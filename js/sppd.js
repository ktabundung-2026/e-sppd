/**
 * e-SPPD Terpadu Kecamatan Tabundung - Full Script
 * Author/Developer: aRL
 */

// Konfigurasi Supabase REST API (Sesuaikan URL dan anonKey dengan milik Anda)
const SUPABASE_URL = "https://offeebouiohweqlgyccx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mZmVlYm91aW9od2VxbGd5Y2N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMzEwOTYsImV4cCI6MjEwNjkwNzA5Nn0.IuJLePe6ZvPABvuSFVpwFjiM3TGiIH_4zah8fUvEfbw";

// Master ASN Bawaan (Default Data)
const DEFAULT_ASN_LIST = [
    { nama: "RUDOLF UMBU RESI LOLY, ST", nip: "197205212006041008", pangkat: "Pembina, IV/a", jabatan: "Camat Tabundung" },
    { nama: "DANIEL KAMBARU WINDI", nip: "197712312008011084", pangkat: "Penata Tk. I, III/d", jabatan: "Pengadminitrasi Perkantoran" }
    
];

let masterAsn = [];
let perdinHistory = [];
let skQuotaMap = {};

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    initMasterAsn();
    initSKQuotas();
    initPerdinHistory();
    populateAsnDropdowns();
    updateSKQuotaInfo();
    onDateOrBudgetChanged();
    checkNetworkStatus();
});

function checkNetworkStatus() {
    const badge = document.getElementById("header-network-badge");
    if (!badge) return;
    if (navigator.onLine) {
        badge.className = "px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 shadow-inner bg-emerald-900/60 text-emerald-200 border border-emerald-500/40";
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Online (Supabase Sync)`;
    } else {
        badge.className = "px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 shadow-inner bg-amber-900/60 text-amber-200 border border-amber-500/40";
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> Offline (Local Cache)`;
    }
}
window.addEventListener('online', checkNetworkStatus);
window.addEventListener('offline', checkNetworkStatus);

// --- MASTER ASN MANAGEMENT & CSV IMPORT ---
function initMasterAsn() {
    const localData = localStorage.getItem("sppd_master_asn");
    if (localData) {
        try { masterAsn = JSON.parse(localData); } catch (e) { masterAsn = DEFAULT_ASN_LIST; }
    } else {
        masterAsn = DEFAULT_ASN_LIST;
        localStorage.setItem("sppd_master_asn", JSON.stringify(masterAsn));
    }
}

function renderAsnList() {
    const container = document.getElementById("asnListContainer");
    const countLabel = document.getElementById("countMasterAsn");
    if (countLabel) countLabel.innerText = masterAsn.length;
    if (!container) return;

    if (masterAsn.length === 0) {
        container.innerHTML = `<p class="p-3 text-center text-xs text-slate-500 italic">Belum ada data ASN tersimpan.</p>`;
        return;
    }

    container.innerHTML = masterAsn.map((asn) => `
        <div class="py-2 px-1 flex items-center justify-between text-xs hover:bg-slate-50 transition border-b border-slate-100">
            <div>
                <p class="font-bold text-slate-800">${asn.nama}</p>
                <p class="text-[11px] text-slate-500">NIP: ${asn.nip} | Gol: ${asn.pangkat || '-'} | ${asn.jabatan}</p>
            </div>
            <div class="flex items-center gap-2">
                <button type="button" onclick="editAsn('${asn.nip}')" class="text-sky-600 hover:text-sky-800 font-bold"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                <button type="button" onclick="deleteAsn('${asn.nip}')" class="text-rose-600 hover:text-rose-800 font-bold"><i class="fa-solid fa-trash"></i> Hapus</button>
            </div>
        </div>
    `).join("");
}

function openAsnMasterModal() {
    renderAsnList();
    document.getElementById("asnMasterModal").classList.remove("hidden");
}

function closeAsnMasterModal() {
    document.getElementById("asnMasterModal").classList.add("hidden");
    resetAsnForm();
}

