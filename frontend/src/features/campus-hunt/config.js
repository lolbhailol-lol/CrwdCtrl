import { FEATURES } from '../../config/env';

export function isCampusHuntEnabled() {
  return FEATURES.CAMPUS_HUNT === true;
}

export const CAMPUS_HUNT_PATHS = {
  event: (slug) => `/campus-hunt/${slug}`,
  /** @deprecated Removed — use teamLogin(slug, teamCode). Kept as alias to event. */
  login: (slug) => `/campus-hunt/${slug}`,
  play: (slug) => `/campus-hunt/${slug}/play`,
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
