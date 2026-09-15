/**
 * Campus Hunt stage colors — same palette on posters, admin, player, scanners.
 * Clue 1 / FIRST SCAN = orange · Clue 2 = green · Clue 3 = blue
 * · Clue 4 / FOURTH SCAN = purple · Final = red
 */

export const STAGE_THEMES = {
  clue1: {
    id: 'clue1',
    label: 'Clue 1',
    scanLabel: 'FIRST SCAN',
    colorName: 'Orange',
    hex: '#F97316',
    ink: '#1C0A00',
    muted: '#C2410C',
    softBg: 'rgba(249, 115, 22, 0.16)',
    borderClass: 'border-orange-400/55',
    bgClass: 'bg-orange-500/15',
    textClass: 'text-orange-200',
    softTextClass: 'text-orange-100/80',
    solidClass: 'bg-orange-500',
    solidTextClass: 'text-white',
    ringClass: 'ring-orange-400',
    buttonClass: 'bg-orange-500 text-white',
  },
  clue2: {
    id: 'clue2',
    label: 'Clue 2',
    scanLabel: 'SECOND SCAN',
    colorName: 'Green',
    hex: '#22C55E',
    ink: '#052E16',
    muted: '#15803D',
    softBg: 'rgba(34, 197, 94, 0.16)',
    borderClass: 'border-emerald-400/55',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-200',
    softTextClass: 'text-emerald-100/80',
    solidClass: 'bg-emerald-500',
    solidTextClass: 'text-black',
    ringClass: 'ring-emerald-400',
    buttonClass: 'bg-emerald-500 text-black',
  },
  clue3: {
    id: 'clue3',
    label: 'Clue 3',
    scanLabel: 'THIRD SCAN',
    colorName: 'Blue',
    hex: '#3B82F6',
    ink: '#0B1F4A',
    muted: '#1D4ED8',
    softBg: 'rgba(59, 130, 246, 0.16)',
    borderClass: 'border-blue-400/55',
    bgClass: 'bg-blue-500/15',
    textClass: 'text-blue-200',
    softTextClass: 'text-blue-100/80',
    solidClass: 'bg-blue-500',
    solidTextClass: 'text-white',
    ringClass: 'ring-blue-400',
    buttonClass: 'bg-blue-500 text-white',
  },
  clue4: {
    id: 'clue4',
    label: 'Clue 4',
    scanLabel: 'FOURTH SCAN',
    colorName: 'Purple',
    hex: '#A855F7',
    ink: '#2E1065',
    muted: '#7E22CE',
    softBg: 'rgba(168, 85, 247, 0.16)',
    borderClass: 'border-purple-400/55',
    bgClass: 'bg-purple-500/15',
    textClass: 'text-purple-200',
    softTextClass: 'text-purple-100/80',
    solidClass: 'bg-purple-500',
    solidTextClass: 'text-white',
    ringClass: 'ring-purple-400',
    buttonClass: 'bg-purple-500 text-white',
  },
  final: {
    id: 'final',
    label: 'Final',
    scanLabel: 'START CHECK-IN',
    colorName: 'Red',
    hex: '#EF4444',
    ink: '#450A0A',
    muted: '#B91C1C',
    softBg: 'rgba(239, 68, 68, 0.16)',
    borderClass: 'border-red-400/55',
    bgClass: 'bg-red-500/15',
    textClass: 'text-red-200',
    softTextClass: 'text-red-100/80',
    solidClass: 'bg-red-500',
    solidTextClass: 'text-white',
    ringClass: 'ring-red-400',
    buttonClass: 'bg-red-500 text-white',
  },
};

export const STAGE_THEME_LIST = [
  STAGE_THEMES.clue1,
  STAGE_THEMES.clue2,
  STAGE_THEMES.clue3,
  STAGE_THEMES.clue4,
  STAGE_THEMES.final,
];

export function themeForChallengeNumber(number) {
  const n = Number(number);
  if (n === 1) return STAGE_THEMES.clue1;
  if (n === 2) return STAGE_THEMES.clue2;
  if (n === 3) return STAGE_THEMES.clue3;
  if (n === 4) return STAGE_THEMES.clue4;
  if (n === 5) return STAGE_THEMES.final;
  return STAGE_THEMES.clue1;
}

