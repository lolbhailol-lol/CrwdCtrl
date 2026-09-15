/**
 * Admin datetime-local values have no timezone.
 * Always interpret them as Asia/Kolkata so IST editors don't accidentally
 * save times that look fine in the form but expire hours earlier in UTC.
 */

const IST_OFFSET = '+05:30';

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Format a Date for <input type="datetime-local" /> in Asia/Kolkata. */
function toIstDatetimeLocalValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/**
 * Parse admin form datetime.
 * @param {'start'|'end'} kind — end dates with midnight roll to 23:59:59.999 IST
 */
function parseAdminDateTime(value, kind = 'start') {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (!s) return null;

  if (/Z$|[+-]\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const time = kind === 'end' ? '23:59:59.999' : '00:00:00.000';
    return new Date(`${s}T${time}${IST_OFFSET}`);
  }

  // datetime-local: YYYY-MM-DDTHH:mm or with seconds
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const [, date, hh, mm, ss = '00'] = m;
    // Midnight on an "expires" field almost always means "that whole day"
    if (kind === 'end' && hh === '00' && mm === '00' && (ss === '00' || !m[4])) {
      return new Date(`${date}T23:59:59.999${IST_OFFSET}`);
    }
    return new Date(`${date}T${hh}:${mm}:${ss}${IST_OFFSET}`);
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isCouponExpired(expiresAt, now = new Date()) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < now.getTime();
}

function isCouponNotStarted(startsAt, now = new Date()) {
  if (!startsAt) return false;
  return new Date(startsAt).getTime() > now.getTime();
}

module.exports = {
  toIstDatetimeLocalValue,
  parseAdminDateTime,
  isCouponExpired,
  isCouponNotStarted,
  pad,
};
