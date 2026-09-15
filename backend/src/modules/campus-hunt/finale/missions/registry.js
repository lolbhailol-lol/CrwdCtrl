const intelHunt = require('./intelHunt');
const lockbox = require('./lockbox');
const fieldTerminal = require('./fieldTerminal');
const blackout = require('./blackout');
const { PLACEHOLDER_MISSIONS, makePlaceholder } = require('./placeholders');
const { FINALE_MISSION_BOARD } = require('../../constants');

const HANDLERS = new Map([
  [intelHunt.id, intelHunt],
  [lockbox.id, lockbox],
  [fieldTerminal.id, fieldTerminal],
  // Legacy alias — old runs / configs may still store borrowed_device
  [fieldTerminal.legacyId, fieldTerminal],
  [blackout.id, blackout],
]);

for (const id of PLACEHOLDER_MISSIONS) {
  const meta = FINALE_MISSION_BOARD.find((m) => m.id === id) || {};
  HANDLERS.set(id, makePlaceholder(id, meta));
}

function getHandler(missionId) {
  return HANDLERS.get(String(missionId || '')) || null;
}

function listHandlers() {
  const seen = new Set();
  const out = [];
  for (const handler of HANDLERS.values()) {
    if (seen.has(handler.id)) continue;
    seen.add(handler.id);
    out.push(handler);
  }
  return out;
}

function missionMeta(config, missionId) {
  const normalized = fieldTerminal.isFieldTerminalMission(missionId)
    ? fieldTerminal.id
    : missionId;
  const fromConfig = (config?.missions || []).find((m) => (
    m.id === normalized
    || (fieldTerminal.isFieldTerminalMission(normalized) && fieldTerminal.isFieldTerminalMission(m.id))
  ));
  const fromDefault = FINALE_MISSION_BOARD.find((m) => m.id === normalized);
  return { ...fromDefault, ...fromConfig, id: normalized };
}

/** Admin can turn missions off for testing without deleting them. */
function isMissionPlayable(meta) {
  if (!meta) return false;
  if (meta.comingSoon) return false;
  if (meta.enabled === false) return false;
  return true;
}

module.exports = {
  getHandler,
  listHandlers,
  missionMeta,
  isMissionPlayable,
};
