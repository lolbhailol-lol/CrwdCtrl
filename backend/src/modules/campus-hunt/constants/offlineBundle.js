/** Offline Hunt Pack — bundle format v1 (airplane-mode play). */

const OFFLINE_BUNDLE_VERSION = 1;

const OFFLINE_BUNDLE_TYPE = 'campus_hunt_offline_team';

/** QR payloads issued between teammate phones (no network). */
const OFFLINE_QR_TYPES = {
  MEMBER_SCAN_PROOF: 'campus_hunt_offline_member_scan',
  TEAM_STATE_SYNC: 'campus_hunt_offline_team_state',
  RESULTS_EXPORT: 'campus_hunt_offline_results',
};

module.exports = {
  OFFLINE_BUNDLE_VERSION,
  OFFLINE_BUNDLE_TYPE,
  OFFLINE_QR_TYPES,
};
