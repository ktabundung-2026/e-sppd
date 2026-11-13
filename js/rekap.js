/*
  ====================================================================================
  Nama Aplikasi : Sistem e - SPPD Terpadu - Kecamatan Tabundung
  Hosting       : GitHub Pages (Murni Single Page Application / SPA)
  Backend / DB  : Supabase REST API & Supabase Storage
  Nama Halaman  : js/rekap.js
  Fungsi Halaman: Logika pengolah data rekapitulasi realisasi perjalanan dinas, 
                  perhitungan akumulasi Orang Hari (OH) per Sub Kegiatan, 
                  visualisasi batas kuota, serta pemfilteran dan pencarian rekap.
  ====================================================================================
*/

let allRecords = [];
let allSK = [];

document.addEventListener('DOMContentLoaded', async () => {
    await refreshRekapData();
});

async function refreshRekapData() {
    if (window.AppDB) {
        allRecords = await window.AppDB.getAllRecords();
        allSK = await window.AppDB.getMasterSK();
    }
    
    populateSKFilterOptions();
    renderSKQuotaCards();
    filterAndRenderRekap();
}

function populateSKFilterOptions() {
    const filterSelect = document.getElementById('filter-sk');
    if (!filterSelect) return;

    filterSelect.innerHTML = '<option value="ALL">-- Semua Sub Kegiatan --</option>';
    allSK.forEach(sk => {
        const opt = document.createElement('option');
        opt.value = sk.kode;
        opt.textContent = `[${sk.kode}] ${sk.nama}`;
        filterSelect.appendChild(opt);
    });
}

// ----------------------------------------------------
// MONITORING CARD KUOTA OH PER SUB KEGIATAN
// ----------------------------------------------------
function renderSKQuotaCards() {
    const container = document.getElementById('sk-cards-container');
    if (!container) return;
    container.innerHTML = '';

    if (allSK.length === 0) {
        container.innerHTML = '<div class="col-span-full p-4 bg-white rounded-xl border border-slate-200 text-slate-500 text-xs italic">Belum ada data Master Sub Kegiatan.</div>';
        return;
    }

    allSK.forEach(sk => {
        const maxQuota = parseInt(sk.quota) || 50;
        
        // Hitung realisasi OH untuk Sub Kegiatan ini
        const skRecords = allRecords.filter(r => (r.kodeSK || '7.01.01.2.01.0003') === sk.kode);
        const usedOH = skRecords.reduce((acc, curr) => {
            const timCount = 1 + (curr.pengikut?.length || 0);
            const lama = parseInt(curr.lamaHari) || 1;
            return acc + (timCount * lama);
        }, 0);

        const remainingOH = maxQuota - usedOH;
        const percentage = Math.min(100, Math.round((usedOH / maxQuota) * 100));

        // Tentukan warna progress bar berdasarkan persentase
        let progressColor = 'bg-gov-600';
        let badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
        if (percentage >= 90) {
            progressColor = 'bg-rose-600';
            badgeColor = 'bg-rose-100 text-rose-800 border-rose-300';
        } else if (percentage >= 75) {
            progressColor = 'bg-amber-500';
            badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
        }

        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3 hover:border-gov-600 transition';
        card.innerHTML = `
            <div class="flex justify-between items-start gap-2">
                <div>
                    <span class="font-mono text-[11px] font-bold text-gov-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">${sk.kode}</span>
                    <h4 class="text-xs font-extrabold text-slate-900 mt-1 line-clamp-2">${sk.nama}</h4>
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}">${percentage}% Terpakai</span>
            </div>

            <div class="space-y-1">
                <div class="flex justify-between text-[11px] font-semibold text-slate-600">
                    <span>Realisasi: <strong class="text-slate-900">${usedOH} OH</strong></span>
                    <span>Batas Kuota: <strong>${maxQuota} OH</strong></span>
                </div>
                <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                    <div class="${progressColor} h-full transition-all duration-300" style="width: ${percentage}%"></div>
                </div>
            </div>

            <div class="pt-2 border-t border-slate-100 flex justify-between items-center text-[11px]">
                <span class="text-slate-500">Sisa Kuota:</span>
                <span class="font-extrabold ${remainingOH < 5 ? 'text-rose-600' : 'text-emerald-700'}">${remainingOH} OH</span>
            </div>
        `;
        container.appendChild(card);
    });
}

