const FEST_ID = '6a7f1010ed26d983b34e55c2';

const NON_TECH_IDS = [
  '6a7f158e0e5ff505e2a4c48d', // FLASH
  '6a7f158e0e5ff505e2a4c48f', // TAKE OFF
  '6a7f158e0e5ff505e2a4c492', // TORQUEST
  '6a7f15c84a2df24d5b0ef4b1', // QUANTQUEST
  '6a7f15b543825c1b6ced8059', // WORLDWIZE
  '6a7f158f0e5ff505e2a4c4b6', // MATHLETICS
  '6a7f158f0e5ff505e2a4c4a7', // FANDOM
  '6a7f158f0e5ff505e2a4c4a4', // BEYOND SUITS
  '6a7f158f0e5ff505e2a4c4bf', // SHERLOCKED
  '6a7f15b543825c1b6ced805c', // GOOGLER
];

const TECH_IDS = [
  '6a7f158e0e5ff505e2a4c495','6a7f158f0e5ff505e2a4c49b','6a7f158f0e5ff505e2a4c498',
  '6a7f158f0e5ff505e2a4c4ad','6a7f158f0e5ff505e2a4c49e','6a7f158f0e5ff505e2a4c4a1',
  '6a7f158f0e5ff505e2a4c4b9','6a7f15900e5ff505e2a4c4dc','6a7f15900e5ff505e2a4c4d9',
  '6a7f15900e5ff505e2a4c4df','6a7f15900e5ff505e2a4c4e9','6a7f15900e5ff505e2a4c4e3',
  '6a7f15b543825c1b6ced8067','6a7f15b543825c1b6ced806b','6a7f15b543825c1b6ced805f',
  '6a7f15900e5ff505e2a4c4ca','6a7f15b543825c1b6ced8064','6a7f15900e5ff505e2a4c4d0',
  '6a7f158f0e5ff505e2a4c4c5','6a7f158f0e5ff505e2a4c4c2','6a7f158f0e5ff505e2a4c4aa',
  '6a7f15b443825c1b6ced8056',
];

const groupFor = (id) => TECH_IDS.includes(String(id)) ? 'technical' : NON_TECH_IDS.includes(String(id)) ? 'non_technical' : '';
module.exports = { FEST_ID, TECH_IDS, NON_TECH_IDS, groupFor, DISCOUNT_PERCENT: 70 };
