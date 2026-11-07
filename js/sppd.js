/* ====================================================================================
 * Nama Modul  : Modul Master Pelaksana & SPPD - Kecamatan Tabundung
 * Deskripsi   : Integrasi Form Input, Import CSV, dan Sinkronisasi Tabel master_pelaksana
 * Skema Tabel : master_pelaksana (id, nama_pelaksana, nip, jabatan, created_at)
 * ==================================================================================== */

// Event listener saat dokumen HTML selesai dimuat
document.addEventListener('DOMContentLoaded', function() {
    loadAsnMasterData();
});

/**
 * HELPER FORMATTER: Golongan / Pangkat
 * Mengubah string pangkat menjadi format: Pembina (IV.a) / Penata Muda (III.a)
 * Teks = Kapital, Romawi = UPPERCASE, Huruf setelah titik (.) = lowercase
 */
function formatPangkatGolongan(text) {
    if (!text) return '';
    
    // Normalisasi spasi ekstra
    let str = text.trim();

    // 1. Kapitalisasi kata non-golongan (seperti Pembina, Penata, Pembina Utama Muda)
    str = str.replace(/\b[a-zA-Z]+\b/g, function(txt) {
        // Jangan ubah jika merupakan bagian romawi yang berdiri sendiri
        if (/^(i|v|x|l|c|d|m)+$/i.test(txt)) return txt;
        return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
    });

    // 2. Format pola Golongan/Ruang dalam kurung atau teks bebas, misal: (iv/a), iv.a, III/B, IV.A
    // Memastikan Romawi huruf besar, titik/garis miring, lalu huruf ruang menjadi huruf kecil
    str = str.replace(/\b(I{1,3}|IV|V|VI{0,3}|IX|X|XI{0,3})\s*[\./\s]\s*([a-eA-E])\b/gi, function(match, romawi, ruang) {
        return romawi.toUpperCase() + '.' + ruang.toLowerCase();
    });

    return str;
}

/**
 * 1. FUNGSI SIMPAN PELAKSANA MANUALLY
 * Menyimpan data dari modal form manual ke Supabase
 */
async function saveAsnMaster(event) {
    event.preventDefault();

    const namaInput = document.getElementById('addAsnNama').value.trim();
    const nipInput = document.getElementById('addAsnNip').value.trim();
    const jabatanInput = document.getElementById('addAsnJabatan').value.trim();
    const pangkatEl = document.getElementById('addAsnPangkat');
    const pangkatInput = pangkatEl ? pangkatEl.value.trim() : '';

    if (!namaInput || !nipInput || !jabatanInput) {
        alert('Mohon lengkapi Nama, NIP, dan Jabatan!');
        return;
    }

    // Nama Pelaksana: HURUF KAPITAL
    const namaKapital = namaInput.toUpperCase();
    
    // Format Pangkat jika diisi (misal: Pembina IV.a)
    const pangkatFormatted = formatPangkatGolongan(pangkatInput);

    // Payload SESUAI HEADER SUPABASE (id - nama_pelaksana - nip - jabatan - created_at)
    const payload = {
        nama_pelaksana: namaKapital,
        nip: nipInput,
        jabatan: jabatanInput
    };

    try {
        const { data, error } = await supabaseClient
            .from('master_pelaksana')
            .insert([payload])
            .select();

        if (error) throw error;

        alert('Data pelaksana berhasil disimpan!');
        document.getElementById('formAddAsn').reset();
        
        // Refresh tabel & dropdown pelaksana
        await loadAsnMasterData();
    } catch (err) {
        console.error('Gagal menyimpan data pelaksana:', err);
        alert('Gagal menyimpan data pelaksana: ' + (err.message || err.error_description || 'Terjadi kesalahan pada Supabase'));
    }
}

/**
 * 2. FUNGSI IMPORT DATA PELAKSANA DARI FILE CSV
 * Parsing CSV 4 Kolom: nama - nip - pangkat - jabatan
 */
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

            // Split kolom berdasarkan Koma (,) atau Titik Koma (;)
            const cols = trimmedLine.split(/[,;]/).map(c => c.trim().replace(/^"(.*)"$/, '$1'));

            // Abaikan baris header
            if (index === 0 && (cols[0].toLowerCase().includes('nama') || cols[1].toLowerCase().includes('nip'))) {
                return;
            }

            if (cols.length >= 2) {
                // 1. Nama: HURUF KAPITAL ALL
                const nama = cols[0] ? cols[0].toUpperCase() : '';
                const nip = cols[1] || '';
                
                // 2. Pangkat / Golongan: Format Khusus (misal: Pembina IV.a)
                const rawPangkat = cols[2] || '';
                const pangkatFormatted = formatPangkatGolongan(rawPangkat);

                // 3. Jabatan
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
            const { data, error } = await supabaseClient
                .from('master_pelaksana')
                .insert(dataToInsert)
                .select();

            if (error) throw error;

            alert(`Berhasil mengimpor ${dataToInsert.length} data pelaksana ke Supabase!`);
            fileInput.value = '';
            
            // Refresh tabel & dropdown pelaksana
            await loadAsnMasterData();
        } catch (err) {
            console.error('Error saat import CSV:', err);
            alert('Gagal mengimpor CSV: ' + (err.message || 'Format data/koneksi bermasalah.'));
        }
    };

    reader.readAsText(file);
}

/**
 * 3. LOAD DATA MASTER PELAKSANA (FETCH FROM SUPABASE & POPULATE UI)
 */
async function loadAsnMasterData() {
    try {
        const { data: pelaksanaList, error } = await supabaseClient
            .from('master_pelaksana')
            .select('*')
            .order('nama_pelaksana', { ascending: true });

        if (error) throw error;

        // Render ke Tabel Modal Master ASN
        renderAsnTable(pelaksanaList || []);

        // Render ke Dropdown Select Pelaksana Utama & Bendahara di Form SPPD
        populateAsnDropdowns(pelaksanaList || []);

    } catch (err) {
        console.error('Gagal mengambil data master pelaksana:', err);
    }
}

/**
 * Render data ke tabel modal #asnTableBody
 */
function renderAsnTable(data) {
    const tbody = document.getElementById('asnTableBody');
    const totalCountEl = document.getElementById('totalAsnCount');

    if (totalCountEl) totalCountEl.textContent = data.length;
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="p-4 text-center text-slate-400 italic">Belum ada data pelaksana tersimpan.</td>
            </tr>`;
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
                <button type="button" onclick="deleteAsnMaster('${item.id}')" class="text-rose-600 hover:text-rose-800 p-1 font-bold" title="Hapus Pelaksana">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Mengisi Select Dropdown (#namaPelaksana & #selectBendahara)
 */
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

/**
 * Listener ketika opsi dropdown Pelaksana/Bendahara dipilih
 */
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

/**
 * 4. FUNGSI HAPUS PELAKSANA DARI SUPABASE
 */
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

/**
 * 5. FUNGSI FILTER SEARCH TABLE MODAL ASN
 */
function filterAsnTable(keyword) {
    const filter = keyword.toUpperCase();
    const rows = document.querySelectorAll('#asnTableBody tr');

    rows.forEach(row => {
        const text = row.textContent || row.innerText;
        row.style.display = text.toUpperCase().includes(filter) ? '' : 'none';
    });
}

/**
 * 6. HELPER UNDUH TEMPLATE CSV
 */
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

/**
 * HELPER MODAL ASN UTILITY
 */
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

/**
 * HELPER ESCAPE HTML (Mencegah XSS)
 */
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
