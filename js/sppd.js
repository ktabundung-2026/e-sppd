// KALKULASI DURASI / LAMA PERJALANAN DINAS (HARI INKLUSIF)
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

// KALKULASI TOTAL BIAYA (LAMA PERDIN x JUMLAH PERSONIL x TARIF PER ORANG/OH)
window.calculateTotalBudget = function() {
    const satuan = parseFloat(document.getElementById('biayaPerOrang')?.value) || 0;
    const totalPengikut = document.querySelectorAll('#pengikutContainer > div').length;
    const totalPersonil = 1 + totalPengikut; // 1 Utama + Pengikut
    const lamaPerdin = calculateLamaPerdin();
    
    const total = satuan * totalPersonil * lamaPerdin;
    
    const formatted = document.getElementById('totalBiayaFormatted');
    const inputTerbilang = document.getElementById('terbilang');
    
    if (formatted) formatted.value = 'Rp ' + total.toLocaleString('id-ID');
    if (inputTerbilang && typeof numberToWords === 'function') {
        inputTerbilang.value = numberToWords(total) + ' Rupiah';
    }
    return total;
};

// HANDLER EVENT PERUBAHAN TANGGAL ATAU BIAYA
window.onDateOrBudgetChanged = function() {
    calculateLamaPerdin();
    calculateTotalBudget();
    window.updateSKQuotaInfo();
};

// SINKRONISASI TEMPAT TUJUAN DARI STEP 1 KE STEP 2
window.syncTujuanPerdin = function(val) {
    const tempatTujuan = document.getElementById('tempatTujuan');
    if (tempatTujuan) {
        tempatTujuan.value = val || '';
    }
};

window.proceedToStep2 = async function() {
    const namaPelaksana = document.getElementById('namaPelaksana')?.value;
    if (!namaPelaksana) return alert("Pilih Pelaksana Utama terlebih dahulu!");

    // Otomatis Ambil Tempat Tujuan dari Step 1 ke Step 2
    const desaTujuanStep1 = document.getElementById('step1_selectDesa')?.value;
    syncTujuanPerdin(desaTujuanStep1);

    const quotaInfo = await window.updateSKQuotaInfo();

    if (quotaInfo.requiredOH > quotaInfo.remainingOH) {
        alert(`Penugasan ditolak! Kuota Perdin untuk SK (${document.getElementById('step1_kodeSK').value}) tidak mencukupi.\n\n` +
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
        if (nama) pengikutList.push({ nama, nip });
    });

    const record = {
        noSuratTugas: document.getElementById('noSuratTugas').value,
        noSPPD: document.getElementById('noSPPD').value,
        kodeSubKegiatan: document.getElementById('step1_kodeSK').value,
        sumberDana: document.getElementById('step1_sumberDana')?.value || 'DAU',
        tempatBerangkat: document.getElementById('tempatBerangkat').value,
        tempatTujuan: document.getElementById('tempatTujuan').value,
        alatAngkutan: document.getElementById('alatAngkutan').value,
        tglMulai: document.getElementById('tglMulai').value,
        tglSelesai: document.getElementById('tglSelesai').value,
        lamaHari: calculateLamaPerdin(),
        maksudTujuan: document.getElementById('maksudTujuan').value,
        laporanHasil: document.getElementById('laporanHasil').value, // DI SIMPAN KE INDEXEDDB
        namaPelaksana: document.getElementById('namaPelaksana').value,
        nipPelaksana: document.getElementById('nipPelaksana').value,
        biayaPerOrang: parseFloat(document.getElementById('biayaPerOrang').value) || 0,
        totalBiaya: calculateTotalBudget(),
        pengikut: pengikutList,
        createdAt: new Date().toISOString()
    };

    const id = await db.records.add(record);
    sessionStorage.setItem('sppd_print_current', JSON.stringify({ ...record, id }));
    alert('SPPD Berhasil Disimpan! Membuka Halaman Cetak...');
    
    await loadLocalRecords();
    openCetakPage(id);
};