export function themeForProgressStepId(stepId) {
  if (stepId === 'clue1') return STAGE_THEMES.clue1;
  if (stepId === 'clue2') return STAGE_THEMES.clue2;
  if (stepId === 'clue3') return STAGE_THEMES.clue3;
  if (stepId === 'clue4') return STAGE_THEMES.clue4;
  if (stepId === 'final') return STAGE_THEMES.final;
  return null;
}

export function themeForCheckpointKey(key) {
  const raw = String(key || '').toUpperCase().trim();
  if (!raw) return STAGE_THEMES.clue1;
  if (raw === 'FINISH' || raw.startsWith('FINISH')) {
    return STAGE_THEMES.final;
  }
  if (raw === '4' || raw.startsWith('4-')) return STAGE_THEMES.clue4;
  if (raw === '3' || raw.startsWith('3-')) return STAGE_THEMES.clue3;
  if (raw === '2' || raw.startsWith('2-')) return STAGE_THEMES.clue2;
  if (raw === '1' || raw.startsWith('1-')) return STAGE_THEMES.clue1;
  return STAGE_THEMES.clue1;
}

/** Resolve theme from player stage or checkpoint payload. */
export function themeForPlayerContext({ stage, checkpointKey, challengeNumber } = {}) {
  if (challengeNumber) return themeForChallengeNumber(challengeNumber);
  if (checkpointKey) return themeForCheckpointKey(checkpointKey);
  const s = String(stage || '');
  if (s.includes('CLUE_5') || s.includes('FINISH') || s.includes('SCORE')) {
    return STAGE_THEMES.final;
  }
  if (s.includes('CLUE_4') || s === 'CHECKPOINT_3_COMPLETED' || s.includes('CHECKPOINT_4')) {
    return STAGE_THEMES.clue4;
  }
  // After green: Clue 3 riddle, then blue CP3 scan
  if (s.includes('CLUE_3') || s === 'CHECKPOINT_2_COMPLETED' || s.includes('CHECKPOINT_3')) {
    return STAGE_THEMES.clue3;
  }
  if (s.includes('CLUE_2') || s.includes('CHECKPOINT_1')) return STAGE_THEMES.clue2;
  if (s.includes('CLUE_1')) return STAGE_THEMES.clue1;
  return STAGE_THEMES.clue1;
}

/**
 * Print CSS for pocket station cards (cut apart, tuck anywhere — not wall posters).
 * ~8 cards / A4 page with dashed cut guides.
 */
export function posterPrintCss(theme) {
  const t = theme || STAGE_THEMES.clue1;
  return `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font: 12px/1.25 system-ui, sans-serif;
      color: #111;
      background: #fff;
    }
    .sheet {
      padding: 10mm 8mm;
      page-break-after: always;
    }
    .sheet:last-child { page-break-after: auto; }
    .sheet-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6mm;
      padding-bottom: 3mm;
      border-bottom: 2px solid ${t.hex};
    }
    .sheet-head h2 { margin: 0; font-size: 16px; }
    .sheet-head p { margin: 2px 0 0; color: #555; font-size: 11px; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      background: ${t.hex};
      color: ${t.ink};
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .05em;
      text-transform: uppercase;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 5mm;
    }
    .card {
      width: 100%;
      min-height: 78mm;
      max-width: 92mm;
      margin: 0 auto;
      border: 2.5px solid ${t.hex};
      border-radius: 8px;
      padding: 4mm 3.5mm;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      page-break-inside: avoid;
      background: linear-gradient(180deg, ${t.softBg} 0%, #fff 38%);
      position: relative;
    }
    .card::after {
      content: '';
      position: absolute;
      inset: -2.5mm;
      border: 1px dashed #bbb;
      border-radius: 10px;
      pointer-events: none;
    }
    .place {
      margin: 0;
      font-size: 9px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: #666;
    }
    .eyebrow {
      margin: 2px 0 0;
      font-size: 9px;
      font-weight: 800;
      color: ${t.muted};
      text-transform: uppercase;
    }
    h1 {
      margin: 3px 0 0;
      font-size: 15px;
      line-height: 1.15;
      max-width: 100%;
      overflow-wrap: anywhere;
    }
    .code {
      margin: 2px 0 0;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .04em;
    }
    .start {
      margin: 2px 0 3px;
      color: #555;
      font-size: 9px;
    }
    img {
      display: block;
      margin: 2px auto 0;
      width: 38mm;
      height: 38mm;
    }
    .paste {
      margin: 3px 0 0;
      font-family: ui-monospace, monospace;
      font-size: 11px;
      letter-spacing: .08em;
      font-weight: 700;
    }
    .note {
      margin: 2px 0 0;
      font-size: 8px;
      color: #444;
      line-height: 1.2;
    }
    .cut-hint {
      margin: 4mm 0 0;
      text-align: center;
      font-size: 9px;
      color: #888;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .sheet { page-break-after: always; }
      .sheet:last-child { page-break-after: auto; }
    }
  `;
}

