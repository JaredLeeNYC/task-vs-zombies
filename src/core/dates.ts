/** A calendar day in the user's local time zone, formatted `YYYY-MM-DD`. */
export type Day = string

const MS_PER_DAY = 86_400_000

// Day arithmetic runs in UTC so daylight-saving shifts never add or drop a day.
function toUtc(day: Day): number {
  const [year, month, date] = day.split('-').map(Number)
  return Date.UTC(year, month - 1, date)
}

function fromUtc(ms: number): Day {
  return new Date(ms).toISOString().slice(0, 10)
}

export function dayOf(date: Date): Day {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function makeDay(year: number, month: number, date: number): Day | null {
  const ms = Date.UTC(year, month - 1, date)
  const utc = new Date(ms)
  const valid = utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === date
  return valid ? fromUtc(ms) : null
}

export function isDay(value: unknown): value is Day {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, date] = value.split('-').map(Number)
  return makeDay(year, month, date) === value
}

export function addDays(day: Day, count: number): Day {
  return fromUtc(toUtc(day) + count * MS_PER_DAY)
}

/** Calendar days from `from` to `to`; negative when `to` is earlier. */
export function diffDays(from: Day, to: Day): number {
  return Math.round((toUtc(to) - toUtc(from)) / MS_PER_DAY)
}

/** 0 is Sunday, 6 is Saturday. */
export function weekdayOf(day: Day): number {
  return new Date(toUtc(day)).getUTCDay()
}

/** The Monday that starts the week of `day`. */
export function weekStart(day: Day): Day {
  return addDays(day, -((weekdayOf(day) + 6) % 7))
}

export function isWorkday(day: Day, workdays: readonly number[]): boolean {
  return workdays.length === 0 || workdays.includes(weekdayOf(day))
}

/**
 * Working days left to finish something due on `due`, not counting today:
 * 0 means it must be done today, a negative number is working days overdue.
 * A deadline on a day off counts as the working day before it.
 */
export function workdaysLeft(today: Day, due: Day, workdays: readonly number[]): number {
  const span = diffDays(today, due)
  const step = span >= 0 ? 1 : -1
  let count = 0
  // Walk (today, due] forwards, or (due, today] backwards when overdue.
  for (let offset = step > 0 ? 1 : 0; step > 0 ? offset <= span : offset > span; offset += step) {
    if (isWorkday(addDays(today, offset), workdays)) count += step
  }
  return count
}
