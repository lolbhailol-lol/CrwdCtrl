import React, { useMemo } from 'react';

function rankFromKey(key) {
  const k = String(key || '').toLowerCase();
  if (k.startsWith('1') || k === 'first') return 1;
  if (k.startsWith('2') || k === 'second') return 2;
  if (k.startsWith('3') || k === 'third') return 3;
  return 0;
}

function placeLabel(rank) {
  return `${rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'} Place`;
}

function normalizeAmount(raw) {
  let amount = String(raw || '').trim();
  if (!amount) return '';
  // Drop trailing rank notes like "(1st)" already stripped elsewhere
  amount = amount.replace(/\s*\/\-\s*$/i, '').trim();
  amount = amount.replace(/^(?:rs\.?|inr)\s*/i, '').trim();
  // Keep existing currency symbol; otherwise add ₹ for numeric amounts
  if (/^[₹]/.test(amount)) return amount;
  if (/^[\d,]+(?:\.\d+)?\+?$/.test(amount.replace(/\s/g, ''))) {
    return `₹${amount.replace(/\s/g, '')}`;
  }
  if (/^[\d,]+/.test(amount)) {
    return `₹${amount}`;
  }
  return amount;
}

function toPrizeChunks(text) {
  return String(text || '')
    .split(/\n|;/)
    .flatMap((line) => String(line).split(/\s*[|·•]\s*/))
    .map((l) => l.replace(/^[-–—*]\s*/, '').trim())
    .filter(Boolean);
}

/**
 * Parse one prize line into place / total / other.
 * Supports:
 * - "1st Place: ₹5,000" / "1st Prize ₹1,500"
 * - "35,000/- (1st)" / "20,000/- (2nd)"
 * - "14,000/- (1st male & female)"
 * - "Worth ₹9,000+" / "Total prize pool: ₹9,000+"
 */
export function parsePrizePlace(line) {
  // Drop medal/bullet emoji so "🥇 1st Prize: ₹6,000" parses as a place (not a duplicate "other" row)
  const text = String(line || '')
    .replace(/^[\s]*(?:🥇|🥈|🥉|🏆|🎖️|🏅|•|●|◦|▪|–|-|\*)+\s*/u, '')
    .trim();
  if (!text) return null;

  // Format: "35,000/- (1st)" or "14,000/- (1st male & female)"
  const trailingRank = text.match(
    /^(.+?)\s*\(\s*(1st|2nd|3rd|first|second|third)\b([^)]*)\)\s*$/i,
  );
  if (trailingRank) {
    const rank = rankFromKey(trailingRank[2]);
    if (rank) {
      const note = String(trailingRank[3] || '').trim().replace(/^[\s,–-]+/, '');
      const amount = normalizeAmount(trailingRank[1]);
      return {
        kind: 'place',
        rank,
        amount: note ? `${amount}${note ? ` · ${note}` : ''}` : amount,
        label: placeLabel(rank),
      };
    }
  }

  // Format: "1st Place: ₹5,000" / "1st Prize: 1500" / "1st: ₹5,000"
  const placeMatch = text.match(
    /^(1st|2nd|3rd|first|second|third)\s*(?:place|prize)?\s*[:\-]?\s*(.+)$/i,
  );
  if (placeMatch) {
    const rank = rankFromKey(placeMatch[1]);
    if (rank) {
      return {
        kind: 'place',
        rank,
        amount: normalizeAmount(placeMatch[2]),
        label: placeLabel(rank),
      };
    }
  }

  if (/total|worth|prize pool/i.test(text) && !/\b(1st|2nd|3rd|first|second|third)\b/i.test(text)) {
    const amount = normalizeAmount(text.replace(/^[^:]*:\s*/i, '').trim() || text);
    return { kind: 'total', amount, label: 'Total Pool' };
  }

  return { kind: 'other', amount: text, label: '' };
}

export function parsePrizePool(text) {
  const raw = String(text || '').trim();
  const parsed = [];

  for (const chunk of toPrizeChunks(raw)) {
    const item = parsePrizePlace(chunk);
    if (item) parsed.push(item);
  }

  // Inline scan when structured places weren't found
  if (!parsed.some((p) => p.kind === 'place')) {
    const inlinePlaceFirst = [...raw.matchAll(
      /\b(1st|2nd|3rd|first|second|third)\b\s*(?:place|prize)?\s*[:\-]?\s*(₹[\d,.\s+kK]+|Rs\.?\s*[\d,.\s+]+|INR\s*[\d,.\s+]+|[\d,]+\+?(?:\s*\/\-)?)/gi,
    )];
    for (const m of inlinePlaceFirst) {
      const item = parsePrizePlace(`${m[1]} Place: ${m[2]}`);
      if (item?.kind === 'place') parsed.push(item);
    }

    const inlineAmountFirst = [...raw.matchAll(
      /(₹?[\d,]+(?:\.\d+)?\+?(?:\s*\/\-)?)(?:\s*)\(\s*(1st|2nd|3rd|first|second|third)\b([^)]*)\)/gi,
    )];
    for (const m of inlineAmountFirst) {
      const item = parsePrizePlace(`${m[1]} (${m[2]}${m[3] || ''})`);
      if (item?.kind === 'place') parsed.push(item);
    }
  }

  if (!parsed.some((p) => p.kind === 'total')) {
    const totalM = raw.match(
      /(?:total(?:\s+prize)?\s*pool|worth)\s*[:\-]?\s*(₹[\d,.\s+kK]+|Rs\.?\s*[\d,.\s+]+|[\d,]+\+?)/i,
    );
    if (totalM) {
      parsed.push({ kind: 'total', amount: normalizeAmount(totalM[1]), label: 'Total Pool' });
    }
  }

  const places = [];
  const seen = new Set();
  for (const p of parsed.filter((x) => x.kind === 'place').sort((a, b) => a.rank - b.rank)) {
    if (seen.has(p.rank)) continue;
    seen.add(p.rank);
    places.push(p);
  }

  // Keep non-place notes only; drop lines that merely restate 1st/2nd/3rd when podium exists
  const others = parsed.filter((p) => {
    if (p.kind !== 'other') return false;
    if (places.length >= 1 && /\b(1st|2nd|3rd|first|second|third)\b/i.test(p.amount || '')) {
      return false;
    }
    return true;
  });

  return {
    places,
    total: parsed.find((p) => p.kind === 'total') || null,
    others,
    hasPodium: places.length >= 1,
  };
}

