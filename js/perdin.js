const db = new Dexie('eSPPD_Tabundung_DB');
db.version(1).stores({
    records: '++id, noSuratTugas, kodeSubKegiatan, namaPelaksana, tglMulai',
    asnMaster: 'nip, nama, jabatan, pangkat',
    settings: 'key, value'
});

document.addEventListener("DOMContentLoaded", async () => {
    const records = await db.records.toArray();
    const totalRealisasi = records.length; // Asumsi sederhana
    document.getElementById("statRealisasiOH").textContent = `${totalRealisasi} OH`;
    document.getElementById("statSisaOH").textContent = `${202 - totalRealisasi} OH`;
});
