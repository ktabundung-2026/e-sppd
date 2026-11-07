/*
  ====================================================================================
  Nama Aplikasi : Sistem e - SPPD Terpadu - Kecamatan Tabundung
  Hosting       : GitHub Pages (Murni Single Page Application / SPA)
  Backend / DB  : Supabase REST API & Supabase Storage
  Nama Halaman  : js/sppd.js
  Fungsi Halaman: Logika pemrosesan form, perhitungan otomatis Lama Hari dari selisih 
                  tanggal, autofill ASN (NIP, Pangkat, Jabatan), perbaikan mapping 
                  data tertukar, serta penyimpanan dan pengalihan ke cetak.html.
  ====================================================================================
*/

let currentMasterASN = [];
let currentMasterSK = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadInitialMasterData();
    renderPengikutTable();
    await renderRiwayatTable();
});

// ----------------------------------------------------
// SWITCH TAB NAVIGATION
// ----------------------------------------------------
function switchTab(tabId) {
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.add('hidden'));
    document.querySelectorAll('.tab-link').forEach(btn => {
        btn.classList.remove('bg-gov-800', 'text-white');
        btn.classList.add('text-slate-600', 'hover:bg-slate-100');
    });

    const activePanel = document.getElementById(`tab-content-${tabId}`);
    const activeBtn = document.getElementById(`tab-btn-${tabId}`);

    if (activePanel) activePanel.classList.remove('hidden');
    if (activeBtn) {
        activeBtn.classList.remove('text-slate-600', 'hover:bg-slate-100');
        activeBtn.classList.add('bg-gov-800', 'text-white');
    }
}

// ----------------------------------------------------
// PERHITUNGAN OTOMATIS LAMA HARI PERJALANAN
// ----------------------------------------------------
function hitungLamaHariOtomatis() {
    const tglMulaiVal = document.getElementById('tglMulai').value;
    const tglKembaliVal = document.getElementById('tglKembali').value;
    const inputLamaHari = document.getElementById('lamaHari');

    if (tglMulaiVal && tglKembaliVal) {
        const dMulai = new Date(tglMulaiVal);
        const dKembali = new Date(tglKembaliVal);

        if (dKembali >= dMulai) {
            const diffTime = Math.abs(dKembali - dMulai);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inklusif
            inputLamaHari.value = diffDays;
        } else {
            alert("Tanggal Kembali tidak boleh sebelum Tanggal Mulai Berangkat!");
            document.getElementById('tglKembali').value = tglMulaiVal;
            inputLamaHari.value = 1;
        }
    }
}

// ----------------------------------------------------
// LOAD DATA MASTER & PERBAIKAN PANGKAT VS JABATAN
// ----------------------------------------------------
async function loadInitialMasterData() {
    if (window.AppDB) {
        currentMasterASN = await window.AppDB.getMasterAsn();
        currentMasterSK = await window.AppDB.getMasterSK();
    }

    populateSKDropdown();
    populateASNDropdowns();
    renderMasterTables();
}

function populateSKDropdown() {
    const skSelect = document.getElementById('kodeSK');
    if (!skSelect) return;
    skSelect.innerHTML = '<option value="">-- Pilih Sub Kegiatan --</option>';

    currentMasterSK.forEach(sk => {
        const opt = document.createElement('option');
        opt.value = sk.kode;
        opt.textContent = `[${sk.kode}] ${sk.nama} (Kuota: ${sk.quota || 50} OH)`;
        skSelect.appendChild(opt);
    });
}

