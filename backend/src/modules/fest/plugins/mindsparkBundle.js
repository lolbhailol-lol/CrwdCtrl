const FEST_ID = '6a7f1010ed26d983b34e55c2';

/**
 * MindSpark competition bundle — any 3 distinct events from this list, 65% off.
 * Updated per Events Head (Harsh) 17 Sep 2026.
 */
const BUNDLE_COMPETITION_IDS = [
  '6a7f158e0e5ff505e2a4c495', // CODE JUNKIE
  '6a7f158f0e5ff505e2a4c498', // NEURAL NEXUS
  '6a7f158f0e5ff505e2a4c49b', // WEBSCAPE
  '6a7f158e0e5ff505e2a4c48d', // FLASH
  '6a7f158e0e5ff505e2a4c48f', // TAKE OFF
  '6a7f158e0e5ff505e2a4c492', // TORQUEST
  '6a7f15c84a2df24d5b0ef4b1', // QUANTQUEST
  '6a7f15b543825c1b6ced8059', // WORLDWIZE
  '6a7f158f0e5ff505e2a4c4b6', // MATHLETICS
  '6a7f158f0e5ff505e2a4c49e', // FUSION ID
  '6a7f158f0e5ff505e2a4c4a1', // REVIT RUSH
  '6a7f158f0e5ff505e2a4c4b9', // ASSEMBLIX
  '6a7f158f0e5ff505e2a4c4a4', // BEYOND SUITS
  '6a7f158f0e5ff505e2a4c4a7', // FANDOM
  '6a7f158f0e5ff505e2a4c4bf', // SHERLOCKED
  '6a7f15b543825c1b6ced805c', // GOOGLER
  '6a7f15900e5ff505e2a4c4d9', // EDIFEX
  '6a7f15900e5ff505e2a4c4dc', // UTOPIA
  '6a7f15900e5ff505e2a4c4df', // ON THE ETCH
  '6a7f15900e5ff505e2a4c4e3', // CIRCUIT FIXER
  '6a7f15900e5ff505e2a4c4e9', // MICROAPPS
];

const DISCOUNT_PERCENT = 65;
const BUNDLE_SIZE = 3;
const BUNDLE_GROUP = 'bundle';

const allowedSet = new Set(BUNDLE_COMPETITION_IDS.map(String));
const isBundleEligible = (id) => allowedSet.has(String(id));
/** @deprecated legacy tech/non-tech split — all eligible comps now use group `bundle` */
const groupFor = (id) => (isBundleEligible(id) ? BUNDLE_GROUP : '');

module.exports = {
  FEST_ID,
  BUNDLE_COMPETITION_IDS,
  DISCOUNT_PERCENT,
  BUNDLE_SIZE,
  BUNDLE_GROUP,
  isBundleEligible,
  groupFor,
  // Back-compat aliases (tests / older imports)
  TECH_IDS: BUNDLE_COMPETITION_IDS,
  NON_TECH_IDS: [],
};
