const AdmZip = require('adm-zip');

const FOLDER_TYPE_MAP = {
  ROBOTICA: { competitionType: 'technical', category: 'TECHNICAL' },
  VOLTUS: { competitionType: 'technical', category: 'TECHNICAL' },
  AVIONICA: { competitionType: 'technical', category: 'TECHNICAL' },
  POTENTIA: { competitionType: 'technical', category: 'TECHNICAL' },
  SUBSTANTIA: { competitionType: 'technical', category: 'TECHNICAL' },
  CODIFICA: { competitionType: 'coding', category: 'TECHNICAL' },
  HACKATHON: { competitionType: 'hackathon', category: 'TECHNICAL' },
  IDEATHON: { competitionType: 'hackathon', category: 'TECHNICAL' },
  DESIGNOVA: { competitionType: 'design', category: 'TECHNICAL' },
  STRUKTURA: { competitionType: 'design', category: 'TECHNICAL' },
  LOGICA: { competitionType: 'quiz', category: 'ACADEMIC' },
  QUANTAMANIA: { competitionType: 'quiz', category: 'ACADEMIC' },
  PRODIGIUM: { competitionType: 'quiz', category: 'ACADEMIC' },
  'FAN-FRENZY': { competitionType: 'informals', category: 'CULTURAL' },
  AMUZIA: { competitionType: 'cultural', category: 'CULTURAL' },
  ILLUMINATI: { competitionType: 'cultural', category: 'CULTURAL' },
  'GAME OF INNOVATION': { competitionType: 'business', category: 'OTHER' },
  'GENIUS JUNIOR': { competitionType: 'other', category: 'OTHER' },
};

const SECTION_HEADERS = [
  'EVENT OBJECTIVE',
  'EVENT STRUCTURE',
  'RULES',
  'ELIMINATION CRITERIA',
  'WINNING CRITERIA',
  'TEAM AND FEE STRUCTURE',
  'TEAM FEE AND STRUCTURE',
  'EVENT HEADS',
  'EVENT HEAD',
  'EVENTS HEADS',
  'FAQS',
  'FAQ',
  'NOTE',
];

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/MindSpark['']?\s*2\s*6/gi, "MindSpark'26")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Collapse OCR/docx spaced digits: "1 0 minutes" → "10 minutes", "1 99" → "199" */
function collapseSpacedDigits(value) {
  return String(value || '').replace(/(\d)\s+(?=\d)/g, '$1');
}

/** Soft cleanup for public copy (rules / rounds / about body) */
function tidyPublicText(value) {
  return collapseSpacedDigits(normalizeWhitespace(value))
    .replace(/\beve\s+nt\b/gi, 'event')
    .replace(/\bg\s+round\b/gi, 'ground')
    .replace(/\bo\s+pen\b/gi, 'open')
    .replace(/\bF\s+inal\b/gi, 'Final')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .trim();
}

function ensureSentencePeriod(value) {
  const text = String(value || '').trim().replace(/[.]+$/, '');
  if (!text) return '';
  return `${text}.`;
}

function formatTeamSizeAboutLine(teamSize) {
  const size = String(teamSize || '').trim().replace(/[.]+$/, '');
  if (!size) return '';
  return `Team size: ${size}.`;
}

/** Keep About = objective only — never paste event structure / rules into overview */
function looksLikeStructureDump(text) {
  const t = String(text || '');
  if (!t) return false;
  const roundHits = (t.match(/\bround\s*\d+\b/gi) || []).length;
  const ruleHits = (t.match(/\b\d+\.\s+/g) || []).length;
  return roundHits >= 2 || ruleHits >= 3 || /\bevent\s+st[ru]*cture\b/i.test(t);
}

