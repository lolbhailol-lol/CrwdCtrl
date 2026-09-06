/**
 * Seed Techfest IIT Bombay 2026 fest + competitions from the official API.
 * Registration is CrwdCtrl-only (INTERNAL_FORM).
 *
 * Usage:
 *   node scripts/seed-techfest-2026.js
 *   node scripts/seed-techfest-2026.js --assign-email organizer@example.com
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Fest = require('../src/model/fest_organizer_model');
const Competition = require('../src/model/competition_model');
const FestOrganizerAccount = require('../src/model/fest_organizer_account_model');

const path = require('path');
const fs = require('fs');

const TECHFEST_API = 'https://techfest.org/api/compis/';
const SLUG = 'techfest-iit-bombay-2026';
const VENUE = 'IIT Bombay, Mumbai';
const FEST_DATE = '16–18 December 2026';
const DEFAULT_DATETIME = 'During Techfest 2026 (16–18 Dec 2026)';

/** Cloudinary URLs from admin-style upload (see upload-techfest-assets-to-cloudinary.js). */
function loadTechfestMedia() {
  const mapPath = path.join(__dirname, 'techfest-cloudinary-urls.json');
  if (fs.existsSync(mapPath)) {
    try {
      const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      if (map.coverImage && Array.isArray(map.galleryImages) && map.galleryImages.length) {
        return { coverImage: map.coverImage, galleryImages: map.galleryImages };
      }
    } catch (_) {
      /* ignore */
    }
  }
  return {
    coverImage: 'https://res.cloudinary.com/dyonimhgb/image/upload/v1788729283/crwdctrl/fests/techfest/theme-logo.webp',
    galleryImages: [
      'https://res.cloudinary.com/dyonimhgb/image/upload/v1788729284/crwdctrl/fests/techfest/gallery/compi2.webp',
      'https://res.cloudinary.com/dyonimhgb/image/upload/v1788729285/crwdctrl/fests/techfest/gallery/compi1.webp',
      'https://res.cloudinary.com/dyonimhgb/image/upload/v1788729286/crwdctrl/fests/techfest/gallery/ws1.png',
      'https://res.cloudinary.com/dyonimhgb/image/upload/v1788729287/crwdctrl/fests/techfest/gallery/ws2.png',
      'https://res.cloudinary.com/dyonimhgb/image/upload/v1788729288/crwdctrl/fests/techfest/gallery/exhi1.jpg',
      'https://res.cloudinary.com/dyonimhgb/image/upload/v1788729289/crwdctrl/fests/techfest/gallery/exhi2.jpg',
      'https://res.cloudinary.com/dyonimhgb/image/upload/v1788729290/crwdctrl/fests/techfest/gallery/exhi3.jpg',
      'https://res.cloudinary.com/dyonimhgb/image/upload/v1788729291/crwdctrl/fests/techfest/gallery/exhi4.jpg',
      'https://res.cloudinary.com/dyonimhgb/image/upload/v1788729292/crwdctrl/fests/techfest/gallery/edm1.webp',
      'https://res.cloudinary.com/dyonimhgb/image/upload/v1788729293/crwdctrl/fests/techfest/gallery/edm2.webp',
      'https://res.cloudinary.com/dyonimhgb/image/upload/v1788729294/crwdctrl/fests/techfest/gallery/edm3.webp',
      'https://res.cloudinary.com/dyonimhgb/image/upload/v1788729295/crwdctrl/fests/techfest/gallery/lec1.jpg',
      'https://res.cloudinary.com/dyonimhgb/image/upload/v1788729296/crwdctrl/fests/techfest/gallery/lec2.jpg',
      'https://res.cloudinary.com/dyonimhgb/image/upload/v1788729297/crwdctrl/fests/techfest/gallery/lec3.jpg',
      'https://res.cloudinary.com/dyonimhgb/image/upload/v1788729299/crwdctrl/fests/techfest/gallery/lec4.jpg',
    ],
  };
}

const TECHFEST_MEDIA = loadTechfestMedia();
const TECHFEST_THEME_LOGO = TECHFEST_MEDIA.coverImage;
const TECHFEST_GALLERY = TECHFEST_MEDIA.galleryImages;

const MODULE_ORDER = [
  'Competitions',
  'Pushpak Grand Challenge 2026',
  'Ideates',
  'Zonals',
];