export function ClassicMedalSvg({ rank = 1, size = 36 }) {
  const themes = {
    1: { rim: '#B8860B', face: '#FFD700', shine: '#FFF3A0', ribbon: '#C9A227' },
    2: { rim: '#6B7280', face: '#C0C0C0', shine: '#F3F4F6', ribbon: '#9CA3AF' },
    3: { rim: '#8B4513', face: '#CD7F32', shine: '#E8B88A', ribbon: '#A0522D' },
  };
  const t = themes[rank] || themes[1];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M22 8 L32 22 L42 8 L36 8 L32 14 L28 8 Z" fill={t.ribbon} />
      <circle cx="32" cy="38" r="18" fill={t.rim} />
      <circle cx="32" cy="38" r="14" fill={t.face} />
      <circle cx="32" cy="38" r="14" fill={t.shine} fillOpacity="0.35" />
      <text
        x="32"
        y="44"
        textAnchor="middle"
        fontSize="16"
        fontWeight="700"
        fill={t.rim}
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        {rank}
      </text>
    </svg>
  );
}

export function ClassicTrophySvg({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M20 14 H44 V28 C44 36 38 42 32 42 C26 42 20 36 20 28 Z" fill="#FFD700" stroke="#B8860B" strokeWidth="2" />
      <path d="M20 18 H14 C12 18 10 20 10 23 C10 28 14 31 20 31" stroke="#B8860B" strokeWidth="2.5" fill="none" />
      <path d="M44 18 H50 C52 18 54 20 54 23 C54 28 50 31 44 31" stroke="#B8860B" strokeWidth="2.5" fill="none" />
      <rect x="29" y="42" width="6" height="8" fill="#B8860B" />
      <rect x="22" y="50" width="20" height="5" rx="1.5" fill="#B8860B" />
      <path d="M26 22 C28 18 36 18 38 22" stroke="#FFF3A0" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function buildPodiumOrder(places) {
  const p1 = places.find((p) => p.rank === 1);
  const p2 = places.find((p) => p.rank === 2);
  const p3 = places.find((p) => p.rank === 3);
  if (p1 && p2 && p3) return [p2, p1, p3];
  if (p1 && p2) return [p2, p1];
  return places;
}

/**
 * Classic medal podium for prize pools — events + competitions.
 */
export default function PrizePoolPodium({
  prizeText,
  isDark = false,
  className = '',
  title = 'Prize Pool',
  compact = false,
}) {
  const { places, others, hasPodium } = useMemo(() => parsePrizePool(prizeText), [prizeText]);

  const trimmed = String(prizeText || '').trim();
  if (!trimmed || /^(tbd|tba|n\/a|na|-)$/i.test(trimmed)) {
    return null;
  }

  const sectionCard = isDark ? 'bg-[#111213]' : 'bg-white border border-gray-100 shadow-md';
  const podiumOrder = buildPodiumOrder(places);

  return (
    <div className={`rounded-2xl ${compact ? 'p-3.5' : 'p-4'} ${sectionCard} ${className}`}>
      <div className={`flex items-center gap-2 ${compact ? 'mb-3' : 'mb-4'}`}>
        <ClassicTrophySvg size={compact ? 24 : 28} />
        <h2 className={`font-semibold ${compact ? 'text-base' : 'text-lg'} ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </h2>
      </div>

      {hasPodium ? (
        <>
          <div
            className={`grid gap-2.5 items-end ${
              places.length >= 3
                ? 'grid-cols-3'
                : places.length === 2
                  ? 'grid-cols-2'
                  : 'grid-cols-1 max-w-[11rem] mx-auto'
            }`}
          >
            {podiumOrder.map((place) => {
              const isGold = place.rank === 1;
              return (
                <div
                  key={place.rank}
                  className={`rounded-2xl px-2 text-center border ${
                    isGold ? 'py-4' : 'py-3'
                  } ${
                    isDark
                      ? isGold
                        ? 'bg-[#2A2410] border-[#B8860B]/40'
                        : 'bg-[#1D1E20] border-white/5'
                      : isGold
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <div className="flex justify-center mb-1.5">
                    <ClassicMedalSvg
                      rank={place.rank}
                      size={isGold ? (compact ? 42 : 48) : (compact ? 32 : 36)}
                    />
                  </div>
                  <p className={`text-[11px] font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {place.label}
                  </p>
                  <p className={`font-bold mt-0.5 ${isGold ? 'text-base' : 'text-sm'} ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {place.amount}
                  </p>
                </div>
              );
            })}
          </div>

          {others.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {others.map((item, idx) => (
                <li key={idx} className={`flex items-start gap-2 text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <span className="mt-1.5 size-1.5 rounded-full bg-[#0ECCEE] shrink-0" />
                  {item.amount}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
          {prizeText}
        </div>
      )}
    </div>
  );
}
