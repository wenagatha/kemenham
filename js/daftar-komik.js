const DEADLINE = new Date('2026-11-04T23:59:00+07:00');

  const KAT = {
    'buku-cerita': {
      judul: 'Daftar Lomba Buku Cerita HAM',
      nomor: 'NIM', asal: 'Asal perguruan tinggi', status: 'mahasiswa aktif perguruan tinggi',
      nomorHint: 'Untuk peserta kelompok, cukup isi NIM perwakilan.',
      kartu: 'Scan Kartu Tanda Mahasiswa (KTM)',
      aturan: [
        'Peserta: mahasiswa aktif perguruan tinggi di Daerah Khusus Jakarta.',
        'Individu atau kelompok (maksimal 3 orang), 1 karya per peserta.',
        'Buku memuat 10 sampai 20 cerita, tiap cerita 2.000 sampai 3.000 karakter termasuk spasi.',
        'Wajib ada sampul, daftar isi, dan nomor halaman.',
        'Format PDF, ukuran kertas A5.'
      ]
    },
    'komik': {
      judul: 'Daftar Lomba Serial Komik Bergambar',
      nomor: 'NIS', asal: 'Asal sekolah', status: 'pelajar aktif SLTA sederajat',
      nomorHint: 'Untuk peserta kelompok, cukup isi NIS perwakilan.',
      kartu: 'Scan Kartu Pelajar',
      aturan: [
        'Peserta: pelajar aktif SLTA sederajat di Daerah Khusus Jakarta.',
        'Individu atau kelompok (maksimal 3 orang), 1 karya per peserta.',
        'Serial memuat 5 sampai 10 cerita yang berkelanjutan.',
        'Wajib ada sampul dan nomor halaman. Tanpa unsur SARA dan pornografi.',
        'Format PDF, ukuran kertas A5.'
      ]
    }
  };

  const $ = s => document.querySelector(s);
  const form = $('#form');

  const HOME_URL = 'home.html'; // ganti dengan alamat beranda, mis. 'home.html' atau '/'
  document.querySelectorAll('[data-home]').forEach(a => a.href = HOME_URL);
  const kategori = 'komik'; // 'buku-cerita' atau 'komik'
  const c = KAT[kategori];
  let pendaftaranAda = null;
  let kartuTersimpan = false;
  form.kategori.value = kategori;
  document.title = c.judul + ' | Kementerian Hak Asasi Manusia';
  $('#judul-halaman').textContent = c.judul;
  $('#lbl-nomor').textContent = c.nomor;
  $('#lbl-asal').textContent = c.asal;
  $('#hint-nomor').textContent = c.nomorHint;
  $('#lbl-kartu').textContent = c.kartu;
  $('#status-peserta').textContent = c.status;
  $('#aturan').innerHTML = c.aturan.map(t => `<li>${t}</li>`).join('');

  document.querySelectorAll('[name=tim]').forEach(r => r.addEventListener('change', () => {
    $('#members').classList.toggle('on', form.tim.value === 'kelompok');
  }));

  function setErr(field, msg) {
    field.classList.toggle('invalid', !!msg);
    const e = field.querySelector('.err');
    if (msg && msg !== true) e.textContent = msg;
  }

  function validasi() {
    let ok = true, pertama = null;
    const tandai = (field, msg) => { setErr(field, msg); if (msg) { ok = false; pertama = pertama || field; } };
    const teks = n => form[n].value.trim();

    tandai($('[data-f=nama]'), teks('nama') ? '' : true);
    tandai($('[data-f=nomor]'), teks('nomor') ? '' : true);
    tandai($('[data-f=asal]'), teks('asal') ? '' : true);
    tandai($('[data-f=email]'), /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teks('email')) ? '' : true);
    tandai($('[data-f=wa]'), /^(\+62|62|0)8[0-9]{7,12}$/.test(teks('wa').replace(/[\s-]/g, '')) ? '' : true);
    tandai($('[data-f=kartu]'), cekKartu());
    tandai($('[data-f=setuju]'), form.setuju.checked ? '' : true);

    if (pertama) pertama.querySelector('input').focus();
    return ok;
  }

  function cekKartu() {
    const file = form.kartu.files[0];
    if (!file) return kartuTersimpan ? '' : 'Pilih file kartu peserta perwakilan.';
    const ekstensi = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ekstensi)) return 'Format file harus PDF, JPG, atau PNG.';
    if (file.size > 10 * 1024 * 1024) return 'Ukuran file melebihi 10 MB.';
    return '';
  }

  form.kartu.addEventListener('change', () => {
    setErr($('[data-f=kartu]'), form.kartu.files.length ? cekKartu() : '');
    if (!form.kartu.files.length && kartuTersimpan) $('#hint-kartu').textContent = 'Kartu saat ini tetap tersimpan. Pilih file hanya jika ingin menggantinya.';
    else $('#hint-kartu').textContent = 'PDF, JPG, atau PNG, maksimal 10 MB. Kalau berkelompok, cukup kartu perwakilan.';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const st = $('#status');
    st.classList.remove('on');
    if (!validasi()) {
      st.textContent = 'Ada isian yang belum benar. Periksa kolom bertanda merah.';
      st.classList.add('on');
      return;
    }
    if (!pendaftaranAda && new Date() > DEADLINE) {
      st.textContent = 'Pendaftaran sudah ditutup (batas 4 November 2026, 23.59 WIB).';
      st.classList.add('on');
      return;
    }
    if (!window.KH) {
      st.textContent = 'Isian sudah lengkap. Pengiriman ke server belum terhubung.';
      st.classList.add('on');
      return;
    }
    if (!KH.me()) {
      KH.tampilkan(form, {
        judul: 'Masuk untuk mendaftar',
        teks: 'Buat akun atau masuk terlebih dahulu agar pendaftaran dan notifikasi tersimpan pada akunmu.',
        tombol: [{ label: 'Masuk atau daftar', href: 'auth-page.html?next=daftar-komik.html', kuning: true }]
      });
      return;
    }
    const submit = form.querySelector('.submit');
    submit.disabled = true;
    st.textContent = pendaftaranAda ? 'Sedang menyimpan perubahan pendaftaran...' : 'Sedang mengirim pendaftaran dan kartu peserta...';
    st.classList.add('on');
    try {
      const data = new FormData(form);
      data.set('peserta', form.nama.value.trim());
      data.set('tim', form.tim.value === 'kelompok' ? 'Kelompok' : 'Individu');
      await KH.tambahDaftar(data);
      location.href = 'unggah-' + kategori + '.html' + (pendaftaranAda ? '' : '?registered=1');
    } catch (error) {
      st.textContent = error.message;
      st.classList.add('on');
    } finally {
      submit.disabled = false;
    }
  });

  document.querySelectorAll('input').forEach(i => i.addEventListener('input', () => {
    const f = i.closest('.field'); if (f && f.classList.contains('invalid') && i.type !== 'file') setErr(f, '');
  }));

  /* ===== Isi otomatis dari akun, dan blokir kalau sudah terdaftar ===== */
  if (window.KH && KH.me()) {
    const u = KH.me().profil;
    form.nama.value = u.nama; form.email.value = u.email; form.wa.value = u.telepon;
    const sudah = KH.daftar(kategori);
    const lain = Object.keys(KH.lomba).find(k => k !== kategori && KH.daftar(k));
    if (sudah) {
      if (sudah.karya) {
        KH.tampilkan(form, {
          judul: sudah.tahap === 'terkirim' ? 'Karyamu sudah dikirim' : 'Pendaftaran tidak bisa diubah',
          teks: sudah.tahap === 'terkirim'
            ? 'Data pendaftaran sudah dikunci setelah karya dikirim.'
            : 'Karyamu sudah dikirim dan perlu diperbaiki. Data pendaftaran sudah dikunci.',
          tombol: (sudah.tahap === 'terkirim'
            ? [{ label: 'Lihat status di profil', href: 'profil.html#upload', kuning: true }]
            : [{ label: 'Perbaiki karya', href: 'unggah-' + kategori + '.html', kuning: true }])
            .concat([{ label: 'Kembali ke beranda', href: 'home.html' }])
        });
      } else {
        pendaftaranAda = sudah;
        kartuTersimpan = !!sudah.kartu;
        $('#judul-halaman').textContent = 'Periksa atau edit data pendaftaran';
        form.nama.value = sudah.peserta;
        form.tim.value = sudah.tim.toLowerCase();
        form.anggota2.value = sudah.anggota2 || '';
        form.anggota3.value = sudah.anggota3 || '';
        form.nomor.value = sudah.nomor;
        form.asal.value = sudah.asal;
        form.email.value = sudah.email;
        form.wa.value = sudah.wa;
        form.setuju.checked = true;
        $('#members').classList.toggle('on', form.tim.value === 'kelompok');
        $('#hint-kartu').textContent = kartuTersimpan
          ? 'Kartu saat ini sudah tersimpan. Pilih file hanya jika ingin menggantinya.'
          : 'Kartu perwakilan belum tersimpan. PDF, JPG, atau PNG, maksimal 10 MB.';
        form.querySelector('.submit').textContent = 'Simpan perubahan dan lanjutkan';
        const st = $('#status');
        st.textContent = sudah.tahap === 'menunggu'
          ? 'Data pendaftaranmu sudah terisi. Kamu bisa memperbaikinya di bawah ini; pengumpulan karya belum dibuka.'
          : 'Data pendaftaranmu sudah terisi. Perbaiki bagian yang keliru, lalu simpan sebelum mengunggah karya.';
        st.classList.add('on');
      }
    } else if (KH.cfg.HANYA_SATU_LOMBA && lain) {
      KH.tampilkan(form, {
        judul: 'Kamu sudah memilih lomba lain',
        teks: 'Akunmu sudah terdaftar di ' + KH.lomba[lain] + ', jadi lomba ini tidak bisa dipilih lagi.',
        tombol: [{ label: 'Kembali ke beranda', href: 'home.html', kuning: true }]
      });
    }
  }
