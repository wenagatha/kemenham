(function () {
  'use strict';

  // Alamat API PHP, relatif terhadap folder html/
  const API = '../php/api/';
  const LOMBA = {
    'buku-cerita': 'Buku Cerita',
    komik: 'Komik'
  };
  const cfg = { HANYA_SATU_LOMBA: true };
  let pageNotificationShown = false;

  // Data akun sekarang berasal dari server (session PHP), bukan localStorage.
  // Dimuat sekali saat halaman dibuka dengan request sinkron supaya KH.me() langsung siap dipakai.
  let state = { user: muat() };

  function muat() {
    try {
      const x = new XMLHttpRequest();
      x.open('GET', API + 'auth.php?aksi=saya', false);
      x.withCredentials = true;
      x.send();
      const j = JSON.parse(x.responseText);
      return j.ok ? j.data : null;
    } catch (error) {
      console.warn('Gagal memuat akun dari server. Pastikan Apache dan MySQL menyala, dan halaman dibuka lewat http://localhost/.', error);
      return null;
    }
  }

  async function kirim(url, body) {
    let res;
    try {
      res = await fetch(API + url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
        body: body instanceof FormData ? body : JSON.stringify(body || {})
      });
    } catch (error) {
      throw new Error('Tidak bisa terhubung ke server. Pastikan Apache dan MySQL di XAMPP sudah menyala.');
    }
    let json;
    try { json = await res.json(); } catch (error) {
      throw new Error('Respons server tidak valid. Cek log error Apache/PHP.');
    }
    if (!json.ok) throw new Error(json.pesan || 'Terjadi kesalahan.');
    return json.data;
  }

  function notify() {
    window.dispatchEvent(new CustomEvent('kemenham:change'));
  }

  function safe(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function showToast(message) {
    ensureNotificationPanel();
    let toast = document.getElementById('kh-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'kh-toast';
      toast.className = 'kh-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('on');
    clearTimeout(toast.dismissTimer);
    toast.dismissTimer = setTimeout(() => toast.classList.remove('on'), 5000);
  }

  function showPageNotification() {
    if (pageNotificationShown) return;
    pageNotificationShown = true;
    const params = new URLSearchParams(location.search);
    const authEvent = params.get('auth-event');
    const user = me();
    if (authEvent && user) {
      const nama = user.profil.nama.split(/\s+/)[0] || 'Peserta';
      showToast(authEvent === 'signup'
        ? 'Akun berhasil dibuat. Selamat datang, ' + nama + '!'
        : 'Selamat datang kembali, ' + nama + '!');
      params.delete('auth-event');
      const query = params.toString();
      history.replaceState(null, '', location.pathname + (query ? '?' + query : '') + location.hash);
      return;
    }
    if (params.has('registered') && user) {
      const category = location.pathname.includes('buku-cerita') ? 'buku-cerita' : 'komik';
      const entry = daftar(category);
      if (entry) showToast('Pendaftaran lomba ' + entry.lomba + ' berhasil. Kamu bisa melanjutkan dengan mengunggah karya.');
    }
  }

  function ensureNotificationPanel() {
    let panel = document.getElementById('kh-notification-panel');
    if (panel) return panel;
    if (!document.getElementById('kh-notification-style')) {
      const style = document.createElement('style');
      style.id = 'kh-notification-style';
      style.textContent = `
        .chip .dot { display:inline-block; width:8px; height:8px; margin-left:2px; border-radius:50%; background:#dc2626; }
        .kh-notification-panel { position:fixed; z-index:1000; top:76px; right:max(16px,calc((100vw - 1120px)/2)); width:min(360px,calc(100vw - 32px)); max-height:min(460px,calc(100vh - 96px)); overflow:hidden; display:none; flex-direction:column; color:#14213d; background:#fff; border:1px solid #c7d4f5; border-radius:14px; box-shadow:0 16px 40px #14213d30; }
        .kh-notification-panel.on { display:flex; }
        .kh-notification-head { display:flex; justify-content:space-between; align-items:center; padding:14px 16px; border-bottom:1px solid #e5eaf5; }
        .kh-notification-head h2 { margin:0; font-size:16px; }
        .kh-notification-head button,.kh-notification-read { border:0; background:transparent; color:#1d4ed8; font:inherit; cursor:pointer; }
        .kh-notification-list { overflow:auto; padding:6px 12px; }
        .kh-notification-item { padding:11px 4px; border-bottom:1px solid #edf0f7; }
        .kh-notification-item:last-child { border-bottom:0; }
        .kh-notification-item.unread { border-left:3px solid #1d4ed8; padding-left:9px; }
        .kh-notification-item p { margin:0; font-size:13px; line-height:1.45; }
        .kh-notification-item time { display:block; margin-top:5px; color:#5d6b8a; font-size:11px; }
        .kh-notification-empty { padding:20px 8px; color:#5d6b8a; text-align:center; font-size:13px; }
        .kh-notification-foot { padding:10px 16px; border-top:1px solid #e5eaf5; text-align:right; }
        .kh-notification-read { font-size:12px; font-weight:700; }
        .kh-toast { position:fixed; z-index:1100; right:20px; bottom:20px; max-width:min(420px,calc(100vw - 40px)); padding:14px 18px; color:#fff; background:#14213d; border:1px solid #1d4ed8; border-radius:12px; box-shadow:0 10px 28px #14213d30; opacity:0; transform:translateY(8px); pointer-events:none; transition:opacity .18s ease,transform .18s ease; }
        .kh-toast.on { opacity:1; transform:translateY(0); }
        @media(prefers-reduced-motion:reduce) { .kh-toast { transition:none; } }
      `;
      document.head.appendChild(style);
    }
    panel = document.createElement('div');
    panel.id = 'kh-notification-panel';
    panel.className = 'kh-notification-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Notifikasi');
    document.body.appendChild(panel);
    panel.addEventListener('click', event => {
      if (event.target.closest('[data-close-notifications]')) {
        panel.classList.remove('on');
        document.querySelectorAll('.chip').forEach(link => {
          if (link.querySelector('span')?.textContent.trim() === 'Notifikasi') link.setAttribute('aria-expanded', 'false');
        });
      } else if (event.target.closest('[data-mark-notifications-read]')) {
        tandaiNotifikasiDibaca().catch(error => showToast(error.message));
      }
    });
    document.addEventListener('click', event => {
      if (panel.classList.contains('on') && !panel.contains(event.target) && !event.target.closest('[data-notifications-trigger]')) {
        panel.classList.remove('on');
        document.querySelectorAll('[data-notifications-trigger]').forEach(link => link.setAttribute('aria-expanded', 'false'));
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && panel.classList.contains('on')) {
        panel.classList.remove('on');
        document.querySelectorAll('[data-notifications-trigger]').forEach(link => link.setAttribute('aria-expanded', 'false'));
      }
    });
    return panel;
  }

  function renderNotificationPanel() {
    const panel = ensureNotificationPanel();
    const notifications = getNotifications();
    const unread = notifications.filter(item => !item.dibaca).length;
    const entries = notifications.length
      ? notifications.map(item => {
          const time = item.waktu ? new Date(item.waktu) : null;
          const waktu = time && !Number.isNaN(time.getTime())
            ? time.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
            : '';
          return '<article class="kh-notification-item' + (item.dibaca ? '' : ' unread') + '">' +
            '<p>' + safe(item.pesan) + '</p>' +
            (waktu ? '<time>' + safe(waktu) + '</time>' : '') + '</article>';
        }).join('')
      : '<div class="kh-notification-empty">' + (me() ? 'Belum ada notifikasi.' : 'Masuk untuk menyimpan dan melihat notifikasi akunmu.') + '</div>';
    panel.innerHTML = '<header class="kh-notification-head"><h2>Notifikasi</h2>' +
      '<button type="button" data-close-notifications aria-label="Tutup notifikasi">Tutup</button></header>' +
      '<div class="kh-notification-list">' + entries + '</div>' +
      (unread ? '<div class="kh-notification-foot"><button type="button" class="kh-notification-read" data-mark-notifications-read>Tandai semua dibaca</button></div>' : '');
  }

  function me() {
    return state.user;
  }

  async function signup(data) {
    try {
      await kirim('auth.php?aksi=daftar', data);
      return '';
    } catch (error) { return error.message; }
  }

  async function login(email, password) {
    try {
      state.user = await kirim('auth.php?aksi=masuk', { email, password });
      notify();
      return '';
    } catch (error) { return error.message; }
  }

  async function logout() {
    try { await kirim('auth.php?aksi=keluar'); } finally {
      state.user = null;
      notify();
    }
  }

  async function simpanProfil(data) {
    state.user = await kirim('profil.php', data);
    notify();
    return state.user.profil;
  }

  function daftar(category) {
    const user = me();
    return user ? user.daftar.find(item => item.kategori === category) || null : null;
  }

  async function tambahDaftar(data) {
    if (!me()) throw new Error('Masuk ke akun terlebih dahulu sebelum mendaftar lomba.');
    state.user = await kirim('pendaftaran.php?aksi=simpan', data);
    notify();
    return daftar(data.kategori);
  }

  async function hapusDaftar(id) {
    state.user = await kirim('pendaftaran.php?aksi=hapus', { id });
    notify();
  }

  async function kirimKarya(category, formData) {
    formData.set('kategori', category);
    let response;
    try {
      response = await fetch(API + 'karya.php', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData
      });
    } catch (error) {
      throw new Error('Tidak bisa terhubung ke server. Pastikan Apache dan MySQL di XAMPP sudah menyala.');
    }
    let json;
    try { json = await response.json(); } catch (error) {
      throw new Error('Respons server tidak valid. Cek log error Apache/PHP.');
    }
    if (!json.ok) throw new Error(json.pesan || 'Karya gagal dikirim.');
    state.user = json.data;
    notify();
    const latest = getNotifications()[0];
    if (latest) showToast(latest.pesan);
    return daftar(category);
  }

  async function tandaiNotifikasiDibaca() {
    state.user = await kirim('notifikasi.php?aksi=baca-semua');
    notify();
    renderNotificationPanel();
  }

  function tampilkan(form, options) {
    const safe = value => String(value || '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
    const buttons = (options.tombol || []).map(button =>
      '<a class="btn' + (button.kuning ? ' yellow' : '') + '" href="' + safe(button.href) + '">' + safe(button.label) + '</a>'
    ).join(' ');

    form.innerHTML = '<section class="status on" role="status"><h2>' + safe(options.judul) +
      '</h2><p>' + safe(options.teks) + '</p><div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:18px">' +
      buttons + '</div></section>';
  }

  function getNotifications() {
    const user = me();
    return user ? (user.notifikasi || []) : [];
  }

  function setupNavigation() {
    showPageNotification();
    const authAction = document.querySelector('[data-auth-action]');
    if (authAction) {
      const label = authAction.querySelector('span');
      const signedIn = !!me();
      if (label) label.textContent = signedIn ? 'Log-out' : 'Sign in';
      authAction.href = 'auth-page.html#login';
      authAction.setAttribute('aria-label', signedIn ? 'Log-out' : 'Sign in');
      if (!authAction.dataset.authActionBound) {
        authAction.dataset.authActionBound = 'true';
        authAction.addEventListener('click', event => {
          if (!me()) return;
          event.preventDefault();
          logout().then(() => { window.location.href = 'auth-page.html#login'; });
        });
      }
    }

    document.querySelectorAll('.chip').forEach(link => {
      const label = link.querySelector('span');
      if (!label) return;
      if (label.textContent.trim() === 'Notifikasi') {
        const unread = getNotifications().filter(item => !item.dibaca).length;
        link.dataset.notificationsTrigger = 'true';
        link.href = '#notifications';
        link.setAttribute('aria-label', unread ? 'Notifikasi, ' + unread + ' belum dibaca' : 'Notifikasi');
        link.setAttribute('aria-haspopup', 'dialog');
        link.setAttribute('aria-expanded', 'false');
        let dot = link.querySelector('.dot');
        if (unread && !dot) {
          dot = document.createElement('i');
          dot.className = 'dot';
          dot.setAttribute('aria-label', 'Ada notifikasi baru');
          link.appendChild(dot);
        } else if (!unread && dot) {
          dot.remove();
        }
        if (!link.dataset.notificationsBound) {
          link.dataset.notificationsBound = 'true';
          link.addEventListener('click', event => {
            event.preventDefault();
            const panel = ensureNotificationPanel();
            const opening = !panel.classList.contains('on');
            if (opening) renderNotificationPanel();
            panel.classList.toggle('on', opening);
            link.setAttribute('aria-expanded', String(opening));
          });
        }
      } else if (label.textContent.trim() === 'Akun') {
        link.href = me() ? 'profil.html' : 'auth-page.html#login';
      }
    });

    document.querySelectorAll('[data-logout], #logout').forEach(button => {
      if (button.dataset.logoutBound) return;
      button.dataset.logoutBound = 'true';
      button.addEventListener('click', event => {
        event.preventDefault();
        logout().then(() => { window.location.href = 'auth-page.html#login'; });
      });
    });
  }

  window.addEventListener('kemenham:change', setupNavigation);
  document.addEventListener('DOMContentLoaded', setupNavigation);

  window.KH = {
    cfg,
    lomba: LOMBA,
    me,
    signup,
    login,
    daftar,
    tambahDaftar,
    kirimKarya,
    tampilkan,
    simpanProfil,
    hapusDaftar,
    getNotifications,
    logout
  };
})();
