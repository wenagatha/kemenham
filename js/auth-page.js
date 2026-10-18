const card = document.getElementById('card');
  const title = document.getElementById('title');
  const pw = document.getElementById('pw');

  function setMode(mode) {
    card.dataset.mode = mode;
    title.textContent = mode === 'signup' ? 'Buat akun' : 'Selamat datang';
    pw.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    document.title = mode === 'signup' ? 'Daftar' : 'Masuk';
    // field khusus signup hanya wajib diisi saat mode daftar
    document.querySelectorAll('[name=gender], [name=birth_date]').forEach(el => el.required = mode === 'signup');
  }
  setMode(location.hash === '#login' ? 'login' : 'signup');
  document.querySelectorAll('[data-go]').forEach(b =>
    b.addEventListener('click', () => setMode(b.dataset.go)));
  // buka halaman login langsung: auth-page.html#login

  document.getElementById('eye').addEventListener('click', () => {
    pw.type = pw.type === 'password' ? 'text' : 'password';
  });


  /* ================= PENGATURAN SLIDER GAMBAR ================= */
  const SLIDES = [
    // 'gambar-1.jpg',
    // 'gambar-2.jpg',
    // 'gambar-3.jpg',
  ];
  const AUTOPLAY = true;   // false = hanya manual
  const INTERVAL = 4000;   // jeda geser otomatis (ms)

  const hero = document.getElementById('hero');
  const track = document.getElementById('track');
  const dotsEl = document.getElementById('dots');
  const items = SLIDES.length ? SLIDES : [null, null, null];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0, timer = null, startX = null, dx = 0;

  items.forEach((src, i) => {
    const slide = document.createElement('div');
    slide.className = 'slide' + (src ? '' : ' ph');
    if (src) slide.style.backgroundImage = `url("${src}")`;
    else slide.innerHTML = `<span>Gambar ${i + 1}<br>Isi di <code>SLIDES</code></span>`;
    track.appendChild(slide);

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Gambar ${i + 1}`);
    dot.addEventListener('click', () => { go(i); restart(); });
    dotsEl.appendChild(dot);
  });
  if (items.length < 2) hero.classList.add('single');

  function go(i) {
    index = (i + items.length) % items.length;
    track.style.transform = `translateX(${-index * 100}%)`;
    [...dotsEl.children].forEach((d, k) => d.classList.toggle('on', k === index));
  }
  function start() { if (AUTOPLAY && items.length > 1 && !reduceMotion) timer = setInterval(() => go(index + 1), INTERVAL); }
  function stop() { clearInterval(timer); }
  function restart() { stop(); start(); }

  document.getElementById('prev').addEventListener('click', () => { go(index - 1); restart(); });
  document.getElementById('next').addEventListener('click', () => { go(index + 1); restart(); });
  hero.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { go(index - 1); restart(); }
    if (e.key === 'ArrowRight') { go(index + 1); restart(); }
  });
  hero.addEventListener('mouseenter', stop);
  hero.addEventListener('mouseleave', start);

  // Geser manual (drag mouse / swipe jari)
  hero.addEventListener('pointerdown', e => {
    if (e.target.closest('button, a')) return;
    startX = e.clientX; dx = 0;
    track.style.transition = 'none';
    hero.setPointerCapture(e.pointerId);
    stop();
  });
  hero.addEventListener('pointermove', e => {
    if (startX === null) return;
    dx = e.clientX - startX;
    track.style.transform = `translateX(calc(${-index * 100}% + ${dx}px))`;
  });
  function endDrag() {
    if (startX === null) return;
    track.style.transition = '';
    const limit = hero.offsetWidth * 0.15;
    go(dx < -limit ? index + 1 : dx > limit ? index - 1 : index);
    startX = null; dx = 0;
    restart();
  }
  hero.addEventListener('pointerup', endDrag);
  hero.addEventListener('pointercancel', endDrag);

  go(0);
  start();


  /* ===== Masuk / daftar: dikirim ke php/api/auth.php lewat kemenham.js ===== */
  if (window.KH) {
    const next = new URLSearchParams(location.search).get('next') || '';
    const tujuan = /^[\w()%.\- ]+\.html(#\w+)?$/.test(next) ? next : 'home.html';
    const errEl = document.getElementById('auth-err');
    document.getElementById('auth-form').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target, v = n => f[n].value.trim();
      const salah = m => { errEl.textContent = m; errEl.hidden = false; };
      errEl.hidden = true;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) return salah('Masukkan alamat email yang valid.');
      if (!f.password.value) return salah('Kata sandi wajib diisi.');
      if (card.dataset.mode === 'signup' && f.password.value.length < 8) return salah('Kata sandi minimal 8 karakter.');
      let pesan;
      if (card.dataset.mode === 'signup') {
        if (!v('first_name')) return salah('Nama depan wajib diisi.');
        if (!f.gender.value || !f.birth_date.value) return salah('Lengkapi jenis kelamin dan tanggal lahir.');
        pesan = await KH.signup({ password: f.password.value, first_name: v('first_name'), last_name: v('last_name'), email: v('email'), phone: v('phone'),
          gender: f.gender.value, birth_place: v('birth_place'), birth_date: f.birth_date.value, address: v('address') });
      } else {
        pesan = await KH.login(v('email'), f.password.value);
      }
      if (pesan) return salah(pesan);
      const target = new URL(tujuan, location.href);
      target.searchParams.set('auth-event', card.dataset.mode);
      location.href = target.href;
    });
  }
