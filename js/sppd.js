/**
 * Logika dan Manajemen Form e-SPPD Terpadu - Kecamatan Tabundung
 * Penyimpanan Data Pelaksana: master_pelaksana
 */

// Variabel Global Data
let masterPelaksana = [];
let masterSK = [];
let daftarPengikut = [];
let riwayatSPPD = [];

// Map Bobot Hirarki Jabatan Kedinasan (Angka lebih kecil = Posisi lebih tinggi)
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

// Inisialisasi Saat Halaman Dimuat
document.addEventListener('DOMContentLoaded', async () => {
    await loadInitialData();
    populateSelects();
    renderPengikutTable();
    updateSKQuotaInfo();
    hitungLamaHariOtomatis();
});

/**
 * Mengurutkan array ASN/Pelaksana berdasarkan hirarki jabatan
 */
function sortPelaksanaByHirarki(list) {
    return list.sort((a, b) => {
        const getRank = (jabatan) => {
            if (!jabatan) return 99;
            const uppercaseJab = jabatan.toUpperCase();
            for (let item of HIRARKI_JABATAN) {
                if (uppercaseJab.includes(item.keyword)) {
                    return item.rank;
                }
            }
            return 50; // default rank menengah jika tidak sesuai keyword
        };

        const rankA = getRank(a.jabatan);
        const rankB = getRank(b.jabatan);

        if (rankA !== rankB) {
            return rankA - rankB;
        }
        // Jika tingkat hirarki sama, urutkan berdasarkan Nama secara Alfabetis
        return (a.nama || '').localeCompare(b.nama || '');
    });
}

/**
 * Memuat data awal dari Dexie (tabel master_pelaksana) / LocalStorage
 */
async function loadInitialData() {
    try {
        if (typeof db !== 'undefined' && db.master_pelaksana) {
            masterPelaksana = await db.master_pelaksana.toArray();
            masterSK = await db.sk ? await db.sk.toArray() : [];
            riwayatSPPD = await db.sppd ? await db.sppd.toArray() : [];
        } else if (typeof db !== 'undefined' && db.asn) {
            // Fallback backward compatibility
            masterPelaksana = await db.asn.toArray();
            masterSK = await db.sk ? await db.sk.toArray() : [];
            riwayatSPPD = await db.sppd ? await db.sppd.toArray() : [];
        } else {
            masterPelaksana = JSON.parse(localStorage.getItem('master_pelaksana')) || [
                { id: 1, nama: "RUDOLF UMBU RESI LOLY, ST", nip: "197205212006041008", pangkat: "Pembina / IV.a", jabatan: "Camat Tabundung" },
                { id: 2, nama: "YOHANES NDAPA, S.IP", nip: "198001012005011002", pangkat: "Penata / III.c", jabatan: "Sekretaris Camat" },
                { id: 3, nama: "MARIA KIKU, S.AP", nip: "198502022008022004", pangkat: "Penata Muda / III.a", jabatan: "Kepala Sub Bagian Umum" },
                { id: 4, nama: "AHMAD FADLI, A.Md", nip: "199203032015031001", pangkat: "Pengatur / II.c", jabatan: "Pengelola Keuangan" }
            ];
            masterSK = JSON.parse(localStorage.getItem('master_sk')) || [
                { id: 1, kode: "5.01.01.2.01", nama: "Koordinasi Pelaksanaan Kegiatan Pemerintahan", kuota: 50 },
                { id: 2, kode: "5.01.01.2.02", nama: "Pemberdayaan Masyarakat Desa & Kelurahan", kuota: 30 }
            ];
            riwayatSPPD = JSON.parse(localStorage.getItem('riwayat_sppd')) || [];
        }
    } catch (err) {
        console.error("Gagal memuat data master:", err);
    }

    // Urutkan data berdasarkan hirarki jabatan
    masterPelaksana = sortPelaksanaByHirarki(masterPelaksana);
}

/**
 * Mengisi Dropdown Master
 */
