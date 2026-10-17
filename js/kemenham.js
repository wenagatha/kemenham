(function () {
  'use strict';

  const STORAGE_KEY = 'kemenham-app-v1';
  const LOMBA = {
    'buku-cerita': 'Buku Cerita',
    komik: 'Komik'
  };
  const cfg = { HANYA_SATU_LOMBA: true };

  function readState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { users: {}, currentUser: '' };

    try {
      const state = JSON.parse(saved);
      if (!state || typeof state !== 'object' || !state.users || typeof state.users !== 'object') {
        throw new Error('Data aplikasi tidak valid.');
      }
      return state;
    } catch (error) {
      console.error('Gagal membaca data aplikasi Kemenham.', error);
      throw error;
    }
  }

  let state = readState();

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('kemenham:change'));
  }

  function normalizedEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function me() {
    return state.users[state.currentUser] || null;
  }

  function makeNotification(user, category, message) {
    user.notifikasi = user.notifikasi || [];
    user.notifikasi.unshift({
      id: Date.now() + '-' + Math.random().toString(36).slice(2),
      kategori: category,
      pesan: message,
      dibaca: false,
      waktu: new Date().toISOString()
    });
  }

  function signup(data) {
    const email = normalizedEmail(data.email);
    if (!email) return 'Email wajib diisi.';
    if (state.users[email]) return 'Email ini sudah terdaftar. Silakan masuk.';

    const today = new Date().toISOString().slice(0, 10);
    state.users[email] = {
      profil: {
        nama: [data.first_name, data.last_name].filter(Boolean).join(' ').trim(),
        email,
        telepon: data.phone || '',
        gender: data.gender || '',
        tempat: data.birth_place || '',
        tgl: data.birth_date || '',
        alamat: data.address || '',
        dibuat: today
      },
      daftar: [],
      notifikasi: []
    };
    state.currentUser = email;
    save();
    return '';
  }

  function login(email) {
    const key = normalizedEmail(email);
    if (!state.users[key]) return 'Akun dengan email tersebut belum ditemukan. Silakan daftar terlebih dahulu.';
    state.currentUser = key;
    save();
    return '';
  }

  function daftar(category) {
    const user = me();
    return user ? user.daftar.find(item => item.kategori === category) || null : null;
  }

  function tambahDaftar(data) {
    const user = me();
    if (!user) throw new Error('Masuk ke akun terlebih dahulu sebelum mendaftar lomba.');

    const existing = daftar(data.kategori);
    if (existing) return existing;
    if (cfg.HANYA_SATU_LOMBA && user.daftar.length) {
      throw new Error('Akun ini sudah terdaftar pada lomba lain.');
    }

    const entry = {
      ...data,
      lomba: LOMBA[data.kategori],
      kategori: data.kategori,
      status: 'Terdaftar',
      tahap: 'terbuka',
      waktu: new Date().toISOString(),
      karya: null
    };
    user.daftar.push(entry);
    makeNotification(user, data.kategori, 'Pendaftaran ' + LOMBA[data.kategori] + ' berhasil. Pengumpulan karya sudah dapat dilakukan.');
    save();
    return entry;
  }

  function kirimKarya(category, karya) {
    const entry = daftar(category);
    if (!entry) throw new Error('Pendaftaran lomba tidak ditemukan.');
    if (entry.tahap !== 'terbuka') throw new Error('Pengumpulan karya tidak sedang dibuka.');
    entry.karya = { ...karya, waktu: new Date().toISOString() };
    entry.tahap = 'terkirim';
    entry.status = 'Karya terkirim';
    makeNotification(me(), category, 'Karya ' + LOMBA[category] + ' berhasil dikirim.');
    save();
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

  function latestNotificationUrl() {
    const notification = getNotifications().find(item => !item.dibaca);
    if (notification && LOMBA[notification.kategori]) {
      return 'unggah-' + notification.kategori + '.html';
    }
    return 'profil.html#upload';
  }

  function setupNavigation() {
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
          state.currentUser = '';
          save();
          window.location.href = 'auth-page.html#login';
        });
      }
    }

    document.querySelectorAll('.chip').forEach(link => {
      const label = link.querySelector('span');
      if (!label) return;
      if (label.textContent.trim() === 'Notifikasi') {
        const unread = getNotifications().filter(item => !item.dibaca).length;
        link.href = latestNotificationUrl();
        link.setAttribute('aria-label', unread ? 'Notifikasi, ' + unread + ' belum dibaca' : 'Notifikasi');
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
            const user = me();
            if (!user) return;
            event.preventDefault();
            const destination = link.href;
            user.notifikasi.forEach(item => { item.dibaca = true; });
            save();
            window.location.href = destination;
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
        state.currentUser = '';
        save();
        window.location.href = 'auth-page.html#login';
      });
    });
  }

  function refreshState() {
    state = readState();
    setupNavigation();
    window.dispatchEvent(new CustomEvent('kemenham:change'));
  }

  window.addEventListener('kemenham:change', setupNavigation);
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) refreshState();
  });
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
    save,
    getNotifications,
    latestNotificationUrl,
    logout() {
      state.currentUser = '';
      save();
    }
  };
})();
