/**
 * js/db.js - Layer Akses & Manajemen Data Terpusat
 * Aplikasi e-SPPD & Rekapitulasi Perdin Kecamatan Tabundung
 * Mengintegrasikan Dexie.js (IndexedDB Offline), Supabase Client (Cloud), 
 * dan LocalStorage Sync secara transparan.
 */

// ==========================================
// 1. KONFIGURASI SUPABASE CLIENT
// ==========================================
const SUPABASE_URL = 'https://offeebouiohweqlgyccx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mZmVlYm91aW9od2VxbGd5Y2N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMzEwOTYsImV4cCI6MjEwNjkwNzA5Nn0.IuJLePe6ZvPABvuSFVpwFjiM3TGiIH_4zah8fUvEfbw';

let supabaseClient = null;
if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ==========================================
// 2. KONFIGURASI DEXIE (OFFLINE INDEXEDDB)
// ==========================================
let localDexieDB = null;
if (typeof window !== 'undefined' && window.Dexie) {
    localDexieDB = new window.Dexie('PerdinTabundungDB');
    localDexieDB.version(1).stores({
        riwayat_perdin: 'id, no_sppd, tanggal, tujuan, pelaksana, sub_kegiatan, jumlah_oh, sinkron',
        master_asn: 'nip, nama, pangkat, jabatan'
    });
}

// ==========================================
// 3. LAYER DATA API TERPUSAT (AppDB)
// ==========================================
const AppDB = {
    supabase: supabaseClient,
    dexie: localDexieDB,

    isOnline() {
        return typeof navigator !== 'undefined' && navigator.onLine;
    },

    // --------------------------------------
    // MANAJEMEN MASTER DATA ASN
    // --------------------------------------
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

    // --------------------------------------
    // MANAJEMEN RIWAYAT PERDIN & REKAP
    // --------------------------------------
    async getAllRecords() {
        let records = [];

        // Prioritas 1: Supabase jika Online
        if (this.isOnline() && this.supabase) {
            try {
                const { data, error } = await this.supabase
                    .from('riwayat_perdin')
                    .select('*')
                    .order('createdAt', { ascending: false });

                if (!error && data && data.length > 0) {
                    records = data;
                    if (this.dexie) {
                        await this.dexie.riwayat_perdin.clear();
                        await this.dexie.riwayat_perdin.bulkAdd(data.map(r => ({
                            id: r.id,
                            no_sppd: r.noSPPD || r.no_sppd,
                            tanggal: r.tglMulai || r.tanggal,
                            tujuan: r.tempatTujuan || r.tujuan,
                            pelaksana: r.namaPelaksana || r.pelaksana,
                            sub_kegiatan: r.kodeSK || r.sub_kegiatan || '7.01.01.2.01.0003',
                            jumlah_oh: (1 + (r.pengikut?.length || 0)) * (r.lamaHari || 1),
                            sinkron: 1
                        })));
                    }
                    localStorage.setItem('sppd_records_tabundung', JSON.stringify(records));
                    return records;
                }
            } catch (err) {
                console.warn("Supabase fetch failed, fallback ke local storage:", err);
            }
        }

        // Prioritas 2: LocalStorage Cache
        const saved = localStorage.getItem('sppd_records_tabundung');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { console.error(e); }
        }

        // Prioritas 3: Dexie IndexedDB
        if (this.dexie) {
            records = await this.dexie.riwayat_perdin.toArray();
        }

        return records;
    },

    async saveRecord(record) {
        // Simpan ke LocalStorage
        const existing = JSON.parse(localStorage.getItem('sppd_records_tabundung') || '[]');
        existing.unshift(record);
        localStorage.setItem('sppd_records_tabundung', JSON.stringify(existing));

        // Simpan ke Dexie (IndexedDB)
        if (this.dexie) {
            await this.dexie.riwayat_perdin.put({
                id: record.id,
                no_sppd: record.noSPPD,
                tanggal: record.tglMulai,
                tujuan: record.tempatTujuan,
                pelaksana: record.namaPelaksana,
                sub_kegiatan: record.kodeSK || '7.01.01.2.01.0003',
                jumlah_oh: (1 + (record.pengikut?.length || 0)) * (record.lamaHari || 1),
                sinkron: this.isOnline() ? 1 : 0
            });
        }

        // Sinkronisasi ke Supabase Cloud
        if (this.isOnline() && this.supabase) {
            try {
                await this.supabase.from('riwayat_perdin').insert([record]);
            } catch (err) {
                console.error("Gagal sync record ke Supabase:", err);
            }
        }
    },

    async deleteRecord(recordId) {
        let existing = JSON.parse(localStorage.getItem('sppd_records_tabundung') || '[]');
        existing = existing.filter(r => r.id != recordId);
        localStorage.setItem('sppd_records_tabundung', JSON.stringify(existing));

        if (this.dexie) {
            await this.dexie.riwayat_perdin.delete(recordId);
        }

        if (this.isOnline() && this.supabase) {
            try {
                await this.supabase.from('riwayat_perdin').delete().eq('id', recordId);
            } catch (err) {
                console.error("Gagal hapus record di Supabase:", err);
            }
        }
    }
};

if (typeof window !== 'undefined') {
    window.AppDB = AppDB;
}