function populateSelects() {
    // Dropdown Pelaksana Utama
    const selPelaksana = document.getElementById('namaPelaksana');
    if (selPelaksana) {
        selPelaksana.innerHTML = '<option value="">-- Pilih Pelaksana Utama --</option>';
        masterPelaksana.forEach(asn => {
            selPelaksana.innerHTML += `<option value="${asn.nama}">${asn.nama}</option>`;
        });
    }

    // Dropdown Bendahara
    const selBendahara = document.getElementById('selectBendahara');
    if (selBendahara) {
        selBendahara.innerHTML = '<option value="">-- Pilih Bendahara Pengeluaran --</option>';
        masterPelaksana.forEach(asn => {
            selBendahara.innerHTML += `<option value="${asn.nama}">${asn.nama}</option>`;
        });
    }

    // Dropdown Kode SK
    const selSK = document.getElementById('step1_kodeSK');
    if (selSK) {
        selSK.innerHTML = '<option value="">Pilih Sub Kegiatan</option>';
        masterSK.forEach(sk => {
            selSK.innerHTML += `<option value="${sk.kode}">${sk.kode} - ${sk.nama}</option>`;
        });
    }
    
    renderAsnMasterTable();
    renderSKMasterTable();
    renderHistoryTable();
}

/**
 * Autocomplete Data Pelaksana Utama
 */
