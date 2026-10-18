<?php
// POST ?aksi=simpan | hapus. Batas waktu dan aturan "satu lomba" dicek di server.
require __DIR__ . '/_boot.php';
wajib_post();
$uid = wajib_login();
$aksi = $_GET['aksi'] ?? '';
$d = body_json();
const HANYA_SATU_LOMBA = true;

function lomba_ditutup(array $l): bool {
    $b = (string)($l['batas_daftar'] ?? '');
    if ($b === '') return false;
    if (strlen($b) <= 10) $b .= ' 23:59:59';
    return time() > strtotime($b);
}

if ($aksi === 'simpan') {
    $lomba = $koneksi->execute_query('SELECT * FROM lomba WHERE kode=?', [bersih($d['kategori'] ?? '', 40)])->fetch_assoc();
    if (!$lomba) galat('Lomba tidak ditemukan.', 404);

    $ada = $koneksi->execute_query('SELECT lomba_id FROM pendaftaran WHERE pengguna_id=?', [$uid])->fetch_all(MYSQLI_ASSOC);
    foreach ($ada as $a) if ((int)$a['lomba_id'] === (int)$lomba['id']) keluar_json(['ok' => true, 'data' => data_pengguna($koneksi, $uid)]);
    if (HANYA_SATU_LOMBA && $ada) galat('Akun ini sudah terdaftar pada lomba lain.', 409);
    if (lomba_ditutup($lomba)) galat('Pendaftaran sudah ditutup.', 403);

    $nama = bersih($d['peserta'] ?? '', 120);
    $nomor = bersih($d['nomor'] ?? '', 40);
    $asal = bersih($d['asal'] ?? '', 120);
    $email = bersih($d['email'] ?? '', 120);
    $wa = bersih($d['wa'] ?? '', 20);
    $tim = ($d['tim'] ?? '') === 'Kelompok' ? 'Kelompok' : 'Individu';
    $a2 = $tim === 'Kelompok' ? bersih($d['anggota2'] ?? '', 120) : '';
    $a3 = $tim === 'Kelompok' ? bersih($d['anggota3'] ?? '', 120) : '';
    if ($nama === '' || $nomor === '' || $asal === '') galat('Lengkapi nama, nomor induk, dan asal.');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) galat('Email tidak valid.');
    if (!telepon_valid($wa)) galat('Nomor WhatsApp tidak valid.');

    $koneksi->begin_transaction();
    try {
        $koneksi->execute_query(
            "INSERT INTO pendaftaran (pengguna_id, lomba_id, nama_peserta, tipe_tim, anggota2, anggota3, nomor_induk, asal, email, whatsapp, tahap, status)
             VALUES (?,?,?,?,?,?,?,?,?,?, 'terbuka', 'Terdaftar')",
            [$uid, $lomba['id'], $nama, $tim, $a2, $a3, $nomor, $asal, $email, $wa]
        );
        buat_notifikasi($koneksi, $uid, (int)$lomba['id'],
            'Pendaftaran lomba ' . $lomba['nama'] . ' berhasil. Kamu bisa melanjutkan dengan mengunggah karya.');
        $koneksi->commit();
    } catch (Throwable $error) {
        $koneksi->rollback();
        throw $error;
    }
    keluar_json(['ok' => true, 'data' => data_pengguna($koneksi, $uid)]);
}

if ($aksi === 'hapus') {
    $id = (int)($d['id'] ?? 0);
    $p = $koneksi->execute_query(
        'SELECT p.id, p.tahap, p.status, l.batas_daftar FROM pendaftaran p JOIN lomba l ON l.id=p.lomba_id WHERE p.id=? AND p.pengguna_id=?',
        [$id, $uid])->fetch_assoc();
    if (!$p) galat('Pendaftaran tidak ditemukan.', 404);
    if ($p['tahap'] === 'terkirim' || $p['status'] !== 'Terdaftar' ||
        $koneksi->execute_query('SELECT 1 FROM karya WHERE pendaftaran_id=?', [$id])->num_rows)
        galat('Pendaftaran tidak bisa dihapus karena karya sudah dikirim.', 403);
    if (lomba_ditutup($p)) galat('Pendaftaran sudah ditutup, tidak bisa dihapus.', 403);
    $koneksi->execute_query('DELETE FROM pendaftaran WHERE id=? AND pengguna_id=?', [$id, $uid]);
    keluar_json(['ok' => true, 'data' => data_pengguna($koneksi, $uid)]);
}

galat('Aksi tidak dikenal.', 404);
