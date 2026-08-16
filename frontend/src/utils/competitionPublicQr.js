import QRCode from 'qrcode';
import markLogoUrl from '../assets/crwdctrl-mark.png';
import { competitionPath } from './slugRoutes';

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function safeFileName(value, fallback = 'competition') {
    return String(value || fallback)
        .replace(/[^\w\-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 60) || fallback;
}

/**
 * Public competition page URL encoded in the QR.
 * Uses title slug (e.g. /competitions-view-details/flash); falls back to id.
 */
export function competitionPublicPageUrl(competition) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const path = competitionPath(competition || {});
    if (!path || path.endsWith('/')) return '';
    return `${origin}${path}`;
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Logo failed to load'));
        img.src = src;
    });
}

/**
 * Load mark with black plate removed, cropped tight to the "ctrl." glyphs only
 * (no empty square padding → QR modules can sit close around the word).
 */
async function loadCroppedTransparentMark(src) {
    const img = await loadImage(src);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const full = document.createElement('canvas');
    full.width = w;
    full.height = h;
    const fctx = full.getContext('2d', { willReadFrequently: true });
    if (!fctx) return { canvas: img, width: w, height: h };

    fctx.drawImage(img, 0, 0);
    const imageData = fctx.getImageData(0, 0, w, h);
    const d = imageData.data;

    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;

    for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const a = d[i + 3];

        // Black / near-black plate → transparent
        if (r < 40 && g < 40 && b < 40) {
            d[i + 3] = 0;
            continue;
        }

        if (a < 12) {
            d[i + 3] = 0;
            continue;
        }

        const px = (i / 4) % w;
        const py = Math.floor((i / 4) / w);
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
    }

    fctx.putImageData(imageData, 0, 0);

    if (maxX <= minX || maxY <= minY) {
        return { canvas: full, width: w, height: h };
    }

    // Tiny bleed so glyph edges aren't clipped
    const pad = 4;
    const sx = Math.max(0, minX - pad);
    const sy = Math.max(0, minY - pad);
    const sw = Math.min(w - sx, maxX - minX + 1 + pad * 2);
    const sh = Math.min(h - sy, maxY - minY + 1 + pad * 2);

    const cropped = document.createElement('canvas');
    cropped.width = sw;
    cropped.height = sh;
    const cctx = cropped.getContext('2d');
    if (!cctx) return { canvas: full, width: w, height: h };
    cctx.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);
    return { canvas: cropped, width: sw, height: sh };
}

/**
 * Square PNG: QR with transparent "ctrl." mark centered.
 * Modules wrap the glyphs — no black plate, no cyan frame, no big white badge.
 */
