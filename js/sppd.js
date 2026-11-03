// INISIALISASI INDEXEDDB DENGAN PENGAMANAN TRY-CATCH
let db;
try {
    db = new Dexie('eSPPD_Tabundung_DB');
    db.version(1).stores({
        records: '++id, noSuratTugas, kodeSubKegiatan, namaPelaksana, tglMulai',
        asnMaster: 'nip, nama, jabatan, pangkat',
        settings: 'key, value'
    });
} catch(e) {
    console.error("Gagal menginisialisasi Dexie DB:", e);
}

const DEFAULT_MAX_KUOTA_OH = 50;
let currentStep = 1;
let pengikutCount = 0;
let cachedAsnList = [];

window.addEventListener('DOMContentLoaded', async function() {
    try {
        setupNetworkBadge();
        if (db) {
            await seedAsnMaster();
            await loadAsnCache();
        }
        populateSelectOptions();
        initDefaultDates();
        syncTujuanPerdin(document.getElementById('step1_selectDesa')?.value);
        if (db) {
            await window.updateSKQuotaInfo();
            await loadLocalRecords();
        }
        calculateTotalBudget();
    } catch (err) {
        console.error("Gagal Menginisialisasi Aplikasi e-SPPD:", err);
    }
});

function setupNetworkBadge() {
    const badge = document.getElementById('header-network-badge');
    if (!badge) return;
    badge.className = navigator.onLine 
        ? 'px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-600 text-white' 
        : 'px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-600 text-white';
    badge.innerText = navigator.onLine ? 'Online' : 'Offline';
}

function initDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const tglMulaiInput = document.getElementById('tglMulai');
    const tglSelesaiInput = document.getElementById('tglSelesai');
    
    if (tglMulaiInput && !tglMulaiInput.value) tglMulaiInput.value = today;
    if (tglSelesaiInput && !tglSelesaiInput.value) tglSelesaiInput.value = today;
    
    calculateLamaPerdin();
}

window.syncTujuanPerdin = function(val) {
    const tempatTujuan = document.getElementById('tempatTujuan');
    const jabatanTujuan = document.getElementById('jabatanPejabatTujuan');
    if (tempatTujuan) {
        tempatTujuan.value = val || '';
    }
    if (jabatanTujuan && val) {
        jabatanTujuan.value = `KEPALA ${val.toUpperCase()}`;
    }
};

window.calculateLamaPerdin = function() {
    const startVal = document.getElementById('tglMulai')?.value;
    const endVal = document.getElementById('tglSelesai')?.value;
    const lamaText = document.getElementById('lamaHariText');

    if (startVal && endVal) {
        const startDate = new Date(startVal);
        const endDate = new Date(endVal);
        const diffTime = endDate - startDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        if (diffDays > 0) {
            if (lamaText) lamaText.value = `${diffDays} Hari`;
            return diffDays;
        }
    }
    if (lamaText) lamaText.value = `1 Hari`;
    return 1;
};

window.switchStep = function(stepNum) {
    currentStep = stepNum;
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    const targetContent = document.getElementById(`step-content-${stepNum}`);
    if (targetContent) targetContent.classList.remove('hidden');

    document.querySelectorAll('.step-btn').forEach((btn, idx) => {
        const icon = btn.querySelector('.step-icon');
        const label = btn.querySelector('.step-label');
        if (idx + 1 === stepNum) {
            if (icon) icon.className = 'step-icon w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-gov-700 text-white shadow-md';
            if (label) label.className = 'step-label text-xs font-bold text-gov-800 mt-1';
        } else {
            if (icon) icon.className = 'step-icon w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-slate-200 text-slate-600';
            if (label) label.className = 'step-label text-xs font-medium text-slate-500 mt-1';
        }
    });
};

