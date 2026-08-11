const PLACEHOLDER_MISSIONS = ['mission_3', 'mission_4'];

function makePlaceholder(id, meta) {
  return {
    id,
    getBoardCard(entry) {
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
