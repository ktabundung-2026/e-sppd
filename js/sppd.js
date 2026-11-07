/* ====================================================================================
 * Nama Modul  : Modul Master Pelaksana & SPPD - Kecamatan Tabundung
 * Deskripsi   : Integrasi Form SPPD, Stepper Navigation, Master SK, dan Master Pelaksana
 * Skema Tabel Supabase: 
 *  - master_pelaksana : id - nama_pelaksana - nip - jabatan - created_at
 *  - master_sk        : id - kode - nama - quota - created_at
 * ==================================================================================== */

// Global state untuk menyimpan data lokal
let currentSKList = [];
let currentAsnList = [];

// Event listener saat dokumen HTML selesai dimuat
document.addEventListener('DOMContentLoaded', async function() {
    await loadMasterSKData();
    await loadAsnMasterData();
});

/* ====================================================================================
 * 1. STEPPER NAVIGATION & FORM FLOW (STEP 1, 2, 3)
 * ==================================================================================== */

function switchStep(stepNumber) {
    // Sembunyikan semua step content
    document.getElementById('step-content-1')?.classList.add('hidden');
    document.getElementById('step-content-2')?.classList.add('hidden');
    document.getElementById('step-content-3')?.classList.add('hidden');

    // Reset gaya indikator tombol stepper
    [1, 2, 3].forEach(i => {
        const icon = document.getElementById(`step-icon-${i}`);
        const label = document.getElementById(`step-label-${i}`);
        if (icon && label) {
            if (i === stepNumber) {
                icon.className = "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-gov-700 text-white shadow-md transition-all";
                label.className = "text-xs font-bold text-gov-800 mt-1";
            } else {
                icon.className = "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-slate-200 text-slate-600 transition-all";
                label.className = "text-xs font-medium text-slate-500 mt-1";
            }
        }
    });

    // Tampilkan step content yang aktif
    const activeStepContent = document.getElementById(`step-content-${stepNumber}`);
    if (activeStepContent) {
        activeStepContent.classList.remove('hidden');
    }
}

function proceedToStep2() {
    const kodeSK = document.getElementById('step1_kodeSK')?.value;
    const desa = document.getElementById('step1_selectDesa')?.value.trim();

    if (!kodeSK) {
        alert('Silakan pilih Kode Sub Kegiatan (SK) terlebih dahulu!');
        return;
    }
    if (!desa) {
        alert('Silakan isi Lokasi Perjalanan Dinas!');
        return;
    }

    // Lanjut ke Step 2
    switchStep(2);
}

function syncTujuanPerdin(val) {
    const tempatTujuanInput = document.getElementById('tempatTujuan');
    if (tempatTujuanInput) {
        tempatTujuanInput.value = val ? val.toUpperCase() : '';
    }
}

/* ====================================================================================
 * 2. KELOLA MASTER SUB KEGIATAN (master_sk: id - kode - nama - quota)
 * ==================================================================================== */

async function loadMasterSKData() {
    try {
        const { data: skList, error } = await supabaseClient
            .from('master_sk')
            .select('*')
            .order('kode', { ascending: true });

        if (error) throw error;

        currentSKList = skList || [];
        renderSKDropdown(currentSKList);
        renderSKTable(currentSKList);

    } catch (err) {
        console.warn('Gagal memuat master_sk dari Supabase:', err.message);
    }
}

function renderSKDropdown(data) {
    const selectSK = document.getElementById('step1_kodeSK');
    if (!selectSK) return;

    selectSK.innerHTML = '<option value="">Pilih Sub Kegiatan</option>' +
        data.map(item => `<option value="${escapeHtml(item.kode)}">${escapeHtml(item.kode)} - ${escapeHtml(item.nama)}</option>`).join('');
}

