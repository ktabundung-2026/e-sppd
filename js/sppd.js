/*
  ====================================================================================
  Nama Aplikasi : Sistem e - SPPD Terpadu - Kecamatan Tabundung
  Hosting       : GitHub Pages (Murni Single Page Application / SPA)
  Backend / DB  : Supabase REST API & Supabase Storage
  Nama Halaman  : js/rekap.js
  Fungsi Halaman: Logika pengolah data rekapitulasi realisasi perjalanan dinas, 
                  perhitungan akumulasi Orang Hari (OH) per Sub Kegiatan, 
                  visualisasi batas kuota, serta pemfilteran dan pencarian rekap.
  ====================================================================================
*/

let masterASN = [];
let masterSK = [];
let daftarPengikut = [];
let riwayatSPPD = [];

// Urutan Bobot Hirarki Jabatan Kedinasan
const HIRARKI_JABATAN = [
    { keyword: "CAMAT", rank: 1 },
    { keyword: "SEKRETARIS CAMAT", rank: 2 },
    { keyword: "SEKCAM", rank: 2 },
    { keyword: "KEPALA SEKSI", rank: 3 },
    { keyword: "KASI", rank: 3 },
    { keyword: "KEPALA SUB BAGIAN", rank: 3 },
    { keyword: "KASUBAG", rank: 3 },
    { keyword: "JABATAN FUNGSIONAL", rank: 4 },
    { keyword: "PENATA", rank: 4 },
    { keyword: "PENGELOLA", rank: 5 },
    { keyword: "PELAKSANA", rank: 5 },
    { keyword: "STAF", rank: 5 },
    { keyword: "OPERATOR", rank: 6 },
    { keyword: "PPPK", rank: 7 },
    { keyword: "HONOR", rank: 8 }
];

document.addEventListener('DOMContentLoaded', async () => {
    await loadInitialData();
    populateSelects();
    renderPengikutTable();
    updateSKQuotaInfo();
    hitungLamaHariOtomatis();
});

/**
 * Mengurutkan array ASN berdasarkan Hirarki Jabatan
 */
function sortASNByHirarki(list) {
    return list.sort((a, b) => {
        const getRank = (jabatan) => {
            if (!jabatan) return 99;
            const uppercaseJab = jabatan.toUpperCase();
            for (let item of HIRARKI_JABATAN) {
                if (uppercaseJab.includes(item.keyword)) return item.rank;
            }
            return 50;
        };

        const rankA = getRank(a.jabatan);
        const rankB = getRank(b.jabatan);

        if (rankA !== rankB) return rankA - rankB;
        return (a.nama || '').localeCompare(b.nama || '');
    });
}

/**
 * Memuat Data awal dari AppDB (js/db.js)
 */
async function loadInitialData() {
    try {
        if (window.AppDB) {
            masterASN = await window.AppDB.getMasterAsn();
            masterSK = await window.AppDB.getMasterSK();
            riwayatSPPD = await window.AppDB.getAllRecords();
        }
    } catch (err) {
        console.error("Gagal memuat data master dari AppDB:", err);
    }
    masterASN = sortASNByHirarki(masterASN);
}

/**
 * Mengisi Dropdown Form
 */
function populateSelects() {
    // 1. Dropdown Pelaksana Utama
    const selPelaksana = document.getElementById('namaPelaksana');
    if (selPelaksana) {
        selPelaksana.innerHTML = '<option value="">-- Pilih Pelaksana Utama --</option>';
        masterASN.forEach(asn => {
            selPelaksana.innerHTML += `<option value="${asn.nama}">${asn.nama}</option>`;
        });
    }

    // 2. Dropdown Bendahara
    const selBendahara = document.getElementById('selectBendahara');
    if (selBendahara) {
        selBendahara.innerHTML = '<option value="">-- Pilih Bendahara Pengeluaran --</option>';
        masterASN.forEach(asn => {
            selBendahara.innerHTML += `<option value="${asn.nama}">${asn.nama}</option>`;
        });
    }

    // 3. Dropdown Kode SK
    const selSK = document.getElementById('step1_kodeSK');
    if (selSK) {
        selSK.innerHTML = '<option value="">Pilih Sub Kegiatan</option>';
        masterSK.forEach(sk => {
            const quotaVal = sk.quota || sk.kuota || 50;
            selSK.innerHTML += `<option value="${sk.kode}">${sk.kode} - ${sk.nama} (Kuota: ${quotaVal} OH)</option>`;
        });
    }
    
    renderAsnMasterTable();
    renderSKMasterTable();
    renderHistoryTable();
}

