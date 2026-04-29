const PLATFORM_FEE_RATE = 0.03;

export const parseTicketPrice = (amount) => {
  if (typeof amount === 'number') return Number.isFinite(amount) && amount > 0 ? amount : 0;
  if (!amount || typeof amount !== 'string') return 0;
  if (amount.trim().toLowerCase() === 'free') return 0;

  const numericValue = Number(amount.replace(/[^0-9.]/g, ''));
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
};

export const calculatePlatformFee = (ticketPrice) => {
  const normalizedTicketPrice = parseTicketPrice(ticketPrice);
  return Math.ceil(normalizedTicketPrice * PLATFORM_FEE_RATE);
};

export const buildPriceBreakdown = (ticketPrice) => {
  const normalizedTicketPrice = parseTicketPrice(ticketPrice);
  const platformFee = calculatePlatformFee(normalizedTicketPrice);

  return {
    ticketPrice: normalizedTicketPrice,
    platformFee,
    totalAmount: normalizedTicketPrice + platformFee,
  };
};
