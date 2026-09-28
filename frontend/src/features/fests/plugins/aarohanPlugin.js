import { AAROHAN_SLUG } from '../aarohan/isAarohanFest';
import { defaultFestPlugin } from './defaultPlugin';

/** Aarohan uses the roster-per-person registration flow. */
export const aarohanPlugin = {
  ...defaultFestPlugin,
  id: 'aarohan',
  skipRegistrationReview: false,
  suppressDefaultSuccessPopup: false,
  skipFestCommonFormOnCompetition: true,
  hasRosterPersonStep: true,
  showLiveStrip: false,
  LiveBadge: null,
  competitionSuccessScreen: null,
  WhatsAppAdmin: null,
  ResourceLinksEditor: null,
  recoveryFestId: AAROHAN_SLUG,
};
