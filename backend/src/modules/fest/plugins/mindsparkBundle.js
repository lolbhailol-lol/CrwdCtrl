const FEST_ID = '6a7f1010ed26d983b34e55c2';

/**
 * MindSpark baskets (Events team):
 * - Hat-Trick basket — any 3 from the list, 65% off
 * - Tech duo basket — 2 tech events, 50% off
 * - Dynamic duo basket — 1 tech + 1 non-tech, 40% off
 *
 * Fusion ID is not on the approved list.
 */
const NON_TECH_IDS = [
  '6a7f158e0e5ff505e2a4c48d', // FLASH
  '6a7f15b543825c1b6ced8059', // WORLDWIZE
  '6a7f158f0e5ff505e2a4c4b6', // MATHLETICS
  '6a7f158f0e5ff505e2a4c4a4', // BEYOND SUITS
  '6a7f158f0e5ff505e2a4c4a7', // FANDOM
  '6a7f15b543825c1b6ced805c', // GOOGLER
  '6ab9616b9da31251f82b3ab6', // DRONEVERSE
];

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
  '6a7f158f0e5ff505e2a4c4a1', // REVIT RUSH
  '6a7f158f0e5ff505e2a4c4b9', // ASSEMBLIX
  '6a7f158f0e5ff505e2a4c4a4', // BEYOND SUITS
  '6a7f158f0e5ff505e2a4c4a7', // FANDOM
  '6a7f15b543825c1b6ced805c', // GOOGLER
  '6a7f15900e5ff505e2a4c4d9', // EDIFEX
  '6a7f15900e5ff505e2a4c4dc', // UTOPIA
  '6a7f15900e5ff505e2a4c4df', // ON THE ETCH
  '6a7f15900e5ff505e2a4c4e3', // CIRCUIT FIXER
  '6a7f15900e5ff505e2a4c4e9', // MICROAPPS
  '6ab9616b9da31251f82b3ab6', // DRONEVERSE
];

const nonTechSet = new Set(NON_TECH_IDS.map(String));
const allowedSet = new Set(BUNDLE_COMPETITION_IDS.map(String));
const TECH_IDS = BUNDLE_COMPETITION_IDS.filter((id) => !nonTechSet.has(String(id)));
const techSet = new Set(TECH_IDS.map(String));

const BUNDLES = [
  {
    key: 'hat_trick',
    name: 'Hat-Trick basket',
    size: 3,
    discountPercent: 65,
    rule: 'any',
    blurb: 'Any 3 events from the list',
  },
  {
    key: 'tech_duo',
    name: 'Tech duo basket',
    size: 2,
    discountPercent: 50,
    rule: 'both_tech',
    blurb: '2 tech events',
  },
  {
    key: 'dynamic_duo',
    name: 'Dynamic duo basket',
    size: 2,
    discountPercent: 40,
    rule: 'one_each',
    blurb: '1 tech + 1 non-tech',
  },
];

const bundleByKey = new Map(BUNDLES.map((b) => [b.key, b]));

const isBundleEligible = (id) => allowedSet.has(String(id));
const isTech = (id) => techSet.has(String(id));
const isNonTech = (id) => nonTechSet.has(String(id));
const groupFor = (id) => {
  if (isNonTech(id)) return 'non_technical';
  if (isTech(id)) return 'technical';
  return '';
};

function resolveBundle(key) {
  const bundle = bundleByKey.get(String(key || '').trim());
  if (!bundle) {
    const error = new Error('Choose a bundle: Hat-Trick, Tech duo, or Dynamic duo.');
    error.status = 400;
    throw error;
  }
  return bundle;
}

function idsForBundle(bundle) {
  if (bundle.rule === 'both_tech') return TECH_IDS;
  return BUNDLE_COMPETITION_IDS;
}

function assertBundleSelection(bundle, ids) {
  const list = (ids || []).map(String);
  if (list.length !== bundle.size || new Set(list).size !== bundle.size) {
    const error = new Error(`${bundle.name}: select exactly ${bundle.size} different events.`);
    error.status = 400;
    throw error;
  }
  if (list.some((id) => !isBundleEligible(id))) {
    const error = new Error(`${bundle.name}: one or more events are not in this basket.`);
    error.status = 400;
    throw error;
  }
  if (bundle.rule === 'both_tech' && list.some((id) => !isTech(id))) {
    const error = new Error('Tech duo basket only includes tech events. Pick 2 tech events.');
    error.status = 400;
    throw error;
  }
  if (bundle.rule === 'one_each') {
    const tech = list.filter(isTech).length;
    const nonTech = list.filter(isNonTech).length;
    if (tech !== 1 || nonTech !== 1) {
      const error = new Error('Dynamic duo basket needs exactly 1 tech event and 1 non-tech event.');
      error.status = 400;
      throw error;
    }
  }
}

/** Hat-trick stays the default for older clients that omit bundleKey. */
const DISCOUNT_PERCENT = 65;
const BUNDLE_SIZE = 3;
const BUNDLE_GROUP = 'bundle';

module.exports = {
  FEST_ID,
  BUNDLE_COMPETITION_IDS,
  NON_TECH_IDS,
  TECH_IDS,
  BUNDLES,
  DISCOUNT_PERCENT,
  BUNDLE_SIZE,
  BUNDLE_GROUP,
  isBundleEligible,
  isTech,
  isNonTech,
  groupFor,
  resolveBundle,
  idsForBundle,
  assertBundleSelection,
};
