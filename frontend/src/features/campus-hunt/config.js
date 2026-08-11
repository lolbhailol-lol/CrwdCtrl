import { FEATURES } from '../../config/env';

/** Public player / volunteer routes (landing, play, leaderboard). */
export function isCampusHuntEnabled() {
  return FEATURES.CAMPUS_HUNT === true;
}

/**
 * Admin control room — always on so organizers are not blocked by a missing
 * VITE_ENABLE_CAMPUS_HUNT on a deploy. Player-facing routes stay gated above.
 */
export function isCampusHuntAdminEnabled() {
  return true;
}

export const CAMPUS_HUNT_PATHS = {
  event: (slug) => `/campus-hunt/${slug}`,
  /** @deprecated Removed — use teamLogin(slug, teamCode). Kept as alias to event. */
  login: (slug) => `/campus-hunt/${slug}`,
  play: (slug) => `/campus-hunt/${slug}/play`,
  grid: '/campus-hunt/grid',
  /** One shared URL per team — leader + all players use this (password + tap name) */
  teamLogin: (slug, teamCode) =>
    `/campus-hunt/${slug}/team/${String(teamCode || '').toUpperCase()}`,
  teamLoginRole: (slug, teamCode, role, slot) => {
    const base = `/campus-hunt/${slug}/team/${String(teamCode || '').toUpperCase()}`;
    if (role === 'scanner' && slot) return `${base}?role=scanner&slot=${slot}`;
    if (role === 'leader') return `${base}?role=leader`;
    return base;
  },
  leaderboard: '/campus-hunt/leaderboard',
  leaderboardCollege: (college) =>
    `/campus-hunt/leaderboard?college=${encodeURIComponent(college)}`,
  /** Profile → Campus Hunt login (Google session required) */
  profileLogin: '/campus-hunt/enter',
  volunteerLogin: '/campus-hunt-volunteer/login',
  volunteerCheckpoint: '/campus-hunt-volunteer/checkpoint',
  admin: '/admin/campus-hunt',
  adminEvent: (eventId) => `/admin/campus-hunt/${eventId}`,
};

export const ISSUE_CATEGORIES = [
  { value: 'team_verification', label: 'Team verification problem' },
  { value: 'qr_problem', label: 'QR problem' },
  { value: 'checkpoint_unavailable', label: 'Checkpoint unavailable' },
  { value: 'safety', label: 'Safety issue' },
  { value: 'technical', label: 'Technical issue' },
  { value: 'team_dispute', label: 'Team dispute' },
  { value: 'other', label: 'Other' },
];