function renderSKTable(data) {
    const tbody = document.getElementById('tableSKBody');
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 italic">Belum ada Sub Kegiatan tersimpan.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(item => `
        <tr class="hover:bg-slate-50 border-b border-slate-100">
            <td class="p-2.5 font-mono font-bold text-gov-800">${escapeHtml(item.kode)}</td>
            <td class="p-2.5 font-medium text-slate-700">${escapeHtml(item.nama)}</td>
            <td class="p-2.5 text-center font-bold text-slate-800">${item.quota || 0} OH</td>
            <td class="p-2.5 text-center">
                <button type="button" onclick="deleteSKMaster('${item.id}')" class="text-rose-600 hover:text-rose-800 font-bold p-1" title="Hapus SK">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function saveNewSK(event) {
    event.preventDefault();
    const kodeVal = document.getElementById('newKodeSK').value.trim();
    const namaVal = document.getElementById('newNamaSK').value.trim();
    const quotaVal = parseInt(document.getElementById('newQuotaSK').value) || 0;

    if (!kodeVal || !namaVal) {
        alert('Kode SK dan Nama SK wajib diisi!');
        return;
    }

    // Payload SESUAI HEADER SUPABASE: id - kode - nama - quota - created_at
    const payload = {
        kode: kodeVal,
        nama: namaVal,
        quota: quotaVal
    };

    try {
        const { data, error } = await supabaseClient
            .from('master_sk')
            .insert([payload]);

        if (error) throw error;

        alert('Sub Kegiatan berhasil disimpan!');
        closeModalSK();
        
        // Reset input modal SK
        document.getElementById('newKodeSK').value = '';
        document.getElementById('newNamaSK').value = '';
        document.getElementById('newQuotaSK').value = '50';

        await loadMasterSKData();
    } catch (err) {
        console.error('Gagal menyimpan SK:', err);
        alert('Gagal menyimpan Sub Kegiatan: ' + (err.message || 'Error Supabase'));
    }
}

async function deleteSKMaster(id) {
    if (!confirm('Apakah Anda yakin menghapus Sub Kegiatan ini?')) return;
    try {
        const { error } = await supabaseClient
            .from('master_sk')
            .delete()
            .eq('id', id);

        if (error) throw error;
        await loadMasterSKData();
    } catch (err) {
        alert('Gagal menghapus Sub Kegiatan: ' + err.message);
    }
}

function openModalManageSK() {
    const modal = document.getElementById('modalManageSK');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
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

function updateSKQuotaInfo() {
    calculateTotalBiaya();
}

/* ====================================================================================
 * 3. KELOLA MASTER PELAKSANA ASN (master_pelaksana: id - nama_pelaksana - nip - jabatan)
 * ==================================================================================== */

function formatPangkatGolongan(text) {
    if (!text) return '';
    let str = text.trim();

    // 1. Teks Gelar/Pangkat utama menjadi Kapital di awal kata
    str = str.replace(/\b[a-zA-Z]+\b/g, function(txt) {
        if (/^(i|v|x|l|c|d|m)+$/i.test(txt)) return txt;
        return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
    });

    // 2. Format Golongan/Ruang: Romawi = UPPERCASE, huruf setelah titik (.) = lowercase
    str = str.replace(/\b(I{1,3}|IV|V|VI{0,3}|IX|X|XI{0,3})\s*[\./\s]\s*([a-eA-E])\b/gi, function(match, romawi, ruang) {
        return romawi.toUpperCase() + '.' + ruang.toLowerCase();
    });

    return str;
}

async function saveAsnMaster(event) {
    event.preventDefault();

    const namaInput = document.getElementById('addAsnNama').value.trim();
    const nipInput = document.getElementById('addAsnNip').value.trim();
    const jabatanInput = document.getElementById('addAsnJabatan').value.trim();

    if (!namaInput || !nipInput || !jabatanInput) {
        alert('Mohon lengkapi Nama, NIP, dan Jabatan!');
        return;
    }

    // Nama Pelaksana: HURUF KAPITAL ALL
    const namaKapital = namaInput.toUpperCase();

    // Payload SESUAI HEADER SUPABASE: id - nama_pelaksana - nip - jabatan - created_at
    const payload = {
        nama_pelaksana: namaKapital,
        nip: nipInput,
        jabatan: jabatanInput
    };

    try {
        const { data, error } = await supabaseClient
            .from('master_pelaksana')
            .insert([payload]);

        if (error) throw error;

        alert('Data pelaksana berhasil disimpan!');
        document.getElementById('formAddAsn').reset();
        await loadAsnMasterData();
    } catch (err) {
        console.error('Gagal menyimpan data pelaksana:', err);
        alert('Gagal menyimpan data pelaksana: ' + (err.message || 'Error Supabase'));
    }
}

async function importAsnFromCsv() {
    const fileInput = document.getElementById('csvFileInput');
    const file = fileInput ? fileInput.files[0] : null;

    if (!file) {
        alert('Silakan pilih file CSV terlebih dahulu.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const lines = text.split(/\r\n|\n/);
        const dataToInsert = [];

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return;

            const cols = trimmedLine.split(/[,;]/).map(c => c.trim().replace(/^"(.*)"$/, '$1'));

            if (index === 0 && (cols[0].toLowerCase().includes('nama') || cols[1].toLowerCase().includes('nip'))) {
                return;
            }

            if (cols.length >= 2) {
                const nama = cols[0] ? cols[0].toUpperCase() : '';
                const nip = cols[1] || '';
                const jabatan = cols[3] || cols[2] || '-'; 

                if (nama && nip) {
                    dataToInsert.push({
                        nama_pelaksana: nama,
                        nip: nip,
                        jabatan: jabatan
                    });
                }
            }
        });

        if (dataToInsert.length === 0) {
            alert('Tidak ada baris data valid yang dapat diproses dari CSV.');
            return;
        }

        try {
            const { error } = await supabaseClient
                .from('master_pelaksana')
                .insert(dataToInsert);

            if (error) throw error;

            alert(`Berhasil mengimpor ${dataToInsert.length} data pelaksana ke Supabase!`);
            fileInput.value = '';
            await loadAsnMasterData();
        } catch (err) {
            console.error('Error saat import CSV:', err);
            alert('Gagal mengimpor CSV: ' + err.message);
        }
    };

    reader.readAsText(file);
}

async function loadAsnMasterData() {
    try {
        const { data: pelaksanaList, error } = await supabaseClient
            .from('master_pelaksana')
            .select('*')
            .order('nama_pelaksana', { ascending: true });

        if (error) throw error;

        currentAsnList = pelaksanaList || [];
        renderAsnTable(currentAsnList);
        populateAsnDropdowns(currentAsnList);

    } catch (err) {
        console.error('Gagal mengambil data master pelaksana:', err);
    }
}

function renderAsnTable(data) {
    const tbody = document.getElementById('asnTableBody');
    const totalCountEl = document.getElementById('totalAsnCount');

    if (totalCountEl) totalCountEl.textContent = data.length;
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-400 italic">Belum ada data pelaksana tersimpan.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(item => `
        <tr class="hover:bg-slate-50 border-b border-slate-100">
            <td class="p-2.5">
                <div class="font-bold text-slate-800 uppercase">${escapeHtml(item.nama_pelaksana)}</div>
                <div class="text-[11px] font-mono text-slate-500">NIP. ${escapeHtml(item.nip || '-')}</div>
            </td>
            <td class="p-2.5 text-slate-600 font-medium">${escapeHtml(item.jabatan || '-')}</td>
            <td class="p-2.5 text-center">
                <button type="button" onclick="deleteAsnMaster('${item.id}')" class="text-rose-600 hover:text-rose-800 p-1 font-bold">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function populateAsnDropdowns(data) {
    const selectPelaksana = document.getElementById('namaPelaksana');
    const selectBendahara = document.getElementById('selectBendahara');

    if (selectPelaksana) {
        selectPelaksana.innerHTML = '<option value="">-- PILIH PELAKSANA UTAMA --</option>' +
            data.map(item => `<option value="${escapeHtml(item.nama_pelaksana)}" data-nip="${escapeHtml(item.nip)}" data-jabatan="${escapeHtml(item.jabatan)}">${escapeHtml(item.nama_pelaksana)}</option>`).join('');
    }

    if (selectBendahara) {
        selectBendahara.innerHTML = '<option value="">-- PILIH BENDAHARA PENGELUARAN --</option>' +
            data.map(item => `<option value="${escapeHtml(item.nama_pelaksana)}" data-nip="${escapeHtml(item.nip)}">${escapeHtml(item.nama_pelaksana)}</option>`).join('');
    }
}

function onNamaInputChanged(type, selectedNama) {
    if (type === 'Pelaksana') {
        const select = document.getElementById('namaPelaksana');
        const selectedOption = select.options[select.selectedIndex];
        
        document.getElementById('nipPelaksana').value = selectedOption ? (selectedOption.getAttribute('data-nip') || '') : '';
        document.getElementById('jabatanPelaksana').value = selectedOption ? (selectedOption.getAttribute('data-jabatan') || '') : '';
    }
}

function onBendaharaSelected(selectedNama) {
    const select = document.getElementById('selectBendahara');
    const selectedOption = select.options[select.selectedIndex];
    document.getElementById('nipBendahara').value = selectedOption ? (selectedOption.getAttribute('data-nip') || '') : '';
}

async function deleteAsnMaster(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus pelaksana ini?')) return;

    try {
        const { error } = await supabaseClient
            .from('master_pelaksana')
            .delete()
            .eq('id', id);

        if (error) throw error;
        await loadAsnMasterData();
    } catch (err) {
        alert('Gagal menghapus data: ' + err.message);
    }
}

function filterAsnTable(keyword) {
    const filter = keyword.toUpperCase();
    const rows = document.querySelectorAll('#asnTableBody tr');

    rows.forEach(row => {
        const text = row.textContent || row.innerText;
        row.style.display = text.toUpperCase().includes(filter) ? '' : 'none';
    });
}

function openModalAsn() {
    const modal = document.getElementById('modalAsn');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeModalAsn() {
    const modal = document.getElementById('modalAsn');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

/* ====================================================================================
 * 4. LOGIKA PERHITUNGAN BIAYA & MANAJEMEN PENGIKUT
 * ==================================================================================== */

function calculateLamaHariFromDates() {
    const tglMulai = document.getElementById('tglMulai')?.value;
    const tglKembali = document.getElementById('tglKembali')?.value;
    const lamaHariEl = document.getElementById('lamaHari');

    if (tglMulai && tglKembali && lamaHariEl) {
        const d1 = new Date(tglMulai);
        const d2 = new Date(tglKembali);
        const diffTime = d2.getTime() - d1.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24)) + 1;

        if (diffDays > 0) {
            lamaHariEl.value = diffDays;
        } else {
            lamaHariEl.value = 1;
        }
    }
    calculateTotalBiaya();
}

function calculateTotalBiaya() {
    const lamaHari = parseInt(document.getElementById('lamaHari')?.value) || 1;
    const biayaPerOrang = parseInt(document.getElementById('biayaPerOrang')?.value) || 0;
    
    // Total orang = 1 Pelaksana Utama + Jumlah Row Pengikut
    const pengikutContainer = document.getElementById('pengikutContainer');
    const jumlahPengikut = pengikutContainer ? pengikutContainer.children.length : 0;
    const totalOrang = 1 + jumlahPengikut;

    const total = lamaHari * biayaPerOrang * totalOrang;

    const totalBiayaEl = document.getElementById('totalBiayaFormatted');
    const terbilangEl = document.getElementById('terbilang');

    if (totalBiayaEl) {
        totalBiayaEl.value = 'Rp ' + total.toLocaleString('id-ID');
    }
    if (terbilangEl) {
        terbilangEl.value = total > 0 ? terbilangAngka(total) + ' Rupiah' : '';
    }
}

function addPengikutRow() {
    const container = document.getElementById('pengikutContainer');
    if (!container) return;

    const rowId = 'pengikut_' + Date.now();
    const div = document.createElement('div');
    div.id = rowId;
    div.className = "grid grid-cols-1 md:grid-cols-3 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 items-center";

    let optionsHtml = '<option value="">-- Pilih Pengikut --</option>';
    currentAsnList.forEach(item => {
        optionsHtml += `<option value="${escapeHtml(item.nama_pelaksana)}">${escapeHtml(item.nama_pelaksana)}</option>`;
    });

    div.innerHTML = `
        <div>
            <select onchange="onPengikutSelected('${rowId}', this.value)" class="w-full p-2 text-xs border rounded bg-white uppercase-input">
                ${optionsHtml}
            </select>
        </div>
        <div>
            <input type="text" id="${rowId}_nip" placeholder="NIP Pengikut" readonly class="w-full p-2 text-xs border rounded font-mono bg-slate-100">
        </div>
        <div class="flex items-center gap-2">
            <input type="text" id="${rowId}_jabatan" placeholder="Jabatan Pengikut" readonly class="w-full p-2 text-xs border rounded bg-slate-100">
            <button type="button" onclick="removePengikutRow('${rowId}')" class="text-rose-600 hover:text-rose-800 p-1 font-bold">
                <i class="fa-solid fa-circle-xmark"></i>
            </button>
        </div>
    `;

    container.appendChild(div);
    calculateTotalBiaya();
}

function onPengikutSelected(rowId, selectedNama) {
    const asn = currentAsnList.find(a => a.nama_pelaksana === selectedNama);
    const nipEl = document.getElementById(`${rowId}_nip`);
    const jabatanEl = document.getElementById(`${rowId}_jabatan`);

    if (nipEl) nipEl.value = asn ? asn.nip : '';
    if (jabatanEl) jabatanEl.value = asn ? asn.jabatan : '';
}

function removePengikutRow(rowId) {
    const el = document.getElementById(rowId);
    if (el) el.remove();
    calculateTotalBiaya();
}

/* ====================================================================================
 * 5. SUBMIT FORM SPPD
 * ==================================================================================== */

async function handleFormSubmit(event) {
    event.preventDefault();
    
    // Objek rekap data yang siap disimpan / dicetak
    const formData = {
        kode_sk: document.getElementById('step1_kodeSK')?.value || '',
        sumber_dana: document.getElementById('sumberDana')?.value || '',
        no_surat_tugas: document.getElementById('noSuratTugas')?.value || '',
        no_sppd: document.getElementById('noSPPD')?.value || '',
        maksud_tujuan: document.getElementById('maksudTujuan')?.value || '',
        nama_pelaksana: document.getElementById('namaPelaksana')?.value || '',
        nip_pelaksana: document.getElementById('nipPelaksana')?.value || '',
        jabatan_pelaksana: document.getElementById('jabatanPelaksana')?.value || '',
        tempat_berangkat: document.getElementById('tempatBerangkat')?.value || '',
        tempat_tujuan: document.getElementById('tempatTujuan')?.value || '',
        tempat_tujuan_2: document.getElementById('tempatTujuan2')?.value || '',
        tempat_tujuan_3: document.getElementById('tempatTujuan3')?.value || '',
        tgl_mulai: document.getElementById('tglMulai')?.value || '',
        tgl_kembali: document.getElementById('tglKembali')?.value || '',
        lama_hari: document.getElementById('lamaHari')?.value || 1,
        biaya_per_orang: document.getElementById('biayaPerOrang')?.value || 0,
        alat_angkut: document.getElementById('alatAngkut')?.value || '',
        tingkat_perdin: document.getElementById('tingkatPerdin')?.value || '',
        laporan_hasil: document.getElementById('laporanHasil')?.value || '',
        nama_pejabat_tujuan: document.getElementById('namaPejabatTujuan')?.value || '',
        jabatan_pejabat_tujuan: document.getElementById('jabatanPejabatTujuan')?.value || ''
    };

    alert('Dokumen SPPD Berhasil Disimpan!');
    switchStep(3);
}

/* ====================================================================================
 * HELPER UTILITY FUNCTIONS
 * ==================================================================================== */

function downloadCsvTemplate() {
    const csvContent = "data:text/csv;charset=utf-8,NAMA,NIP,PANGKAT,JABATAN\nPETRUS REMI;198501012010011001;Penata Muda III.a;Staf Umum\nMARIA GORETI;199002022015022002;Pembina IV.a;Kepala Seksi";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "template_master_pelaksana.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function terbilangAngka(angka) {
    const bil = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
    if (angka < 12) return bil[angka];
    else if (angka < 20) return terbilangAngka(angka - 10) + " Belas";
    else if (angka < 100) return terbilangAngka(Math.floor(angka / 10)) + " Puluh " + terbilangAngka(angka % 10);
    else if (angka < 200) return "Seratus " + terbilangAngka(angka - 100);
    else if (angka < 1000) return terbilangAngka(Math.floor(angka / 100)) + " Ratus " + terbilangAngka(angka % 100);
    else if (angka < 2000) return "Seribu " + terbilangAngka(angka - 1000);
    else if (angka < 1000000) return terbilangAngka(Math.floor(angka / 1000)) + " Ribu " + terbilangAngka(angka % 1000);
    else if (angka < 1000000000) return terbilangAngka(Math.floor(angka / 1000000)) + " Juta " + terbilangAngka(angka % 1000000);
    return "";
}