function downloadCsvTemplate() {
    const csvContent = "data:text/csv;charset=utf-8," 
        + "nama,nip,pangkat,jabatan\n"
        + "RUDOLF UMBU RESI LOLY ST,197205212006041008,Pembina IV/a,Camat Tabundung\n"
        + "DANIEL KAMBARU WINDI,197712312008011084,Penata Tk. I III/d,Pengadministrasi Perkantoran"
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "template_master_asn_tabundung.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function importAsnFromCsv() {
    const fileInput = document.getElementById('asnCsvFileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert("Silakan pilih file CSV terlebih dahulu!");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split(/\r\n|\n/);
        
        if (lines.length < 2) {
            alert("File CSV kosong atau format tidak valid!");
            return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
        
        const idxNama = headers.indexOf('nama');
        const idxNip = headers.indexOf('nip');
        const idxPangkat = headers.indexOf('pangkat');
        const idxJabatan = headers.indexOf('jabatan');

        if (idxNama === -1 || idxNip === -1 || idxJabatan === -1) {
            alert("Header CSV tidak sesuai! Pastikan terdapat kolom: nama, nip, pangkat, jabatan");
            return;
        }

        let importedCount = 0;
        let updatedCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
            
            const nama = cols[idxNama] || '';
            const nip = cols[idxNip] || '-';
            const pangkat = idxPangkat !== -1 ? (cols[idxPangkat] || '-') : '-';
            const jabatan = cols[idxJabatan] || '';

            if (nama && jabatan) {
                const existingIdx = masterAsn.findIndex(a => (nip !== '-' && a.nip === nip) || a.nama.toLowerCase() === nama.toLowerCase());
                const asnObj = { nama, nip, pangkat, jabatan };

                if (existingIdx !== -1) {
                    masterAsn[existingIdx] = asnObj;
                    updatedCount++;
                } else {
                    masterAsn.push(asnObj);
                    importedCount++;
                }
            }
        }

        localStorage.setItem("sppd_master_asn", JSON.stringify(masterAsn));
        populateAsnDropdowns();
        renderAsnList();
        fileInput.value = '';

        alert(`Import CSV Berhasil!\n- Data Baru Ditambahkan: ${importedCount}\n- Data Diperbarui: ${updatedCount}`);
    };

    reader.readAsText(file);
}

function saveAsnMaster(e) {
    e.preventDefault();
    const origNip = document.getElementById("asnOriginalNip").value;
    const nama = document.getElementById("asnNama").value.trim();
    const nip = document.getElementById("asnNip").value.trim();
    const pangkat = document.getElementById("asnPangkat").value.trim();
    const jabatan = document.getElementById("asnJabatan").value.trim();

    const newObj = { nama, nip, pangkat, jabatan };

    if (origNip) {
        const idx = masterAsn.findIndex(a => a.nip === origNip);
        if (idx !== -1) masterAsn[idx] = newObj;
    } else {
        masterAsn.push(newObj);
    }

    localStorage.setItem("sppd_master_asn", JSON.stringify(masterAsn));
    populateAsnDropdowns();
    renderAsnList();
    resetAsnForm();
}

function editAsn(nip) {
    const asn = masterAsn.find(a => a.nip === nip);
    if (!asn) return;
    document.getElementById("asnOriginalNip").value = asn.nip;
    document.getElementById("asnNama").value = asn.nama;
    document.getElementById("asnNip").value = asn.nip;
    document.getElementById("asnPangkat").value = asn.pangkat;
    document.getElementById("asnJabatan").value = asn.jabatan;
    document.getElementById("asnFormTitle").innerText = "Edit Data ASN:";
    document.getElementById("btnSaveAsn").innerText = "Simpan Perubahan";
    document.getElementById("btnCancelEditAsn").classList.remove("hidden");
}

function resetAsnForm() {
    document.getElementById("asnForm").reset();
    document.getElementById("asnOriginalNip").value = "";
    document.getElementById("asnFormTitle").innerText = "Tambah / Edit Data ASN Manual:";
    document.getElementById("btnSaveAsn").innerText = "+ Simpan ASN Baru";
    document.getElementById("btnCancelEditAsn").classList.add("hidden");
}

function deleteAsn(nip) {
    if (!confirm("Hapus data ASN ini dari master?")) return;
    masterAsn = masterAsn.filter(a => a.nip !== nip);
    localStorage.setItem("sppd_master_asn", JSON.stringify(masterAsn));
    populateAsnDropdowns();
    renderAsnList();
}

