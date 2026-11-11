/*
  ====================================================================================
  Nama Aplikasi : Sistem e - SPPD Terpadu - Kecamatan Tabundung
  Hosting       : GitHub Pages (Murni Single Page Application / SPA)
  Backend / DB  : Supabase REST API & Supabase Storage
  Nama Halaman  : js/sppd.js
  Fungsi Halaman: Logika pemrosesan form, perhitungan otomatis Lama Hari dari selisih 
                  tanggal, autofill ASN, penyimpanan rute lokasi opsional II & III, 
                  serta penyimpanan & cetak.
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
// STEPPER & TAB NAVIGATION
// ----------------------------------------------------
function switchStep(stepNumber) {
    document.getElementById('step-content-1').classList.add('hidden');
    document.getElementById('step-content-2').classList.add('hidden');
    document.getElementById('step-content-3').classList.add('hidden');

    const activeContent = document.getElementById(`step-content-${stepNumber}`);
    if (activeContent) activeContent.classList.remove('hidden');

    for (let i = 1; i <= 3; i++) {
        const icon = document.getElementById(`step-icon-${i}`);
        const label = document.getElementById(`step-label-${i}`);
        if (i === stepNumber) {
            icon.className = "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-gov-700 text-white shadow-md transition-all";
            label.className = "text-xs font-bold text-gov-800 mt-1";
        } else {
            icon.className = "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-slate-200 text-slate-600 transition-all";
            label.className = "text-xs font-medium text-slate-500 mt-1";
        }
    }
}

function proceedToStep2() {
    const kodeSK = document.getElementById('step1_kodeSK').value;
    if (!kodeSK) {
        alert("Pilih Kode Sub Kegiatan (SK) terlebih dahulu!");
        return;
    }
    switchStep(2);
}

function syncTujuanPerdin(val) {
    const target = document.getElementById('tempatTujuan');
    if (target) target.value = val;
}

// ----------------------------------------------------
// PERHITUNGAN OTOMATIS LAMA HARI & BIAYA
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
            alert("Tanggal Kembali tidak boleh sebelum Tanggal Mulai!");
            document.getElementById('tglKembali').value = tglMulaiVal;
            inputLamaHari.value = 1;
        }
    }
    updateSKQuotaInfo();
}

function updateSKQuotaInfo() {
    const lamaHari = parseInt(document.getElementById('lamaHari').value) || 1;
    const biayaPerOrang = parseInt(document.getElementById('biayaPerOrang').value) || 0;
    const totalOrang = 1 + document.querySelectorAll('#tbody-pengikut tr').length;
    
    const totalBiaya = lamaHari * biayaPerOrang * totalOrang;
    
    const fieldTotal = document.getElementById('totalBiayaFormatted');
    const fieldTerbilang = document.getElementById('terbilang');

    if (fieldTotal) fieldTotal.value = "Rp " + totalBiaya.toLocaleString('id-ID');
    if (fieldTerbilang) fieldTerbilang.value = terbilang(totalBiaya) + " Rupiah";
}

function terbilang(angka) {
    const bil = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
    if (angka < 12) return bil[angka];
    if (angka < 20) return terbilang(angka - 10) + " Belas";
    if (angka < 100) return terbilang(Math.floor(angka / 10)) + " Puluh " + bil[angka % 10];
    if (angka < 200) return "Seratus " + terbilang(angka - 100);
    if (angka < 1000) return terbilang(Math.floor(angka / 100)) + " Ratus " + terbilang(angka % 100);
    if (angka < 2000) return "Seribu " + terbilang(angka - 1000);
    if (angka < 1000000) return terbilang(Math.floor(angka / 1000)) + " Ribu " + terbilang(angka % 1000);
    if (angka < 1000000000) return terbilang(Math.floor(angka / 1000000)) + " Juta " + terbilang(angka % 1000000);
    return angka.toString();
}

// ----------------------------------------------------
// LOAD DATA MASTER & POPULATE DROPDOWNS
// ----------------------------------------------------
async function loadInitialMasterData() {
    if (window.AppDB) {
        currentMasterASN = await window.AppDB.getMasterAsn();
        currentMasterSK = await window.AppDB.getMasterSK();
    }

    populateSKDropdown();
    populateASNDropdowns();
}

function populateSKDropdown() {
    const skSelect = document.getElementById('step1_kodeSK');
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
    const selectPelaksana = document.getElementById('namaPelaksana');
    const selectBendahara = document.getElementById('selectBendahara');

    if (selectPelaksana) selectPelaksana.innerHTML = '<option value="">-- Pilih dari Master ASN --</option>';
    if (selectBendahara) selectBendahara.innerHTML = '<option value="">-- Pilih Bendahara --</option>';

    currentMasterASN.forEach(asn => {
        const namaUpper = asn.nama ? asn.nama.toUpperCase() : '';
        
        if (selectPelaksana) {
            const opt = document.createElement('option');
            opt.value = asn.nip;
            opt.textContent = `${namaUpper} - NIP. ${asn.nip}`;
            selectPelaksana.appendChild(opt);
        }

        if (selectBendahara) {
            const optB = document.createElement('option');
            optB.value = asn.nip;
            optB.textContent = `${namaUpper} (${asn.jabatan || 'Bendahara'})`;
            if (asn.jabatan && asn.jabatan.toLowerCase().includes('bendahara')) {
                optB.selected = true;
                const nipInput = document.getElementById('nipBendahara');
                if (nipInput) nipInput.value = asn.nip;
            }
            selectBendahara.appendChild(optB);
        }
    });

    document.querySelectorAll('.select-pengikut-asn').forEach(sel => {
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">-- Pilih ASN --</option>';
        currentMasterASN.forEach(a => {
            sel.innerHTML += `<option value="${a.nip}">${a.nama.toUpperCase()} - NIP. ${a.nip}</option>`;
        });
        sel.value = currentVal;
    });
}

function autoFillPelaksanaUtama() {
    const nipVal = document.getElementById('namaPelaksana').value;
    const matched = currentMasterASN.find(a => a.nip === nipVal);

    if (matched) {
        document.getElementById('nipPelaksana').value = matched.nip || '-';
        document.getElementById('pangkatPelaksana').value = matched.pangkat || '-';
        document.getElementById('jabatanPelaksana').value = matched.jabatan || '-';
    } else {
        document.getElementById('nipPelaksana').value = '';
        document.getElementById('pangkatPelaksana').value = '';
        document.getElementById('jabatanPelaksana').value = '';
    }
}

function onBendaharaSelected(nip) {
    const matched = currentMasterASN.find(a => a.nip === nip);
    const nipInput = document.getElementById('nipBendahara');
    if (nipInput) nipInput.value = matched ? matched.nip : '';
}

// ----------------------------------------------------
// MANAJEMEN PENGIKUT
// ----------------------------------------------------
let pengikutCount = 0;
function addPengikutRow() {
    pengikutCount++;
    const tbody = document.getElementById('tbody-pengikut');
    const tr = document.createElement('tr');
    tr.id = `row-pengikut-${pengikutCount}`;
    tr.className = 'hover:bg-slate-50 border-b border-slate-100';

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
            <input type="text" class="w-full text-xs p-1.5 border border-slate-300 rounded input-pengikut-nama uppercase-input" placeholder="NAMA PENGIKUT">
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
    updateSKQuotaInfo();
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
    updateSKQuotaInfo();
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
        addPengikutRow();
    }
}

// ----------------------------------------------------
// FORM SUBMIT & SIMPAN SPPD
// ----------------------------------------------------
async function handleFormSubmit(event) {
    event.preventDefault();

    const nipUtama = document.getElementById('namaPelaksana').value;
    const matchedPelaksana = currentMasterASN.find(a => a.nip === nipUtama);
    const namaUtama = matchedPelaksana ? matchedPelaksana.nama.toUpperCase() : '';

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

    const recordData = {
        id: Date.now().toString(),
        noSuratTugas: document.getElementById('noSuratTugas').value,
        noSPPD: document.getElementById('noSPPD').value,
        kodeSK: document.getElementById('step1_kodeSK').value,
        sumberDana: document.getElementById('sumberDana').value,
        maksudTujuan: document.getElementById('maksudTujuan').value,
        
        namaPelaksana: namaUtama,
        nipPelaksana: document.getElementById('nipPelaksana').value,
        pangkatPelaksana: document.getElementById('pangkatPelaksana').value,
        jabatanPelaksana: document.getElementById('jabatanPelaksana').value,
        
        tempatBerangkat: document.getElementById('tempatBerangkat').value,
        tempatTujuan: document.getElementById('tempatTujuan').value,

        // --- TUJUAN OPSIONAL II & III ---
        tempatTujuan2: document.getElementById('tempatTujuan2')?.value.trim() || '',
        tglTiba2: document.getElementById('tglTiba2')?.value || '',
        tglBerangkat2: document.getElementById('tglBerangkat2')?.value || '',
        pejabatTujuan2: document.getElementById('pejabatTujuan2')?.value.trim() || '',

        tempatTujuan3: document.getElementById('tempatTujuan3')?.value.trim() || '',
        tglTiba3: document.getElementById('tglTiba3')?.value || '',
        tglBerangkat3: document.getElementById('tglBerangkat3')?.value || '',
        pejabatTujuan3: document.getElementById('pejabatTujuan3')?.value.trim() || '',

        tglMulai: document.getElementById('tglMulai').value,
        tglKembali: document.getElementById('tglKembali').value,
        lamaHari: parseInt(document.getElementById('lamaHari').value) || 1,
        biayaPerOrang: parseInt(document.getElementById('biayaPerOrang').value) || 0,
        
        laporanHasil: document.getElementById('laporanHasil').value,
        
        namaPenggunaAnggaran: document.getElementById('namaPenggunaAnggaran').value,
        nipPenggunaAnggaran: document.getElementById('nipPenggunaAnggaran').value,
        selectBendahara: document.getElementById('selectBendahara').value,
        nipBendahara: document.getElementById('nipBendahara').value,
        
        namaPejabatTujuan: document.getElementById('namaPejabatTujuan').value,
        jabatanPejabatTujuan: document.getElementById('jabatanPejabatTujuan').value,
        
        pengikut: pengikutList,
        createdAt: new Date().toISOString()
    };

    if (window.AppDB) {
        await window.AppDB.saveRecord(recordData);
    }

    alert("Dokumen SPPD berhasil disimpan!");
    await renderRiwayatTable();
    switchStep(3);
}

// ----------------------------------------------------
// RIWAYAT TABEL SPPD
// ----------------------------------------------------
async function renderRiwayatTable() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    let records = [];
    if (window.AppDB) records = await window.AppDB.getAllRecords();

    tbody.innerHTML = '';
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">Belum ada riwayat dokumen SPPD.</td></tr>';
        return;
    }

    records.forEach(r => {
        const totalOrang = 1 + (r.pengikut ? r.pengikut.length : 0);
        const totalBiaya = (r.lamaHari || 1) * (r.biayaPerOrang || 0) * totalOrang;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 border-b border-slate-100';
        tr.innerHTML = `
            <td class="p-3">
                <div class="font-bold text-gov-900">${r.noSPPD || '-'}</div>
                <div class="text-[11px] text-slate-500">ST: ${r.noSuratTugas || '-'}</div>
            </td>
            <td class="p-3 font-mono text-[11px]">${r.kodeSK || '-'}</td>
            <td class="p-3 font-semibold uppercase text-slate-800">${r.namaPelaksana || '-'}</td>
            <td class="p-3">
                <div class="font-bold">${r.tempatTujuan || '-'}</div>
                <div class="text-[11px] text-slate-500">${r.tglMulai || '-'} s/d ${r.tglKembali || '-'} (${r.lamaHari || 1} Hari)</div>
            </td>
            <td class="p-3 font-semibold text-emerald-700">Rp ${totalBiaya.toLocaleString('id-ID')}</td>
            <td class="p-3 text-center space-x-1">
                <a href="cetak.html?id=${r.id}" target="_blank" class="px-2.5 py-1 bg-gov-800 hover:bg-gov-900 text-white rounded text-[11px] font-bold transition inline-flex items-center gap-1">
                    <i class="fa-solid fa-print"></i> Cetak
                </a>
                <button type="button" onclick="hapusRiwayatSppd('${r.id}')" class="px-2 py-1 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded text-[11px] font-bold">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function hapusRiwayatSppd(id) {
    if (confirm("Apakah Anda yakin ingin menghapus dokumen SPPD ini?")) {
        if (window.AppDB) {
            await window.AppDB.deleteRecord(id);
            await renderRiwayatTable();
        }
    }
}

// ----------------------------------------------------
// MANAJEMEN MODAL & MASTER ASN
// ----------------------------------------------------
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

function downloadCsvTemplate() {
    const csvContent = "data:text/csv;charset=utf-8," 
        + "NAMA,NIP,JABATAN,PANGKAT\n"
        + "RUDOLF UMBU RESI LOLY,197205212006041008,Camat Tabundung,Penata Tingkat I (III/d)\n"
        + "ARIS MUNANDAR,199001012015021001,Staf Subag Umum,Penata Muda (III/a)";
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "template_master_asn.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function importAsnFromCsv() {
    const fileInput = document.getElementById('csvFileInput');
    if (!fileInput || !fileInput.files.length) {
        alert("Pilih file CSV terlebih dahulu!");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function(e) {
        const text = e.target.result;
        const lines = text.split(/\r\n|\n/);
        if (lines.length < 2) {
            alert("File CSV kosong atau format tidak valid!");
            return;
        }

        const delimiter = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(delimiter).map(h => h.trim().toUpperCase());

        const idxNama = headers.findIndex(h => h.includes('NAMA'));
        const idxNip = headers.findIndex(h => h.includes('NIP'));
        const idxJabatan = headers.findIndex(h => h.includes('JABATAN'));
        const idxPangkat = headers.findIndex(h => h.includes('PANGKAT'));

        if (idxNama === -1 || idxNip === -1) {
            alert("Header CSV harus memiliki minimal kolom 'NAMA' dan 'NIP'!");
            return;
        }

        const newAsnList = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = line.split(delimiter).map(c => c.trim().replace(/^"(.*)"$/, '$1'));
            const nama = cols[idxNama] ? cols[idxNama].toUpperCase() : '';
            const nip = cols[idxNip] ? cols[idxNip].replace(/[^0-9]/g, '') : '';
            const jabatan = idxJabatan !== -1 ? (cols[idxJabatan] || '-') : '-';
            const pangkat = idxPangkat !== -1 ? (cols[idxPangkat] || '-') : '-';

            if (nama && nip) {
                newAsnList.push({ nama, nip, jabatan, pangkat });
            }
        }

        if (newAsnList.length === 0) {
            alert("Tidak ada data ASN valid yang ditemukan dalam berkas CSV.");
            return;
        }

        if (window.AppDB) {
            await window.AppDB.bulkSaveMasterAsn(newAsnList);
            await loadInitialMasterData();
            renderAsnTable();
            fileInput.value = '';
            alert(`Berhasil mengimpor ${newAsnList.length} data ASN!`);
        }
    };

    reader.readAsText(file);
}

async function saveAsnMaster(event) {
    event.preventDefault();
    const nama = document.getElementById('addAsnNama').value.trim().toUpperCase();
    const nip = document.getElementById('addAsnNip').value.trim();
    const jabatan = document.getElementById('addAsnJabatan').value.trim();
    const pangkat = document.getElementById('addAsnPangkat').value.trim();

    if (!nama || !nip) {
        alert("Nama dan NIP wajib diisi!");
        return;
    }

    const asnObj = { nama, nip, jabatan, pangkat };
    if (window.AppDB) {
        await window.AppDB.saveMasterAsn(asnObj);
        await loadInitialMasterData();
        renderAsnTable();
        document.getElementById('formAddAsn').reset();
        alert("Data Pelaksana berhasil disimpan!");
    }
}

function renderAsnTable(filterText = '') {
    const tbody = document.getElementById('asnTableBody');
    const totalCount = document.getElementById('totalAsnCount');
    if (!tbody) return;

    const filtered = currentMasterASN.filter(a => 
        a.nama.toLowerCase().includes(filterText.toLowerCase()) || 
        a.nip.includes(filterText)
    );

    if (totalCount) totalCount.textContent = filtered.length;

    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-400 italic">Belum ada data ASN tersimpan.</td></tr>`;
        return;
    }

    filtered.forEach(asn => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 border-b border-slate-100';
        tr.innerHTML = `
            <td class="p-2.5">
                <div class="font-bold text-slate-800 uppercase">${asn.nama}</div>
                <div class="text-[11px] font-mono text-slate-500">NIP. ${asn.nip}</div>
            </td>
            <td class="p-2.5">
                <div class="font-medium text-slate-700">${asn.jabatan || '-'}</div>
                <div class="text-[11px] text-slate-400">${asn.pangkat || '-'}</div>
            </td>
            <td class="p-2.5 text-center">
                <button type="button" onclick="deleteAsnFromModal('${asn.nip}')" class="text-rose-600 hover:text-rose-800 p-1">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterAsnTable(val) {
    renderAsnTable(val);
}

async function deleteAsnFromModal(nip) {
    if (confirm(`Hapus ASN dengan NIP ${nip}?`)) {
        if (window.AppDB) {
            await window.AppDB.deleteMasterAsn(nip);
            await loadInitialMasterData();
            renderAsnTable();
        }
    }
}

// ----------------------------------------------------
// MANAJEMEN MODAL MASTER SUB KEGIATAN (SK)
// ----------------------------------------------------
function openModalManageSK() {
    const modal = document.getElementById('modalManageSK');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        renderSKTable();
    }
}

function closeModalManageSK() {
    const modal = document.getElementById('modalManageSK');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function openModalSK() {
    document.getElementById('isEditSKMode').value = "false";
    document.getElementById('newKodeSK').value = "";
    document.getElementById('newNamaSK').value = "";
    document.getElementById('newQuotaSK').value = "50";
    document.getElementById('newKodeSK').removeAttribute('readonly');
    
    const modal = document.getElementById('modalSK');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeModalSK() {
    const modal = document.getElementById('modalSK');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function saveNewSK(event) {
    event.preventDefault();
    const kode = document.getElementById('newKodeSK').value.trim();
    const nama = document.getElementById('newNamaSK').value.trim();
    const quota = parseInt(document.getElementById('newQuotaSK').value) || 50;

    if (!kode || !nama) {
        alert("Kode SK dan Nama SK wajib diisi!");
        return;
    }

    if (window.AppDB) {
        await window.AppDB.saveMasterSK({ kode, nama, quota });
        await loadInitialMasterData();
        renderSKTable();
        closeModalSK();
        alert("Sub Kegiatan berhasil disimpan!");
    }
}

function renderSKTable() {
    const tbody = document.getElementById('tableSKBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (currentMasterSK.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 italic">Belum ada Sub Kegiatan tersimpan.</td></tr>`;
        return;
    }

    currentMasterSK.forEach(sk => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 border-b border-slate-100';
        tr.innerHTML = `
            <td class="p-2.5 font-mono font-bold text-slate-700">${sk.kode}</td>
            <td class="p-2.5 text-slate-800 font-medium">${sk.nama}</td>
            <td class="p-2.5 text-center font-bold text-gov-800">${sk.quota || 50}</td>
            <td class="p-2.5 text-center">
                <button type="button" onclick="deleteSKFromModal('${sk.kode}')" class="text-rose-600 hover:text-rose-800 p-1">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function deleteSKFromModal(kode) {
    if (confirm(`Hapus Sub Kegiatan ${kode}?`)) {
        if (window.AppDB) {
            await window.AppDB.deleteMasterSK(kode);
            await loadInitialMasterData();
            renderSKTable();
        }
    }
}
