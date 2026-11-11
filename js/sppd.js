/*
  ====================================================================================
  Nama Aplikasi : Sistem e - SPPD Terpadu - Kecamatan Tabundung
  Hosting       : GitHub Pages (Murni Single Page Application / SPA)
  Backend / DB  : Supabase REST API & Supabase Storage
  Nama Halaman  : js/sppd.js
  Fungsi Halaman: Logika pemrosesan form, perhitungan otomatis Lama Hari dari selisih 
                  tanggal, autofill ASN, penyimpanan record, serta NAVIGASI PENGALIHAN 
                  KE cetak.html?id=... (BUKAN printer lokal secara langsung).
  ====================================================================================
*/

let currentMasterASN = [];
let currentMasterSK = [];
let pengikutCount = 0;

document.addEventListener('DOMContentLoaded', async () => {
    await loadInitialMasterData();
    renderPengikutTable();
    await renderRiwayatTable();
    updateTotalBiayaEstimasi();
});

// ----------------------------------------------------
// STEPPER & TAB NAVIGATION
// ----------------------------------------------------
function switchStep(stepNumber) {
    [1, 2, 3].forEach(num => {
        const content = document.getElementById(`step-content-${num}`);
        const icon = document.getElementById(`step-icon-${num}`);
        const label = document.getElementById(`step-label-${num}`);

        if (content) {
            if (num === stepNumber) {
                content.classList.remove('hidden');
            } else {
                content.classList.add('hidden');
            }
        }

        if (icon && label) {
            if (num === stepNumber) {
                icon.className = 'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-gov-700 text-white shadow-md transition-all';
                label.className = 'text-xs font-bold text-gov-800 mt-1';
            } else {
                icon.className = 'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-slate-200 text-slate-600 transition-all';
                label.className = 'text-xs font-medium text-slate-500 mt-1';
            }
        }
    });

    if (stepNumber === 3) {
        renderRiwayatTable();
    }
}

function proceedToStep2() {
    const kodeSK = document.getElementById('kodeSK')?.value;
    const tujuan = document.getElementById('step1_selectDesa')?.value;

    if (!kodeSK) {
        alert('Silakan pilih Sub Kegiatan terlebih dahulu!');
        return;
    }
    if (!tujuan || tujuan.trim() === '') {
        alert('Silakan isi Lokasi Perjalanan Dinas terlebih dahulu!');
        return;
    }

    switchStep(2);
}

function syncTujuanPerdin(val) {
    const tempatTujuan = document.getElementById('tempatTujuan');
    if (tempatTujuan) tempatTujuan.value = val;
}

// ----------------------------------------------------
// PERHITUNGAN OTOMATIS LAMA HARI & ESTIMASI BIAYA
// ----------------------------------------------------
function hitungLamaHariOtomatis() {
    const tglMulaiVal = document.getElementById('tglMulai').value;
    const tglKembaliVal = document.getElementById('tglKembali').value;
    const inputLamaHari = document.getElementById('lamaHari');

    if (tglMulaiVal && tglKembaliVal) {
        const dMulai = new Date(tglMulaiVal);
        const dKembali = new Date(tglKembaliVal);

        if (dKembali >= dMulai) {
            const diffTime = Math.abs(dKembali - dMulai);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inklusif
            inputLamaHari.value = diffDays;
        } else {
            alert("Tanggal Kembali tidak boleh sebelum Tanggal Mulai Berangkat!");
            document.getElementById('tglKembali').value = tglMulaiVal;
            inputLamaHari.value = 1;
        }
    }
    updateTotalBiayaEstimasi();
}

function updateSKQuotaInfo() {
    updateTotalBiayaEstimasi();
}

