/**
 * Rasterize category sources to crisp 3× WebP for iOS retina.
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

/**
 * Target fill ratio for the visible (trimmed) content inside the canvas.
 * Fests/Sports/Treks SVGs naturally land near 87% × 91% — keep events PNGs in lockstep.
 */
const EVENTS_FILL_W = 0.872;
const EVENTS_FILL_H = 0.91;

/** @type {{ out: string; src: string; trimAndFit?: boolean }[]} */
const ICONS = [
  { out: 'fests-light.webp', src: 'FEST.svg' },
  { out: 'sports-light.webp', src: 'SPORTS.svg' },
  { out: 'treks-light.webp', src: 'trek.svg' },
  { out: 'events-light.webp', src: 'events-light.png', trimAndFit: true },
  { out: 'fests-dark.webp', src: 'fest-dark.svg' },
  { out: 'sports-dark.webp', src: 'sports-dark.svg' },
  { out: 'treks-dark.webp', src: 'treks-dark.svg' },
  { out: 'events-dark.webp', src: 'events-dark.png', trimAndFit: true },
];

/** Trim transparent padding, then resize content to match visual weight of the others. */
async function buildEventsRaster(inputBuffer) {
  const trimmed = await sharp(inputBuffer)
    .trim()
    .png()
    .toBuffer({ resolveWithObject: true });

  const innerW = Math.round(OUT_W * EVENTS_FILL_W);
  const innerH = Math.round(OUT_H * EVENTS_FILL_H);

  const inner = await sharp(trimmed.data)
    .resize(innerW, innerH, {
      fit: 'inside',
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false,
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  const padX = Math.max(0, Math.round((OUT_W - inner.info.width) / 2));
  const padY = Math.max(0, Math.round((OUT_H - inner.info.height) / 2));

  return sharp(inner.data).extend({
    top: padY,
    bottom: OUT_H - inner.info.height - padY,
    left: padX,
    right: OUT_W - inner.info.width - padX,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
}

async function buildSvgRaster(inputBuffer) {
  return sharp(inputBuffer, { density: 288 }).resize(OUT_W, OUT_H, {
    fit: 'contain',
    kernel: sharp.kernel.lanczos3,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
}

async function optimizeOne({ out, src, trimAndFit = false }) {
  const input = path.join(iconsDir, src);
  const output = path.join(outDir, out);
  const inputBuffer = await readFile(input);
  const isSvg = src.toLowerCase().endsWith('.svg');

  const pipeline = isSvg
    ? await buildSvgRaster(inputBuffer)
    : trimAndFit
      ? await buildEventsRaster(inputBuffer)
      : sharp(inputBuffer).resize(OUT_W, OUT_H, {
          fit: 'contain',
          kernel: sharp.kernel.lanczos3,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        });

  await pipeline
    .png()
    .toBuffer()
    .then((buf) =>
      sharp(buf)
        .webp({
          quality: 98,
          alphaQuality: 100,
          effort: 6,
          smartSubsample: false,
          nearLossless: true,
        })
        .toFile(output),
    );

  const bytes = (await readFile(output)).length;
  const note = trimAndFit ? `  trim+fit ${(EVENTS_FILL_W * 100).toFixed(0)}×${(EVENTS_FILL_H * 100).toFixed(0)}%` : '';
  console.log(`${out}  ${OUT_W}×${OUT_H}  ${(bytes / 1024).toFixed(1)} KB  ← ${src}${note}`);
  return bytes;
}

await mkdir(outDir, { recursive: true });

let total = 0;
for (const icon of ICONS) {
  total += await optimizeOne(icon);
}

console.log(`\nTotal WebP: ${(total / 1024).toFixed(1)} KB @ ${SCALE}× (${OUT_W}×${OUT_H}px)`);
