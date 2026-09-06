const multer = require('multer');
const { createNotification } = require('../notificationController');
const { sendPushNotification } = require('../../services/pushService');
const { logger } = require('../../utils/logger');

function parseResponsesBody(body = {}) {
  let responses = body.responses;
  if (!responses) return {};
  if (typeof responses === 'string') {
    try {
      responses = JSON.parse(responses);
    } catch {
      return {};
    }
  }
  if (typeof responses !== 'object' || Array.isArray(responses)) return {};
  const out = {};
  for (const [key, value] of Object.entries(responses)) {
    if (key.endsWith('_file')) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'object' && (value.uploaded || value.url || value.ready)) continue;
    out[key] = value;
  }
  return out;
}

function mergeRegistrationResponses(base, extra) {
  const merged = { ...(base || {}) };
  for (const [key, value] of Object.entries(extra || {})) {
    if (value !== null && value !== undefined && value !== '') {
      merged[key] = value;
    }
  }
  return merged;
}

async function maybeEnrichExistingResponses(existingDoc, extraResponses) {
  if (!extraResponses || Object.keys(extraResponses).length === 0) return existingDoc;
  const current =
    existingDoc.responses instanceof Map
      ? Object.fromEntries(existingDoc.responses)
      : { ...(existingDoc.responses || {}) };
  let changed = false;
  for (const [key, value] of Object.entries(extraResponses)) {
    const cur = current[key];
    if (cur === undefined || cur === null || cur === '') {
      current[key] = value;
      changed = true;
    }
  }
  if (changed) {
    existingDoc.responses = current;
    await existingDoc.save();
  }
  return existingDoc;
}

/** Create in-app notification + push (call after HTTP response is sent). */
async function notifyRegistrationSuccess(userId, { title, message, body, link, metadata }) {
  await createNotification({
    userId,
    title,
    message,
    type: 'registration',
    link,
    metadata,
  });
  sendPushNotification(userId, {
    title,
    body: body || message,
    link,
    type: 'registration',
  }).catch(() => {});
}

function scheduleRegistrationNotification(userId, payload) {
  setImmediate(async () => {
    try {
      await notifyRegistrationSuccess(userId, payload);
    } catch (notifErr) {
      logger.error('❌ Notification creation error:', notifErr.message);
    }
  });
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types for registration forms
    const allowedTypes = [
      'image/jpeg',
      'image/png', 
      'image/jpg',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  },
});

module.exports = {
  parseResponsesBody,
  mergeRegistrationResponses,
  maybeEnrichExistingResponses,
  notifyRegistrationSuccess,
  scheduleRegistrationNotification,
  upload,
};
