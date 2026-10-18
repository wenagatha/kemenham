/* ===== Data contoh. Ganti dengan data dari server (PHP/MySQL) ===== */
  const ME = window.KH && KH.me();
  const USER = ME ? ME.profil : { nama:'Tamu', email:'-', telepon:'', gender:'', tempat:'', tgl:'', alamat:'', dibuat:new Date().toISOString().slice(0, 10) };
  const DAFTAR = ME ? ME.daftar : [];
    const HOME_URL = 'home.html'; // ganti dengan alamat beranda, mis. 'home.html' atau '/'
  document.querySelectorAll('[data-home]').forEach(a => a.href = HOME_URL);

  const $ = s => document.querySelector(s);
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tgl = (iso, jam) => {
    const d = new Date(iso); if (isNaN(d)) return '-';
    const t = d.toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
    return jam ? t + ' pukul ' + d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' }) : t;
  };

  /* ===== Tab ===== */
  const TABS = ['info', 'edit', 'upload'];
  function show(t) {
    if (!TABS.includes(t)) t = 'info';
    TABS.forEach(n => {
      $('#p-' + n).hidden = n !== t;
      $('#t-' + n).classList.toggle('on', n === t);
      $('#t-' + n).setAttribute('aria-selected', n === t);
    });
    try { history.replaceState(null, '', '#' + t); } catch (e) {}
  }
  TABS.forEach(n => $('#t-' + n).addEventListener('click', () => show(n)));
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));

  /* ===== Info profil ===== */
  function renderInfo() {
    $('#avatar').textContent = (USER.nama.trim()[0] || '?').toUpperCase();
    $('#i-nama').textContent = USER.nama;
    $('#i-email').textContent = USER.email;
    $('#i-telepon').textContent = USER.telepon || '-';
    $('#i-gender').textContent = USER.gender || '-';
    $('#i-tempat').textContent = USER.tempat || '-';
    $('#i-tgl').textContent = USER.tgl ? tgl(USER.tgl + 'T00:00:00') : '-';
    $('#i-alamat').textContent = USER.alamat || '-';
    $('#i-dibuat').textContent = tgl(USER.dibuat + 'T00:00:00');
  }

  /* ===== Edit profil ===== */
  function isiForm() {
    $('#e-nama').value = USER.nama; $('#e-email').value = USER.email; $('#e-telepon').value = USER.telepon;
    $('#e-tempat').value = USER.tempat; $('#e-tgl').value = USER.tgl; $('#e-alamat').value = USER.alamat;
    document.querySelectorAll('[name=gender]').forEach(r => r.checked = r.value === USER.gender);
  }
  $('#form-edit').addEventListener('submit', async e => {
    e.preventDefault();
    const nama = $('#e-nama').value.trim(), telp = $('#e-telepon').value.trim().replace(/[\s-]/g, '');
    const okNama = !!nama, okTelp = /^(\+62|62|0)8[0-9]{7,12}$/.test(telp);
    $('[data-f=nama]').classList.toggle('invalid', !okNama);
    $('[data-f=telepon]').classList.toggle('invalid', !okTelp);
    const st = $('#st-edit'); st.classList.add('on');
    if (!okNama || !okTelp) { st.textContent = 'Ada isian yang belum benar. Periksa kolom bertanda merah.'; return; }
    try {
      const baru = await KH.simpanProfil({ nama, telepon: $('#e-telepon').value.trim(), tempat: $('#e-tempat').value.trim(),
        tgl: $('#e-tgl').value, alamat: $('#e-alamat').value.trim(),
        gender: (document.querySelector('[name=gender]:checked') || {}).value || '' });
      Object.assign(USER, baru); renderInfo();
      st.textContent = 'Perubahan tersimpan.';
    } catch (error) {
      st.textContent = error.message;
    }
  });

  /* ===== Hasil upload ===== */
  function renderDaftar() {
    const el = $('#daftar');
    if (!DAFTAR.length) {
      el.innerHTML = `<div class="empty">Kamu belum mendaftar lomba apa pun.<br>
        <a class="btn" href="daftar-buku-cerita.html">Daftar Buku Cerita</a><a class="btn blue" style="color:#fff" href="daftar-komik.html">Daftar Komik</a></div>`;
      return;
    }
    el.innerHTML = DAFTAR.map((d, i) => {
      const aksi = d.tahap === 'terkirim'
        ? `<div class="notice">Karya ${d.karya ? '“' + esc(d.karya.judul) + '” ' : ''}sudah diunggah dan tercatat di sistem.</div>`
        : d.tahap === 'terbuka'
          ? `<div class="notice">Pengumpulan karya sudah dibuka.<br><a class="btn" href="unggah-${esc(d.kategori)}.html">Unggah karya →</a></div>`
          : `<div class="notice">Karya belum bisa diunggah. Panitia akan mengirim notifikasi saat pengumpulan karya dibuka.<br><button class="btn" type="button" disabled>Unggah karya →</button></div>`;
      return `<article class="reg">
        <h3>${esc(d.lomba)}</h3>
        <div class="side"><span class="badge">${esc(d.status)}</span>${d.tahap === 'terkirim' ? '' : `<button class="del" type="button" data-i="${i}">Hapus</button>`}</div>
        <div class="meta">Peserta: ${esc(d.peserta)} · ${esc(d.tim)}<br>Asal: ${esc(d.asal)}<br>Mendaftar: ${tgl(d.waktu, true)}</div>
        ${aksi}</article>`;
    }).join('');
  }
  $('#daftar').addEventListener('click', async e => {
    const b = e.target.closest('.del'); if (!b) return;
    if (!confirm('Hapus pendaftaran ini? Kamu perlu mendaftar ulang kalau berubah pikiran.')) return;
    try {
      await KH.hapusDaftar(DAFTAR[+b.dataset.i].id);
      DAFTAR.splice(0, DAFTAR.length, ...KH.me().daftar);
      renderDaftar();
    } catch (error) { alert(error.message); }
  });

  // Tombol Log-out ditangani oleh kemenham.js

  renderInfo(); isiForm(); renderDaftar();
  show(location.hash.slice(1));