/**
 * Auto-fill Pelaksana Utama
 */
function autoFillPelaksanaUtama() {
    const namaVal = document.getElementById('namaPelaksana').value;
    const selected = masterASN.find(item => item.nama === namaVal);

    if (selected) {
        document.getElementById('nipPelaksana').value = selected.nip || '-';
        document.getElementById('pangkatPelaksana').value = selected.pangkat || '-';
        document.getElementById('jabatanPelaksana').value = selected.jabatan || '-';
    } else {
        document.getElementById('nipPelaksana').value = '';
        document.getElementById('pangkatPelaksana').value = '';
        document.getElementById('jabatanPelaksana').value = '';
    }
}

function onBendaharaSelected(namaVal) {
    const selected = masterASN.find(item => item.nama === namaVal);
    document.getElementById('nipBendahara').value = selected ? (selected.nip || '') : '';
}

function syncTujuanPerdin(val) {
    document.getElementById('tempatTujuan').value = val;
}

/**
 * Manajamen Pengikut
 */
function addPengikutRow() {
    daftarPengikut.push({
        id: Date.now(),
        nama: '',
        nip: '',
        pangkat: '',
        jabatan: ''
    });
    renderPengikutTable();
}

function removePengikutRow(index) {
    daftarPengikut.splice(index, 1);
    renderPengikutTable();
    updateSKQuotaInfo();
}

function onSelectPengikut(index, namaSelected) {
    const selectedAsn = masterASN.find(item => item.nama === namaSelected);
    if (selectedAsn) {
        daftarPengikut[index].nama = selectedAsn.nama;
        daftarPengikut[index].nip = selectedAsn.nip || '-';
        daftarPengikut[index].pangkat = selectedAsn.pangkat || '-';
        daftarPengikut[index].jabatan = selectedAsn.jabatan || '-';
    } else {
        daftarPengikut[index].nama = namaSelected;
        daftarPengikut[index].nip = '';
        daftarPengikut[index].pangkat = '';
        daftarPengikut[index].jabatan = '';
    }
    renderPengikutTable();
    updateSKQuotaInfo();
}

function renderPengikutTable() {
    const tbody = document.getElementById('tbody-pengikut');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (daftarPengikut.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="p-3 text-center text-slate-400 italic">
                    Belum ada pengikut yang ditambahkan.
                </td>
            </tr>
        `;
        return;
    }

    daftarPengikut.forEach((item, index) => {
        let options = `<option value="">-- Pilih ASN --</option>`;
        masterASN.forEach(asn => {
            const isSelected = asn.nama === item.nama ? 'selected' : '';
            options += `<option value="${asn.nama}" ${isSelected}>${asn.nama}</option>`;
        });

        const rowHTML = `
            <tr class="hover:bg-slate-50 transition">
                <td class="p-2.5 text-center font-bold text-slate-600">${index + 1}</td>
                <td class="p-2.5">
                    <select onchange="onSelectPengikut(${index}, this.value)" class="w-full p-1.5 text-xs border rounded border-slate-300 font-semibold bg-white uppercase-input">
                        ${options}
                    </select>
                </td>
                <td class="p-2.5">
                    <input type="text" value="${item.nip || ''}" readonly class="w-full p-1.5 text-xs border rounded font-mono bg-slate-100">
                </td>
                <td class="p-2.5">
                    <input type="text" value="${item.pangkat || ''}" readonly class="w-full p-1.5 text-xs border rounded font-semibold bg-slate-100 capitalize-input">
                </td>
                <td class="p-2.5">
                    <input type="text" value="${item.jabatan || ''}" readonly class="w-full p-1.5 text-xs border rounded font-semibold bg-slate-100 capitalize-input">
                </td>
                <td class="p-2.5 text-center">
                    <button type="button" onclick="removePengikutRow(${index})" class="text-rose-600 hover:text-rose-800 p-1 font-bold" title="Hapus Pengikut">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', rowHTML);
    });
}

