<?php
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$koneksi = new mysqli('localhost', 'root', '', 'db_kemenham');
$koneksi->set_charset('utf8mb4');