export async function buildBrandedCompetitionQrDataUrl(url, {
    size = 1024,
    margin = 1,
    /** Target width of the wordmark relative to QR size */
    logoWidthRatio = 0.34,
} = {}) {
    if (!url) throw new Error('Missing competition URL');

    const qrDataUrl = await QRCode.toDataURL(url, {
        width: size,
        margin,
        errorCorrectionLevel: 'H',
        color: { dark: '#111213', light: '#ffffff' },
    });

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');

    const qrImg = await loadImage(qrDataUrl);
    ctx.drawImage(qrImg, 0, 0, size, size);

    try {
        const { canvas: logo, width: lw, height: lh } = await loadCroppedTransparentMark(markLogoUrl);
        const logoW = Math.round(size * logoWidthRatio);
        const logoH = Math.max(1, Math.round(logoW * (lh / Math.max(1, lw))));

        // Thin white quiet zone only — just enough for scanners, not a plate
        const padX = Math.round(logoW * 0.1);
        const padY = Math.round(logoH * 0.14);
        const clearW = logoW + padX * 2;
        const clearH = logoH + padY * 2;
        const clearX = (size - clearW) / 2;
        const clearY = (size - clearH) / 2;
        const radius = Math.max(6, Math.round(Math.min(clearW, clearH) * 0.18));

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(clearX + radius, clearY);
        ctx.arcTo(clearX + clearW, clearY, clearX + clearW, clearY + clearH, radius);
        ctx.arcTo(clearX + clearW, clearY + clearH, clearX, clearY + clearH, radius);
        ctx.arcTo(clearX, clearY + clearH, clearX, clearY, radius);
        ctx.arcTo(clearX, clearY, clearX + clearW, clearY, radius);
        ctx.closePath();
        ctx.fill();

        const logoX = (size - logoW) / 2;
        const logoY = (size - logoH) / 2;
        ctx.drawImage(logo, logoX, logoY, logoW, logoH);
    } catch {
        // Fallback wordmark if asset fails
        const fontSize = Math.round(size * 0.09);
        ctx.fillStyle = '#ffffff';
        const tw = Math.round(size * 0.36);
        const th = Math.round(fontSize * 1.6);
        ctx.fillRect((size - tw) / 2, (size - th) / 2, tw, th);
        ctx.fillStyle = '#0ECCEE';
        ctx.font = `bold ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ctrl.', size / 2, size / 2 + 1);
    }

    return canvas.toDataURL('image/png');
}

export function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export async function downloadCompetitionQrPng(competition, festName = '', dataUrl = '') {
    const url = competitionPublicPageUrl(competition);
    const png = dataUrl || await buildBrandedCompetitionQrDataUrl(url);
    const festBit = safeFileName(festName, 'fest');
    const nameBit = safeFileName(competition?.name, 'competition');
    downloadDataUrl(png, `${festBit}_${nameBit}_QR.png`);
    return url;
}

const PRINT_CSS = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
    color: #111213;
    background: #fff;
  }
  .sheet {
    page-break-after: always;
    min-height: 262mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 28px 24px;
  }
  .sheet:last-child { page-break-after: auto; }
  .brand {
    font-size: 11px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #0ECCEE;
    font-weight: 800;
  }
  .fest { font-size: 15px; margin: 10px 0 0; color: #4b5563; }
  .name {
    font-size: 28px;
    font-weight: 800;
    margin: 12px 0 20px;
    line-height: 1.15;
    max-width: 520px;
  }
  .qr {
    width: 320px;
    height: 320px;
    display: block;
    background: transparent;
  }
  .hint {
    margin-top: 22px;
    font-size: 14px;
    color: #374151;
    max-width: 420px;
    line-height: 1.45;
  }
  .url {
    margin-top: 12px;
    font-size: 10px;
    color: #9ca3af;
    word-break: break-all;
    max-width: 460px;
  }
`;

/** Print / save-as-PDF pack: one A4 sheet per competition. */
export async function printAllCompetitionQrs({ festName, competitions }) {
    const list = (competitions || []).filter((c) => c?.id || c?._id);
    if (!list.length) throw new Error('No competitions');

    const sheets = [];
    for (const comp of list) {
        const url = competitionPublicPageUrl(comp);
        const qr = await buildBrandedCompetitionQrDataUrl(url, { size: 720 });
        sheets.push(`
      <section class="sheet">
        <p class="brand">CrwdCtrl</p>
        <p class="fest">${escapeHtml(festName || 'Fest')}</p>
        <h1 class="name">${escapeHtml(comp.name || 'Competition')}</h1>
        <img class="qr" src="${qr}" alt="QR" width="320" height="320" />
        <p class="hint">Scan to open this competition page on CrwdCtrl.</p>
        <p class="url">${escapeHtml(url)}</p>
      </section>
    `);
    }

    const popup = window.open('', '_blank', 'width=920,height=1100');
    if (!popup) throw new Error('Allow popups to print');

    popup.document.write(`<!doctype html><html><head>
    <title>${escapeHtml(festName || 'Fest')} · competition QRs</title>
    <style>${PRINT_CSS}</style>
  </head><body>${sheets.join('')}<script>
    window.onload = function () { setTimeout(function () { window.print(); }, 250); };
  </script></body></html>`);
    popup.document.close();
}

/** Download every competition QR as separate PNG files (staggered to avoid browser blocks). */
export async function downloadAllCompetitionQrPngs(competitions, festName = '', onProgress) {
    const list = (competitions || []).filter((c) => c?.id || c?._id);
    for (let i = 0; i < list.length; i += 1) {
        onProgress?.(i + 1, list.length, list[i]);
        await downloadCompetitionQrPng(list[i], festName);
        await new Promise((r) => setTimeout(r, 350));
    }
}
