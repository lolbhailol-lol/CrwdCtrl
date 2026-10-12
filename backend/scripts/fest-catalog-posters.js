'use strict';

// Designed fallback posters for fests/competitions without a suitable real or CC0 photo.
const fs = require('node:fs/promises');
const path = require('node:path');

const ICON_DIR = path.resolve(__dirname, '../../frontend/node_modules/lucide-react/dist/esm/icons');

const TOPIC_STYLE = {
  dance: ['#ff4d8d', '#7b2ff7', 'drama'],
  music: ['#ff7a18', '#af002d', 'music'],
  robotics: ['#00c6ff', '#0072ff', 'bot'],
  football: ['#11998e', '#38ef7d', 'trophy'],
  cricket: ['#1d976c', '#93f9b9', 'trophy'],
  basketball: ['#f7971e', '#d35400', 'dribbble'],
  badminton: ['#56ab2f', '#a8e063', 'medal'],
  volleyball: ['#f2994a', '#f2c94c', 'volleyball'],
  kabaddi: ['#cb356b', '#bd3f32', 'dumbbell'],
  chess: ['#434343', '#9b9b9b', 'puzzle'],
  tennis: ['#11998e', '#0f9b0f', 'target'],
  swimming: ['#2193b0', '#6dd5ed', 'medal'],
  archery: ['#b92b27', '#1565c0', 'target'],
  squash: ['#373b44', '#4286f4', 'target'],
  running: ['#f12711', '#f5af19', 'footprints'],
  drone: ['#1488cc', '#2b32b2', 'plane-takeoff'],
  gaming: ['#8e2de2', '#4a00e0', 'gamepad-2'],
  coding: ['#0f2027', '#2c5364', 'code'],
  quiz: ['#6a3093', '#a044ff', 'brain-circuit'],
  debate: ['#c33764', '#1d2671', 'mic'],
  startup: ['#0b486b', '#f56217', 'briefcase'],
  photography: ['#232526', '#414345', 'camera'],
  film: ['#200122', '#6f0000', 'clapperboard'],
  fashion: ['#ee0979', '#ff6a00', 'shirt'],
  theatre: ['#4b134f', '#c94b4b', 'drama'],
  poetry: ['#3a1c71', '#d76d77', 'feather'],
  art: ['#fc466b', '#3f5efb', 'palette'],
  technology: ['#0575e6', '#021b79', 'cpu'],
  festival: ['#e65c00', '#8e0e00', 'party-popper'],
  sports: ['#00b09b', '#96c93d', 'trophy'],
  campus: ['#0ecce4', '#0b3c5d', 'sparkles'],
};

const escapeXml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));

async function iconMarkup(name) {
  const source = await fs.readFile(path.join(ICON_DIR, `${name}.js`), 'utf8');
  const nodes = [...source.matchAll(/\[\s*"(\w+)",\s*\{([^}]*)\}\s*\]/g)].map(([, tag, attrs]) => {
    const parts = [...attrs.matchAll(/(\w+):\s*"([^"]*)"/g)].filter(([, key]) => key !== 'key').map(([, key, value]) => `${key}="${value}"`);
    return `<${tag} ${parts.join(' ')}/>`;
  });
  return nodes.join('');
}

function wrap(text, maxChars, maxLines) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current ? `${current} ${word}` : word).length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, maxChars - 1).trim()}…`;
  }
  return lines;
}

async function posterSvg({ title, subtitle, topic, width = 1200, height = 900 }) {
  const [from, to, icon] = TOPIC_STYLE[topic] || TOPIC_STYLE.campus;
  const iconSvg = await iconMarkup(icon);
  const cleanTitle = String(title || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim() || title;
  const titleLines = wrap(cleanTitle.toUpperCase(), width > 1300 ? 18 : 16, 3);
  const fontSize = titleLines.some((line) => line.length > 12) ? 84 : 104;
  const lineHeight = fontSize * 1.08;
  const titleTop = height - 150 - (titleLines.length - 1) * lineHeight;
  const label = topic === 'festival' || topic === 'campus' ? 'FEST' : topic.toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
    <radialGradient id="glow" cx="0.82" cy="0.18" r="0.6"><stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>
  <g opacity="0.10" fill="none" stroke="#fff" stroke-width="2">
    <circle cx="${width * 0.85}" cy="${height * 0.2}" r="${height * 0.42}"/>
    <circle cx="${width * 0.85}" cy="${height * 0.2}" r="${height * 0.3}"/>
    <circle cx="${width * 0.85}" cy="${height * 0.2}" r="${height * 0.18}"/>
  </g>
  <g transform="translate(${width - 380} 70) scale(13)" fill="none" stroke="#ffffff" stroke-opacity="0.92" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${iconSvg}</g>
  <rect width="${width}" height="${height}" fill="url(#shade)"/>
  <rect x="64" y="64" rx="22" height="44" width="${label.length * 17 + 48}" fill="#ffffff" fill-opacity="0.18"/>
  <text x="88" y="95" font-family="Poppins, Segoe UI, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="3" fill="#ffffff">${escapeXml(label)}</text>
  ${titleLines.map((line, index) => `<text x="64" y="${titleTop + index * lineHeight}" font-family="Poppins, Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="800" fill="#ffffff">${escapeXml(line)}</text>`).join('\n  ')}
  <text x="64" y="${height - 72}" font-family="Poppins, Segoe UI, Arial, sans-serif" font-size="34" font-weight="600" fill="#ffffff" fill-opacity="0.85">${escapeXml(String(subtitle || '').slice(0, 60))}</text>
</svg>`;
}

module.exports = { posterSvg, TOPIC_STYLE };
