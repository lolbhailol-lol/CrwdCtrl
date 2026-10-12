'use strict';

// Layout-aware designed posters: one render per card slot so names never get cropped.
const fs = require('node:fs');
const path = require('node:path');

const ICON_DIR = path.resolve(__dirname, '../../frontend/node_modules/lucide-react/dist/esm/icons');

// topic -> [gradient start, gradient end, accent, lucide icon, chip label]
const THEMES = {
  dance: ['#ff3d7f', '#5b1fd1', '#ffd1e6', 'drama', 'DANCE'],
  music: ['#ff7a18', '#a3002f', '#ffe0b3', 'music', 'MUSIC'],
  robotics: ['#00b4ff', '#0a2fb8', '#c4f0ff', 'bot', 'ROBOTICS'],
  football: ['#0fa37f', '#064e3b', '#b9ffe6', 'trophy', 'FOOTBALL'],
  cricket: ['#22a06b', '#0b4d2e', '#c8ffd9', 'trophy', 'CRICKET'],
  basketball: ['#ff8a00', '#9a2b00', '#ffe1bf', 'dribbble', 'BASKETBALL'],
  badminton: ['#52b32a', '#1b5e20', '#e2ffc9', 'medal', 'BADMINTON'],
  volleyball: ['#f2994a', '#a14d00', '#ffe7c8', 'volleyball', 'VOLLEYBALL'],
  kabaddi: ['#d63864', '#7a1530', '#ffd3df', 'dumbbell', 'KABADDI'],
  chess: ['#4b4b55', '#121216', '#e5e5ea', 'puzzle', 'CHESS'],
  tennis: ['#13a89e', '#0b5d3b', '#c9fff5', 'target', 'TABLE TENNIS'],
  swimming: ['#1fa2d6', '#0b4f8a', '#cdf3ff', 'medal', 'SWIMMING'],
  archery: ['#c2312b', '#1d3f8f', '#ffd6d3', 'target', 'ARCHERY'],
  squash: ['#3a4a6b', '#141c2e', '#d4def5', 'target', 'SQUASH'],
  running: ['#ff4b1f', '#b31217', '#ffd9c7', 'footprints', 'RUN'],
  drone: ['#1488cc', '#2b32b2', '#cfe8ff', 'plane-takeoff', 'DRONES'],
  gaming: ['#8e2de2', '#3a0ca3', '#e7d4ff', 'gamepad-2', 'ESPORTS'],
  coding: ['#0f4c75', '#0b1d33', '#bfe6ff', 'code', 'CODING'],
  quiz: ['#7b2ff7', '#3d0f8f', '#e6d6ff', 'brain-circuit', 'QUIZ'],
  debate: ['#c33764', '#1d2671', '#ffd2e0', 'mic', 'DEBATE'],
  startup: ['#0b486b', '#f56217', '#ffe3cf', 'briefcase', 'BUSINESS'],
  photography: ['#3a3d45', '#121318', '#e8e8ee', 'camera', 'PHOTOGRAPHY'],
  film: ['#4a0d2e', '#120318', '#ffd0e4', 'clapperboard', 'FILM'],
  fashion: ['#ee0979', '#ff6a00', '#ffe0ec', 'shirt', 'FASHION'],
  theatre: ['#5b1a66', '#b33a3a', '#ffd9e6', 'drama', 'THEATRE'],
  poetry: ['#3a1c71', '#d76d77', '#ffe1e5', 'feather', 'LITERARY'],
  art: ['#fc466b', '#3f5efb', '#ffe0ea', 'palette', 'ART'],
  technology: ['#0575e6', '#021b79', '#cfe6ff', 'cpu', 'TECH'],
  festival: ['#ff6a00', '#8e0e00', '#ffe3c4', 'party-popper', 'FEST'],
  sports: ['#00b09b', '#1f5f2a', '#d0ffe9', 'trophy', 'SPORTS'],
  campus: ['#0ecce4', '#0b3c5d', '#d2f8ff', 'sparkles', 'CAMPUS'],
};

