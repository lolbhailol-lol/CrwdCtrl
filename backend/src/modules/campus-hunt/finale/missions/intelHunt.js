const { matchesAnyAccepted } = require('../../utils/answerNormalize');
const { FINALE_DEFAULTS } = require('../../constants');

function defaultIntelConfig(config) {
  const intel = config?.intelHunt || {};
  return {
    maxAttemptsPerStep: Number(intel.maxAttemptsPerStep) || FINALE_DEFAULTS.intelMaxAttemptsPerStep || 2,
  };
}

function resolveAssignment(run) {
  const assignment = run?.state?.assignment;
  if (assignment?.location1 && assignment?.location2) {
    return {
      location1: assignment.location1,
      location2: assignment.location2,
      combinedAnswer: assignment.combinedAnswer,
    };
  }
  return null;
}

function lockedIntelView(step, loc, state, message, intel) {
  const base = {
    missionId: 'intel_hunt',
    step,
    locked: true,
    message,
    attemptsLeft: 0,
  };
  if (step === 'loc1') {
    return { ...base, locationName: loc.name, instruction: loc.instruction };
  }
  if (step === 'loc2') {
    return {
      ...base,
      locationName: loc.name,
      instruction: loc.instruction,
      intel1Fragment: state.intel1Fragment,
    };
  }
  return {
    ...base,
    instruction: 'Combine your Intel pieces into one final word.',
    intel1Fragment: state.intel1Fragment,
    intel2Fragment: state.intel2Fragment,
  };
}

function getBoardCard(entry, config, meta) {
  const completed = (entry.completedMissionIds || []).includes('intel_hunt');
  const active = entry.activeMissionId === 'intel_hunt';
  let status = 'available';
  if (meta?.comingSoon || meta?.enabled === false) status = 'coming_soon';
  else if (completed) status = 'completed';
  else if (active) status = 'active';
  else if (entry.status === 'locked' || entry.status === 'stopped') status = 'locked';
  return {
    id: 'intel_hunt',
    title: meta?.title || 'Intel Hunt',
    emoji: meta?.emoji || '🧠',
    points: meta?.points || 50,
    status,
    enabled: meta?.enabled !== false,
  };
}

function startRun(entry, config, { assignment } = {}) {
  if (!assignment?.location1 || !assignment?.location2) {
    const err = new Error('Intel locations not assigned.');
    err.status = 409;
    err.code = 'INTEL_NOT_ASSIGNED';
    throw err;
  }

  return {
    state: {
      step: 'loc1',
      intel1Fragment: null,
      intel2Fragment: null,
      assignment,
      assignedLocationIds: assignment.assignedLocationIds || [],
      combinedAnswer: assignment.combinedAnswer,
      attempts: { loc1: 0, loc2: 0, combine: 0 },
    },
    playerView: {
      missionId: 'intel_hunt',
      step: 'loc1',
      locationName: assignment.location1.name,
      instruction: assignment.location1.instruction,
      leaderOnly: true,
      hint: 'Only the Team Leader can submit Intel.',
    },
  };
}

