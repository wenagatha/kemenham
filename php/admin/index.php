<?php
session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'path' => '/']);
session_start();
require __DIR__ . '/../koneksi.php';
$STATUS = ['Terdaftar', 'Karya terkirim', 'Diverifikasi', 'Perlu revisi', 'Ditolak'];
$e = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
$galat = '';

if (isset($_GET['keluar'])) { unset($_SESSION['admin'], $_SESSION['email'], $_SESSION['csrf']); header('Location: index.php'); exit; }

// Kode undangan: hanya orang yang tahu kode ini yang bisa membuat akun admin. Ganti nilainya!
// Kosongkan ('') kalau pendaftaran admin ingin dibuka tanpa kode (tidak disarankan).
const KODE_UNDANGAN = '';

if (isset($_POST['daftar'])) {
    $gagal = function ($k) { header('Location: index.php?daftar=1&galat=' . $k); exit; };
    $nama = trim($_POST['nama'] ?? ''); $email = strtolower(trim($_POST['email'] ?? '')); $pw = $_POST['password'] ?? '';
    if (KODE_UNDANGAN !== '' && !hash_equals(KODE_UNDANGAN, (string)($_POST['kode'] ?? ''))) $gagal('kode');
    if ($nama === '' || mb_strlen($nama) > 60 || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($pw) < 8) $gagal('data');
    if ($koneksi->execute_query('SELECT 1 FROM pengguna WHERE email=?', [$email])->num_rows) $gagal('email');
    $koneksi->execute_query("INSERT INTO pengguna (nama_depan, email, password_hash, role, gender, tanggal_lahir) VALUES (?,?,?,'admin','Laki-laki','1990-01-01')",
        [$nama, $email, password_hash($pw, PASSWORD_DEFAULT)]);
    header('Location: index.php?ok=daftar'); exit;
}

