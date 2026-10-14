const EvidenceNode = require('../models/EvidenceNode');

// ⚠️ CRITICAL: Ground-truth fields (reliability, connectsToEvidenceIds) must never
// appear in a player-facing response — otherwise the core "truth is not given"
// mechanic breaks.
function sanitizeEvidence(evidence) {
  if (!evidence) return null;
  const obj = evidence.toObject ? evidence.toObject() : evidence;
  return {
    _id: obj._id,
    code: obj.code,
    world: obj.world,
    title: obj.title,
    description: obj.description,
    timestampLabel: obj.timestampLabel,
    imageUrl: obj.imageUrl,
    points: obj.points,
    // reliability, connectsToEvidenceIds, canonicalOrder — INTENTIONALLY hidden
  };
}

async function getUnlockableEvidence(caseId, unlockedIds) {
  // Evidence that is still locked but whose prerequisites are all unlocked
  const allEvidence = await EvidenceNode.find({ caseId, unlockedByBranchId: null });
  const unlockedSet = new Set(unlockedIds.map(String));
  return allEvidence.filter((e) => {
    if (unlockedSet.has(String(e._id))) return false;
    if (!e.unlockedByEvidenceIds || e.unlockedByEvidenceIds.length === 0) return true;
    return e.unlockedByEvidenceIds.every((id) => unlockedSet.has(String(id)));
  });
}

module.exports = { sanitizeEvidence, getUnlockableEvidence };