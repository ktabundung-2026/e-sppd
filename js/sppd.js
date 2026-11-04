/**
 * sppd.js - Sistem Pengelolaan SPPD Kecamatan Tabundung
 * Menyediakan manajemen master ASN (termasuk CSV import/export), 
 * form input multi-step SPPD, kalkulasi biaya, serta sinkronisasi online/offline.
 */

// ==========================================
// 1. DATA DEFAULT & DEKLARASI STATE
// ==========================================
const DEFAULT_ASN_LIST = [
    { nip: "197205212006041008", nama: "RUDOLF UMBU RESI LOLY, ST", pangkat: "Pembina (IV/a)", jabatan: "Camat Tabundung" },
    { nip: "197712312008011084", nama: "DANIEL KAMBARU WINDI", pangkat: "Penata Tk. I (III/d)", jabatan: "Bendahara Pengeluaran" }
];

let masterAsnList = [];
let currentPengikut = [];

// ==========================================
// 2. INITIALIZATION (DOM LOADED)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initOnlineStatus();
    loadMasterAsn();
    initEventListeners();
    initFormDefaults();
});

// ==========================================
// 3. STATUS ONLINE / OFFLINE BADGE
// ==========================================
function initOnlineStatus() {
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
}

function updateOnlineStatus() {
    const badge = document.getElementById('statusBadge');
    if (!badge) return;

    if (navigator.onLine) {
        badge.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm";
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Online (Synced)`;
    } else {
        badge.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 shadow-sm";
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span> Offline (Local)`;
    }
}

// ==========================================
// 4. MANAJEMEN MASTER DATA ASN
// ==========================================
function loadMasterAsn() {
    const saved = localStorage.getItem('sppd_master_asn');
    if (saved) {
        try {
            masterAsnList = JSON.parse(saved);
        } catch (e) {
            console.error("Gagal membaca master ASN dari Storage:", e);
            masterAsnList = [...DEFAULT_ASN_LIST];
        }
    } else {
        masterAsnList = [...DEFAULT_ASN_LIST];
        saveMasterAsn();
    }
    populatePelaksanaDatalist();
    renderAsnTable();
}

function saveMasterAsn() {
    localStorage.setItem('sppd_master_asn', JSON.stringify(masterAsnList));
    populatePelaksanaDatalist();
    renderAsnTable();
}

function renderAsnTable(filterText = '') {
    const tbody = document.getElementById('asnTableBody');
    const countEl = document.getElementById('totalAsnCount');
    if (!tbody) return;

    const filtered = masterAsnList.filter(item => 
        item.nama.toLowerCase().includes(filterText.toLowerCase()) || 
        item.nip.includes(filterText) ||
        (item.jabatan && item.jabatan.toLowerCase().includes(filterText.toLowerCase()))
    );

    if (countEl) countEl.innerText = masterAsnList.length;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-slate-400 italic">Data ASN tidak ditemukan</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((asn, idx) => `
        <tr class="border-b hover:bg-slate-50 transition text-xs">
            <td class="p-2 font-semibold text-slate-700">${asn.nama}</td>
            <td class="p-2 font-mono text-slate-600">${asn.nip || '-'}</td>
            <td class="p-2 text-slate-600">${asn.pangkat || '-'} / ${asn.jabatan || '-'}</td>
            <td class="p-2 text-center">
                <button onclick="deleteAsn('${asn.nip}')" class="text-rose-600 hover:text-rose-800 p-1" title="Hapus ASN">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function deleteAsn(nip) {
    if (confirm("Apakah Anda yakin ingin menghapus data ASN ini dari master local?")) {
        masterAsnList = masterAsnList.filter(a => a.nip !== nip);
        saveMasterAsn();
    }
}

function openModalAsn() {
    const modal = document.getElementById('modalAsn');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        renderAsnTable();
    }
}

function closeModalAsn() {
    const modal = document.getElementById('modalAsn');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// Fitur CSV Impor & Ekspor Template
function downloadCsvTemplate() {
    const csvContent = "data:text/csv;charset=utf-8,NIP,NAMA,PANGKAT,JABATAN\n198501012010011001,NAMA ASN LENGKAP,Penata (III/c),Kepala Sub Bagian";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "template_master_asn.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function handleCsvUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const lines = e.target.result.split('\n');
        let addedCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const cols = line.split(',').map(c => c.trim().replace(/^"(.*)"$/, '$1'));
            if (cols.length >= 2) {
                const nip = cols[0];
                const nama = cols[1];
                const pangkat = cols[2] || '';
                const jabatan = cols[3] || '';

                if (nama && !masterAsnList.some(a => a.nip === nip)) {
                    masterAsnList.push({ nip, nama: nama.toUpperCase(), pangkat, jabatan });
                    addedCount++;
                }
            }
        }
        saveMasterAsn();
        alert(`Berhasil mengimpor ${addedCount} data ASN baru!`);
        event.target.value = '';
    };
    reader.readAsText(file);
}

