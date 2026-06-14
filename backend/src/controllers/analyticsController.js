const Analytics = require('../model/analytics_model');
const User = require('../model/usermodel');
const Registration = require('../model/registration_model');
const FestOrganizer = require('../model/fest_organizer_model');
const TrekBooking = require('../model/trek_booking_model');
const CategoryRegistration = require('../model/category_registration_model');
const PaymentOrder = require('../model/payment_order_model');
const { deriveRevenueFromPaidAmount } = require('../utils/platformFee');

function sumRevenueRows(rows, amountKey, options = {}) {
  return rows.reduce(
    (acc, row) => {
      const derived = deriveRevenueFromPaidAmount(row[amountKey], options);
      acc.grossCollected += derived.grossCollected;
      acc.ticketRevenue += derived.ticketPrice;
      acc.platformCommission += derived.platformFee;
      acc.paidCount += 1;
      return acc;
    },
    { grossCollected: 0, ticketRevenue: 0, platformCommission: 0, paidCount: 0 },
  );
}

function emptyRevenueBucket() {
  return {
    registrations: 0,
    paidCount: 0,
    grossCollected: 0,
    ticketRevenue: 0,
    platformCommission: 0,
  };
}

function mergeRevenueBuckets(...buckets) {
  return buckets.reduce(
    (acc, b) => ({
      registrations: acc.registrations + (b.registrations || 0),
      paidCount: acc.paidCount + (b.paidCount || 0),
      grossCollected: acc.grossCollected + (b.grossCollected || 0),
      ticketRevenue: acc.ticketRevenue + (b.ticketRevenue || 0),
      platformCommission: acc.platformCommission + (b.platformCommission || 0),
    }),
    emptyRevenueBucket(),
  );
}

// ===== POST: Track an analytics event (public — no auth required for page views) =====
const trackEvent = async (req, res) => {
  try {
    const { eventType, metadata = {}, sessionId } = req.body;

    if (!eventType) {
      return res.status(400).json({ success: false, message: 'eventType is required' });
    }

    // Get userId from auth if available (optional)
    let userId = null;
    try {
      if (req.user && req.user.userId) {
        userId = req.user.userId;
      }
    } catch (_) { /* no auth — that's fine */ }

    await Analytics.create({
      eventType,
      userId,
      sessionId: sessionId || null,
      metadata,
    });

    res.status(201).json({ success: true });
  } catch (error) {
    // Don't fail the response for analytics errors
    console.error('❌ Analytics track error:', error.message);
    res.status(200).json({ success: true }); // Still return 200 to not break frontend
  }
};