function updateTotalBiayaEstimasi() {
    const lamaHari = parseInt(document.getElementById('lamaHari')?.value) || 1;
    const biayaPerOrang = parseFloat(document.getElementById('biayaPerOrang')?.value) || 0;
    
    // Hitung total orang: Pelaksana Utama (1) + Pengikut
    const totalPengikut = document.querySelectorAll('#tbody-pengikut tr').length;
    const totalOrang = 1 + totalPengikut;

    const totalBiaya = lamaHari * biayaPerOrang * totalOrang;

    const elemFormatted = document.getElementById('totalBiayaFormatted');
    const elemTerbilang = document.getElementById('terbilang');

    if (elemFormatted) {
        elemFormatted.value = 'Rp ' + totalBiaya.toLocaleString('id-ID');
    }
    if (elemTerbilang) {
        elemTerbilang.value = terbilangAngka(totalBiaya) + ' Rupiah';
    }
}

function terbilangAngka(n) {
    if (n < 0) return "";
    const angka = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
    if (n < 12) return angka[n];
    if (n < 20) return terbilangAngka(n - 10) + " Belas";
    if (n < 100) return terbilangAngka(Math.floor(n / 10)) + " Puluh " + terbilangAngka(n % 10);
    if (n < 200) return "Seratus " + terbilangAngka(n - 100);
    if (n < 1000) return terbilangAngka(Math.floor(n / 100)) + " Ratus " + terbilangAngka(n % 100);
    if (n < 2000) return "Seribu " + terbilangAngka(n - 1000);
    if (n < 1000000) return terbilangAngka(Math.floor(n / 1000)) + " Ribu " + terbilangAngka(n % 1000);
    if (n < 1000000000) return terbilangAngka(Math.floor(n / 1000000)) + " Juta " + terbilangAngka(n % 1000000);
    return n.toString();
}

// ----------------------------------------------------
// LOAD DATA MASTER & DROP DOWN POPULATION
// ----------------------------------------------------
async function loadInitialMasterData() {
    if (window.AppDB) {
        currentMasterASN = await window.AppDB.getMasterAsn();
        currentMasterSK = await window.AppDB.getMasterSK();
    }

    populateSKDropdown();
    populateASNDropdowns();
    renderMasterTables();
}

function populateSKDropdown() {
    const skSelect = document.getElementById('kodeSK');
    if (!skSelect) return;
    skSelect.innerHTML = '<option value="">-- Pilih Sub Kegiatan --</option>';

    currentMasterSK.forEach(sk => {
        const opt = document.createElement('option');
        opt.value = sk.kode;
        opt.textContent = `[${sk.kode}] ${sk.nama} (Kuota: ${sk.quota || 50} OH)`;
        skSelect.appendChild(opt);
    });
}

function populateASNDropdowns() {
    const selectPelaksana = document.getElementById('namaPelaksana');
    const selectBendahara = document.getElementById('selectBendahara');

    if (selectPelaksana) selectPelaksana.innerHTML = '<option value="">-- Pilih Pelaksana Utama --</option>';
    if (selectBendahara) selectBendahara.innerHTML = '<option value="">-- Pilih Bendahara --</option>';

    currentMasterASN.forEach(asn => {
        const namaUpper = asn.nama ? asn.nama.toUpperCase() : '';
        
        // Option Pelaksana Utama
        if (selectPelaksana) {
            const opt = document.createElement('option');
            opt.value = asn.nip;
            opt.textContent = `${namaUpper} - NIP. ${asn.nip}`;
            selectPelaksana.appendChild(opt);
        }

        // Option Bendahara
        if (selectBendahara) {
            const optB = document.createElement('option');
            optB.value = asn.nip;
            optB.textContent = `${namaUpper} (${asn.jabatan || 'Bendahara'})`;
            if (asn.jabatan && asn.jabatan.toLowerCase().includes('bendahara')) {
                optB.selected = true;
            }
            selectBendahara.appendChild(optB);
        }
    });
}

function autoFillPelaksanaUtama() {
    const nipVal = document.getElementById('namaPelaksana').value;
    const matched = currentMasterASN.find(a => a.nip === nipVal);

    if (matched) {
        document.getElementById('nipPelaksana').value = matched.nip || '-';
        document.getElementById('jabatanPelaksana').value = matched.jabatan || '-';
    } else {
        document.getElementById('nipPelaksana').value = '';
        document.getElementById('jabatanPelaksana').value = '';
    }
}

