const PLATFORM_FEE_RATE = 0.03;
/** Events use a reduced 2.5% platform fee. */
export const EVENT_PLATFORM_FEE_RATE = 0.025;

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

export const calculateTrekPlatformFee = (ticketPrice, platformFeePercent = 3) => {
  const normalizedTicketPrice = parseTicketPrice(ticketPrice);
  const rate = Number(platformFeePercent);
  // Explicit 0% = Cashfree only, no CrwdCtrl platform fee
  if (Number.isFinite(rate) && rate === 0) return 0;
  const pct = Number.isFinite(rate) && rate > 0 ? rate / 100 : PLATFORM_FEE_RATE;
  return Math.ceil(normalizedTicketPrice * pct);
};

export const buildTrekPriceBreakdown = (ticketPrice, platformFeePercent = 3) => {
  const normalizedTicketPrice = parseTicketPrice(ticketPrice);
  const platformFee = calculateTrekPlatformFee(normalizedTicketPrice, platformFeePercent);
  return {
    ticketPrice: normalizedTicketPrice,
    platformFee,
    totalAmount: normalizedTicketPrice + platformFee,
  };
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

export const calculateEventPlatformFee = (ticketPrice, platformFeePercent = 2.5) => {
  const normalizedTicketPrice = parseTicketPrice(ticketPrice);
  const rate = Number(platformFeePercent);
  // Explicit 0% = Cashfree only, no CrwdCtrl platform fee
  if (Number.isFinite(rate) && rate === 0) return 0;
  const pct = Number.isFinite(rate) && rate > 0 ? rate / 100 : EVENT_PLATFORM_FEE_RATE;
  return Math.ceil(normalizedTicketPrice * pct);
};

export const buildEventPriceBreakdown = (ticketPrice, platformFeePercent = 2.5) => {
  const normalizedTicketPrice = parseTicketPrice(ticketPrice);
  const platformFee = calculateEventPlatformFee(normalizedTicketPrice, platformFeePercent);
  return {
    ticketPrice: normalizedTicketPrice,
    platformFee,
    totalAmount: normalizedTicketPrice + platformFee,
  };
};
