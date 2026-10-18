(function () {
  const AK = 'kemenham.admin', DK = 'kemenham.db';
  const read = k => { try { return JSON.parse(localStorage.getItem(k)) || null; } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let A = Object.assign({ akun: {}, current: null, seen: '' }, read(AK) || {});
  const save = () => write(AK, A);
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STATUS = ['Terdaftar', 'Karya terkirim', 'Diverifikasi', 'Perlu revisi', 'Ditolak'];
  const WARNA = { 'Terdaftar': '#9db0e8', 'Karya terkirim': '#4f7cff', 'Diverifikasi': '#2dd4a0', 'Perlu revisi': '#facc15', 'Ditolak': '#f87171' };
  const LOMBA = { 'buku-cerita': 'Buku Cerita', 'komik': 'Komik' };
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const fmt = iso => { if (!iso) return '-'; const d = new Date(iso); return d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear(); };
  const me = () => (A.current && A.akun[A.current]) || null;

  // Data contoh dipakai selama belum ada pendaftar di situs
  const CONTOH = [
    ['Alya Putri', 'Universitas Indonesia', 'buku-cerita', 'Karya terkirim'], ['Bima Saputra', 'SMAN 8 Jakarta', 'komik', 'Diverifikasi'],
    ['Citra Lestari', 'Universitas Indonesia', 'buku-cerita', 'Terdaftar'], ['Dimas Pratama', 'SMAN 8 Jakarta', 'komik', 'Perlu revisi'],
    ['Elsa Maharani', 'Universitas Indonesia', 'buku-cerita', 'Karya terkirim'], ['Fajar Nugroho', 'SMAN 8 Jakarta', 'komik', 'Diverifikasi'],
    ['Gita Anjani', 'Universitas Indonesia', 'buku-cerita', 'Ditolak'], ['Hendra Wijaya', 'SMAN 8 Jakarta', 'komik', 'Karya terkirim'],
    ['Intan Permata', 'Universitas Indonesia', 'buku-cerita', 'Diverifikasi'], ['Joko Santoso', 'SMAN 8 Jakarta', 'komik', 'Terdaftar']
  ].map((r, i) => {
    const hari = '2026-10-' + String(3 + i).padStart(2, '0'), kirim = r[3] !== 'Terdaftar';
    return { contoh: true, id: 'c' + i, nama: r[0], asal: r[1], kat: r[2], status: r[3], daftar: hari + 'T09:00:00',
      judul: kirim ? 'Suara dari Jakarta #' + (i + 1) : '', dikirim: kirim ? hari + 'T15:00:00' : '', karya: null };
  });

  function rows() {
    const db = read(DK), out = [];
    if (db && db.users) Object.values(db.users).forEach(u => (u.daftar || []).forEach(d => out.push({
      contoh: false, id: u.profil.email + '|' + d.kategori, email: u.profil.email, nama: d.peserta || u.profil.nama, asal: d.asal || '',
      kat: d.kategori, judul: d.karya ? d.karya.judul : '', dikirim: d.karya ? d.karya.waktu : '', daftar: d.waktu, karya: d.karya || null,
      status: d.tahap === 'terkirim' && d.status === 'Terdaftar' ? 'Karya terkirim' : d.status })));
    return out.length ? { contoh: false, data: out } : { contoh: true, data: CONTOH.map(r => Object.assign({}, r)) };
  }
  function events() {
    const out = [];
    rows().data.forEach(r => {
      out.push({ t: r.daftar, k: 'daftar', teks: r.nama + ' mendaftar di Lomba ' + LOMBA[r.kat] + '.' });
      if (r.dikirim) out.push({ t: r.dikirim, k: 'karya', teks: r.nama + ' mengirim karya “' + r.judul + '”.' });
    });
    return out.sort((a, b) => b.t.localeCompare(a.t));
  }
  const unread = () => events().filter(e => e.t > A.seen).length;
  const PESAN = { 'Diverifikasi': 'sudah diverifikasi panitia.', 'Perlu revisi': 'perlu direvisi. Silakan periksa kembali.', 'Ditolak': 'tidak lolos verifikasi.' };

  // Sinkron antar tab: data peserta berubah (daftar, kirim karya) lalu halaman admin dimuat ulang
  window.addEventListener('storage', e => { if (e.key === DK && !document.querySelector('dialog[open]')) location.reload(); });

  window.AD = {
    STATUS, WARNA, LOMBA, esc, fmt, rows, events, unread, me,
    seen() { A.seen = new Date().toISOString(); save(); },
    signup(nama, email, pw) {
      email = email.trim().toLowerCase();
      if (A.akun[email]) return 'Email ini sudah terdaftar. Silakan masuk.';
      A.akun[email] = { nama: nama.trim(), email, dibuat: new Date().toISOString() }; A.current = email; save(); return '';
    },
    login(email) {
      email = email.trim().toLowerCase();
      if (!A.akun[email]) return 'Akun admin tidak ditemukan. Daftar dulu.';
      A.current = email; save(); return '';
    },
    logout() { A.current = null; save(); },
    ubahNama(n) { me().nama = n.trim(); save(); },
    guard() {
      const nyata = /^(file|https?):$/.test(location.protocol) && /\.html$/.test(location.pathname);
      if (nyata && !me()) location.replace('admin-masuk.html');
    },
    ubahStatus(r, status) {
      r.status = status;
      if (r.contoh) return;                          // data contoh tidak disimpan
      const db = read(DK), u = db.users[r.email], d = u.daftar.find(x => x.kategori === r.kat);
      d.status = status;
      if (PESAN[status]) u.notif.unshift({ id: Date.now(), pesan: 'Karya "' + r.judul + '" ' + PESAN[status], link: 'profil.html#upload', label: 'Lihat status', dibaca: false, waktu: new Date().toISOString() });
      write(DK, db);
    },
    top(aktif) {
      const n = unread(), u = me();
      document.getElementById('top').innerHTML = '<a class="logo" href="admin-dashboard.html"><i></i>Admin Kemenham</a><nav>' +
        [['dashboard', 'Dashboard'], ['notifikasi', 'Notifikasi'], ['profil', 'Profil']].map(([k, t]) =>
          `<a href="admin-${k}.html" class="${k === aktif ? 'on' : ''}">${t}${k === 'notifikasi' && n ? `<b class="bdg">${n > 9 ? '9+' : n}</b>` : ''}</a>`).join('') +
        `</nav><span class="who">${esc(u ? u.nama : 'Tamu')}</span><button class="btn ghost" id="keluar" type="button">Keluar</button>`;
      document.getElementById('keluar').onclick = () => { if (confirm('Keluar dari akun admin?')) { AD.logout(); location.href = 'admin-masuk.html'; } };
    }
  };
})();

AD.guard(); AD.top('profil');
  const u = AD.me() || { nama: 'Tamu', email: '-', dibuat: new Date().toISOString() }, $ = s => document.querySelector(s);
  function isi() { $('#av').textContent = (u.nama.trim()[0] || '?').toUpperCase(); $('#p-nama').textContent = u.nama; $('#p-email').textContent = u.email; $('#p-dibuat').textContent = 'Dibuat ' + AD.fmt(u.dibuat); $('#nama').value = u.nama; }
  isi();
  $('#f').onsubmit = e => {
    e.preventDefault();
    const n = $('#nama').value.trim(), m = $('#msg'); m.hidden = false;
    if (!n) { m.style.color = 'var(--red)'; m.textContent = 'Nama wajib diisi.'; return; }
    if (AD.me()) AD.ubahNama(n); else u.nama = n;
    isi(); AD.top('profil'); m.style.color = ''; m.textContent = 'Perubahan tersimpan.';
  };
