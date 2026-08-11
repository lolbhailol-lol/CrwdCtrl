const intelHunt = require('./intelHunt');
const fieldTerminal = require('./fieldTerminal');
const { PLACEHOLDER_MISSIONS, makePlaceholder } = require('./placeholders');
const { FINALE_MISSION_BOARD } = require('../../constants');

const HANDLERS = new Map([
  [intelHunt.id, intelHunt],
  [fieldTerminal.id, fieldTerminal],
  // Legacy alias — old runs / configs may still store borrowed_device
  [fieldTerminal.legacyId, fieldTerminal],
]);

for (const id of PLACEHOLDER_MISSIONS) {
  const meta = FINALE_MISSION_BOARD.find((m) => m.id === id) || {};
  HANDLERS.set(id, makePlaceholder(id, meta));
}

function getHandler(missionId) {
  return HANDLERS.get(String(missionId || '')) || null;
}

function listHandlers() {
  // Unique by canonical id (skip legacy alias duplicate)
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

module.exports = {
  getHandler,
  listHandlers,
  missionMeta,
};
