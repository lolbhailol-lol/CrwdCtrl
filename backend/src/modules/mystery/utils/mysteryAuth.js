const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../../../config/jwtSecret');

const MYSTERY_TOKEN_EXPIRY = '12h';

/** Mystery ka apna JWT — campus-hunt ke hunt-token jaisa, alag session. */
function generateMysteryToken({ userId, mysteryTeamId, mysteryEventId, mysteryRole }) {
  const secret = getJwtSecret();
  return jwt.sign(
    {
      userId,
      tokenType: 'mystery',
      aud: 'mystery-case',
      mysteryTeamId,
      mysteryEventId: mysteryEventId || null,
      mysteryRole: mysteryRole || 'leader',
    },
    secret,
    { expiresIn: MYSTERY_TOKEN_EXPIRY },
  );
}

module.exports = { generateMysteryToken };