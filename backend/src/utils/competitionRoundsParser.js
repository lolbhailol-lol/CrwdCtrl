/**
 * Parse EVENT STRUCTURE / round blocks into Aarohan-style round tabs.
 * Supports Round 1/2/3, Elimination, Knock-Out, Final, and offline/online splits.
 */

function decodeHtml(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeWhitespace(text) {
  return decodeHtml(String(text || ''))
    .replace(/\r/g, ' ')
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNumberedRules(text) {
  const chunk = normalizeWhitespace(text);
  if (!chunk) return [];

  const rules = [];
  const parts = chunk.split(/(?=\d+\.\s)/);
  for (const part of parts) {
    const match = part.match(/^\d+\.\s*(.+)$/);
    if (match) {
      const rule = normalizeWhitespace(match[1]);
      if (rule.length > 8) rules.push(rule);
    }
  }
  return rules;
}

function splitProseRules(text) {
  const chunk = normalizeWhitespace(text);
  if (!chunk) return [];
  if (chunk.length <= 220) return [chunk];

  return chunk
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

const NAMED_ROUND_HEADERS = [
  'Elimination Round',
  'Knock-Out Round',
  'Knockout Round',
  'Qualifier Round',
  'Preliminary Round',
  'Shortlisting Round',
  'Qualifying Round',
  'Design Round',
  'Semi-Final Round',
  'Semi Final Round',
  'Quarter-Final Round',
  'Quarter Final Round',
  'Final Round',
  'Grand Final',
  'Surprise Round',
  'Mentor Round',
];

function buildHeaderRegex() {
  const named = NAMED_ROUND_HEADERS.map((h) => h.replace(/\s+/g, '\\s+')).join('|');
  return new RegExp(
    `(?:^|\\s)(R\\s*ound\\s*(\\d+)|${named})\\s*:`,
    'gi',
  );
}

const HEADER_RE = buildHeaderRegex();

function findRoundMarkers(text) {
  const markers = [];
  HEADER_RE.lastIndex = 0;
  let match = HEADER_RE.exec(text);
  while (match) {
    const rawLabel = normalizeWhitespace(match[1].replace(/\s+/g, ' '));
    const roundNum = match[2] ? Number(match[2]) : null;
    markers.push({
      index: match.index + (match[0].startsWith(' ') ? 1 : 0),
      end: match.index + match[0].length,
      rawLabel: roundNum ? `Round ${roundNum}` : rawLabel,
      roundNum,
      type: roundNum ? 'numbered' : 'named',
    });
    match = HEADER_RE.exec(text);
  }

  markers.sort((a, b) => a.index - b.index);

  const deduped = [];
  for (const m of markers) {
    const prev = deduped[deduped.length - 1];
    if (prev && m.index - prev.index < 8 && prev.rawLabel === m.rawLabel) continue;
    deduped.push(m);
  }
  return deduped;
}

function looksLikeSentenceTitle(text) {
  const t = normalizeWhitespace(text);
  if (!t) return false;
  if (t.length > 72) return true;
  return /^(for |each |the |participants |this |an |a |qualified |all |teams |only )/i.test(t);
}

function extractInlineTitle(body, rawLabel) {
  const chunk = normalizeWhitespace(body);
  if (!chunk) return rawLabel;

  const nextHeader = chunk.search(/\bR\s*ound\s*\d+\s*:|Elimination\s+Round\s*:|Knock-?Out\s+Round\s*:|Final\s+Round\s*:/i);
  let beforeNext = nextHeader > 0 ? chunk.slice(0, nextHeader) : chunk;

  const stopPatterns = [
    /\bPurpose\s*:/i,
    /\bParticipants\s*:/i,
    /\bFormat\s*:/i,
    /\bObjective\s*:/i,
    /\bDuration\s*:/i,
    /\bTime\s*:/i,
  ];
  for (const re of stopPatterns) {
    const m = re.exec(beforeNext);
    if (m && m.index > 0) {
      beforeNext = beforeNext.slice(0, m.index);
    }
  }

  const firstSentence = beforeNext.split(/\.\s+/)[0].trim();

  if (firstSentence && !looksLikeSentenceTitle(firstSentence) && firstSentence.length <= 72) {
    return firstSentence;
  }
  return rawLabel;
}

function splitRoundSegments(structureText) {
  const text = normalizeWhitespace(structureText);
  if (!text) return [];

  const markers = findRoundMarkers(text);
  if (!markers.length) {
    return [{ title: 'Overview', body: text }];
  }

  const segments = [];
  for (let i = 0; i < markers.length; i += 1) {
    const m = markers[i];
    const bodyStart = m.end;
    const bodyEnd = i + 1 < markers.length ? markers[i + 1].index : text.length;
    let body = normalizeWhitespace(text.slice(bodyStart, bodyEnd));
    let title = extractInlineTitle(body, m.rawLabel);

    if (m.roundNum && title === body) {
      if (/^round\s*\d+$/i.test(title)) {
        title = m.rawLabel;
      } else {
        body = '';
      }
    } else if (title !== m.rawLabel && body.startsWith(title)) {
      body = normalizeWhitespace(body.slice(title.length).replace(/^[\s.:,-]+/, ''));
    }

  if (m.type === 'named' && looksLikeSentenceTitle(title) && title.length > 40) {
    title = m.rawLabel;
  }

    segments.push({ title, body, rawLabel: m.rawLabel });
  }

  return enrichSegmentsFromSubsections(text, segments);
}

function enrichSegmentsFromSubsections(fullText, segments) {
  return segments.map((seg) => {
    if (seg.body.length > 180) return seg;

    const titleKey = seg.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const subRe = new RegExp(
      `${titleKey}\\s*:([\\s\\S]+?)(?=(?:Round\\s*\\d+|R\\s*ound\\s*\\d+|${NAMED_ROUND_HEADERS.map((h) => h.replace(/\s+/g, '\\s+')).join('|')})\\s*:|$)`,
      'i',
    );
    const match = fullText.match(subRe);
    if (match?.[1] && normalizeWhitespace(match[1]).length > seg.body.length) {
      return { ...seg, body: normalizeWhitespace(match[1]) };
    }
    return seg;
  });
}

function detectModeFromBody(body) {
  const lower = body.toLowerCase();
  const isOnline = /\b(conducted|held|made|submission(?:\s+would\s+be\s+made)?)\s+(?:through\s+)?online\b|\bonline\s+(?:mode|only|test)\b|\bvia\s+google\s+forms?\b/.test(lower);
  const isOffline = /\b(conducted|held)\s+offline\b|\boffline\s+(?:mode|only)\b|\bbrought?\s+their\s+own\s+laptops?\b/.test(lower);
  return { isOnline, isOffline };
}

function splitOfflineOnline(body, title) {
  const numberedRules = extractNumberedRules(body);
  const proseRules = numberedRules.length ? numberedRules : splitProseRules(body);
  const { isOnline, isOffline } = detectModeFromBody(`${title} ${body}`);

  const offlineBlock = body.match(/offline\s*(?:round|mode)?\s*:?\s*(.+?)(?=online\s*(?:round|mode)?\s*:|$)/i);
  const onlineBlock = body.match(/online\s*(?:round|mode)?\s*:?\s*(.+?)(?=offline\s*(?:round|mode)?\s*:|$)/i);

  if (offlineBlock && onlineBlock) {
    const offRules = extractNumberedRules(offlineBlock[1]);
    const onRules = extractNumberedRules(onlineBlock[1]);
    return {
      rules: [],
      offline: { rules: offRules.length ? offRules : splitProseRules(offlineBlock[1]) },
      online: { rules: onRules.length ? onRules : splitProseRules(onlineBlock[1]) },
    };
  }

  if (isOnline && !isOffline) {
    return { rules: [], offline: null, online: { rules: proseRules } };
  }

  if (isOffline && !isOnline) {
    return { rules: [], offline: { rules: proseRules }, online: null };
  }

  return { rules: proseRules, offline: null, online: null };
}

function buildRoundDoc(segment, index, total) {
  const { title, body, rawLabel } = segment;
  const { rules, offline, online } = splitOfflineOnline(body, title);

  let displayTitle = title || rawLabel || `Round ${index + 1}`;

  if (/^qualifier\s+round$/i.test(rawLabel || title)) {
    displayTitle = 'Qualifier Round';
  } else if (/^elimination\s+round$/i.test(rawLabel || title)) {
    displayTitle = offline && online ? 'Offline/Online Elimination Round' : 'Elimination Round';
  } else if (/^knock-?out\s+round$/i.test(rawLabel || title)) {
    displayTitle = 'Knock-Out Round';
  } else if (/^final\s+round$/i.test(rawLabel || title) || /^grand\s+final$/i.test(rawLabel || title)) {
    displayTitle = index === total - 1 ? 'Final Round' : displayTitle;
  } else if (/^preliminary\s+round$/i.test(rawLabel || title)) {
    displayTitle = 'Preliminary Round';
  } else if (/^shortlisting\s+round$/i.test(rawLabel || title)) {
    displayTitle = 'Shortlisting Round';
  }

  const description =
    rules.length === 0 && !offline && !online && body && body.length <= 220
      ? body
      : '';

  const doc = {
    roundNumber: index + 1,
    title: displayTitle,
    description,
    rules,
    roundRulesMessage: '',
    dateTime: "During MindSpark'26 (3–4 Oct 2026)",
    venue: '',
  };

  if (offline?.rules?.length) doc.offline = offline;
  if (online?.rules?.length) doc.online = online;

  return doc;
}

function parseRevitStyleTwoRound(text) {
  const psMatch = text.match(
    /Problem Statement\s*&?\s*Concept Development\s*:(.+?)(?=Design Round\s*:|$)/i,
  );
  const drMatch = text.match(/Design Round\s*:(.+?)$/i);
  if (!psMatch?.[1] || !drMatch?.[1]) return null;

  return [
    buildRoundDoc(
      { title: 'Problem Statement & Concept Development', body: psMatch[1], rawLabel: 'Round 1' },
      0,
      2,
    ),
    buildRoundDoc({ title: 'Design Round', body: drMatch[1], rawLabel: 'Round 2' }, 1, 2),
  ];
}

function parseRoundsFromStructureText(structureText) {
  const text = normalizeWhitespace(structureText);
  if (!text) return [];

  if (/Problem Statement\s*&?\s*Concept Development\s*:/i.test(text) && /Design Round\s*:/i.test(text)) {
    const revit = parseRevitStyleTwoRound(text);
    if (revit) return revit;
  }

  const segments = splitRoundSegments(text);
  if (!segments.length) return [];

  return segments.map((seg, idx) => buildRoundDoc(seg, idx, segments.length));
}

function extractStructureFromDescription(description) {
  const text = normalizeWhitespace(description);
  if (!text) return '';

  const eventStructure = text.match(
    /EVENT\s+ST(?:RUCTURE|UCTURE|UCT)\s*:?\s*(.+?)(?=RULES\s*:|ELIMINATION\s+CRITERIA\s*:|WINNING\s+CRITERIA\s*:|TEAM\s+(?:AND|&)\s+FEE|CATEGORIES\s*:|$)/i,
  );
  if (eventStructure?.[1]) {
    return normalizeWhitespace(eventStructure[1]);
  }

  if (/\bR\s*ound\s*\d+\s*:/i.test(text) || /Elimination\s+Round\s*:/i.test(text)) {
    return text;
  }

  return '';
}

function mapExistingRound(r, idx) {
  return {
    roundNumber: idx + 1,
    title: r.title || `Round ${idx + 1}`,
    description: r.description || '',
    rules: r.rules || [],
    roundRulesMessage: r.roundRulesMessage || '',
    dateTime: r.dateTime || "During MindSpark'26 (3–4 Oct 2026)",
    venue: r.venue || '',
    ...(r.offline ? { offline: r.offline } : {}),
    ...(r.online ? { online: r.online } : {}),
  };
}

function parseRoundsFromCompetitionDoc(comp) {
  const existing = Array.isArray(comp.rounds) ? comp.rounds : [];

  if (existing.length === 1 && !/^event structure$/i.test(existing[0].title || '')) {
    const only = existing[0];
    if (!/\bR\s*ound\s*\d+\s*:/i.test(only.description || '') && !/Elimination\s+Round\s*:/i.test(only.description || '')) {
      return [mapExistingRound(only, 0)];
    }
  }

  let structureText = '';
  if (existing.length >= 1) {
    const first = existing[0];
    if (/^event structure$/i.test(first.title || '') || /\bR\s*ound\s*\d+\s*:/i.test(first.description || '')) {
      structureText = first.description || '';
    }
  }

  if (!structureText) {
    structureText = extractStructureFromDescription(comp.description || '');
  }

  if (!structureText && existing.length > 1) {
    const combined = existing.map((r) => r.description || r.title).filter(Boolean).join(' ');
    if (!/\bR\s*ound\s*\d+\s*:/i.test(combined) && !/Elimination\s+Round\s*:/i.test(combined)) {
      return [mapExistingRound({ ...existing[0], description: combined || existing[0].description }, 0)];
    }
    return existing.map(mapExistingRound);
  }

  const parsed = parseRoundsFromStructureText(structureText);
  if (parsed.length) return parsed;

  if (existing.length === 1 && existing[0].description) {
    return [{
      ...mapExistingRound(existing[0], 0),
      title: existing[0].title || 'Overview',
    }];
  }

  const desc = normalizeWhitespace(comp.description || '');
  if (desc) {
    return [{
      roundNumber: 1,
      title: 'Overview',
      description: desc.length <= 300 ? desc : '',
      rules: desc.length > 300 ? splitProseRules(desc) : [],
      roundRulesMessage: '',
      dateTime: "During MindSpark'26 (3–4 Oct 2026)",
      venue: '',
    }];
  }

  return [];
}

module.exports = {
  normalizeWhitespace,
  parseRoundsFromStructureText,
  parseRoundsFromCompetitionDoc,
  extractStructureFromDescription,
};