if (isset($_POST['masuk'])) {
    $u = $koneksi->execute_query("SELECT id, nama_depan, password_hash FROM pengguna WHERE email=? AND role='admin'", [trim($_POST['email'] ?? '')])->fetch_assoc();
    if ($u && password_verify($_POST['password'] ?? '', $u['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['admin'] = $u['nama_depan']; $_SESSION['email'] = trim($_POST['email'] ?? ''); $_SESSION['csrf'] = bin2hex(random_bytes(16));
        header('Location: index.php'); exit;
    }
    $galat = 'Email atau kata sandi salah, atau akun ini bukan admin.';
}

if (empty($_SESSION['admin'])) {
    $mode = isset($_GET['daftar']) ? 'daftar' : 'masuk';
    $kodeG = ['kode' => 'Kode undangan salah.', 'data' => 'Isi nama, email yang valid, dan kata sandi minimal 8 karakter.', 'email' => 'Email ini sudah terdaftar. Silakan masuk.'];
    $info = $galat ?: ($kodeG[$_GET['galat'] ?? ''] ?? (($_GET['ok'] ?? '') === 'daftar' ? 'Akun berhasil dibuat. Silakan masuk.' : ''));
    $sukses = ($_GET['ok'] ?? '') === 'daftar'; ?>
<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Kemenham</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1020;color:#e8ecf8;font-family:system-ui,sans-serif}
form{background:#141b34;border:1px solid #243058;border-radius:16px;padding:32px;width:min(380px,90vw);display:grid;gap:12px}
h1{margin:0;font-size:22px}p{margin:0;color:#8e9ac0;font-size:14px}a{color:#facc15}
input{padding:12px;border-radius:10px;border:1px solid #2d3a6b;background:#0b1020;color:inherit;font:inherit}
button{padding:12px;border:0;border-radius:10px;background:#facc15;color:#14183a;font:inherit;font-weight:700;cursor:pointer}p.g{color:#ff9d9d}p.s{color:#7ee7bd}
@media(max-width:600px){form{width:calc(100vw - 64px);padding:24px 20px}}</style></head><body>
<form method="post" action="index.php<?= $mode === 'daftar' ? '?daftar=1' : '' ?>">
<h1><?= $mode === 'daftar' ? 'Buat akun admin' : 'Masuk admin' ?></h1>
<?php if ($info) echo '<p class="' . ($sukses ? 's' : 'g') . '" role="alert">' . $e($info) . '</p>'; ?>
<?php if ($mode === 'daftar') { ?><input name="nama" placeholder="Nama" maxlength="60" required><?php } ?>
<input type="email" name="email" placeholder="Email" required>
<input type="password" name="password" placeholder="Kata sandi<?= $mode === 'daftar' ? ' (minimal 8 karakter)' : '' ?>" required>
<?php if ($mode === 'daftar' && KODE_UNDANGAN !== '') { ?><input type="password" name="kode" placeholder="Kode undangan"><?php } ?>
<button name="<?= $mode === 'daftar' ? 'daftar' : 'masuk' ?>" value="1"><?= $mode === 'daftar' ? 'Buat akun' : 'Masuk' ?></button>
<p><?= $mode === 'daftar' ? 'Sudah punya akun? <a href="index.php">Masuk</a>' : 'Belum punya akun? <a href="index.php?daftar=1">Daftar</a>' ?></p>
</form></body></html>
<?php exit; }

$pesan = ($_GET['ok'] ?? '') === '1' ? 'Status tersimpan dan peserta sudah dikirimi notifikasi.' : '';
if (isset($_POST['ubah'])) {
    if (!hash_equals($_SESSION['csrf'], $_POST['csrf'] ?? '')) { http_response_code(400); exit('Sesi tidak valid. Muat ulang halaman.'); }
    $id = (int)$_POST['id']; $status = $_POST['status'] ?? '';
    if (in_array($status, $STATUS, true)) {
        $koneksi->execute_query('UPDATE pendaftaran SET status=?, catatan_admin=? WHERE id=?', [$status, mb_substr(trim($_POST['catatan'] ?? ''), 0, 255), $id]);
        // Perlu revisi = pengumpulan dibuka lagi supaya peserta bisa unggah ulang
        $koneksi->execute_query("UPDATE pendaftaran p SET p.tahap = IF(?='Perlu revisi', 'terbuka', IF(EXISTS(SELECT 1 FROM karya k WHERE k.pendaftaran_id=p.id), 'terkirim', p.tahap)) WHERE p.id=?", [$status, $id]);
        $teks = 'Status karyamu diperbarui menjadi: ' . $status . '.' . ($status === 'Perlu revisi' ? ' Kamu bisa mengunggah ulang karyamu.' : '') . (trim($_POST['catatan'] ?? '') !== '' ? ' Catatan panitia: ' . mb_substr(trim($_POST['catatan']), 0, 140) : '');
        $koneksi->execute_query('INSERT INTO notifikasi (pengguna_id, lomba_id, pesan) SELECT pengguna_id, lomba_id, ? FROM pendaftaran WHERE id=?', [$teks, $id]);
        header('Location: index.php?ok=1'); exit;
    }
}

$q = trim($_GET['q'] ?? ''); $fl = (int)($_GET['lomba'] ?? 0); $fs = $_GET['status'] ?? '';
$w = ['1=1']; $p = [];
if ($q !== '')  { $w[] = '(p.nama_peserta LIKE ? OR p.asal LIKE ? OR k.judul LIKE ?)'; array_push($p, "%$q%", "%$q%", "%$q%"); }
if ($fl)        { $w[] = 'p.lomba_id=?'; $p[] = $fl; }
if (in_array($fs, $STATUS, true)) { $w[] = 'p.status=?'; $p[] = $fs; }
$baris = $koneksi->execute_query("SELECT p.*, l.nama AS lomba, k.judul, k.file_pdf, k.file_word, k.file_pernyataan, k.dikirim_pada
  FROM pendaftaran p JOIN lomba l ON l.id=p.lomba_id LEFT JOIN karya k ON k.pendaftaran_id=p.id
  WHERE " . implode(' AND ', $w) . " ORDER BY p.dibuat_pada DESC", $p)->fetch_all(MYSQLI_ASSOC);

$tot = $koneksi->query("SELECT COUNT(*) a, (SELECT COUNT(*) FROM karya) b, SUM(status='Karya terkirim') c, SUM(status='Diverifikasi') d FROM pendaftaran")->fetch_assoc();
$g1 = $koneksi->query('SELECT status, COUNT(*) n FROM pendaftaran GROUP BY status')->fetch_all(MYSQLI_ASSOC);
$g2 = $koneksi->query('SELECT l.nama, COUNT(p.id) daftar, COUNT(k.id) karya FROM lomba l LEFT JOIN pendaftaran p ON p.lomba_id=l.id LEFT JOIN karya k ON k.pendaftaran_id=p.id GROUP BY l.id')->fetch_all(MYSQLI_ASSOC);
$g3 = $koneksi->query('SELECT DATE(dibuat_pada) d, COUNT(*) n FROM pendaftaran GROUP BY d ORDER BY d')->fetch_all(MYSQLI_ASSOC);
$lombaList = $koneksi->query('SELECT id, nama FROM lomba')->fetch_all(MYSQLI_ASSOC);
$notif = $koneksi->query('SELECT p.nama_peserta, p.status, l.nama AS lomba, k.judul, k.dikirim_pada FROM karya k JOIN pendaftaran p ON p.id=k.pendaftaran_id JOIN lomba l ON l.id=p.lomba_id ORDER BY k.dikirim_pada DESC LIMIT 8')->fetch_all(MYSQLI_ASSOC);
$perlu = (int)$tot['c'];
$warna = ['Terdaftar' => '#8aa0d6', 'Karya terkirim' => '#4f7cff', 'Diverifikasi' => '#34d399', 'Perlu revisi' => '#facc15', 'Ditolak' => '#f87171'];
$uploads = 'unduh.php?f=';
?>
<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Monitoring karya | Admin Kemenham</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
:root{--bg:#0b1020;--pn:#141b34;--ln:#243058;--tx:#e8ecf8;--mu:#8e9ac0;--kn:#facc15;--bl:#4f7cff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font-family:"Plus Jakarta Sans",system-ui,sans-serif;font-size:14px}
header{display:flex;justify-content:space-between;align-items:center;padding:16px 28px;border-bottom:1px solid var(--ln)}
header b{font-size:17px}header a{color:var(--mu);text-decoration:none;margin-left:16px}
main{padding:24px 28px;max-width:1280px;margin:auto;display:grid;gap:18px}h1{margin:0;font-size:26px}h1+p{margin:4px 0 0;color:var(--mu)}
.kartu{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
.pn{background:var(--pn);border:1px solid var(--ln);border-radius:14px;padding:18px}.pn h2{margin:0 0 12px;font-size:15px;font-weight:600}
.ang{font-size:34px;font-weight:800;margin:6px 0 0}.ang.k{color:var(--kn)}.lbl{color:var(--mu)}
.grafik{display:grid;grid-template-columns:1fr 1.2fr 1.4fr;gap:14px}.grafik canvas{max-height:230px}
.filter{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px}
input,select,textarea{background:var(--bg);color:var(--tx);border:1px solid var(--ln);border-radius:9px;padding:9px 12px;font:inherit}
.btn{background:var(--kn);color:#14183a;border:0;border-radius:9px;padding:9px 16px;font:inherit;font-weight:700;cursor:pointer}.btn.g{background:transparent;color:var(--tx);border:1px solid var(--ln)}
.tb{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:760px}th,td{text-align:left;padding:11px 10px;border-bottom:1px solid var(--ln)}th{color:var(--mu);font-weight:500}
.bd{padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600;background:#ffffff14}.ok{background:#16a34a2e;color:#34d399;padding:10px 14px;border-radius:10px}
dialog{background:var(--pn);color:var(--tx);border:1px solid var(--ln);border-radius:16px;width:min(560px,94vw);padding:24px}dialog::backdrop{background:#000a}
dialog dl{display:grid;grid-template-columns:130px 1fr;gap:6px 12px;margin:14px 0}dt{color:var(--mu)}dd{margin:0}dialog a{color:var(--kn)}
dialog form{display:grid;gap:10px}
@media(max-width:900px){.grafik{grid-template-columns:1fr}}
@media(max-width:600px){
header{flex-wrap:wrap;gap:10px;padding:12px 16px}
header b{font-size:15px}
header .nav{width:100%;flex-wrap:wrap;gap:6px}
header .chip{padding:7px 10px;font-size:12px}
main{padding:20px 16px;gap:14px}
.kartu{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.pn{min-width:0;padding:14px}
.ang{font-size:28px}
.grafik{grid-template-columns:minmax(0,1fr)}
.filter>*{flex:1 1 100%;min-width:0}
.filter .btn{flex:1 1 calc(50% - 5px);text-align:center}
.tb{max-width:100%;overscroll-behavior-x:contain}
dialog{max-height:calc(100dvh - 32px);overflow-y:auto;padding:18px}
dialog dl{grid-template-columns:1fr}
}
:focus-visible{outline:2px solid var(--kn);outline-offset:2px}
.nav{display:flex;gap:10px;align-items:center}.nav a.chip{margin:0}.menu{position:relative}
.chip{list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:99px;border:1px solid var(--ln);color:var(--tx);text-decoration:none;font-weight:600;background:transparent}
.chip::-webkit-details-marker{display:none}.chip.kn{background:var(--kn);border-color:var(--kn);color:#14183a}
.dot{font-style:normal;background:#f87171;color:#fff;border-radius:99px;min-width:20px;padding:1px 6px;font-size:11px;text-align:center}
.drop{position:absolute;right:0;top:calc(100% + 8px);z-index:5;width:min(340px,86vw);background:var(--pn);border:1px solid var(--ln);border-radius:14px;padding:14px;display:grid;gap:4px}
.drop h3{margin:0 0 6px;font-size:14px}.drop p{margin:0}.drop a{display:block;padding:9px 8px;border-radius:9px;color:var(--tx);text-decoration:none;margin:0}.drop a:hover{background:#ffffff0d}
</style></head><body>
<header><b>Admin Kemenham</b>
<nav class="nav">
<details class="menu"><summary class="chip" aria-label="Notifikasi, <?= $perlu ?> karya perlu ditinjau">Notifikasi<?php if ($perlu) echo '<i class="dot">' . $perlu . '</i>'; ?></summary>
<div class="drop"><h3>Karya terbaru</h3>
<?php if (!$notif) echo '<p class="lbl">Belum ada karya masuk.</p>';
foreach ($notif as $n) { ?><a href="?q=<?= urlencode($n['nama_peserta']) ?>"><b><?= $e($n['nama_peserta']) ?></b> mengirim karya “<?= $e($n['judul']) ?>”<br><span class="lbl"><?= $e($n['lomba']) ?> · <?= $e(date('d M Y', strtotime($n['dikirim_pada']))) ?> · <?= $e($n['status']) ?></span></a><?php } ?>
</div></details>
<details class="menu"><summary class="chip">Akun</summary>
<div class="drop"><h3><?= $e($_SESSION['admin']) ?></h3><p class="lbl"><?= $e($_SESSION['email'] ?? '') ?><br>Peran: Admin</p></div></details>
<a class="chip kn" href="?keluar=1">Keluar</a>
</nav></header>
<main>
<div><h1>Monitoring karya peserta</h1><p>Pantau pendaftaran dan karya yang masuk, lalu perbarui statusnya.</p></div>
<?php if ($pesan) echo '<div class="ok">' . $e($pesan) . '</div>'; ?>
<section class="kartu">
<div class="pn"><span class="lbl">Total pendaftar</span><div class="ang"><?= (int)$tot['a'] ?></div></div>
<div class="pn"><span class="lbl">Karya masuk</span><div class="ang"><?= (int)$tot['b'] ?></div></div>
<div class="pn"><span class="lbl">Perlu ditinjau</span><div class="ang k"><?= (int)$tot['c'] ?></div></div>
<div class="pn"><span class="lbl">Sudah diverifikasi</span><div class="ang"><?= (int)$tot['d'] ?></div></div>
</section>
<section class="grafik">
<div class="pn"><h2>Status karya</h2><canvas id="c1"></canvas></div>
<div class="pn"><h2>Pendaftar dan karya per lomba</h2><canvas id="c2"></canvas></div>
<div class="pn"><h2>Pendaftaran per hari</h2><canvas id="c3"></canvas></div>
</section>
<section class="pn">
<form class="filter" method="get">
<input type="search" name="q" value="<?= $e($q) ?>" placeholder="Cari nama, asal, atau judul" aria-label="Cari">
<select name="lomba" aria-label="Lomba"><option value="0">Semua lomba</option><?php foreach ($lombaList as $l) echo '<option value="' . $l['id'] . '"' . ($fl == $l['id'] ? ' selected' : '') . '>' . $e($l['nama']) . '</option>'; ?></select>
<select name="status" aria-label="Status"><option value="">Semua status</option><?php foreach ($STATUS as $s) echo '<option' . ($fs === $s ? ' selected' : '') . '>' . $e($s) . '</option>'; ?></select>
<button class="btn">Terapkan</button><a class="btn g" href="index.php" style="text-decoration:none">Atur ulang</a>
</form>
<div class="tb"><table><thead><tr><th>Peserta</th><th>Lomba</th><th>Judul karya</th><th>Dikirim</th><th>Status</th><th></th></tr></thead><tbody>
<?php if (!$baris) echo '<tr><td colspan="6" class="lbl">Belum ada data yang cocok dengan filter ini.</td></tr>';
foreach ($baris as $r) { $js = $e(json_encode($r, JSON_HEX_APOS | JSON_UNESCAPED_UNICODE)); ?>
<tr><td><b><?= $e($r['nama_peserta']) ?></b><br><span class="lbl"><?= $e($r['asal']) ?></span></td><td><?= $e($r['lomba']) ?></td>
<td><?= $r['judul'] ? $e($r['judul']) : '<span class="lbl">Belum mengirim</span>' ?></td>
<td><?= $r['dikirim_pada'] ? $e(date('d M Y', strtotime($r['dikirim_pada']))) : '-' ?></td>
<td><span class="bd" style="color:<?= $warna[$r['status']] ?? '#fff' ?>"><?= $e($r['status']) ?></span></td>
<td><button class="btn g" type="button" data-r="<?= $js ?>">Tinjau</button></td></tr>
<?php } ?></tbody></table></div></section>
</main>
<dialog id="dlg"><h2 id="d-judul" style="margin:0"></h2><dl id="d-isi"></dl>
<form method="post"><input type="hidden" name="csrf" value="<?= $e($_SESSION['csrf']) ?>"><input type="hidden" name="id" id="d-id">
<label>Status<br><select name="status" id="d-status" style="width:100%"><?php foreach ($STATUS as $s) echo '<option>' . $e($s) . '</option>'; ?></select></label>
<label>Catatan untuk peserta (opsional)<br><textarea name="catatan" id="d-cat" rows="3" maxlength="255" style="width:100%"></textarea></label>
<div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn g" onclick="dlg.close()">Tutup</button><button class="btn" name="ubah" value="1">Simpan status</button></div></form></dialog>
<script>
const dlg = document.getElementById('dlg'), U = <?= json_encode($uploads) ?>;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tautan = (f, t) => f ? `<a href="${U + encodeURIComponent(f)}&lihat=1" target="_blank">${t}</a>` : '';
document.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => {
  const r = JSON.parse(b.dataset.r);
  d_judul.textContent = r.judul || 'Belum ada karya';
  d_isi.innerHTML = [['Peserta', r.nama_peserta + ' (' + r.tipe_tim + ')'], ['Lomba', r.lomba], ['Nomor induk', r.nomor_induk], ['Asal', r.asal],
    ['Email', r.email], ['WhatsApp', r.whatsapp],
    ['Berkas', [tautan(r.file_pdf, 'PDF karya'), tautan(r.file_word, 'Word'), tautan(r.file_kartu, 'Kartu'), tautan(r.file_pernyataan, 'Pernyataan')].filter(Boolean).join(' · ') || 'Belum ada berkas']
  ].map(x => `<dt>${x[0]}</dt><dd>${x[0] === 'Berkas' ? x[1] : esc(x[1])}</dd>`).join('');
  d_id.value = r.id; d_status.value = r.status; d_cat.value = r.catatan_admin || '';
  dlg.showModal();
}));
Chart.defaults.color = '#8e9ac0'; Chart.defaults.borderColor = '#243058';
const W = <?= json_encode($warna) ?>, G1 = <?= json_encode($g1) ?>, G2 = <?= json_encode($g2) ?>, G3 = <?= json_encode($g3) ?>;
new Chart(c1, {type:'doughnut', data:{labels:G1.map(x=>x.status), datasets:[{data:G1.map(x=>+x.n), backgroundColor:G1.map(x=>W[x.status]), borderWidth:0}]}, options:{cutout:'62%', plugins:{legend:{position:'bottom'}}}});
new Chart(c2, {type:'bar', data:{labels:G2.map(x=>x.nama), datasets:[{label:'Pendaftar', data:G2.map(x=>+x.daftar), backgroundColor:'#4f7cff', borderRadius:6},{label:'Karya masuk', data:G2.map(x=>+x.karya), backgroundColor:'#facc15', borderRadius:6}]}, options:{scales:{y:{beginAtZero:true, ticks:{precision:0}}}}});
new Chart(c3, {type:'line', data:{labels:G3.map(x=>x.d), datasets:[{label:'Pendaftar', data:G3.map(x=>+x.n), borderColor:'#facc15', backgroundColor:'#facc1522', fill:true, tension:.35}]}, options:{plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true, ticks:{precision:0}}}}});
document.addEventListener('click', e => document.querySelectorAll('details.menu[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; }));
</script></body></html>
