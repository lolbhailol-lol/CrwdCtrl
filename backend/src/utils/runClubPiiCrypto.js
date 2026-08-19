const crypto = require('crypto');

const OPERATIONAL_RESPONSE_KEYS = new Set(['people', 'date', 'time', 'gender', 'sex']);
const PII_RESPONSE_KEYS = new Set([
    'full_name',
    'fullname',
    'name',
    'email',
    'e_mail',
    'e_mail_id',
    'contact_no',
    'phone',
    'mobile',
    'contact',
    'emergency_contact',
    'emergency_phone',
    'guardian_contact',
]);

/** Ordered key sources — primary first, JWT fallback for rows encrypted before RUN_CLUB_PII_MASTER_KEY existed. */
function listMasterKeyMaterial() {
    const candidates = [];
    const add = (raw) => {
        const trimmed = String(raw || '').trim();
        if (!trimmed) return;
        if (candidates.some((c) => c === trimmed)) return;
        candidates.push(trimmed);
    };
    add(process.env.RUN_CLUB_PII_MASTER_KEY);
    add(process.env.JWT_SECRET);
    if (!candidates.length) {
        throw new Error('RUN_CLUB_PII_MASTER_KEY or JWT_SECRET is required for run-club PII encryption');
    }
    return candidates;
}

function deriveMasterKey(raw) {
    return crypto.createHash('sha256').update(`run-club-pii-v1:${raw}`).digest();
}

function getMasterKey() {
    return deriveMasterKey(listMasterKeyMaterial()[0]);
}

function canonicalRunClubId(runClubId) {
    if (!runClubId) return '';
    if (typeof runClubId.toHexString === 'function') {
        return String(runClubId.toHexString()).toLowerCase();
    }
    if (typeof runClubId === 'object' && runClubId._id && runClubId._id !== runClubId) {
        return canonicalRunClubId(runClubId._id);
    }
    const hex = String(runClubId).match(/[a-f0-9]{24}/i);
    if (hex) return hex[0].toLowerCase();
    const asString = String(runClubId);
    if (asString === '[object Object]') return '';
    return asString;
}

function runClubIdDecryptVariants(runClubId) {
    const ids = new Set();
    const add = (value) => {
        const s = String(value || '').trim();
        if (s) ids.add(s);
    };
    add(canonicalRunClubId(runClubId));
    add(runClubId);
    if (runClubId && typeof runClubId === 'object') {
        add(runClubId._id);
        add(runClubId.id);
        if (typeof runClubId.toString === 'function') add(runClubId.toString());
    }
    return [...ids];
}

function getClubDekFromMaster(masterKey, runClubId) {
    const id = canonicalRunClubId(runClubId) || String(runClubId || '');
    if (!id) throw new Error('runClubId is required for PII encryption');
    return crypto.createHmac('sha256', masterKey).update(`club:${id}`).digest();
}

