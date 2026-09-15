import { MINDSPARK_FEST_ID } from '../mindspark/isMindSparkFest';
import {
  resolveMindSparkModule,
  sortMindSparkModules,
  sortMindSparkModuleGroups,
  formatMindSparkModuleLabel,
} from '../mindspark/modules';
import MindSparkSuccessStep from '../mindspark/MindSparkSuccessStep';
import MindSparkLiveBadge from '../mindspark/MindSparkLiveBadge';
import MindSparkWhatsAppLinksAdmin from '../mindspark/MindSparkWhatsAppLinksAdmin';
import ResourceLinksEditor from '../mindspark/ResourceLinksEditor';

/**
 * MindSpark-only behavior. Generic fest pages must call getFestPlugin()
 * instead of growing isMindSparkFest() branches.
 */
export const mindsparkPlugin = {
  id: 'mindspark',
  hideProShow: true,
  hideStallLeads: true,
  skipRegistrationReview: true,
  suppressDefaultSuccessPopup: true,
  skipFestCommonFormOnCompetition: true,
  hasRosterPersonStep: true,
  showLiveStrip: true,
  LiveBadge: MindSparkLiveBadge,
  competitionSuccessScreen: MindSparkSuccessStep,
  WhatsAppAdmin: MindSparkWhatsAppLinksAdmin,
  ResourceLinksEditor,
  recoveryFestId: MINDSPARK_FEST_ID,
  sortCompetitionGroups: sortMindSparkModuleGroups,
  sortModules: sortMindSparkModules,
  competitionGroupKey: resolveMindSparkModule,
  competitionModuleLabel: resolveMindSparkModule,
  formatTabLabel(tab) {
    if (!tab || tab === 'OTHER') return 'Other';
    return formatMindSparkModuleLabel(tab);
  },
};
