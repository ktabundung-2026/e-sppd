/**
 * js/db.js - Layer Akses & Manajemen Data Terpusat
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
    localDexieDB.version(2).stores({
        riwayat_perdin: 'id, no_sppd, tanggal, tujuan, pelaksana, sub_kegiatan, jumlah_oh, sinkron',
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
    // MANAJEMEN MASTER SUB KEGIATAN (SK & KUOTA)
    // --------------------------------------
    async getMasterSK() {
        let skList = [];

        if (this.isOnline() && this.supabase) {
            try {
                const { data, error } = await this.supabase
                    .from('master_sk')
                    .select('*')
                    .order('created_at', { ascending: true });

                if (!error && data && data.length > 0) {
                    skList = data;
                    if (this.dexie) {
                        await this.dexie.master_sk.clear();
                        await this.dexie.master_sk.bulkPut(data.map(item => ({
                            kode: item.kode,
                            nama: item.nama,
                            quota: item.quota || 50
                        })));
                    }
                    localStorage.setItem('sppd_custom_sk_list', JSON.stringify(skList));
                    return skList;
                }
            } catch (err) {
                console.warn("Gagal dari tabel Supabase, fallback ke storage lokal:", err);
            }
        }

        const saved = localStorage.getItem('sppd_custom_sk_list');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { console.error(e); }
        }

        if (this.dexie) {
            skList = await this.dexie.master_sk.toArray();
        }

        return skList;
    },

    async saveMasterSK(skObj) {
        const quotaVal = parseInt(skObj.quota) || 50;
        const payload = {
            kode: skObj.kode,
            nama: skObj.nama,
            quota: quotaVal
        };

        if (this.isOnline() && this.supabase) {
            try {
                const { data, error } = await this.supabase
                    .from('master_sk')
                    .upsert([payload], { onConflict: 'kode' })
                    .select();

                if (error) {
                    console.error("Gagal simpan master_sk ke Supabase:", error);
                    alert(`[Supabase Error] Gagal simpan: ${error.message}`);
                    return false;
                }
            } catch (err) {
                console.error("Error jaringan ke Supabase:", err);
                alert(`[Error Jaringan] ${err.message}`);
                return false;
            }
        }

        const customSK = JSON.parse(localStorage.getItem('sppd_custom_sk_list') || '[]');
        const idx = customSK.findIndex(item => item.kode === skObj.kode);
        if (idx >= 0) {
            customSK[idx] = payload;
        } else {
            customSK.push(payload);
        }
        localStorage.setItem('sppd_custom_sk_list', JSON.stringify(customSK));

        const quotas = JSON.parse(localStorage.getItem('sppd_sk_quotas') || '{}');
        quotas[skObj.kode] = quotaVal;
        localStorage.setItem('sppd_sk_quotas', JSON.stringify(quotas));

        if (this.dexie) {
            await this.dexie.master_sk.put(payload);
        }

        return true;
    },

    async deleteMasterSK(kode) {
        if (this.isOnline() && this.supabase) {
            try {
                const { error } = await this.supabase
                    .from('master_sk')
                    .delete()
                    .eq('kode', kode);
                if (error) console.error("Gagal hapus di Supabase:", error);
            } catch (err) {
                console.error("Error hapus Supabase:", err);
            }
        }

        let customSK = JSON.parse(localStorage.getItem('sppd_custom_sk_list') || '[]');
        customSK = customSK.filter(sk => sk.kode !== kode);
        localStorage.setItem('sppd_custom_sk_list', JSON.stringify(customSK));

        if (this.dexie) {
            await this.dexie.master_sk.delete(kode);
        }
        return true;
    },

    // --------------------------------------
    // MANAJEMEN RIWAYAT PERDIN & REKAP
    // --------------------------------------
    async getAllRecords() {
        let records = [];
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
                console.warn("Fetch failed, fallback ke local storage:", err);
            }
        }

        const saved = localStorage.getItem('sppd_records_tabundung');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { console.error(e); }
        }

        if (this.dexie) {
            records = await this.dexie.riwayat_perdin.toArray();
        }

        return records;
    },

    async saveRecord(record) {
        const existing = JSON.parse(localStorage.getItem('sppd_records_tabundung') || '[]');
        existing.unshift(record);
        localStorage.setItem('sppd_records_tabundung', JSON.stringify(existing));

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

        if (this.isOnline() && this.supabase) {
            try {
                await this.supabase.from('riwayat_perdin').insert([record]);
            } catch (err) {
                console.error("Gagal sync record", err);
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
                console.error("Gagal hapus record", err);
            }
        }
    }
};

if (typeof window !== 'undefined') {
    window.AppDB = AppDB;
}
