/**
 * Normalize challenge answers for comparison.
 * Trims, collapses whitespace, lowercases (unless preserveCase).
 */
function normalizeAnswer(value, { preserveCase = false } = {}) {
  if (value == null) return '';
  let s = String(value).trim().replace(/\s+/g, ' ');
  if (!preserveCase) s = s.toLowerCase();
  return s;
}

function answersMatch(submitted, expected, options = {}) {
  const a = normalizeAnswer(submitted, options);
  const b = normalizeAnswer(expected, options);
  return a.length > 0 && a === b;
}

function matchesAnyAccepted(submitted, acceptedAnswers = [], options = {}) {
  if (!Array.isArray(acceptedAnswers) || acceptedAnswers.length === 0) return false;
  return acceptedAnswers.some((expected) => answersMatch(submitted, expected, options));
}

module.exports = {
  normalizeAnswer,
  answersMatch,
  matchesAnyAccepted,
};
