<?php
// POST ?aksi=simpan | hapus. Batas waktu dan aturan "satu lomba" dicek di server.
require __DIR__ . '/_boot.php';
wajib_post();
$uid = wajib_login();
$aksi = $_GET['aksi'] ?? '';
$multipart = $_POST !== [] || $_FILES !== [];
if ($aksi === 'simpan' && !$multipart &&
    str_starts_with(strtolower((string)($_SERVER['CONTENT_TYPE'] ?? '')), 'multipart/form-data') &&
    (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    galat('Ukuran kiriman melebihi batas server. Minta pengelola menaikkan post_max_size.', 413);
}
$d = $multipart ? $_POST : body_json();
const HANYA_SATU_LOMBA = true;

function lomba_ditutup(array $l): bool {
    $b = (string)($l['batas_daftar'] ?? '');
    if ($b === '') return false;
    if (strlen($b) <= 10) $b .= ' 23:59:59';
    return time() > strtotime($b);
}

function simpan_kartu_peserta(?array $file, bool $wajib = true): ?string {
    if (!$file || $file['error'] === UPLOAD_ERR_NO_FILE) {
        if ($wajib) galat('Kartu peserta perwakilan wajib diunggah.');
        return null;
    }
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $pesan = in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
            ? 'Ukuran kartu peserta melebihi batas unggah server.'
            : 'Kartu peserta gagal diterima server.';
        galat($pesan, 400);
    }
    $ekstensi = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ekstensi, ['pdf', 'jpg', 'jpeg', 'png'], true)) {
        galat('Format kartu peserta harus PDF, JPG, atau PNG.');
    }
    if ($file['size'] > 10 * 1024 * 1024) galat('Ukuran kartu peserta melebihi 10 MB.');
    $isi = (string)file_get_contents($file['tmp_name'], false, null, 0, 8);
    $sesuai = match ($ekstensi) {
        'pdf' => str_starts_with($isi, '%PDF-'),
        'jpg', 'jpeg' => str_starts_with($isi, "\xFF\xD8\xFF"),
        'png' => str_starts_with($isi, "\x89PNG\r\n\x1A\n"),
        default => false,
    };
    if (!$sesuai) galat('Isi kartu peserta tidak sesuai dengan format yang dipilih.');

    $tujuan = FOLDER_UPLOAD;
    if (!is_dir($tujuan) && !mkdir($tujuan, 0700, true) && !is_dir($tujuan)) {
        galat('Folder penyimpanan berkas tidak dapat dibuat.', 500);
    }
    if (!is_writable($tujuan)) galat('Folder penyimpanan berkas tidak dapat ditulis.', 500);
    $namaAcak = bin2hex(random_bytes(16)) . '.' . $ekstensi;
    if (!move_uploaded_file($file['tmp_name'], $tujuan . DIRECTORY_SEPARATOR . $namaAcak)) {
        galat('Kartu peserta gagal disimpan.', 500);
    }
    return $namaAcak;
}

