function requireNonEmptyString(value, fieldName) {
  if (value == null || String(value).trim() === '') {
    const err = new Error(`${fieldName} is required`);
    err.status = 400;
    throw err;
  }
  return String(value).trim();
}

function parseChallengeNumber(raw) {
  const n = Number(raw);
  if (![1, 2, 3, 4].includes(n)) {
    const err = new Error('Invalid challenge number');
    err.status = 400;
    throw err;
  }
  return n;
}

function validateAnswerBody(body = {}) {
  const answer = requireNonEmptyString(body.answer, 'answer');
  if (answer.length > 200) {
    const err = new Error('Answer is too long');
    err.status = 400;
    throw err;
  }
  return { answer, requestId: body.requestId ? String(body.requestId).slice(0, 128) : undefined };
}

function validateHintBody(body = {}) {
  if (body.confirm !== true) {
    const err = new Error('Hint confirmation required (confirm: true)');
    err.status = 400;
    throw err;
  }
  return { requestId: body.requestId ? String(body.requestId).slice(0, 128) : undefined };
}

module.exports = {
  requireNonEmptyString,
  parseChallengeNumber,
  validateAnswerBody,
  validateHintBody,
};
