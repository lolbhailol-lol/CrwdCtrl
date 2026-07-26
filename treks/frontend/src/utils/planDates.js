const IST = 'Asia/Kolkata'
export const PLAN_HORIZON_DAYS = 6

export function todayIst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function addDaysIst(yyyyMmDd, n) {
  const [y, m, d] = String(yyyyMmDd).split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d + Number(n)))
  const yyyy = utc.getUTCFullYear()
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(utc.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Parse YYYY-MM-DD as noon IST-ish for weekday labels */
function partsForLabel(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  // Use UTC noon so weekday matches IST calendar day for India
  return new Date(Date.UTC(y, m - 1, d, 6, 30))
}

/**
 * Build 7 plan days: Today + next 6.
 * @returns {{ date: string, label: string, weekday: string, isToday: boolean, isTomorrow: boolean }[]}
 */
export function buildPlanDays(fromDate = todayIst()) {
  const today = todayIst()
  const start = fromDate || today
  const days = []

  for (let i = 0; i <= PLAN_HORIZON_DAYS; i += 1) {
    const date = addDaysIst(start, i)
    const dt = partsForLabel(date)
    const weekday = new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(dt)
    const dayNum = new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      timeZone: 'UTC',
    }).format(dt)

    const isToday = date === today
    const isTomorrow = date === addDaysIst(today, 1)

    let label = `${weekday} ${dayNum}`
    if (isToday) label = 'Today'
    else if (isTomorrow) label = 'Tomorrow'

    days.push({ date, label, weekday, dayNum, isToday, isTomorrow })
  }

  return days
}

export function labelForDate(date, planDays = buildPlanDays()) {
  const hit = planDays.find((d) => d.date === date)
  if (hit) return hit.label
  return date
}
