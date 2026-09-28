import { deflateSync, crc32 } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const NAVY = [0x0b, 0x1f, 0x33, 255];
const ORANGE = [0xf5, 0xa6, 0x23, 255];
const CREAM = [0xf7, 0xf4, 0xee, 255];
const GRID = [0x0b, 0x1f, 0x33, 70];
const CLEAR = [0, 0, 0, 0];

function chunk(type, data) {
  const header = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = crc32(Buffer.concat([header, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0);
  return Buffer.concat([len, header, data, crcBuf]);
}

function png(width, height, getPixel) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const p = getPixel(x, y);
      const o = row + 1 + x * 4;
      raw[o] = p[0];
      raw[o + 1] = p[1];
      raw[o + 2] = p[2];
      raw[o + 3] = p[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function roundedRect(x, y, w, h, rx, px, py) {
  const lx = px - x;
  const ly = py - y;
  if (lx < 0 || ly < 0 || lx >= w || ly >= h) return false;
  const r = Math.min(rx, w / 2, h / 2);
  if (lx >= r && lx < w - r) return true;
  if (ly >= r && ly < h - r) return true;
  const cx = lx < r ? r : w - r;
  const cy = ly < r ? r : h - r;
  return (lx - cx) ** 2 + (ly - cy) ** 2 <= r * r;
}

function stadium(x, y, w, h, px, py) {
  return roundedRect(x, y, w, h, h / 2, px, py);
}

/** Calendar glyph in a 0..1 box. Returns a colour or null when outside the mark. */
function glyph(u, v) {
  const px = u * 1024;
  const py = v * 1024;
  const ring = (x) => stadium(x, 176, 64, 160, px, py);
  if (ring(340) || ring(620)) return ORANGE;
  if (!roundedRect(220, 268, 584, 588, 56, px, py)) return null;
  if (py < 456) return ORANGE;
  const cols = 7;
  const rows = 5;
  const gridX = 276;
  const gridY = 500;
  const gridW = 472;
  const gridH = 292;
  const cellW = gridW / cols;
  const cellH = gridH / rows;
  const col = Math.floor((px - gridX) / cellW);
  const row = Math.floor((py - gridY) / cellH);
  if (col >= 0 && col < cols && row >= 0 && row < rows) {
    const inset = 10;
    const cx = gridX + col * cellW + inset;
    const cy = gridY + row * cellH + inset;
    if (roundedRect(cx, cy, cellW - inset * 2, cellH - inset * 2, 8, px, py)) {
      return col === 3 && row === 1 ? ORANGE : GRID;
    }
  }
  return CREAM;
}

function iconPixel(x, y, size, background) {
  const p = glyph(x / size, y / size);
  if (!p) return background;
  return p;
}

function iconAt(size) {
  return png(size, size, (x, y) => iconPixel(x, y, size, NAVY));
}

function foregroundAt(size) {
  return png(size, size, (x, y) => iconPixel(x, y, size, CLEAR));
}

function splashPng() {
  const size = 2732;
  const mark = 980;
  const ox = Math.floor((size - mark) / 2);
  const oy = Math.floor((size - mark) / 2) - 40;
  return png(size, size, (x, y) => {
    if (x >= ox && x < ox + mark && y >= oy && y < oy + mark) {
      const p = iconPixel(x - ox, y - oy, mark, CLEAR);
      if (p[3] !== 0) return p;
    }
    return NAVY;
  });
}

const resources = path.join(root, "resources");
const pub = path.join(root, "public");
await mkdir(resources, { recursive: true });
await mkdir(pub, { recursive: true });

const icon = iconAt(1024);
await writeFile(path.join(resources, "icon.png"), icon);
await writeFile(path.join(resources, "icon-only.png"), icon);
await writeFile(path.join(resources, "icon-foreground.png"), foregroundAt(1024));
await writeFile(path.join(resources, "icon-background.png"), png(1024, 1024, () => NAVY));
await writeFile(path.join(resources, "splash.png"), splashPng());
await writeFile(path.join(pub, "apple-touch-icon.png"), iconAt(180));

const favicon = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="7" fill="#0B1F33"/>
  <rect x="7" y="9" width="18" height="16" rx="2.5" fill="#F7F4EE"/>
  <rect x="7" y="9" width="18" height="5" rx="2.5" fill="#F5A623"/>
  <rect x="7" y="12" width="18" height="2" fill="#F5A623"/>
  <rect x="11" y="7" width="2" height="4" rx="1" fill="#F5A623"/>
  <rect x="19" y="7" width="2" height="4" rx="1" fill="#F5A623"/>
  <rect x="10" y="16.5" width="3" height="2.2" rx="0.4" fill="#0B1F33" opacity="0.25"/>
  <rect x="14.5" y="16.5" width="3" height="2.2" rx="0.4" fill="#F5A623"/>
  <rect x="19" y="16.5" width="3" height="2.2" rx="0.4" fill="#0B1F33" opacity="0.25"/>
  <rect x="10" y="20" width="3" height="2.2" rx="0.4" fill="#0B1F33" opacity="0.25"/>
  <rect x="14.5" y="20" width="3" height="2.2" rx="0.4" fill="#0B1F33" opacity="0.25"/>
  <rect x="19" y="20" width="3" height="2.2" rx="0.4" fill="#0B1F33" opacity="0.25"/>
</svg>
`;
await writeFile(path.join(root, "scripts", "favicon.svg"), favicon);
await writeFile(path.join(pub, "favicon.svg"), favicon);

console.log("Wrote navy/orange calendar icon and splash.");
