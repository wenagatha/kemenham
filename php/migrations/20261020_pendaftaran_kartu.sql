ALTER TABLE pendaftaran
  ADD COLUMN file_kartu VARCHAR(255) NULL AFTER whatsapp;

UPDATE pendaftaran p
JOIN karya k ON k.pendaftaran_id = p.id
SET p.file_kartu = k.file_kartu
WHERE p.file_kartu IS NULL
  AND k.file_kartu IS NOT NULL
  AND k.file_kartu <> '';
