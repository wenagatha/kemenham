<?php
// Unduh seluruh berkas pada pendaftaran milik peserta yang sedang masuk.
require __DIR__ . '/_boot.php';
require __DIR__ . '/_zip.php';
header_remove('Content-Type');

if (empty($_SESSION['uid'])) {
    http_response_code(401);
    header('Content-Type: text/plain; charset=utf-8');
    exit('Silakan masuk terlebih dahulu.');
}
$uid = (int)$_SESSION['uid'];
$rows = $koneksi->execute_query(
    'SELECT p.id, p.nama_peserta, l.nama AS lomba,
            COALESCE(NULLIF(p.file_kartu, \'\'), k.file_kartu) AS file_kartu,
            k.file_pdf, k.file_word, k.file_pernyataan
     FROM pendaftaran p
     JOIN lomba l ON l.id=p.lomba_id
     LEFT JOIN karya k ON k.pendaftaran_id=p.id
     WHERE p.pengguna_id=?
     ORDER BY p.id',
    [$uid]
)->fetch_all(MYSQLI_ASSOC);

$fileLabel = [
    'file_pdf' => 'karya',
    'file_word' => 'naskah',
    'file_kartu' => 'kartu-peserta',
    'file_pernyataan' => 'pernyataan',
];
$berkas = [];
foreach ($rows as $row) {
    foreach ($fileLabel as $kolom => $label) {
        $nama = basename((string)($row[$kolom] ?? ''));
        if ($nama === '') continue;
        if (!preg_match('/^[a-f0-9]{32}\.(pdf|doc|docx|jpg|jpeg|png)$/', $nama)) {
            http_response_code(404);
            header('Content-Type: text/plain; charset=utf-8');
            exit('Salah satu berkas tidak dapat ditemukan.');
        }
        $path = FOLDER_UPLOAD . DIRECTORY_SEPARATOR . $nama;
        if (!is_file($path)) {
            http_response_code(404);
            header('Content-Type: text/plain; charset=utf-8');
            exit('Salah satu berkas tidak ditemukan di server.');
        }
        $slug = trim(preg_replace('/[^A-Za-z0-9_-]+/', '-', (string)$row['lomba']), '-');
        $peserta = trim(preg_replace('/[^A-Za-z0-9_-]+/', '-', (string)$row['nama_peserta']), '-');
        $folder = 'berkas-peserta/lomba-' . (int)$row['id'];
        $ext = strtolower(pathinfo($nama, PATHINFO_EXTENSION));
        $berkas[] = [$path, $folder . '/' . ($slug ?: 'lomba') . '_' . ($peserta ?: 'peserta') . '_' . $label . '.' . $ext];
    }
}

if (!$berkas) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    exit('Belum ada berkas yang dapat diunduh.');
}

session_write_close();
$temp = tempnam(sys_get_temp_dir(), 'kh-');
if ($temp === false) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    exit('Arsip unduhan gagal disiapkan.');
}

$arsipBerhasil = false;
if (class_exists(ZipArchive::class)) {
    $zip = new ZipArchive();
    $opened = $zip->open($temp, ZipArchive::CREATE | ZipArchive::OVERWRITE);
    if ($opened === true) {
        $arsipBerhasil = true;
        foreach ($berkas as [$path, $namaArsip]) {
            if (!$zip->addFile($path, $namaArsip)) {
                $arsipBerhasil = false;
                break;
            }
        }
        if (!$zip->close()) $arsipBerhasil = false;
    }
}
if (!$arsipBerhasil) {
    $arsipBerhasil = kh_zip_add_files($berkas, $temp);
}

if (!$arsipBerhasil) {
    unlink($temp);
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    exit('Arsip unduhan gagal dibuat. Pastikan folder sementara server dapat ditulis.');
}

header('Content-Type: application/zip');
header('Content-Length: ' . filesize($temp));
header('Content-Disposition: attachment; filename="berkas-peserta.zip"');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
readfile($temp);
unlink($temp);
