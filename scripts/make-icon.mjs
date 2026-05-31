import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve(import.meta.dirname, "..");
const outFile = path.join(root, "assets", "icon.png");
const size = 512;
const data = Buffer.alloc((size * 4 + 1) * size);

for (let y = 0; y < size; y += 1) {
  const row = y * (size * 4 + 1);
  data[row] = 0;
  for (let x = 0; x < size; x += 1) {
    const offset = row + 1 + x * 4;
    const nx = (x / (size - 1)) * 2 - 1;
    const ny = (y / (size - 1)) * 2 - 1;
    const radius = Math.sqrt(nx * nx + ny * ny);
    const inSeal = Math.max(Math.abs(nx), Math.abs(ny)) < 0.86;
    const onGoldRing = radius > 0.58 && radius < 0.67;
    const onSlash = Math.abs(nx + ny * 0.62) < 0.07 && Math.abs(nx) < 0.58 && Math.abs(ny) < 0.58;
    const onDot = Math.sqrt((nx - 0.24) ** 2 + (ny + 0.28) ** 2) < 0.12;

    let r = 25;
    let g = 24;
    let b = 22;
    let a = inSeal ? 255 : 0;

    if (inSeal) {
      r = Math.round(118 + 42 * (1 - radius));
      g = Math.round(29 + 14 * (1 - radius));
      b = Math.round(25 + 10 * (1 - radius));
    }

    if (onGoldRing || onSlash || onDot) {
      r = 224;
      g = 178;
      b = 78;
      a = 255;
    }

    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = a;
  }
}

await fs.promises.mkdir(path.dirname(outFile), { recursive: true });
await fs.promises.writeFile(outFile, png(size, size, data));
console.log(`wrote ${outFile}`);

function png(width, height, raw) {
  const signature = Buffer.from("89504e470d0a1a0a", "hex");
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr(width, height)),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function ihdr(width, height) {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  return buffer;
}

function chunk(type, payload) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, payload])), 0);
  return Buffer.concat([length, name, payload, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
