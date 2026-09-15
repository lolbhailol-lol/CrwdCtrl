import { PUBLIC_WEB_ORIGIN } from './publicWebOrigin.js';

function slug(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Direct fest-day registration URL; organizer desks should skip the detail-page hop. */
export function competitionRegistrationUrl(festId, competition) {
  const resolvedFestId = String(festId || competition?.festId || competition?.fest?._id || competition?.fest || '').trim();
  const competitionId = String(competition?.id || competition?._id || '').trim();
  if (resolvedFestId && competitionId) {
    return `${PUBLIC_WEB_ORIGIN}/fest/${encodeURIComponent(resolvedFestId)}/register/${encodeURIComponent(competitionId)}?festDay=1`;
  }
  const name = competition?.name || competition?.title || competition?.competitionName || '';
  return `${PUBLIC_WEB_ORIGIN}/competitions-view-details/${slug(name) || competitionId}`;
}
