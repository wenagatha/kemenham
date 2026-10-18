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

AD.guard(); AD.top('dashboard');
  const $ = s => document.querySelector(s), esc = AD.esc;
  const R = AD.rows(), D = R.data;
  $('#note').hidden = !R.contoh;

  function kpis() {
    const n = s => D.filter(r => r.status === s).length;
    $('#kpis').innerHTML = [['Total pendaftar', D.length, ''], ['Karya masuk', D.filter(r => r.status !== 'Terdaftar').length, ''],
      ['Perlu ditinjau', n('Karya terkirim'), 'color:var(--yellow)'], ['Sudah diverifikasi', n('Diverifikasi'), '']]
      .map(([t, v, s]) => `<div class="card kpi"><small>${t}</small><b style="${s}">${v}</b></div>`).join('');
  }
  function donut() {
    const C = 2 * Math.PI * 56, tot = D.length || 1; let off = 0;
    const segs = AD.STATUS.map(s => {
      const n = D.filter(r => r.status === s).length, len = n / tot * C;
      const el = n ? `<circle cx="80" cy="80" r="56" fill="none" stroke="${AD.WARNA[s]}" stroke-width="26" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"/>` : '';
      off += len; return el;
    }).join('');
    $('#c-donut').innerHTML = `<svg viewBox="0 0 160 160" style="width:min(100%,190px);display:block;margin:0 auto"><circle cx="80" cy="80" r="56" fill="none" stroke="#1b2446" stroke-width="26"/>${segs}</svg>` +
      `<div class="legend">${AD.STATUS.map(s => `<span><i style="background:${AD.WARNA[s]}"></i>${s}</span>`).join('')}</div>`;
  }
  function sumbu(top, step, W, L, y) {
    let s = '';
    for (let v = 0; v <= top; v += step) s += `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="#232c47"/><text x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
    return s;
  }
  function bars() {
    const g = Object.keys(AD.LOMBA).map(k => [AD.LOMBA[k], D.filter(r => r.kat === k).length, D.filter(r => r.kat === k && r.status !== 'Terdaftar').length]);
    const max = Math.max(5, ...g.flatMap(x => [x[1], x[2]])), step = Math.ceil(max / 5), top = step * Math.ceil(max / step);
    const W = 300, H = 190, L = 28, ph = H - 34, y = v => 10 + ph - v / top * ph, gw = (W - L) / g.length;
    let s = sumbu(top, step, W, L, y);
    g.forEach((x, i) => {
      const cx = L + gw * i + gw / 2;
      s += `<rect x="${cx - 32}" y="${y(x[1])}" width="30" height="${y(0) - y(x[1])}" rx="3" fill="#4f7cff"/><rect x="${cx + 2}" y="${y(x[2])}" width="30" height="${y(0) - y(x[2])}" rx="3" fill="#facc15"/><text x="${cx}" y="${H - 6}" text-anchor="middle">${x[0]}</text>`;
    });
    $('#c-bar').innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%">${s}</svg><div class="legend"><span><i style="background:#4f7cff"></i>Pendaftar</span><span><i style="background:#facc15"></i>Karya masuk</span></div>`;
  }
  function garis() {
    const hari = {}; D.forEach(r => { const k = r.daftar.slice(0, 10); hari[k] = (hari[k] || 0) + 1; });
    const keys = Object.keys(hari).sort();
    if (!keys.length) { $('#c-line').innerHTML = '<p class="empty">Belum ada data.</p>'; return; }
    const days = [];
    for (let d = new Date(keys[0]), end = new Date(keys[keys.length - 1]); d <= end && days.length < 14; d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
    const vals = days.map(k => hari[k] || 0), max = Math.max(1, ...vals), step = Math.ceil(max / 5), top = step * Math.ceil(max / step);
    const W = 300, H = 190, L = 24, ph = H - 62, x = i => L + (days.length > 1 ? i / (days.length - 1) * (W - L - 8) : 0), y = v => 10 + ph - v / top * ph;
    const s = sumbu(top, step, W, L, y) + `<polyline fill="none" stroke="#facc15" stroke-width="2" points="${vals.map((v, i) => x(i) + ',' + y(v)).join(' ')}"/>` +
      vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="#facc15"/>`).join('') +
      days.map((k, i) => `<text transform="translate(${x(i) + 3} ${y(0) + 14}) rotate(-40)" text-anchor="end">${k}</text>`).join('');
    $('#c-line').innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%">${s}</svg>`;
  }

  AD.STATUS.forEach(s => $('#fs').insertAdjacentHTML('beforeend', `<option>${s}</option>`));
  function tabel() {
    const q = $('#q').value.trim().toLowerCase(), fl = $('#fl').value, st = $('#fs').value;
    const list = D.filter(r => (!fl || r.kat === fl) && (!st || r.status === st) && (!q || (r.nama + ' ' + r.asal + ' ' + r.judul).toLowerCase().includes(q)));
    $('#tb').innerHTML = list.map(r => `<tr><td><b>${esc(r.nama)}</b><small>${esc(r.asal)}</small></td><td>${AD.LOMBA[r.kat]}</td>` +
      `<td>${r.judul ? esc(r.judul) : '<span class="mut">Belum mengirim</span>'}</td><td>${AD.fmt(r.dikirim)}</td>` +
      `<td><span class="badge" style="--c:${AD.WARNA[r.status]}">${r.status}</span></td><td><button class="btn ghost" data-id="${esc(r.id)}">Tinjau</button></td></tr>`).join('');
    $('#kosong').hidden = !!list.length;
  }
  ['#q', '#fl', '#fs'].forEach(s => $(s).addEventListener('input', tabel));

  let cur = null;
  $('#tb').onclick = e => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    cur = D.find(r => r.id === b.dataset.id);
    const k = cur.karya, kirim = cur.status !== 'Terdaftar';
    $('#d-judul').textContent = cur.nama;
    $('#d-info').innerHTML = [['Asal', cur.asal], ['Lomba', AD.LOMBA[cur.kat]], ['Judul karya', cur.judul || 'Belum mengirim'], ['Dikirim', AD.fmt(cur.dikirim)],
      ['Berkas', k ? [k.pdf, k.word, k.kartu, k.pernyataan].filter(Boolean).join(', ') : (kirim ? '(contoh)' : '-')]]
      .map(([a, c]) => `<div><dt>${a}</dt><dd>${esc(c)}</dd></div>`).join('');
    const sel = $('#d-status');
    sel.innerHTML = AD.STATUS.filter(s => kirim ? s !== 'Terdaftar' : s === 'Terdaftar').map(s => `<option${s === cur.status ? ' selected' : ''}>${s}</option>`).join('');
    sel.disabled = $('#d-simpan').disabled = !kirim;
    $('#dlg').showModal();
  };
  $('#d-tutup').onclick = () => $('#dlg').close();
  $('#d-simpan').onclick = () => { AD.ubahStatus(cur, $('#d-status').value); $('#dlg').close(); kpis(); donut(); bars(); tabel(); };
  kpis(); donut(); bars(); garis(); tabel();
