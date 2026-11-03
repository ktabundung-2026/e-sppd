// Konfigurasi Batas Maksimal Kuota OH per SK (Default jika belum disetting di DB)
const DEFAULT_MAX_KUOTA_OH = 50;

// Update Informasi & Kalkulasi Kuota SK Real-Time
window.updateSKQuotaInfo = async function() {
    const kodeSK = document.getElementById('step1_kodeSK')?.value.trim() || '7.01.01.2.01.0003';
    document.getElementById('lblCurrentSK').innerText = kodeSK;

    // Hitung OH dari data SPPD yang sudah tersimpan di IndexedDB
    const records = await db.records.filter(r => r.kodeSubKegiatan === kodeSK).toArray();
    
    let usedOH = 0;
    records.forEach(r => {
        const countPengikut = Array.isArray(r.pengikut) ? r.pengikut.length : (r.jumlahPengikut || 0);
        usedOH += (1 + countPengikut); // 1 Pelaksana Utama + Jumlah Pengikut
    });

    // Ambil batas kuota dari settings jika ada, atau gunakan default
    const quotaSetting = await db.settings.get(`quota_${kodeSK}`);
    const maxQuota = quotaSetting ? parseInt(quotaSetting.value) : DEFAULT_MAX_KUOTA_OH;

    const remainingOH = Math.max(0, maxQuota - usedOH);
    const percentage = Math.min(100, Math.round((usedOH / maxQuota) * 100));

    // Update Elemen UI
    document.getElementById('valTotalQuota').innerText = `${maxQuota} OH`;
    document.getElementById('valUsedQuota').innerText = `${usedOH} OH`;
    document.getElementById('valRemainingQuota').innerText = `${remainingOH} OH`;

    const pBar = document.getElementById('progressBarQuota');
    const badgeStatus = document.getElementById('badgeStatusQuota');

    if (pBar) {
        pBar.style.width = `${percentage}%`;
        if (percentage >= 90) {
            pBar.className = 'bg-rose-600 h-2 rounded-full transition-all duration-300';
        } else if (percentage >= 75) {
            pBar.className = 'bg-amber-500 h-2 rounded-full transition-all duration-300';
        } else {
            pBar.className = 'bg-gov-700 h-2 rounded-full transition-all duration-300';
        }
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

    // Hitung OH yang dibutuhkan penugasan saat ini
    const currentPengikutCount = document.querySelectorAll('#pengikutContainer > div').length;
    const requiredOH = 1 + currentPengikutCount;
    document.getElementById('lblPenugasanOH').innerText = `${requiredOH} OH`;

    return { maxQuota, usedOH, remainingOH, requiredOH };
};

// Modifikasi fungsi addOfficerRow untuk update kuota
const originalAddOfficerRow = window.addOfficerRow;
window.addOfficerRow = function() {
    originalAddOfficerRow();
    window.updateSKQuotaInfo();
};

// Modifikasi fungsi removeOfficerRow untuk update kuota
const originalRemoveOfficerRow = window.removeOfficerRow;
window.removeOfficerRow = function(id) {
    originalRemoveOfficerRow(id);
    window.updateSKQuotaInfo();
};

// Validasi Kuota saat hendak Lanjut ke Step 2
window.proceedToStep2 = async function() {
    const namaPelaksana = document.getElementById('namaPelaksana').value;
    if (!namaPelaksana) return alert("Pilih Pelaksana Utama terlebih dahulu!");

    const quotaInfo = await window.updateSKQuotaInfo();

    if (quotaInfo.requiredOH > quotaInfo.remainingOH) {
        alert(`Penugasan ditolak! Kuota Perdin untuk Sub Kegiatan (${document.getElementById('step1_kodeSK').value}) tidak mencukupi.\n\n` +
              `• Dibutuhkan: ${quotaInfo.requiredOH} OH\n` +
              `• Sisa Kuota: ${quotaInfo.remainingOH} OH`);
        return;
    }

    switchStep(2);
};

// Render List ASN Master dengan tambahan informasi No Surat Tugas & No SPPD Terakhir
async function renderAsnList() {
    const list = await db.asnMaster.toArray();
    const records = await db.records.reverse().toArray();
    const container = document.getElementById('asnListContainer');
    if (!container) return;

    container.innerHTML = list.map(a => {
        // Cari penugasan terakhir ASN ini
        const lastRecord = records.find(r => r.namaPelaksana === a.nama || (r.pengikut && r.pengikut.some(p => p.nama === a.nama)));
        const docInfo = lastRecord 
            ? `<div class="mt-1 text-[11px] bg-slate-100 p-1.5 rounded border border-slate-200">
                <p class="font-semibold text-gov-800"><i class="fa-solid fa-file-lines mr-1"></i> Penugasan Terakhir:</p>
                <p class="text-slate-600">No. ST: <span class="font-mono font-bold">${lastRecord.noSuratTugas}</span></p>
                <p class="text-slate-600">No. SPPD: <span class="font-mono font-bold">${lastRecord.noSPPD || '-'}</span></p>
               </div>` 
            : `<p class="text-[10px] text-slate-400 italic mt-0.5">Belum ada riwayat penugasan</p>`;

        return `
            <div class="py-2.5 flex justify-between items-start text-xs border-b border-slate-100">
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

// Tambahkan pemanggilan updateSKQuotaInfo pada window.onload
const originalOnload = window.onload;
window.onload = async function() {
    if (originalOnload) await originalOnload();
    await window.updateSKQuotaInfo();
};
