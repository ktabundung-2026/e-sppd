// INISIALISASI DATABASE TERPADU INDEXEDDB
const db = new Dexie('eSPPD_Tabundung_DB');
db.version(1).stores({
    records: '++id, noSuratTugas, kodeSubKegiatan, namaPelaksana, tglMulai',
    asnMaster: 'nip, nama, jabatan, pangkat',
    settings: 'key, value'
});

const DEFAULT_MAX_KUOTA_OH = 50;
let currentStep = 1;
let pengikutCount = 0;
let cachedAsnList = [];

window.onload = async function() {
    setupNetworkBadge();
    await seedAsnMaster();
    await loadAsnCache();
    populateSelectOptions();
    await window.updateSKQuotaInfo();
    loadLocalRecords();
    calculateTotalBudget();
};

function setupNetworkBadge() {
    const badge = document.getElementById('header-network-badge');
    if (!badge) return;
    badge.className = navigator.onLine 
        ? 'px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-600 text-white' 
        : 'px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-600 text-white';
    badge.innerText = navigator.onLine ? 'Online' : 'Offline';
}

window.switchStep = function(stepNum) {
    currentStep = stepNum;
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`step-content-${stepNum}`).classList.remove('hidden');

    document.querySelectorAll('.step-btn').forEach((btn, idx) => {
        const icon = btn.querySelector('.step-icon');
        const label = btn.querySelector('.step-label');
        if (idx + 1 === stepNum) {
            icon.className = 'step-icon w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-gov-700 text-white shadow-md';
            label.className = 'step-label text-xs font-bold text-gov-800 mt-1';
        } else {
            icon.className = 'step-icon w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-slate-200 text-slate-600';
            label.className = 'step-label text-xs font-medium text-slate-500 mt-1';
        }
    });
};

async function seedAsnMaster() {
    const count = await db.asnMaster.count();
    if (count === 0) {
        await db.asnMaster.bulkPut([
            { nama: "RUDOLF UMBU RESI LOLY, ST", jabatan: "CAMAT TABUNDUNG", nip: "197205212006041008", pangkat: "Pembina" },
            { nama: "KORNELIS KOPA RIHI, SE", jabatan: "SEKRETARIS CAMAT", nip: "197811262010011008", pangkat: "Penata Tk. I" }            
        ]);
    }
}

async function loadAsnCache() {
    cachedAsnList = await db.asnMaster.toArray();
}

function populateSelectOptions() {
    const selectPelaksana = document.getElementById('namaPelaksana');
    if (selectPelaksana) {
        selectPelaksana.innerHTML = '<option value="">-- Pilih ASN Pelaksana --</option>';
        cachedAsnList.forEach(asn => {
            selectPelaksana.innerHTML += `<option value="${asn.nama}">${asn.nama}</option>`;
        });
    }
}

window.onNamaInputChanged = async function(role, namaVal) {
    if (!namaVal) return;
    const match = cachedAsnList.find(a => a.nama === namaVal);
    if (match && role === 'Pelaksana') {
        document.getElementById('nipPelaksana').value = match.nip;
    }
};

// SIMPAN SETTINGAN KUOTA SK BARU
window.saveCustomSKQuota = async function(val) {
    const kodeSK = document.getElementById('step1_kodeSK')?.value.trim() || '7.01.01.2.01.0003';
    const newMax = parseInt(val) || DEFAULT_MAX_KUOTA_OH;
    
    await db.settings.put({ key: `quota_${kodeSK}`, value: newMax });
    await window.updateSKQuotaInfo();
};

// HITUNG DAN UPDATE STATUS KUOTA SK
window.updateSKQuotaInfo = async function() {
    const kodeSK = document.getElementById('step1_kodeSK')?.value.trim() || '7.01.01.2.01.0003';
    const lblSK = document.getElementById('lblCurrentSK');
    if (lblSK) lblSK.innerText = kodeSK;

    // Hitung OH terpakai dari IndexedDB
    const records = await db.records.filter(r => r.kodeSubKegiatan === kodeSK).toArray();
    let usedOH = 0;
    records.forEach(r => {
        const countPengikut = Array.isArray(r.pengikut) ? r.pengikut.length : (r.jumlahPengikut || 0);
        usedOH += (1 + countPengikut);
    });

    // Ambil batas kuota tersimpan
    const quotaSetting = await db.settings.get(`quota_${kodeSK}`);
    const maxQuota = quotaSetting ? parseInt(quotaSetting.value) : DEFAULT_MAX_KUOTA_OH;

    const inputMax = document.getElementById('inputMaxQuota');
    if (inputMax && document.activeElement !== inputMax) {
        inputMax.value = maxQuota;
    }

    const remainingOH = Math.max(0, maxQuota - usedOH);
    const percentage = Math.min(100, Math.round((usedOH / maxQuota) * 100));

    // Update Elemen UI Kuota
    document.getElementById('valUsedQuota').innerText = `${usedOH} OH`;
    document.getElementById('valRemainingQuota').innerText = `${remainingOH} OH`;

    const pBar = document.getElementById('progressBarQuota');
    const badgeStatus = document.getElementById('badgeStatusQuota');

    if (pBar) {
        pBar.style.width = `${percentage}%`;
        pBar.className = percentage >= 90 ? 'bg-rose-600 h-2 rounded-full transition-all duration-300' :
                         percentage >= 75 ? 'bg-amber-500 h-2 rounded-full transition-all duration-300' :
                         'bg-gov-700 h-2 rounded-full transition-all duration-300';
    }

    if (badgeStatus) {
        if (remainingOH <= 0) {
            badgeStatus.className = 'text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300';
            badgeStatus.innerText = 'Kuota Habis';
        } else if (remainingOH <= 5) {
            badgeStatus.className = 'text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300';
            badgeStatus.innerText = 'Kuota Menipis';
        } else {
            badgeStatus.className = 'text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300';
            badgeStatus.innerText = 'Tersedia';
        }
    }

    const currentPengikutCount = document.querySelectorAll('#pengikutContainer > div').length;
    const requiredOH = 1 + currentPengikutCount;
    document.getElementById('lblPenugasanOH').innerText = `${requiredOH} OH`;

    return { maxQuota, usedOH, remainingOH, requiredOH };
};

