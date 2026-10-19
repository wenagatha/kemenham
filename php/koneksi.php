<?php
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$koneksi = new mysqli('localhost', 'root', '', 'db_kemenham');
$koneksi->set_charset('utf8mb4');

// Folder berkas karya (di luar folder web). Ubah di sini kalau mau pindah lokasi.
define('FOLDER_UPLOAD', dirname(__DIR__, 3) . DIRECTORY_SEPARATOR . 'kemenham-uploads');