function populateAsnDropdowns() {
    const options = masterAsn.map(a => `<option value="${a.nama}">${a.nama} (${a.jabatan})</option>`).join("");

    const selPelaksana = document.getElementById("namaPelaksana");
    if (selPelaksana) {
        selPelaksana.innerHTML = options;
        if (masterAsn.length > 0) onNamaInputChanged('Pelaksana', masterAsn[0].nama);
    }

    const selPejabat = document.getElementById("namaPejabat");
    if (selPejabat) {
        selPejabat.innerHTML = options;
        const camat = masterAsn.find(a => a.jabatan.toLowerCase().includes("camat")) || masterAsn[0];
        if (camat) {
            selPejabat.value = camat.nama;
            onPejabatSelected(camat.nama);
        }
    }
}

function onNamaInputChanged(role, namaVal) {
    const asn = masterAsn.find(a => a.nama === namaVal);
    if (role === 'Pelaksana') {
        document.getElementById("nipPelaksana").value = asn ? asn.nip : "";
        document.getElementById("jabatanPelaksana").value = asn ? asn.jabatan : "";
    }
}

function onPejabatSelected(namaVal) {
    const asn = masterAsn.find(a => a.nama === namaVal);
    if (asn) {
        document.getElementById("nipPejabat").value = asn.nip;
        document.getElementById("jabatanPejabat").value = asn.jabatan.toUpperCase();
    }
}

// --- ANGGOTA PENGIKUT ---
let pengikutCount = 0;
function addOfficerRow() {
    pengikutCount++;
    const container = document.getElementById("pengikutContainer");
    const div = document.createElement("div");
    div.id = `pengikut_row_${pengikutCount}`;
    div.className = "grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-white rounded border border-slate-200 relative";
    div.innerHTML = `
        <div>
            <label class="block text-[11px] text-slate-600 mb-0.5">Anggota Pengikut #${pengikutCount}</label>
            <select onchange="onPengikutSelected(${pengikutCount}, this.value)" class="pengikut-nama w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 bg-white font-semibold">
                ${masterAsn.map(a => `<option value="${a.nama}">${a.nama}</option>`).join("")}
            </select>
        </div>
        <div>
            <label class="block text-[11px] text-slate-600 mb-0.5">NIP Pengikut</label>
            <input type="text" readonly id="pengikut_nip_${pengikutCount}" class="pengikut-nip w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 bg-slate-100 font-mono">
        </div>
        <div class="flex items-end gap-2">
            <div class="flex-1">
                <label class="block text-[11px] text-slate-600 mb-0.5">Jabatan Pengikut</label>
                <input type="text" readonly id="pengikut_jabatan_${pengikutCount}" class="pengikut-jabatan w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 bg-slate-100 font-semibold">
            </div>
            <button type="button" onclick="removeOfficerRow(${pengikutCount})" class="text-rose-600 hover:text-rose-800 p-2 text-xs font-bold"><i class="fa-solid fa-trash"></i></button>
        </div>
    `;
    container.appendChild(div);
    if (masterAsn.length > 0) onPengikutSelected(pengikutCount, masterAsn[0].nama);
    updateSKQuotaInfo();
    onDateOrBudgetChanged();
}

function removeOfficerRow(id) {
    const el = document.getElementById(`pengikut_row_${id}`);
    if (el) el.remove();
    updateSKQuotaInfo();
    onDateOrBudgetChanged();
}

function onPengikutSelected(id, namaVal) {
    const asn = masterAsn.find(a => a.nama === namaVal);
    if (asn) {
        document.getElementById(`pengikut_nip_${id}`).value = asn.nip;
        document.getElementById(`pengikut_jabatan_${id}`).value = asn.jabatan;
    }
}

// --- ALUR STEPPER ---
function switchStep(stepNum) {
    document.querySelectorAll(".step-content").forEach(el => el.classList.add("hidden"));
    document.getElementById(`step-content-${stepNum}`).classList.remove("hidden");

    document.querySelectorAll(".step-btn").forEach((btn, idx) => {
        const icon = btn.querySelector(".step-icon");
        const label = btn.querySelector(".step-label");
        if (idx + 1 === stepNum) {
            icon.className = "step-icon w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-gov-700 text-white shadow-md";
            label.className = "step-label text-xs font-bold text-gov-800 mt-1";
        } else {
            icon.className = "step-icon w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-slate-200 text-slate-600";
            label.className = "step-label text-xs font-medium text-slate-500 mt-1";
        }
    });
}

function syncTujuanPerdin(val) {
    const el = document.getElementById("tempatTujuan");
    if (el) el.value = val;
}

