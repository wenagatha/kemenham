<?php
// Dipakai bersama oleh semua endpoint API peserta.
date_default_timezone_set('Asia/Jakarta');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

set_exception_handler(function (Throwable $e) {
    error_log('[kemenham] ' . $e);   // detail ada di log Apache (xampp/apache/logs/error.log)
    keluar_json(['ok' => false, 'pesan' => 'Terjadi kesalahan di server.'], 500);
});

session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'path' => '/']);
session_start();

require __DIR__ . '/../koneksi.php';

function keluar_json(array $data, int $kode = 200): never {
    http_response_code($kode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function galat(string $pesan, int $kode = 400): never {
    keluar_json(['ok' => false, 'pesan' => $pesan], $kode);
}
function body_json(): array {
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    return is_array($data) ? $data : [];
}
function wajib_post(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') galat('Metode tidak diizinkan.', 405);
}
function wajib_login(): int {
    if (empty($_SESSION['uid'])) galat('Silakan masuk terlebih dahulu.', 401);
    return (int)$_SESSION['uid'];
}
function bersih(mixed $v, int $maks = 255): string {
    return mb_substr(trim((string)$v), 0, $maks);
}
function telepon_valid(string $t): bool {
    return (bool)preg_match('/^(\+62|62|0)8[0-9]{7,12}$/', preg_replace('/[\s-]/', '', $t));
}
function buat_notifikasi(mysqli $db, int $uid, ?int $lombaId, string $pesan): void {
    $db->execute_query(
        'INSERT INTO notifikasi (pengguna_id, lomba_id, pesan) VALUES (?,?,?)',
        [$uid, $lombaId, mb_substr($pesan, 0, 255)]
    );
}

// Data lengkap untuk frontend: profil, pendaftaran lomba, notifikasi.
function data_pengguna(mysqli $db, int $uid): ?array {
    $u = $db->execute_query(
        "SELECT * FROM pengguna WHERE id=? AND role='peserta'", [$uid]
    )->fetch_assoc();
    if (!$u) return null;

    $daftar = [];
    $rows = $db->execute_query(
        "SELECT p.*, l.kode, l.nama AS lomba, k.judul AS karya_judul, k.file_kartu AS karya_file_kartu, k.dikirim_pada
         FROM pendaftaran p
         JOIN lomba l ON l.id = p.lomba_id
         LEFT JOIN karya k ON k.pendaftaran_id = p.id
         WHERE p.pengguna_id=? ORDER BY p.dibuat_pada", [$uid]
    )->fetch_all(MYSQLI_ASSOC);
    foreach ($rows as $r) {
        $daftar[] = [
            'id' => (int)$r['id'], 'kategori' => $r['kode'], 'lomba' => $r['lomba'],
            'peserta' => $r['nama_peserta'], 'tim' => $r['tipe_tim'],
            'anggota2' => $r['anggota2'] ?? '', 'anggota3' => $r['anggota3'] ?? '',
            'nomor' => $r['nomor_induk'], 'asal' => $r['asal'], 'email' => $r['email'], 'wa' => $r['whatsapp'],
            'kartu' => !empty($r['file_kartu']) || !empty($r['karya_file_kartu']),
            'status' => $r['status'], 'tahap' => $r['tahap'], 'catatan' => $r['catatan_admin'] ?? '',
            'waktu' => date('c', strtotime($r['dibuat_pada'])),
            'karya' => $r['karya_judul'] !== null ? ['judul' => $r['karya_judul'], 'waktu' => $r['dikirim_pada']] : null,
        ];
    }

    $notif = [];
    $nr = $db->execute_query(
        "SELECT n.*, l.kode FROM notifikasi n LEFT JOIN lomba l ON l.id=n.lomba_id
         WHERE n.pengguna_id=? ORDER BY n.id DESC LIMIT 50", [$uid]
    )->fetch_all(MYSQLI_ASSOC);
    foreach ($nr as $n) {
        $notif[] = ['id' => (int)$n['id'], 'kategori' => $n['kode'] ?? '', 'pesan' => $n['pesan'],
                    'dibaca' => !empty($n['dibaca']), 'waktu' => $n['dibuat_pada'] ?? ''];
    }

    return [
        'profil' => [
            'nama' => trim($u['nama_depan'] . ' ' . ($u['nama_belakang'] ?? '')),
            'email' => $u['email'], 'telepon' => $u['telepon'] ?? '', 'gender' => $u['gender'],
            'tempat' => $u['tempat_lahir'] ?? '', 'tgl' => $u['tanggal_lahir'], 'alamat' => $u['alamat'] ?? '',
            'dibuat' => substr($u['dibuat_pada'], 0, 10),
        ],
        'daftar' => $daftar,
        'notifikasi' => $notif,
    ];
}