// TAMBAH PENGIKUT
window.addOfficerRow = function() {
    pengikutCount++;
    const container = document.getElementById('pengikutContainer');
    if (!container) return;

    const div = document.createElement('div');
    div.id = `pengikut-row-${pengikutCount}`;
    div.className = 'bg-white p-3 rounded-lg border border-slate-200 space-y-2 shadow-sm';

    let optionsHTML = '<option value="">-- Pilih Anggota Pengikut --</option>';
    cachedAsnList.forEach(asn => {
        optionsHTML += `<option value="${asn.nama}">${asn.nama}</option>`;
    });

    div.innerHTML = `
        <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-700">Anggota Pengikut ${pengikutCount}</span>
            <button type="button" onclick="removeOfficerRow(${pengikutCount})" class="text-rose-600 hover:text-rose-800 text-xs font-bold flex items-center gap-1">
                <i class="fa-solid fa-trash"></i> Hapus
            </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
                <select class="pengikut-nama w-full p-2 text-xs rounded border border-slate-300 font-semibold" onchange="autofillPengikutRow(${pengikutCount}, this.value)">
                    ${optionsHTML}
                </select>
            </div>
            <div>
                <input type="text" placeholder="NIP Pengikut" readonly class="pengikut-nip w-full p-2 text-xs rounded border border-slate-200 bg-slate-100 font-mono">
            </div>
        </div>
    `;

    container.appendChild(div);
    calculateTotalBudget();
    window.updateSKQuotaInfo();
};

// HAPUS PENGIKUT
window.removeOfficerRow = function(id) {
    const row = document.getElementById(`pengikut-row-${id}`);
    if (row) {
        row.remove();
        calculateTotalBudget();
        window.updateSKQuotaInfo();
    }
};

window.autofillPengikutRow = function(id, namaVal) {
    const match = cachedAsnList.find(a => a.nama === namaVal);
    const row = document.getElementById(`pengikut-row-${id}`);
    if (row) {
        const nipInput = row.querySelector('.pengikut-nip');
        if (nipInput) nipInput.value = match ? match.nip : '';
    }
};

window.calculateTotalBudget = function() {
    const satuan = parseFloat(document.getElementById('biayaPerOrang').value) || 0;
    const totalPengikut = document.querySelectorAll('#pengikutContainer > div').length;
    const total = satuan * (1 + totalPengikut);
    
    const formatted = document.getElementById('totalBiayaFormatted');
    if (formatted) formatted.value = 'Rp ' + total.toLocaleString('id-ID');
    return total;
};

window.proceedToStep2 = async function() {
    const namaPelaksana = document.getElementById('namaPelaksana').value;
    if (!namaPelaksana) return alert("Pilih Pelaksana Utama terlebih dahulu!");

    const quotaInfo = await window.updateSKQuotaInfo();

    if (quotaInfo.requiredOH > quotaInfo.remainingOH) {
        alert(`Penugasan ditolak! Kuota Perdin untuk SK (${document.getElementById('step1_kodeSK').value}) tidak mencukupi.\n\n` +
              `• Dibutuhkan: ${quotaInfo.requiredOH} OH\n` +
              `• Sisa Kuota: ${quotaInfo.remainingOH} OH`);
        return;
    }

    switchStep(2);
};

window.handleFormSubmit = async function(e) {
    e.preventDefault();
    const record = {
        noSuratTugas: document.getElementById('noSuratTugas').value,
        noSPPD: document.getElementById('noSPPD').value,
        maksudTujuan: document.getElementById('maksudTujuan').value,
        namaPelaksana: document.getElementById('namaPelaksana').value,
        nipPelaksana: document.getElementById('nipPelaksana').value,
        kodeSubKegiatan: document.getElementById('step1_kodeSK').value,
        desaTujuan: document.getElementById('step1_selectDesa').value,
        totalBiaya: calculateTotalBudget(),
        createdAt: new Date().toISOString()
    };

    const id = await db.records.add(record);
    sessionStorage.setItem('sppd_print_current', JSON.stringify({ ...record, id }));
    alert('SPPD Berhasil Disimpan! Membuka Halaman Cetak...');
    
    await loadLocalRecords();
    openCetakPage(id);
};

