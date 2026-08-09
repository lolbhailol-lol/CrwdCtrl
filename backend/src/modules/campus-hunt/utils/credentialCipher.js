const crypto = require('crypto');
const { getJwtSecret } = require('../../../config/jwtSecret');

function key() {
  const material = process.env.CAMPUS_HUNT_CREDENTIAL_KEY || getJwtSecret();
  return crypto.createHash('sha256').update(String(material)).digest();
}

function encryptCredential(value) {
  if (!value) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptCredential(value) {
  if (!value) return '';
  if (!String(value).startsWith('v1.')) return String(value);
  const [, ivPart, tagPart, encryptedPart] = String(value).split('.');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key(),
    Buffer.from(ivPart, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

module.exports = { encryptCredential, decryptCredential };
