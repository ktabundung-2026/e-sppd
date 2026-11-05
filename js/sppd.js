/**
 * js/sppd.js - Sistem Pengelolaan SPPD Kecamatan Tabundung
 * Mengelola form input multi-step SPPD, kalkulasi biaya, manajemen master ASN,
 * impor/ekspor CSV, pencegahan data ganda (deduplikasi), serta sinkronisasi data via AppDB.
 */

// ==========================================
// 1. DATA DEFAULT & DEKLARASI STATE GLOBAL
// ==========================================
const DEFAULT_ASN_LIST = [
    { nama: "RUDOLF UMBU RESI LOLY, ST", nip: "197205212006041008", pangkat: "Pembina (IV/a)", jabatan: "Camat Tabundung" },
    { nama: "DANIEL KAMBARU WINDI", nip: "197712312008011084", pangkat: "Penata Tk. I (III/d)", jabatan: "Bendahara Pengeluaran" }
];

let masterAsnList = [];
let currentPengikut = [];
let currentStep = 1;

// ==========================================
// 2. INISIALISASI SAAT DOM DIMUAT
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    initOnlineStatus();
    await loadMasterAsn();
    initEventListeners();
    initFormDefaults();
    updateSKQuotaInfo();
    renderHistoryTable();
});

// ==========================================
// 3. MONITOR STATUS JARINGAN (ONLINE/OFFLINE)
// ==========================================
function initOnlineStatus() {
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
}

function updateOnlineStatus() {
    const badge = document.getElementById('statusBadge') || document.getElementById('header-network-badge');
    if (!badge) return;

    if (navigator.onLine) {
        badge.className = "px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 bg-emerald-600/90 text-white border border-emerald-400/30 backdrop-blur-sm shadow-sm";
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-200 animate-pulse"></span> Mode Online`;
    } else {
        badge.className = "px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 bg-amber-600/90 text-white border border-amber-400/30 backdrop-blur-sm shadow-sm";
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-200"></span> Mode Offline`;
    }
}

// ==========================================
// 4. MANAJEMEN MASTER DATA ASN
// ==========================================

function sanitizeAsnList(list) {
    if (!Array.isArray(list)) return [];
    return list.map(item => {
        if (!item || typeof item !== 'object') return null;

        let namaVal = (item.nama || '').toString().trim();
        let nipVal = (item.nip || '').toString().trim();
        let pangkatVal = item.pangkat || '-';
        let jabatanVal = item.jabatan || '-';

        const namaIsNip = /^\d{12,18}$/.test(namaVal.replace(/\s+/g, ''));
        const nipIsNama = /[a-zA-Z]/.test(nipVal);

        if (namaIsNip && nipIsNama) {
            return {
                nama: nipVal.toUpperCase(),
                nip: namaVal,
                pangkat: pangkatVal,
                jabatan: jabatanVal
            };
        }

        return {
            nama: namaVal.toUpperCase(),
            nip: nipVal || '-',
            pangkat: pangkatVal,
            jabatan: jabatanVal
        };
    }).filter(item => item !== null);
}

async function loadMasterAsn() {
    if (window.AppDB) {
        masterAsnList = await window.AppDB.getMasterAsn();
    } else {
        const saved = localStorage.getItem('sppd_master_asn');
        masterAsnList = saved ? JSON.parse(saved) : [];
    }

    if (!masterAsnList || masterAsnList.length === 0) {
        masterAsnList = [...DEFAULT_ASN_LIST];
    }

    masterAsnList = sanitizeAsnList(masterAsnList);
    await saveMasterAsn();
}

async function saveMasterAsn() {
    masterAsnList = sanitizeAsnList(masterAsnList);

    if (window.AppDB) {
        await window.AppDB.saveMasterAsn(masterAsnList);
    } else {
        localStorage.setItem('sppd_master_asn', JSON.stringify(masterAsnList));
    }
    populatePelaksanaDropdowns();
    renderAsnTable();
}