window.openCetakPage = async function(id) {
    const record = await db.records.get(id);
    if (record) {
        sessionStorage.setItem('sppd_print_current', JSON.stringify(record));
        window.location.href = `cetak.html?id=${id}`;
    } else {
        alert("Data SPPD tidak ditemukan!");
    }
};

window.deleteRecord = async function(id) {
    if (confirm("Apakah Anda yakin ingin menghapus data SPPD ini?")) {
        await db.records.delete(id);
        await loadLocalRecords();
        await window.updateSKQuotaInfo();
    }
};

async function loadLocalRecords() {
    const records = await db.records.reverse().toArray();
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Belum ada riwayat SPPD.</td></tr>`;
        return;
    }

    tbody.innerHTML = records.map(r => `
        <tr class="hover:bg-slate-50 border-b">
            <td class="p-3 font-medium">
                ${r.noSuratTugas}<br>
                <span class="text-[11px] text-slate-500">${r.noSPPD || '-'}</span>
            </td>
            <td class="p-3 font-mono font-bold text-sky-800">${r.kodeSubKegiatan}</td>
            <td class="p-3 font-bold">${r.namaPelaksana}</td>
            <td class="p-3">${r.desaTujuan || r.maksudTujuan}</td>
            <td class="p-3 font-semibold text-emerald-700">Rp ${(r.totalBiaya || 0).toLocaleString('id-ID')}</td>
            <td class="p-3 text-center">
                <button onclick="openCetakPage(${r.id})" class="bg-gov-700 hover:bg-gov-800 text-white px-2.5 py-1 rounded text-xs transition mr-1">
                    <i class="fa-solid fa-print"></i> Cetak
                </button>
                <button onclick="deleteRecord(${r.id})" class="text-rose-600 hover:text-rose-800 p-1 text-xs">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// MANAGEMENT MODAL MASTER ASN
window.openAsnMasterModal = function() { 
    const modal = document.getElementById('asnMasterModal');
    if (modal) {
        modal.classList.remove('hidden'); 
        renderAsnList(); 
    }
};

window.closeAsnMasterModal = function() { 
    const modal = document.getElementById('asnMasterModal');
    if (modal) modal.classList.add('hidden'); 
};

async function renderAsnList() {
    const list = await db.asnMaster.toArray();
    const records = await db.records.reverse().toArray();
    const container = document.getElementById('asnListContainer');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-4">Belum ada data ASN.</p>`;
        return;
    }

    container.innerHTML = list.map(a => {
        const lastRecord = records.find(r => r.namaPelaksana === a.nama || (r.pengikut && r.pengikut.some(p => p.nama === a.nama)));
        const docInfo = lastRecord 
            ? `<div class="mt-1.5 text-[11px] bg-slate-100 p-2 rounded border border-slate-200">
                <p class="font-bold text-gov-800 mb-0.5"><i class="fa-solid fa-file-lines mr-1"></i> Penugasan Terakhir:</p>
                <p class="text-slate-700">No. ST: <span class="font-mono font-bold">${lastRecord.noSuratTugas}</span></p>
                <p class="text-slate-700">No. SPPD: <span class="font-mono font-bold">${lastRecord.noSPPD || '-'}</span></p>
               </div>` 
            : `<p class="text-[10px] text-slate-400 italic mt-0.5">Belum ada riwayat penugasan</p>`;

        return `
            <div class="py-3 flex justify-between items-start text-xs border-b border-slate-100">
                <div class="flex-1 pr-2">
                    <p class="font-bold text-slate-800 text-sm">${a.nama}</p>
                    <p class="text-slate-500 font-mono">NIP. ${a.nip} • ${a.jabatan}</p>
                    ${docInfo}
                </div>
                <button onclick="deleteAsn('${a.nip}')" class="text-rose-600 hover:text-rose-800 font-bold text-xs p-1">
                    <i class="fa-solid fa-trash"></i> Hapus
                </button>
            </div>
        `;
    }).join('');
}

window.saveAsnMaster = async function(e) {
    e.preventDefault();
    await db.asnMaster.put({
        nama: document.getElementById('asnNama').value,
        nip: document.getElementById('asnNip').value,
        pangkat: document.getElementById('asnPangkat').value,
        jabatan: document.getElementById('asnJabatan').value
    });
    document.getElementById('asnForm').reset();
    await loadAsnCache();
    renderAsnList();
    populateSelectOptions();
};

window.deleteAsn = async function(nip) {
    if(confirm('Hapus ASN ini?')) { 
        await db.asnMaster.delete(nip); 
        await loadAsnCache();
        renderAsnList(); 
        populateSelectOptions(); 
    }
};
