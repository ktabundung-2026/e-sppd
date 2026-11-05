/**
 * js/sppd.js - Sistem Pengelolaan SPPD Kecamatan Tabundung
 */

const DEFAULT_ASN_LIST = [
    { nama: "RUDOLF UMBU RESI LOLY, ST", nip: "197205212006041008", pangkat: "Pembina (IV/a)", jabatan: "Camat Tabundung" },
    { nama: "DANIEL KAMBARU WINDI", nip: "197712312008011084", pangkat: "Penata Tk. I (III/d)", jabatan: "Bendahara Pengeluaran" }
];

let masterAsnList = [];
let masterSKList = [];
let currentPengikut = [];
let currentStep = 1;

document.addEventListener('DOMContentLoaded', async () => {
    initOnlineStatus();
    await loadMasterAsn();
    await loadCustomSKList();
    initEventListeners();
    initFormDefaults();
    updateSKQuotaInfo();
    renderHistoryTable();
});

function initOnlineStatus() {
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
}

function updateOnlineStatus() {
    const badge = document.getElementById('statusBadge');
    if (!badge) return;

    if (navigator.onLine) {
        badge.className = "px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 bg-emerald-600/90 text-white border border-emerald-400/30 backdrop-blur-sm shadow-sm";
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-200 animate-pulse"></span> Mode Online`;
    } else {
        badge.className = "px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 bg-amber-600/90 text-white border border-amber-400/30 backdrop-blur-sm shadow-sm";
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-200"></span> Mode Offline`;
    }
}

async function loadCustomSKList() {
    const selectSK = document.getElementById('step1_kodeSK');
    if (!selectSK) return;

    if (window.AppDB && typeof window.AppDB.getMasterSK === 'function') {
        masterSKList = await window.AppDB.getMasterSK();
    } else {
        const saved = localStorage.getItem('sppd_custom_sk_list');
        masterSKList = saved ? JSON.parse(saved) : [];
    }

    selectSK.innerHTML = '<option value="">Pilih Sub Kegiatan</option>';
    masterSKList.forEach(sk => {
        const opt = document.createElement('option');
        opt.value = sk.kode;
        opt.innerText = `${sk.kode} - ${sk.nama}`;
        selectSK.appendChild(opt);
    });
}