// ===== GET: Admin dashboard analytics =====
const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const previousThirtyDays = new Date(now - 60 * 24 * 60 * 60 * 1000);

    // Parallel aggregations for performance
    const [
      totalUsers,
      festRegistrations,
      competitionRegistrations,
      trekBookings,
      categoryRegistrations,
      pageViews7d,
      pageViews30d,
      previousPeriodUsers,
      previousPeriodRegistrations,
      registrationsByDay,
      topFestsByViews,
      deviceBreakdown,
      userSignupsByDay,
      recentRegistrations,
    ] = await Promise.all([
      // Total users
      User.countDocuments(),

      Registration.countDocuments({ competitionId: null }),
      Registration.countDocuments({ competitionId: { $ne: null } }),
      TrekBooking.countDocuments({ status: 'confirmed' }),
      CategoryRegistration.countDocuments(),

      // Page views last 7 days
      Analytics.countDocuments({
        eventType: 'page_view',
        createdAt: { $gte: sevenDaysAgo },
      }),

      // Page views last 30 days
      Analytics.countDocuments({
        eventType: 'page_view',
        createdAt: { $gte: thirtyDaysAgo },
      }),

      // Previous 30-day users (for growth calculation)
      User.countDocuments({
        createdAt: { $gte: previousThirtyDays, $lt: thirtyDaysAgo },
      }),

      // Previous 30-day registrations
      Registration.countDocuments({
        createdAt: { $gte: previousThirtyDays, $lt: thirtyDaysAgo },
      }),

      // Registrations by day (last 30 days)
      Registration.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Top 5 fests by views
      Analytics.aggregate([
        {
          $match: {
            eventType: 'fest_view',
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: '$metadata.festId',
            views: { $sum: 1 },
          },
        },
        { $sort: { views: -1 } },
        { $limit: 5 },
      ]),

      // Device breakdown
      Analytics.aggregate([
        {
          $match: {
            eventType: 'page_view',
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: '$metadata.device',
            count: { $sum: 1 },
          },
        },
      ]),

      // User signups by day (last 30 days)
      User.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Recent registrations (last 10)
      Registration.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('user', 'name email')
        .populate('fest', 'festName')
        .populate('competitionId', 'name')
        .lean(),
    ]);

    // Enrich top fests with names
    let topFestsEnriched = [];
    if (topFestsByViews.length > 0) {
      const festIds = topFestsByViews.map(f => f._id).filter(Boolean);
      const fests = await FestOrganizer.find({ _id: { $in: festIds } }).select('festName').lean();
      const festMap = {};
      fests.forEach(f => { festMap[f._id.toString()] = f.festName; });
      topFestsEnriched = topFestsByViews.map(f => ({
        festId: f._id,
        name: festMap[f._id?.toString()] || 'Unknown Fest',
        views: f.views,
      }));
    }

    // Calculate growth percentages
    const currentPeriodUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });
    const currentPeriodRegistrations = await Registration.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    const userGrowth = previousPeriodUsers > 0
      ? Math.round(((currentPeriodUsers - previousPeriodUsers) / previousPeriodUsers) * 100)
      : currentPeriodUsers > 0 ? 100 : 0;

    const registrationGrowth = previousPeriodRegistrations > 0
      ? Math.round(((currentPeriodRegistrations - previousPeriodRegistrations) / previousPeriodRegistrations) * 100)
      : currentPeriodRegistrations > 0 ? 100 : 0;

    const totalRegistrations =
      festRegistrations + competitionRegistrations + trekBookings + categoryRegistrations;

    // Format device breakdown
    const devices = {};
    deviceBreakdown.forEach(d => {
      devices[d._id || 'unknown'] = d.count;
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalRegistrations,
        festRegistrations,
        competitionRegistrations,
        trekBookings,
        categoryRegistrations,
        pageViews7d,
        pageViews30d,
        userGrowth,
        registrationGrowth,
        devices,
      },
      charts: {
        registrationsByDay,
        topFests: topFestsEnriched,
        userSignupsByDay,
      },
      recentRegistrations: recentRegistrations.map(r => ({
        id: r._id,
        userName: r.user?.name || 'Unknown',
        userEmail: r.user?.email || '',
        festName: r.fest?.festName || 'Unknown',
        competitionName: r.competitionId?.name || null,
        status: r.status,
        date: r.createdAt,
      })),
    });
  } catch (error) {
    console.error('❌ Analytics dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
};

// ===== GET: Per-fest analytics =====
const getFestAnalytics = async (req, res) => {
  try {
    const { festId } = req.params;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [views, registrations, viewsByDay] = await Promise.all([
      Analytics.countDocuments({
        eventType: 'fest_view',
        'metadata.festId': festId,
        createdAt: { $gte: thirtyDaysAgo },
      }),

      Registration.countDocuments({
        fest: festId,
        createdAt: { $gte: thirtyDaysAgo },
      }),

      Analytics.aggregate([
        {
          $match: {
            eventType: 'fest_view',
            'metadata.festId': festId,
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const conversionRate = views > 0 ? Math.round((registrations / views) * 100) : 0;

    res.json({
      success: true,
      festId,
      views,
      registrations,
      conversionRate,
      viewsByDay,
    });
  } catch (error) {
    console.error('❌ Fest analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fest analytics' });
  }
};

// ===== GET: Realtime stats (active users in last 5 min) =====
const getRealtimeStats = async (req, res) => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const activeUsers = await Analytics.distinct('sessionId', {
      createdAt: { $gte: fiveMinutesAgo },
      sessionId: { $ne: null },
    });

    res.json({
      success: true,
      activeUsers: activeUsers.length,
    });
  } catch (error) {
    console.error('❌ Realtime stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch realtime stats' });
  }
};

// ===== GET: Revenue summary from saved payment records =====
const getRevenueSummary = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [
      festPaidRegs,
      competitionPaidRegs,
      trekPaidBookings,
      sportsPaidRegs,
      eventsPaidRegs,
      paidPaymentOrders,
      festRegCount,
      competitionRegCount,
      trekBookingCount,
      sportsRegCount,
      eventsRegCount,
      recentFestPaid,
      recentCompetitionPaid,
      recentTrekPaid,
      recentSportsPaid,
    ] = await Promise.all([
      Registration.find({ paymentStatus: 'paid', amountPaid: { $gt: 0 }, competitionId: null })
        .select('amountPaid createdAt')
        .lean(),
      Registration.find({ paymentStatus: 'paid', amountPaid: { $gt: 0 }, competitionId: { $ne: null } })
        .select('amountPaid createdAt')
        .lean(),
      TrekBooking.find({ status: 'confirmed', 'bookingDetails.amountPaid': { $gt: 0 } })
        .select('bookingDetails.amountPaid createdAt')
        .lean(),
      CategoryRegistration.find({ category: 'sports', paymentStatus: 'paid', amountPaid: { $gt: 0 } })
        .select('amountPaid createdAt')
        .lean(),
      CategoryRegistration.find({ category: 'events', paymentStatus: 'paid', amountPaid: { $gt: 0 } })
        .select('amountPaid createdAt')
        .lean(),
      PaymentOrder.find({ status: 'PAID' })
        .select('ticketPrice platformFee totalAmount entityType createdAt')
        .lean(),
      Registration.countDocuments({ competitionId: null }),
      Registration.countDocuments({ competitionId: { $ne: null } }),
      TrekBooking.countDocuments({ status: 'confirmed' }),
      CategoryRegistration.countDocuments({ category: 'sports' }),
      CategoryRegistration.countDocuments({ category: 'events' }),
      Registration.find({
        paymentStatus: 'paid',
        amountPaid: { $gt: 0 },
        competitionId: null,
        createdAt: { $gte: thirtyDaysAgo },
      }).select('amountPaid').lean(),
      Registration.find({
        paymentStatus: 'paid',
        amountPaid: { $gt: 0 },
        competitionId: { $ne: null },
        createdAt: { $gte: thirtyDaysAgo },
      }).select('amountPaid').lean(),
      TrekBooking.find({
        status: 'confirmed',
        'bookingDetails.amountPaid': { $gt: 0 },
        createdAt: { $gte: thirtyDaysAgo },
      }).select('bookingDetails.amountPaid createdAt').lean(),
      CategoryRegistration.find({
        category: 'sports',
        paymentStatus: 'paid',
        amountPaid: { $gt: 0 },
        createdAt: { $gte: thirtyDaysAgo },
      }).select('amountPaid').lean(),
    ]);

    const festRevenue = sumRevenueRows(festPaidRegs, 'amountPaid', { feeIsTicketOnly: true });
    const competitionRevenue = sumRevenueRows(competitionPaidRegs, 'amountPaid');
    const trekRevenue = sumRevenueRows(
      trekPaidBookings.map((b) => ({ amountPaid: b.bookingDetails?.amountPaid || 0 })),
      'amountPaid',
    );
    const runsRevenue = sumRevenueRows(sportsPaidRegs, 'amountPaid');
    const eventsRevenue = sumRevenueRows(eventsPaidRegs, 'amountPaid');

    const festBucket = { ...festRevenue, registrations: festRegCount };
    const competitionBucket = { ...competitionRevenue, registrations: competitionRegCount };
    const treksBucket = { ...trekRevenue, registrations: trekBookingCount };
    const runsBucket = { ...runsRevenue, registrations: sportsRegCount };
    const eventsBucket = { ...eventsRevenue, registrations: eventsRegCount };

    const categories = {
      fests: festBucket,
      competitions: competitionBucket,
      treks: treksBucket,
      runs: runsBucket,
      events: eventsBucket,
    };

    const totals = mergeRevenueBuckets(
      festBucket,
      competitionBucket,
      treksBucket,
      runsBucket,
      eventsBucket,
    );

    const last30Fest = sumRevenueRows(recentFestPaid, 'amountPaid', { feeIsTicketOnly: true });
    const last30Competition = sumRevenueRows(recentCompetitionPaid, 'amountPaid');
    const last30Trek = sumRevenueRows(
      recentTrekPaid.map((b) => ({ amountPaid: b.bookingDetails?.amountPaid || 0 })),
      'amountPaid',
    );
    const last30Runs = sumRevenueRows(recentSportsPaid, 'amountPaid');
    const last30Days = mergeRevenueBuckets(last30Fest, last30Competition, last30Trek, last30Runs);

    const paymentOrdersSummary = paidPaymentOrders.reduce(
      (acc, order) => {
        acc.count += 1;
        acc.grossCollected += order.totalAmount || 0;
        acc.ticketRevenue += order.ticketPrice || 0;
        acc.platformCommission += order.platformFee || 0;
        return acc;
      },
      { count: 0, grossCollected: 0, ticketRevenue: 0, platformCommission: 0 },
    );

    res.json({
      success: true,
      platformFeeRate: 0.03,
      totals: {
        ...totals,
        registrations:
          festRegCount + competitionRegCount + trekBookingCount + sportsRegCount + eventsRegCount,
      },
      last30Days,
      categories,
      paymentOrders: paymentOrdersSummary,
      note: 'Gross collected is derived from saved amountPaid fields. Fest fees stored as ticket price include estimated 3% platform fee.',
    });
  } catch (error) {
    console.error('❌ Revenue summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch revenue summary' });
  }
};

module.exports = {
  trackEvent,
  getDashboardStats,
  getFestAnalytics,
  getRealtimeStats,
  getRevenueSummary,
};
