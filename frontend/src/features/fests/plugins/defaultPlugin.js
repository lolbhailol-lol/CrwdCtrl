/**
 * Default fest plugin — generic CrwdCtrl fest behavior.
 * Named fests (MindSpark, …) override these flags and hooks.
 */
export const defaultFestPlugin = {
  id: 'default',
  hideProShow: false,
  hideStallLeads: false,
  skipRegistrationReview: false,
  suppressDefaultSuccessPopup: false,
  skipFestCommonFormOnCompetition: false,
  hasRosterPersonStep: false,
  showLiveStrip: false,
  LiveBadge: null,
  competitionSuccessScreen: null,
  WhatsAppAdmin: null,
  ResourceLinksEditor: null,
  recoveryFestId: null,
  sortCompetitionGroups(grouped) {
    return grouped || {};
  },
  sortModules(modules = []) {
    return [...modules].sort();
  },
  competitionGroupKey(comp) {
    return comp?.competitionType?.toUpperCase() || 'OTHER';
  },
  competitionModuleLabel(comp) {
    return comp?.category || '';
  },
  formatTabLabel(tab) {
    if (!tab || tab === 'OTHER') return 'Other';
    if (tab === tab.toUpperCase() || tab.includes(' ') || tab.includes('-')) {
      return String(tab)
        .replace(/-/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return tab.charAt(0) + tab.slice(1).toLowerCase();
  },
};