// ----------------------------------------------------
// MANAJEMEN TIM PENGIKUT
// ----------------------------------------------------
function tambahRowPengikut() {
    pengikutCount++;
    const tbody = document.getElementById('tbody-pengikut');
    const tr = document.createElement('tr');
    tr.id = `row-pengikut-${pengikutCount}`;
    tr.className = 'hover:bg-slate-50';

    let optionsAsn = '<option value="">-- Pilih ASN --</option>';
    currentMasterASN.forEach(a => {
        optionsAsn += `<option value="${a.nip}">${a.nama.toUpperCase()} - NIP. ${a.nip}</option>`;
    });

    tr.innerHTML = `
        <td class="p-2 text-center font-bold text-slate-500 row-index">${tbody.children.length + 1}</td>
        <td class="p-2">
            <select class="w-full text-xs p-1.5 border border-slate-300 rounded mb-1 select-pengikut-asn" onchange="autoFillRowPengikut(${pengikutCount}, this.value)">
                ${optionsAsn}
            </select>
            <input type="text" class="w-full text-xs p-1.5 border border-slate-300 rounded input-pengikut-nama uppercase" placeholder="NAMA PENGIKUT">
        </td>
        <td class="p-2">
            <input type="text" class="w-full text-xs p-1.5 border border-slate-300 rounded input-pengikut-nip font-mono" placeholder="NIP">
        </td>
        <td class="p-2 space-y-1">
            <input type="text" class="w-full text-xs p-1.5 border border-slate-300 rounded input-pengikut-pangkat" placeholder="Pangkat / Gol">
            <input type="text" class="w-full text-xs p-1.5 border border-slate-300 rounded input-pengikut-jabatan" placeholder="Jabatan">
        </td>
        <td class="p-2 text-center">
            <button type="button" onclick="hapusRowPengikut(${pengikutCount})" class="text-rose-600 hover:text-rose-800 p-1">
                <i class="fa-solid fa-trash"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
    updatePengikutIndices();
    updateTotalBiayaEstimasi();
}

function autoFillRowPengikut(rowId, nip) {
    const row = document.getElementById(`row-pengikut-${rowId}`);
    if (!row) return;
    const matched = currentMasterASN.find(a => a.nip === nip);
    if (matched) {
        row.querySelector('.input-pengikut-nama').value = matched.nama.toUpperCase();
        row.querySelector('.input-pengikut-nip').value = matched.nip;
        row.querySelector('.input-pengikut-pangkat').value = matched.pangkat || '-';
        row.querySelector('.input-pengikut-jabatan').value = matched.jabatan || '-';
    }
}

function hapusRowPengikut(rowId) {
    const row = document.getElementById(`row-pengikut-${rowId}`);
    if (row) row.remove();
    updatePengikutIndices();
    updateTotalBiayaEstimasi();
}

function updatePengikutIndices() {
    const rows = document.querySelectorAll('#tbody-pengikut tr');
    rows.forEach((r, idx) => {
        r.querySelector('.row-index').textContent = idx + 1;
    });
}

function renderPengikutTable() {
    const tbody = document.getElementById('tbody-pengikut');
    if (tbody && tbody.children.length === 0) {
        tambahRowPengikut();
    }
}

// ----------------------------------------------------
// PENYIMPANAN DATA & PENGALIHAN KE CETAK.HTML
// ----------------------------------------------------
async function handleFormSubmit(event) {
    event.preventDefault();

    const nipUtama = document.getElementById('namaPelaksana').value;
    const matchedPelaksana = currentMasterASN.find(a => a.nip === nipUtama);
    const namaUtama = matchedPelaksana ? matchedPelaksana.nama.toUpperCase() : document.getElementById('namaPelaksana').options[document.getElementById('namaPelaksana').selectedIndex]?.text || '';

    // Ambil Data Pengikut
    const pengikutList = [];
    document.querySelectorAll('#tbody-pengikut tr').forEach(row => {
        const nama = row.querySelector('.input-pengikut-nama')?.value;
        if (nama && nama.trim() !== '') {
            pengikutList.push({
                nama: nama.toUpperCase(),
                nip: row.querySelector('.input-pengikut-nip')?.value || '-',
                pangkat: row.querySelector('.input-pengikut-pangkat')?.value || '-',
                jabatan: row.querySelector('.input-pengikut-jabatan')?.value || '-'
            });
        }
    });

    const recordData = {
        id: Date.now().toString(),
        noSuratTugas: document.getElementById('noSuratTugas').value,
        noSPPD: document.getElementById('noSPPD').value,
        kodeSK: document.getElementById('kodeSK').value,
        sumberDana: document.getElementById('sumberDana').value,
        tglMulai: document.getElementById('tglMulai').value,
        tglKembali: document.getElementById('tglKembali').value,
        lamaHari: parseInt(document.getElementById('lamaHari').value) || 1,
        biayaPerOrang: parseFloat(document.getElementById('biayaPerOrang').value) || 0,
        maksudPerdin: document.getElementById('maksudTujuan').value,
        laporanHasil: document.getElementById('laporanHasil').value,
        
        // Pelaksana Utama
        namaPelaksana: namaUtama,
        nipPelaksana: document.getElementById('nipPelaksana').value,
        jabatanPelaksana: document.getElementById('jabatanPelaksana').value,
        
        // Lokasi
        tempatBerangkat: document.getElementById('tempatBerangkat').value,
        tempatTujuan: document.getElementById('tempatTujuan').value,
        
        // Pejabat TTD
        namaPenggunaAnggaran: document.getElementById('namaPenggunaAnggaran').value,
        nipPenggunaAnggaran: document.getElementById('nipPenggunaAnggaran').value,
        nipBendahara: document.getElementById('selectBendahara').value,
        namaPejabatTujuan: document.getElementById('namaPejabatTujuan').value,
        jabatanPejabatTujuan: document.getElementById('jabatanPejabatTujuan').value,

        pengikut: pengikutList,
        createdAt: new Date().toISOString()
    };

    if (window.AppDB) {
        await window.AppDB.saveRecord(recordData);
    }

    // Arahkan browser menuju cetak.html dengan menyertakan ID dokumen
    window.location.href = `cetak.html?id=${recordData.id}`;
}

// ----------------------------------------------------
// TABEL RIWAYAT PERDIN (DIARAHKAN KE CETAK.HTML)
// ----------------------------------------------------
async function renderRiwayatTable() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    
    let records = [];
    if (window.AppDB) records = await window.AppDB.getAllRecords();

    const searchKeyword = (document.getElementById('search-riwayat')?.value || '').toLowerCase();
    const filtered = records.filter(r => 
        (r.namaPelaksana && r.namaPelaksana.toLowerCase().includes(searchKeyword)) ||
        (r.noSPPD && r.noSPPD.toLowerCase().includes(searchKeyword)) ||
        (r.noSuratTugas && r.noSuratTugas.toLowerCase().includes(searchKeyword))
    );

    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">Belum ada data riwayat perjalanan dinas.</td></tr>';
        return;
    }

    filtered.forEach((r, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="p-3 text-center font-bold text-slate-500">${idx + 1}</td>
            <td class="p-3">
                <div class="font-bold text-gov-900">${r.noSPPD || '-'}</div>
                <div class="text-[11px] text-slate-500">ST: ${r.noSuratTugas || '-'}</div>
            </td>
            <td class="p-3 font-semibold text-slate-800 uppercase">${r.namaPelaksana || '-'}</td>
            <td class="p-3">
                <div class="font-bold">${r.tempatTujuan || '-'}</div>
                <div class="text-[11px] text-slate-500">${r.tglMulai || ''} s/d ${r.tglKembali || r.tglMulai || ''} (${r.lamaHari || 1} Hari)</div>
            </td>
            <td class="p-3 font-mono text-[11px]">${r.kodeSK || '-'}</td>
            <td class="p-3 text-center">
                <a href="cetak.html?id=${r.id}" class="px-2.5 py-1 bg-gov-800 hover:bg-gov-900 text-white rounded text-[11px] font-bold transition inline-flex items-center gap-1 cursor-pointer">
                    <i class="fa-solid fa-file-lines"></i> Cetak Dokumen
                </a>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ----------------------------------------------------
// MODAL MANAGEMENT & MASTER DATA HAPUS/TAMBAH
// ----------------------------------------------------
function openModalAsn() {
    const modal = document.getElementById('modalAsn');
    if (modal) modal.classList.remove('hidden'), modal.classList.add('flex');
}

function closeModalAsn() {
    const modal = document.getElementById('modalAsn');
    if (modal) modal.classList.add('hidden'), modal.classList.remove('flex');
}

function openModalSK() {
    const modal = document.getElementById('modalSK');
    if (modal) modal.classList.remove('hidden'), modal.classList.add('flex');
}

function closeModalSK() {
    const modal = document.getElementById('modalSK');
    if (modal) modal.classList.add('hidden'), modal.classList.remove('flex');
}

function openModalManageSK() {
    const modal = document.getElementById('modalManageSK');
    if (modal) modal.classList.remove('hidden'), modal.classList.add('flex');
}

function closeModalManageSK() {
    const modal = document.getElementById('modalManageSK');
    if (modal) modal.classList.add('hidden'), modal.classList.remove('flex');
}

async function saveAsnMaster(e) {
    e.preventDefault();
    const newAsn = {
        nama: document.getElementById('addAsnNama').value.toUpperCase(),
        nip: document.getElementById('addAsnNip').value,
        jabatan: document.getElementById('addAsnJabatan').value,
        pangkat: document.getElementById('addAsnPangkat').value
    };

    if (window.AppDB) {
        await window.AppDB.saveMasterAsn(newAsn);
        await loadInitialMasterData();
        document.getElementById('formAddAsn').reset();
    }
}

async function saveNewSK(e) {
    e.preventDefault();
    const newSk = {
        kode: document.getElementById('newKodeSK').value,
        nama: document.getElementById('newNamaSK').value,
        quota: parseInt(document.getElementById('newQuotaSK').value) || 50
    };

    if (window.AppDB) {
        await window.AppDB.saveMasterSK(newSk);
        await loadInitialMasterData();
        closeModalSK();
    }
}

function renderMasterTables() {
    // Master ASN
    const tbodyAsn = document.getElementById('tbody-master-asn');
    if (tbodyAsn) {
        tbodyAsn.innerHTML = '';
        currentMasterASN.forEach(asn => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50';
            tr.innerHTML = `
                <td class="p-2 font-bold uppercase text-slate-800">${asn.nama}<br><span class="font-mono text-[10px] text-slate-500">${asn.nip}</span></td>
                <td class="p-2">${asn.jabatan || '-'}</td>
                <td class="p-2 text-center">
                    <button onclick="hapusASN('${asn.nip}')" class="text-rose-600 hover:text-rose-800"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbodyAsn.appendChild(tr);
        });
    }

    // Master SK
    const tbodySk = document.getElementById('tbody-master-sk');
    if (tbodySk) {
        tbodySk.innerHTML = '';
        currentMasterSK.forEach(sk => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50';
            tr.innerHTML = `
                <td class="p-2 font-mono font-bold text-slate-700">${sk.kode}</td>
                <td class="p-2 font-medium">${sk.nama}</td>
                <td class="p-2 text-center font-bold text-gov-800">${sk.quota || 50}</td>
                <td class="p-2 text-center">
                    <button onclick="hapusSK('${sk.kode}')" class="text-rose-600 hover:text-rose-800"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbodySk.appendChild(tr);
        });
    }
}

async function hapusASN(nip) {
    if (confirm(`Hapus ASN dengan NIP ${nip}?`)) {
        await window.AppDB.deleteMasterAsn(nip);
        await loadInitialMasterData();
    }
}

async function hapusSK(kode) {
    if (confirm(`Hapus Sub Kegiatan ${kode}?`)) {
        await window.AppDB.deleteMasterSK(kode);
        await loadInitialMasterData();
    }
}
