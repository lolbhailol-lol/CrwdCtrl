/**
 * Recompress oversized bundled images IN PLACE (same path + extension) so
 * Vite imports keep working unchanged. Shrinks the Android AAB / web bundle.
 *
 * Usage: node scripts/optimize-large-images.mjs [minBytes] [maxWidth]
 *   minBytes default 1048576 (1 MB) — only files larger than this are touched.
 *   maxWidth default 1280 — downscale only (never upscale).
 */
import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import sharp from 'sharp';

const ROOT = join(process.cwd(), 'src');
const MIN_BYTES = Number(process.argv[2]) || 1024 * 1024;
const MAX_WIDTH = Number(process.argv[3]) || 1280;
const EXTS = new Set(['.png', '.jpg', '.jpeg']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(extname(name).toLowerCase()) && st.size > MIN_BYTES) {
      out.push({ full, size: st.size });
    }
  }
  return out;
}

const targets = walk(ROOT).sort((a, b) => b.size - a.size);
if (!targets.length) {
  console.log('No images above threshold. Nothing to do.');
  process.exit(0);
}

let before = 0;
let after = 0;

for (const { full, size } of targets) {
  before += size;
  const ext = extname(full).toLowerCase();
  const input = readFileSync(full);
  const img = sharp(input, { failOn: 'none' });
  const meta = await img.metadata();
  const pipeline = sharp(input, { failOn: 'none' }).rotate();

  if (meta.width && meta.width > MAX_WIDTH) {
    pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }

  let out;
  if (ext === '.png') {
    // Lossy palette quantization keeps the .png extension while cutting size hard.
    out = await pipeline.png({ compressionLevel: 9, quality: 80, palette: true }).toBuffer();
  } else {
    out = await pipeline.jpeg({ quality: 78, mozjpeg: true }).toBuffer();
  }

  // Only write if we actually saved space.
  if (out.length < size) {
    writeFileSync(full, out);
    after += out.length;
    const rel = full.replace(process.cwd() + '\\', '').replace(process.cwd() + '/', '');
    console.log(
      `${(size / 1048576).toFixed(2)}MB -> ${(out.length / 1048576).toFixed(2)}MB  ${rel}`,
    );
  } else {
    after += size;
  }
}

console.log(
  `\nTotal: ${(before / 1048576).toFixed(1)}MB -> ${(after / 1048576).toFixed(1)}MB ` +
    `(saved ${((before - after) / 1048576).toFixed(1)}MB across ${targets.length} files)`,
);