function submitStep(entry, run, { answer }, config) {
  const intel = defaultIntelConfig(config);
  const assignment = resolveAssignment(run);
  if (!assignment) {
    return { ok: false, state: run.state || {}, playerView: { message: 'Mission setup error.' } };
  }

  const { location1, location2, combinedAnswer } = assignment;
  const state = { ...(run.state || {}) };
  state.attempts = { loc1: 0, loc2: 0, combine: 0, ...(state.attempts || {}) };
  const step = state.step || 'loc1';
  const trimmed = String(answer || '').trim();
  const maxAttempts = intel.maxAttemptsPerStep;

  if (step === 'loc1') {
    if (state.attempts.loc1 >= maxAttempts) {
      return {
        ok: false,
        state,
        playerView: lockedIntelView('loc1', location1, state, 'Out of attempts. Ask an organizer for help.', intel),
      };
    }
    state.attempts.loc1 += 1;
    const ok = matchesAnyAccepted(trimmed, location1.acceptedAnswers);
    if (!ok) {
      const maxed = state.attempts.loc1 >= maxAttempts;
      return {
        ok: false,
        state,
        playerView: maxed
          ? lockedIntelView('loc1', location1, state, 'Out of attempts. Ask an organizer for help.', intel)
          : {
            missionId: 'intel_hunt',
            step: 'loc1',
            locationName: location1.name,
            instruction: location1.instruction,
            message: 'Incorrect Intel. Try again.',
            attemptsLeft: Math.max(0, maxAttempts - state.attempts.loc1),
          },
      };
    }
    state.step = 'loc2';
    state.intel1Fragment = location1.fragment || location1.acceptedAnswers[0] || trimmed.toUpperCase();
    return {
      ok: true,
      state,
      playerView: {
        missionId: 'intel_hunt',
        step: 'loc2',
        locationName: location2.name,
        instruction: location2.instruction,
        message: 'INTEL 1 VERIFIED. Location 2 unlocked.',
        intel1Fragment: state.intel1Fragment,
      },
    };
  }

  if (step === 'loc2') {
    if (state.attempts.loc2 >= maxAttempts) {
      return {
        ok: false,
        state,
        playerView: lockedIntelView('loc2', location2, state, 'Out of attempts. Ask an organizer for help.', intel),
      };
    }
    state.attempts.loc2 += 1;
    const ok = matchesAnyAccepted(trimmed, location2.acceptedAnswers);
    if (!ok) {
      const maxed = state.attempts.loc2 >= maxAttempts;
      return {
        ok: false,
        state,
        playerView: maxed
          ? lockedIntelView('loc2', location2, state, 'Out of attempts. Ask an organizer for help.', intel)
          : {
            missionId: 'intel_hunt',
            step: 'loc2',
            locationName: location2.name,
            instruction: location2.instruction,
            message: 'Incorrect Intel. Try again.',
            attemptsLeft: Math.max(0, maxAttempts - state.attempts.loc2),
            intel1Fragment: state.intel1Fragment,
          },
      };
    }
    const fragment2 = location2.fragment || location2.acceptedAnswers[0] || trimmed.toUpperCase();
    state.step = 'combine';
    state.intel2Fragment = fragment2;
    return {
      ok: true,
      state,
      playerView: {
        missionId: 'intel_hunt',
        step: 'combine',
        instruction: `Combine your Intel pieces (${state.intel1Fragment} + ${fragment2}) into one final word.`,
        intel1Fragment: state.intel1Fragment,
        intel2Fragment: fragment2,
        message: 'INTEL 2 VERIFIED. Enter the combined word.',
      },
    };
  }

  if (step === 'combine') {
    const finalAnswer = state.combinedAnswer || combinedAnswer;
    if (state.attempts.combine >= maxAttempts) {
      return {
        ok: false,
        state,
        playerView: lockedIntelView('combine', null, state, 'Out of attempts. Ask an organizer for help.', intel),
      };
    }
    state.attempts.combine += 1;
    const ok = matchesAnyAccepted(trimmed, [finalAnswer]);
    if (!ok) {
      const maxed = state.attempts.combine >= maxAttempts;
      return {
        ok: false,
        state,
        playerView: maxed
          ? lockedIntelView('combine', null, state, 'Out of attempts. Ask an organizer for help.', intel)
          : {
            missionId: 'intel_hunt',
            step: 'combine',
            instruction: 'Enter the combined final word.',
            intel1Fragment: state.intel1Fragment,
            intel2Fragment: state.intel2Fragment,
            message: 'Not the right word. Think about how the fragments fit together.',
            attemptsLeft: Math.max(0, maxAttempts - state.attempts.combine),
          },
      };
    }
    const points = (config.missions || []).find((m) => m.id === 'intel_hunt')?.points || 50;
    return {
      ok: true,
      complete: true,
      points,
      state: { ...state, step: 'done' },
      playerView: {
        missionId: 'intel_hunt',
        step: 'done',
        message: `Intel complete! +${points} points.`,
      },
    };
  }

  return { ok: false, state, playerView: { message: 'Mission already completed.' } };
}

function abortRun(run) {
  return { state: run.state || {} };
}

/** Rebuild player view from persisted run state. */
function rebuildPlayerView(run, config) {
  const assignment = resolveAssignment(run);
  if (!assignment) return { missionId: 'intel_hunt' };

  const state = run.state || {};
  const { location1, location2 } = assignment;

  if (state.step === 'loc2') {
    return {
      missionId: 'intel_hunt',
      step: 'loc2',
      locationName: location2.name,
      instruction: location2.instruction,
      intel1Fragment: state.intel1Fragment,
      leaderOnly: true,
    };
  }
  if (state.step === 'combine') {
    return {
      missionId: 'intel_hunt',
      step: 'combine',
      instruction: 'Combine your Intel pieces into one final word.',
      intel1Fragment: state.intel1Fragment,
      intel2Fragment: state.intel2Fragment,
      leaderOnly: true,
    };
  }
  return {
    missionId: 'intel_hunt',
    step: 'loc1',
    locationName: location1.name,
    instruction: location1.instruction,
    leaderOnly: true,
  };
}

module.exports = {
  id: 'intel_hunt',
  getBoardCard,
  startRun,
  submitStep,
  abortRun,
  rebuildPlayerView,
};