function populateASNDropdowns() {
    const selectPelaksana = document.getElementById('select-pelaksana-utama');
    const selectCamat = document.getElementById('select-ttd-camat');
    const selectSekcam = document.getElementById('select-sekcam');

    if (selectPelaksana) selectPelaksana.innerHTML = '<option value="">-- Pilih dari Master ASN --</option>';
    if (selectCamat) selectCamat.innerHTML = '<option value="">-- Pilih Camat / Plt --</option>';
    if (selectSekcam) selectSekcam.innerHTML = '<option value="">-- Pilih Sekretaris Camat --</option>';

    currentMasterASN.forEach(asn => {
        const namaUpper = asn.nama ? asn.nama.toUpperCase() : '';
        
        // Option Pelaksana Utama
        if (selectPelaksana) {
            const opt = document.createElement('option');
            opt.value = asn.nip;
            opt.textContent = `${namaUpper} - NIP. ${asn.nip}`;
            selectPelaksana.appendChild(opt);
        }

        // Option Camat
        if (selectCamat) {
            const optC = document.createElement('option');
            optC.value = JSON.stringify(asn);
            optC.textContent = `${namaUpper} (${asn.jabatan || 'Camat'})`;
            if (asn.jabatan && asn.jabatan.toLowerCase().includes('camat') && !asn.jabatan.toLowerCase().includes('sekretaris')) {
                optC.selected = true;
            }
            selectCamat.appendChild(optC);
        }

        // Option Sekretaris Camat
        if (selectSekcam) {
            const optS = document.createElement('option');
            optS.value = JSON.stringify(asn);
            optS.textContent = `${namaUpper} (${asn.jabatan || 'Sekretaris Camat'})`;
            if (asn.jabatan && asn.jabatan.toLowerCase().includes('sekretaris')) {
                optS.selected = true;
            }
            selectSekcam.appendChild(optS);
        }
    });
}

// ----------------------------------------------------
// AUTOFILL PELAKSANA UTAMA (NIP, PANGKAT, JABATAN)
// PERBAIKAN: Pemetaan Pangkat & Jabatan Terpasang Benar
// ----------------------------------------------------
function autoFillPelaksanaUtama() {
    const nipVal = document.getElementById('select-pelaksana-utama').value;
    const matched = currentMasterASN.find(a => a.nip === nipVal);

    if (matched) {
        document.getElementById('nipPelaksana').value = matched.nip || '-';
        // Dipastikan Pangkat mengisi Pangkat, Jabatan mengisi Jabatan
        document.getElementById('pangkatPelaksana').value = matched.pangkat || '-';
        document.getElementById('jabatanPelaksana').value = matched.jabatan || '-';
    } else {
        document.getElementById('nipPelaksana').value = '';
        document.getElementById('pangkatPelaksana').value = '';
        document.getElementById('jabatanPelaksana').value = '';
    }
}

