const KAT = {
    'buku-cerita': {
      judul: 'Unggah Karya Buku Cerita HAM',
      kartu: 'Scan Kartu Tanda Mahasiswa (KTM)', word: true,
      aturan: [
        'Buku memuat 10 sampai 20 cerita, tiap cerita 2.000 sampai 3.000 karakter termasuk spasi.',
        'Wajib ada sampul, daftar isi, dan nomor halaman.',
        'Format PDF, ukuran kertas A5.'
      ]
    },
    'komik': {
      judul: 'Unggah Karya Serial Komik Bergambar',
      kartu: 'Scan Kartu Pelajar', word: false,
      aturan: [
        'Serial memuat 5 sampai 10 cerita yang berkelanjutan.',
        'Wajib ada sampul dan nomor halaman. Tanpa unsur SARA dan pornografi.',
        'Format PDF, ukuran kertas A5.'
      ]
    }
  };

  const PROFIL_URL = 'profil.html';
  const TEMPLATE_URL = '#'; // ganti dengan alamat file template lembar pernyataan keaslian
  const PEDOMAN_URL = '#';  // ganti dengan alamat file pedoman lengkap
  const kategori = 'buku-cerita'; // 'buku-cerita' atau 'komik'

  const $ = s => document.querySelector(s);
  const form = $('#form');
  const c = KAT[kategori];

  form.kategori.value = kategori;
  document.title = c.judul + ' | Kementerian Hak Asasi Manusia';
  $('#judul-halaman').textContent = c.judul;
  $('#lbl-kartu').textContent = c.kartu;
  $('#aturan').innerHTML = c.aturan.map(t => `<li>${t}</li>`).join('');
  $('#f-word').hidden = !c.word;
  $('[data-template]').href = TEMPLATE_URL;
  $('[data-pedoman]').href = PEDOMAN_URL;
  document.querySelectorAll('.actions a[href="profil.html"]').forEach(a => a.href = PROFIL_URL);

  const MB = 1024 * 1024;
  const FILE = {
    pdf:        { ext: ['pdf'], max: 100, label: 'PDF', kosong: 'Pilih file PDF karyamu.' },
    word:       { ext: ['doc', 'docx'], max: 100, label: 'DOC atau DOCX', kosong: 'Pilih file Word karyamu.' },
    kartu:      { ext: ['pdf', 'jpg', 'jpeg', 'png'], max: 10, label: 'PDF, JPG, atau PNG', kosong: 'Pilih file scan kartumu.' },
    pernyataan: { ext: ['pdf', 'jpg', 'jpeg', 'png'], max: 10, label: 'PDF, JPG, atau PNG', kosong: 'Pilih file lembar pernyataan yang sudah ditandatangani.' }
  };

  function cekFile(nama) {
    const r = FILE[nama], f = form[nama].files[0];
    if (!f) return r.kosong;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!r.ext.includes(ext)) return `Format file harus ${r.label}.`;
    if (f.size > r.max * MB) return `Ukuran file melebihi ${r.max} MB.`;
    return '';
  }

  function setErr(field, msg) {
    field.classList.toggle('invalid', !!msg);
    const e = field.querySelector('.err');
    if (msg && msg !== true) e.textContent = msg;
  }

  function validasi() {
    let ok = true, pertama = null;
    const tandai = (field, msg) => { setErr(field, msg); if (msg) { ok = false; pertama = pertama || field; } };

    tandai($('[data-f=judul]'), form.judul.value.trim() ? '' : true);
    Object.keys(FILE).forEach(n => {
      if (n === 'word' && !c.word) return;
      tandai($(`[data-f=${n}]`), cekFile(n));
    });
    tandai($('[data-f=setuju]'), form.setuju.checked ? '' : true);

    if (pertama) pertama.querySelector('input').focus();
    return ok;
  }

  // Cek format dan ukuran begitu file dipilih
  Object.keys(FILE).forEach(n => form[n].addEventListener('change', () => {
    setErr($(`[data-f=${n}]`), form[n].files.length ? cekFile(n) : '');
  }));

  document.querySelectorAll('input').forEach(i => i.addEventListener('input', () => {
    const f = i.closest('.field'); if (f && f.classList.contains('invalid') && i.type !== 'file') setErr(f, '');
  }));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const st = $('#status');
    const submit = form.querySelector('[type=submit]');
    st.classList.remove('on');
    if (!validasi()) {
      st.textContent = 'Ada isian yang belum benar. Periksa kolom bertanda merah.';
      st.classList.add('on');
      return;
    }
    if (!window.KH) {
      st.textContent = 'Isian sudah lengkap. Pengiriman ke server belum terhubung.';
      st.classList.add('on');
      return;
    }
    submit.disabled = true;
    st.textContent = 'Sedang mengunggah karya dan dokumen pendukung...';
    st.classList.add('on');
    try {
      await KH.kirimKarya(kategori, new FormData(form));
      KH.tampilkan(form, {
        judul: 'Karya berhasil diunggah',
        teks: 'Terima kasih! Karyamu sudah tersimpan dan tercatat. Notifikasi konfirmasi sudah dikirim ke akunmu.',
        tombol: [{ label: 'Lihat di profil', href: 'profil.html#upload', kuning: true }, { label: 'Kembali ke beranda', href: 'home.html' }]
      });
    } catch (error) {
      st.textContent = error.message;
      st.classList.add('on');
    } finally {
      submit.disabled = false;
    }
  });

  /* ===== Halaman ini hanya untuk peserta yang sudah mendaftar ===== */
  if (window.KH && KH.me()) {
    const dft = KH.daftar(kategori);
    if (!dft) {
      KH.tampilkan(form, { judul: 'Kamu belum terdaftar', teks: 'Daftar lomba ini dulu, setelah itu kamu bisa mengunggah karya.',
        tombol: [{ label: 'Daftar lomba', href: 'daftar-' + kategori + '.html', kuning: true }, { label: 'Kembali ke beranda', href: 'home.html' }] });
    } else if (dft.tahap === 'menunggu') {
      KH.tampilkan(form, { judul: 'Pengumpulan karya belum dibuka', teks: 'Panitia akan mengirim notifikasi saat pengumpulan karya dibuka.',
        tombol: [{ label: 'Kembali ke beranda', href: 'home.html', kuning: true }] });
    } else if (dft.tahap === 'terkirim') {
      KH.tampilkan(form, { judul: 'Karyamu sudah terkirim', teks: 'Judul karya: ' + (dft.karya ? dft.karya.judul : '-') + '.',
        tombol: [{ label: 'Lihat di profil', href: 'profil.html#upload', kuning: true }, { label: 'Kembali ke beranda', href: 'home.html' }] });
    }
  } else if (window.KH) {
    KH.tampilkan(form, {
      judul: 'Masuk untuk mengunggah karya',
      teks: 'Masuk dengan akun yang digunakan untuk mendaftar lomba terlebih dahulu.',
      tombol: [{ label: 'Masuk atau daftar', href: 'auth-page.html?next=unggah-buku-cerita.html', kuning: true }, { label: 'Kembali ke beranda', href: 'home.html' }]
    });
  }
  if (window.KH && KH.me() && new URLSearchParams(location.search).has('registered')) {
    const st = $('#status');
    st.textContent = 'Pendaftaran berhasil! Notifikasi sudah masuk. Kamu bisa mengunggah karya sekarang atau kembali ke beranda dan melanjutkannya nanti.';
    st.classList.add('on');
  }
