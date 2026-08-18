const { parseTicketPrice } = require('./platformFee');

/** Game of Innovation (MindSpark) — one event, three student-category fees */
const GAME_OF_INNOVATION_FEE_TIERS = [
  { id: 'under_18', label: 'Under 18 students', amount: 150 },
  { id: 'ug', label: 'UG students', amount: 300 },
  { id: 'pg_phd', label: 'PG students / PhD Scholars', amount: 500 },
];

function slugTierId(label, index = 0) {
  const base = String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32);
  return base || `tier_${index + 1}`;
}

function sanitizeCompetitionFeeTiers(list) {
  if (!Array.isArray(list)) return [];
  const used = new Set();
  return list
    .map((tier, index) => {
      const label = String(tier?.label || tier?.name || '').trim();
      const amount = Math.max(0, Math.round(Number(tier?.amount ?? tier?.fee) || 0));
      let id = String(tier?.id || '').trim() || slugTierId(label, index);
      id = id.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 48);
      if (!id) id = `tier_${index + 1}`;
      if (used.has(id)) id = `${id}_${index + 1}`;
      used.add(id);
      return { id, label, amount };
    })
    .filter((tier) => tier.label || tier.amount > 0)
    .map((tier, index) => ({
      ...tier,
      label: tier.label || `Category ${index + 1}`,
    }));
}

function getCompetitionFeeTiers(competition) {
  return sanitizeCompetitionFeeTiers(competition?.feeTiers);
}

function minCompetitionFeeAmount(tiers) {
  if (!Array.isArray(tiers) || !tiers.length) return 0;
  return Math.min(...tiers.map((t) => Math.max(0, Number(t.amount) || 0)));
}

function formatCompetitionFeeTiersLabel(tiers) {
  const list = sanitizeCompetitionFeeTiers(tiers);
  if (!list.length) return '';
  return list
    .map((t) => `₹${Number(t.amount).toLocaleString('en-IN')}/- for ${t.label}`)
    .join(' · ');
}

function formatCompetitionFeeFromLabel(tiers) {
  const list = sanitizeCompetitionFeeTiers(tiers);
  if (!list.length) return '';
  const min = minCompetitionFeeAmount(list);
  const max = Math.max(...list.map((t) => t.amount));
  if (max === 0) return 'Free';
  if (min === max) return `₹${min.toLocaleString('en-IN')}`;
  return list
    .map((t) => `₹${Number(t.amount).toLocaleString('en-IN')}`)
    .join(' · ');
}

function competitionRequiresPayment(competition) {
  const tiers = getCompetitionFeeTiers(competition);
  if (tiers.length) return tiers.some((t) => t.amount > 0);
  return (
    (parseTicketPrice(competition?.feeAmount) || parseTicketPrice(competition?.registrationFee)) > 0
  );
}

function findCompetitionFeeTierOrThrow(tiers, tierId) {
  const id = String(tierId || '').trim();
  if (!id) {
    const err = new Error('Please select a registration category.');
    err.status = 400;
    throw err;
  }
  const tier = tiers.find((t) => t.id === id);
  if (!tier) {
    const err = new Error('Invalid registration category selected.');
    err.status = 400;
    throw err;
  }
  return tier;
}

/**
 * @returns {{ ticketPrice: number, tier: object|null }}
 */
function resolveCompetitionTicketPrice(competition, tierId) {
  const tiers = getCompetitionFeeTiers(competition);
  if (tiers.length) {
    const tier = findCompetitionFeeTierOrThrow(tiers, tierId);
    return { ticketPrice: Math.max(0, Number(tier.amount) || 0), tier };
  }
  return {
    ticketPrice:
      parseTicketPrice(competition?.feeAmount) || parseTicketPrice(competition?.registrationFee) || 0,
    tier: null,
  };
}

function applyFeeTiersToCompetition(competition, feeTiersRaw) {
  const tiers = sanitizeCompetitionFeeTiers(feeTiersRaw);
  competition.feeTiers = tiers;
  if (tiers.length) {
    competition.feeAmount = minCompetitionFeeAmount(tiers);
    competition.registrationFee = formatCompetitionFeeTiersLabel(tiers);
  }
  return tiers;
}

async function resolvePaidOrderTotal(orderId, fallback = 0) {
  if (!orderId) return fallback;
  const PaymentOrder = require('../model/payment_order_model');
  const order = await PaymentOrder.findOne({ orderId: String(orderId) }).select('totalAmount').lean();
  const n = Number(order?.totalAmount);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

module.exports = {
  GAME_OF_INNOVATION_FEE_TIERS,
  sanitizeCompetitionFeeTiers,
  getCompetitionFeeTiers,
  minCompetitionFeeAmount,
  formatCompetitionFeeTiersLabel,
  formatCompetitionFeeFromLabel,
  competitionRequiresPayment,
  resolveCompetitionTicketPrice,
  applyFeeTiersToCompetition,
  resolvePaidOrderTotal,
};
