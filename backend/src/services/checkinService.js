const Registration = require('../model/registration_model');
const TrekBooking = require('../model/trek_booking_model');
const CategoryRegistration = require('../model/category_registration_model');
const EventShowRegistration = require('../model/event_show_registration_model');
const SportsEvent = require('../model/sports_model');
const FestOrganizer = require('../model/fest_organizer_model');
const Trek = require('../model/trek_model');
const Competition = require('../model/competition_model');
const { parseQrPayload, resolveCheckinRecord } = require('../utils/qrCheckin');
const { appendCheckinToGoogleSheets } = require('./googleSheetsService');

function matchesFestScope(recordFestId, festId) {
  if (!festId) return true;
  return String(recordFestId) === String(festId);
}

function matchesTrekScope(recordTrekId, trekId) {
  if (!trekId) return true;
  return String(recordTrekId) === String(trekId);
}

function matchesSportScope(recordEventId, sportEventId) {
  if (!sportEventId) return true;
  return String(recordEventId) === String(sportEventId);
}

async function resolveSheetsUrl({ festId, competitionId }) {
  const fest = await FestOrganizer.findById(festId).select('registration.googleSheetsUrl festName');
  if (!fest) return { sheetUrl: null, fest };

  if (competitionId) {
    const competition = await Competition.findById(competitionId).select(
      'name registration.googleSheetsUrl',
    );
    const compUrl = competition?.registration?.googleSheetsUrl;
    if (compUrl) {
      return { sheetUrl: compUrl, fest, competition };
    }
    return { sheetUrl: fest.registration?.googleSheetsUrl || null, fest, competition };
  }

  return { sheetUrl: fest.registration?.googleSheetsUrl || null, fest, competition: null };
}

function scheduleCheckinSheetLog({
  sheetUrl,
  festName,
  competitionName,
  ticketType,
  registrationId,
  userName,
  userEmail,
  checkedInAt,
  status,
  scannedBy,
}) {
  if (!sheetUrl) return;

  setImmediate(async () => {
    try {
      await appendCheckinToGoogleSheets(sheetUrl, {
        checkedInAt,
        userName,
        userEmail,
        festName,
        competitionName,
        ticketType,
        registrationId,
        status,
        scannedBy,
      });
    } catch (err) {
      console.error('❌ Check-in Google Sheets log failed:', err.message);
    }
  });
}

/**
 * @param {string} raw - QR payload string
 * @param {object} options
 * @param {string} [options.festId] - Restrict to this fest (fest organizer scanners)
 * @param {string} [options.trekId] - Restrict to this trek (trek organizer scanners)
 * @param {string} [options.sportEventId] - Restrict to this sports event (sport scanners)
 * @param {boolean} [options.allowTrek=true] - Admin can scan treks
 * @param {boolean} [options.allowSports=true] - Admin can scan sports tickets
 * @param {string} [options.scannedBy] - Name/email of scanner for sheet log
 * @param {boolean} [options.logToSheets=true]
 */