/** Cut About at structure/categories/rules so overview stays short */
function trimAboutObjective(text) {
  let body = tidyPublicText(text);
  if (!body) return '';
  body = body.replace(/^Team size:[^.]*\.?\s*/i, '').trim();
  const cut = body.search(
    /\bEVENT\s+ST[RU]*CTURE\b|\bCATEGORIES\s*:|\bRULES\s*:|\bRound\s*\d+\s*:|\bELIMINATION\s+CRITERIA\b|\bWINNING\s+CRITERIA\b|\bTEAM\s+AND\s+FEE\b/i,
  );
  if (cut > 40) body = body.slice(0, cut).trim();
  if (looksLikeStructureDump(body)) {
    // Keep first 1–2 sentences only
    const sentences = body.match(/[^.!?]+[.!?]+/g) || [body];
    body = sentences.slice(0, 2).join(' ').trim();
  }
  return body.replace(/\s+/g, ' ').trim();
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith('091')) return `+91${digits.slice(3)}`;
  return digits ? `+${digits}` : '';
}

function extractDocxText(buffer) {
  const zip = new AdmZip(buffer);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) {
    throw new Error('Invalid docx: missing word/document.xml');
  }
  const xml = entry.getData().toString('utf8');
  const parts = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  return normalizeWhitespace(
    parts.map((part) => part.replace(/<[^>]+>/g, '')).join(' ')
  );
}

async function extractPdfText(buffer) {
  const { PDFParse } = require('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return normalizeWhitespace(result.text || '');
  } finally {
    await parser.destroy();
  }
}

function cleanCompetitionName(filename, folderName) {
  let name = filename.replace(/\.(docx|pdf)$/i, '');
  name = name.replace(/\bRulebook\d*\b/gi, '');
  name = name.replace(/\bRuleBook\d*\b/gi, '');
  name = name.replace(/\b_rulebook\d*\b/gi, '');
  name = name.replace(/\[[^\]]*\]/g, '');
  name = name.replace(/\([^)]*\)/g, '');
  name = name.replace(/^\s*ROBOTICA\s*-\s*/i, '');
  name = name.replace(/^\s*AVIONICA\s*-\s*/i, '');
  name = name.replace(/^\s*THE GAME OF INNOVATIONS\s*$/i, 'Game of Innovation');
  name = name.replace(/^\s*RULEBOOK-IDEATHON\s*$/i, 'Ideathon');
  name = name.replace(/^\s*-IDEATHON\s*$/i, 'Ideathon');
  name = name.replace(/\bGOOGLER[_\s-]*1?\s*Rulebook?\b/gi, 'Googler');
  name = name.replace(/\bROBO\s*FALCONARY\b/gi, 'Robo Falconry');
  name = name.replace(/\bTake\s*off\s*26\b/gi, 'Take Off');
  name = name.replace(/\bFOX\s*HUNT\b/gi, 'Fox Hunt');
  name = name.replace(/\bedited\b/gi, '');
  name = name.replace(/\bdone\b/gi, '');
  name = name.replace(/\bfinal+\^?\b/gi, '');
  name = name.replace(/\brulebook\b/gi, '');
  name = name.replace(/[_]+/g, ' ');
  name = name.replace(/\s{2,}/g, ' ').trim();
  name = name.replace(/\d+$/, '').trim();
  name = name.replace(/\.$/, '').trim();
  if (/^FANDOM\.?$/i.test(name)) name = 'FANDOM';
  if (/^BEYOND\s*SUITS$/i.test(name)) name = 'Beyond Suits';
  if (!name) {
    name = folderName.replace(/[_-]+/g, ' ').trim();
  }
  return name;
}

function extractSection(text, header, nextHeaders = SECTION_HEADERS) {
  const headerPattern = header.replace(/\s+/g, '\\s*');
  const nextPattern = nextHeaders
    .filter((h) => h !== header)
    .map((h) => h.replace(/\s+/g, '\\s*'))
    .join('|');
  // Require a colon after headers so narrative "event heads will…" does not truncate RULES.
  const regex = new RegExp(
    `(?:^|\\s)${headerPattern}\\s*:\\s*(.*?)(?=\\s(?:${nextPattern})\\s*:|$)`,
    'is'
  );
  const match = text.match(regex);
  return match ? normalizeWhitespace(match[1]) : '';
}

