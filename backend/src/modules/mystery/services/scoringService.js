const EvidenceNode = require('../models/EvidenceNode');

// Connection-scoring: team ne jo connections banaye, kitne ground-truth se match karte hain
async function scoreConnections(caseId, connectionsMade) {
  const evidenceList = await EvidenceNode.find({ caseId });
  const truthMap = new Map(evidenceList.map((e) => [String(e._id), new Set((e.connectsToEvidenceIds || []).map(String))]));

  let correct = 0;
  for (const conn of connectionsMade) {
    const a = String(conn.evidenceIdA);
    const b = String(conn.evidenceIdB);
    const aConnects = truthMap.get(a);
    if (aConnects && aConnects.has(b)) correct += 1;
  }
  return correct * 8; // har sahi connection = 8 points
}

// Timeline-scoring: submitted order ko canonicalOrder se compare karo
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

// Evidence-verdict scoring: team ne kis evidence ko reliable/unreliable bola, ground-truth se compare
function scoreVerdicts(evidenceVerdicts, evidenceMap) {
  let correct = 0;
  for (const v of evidenceVerdicts) {
    const evidence = evidenceMap.get(String(v.evidenceId));
    if (!evidence) continue;
    const truthIsReliable = evidence.reliability === 'reliable';
    const teamSaysReliable = v.verdict === 'reliable';
    if (truthIsReliable === teamSaysReliable) correct += 1;
  }
  return correct * 10; // har sahi verdict = 10 points
}

// Confidence/risk bonus: sahi theory + high confidence = bonus; galat theory + high confidence = penalty
function scoreConfidenceBonus(theoryCorrect, confidenceLevel) {
  const normalized = Math.max(0, Math.min(100, confidenceLevel)) / 100;
  if (theoryCorrect) return Math.round(normalized * 30); // max +30
  return -Math.round(normalized * 15); // max -15 (overconfidence penalty)
}

module.exports = { scoreConnections, scoreTimeline, scoreVerdicts, scoreConfidenceBonus };