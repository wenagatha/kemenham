<?php
require __DIR__ . '/_boot.php';
wajib_post();
$uid = wajib_login();

// Cek isi berkas lewat byte awal (tidak bergantung pada ekstensi PHP fileinfo)
function isi_sesuai(string $path, string $ext): bool {
    $h = (string)file_get_contents($path, false, null, 0, 1024);
    return match ($ext) {
        'pdf' => str_contains($h, '%PDF-'),
        'jpg', 'jpeg' => str_starts_with($h, "\xFF\xD8\xFF"),
        'png' => str_starts_with($h, "\x89PNG"),
        'docx' => str_starts_with($h, "PK\x03\x04"),
        'doc' => str_starts_with($h, "\xD0\xCF\x11\xE0"),
        default => false,
    };
}

if (empty($_POST) && empty($_FILES) && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    galat('Ukuran kiriman melebihi batas server. Minta pengelola menaikkan post_max_size.', 413);
}

$kategori = bersih($_POST['kategori'] ?? '', 40);
$judul = bersih($_POST['judul'] ?? '', 200);
if ($judul === '') galat('Judul karya wajib diisi.');
if (($_POST['setuju'] ?? '') !== 'on') galat('Pernyataan keaslian wajib disetujui.');

$lomba = $koneksi->execute_query('SELECT id, kode, nama FROM lomba WHERE kode=?', [$kategori])->fetch_assoc();
if (!$lomba) galat('Lomba tidak ditemukan.', 404);
$pendaftaran = $koneksi->execute_query(
    'SELECT id, tahap FROM pendaftaran WHERE pengguna_id=? AND lomba_id=?',
    [$uid, $lomba['id']]
)->fetch_assoc();
if (!$pendaftaran) galat('Pendaftaran lomba tidak ditemukan.', 404);
if ($pendaftaran['tahap'] !== 'terbuka') galat('Pengumpulan karya tidak sedang dibuka.', 403);
// Ada karya lama + tahap 'terbuka' = pengiriman ulang setelah admin meminta revisi
$karyaLama = $koneksi->execute_query('SELECT * FROM karya WHERE pendaftaran_id=?', [$pendaftaran['id']])->fetch_assoc();

$aturanFile = [
    'pdf' => ['wajib' => true, 'ukuran' => 100 * 1024 * 1024, 'ekstensi' => ['pdf'],
        'mime' => ['pdf' => ['application/pdf']]],
    'word' => ['wajib' => $kategori === 'buku-cerita', 'ukuran' => 100 * 1024 * 1024, 'ekstensi' => ['doc', 'docx'],
        'mime' => [
            'doc' => ['application/msword', 'application/x-ole-storage'],
            'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/x-zip-compressed'],
        ]],
    'pernyataan' => ['wajib' => true, 'ukuran' => 10 * 1024 * 1024, 'ekstensi' => ['pdf', 'jpg', 'jpeg', 'png'],
        'mime' => ['pdf' => ['application/pdf'], 'jpg' => ['image/jpeg'], 'jpeg' => ['image/jpeg'], 'png' => ['image/png']]],
];

$fileTersimpan = [];
$fileDiunggah = [];
$tujuan = FOLDER_UPLOAD;
if (!is_dir($tujuan) && !mkdir($tujuan, 0700, true) && !is_dir($tujuan)) {
    galat('Folder penyimpanan berkas tidak dapat dibuat.', 500);
}
if (!is_writable($tujuan)) galat('Folder penyimpanan berkas tidak dapat ditulis.', 500);

foreach ($aturanFile as $nama => $aturan) {
    if ($nama === 'word' && !$aturan['wajib'] && empty($_FILES[$nama]['name'])) {
        $fileTersimpan[$nama] = '';
        continue;
    }
    $file = $_FILES[$nama] ?? null;
    if (!$file || $file['error'] === UPLOAD_ERR_NO_FILE) {
        if ($aturan['wajib']) galat('Berkas ' . $nama . ' wajib diunggah.');
        $fileTersimpan[$nama] = '';
        continue;
    }
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $pesan = in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
            ? 'Ukuran berkas melebihi batas unggah server.'
            : 'Berkas ' . $nama . ' gagal diterima server.';
        galat($pesan, 400);
    }
    $ekstensi = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ekstensi, $aturan['ekstensi'], true)) galat('Format berkas ' . $nama . ' tidak didukung.');
    if ($file['size'] > $aturan['ukuran']) galat('Ukuran berkas ' . $nama . ' melebihi batas.');
    if (!isi_sesuai($file['tmp_name'], $ekstensi)) {
        galat('Isi berkas ' . $nama . ' tidak sesuai dengan format yang dipilih.');
    }
    $fileDiunggah[$nama] = ['tmp' => $file['tmp_name'], 'ekstensi' => $ekstensi];
}

try {
    foreach ($aturanFile as $nama => $_aturan) {
        if (!isset($fileDiunggah[$nama])) continue;
        $namaAcak = bin2hex(random_bytes(16)) . '.' . $fileDiunggah[$nama]['ekstensi'];
        $path = $tujuan . DIRECTORY_SEPARATOR . $namaAcak;
        if (!move_uploaded_file($fileDiunggah[$nama]['tmp'], $path)) {
            throw new RuntimeException('Berkas ' . $nama . ' gagal disimpan.');
        }
        $fileTersimpan[$nama] = $namaAcak;
        $fileTersimpan['_paths'][] = $path;
    }
} catch (Throwable $error) {
    foreach ($fileTersimpan['_paths'] ?? [] as $path) {
        if (is_file($path)) unlink($path);
    }
    throw $error;
}

try {
    $koneksi->begin_transaction();
    if ($karyaLama) {
        $koneksi->execute_query(
            'UPDATE karya SET judul=?, file_pdf=?, file_word=?, file_pernyataan=?, dikirim_pada=NOW() WHERE pendaftaran_id=?',
            [$judul, $fileTersimpan['pdf'], $fileTersimpan['word'], $fileTersimpan['pernyataan'], $pendaftaran['id']]
        );
    } else {
        $koneksi->execute_query(
            'INSERT INTO karya (pendaftaran_id, judul, file_pdf, file_word, file_kartu, file_pernyataan) VALUES (?,?,?,?,?,?)',
            [$pendaftaran['id'], $judul, $fileTersimpan['pdf'], $fileTersimpan['word'], '', $fileTersimpan['pernyataan']]
        );
    }
    $koneksi->execute_query(
        "UPDATE pendaftaran SET tahap='terkirim', status='Karya terkirim' WHERE id=? AND pengguna_id=?",
        [$pendaftaran['id'], $uid]
    );
    buat_notifikasi($koneksi, $uid, (int)$lomba['id'],
        'Karya "' . $judul . '" berhasil diunggah dan sudah tercatat untuk lomba ' . $lomba['nama'] . '.');
    $koneksi->commit();
    if ($karyaLama) foreach (['file_pdf', 'file_word', 'file_pernyataan'] as $kol) {
        if (!empty($karyaLama[$kol])) @unlink(FOLDER_UPLOAD . DIRECTORY_SEPARATOR . $karyaLama[$kol]);
    }
} catch (Throwable $error) {
    $koneksi->rollback();
    foreach ($fileTersimpan['_paths'] ?? [] as $path) {
        if (is_file($path)) unlink($path);
    }
    throw $error;
}

keluar_json(['ok' => true, 'data' => data_pengguna($koneksi, $uid)]);