const iconCache = new Map();
function iconMarkup(name) {
  if (!iconCache.has(name)) {
    const source = fs.readFileSync(path.join(ICON_DIR, `${name}.js`), 'utf8');
    const nodes = [...source.matchAll(/\[\s*"(\w+)",\s*\{([^}]*)\}\s*\]/g)].map(([, tag, attrs]) => {
      const parts = [...attrs.matchAll(/(\w+):\s*"([^"]*)"/g)].filter(([, key]) => key !== 'key').map(([, key, value]) => `${key}="${value}"`);
      return `<${tag} ${parts.join(' ')}/>`;
    });
    iconCache.set(name, nodes.join(''));
  }
  return iconCache.get(name);
}

const xml = (value) => String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

function wrapWords(text, maxChars) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// Largest font whose wrapped title fits the box (heavy uppercase ~0.6em per glyph).
function fitTitle(text, boxWidth, boxHeight, maxLines, maxFont, minFont) {
  for (let size = maxFont; size >= minFont; size -= 2) {
    const maxChars = Math.max(4, Math.floor(boxWidth / (size * 0.6)));
    const lines = wrapWords(text, maxChars);
    const longest = Math.max(...lines.map((l) => l.length));
    if (lines.length <= maxLines && longest * size * 0.6 <= boxWidth && lines.length * size * 1.05 <= boxHeight) return { size, lines };
  }
  const size = minFont;
  const lines = wrapWords(text, Math.max(4, Math.floor(boxWidth / (size * 0.6)))).slice(0, maxLines);
  return { size, lines };
}

const FONT = "Poppins, 'Segoe UI', Arial, sans-serif";