/**
 * Perhitungan Otomatis
 */
function hitungLamaHariOtomatis() {
    const tglMulai = document.getElementById('tglMulai').value;
    const tglKembali = document.getElementById('tglKembali').value;

    if (tglMulai && tglKembali) {
        const d1 = new Date(tglMulai);
        const d2 = new Date(tglKembali);
        const selisihMs = d2 - d1;
        const diffDays = Math.ceil(selisihMs / (1000 * 60 * 60 * 24)) + 1;
        document.getElementById('lamaHari').value = diffDays > 0 ? diffDays : 1;
    }
    updateSKQuotaInfo();
}

function updateSKQuotaInfo() {
    const lamaHari = parseInt(document.getElementById('lamaHari').value) || 1;
    const biayaPerOrang = parseFloat(document.getElementById('biayaPerOrang').value) || 0;
    const jumlahPersonel = 1 + daftarPengikut.length;
    const totalBiaya = lamaHari * biayaPerOrang * jumlahPersonel;

    document.getElementById('totalBiayaFormatted').value = "Rp " + totalBiaya.toLocaleString('id-ID');
    document.getElementById('terbilang').value = angkaKeTerbilang(totalBiaya) + " Rupiah";
}

function angkaKeTerbilang(nilai) {
    const huruf = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
    let temp = "";
    if (nilai < 12) temp = " " + huruf[nilai];
    else if (nilai < 20) temp = angkaKeTerbilang(nilai - 10) + " Belas";
    else if (nilai < 100) temp = angkaKeTerbilang(Math.floor(nilai / 10)) + " Puluh" + angkaKeTerbilang(nilai % 10);
    else if (nilai < 200) temp = " Seratus" + angkaKeTerbilang(nilai - 100);
    else if (nilai < 1000) temp = angkaKeTerbilang(Math.floor(nilai / 100)) + " Ratus" + angkaKeTerbilang(nilai % 100);
    else if (nilai < 2000) temp = " Seribu" + angkaKeTerbilang(nilai - 1000);
    else if (nilai < 1000000) temp = angkaKeTerbilang(Math.floor(nilai / 1000)) + " Ribu" + angkaKeTerbilang(nilai % 1000);
    else if (nilai < 1000000000) temp = angkaKeTerbilang(Math.floor(nilai / 1000000)) + " Juta" + angkaKeTerbilang(nilai % 1000000);
    return temp.trim();
}

/**
 * Stepper Navigasi
 */
function switchStep(step) {
    for (let i = 1; i <= 3; i++) {
        const content = document.getElementById(`step-content-${i}`);
        const icon = document.getElementById(`step-icon-${i}`);
        const label = document.getElementById(`step-label-${i}`);

        if (i === step) {
            content.classList.remove('hidden');
            icon.className = "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-gov-700 text-white shadow-md transition-all";
            label.className = "text-xs font-bold text-gov-800 mt-1";
        } else {
            content.classList.add('hidden');
            icon.className = "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-slate-200 text-slate-600 transition-all";
            label.className = "text-xs font-medium text-slate-500 mt-1";
        }
    }
}