// FORMAT RENDERING: NAMA DENGAN DETAIL TEKS KECIL DI BAWAHNYA
function renderAsnTable(filterText = '') {
    const tbody = document.getElementById('asnTableBody') || document.getElementById('asnListContainer');
    const countEl = document.getElementById('totalAsnCount') || document.getElementById('countMasterAsn');
    if (!tbody) return;

    masterAsnList = sanitizeAsnList(masterAsnList);

    const filtered = masterAsnList.filter(item => {
        const nama = (item.nama || '').toLowerCase();
        const nip = (item.nip || '').toLowerCase();
        const jabatan = (item.jabatan || '').toLowerCase();
        const q = filterText.toLowerCase();
        return nama.includes(q) || nip.includes(q) || jabatan.includes(q);
    });

    if (countEl) countEl.innerText = masterAsnList.length;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td class="p-3 text-center text-slate-400 italic">Data ASN tidak ditemukan</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((asn) => {
        const displayNama = asn.nama ? asn.nama.toUpperCase() : '<span class="text-rose-500 font-normal">[TANPA NAMA]</span>';
        const safeNip = (asn.nip || '-').toString().trim();
        const safePangkat = asn.pangkat ? `${asn.pangkat}` : '-';
        const safeJabatan = asn.jabatan ? `${asn.jabatan}` : '-';

        return `
            <tr class="hover:bg-slate-50 transition text-xs border-b border-slate-100">
                <td class="p-2.5">
                    <div class="font-bold text-slate-800 uppercase">${displayNama}</div>
                    <div class="text-[10px] text-slate-500 mt-0.5">
                        <span class="font-mono">NIP: ${safeNip}</span> &bull; <span>${safePangkat} - ${safeJabatan}</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openModalAsn() {
    const modal = document.getElementById('modalAsn') || document.getElementById('asnMasterModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        renderAsnTable();
    }
}

function closeModalAsn() {
    const modal = document.getElementById('modalAsn') || document.getElementById('asnMasterModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

window.openModalAsn = openModalAsn;
window.closeModalAsn = closeModalAsn;

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
window.downloadCsvTemplate = downloadCsvTemplate;

function importAsnFromCsv() {
    const fileInput = document.getElementById('csvFileInput') || document.getElementById('asnCsvFileInput');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("Silakan pilih berkas CSV terlebih dahulu!");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            const text = e.target.result.replace(/^\uFEFF/, '');
            const lines = text.split(/\r\n|\n/);
            let addedCount = 0;
            let skippedCount = 0;
            let invalidCount = 0;

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const cols = line.split(/[,;\t]/).map(c => c.trim().replace(/^"(.*)"$/, '$1'));
                if (cols.length >= 2) {
                    let col0 = cols[0] || '';
                    let col1 = cols[1] || '';
                    let pangkat = cols[2] || '-';
                    let jabatan = cols[3] || '-';

                    let nip = '-';
                    let nama = '';

                    if (/^\d+$/.test(col0.replace(/\s+/g, '')) || col0.length >= 12) {
                        nip = col0;
                        nama = col1.toUpperCase();
                    } else if (/^\d+$/.test(col1.replace(/\s+/g, '')) || col1.length >= 12) {
                        nip = col1;
                        nama = col0.toUpperCase();
                    } else {
                        nip = col0 || '-';
                        nama = col1.toUpperCase();
                    }

                    if (!nama || nama === 'NAMA' || nama === 'NIP') {
                        invalidCount++;
                        continue;
                    }

                    const isDuplicate = masterAsnList.some(existing => {
                        const matchNip = (nip && nip !== '-' && existing.nip === nip);
                        const matchNama = (existing.nama && existing.nama.toLowerCase() === nama.toLowerCase());
                        return matchNip || matchNama;
                    });

                    if (isDuplicate) {
                        skippedCount++;
                    } else {
                        masterAsnList.push({ nama, nip, pangkat, jabatan });
                        addedCount++;
                    }
                } else {
                    invalidCount++;
                }
            }

            await saveMasterAsn();
            fileInput.value = '';

            alert(`Proses Impor Berhasil!\n- Data Ditambahkan: ${addedCount}\n- Data Duplikat Dilewati: ${skippedCount}\n- Baris Format Salah Dilewati: ${invalidCount}`);
        } catch (err) {
            alert("Gagal membaca berkas CSV. Pastikan format pemisah menggunakan koma (,) atau titik koma (;)");
            console.error(err);
        }
    };
    
    reader.readAsText(file);
}
window.importAsnFromCsv = importAsnFromCsv;

async function saveAsnMaster(e) {
    if (e) e.preventDefault();
    const namaInput = document.getElementById('addAsnNama') || document.getElementById('asnNama');
    const nama = namaInput?.value.trim().toUpperCase();
    const nip = (document.getElementById('addAsnNip') || document.getElementById('asnNip'))?.value.trim() || '-';
    const pangkat = (document.getElementById('addAsnPangkat') || document.getElementById('asnPangkat'))?.value.trim() || '-';
    const jabatan = (document.getElementById('addAsnJabatan') || document.getElementById('asnJabatan'))?.value.trim() || '-';

    if (!nama) {
        alert("Nama ASN wajib diisi!");
        return;
    }

    const isDuplicate = masterAsnList.some(a => (nip !== '-' && a.nip === nip) || (a.nama && a.nama.toLowerCase() === nama.toLowerCase()));
    
    if (isDuplicate) {
        alert("Data ASN ini sudah ada di dalam sistem master!");
        return;
    }

    masterAsnList.push({ nama, nip, pangkat, jabatan });
    await saveMasterAsn();
    resetAsnForm();
}

function resetAsnForm() {
    const form = document.getElementById('formAddAsn') || document.getElementById('asnForm');
    if (form) form.reset();
}

// ==========================================
// 5. EVENT LISTENERS & BINDING TERPUSAT
// ==========================================
function initEventListeners() {
    const btnOpenAsn = document.getElementById('btnKelolaAsn');
    if (btnOpenAsn) btnOpenAsn.addEventListener('click', openModalAsn);

    const btnCloseAsn = document.getElementById('btnCloseModalAsn');
    if (btnCloseAsn) btnCloseAsn.addEventListener('click', closeModalAsn);

    const modalAsn = document.getElementById('modalAsn') || document.getElementById('asnMasterModal');
    if (modalAsn) {
        modalAsn.addEventListener('click', (e) => {
            if (e.target === modalAsn) closeModalAsn();
        });
    }

    const searchInput = document.getElementById('searchAsnInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => renderAsnTable(e.target.value));
    }

    const asnForm = document.getElementById('formAddAsn') || document.getElementById('asnForm');
    if (asnForm) {
        asnForm.addEventListener('submit', saveAsnMaster);
    }

    const sppdForm = document.getElementById('sppdForm');
    if (sppdForm) {
        sppdForm.addEventListener('submit', handleFormSubmit);
    }
}

// ==========================================
// 6. AUTOFILL DROPDOWN ASN & PELAKSANA
// ==========================================
function populatePelaksanaDropdowns() {
    const selectPelaksana = document.getElementById('namaPelaksana');
    const selectPejabat = document.getElementById('namaPejabat');

    const optionsHTML = masterAsnList.map(a => 
        `<option value="${a.nama}">${a.nama} (${a.jabatan || 'ASN'})</option>`
    ).join('');

    if (selectPelaksana) {
        selectPelaksana.innerHTML = '<option value="">-- Pilih Pelaksana Utama --</option>' + optionsHTML;
        if (masterAsnList.length > 0 && !selectPelaksana.value) {
            selectPelaksana.value = masterAsnList[0].nama;
            onNamaInputChanged('Pelaksana', selectPelaksana.value);
        }
    }

    if (selectPejabat) {
        selectPejabat.innerHTML = '<option value="">-- Pilih Pejabat Penandatangan --</option>' + optionsHTML;
        const defaultCamat = masterAsnList.find(a => a.jabatan && a.jabatan.toLowerCase().includes('camat')) || masterAsnList[0];
        if (defaultCamat) {
            selectPejabat.value = defaultCamat.nama;
            onPejabatSelected(defaultCamat.nama);
        }
    }
}

function onNamaInputChanged(type, selectedNama) {
    const match = masterAsnList.find(a => a.nama === selectedNama);
    if (type === 'Pelaksana') {
        const nipEl = document.getElementById('nipPelaksana');
        const jabEl = document.getElementById('jabatanPelaksana');
        if (nipEl) nipEl.value = match ? (match.nip || '-') : '';
        if (jabEl) jabEl.value = match ? (match.jabatan || '-') : '';
    }
    updateSKQuotaInfo();
}

function onPejabatSelected(selectedNama) {
    const match = masterAsnList.find(a => a.nama === selectedNama);
    if (match) {
        const nipEl = document.getElementById('nipPejabat');
        const jabEl = document.getElementById('jabatanPejabat');
        if (nipEl) nipEl.value = match.nip || '-';
        if (jabEl) jabEl.value = match.jabatan || '-';
    }
}

// ==========================================
// 7. MANAJEMEN PENGIKUT & KALKULASI BIAYA
// ==========================================
function addOfficerRow() { addPengikutRow(); }

function addPengikutRow() {
    const container = document.getElementById('pengikutContainer');
    if (!container) return;

    const idx = currentPengikut.length;
    currentPengikut.push({ nama: '', nip: '', jabatan: '' });

    const row = document.createElement('div');
    row.className = "flex flex-col sm:flex-row gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm mt-2";
    row.id = `pengikutRow_${idx}`;

    const optionsHTML = masterAsnList.map(a => `<option value="${a.nama}">${a.nama}</option>`).join('');

    row.innerHTML = `
        <select onchange="updatePengikutSelect(${idx}, this.value)" class="w-full sm:w-1/3 p-2 text-xs border rounded font-semibold bg-white">
            <option value="">-- Pilih Anggota Tim --</option>
            ${optionsHTML}
        </select>
        <input type="text" id="pengikutNip_${idx}" placeholder="NIP Anggota" class="w-full sm:w-1/3 p-2 text-xs border rounded font-mono bg-slate-50" readonly>
        <input type="text" id="pengikutJabatan_${idx}" placeholder="Jabatan Anggota" class="w-full sm:w-1/3 p-2 text-xs border rounded font-semibold bg-slate-50" readonly>
        <button type="button" onclick="removePengikutRow(${idx})" class="text-rose-600 hover:text-rose-800 p-1.5 shrink-0 cursor-pointer" title="Hapus Anggota">
            <i class="fa-solid fa-xmark text-base"></i>
        </button>
    `;
    container.appendChild(row);
    updateSKQuotaInfo();
}

function updatePengikutSelect(idx, nama) {
    const match = masterAsnList.find(a => a.nama === nama);
    if (currentPengikut[idx]) {
        currentPengikut[idx] = {
            nama: nama,
            nip: match ? match.nip : '',
            jabatan: match ? match.jabatan : ''
        };
        const nipInput = document.getElementById(`pengikutNip_${idx}`);
        const jabInput = document.getElementById(`pengikutJabatan_${idx}`);
        if (nipInput) nipInput.value = match ? (match.nip || '-') : '';
        if (jabInput) jabInput.value = match ? (match.jabatan || '-') : '';
    }
    updateSKQuotaInfo();
}

function removePengikutRow(idx) {
    const row = document.getElementById(`pengikutRow_${idx}`);
    if (row) row.remove();
    currentPengikut[idx] = null;
    updateSKQuotaInfo();
}

// ==========================================
// 8. SINKRONISASI KUOTA OH & HITUNG BIAYA
// ==========================================
function updateSKQuotaInfo() {
    const kodeSK = document.getElementById('step1_kodeSK')?.value || '7.01.01.2.01.0003';
    const lblSK = document.getElementById('lblCurrentSK');
    if (lblSK) lblSK.innerText = kodeSK;

    const activePengikut = currentPengikut.filter(p => p !== null && p.nama !== '');
    const totalPersonil = 1 + activePengikut.length;

    const tglMulai = document.getElementById('tglMulai')?.value;
    const tglSelesai = document.getElementById('tglSelesai')?.value;
    let days = 1;

    if (tglMulai && tglSelesai) {
        const d1 = new Date(tglMulai);
        const d2 = new Date(tglSelesai);
        const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
        days = diff > 0 ? diff : 1;
    }

    const neededOH = totalPersonil * days;
    const lblOH = document.getElementById('lblPenugasanOH');
    if (lblOH) lblOH.innerText = `${neededOH} OH`;

    const txtHari = document.getElementById('lamaHariText');
    if (txtHari) txtHari.value = `${days} Hari`;

    let usedOH = 0;
    const savedRecords = JSON.parse(localStorage.getItem('sppd_records_tabundung') || '[]');
    savedRecords.forEach(r => {
        if ((r.kodeSK || r.sub_kegiatan) === kodeSK) {
            const count = 1 + (r.pengikut ? r.pengikut.length : 0);
            usedOH += (count * (r.lamaHari || 1));
        }
    });

    const maxQuota = parseInt(document.getElementById('inputMaxQuota')?.value) || 50;
    const remainingOH = maxQuota - usedOH;

    const valUsed = document.getElementById('valUsedQuota');
    const valRemaining = document.getElementById('valRemainingQuota');

    if (valUsed) valUsed.innerText = `${usedOH} OH`;
    if (valRemaining) valRemaining.innerText = `${remainingOH} OH`;

    const pct = Math.min(100, Math.round((usedOH / maxQuota) * 100));
    const progress = document.getElementById('progressBarQuota');
    if (progress) progress.style.width = `${pct}%`;

    const badge = document.getElementById('badgeStatusQuota');
    if (badge) {
        if (remainingOH < 0) {
            badge.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300";
            badge.innerText = "Over Kuota";
        } else if (remainingOH <= 5) {
            badge.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300";
            badge.innerText = "Hampir Habis";
        } else {
            badge.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300";
            badge.innerText = "Tersedia";
        }
    }

    calculateTotalBiaya(days, totalPersonil);
}

function saveCustomSKQuota(val) {
    const kodeSK = document.getElementById('step1_kodeSK')?.value || '7.01.01.2.01.0003';
    const quotas = JSON.parse(localStorage.getItem('sppd_sk_quotas') || '{}');
    quotas[kodeSK] = parseInt(val) || 50;
    localStorage.setItem('sppd_sk_quotas', JSON.stringify(quotas));
    updateSKQuotaInfo();
}

function syncTujuanPerdin(val) {
    const destInput = document.getElementById('tempatTujuan');
    if (destInput) destInput.value = val;
}

function onDateOrBudgetChanged() {
    updateSKQuotaInfo();
}

function calculateTotalBiaya(daysParam, personilParam) {
    const days = daysParam || 1;
    const totalPersonil = personilParam || 1;
    const rate = parseFloat(document.getElementById('biayaPerOrang')?.value) || 0;
    const totalBiaya = days * rate * totalPersonil;
    
    const fmtInput = document.getElementById('totalBiayaFormatted');
    const terbilangInput = document.getElementById('terbilang');

    if (fmtInput) fmtInput.value = `Rp ${totalBiaya.toLocaleString('id-ID')}`;
    if (terbilangInput) terbilangInput.value = `${numberToWords(totalBiaya)} Rupiah`;
}

// ==========================================
// 9. NAVIGASI STEPPER FORM & SUBMIT
// ==========================================
function switchStep(stepNumber) {
    currentStep = stepNumber;
    [1, 2, 3].forEach(s => {
        const content = document.getElementById(`step-content-${s}`);
        const btn = document.getElementById(`step-btn-${s}`);
        
        if (content) content.classList.add('hidden');
        if (btn) {
            btn.classList.remove('active');
            const icon = btn.querySelector('.step-icon');
            const label = btn.querySelector('.step-label');
            if (icon) icon.className = "step-icon w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-slate-200 text-slate-600";
            if (label) label.className = "step-label text-xs font-medium text-slate-500 mt-1";
        }
    });

    const activeContent = document.getElementById(`step-content-${stepNumber}`);
    const activeBtn = document.getElementById(`step-btn-${stepNumber}`);
    if (activeContent) activeContent.classList.remove('hidden');
    if (activeBtn) {
        activeBtn.classList.add('active');
        const icon = activeBtn.querySelector('.step-icon');
        const label = activeBtn.querySelector('.step-label');
        if (icon) icon.className = "step-icon w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-gov-700 text-white shadow-md";
        if (label) label.className = "step-label text-xs font-bold text-gov-800 mt-1";
    }

    if (stepNumber === 3) {
        renderHistoryTable();
    }
}

function proceedToStep2() {
    const desa = document.getElementById('step1_selectDesa')?.value;
    if (!desa) {
        alert("Harap isi tempat / desa tujuan perjalanan dinas!");
        return;
    }
    syncTujuanPerdin(desa);
    switchStep(2);
}

function initFormDefaults() {
    const today = new Date().toISOString().split('T')[0];
    const tglMulai = document.getElementById('tglMulai');
    const tglSelesai = document.getElementById('tglSelesai');

    if (tglMulai && !tglMulai.value) tglMulai.value = today;
    if (tglSelesai && !tglSelesai.value) tglSelesai.value = today;
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const activePengikut = currentPengikut.filter(p => p !== null && p.nama.trim() !== '');
    const tglMulai = document.getElementById('tglMulai')?.value || '';
    const tglSelesai = document.getElementById('tglSelesai')?.value || '';
    
    let days = 1;
    if (tglMulai && tglSelesai) {
        const d1 = new Date(tglMulai);
        const d2 = new Date(tglSelesai);
        const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
        days = diff > 0 ? diff : 1;
    }

    const rate = parseFloat(document.getElementById('biayaPerOrang')?.value) || 0;
    const totalPersonil = 1 + activePengikut.length;
    const totalBiaya = days * rate * totalPersonil;

    const record = {
        id: Date.now(),
        noSuratTugas: document.getElementById('noSuratTugas')?.value || '',
        noSPPD: document.getElementById('noSPPD')?.value || '',
        noBku: 'BKU/' + Date.now().toString().slice(-4),
        kodeSK: document.getElementById('step1_kodeSK')?.value || '7.01.01.2.01.0003',
        sumberDana: document.getElementById('sumberDana')?.value || 'DAU',
        dasarPelaksanaan: 'Atas Perintah Camat Tabundung',
        maksudTujuan: document.getElementById('maksudTujuan')?.value || '',
        
        namaPelaksana: (document.getElementById('namaPelaksana')?.value || '').toUpperCase(),
        nipPelaksana: document.getElementById('nipPelaksana')?.value || '',
        pangkatPelaksana: (masterAsnList.find(a => a.nama === document.getElementById('namaPelaksana')?.value)?.pangkat) || 'Penata (III/c)',
        jabatanPelaksana: document.getElementById('jabatanPelaksana')?.value || '',
        pengikut: activePengikut,

        tempatBerangkat: document.getElementById('tempatBerangkat')?.value || 'Malahar',
        tempatTujuan: document.getElementById('tempatTujuan')?.value || '',
        alatAngkutan: 'Kendaraan Roda 2',
        tglMulai: tglMulai,
        tglSelesai: tglSelesai,
        lamaHari: days,

        biayaPerOrang: rate,
        totalBiaya: totalBiaya,

        namaPejabatTujuan: document.getElementById('namaPejabatTujuan')?.value || '',
        jabatanPejabatTujuan: document.getElementById('jabatanPejabatTujuan')?.value || '',
        nipPejabatTujuan: document.getElementById('nipPejabatTujuan')?.value || '-',

        namaCamat: document.getElementById('namaPejabat')?.value || 'RUDOLF UMBU RESI LOLY, ST',
        nipCamat: document.getElementById('nipPejabat')?.value || '197205212006041008',
        pangkatCamat: document.getElementById('jabatanPejabat')?.value || 'Camat Tabundung',
        namaBendahara: 'DANIEL KAMBARU WINDI',
        nipBendahara: '197712312008011084',

        createdAt: new Date().toISOString()
    };

    if (window.AppDB) {
        await window.AppDB.saveRecord(record);
    } else {
        const existing = JSON.parse(localStorage.getItem('sppd_records_tabundung') || '[]');
        existing.unshift(record);
        localStorage.setItem('sppd_records_tabundung', JSON.stringify(existing));
    }

    sessionStorage.setItem('sppd_print_current', JSON.stringify(record));
    window.location.href = `cetak.html?id=${record.id}`;
}

// ==========================================
// 10. RIWAYAT, AKSI HAPUS & UTILITY TERBILANG
// ==========================================
async function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    let records = [];
    if (window.AppDB) {
        records = await window.AppDB.getAllRecords();
    } else {
        records = JSON.parse(localStorage.getItem('sppd_records_tabundung') || '[]');
    }

    if (!records || records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 italic text-xs">Belum ada riwayat dokumen SPPD tersimpan.</td></tr>`;
        return;
    }

    tbody.innerHTML = records.map((r) => `
        <tr class="border-b hover:bg-slate-50 transition text-xs">
            <td class="p-3">
                <span class="font-bold text-gov-800">${r.noSuratTugas || '-'}</span><br>
                <span class="text-[10px] text-slate-500">SPPD: ${r.noSPPD || r.no_sppd || '-'}</span>
            </td>
            <td class="p-3">
                <span class="font-mono font-bold">${r.kodeSK || r.sub_kegiatan || '7.01.01.2.01.0003'}</span><br>
                <span class="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">${r.sumberDana || 'DAU'}</span>
            </td>
            <td class="p-3 font-semibold text-slate-800">${r.namaPelaksana || r.pelaksana || '-'}</td>
            <td class="p-3 text-slate-600">${r.tempatTujuan || r.tujuan || '-'}</td>
            <td class="p-3 font-extrabold text-emerald-700">Rp ${(r.totalBiaya || 0).toLocaleString('id-ID')}</td>
            <td class="p-3 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <a href="cetak.html?id=${r.id}" class="inline-flex items-center gap-1 bg-gov-700 hover:bg-gov-800 text-white px-2.5 py-1.5 rounded font-bold text-[11px] transition shadow-sm" title="Cetak Dokumen">
                        <i class="fa-solid fa-print"></i> Cetak
                    </a>
                    <button type="button" onclick="deleteSppdRecord(${r.id})" class="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1.5 rounded font-bold text-[11px] transition" title="Hapus Dokumen">
                        <i class="fa-solid fa-trash"></i> Hapus
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function deleteSppdRecord(id) {
    if (confirm("Apakah Anda yakin ingin menghapus riwayat dokumen SPPD ini?")) {
        if (window.AppDB && typeof window.AppDB.deleteRecord === 'function') {
            await window.AppDB.deleteRecord(id);
        } else {
            let records = JSON.parse(localStorage.getItem('sppd_records_tabundung') || '[]');
            records = records.filter(r => r.id !== id);
            localStorage.setItem('sppd_records_tabundung', JSON.stringify(records));
        }
        await renderHistoryTable();
        updateSKQuotaInfo();
    }
}
window.deleteSppdRecord = deleteSppdRecord;

function printHistoryTable() {
    window.location.href = "rekap.html";
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