// ==========================================
// 5. EVENT LISTENERS & FORM BINDING
// ==========================================
function initEventListeners() {
    // Tombol Modal ASN
    const btnOpenAsn = document.getElementById('btnKelolaAsn');
    if (btnOpenAsn) btnOpenAsn.addEventListener('click', openModalAsn);

    const btnCloseAsn = document.getElementById('btnCloseModalAsn');
    if (btnCloseAsn) btnCloseAsn.addEventListener('click', closeModalAsn);

    const modalAsn = document.getElementById('modalAsn');
    if (modalAsn) {
        modalAsn.addEventListener('click', (e) => {
            if (e.target === modalAsn) closeModalAsn();
        });
    }

    // Input Search ASN
    const searchInput = document.getElementById('searchAsnInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => renderAsnTable(e.target.value));
    }

    // Form Tambah ASN Manual
    const formAddAsn = document.getElementById('formAddAsn');
    if (formAddAsn) {
        formAddAsn.addEventListener('submit', (e) => {
            e.preventDefault();
            const nama = document.getElementById('addAsnNama').value.trim().toUpperCase();
            const nip = document.getElementById('addAsnNip').value.trim();
            const pangkat = document.getElementById('addAsnPangkat').value.trim();
            const jabatan = document.getElementById('addAsnJabatan').value.trim();

            if (!nama) return;

            masterAsnList.push({ nip, nama, pangkat, jabatan });
            saveMasterAsn();
            formAddAsn.reset();
        });
    }

    // Input CSV Upload
    const csvInput = document.getElementById('csvFileInput');
    if (csvInput) csvInput.addEventListener('change', handleCsvUpload);

    // Dynamic Search / Autofill Pelaksana Utama
    const namaInput = document.getElementById('namaPelaksana');
    if (namaInput) {
        namaInput.addEventListener('input', (e) => autofillAsnData(e.target.value));
    }

    // Pengikut Handling
    const btnAddPengikut = document.getElementById('btnAddPengikut');
    if (btnAddPengikut) btnAddPengikut.addEventListener('click', addPengikutRow);

    // Calculation Triggers
    ['lamaHari', 'biayaPerOrang'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calculateTotalBiaya);
    });

    // Form Submit (Proses Cetak)
    const sppdForm = document.getElementById('sppdForm');
    if (sppdForm) {
        sppdForm.addEventListener('submit', handleFormSubmit);
    }
}

// Populate Data List Pelaksana
function populatePelaksanaDatalist() {
    let datalist = document.getElementById('asnDatalist');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'asnDatalist';
        document.body.appendChild(datalist);
    }

    const namaInput = document.getElementById('namaPelaksana');
    if (namaInput) namaInput.setAttribute('list', 'asnDatalist');

    datalist.innerHTML = masterAsnList.map(a => `<option value="${a.nama}">${a.nip ? 'NIP. ' + a.nip : ''} - ${a.jabatan || ''}</option>`).join('');
}

function autofillAsnData(nama) {
    const match = masterAsnList.find(a => a.nama.toLowerCase() === nama.trim().toLowerCase());
    if (match) {
        document.getElementById('nipPelaksana').value = match.nip || '';
        document.getElementById('pangkatPelaksana').value = match.pangkat || '';
        document.getElementById('jabatanPelaksana').value = match.jabatan || '';
    }
}