function proceedToStep2() {
    const kodeSK = document.getElementById('step1_kodeSK').value;
    if (!kodeSK) {
        alert("Silakan pilih Sub Kegiatan terlebih dahulu.");
        return;
    }
    switchStep(2);
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const lamaHariVal = parseInt(document.getElementById('lamaHari').value) || 1;
    const biayaPerOrangVal = parseFloat(document.getElementById('biayaPerOrang').value) || 0;
    const jumlahPersonel = 1 + (daftarPengikut ? daftarPengikut.length : 0);
    const totalBiayaVal = lamaHariVal * biayaPerOrangVal * jumlahPersonel;

    // Ambil data Bendahara yang dipilih
    const namaBendaharaVal = document.getElementById('selectBendahara').value || '';
    const nipBendaharaVal = document.getElementById('nipBendahara').value || '';

    // Buat Objek Record Presisi Sesuai Header Kolom Supabase
    const record = {
        id: Date.now(),
        noSuratTugas: document.getElementById('noSuratTugas').value || '-',
        noSPPD: document.getElementById('noSPPD').value || '-',
        noBku: '', // opsional / diisi nanti
        kodeSK: document.getElementById('step1_kodeSK').value || '',
        sumberDana: document.getElementById('sumberDana').value || 'DAU',
        dasarPelaksanaan: `DPA Kecamatan Tabundung Kabupaten Sumba Timur Tahun Anggaran 2026`,
        maksudPerdin: document.getElementById('maksudPerdin').value || '-',
        namaPelaksana: document.getElementById('namaPelaksana').value || '-',
        nipPelaksana: document.getElementById('nipPelaksana').value || '-',
        pangkatPelaksana: document.getElementById('pangkatPelaksana').value || '-',
        jabatanPelaksana: document.getElementById('jabatanPelaksana').value || '-',
        pengikut: daftarPengikut || [], // JSONB di Supabase
        tempatBerangkat: document.getElementById('tempatBerangkat').value || 'Malahar',
        tempatTujuan: document.getElementById('tempatTujuan').value || '-',
        alatAngkutan: 'Kendaraan Roda Dua',
        tglMulai: document.getElementById('tglMulai').value || null,
        tglKembali: document.getElementById('tglKembali').value || document.getElementById('tglMulai').value || null,
        lamaHari: lamaHariVal,
        biayaPerOrang: biayaPerOrangVal,
        totalBiaya: totalBiayaVal,
        namaPejabatTujuan: document.getElementById('namaPejabatTujuan').value || '',
        jabatanPejabatTujuan: document.getElementById('jabatanPejabatTujuan').value || '',
        nipPejabatTujuan: '-',
        namaCamat: document.getElementById('namaPenggunaAnggaran').value || 'RUDOLF UMBU RESI LOLY, ST',
        nipCamat: document.getElementById('nipPenggunaAnggaran').value || '197205212006041008',
        pangkatCamat: 'Pembina',
        namaBendahara: namaBendaharaVal,
        nipBendahara: nipBendaharaVal,
        laporanHasil: document.getElementById('laporanHasil').value || '',
        createdAt: new Date().toISOString()
    };

    if (window.AppDB) await window.AppDB.saveRecord(record);
    riwayatSPPD.unshift(record);

    alert("Dokumen SPPD Berhasil Disimpan!");
    renderHistoryTable();
    switchStep(3);
}

// Helper Format Rupiah (contoh: 1200 -> Rp. 1.200)
function formatRupiahRP(angka) {
    const val = parseInt(angka) || 0;
    return "Rp. " + val.toLocaleString('id-ID');
}

// Helper Navigasi ke Halaman Cetak di Tab/Halaman yang Sama
function openCetakPage(id) {
    window.location.href = `cetak.html?id=${id}`;
}

