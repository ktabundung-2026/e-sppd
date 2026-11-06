/**
 * js/db.js - Layer Akses & Manajemen Data Terpusat (Offline-First)
 * Aplikasi e-SPPD & Rekapitulasi Perdin Kecamatan Tabundung
 */

const SUPABASE_URL = 'https://offeebouiohweqlgyccx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mZmVlYm91aW9od2VxbGd5Y2N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMzEwOTYsImV4cCI6MjEwNjkwNzA5Nn0.IuJLePe6ZvPABvuSFVpwFjiM3TGiIH_4zah8fUvEfbw';

let supabaseClient = null;
if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

let localDexieDB = null;
if (typeof window !== 'undefined' && window.Dexie) {
    localDexieDB = new window.Dexie('PerdinTabundungDB');
    localDexieDB.version(4).stores({
        riwayat_perdin: 'id, no_sppd, tanggal, tujuan, pelaksana, sub_kegiatan, jumlah_oh, foto_bukti, sinkron',
        master_pelaksana: '++id, nip, nama_pelaksana, pangkat, jabatan',
        master_sk: 'kode, nama, quota'
    });
}

const AppDB = {
    supabase: supabaseClient,
    dexie: localDexieDB,

    isOnline() {
        return typeof navigator !== 'undefined' && navigator.onLine;
    },

    async syncOfflineData() {
        if (!this.isOnline() || !this.supabase || !this.dexie) return;

        try {
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
    // MANAJEMEN MASTER PELAKSANA / ASN (HURUF KAPITAL UNTUK NAMA)
    // ----------------------------------------------------
    async getMasterAsn() {
        let asnList = [];
        const saved = localStorage.getItem('sppd_master_asn');
        if (saved) {
            try { asnList = JSON.parse(saved); } catch (e) { asnList = []; }
        }

        if (this.isOnline() && this.supabase) {
            try {
                const { data, error } = await this.supabase.from('master_pelaksana').select('*').order('nama_pelaksana', { ascending: true });
                if (!error && data && data.length > 0) {
                    asnList = data.map(item => ({
                        id: item.id,
                        nama: item.nama_pelaksana ? item.nama_pelaksana.toUpperCase() : '',
                        nip: item.nip,
                        jabatan: item.jabatan,
                        pangkat: item.pangkat || '-'
                    }));
                    localStorage.setItem('sppd_master_asn', JSON.stringify(asnList));
                    if (this.dexie) {
                        await this.dexie.master_pelaksana.clear();
                        await this.dexie.master_pelaksana.bulkPut(data);
                    }
                }
            } catch (e) { console.warn("Fetch master_pelaksana Supabase gagal, fallback lokal:", e); }
        } else if (asnList.length === 0 && this.dexie) {
            const localList = await this.dexie.master_pelaksana.toArray();
            if (localList && localList.length > 0) {
                asnList = localList.map(item => ({
                    id: item.id,
                    nama: item.nama_pelaksana ? item.nama_pelaksana.toUpperCase() : '',
                    nip: item.nip,
                    jabatan: item.jabatan,
                    pangkat: item.pangkat || '-'
                }));
            }
        }

        return asnList;
    },

    async saveMasterAsn(asnObj) {
        const payload = {
            nama_pelaksana: asnObj.nama ? asnObj.nama.toUpperCase() : '',
            nip: asnObj.nip,
            jabatan: asnObj.jabatan,
            pangkat: asnObj.pangkat || '-'
        };

        const currentList = JSON.parse(localStorage.getItem('sppd_master_asn') || '[]');
        const existingIdx = currentList.findIndex(a => a.nip === asnObj.nip);
        if (existingIdx >= 0) currentList[existingIdx] = { ...asnObj, nama: payload.nama_pelaksana };
        else currentList.push({ ...asnObj, nama: payload.nama_pelaksana });

        localStorage.setItem('sppd_master_asn', JSON.stringify(currentList));
        if (this.dexie) await this.dexie.master_pelaksana.put(payload);

        if (this.isOnline() && this.supabase) {
            try {
                await this.supabase.from('master_pelaksana').upsert([payload], { onConflict: 'nip' });
            } catch (err) { console.error("Gagal simpan master_pelaksana ke Supabase:", err); }
        }
        return true;
    },

    async bulkSaveMasterAsn(asnArray) {
        const payload = asnArray.map(a => ({
            nama_pelaksana: a.nama ? a.nama.toUpperCase() : '',
            nip: a.nip,
            jabatan: a.jabatan,
            pangkat: a.pangkat || '-'
        }));

        const formattedList = asnArray.map(a => ({
            ...a,
            nama: a.nama ? a.nama.toUpperCase() : ''
        }));

        localStorage.setItem('sppd_master_asn', JSON.stringify(formattedList));
        if (this.dexie) {
            await this.dexie.master_pelaksana.clear();
            await this.dexie.master_pelaksana.bulkPut(payload);
        }

        if (this.isOnline() && this.supabase) {
            try {
                await this.supabase.from('master_pelaksana').upsert(payload, { onConflict: 'nip' });
            } catch (err) { console.error("Gagal bulk save ke Supabase:", err); }
        }
        return true;
    },

    async deleteMasterAsn(nip) {
        let currentList = JSON.parse(localStorage.getItem('sppd_master_asn') || '[]');
        currentList = currentList.filter(a => a.nip !== nip);
        localStorage.setItem('sppd_master_asn', JSON.stringify(currentList));

        if (this.dexie) {
            const match = await this.dexie.master_pelaksana.where('nip').equals(nip).first();
            if (match) await this.dexie.master_pelaksana.delete(match.id);
        }

        if (this.isOnline() && this.supabase) {
            try {
                await this.supabase.from('master_pelaksana').delete().eq('nip', nip);
            } catch (err) { console.error("Gagal hapus di Supabase:", err); }
        }
    },

    // ----------------------------------------------------
    // MANAJEMEN MASTER SUB KEGIATAN (SK)
    // ----------------------------------------------------
    async getMasterSK() {
        const saved = localStorage.getItem('sppd_custom_sk_list');
        let skList = saved ? JSON.parse(saved) : [];

        if (this.isOnline() && this.supabase) {
            try {
                const { data, error } = await this.supabase.from('master_sk').select('*').order('created_at', { ascending: true });
                if (!error && data && data.length > 0) {
                    skList = data;
                    localStorage.setItem('sppd_custom_sk_list', JSON.stringify(skList));
                    if (this.dexie) {
                        await this.dexie.master_sk.clear();
                        await this.dexie.master_sk.bulkPut(data.map(i => ({ kode: i.kode, nama: i.nama, quota: i.quota || 50 })));
                    }
                }
            } catch (e) { console.warn("Fetch Supabase gagal, menggunakan cache lokal", e); }
        } else if (skList.length === 0 && this.dexie) {
            skList = await this.dexie.master_sk.toArray();
        }

        return skList;
    },

    async saveMasterSK(skObj) {
        const quotaVal = parseInt(skObj.quota) || 50;
        const payload = { kode: skObj.kode, nama: skObj.nama, quota: quotaVal };

        const customSK = JSON.parse(localStorage.getItem('sppd_custom_sk_list') || '[]');
        const idx = customSK.findIndex(item => item.kode === skObj.kode);
        if (idx >= 0) customSK[idx] = payload;
        else customSK.push(payload);
        
        localStorage.setItem('sppd_custom_sk_list', JSON.stringify(customSK));
        if (this.dexie) await this.dexie.master_sk.put(payload);

        if (this.isOnline() && this.supabase) {
            try {
                await this.supabase.from('master_sk').upsert([payload], { onConflict: 'kode' });
            } catch (err) { console.error("Gagal simpan ke Supabase:", err); }
        }

        return true;
    },

    async deleteMasterSK(kodeSK) {
        let customSK = JSON.parse(localStorage.getItem('sppd_custom_sk_list') || '[]');
        customSK = customSK.filter(item => item.kode !== kodeSK);
        localStorage.setItem('sppd_custom_sk_list', JSON.stringify(customSK));

        if (this.dexie) await this.dexie.master_sk.delete(kodeSK);

        if (this.isOnline() && this.supabase) {
            try {
                await this.supabase.from('master_sk').delete().eq('kode', kodeSK);
            } catch (err) { console.error("Gagal hapus SK di Supabase:", err); }
        }
    },

    // ----------------------------------------------------
    // MANAJEMEN RIWAYAT PERDIN
    // ----------------------------------------------------
    async getAllRecords() {
        const saved = localStorage.getItem('sppd_records_tabundung');
        let records = saved ? JSON.parse(saved) : [];

        if (this.isOnline() && this.supabase) {
            try {
                const { data, error } = await this.supabase.from('riwayat_perdin').select('*').order('createdAt', { ascending: false });
                if (!error && data && data.length > 0) {
                    records = data;
                    localStorage.setItem('sppd_records_tabundung', JSON.stringify(records));
                }
            } catch (err) { console.warn("Fallback ke penyimpanan lokal:", err); }
        }

        return records;
    },

    async saveRecord(record) {
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
