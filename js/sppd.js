// EDIT DATA ASN: MENGISI FORM DENGAN DATA ASN YANG DIPILIH
window.editAsn = async function(nip) {
    const asn = await db.asnMaster.get(nip);
    if (!asn) return alert("Data ASN tidak ditemukan!");

    document.getElementById('asnOriginalNip').value = asn.nip;
    document.getElementById('asnNama').value = asn.nama || '';
    document.getElementById('asnNip').value = asn.nip || '';
    document.getElementById('asnPangkat').value = asn.pangkat || '';
    document.getElementById('asnJabatan').value = asn.jabatan || '';

    // Update Tampilan Form ke Mode Edit
    document.getElementById('asnFormTitle').innerText = `Edit Data ASN (${asn.nama})`;
    document.getElementById('btnSaveAsn').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Simpan Perubahan ASN`;
    document.getElementById('btnSaveAsn').className = "w-full py-2 bg-amber-600 text-white font-bold text-xs rounded hover:bg-amber-700 shadow transition cursor-pointer";
    document.getElementById('btnCancelEditAsn').classList.remove('hidden');

    // Scroll otomatis ke posisi form input
    document.getElementById('asnForm').scrollIntoView({ behavior: 'smooth' });
};

// RESET FORM INPUT ASN KE MODE TAMBAH BARU
window.resetAsnForm = function() {
    document.getElementById('asnForm').reset();
    document.getElementById('asnOriginalNip').value = '';
    document.getElementById('asnFormTitle').innerText = "Tambah / Edit Data ASN:";
    document.getElementById('btnSaveAsn').innerHTML = `+ Simpan ASN Baru`;
    document.getElementById('btnSaveAsn').className = "w-full py-2 bg-gov-700 text-white font-bold text-xs rounded hover:bg-gov-800 shadow transition cursor-pointer";
    document.getElementById('btnCancelEditAsn').classList.add('hidden');
};

// SIMPAN ATAU PERBARUI DATA ASN
window.saveAsnMaster = async function(e) {
    e.preventDefault();
    const originalNip = document.getElementById('asnOriginalNip').value.trim();
    const nama = document.getElementById('asnNama').value.trim();
    const nip = document.getElementById('asnNip').value.trim();
    const pangkat = document.getElementById('asnPangkat').value.trim();
    const jabatan = document.getElementById('asnJabatan').value.trim();

    if (!nama || !nip || !jabatan) {
        return alert('Nama, NIP, dan Jabatan wajib diisi!');
    }

    // Jika NIP diubah pada mode edit, hapus data record lama berdasar NIP lama
    if (originalNip && originalNip !== nip) {
        await db.asnMaster.delete(originalNip);
    }

    await db.asnMaster.put({ nama, nip, pangkat, jabatan });
    
    resetAsnForm();
    await loadAsnCache();
    renderAsnList();
    populateSelectOptions();
    
    alert(`Data ASN (${nama}) berhasil disimpan!`);
};

// RENDER LIST MASTER ASN DENGAN TOMBOL EDIT
async function renderAsnList() {
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
                <p class="text-slate-700">No. ST: <span class="font-mono font-bold">${lastRecord.noSuratTugas}</span></p>
                <p class="text-slate-700">No. SPPD: <span class="font-mono font-bold">${lastRecord.noSPPD || '-'}</span></p>
               </div>` 
            : `<p class="text-[10px] text-slate-400 italic mt-0.5">Belum ada riwayat penugasan</p>`;

        return `
            <div class="py-3 flex justify-between items-start text-xs border-b border-slate-100">
                <div class="flex-1 pr-2">
                    <p class="font-bold text-slate-800 text-sm">${a.nama}</p>
                    <p class="text-slate-600 font-mono">NIP. ${a.nip}</p>
                    <p class="text-slate-500 font-semibold">${a.jabatan} ${a.pangkat ? '('+a.pangkat+')' : ''}</p>
                    ${docInfo}
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    <button type="button" onclick="editAsn('${a.nip}')" class="text-amber-600 hover:text-amber-800 font-bold text-xs p-1 cursor-pointer" title="Edit ASN Ini">
                        <i class="fa-solid fa-pen-to-square"></i> Edit
                    </button>
                    <button type="button" onclick="deleteAsn('${a.nip}')" class="text-rose-600 hover:text-rose-800 font-bold text-xs p-1 cursor-pointer" title="Hapus ASN">
                        <i class="fa-solid fa-trash"></i> Hapus
                    </button>
                </div>
            </div>
        `;
    }).join('');
}
