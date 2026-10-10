export const MYSTERY_BASE = '/mystery';

export const MYSTERY_PATHS = {
  landing: '/mystery',
  caseDetail: (caseId) => `/mystery/case/${caseId}`,
  register: (caseId) => `/mystery/case/${caseId}/register`,
  enter: '/mystery/enter',
  practice: (caseId) => `/mystery/case/${caseId}/practice`,
  play: '/mystery/play',
  leaderboard: (eventId) => `/mystery/leaderboard/${eventId}`,
  adminDashboard: '/admin/mystery',
  adminCase: (caseId) => `/admin/mystery/case/${caseId}`,
};