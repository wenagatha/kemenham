/* ===== Slider foto kegiatan ===== */
  const SLIDES = [
    // 'foto-1.jpg',
    // 'foto-2.jpg',
    // 'foto-3.jpg',
    // 'foto-4.jpg',
    // 'foto-5.jpg',
  ];
  const AUTOPLAY = true;   // false = hanya manual
  const INTERVAL = 3500;   // ms

  const track = document.getElementById('track');
  const dotsEl = document.getElementById('dots');
  const items = SLIDES.length ? SLIDES : [null, null, null, null, null];
  let index = 0, timer = null;

  items.forEach((src, i) => {
    const s = document.createElement('div');
    s.className = 'slide' + (src ? '' : ' ph');
    if (src) s.style.backgroundImage = `url("${src}")`;
    else s.innerHTML = `<span>Foto ${i + 1}<br>1080 × 1080 px</span>`;
    track.appendChild(s);

    const d = document.createElement('button');
    d.type = 'button';
    d.setAttribute('aria-label', `Foto ${i + 1}`);
    d.onclick = () => { go(i); restart(); };
    dotsEl.appendChild(d);
  });

  function go(i) {
    index = (i + items.length) % items.length;
    track.style.transform = `translateX(${-index * 100}%)`;
    [...dotsEl.children].forEach((d, k) => d.classList.toggle('on', k === index));
  }
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function start() { if (AUTOPLAY && !still && items.length > 1) timer = setInterval(() => go(index + 1), INTERVAL); }
  function restart() { clearInterval(timer); start(); }

  document.getElementById('prev').onclick = () => { go(index - 1); restart(); };
  document.getElementById('next').onclick = () => { go(index + 1); restart(); };
  const car = document.getElementById('car');
  car.onmouseenter = () => clearInterval(timer);
  car.onmouseleave = start;
  go(0); start();

  /* ===== Skala ponsel mengikuti lebar layar ===== */
  const phones = document.getElementById('phones');
  const pcell = phones.parentElement;
  function fit() {
    phones.style.zoom = 1;
    phones.style.zoom = Math.min(1, pcell.clientWidth / 512);
  }
  let lastW = 0;
  new ResizeObserver(() => {
    const w = pcell.clientWidth;
    if (w === lastW) return;   // hanya bereaksi kalau lebarnya berubah
    lastW = w;
    requestAnimationFrame(fit);
  }).observe(pcell);
  fit();

  /* ===== Tombol lomba mengikuti status pendaftaran ===== */
  function renderStatusLomba() {
    if (!window.KH) return;
    const nama = { 'buku-cerita': 'Buku Cerita', 'komik': 'Komik' };
    const user = KH.me();
    const pilih = user && Object.keys(KH.lomba).find(k => KH.daftar(k));
    document.querySelectorAll('[data-lomba]').forEach(a => {
      const k = a.dataset.lomba, d = KH.daftar(k);
      a.classList.remove('off');
      a.removeAttribute('aria-disabled');
      a.href = 'daftar-' + k + '.html';
      a.textContent = 'Daftar Lomba ' + nama[k];
      if (d) {
        if (d.tahap === 'terkirim') { a.textContent = 'Karya Terkirim'; a.href = 'profil.html#upload'; }
        else if (d.karya) { a.textContent = 'Perbaiki Karya ' + nama[k]; a.href = 'unggah-' + k + '.html'; }
        else { a.textContent = 'Lanjutkan pendaftaran'; a.href = 'daftar-' + k + '.html'; }
      } else if (user && KH.cfg.HANYA_SATU_LOMBA && pilih) {
        a.textContent = 'Kamu sudah memilih lomba lain';
        a.classList.add('off'); a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true');
      }
    });
  }
  if (window.KH) {
    renderStatusLomba();
    window.addEventListener('kemenham:change', renderStatusLomba);
  }
