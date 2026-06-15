const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwtSecret');

const PROOF_TYPE = 'payment_proof';
const PROOF_TTL = '15m';

/**
 * Issue a short-lived JWT proving Cashfree payment succeeded (trek guest flow).
 * Register endpoint still re-verifies with Cashfree — this is an optional client hint only.
 */
function signPaymentProof({ orderId, paymentId, trekId, totalAmount, people }) {
  return jwt.sign(
    {
      type: PROOF_TYPE,
      orderId,
      paymentId,
      trekId: String(trekId),
      totalAmount,
      people,
    },
    getJwtSecret(),
    { expiresIn: PROOF_TTL }
  );
}

module.exports = { signPaymentProof };
