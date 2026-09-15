/**
 * Public-safe slice of mission run state for client board payloads.
 * Never includes answers, keys, assignments, or code pools.
 */
function sanitizePublicMissionState(missionId, state = {}) {
  const s = state && typeof state === 'object' ? state : {};
  const publicState = {
    step: s.step || null,
    attempts: s.attempts != null ? s.attempts : null,
    missionExpiresAt: s.missionExpiresAt || null,
  };

  const id = String(missionId || '');
  if (id === 'field_terminal' || id === 'borrowed_device') {
    publicState.accessCode = s.accessCode || null;
    publicState.gridSessionId = s.gridSessionId || null;
  }

  return publicState;
}

/** True if a JSON-serializable payload still contains answer secrets. */
function payloadContainsMissionSecrets(payload) {
  const text = JSON.stringify(payload || {});
  return /acceptedAnswers|combinedAnswer|"assignedKey"|assignedCode/.test(text);
}

module.exports = {
  sanitizePublicMissionState,
  payloadContainsMissionSecrets,
};
