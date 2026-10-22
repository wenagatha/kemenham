/* ===== Slider foto kegiatan ===== */
  const SLIDES = [
    {
      src: '../foo/asse/lomba-serial-komik-ham-portrait.jpg',
      alt: 'Ilustrasi ajakan mengikuti lomba serial komik HAM',
      title: 'LOMBA SERIAL KOMIK HAM',
    },
    {
      src: '../foo/asse/lomba-buku-cerita-ham-portrait.jpg',
      alt: 'Ilustrasi ajakan mengikuti lomba buku cerita HAM',
      title: 'LOMBA BUKU CERITA HAM',
    },
  ];
  const AUTOPLAY = true;   // false = hanya manual
  const INTERVAL = 3500;   // ms

  const track = document.getElementById('track');
  const dotsEl = document.getElementById('dots');
  const caption = document.getElementById('slide-caption');
  const items = SLIDES;
  let index = 0, timer = null;

  items.forEach((item, i) => {
    const s = document.createElement('div');
    s.className = 'slide';
    const image = document.createElement('img');
    image.src = item.src;
    image.alt = item.alt;
    s.appendChild(image);
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
    caption.textContent = items[index].title;
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
    if (matchMedia('(max-width: 760px)').matches) return;
    phones.style.zoom = Math.min(1, pcell.clientWidth / 568);
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
