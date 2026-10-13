const EvidenceNode = require('../models/EvidenceNode');

// ⚠️ CRITICAL: Ground-truth fields (reliability, connectsToEvidenceIds) kabhi
// player-facing response me nahi jaane chahiye — warna "truth is not given" wala
// core mechanic hi toot jaayega.
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
    // reliability, connectsToEvidenceIds, canonicalOrder — INTENTIONALLY chhupaye
  };
}

async function getUnlockableEvidence(caseId, unlockedIds) {
  // Jo evidence ke saare prerequisites already unlocked hain, aur khud abhi locked hai
  const allEvidence = await EvidenceNode.find({ caseId, unlockedByBranchId: null });
  const unlockedSet = new Set(unlockedIds.map(String));
  return allEvidence.filter((e) => {
    if (unlockedSet.has(String(e._id))) return false;
    if (!e.unlockedByEvidenceIds || e.unlockedByEvidenceIds.length === 0) return true;
    return e.unlockedByEvidenceIds.every((id) => unlockedSet.has(String(id)));
  });
}

module.exports = { sanitizeEvidence, getUnlockableEvidence };