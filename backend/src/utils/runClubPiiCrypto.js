const crypto = require('crypto');

const OPERATIONAL_RESPONSE_KEYS = new Set(['people', 'date', 'time']);

function getMasterKey() {
    const raw = String(process.env.RUN_CLUB_PII_MASTER_KEY || process.env.JWT_SECRET || '').trim();
    if (!raw) {
        throw new Error('RUN_CLUB_PII_MASTER_KEY or JWT_SECRET is required for run-club PII encryption');
    }
    return crypto.createHash('sha256').update(`run-club-pii-v1:${raw}`).digest();
}

function getClubDek(runClubId) {
    if (!runClubId) throw new Error('runClubId is required for PII encryption');
    return crypto.createHmac('sha256', getMasterKey()).update(`club:${String(runClubId)}`).digest();
}

function encryptPayload(dek, value) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    const plain = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value ?? ''), 'utf8');
    const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${enc.toString('base64url')}`;
}

function decryptPayload(dek, packed, { json = false } = {}) {
    if (!packed || typeof packed !== 'string') return json ? null : '';
    const parts = packed.split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') {
        throw new Error('Unsupported PII ciphertext format');
    }
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    const data = Buffer.from(parts[3], 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    if (!json) return out;
    try {
        return JSON.parse(out);
    } catch {
        return null;
    }
}

function responsesToPlainObject(responses) {
    if (!responses) return {};
    if (responses instanceof Map) return Object.fromEntries(responses);
    if (typeof responses === 'object') return { ...responses };
    return {};
}

function pickOperationalResponses(responses) {
    const src = responsesToPlainObject(responses);
    const out = {};
    for (const key of OPERATIONAL_RESPONSE_KEYS) {
        if (src[key] !== undefined && src[key] !== null && src[key] !== '') {
            out[key] = src[key];
        }
    }
    return out;
}

function normalizeForSearch(kind, value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    if (kind === 'phone') return raw.replace(/\D/g, '');
    if (kind === 'email') return raw.replace(/\s+/g, '');
    return raw.replace(/\s+/g, ' ');
}

function hashSearchToken(kind, value) {
    const normalized = normalizeForSearch(kind, value);
    if (!normalized || (kind === 'phone' && normalized.length < 6)) return null;
    return crypto
        .createHmac('sha256', getMasterKey())
        .update(`${kind}:${normalized}`)
        .digest('base64url');
}

function buildPiiSearchTokens(responses = {}) {
    const src = responsesToPlainObject(responses);
    const tokens = new Set();

    const add = (kind, value) => {
        const token = hashSearchToken(kind, value);
        if (token) tokens.add(token);
    };

    add('phone', src.contact_no || src.phone || src.mobile || src.contact);
    add('email', src.email || src.e_mail);
    add('name', src.full_name || src.name || src.fullname);

    const name = String(src.full_name || src.name || '').trim().toLowerCase();
    if (name) {
        name.split(/\s+/).filter((w) => w.length >= 2).forEach((word) => add('name', word));
    }

    return [...tokens];
}

function searchTokensForQuery(query) {
    const q = String(query || '').trim();
    if (!q) return [];
    const tokens = new Set();
    const add = (kind, value) => {
        const token = hashSearchToken(kind, value);
        if (token) tokens.add(token);
    };
    add('phone', q);
    add('email', q);
    add('name', q);
    q.toLowerCase().split(/\s+/).filter((w) => w.length >= 2).forEach((word) => add('name', word));
    return [...tokens];
}

/**
 * Encrypt sensitive registration fields for a run club.
 * Keeps operational keys (people/date/time) in plaintext responses.
 */
function encryptRegistrationPii({ responses, paymentScreenshotUrl, transactionId, runClubId }) {
    const dek = getClubDek(runClubId);
    const fullResponses = responsesToPlainObject(responses);
    return {
        piiEncrypted: true,
        runClubId,
        responses: pickOperationalResponses(fullResponses),
        responsesCipher: encryptPayload(dek, fullResponses),
        paymentScreenshotUrl: '',
        paymentScreenshotCipher: paymentScreenshotUrl
            ? encryptPayload(dek, String(paymentScreenshotUrl))
            : '',
        transactionId: '',
        transactionIdCipher: transactionId ? encryptPayload(dek, String(transactionId)) : '',
        piiSearchTokens: buildPiiSearchTokens(fullResponses),
    };
}

/**
 * Decrypt into a plain registration-shaped object (does not mutate DB doc).
 * Legacy plaintext rows pass through unchanged.
 */
function decryptRegistrationPii(reg, runClubIdOverride = null) {
    if (!reg) return reg;
    const runClubId = runClubIdOverride || reg.runClubId;
    if (!reg.piiEncrypted || !runClubId) {
        return typeof reg.toObject === 'function' ? reg.toObject() : { ...reg };
    }

    const plain = typeof reg.toObject === 'function' ? reg.toObject() : { ...reg };
    try {
        const dek = getClubDek(runClubId);
        if (plain.responsesCipher) {
            const decoded = decryptPayload(dek, plain.responsesCipher, { json: true });
            if (decoded && typeof decoded === 'object') {
                plain.responses = decoded;
            }
        }
        if (plain.paymentScreenshotCipher) {
            plain.paymentScreenshotUrl = decryptPayload(dek, plain.paymentScreenshotCipher);
        }
        if (plain.transactionIdCipher) {
            plain.transactionId = decryptPayload(dek, plain.transactionIdCipher);
        }
    } catch (err) {
        console.error('[runClubPiiCrypto.decrypt]', err.message);
    }

    // Never leak ciphertext to clients that receive decrypted views
    delete plain.responsesCipher;
    delete plain.paymentScreenshotCipher;
    delete plain.transactionIdCipher;
    delete plain.piiSearchTokens;
    return plain;
}

function decryptManyRegistrations(regs, runClubId) {
    return (regs || []).map((r) => decryptRegistrationPii(r, runClubId || r.runClubId));
}

/** Admin / platform: hide participant PII and ciphertext. */
function redactRegistrationPii(reg) {
    if (!reg) return reg;
    const plain = typeof reg.toObject === 'function' ? reg.toObject() : { ...reg };
    if (!plain.piiEncrypted) {
        // Legacy plaintext run-club rows: still redact sensitive form fields for admin
        const ops = pickOperationalResponses(plain.responses);
        plain.responses = ops;
        plain.paymentScreenshotUrl = plain.paymentScreenshotUrl ? '[redacted]' : '';
        plain.transactionId = plain.transactionId ? '[redacted]' : '';
        plain.piiRedacted = true;
        return plain;
    }

    plain.responses = pickOperationalResponses(plain.responses);
    plain.paymentScreenshotUrl = '';
    plain.transactionId = '';
    delete plain.responsesCipher;
    delete plain.paymentScreenshotCipher;
    delete plain.transactionIdCipher;
    delete plain.piiSearchTokens;
    plain.piiRedacted = true;
    return plain;
}

function isPiiEncryptionEnabled() {
    return Boolean(String(process.env.RUN_CLUB_PII_MASTER_KEY || process.env.JWT_SECRET || '').trim());
}

module.exports = {
    OPERATIONAL_RESPONSE_KEYS,
    encryptRegistrationPii,
    decryptRegistrationPii,
    decryptManyRegistrations,
    redactRegistrationPii,
    searchTokensForQuery,
    buildPiiSearchTokens,
    isPiiEncryptionEnabled,
    pickOperationalResponses,
};
