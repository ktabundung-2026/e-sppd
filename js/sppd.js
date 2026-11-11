/**
 * Logika dan Manajemen Form e-SPPD Terpadu - Kecamatan Tabundung
 */

// Variabel Global Data Sensus & Transaksi
let masterASN = [];
let masterSK = [];
let daftarPengikut = [];
let riwayatSPPD = [];

// Inisialisasi Saat Halaman Dimuat
document.addEventListener('DOMContentLoaded', async () => {
    await loadInitialData();
    populateSelects();
    renderPengikutTable();
    updateSKQuotaInfo();
    hitungLamaHariOtomatis();
});

/**
 * Memuat data awal dari IndexedDB / LocalStorage / Dummy Data
 */
async function loadInitialData() {
    try {
        if (typeof db !== 'undefined' && db.asn) {
            masterASN = await db.asn.toArray();
            masterSK = await db.sk ? await db.sk.toArray() : [];
            riwayatSPPD = await db.sppd ? await db.sppd.toArray() : [];
        } else {
            masterASN = JSON.parse(localStorage.getItem('master_asn')) || [
                { id: 1, nama: "YOHANES NDAPA, S.IP", nip: "198001012005011002", pangkat: "Penata / III.c", jabatan: "Sekretaris Camat" },
                { id: 2, nama: "MARIA KIKU, S.AP", nip: "198502022008022004", pangkat: "Penata Muda / III.a", jabatan: "Kepala Sub Bagian Umum" },
                { id: 3, nama: "AHMAD FADLI, A.Md", nip: "199203032015031001", pangkat: "Pengatur / II.c", jabatan: "Pengelola Keuangan" }
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
}

/**
 * Mengisi Dropdown Master (Pelaksana Utama, Bendahara, Kode SK)
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
            selSK.innerHTML += `<option value="${sk.kode}">${sk.kode} - ${sk.nama}</option>`;
        });
    }
    
    renderAsnMasterTable();
    renderSKMasterTable();
    renderHistoryTable();
}

/**
 * Autocomplete / Fill Otomatis Data Pelaksana Utama
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

/**
 * Autocomplete Data Bendahara
 */
function onBendaharaSelected(namaVal) {
    const selected = masterASN.find(item => item.nama === namaVal);
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
    const selectedAsn = masterASN.find(item => item.nama === namaSelected);
    if (selectedAsn) {
        daftarPengikut[index].nama = selectedAsn.nama; // Nama tanpa NIP
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
        masterASN.forEach(asn => {
            const isSelected = asn.nama === item.nama ? 'selected' : '';
            options += `<option value="${asn.nama}" ${isSelected}>${asn.nama}</option>`;
        });

        const rowHTML = `
            <tr class="hover:bg-slate-50 transition">
                <!-- 1. No. -->
                <td class="p-2.5 text-center font-bold text-slate-600">${index + 1}</td>
                
                <!-- 2. Nama ASN (Tanpa NIP di dropdown/label) -->
                <td class="p-2.5">
                    <select onchange="onSelectPengikut(${index}, this.value)" class="w-full p-1.5 text-xs border rounded border-slate-300 font-semibold bg-white uppercase-input">
                        ${options}
                    </select>
                </td>
                
                <!-- 3. NIP -->
                <td class="p-2.5">
                    <input type="text" value="${item.nip || ''}" readonly class="w-full p-1.5 text-xs border rounded font-mono bg-slate-100">
                </td>
                
                <!-- 4. Pangkat / Golongan -->
                <td class="p-2.5">
                    <input type="text" value="${item.pangkat || ''}" readonly class="w-full p-1.5 text-xs border rounded font-semibold bg-slate-100 capitalize-input">
                </td>
                
                <!-- 5. Jabatan -->
                <td class="p-2.5">
                    <input type="text" value="${item.jabatan || ''}" readonly class="w-full p-1.5 text-xs border rounded font-semibold bg-slate-100 capitalize-input">
                </td>
                
                <!-- 6. Aksi -->
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
    const jumlahPersonel = 1 + daftarPengikut.length; // 1 Utama + Jumlah Pengikut
    
    const totalBiaya = lamaHari * biayaPerOrang * jumlahPersonel;

    document.getElementById('totalBiayaFormatted').value = "Rp " + totalBiaya.toLocaleString('id-ID');
    document.getElementById('terbilang').value = angkaKeTerbilang(totalBiaya) + " Rupiah";
}

/**
 * Helper Fungsi Konversi Angka ke Terbilang
 */
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
 * Navigasi Wizard / Stepper
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
 * Penanganan Submit Form Utama
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
 * Modal Master ASN & Master SK
 */
function openModalAsn() { document.getElementById('modalAsn').classList.remove('hidden'); document.getElementById('modalAsn').classList.add('flex'); }
function closeModalAsn() { document.getElementById('modalAsn').classList.add('hidden'); document.getElementById('modalAsn').classList.remove('flex'); }

function openModalSK() { document.getElementById('modalSK').classList.remove('hidden'); document.getElementById('modalSK').classList.add('flex'); }
function closeModalSK() { document.getElementById('modalSK').classList.add('hidden'); document.getElementById('modalSK').classList.remove('flex'); }

function openModalManageSK() { document.getElementById('modalManageSK').classList.remove('hidden'); document.getElementById('modalManageSK').classList.add('flex'); }
function closeModalManageSK() { document.getElementById('modalManageSK').classList.add('hidden'); document.getElementById('modalManageSK').classList.remove('flex'); }

function renderAsnMasterTable() {
    const tbody = document.getElementById('asnTableBody');
    const count = document.getElementById('totalAsnCount');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    count.textContent = masterASN.length;

    masterASN.forEach((asn) => {
        tbody.innerHTML += `
            <tr>
                <td class="p-2.5">
                    <div class="font-bold uppercase">${asn.nama}</div>
                    <div class="text-[10px] font-mono text-slate-400">NIP: ${asn.nip || '-'}</div>
                </td>
                <td class="p-2.5 capitalize-input">${asn.jabatan || '-'}</td>
                <td class="p-2.5 text-center">
                    <button type="button" class="text-rose-600 hover:text-rose-800 font-bold"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

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
                    <button type="button" class="text-rose-600 hover:text-rose-800 font-bold"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function saveAsnMaster(e) {
    e.preventDefault();
    const newASN = {
        id: Date.now(),
        nama: document.getElementById('addAsnNama').value,
        nip: document.getElementById('addAsnNip').value,
        jabatan: document.getElementById('addAsnJabatan').value,
        pangkat: document.getElementById('addAsnPangkat').value
    };

    masterASN.push(newASN);
    if (typeof db !== 'undefined' && db.asn) {
        db.asn.add(newASN);
    } else {
        localStorage.setItem('master_asn', JSON.stringify(masterASN));
    }

    document.getElementById('formAddAsn').reset();
    populateSelects();
    alert("Data ASN berhasil ditambahkan.");
}

function saveNewSK(e) {
    e.preventDefault();
    const newSK = {
        id: Date.now(),
        kode: document.getElementById('newKodeSK').value,
        nama: document.getElementById('newNamaSK').value,
        kuota: parseInt(document.getElementById('newQuotaSK').value) || 0
    };

    masterSK.push(newSK);
    if (typeof db !== 'undefined' && db.sk) {
        db.sk.add(newSK);
    } else {
        localStorage.setItem('master_sk', JSON.stringify(masterSK));
    }

    closeModalSK();
    populateSelects();
    alert("Sub Kegiatan berhasil ditambahkan.");
}
