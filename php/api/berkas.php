<?php
// Peserta membuka berkas miliknya sendiri: berkas.php?id=<id pendaftaran>&jenis=pdf|word|pernyataan|kartu[&unduh=1]
require __DIR__ . '/_boot.php';   // sesi, koneksi, FOLDER_UPLOAD
header_remove('Content-Type');

function tolak(int $kode, string $pesan): never {
    http_response_code($kode);
    header('Content-Type: text/plain; charset=utf-8');
    exit($pesan);
}
if (empty($_SESSION['uid'])) tolak(401, 'Silakan masuk terlebih dahulu.');

$id = (int)($_GET['id'] ?? 0);
$jenis = (string)($_GET['jenis'] ?? '');
if (!in_array($jenis, ['pdf', 'word', 'pernyataan', 'kartu'], true)) tolak(404, 'Berkas tidak ditemukan.');

// Kepemilikan dicek lewat p.pengguna_id: peserta hanya bisa membuka berkas pendaftarannya sendiri
$r = $koneksi->execute_query(
    'SELECT p.nama_peserta, p.file_kartu, k.file_pdf, k.file_word, k.file_pernyataan, k.file_kartu AS kartu_lama
     FROM pendaftaran p LEFT JOIN karya k ON k.pendaftaran_id = p.id
     WHERE p.id=? AND p.pengguna_id=?', [$id, (int)$_SESSION['uid']]
)->fetch_assoc();
if (!$r) tolak(404, 'Berkas tidak ditemukan.');

$nama = match ($jenis) {
    'pdf' => $r['file_pdf'], 'word' => $r['file_word'], 'pernyataan' => $r['file_pernyataan'],
    'kartu' => ($r['file_kartu'] ?: $r['kartu_lama']),
};
$nama = basename((string)$nama);
if (!preg_match('/^[a-f0-9]{32}\.(pdf|doc|docx|jpg|jpeg|png)$/', $nama)) tolak(404, 'Berkas tidak ditemukan.');
$path = FOLDER_UPLOAD . DIRECTORY_SEPARATOR . $nama;
if (!is_file($path)) tolak(404, 'Berkas tidak ditemukan di server.');

$ext = strtolower(pathinfo($nama, PATHINFO_EXTENSION));
$mime = ['pdf' => 'application/pdf', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png'][$ext] ?? null;
$tampil = $mime && !isset($_GET['unduh']);
$label = ['pdf' => 'karya', 'word' => 'karya-word', 'pernyataan' => 'pernyataan', 'kartu' => 'kartu'][$jenis];
$unduh = trim(preg_replace('/[^A-Za-z0-9_-]+/', '-', $r['nama_peserta']), '-') . '_' . $label . '.' . $ext;

session_write_close();
header('Content-Type: ' . ($tampil ? $mime : 'application/octet-stream'));
header('Content-Length: ' . filesize($path));
header('Content-Disposition: ' . ($tampil ? 'inline' : 'attachment') . '; filename="' . $unduh . '"');
header('Cache-Control: private, no-store');
readfile($path);