function parseRules(text) {
  const rulesBlock = extractSection(text, 'RULES', [
    'ELIMINATION CRITERIA',
    'WINNING CRITERIA',
    'TEAM AND FEE STRUCTURE',
    'TEAM FEE AND STRUCTURE',
    'EVENT HEADS',
    'EVENT HEAD',
    'EVENTS HEADS',
    'FAQS',
    'FAQ',
    'NOTE',
  ]);
  if (!rulesBlock) return [];

  const cleaned = tidyPublicText(rulesBlock)
    .replace(/^RULES?\s*:?\s*/i, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');

  const numbered = [];
  // Split on "1." / "1)" / "1-" style markers so combined OCR blobs become separate rules
  const numberedParts = cleaned.split(/(?=(?:^|\s)\d+\s*[.)\-]\s+)/);
  for (const part of numberedParts) {
    const match = part.match(/(?:^|\s)(\d+)\s*[.)\-]\s*(.+)$/);
    if (match) {
      const rule = tidyPublicText(match[2]);
      if (rule.length > 8) numbered.push(rule);
    }
  }

  const dedupe = (list) => {
    const seen = new Set();
    const out = [];
    for (const rule of list) {
      const key = rule.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(rule);
    }
    return out;
  };

  if (numbered.length >= 2) return dedupe(numbered);

  return dedupe(
    cleaned
      .replace(/\be\.g\.\s+/gi, 'eg ')
      .replace(/\bi\.e\.\s+/gi, 'ie ')
      .split(/(?<=[.!?])\s+(?=[A-Z(])/)
      .map((rule) => tidyPublicText(rule.replace(/\beg\s+/gi, 'e.g. ').replace(/\bie\s+/gi, 'i.e. ')))
      .filter((rule) => rule.length > 12),
  );
}

function parseRounds(text) {
  const structure = extractSection(text, 'EVENT STRUCTURE', [
    'RULES',
    'ELIMINATION CRITERIA',
    'WINNING CRITERIA',
    'TEAM AND FEE STRUCTURE',
    'TEAM FEE AND STRUCTURE',
    'EVENT HEADS',
    'EVENT HEAD',
    'EVENTS HEADS',
    'FAQS',
    'FAQ',
    'NOTE',
  ]);
  const source = structure || text;
  const { parseRoundsFromStructureText } = require('../utils/competitionRoundsParser');
  const parsed = parseRoundsFromStructureText(source);
  if (parsed.length) {
    return sanitizeRoundList(
      parsed.map((round, index) => ({
        ...round,
        title: tidyPublicText(round.title || `Round ${index + 1}`),
        description: tidyPublicText(round.description || ''),
        rules: (round.rules || []).map((r) => tidyPublicText(r)).filter(Boolean),
        roundNumber: round.roundNumber || index + 1,
      })),
    );
  }

  if (!structure) return [];

  return [
    {
      roundNumber: 1,
      title: 'Event Structure',
      description: tidyPublicText(structure),
      rules: [],
      dateTime: 'TBA',
      venue: '',
    },
  ];
}

/** Drop false "rounds" created from narrative like "Round 2 would be held offline" */
function sanitizeRoundList(rounds = []) {
  const cleaned = rounds.filter((round) => {
    const title = String(round.title || '').trim();
    if (!title) return false;
    if (/would be held|must report|failure to do so|compulsory to attend|online on|webinar would/i.test(title)) {
      return false;
    }
    // "Round 2 would be held offline…" style titles
    if (/^round\s*\d+\b/i.test(title) && title.split(/\s+/).length > 3) {
      return false;
    }
    return true;
  });

  return cleaned.map((round, index) => ({
    ...round,
    roundNumber: index + 1,
  }));
}

