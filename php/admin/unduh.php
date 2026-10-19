<?php
session_start();
if (empty($_SESSION['admin'])) { http_response_code(403); exit('Akses ditolak.'); }
session_write_close();   // jangan mengunci sesi selama berkas besar dikirim

require __DIR__ . '/../koneksi.php';
$nama = basename((string)($_GET['f'] ?? ''));
if (!preg_match('/^[a-f0-9]{32}\.(pdf|doc|docx|jpg|jpeg|png)$/', $nama)) { http_response_code(404); exit('Berkas tidak ditemukan.'); }

$kolom = ['file_pdf' => 'karya', 'file_word' => 'karya-word', 'file_kartu' => 'kartu', 'file_pernyataan' => 'pernyataan'];
$k = $koneksi->execute_query(
    'SELECT p.nama_peserta, k.file_pdf, k.file_word, COALESCE(p.file_kartu, k.file_kartu) AS file_kartu, k.file_pernyataan
     FROM pendaftaran p LEFT JOIN karya k ON k.pendaftaran_id=p.id
     WHERE p.file_kartu=? OR k.file_pdf=? OR k.file_word=? OR k.file_kartu=? OR k.file_pernyataan=? LIMIT 1',
    array_fill(0, count($kolom) + 1, $nama)
)->fetch_assoc();
$path = FOLDER_UPLOAD . DIRECTORY_SEPARATOR . $nama;
if (!$k || !is_file($path)) { http_response_code(404); exit('Berkas tidak ditemukan.'); }

$label = '';
foreach ($kolom as $c => $l) if ($k[$c] === $nama) $label = $l;
$ext = strtolower(pathinfo($nama, PATHINFO_EXTENSION));
$mime = ['pdf' => 'application/pdf', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png'][$ext] ?? null;
$tampil = isset($_GET['lihat']) && $mime;     // ?lihat=1 -> dibuka di browser (PDF/gambar)
$unduh = trim(preg_replace('/[^A-Za-z0-9_-]+/', '-', $k['nama_peserta']), '-') . '_' . $label . '.' . $ext;

header('Content-Type: ' . ($tampil ? $mime : 'application/octet-stream'));
header('Content-Length: ' . filesize($path));
header('Content-Disposition: ' . ($tampil ? 'inline' : 'attachment') . '; filename="' . $unduh . '"');
header('X-Content-Type-Options: nosniff');
readfile($path);
