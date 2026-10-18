<?php
session_start();
if (empty($_SESSION['admin'])) {
    http_response_code(403);
    exit('Akses ditolak.');
}

require __DIR__ . '/../koneksi.php';
$nama = basename((string)($_GET['f'] ?? ''));
if (!preg_match('/^[a-f0-9]{32}\.(pdf|doc|docx|jpg|jpeg|png)$/', $nama)) {
    http_response_code(404);
    exit('Berkas tidak ditemukan.');
}
$kolom = ['file_pdf', 'file_word', 'file_kartu', 'file_pernyataan'];
$hasil = $koneksi->execute_query(
    'SELECT 1 FROM karya WHERE ' . implode(' OR ', array_map(static fn($c) => $c . '=?', $kolom)) . ' LIMIT 1',
    array_fill(0, count($kolom), $nama)
)->fetch_row();
$path = dirname(__DIR__, 4) . DIRECTORY_SEPARATOR . 'kemenham-uploads' . DIRECTORY_SEPARATOR . $nama;
if (!$hasil || !is_file($path)) {
    http_response_code(404);
    exit('Berkas tidak ditemukan.');
}

header('Content-Type: application/octet-stream');
header('Content-Length: ' . filesize($path));
header('Content-Disposition: attachment; filename="' . $nama . '"');
header('X-Content-Type-Options: nosniff');
readfile($path);
