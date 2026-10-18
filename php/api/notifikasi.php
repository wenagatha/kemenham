<?php
require __DIR__ . '/_boot.php';
wajib_post();
$uid = wajib_login();
$aksi = $_GET['aksi'] ?? '';

if ($aksi === 'baca-semua') {
    $koneksi->execute_query('UPDATE notifikasi SET dibaca=1 WHERE pengguna_id=? AND dibaca=0', [$uid]);
    keluar_json(['ok' => true, 'data' => data_pengguna($koneksi, $uid)]);
}

galat('Aksi tidak dikenal.', 404);