function autoFillPelaksanaUtama() {
    const namaVal = document.getElementById('namaPelaksana').value;
    const selected = masterPelaksana.find(item => item.nama === namaVal);

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

/**
 * Autocomplete Data Bendahara
 */
function onBendaharaSelected(namaVal) {
    const selected = masterPelaksana.find(item => item.nama === namaVal);
    document.getElementById('nipBendahara').value = selected ? (selected.nip || '') : '';
}

/**
 * Sinkronisasi Lokasi Perdin Step 1 ke Tempat Tujuan Step 2
 */
function syncTujuanPerdin(val) {
    document.getElementById('tempatTujuan').value = val;
}

/**
 * Modul Pengikut (Tambah, Hapus, Render)
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
    const selectedAsn = masterPelaksana.find(item => item.nama === namaSelected);
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

function updatePengikutData(index, field, value) {
    daftarPengikut[index][field] = value;
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
        masterPelaksana.forEach(asn => {
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
 * Perhitungan Otomatis Lama Hari dan Total Estimasi Biaya
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
 * Navigasi Wizard
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

/**
 * Simpan Data SPPD
 */
function handleFormSubmit(e) {
    e.preventDefault();
    const dataSPPD = {
        noST: document.getElementById('noSuratTugas').value,
        noSPPD: document.getElementById('noSPPD').value,
        kodeSK: document.getElementById('step1_kodeSK').value,
        pelaksanaUtama: document.getElementById('namaPelaksana').value,
        tujuan: document.getElementById('tempatTujuan').value,
        totalBiaya: document.getElementById('totalBiayaFormatted').value,
        tglMulai: document.getElementById('tglMulai').value
    };

    riwayatSPPD.push(dataSPPD);
    if (typeof db !== 'undefined' && db.sppd) {
        db.sppd.add(dataSPPD);
    } else {
        localStorage.setItem('riwayat_sppd', JSON.stringify(riwayatSPPD));
    }

    alert("Dokumen SPPD Berhasil Disimpan!");
    renderHistoryTable();
    switchStep(3);
}

function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    riwayatSPPD.forEach((item) => {
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 border-b">
                <td class="p-3 font-semibold">${item.noST || '-'}<br><span class="text-[10px] text-slate-400">${item.noSPPD || '-'}</span></td>
                <td class="p-3 font-mono">${item.kodeSK || '-'}</td>
                <td class="p-3 font-bold">${item.pelaksanaUtama || '-'}</td>
                <td class="p-3">${item.tujuan || '-'}</td>
                <td class="p-3 font-bold text-emerald-700">${item.totalBiaya || '0'}</td>
                <td class="p-3 text-center">
                    <button type="button" onclick="window.print()" class="text-sky-600 hover:text-sky-800 font-bold">
                        <i class="fa-solid fa-print"></i> Cetak
                    </button>
                </td>
            </tr>
        `;
    });
}

/**
 * MODAL MASTER ASN / PELAKSANA (master_pelaksana)
 */
function openModalAsn() { document.getElementById('modalAsn').classList.remove('hidden'); document.getElementById('modalAsn').classList.add('flex'); }
function closeModalAsn() { document.getElementById('modalAsn').classList.add('hidden'); document.getElementById('modalAsn').classList.remove('flex'); }

function openModalSK() { document.getElementById('modalSK').classList.remove('hidden'); document.getElementById('modalSK').classList.add('flex'); }
function closeModalSK() { document.getElementById('modalSK').classList.add('hidden'); document.getElementById('modalSK').classList.remove('flex'); }

function openModalManageSK() { document.getElementById('modalManageSK').classList.remove('hidden'); document.getElementById('modalManageSK').classList.add('flex'); }
function closeModalManageSK() { document.getElementById('modalManageSK').classList.add('hidden'); document.getElementById('modalManageSK').classList.remove('flex'); }

/**
 * Render Tabel Master Pelaksana (Diurutkan berdasarkan Hirarki Jabatan)
 */
function renderAsnMasterTable(filteredList = null) {
    const tbody = document.getElementById('asnTableBody');
    const count = document.getElementById('totalAsnCount');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const dataToDisplay = filteredList || masterPelaksana;
    count.textContent = dataToDisplay.length;

    if (dataToDisplay.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-slate-400 italic">Data pelaksana kosong.</td></tr>`;
        return;
    }

    dataToDisplay.forEach((asn) => {
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition">
                <td class="p-2.5">
                    <div class="font-bold uppercase text-slate-800">${asn.nama}</div>
                    <div class="text-[10px] font-mono text-slate-500">NIP: ${asn.nip || '-'} | Gol: ${asn.pangkat || '-'}</div>
                </td>
                <td class="p-2.5 capitalize-input font-medium text-slate-700">${asn.jabatan || '-'}</td>
                <td class="p-2.5 text-center">
                    <button type="button" onclick="deleteAsnMaster(${asn.id})" class="text-rose-600 hover:text-rose-800 font-bold p-1 cursor-pointer" title="Hapus Pelaksana">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

/**
 * Pencarian / Filter Data Master Pelaksana
 */
function filterAsnTable(keyword) {
    const q = keyword.toLowerCase();
    const filtered = masterPelaksana.filter(item => 
        (item.nama && item.nama.toLowerCase().includes(q)) || 
        (item.nip && item.nip.toLowerCase().includes(q)) ||
        (item.jabatan && item.jabatan.toLowerCase().includes(q))
    );
    renderAsnMasterTable(filtered);
}

/**
 * PROSES IMPORT DATA CSV KE TABEL master_pelaksana
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
        let importedCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Memisahkan kolom dengan koma atau titik koma
            const cols = line.split(/;|,/).map(c => c.trim().replace(/^"|"$/g, ''));
            
            // Lewati baris header jika ada
            if (i === 0 && (cols[0].toLowerCase().includes('nama') || cols[1]?.toLowerCase().includes('nip'))) {
                continue;
            }

            if (cols.length >= 2) {
                const newPelaksana = {
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    nama: cols[0],
                    nip: cols[1] || '',
                    pangkat: cols[2] || '',
                    jabatan: cols[3] || 'Staf / Pelaksana'
                };

                // Simpan ke IndexedDB / LocalStorage
                if (typeof db !== 'undefined' && db.master_pelaksana) {
                    await db.master_pelaksana.add(newPelaksana);
                } else if (typeof db !== 'undefined' && db.asn) {
                    await db.asn.add(newPelaksana);
                }
                
                masterPelaksana.push(newPelaksana);
                importedCount++;
            }
        }

        // Urutkan kembali berdasarkan hirarki
        masterPelaksana = sortPelaksanaByHirarki(masterPelaksana);
        localStorage.setItem('master_pelaksana', JSON.stringify(masterPelaksana));

        populateSelects();
        renderPengikutTable();
        fileInput.value = '';
        alert(`Berhasil mengimpor ${importedCount} data pelaksana ke master_pelaksana!`);
    };

    reader.readAsText(file);
}

/**
 * Unduh Template CSV Pelaksana
 */
function downloadCsvTemplate() {
    const csvContent = "data:text/csv;charset=utf-8,NAMA,NIP,PANGKAT_GOLONGAN,JABATAN\n" +
        "RUDOLF UMBU RESI LOLY ST,197205212006041008,Pembina / IV.a,Camat Tabundung\n" +
        "YOHANES NDAPA S.IP,198001012005011002,Penata / III.c,Sekretaris Camat\n" +
        "MARIA KIKU S.AP,198502022008022004,Penata Muda / III.a,Kepala Sub Bagian Umum";
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "template_master_pelaksana.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * SIMPAN MASTER PELAKSANA MANUALLY
 */
async function saveAsnMaster(e) {
    e.preventDefault();
    const newPelaksana = {
        id: Date.now(),
        nama: document.getElementById('addAsnNama').value.trim(),
        nip: document.getElementById('addAsnNip').value.trim(),
        jabatan: document.getElementById('addAsnJabatan').value.trim(),
        pangkat: document.getElementById('addAsnPangkat').value.trim()
    };

    if (typeof db !== 'undefined' && db.master_pelaksana) {
        await db.master_pelaksana.add(newPelaksana);
    } else if (typeof db !== 'undefined' && db.asn) {
        await db.asn.add(newPelaksana);
    }
    
    masterPelaksana.push(newPelaksana);
    masterPelaksana = sortPelaksanaByHirarki(masterPelaksana);
    localStorage.setItem('master_pelaksana', JSON.stringify(masterPelaksana));

    document.getElementById('formAddAsn').reset();
    populateSelects();
    renderPengikutTable();
    alert("Data Pelaksana berhasil disimpan di master_pelaksana.");
}

/**
 * HAPUS MASTER PELAKSANA
 */
async function deleteAsnMaster(id) {
    if (!confirm("Apakah Anda yakin ingin menghapus data pelaksana ini dari master_pelaksana?")) return;

    try {
        if (typeof db !== 'undefined' && db.master_pelaksana) {
            await db.master_pelaksana.delete(id);
        } else if (typeof db !== 'undefined' && db.asn) {
            await db.asn.delete(id);
        }

        masterPelaksana = masterPelaksana.filter(item => item.id !== id);
        localStorage.setItem('master_pelaksana', JSON.stringify(masterPelaksana));

        populateSelects();
        renderPengikutTable();
        alert("Data pelaksana berhasil dihapus.");
    } catch (err) {
        console.error("Gagal menghapus pelaksana:", err);
        alert("Gagal menghapus data pelaksana.");
    }
}

/**
 * MODAL MASTER SUB KEGIATAN
 */
function renderSKMasterTable() {
    const tbody = document.getElementById('tableSKBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    masterSK.forEach((sk) => {
        tbody.innerHTML += `
            <tr>
                <td class="p-2.5 font-mono font-bold">${sk.kode}</td>
                <td class="p-2.5">${sk.nama}</td>
                <td class="p-2.5 text-center font-bold">${sk.kuota} OH</td>
                <td class="p-2.5 text-center">
                    <button type="button" onclick="deleteSKMaster(${sk.id})" class="text-rose-600 hover:text-rose-800 font-bold"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

async function saveNewSK(e) {
    e.preventDefault();
    const newSK = {
        id: Date.now(),
        kode: document.getElementById('newKodeSK').value,
        nama: document.getElementById('newNamaSK').value,
        kuota: parseInt(document.getElementById('newQuotaSK').value) || 0
    };

    masterSK.push(newSK);
    if (typeof db !== 'undefined' && db.sk) {
        await db.sk.add(newSK);
    } else {
        localStorage.setItem('master_sk', JSON.stringify(masterSK));
    }

    closeModalSK();
    populateSelects();
    alert("Sub Kegiatan berhasil ditambahkan.");
}

async function deleteSKMaster(id) {
    if (!confirm("Hapus Sub Kegiatan ini?")) return;
    if (typeof db !== 'undefined' && db.sk) {
        await db.sk.delete(id);
    }
    masterSK = masterSK.filter(item => item.id !== id);
    localStorage.setItem('master_sk', JSON.stringify(masterSK));
    populateSelects();
}