function proceedToStep2() {
    const tujuan = document.getElementById("step1_selectDesa").value.trim();
    if (!tujuan) {
        alert("Harap masukkan Tempat / Desa Tujuan Perdin!");
        return;
    }
    syncTujuanPerdin(tujuan);
    switchStep(2);
}

// --- LOGIKA KUOTA SK & KALKULASI BIAYA ---
function initSKQuotas() {
    const saved = localStorage.getItem("sppd_sk_quotas");
    if (saved) {
        try { skQuotaMap = JSON.parse(saved); } catch (e) { skQuotaMap = {}; }
    }
}

function saveCustomSKQuota(val) {
    const sk = document.getElementById("step1_kodeSK").value.trim();
    if (!sk) return;
    skQuotaMap[sk] = parseInt(val) || 50;
    localStorage.setItem("sppd_sk_quotas", JSON.stringify(skQuotaMap));
    updateSKQuotaInfo();
}

function updateSKQuotaInfo() {
    const sk = document.getElementById("step1_kodeSK").value.trim() || "7.01.01.2.01.0003";
    document.getElementById("lblCurrentSK").innerText = sk;

    const maxQuota = skQuotaMap[sk] !== undefined ? skQuotaMap[sk] : 50;
    document.getElementById("inputMaxQuota").value = maxQuota;

    let usedOH = 0;
    perdinHistory.filter(r => r.kodeSK === sk).forEach(r => {
        const personCount = 1 + (r.pengikut ? r.pengikut.length : 0);
        const days = r.lamaHari || 1;
        usedOH += personCount * days;
    });

    const remaining = maxQuota - usedOH;
    const pct = Math.min(100, Math.round((usedOH / maxQuota) * 100));

    document.getElementById("valUsedQuota").innerText = `${usedOH} OH`;
    document.getElementById("valRemainingQuota").innerText = `${remaining} OH`;
    
    const pBar = document.getElementById("progressBarQuota");
    pBar.style.width = `${pct}%`;

    const statusBadge = document.getElementById("badgeStatusQuota");
    if (remaining < 0) {
        statusBadge.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300";
        statusBadge.innerText = "Over Kuota";
        pBar.className = "bg-rose-600 h-2 rounded-full transition-all duration-300";
    } else if (remaining <= 5) {
        statusBadge.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300";
        statusBadge.innerText = "Hampir Habis";
        pBar.className = "bg-amber-500 h-2 rounded-full transition-all duration-300";
    } else {
        statusBadge.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300";
        statusBadge.innerText = "Tersedia";
        pBar.className = "bg-gov-700 h-2 rounded-full transition-all duration-300";
    }

    const totalTim = 1 + document.querySelectorAll("#pengikutContainer > div").length;
    const tglMulai = document.getElementById("tglMulai")?.value;
    const tglSelesai = document.getElementById("tglSelesai")?.value;
    let days = 1;
    if (tglMulai && tglSelesai) {
        const d1 = new Date(tglMulai);
        const d2 = new Date(tglSelesai);
        const diffTime = Math.abs(d2 - d1);
        days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    const penugasanOH = totalTim * days;
    const lblPenugasan = document.getElementById("lblPenugasanOH");
    if (lblPenugasan) lblPenugasan.innerText = `${penugasanOH} OH (${totalTim} Orang x ${days} Hari)`;
}

function onDateOrBudgetChanged() {
    const tglMulai = document.getElementById("tglMulai").value;
    const tglSelesai = document.getElementById("tglSelesai").value;
    let days = 1;

    if (tglMulai && tglSelesai) {
        const d1 = new Date(tglMulai);
        const d2 = new Date(tglSelesai);
        if (d2 >= d1) {
            const diffTime = Math.abs(d2 - d1);
            days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }
    }

    document.getElementById("lamaHariText").value = `${days} Hari`;

    const totalTim = 1 + document.querySelectorAll("#pengikutContainer > div").length;
    const rate = parseInt(document.getElementById("biayaPerOrang").value) || 0;
    const totalBiaya = totalTim * days * rate;

    document.getElementById("totalBiayaFormatted").value = `Rp ${totalBiaya.toLocaleString("id-ID")}`;
    document.getElementById("terbilang").value = `${numberToWords(totalBiaya)} Rupiah`;

    updateSKQuotaInfo();
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

// --- RIWAYAT PERDIN & SUPABASE API ---
async function initPerdinHistory() {
    const local = localStorage.getItem("sppd_records_tabundung");
    if (local) {
        try { perdinHistory = JSON.parse(local); } catch (e) { perdinHistory = []; }
    }
    renderHistoryTable();

    if (navigator.onLine) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/riwayat_perdin?select=*`, {
                headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
            });
            if (res.ok) {
                const remoteData = await res.json();
                if (remoteData && remoteData.length > 0) {
                    perdinHistory = remoteData;
                    localStorage.setItem("sppd_records_tabundung", JSON.stringify(perdinHistory));
                    renderHistoryTable();
                    updateSKQuotaInfo();
                }
            }
        } catch (err) {
            console.warn("Supabase fetch offline/failed, using local cache.", err);
        }
    }
}

async function saveRecordToSupabase(recordObj) {
    if (!navigator.onLine) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/riwayat_perdin`, {
            method: "POST",
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify(recordObj)
        });
    } catch (e) {
        console.error("Gagal simpan ke Supabase:", e);
    }
}

