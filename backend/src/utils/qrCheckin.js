function normalizeHash(hash) {
  const value = String(hash || '').trim().toLowerCase();
  return /^[a-f0-9]{32}$/.test(value) ? value : null;
}

function parseQrPayload(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') {
      return { hash: normalizeHash(parsed) };
    }
    return {
      hash: normalizeHash(parsed.hash || parsed.qrHash),
      registrationId: parsed.registrationId ? String(parsed.registrationId) : null,
      bookingId: parsed.bookingId ? String(parsed.bookingId) : null,
      type: parsed.type || null,
    };
  } catch {
    return { hash: normalizeHash(trimmed) };
  }
}

function extractHashFromQrPayload(raw) {
  return parseQrPayload(raw)?.hash || null;
}

async function resolveCheckinRecord({ Registration, TrekBooking, CategoryRegistration, EventShowRegistration, payload }) {
  const hash = payload?.hash || null;
  const candidateId = payload?.bookingId || payload?.registrationId || null;

  if (hash) {
    const registration = await Registration.findOne({ qrCodeData: hash });
    if (registration) return { kind: 'registration', record: registration };

    const trekBooking = await TrekBooking.findOne({ qrCodeData: hash });
    if (trekBooking) return { kind: 'trek', record: trekBooking };

    if (CategoryRegistration) {
      const sportsReg = await CategoryRegistration.findOne({
        qrCodeData: hash,
        category: 'sports',
      });
      if (sportsReg) return { kind: 'sports', record: sportsReg };
    }

    if (EventShowRegistration) {
      const eventReg = await EventShowRegistration.findOne({ qrCodeData: hash });
      if (eventReg) return { kind: 'event', record: eventReg };
    }
  }

  if (candidateId) {
    if (EventShowRegistration) {
      const eventReg = await EventShowRegistration.findById(candidateId);
      if (eventReg) {
        if (!eventReg.qrCodeData && hash) {
          eventReg.qrCodeData = hash;
          await eventReg.save();
        }
        if (eventReg.qrCodeData) {
          if (hash && eventReg.qrCodeData !== hash) return null;
          return { kind: 'event', record: eventReg };
        }
      }
    }

    if (CategoryRegistration) {
      const sportsReg = await CategoryRegistration.findById(candidateId);
      if (sportsReg?.category === 'sports') {
        if (!sportsReg.qrCodeData && hash) {
          sportsReg.qrCodeData = hash;
          await sportsReg.save();
        }
        if (sportsReg.qrCodeData) {
          if (hash && sportsReg.qrCodeData !== hash) return null;
          return { kind: 'sports', record: sportsReg };
        }
      }
    }

    const registration = await Registration.findById(candidateId);
    if (registration) {
      if (!registration.qrCodeData && hash) {
        registration.qrCodeData = hash;
        await registration.save();
      }
      if (registration.qrCodeData) {
        if (hash && registration.qrCodeData !== hash) return null;
        return { kind: 'registration', record: registration };
      }
    }

    const trekBooking = await TrekBooking.findById(candidateId);
    if (trekBooking) {
      if (!trekBooking.qrCodeData && hash) {
        trekBooking.qrCodeData = hash;
        await trekBooking.save();
      }
      if (trekBooking.qrCodeData) {
        if (hash && trekBooking.qrCodeData !== hash) return null;
        return { kind: 'trek', record: trekBooking };
      }
    }
  }

  return null;
}

module.exports = {
  normalizeHash,
  parseQrPayload,
  extractHashFromQrPayload,
  resolveCheckinRecord,
};
