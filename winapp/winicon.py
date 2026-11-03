"""The yellow Notes icon for Windows, with no extra tools: drawn here in plain Python.

  python3 winicon.py ico notes.ico     a multi-size .ico (16 to 256 px) for shortcuts, the installer, window and tray
  python3 winicon.py exe Notes.exe     puts the same icon inside Notes.exe (in place of the runtime's own), so
                                       File Explorer shows it too

Same art as the Mac and iPhone icons (yellow gradient, three white lines), with rounded corners like the Mac Dock.
"""
import struct, sys, zlib

TOP, BOTTOM = (255, 219, 89), (245, 173, 26)          # the icon's yellow gradient, top to bottom
LINES = [(0.46, 0.33), (0.46, 0.47), (0.30, 0.61)]    # (width, top) of each line, in fractions of the icon
SS = 4                                                 # samples per pixel per axis, for smooth edges


def _inside_round_rect(x, y, x0, y0, x1, y1, r):
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r and x0 <= x <= x1 and y0 <= y <= y1


def render(size):
    """RGBA rows, top to bottom."""
    rows = []
    corner = 0.18
    for py in range(size):
        row = bytearray()
        for px in range(size):
            cover = line = 0
            for sy in range(SS):
                for sx in range(SS):
                    x = (px + (sx + 0.5) / SS) / size
                    y = (py + (sy + 0.5) / SS) / size
                    if not _inside_round_rect(x, y, 0, 0, 1, 1, corner):
                        continue
                    cover += 1
                    if any(_inside_round_rect(x, y, 0.27, top, 0.27 + w, top + 0.05, 0.025) for w, top in LINES):
                        line += 1
            if not cover:
                row += b'\0\0\0\0'
                continue
            t = (py + 0.5) / size
            bg = [TOP[i] + (BOTTOM[i] - TOP[i]) * t for i in range(3)]
            mix = line / cover * 0.92                   # white lines at 92% over the yellow
            rgb = [round(c + (255 - c) * mix) for c in bg]
            row += bytes(rgb + [round(255 * cover / (SS * SS))])
        rows.append(bytes(row))
    return rows


def png(size):
    rows = render(size)
    raw = b''.join(b'\0' + r for r in rows)
    chunk = lambda t, data: struct.pack('>I', len(data)) + t + data + struct.pack('>I', zlib.crc32(t + data) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def dib(size):
    """A classic 32-bit icon bitmap (BGRA, bottom-up, with an all-clear AND mask)."""
    rows = render(size)
    pixels = b''.join(bytes(b for i in range(0, len(r), 4) for b in (r[i + 2], r[i + 1], r[i], r[i + 3])) for r in reversed(rows))
    mask = b'\0' * (((size + 31) // 32) * 4 * size)
    return struct.pack('<IiiHHIIiiII', 40, size, size * 2, 1, 32, 0, len(pixels) + len(mask), 0, 0, 0, 0) + pixels + mask


def make_ico(path):
    sizes = [16, 24, 32, 48, 64, 128, 256]
    images = [dib(s) if s <= 48 else png(s) for s in sizes]
    out = struct.pack('<HHH', 0, 1, len(sizes))
    offset = 6 + 16 * len(sizes)
    for s, img in zip(sizes, images):
        out += struct.pack('<BBBBHHII', s % 256, s % 256, 0, 0, 1, 32, len(img), offset)
        offset += len(img)
    open(path, 'wb').write(out + b''.join(images))


def patch_exe(path):
    """Replace the program's icon images in place (each new image fits in the old one's space)."""
    f = open(path, 'r+b')
    head = f.read(4096)
    pe = struct.unpack_from('<I', head, 0x3c)[0]
    nsec, optsz = struct.unpack_from('<H', head, pe + 6)[0], struct.unpack_from('<H', head, pe + 20)[0]
    opt = pe + 24
    dirs = opt + (112 if struct.unpack_from('<H', head, opt)[0] == 0x20b else 96)
    rsrc_rva = struct.unpack_from('<I', head, dirs + 16)[0]
    if struct.unpack_from('<I', head, dirs + 32)[0]:
        sys.exit('Notes.exe is code-signed: changing its icon would break the signature')
    sections = [struct.unpack_from('<IIII', head, opt + optsz + 40 * i + 8) for i in range(nsec)]

    def off(rva):
        for vsize, va, rawsize, rawptr in sections:
            if va <= rva < va + max(vsize, rawsize):
                return rva - va + rawptr
        raise ValueError('address outside the file')

    def read(o, n):
        f.seek(o); return f.read(n)

    base = off(rsrc_rva)

    def entries(o):
        named, ids = struct.unpack('<HH', read(o + 12, 4))
        return [struct.unpack('<II', read(o + 16 + 8 * i, 8)) for i in range(named + ids)]

    def leaves(type_id):                               # {resource id: (data-entry offset, data offset, size)}
        found = {}
        for tid, toff in entries(base):
            if tid != type_id:
                continue
            for rid, roff in entries(base + (toff & 0x7fffffff)):
                for _, loff in entries(base + (roff & 0x7fffffff)):
                    rva, size = struct.unpack('<II', read(base + loff, 8))
                    found[rid] = (base + loff, off(rva), size)
        return found

    icons, groups = leaves(3), leaves(14)
    for _, (_, gdata, _) in groups.items():
        count = struct.unpack('<H', read(gdata + 4, 2))[0]
        for k in range(count):
            e = gdata + 6 + 14 * k
            w, h, _, _, planes, bits, nbytes, rid = struct.unpack('<BBBBHHIH', read(e, 14))
            size = w or 256
            entry, data, old = icons[rid]
            new = png(size) if read(data, 4) == b'\x89PNG' else dib(size)
            if len(new) > old:
                new = png(size)                            # PNG is smaller still
            if len(new) > old:
                sys.exit(f'the {size} px icon doesn\'t fit ({len(new)} > {old} bytes)')
            f.seek(data); f.write(new + b'\0' * (old - len(new)))
            f.seek(entry + 4); f.write(struct.pack('<I', len(new)))
            f.seek(e); f.write(struct.pack('<BBBBHHIH', w, h, 0, 0, 1, 32, len(new), rid))
            print(f'  {size} px icon replaced ({len(new)} of {old} bytes)')
    f.close()


if __name__ == '__main__':
    {'ico': make_ico, 'exe': patch_exe}[sys.argv[1]](sys.argv[2])
