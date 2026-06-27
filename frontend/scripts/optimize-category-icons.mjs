/**
 * Rasterize bloated category SVGs (~3MB each) to crisp 3× WebP for iOS retina.
 * Run: node scripts/optimize-category-icons.mjs
 */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const iconsDir = path.join(root, 'src', 'assets', 'mobile-icons');
const outDir = path.join(root, 'public', 'category-icons');

/** Native artboard 78×85 — export at 3× for iPhone Pro / high-DPI Android */
const SCALE = 3;
const NATIVE_W = 78;
const NATIVE_H = 85;
const OUT_W = NATIVE_W * SCALE;
const OUT_H = NATIVE_H * SCALE;

/** @type {{ out: string; src: string }[]} */
const ICONS = [
  { out: 'fests-light.webp', src: 'FEST.svg' },
  { out: 'sports-light.webp', src: 'SPORTS.svg' },
  { out: 'treks-light.webp', src: 'trek.svg' },
  { out: 'theatre-light.webp', src: 'THETRE.svg' },
  { out: 'fests-dark.webp', src: 'fest-dark.svg' },
  { out: 'sports-dark.webp', src: 'sports-dark.svg' },
  { out: 'treks-dark.webp', src: 'treks-dark.svg' },
  { out: 'theatre-dark.webp', src: 'theatre-dark.svg' },
];

async function optimizeOne({ out, src }) {
  const input = path.join(iconsDir, src);
  const output = path.join(outDir, out);
  const svg = await readFile(input);

  // High-density SVG raster → resize with Lanczos3 → near-lossless WebP
  await sharp(svg, { density: 288 })
    .resize(OUT_W, OUT_H, {
      fit: 'contain',
      kernel: sharp.kernel.lanczos3,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({
      quality: 98,
      alphaQuality: 100,
      effort: 6,
      smartSubsample: false,
      nearLossless: true,
    })
    .toFile(output);

  const bytes = (await readFile(output)).length;
  console.log(`${out}  ${OUT_W}×${OUT_H}  ${(bytes / 1024).toFixed(1)} KB`);
  return bytes;
}

await mkdir(outDir, { recursive: true });

let total = 0;
for (const icon of ICONS) {
  total += await optimizeOne(icon);
}

console.log(`\nTotal WebP: ${(total / 1024).toFixed(1)} KB @ ${SCALE}× (${OUT_W}×${OUT_H}px)`);