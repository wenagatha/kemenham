<?php
// Endpoint akun peserta: ?aksi=saya | daftar | masuk | keluar
require __DIR__ . '/_boot.php';
$aksi = $_GET['aksi'] ?? '';

if ($aksi === 'saya') {                       // GET: data akun yang sedang masuk
    $uid = (int)($_SESSION['uid'] ?? 0);
    keluar_json(['ok' => true, 'data' => $uid ? data_pengguna($koneksi, $uid) : null]);
}

wajib_post();
$d = body_json();

if ($aksi === 'daftar') {
    $depan    = bersih($d['first_name'] ?? '', 60);
    $belakang = bersih($d['last_name'] ?? '', 60);
    $email    = strtolower(bersih($d['email'] ?? '', 120));
    $pw       = (string)($d['password'] ?? '');
    $telp     = bersih($d['phone'] ?? '', 20);
    $gender   = (string)($d['gender'] ?? '');
    $tempat   = bersih($d['birth_place'] ?? '', 80);
    $tgl      = (string)($d['birth_date'] ?? '');
    $alamat   = bersih($d['address'] ?? '', 255);

    if ($depan === '') galat('Nama depan wajib diisi.');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) galat('Masukkan alamat email yang valid.');
    if (strlen($pw) < 8) galat('Kata sandi minimal 8 karakter.');
    if (!in_array($gender, ['Laki-laki', 'Perempuan'], true)) galat('Pilih jenis kelamin.');
    $dt = DateTime::createFromFormat('Y-m-d', $tgl);
    if (!$dt || $dt->format('Y-m-d') !== $tgl) galat('Tanggal lahir tidak valid.');
    if ($tgl >= date('Y-m-d')) galat('Tanggal lahir harus sebelum hari ini.');
    if ($telp !== '' && !telepon_valid($telp)) galat('Nomor telepon tidak valid.');

    if ($koneksi->execute_query('SELECT 1 FROM pengguna WHERE email=?', [$email])->num_rows)
        galat('Email ini sudah terdaftar. Silakan masuk.', 409);

    $koneksi->begin_transaction();
    try {
        $koneksi->execute_query(
            "INSERT INTO pengguna (nama_depan, nama_belakang, email, password_hash, role, telepon, gender, tempat_lahir, tanggal_lahir, alamat)
             VALUES (?,?,?,?,'peserta',?,?,?,?,?)",
            [$depan, $belakang, $email, password_hash($pw, PASSWORD_DEFAULT), $telp, $gender, $tempat, $tgl, $alamat]
        );
        $uid = (int)$koneksi->insert_id;
        buat_notifikasi($koneksi, $uid, null, 'Akun berhasil dibuat. Selamat datang, ' . trim($depan . ' ' . $belakang) . '! Lengkapi profil dan pilih lomba yang ingin kamu ikuti.');
        $koneksi->commit();
    } catch (Throwable $error) {
        $koneksi->rollback();
        throw $error;
    }
    session_regenerate_id(true);
    $_SESSION['uid'] = $uid;
    keluar_json(['ok' => true, 'data' => data_pengguna($koneksi, $_SESSION['uid'])]);
}

if ($aksi === 'masuk') {
    $email = strtolower(bersih($d['email'] ?? '', 120));
    $u = $koneksi->execute_query("SELECT id, nama_depan, nama_belakang, password_hash FROM pengguna WHERE email=? AND role='peserta'", [$email])->fetch_assoc();
    if (!$u || !password_verify((string)($d['password'] ?? ''), $u['password_hash']))
        galat('Email atau kata sandi salah.', 401);
    buat_notifikasi($koneksi, (int)$u['id'], null, 'Selamat datang kembali, ' . trim($u['nama_depan'] . ' ' . ($u['nama_belakang'] ?? '')) . '! Kamu berhasil masuk ke akun.');
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$u['id'];
    keluar_json(['ok' => true, 'data' => data_pengguna($koneksi, (int)$u['id'])]);
}

if ($aksi === 'keluar') {
    unset($_SESSION['uid']);
    session_regenerate_id(true);
    keluar_json(['ok' => true]);
}

galat('Aksi tidak dikenal.', 404);
