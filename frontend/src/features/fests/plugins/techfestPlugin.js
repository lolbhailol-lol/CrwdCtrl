import { TECHFEST_SLUG } from '../techfest/isTechfestFest';
import {
  resolveTechfestModule,
  sortTechfestModules,
  sortTechfestModuleGroups,
  formatTechfestModuleLabel,
} from '../techfest/modules';
import TechfestAccommodationBadge from '../techfest/TechfestAccommodationBadge';

/**
 * Techfest IIT Bombay — module tabs + Accommodation chip (no live strip).
 */
export const techfestPlugin = {
  id: 'techfest',
  hideProShow: true,
  hideStallLeads: true,
  skipRegistrationReview: false,
  suppressDefaultSuccessPopup: false,
  skipFestCommonFormOnCompetition: true,
  hasRosterPersonStep: true,
  showLiveStrip: false,
  LiveBadge: TechfestAccommodationBadge,
  competitionSuccessScreen: null,
  WhatsAppAdmin: null,
  ResourceLinksEditor: null,
  recoveryFestId: TECHFEST_SLUG,
  sortCompetitionGroups: sortTechfestModuleGroups,
  sortModules: sortTechfestModules,
  competitionGroupKey: resolveTechfestModule,
  competitionModuleLabel: resolveTechfestModule,
  formatTabLabel(tab) {
    if (!tab || tab === 'OTHER') return 'Other';
    return formatTechfestModuleLabel(tab);
  },
};