function handleFormSubmit(e) {
    e.preventDefault();

    const pengikutList = [];
    document.querySelectorAll("#pengikutContainer > div").forEach((row) => {
        const nama = row.querySelector(".pengikut-nama").value;
        const nip = row.querySelector(".pengikut-nip").value;
        const jabatan = row.querySelector(".pengikut-jabatan").value;
        if (nama) pengikutList.push({ nama, nip, jabatan });
    });

    const pelaksanaNama = document.getElementById("namaPelaksana").value;
    const pelaksanaAsn = masterAsn.find(a => a.nama === pelaksanaNama);

    const tglMulai = document.getElementById("tglMulai").value;
    const tglSelesai = document.getElementById("tglSelesai").value;
    let days = 1;
    if (tglMulai && tglSelesai) {
        const d1 = new Date(tglMulai);
        const d2 = new Date(tglSelesai);
        if (d2 >= d1) {
            days = Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
        }
    }

    const rate = parseInt(document.getElementById("biayaPerOrang").value) || 170000;
    const totalBiaya = (1 + pengikutList.length) * days * rate;

    const record = {
        id: Date.now().toString(),
        noSuratTugas: document.getElementById("noSuratTugas").value,
        noSPPD: document.getElementById("noSPPD").value,
        kodeSK: document.getElementById("step1_kodeSK").value,
        sumberDana: document.getElementById("step1_sumberDana").value,
        
        // Pejabat Pengutus (Kecamatan)
        namaCamat: document.getElementById("namaPejabat").value,
        nipCamat: document.getElementById("nipPejabat").value,
        pangkatCamat: document.getElementById("jabatanPejabat").value,
        
        // Pejabat Tempat Tujuan
        namaPejabatTujuan: document.getElementById("namaPejabatTujuan").value,
        nipPejabatTujuan: document.getElementById("nipPejabatTujuan").value,
        jabatanPejabatTujuan: document.getElementById("jabatanPejabatTujuan").value,

        // Pelaksana & Pengikut
        namaPelaksana: pelaksanaNama,
        nipPelaksana: document.getElementById("nipPelaksana").value,
        jabatanPelaksana: document.getElementById("jabatanPelaksana").value,
        pangkatPelaksana: pelaksanaAsn ? pelaksanaAsn.pangkat : "",
        pengikut: pengikutList,

        // Detail Perjalanan & Laporan
        tempatBerangkat: document.getElementById("tempatBerangkat").value,
        tempatTujuan: document.getElementById("tempatTujuan").value,
        alatAngkutan: document.getElementById("alatAngkutan").value,
        tglMulai: tglMulai,
        tglSelesai: tglSelesai,
        tglSurat: tglMulai,
        lamaHari: days,
        maksudTujuan: document.getElementById("maksudTujuan").value,
        laporanHasil: document.getElementById("laporanHasil").value,

        // Biaya & Kwitansi
        biayaPerOrang: rate,
        totalBiaya: totalBiaya,
        dasarPelaksanaan: "Atas Perintah Camat",
        created_at: new Date().toISOString()
    };

    perdinHistory.unshift(record);
    localStorage.setItem("sppd_records_tabundung", JSON.stringify(perdinHistory));
    sessionStorage.setItem("sppd_print_current", JSON.stringify(record));

    saveRecordToSupabase(record);

    alert("Dokumen SPPD Berhasil Disimpan! Pengalihan ke Modul Cetak...");
    window.location.href = `cetak.html?id=${record.id}`;
}

