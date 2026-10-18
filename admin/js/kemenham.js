/* kemenham.js
   Penyimpanan sementara di browser (localStorage) supaya alur situs bisa dicoba tanpa server.
   Saat PHP/MySQL sudah siap, isi fungsi di objek KH diganti dengan panggilan ke server. */
(function () {
  const CFG = {
    WAJIB_LOGIN: true,       // true = halaman selain auth-page.html meminta login dulu
    TAHAP_AWAL: 'terbuka',   // tahap setelah daftar: 'terbuka' (langsung boleh unggah) atau 'menunggu'
    HANYA_SATU_LOMBA: true   // true = setelah daftar satu lomba, lomba lainnya terkunci
  };
  const LOMBA = { 'buku-cerita': 'Lomba Buku Cerita HAM', 'komik': 'Lomba Serial Komik Bergambar' };
  const KEY = 'kemenham.db';

  let db = { users: {}, current: null };
  try { db = Object.assign(db, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = e => String(e || '').trim().toLowerCase();
  const me = () => (db.current && db.users[db.current]) || null;
  const notif = (pesan, link, label) =>
    me().notif.unshift({ id: Date.now(), pesan, link: link || '', label: label || '', dibaca: false, waktu: new Date().toISOString() });

  const KH = window.KH = {
    cfg: CFG, lomba: LOMBA, save, esc, me,

    signup(f) {
      const email = norm(f.email);
      if (db.users[email]) return 'Email ini sudah terdaftar. Silakan masuk.';
      db.users[email] = { daftar: [], notif: [], profil: {
        nama: [f.first_name, f.last_name].filter(Boolean).join(' ').trim(), email,
        telepon: f.phone || '', gender: f.gender || '', tempat: f.birth_place || '', tgl: f.birth_date || '',
        alamat: f.address || '', dibuat: new Date().toISOString().slice(0, 10) } };
      db.current = email; save(); return '';
    },
    login(email) {
      email = norm(email);
      if (!db.users[email]) return 'Akun belum terdaftar. Buat akun dulu.';
      db.current = email; save(); return '';
    },
    logout() { db.current = null; save(); },

    daftar(kat) { const u = me(); return (u && u.daftar.find(d => d.kategori === kat)) || null; },
    tambahDaftar(d) {
      const buka = CFG.TAHAP_AWAL === 'terbuka';
      const rec = Object.assign({}, d, { lomba: LOMBA[d.kategori], status: 'Terdaftar', tahap: CFG.TAHAP_AWAL, waktu: new Date().toISOString() });
      me().daftar.push(rec);
      notif(buka ? `Pendaftaran ${rec.lomba} berhasil. Kamu sudah bisa mengunggah karya.`
                 : `Pendaftaran ${rec.lomba} berhasil. Panitia akan mengirim notifikasi saat pengumpulan karya dibuka.`,
            buka ? 'unggah-' + d.kategori + '.html' : '', 'Unggah karya');
      save(); return rec;
    },
    kirimKarya(kat, info) {
      const d = KH.daftar(kat);
      d.tahap = 'terkirim';
      d.status = 'Karya terkirim';
      d.karya = Object.assign({}, info, { waktu: new Date().toISOString() });
      notif(`Karya "${info.judul}" untuk ${d.lomba} sudah diterima.`, 'profil.html#upload', 'Lihat status');
      save();
    },

    // Mengganti isi kotak (form) dengan pesan + tombol
    tampilkan(el, o) {
      el.innerHTML = `<h3 class="sec">${esc(o.judul)}</h3><p style="color:var(--muted);font-size:14.5px">${esc(o.teks)}</p>` +
        `<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:22px">` +
        (o.tombol || []).map(b => `<a class="btn${b.kuning ? ' yellow' : ''}" href="${esc(b.href)}">${esc(b.label)}</a>`).join('') + `</div>`;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  /* ===== Halaman selain auth-page.html wajib login ===== */
  const page = location.pathname.split('/').pop();
  const nyata = /^(file|https?):$/.test(location.protocol) && /\.html$/.test(page);
  if (nyata && CFG.WAJIB_LOGIN && page !== 'auth-page.html' && !me()) {
    location.replace('auth-page.html?next=' + encodeURIComponent(page + location.hash));
    return;
  }

  /* ===== Gaya untuk badge & panel notifikasi ===== */
  const css = document.createElement('style');
  css.textContent = `
    .kh-badge { min-width:18px; height:18px; padding:0 5px; display:inline-grid; place-items:center; font-size:11px; font-weight:700; color:#14213d; background:#facc15; border:1.5px solid #14213d; border-radius:9px; }
    .kh-badge[hidden] { display:none; }
    .kh-notif { position:absolute; z-index:50; padding:16px; background:#fff; border:2px solid #14213d; border-radius:16px; box-shadow:6px 6px 0 #facc15; font-size:14px; }
    .kh-notif[hidden] { display:none; }
    .kh-notif h4 { margin:0 0 6px; font-size:16px; }
    .kh-n { padding:12px 0 12px 10px; border-top:1.5px dashed #c7d4f5; }
    .kh-n.new { border-left:4px solid #1d4ed8; }
    .kh-n small { display:block; margin-top:2px; font-size:12px; color:#5d6b8a; }
    .kh-n a { display:inline-block; margin-top:8px; padding:6px 12px; font-size:13px; font-weight:700; color:#14213d; background:#facc15; border:1.5px solid #14213d; border-radius:8px; }
    .kh-empty { margin:10px 0 0; color:#5d6b8a; }`;
  document.head.appendChild(css);

  let resync = () => {};
  function pasangNotif(chip) {
    if (!me()) return;
    chip.href = '#';
    const dot = chip.querySelector('.dot'); if (dot) dot.remove();
    const badge = document.createElement('b'); badge.className = 'kh-badge'; chip.appendChild(badge);
    const panel = document.createElement('div'); panel.className = 'kh-notif'; panel.hidden = true; document.body.appendChild(panel);
    const sync = () => { const n = me().notif.filter(x => !x.dibaca).length; badge.textContent = n; badge.hidden = !n; };
    const waktu = iso => new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    resync = sync; sync();
    chip.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if (!panel.hidden) { panel.hidden = true; return; }
      panel.innerHTML = '<h4>Notifikasi</h4>' + (me().notif.length ? me().notif.map(n =>
        `<div class="kh-n${n.dibaca ? '' : ' new'}">${esc(n.pesan)}<small>${waktu(n.waktu)}</small>` +
        (n.link ? `<a href="${esc(n.link)}">${esc(n.label || 'Buka')}</a>` : '') + `</div>`).join('')
        : '<p class="kh-empty">Belum ada notifikasi.</p>');
      const r = chip.getBoundingClientRect(), w = Math.min(340, innerWidth - 24);
      panel.style.width = w + 'px';
      panel.style.top = (r.bottom + scrollY + 10) + 'px';
      panel.style.left = Math.max(12, Math.min(r.right + scrollX - w, innerWidth - w - 12)) + 'px';
      panel.hidden = false;
      me().notif.forEach(n => n.dibaca = true); save(); sync();
    });
    document.addEventListener('click', e => { if (!panel.contains(e.target)) panel.hidden = true; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') panel.hidden = true; });
  }

  // Sinkron antar tab: kalau data berubah di tab lain (mis. admin), badge notifikasi ikut diperbarui
  window.addEventListener('storage', e => {
    if (e.key !== KEY) return;
    try { db = Object.assign({ users: {}, current: null }, JSON.parse(e.newValue) || {}); } catch (err) {}
    resync();
  });

  /* ===== Navbar: logo, Notifikasi, Akun, Log-out ===== */
  document.addEventListener('DOMContentLoaded', () => {
    const brand = document.querySelector('.nav .brand');
    if (brand) {
      if (brand.tagName === 'A') brand.href = 'home.html';
      else { brand.style.cursor = 'pointer'; brand.addEventListener('click', () => { location.href = 'home.html'; }); }
    }
    document.querySelectorAll('.nav .actions .chip').forEach(chip => {
      const t = chip.textContent.trim();
      if (/^Akun/.test(t)) { if (page !== 'profil.html') chip.href = 'profil.html'; }
      else if (/^Log-out/.test(t)) chip.addEventListener('click', e => {
        e.preventDefault();
        if (confirm('Keluar dari akun?')) { KH.logout(); location.href = 'auth-page.html#login'; }
      });
      else if (/^Notifikasi/.test(t)) pasangNotif(chip);
    });
  });
})();
