/** No coming-soon placeholders — all 4 finale missions are live. */
const PLACEHOLDER_MISSIONS = [];

function makePlaceholder(id, meta) {
  return {
    id,
    getBoardCard() {
      return {
        id,
        title: meta?.title || id.toUpperCase().replace('_', ' '),
        emoji: meta?.emoji || '🔒',
        points: meta?.points || 0,
        status: 'coming_soon',
      };
    },
    startRun() {
      const err = new Error('This mission is not available yet.');
      err.status = 409;
      err.code = 'MISSION_COMING_SOON';
      throw err;
    },
    submitStep() {
      const err = new Error('This mission is not available yet.');
      err.status = 409;
      err.code = 'MISSION_COMING_SOON';
      throw err;
    },
  };
}

module.exports = {
  PLACEHOLDER_MISSIONS,
  makePlaceholder,
};
