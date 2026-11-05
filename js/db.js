/**
 * js/db.js - Layer Akses & Manajemen Data Terpusat (Offline-First)
 * Aplikasi e-SPPD & Rekapitulasi Perdin Kecamatan Tabundung
 */

const SUPABASE_URL = 'https://offeebouiohweqlgyccx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mZmVlYm91aW9od2VxbGd5Y2N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMzEwOTYsImV4cCI6MjEwNjkwNzA5Nn0.IuJLePe6ZvPABvuSFVpwFjiM3TGiIH_4zah8fUvEfbw';
const DEFAULT_BUCKET = 'image';

let supabaseClient = null;
if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

let localDexieDB = null;
if (typeof window !== 'undefined' && window.Dexie) {
    localDexieDB = new window.Dexie('PerdinTabundungDB');
    localDexieDB.version(3).stores({
        riwayat_perdin: 'id, no_sppd, tanggal, tujuan, pelaksana, sub_kegiatan, jumlah_oh, foto_bukti, sinkron',
        master_asn: 'nip, nama, pangkat, jabatan',
        master_sk: 'kode, nama, quota'
    });
}

const AppDB = {
    supabase: supabaseClient,
    dexie: localDexieDB,

    isOnline() {
        return typeof navigator !== 'undefined' && navigator.onLine;
    },

    // ----------------------------------------------------
    // SINKRONISASI OTOMATIS SAAT KONEKSI ONLINE KEMBALI
    // ----------------------------------------------------
    async syncOfflineData() {
        if (!this.isOnline() || !this.supabase || !this.dexie) return;

        try {
            // Ambil data lokal yang belum tersinkron ke server database
            const unsyncedRecords = await this.dexie.riwayat_perdin.where('sinkron').equals(0).toArray();
            if (unsyncedRecords.length > 0) {
                console.log(`[Sync Engine] Mengunggah ${unsyncedRecords.length} data offline ke Supabase...`);
                
                const localRecords = JSON.parse(localStorage.getItem('sppd_records_tabundung') || '[]');
                
                for (const item of unsyncedRecords) {
                    const fullRecord = localRecords.find(r => r.id == item.id);
                    if (fullRecord) {
                        const { error } = await this.supabase.from('riwayat_perdin').upsert([fullRecord]);
                        if (!error) {
                            await this.dexie.riwayat_perdin.update(item.id, { sinkron: 1 });
                        }
                    }
                }
                console.log('[Sync Engine] Sinkronisasi selesai!');
            }
        } catch (err) {
            console.error('[Sync Engine Error]', err);
        }
    },

    // ----------------------------------------------------
    // MANAJEMEN MASTER DATA ASN
    // ----------------------------------------------------
    async getMasterAsn() {
        const saved = localStorage.getItem('sppd_master_asn');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { console.error(e); }
        }
        if (this.dexie) {
            const list = await this.dexie.master_asn.toArray();
            if (list && list.length > 0) {
                localStorage.setItem('sppd_master_asn', JSON.stringify(list));
                return list;
            }
        }
        return [];
    },

    async saveMasterAsn(asnList) {
        localStorage.setItem('sppd_master_asn', JSON.stringify(asnList));
        if (this.dexie) {
            await this.dexie.master_asn.clear();
            await this.dexie.master_asn.bulkAdd(asnList);
        }
    },

    // ----------------------------------------------------
    // MANAJEMEN MASTER SUB KEGIATAN (SK)
    // ----------------------------------------------------
    async getMasterSK() {
        let skList = [];
        if (this.isOnline() && this.supabase) {
            try {
                const { data, error } = await this.supabase.from('master_sk').select('*').order('created_at', { ascending: true });
                if (!error && data && data.length > 0) {
                    skList = data;
                    if (this.dexie) {
                        await this.dexie.master_sk.clear();
                        await this.dexie.master_sk.bulkPut(data.map(i => ({ kode: i.kode, nama: i.nama, quota: i.quota || 50 })));
                    }
                    localStorage.setItem('sppd_custom_sk_list', JSON.stringify(skList));
                    return skList;
                }
            } catch (e) { console.warn("Fetch Supabase gagal, menggunakan cache lokal", e); }
        }

        const saved = localStorage.getItem('sppd_custom_sk_list');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { console.error(e); }
        }
        if (this.dexie) skList = await this.dexie.master_sk.toArray();
        return skList;
    },

    async saveMasterSK(skObj) {
        const quotaVal = parseInt(skObj.quota) || 50;
        const payload = { kode: skObj.kode, nama: skObj.nama, quota: quotaVal };

        if (this.isOnline() && this.supabase) {
            try {
                await this.supabase.from('master_sk').upsert([payload], { onConflict: 'kode' });
            } catch (err) { console.error("Gagal simpan ke Supabase:", err); }
        }

        const customSK = JSON.parse(localStorage.getItem('sppd_custom_sk_list') || '[]');
        const idx = customSK.findIndex(item => item.kode === skObj.kode);
        if (idx >= 0) customSK[idx] = payload;
        else customSK.push(payload);
        
        localStorage.setItem('sppd_custom_sk_list', JSON.stringify(customSK));
        if (this.dexie) await this.dexie.master_sk.put(payload);
        return true;
    },

    // ----------------------------------------------------
    // MANAJEMEN RIWAYAT PERDIN (OFFLINE & ONLINE STORAGE)
    // ----------------------------------------------------
    async getAllRecords() {
        let records = [];
        if (this.isOnline() && this.supabase) {
            try {
                const { data, error } = await this.supabase.from('riwayat_perdin').select('*').order('createdAt', { ascending: false });
                if (!error && data && data.length > 0) {
                    records = data;
                    localStorage.setItem('sppd_records_tabundung', JSON.stringify(records));
                    return records;
                }
            } catch (err) { console.warn("Fallback ke penyimpanan lokal:", err); }
        }

        const saved = localStorage.getItem('sppd_records_tabundung');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { console.error(e); }
        }
        return records;
    },

    async saveRecord(record) {
        // 1. Simpan Sementara di Local Storage & IndexedDB (Selalu Berhasil Offline/Online)
        const existing = JSON.parse(localStorage.getItem('sppd_records_tabundung') || '[]');
        existing.unshift(record);
        localStorage.setItem('sppd_records_tabundung', JSON.stringify(existing));

        const isOnlineNow = this.isOnline();

        if (this.dexie) {
            await this.dexie.riwayat_perdin.put({
                id: record.id,
                no_sppd: record.noSPPD,
                tanggal: record.tglMulai,
                tujuan: record.tempatTujuan,
                pelaksana: record.namaPelaksana,
                sub_kegiatan: record.kodeSK || '7.01.01.2.01.0003',
                jumlah_oh: (1 + (record.pengikut?.length || 0)) * (record.lamaHari || 1),
                foto_bukti: '',
                sinkron: isOnlineNow ? 1 : 0
            });
        }

        // 2. Jika Online, Langsung Kirim ke Database Server
        if (isOnlineNow && this.supabase) {
            try {
                await this.supabase.from('riwayat_perdin').insert([record]);
            } catch (err) {
                console.error("Gagal sync online, tersimpan di queue local", err);
            }
        }
    },

    async deleteRecord(recordId) {
        let existing = JSON.parse(localStorage.getItem('sppd_records_tabundung') || '[]');
        existing = existing.filter(r => r.id != recordId);
        localStorage.setItem('sppd_records_tabundung', JSON.stringify(existing));

        if (this.dexie) await this.dexie.riwayat_perdin.delete(recordId);

        if (this.isOnline() && this.supabase) {
            try {
                await this.supabase.from('riwayat_perdin').delete().eq('id', recordId);
            } catch (err) { console.error("Gagal hapus di database online:", err); }
        }
    }
};

if (typeof window !== 'undefined') {
    window.AppDB = AppDB;
    window.addEventListener('online', () => AppDB.syncOfflineData());
}
