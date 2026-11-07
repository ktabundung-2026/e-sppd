/*
  ====================================================================================
  Nama Aplikasi : Sistem e - SPPD Terpadu - Kecamatan Tabundung
  Hosting       : GitHub Pages (Murni Single Page Application / SPA)
  Backend / DB  : Supabase REST API & Supabase Storage
  Nama Halaman  : js/sppd.js
  Fungsi Halaman: Logika pemrosesan form terpadu, penanganan navigasi stepper 1-2-3,
                  autofill Jabatan Kedinasan (Camat, Sekcam, Kasi, dll.), 
                  perhitungan otomatis Lama Hari & Estimasi Biaya, serta Riwayat.
  ====================================================================================
*/

let currentMasterASN = [];
let currentMasterSK = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadInitialMasterData();
    await renderHistoryTable();
});

// ----------------------------------------------------
// 1. STEPPER NAVIGATION (Step 1, 2, 3 Bebas Akses)
// ----------------------------------------------------
function switchStep(stepNumber) {
    // Sembunyikan semua kontainer step
    [1, 2, 3].forEach(num => {
        const content = document.getElementById(`step-content-${num}`);
        const icon = document.getElementById(`step-icon-${num}`);
        const label = document.getElementById(`step-label-${num}`);

        if (content) {
            content.classList.add('hidden');
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

    // Tampilkan step yang diklik
    const activeContent = document.getElementById(`step-content-${stepNumber}`);
    if (activeContent) {
        activeContent.classList.remove('hidden');
    }

    // Scroll halus ke atas halaman
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function proceedToStep2() {
    // Dipanggil dari tombol "Lanjut Input Detail Form SPPD" di Step 1
    switchStep(2);
}

// ----------------------------------------------------
// 2. LOAD DATA MASTER & POPULATE DROPDOWN
// ----------------------------------------------------
async function loadInitialMasterData() {
    if (window.AppDB) {
        currentMasterASN = await window.AppDB.getMasterAsn();
        currentMasterSK = await window.AppDB.getMasterSK();
    }

    populateSKDropdown();
    populateASNDropdowns();
    renderMasterSKTable();
    renderMasterASNTable();
}

function populateSKDropdown() {
    const skSelect = document.getElementById('step1_kodeSK');
    if (!skSelect) return;
    skSelect.innerHTML = '<option value="">Pilih Sub Kegiatan</option>';

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

    if (selectPelaksana) selectPelaksana.innerHTML = '<option value="">Pilih Pelaksana Utama</option>';
    if (selectBendahara) selectBendahara.innerHTML = '<option value="">Pilih Bendahara</option>';

    currentMasterASN.forEach(asn => {
        const namaUpper = asn.nama ? asn.nama.toUpperCase() : '';

        if (selectPelaksana) {
            const opt = document.createElement('option');
            opt.value = asn.nip;
            opt.textContent = `${namaUpper} - NIP. ${asn.nip}`;
            selectPelaksana.appendChild(opt);
        }

        if (selectBendahara) {
            const optB = document.createElement('option');
            optB.value = asn.nip;
            optB.textContent = `${namaUpper} - NIP. ${asn.nip}`;
            if (asn.jabatan && asn.jabatan.toLowerCase().includes('bendahara')) {
                optB.selected = true;
                const nipBendahara = document.getElementById('nipBendahara');
                if (nipBendahara) nipBendahara.value = asn.nip;
            }
            selectBendahara.appendChild(optB);
        }
    });
}

// ----------------------------------------------------
// 3. AUTOFILL DATA PELAKSANA (Memastikan Jabatan Kedinasan)
// ----------------------------------------------------
function onNamaInputChanged(type, nip) {
    const matched = currentMasterASN.find(a => a.nip === nip);
    if (matched) {
        document.getElementById('nipPelaksana').value = matched.nip || '';
        // Memastikan Jabatan terisi nama Jabatan Kedinasan (Camat, Sekcam, Kasi, dll.), BUKAN Pangkat
        document.getElementById('jabatanPelaksana').value = matched.jabatan || '';
    } else {
        document.getElementById('nipPelaksana').value = '';
        document.getElementById('jabatanPelaksana').value = '';
    }
}

function onBendaharaSelected(nip) {
    const nipBendahara = document.getElementById('nipBendahara');
    if (nipBendahara) nipBendahara.value = nip;
}

// ----------------------------------------------------
// 4. PERHITUNGAN OTOMATIS LAMA HARI & ESTIMASI BIAYA
// ----------------------------------------------------
function calculateLamaHariFromDates() {
    const tglMulaiVal = document.getElementById('tglMulai')?.value;
    const tglKembaliVal = document.getElementById('tglKembali')?.value;
    const inputLamaHari = document.getElementById('lamaHari');

    if (tglMulaiVal && tglKembaliVal && inputLamaHari) {
        const dMulai = new Date(tglMulaiVal);
        const dKembali = new Date(tglKembaliVal);

        if (dKembali >= dMulai) {
            const diffTime = Math.abs(dKembali - dMulai);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inklusif
            inputLamaHari.value = diffDays;
        } else {
            alert("Tanggal Kembali tidak boleh sebelum Tanggal Mulai!");
            document.getElementById('tglKembali').value = tglMulaiVal;
            inputLamaHari.value = 1;
        }
    }
    updateSKQuotaInfo();
}

function updateSKQuotaInfo() {
    const lamaHari = parseInt(document.getElementById('lamaHari')?.value) || 1;
    const biayaPerOrang = parseInt(document.getElementById('biayaPerOrang')?.value) || 0;
    
    // Total Orang = 1 Pelaksana Utama + Jumlah Pengikut
    const totalPengikut = document.querySelectorAll('#pengikutContainer .pengikut-row').length;
    const totalOrang = 1 + totalPengikut;
    const totalBiaya = lamaHari * biayaPerOrang * totalOrang;

    const totalBiayaFormatted = document.getElementById('totalBiayaFormatted');
    if (totalBiayaFormatted) {
        totalBiayaFormatted.value = `Rp ${totalBiaya.toLocaleString('id-ID')}`;
    }

    const terbilangInput = document.getElementById('terbilang');
    if (terbilangInput) {
        terbilangInput.value = `${terbilang(totalBiaya)} Rupiah`;
    }
}

function syncTujuanPerdin(val) {
    const tempatTujuan = document.getElementById('tempatTujuan');
    if (tempatTujuan) {
        tempatTujuan.value = val;
    }
}

// ----------------------------------------------------
// 5. MANAJEMEN PENGIKUT DINAMIS
// ----------------------------------------------------
function addPengikutRow() {
    const container = document.getElementById('pengikutContainer');
    if (!container) return;

    const rowId = Date.now();
    let optionsAsn = '<option value="">Pilih ASN Pengikut</option>';
    currentMasterASN.forEach(a => {
        optionsAsn += `<option value="${a.nip}">${a.nama.toUpperCase()} - NIP. ${a.nip}</option>`;
    });

    const div = document.createElement('div');
    div.id = `pengikut-row-${rowId}`;
    div.className = 'pengikut-row grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 relative mb-2';

    div.innerHTML = `
        <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase">Nama Pengikut</label>
            <select onchange="onPengikutSelected('${rowId}', this.value)" class="w-full p-2 text-xs border rounded font-semibold bg-white uppercase-input">
                ${optionsAsn}
            </select>
        </div>
        <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase">NIP</label>
            <input type="text" id="pengikut-nip-${rowId}" readonly class="w-full p-2 text-xs border rounded font-mono bg-slate-100">
        </div>
        <div class="flex items-center gap-2">
            <div class="flex-1">
                <label class="block text-[10px] font-bold text-slate-500 uppercase">Jabatan</label>
                <input type="text" id="pengikut-jabatan-${rowId}" readonly class="w-full p-2 text-xs border rounded font-semibold bg-slate-100">
            </div>
            <button type="button" onclick="removePengikutRow('${rowId}')" class="mt-4 p-2 text-rose-600 hover:text-rose-800">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `;

    container.appendChild(div);
    updateSKQuotaInfo();
}

function onPengikutSelected(rowId, nip) {
    const matched = currentMasterASN.find(a => a.nip === nip);
    if (matched) {
        document.getElementById(`pengikut-nip-${rowId}`).value = matched.nip || '';
        // Autofill Jabatan Kedinasan Pengikut
        document.getElementById(`pengikut-jabatan-${rowId}`).value = matched.jabatan || '';
    }
}

function removePengikutRow(rowId) {
    const row = document.getElementById(`pengikut-row-${rowId}`);
    if (row) row.remove();
    updateSKQuotaInfo();
}

// ----------------------------------------------------
// 6. SUBMIT FORM & SIMPAN KE DATABASE
// ----------------------------------------------------
async function handleFormSubmit(event) {
    event.preventDefault();

    const nipUtama = document.getElementById('namaPelaksana')?.value;
    const matchedPelaksana = currentMasterASN.find(a => a.nip === nipUtama);

    const recordData = {
        id: Date.now().toString(),
        kodeSK: document.getElementById('step1_kodeSK')?.value,
        sumberDana: document.getElementById('sumberDana')?.value,
        noSuratTugas: document.getElementById('noSuratTugas')?.value,
        noSPPD: document.getElementById('noSPPD')?.value,
        maksudTujuan: document.getElementById('maksudTujuan')?.value,
        namaPelaksana: matchedPelaksana ? matchedPelaksana.nama.toUpperCase() : '',
        nipPelaksana: matchedPelaksana ? matchedPelaksana.nip : '',
        jabatanPelaksana: matchedPelaksana ? matchedPelaksana.jabatan : '',
        tempatBerangkat: document.getElementById('tempatBerangkat')?.value,
        tempatTujuan: document.getElementById('tempatTujuan')?.value,
        tglMulai: document.getElementById('tglMulai')?.value,
        tglKembali: document.getElementById('tglKembali')?.value,
        lamaHari: parseInt(document.getElementById('lamaHari')?.value) || 1,
        biayaPerOrang: parseInt(document.getElementById('biayaPerOrang')?.value) || 0,
        laporanHasil: document.getElementById('laporanHasil')?.value,
        namaPenggunaAnggaran: document.getElementById('namaPenggunaAnggaran')?.value,
        nipPenggunaAnggaran: document.getElementById('nipPenggunaAnggaran')?.value,
        namaPejabatTujuan: document.getElementById('namaPejabatTujuan')?.value,
        jabatanPejabatTujuan: document.getElementById('jabatanPejabatTujuan')?.value,
        createdAt: new Date().toISOString()
    };

    if (window.AppDB) {
        await window.AppDB.saveRecord(recordData);
    }

    alert('Data SPPD Berhasil Disimpan!');
    switchStep(3);
    await renderHistoryTable();
}

// ----------------------------------------------------
// 7. RIWAYAT SPPD (STEP 3)
// ----------------------------------------------------
async function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    let records = [];
    if (window.AppDB) records = await window.AppDB.getAllRecords();

    tbody.innerHTML = '';
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">Belum ada dokumen SPPD tersimpan.</td></tr>';
        return;
    }

    records.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = 'border-b hover:bg-slate-50';
        tr.innerHTML = `
            <td class="p-3 font-semibold">
                <div>ST: ${r.noSuratTugas || '-'}</div>
                <div class="text-[11px] text-slate-500">SPPD: ${r.noSPPD || '-'}</div>
            </td>
            <td class="p-3 font-mono text-xs">${r.kodeSK || '-'}</td>
            <td class="p-3 uppercase font-bold">${r.namaPelaksana || '-'}</td>
            <td class="p-3">${r.tempatTujuan || '-'}</td>
            <td class="p-3 font-bold text-emerald-700">Rp ${((r.lamaHari || 1) * (r.biayaPerOrang || 0)).toLocaleString('id-ID')}</td>
            <td class="p-3 text-center">
                <a href="cetak.html?id=${r.id}" target="_blank" class="px-3 py-1 bg-gov-700 hover:bg-gov-800 text-white rounded text-xs font-bold inline-flex items-center gap-1">
                    <i class="fa-solid fa-print"></i> Cetak
                </a>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ----------------------------------------------------
// 8. KELOLA MASTER DATA (MODAL ASN & SK)
// ----------------------------------------------------
async function saveAsnMaster(event) {
    event.preventDefault();
    const nama = document.getElementById('addAsnNama').value.trim().toUpperCase();
    const nip = document.getElementById('addAsnNip').value.trim();
    const jabatan = document.getElementById('addAsnJabatan').value.trim();
    const pangkat = document.getElementById('addAsnPangkat').value.trim();

    if (!nama || !nip || !jabatan) {
        alert('Mohon lengkapi Nama, NIP, dan Jabatan!');
        return;
    }

    const asnObj = { nama, nip, jabatan, pangkat };
    if (window.AppDB) {
        await window.AppDB.saveMasterAsn(asnObj);
    }
    
    document.getElementById('formAddAsn').reset();
    await loadInitialMasterData();
}

function renderMasterASNTable() {
    const tbody = document.getElementById('asnTableBody');
    const totalCount = document.getElementById('totalAsnCount');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (totalCount) totalCount.textContent = currentMasterASN.length;

    currentMasterASN.forEach(asn => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="p-2.5">
                <div class="font-bold text-slate-800 uppercase">${asn.nama}</div>
                <div class="text-[11px] font-mono text-slate-500">${asn.nip}</div>
            </td>
            <td class="p-2.5 font-semibold text-slate-700">${asn.jabatan || '-'}</td>
            <td class="p-2.5 text-center">
                <button type="button" onclick="deleteAsnItem('${asn.nip}')" class="text-rose-600 hover:text-rose-800 text-xs font-bold">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function deleteAsnItem(nip) {
    if (confirm(`Hapus data ASN dengan NIP ${nip}?`)) {
        if (window.AppDB) await window.AppDB.deleteMasterAsn(nip);
        await loadInitialMasterData();
    }
}

function renderMasterSKTable() {
    const tbody = document.getElementById('tableSKBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    currentMasterSK.forEach(sk => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="p-2.5 font-mono font-bold text-slate-700">${sk.kode}</td>
            <td class="p-2.5 font-medium">${sk.nama}</td>
            <td class="p-2.5 text-center font-bold text-gov-800">${sk.quota || 50}</td>
            <td class="p-2.5 text-center">
                <button type="button" onclick="deleteSKItem('${sk.kode}')" class="text-rose-600 hover:text-rose-800"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function deleteSKItem(kode) {
    if (confirm(`Hapus Sub Kegiatan ${kode}?`)) {
        if (window.AppDB) await window.AppDB.deleteMasterSK(kode);
        await loadInitialMasterData();
    }
}

async function saveNewSK(event) {
    event.preventDefault();
    const kode = document.getElementById('newKodeSK').value.trim();
    const nama = document.getElementById('newNamaSK').value.trim();
    const quota = parseInt(document.getElementById('newQuotaSK').value) || 50;

    if (window.AppDB) {
        await window.AppDB.saveMasterSK({ kode, nama, quota });
    }

    closeModalSK();
    await loadInitialMasterData();
}

// ----------------------------------------------------
// 9. UTILITY TERBILANG & MODAL TOGGLE HELPERS
// ----------------------------------------------------
function terbilang(n) {
    const angka = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
    if (n < 12) return angka[n];
    if (n < 20) return terbilang(n - 10) + " Belas";
    if (n < 100) return terbilang(Math.floor(n / 10)) + " Puluh " + terbilang(n % 10);
    if (n < 200) return "Seratus " + terbilang(n - 100);
    if (n < 1000) return terbilang(Math.floor(n / 100)) + " Ratus " + terbilang(n % 100);
    if (n < 2000) return "Seribu " + terbilang(n - 1000);
    if (n < 1000000) return terbilang(Math.floor(n / 1000)) + " Ribu " + terbilang(n % 1000);
    if (n < 1000000000) return terbilang(Math.floor(n / 1000000)) + " Juta " + terbilang(n % 1000000);
    return "";
}

function openModalAsn() { document.getElementById('modalAsn')?.classList.remove('hidden'); document.getElementById('modalAsn')?.classList.add('flex'); }
function closeModalAsn() { document.getElementById('modalAsn')?.classList.add('hidden'); document.getElementById('modalAsn')?.classList.remove('flex'); }
function openModalSK() { document.getElementById('modalSK')?.classList.remove('hidden'); document.getElementById('modalSK')?.classList.add('flex'); }
function closeModalSK() { document.getElementById('modalSK')?.classList.add('hidden'); document.getElementById('modalSK')?.classList.remove('flex'); }
function openModalManageSK() { document.getElementById('modalManageSK')?.classList.remove('hidden'); document.getElementById('modalManageSK')?.classList.add('flex'); }
function closeModalManageSK() { document.getElementById('modalManageSK')?.classList.add('hidden'); document.getElementById('modalManageSK')?.classList.remove('flex'); }