// ----------------------------------------------------
// TABEL REKAPITULASI DETAIL PER SPPD (Dikelompokkan Berdasarkan SK)
// ----------------------------------------------------
function filterAndRenderRekap() {
    const tbody = document.getElementById('tbody-rekap');
    if (!tbody) return;

    const selectedSK = document.getElementById('filter-sk')?.value || 'ALL';
    const keyword = (document.getElementById('search-rekap')?.value || '').toLowerCase();

    const filtered = allRecords.filter(r => {
        const matchSK = (selectedSK === 'ALL') || ((r.kodeSK || '7.01.01.2.01.0003') === selectedSK);
        const matchSearch = r.namaPelaksana.toLowerCase().includes(keyword) ||
                            r.noSPPD.toLowerCase().includes(keyword) ||
                            r.maksudPerdin.toLowerCase().includes(keyword);
        return matchSK && matchSearch;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">Tidak ada data rekapitulasi yang sesuai kriteria.</td></tr>';
        return;
    }

    // Kelompokkan data berdasarkan Kode Sub Kegiatan (SK)
    const groupedBySK = {};
    filtered.forEach(r => {
        const kode = r.kodeSK || '7.01.01.2.01.0003';
        if (!groupedBySK[kode]) {
            groupedBySK[kode] = [];
        }
        groupedBySK[kode].push(r);
    });

    let grandTotalOH = 0;
    let globalNo = 1;

    Object.keys(groupedBySK).forEach(kodeSK => {
        const skRecords = groupedBySK[kodeSK];
        const matchedSKObj = allSK.find(s => s.kode === kodeSK);
        const namaSK = matchedSKObj ? matchedSKObj.nama : "Sub Kegiatan Umum";

        // Baris Header Kelompok Sub Kegiatan
        tbody.innerHTML += `
            <tr class="bg-slate-100 font-bold border-t border-slate-300 text-gov-900">
                <td colspan="6" class="p-2.5 text-xs">
                    <i class="fa-solid fa-folder-open text-gov-700 mr-1.5"></i> Kode SK: ${kodeSK} - ${namaSK}
                </td>
            </tr>
        `;

        let subTotalOH = 0;

        skRecords.forEach(r => {
            const timCount = 1 + (r.pengikut?.length || 0);
            const lama = parseInt(r.lamaHari) || 1;
            const totalOH = timCount * lama;
            subTotalOH += totalOH;
            grandTotalOH += totalOH;

            // Susun daftar pengikut
            let pengikutStr = '-';
            if (r.pengikut && r.pengikut.length > 0) {
                pengikutStr = r.pengikut.map(p => p.nama.toUpperCase()).join(', ');
            }

            tbody.innerHTML += `
                <tr class="hover:bg-slate-50 border-b">
                    <td class="p-3 text-center font-bold text-slate-500">${globalNo++}</td>
                    <td class="p-3">
                        <div class="font-bold text-gov-900">${r.noSPPD}</div>
                        <div class="text-[11px] text-slate-500">ST: ${r.noSuratTugas}</div>
                    </td>
                    <td class="p-3 space-y-0.5">
                        <div class="font-extrabold text-slate-900 uppercase">${r.namaPelaksana}</div>
                        <div class="text-[11px] text-slate-500">NIP. ${r.nipPelaksana || '-'}</div>
                        ${pengikutStr !== '-' ? `<div class="text-[10px] text-indigo-700 bg-indigo-50 p-1 rounded mt-1 border border-indigo-100"><strong>Pengikut:</strong> ${pengikutStr}</div>` : ''}
                    </td>
                    <td class="p-3">
                        <div class="font-semibold text-slate-800 line-clamp-2">${r.maksudPerdin}</div>
                        <div class="text-[11px] text-slate-500 mt-0.5"><i class="fa-solid fa-location-dot text-rose-500"></i> ${r.tempatBerangkat} → ${r.tempatTujuan}</div>
                    </td>
                    <td class="p-3">
                        <div class="font-bold text-slate-700">${r.tglMulai}</div>
                        <div class="text-[11px] text-slate-500">${lama} Hari Perjalanan</div>
                    </td>
                    <td class="p-3 text-center font-extrabold text-gov-800 text-sm bg-sky-50/30">
                        ${totalOH} OH
                        <div class="text-[10px] font-normal text-slate-500">(${timCount} Org × ${lama} Hr)</div>
                    </td>
                </tr>
            `;
        });

        // Baris Sub Total OH per Sub Kegiatan
        tbody.innerHTML += `
            <tr class="bg-sky-50/80 font-bold border-t border-slate-200">
                <td colspan="5" class="p-2.5 text-right text-slate-700 uppercase text-xs">Sub Total OH (${kodeSK}):</td>
                <td class="p-2.5 text-center text-gov-900 text-xs font-extrabold">${subTotalOH} OH</td>
            </tr>
        `;
    });

    // Baris Total Keseluruhan OH
    tbody.innerHTML += `
        <tr class="bg-gov-900 text-white font-extrabold border-t-2 border-slate-800">
            <td colspan="5" class="p-3 text-right uppercase text-xs">TOTAL KESELURUHAN REALISASI ORANG HARI (OH) :</td>
            <td class="p-3 text-center text-sm font-extrabold">${grandTotalOH} OH</td>
        </tr>
    `;
}