async function seedAsnMaster() {
    try {
        const count = await db.asnMaster.count();
        if (count === 0) {
            await db.asnMaster.bulkPut([
                { nama: "RUDOLF UMBU RESI LOLY, ST", jabatan: "CAMAT TABUNDUNG", nip: "197205212006041008", pangkat: "Pembina" },
                { nama: "KORNELIS KOPA RIHI, SE", jabatan: "SEKRETARIS CAMAT", nip: "197811262010011008", pangkat: "Penata Tk. I" },
                { nama: "RAUF UMAR", jabatan: "KASUBAG PROGRAM", nip: "197409121999031004", pangkat: "Penata" }
            ]);
        }
    } catch(e) { console.error(e); }
}

async function loadAsnCache() {
    try {
        cachedAsnList = await db.asnMaster.toArray();
    } catch(e) { cachedAsnList = []; }
}

function populateSelectOptions() {
    const selectPelaksana = document.getElementById('namaPelaksana');
    const selectPejabat = document.getElementById('namaPejabat');
    
    const selectedPelaksanaVal = selectPelaksana ? selectPelaksana.value : '';
    const selectedPejabatVal = selectPejabat ? selectPejabat.value : '';

    if (selectPelaksana) {
        selectPelaksana.innerHTML = '<option value="">-- Pilih Pelaksana Utama --</option>';
        cachedAsnList.forEach(asn => {
            selectPelaksana.innerHTML += `<option value="${escapeHtml(asn.nama)}">${escapeHtml(asn.nama)}</option>`;
        });
        if (selectedPelaksanaVal) selectPelaksana.value = selectedPelaksanaVal;
    }

    if (selectPejabat) {
        selectPejabat.innerHTML = '<option value="">-- Pilih Pejabat Penandatangan --</option>';
        cachedAsnList.forEach(asn => {
            selectPejabat.innerHTML += `<option value="${escapeHtml(asn.nama)}">${escapeHtml(asn.nama)}</option>`;
        });

        const camat = cachedAsnList.find(a => a.jabatan && a.jabatan.toUpperCase().includes("CAMAT"));
        if (selectedPejabatVal) {
            selectPejabat.value = selectedPejabatVal;
        } else if (camat) {
            selectPejabat.value = camat.nama;
            onPejabatSelected(camat.nama);
        }
    }

    document.querySelectorAll('.pengikut-nama').forEach(selectElem => {
        const currentPengikutVal = selectElem.value;
        selectElem.innerHTML = '<option value="">-- Pilih Anggota Pengikut --</option>';
        cachedAsnList.forEach(asn => {
            selectElem.innerHTML += `<option value="${escapeHtml(asn.nama)}">${escapeHtml(asn.nama)}</option>`;
        });
        if (currentPengikutVal) selectElem.value = currentPengikutVal;
    });
}

window.onPejabatSelected = function(namaVal) {
    if (!namaVal) return;
    const match = cachedAsnList.find(a => a.nama === namaVal);
    if (match) {
        const nipInput = document.getElementById('nipPejabat');
        const jabatanInput = document.getElementById('jabatanPejabat');
        if (nipInput) nipInput.value = match.nip || '';
        if (jabatanInput) jabatanInput.value = match.jabatan || 'CAMAT TABUNDUNG';
    }
};

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.onNamaInputChanged = function(role, namaVal) {
    if (!namaVal) {
        const nInput = document.getElementById('nipPelaksana');
        const jInput = document.getElementById('jabatanPelaksana');
        if(nInput) nInput.value = '';
        if(jInput) jInput.value = '';
        return;
    }
    const match = cachedAsnList.find(a => a.nama === namaVal);
    if (match && role === 'Pelaksana') {
        const nInput = document.getElementById('nipPelaksana');
        const jInput = document.getElementById('jabatanPelaksana');
        if(nInput) nInput.value = match.nip || '';
        if(jInput) jInput.value = match.jabatan || '';
    }
};