if ($aksi === 'simpan') {
    $lomba = $koneksi->execute_query('SELECT * FROM lomba WHERE kode=?', [bersih($d['kategori'] ?? '', 40)])->fetch_assoc();
    if (!$lomba) galat('Lomba tidak ditemukan.', 404);

    $sudahTerdaftar = $koneksi->execute_query(
        'SELECT id, file_kartu, status FROM pendaftaran WHERE pengguna_id=? AND lomba_id=?',
        [$uid, $lomba['id']]
    )->fetch_assoc();
    if ($sudahTerdaftar) {
        if ($sudahTerdaftar['status'] !== 'Terdaftar') galat('Data pendaftaran sudah dikunci oleh panitia.', 403);
        if ($koneksi->execute_query('SELECT 1 FROM karya WHERE pendaftaran_id=?', [$sudahTerdaftar['id']])->num_rows) {
            galat('Data pendaftaran tidak bisa diubah setelah karya dikirim.', 409);
        }

        $nama = bersih($d['peserta'] ?? '', 120);
        $nomor = bersih($d['nomor'] ?? '', 40);
        $asal = bersih($d['asal'] ?? '', 120);
        $email = bersih($d['email'] ?? '', 120);
        $wa = bersih($d['wa'] ?? '', 20);
        $tim = strtolower((string)($d['tim'] ?? '')) === 'kelompok' ? 'Kelompok' : 'Individu';
        $a2 = $tim === 'Kelompok' ? bersih($d['anggota2'] ?? '', 120) : '';
        $a3 = $tim === 'Kelompok' ? bersih($d['anggota3'] ?? '', 120) : '';
        if ($nama === '' || $nomor === '' || $asal === '') galat('Lengkapi nama, nomor induk, dan asal.');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) galat('Email tidak valid.');
        if (!telepon_valid($wa)) galat('Nomor WhatsApp tidak valid.');

        $kartuLama = (string)($sudahTerdaftar['file_kartu'] ?? '');
        $kartuBaru = simpan_kartu_peserta($_FILES['kartu'] ?? null, false);
        $kartuFinal = $kartuBaru ?? $kartuLama;
        if ($kartuFinal === '') galat('Kartu peserta perwakilan wajib diunggah.');
        $pathBaru = $kartuBaru ? FOLDER_UPLOAD . DIRECTORY_SEPARATOR . $kartuBaru : null;
        $transaksiDimulai = false;
        try {
            $koneksi->begin_transaction();
            $transaksiDimulai = true;
            $koneksi->execute_query(
                'UPDATE pendaftaran SET nama_peserta=?, tipe_tim=?, anggota2=?, anggota3=?, nomor_induk=?, asal=?, email=?, whatsapp=?, file_kartu=? WHERE id=? AND pengguna_id=?',
                [$nama, $tim, $a2, $a3, $nomor, $asal, $email, $wa, $kartuFinal, $sudahTerdaftar['id'], $uid]
            );
            $koneksi->commit();
            $transaksiDimulai = false;
        } catch (Throwable $error) {
            if ($transaksiDimulai) $koneksi->rollback();
            if ($pathBaru && is_file($pathBaru)) unlink($pathBaru);
            throw $error;
        }
        if ($kartuBaru && $kartuLama !== '' && is_file(FOLDER_UPLOAD . DIRECTORY_SEPARATOR . basename($kartuLama))) {
            unlink(FOLDER_UPLOAD . DIRECTORY_SEPARATOR . basename($kartuLama));
        }
        keluar_json(['ok' => true, 'data' => data_pengguna($koneksi, $uid)]);
    }

    $ada = $koneksi->execute_query('SELECT lomba_id FROM pendaftaran WHERE pengguna_id=?', [$uid])->fetch_all(MYSQLI_ASSOC);
    if (HANYA_SATU_LOMBA && $ada) galat('Akun ini sudah terdaftar pada lomba lain.', 409);
    if (lomba_ditutup($lomba)) galat('Pendaftaran sudah ditutup.', 403);

    $nama = bersih($d['peserta'] ?? '', 120);
    $nomor = bersih($d['nomor'] ?? '', 40);
    $asal = bersih($d['asal'] ?? '', 120);
    $email = bersih($d['email'] ?? '', 120);
    $wa = bersih($d['wa'] ?? '', 20);
    $tim = strtolower((string)($d['tim'] ?? '')) === 'kelompok' ? 'Kelompok' : 'Individu';
    $a2 = $tim === 'Kelompok' ? bersih($d['anggota2'] ?? '', 120) : '';
    $a3 = $tim === 'Kelompok' ? bersih($d['anggota3'] ?? '', 120) : '';
    if ($nama === '' || $nomor === '' || $asal === '') galat('Lengkapi nama, nomor induk, dan asal.');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) galat('Email tidak valid.');
    if (!telepon_valid($wa)) galat('Nomor WhatsApp tidak valid.');

    $namaAcak = simpan_kartu_peserta($_FILES['kartu'] ?? null);
    $path = FOLDER_UPLOAD . DIRECTORY_SEPARATOR . $namaAcak;

    $transaksiDimulai = false;
    try {
        $koneksi->begin_transaction();
        $transaksiDimulai = true;
        $koneksi->execute_query(
            "INSERT INTO pendaftaran (pengguna_id, lomba_id, nama_peserta, tipe_tim, anggota2, anggota3, nomor_induk, asal, email, whatsapp, file_kartu, tahap, status)
             VALUES (?,?,?,?,?,?,?,?,?,?,?, 'terbuka', 'Terdaftar')",
            [$uid, $lomba['id'], $nama, $tim, $a2, $a3, $nomor, $asal, $email, $wa, $namaAcak]
        );
        buat_notifikasi($koneksi, $uid, (int)$lomba['id'],
            'Pendaftaran lomba ' . $lomba['nama'] . ' berhasil. Kamu bisa melanjutkan dengan mengunggah karya.');
        $koneksi->commit();
        $transaksiDimulai = false;
    } catch (Throwable $error) {
        if ($transaksiDimulai) $koneksi->rollback();
        if (is_file($path)) unlink($path);
        throw $error;
    }
    keluar_json(['ok' => true, 'data' => data_pengguna($koneksi, $uid)]);
}

if ($aksi === 'hapus') {
    $id = (int)($d['id'] ?? 0);
    $p = $koneksi->execute_query(
        'SELECT p.id, p.file_kartu, p.tahap, p.status, l.batas_daftar FROM pendaftaran p JOIN lomba l ON l.id=p.lomba_id WHERE p.id=? AND p.pengguna_id=?',
        [$id, $uid])->fetch_assoc();
    if (!$p) galat('Pendaftaran tidak ditemukan.', 404);
    if ($p['tahap'] === 'terkirim' || $p['status'] !== 'Terdaftar' ||
        $koneksi->execute_query('SELECT 1 FROM karya WHERE pendaftaran_id=?', [$id])->num_rows)
        galat('Pendaftaran tidak bisa dihapus karena karya sudah dikirim.', 403);
    if (lomba_ditutup($p)) galat('Pendaftaran sudah ditutup, tidak bisa dihapus.', 403);
    $koneksi->execute_query('DELETE FROM pendaftaran WHERE id=? AND pengguna_id=?', [$id, $uid]);
    if (!empty($p['file_kartu'])) {
        $path = FOLDER_UPLOAD . DIRECTORY_SEPARATOR . basename($p['file_kartu']);
        if (is_file($path)) unlink($path);
    }
    keluar_json(['ok' => true, 'data' => data_pengguna($koneksi, $uid)]);
}

galat('Aksi tidak dikenal.', 404);