function parseTeamSize(text) {
  const feeBlock =
    extractSection(text, 'TEAM AND FEE STRUCTURE', [
      'EVENT HEADS',
      'EVENT HEAD',
      'EVENTS HEADS',
      'FAQS',
      'FAQ',
      'NOTE',
    ]) ||
    extractSection(text, 'TEAM FEE AND STRUCTURE', [
      'EVENT HEADS',
      'EVENT HEAD',
      'EVENTS HEADS',
      'FAQS',
      'FAQ',
      'NOTE',
    ]) ||
    '';

  const source = collapseSpacedDigits(feeBlock || text);
  const rangeMatch = source.match(
    /team\s*siz\s*e\s*:?\s*(\d+\s*[–\-to]+\s*\d+\s*participants?\s*(?:per\s*team)?)/i,
  );
  if (rangeMatch) {
    return normalizeWhitespace(rangeMatch[1].replace(/\s*[–\-]\s*/g, '–'));
  }

  const individual = source.match(/team\s*siz\s*e\s*:?\s*(individual[^.]*?)(?:registration|\.|$)/i);
  if (individual) {
    return normalizeWhitespace(individual[1]);
  }

  const maxMatch =
    source.match(/team\s*siz\s*e\s*:?\s*(max(?:imum)?(?:\s*of)?\s*\d+\s*(?:participants?\s*)?(?:per\s*team)?)/i) ||
    source.match(/team\s*siz\s*e\s*:?\s*(maximum\s*\d+\s*(?:participants?\s*)?(?:per\s*team)?)/i) ||
    source.match(/maximum\s*(?:of\s*)?(\d+)\s*(?:participants?|members?|players?)\s*per\s*team/i);

  if (maxMatch) {
    const raw = maxMatch[1];
    if (/^\d+$/.test(raw)) return `Max ${raw} participants per team`;
    return normalizeWhitespace(raw.replace(/^max(?:imum)?(?:\s*of)?/i, 'Max'));
  }

  if (/strictly\s+an\s+individual\s+event/i.test(text)) {
    return 'Individual event';
  }

  const faqTeam =
    source.match(/team\s+of\s+maximum\s+(\d+)/i) ||
    text.match(/Participants can take part in a team of maximum\s+(\d+)/i) ||
    text.match(/maximum\s+(?:of\s+)?(\d+)\s+(?:players|members|participants)/i);
  if (faqTeam) {
    return `Max ${faqTeam[1]} participants per team`;
  }

  return '';
}

function parseFee(text) {
  const feeBlock =
    extractSection(text, 'TEAM AND FEE STRUCTURE', [
      'EVENT HEADS',
      'EVENT HEAD',
      'EVENTS HEADS',
      'FAQS',
      'FAQ',
      'NOTE',
    ]) ||
    extractSection(text, 'TEAM FEE AND STRUCTURE', [
      'EVENT HEADS',
      'EVENT HEAD',
      'EVENTS HEADS',
      'FAQS',
      'FAQ',
      'NOTE',
    ]) ||
    '';

  const collapsed = collapseSpacedDigits(feeBlock || text);
  const feeMatch =
    collapsed.match(/registration\s*fe\s*e\s*:?\s*(?:₹|rs\.?\s*)?\s*([\d,]+)\s*(per\s*(?:team|person))?/i) ||
    collapsed.match(/registration\s*fee\s*:?\s*(?:₹|rs\.?\s*)?\s*([\d,]+)\s*(per\s*(?:team|person))?/i);

  if (!feeMatch) {
    return { registrationFee: 'TBA', feeAmount: 0 };
  }

  const amount = Number(String(feeMatch[1]).replace(/[^\d]/g, '')) || 0;
  if (!amount) {
    return { registrationFee: 'TBA', feeAmount: 0 };
  }
  const unit = /person/i.test(feeMatch[2] || '') ? 'per person' : 'per team';
  return {
    registrationFee: `₹${amount} ${unit}`,
    feeAmount: amount,
  };
}

function parsePrizePool(text) {
  const prizePatterns = [
    /(?:1st|first)\s*(?:prize|place)?\s*:?\s*(?:₹|rs\.?\s*)[\d,]+/i,
    /(?:2nd|second)\s*(?:prize|place)?\s*:?\s*(?:₹|rs\.?\s*)[\d,]+/i,
    /prize\s*money\s*:?\s*(?:₹|rs\.?\s*)[\d,]+/i,
    /winner\s*:?\s*(?:₹|rs\.?\s*)[\d,]+/i,
    /prize\s*pool\s*:?\s*(?:₹|rs\.?\s*)[\d,]+/i,
  ];

  const matches = prizePatterns
    .map((pattern) => text.match(pattern))
    .filter(Boolean)
    .map((match) => normalizeWhitespace(match[0]));

  if (matches.length) {
    return matches.join(' | ');
  }

  if (/prize\s*money\s*is\s*subject\s*to\s*change/i.test(text) ||
      /prizes?\s*are\s*subject\s*to\s*change/i.test(text)) {
    return 'Subject to change';
  }

  return 'Subject to change';
}