window.saveCustomSKQuota = async function(val) {
    try {
        const kodeSK = document.getElementById('step1_kodeSK')?.value.trim() || '7.01.01.2.01.0003';
        const newMax = parseInt(val) || DEFAULT_MAX_KUOTA_OH;
        
        await db.settings.put({ key: `quota_${kodeSK}`, value: newMax });
        await window.updateSKQuotaInfo();
    } catch(e) { console.error(e); }
};

window.updateSKQuotaInfo = async function() {
    try {
        const kodeSK = document.getElementById('step1_kodeSK')?.value.trim() || '7.01.01.2.01.0003';
        const lblSK = document.getElementById('lblCurrentSK');
        if (lblSK) lblSK.innerText = kodeSK;

        const records = await db.records.filter(r => r.kodeSubKegiatan === kodeSK).toArray();
        let usedOH = 0;
        records.forEach(r => {
            const countPengikut = Array.isArray(r.pengikut) ? r.pengikut.length : 0;
            const lamaHari = r.lamaHari || 1;
            usedOH += (1 + countPengikut) * lamaHari;
        });

        const quotaSetting = await db.settings.get(`quota_${kodeSK}`);
        const maxQuota = quotaSetting ? parseInt(quotaSetting.value) : DEFAULT_MAX_KUOTA_OH;

        const inputMax = document.getElementById('inputMaxQuota');
        if (inputMax && document.activeElement !== inputMax) {
            inputMax.value = maxQuota;
        }

        const remainingOH = Math.max(0, maxQuota - usedOH);
        const percentage = Math.min(100, Math.round((usedOH / maxQuota) * 100));

        const valUsed = document.getElementById('valUsedQuota');
        const valRem = document.getElementById('valRemainingQuota');
        if(valUsed) valUsed.innerText = `${usedOH} OH`;
        if(valRem) valRem.innerText = `${remainingOH} OH`;

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
        const durasiHari = calculateLamaPerdin();
        const requiredOH = (1 + currentPengikutCount) * durasiHari;
        const lblPenugasan = document.getElementById('lblPenugasanOH');
        if(lblPenugasan) lblPenugasan.innerText = `${requiredOH} OH`;

        return { maxQuota, usedOH, remainingOH, requiredOH };
    } catch(e) {
        console.error(e);
        return { maxQuota: 50, usedOH: 0, remainingOH: 50, requiredOH: 1 };
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
        optionsHTML += `<option value="${escapeHtml(asn.nama)}">${escapeHtml(asn.nama)}</option>`;
    });

    div.innerHTML = `
        <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-700">Anggota Pengikut ${pengikutCount}</span>
            <button type="button" onclick="removeOfficerRow(${pengikutCount})" class="text-rose-600 hover:text-rose-800 text-xs font-bold flex items-center gap-1 cursor-pointer">
                <i class="fa-solid fa-trash"></i> Hapus
            </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
                <select class="pengikut-nama w-full p-2 text-xs rounded border border-slate-300 font-semibold bg-white" onchange="autofillPengikutRow(${pengikutCount}, this.value)">
                    ${optionsHTML}
                </select>
            </div>
            <div>
                <input type="text" placeholder="NIP Pengikut" readonly class="pengikut-nip w-full p-2 text-xs rounded border border-slate-200 bg-slate-100 font-mono">
            </div>
            <div>
                <input type="text" placeholder="Jabatan Pengikut" readonly class="pengikut-jabatan w-full p-2 text-xs rounded border border-slate-200 bg-slate-100 font-semibold">
            </div>
        </div>
    `;

    container.appendChild(div);
    calculateTotalBudget();
    window.updateSKQuotaInfo();
};

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
        const jabatanInput = row.querySelector('.pengikut-jabatan');
        if (nipInput) nipInput.value = match ? match.nip : '';
        if (jabatanInput) jabatanInput.value = match ? match.jabatan : '';
    }
};