// ----------------------------------------------------
// MANAJEMEN BARIS PENGIKUT
// ----------------------------------------------------
let pengikutCount = 0;
function tambahRowPengikut() {
    pengikutCount++;
    const tbody = document.getElementById('tbody-pengikut');
    const tr = document.createElement('tr');
    tr.id = `row-pengikut-${pengikutCount}`;
    tr.className = 'hover:bg-slate-50';

    let optionsAsn = '<option value="">-- Pilih ASN --</option>';
    currentMasterASN.forEach(a => {
        optionsAsn += `<option value="${a.nip}">${a.nama.toUpperCase()} - NIP. ${a.nip}</option>`;
    });

    tr.innerHTML = `
        <td class="p-2 text-center font-bold text-slate-500 row-index">${tbody.children.length + 1}</td>
        <td class="p-2">
            <select class="w-full text-xs p-1.5 border border-slate-300 rounded mb-1 select-pengikut-asn" onchange="autoFillRowPengikut(${pengikutCount}, this.value)">
                ${optionsAsn}
            </select>
            <input type="text" class="w-full text-xs p-1.5 border border-slate-300 rounded input-pengikut-nama uppercase" placeholder="NAMA PENGIKUT">
        </td>
        <td class="p-2">
            <input type="text" class="w-full text-xs p-1.5 border border-slate-300 rounded input-pengikut-nip font-mono" placeholder="NIP">
        </td>
        <td class="p-2 space-y-1">
            <input type="text" class="w-full text-xs p-1.5 border border-slate-300 rounded input-pengikut-pangkat" placeholder="Pangkat / Gol">
            <input type="text" class="w-full text-xs p-1.5 border border-slate-300 rounded input-pengikut-jabatan" placeholder="Jabatan">
        </td>
        <td class="p-2 text-center">
            <button type="button" onclick="hapusRowPengikut(${pengikutCount})" class="text-rose-600 hover:text-rose-800 p-1">
                <i class="fa-solid fa-trash"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
    updatePengikutIndices();
}

function autoFillRowPengikut(rowId, nip) {
    const row = document.getElementById(`row-pengikut-${rowId}`);
    if (!row) return;
    const matched = currentMasterASN.find(a => a.nip === nip);
    if (matched) {
        row.querySelector('.input-pengikut-nama').value = matched.nama.toUpperCase();
        row.querySelector('.input-pengikut-nip').value = matched.nip;
        row.querySelector('.input-pengikut-pangkat').value = matched.pangkat;
        row.querySelector('.input-pengikut-jabatan').value = matched.jabatan;
    }
}

function hapusRowPengikut(rowId) {
    const row = document.getElementById(`row-pengikut-${rowId}`);
    if (row) row.remove();
    updatePengikutIndices();
}

function updatePengikutIndices() {
    const rows = document.querySelectorAll('#tbody-pengikut tr');
    rows.forEach((r, idx) => {
        r.querySelector('.row-index').textContent = idx + 1;
    });
}

function renderPengikutTable() {
    const tbody = document.getElementById('tbody-pengikut');
    if (tbody && tbody.children.length === 0) {
        tambahRowPengikut();
    }
}

// ----------------------------------------------------
// NAVIGASI PENERBITAN & SIMPAN DOKUMEN SPPD
// ----------------------------------------------------
function lanjutKeStep2() {
    const formStep1 = document.getElementById('form-step1');
    if (!formStep1.checkValidity()) {
        formStep1.reportValidity();
        return;
    }
    switchTab('step2');
}

async function simpanDanCetakPerdin() {
    const formStep2 = document.getElementById('form-step2');
    if (!formStep2.checkValidity()) {
        formStep2.reportValidity();
        return;
    }

    const nipUtama = document.getElementById('select-pelaksana-utama').value;
    const matchedPelaksana = currentMasterASN.find(a => a.nip === nipUtama);
    const namaUtama = matchedPelaksana ? matchedPelaksana.nama.toUpperCase() : '';

    // Ambil Data Pengikut
    const pengikutList = [];
    document.querySelectorAll('#tbody-pengikut tr').forEach(row => {
        const nama = row.querySelector('.input-pengikut-nama')?.value;
        if (nama && nama.trim() !== '') {
            pengikutList.push({
                nama: nama.toUpperCase(),
                nip: row.querySelector('.input-pengikut-nip')?.value || '-',
                pangkat: row.querySelector('.input-pengikut-pangkat')?.value || '-',
                jabatan: row.querySelector('.input-pengikut-jabatan')?.value || '-'
            });
        }
    });

    const camatJson = document.getElementById('select-ttd-camat').value;
    const sekcamJson = document.getElementById('select-sekcam').value;

    const recordData = {
        id: Date.now().toString(),
        noSuratTugas: document.getElementById('noSuratTugas').value,
        noSPPD: document.getElementById('noSPPD').value,
        kodeSK: document.getElementById('kodeSK').value,
        tglMulai: document.getElementById('tglMulai').value,
        tglKembali: document.getElementById('tglKembali').value,
        lamaHari: parseInt(document.getElementById('lamaHari').value) || 1,
        maksudPerdin: document.getElementById('maksudPerdin').value,
        tingkatanSPPD: document.getElementById('tingkatanSPPD').value,
        alatAngkut: document.getElementById('alatAngkut').value,
        
        // Pelaksana Utama (Secara konsisten disimpan tepat sesuai atributnya)
        namaPelaksana: namaUtama,
        nipPelaksana: document.getElementById('nipPelaksana').value,
        pangkatPelaksana: document.getElementById('pangkatPelaksana').value,
        jabatanPelaksana: document.getElementById('jabatanPelaksana').value,
        
        // Rute Perjalanan
        tempatBerangkat: document.getElementById('tempatBerangkat').value,
        tempatTujuan: document.getElementById('tempatTujuan').value,
        
        // Rute II, III, IV
        rute2: {
            berangkat: document.getElementById('rute2_berangkat').value,
            tujuan: document.getElementById('rute2_tujuan').value,
            tgl: document.getElementById('rute2_tgl_berangkat').value,
            ttd: document.getElementById('rute2_ttd').value
        },
        rute3: {
            berangkat: document.getElementById('rute3_berangkat').value,
            tujuan: document.getElementById('rute3_tujuan').value,
            tgl: document.getElementById('rute3_tgl_berangkat').value,
            ttd: document.getElementById('rute3_ttd').value
        },
        rute4: {
            berangkat: document.getElementById('rute4_berangkat').value,
            tujuan: document.getElementById('rute4_tujuan').value,
            tgl: document.getElementById('rute4_tgl_berangkat').value,
            ttd: document.getElementById('rute4_ttd').value
        },

        pengikut: pengikutList,
        pejabatCamat: camatJson ? JSON.parse(camatJson) : null,
        pejabatSekcam: sekcamJson ? JSON.parse(sekcamJson) : null,
        createdAt: new Date().toISOString()
    };

    if (window.AppDB) {
        await window.AppDB.saveRecord(recordData);
    }

    window.location.href = `cetak.html?id=${recordData.id}`;
}

// ----------------------------------------------------
// TABEL RIWAYAT PERDIN DITERBITKAN
// ----------------------------------------------------
async function renderRiwayatTable() {
    const tbody = document.getElementById('tbody-riwayat');
    if (!tbody) return;
    
    let records = [];
    if (window.AppDB) records = await window.AppDB.getAllRecords();

    const searchKeyword = (document.getElementById('search-riwayat')?.value || '').toLowerCase();
    const filtered = records.filter(r => 
        (r.namaPelaksana && r.namaPelaksana.toLowerCase().includes(searchKeyword)) ||
        (r.noSPPD && r.noSPPD.toLowerCase().includes(searchKeyword))
    );

    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">Belum ada data riwayat perjalanan dinas.</td></tr>';
        return;
    }

    filtered.forEach((r, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="p-3 text-center font-bold text-slate-500">${idx + 1}</td>
            <td class="p-3">
                <div class="font-bold text-gov-900">${r.noSPPD}</div>
                <div class="text-[11px] text-slate-500">ST: ${r.noSuratTugas}</div>
            </td>
            <td class="p-3 font-semibold text-slate-800 uppercase">${r.namaPelaksana}</td>
            <td class="p-3">
                <div>${r.tempatTujuan}</div>
                <div class="text-[11px] text-slate-500">${r.tglMulai} s/d ${r.tglKembali || r.tglMulai} (${r.lamaHari} Hari)</div>
            </td>
            <td class="p-3 font-mono text-[11px]">${r.kodeSK || '-'}</td>
            <td class="p-3 text-center">
                <a href="cetak.html?id=${r.id}" target="_blank" class="px-2.5 py-1 bg-gov-800 hover:bg-gov-900 text-white rounded text-[11px] font-bold transition inline-flex items-center gap-1">
                    <i class="fa-solid fa-print"></i> Cetak
                </a>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ----------------------------------------------------
// MANAJEMEN TABEL MASTER DATA (ASN & SK)
// ----------------------------------------------------
function renderMasterTables() {
    // Master ASN
    const tbodyAsn = document.getElementById('tbody-master-asn');
    if (tbodyAsn) {
        tbodyAsn.innerHTML = '';
        currentMasterASN.forEach(asn => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50';
            tr.innerHTML = `
                <td class="p-2 font-bold uppercase text-slate-800">${asn.nama}</td>
                <td class="p-2 font-mono text-slate-600">${asn.nip}</td>
                <td class="p-2">${asn.pangkat}</td>
                <td class="p-2 text-slate-700">${asn.jabatan}</td>
                <td class="p-2 text-center">
                    <button onclick="hapusASN('${asn.nip}')" class="text-rose-600 hover:text-rose-800"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbodyAsn.appendChild(tr);
        });
    }

    // Master SK
    const tbodySk = document.getElementById('tbody-master-sk');
    if (tbodySk) {
        tbodySk.innerHTML = '';
        currentMasterSK.forEach(sk => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50';
            tr.innerHTML = `
                <td class="p-2 font-mono font-bold text-slate-700">${sk.kode}</td>
                <td class="p-2 font-medium">${sk.nama}</td>
                <td class="p-2 text-center font-bold text-gov-800">${sk.quota || 50}</td>
                <td class="p-2 text-center">
                    <button onclick="hapusSK('${sk.kode}')" class="text-rose-600 hover:text-rose-800"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbodySk.appendChild(tr);
        });
    }
}

async function hapusASN(nip) {
    if (confirm(`Hapus ASN dengan NIP ${nip}?`)) {
        await window.AppDB.deleteMasterAsn(nip);
        await loadInitialMasterData();
    }
}

async function hapusSK(kode) {
    if (confirm(`Hapus Sub Kegiatan ${kode}?`)) {
        await window.AppDB.deleteMasterSK(kode);
        await loadInitialMasterData();
    }
}
