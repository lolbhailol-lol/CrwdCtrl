const PLATFORM_FEE_RATE = 0.03;

const normalizeAmount = (amount) => {
  const value = Number(amount);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const calculatePlatformFee = (ticketPrice) => {
  const normalizedTicketPrice = normalizeAmount(ticketPrice);
  return Math.ceil(normalizedTicketPrice * PLATFORM_FEE_RATE);
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

module.exports = {
  calculatePlatformFee,
  buildPriceBreakdown,
  parseTicketPrice,
};
