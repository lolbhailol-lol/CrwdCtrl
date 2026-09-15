const crypto = require('crypto');
const { getJwtSecret } = require('../../../config/jwtSecret');

function deriveKey(material) {
  return crypto.createHash('sha256').update(String(material || '')).digest();
}

/** Active key + legacy fallbacks (JWT secret) so rotating CAMPUS_HUNT_CREDENTIAL_KEY does not 500. */
function candidateKeys() {
  const keys = [];
  const seen = new Set();
  const push = (material) => {
    const m = String(material || '').trim();
    if (!m || seen.has(m)) return;
    seen.add(m);
    keys.push(deriveKey(m));
  };
  push(process.env.CAMPUS_HUNT_CREDENTIAL_KEY);
  push(getJwtSecret());
  return keys;
}

function encryptCredential(value) {
  if (!value) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', candidateKeys()[0], iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptWithKey(value, keyBuf) {
  const [, ivPart, tagPart, encryptedPart] = String(value).split('.');
  if (!ivPart || !tagPart || !encryptedPart) return null;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    keyBuf,
    Buffer.from(ivPart, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Decrypt team credential. Never throws on wrong key / corrupt ciphertext —
 * returns '' so login/reveal can respond with a clear 401/409 instead of 500.
 */
function decryptCredential(value) {
  if (!value) return '';
  if (!String(value).startsWith('v1.')) return String(value);

  for (const keyBuf of candidateKeys()) {
    try {
      const plain = decryptWithKey(value, keyBuf);
      if (plain != null) return plain;
    } catch {
      // Wrong key or bad tag — try next candidate
    }
  }
  return '';
}

module.exports = { encryptCredential, decryptCredential };
