/**
 * js/rekap.js - Logika Monitoring Kuota & Rekapitulasi SPPD
 * Aplikasi e-SPPD Kecamatan Tabundung
 */

document.addEventListener("DOMContentLoaded", () => {
    loadRekapData();
});

async function loadRekapData() {
    let perdinHistory = [];
    let masterSKList = [];

    // Prioritaskan Caching Lokal untuk Loading Cepat
    const savedRecords = localStorage.getItem('sppd_records_tabundung');
    if (savedRecords) {
        try { perdinHistory = JSON.parse(savedRecords); } catch (e) { perdinHistory = []; }
    }

    const savedSK = localStorage.getItem('sppd_custom_sk_list');
    if (savedSK) {
        try { masterSKList = JSON.parse(savedSK); } catch (e) { masterSKList = []; }
    }

    // Render tampilan secara instan
    renderDashboardComponents(perdinHistory, masterSKList);

    // Ambil data terbaru secara asynchronous tanpa menghambat tampilan awal
    if (window.AppDB) {
        Promise.all([
            window.AppDB.getAllRecords(),
            window.AppDB.getMasterSK()
        ]).then(([latestRecords, latestSK]) => {
            if (latestRecords && latestRecords.length > 0) perdinHistory = latestRecords;
            if (latestSK && latestSK.length > 0) masterSKList = latestSK;
            renderDashboardComponents(perdinHistory, masterSKList);
        }).catch(err => console.warn("Sync asynchronous rekap:", err));
    }
}

