// INISIALISASI DATABASE TERPADU INDEXEDDB
const db = new Dexie('eSPPD_Tabundung_DB');
db.version(1).stores({
    records: '++id, noSuratTugas, kodeSubKegiatan, namaPelaksana, tglMulai',
    asnMaster: 'nip, nama, jabatan, pangkat',
    settings: 'key, value'
});

const DAFTAR_DESA_TABUNDUNG = [
    "Desa Banggawatu", "Desa Tapil", "Desa Tarimbang", "Desa Kukitalu", 
    "Desa Karita", "Desa Waikanabu", "Desa Billa", "Desa Wudipandak", 
    "Desa Praing Kareha", "Desa Pindu Hurani"
];

let currentStep = 1;
let pengikutCount = 0;
let cachedAsnList = [];

window.onload = async function() {
    setupNetworkBadge();
    await seedAsnMaster();
    await loadAsnCache();
    populateSelectOptions();
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

window.proceedToStep2 = function() {
    const namaPelaksana = document.getElementById('namaPelaksana').value;
    if (!namaPelaksana) return alert("Pilih Pelaksana Utama terlebih dahulu!");
    switchStep(2);
};

async function seedAsnMaster() {
    const count = await db.asnMaster.count();
    if (count === 0) {
        await db.asnMaster.bulkPut([
            { nama: "RUDOLF UMBU RESI LOLY, ST", jabatan: "CAMAT TABUNDUNG", nip: "197205212006041008", pangkat: "Pembina" },
            { nama: "KORNELIS KOPA RIHI, SE", jabatan: "SEKRETARIS CAMAT", nip: "197811262010011008", pangkat: "Penata Tk. I" },
            { nama: "RAUF UMAR", jabatan: "KASUBAG PROGRAM", nip: "197409121999031004", pangkat: "Penata" }
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

    const selectDesa = document.getElementById('step1_selectDesa');
    if (selectDesa) {
        selectDesa.innerHTML = '';
        DAFTAR_DESA_TABUNDUNG.forEach(d => {
            selectDesa.innerHTML += `<option value="${d}">${d}</option>`;
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
};

window.removeOfficerRow = function(id) {
    const row = document.getElementById(`pengikut-row-${id}`);
    if (row) {
        row.remove();
        calculateTotalBudget();
    }
};

window.autofillPengikutRow = function(id, namaVal) {
    const match = cachedAsnList.find(a => a.nama === namaVal);
    const row = document.getElementById(`pengikut-row-${id}`);
    if (row) {
        const nipInput = row.querySelector('.pengikut-nip');
        if (nipInput) {
            nipInput.value = match ? match.nip : '';
        }
    }
};

window.calculateTotalBudget = function() {
    const satuan = parseFloat(document.getElementById('biayaPerOrang').value) || 0;
    const totalPengikut = document.querySelectorAll('#pengikutContainer > div').length;
    const total = satuan * (1 + totalPengikut);
    
    const formatted = document.getElementById('totalBiayaFormatted');
    if (formatted) {
        formatted.value = 'Rp ' + total.toLocaleString('id-ID');
    }
    return total;
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

// FUNGSI BUKA HALAMAN CETAK DOKUMEN INDIVIDUAL
window.openCetakPage = async function(id) {
    const record = await db.records.get(id);
    if (record) {
        sessionStorage.setItem('sppd_print_current', JSON.stringify(record));
        window.location.href = `cetak.html?id=${id}`;
    } else {
        alert("Data SPPD tidak ditemukan!");
    }
};

// FUNGSI HAPUS REKORD SPPD
window.deleteRecord = async function(id) {
    if (confirm("Apakah Anda yakin ingin menghapus data SPPD ini?")) {
        await db.records.delete(id);
        await loadLocalRecords();
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

// FUNGSI CETAK REKAPITULASI SELURUH SPPD
window.printHistoryTable = async function() {
    const records = await db.records.toArray();
    if (records.length === 0) return alert("Belum ada data riwayat SPPD untuk dicetak!");

    const rekapSection = document.getElementById('rekapPrintSection');
    const container = document.getElementById('rekapPrintContainer');
    container.innerHTML = '';

    let grandTotal = 0;
    let tableRows = '';

    records.forEach((r, idx) => {
        const total = r.totalBiaya || 0;
        grandTotal += total;
        tableRows += `
            <tr>
                <td class="border border-black p-1.5 text-center">${idx + 1}</td>
                <td class="border border-black p-1.5">${r.noSuratTugas}<br><span class="text-[10px] text-slate-600">${r.noSPPD || '-'}</span></td>
                <td class="border border-black p-1.5 font-bold">${r.namaPelaksana}</td>
                <td class="border border-black p-1.5">${r.desaTujuan || r.maksudTujuan}</td>
                <td class="border border-black p-1.5 font-mono text-center">${r.kodeSubKegiatan}</td>
                <td class="border border-black p-1.5 text-right font-bold">Rp ${total.toLocaleString('id-ID')}</td>
            </tr>
        `;
    });

    container.innerHTML = `
        <table class="w-full text-xs font-official border-collapse border border-black">
            <thead>
                <tr class="bg-slate-100 border-b border-black text-center font-bold">
                    <th class="border border-black p-1.5 w-8">No.</th>
                    <th class="border border-black p-1.5">No. Surat / SPPD</th>
                    <th class="border border-black p-1.5">Pelaksana Utama</th>
                    <th class="border border-black p-1.5">Tujuan / Maksud</th>
                    <th class="border border-black p-1.5">Kode SK</th>
                    <th class="border border-black p-1.5">Total Biaya (Rp)</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
            <tfoot>
                <tr class="bg-slate-100 font-bold border-t border-black">
                    <td colspan="5" class="border border-black p-1.5 text-right uppercase">Grand Total Realisasi SPPD:</td>
                    <td class="border border-black p-1.5 text-right font-extrabold whitespace-nowrap">Rp ${grandTotal.toLocaleString('id-ID')}</td>
                </tr>
            </tfoot>
        </table>
    `;

    rekapSection.classList.remove('hidden');
    document.body.classList.add('printing-rekap');

    setTimeout(() => {
        window.print();
        document.body.classList.remove('printing-rekap');
        rekapSection.classList.add('hidden');
    }, 150);
};

// MANAGEMENT MODAL MASTER ASN
window.openAsnMasterModal = function() { document.getElementById('asnMasterModal').classList.remove('hidden'); renderAsnList(); };
window.closeAsnMasterModal = function() { document.getElementById('asnMasterModal').classList.add('hidden'); };

async function renderAsnList() {
    const list = await db.asnMaster.toArray();
    document.getElementById('asnListContainer').innerHTML = list.map(a => `
        <div class="py-2 flex justify-between items-center text-xs">
            <div>
                <p class="font-bold text-slate-800">${a.nama}</p>
                <p class="text-slate-500">NIP. ${a.nip} - ${a.jabatan}</p>
            </div>
            <button onclick="deleteAsn('${a.nip}')" class="text-rose-600 font-bold">Hapus</button>
        </div>
    `).join('');
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