// safeY keeps everything inside a central band so the image survives cropping to 4:3 or 16:10.
function renderPoster({ title, kicker, lines = [], topic, width, height, safeY = 0, stacked = false }) {
  const [from, to, accent, icon, label] = THEMES[topic] || THEMES.campus;
  const iconSvg = iconMarkup(icon);
  const ratio = width / height;
  const tall = stacked || ratio < 0.95;
  const banner = ratio > 1.9;
  const pad = Math.round(Math.min(width, height) * 0.075);
  const padY = Math.max(pad, Math.round(height * safeY));
  const cleanTitle = String(title || '').replace(/\s*\((online|offline)\)\s*/gi, ' ').replace(/\s+/g, ' ').trim().toUpperCase();

  const textWidth = tall ? width - pad * 2 : banner ? width * 0.56 : width * 0.68;
  const titleBox = safeY ? height * 0.28 : tall ? height * 0.34 : banner ? height * 0.44 : height * 0.4;
  const base = Math.min(width, height);
  const { size, lines: titleLines } = fitTitle(cleanTitle, textWidth, titleBox, tall ? 4 : 3, Math.round(base * (tall ? 0.15 : 0.16)), Math.round(base * 0.06));
  const subSize = Math.round(base * 0.042);
  const kickerSize = Math.round(base * 0.034);
  const detailLines = lines.filter(Boolean).slice(0, 2).map((line) => String(line).slice(0, tall ? 38 : 52));

  const titleHeight = titleLines.length * size * 1.04;
  const detailHeight = detailLines.length * subSize * 1.45;
  const blockHeight = (kicker ? kickerSize * 1.9 : 0) + titleHeight + (detailLines.length ? subSize * 0.6 + detailHeight : 0);
  const blockTop = banner ? (height - blockHeight) / 2 : height - padY - blockHeight;

  const badge = Math.round(base * (banner ? 0.42 : safeY ? 0.22 : 0.3));
  const badgeX = banner ? width - pad - badge : width - pad - badge;
  const badgeY = banner ? (height - badge) / 2 : padY;
  const iconScale = (badge * 0.5) / 24;
  const markScale = (Math.max(width, height) * 0.62) / 24;

  let y = blockTop;
  const parts = [];
  if (kicker) {
    parts.push(`<text x="${pad}" y="${y + kickerSize}" font-family="${FONT}" font-size="${kickerSize}" font-weight="700" letter-spacing="${kickerSize * 0.12}" fill="${accent}">${xml(String(kicker).toUpperCase().slice(0, 44))}</text>`);
    y += kickerSize * 1.9;
  }
  titleLines.forEach((line, index) => {
    parts.push(`<text x="${pad}" y="${y + size * 0.86 + index * size * 1.04}" font-family="${FONT}" font-size="${size}" font-weight="800" fill="#ffffff">${xml(line)}</text>`);
  });
  y += titleHeight + subSize * 0.6;
  detailLines.forEach((line, index) => {
    parts.push(`<text x="${pad}" y="${y + subSize + index * subSize * 1.45}" font-family="${FONT}" font-size="${subSize}" font-weight="${index === 0 ? 600 : 500}" fill="#ffffff" fill-opacity="${index === 0 ? 0.92 : 0.75}">${xml(line)}</text>`);
  });

  const chipW = label.length * kickerSize * 0.72 + kickerSize * 2.2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
    <radialGradient id="g1" cx="0.85" cy="0.12" r="0.65"><stop offset="0" stop-color="#ffffff" stop-opacity="0.32"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2" cx="0.05" cy="1" r="0.7"><stop offset="0" stop-color="#000000" stop-opacity="0.45"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="${banner ? 1 : 0}" y2="${banner ? 0 : 1}"><stop offset="${banner ? 0 : 0.35}" stop-color="#000" stop-opacity="${banner ? 0.45 : 0}"/><stop offset="${banner ? 0.7 : 1}" stop-color="#000" stop-opacity="${banner ? 0 : 0.6}"/></linearGradient>
    <pattern id="dots" width="${Math.round(base * 0.045)}" height="${Math.round(base * 0.045)}" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="#ffffff" fill-opacity="0.13"/></pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#dots)"/>
  <rect width="${width}" height="${height}" fill="url(#g1)"/>
  <rect width="${width}" height="${height}" fill="url(#g2)"/>
  <path d="M${width * 0.42} 0 L${width * 0.62} 0 L${width * 0.28} ${height} L${width * 0.08} ${height} Z" fill="#ffffff" fill-opacity="0.05"/>
  <g transform="translate(${width * (banner ? 0.6 : 0.38)} ${height * (tall ? 0.1 : banner ? -0.25 : 0.02)}) scale(${markScale})" fill="none" stroke="#ffffff" stroke-opacity="0.09" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${iconSvg}</g>
  <rect width="${width}" height="${height}" fill="url(#shade)"/>
  <g>
    <circle cx="${badgeX + badge / 2}" cy="${badgeY + badge / 2}" r="${badge / 2}" fill="#ffffff" fill-opacity="0.14" stroke="#ffffff" stroke-opacity="0.35" stroke-width="${Math.max(2, badge * 0.012)}"/>
    <g transform="translate(${badgeX + badge * 0.25} ${badgeY + badge * 0.25}) scale(${iconScale})" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${iconSvg}</g>
  </g>
  <rect x="${pad}" y="${padY}" rx="${kickerSize * 0.9}" width="${chipW}" height="${kickerSize * 1.8}" fill="#000000" fill-opacity="0.28" stroke="#ffffff" stroke-opacity="0.3"/>
  <text x="${pad + kickerSize * 1.1}" y="${padY + kickerSize * 1.22}" font-family="${FONT}" font-size="${kickerSize * 0.95}" font-weight="800" letter-spacing="${kickerSize * 0.12}" fill="#ffffff">${xml(label)}</text>
  ${parts.join('\n  ')}
  <text x="${width - pad}" y="${height - padY + kickerSize * 1.4}" text-anchor="end" font-family="${FONT}" font-size="${Math.round(base * 0.03)}" font-weight="800" fill="#ffffff" fill-opacity="0.55">CrwdCtrl</text>
</svg>`;
}

const CARD_SIZE = [1080, 1080];
const CARD_OPTIONS = { safeY: 0.19, stacked: true };

const SLOT_SIZES = {
  wide: [1400, 980],
  portrait: [1000, 1300],
  square: [1080, 1080],
  hero: [1800, 840],
  landscape: [1500, 900],
  video: [1600, 900],
  page: [1250, 1000],
};

module.exports = { renderPoster, SLOT_SIZES, CARD_SIZE, CARD_OPTIONS, THEMES };