function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!riwayatSPPD || riwayatSPPD.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 italic">Belum ada riwayat perjalanan dinas.</td></tr>`;
        return;
    }

    // 1. Pengelompokan Data Riwayat Berdasarkan Kode SK
    const groupedBySK = {};
    let grandTotalBiaya = 0;

    riwayatSPPD.forEach(item => {
        const kodeSK = item.kodeSK || '7.01.01.2.01.0003';
        if (!groupedBySK[kodeSK]) {
            groupedBySK[kodeSK] = [];
        }
        groupedBySK[kodeSK].push(item);
    });

    // 2. Render Baris Riwayat, Sub Total per SK, dan Total Keseluruhan
    Object.keys(groupedBySK).forEach(kodeSK => {
        let subTotalSK = 0;

        // Header Sub Kegiatan
        tbody.innerHTML += `
            <tr class="bg-gov-900 text-white font-bold">
                <td colspan="6" class="p-2.5 text-xs tracking-wider">
                    <i class="fa-solid fa-folder-open text-sky-300 mr-2"></i> SUB KEGIATAN: ${kodeSK}
                </td>
            </tr>
        `;

        groupedBySK[kodeSK].forEach(item => {
            const totalBiayaVal = parseFloat(item.totalBiaya) || 0;
            subTotalSK += totalBiayaVal;
            grandTotalBiaya += totalBiayaVal;

            tbody.innerHTML += `
                <tr class="hover:bg-slate-50 border-b">
                    <td class="p-3 font-semibold">${item.noSuratTugas || '-'}<br><span class="text-[10px] text-slate-400">${item.noSPPD || '-'}</span></td>
                    <td class="p-3 font-mono">${item.kodeSK || '-'}</td>
                    <td class="p-3 font-bold uppercase">${item.namaPelaksana || item.pelaksanaUtama || '-'}</td>
                    <td class="p-3">${item.tempatTujuan || item.tujuan || '-'}</td>
                    <td class="p-3 font-bold text-emerald-700">${formatRupiahRP(totalBiayaVal)}</td>
                    <td class="p-3 text-center flex items-center justify-center gap-2">
                        <button type="button" onclick="openCetakPage(${item.id})" class="text-sky-600 hover:text-sky-800 font-bold p-1 cursor-pointer" title="Cetak Dokumen">
                            <i class="fa-solid fa-print"></i>
                        </button>
                        <button type="button" onclick="deleteHistoryRecord(${item.id})" class="text-rose-600 hover:text-rose-800 font-bold p-1 cursor-pointer" title="Hapus SPPD">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        // Baris Sub Total Biaya Realisasi Per SK
        tbody.innerHTML += `
            <tr class="bg-sky-50 font-bold border-b-2 border-slate-300">
                <td colspan="4" class="p-2.5 text-right text-gov-900 uppercase text-xs">Sub Total Biaya Realisasi (${kodeSK}) :</td>
                <td class="p-2.5 text-emerald-800 text-xs font-extrabold">${formatRupiahRP(subTotalSK)}</td>
                <td></td>
            </tr>
        `;
    });

    // Baris Total Keseluruhan Biaya Realisasi
    tbody.innerHTML += `
        <tr class="bg-emerald-100 font-extrabold border-t-2 border-emerald-500 text-slate-900">
            <td colspan="4" class="p-3 text-right uppercase text-xs text-emerald-900">TOTAL KESELURUHAN BIAYA REALISASI :</td>
            <td class="p-3 text-emerald-900 text-sm font-extrabold">${formatRupiahRP(grandTotalBiaya)}</td>
            <td></td>
        </tr>
    `;
}

async function deleteHistoryRecord(id) {
    if (!confirm("Hapus data perjalanan dinas ini?")) return;
    if (window.AppDB) await window.AppDB.deleteRecord(id);
    riwayatSPPD = riwayatSPPD.filter(r => r.id != id);
    renderHistoryTable();
}

/**
 * MODAL OPEN / CLOSE
 */
function openModalAsn() { document.getElementById('modalAsn').classList.remove('hidden'); document.getElementById('modalAsn').classList.add('flex'); }
function closeModalAsn() { document.getElementById('modalAsn').classList.add('hidden'); document.getElementById('modalAsn').classList.remove('flex'); }

function openModalSK() { document.getElementById('modalSK').classList.remove('hidden'); document.getElementById('modalSK').classList.add('flex'); }
function closeModalSK() { document.getElementById('modalSK').classList.add('hidden'); document.getElementById('modalSK').classList.remove('flex'); }

function openModalManageSK() { document.getElementById('modalManageSK').classList.remove('hidden'); document.getElementById('modalManageSK').classList.add('flex'); }
function closeModalManageSK() { document.getElementById('modalManageSK').classList.add('hidden'); document.getElementById('modalManageSK').classList.remove('flex'); }

/**
 * MODAL KELOLA MASTER ASN (tabel master_pelaksana)
 */
function renderAsnMasterTable(filteredList = null) {
    const tbody = document.getElementById('asnTableBody');
    const count = document.getElementById('totalAsnCount');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const dataToDisplay = filteredList || masterASN;
    count.textContent = dataToDisplay.length;

    if (dataToDisplay.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-slate-400 italic">Data ASN kosong.</td></tr>`;
        return;
    }

    dataToDisplay.forEach((asn) => {
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition border-b">
                <td class="p-2.5">
                    <div class="font-bold uppercase text-slate-800">${asn.nama}</div>
                    <div class="text-[10px] font-mono text-slate-500">NIP: ${asn.nip || '-'} | Gol: ${asn.pangkat || '-'}</div>
                </td>
                <td class="p-2.5 capitalize-input font-medium text-slate-700">${asn.jabatan || '-'}</td>
                <td class="p-2.5 text-center">
                    <button type="button" onclick="deleteAsnMaster('${asn.nip}')" class="text-rose-600 hover:text-rose-800 font-bold p-1.5 cursor-pointer" title="Hapus ASN">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

function filterAsnTable(keyword) {
    const q = keyword.toLowerCase();
    const filtered = masterASN.filter(item => 
        (item.nama && item.nama.toLowerCase().includes(q)) || 
        (item.nip && item.nip.toLowerCase().includes(q)) ||
        (item.jabatan && item.jabatan.toLowerCase().includes(q))
    );
    renderAsnMasterTable(filtered);
}

/**
 * SIMPAN INDIVIDUAL MASTER ASN
 */
async function saveAsnMaster(e) {
    e.preventDefault();
    const asnObj = {
        nama: document.getElementById('addAsnNama').value.trim().toUpperCase(),
        nip: document.getElementById('addAsnNip').value.trim(),
        jabatan: document.getElementById('addAsnJabatan').value.trim(),
        pangkat: document.getElementById('addAsnPangkat').value.trim()
    };

    if (window.AppDB) {
        await window.AppDB.saveMasterAsn(asnObj);
        masterASN = await window.AppDB.getMasterAsn();
    }
    
    masterASN = sortASNByHirarki(masterASN);
    document.getElementById('formAddAsn').reset();
    populateSelects();
    renderPengikutTable();
    alert("Data ASN berhasil disimpan ke master_pelaksana.");
}

/**
 * HAPUS MASTER ASN (BERDARTAKAN NIP)
 */
async function deleteAsnMaster(nip) {
    if (!nip || nip === '-') {
        alert("NIP tidak valid untuk dihapus.");
        return;
    }
    if (!confirm(`Apakah Anda yakin ingin menghapus data ASN dengan NIP (${nip}) dari master_pelaksana?`)) return;

    try {
        if (window.AppDB) {
            await window.AppDB.deleteMasterAsn(nip);
            masterASN = await window.AppDB.getMasterAsn();
        }
        masterASN = sortASNByHirarki(masterASN);
        populateSelects();
        renderPengikutTable();
        alert("Data ASN berhasil dihapus.");
    } catch (err) {
        console.error("Gagal menghapus ASN:", err);
        alert("Gagal menghapus data ASN.");
    }
}

/**
 * IMPORT CSV MASTER ASN TO TABEL master_pelaksana
 */
async function importAsnFromCsv() {
    const fileInput = document.getElementById('csvFileInput');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("Silakan pilih berkas CSV terlebih dahulu!");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function(e) {
        const text = e.target.result;
        const lines = text.split(/\r\n|\n/);
        const importedList = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = line.split(/;|,/).map(c => c.trim().replace(/^"|"$/g, ''));
            
            // Bypass baris header jika ada
            if (i === 0 && (cols[0].toLowerCase().includes('nama') || cols[1]?.toLowerCase().includes('nip'))) {
                continue;
            }

            if (cols.length >= 2) {
                importedList.push({
                    nama: cols[0].toUpperCase(),
                    nip: cols[1] || '',
                    pangkat: cols[2] || '',
                    jabatan: cols[3] || 'Pelaksana / Staf'
                });
            }
        }

        if (importedList.length === 0) {
            alert("Tidak ada baris data valid yang ditemukan dalam file CSV.");
            return;
        }

        if (window.AppDB) {
            await window.AppDB.bulkSaveMasterAsn(importedList);
            masterASN = await window.AppDB.getMasterAsn();
        }

        masterASN = sortASNByHirarki(masterASN);
        populateSelects();
        renderPengikutTable();
        fileInput.value = '';
        alert(`Berhasil mengimpor ${importedList.length} data ASN ke tabel master_pelaksana!`);
    };

    reader.readAsText(file);
}

function downloadCsvTemplate() {
    const csvContent = "data:text/csv;charset=utf-8,NAMA,NIP,PANGKAT_GOLONGAN,JABATAN\n" +
        "RUDOLF UMBU RESI LOLY ST,197205212006041008,Pembina / IV.a,Camat Tabundung\n" +
        "YOHANES NDAPA S.IP,198001012005011002,Penata / III.c,Sekretaris Camat\n" +
        "MARIA KIKU S.AP,198502022008022004,Penata Muda / III.a,Kepala Sub Bagian Umum";
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "template_master_asn.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * MODAL KELOLA MASTER SUB KEGIATAN (tabel master_sk)
 */
function renderSKMasterTable() {
    const tbody = document.getElementById('tableSKBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    masterSK.forEach((sk) => {
        const quotaVal = sk.quota || sk.kuota || 50;
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition border-b">
                <td class="p-2.5 font-mono font-bold">${sk.kode}</td>
                <td class="p-2.5">${sk.nama}</td>
                <td class="p-2.5 text-center font-bold">${quotaVal} OH</td>
                <td class="p-2.5 text-center">
                    <button type="button" onclick="deleteSKMaster('${sk.kode}')" class="text-rose-600 hover:text-rose-800 font-bold p-1.5 cursor-pointer" title="Hapus Sub Kegiatan">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

async function saveNewSK(e) {
    e.preventDefault();
    const skObj = {
        kode: document.getElementById('newKodeSK').value.trim(),
        nama: document.getElementById('newNamaSK').value.trim(),
        quota: parseInt(document.getElementById('newQuotaSK').value) || 50
    };

    if (window.AppDB) {
        await window.AppDB.saveMasterSK(skObj);
        masterSK = await window.AppDB.getMasterSK();
    }

    closeModalSK();
    populateSelects();
    alert("Sub Kegiatan berhasil disimpan ke master_sk.");
}

async function deleteSKMaster(kodeSK) {
    if (!kodeSK) return;
    if (!confirm(`Apakah Anda yakin ingin menghapus Sub Kegiatan (${kodeSK}) dari master_sk?`)) return;

    try {
        if (window.AppDB) {
            await window.AppDB.deleteMasterSK(kodeSK);
            masterSK = await window.AppDB.getMasterSK();
        }
        populateSelects();
        alert("Sub Kegiatan berhasil dihapus.");
    } catch (err) {
        console.error("Gagal menghapus Sub Kegiatan:", err);
        alert("Gagal menghapus Sub Kegiatan.");
    }
}