window.calculateTotalBudget = function() {
    const satuan = parseFloat(document.getElementById('biayaPerOrang')?.value) || 0;
    const totalPengikut = document.querySelectorAll('#pengikutContainer > div').length;
    const durasiHari = calculateLamaPerdin();
    const total = satuan * (1 + totalPengikut) * durasiHari;
    
    const formatted = document.getElementById('totalBiayaFormatted');
    const inputTerbilang = document.getElementById('terbilang');
    
    if (formatted) formatted.value = 'Rp ' + total.toLocaleString('id-ID');
    if (inputTerbilang && typeof numberToWords === 'function') {
        inputTerbilang.value = numberToWords(total) + ' Rupiah';
    }
    return total;
};

window.onDateOrBudgetChanged = function() {
    calculateLamaPerdin();
    calculateTotalBudget();
    window.updateSKQuotaInfo();
};

window.proceedToStep2 = async function() {
    const kodeSK = document.getElementById('step1_kodeSK')?.value.trim();
    const desaTujuanStep1 = document.getElementById('step1_selectDesa')?.value.trim();
    const sumberDanaStep1 = document.getElementById('step1_sumberDana')?.value.trim();
    const namaPelaksana = document.getElementById('namaPelaksana')?.value.trim();

    if (!kodeSK) {
        alert("Peringatan: Kode Sub Kegiatan (SK) wajib diisi!");
        document.getElementById('step1_kodeSK')?.focus();
        return;
    }
    if (!desaTujuanStep1) {
        alert("Peringatan: Tempat / Desa Tujuan Perdin wajib diisi!");
        document.getElementById('step1_selectDesa')?.focus();
        return;
    }
    if (!sumberDanaStep1) {
        alert("Peringatan: Sumber Dana wajib diisi!");
        document.getElementById('step1_sumberDana')?.focus();
        return;
    }
    if (!namaPelaksana) {
        alert("Peringatan: Silakan pilih Pelaksana Utama terlebih dahulu!");
        document.getElementById('namaPelaksana')?.focus();
        return;
    }

    let unselectedPengikut = false;
    document.querySelectorAll('#pengikutContainer > div').forEach((row) => {
        const val = row.querySelector('.pengikut-nama')?.value;
        if (!val) unselectedPengikut = true;
    });
    if (unselectedPengikut) {
        alert("Peringatan: Terdapat baris anggota pengikut yang belum dipilih nama ASN-nya!");
        return;
    }

    syncTujuanPerdin(desaTujuanStep1);

    const quotaInfo = await window.updateSKQuotaInfo();
    if (quotaInfo.requiredOH > quotaInfo.remainingOH) {
        alert(`Penugasan ditolak! Kuota Perdin untuk SK (${kodeSK}) tidak mencukupi.\n\n` +
              `• Dibutuhkan: ${quotaInfo.requiredOH} OH\n` +
              `• Sisa Kuota: ${quotaInfo.remainingOH} OH`);
        return;
    }

    switchStep(2);
};