const FORM_SCHEMA = [
  { id: 'full_name', type: 'text', label: 'Full Name', fieldName: 'full_name', required: true, placeholder: 'Your full name' },
  { id: 'email', type: 'email', label: 'Email Address', fieldName: 'email', required: true, placeholder: 'you@email.com' },
  { id: 'mobile', type: 'tel', label: 'Mobile Number', fieldName: 'mobile', required: true, placeholder: '10-digit mobile number' },
  { id: 'college', type: 'text', label: 'College / Institute', fieldName: 'college_name', required: true, placeholder: 'Your college / school name' },
  { id: 'team_name', type: 'text', label: 'Team Name (if applicable)', fieldName: 'team_name', required: false, placeholder: 'Leave blank for solo events' },
];

/** Roster: group lead = full details; other members = name + contact only. */
const TECHFEST_PERSON_FIELDS = [
  {
    id: 'pf_name',
    key: 'name',
    label: 'Full name',
    type: 'text',
    scope: 'person',
    roles: ['leader', 'member'],
    options: [],
    placeholder: 'Full name',
    required: true,
  },
  {
    id: 'pf_email',
    key: 'email',
    label: 'Email',
    type: 'email',
    scope: 'person',
    roles: ['leader'],
    options: [],
    placeholder: 'you@email.com',
    required: true,
  },
  {
    id: 'pf_phone',
    key: 'phone',
    label: 'Phone number',
    type: 'tel',
    scope: 'person',
    roles: ['leader', 'member'],
    options: [],
    placeholder: '10-digit mobile',
    required: true,
  },
  {
    id: 'pf_college',
    key: 'college',
    label: 'College name',
    type: 'text',
    scope: 'person',
    roles: ['leader'],
    options: [],
    placeholder: 'College / institution',
    required: true,
  },
  {
    id: 'pf_state',
    key: 'state',
    label: 'State',
    type: 'text',
    scope: 'person',
    roles: ['leader'],
    options: [],
    placeholder: 'State',
    required: true,
  },
  {
    id: 'pf_pin',
    key: 'pin',
    label: 'PIN code',
    type: 'text',
    scope: 'person',
    roles: ['leader'],
    options: [],
    placeholder: '6-digit PIN',
    required: true,
  },
];

function teamSizeLabel(min, max) {
  if (min === max && max === 1) return 'Solo';
  if (min === max) return `${max} people`;
  if (min === 1) return `Max ${max} people`;
  return `${min}–${max} people`;
}

function parseArgs(argv) {
  const out = { assignEmail: '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--assign-email' && argv[i + 1]) {
      out.assignEmail = String(argv[i + 1]).trim().toLowerCase();
      i += 1;
    }
  }
  return out;
}

