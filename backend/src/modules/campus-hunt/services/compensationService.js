/**
 * Predefined compensation policies for disabled checkpoints / voided challenges.
 * All affected teams receive the same treatment.
 */

const POLICIES = {
  skip_and_continue: {
    key: 'skip_and_continue',
    description: 'Advance team past the blocked step without awarding challenge points',
    awardPoints: 0,
  },
  full_challenge_credit: {
    key: 'full_challenge_credit',
    description: 'Award base challenge points (no speed bonus) and advance',
    awardPoints: 'base',
  },
  flat_25: {
    key: 'flat_25',
    description: 'Award flat +25 compensation points and advance',
    awardPoints: 25,
  },
};

function resolvePolicy(policyKey) {
  return POLICIES[policyKey] || POLICIES.skip_and_continue;
}

function resolveAwardPoints(policy, basePoints = 0) {
  if (policy.awardPoints === 'base') return Number(basePoints) || 0;
  return Number(policy.awardPoints) || 0;
}

module.exports = {
  POLICIES,
  resolvePolicy,
  resolveAwardPoints,
};
