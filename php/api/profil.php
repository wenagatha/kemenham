<?php
// POST: perbarui profil peserta yang sedang masuk (email tidak bisa diubah di sini).
require __DIR__ . '/_boot.php';
wajib_post();
$uid = wajib_login();
$d = body_json();

$nama   = bersih($d['nama'] ?? '', 120);
$telp   = bersih($d['telepon'] ?? '', 20);
$tempat = bersih($d['tempat'] ?? '', 80);
$tgl    = (string)($d['tgl'] ?? '');
$alamat = bersih($d['alamat'] ?? '', 255);
$gender = (string)($d['gender'] ?? '');

if ($nama === '') galat('Nama wajib diisi.');
if (!telepon_valid($telp)) galat('Nomor telepon tidak valid.');
if (!in_array($gender, ['Laki-laki', 'Perempuan'], true)) galat('Pilih jenis kelamin.');
$dt = DateTime::createFromFormat('Y-m-d', $tgl);
if (!$dt || $dt->format('Y-m-d') !== $tgl || $tgl >= date('Y-m-d')) galat('Tanggal lahir tidak valid.');

// "Alief Linggar" -> depan "Alief", belakang "Linggar"
$bagian = preg_split('/\s+/', $nama, 2);
$koneksi->execute_query(
    'UPDATE pengguna SET nama_depan=?, nama_belakang=?, telepon=?, gender=?, tempat_lahir=?, tanggal_lahir=?, alamat=? WHERE id=?',
    [$bagian[0], $bagian[1] ?? '', $telp, $gender, $tempat, $tgl, $alamat, $uid]
);
keluar_json(['ok' => true, 'data' => data_pengguna($koneksi, $uid)]);
