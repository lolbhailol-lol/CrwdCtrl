const EvidenceNode = require('../models/EvidenceNode');

// Connection scoring: how many of the team's connections match the ground truth
async function scoreConnections(caseId, connectionsMade) {
  const evidenceList = await EvidenceNode.find({ caseId });
  const truthMap = new Map(evidenceList.map((e) => [String(e._id), new Set((e.connectsToEvidenceIds || []).map(String))]));

  let correct = 0;
  for (const conn of connectionsMade) {
    const a = String(conn.evidenceIdA);
    const b = String(conn.evidenceIdB);
    if (truthMap.get(a)?.has(b) || truthMap.get(b)?.has(a)) correct += 1;
  }
  return correct * 8; // each correct connection = 8 points
}

// Timeline scoring: compare the submitted order with canonicalOrder
function scoreTimeline(reconstructedTimeline, evidenceMap) {
  const submittedOrder = reconstructedTimeline
    .map((t) => evidenceMap.get(String(t.evidenceId)))
    .filter(Boolean)
    .map((e) => e.canonicalOrder);

  let correctPairs = 0;
  let totalPairs = 0;
  for (let i = 0; i < submittedOrder.length; i++) {
    for (let j = i + 1; j < submittedOrder.length; j++) {
      totalPairs += 1;
      if (submittedOrder[i] < submittedOrder[j]) correctPairs += 1;
    }
  }
  if (totalPairs === 0) return 0;
  return Math.round((correctPairs / totalPairs) * 50); // max 50 points for perfect order
}

// Evidence verdict scoring: compare the team's reliable/unreliable calls with the ground truth
function scoreVerdicts(evidenceVerdicts, evidenceMap) {
  let correct = 0;
  for (const v of evidenceVerdicts) {
    const evidence = evidenceMap.get(String(v.evidenceId));
    if (!evidence) continue;
    const truthIsReliable = evidence.reliability === 'reliable';
    const teamSaysReliable = v.verdict === 'reliable';
    if (truthIsReliable === teamSaysReliable) correct += 1;
  }
  return correct * 10; // each correct verdict = 10 points
}

// Confidence/risk bonus: correct theory + high confidence = bonus; wrong theory + high confidence = penalty
function scoreConfidenceBonus(theoryCorrect, confidenceLevel) {
  const normalized = Math.max(0, Math.min(100, confidenceLevel)) / 100;
  if (theoryCorrect) return Math.round(normalized * 30); // max +30
  return -Math.round(normalized * 15); // max -15 (overconfidence penalty)
}

module.exports = { scoreConnections, scoreTimeline, scoreVerdicts, scoreConfidenceBonus };