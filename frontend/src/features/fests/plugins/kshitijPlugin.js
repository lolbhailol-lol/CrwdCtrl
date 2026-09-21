import { defaultFestPlugin } from './defaultPlugin';
import { KSHITIJ_PUNE_MULTICITY_SLUG } from '../kshitij/isKshitijFest';

const CATEGORY_ORDER = ['PERFORMING ARTS', 'GAMING AND SPORTS', 'INFORMALS', 'BUSINESS EVENTS'];

/**
 * Kshitij Pune Multicity — Techfest-style simple organizer portal
 * (Overview · Competitions · Participants) with roster registration.
 */
export const kshitijPlugin = {
  ...defaultFestPlugin,
  id: 'kshitij',
  simpleOrganizerPortal: true,
  hideProShow: true,
  hideStallLeads: true,
  hideLiveNav: true,
  hideFestInfoNav: true,
  hideCompetitionProbables: true,
  skipRegistrationReview: true,
  suppressDefaultSuccessPopup: true,
  skipFestCommonFormOnCompetition: true,
  hasRosterPersonStep: true,
  recoveryFestId: KSHITIJ_PUNE_MULTICITY_SLUG,
  competitionGroupKey(comp) {
    return String(comp?.module || comp?.competitionType || 'OTHER').trim().toUpperCase();
  },
  sortCompetitionGroups(grouped = {}) {
    return Object.fromEntries(
      Object.entries(grouped).sort(([left], [right]) => {
        const leftIndex = CATEGORY_ORDER.indexOf(left);
        const rightIndex = CATEGORY_ORDER.indexOf(right);
        if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      }),
    );
  },
};