/** A3 portrait — all station QRs on one page with dashed cut guides. */
export function a3GridPosterPrintCss(theme, { columns = 2, cardCount = 4 } = {}) {
  const t = theme || STAGE_THEMES.clue1;
  const compact = cardCount > 4;
  const tight = cardCount > 6;
  return `
    * { box-sizing: border-box; }
    @page { size: A3 portrait; margin: 7mm; }
    body {
      margin: 0;
      font: 12px/1.25 system-ui, sans-serif;
      color: #111;
      background: #fff;
    }
    .sheet-a3 {
      width: 100%;
      min-height: 100%;
      padding: 0;
      page-break-after: avoid;
    }
    .sheet-head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 5mm;
      padding-bottom: 3mm;
      border-bottom: 2.5px solid ${t.hex};
    }
    .sheet-head h2 { margin: 0; font-size: ${compact ? '15px' : '18px'}; }
    .sheet-head p { margin: 2px 0 0; color: #555; font-size: ${compact ? '9px' : '10px'}; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      background: ${t.hex};
      color: ${t.ink};
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .05em;
      text-transform: uppercase;
    }
    .cut-banner {
      margin: 0 0 4mm;
      text-align: center;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: .06em;
      text-transform: uppercase;
      color: #666;
    }
    .grid-a3 {
      display: grid;
      grid-template-columns: repeat(${columns}, 1fr);
      gap: 0;
      width: 100%;
      border: 1px dashed #999;
    }
    .card {
      width: 100%;
      min-height: ${tight ? '58mm' : compact ? '68mm' : '88mm'};
      border: 1px dashed #aaa;
      border-radius: 0;
      padding: ${tight ? '3mm 2.5mm' : compact ? '3.5mm 3mm' : '4mm 3.5mm'};
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      page-break-inside: avoid;
      background: linear-gradient(180deg, ${t.softBg} 0%, #fff 42%);
      position: relative;
    }
    .card::before {
      content: '✂ cut';
      position: absolute;
      top: 2mm;
      right: 2.5mm;
      font-size: 7px;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
      color: #aaa;
    }
    .place {
      margin: 0;
      font-size: ${tight ? '7px' : '8px'};
      letter-spacing: .08em;
      text-transform: uppercase;
      color: #666;
    }
    .eyebrow {
      margin: 1px 0 0;
      font-size: ${tight ? '7px' : '8px'};
      font-weight: 800;
      color: ${t.muted};
      text-transform: uppercase;
    }
    h1 {
      margin: 2px 0 0;
      font-size: ${tight ? '11px' : compact ? '13px' : '15px'};
      line-height: 1.15;
      max-width: 100%;
      overflow-wrap: anywhere;
    }
    .code {
      margin: 1px 0 0;
      font-size: ${tight ? '10px' : '11px'};
      font-weight: 800;
      letter-spacing: .04em;
    }
    img {
      display: block;
      margin: 2px auto 0;
      width: ${tight ? '28mm' : compact ? '32mm' : '38mm'};
      height: ${tight ? '28mm' : compact ? '32mm' : '38mm'};
    }
    .paste {
      margin: 2px 0 0;
      font-family: ui-monospace, monospace;
      font-size: ${tight ? '9px' : '10px'};
      letter-spacing: .06em;
      font-weight: 700;
    }
    .note {
      margin: 1px 0 0;
      font-size: ${tight ? '7px' : '8px'};
      color: #444;
      line-height: 1.2;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .sheet-a3 { page-break-after: avoid; page-break-inside: avoid; }
    }
  `;
}

export function posterGridColumns(cardCount) {
  if (cardCount <= 1) return 1;
  if (cardCount <= 4) return 2;
  if (cardCount <= 6) return 3;
  if (cardCount <= 9) return 3;
  return 4;
}
