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
 * Uses title slug (e.g. /competitions-view-details/robowars) so posters read cleanly;
 * falls back to Mongo id if the name cannot slugify. Scan opens the same detail page
 * (3D loader → competition).
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

/** Strip solid black / near-black plate so only the ctrl. mark remains. */
async function loadTransparentMark(src) {
    const img = await loadImage(src);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return img;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        // Black plate → fully transparent
        if (r < 32 && g < 32 && b < 32) {
            d[i + 3] = 0;
            continue;
        }
        // Soften dark gray fringe around the mark
        if (r < 48 && g < 48 && b < 48 && d[i + 3] > 0) {
            d[i + 3] = Math.min(d[i + 3], 40);
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

/**
 * Square PNG: competition-page QR with transparent CrwdCtrl mark centered
 * (QR modules sit around the logo — no black logo plate).
 */
export async function buildBrandedCompetitionQrDataUrl(url, {
    size = 1024,
    margin = 1,
    logoRatio = 0.26,
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

    const logoSize = Math.round(size * logoRatio);
    // Quiet cutout slightly larger than the mark so scanners read modules around it
    const cut = Math.round(logoSize * 1.12);
    const cutX = (size - cut) / 2;
    const cutY = (size - cut) / 2;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, cut / 2, 0, Math.PI * 2);
    ctx.fill();

    try {
        const logo = await loadTransparentMark(markLogoUrl);
        const logoX = (size - logoSize) / 2;
        const logoY = (size - logoSize) / 2;
        ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
    } catch {
        ctx.fillStyle = '#0ECCEE';
        ctx.font = `bold ${Math.round(logoSize * 0.38)}px ui-sans-serif, system-ui, sans-serif`;
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
    border: 1.5px solid #e5e7eb;
    border-radius: 24px;
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
    border-radius: 18px;
    box-shadow: 0 12px 40px rgba(17, 18, 19, 0.08);
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
