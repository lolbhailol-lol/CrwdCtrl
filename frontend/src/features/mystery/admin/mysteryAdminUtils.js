import QRCode from 'qrcode';

export const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white placeholder:text-white/25';
export const labelClass = 'block text-xs text-white/50';
export const cardClass = 'rounded-2xl border border-white/10 bg-white/5 p-4';
export const primaryBtn = 'rounded-xl bg-[#0ECCEE] px-4 py-2 text-sm font-bold text-black disabled:opacity-40';
export const ghostBtn = 'rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-white/30 disabled:opacity-40';
export const dangerBtn = 'rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-200 disabled:opacity-40';

export const EVENT_STATUS_LABEL = {
  draft: 'Draft',
  upcoming: 'Upcoming',
  registration_open: 'Registration open',
  live: 'Live',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
  pending_approval: 'Pending approval',
  rejected: 'Rejected',
};

export const EVENT_STATUS_TONE = {
  live: 'bg-emerald-400/15 text-emerald-300',
  registration_open: 'bg-sky-400/15 text-sky-300',
  paused: 'bg-amber-400/15 text-amber-300',
  completed: 'bg-white/10 text-white/60',
  cancelled: 'bg-red-500/15 text-red-200',
};

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(value) {
  if (!value) return '—';
  const sec = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return `${Math.round(sec / 3600)}h ago`;
}

export function toLocalInput(value) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/** Opens a print window with one card per QR clue (QR + code + title + placement). */
export async function printQrSheet({ title, evidence }) {
  const qrItems = evidence.filter((e) => e.requiresQR && e.qrSecret);
  const win = window.open('', '_blank');
  if (!win) throw new Error('Popup blocked — allow popups to print QR codes');
  const cards = await Promise.all(qrItems.map(async (e) => {
    const src = await QRCode.toDataURL(e.qrSecret, { width: 360, margin: 2 });
    return `
      <div class="card">
        <img src="${src}" alt="QR ${escapeHtml(e.code)}" />
        <div class="code">${escapeHtml(e.code)}</div>
        <div class="secret">Manual code: ${escapeHtml(e.qrSecret)}</div>
        <div class="admin">${escapeHtml(e.title)} · ${escapeHtml(e.world)}${e.placementNote ? ` · Place: ${escapeHtml(e.placementNote)}` : ''}</div>
      </div>`;
  }));
  win.document.write(`<!doctype html><html><head><title>${escapeHtml(title)} — QR clues</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 16px; color: #111; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      p.note { font-size: 12px; color: #555; margin: 0 0 16px; }
      .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
      .card { border: 2px dashed #999; border-radius: 12px; padding: 14px; text-align: center; page-break-inside: avoid; }
      .card img { width: 220px; height: 220px; }
      .code { font-size: 22px; font-weight: 800; letter-spacing: 2px; margin-top: 6px; }
      .secret { font-family: monospace; font-size: 13px; margin-top: 4px; }
      .admin { font-size: 11px; color: #666; margin-top: 8px; border-top: 1px solid #ddd; padding-top: 6px; }
      @media print { .admin { display: none; } p.note { display: none; } }
    </style></head><body>
    <h1>${escapeHtml(title)} — ${qrItems.length} QR clue${qrItems.length === 1 ? '' : 's'}</h1>
    <p class="note">Grey line (title + placement) sirf screen pe dikhta hai, print me nahi. Cut along dashed lines.</p>
    <div class="grid">${cards.join('')}</div>
    <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
    </body></html>`);
  win.document.close();
  return qrItems.length;
}