window.handleFormSubmit = async function(e) {
    e.preventDefault();
    const pengikutList = [];
    document.querySelectorAll('#pengikutContainer > div').forEach(row => {
        const nama = row.querySelector('.pengikut-nama')?.value;
        const nip = row.querySelector('.pengikut-nip')?.value;
        const jabatan = row.querySelector('.pengikut-jabatan')?.value;
        if (nama) pengikutList.push({ nama, nip, jabatan });
    });

    const record = {
        noSuratTugas: document.getElementById('noSuratTugas').value,
        noSPPD: document.getElementById('noSPPD').value,
        kodeSubKegiatan: document.getElementById('step1_kodeSK').value,
        sumberDana: document.getElementById('step1_sumberDana')?.value || 'DAU',
        
        // Data Pejabat Pengutus (Camat / Pengguna Anggaran)
        namaCamat: document.getElementById('namaPejabat')?.value || 'RUDOLF UMBU RESI LOLY, ST',
        nipCamat: document.getElementById('nipPejabat')?.value || '197205212006041008',
        pangkatCamat: 'Pembina',
        jabatanCamat: document.getElementById('jabatanPejabat')?.value || 'CAMAT TABUNDUNG',

        // Data Bendahara Pengeluaran Default
        namaBendahara: 'RAUF UMAR',
        nipBendahara: '197409121999031004',

        // Data Pejabat Penandatangan di Tempat Tujuan (Kades)
        namaPejabatTujuan: document.getElementById('namaPejabatTujuan')?.value || '',
        nipPejabatTujuan: document.getElementById('nipPejabatTujuan')?.value || '-',
        jabatanPejabatTujuan: document.getElementById('jabatanPejabatTujuan')?.value || '',

        tempatBerangkat: document.getElementById('tempatBerangkat').value,
        tempatTujuan: document.getElementById('tempatTujuan').value,
        alatAngkutan: document.getElementById('alatAngkutan').value,
        tglMulai: document.getElementById('tglMulai').value,
        tglSelesai: document.getElementById('tglSelesai').value,
        lamaHari: calculateLamaPerdin(),
        maksudTujuan: document.getElementById('maksudTujuan').value,
        laporanHasil: document.getElementById('laporanHasil').value,
        namaPelaksana: document.getElementById('namaPelaksana').value,
        nipPelaksana: document.getElementById('nipPelaksana').value,
        jabatanPelaksana: document.getElementById('jabatanPelaksana')?.value || '',
        biayaPerOrang: parseFloat(document.getElementById('biayaPerOrang').value) || 0,
        totalBiaya: calculateTotalBudget(),
        pengikut: pengikutList,
        createdAt: new Date().toISOString()
    };

    try {
        const id = await db.records.add(record);
        sessionStorage.setItem('sppd_print_current', JSON.stringify({ ...record, id }));
        alert('SPPD Berhasil Disimpan! Membuka Halaman Cetak...');
        
        await loadLocalRecords();
        openCetakPage(id);
    } catch(err) {
        console.error("Gagal menyimpan ke DB:", err);
        alert("Gagal menyimpan data SPPD!");
    }
};

