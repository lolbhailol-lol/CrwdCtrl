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

const calculateTrekPlatformFee = (ticketPrice, platformFeePercent = 3) => {
  const normalizedTicketPrice = normalizeAmount(ticketPrice);
  const rate = Number(platformFeePercent);
  const pct = Number.isFinite(rate) && rate > 0 ? rate / 100 : PLATFORM_FEE_RATE;
  return Math.ceil(normalizedTicketPrice * pct);
};

const buildTrekPriceBreakdown = (ticketPrice, platformFeePercent = 3) => {
  const normalizedTicketPrice = normalizeAmount(ticketPrice);
  const platformFee = calculateTrekPlatformFee(normalizedTicketPrice, platformFeePercent);
  return {
    ticketPrice: normalizedTicketPrice,
    platformFee,
    totalAmount: normalizedTicketPrice + platformFee,
  };
};

const calculateEventPlatformFee = (ticketPrice, platformFeePercent = 2.5) => {
  const normalizedTicketPrice = normalizeAmount(ticketPrice);
  const rate = Number(platformFeePercent);
  const pct = Number.isFinite(rate) && rate > 0 ? rate / 100 : EVENT_PLATFORM_FEE_RATE;
  return Math.ceil(normalizedTicketPrice * pct);
};

const buildEventPriceBreakdown = (ticketPrice, platformFeePercent = 2.5) => {
  const normalizedTicketPrice = normalizeAmount(ticketPrice);
  const platformFee = calculateEventPlatformFee(normalizedTicketPrice, platformFeePercent);
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

/** Inverse of buildTrekPriceBreakdown total — find ticket portion from customer-paid total. */
function findTicketPriceForTrekPaidTotal(paid, platformFeePercent = 3) {
  const normalizedPaid = normalizeAmount(paid);
  if (normalizedPaid <= 0) return null;

  const rate = Number(platformFeePercent);
  const pct = Number.isFinite(rate) && rate > 0 ? rate / 100 : PLATFORM_FEE_RATE;

  let low = 0;
  let high = normalizedPaid;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const fee = Math.ceil(mid * pct);
    const total = mid + fee;
    if (total === normalizedPaid) return mid;
    if (total < normalizedPaid) low = mid + 1;
    else high = mid - 1;
  }
  return null;
}

/**
 * Split customer-paid trek total into organizer share (ticket) vs CrwdCtrl platform fee.
 */
function splitTrekOrganizerPayment(
  amountPaid,
  platformFeePercent = 3,
  { registrationFeePerPerson = 0, people = 1 } = {},
) {
  const gross = normalizeAmount(amountPaid);
  if (gross <= 0) {
    return { organizerNet: 0, platformFee: 0, grossCollected: 0 };
  }

  const headcount = Math.max(1, Number(people) || 1);
  const expectedTicket = normalizeAmount(registrationFeePerPerson) * headcount;

  if (expectedTicket > 0) {
    const { platformFee, totalAmount } = buildTrekPriceBreakdown(expectedTicket, platformFeePercent);
    if (totalAmount === gross) {
      return { organizerNet: expectedTicket, platformFee, grossCollected: gross };
    }
  }

  const ticketPrice = findTicketPriceForTrekPaidTotal(gross, platformFeePercent);
  if (ticketPrice !== null) {
    return {
      organizerNet: ticketPrice,
      platformFee: gross - ticketPrice,
      grossCollected: gross,
    };
  }

  return { organizerNet: gross, platformFee: 0, grossCollected: gross };
}

module.exports = {
  PLATFORM_FEE_RATE,
  EVENT_PLATFORM_FEE_RATE,
  calculatePlatformFee,
  calculateTrekPlatformFee,
  calculateEventPlatformFee,
  buildPriceBreakdown,
  buildTrekPriceBreakdown,
  buildEventPriceBreakdown,
  parseTicketPrice,
  deriveRevenueFromPaidAmount,
  findTicketPriceForTrekPaidTotal,
  splitTrekOrganizerPayment,
};
