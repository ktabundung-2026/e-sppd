/*
  ====================================================================================
  Nama Aplikasi : Sistem e - SPPD Terpadu - Kecamatan Tabundung
  Hosting       : GitHub Pages (Murni Single Page Application / SPA)
  Backend / DB  : Supabase REST API & Supabase Storage
  Nama Halaman  : js/sppd.js
  Fungsi Halaman: Logika pemrosesan form, perhitungan otomatis Lama Hari dari selisih 
                  tanggal, autofill ASN (NIP, Pangkat, Jabatan), perbaikan mapping 
                  data tertukar, serta penyimpanan dan pengalihan ke cetak.html.
  ====================================================================================
*/

let currentMasterASN = [];
let currentMasterSK = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadInitialMasterData();
    await renderHistoryTable();
});

// ----------------------------------------------------
// STEPPER NAVIGATION (Step 1, 2, 3) - DIPERBAIKI
// ----------------------------------------------------
function switchStep(stepNumber) {
    // Sembunyikan semua kontainer step (step-content-1, 2, 3)
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

    // Tampilkan step yang dipilih
    const activeContent = document.getElementById(`step-content-${stepNumber}`);
    if (activeContent) {
        activeContent.classList.remove('hidden');
    }

    // Scroll halus ke atas
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function proceedToStep2() {
    const kodeSK = document.getElementById('step1_kodeSK')?.value;
    if (!kodeSK) {
        alert('Silakan pilih Kode Sub Kegiatan (SK) terlebih dahulu!');
        return;
    }
    switchStep(2);
}

// ----------------------------------------------------
// PERHITUNGAN OTOMATIS LAMA HARI & BIAYA
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
    
    // Hitung total orang (1 Pelaksana Utama + Jumlah Pengikut)
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
// LOAD DATA MASTER (ASN & SK)
// ----------------------------------------------------
async function loadInitialMasterData() {
    if (window.AppDB) {
        currentMasterASN = await window.AppDB.getMasterAsn();
        currentMasterSK = await window.AppDB.getMasterSK();
    }

    populateSKDropdown();
    populateASNDropdowns();
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

function onNamaInputChanged(type, nip) {
    const matched = currentMasterASN.find(a => a.nip === nip);
    if (matched) {
        document.getElementById('nipPelaksana').value = matched.nip || '';
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
// BARIS PENGIKUT DINAMIS
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
        document.getElementById(`pengikut-jabatan-${rowId}`).value = matched.jabatan || '';
    }
}

function removePengikutRow(rowId) {
    const row = document.getElementById(`pengikut-row-${rowId}`);
    if (row) row.remove();
    updateSKQuotaInfo();
}

// ----------------------------------------------------
// PENYIMPANAN FORM & CETAK
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
// RIWAYAT SPPD (STEP 3)
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
// UTILITY TERBILANG
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

// Modal Toggle Helpers
function openModalAsn() { document.getElementById('modalAsn')?.classList.remove('hidden'); document.getElementById('modalAsn')?.classList.add('flex'); }
function closeModalAsn() { document.getElementById('modalAsn')?.classList.add('hidden'); document.getElementById('modalAsn')?.classList.remove('flex'); }
function openModalSK() { document.getElementById('modalSK')?.classList.remove('hidden'); document.getElementById('modalSK')?.classList.add('flex'); }
function closeModalSK() { document.getElementById('modalSK')?.classList.add('hidden'); document.getElementById('modalSK')?.classList.remove('flex'); }
function openModalManageSK() { document.getElementById('modalManageSK')?.classList.remove('hidden'); document.getElementById('modalManageSK')?.classList.add('flex'); }
function closeModalManageSK() { document.getElementById('modalManageSK')?.classList.add('hidden'); document.getElementById('modalManageSK')?.classList.remove('flex'); }
