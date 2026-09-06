/** Offline Hunt Pack — bundle format v1 (airplane-mode play). */

export const OFFLINE_BUNDLE_VERSION = 1;
export const OFFLINE_BUNDLE_TYPE = 'campus_hunt_offline_team';

export const OFFLINE_QR_TYPES = {
  MEMBER_SCAN_PROOF: 'campus_hunt_offline_member_scan',
  TEAM_STATE_SYNC: 'campus_hunt_offline_team_state',
  RESULTS_EXPORT: 'campus_hunt_offline_results',
  PHONE_BACKUP: 'campus_hunt_offline_phone_backup',
};

export const OFFLINE_DB_NAME = 'crwdctrl_campus_hunt_offline';
export const OFFLINE_DB_VERSION = 1;

export const OFFLINE_STORES = {
  BUNDLE: 'bundle',
  STATE: 'team_state',
  SESSION: 'session',
};

/** Native Capacitor SQLite (SQLCipher) database name. */
export const OFFLINE_SQLITE_DB = 'crwdctrl_offline_event';
export const OFFLINE_SQLITE_VERSION = 1;