function splitLines(text = '') {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Split official rules text into clean bullets (dedupe numbered repeats; keep real @techfest.org emails). */
function normalizeCommonRules(rulesText = '') {
  const raw = String(rulesText || '')
    .replace(/\r\n/g, '\n')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

  const pieces = [];
  for (const line of raw.split('\n')) {
    let t = line.replace(/\s+/g, ' ').trim().replace(/^["']+|["']+$/g, '').trim();
    if (!t) continue;
    // Numbered block packed into one line / quoted paragraph
    if ((t.match(/\d+\.\s+/g) || []).length > 1) {
      pieces.push(...t.split(/(?=\d+\.\s+)/).map((s) => s.trim()).filter(Boolean));
    } else {
      pieces.push(t);
    }
  }

  const seen = new Set();
  const out = [];
  for (const piece of pieces) {
    let line = piece
      .replace(/^["']+|["']+$/g, '')
      .trim();
    if (!line) continue;

    // Registration is on CrwdCtrl — only rewrite registration phrases, never emails/domains
    line = line
      .replace(/\bregister online at techfest\.org\b/gi, 'register on CrwdCtrl')
      .replace(/\bmust register online at techfest\.org\b/gi, 'must register on CrwdCtrl')
      .replace(/\bon the official Techfest website\b/gi, 'on CrwdCtrl')
      .replace(/\bavailable on techfest\.org\b/gi, 'available on the official Techfest website')
      .replace(/\btechfest\.org\s*>\s*Competitions\b/gi, 'CrwdCtrl > Competitions')
      // Repair any previously mangled emails from older seeds
      .replace(/@CrwdCtrl\b/gi, '@techfest.org');

    // Never leave fake @CrwdCtrl addresses
    if (/@[Cc]rwd[Cc]trl\b/.test(line)) {
      line = line.replace(/@[Cc]rwd[Cc]trl\b/g, '@techfest.org');
    }

    const key = line
      .toLowerCase()
      .replace(/^\d+\.\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    // Drop leftover numbering from official quoted lists
    out.push(line.replace(/^\d+\.\s*/, '').trim());
  }
  return out;
}

function parseContact(raw = '') {
  const lines = splitLines(raw);
  const email = (lines.find((l) => l.includes('@')) || '').replace(/\[email\s*protected\]/gi, '').trim();
  const phone = (lines.find((l) => /\d{8,}/.test(l.replace(/\s/g, ''))) || '').trim();
  const name = lines.find((l) => l !== email && l !== phone && !l.includes('@')) || '';
  return {
    name: name || 'Techfest Organizer',
    email: email.includes('@') ? email : '',
    phone,
    instagram: '',
  };
}

function competitionTypeFor(compi) {
  const id = String(compi.compi_id || '').toLowerCase();
  const name = String(compi.name || '').toLowerCase();
  if (id === 'qcc' || id === 'zero-code' || name.includes('code')) return 'coding';
  if (id === 'npc' || name.includes('probability')) return 'quiz';
  if (name.includes('ideathon') || id === 'lqideathon' || id === 'india71100' || id === 'innovatex') {
    return 'hackathon';
  }
  return 'technical';
}

function teamBounds(compi) {
  const max = Math.max(1, Number(compi.max_team_size) || 1);
  const id = String(compi.compi_id || '').toLowerCase();
  let min = 1;
  if (id === 'oll') min = 3;
  if (!compi.is_team_compi) {
    return { teamSizeMin: 1, teamSizeMax: 1, teamSizeLabel: 'Solo' };
  }
  return {
    teamSizeMin: Math.min(min, max),
    teamSizeMax: max,
    teamSizeLabel: teamSizeLabel(Math.min(min, max), max),
  };
}

/**
 * Split "Round 1: Short Name (Online): long paragraph…" into title + description.
 */
function splitRoundHeading(rawTitle = '') {
  const raw = String(rawTitle || '').replace(/^["']|["']$/g, '').trim();
  if (!raw) return { title: 'Round', description: '' };

  const headed = raw.match(/^(round\s*\d+|stage\s*\d+|qualifying(?:\s*round)?|grand\s*finale|finals?)\s*:\s*(.+)$/i);
  if (headed) {
    const prefix = headed[1].replace(/\s+/g, ' ').trim();
    const rest = headed[2].trim();
    const second = rest.match(/^(.{3,90}?)\s*:\s+(.+)$/);
    if (second) {
      return {
        title: `${prefix}: ${second[1].trim()}`.slice(0, 100),
        description: second[2].trim(),
      };
    }
    if (rest.length > 90) {
      return {
        title: `${prefix}: ${rest.slice(0, 64).trim()}…`.slice(0, 100),
        description: rest,
      };
    }
    return { title: `${prefix}: ${rest}`.slice(0, 100), description: '' };
  }

  if (raw.length > 100) {
    return { title: `${raw.slice(0, 80).trim()}…`, description: raw };
  }
  return { title: raw.slice(0, 100), description: '' };
}

/**
 * Parse official structure text into Competition.rounds[].
 */
function parseRounds(structure = '', timeline = '', venue = VENUE) {
  const text = String(structure || '').replace(/\r\n/g, '\n').trim();
  if (!text) {
    return [
      {
        roundNumber: 1,
        title: 'Preliminary Round',
        description: 'Details as per official Techfest problem statement.',
        rules: [],
        online: { rules: [] },
        offline: { rules: [] },
        roundRulesMessage: '',
        dateTime: DEFAULT_DATETIME,
        venue: '',
      },
      {
        roundNumber: 2,
        title: 'Grand Finale at Techfest, IIT Bombay',
        description: 'On-site finale at IIT Bombay during Techfest 2026.',
        rules: [],
        online: { rules: [] },
        offline: { rules: ['Held on campus at IIT Bombay.'] },
        roundRulesMessage: '',
        dateTime: FEST_DATE,
        venue,
      },
    ];
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const blocks = [];
  let current = null;

  const isHeading = (line) =>
    /^(round|stage|qualifying|grand finale|finals?)\b/i.test(line) ||
    /^(round|stage)\s*\d+/i.test(line) ||
    /–|—/.test(line) && /^(round|stage|qualifying|grand)/i.test(line.split(/–|—/)[0].trim());

  for (const line of lines) {
    if (/^(eligibility|team size|participation|themes?|objectives?|gameplay)\b/i.test(line)) {
      if (current) current.meta.push(line);
      continue;
    }
    if (isHeading(line) || /^(round|stage)\s*\d+/i.test(line)) {
      if (current) blocks.push(current);
      current = { title: line.replace(/^["']|["']$/g, '').trim(), body: [], meta: [] };
      continue;
    }
    if (!current) {
      current = { title: 'Overview', body: [], meta: [] };
    }
    current.body.push(line);
  }
  if (current) blocks.push(current);

  // Prefer blocks that look like rounds/stages
  let roundBlocks = blocks.filter((b) =>
    /round|stage|qualifying|finale|finals/i.test(b.title)
  );
  if (!roundBlocks.length) {
    // Fallback: treat whole structure as one prelim + implied finale
    roundBlocks = [
      {
        title: 'Competition structure',
        body: lines.filter((l) => !/^(eligibility|team size)/i.test(l)),
        meta: [],
      },
    ];
  }

  const timelineLines = splitLines(timeline);
  const rounds = roundBlocks.map((b, idx) => {
    // Short title + description when official text packs everything into one heading line
    const split = splitRoundHeading(b.title);
    const title = split.title;
    const bodyLines = [...b.meta, ...b.body, ...(split.description ? [split.description] : [])]
      .map((l) => String(l || '').replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);
    const fullText = bodyLines.join('\n').trim();
    const lower = `${title}\n${fullText}`.toLowerCase();
    const isFinale =
      /finale|final presentation|grand challenge finale|on-site final|at techfest|iit bombay/.test(lower) &&
      !/online qualifier|round 1|stage 1|preliminary/.test(title.toLowerCase());
    const isOnline =
      /online|hackerearth|abstract|submission|email|simulation/.test(lower) &&
      !isFinale;
    const isOffline =
      /on-site|onsite|offline|zonal|arena|in person|iit bombay|grand finale/.test(lower);

    const dateHint =
      timelineLines.find((t) => {
        const tLow = t.toLowerCase();
        if (isFinale && /finale|finals|16th|15th-18th|december/.test(tLow)) return true;
        if (!isFinale && /round 1|stage 1|registration|qualifier|zonal|submission/.test(tLow)) return true;
        return false;
      }) || (isFinale ? FEST_DATE : DEFAULT_DATETIME);

    // Short blurb for the round header; remaining lines as rules
    const shortDesc = (bodyLines[0] || '').slice(0, 320);
    const rules = bodyLines.length > 1 ? bodyLines.slice(1) : [];

    return {
      roundNumber: idx + 1,
      title,
      description: shortDesc,
      rules,
      online: {
        rules: isOnline
          ? ['This stage is conducted online / via remote submission as per the official problem statement.']
          : [],
      },
      offline: {
        rules: isOffline || isFinale
          ? ['This stage is held on-ground (zonal centre and/or Techfest, IIT Bombay) as per the official schedule.']
          : [],
      },
      roundRulesMessage: '',
      dateTime: dateHint.replace(/^[^:]*:\s*/i, '').trim() || DEFAULT_DATETIME,
      venue: isFinale || /iit bombay|techfest/.test(lower) ? venue : '',
    };
  });

  // Ensure a finale round exists when text mentions IIT Bombay finale but parser missed it
  const hasFinale = rounds.some((r) => /finale|final/i.test(r.title));
  if (!hasFinale && /iit bombay|grand finale|on-site final/i.test(text)) {
    rounds.push({
      roundNumber: rounds.length + 1,
      title: 'Grand Finale at Techfest, IIT Bombay',
      description: 'Finalists compete / present on campus during Techfest 2026.',
      rules: [],
      online: { rules: [] },
      offline: { rules: ['Held at IIT Bombay during Techfest 2026.'] },
      roundRulesMessage: '',
      dateTime: FEST_DATE,
      venue,
    });
  }

  return rounds;
}

function resourceLinksFor(compi) {
  const links = [];
  if (compi.probStatement) {
    links.push({ label: 'Problem Statement', url: compi.probStatement });
  }
  if (compi.compi_id) {
    links.push({
      label: 'Official Techfest website',
      url: `https://techfest.org/competitions/${compi.compi_id}`,
    });
  }
  return links;
}

function sponsorsFromCompis(compis) {
  const seen = new Set();
  const sponsors = [{ name: 'CrwdCtrl', logo: '' }];
  for (const c of compis) {
    if (!c.sponsorLink && !c.sponsorImg) continue;
    const key = c.sponsorLink || c.sponsorImg;
    if (seen.has(key)) continue;
    seen.add(key);
    let name = 'Partner';
    try {
      if (c.sponsorLink) name = new URL(c.sponsorLink).hostname.replace(/^www\./, '');
    } catch {
      /* ignore */
    }
    if (/janestreet|jane\.street/i.test(c.sponsorLink || '')) name = 'Jane Street';
    if (/juspay/i.test(c.sponsorLink || '')) name = 'Juspay';
    if (/oll\.co/i.test(c.sponsorLink || '')) name = 'OLL';
    if (/logiqids/i.test(c.sponsorLink || '')) name = 'LogIQids';
    sponsors.push({ name, logo: c.sponsorImg || '' });
  }
  return sponsors;
}

function normalizeModule(genreDisplay = '') {
  const raw = String(genreDisplay || '').trim();
  if (!raw) return 'Competitions';
  const hit = MODULE_ORDER.find((m) => m.toLowerCase() === raw.toLowerCase());
  return hit || raw;
}

function buildDescription(compi) {
  const about = String(compi.about || compi.desc || '').trim();
  const parts = [about];
  parts.push(
    '',
    'Prelims are mostly online or at city zonals; the grand finale is at Techfest, IIT Bombay (16–18 December 2026). Register on CrwdCtrl.'
  );
  return parts.join('\n').slice(0, 8000);
}

async function fetchCompis() {
  const res = await fetch(TECHFEST_API);
  if (!res.ok) throw new Error(`Failed to fetch ${TECHFEST_API}: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) throw new Error('Empty compi list from Techfest API');
  return data.filter((c) => c.live !== false);
}

async function upsertFest(compis) {
  const description = [
    "Techfest, IIT Bombay is Asia's largest science and technology festival — the 30th edition runs 16–18 December 2026 on campus.",
    'Competitions span coding, robotics, drones (PUSHPAK), ideates, and nationwide zonals. Most preliminary rounds are online or at regional centres; grand finales are at IIT Bombay.',
    'CrwdCtrl is an additional partner. All competition registrations on this page are through CrwdCtrl.',
  ].join('\n\n');

  const payload = {
    festName: 'Techfest',
    subtitle: "Asia's Largest Science & Technology Festival · IIT Bombay",
    collegeName: 'IIT Bombay',
    festType: 'technical',
    festDate: FEST_DATE,
    venue: VENUE,
    description,
    coverImage: TECHFEST_THEME_LOGO,
    galleryImages: TECHFEST_GALLERY,
    slug: SLUG,
    status: 'ongoing',
    homeSection: 'trending',
    homePriority: 1,
    isApproved: true,
    priority: 1,
    competitionsHeading: 'Competitions',
    ticketPrice: 'Free',
    feeAmount: 0,
    platformFeePercent: 0,
    sponsors: sponsorsFromCompis(compis),
    registration: {
      mode: 'INTERNAL_FORM',
      externalLink: '',
      formType: 'SINGLE_STEP',
      formSchema: FORM_SCHEMA,
      formInstructions:
        'Register for Techfest IIT Bombay competitions on CrwdCtrl. Organizers manage entries from the fest dashboard.',
      organizerEmail: process.env.TECHFEST_ORGANIZER_EMAIL || 'aryan@techfest.org',
      resourceLinks: [],
      whatsappCommunityLink: '',
    },
  };

  let fest = await Fest.findOne({ slug: SLUG });
  if (!fest) {
    fest = await Fest.findOne({
      festName: /techfest/i,
      collegeName: /bombay|iit/i,
    });
  }

  if (fest) {
    Object.assign(fest, payload);
    await fest.save();
    console.log('Updated fest:', fest._id.toString(), fest.festName);
  } else {
    fest = await Fest.create(payload);
    console.log('Created fest:', fest._id.toString(), fest.festName);
  }
  return fest;
}

async function upsertCompetition(fest, compi) {
  const moduleName = normalizeModule(compi.genre_display);
  const team = teamBounds(compi);
  const contact = parseContact(compi.contact);
  const commonRules = normalizeCommonRules(compi.rules);
  const rounds = parseRounds(compi.structure, compi.timeline, VENUE);
  const resourceLinks = resourceLinksFor(compi);
  const subtitle =
    String(compi.compi_id || '').toLowerCase() === 'lqideathon'
      ? 'Invite-only · Ideation finals at IIT Bombay'
      : moduleName;

  const doc = {
    fest: fest._id,
    name: String(compi.name || '').trim(),
    subtitle,
    module: moduleName,
    competitionType: competitionTypeFor(compi),
    category: 'TECHNICAL',
    description: buildDescription(compi) || String(compi.desc || 'Techfest competition').trim(),
    prizePool: String(compi.prize || 'To be announced').trim(),
    dateTime: DEFAULT_DATETIME,
    venue: VENUE,
    coverImage: compi.compiImg || fest.coverImage || '',
    gallery: compi.compiImg ? [compi.compiImg] : [],
    commonRules: commonRules.length
      ? commonRules
      : [
          'Follow the official Techfest problem-statement rules for this competition.',
          'Organizers’ and judges’ decisions are final.',
          'Finalists must carry valid ID for verification at IIT Bombay.',
        ],
    commonRulesMessage: '',
    rounds,
    registrationFee: 'Free',
    feeAmount: 0,
    feeTiers: [],
    slotsAllotted: 50,
    showSlotsPublic: false,
    ...team,
    registrationType: 'fest',
    registration: {
      status: 'internal_form',
      externalUrl: '',
      whatsappGroupLink: compi.walink || '',
      resourceLinks,
      formType: 'SINGLE_STEP',
      formSchema: [],
      personFields: TECHFEST_PERSON_FIELDS,
      settings: {
        allowMultipleRegistrations: true,
        maxRegistrations: 500,
      },
    },
    contact,
    isApproved: true,
  };

  let existing = await Competition.findOne({ fest: fest._id, name: doc.name });
  if (!existing && compi.compi_id) {
    existing = await Competition.findOne({
      fest: fest._id,
      'registration.resourceLinks.url': `https://techfest.org/competitions/${compi.compi_id}`,
    });
  }

  if (existing) {
    Object.assign(existing, doc);
    await existing.save();
    console.log('  updated:', doc.name, `(${moduleName})`);
    return existing;
  }

  const created = await Competition.create(doc);
  console.log('  created:', doc.name, `(${moduleName})`);
  return created;
}

async function syncFestCompetitionIds(fest, competitionIds) {
  fest.competitions = competitionIds;
  await fest.save();
}

async function assignOrganizer(fest, email) {
  if (!email) return;
  const account = await FestOrganizerAccount.findOne({ email });
  if (!account) {
    console.warn(`No FestOrganizerAccount found for ${email} — create the account in admin, then re-run with --assign-email`);
    return;
  }
  const idStr = fest._id.toString();
  const already = (account.assignedFestIds || []).some((id) => String(id) === idStr);
  if (!already) {
    account.assignedFestIds = [...(account.assignedFestIds || []), fest._id];
    await account.save();
  }
  console.log(`Assigned fest to organizer dashboard: ${email}`);
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI missing in backend/.env');
  }

  console.log('Fetching official Techfest competitions…');
  const compis = await fetchCompis();
  console.log(`Got ${compis.length} live competitions`);

  await mongoose.connect(process.env.MONGODB_URI);

  const fest = await upsertFest(compis);
  const ids = [];
  for (const compi of compis) {
    const comp = await upsertCompetition(fest, compi);
    ids.push(comp._id);
  }
  await syncFestCompetitionIds(fest, ids);
  await assignOrganizer(fest, args.assignEmail || process.env.TECHFEST_ORGANIZER_ACCOUNT_EMAIL || '');

  console.log('\nDone.');
  console.log(`Fest slug: ${SLUG}`);
  console.log(`Fest id: ${fest._id.toString()}`);
  console.log(`Competitions: ${ids.length}`);
  console.log('Public URL path: /view-details/techfest-iit-bombay-2026');
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
