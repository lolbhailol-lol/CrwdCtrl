const IST = 'Asia/Kolkata'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const PLAN_HORIZON_DAYS = 6 // today + 6 = 7 days

/** Today's calendar date in Asia/Kolkata as YYYY-MM-DD */
export function todayIst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Add n calendar days to a YYYY-MM-DD string (IST-safe via noon UTC trick). */
export function addDaysIst(yyyyMmDd, n) {
  const [y, m, d] = String(yyyyMmDd).split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d + Number(n)))
  const yyyy = utc.getUTCFullYear()
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(utc.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function isValidDateString(value) {
  if (!DATE_RE.test(String(value || ''))) return false
  const [y, m, d] = value.split('-').map(Number)
  const check = new Date(Date.UTC(y, m - 1, d))
  return (
    check.getUTCFullYear() === y &&
    check.getUTCMonth() === m - 1 &&
    check.getUTCDate() === d
  )
}

/** Allowed plan dates: today … today+PLAN_HORIZON_DAYS (inclusive). */
export function isAllowedPlanDate(date) {
  if (!isValidDateString(date)) return false
  const start = todayIst()
  const end = addDaysIst(start, PLAN_HORIZON_DAYS)
  return date >= start && date <= end
}

/**
 * Resolve request date for board/check-ins.
 * Returns { ok, date, error }.
 */
export function resolvePlanDate(input) {
  if (input == null || input === '') {
    return { ok: true, date: todayIst() }
  }
  const date = String(input).trim()
  if (!isValidDateString(date)) {
    return { ok: false, error: 'date must be YYYY-MM-DD' }
  }
  if (!isAllowedPlanDate(date)) {
    return {
      ok: false,
      error: `date must be between today and +${PLAN_HORIZON_DAYS} days (IST)`,
    }
  }
  return { ok: true, date }
}

export function crowdLevelFromPeople(count) {
  if (count >= 120) return 'Very High'
  if (count >= 60) return 'High'
  if (count >= 20) return 'Moderate'
  if (count > 0) return 'Low'
  return null
}

export function isNewerThanHours(date, hours) {
  if (!date) return false
  const t = new Date(date).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t < hours * 60 * 60 * 1000
}