async function performCheckinFromRaw(raw, options = {}) {
  const {
    festId = null,
    trekId = null,
    sportEventId = null,
    allowTrek = true,
    allowSports = true,
    scannedBy = 'Admin',
    logToSheets = true,
  } = options;

  const payload = parseQrPayload(raw);
  if (!payload || (!payload.hash && !payload.registrationId && !payload.bookingId)) {
    return {
      status: 400,
      body: {
        success: false,
        status: 'invalid',
        message: 'Invalid QR code format — could not read ticket data',
      },
    };
  }

  const resolved = await resolveCheckinRecord({
    Registration,
    TrekBooking,
    CategoryRegistration,
    EventShowRegistration,
    payload,
  });
  if (!resolved) {
    return {
      status: 404,
      body: {
        success: false,
        status: 'invalid',
        message: 'Ticket not found. Ask the attendee to open My Bookings → Download ticket first, then scan again.',
      },
    };
  }

  if (resolved.kind === 'event') {
    if (festId || trekId || sportEventId) {
      return {
        status: 403,
        body: {
          success: false,
          status: 'invalid',
          message: 'This scanner is not for event tickets. Use the event scanner.',
        },
      };
    }

    const EventShow = require('../model/event_show_model');
    const eventReg = await EventShowRegistration.findById(resolved.record._id)
      .populate('user', 'name email profilePic');

    if (!eventReg) {
      return {
        status: 404,
        body: { success: false, status: 'invalid', message: 'Event registration not found.' },
      };
    }

    const show = await EventShow.findById(eventReg.eventShow).select('title displayName');
    const eventTitle = show?.displayName || show?.title || 'Event';

    if (eventReg.checkedIn) {
      return {
        status: 200,
        body: {
          success: true,
          status: 'already_checked_in',
          message: 'Already checked in',
          data: {
            userName: eventReg.user?.name,
            festName: eventTitle,
            eventTitle,
            ticketType: 'event',
            checkedInAt: eventReg.checkedInAt,
          },
        },
      };
    }

    eventReg.checkedIn = true;
    eventReg.checkedInAt = new Date();
    await eventReg.save();

    const { createNotification } = require('../controllers/notificationController');
    if (eventReg.user?._id) {
      setImmediate(async () => {
        try {
          await createNotification({
            userId: eventReg.user._id,
            title: 'Checked In!',
            message: `You've been checked in for ${eventTitle}.`,
            type: 'event',
            metadata: {
              eventShowId: eventReg.eventShow,
              registrationId: eventReg._id,
            },
          });
        } catch (err) {
          console.error('❌ Failed to create event check-in notification:', err.message);
        }
      });
    }

    return {
      status: 200,
      body: {
        success: true,
        status: 'checked_in',
        message: 'Check-in successful!',
        data: {
          userName: eventReg.user?.name,
          userEmail: eventReg.user?.email,
          userProfilePic: eventReg.user?.profilePic,
          festName: eventTitle,
          eventTitle,
          ticketType: 'event',
          checkedInAt: eventReg.checkedInAt,
          registrationId: eventReg._id,
        },
      },
    };
  }

  if (resolved.kind === 'sports') {
    if (festId) {
      return {
        status: 403,
        body: {
          success: false,
          status: 'invalid',
          message: 'This scanner is for fest tickets only. Sports tickets cannot be checked in here.',
        },
      };
    }
    if (trekId) {
      return {
        status: 403,
        body: {
          success: false,
          status: 'invalid',
          message: 'This scanner is for trek tickets only. Sports tickets cannot be checked in here.',
        },
      };
    }
    if (!allowSports && !sportEventId) {
      return {
        status: 403,
        body: {
          success: false,
          status: 'invalid',
          message: 'Sports tickets cannot be checked in with this scanner.',
        },
      };
    }

    const sportsReg = await CategoryRegistration.findById(resolved.record._id)
      .populate('user', 'name email profilePic');

    if (sportsReg.category !== 'sports' || sportsReg.status === 'cancelled') {
      return {
        status: 404,
        body: {
          success: false,
          status: 'invalid',
          message: 'Sports registration not found or cancelled.',
        },
      };
    }

    const event = await SportsEvent.findById(sportsReg.eventId).select(
      'title city sportType eventDate registration.googleSheetsUrl',
    );
    const eventId = sportsReg.eventId;
    const eventTitle = event?.title || 'Sports Event';

    if (sportEventId && !matchesSportScope(eventId, sportEventId)) {
      return {
        status: 403,
        body: {
          success: false,
          status: 'invalid',
          message: 'This ticket belongs to a different sports event. Use the correct scanner.',
        },
      };
    }

    if (sportsReg.checkedIn) {
      return {
        status: 200,
        body: {
          success: true,
          status: 'already_checked_in',
          message: 'Already checked in',
          data: {
            userName: sportsReg.user?.name,
            festName: eventTitle,
            eventTitle,
            ticketType: 'sports',
            checkedInAt: sportsReg.checkedInAt,
          },
        },
      };
    }

    sportsReg.checkedIn = true;
    sportsReg.checkedInAt = new Date();
    await sportsReg.save();

    const { createNotification } = require('../controllers/notificationController');
    if (sportsReg.user?._id) {
      setImmediate(async () => {
        try {
          await createNotification({
            userId: sportsReg.user._id,
            title: 'Checked In!',
            message: `You've been checked in for ${eventTitle}.`,
            type: 'event',
            metadata: {
              sportEventId: eventId,
              registrationId: sportsReg._id,
            },
          });
        } catch (err) {
          console.error('❌ Failed to create sports check-in notification:', err.message);
        }
      });
    }

    if (logToSheets) {
      let sheetUrl = event?.registration?.googleSheetsUrl || null;
      if (!sheetUrl && eventId) {
        const eventDoc = await SportsEvent.findById(eventId).select('registration.googleSheetsUrl');
        sheetUrl = eventDoc?.registration?.googleSheetsUrl || null;
      }

      scheduleCheckinSheetLog({
        sheetUrl,
        festName: eventTitle,
        competitionName: null,
        ticketType: 'sports',
        registrationId: sportsReg._id,
        userName: sportsReg.user?.name,
        userEmail: sportsReg.user?.email,
        checkedInAt: sportsReg.checkedInAt,
        status: 'Completed',
        scannedBy,
      });
    }

    return {
      status: 200,
      body: {
        success: true,
        status: 'checked_in',
        message: 'Check-in successful!',
        data: {
          userName: sportsReg.user?.name,
          userEmail: sportsReg.user?.email,
          userProfilePic: sportsReg.user?.profilePic,
          festName: eventTitle,
          eventTitle,
          ticketType: 'sports',
          checkedInAt: sportsReg.checkedInAt,
          registrationId: sportsReg._id,
        },
      },
    };
  }

  if (resolved.kind === 'trek') {
    if (festId || sportEventId) {
      return {
        status: 403,
        body: {
          success: false,
          status: 'invalid',
          message: sportEventId
            ? 'This scanner is for sports tickets only. Trek tickets cannot be checked in here.'
            : 'This scanner is for fest tickets only. Trek tickets cannot be checked in here.',
        },
      };
    }
    if (!allowTrek && !trekId) {
      return {
        status: 403,
        body: {
          success: false,
          status: 'invalid',
          message: 'Trek tickets cannot be checked in with this scanner.',
        },
      };
    }

    const trekBooking = await TrekBooking.findById(resolved.record._id)
      .populate('userId', 'name email profilePic')
      .populate('trekId', 'trekName trekDate city registration.googleSheetsUrl');

    const bookingTrekId = trekBooking.trekId?._id || trekBooking.trekId;
    if (trekId && !matchesTrekScope(bookingTrekId, trekId)) {
      return {
        status: 403,
        body: {
          success: false,
          status: 'invalid',
          message: 'This ticket belongs to a different trek. Use the correct trek scanner.',
        },
      };
    }

    const trekName = trekBooking.trekId?.trekName || 'Trek';

    if (trekBooking.status && trekBooking.status !== 'confirmed') {
      return {
        status: 400,
        body: {
          success: false,
          status: 'invalid',
          message: 'This booking is not confirmed and cannot be checked in.',
        },
      };
    }

    if (trekBooking.checkedIn) {
      const peopleCount = Math.max(1, Number(trekBooking.bookingDetails?.people) || 1);
      return {
        status: 200,
        body: {
          success: true,
          status: 'already_checked_in',
          message: peopleCount > 1
            ? `Already checked in (${peopleCount} people on this ticket)`
            : 'Already checked in',
          data: {
            userName: trekBooking.userId?.name || trekBooking.userName,
            festName: trekBooking.trekId?.trekName,
            trekName: trekBooking.trekId?.trekName,
            ticketType: 'trek',
            people: peopleCount,
            checkedInAt: trekBooking.checkedInAt,
          },
        },
      };
    }

    trekBooking.checkedIn = true;
    trekBooking.checkedInAt = new Date();
    await trekBooking.save();

    const { createNotification } = require('../controllers/notificationController');
    const { sendPushNotification } = require('../services/pushService');
    const trekUserId = trekBooking.userId?._id || trekBooking.userId;
    const checkInLink = `/registration-details/${trekBooking._id}?type=trek`;
    if (trekUserId) {
      setImmediate(async () => {
        try {
          await createNotification({
            userId: trekUserId,
            title: 'Checked In!',
            message: `You've been checked in for ${trekName}.`,
            type: 'event',
            link: checkInLink,
            metadata: {
              trekId: bookingTrekId,
              registrationId: trekBooking._id,
            },
          });
          sendPushNotification(trekUserId, {
            title: 'Checked In!',
            body: `You've been checked in for ${trekName}.`,
            link: checkInLink,
            type: 'event',
          }, { preferenceKey: 'pushReminders' }).catch((err) => {
            console.error('❌ Trek check-in push failed:', err.message);
          });
        } catch (err) {
          console.error('❌ Failed to create trek check-in notification:', err.message);
        }
      });
    }

    if (logToSheets) {
      let sheetUrl = trekBooking.trekId?.registration?.googleSheetsUrl || null;
      if (!sheetUrl && bookingTrekId) {
        const trekDoc = await Trek.findById(bookingTrekId).select('registration.googleSheetsUrl');
        sheetUrl = trekDoc?.registration?.googleSheetsUrl || null;
      }

      scheduleCheckinSheetLog({
        sheetUrl,
        festName: trekName,
        competitionName: null,
        ticketType: 'trek',
        registrationId: trekBooking._id,
        userName: trekBooking.userId?.name || trekBooking.userName,
        userEmail: trekBooking.userId?.email || trekBooking.userEmail,
        checkedInAt: trekBooking.checkedInAt,
        status: 'Completed',
        scannedBy,
      });
    }

    return {
      status: 200,
      body: {
        success: true,
        status: 'checked_in',
        message: (() => {
          const peopleCount = Math.max(1, Number(trekBooking.bookingDetails?.people) || 1);
          return peopleCount > 1
            ? `Check-in successful! ${peopleCount} people on this ticket.`
            : 'Check-in successful!';
        })(),
        data: {
          userName: trekBooking.userId?.name || trekBooking.userName,
          userEmail: trekBooking.userId?.email || trekBooking.userEmail,
          userProfilePic: trekBooking.userId?.profilePic,
          festName: trekName,
          trekName,
          ticketType: 'trek',
          people: Math.max(1, Number(trekBooking.bookingDetails?.people) || 1),
          checkedInAt: trekBooking.checkedInAt,
          bookingId: trekBooking._id,
        },
      },
    };
  }

  if (trekId || sportEventId) {
    return {
      status: 403,
      body: {
        success: false,
        status: 'invalid',
        message: sportEventId
          ? 'This scanner is for sports tickets only. Fest tickets cannot be checked in here.'
          : 'This scanner is for trek tickets only. Fest tickets cannot be checked in here.',
      },
    };
  }

  const registration = await Registration.findById(resolved.record._id)
    .populate('user', 'name email profilePic')
    .populate('fest', 'festName festDate registration.googleSheetsUrl')
    .populate('competitionId', 'name registration.googleSheetsUrl');

  if (festId && !matchesFestScope(registration.fest?._id || registration.fest, festId)) {
    return {
      status: 403,
      body: {
        success: false,
        status: 'invalid',
        message: 'This ticket belongs to a different event. Use the correct fest scanner.',
      },
    };
  }

  const ticketType = registration.competitionId ? 'competition' : 'fest';
  const festName = registration.fest?.festName || 'Event';
  const competitionName = registration.competitionId?.name || null;

  if (registration.checkedIn) {
    return {
      status: 200,
      body: {
        success: true,
        status: 'already_checked_in',
        message: 'Already checked in',
        data: {
          userName: registration.user?.name,
          festName,
          competitionName,
          ticketType,
          checkedInAt: registration.checkedInAt,
        },
      },
    };
  }

  registration.checkedIn = true;
  registration.checkedInAt = new Date();
  await registration.save();

  const { createNotification } = require('../controllers/notificationController');
  setImmediate(async () => {
    try {
      await createNotification({
        userId: registration.user._id,
        title: 'Checked In!',
        message: `You've been checked in to ${festName}${competitionName ? ` — ${competitionName}` : ''}.`,
        type: 'event',
        metadata: {
          festId: registration.fest?._id,
          competitionId: registration.competitionId?._id,
          registrationId: registration._id,
        },
      });
    } catch (err) {
      console.error('❌ Failed to create check-in notification:', err.message);
    }
  });

  if (logToSheets) {
    const targetFestId = registration.fest?._id || registration.fest;
    const { sheetUrl } = await resolveSheetsUrl({
      festId: targetFestId,
      competitionId: registration.competitionId?._id || registration.competitionId,
    });

    scheduleCheckinSheetLog({
      sheetUrl,
      festName,
      competitionName,
      ticketType,
      registrationId: registration._id,
      userName: registration.user?.name,
      userEmail: registration.user?.email,
      checkedInAt: registration.checkedInAt,
      status: 'Completed',
      scannedBy,
    });
  }

  return {
    status: 200,
    body: {
      success: true,
      status: 'checked_in',
      message: 'Check-in successful!',
      data: {
        userName: registration.user?.name,
        userEmail: registration.user?.email,
        userProfilePic: registration.user?.profilePic,
        festName,
        competitionName,
        ticketType,
        checkedInAt: registration.checkedInAt,
        registrationId: registration._id,
      },
    },
  };
}

module.exports = {
  performCheckinFromRaw,
  matchesFestScope,
  matchesTrekScope,
  matchesSportScope,
};