function openModalSK(isEdit = false, kode = '', nama = '', quota = 50) {
    const modal = document.getElementById('modalSK');
    const inputKode = document.getElementById('newKodeSK');
    const inputNama = document.getElementById('newNamaSK');
    const inputQuota = document.getElementById('newQuotaSK');
    const isEditMode = document.getElementById('isEditSKMode');

    if (modal) {
        if (isEdit) {
            if (isEditMode) isEditMode.value = "true";
            if (inputKode) { inputKode.value = kode; inputKode.readOnly = true; }
            if (inputNama) inputNama.value = nama;
            if (inputQuota) inputQuota.value = quota;
        } else {
            if (isEditMode) isEditMode.value = "false";
            if (inputKode) { inputKode.value = ''; inputKode.readOnly = false; }
            if (inputNama) inputNama.value = '';
            if (inputQuota) inputQuota.value = 50;
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeModalSK() {
    const modal = document.getElementById('modalSK');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function saveNewSK(e) {
    e.preventDefault();
    const kode = document.getElementById('newKodeSK')?.value.trim();
    const nama = document.getElementById('newNamaSK')?.value.trim();
    const quota = parseInt(document.getElementById('newQuotaSK')?.value) || 50;

    if (!kode || !nama) {
        alert("Kode SK dan Nama Sub Kegiatan wajib diisi!");
        return;
    }

    const newSKObj = { kode, nama, quota };
    if (window.AppDB && typeof window.AppDB.saveMasterSK === 'function') {
        await window.AppDB.saveMasterSK(newSKObj);
    }
    await loadCustomSKList();
    closeModalSK();
    closeModalManageSK();
    updateSKQuotaInfo();
}

function openModalManageSK() {
    const modal = document.getElementById('modalManageSK');
    if (modal) {
        renderManageSKTable();
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeModalManageSK() {
    const modal = document.getElementById('modalManageSK');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function renderManageSKTable() {
    const tbody = document.getElementById('tableSKBody');
    if (!tbody) return;
    await loadCustomSKList();

    if (masterSKList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-slate-400 italic">Belum ada Sub Kegiatan.</td></tr>`;
        return;
    }

    tbody.innerHTML = masterSKList.map(sk => `
        <tr class="hover:bg-slate-50 transition border-b">
            <td class="p-2.5 font-mono font-bold text-gov-800">${sk.kode}</td>
            <td class="p-2.5 font-semibold text-slate-700">${sk.nama}</td>
            <td class="p-2.5 text-center font-bold text-emerald-700">${sk.quota || 50} OH</td>
            <td class="p-2.5 text-center">
                <button type="button" onclick="openModalSK(true, '${sk.kode}', '${sk.nama}', ${sk.quota || 50})" class="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[11px] font-bold">Edit</button>
            </td>
        </tr>
    `).join('');
}

async function loadMasterAsn() {
    if (window.AppDB && typeof window.AppDB.getMasterAsn === 'function') {
        masterAsnList = await window.AppDB.getMasterAsn();
    } else {
        const saved = localStorage.getItem('sppd_master_asn');
        masterAsnList = saved ? JSON.parse(saved) : [];
    }
    if (!masterAsnList || masterAsnList.length === 0) masterAsnList = [...DEFAULT_ASN_LIST];
    populatePelaksanaDropdowns();
}

function populatePelaksanaDropdowns() {
    const selectPelaksana = document.getElementById('namaPelaksana');
    const selectBendahara = document.getElementById('selectBendahara');

    const optionsHTML = masterAsnList.map(a => `<option value="${a.nama}">${a.nama}</option>`).join('');

    if (selectPelaksana) {
        selectPelaksana.innerHTML = '<option value="">-- Pilih Pelaksana Utama --</option>' + optionsHTML;
        if (masterAsnList.length > 0) {
            selectPelaksana.value = masterAsnList[0].nama;
            onNamaInputChanged('Pelaksana', selectPelaksana.value);
        }
    }

    if (selectBendahara) {
        selectBendahara.innerHTML = '<option value="">-- Pilih Bendahara --</option>' + optionsHTML;
        const defaultBendahara = masterAsnList.find(a => a.jabatan && a.jabatan.toLowerCase().includes('bendahara')) || masterAsnList[0];
        if (defaultBendahara) {
            selectBendahara.value = defaultBendahara.nama;
            onBendaharaSelected(defaultBendahara.nama);
        }
    }
}

function onNamaInputChanged(type, selectedNama) {
    const match = masterAsnList.find(a => a.nama === selectedNama);
    if (type === 'Pelaksana') {
        document.getElementById('nipPelaksana').value = match ? (match.nip || '-') : '';
        document.getElementById('jabatanPelaksana').value = match ? (match.jabatan || '-') : '';
    }
    updateSKQuotaInfo();
}

function onBendaharaSelected(selectedNama) {
    const match = masterAsnList.find(a => a.nama === selectedNama);
    document.getElementById('nipBendahara').value = match ? (match.nip || '-') : '';
}

function addPengikutRow() {
    const container = document.getElementById('pengikutContainer');
    if (!container) return;

    const idx = currentPengikut.length;
    currentPengikut.push({ nama: '', nip: '', jabatan: '' });

    const row = document.createElement('div');
    row.className = "flex flex-col sm:flex-row gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200 mt-2";
    row.id = `pengikutRow_${idx}`;
    const optionsHTML = masterAsnList.map(a => `<option value="${a.nama}">${a.nama}</option>`).join('');

    row.innerHTML = `
        <select onchange="updatePengikutSelect(${idx}, this.value)" class="w-full sm:w-1/3 p-2 text-xs border rounded font-semibold">
            <option value="">-- Pilih Anggota Tim --</option>${optionsHTML}
        </select>
        <input type="text" id="pengikutNip_${idx}" placeholder="NIP" class="w-full sm:w-1/3 p-2 text-xs border rounded font-mono bg-slate-50" readonly>
        <input type="text" id="pengikutJabatan_${idx}" placeholder="Jabatan" class="w-full sm:w-1/3 p-2 text-xs border rounded font-semibold bg-slate-50" readonly>
        <button type="button" onclick="removePengikutRow(${idx})" class="text-rose-600 p-1.5"><i class="fa-solid fa-xmark"></i></button>
    `;
    container.appendChild(row);
    updateSKQuotaInfo();
}

function updatePengikutSelect(idx, nama) {
    const match = masterAsnList.find(a => a.nama === nama);
    if (currentPengikut[idx]) {
        currentPengikut[idx] = { nama: nama, nip: match ? match.nip : '', jabatan: match ? match.jabatan : '' };
        document.getElementById(`pengikutNip_${idx}`).value = match ? (match.nip || '-') : '';
        document.getElementById(`pengikutJabatan_${idx}`).value = match ? (match.jabatan || '-') : '';
    }
    updateSKQuotaInfo();
}

function removePengikutRow(idx) {
    const row = document.getElementById(`pengikutRow_${idx}`);
    if (row) row.remove();
    currentPengikut[idx] = null;
    updateSKQuotaInfo();
}

function calculateLamaHariFromDates() {
    const tglMulaiVal = document.getElementById('tglMulai')?.value;
    const tglKembaliVal = document.getElementById('tglKembali')?.value;
    const lamaHariInput = document.getElementById('lamaHari');

    if (tglMulaiVal && tglKembaliVal && lamaHariInput) {
        const dMulai = new Date(tglMulaiVal);
        const dKembali = new Date(tglKembaliVal);
        const diffTime = dKembali - dMulai;
        if (diffTime >= 0) {
            lamaHariInput.value = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        } else {
            lamaHariInput.value = 1;
        }
    }
    updateSKQuotaInfo();
}

function updateSKQuotaInfo() {
    const activePengikut = currentPengikut.filter(p => p !== null && p.nama !== '');
    const totalPersonil = 1 + activePengikut.length;
    const days = parseInt(document.getElementById('lamaHari')?.value) || 1;
    calculateTotalBiaya(days, totalPersonil);
}

function syncTujuanPerdin(val) {
    const destInput = document.getElementById('tempatTujuan');
    if (destInput) destInput.value = val ? val.toUpperCase() : '';
}

function calculateTotalBiaya(daysParam, personilParam) {
    const days = daysParam || 1;
    const totalPersonil = personilParam || 1;
    const rate = parseFloat(document.getElementById('biayaPerOrang')?.value) || 0;
    const totalBiaya = days * rate * totalPersonil;
    
    document.getElementById('totalBiayaFormatted').value = `Rp ${totalBiaya.toLocaleString('id-ID')}`;
    document.getElementById('terbilang').value = `${numberToWords(totalBiaya)} Rupiah`;
}

function switchStep(stepNumber) {
    currentStep = stepNumber;
    [1, 2, 3].forEach(s => {
        document.getElementById(`step-content-${s}`)?.classList.add('hidden');
    });
    document.getElementById(`step-content-${stepNumber}`)?.classList.remove('hidden');
    if (stepNumber === 3) renderHistoryTable();
}

function proceedToStep2() {
    const desa = document.getElementById('step1_selectDesa')?.value.trim();
    if (!desa) {
        alert("Harap isi tempat / desa tujuan perjalanan dinas!");
        return;
    }
    syncTujuanPerdin(desa);
    switchStep(2);
}

function initFormDefaults() {
    const today = new Date().toISOString().split('T')[0];
    if (!document.getElementById('tglMulai').value) document.getElementById('tglMulai').value = today;
    if (!document.getElementById('tglKembali').value) document.getElementById('tglKembali').value = today;
}

function initEventListeners() {
    document.getElementById('sppdForm')?.addEventListener('submit', handleFormSubmit);
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const activePengikut = currentPengikut.filter(p => p !== null && p.nama.trim() !== '');
    const days = parseInt(document.getElementById('lamaHari')?.value) || 1;
    const rate = parseFloat(document.getElementById('biayaPerOrang')?.value) || 0;
    const totalPersonil = 1 + activePengikut.length;
    const totalBiaya = days * rate * totalPersonil;

    const record = {
        id: Date.now(),
        noSuratTugas: document.getElementById('noSuratTugas')?.value || '',
        noSPPD: document.getElementById('noSPPD')?.value || '',
        noBku: 'BKU/' + Date.now().toString().slice(-4),
        kodeSK: document.getElementById('step1_kodeSK')?.value || '',
        sumberDana: document.getElementById('sumberDana')?.value || 'DAU',
        maksudTujuan: document.getElementById('maksudTujuan')?.value || '',
        laporanHasil: document.getElementById('laporanHasil')?.value || '',
        
        namaPelaksana: (document.getElementById('namaPelaksana')?.value || '').toUpperCase(),
        nipPelaksana: document.getElementById('nipPelaksana')?.value || '',
        pangkatPelaksana: (masterAsnList.find(a => a.nama === document.getElementById('namaPelaksana')?.value)?.pangkat) || '-',
        jabatanPelaksana: document.getElementById('jabatanPelaksana')?.value || '',
        pengikut: activePengikut,

        tempatBerangkat: document.getElementById('tempatBerangkat')?.value || 'Malahar',
        tempatTujuan: document.getElementById('tempatTujuan')?.value || '',
        tglMulai: document.getElementById('tglMulai')?.value,
        tglSelesai: document.getElementById('tglKembali')?.value,
        lamaHari: days,
        biayaPerOrang: rate,
        totalBiaya: totalBiaya,

        namaCamat: document.getElementById('namaPenggunaAnggaran')?.value || 'RUDOLF UMBU RESI LOLY, ST',
        nipCamat: document.getElementById('nipPenggunaAnggaran')?.value || '197205212006041008',
        namaBendahara: document.getElementById('selectBendahara')?.value || '',
        nipBendahara: document.getElementById('nipBendahara')?.value || '',
        createdAt: new Date().toISOString()
    };

    if (window.AppDB) await window.AppDB.saveRecord(record);
    sessionStorage.setItem('sppd_print_current', JSON.stringify(record));
    window.location.href = `cetak.html?id=${record.id}`;
}

async function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    let records = window.AppDB ? await window.AppDB.getAllRecords() : [];
    if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 italic">Belum ada riwayat SPPD.</td></tr>`;
        return;
    }

    tbody.innerHTML = records.map(r => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3"><span class="font-bold text-gov-800">${r.noSuratTugas || '-'}</span></td>
            <td class="p-3"><span class="font-mono font-bold">${r.kodeSK || '-'}</span></td>
            <td class="p-3 font-semibold">${r.namaPelaksana || '-'}</td>
            <td class="p-3">${r.tempatTujuan || '-'}</td>
            <td class="p-3 font-extrabold text-emerald-700">Rp ${(r.totalBiaya || 0).toLocaleString('id-ID')}</td>
            <td class="p-3 text-center">
                <a href="cetak.html?id=${r.id}" class="bg-gov-700 text-white px-2 py-1 rounded text-[11px] font-bold">Cetak</a>
            </td>
        </tr>
    `).join('');
}

function numberToWords(amount) {
    const words = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
    let num = Math.floor(Math.abs(amount));
    if (num === 0) return "Nol";
    function convert(n) {
        if (n < 12) return words[n];
        if (n < 20) return convert(n - 10) + " Belas";
        if (n < 100) return convert(Math.floor(n / 10)) + " Puluh " + convert(n % 10);
        if (n < 1000) return convert(Math.floor(n / 100)) + " Ratus " + convert(n % 100);
        if (n < 2000) return "Seribu " + convert(n - 1000);
        if (n < 1000000) return convert(Math.floor(n / 1000)) + " Ribu " + convert(n % 1000);
        if (n < 1000000000) return convert(Math.floor(n / 1000000)) + " Juta " + convert(n % 1000000);
        return n.toString();
    }
    return convert(num).replace(/\s+/g, ' ').trim();
}