// ==========================================
// 6. MANAJEMEN PENGIKUT & KALKULASI
// ==========================================
function addPengikutRow() {
    const container = document.getElementById('pengikutContainer');
    if (!container) return;

    const idx = currentPengikut.length;
    currentPengikut.push({ nama: '', nip: '', jabatan: '' });

    const row = document.createElement('div');
    row.className = "flex flex-col sm:flex-row gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200 mt-2";
    row.id = `pengikutRow_${idx}`;
    row.innerHTML = `
        <input type="text" placeholder="Nama Pengikut" class="w-full sm:w-1/3 p-2 text-xs border rounded uppercase focus:ring-1 focus:ring-gov-600" onchange="updatePengikut(${idx}, 'nama', this.value.toUpperCase())">
        <input type="text" placeholder="NIP" class="w-full sm:w-1/3 p-2 text-xs border rounded font-mono focus:ring-1 focus:ring-gov-600" onchange="updatePengikut(${idx}, 'nip', this.value)">
        <input type="text" placeholder="Jabatan" class="w-full sm:w-1/3 p-2 text-xs border rounded focus:ring-1 focus:ring-gov-600" onchange="updatePengikut(${idx}, 'jabatan', this.value)">
        <button type="button" onclick="removePengikutRow(${idx})" class="text-rose-600 hover:text-rose-800 p-1">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;
    container.appendChild(row);
    calculateTotalBiaya();
}

function updatePengikut(idx, field, val) {
    if (currentPengikut[idx]) {
        currentPengikut[idx][field] = val;
    }
}

function removePengikutRow(idx) {
    const row = document.getElementById(`pengikutRow_${idx}`);
    if (row) row.remove();
    currentPengikut[idx] = null;
    calculateTotalBiaya();
}

function calculateTotalBiaya() {
    const days = parseInt(document.getElementById('lamaHari')?.value) || 1;
    const rate = parseFloat(document.getElementById('biayaPerOrang')?.value) || 0;
    
    // Hitung total personil (Pelaksana Utama + Pengikut Aktif)
    const activePengikut = currentPengikut.filter(p => p !== null);
    const totalPersonil = 1 + activePengikut.length;
    
    const totalBiaya = days * rate * totalPersonil;
    const totalBiayaInput = document.getElementById('totalBiaya');
    
    if (totalBiayaInput) {
        totalBiayaInput.value = totalBiaya;
    }
}

// ==========================================
// 7. DEFAULTS & FORM SUBMIT
// ==========================================
function initFormDefaults() {
    const tglMulai = document.getElementById('tglMulai');
    const tglSelesai = document.getElementById('tglSelesai');
    const today = new Date().toISOString().split('T')[0];

    if (tglMulai && !tglMulai.value) tglMulai.value = today;
    if (tglSelesai && !tglSelesai.value) tglSelesai.value = today;

    calculateTotalBiaya();
}

function handleFormSubmit(e) {
    e.preventDefault();

    const activePengikut = currentPengikut.filter(p => p !== null && p.nama.trim() !== '');
    
    const record = {
        id: Date.now(),
        noSuratTugas: document.getElementById('noSuratTugas')?.value || '',
        noSPPD: document.getElementById('noSPPD')?.value || '',
        noBku: document.getElementById('noBku')?.value || '',
        kodeSK: document.getElementById('kodeSK')?.value || '7.01.01.2.01.0003',
        sumberDana: document.getElementById('sumberDana')?.value || 'DAU',
        dasarPelaksanaan: document.getElementById('dasarPelaksanaan')?.value || 'Atas Perintah Camat',
        maksudTujuan: document.getElementById('maksudTujuan')?.value || '',
        
        // Pelaksana
        namaPelaksana: (document.getElementById('namaPelaksana')?.value || '').toUpperCase(),
        nipPelaksana: document.getElementById('nipPelaksana')?.value || '',
        pangkatPelaksana: document.getElementById('pangkatPelaksana')?.value || '',
        jabatanPelaksana: document.getElementById('jabatanPelaksana')?.value || '',
        pengikut: activePengikut,

        // Lokasi & Waktu
        tempatBerangkat: document.getElementById('tempatBerangkat')?.value || 'Malahar',
        tempatTujuan: document.getElementById('tempatTujuan')?.value || '',
        alatAngkutan: document.getElementById('alatAngkutan')?.value || 'Sepeda Motor / Kendaraan Dinas',
        tglMulai: document.getElementById('tglMulai')?.value || '',
        tglSelesai: document.getElementById('tglSelesai')?.value || '',
        lamaHari: parseInt(document.getElementById('lamaHari')?.value) || 1,

        // Keuangan
        biayaPerOrang: parseFloat(document.getElementById('biayaPerOrang')?.value) || 0,
        totalBiaya: parseFloat(document.getElementById('totalBiaya')?.value) || 0,

        // Pejabat Tempat Tujuan & Pengutus
        namaPejabatTujuan: document.getElementById('namaPejabatTujuan')?.value || '',
        jabatanPejabatTujuan: document.getElementById('jabatanPejabatTujuan')?.value || '',
        nipPejabatTujuan: document.getElementById('nipPejabatTujuan')?.value || '',

        // Camat & Bendahara
        namaCamat: document.getElementById('namaCamat')?.value || 'RUDOLF UMBU RESI LOLY, ST',
        nipCamat: document.getElementById('nipCamat')?.value || '197205212006041008',
        pangkatCamat: document.getElementById('pangkatCamat')?.value || 'Camat Tabundung',
        namaBendahara: document.getElementById('namaBendahara')?.value || 'DANIEL KAMBARU WINDI',
        nipBendahara: document.getElementById('nipBendahara')?.value || '197712312008011084',

        // Laporan Hasil
        laporanHasil: document.getElementById('laporanHasil')?.value || '',
        createdAt: new Date().toISOString()
    };

    // 1. Simpan ke LocalStorage Rekapitulasi
    const existing = JSON.parse(localStorage.getItem('sppd_records_tabundung') || '[]');
    existing.unshift(record);
    localStorage.setItem('sppd_records_tabundung', JSON.stringify(existing));

    // 2. Simpan ke Session Current Print
    sessionStorage.setItem('sppd_print_current', JSON.stringify(record));

    // 3. Arahkan ke Modul Cetak
    window.location.href = `cetak.html?id=${record.id}`;
}
