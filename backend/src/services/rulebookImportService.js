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
  'EVENT HEAD',
  'FAQS',
];

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
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
  name = name.replace(/\bedited\b/gi, '');
  name = name.replace(/\bdone\b/gi, '');
  name = name.replace(/\bfinal+\^?\b/gi, '');
  name = name.replace(/\brulebook\b/gi, '');
  name = name.replace(/[_]+/g, ' ');
  name = name.replace(/\s{2,}/g, ' ').trim();
  name = name.replace(/\d+$/, '').trim();
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
  const regex = new RegExp(
    `(?:^|\\s)${headerPattern}\\s*:?\\s*(.*?)(?=\\s(?:${nextPattern})\\s*:?|$)`,
    'is'
  );
  const match = text.match(regex);
  return match ? normalizeWhitespace(match[1]) : '';
}

function parseRules(text) {
  const rulesBlock = extractSection(text, 'RULES');
  if (!rulesBlock) return [];
  return rulesBlock
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((rule) => rule.trim())
    .filter((rule) => rule.length > 10);
}

function parseRounds(text) {
  const structure = extractSection(text, 'EVENT STRUCTURE');
  if (!structure) return [];

  const roundMatches = [...structure.matchAll(/Round\s*(\d+)\s*:?\s*([^R]+?)(?=Round\s*\d+\s*:?|$)/gi)];
  if (roundMatches.length) {
    return roundMatches.map((match, index) => ({
      roundNumber: Number(match[1]) || index + 1,
      title: `Round ${match[1]}`,
      description: normalizeWhitespace(match[2]),
      rules: [],
      dateTime: 'TBA',
      venue: '',
    }));
  }

  return [
    {
      roundNumber: 1,
      title: 'Event Structure',
      description: structure,
      rules: [],
      dateTime: 'TBA',
      venue: '',
    },
  ];
}

function parseFee(text) {
  const feeBlock = extractSection(text, 'TEAM AND FEE STRUCTURE', [
    ...SECTION_HEADERS,
    'TEAM FEE AND STRUCTURE',
  ]) || extractSection(text, 'TEAM FEE AND STRUCTURE');

  const feeMatch =
    feeBlock.match(/registration\s*f\s*e\s*e\s*:?\s*(?:₹|rs\.?\s*)?\s*([\d,\s]+)/i) ||
    feeBlock.match(/registration\s*fee\s*:?\s*(?:₹|rs\.?\s*)?\s*([\d,\s]+)/i) ||
    text.match(/registration\s*f\s*e\s*e\s*:?\s*(?:₹|rs\.?\s*)?\s*([\d,\s]+)/i) ||
    text.match(/registration\s*fee\s*:?\s*(?:₹|rs\.?\s*)?\s*([\d,\s]+)/i);

  if (!feeMatch) {
    return { registrationFee: 'TBA', feeAmount: 0 };
  }

  const digits = feeMatch[1].replace(/[^\d]/g, '');
  const amount = Number(digits) || 0;
  if (!amount) {
    return { registrationFee: 'TBA', feeAmount: 0 };
  }
  return {
    registrationFee: `₹${amount} per team`,
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

function parseContact(text) {
  const headsBlock = extractSection(text, 'EVENT HEAD');
  if (!headsBlock) return {};

  const phoneMatch = headsBlock.match(/(?:\+91|91)?[\s-]?[6-9]\d{4}[\s-]?\d{5}/);
  const nameMatch = headsBlock.match(/^([A-Za-z][A-Za-z\s.'-]{2,40}?)(?:\s*:|\s+\+91|\s+\d)/);

  return {
    name: nameMatch ? normalizeWhitespace(nameMatch[1]) : '',
    phone: phoneMatch ? phoneMatch[0].replace(/\s+/g, '') : '',
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
  const description =
    extractSection(text, 'EVENT OBJECTIVE') ||
    extractSection(text, 'EVENT STRUCTURE') ||
    `${name} competition at ${folderName}.`;
  const { registrationFee, feeAmount } = parseFee(text);
  const warnings = [];

  if (registrationFee === 'TBA') {
    warnings.push('Registration fee not found in rulebook');
  }
  if (!extractSection(text, 'EVENT OBJECTIVE')) {
    warnings.push('EVENT OBJECTIVE section not found');
  }

  return {
    name,
    subtitle: folderName,
    competitionType,
    category,
    description,
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