function renderDashboardComponents(perdinHistory, masterSKList) {
    let totalBiaya = 0;
    let totalOH = 0;

    perdinHistory.forEach(r => {
        const count = 1 + (r.pengikut ? r.pengikut.length : 0);
        const days = parseInt(r.lamaHari) || 1;
        totalOH += (count * days);
        totalBiaya += (r.totalBiaya || 0);
    });

    document.getElementById("metricTotalPerdin").innerText = perdinHistory.length;
    document.getElementById("metricTotalOH").innerText = `${totalOH} OH`;
    document.getElementById("metricTotalBiaya").innerText = `Rp ${totalBiaya.toLocaleString('id-ID')}`;
    document.getElementById("metricTotalSK").innerText = masterSKList.length;

    const skUsageMap = {};
    perdinHistory.forEach(r => {
        const sk = r.kodeSK || r.sub_kegiatan;
        if (sk) {
            const count = 1 + (r.pengikut ? r.pengikut.length : 0);
            const days = parseInt(r.lamaHari) || 1;
            skUsageMap[sk] = (skUsageMap[sk] || 0) + (count * days);
        }
    });

    // Render Status Kuota SK
    const container = document.getElementById("skQuotaCardsContainer");
    if (container) {
        container.className = "flex flex-col space-y-3 w-full";
        container.innerHTML = "";

        if (masterSKList.length === 0) {
            container.innerHTML = `<div class="w-full p-4 text-center text-slate-400 italic text-xs bg-slate-50 border border-slate-200 rounded-xl">Belum ada data Sub Kegiatan aktif.</div>`;
        } else {
            masterSKList.forEach(skObj => {
                const sk = skObj.kode;
                const namaSK = skObj.nama || '(Isi Nama Sub Kegiatan)';
                const maxQuota = parseInt(skObj.quota) || 50;
                const used = skUsageMap[sk] || 0;
                const remaining = maxQuota - used;
                const pct = Math.min(100, Math.round((used / maxQuota) * 100));

                let badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-300";
                let statusText = "Tersedia";
                let barColor = "bg-gov-700";

                if (remaining < 0) {
                    badgeColor = "bg-rose-100 text-rose-800 border-rose-300";
                    statusText = "Over Kuota";
                    barColor = "bg-rose-600";
                } else if (remaining <= 5) {
                    badgeColor = "bg-amber-100 text-amber-800 border-amber-300";
                    statusText = "Hampir Habis";
                    barColor = "bg-amber-500";
                }

                container.innerHTML += `
                    <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                        <div class="w-full md:w-1/3 space-y-1">
                            <div class="flex items-center gap-2">
                                <span class="font-mono font-bold text-xs text-gov-900 bg-slate-200 px-2 py-0.5 rounded border border-slate-300">${sk}</span>
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}">${statusText}</span>
                            </div>
                            <h4 class="text-xs font-semibold text-slate-700 leading-tight">${namaSK}</h4>
                        </div>
                        <div class="grid grid-cols-3 gap-2 text-center text-xs w-full md:w-1/3">
                            <div class="bg-white p-2 rounded-lg border border-slate-200">
                                <span class="block text-[9px] text-slate-400 font-bold uppercase">Batas Kuota</span>
                                <span class="font-extrabold text-slate-800">${maxQuota} OH</span>
                            </div>
                            <div class="bg-white p-2 rounded-lg border border-slate-200">
                                <span class="block text-[9px] text-slate-400 font-bold uppercase">Terpakai</span>
                                <span class="font-extrabold text-sky-700">${used} OH</span>
                            </div>
                            <div class="bg-white p-2 rounded-lg border border-slate-200">
                                <span class="block text-[9px] text-slate-400 font-bold uppercase">Sisa Kuota</span>
                                <span class="font-extrabold ${remaining < 0 ? 'text-rose-600' : 'text-emerald-600'}">${remaining} OH</span>
                            </div>
                        </div>
                        <div class="w-full md:w-1/4 space-y-1">
                            <div class="flex justify-between items-center text-[10px] font-bold text-slate-500">
                                <span>Persentase Serapan</span>
                                <span>${pct}%</span>
                            </div>
                            <div class="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                <div class="${barColor} h-2.5 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
    }

    // Render Tabel Perdin Dikelompokkan berdasarkan Kode SK
    renderGroupedTable(perdinHistory, masterSKList);
}

function renderGroupedTable(perdinHistory, masterSKList) {
    const groupedContainer = document.getElementById("groupedRekapContainer");
    if (!groupedContainer) return;

    if (perdinHistory.length === 0) {
        groupedContainer.innerHTML = `<div class="p-4 text-center text-slate-500 italic text-xs">Belum ada riwayat dokumen perjalanan dinas tersimpan.</div>`;
        return;
    }

    const groupedData = {};
    perdinHistory.forEach(r => {
        const sk = r.kodeSK || r.sub_kegiatan || 'Tanpa Kode SK';
        if (!groupedData[sk]) groupedData[sk] = [];
        groupedData[sk].push(r);
    });

    let html = '';
    let globalIndex = 1;

    Object.keys(groupedData).forEach(kodeSK => {
        const skObj = masterSKList.find(s => s.kode === kodeSK);
        const namaSK = skObj ? skObj.nama : 'Sub Kegiatan Perjalanan Dinas';
        const records = groupedData[kodeSK];

        html += `
            <div class="mb-6 border border-slate-300 rounded-xl overflow-hidden bg-white shadow-sm">
                <div class="bg-gov-900 text-white px-4 py-2.5 font-bold text-xs flex justify-between items-center">
                    <span><i class="fa-solid fa-folder-open text-amber-400 mr-2"></i> Kode SK: ${kodeSK} - ${namaSK}</span>
                    <span class="bg-gov-700 px-2.5 py-0.5 rounded text-[10px]">${records.length} Laporan</span>
                </div>
                <table class="w-full text-left text-xs border-collapse print-table">
                    <thead>
                        <tr class="bg-slate-100 border-b text-slate-700 font-bold uppercase">
                            <th class="p-2.5 text-center w-10">No</th>
                            <th class="p-2.5">No. ST / No. SPPD</th>
                            <th class="p-2.5">Nama Pelaksana Perdin</th>
                            <th class="p-2.5">Tgl Berangkat / Tgl Kembali</th>
                            <th class="p-2.5 text-center">Beban OH</th>
                            <th class="p-2.5 text-right">Total Biaya</th>
                            <th class="p-2.5 text-center print:hidden no-print">Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200">
        `;

        records.forEach(r => {
            const count = 1 + (r.pengikut ? r.pengikut.length : 0);
            const days = parseInt(r.lamaHari) || 1;
            const ohBeban = count * days;
            const pelaksana = r.namaPelaksana || r.pelaksana || '-';
            const tglMulai = r.tglMulai || r.tanggal || '-';
            const tglKembali = r.tglSelesai || r.tglKembali || '-';

            html += `
                <tr class="hover:bg-slate-50 border-b">
                    <td class="p-2.5 text-center font-bold text-slate-500">${globalIndex++}</td>
                    <td class="p-2.5">
                        <div class="font-bold text-gov-800">${r.noSuratTugas || '-'}</div>
                        <div class="text-[10px] text-slate-500">SPPD: ${r.noSPPD || r.no_sppd || '-'}</div>
                    </td>
                    <td class="p-2.5 font-bold text-slate-800">${pelaksana}</td>
                    <td class="p-2.5 text-[11px]">
                        <div>${tglMulai}</div>
                        <div class="text-slate-500 font-semibold">${tglKembali}</div>
                    </td>
                    <td class="p-2.5 text-center font-extrabold text-gov-800 bg-slate-50">${ohBeban} OH</td>
                    <td class="p-2.5 text-right font-extrabold text-emerald-700">Rp ${(r.totalBiaya || 0).toLocaleString('id-ID')}</td>
                    <td class="p-2.5 text-center print:hidden no-print">
                        <div class="flex items-center justify-center gap-1.5">
                            <a href="sppd.html?edit=${r.id}" class="bg-amber-100 hover:bg-amber-200 text-amber-800 px-2 py-1 rounded font-bold text-[11px] transition shadow-sm">Edit</a>
                            <button type="button" onclick="deletePerdinRecord(${r.id})" class="bg-rose-100 hover:bg-rose-200 text-rose-800 px-2 py-1 rounded font-bold text-[11px] transition shadow-sm">Hapus</button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
    });

    groupedContainer.innerHTML = html;
}

async function deletePerdinRecord(recordId) {
    if (confirm("Apakah Anda yakin ingin menghapus dokumen Perjalanan Dinas ini?")) {
        if (window.AppDB && typeof window.AppDB.deleteRecord === 'function') {
            await window.AppDB.deleteRecord(recordId);
        } else {
            let records = JSON.parse(localStorage.getItem('sppd_records_tabundung') || '[]');
            records = records.filter(r => r.id != recordId);
            localStorage.setItem('sppd_records_tabundung', JSON.stringify(records));
        }

        await loadRekapData();
        alert("Dokumen Perjalanan Dinas berhasil dihapus.");
    }
}

window.deletePerdinRecord = deletePerdinRecord;
