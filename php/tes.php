<?php
require 'koneksi.php';
$hasil = $koneksi->query('SELECT kode, nama, batas_daftar FROM lomba');
while ($baris = $hasil->fetch_assoc()) {
    echo $baris['nama'] . ' (' . $baris['kode'] . ') - batas ' . $baris['batas_daftar'] . '<br>';
}