function renderHistoryTable() {
    const tbody = document.getElementById("historyTableBody");
    if (!tbody) return;

    if (perdinHistory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">Belum ada riwayat dokumen perjalanan dinas.</td></tr>`;
        return;
    }

    tbody.innerHTML = perdinHistory.map(r => `
        <tr class="hover:bg-slate-50 border-b text-xs">
            <td class="p-3">
                <span class="font-bold text-gov-800">${r.noSuratTugas}</span><br>
                <span class="text-[11px] text-slate-500">SPPD: ${r.noSPPD}</span>
            </td>
            <td class="p-3">
                <span class="font-mono font-bold">${r.kodeSK}</span><br>
                <span class="text-[11px] text-slate-600 bg-amber-100 px-1.5 py-0.5 rounded font-bold">${r.sumberDana || 'DAU'}</span>
            </td>
            <td class="p-3">
                <span class="font-bold text-slate-800">${r.namaPelaksana}</span>
                <p class="text-[10px] text-slate-500">+${r.pengikut ? r.pengikut.length : 0} Pengikut (${r.lamaHari || 1} Hari)</p>
            </td>
            <td class="p-3 font-semibold text-slate-700">${r.tempatTujuan}</td>
            <td class="p-3 font-bold text-emerald-700">Rp ${r.totalBiaya ? r.totalBiaya.toLocaleString('id-ID') : 0}</td>
            <td class="p-3 text-center space-x-1">
                <button onclick="openPrintRecord('${r.id}')" class="bg-gov-700 text-white px-2.5 py-1 rounded hover:bg-gov-800 text-[11px] font-bold"><i class="fa-solid fa-print"></i> Cetak</button>
                <button onclick="deleteRecord('${r.id}')" class="bg-rose-600 text-white px-2 py-1 rounded hover:bg-rose-700 text-[11px] font-bold"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join("");
}

function openPrintRecord(id) {
    const rec = perdinHistory.find(r => r.id == id);
    if (rec) {
        sessionStorage.setItem("sppd_print_current", JSON.stringify(rec));
        window.location.href = `cetak.html?id=${id}`;
    }
}

function deleteRecord(id) {
    if (!confirm("Apakah Anda yakin ingin menghapus dokumen ini dari riwayat?")) return;
    perdinHistory = perdinHistory.filter(r => r.id != id);
    localStorage.setItem("sppd_records_tabundung", JSON.stringify(perdinHistory));
    renderHistoryTable();
    updateSKQuotaInfo();
}

function printHistoryTable() {
    const printContainer = document.getElementById("rekapPrintContainer");
    if (!printContainer) return;

    let html = `
        <table class="w-full border-collapse border border-black text-xs font-official">
            <thead>
                <tr class="bg-slate-200 border-b border-black text-center font-bold">
                    <th class="border border-black p-2">No</th>
                    <th class="border border-black p-2">No. Surat / SPPD</th>
                    <th class="border border-black p-2">Kode SK</th>
                    <th class="border border-black p-2">Pelaksana & Anggota</th>
                    <th class="border border-black p-2">Tujuan</th>
                    <th class="border border-black p-2">Lama (Hari)</th>
                    <th class="border border-black p-2">Total Biaya (Rp)</th>
                </tr>
            </thead>
            <tbody>
    `;

    perdinHistory.forEach((r, idx) => {
        const team = [r.namaPelaksana, ...(r.pengikut ? r.pengikut.map(p => p.nama) : [])].join(", ");
        html += `
            <tr class="border border-black">
                <td class="border border-black p-1.5 text-center">${idx + 1}</td>
                <td class="border border-black p-1.5">${r.noSuratTugas}<br><small>${r.noSPPD}</small></td>
                <td class="border border-black p-1.5 font-mono">${r.kodeSK}</td>
                <td class="border border-black p-1.5">${team}</td>
                <td class="border border-black p-1.5">${r.tempatTujuan}</td>
                <td class="border border-black p-1.5 text-center">${r.lamaHari || 1}</td>
                <td class="border border-black p-1.5 text-right font-bold">${r.totalBiaya ? r.totalBiaya.toLocaleString('id-ID') : 0}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    printContainer.innerHTML = html;
    document.body.classList.add("printing-rekap");
    window.print();
    document.body.classList.remove("printing-rekap");
}
