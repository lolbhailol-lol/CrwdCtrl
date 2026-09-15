import { defaultFestPlugin } from './defaultPlugin';

const CATEGORY_ORDER = ['PERFORMING ARTS', 'GAMING AND SPORTS', 'INFORMALS', 'BUSINESS EVENTS'];

export const kshitijPlugin = {
  ...defaultFestPlugin,
  id: 'kshitij',
  // Kshitij competition registrations use the same guided roster flow as
  // MindSpark: team selection, one details form per participant, then submit.
  skipFestCommonFormOnCompetition: true,
  hasRosterPersonStep: true,
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
