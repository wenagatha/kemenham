<?php
function kh_zip_write_all($stream, string $data): bool {
    $length = strlen($data);
    $written = 0;
    while ($written < $length) {
        $result = fwrite($stream, substr($data, $written));
        if ($result === false || $result === 0) return false;
        $written += $result;
    }
    return true;
}

function kh_zip_add_files(array $files, string $destination): bool {
    if (count($files) > 0xffff) return false;
    $output = @fopen($destination, 'wb');
    if (!$output) return false;

    $now = getdate();
    $year = max(1980, (int)$now['year']);
    $dosTime = ((int)$now['hours'] << 11) | ((int)$now['minutes'] << 5) | ((int)$now['seconds'] >> 1);
    $dosDate = (($year - 1980) << 9) | ((int)$now['mon'] << 5) | (int)$now['mday'];
    $entries = [];
    $ok = true;

    foreach ($files as [$path, $name]) {
        $size = @filesize($path);
        $crcHex = @hash_file('crc32b', $path);
        if ($size === false || $size > 0xffffffff || $crcHex === false || !preg_match('/^[\x20-\x7e]+$/', $name)) {
            $ok = false;
            break;
        }
        $nameLength = strlen($name);
        if ($nameLength > 0xffff) {
            $ok = false;
            break;
        }

        $offset = ftell($output);
        if ($offset === false || $offset > 0xffffffff) {
            $ok = false;
            break;
        }
        $crc = hexdec($crcHex);
        $header = pack('VvvvvvVVVvv', 0x04034b50, 20, 0, 0, $dosTime, $dosDate, $crc, $size, $size, $nameLength, 0);
        if (!kh_zip_write_all($output, $header . $name)) {
            $ok = false;
            break;
        }

        $input = @fopen($path, 'rb');
        if (!$input) {
            $ok = false;
            break;
        }
        $copied = stream_copy_to_stream($input, $output);
        fclose($input);
        if ($copied !== $size) {
            $ok = false;
            break;
        }
        $entries[] = [$name, $nameLength, $crc, $size, $offset];
    }

    if ($ok) {
        $centralOffset = ftell($output);
        if ($centralOffset === false || $centralOffset > 0xffffffff) {
            $ok = false;
        } else {
            foreach ($entries as [$name, $nameLength, $crc, $size, $offset]) {
                $header = pack(
                    'VvvvvvvVVVvvvvvVV',
                    0x02014b50, 20, 20, 0, 0, $dosTime, $dosDate,
                    $crc, $size, $size, $nameLength, 0, 0, 0, 0, 0, $offset
                );
                if (!kh_zip_write_all($output, $header . $name)) {
                    $ok = false;
                    break;
                }
            }
            $centralSize = ftell($output);
            if ($centralSize === false) {
                $ok = false;
            } else {
                $centralSize -= $centralOffset;
                if ($centralSize > 0xffffffff) {
                    $ok = false;
                } elseif ($ok) {
                    $count = count($entries);
                    $end = pack('VvvvvVVv', 0x06054b50, 0, 0, $count, $count, $centralSize, $centralOffset, 0);
                    $ok = kh_zip_write_all($output, $end);
                }
            }
        }
    }

    if (!fclose($output)) $ok = false;
    return $ok;
}