function extractEventHeadsBlock(text) {
  const matches = [...String(text || '').matchAll(/\bEVENTS?\s*HEAD\s*S?\s*:/gi)];
  if (!matches.length) return '';
  // Prefer the last explicit heads header (earlier matches are often narrative "Event Head reserves…")
  const last = matches[matches.length - 1];
  const start = last.index + last[0].length;
  const rest = text.slice(start);
  const endMatch = rest.match(/\b(?:NOTE|FAQs?|FAQ)\s*:/i);
  return normalizeWhitespace(endMatch ? rest.slice(0, endMatch.index) : rest.slice(0, 500));
}

function tidyPersonName(name) {
  return normalizeWhitespace(name)
    .replace(/\b([A-Z])\s+(?=[a-z])/g, '$1') // "S hreyas" → "Shreyas"
    .replace(/\s+/g, ' ')
    .trim();
}

function parseContact(text) {
  const headsBlock = extractEventHeadsBlock(text);
  if (!headsBlock || /^NOTE\b/i.test(headsBlock.trim())) {
    return { name: '', phone: '', email: '', instagram: '' };
  }

  const pairs = [];
  const pairRe =
    /([A-Za-z][A-Za-z\s.'-]{1,40}?)\s*:\s*(?:\+?\s*91[\s-]?)?([6-9]\d{4}[\s-]?\d{5})/g;
  let match;
  while ((match = pairRe.exec(headsBlock)) !== null) {
    const name = tidyPersonName(match[1]);
    if (!name || /^(NOTE|FAQ|FAQs|EVENT|TEAM|HEAD|HEADS)$/i.test(name)) continue;
    const phone = normalizePhone(match[2]);
    if (!phone) continue;
    pairs.push({ name, phone });
  }

  if (!pairs.length) {
    return { name: '', phone: '', email: '', instagram: '' };
  }

  return {
    name: pairs.map((p) => p.name).join(' / '),
    phone: pairs.map((p) => p.phone).join(', '),
    email: '',
    instagram: '',
  };
}

function mapFolderMeta(folderName) {
  const key = folderName.toUpperCase().trim();
  return FOLDER_TYPE_MAP[key] || { competitionType: 'other', category: 'OTHER' };
}

function buildCompetitionPayload({ folderName, filename, text }) {
  const { competitionType, category } = mapFolderMeta(folderName);
  const name = cleanCompetitionName(filename, folderName);
  const objectiveRaw = extractSection(text, 'EVENT OBJECTIVE');
  // Never fall back to EVENT STRUCTURE — that dumps rounds into About/overview
  let objective = objectiveRaw
    ? trimAboutObjective(objectiveRaw)
    : `${name} is a competition at MindSpark'26.`;
  if (!objective || looksLikeStructureDump(objective)) {
    objective = `${name} is a competition at MindSpark'26.`;
  }
  const teamSize = parseTeamSize(text);
  // About = objective only (no "Team size:" opener — that belongs in fee/team block)
  const description = objective;
  const { registrationFee, feeAmount } = parseFee(text);
  const warnings = [];

  if (registrationFee === 'TBA') {
    warnings.push('Registration fee not found in rulebook');
  }
  if (!objectiveRaw) {
    warnings.push('EVENT OBJECTIVE section not found');
  }
  if (!teamSize) {
    warnings.push('Team size not found in rulebook');
  }
  if (!parseContact(text).phone) {
    warnings.push('Event head contact not found in rulebook');
  }

  return {
    name,
    subtitle: folderName,
    competitionType,
    category,
    description,
    teamSize,
    prizePool: parsePrizePool(text),
    dateTime: 'TBA',
    venue: '',
    commonRules: parseRules(text),
    commonRulesMessage: '',
    rounds: parseRounds(text),
    registrationFee,
    feeAmount,
    registrationType: 'fest',
    contact: parseContact(text),
    isApproved: true,
    registration: {
      status: 'not_started',
      externalUrl: '',
      googleSheetsUrl: '',
      formSchema: [],
      settings: {
        allowMultipleRegistrations: true,
        requireEmailVerification: false,
        autoConfirmation: true,
        maxRegistrations: null,
        registrationDeadline: null,
      },
    },
    legacyRegistration: { status: 'NOT_STARTED' },
  };
}

function normalizeZipPath(entryPath) {
  return String(entryPath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

async function parseRulebookEntry({ folderName, filename, buffer, ext }) {
  const sourceFile = folderName ? `${folderName}/${filename}` : filename;
  try {
    let text = '';
    if (ext === '.docx') {
      text = extractDocxText(buffer);
    } else if (ext === '.pdf') {
      text = await extractPdfText(buffer);
    } else {
      return {
        sourceFile,
        status: 'skipped',
        warnings: [`Unsupported file type: ${ext}`],
        parsed: null,
      };
    }

    if (!text || text.length < 20) {
      return {
        sourceFile,
        status: 'error',
        warnings: ['Could not extract meaningful text from file'],
        parsed: null,
      };
    }

    const parsed = buildCompetitionPayload({ folderName, filename, text });
    return {
      sourceFile,
      status: 'ok',
      warnings: [],
      parsed,
    };
  } catch (error) {
    return {
      sourceFile,
      status: 'error',
      warnings: [error.message || 'Failed to parse rulebook'],
      parsed: null,
    };
  }
}

async function parseRulebookZip(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries().filter((entry) => !entry.isDirectory);
  const results = [];

  for (const entry of entries) {
    const normalized = normalizeZipPath(entry.entryName);
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length === 0) continue;

    const filename = parts[parts.length - 1];
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    if (!['.docx', '.pdf'].includes(ext)) continue;

    const folderName = parts.length > 1 ? parts[parts.length - 2] : '';
    const buffer = entry.getData();
    const result = await parseRulebookEntry({ folderName, filename, buffer, ext });
    results.push(result);
  }

  results.sort((a, b) => a.sourceFile.localeCompare(b.sourceFile));

  return {
    total: results.length,
    ok: results.filter((r) => r.status === 'ok').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    errors: results.filter((r) => r.status === 'error').length,
    items: results,
  };
}

function buildCompetitionFromImportRow(row, festId, getCompetitionBaseFee) {
  const {
    name,
    subtitle,
    competitionType,
    category,
    description,
    prizePool,
    dateTime,
    venue,
    commonRules,
    commonRulesMessage,
    rounds,
    registrationFee,
    feeAmount,
    contact,
    registrationType,
    registration,
    legacyRegistration,
    isApproved,
  } = row;

  if (!name || !description || !prizePool || !registrationFee) {
    throw new Error(`Missing required fields for "${name || 'unknown'}"`);
  }

  return {
    fest: festId,
    name,
    subtitle: subtitle || '',
    competitionType: competitionType || 'other',
    category: category || 'OTHER',
    description,
    prizePool,
    dateTime: dateTime || 'TBA',
    venue: venue || '',
    coverImage: '',
    gallery: [],
    commonRules: commonRules || [],
    commonRulesMessage: commonRulesMessage || '',
    rounds: rounds || [],
    registrationFee: registrationFee || 'TBA',
    feeAmount: getCompetitionBaseFee(registrationFee, feeAmount),
    registrationLink: '',
    registrationFields: [],
    contact: contact || {},
    registrationType: registrationType || 'fest',
    registration: registration || {
      status: 'not_started',
      externalUrl: '',
      googleSheetsUrl: '',
      formSchema: [],
      settings: {
        allowMultipleRegistrations: true,
        requireEmailVerification: false,
        autoConfirmation: true,
        maxRegistrations: null,
        registrationDeadline: null,
      },
    },
    legacyRegistration: legacyRegistration || { status: 'NOT_STARTED' },
    isApproved: isApproved !== false,
  };
}

module.exports = {
  parseRulebookZip,
  buildCompetitionFromImportRow,
  buildCompetitionPayload,
  extractDocxText,
  mapFolderMeta,
  cleanCompetitionName,
};