function getClubDek(runClubId) {
    return getClubDekFromMaster(getMasterKey(), runClubId);
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

function tryDecryptPayload(dek, packed, { json = false } = {}) {
    try {
        return decryptPayload(dek, packed, { json });
    } catch {
        return json ? null : '';
    }
}

/** Try each configured master key until AES-GCM auth succeeds (handles pre/post master-key migration). */
function decryptFieldWithKeyFallback(runClubId, packed, { json = false } = {}) {
    if (!packed) return json ? null : '';
    for (const id of runClubIdDecryptVariants(runClubId)) {
        for (const raw of listMasterKeyMaterial()) {
            const dek = getClubDekFromMaster(deriveMasterKey(raw), id);
            const out = tryDecryptPayload(dek, packed, { json });
            if (json) {
                if (out && typeof out === 'object') return out;
            } else if (out) {
                return out;
            }
        }
    }
    return json ? null : '';
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
    for (const [key, value] of Object.entries(src)) {
        if (value === undefined || value === null || value === '') continue;
        if (typeof value === 'object') continue;
        if (PII_RESPONSE_KEYS.has(String(key).toLowerCase())) continue;
        out[key] = value;
    }
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

function hashSearchTokenWithMaster(masterKey, kind, value) {
    const normalized = normalizeForSearch(kind, value);
    if (!normalized || (kind === 'phone' && normalized.length < 6)) return null;
    return crypto
        .createHmac('sha256', masterKey)
        .update(`${kind}:${normalized}`)
        .digest('base64url');
}

function hashSearchToken(kind, value) {
    return hashSearchTokenWithMaster(getMasterKey(), kind, value);
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
    const addForMaster = (masterKey, kind, value) => {
        const token = hashSearchTokenWithMaster(masterKey, kind, value);
        if (token) tokens.add(token);
    };
    for (const raw of listMasterKeyMaterial()) {
        const masterKey = deriveMasterKey(raw);
        addForMaster(masterKey, 'phone', q);
        addForMaster(masterKey, 'email', q);
        addForMaster(masterKey, 'name', q);
        q.toLowerCase().split(/\s+/).filter((w) => w.length >= 2).forEach((word) => {
            addForMaster(masterKey, 'name', word);
        });
    }
    return [...tokens];
}

/**
 * Encrypt sensitive registration fields for a run club.
 * Name / email / phone stay in ciphertext. Form answers (gender, café, skill)
 * stay on plaintext `responses` so the organizer dashboard can read them
 * even if decrypt fails.
 */
function encryptRegistrationPii({ responses, paymentScreenshotUrl, transactionId, runClubId }) {
    const dek = getClubDek(runClubId);
    const fullResponses = responsesToPlainObject(responses);
    return {
        piiEncrypted: true,
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
function decryptRegistrationPiiWithStatus(reg, runClubIdOverride = null) {
    if (!reg) {
        return {
            plain: reg,
            responsesOk: true,
            screenshotOk: true,
            transactionOk: true,
        };
    }
    const runClubId = runClubIdOverride || reg.runClubId;
    if (!reg.piiEncrypted || !runClubId) {
        const plain = typeof reg.toObject === 'function' ? reg.toObject() : { ...reg };
        return {
            plain,
            responsesOk: true,
            screenshotOk: true,
            transactionOk: true,
        };
    }

    const plain = typeof reg.toObject === 'function' ? reg.toObject() : { ...reg };
    let responsesOk = !plain.responsesCipher;
    let screenshotOk = !plain.paymentScreenshotCipher;
    let transactionOk = !plain.transactionIdCipher;

    if (plain.responsesCipher) {
        const decoded = decryptFieldWithKeyFallback(runClubId, plain.responsesCipher, { json: true });
        if (decoded && typeof decoded === 'object') {
            const ops = pickOperationalResponses(plain.responses);
            plain.responses = { ...decoded, ...ops };
            responsesOk = true;
        }
    }
    if (plain.paymentScreenshotCipher) {
        const url = decryptFieldWithKeyFallback(runClubId, plain.paymentScreenshotCipher);
        if (url) {
            plain.paymentScreenshotUrl = url;
            screenshotOk = true;
        }
    }
    if (plain.transactionIdCipher) {
        const tx = decryptFieldWithKeyFallback(runClubId, plain.transactionIdCipher);
        if (tx) {
            plain.transactionId = tx;
            transactionOk = true;
        }
    }

    if (plain.responsesCipher && !responsesOk && listMasterKeyMaterial().length >= 2) {
        console.error('[runClubPiiCrypto.decrypt] Unsupported state or unable to authenticate data');
    }

    delete plain.responsesCipher;
    delete plain.paymentScreenshotCipher;
    delete plain.transactionIdCipher;
    delete plain.piiSearchTokens;
    return {
        plain,
        responsesOk,
        screenshotOk,
        transactionOk,
    };
}

function decryptRegistrationPii(reg, runClubIdOverride = null) {
    return decryptRegistrationPiiWithStatus(reg, runClubIdOverride).plain;
}

/**
 * Merge organizer form answers onto a registration without replacing ciphertext
 * when PII cannot be decrypted.
 */
function persistMergedRegistrationResponses(registration, mergedResponses, runClubId) {
    const merged = responsesToPlainObject(mergedResponses);
    const encryptedEnabled = Boolean(runClubId) && isPiiEncryptionEnabled();
    const status = decryptRegistrationPiiWithStatus(registration, runClubId);

    if (!encryptedEnabled || !registration.piiEncrypted) {
        registration.responses = merged;
        return { mode: 'plaintext', ...status };
    }

    if (!status.responsesOk && registration.responsesCipher) {
        registration.responses = pickOperationalResponses(merged);
        return { mode: 'plaintext-ops-only', ...status };
    }

    const encrypted = encryptRegistrationPii({
        responses: merged,
        paymentScreenshotUrl: status.screenshotOk ? (status.plain.paymentScreenshotUrl || '') : '',
        transactionId: status.transactionOk ? (status.plain.transactionId || '') : '',
        runClubId,
    });

    if (!status.screenshotOk && registration.paymentScreenshotCipher) {
        encrypted.paymentScreenshotCipher = registration.paymentScreenshotCipher;
        encrypted.paymentScreenshotUrl = '';
    }
    if (!status.transactionOk && registration.transactionIdCipher) {
        encrypted.transactionIdCipher = registration.transactionIdCipher;
        encrypted.transactionId = '';
    }

    registration.set(encrypted);
    return { mode: 'reencrypt', ...status };
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
    canonicalRunClubId,
    encryptRegistrationPii,
    persistMergedRegistrationResponses,
    decryptRegistrationPii,
    decryptRegistrationPiiWithStatus,
    decryptManyRegistrations,
    redactRegistrationPii,
    searchTokensForQuery,
    buildPiiSearchTokens,
    isPiiEncryptionEnabled,
    pickOperationalResponses,
    deriveMasterKey,
    listMasterKeyMaterial,
    getClubDekFromMaster,
    tryDecryptPayload,
};
