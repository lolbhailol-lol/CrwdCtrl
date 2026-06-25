const PLATFORM_FEE_RATE = 0.03;
/** Events use a reduced 2.5% platform fee. */
const EVENT_PLATFORM_FEE_RATE = 0.025;

const normalizeAmount = (amount) => {
  const value = Number(amount);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const calculatePlatformFee = (ticketPrice) => {
  const normalizedTicketPrice = normalizeAmount(ticketPrice);
  return Math.ceil(normalizedTicketPrice * PLATFORM_FEE_RATE);
};

const calculateEventPlatformFee = (ticketPrice) => {
  const normalizedTicketPrice = normalizeAmount(ticketPrice);
  return Math.ceil(normalizedTicketPrice * EVENT_PLATFORM_FEE_RATE);
};

const buildEventPriceBreakdown = (ticketPrice) => {
  const normalizedTicketPrice = normalizeAmount(ticketPrice);
  const platformFee = calculateEventPlatformFee(normalizedTicketPrice);
  return {
    ticketPrice: normalizedTicketPrice,
    platformFee,
    totalAmount: normalizedTicketPrice + platformFee,
  };
};

const parseTicketPrice = (amount) => {
  if (typeof amount === 'number') return normalizeAmount(amount);
  if (!amount || typeof amount !== 'string') return 0;
  if (amount.trim().toLowerCase() === 'free') return 0;

  const numericValue = amount.replace(/[^0-9.]/g, '');
  return normalizeAmount(numericValue);
};

const buildPriceBreakdown = (ticketPrice) => {
  const normalizedTicketPrice = normalizeAmount(ticketPrice);
  const platformFee = calculatePlatformFee(normalizedTicketPrice);
  const totalAmount = normalizedTicketPrice + platformFee;

  return {
    ticketPrice: normalizedTicketPrice,
    platformFee,
    totalAmount,
  };
};

/** Total charged for a ticket price: ticket + ceil(3% fee). Monotonic in ticket. */
const totalForTicketPrice = (ticketPrice) => {
  const ticket = normalizeAmount(ticketPrice);
  return ticket + calculatePlatformFee(ticket);
};

/** Inverse of totalForTicketPrice — O(log paid) binary search instead of O(paid) scan. */
function findTicketPriceForPaidTotal(paid) {
  let low = 0;
  let high = paid;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const total = totalForTicketPrice(mid);
    if (total === paid) return mid;
    if (total < paid) low = mid + 1;
    else high = mid - 1;
  }
  return null;
}

/** Split a customer-paid total into ticket + 3% platform fee (when total includes fee). */
function deriveRevenueFromPaidAmount(amountPaid, { feeIsTicketOnly = false } = {}) {
  const paid = normalizeAmount(amountPaid);
  if (paid <= 0) {
    return { ticketPrice: 0, platformFee: 0, grossCollected: 0 };
  }

  if (feeIsTicketOnly) {
    const platformFee = calculatePlatformFee(paid);
    return {
      ticketPrice: paid,
      platformFee,
      grossCollected: paid + platformFee,
    };
  }

  const ticketPrice = findTicketPriceForPaidTotal(paid);
  if (ticketPrice !== null) {
    const platformFee = calculatePlatformFee(ticketPrice);
    return { ticketPrice, platformFee, grossCollected: paid };
  }

  return { ticketPrice: paid, platformFee: 0, grossCollected: paid };
}

module.exports = {
  PLATFORM_FEE_RATE,
  EVENT_PLATFORM_FEE_RATE,
  calculatePlatformFee,
  calculateEventPlatformFee,
  buildPriceBreakdown,
  buildEventPriceBreakdown,
  parseTicketPrice,
  deriveRevenueFromPaidAmount,
};