window.openCetakPage = async function(id) {
    try {
        const record = await db.records.get(id);
        if (record) {
            sessionStorage.setItem('sppd_print_current', JSON.stringify(record));
            window.location.href = `cetak.html?id=${id}`;
        } else {
            alert("Data SPPD tidak ditemukan!");
        }
    } catch(e) {
        alert("Gagal membuka halaman cetak!");
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
    try {
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
                    ${escapeHtml(r.noSuratTugas)}<br>
                    <span class="text-[11px] text-slate-500">${escapeHtml(r.noSPPD) || '-'}</span>
                </td>
                <td class="p-3 font-mono">
                    <span class="font-bold text-sky-800">${escapeHtml(r.kodeSubKegiatan)}</span><br>
                    <span class="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-sans font-semibold uppercase">${escapeHtml(r.sumberDana) || 'DAU'}</span>
                </td>
                <td class="p-3 font-bold">${escapeHtml(r.namaPelaksana)}</td>
                <td class="p-3">${escapeHtml(r.tempatTujuan || r.maksudTujuan)}</td>
                <td class="p-3 font-semibold text-emerald-700">Rp ${(r.totalBiaya || 0).toLocaleString('id-ID')}</td>
                <td class="p-3 text-center">
                    <button onclick="openCetakPage(${r.id})" class="bg-gov-700 hover:bg-gov-800 text-white px-2.5 py-1 rounded text-xs transition mr-1 cursor-pointer">
                        <i class="fa-solid fa-print"></i> Cetak
                    </button>
                    <button onclick="deleteRecord(${r.id})" class="text-rose-600 hover:text-rose-800 p-1 text-xs cursor-pointer">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch(e) { console.error(e); }
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

window.editAsn = async function(nip) {
    const asn = await db.asnMaster.get(nip);
    if (!asn) return alert("Data ASN tidak ditemukan!");

    document.getElementById('asnOriginalNip').value = asn.nip;
    document.getElementById('asnNama').value = asn.nama || '';
    document.getElementById('asnNip').value = asn.nip || '';
    document.getElementById('asnPangkat').value = asn.pangkat || '';
    document.getElementById('asnJabatan').value = asn.jabatan || '';

    document.getElementById('asnFormTitle').innerText = `Edit Data ASN (${asn.nama})`;
    document.getElementById('btnSaveAsn').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Simpan Perubahan ASN`;
    document.getElementById('btnSaveAsn').className = "w-full py-2 bg-amber-600 text-white font-bold text-xs rounded hover:bg-amber-700 shadow transition cursor-pointer";
    document.getElementById('btnCancelEditAsn').classList.remove('hidden');
};

window.resetAsnForm = function() {
    document.getElementById('asnForm').reset();
    document.getElementById('asnOriginalNip').value = '';
    document.getElementById('asnFormTitle').innerText = "Tambah / Edit Data ASN:";
    document.getElementById('btnSaveAsn').innerHTML = `+ Simpan ASN Baru`;
    document.getElementById('btnSaveAsn').className = "w-full py-2 bg-gov-700 text-white font-bold text-xs rounded hover:bg-gov-800 shadow transition cursor-pointer";
    document.getElementById('btnCancelEditAsn').classList.add('hidden');
};

window.saveAsnMaster = async function(e) {
    if (e) e.preventDefault();
    const originalNip = document.getElementById('asnOriginalNip').value.trim();
    const nama = document.getElementById('asnNama').value.trim();
    const nip = document.getElementById('asnNip').value.trim();
    const pangkat = document.getElementById('asnPangkat').value.trim();
    const jabatan = document.getElementById('asnJabatan').value.trim();

    if (!nama || !nip || !jabatan) {
        return alert('Nama, NIP, dan Jabatan wajib diisi!');
    }

    if (originalNip && originalNip !== nip) {
        await db.asnMaster.delete(originalNip);
    }

    await db.asnMaster.put({ nama, nip, pangkat, jabatan });
    
    resetAsnForm();
    await loadAsnCache();
    await renderAsnList();
    populateSelectOptions();
    
    alert(`Data ASN (${nama}) berhasil disimpan!`);
};

window.deleteAsn = async function(nip) {
    if(confirm('Hapus ASN ini dari Master Data?')) { 
        await db.asnMaster.delete(nip); 
        await loadAsnCache();
        await renderAsnList(); 
        populateSelectOptions(); 
    }
};

async function renderAsnList() {
    try {
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
                    <p class="text-slate-700">No. ST: <span class="font-mono font-bold">${escapeHtml(lastRecord.noSuratTugas)}</span></p>
                    <p class="text-slate-700">No. SPPD: <span class="font-mono font-bold">${escapeHtml(lastRecord.noSPPD) || '-'}</span></p>
                   </div>` 
                : `<p class="text-[10px] text-slate-400 italic mt-0.5">Belum ada riwayat penugasan</p>`;

            return `
                <div class="py-3 flex justify-between items-start text-xs border-b border-slate-100">
                    <div class="flex-1 pr-2">
                        <p class="font-bold text-slate-800 text-sm">${escapeHtml(a.nama)}</p>
                        <p class="text-slate-600 font-mono">NIP. ${escapeHtml(a.nip)}</p>
                        <p class="text-slate-500 font-semibold">${escapeHtml(a.jabatan)} ${a.pangkat ? '('+escapeHtml(a.pangkat)+')' : ''}</p>
                        ${docInfo}
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                        <button type="button" onclick="editAsn('${escapeHtml(a.nip)}')" class="text-amber-600 hover:text-amber-800 font-bold text-xs p-1 cursor-pointer">
                            <i class="fa-solid fa-pen-to-square"></i> Edit
                        </button>
                        <button type="button" onclick="deleteAsn('${escapeHtml(a.nip)}')" class="text-rose-600 hover:text-rose-800 font-bold text-xs p-1 cursor-pointer">
                            <i class="fa-solid fa-trash"></i> Hapus
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch(e) { console.error(e); }
}

window.downloadCsvTemplate = function() {
    const csvContent = "data:text/csv;charset=utf-8," 
        + "nama,nip,pangkat,jabatan\n"
        + "RUDOLF UMBU RESI LOLY ST,197205212006041008,Pembina,CAMAT TABUNDUNG\n"
        + "KORNELIS KOPA RIHI SE,197811262010011008,Penata Tk. I,SEKRETARIS CAMAT\n"
        + "RAUF UMAR,197409121999031004,Penata,KASUBAG PROGRAM";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "template_master_asn_tabundung.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.importAsnFromCsv = function() {
    const fileInput = document.getElementById('asnCsvFileInput');
    const file = fileInput?.files[0];

    if (!file) {
        return alert("Pilih berkas CSV terlebih dahulu!");
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const text = e.target.result;
            const lines = text.split(/\r\n|\n/);
            
            if (lines.length < 2) {
                return alert("Berkas CSV kosong atau tidak memiliki baris data!");
            }

            const headerLine = lines[0].toLowerCase();
            const delimiter = headerLine.includes(';') ? ';' : ',';
            const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));

            const idxNama = headers.indexOf('nama');
            const idxNip = headers.indexOf('nip');
            const idxPangkat = headers.indexOf('pangkat');
            const idxJabatan = headers.indexOf('jabatan');

            if (idxNama === -1 || idxNip === -1) {
                return alert("Format header CSV salah! Header wajib memiliki minimal kolom 'nama' dan 'nip'.");
            }

            let addedCount = 0;
            let updatedCount = 0;
            const asnBatch = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
                const nama = cols[idxNama] || '';
                const nip = cols[idxNip] || '';
                const pangkat = idxPangkat !== -1 ? (cols[idxPangkat] || '') : '';
                const jabatan = idxJabatan !== -1 ? (cols[idxJabatan] || '') : '';

                if (nama && nip) {
                    const existing = await db.asnMaster.get(nip);
                    if (existing) updatedCount++; else addedCount++;
                    asnBatch.push({ nip, nama, pangkat, jabatan });
                }
            }

            if (asnBatch.length > 0) {
                await db.asnMaster.bulkPut(asnBatch);
                await loadAsnCache();
                await renderAsnList();
                populateSelectOptions();

                fileInput.value = '';
                alert(`Berhasil Mengimport Data ASN!\n\n• Data Baru: ${addedCount}\n• Data Diperbarui: ${updatedCount}`);
            } else {
                alert("Tidak ada data ASN valid yang dapat di-import.");
            }
        } catch(err) {
            console.error("Gagal import CSV:", err);
            alert("Terjadi kesalahan saat memproses berkas CSV.");
        }
    };

    reader.readAsText(file);
};

window.printHistoryTable = async function() {
    try {
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
                    <td class="border border-black p-1.5">${escapeHtml(r.noSuratTugas)}<br><span class="text-[10px] text-slate-600">${escapeHtml(r.noSPPD) || '-'}</span></td>
                    <td class="border border-black p-1.5 font-bold">${escapeHtml(r.namaPelaksana)}</td>
                    <td class="border border-black p-1.5">${escapeHtml(r.tempatTujuan || r.maksudTujuan)}</td>
                    <td class="border border-black p-1.5 font-mono text-center">${escapeHtml(r.kodeSubKegiatan)} (${escapeHtml(r.sumberDana) || 'DAU'})</td>
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
                        <th class="border border-black p-1.5">Kode SK & Sumber Dana</th>
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
    } catch(e) {
        alert("Gagal mencetak rekapitulasi!");
    }
};

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
