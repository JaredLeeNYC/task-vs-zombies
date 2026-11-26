import { addDays, makeDay, weekStart, type Day } from './dates'
import type { Draft, Importance, Settings } from './types'

/** The fields a quick-add line set explicitly; the rest keep the form's values. */
export type QuickAdd = Partial<Omit<Draft, 'title'>> & { title: string }

const WEEKDAY: Record<string, number> = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 }
const RELATIVE_DAY: Record<string, number> = { 今天: 0, 今日: 0, 明天: 1, 明日: 1, 后天: 2, 大后天: 3 }

function parseImportance(token: string): Importance | null {
  const match = /^[!！](?:([123])|[!！]{0,2})$/.exec(token)
  if (!match) return null
  return (match[1] ? Number(match[1]) : [...token].length) as Importance
}

function parseEffort(token: string): number | null {
  const match = /^(\d+(?:\.\d+)?)(m|min|分钟|分|h|小时)$/i.exec(token)
  if (!match) return null
  const unit = match[2].toLowerCase()
  const minutes = Number(match[1]) * (unit === 'h' || unit === '小时' ? 60 : 1)
  return minutes >= 1 ? Math.round(minutes) : null
}

function parseLane(token: string, lanes: readonly string[]): number | null {
  const match = /^[#＃](.+)$/.exec(token)
  if (!match) return null
  const number = Number(match[1])
  if (Number.isInteger(number) && number >= 1 && number <= lanes.length) return number - 1
  const index = lanes.findIndex((lane) => lane.includes(match[1]))
  return index === -1 ? null : index
}

function parseDue(token: string, today: Day): Day | null {
  const text = token.replace(/^[@＠]/, '')
  if (text in RELATIVE_DAY) return addDays(today, RELATIVE_DAY[text])

  const offset = /^(?:\+(\d+)d|(\d+)天后)$/i.exec(text)
  if (offset) return addDays(today, Number(offset[1] ?? offset[2]))

  const weekday = /^(下)?本?(?:周|星期|礼拜)([一二三四五六日天])$/.exec(text)
  if (weekday) {
    const day = addDays(weekStart(today), ((WEEKDAY[weekday[2]] + 6) % 7) + (weekday[1] ? 7 : 0))
    return !weekday[1] && day < today ? addDays(day, 7) : day
  }

  const date = /^(?:(\d{4})[-/])?(\d{1,2})[-/](\d{1,2})$/.exec(text) ?? /^(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]?$/.exec(text)
  if (date) {
    const [month, dayOfMonth] = [Number(date[2]), Number(date[3])]
    if (date[1]) return makeDay(Number(date[1]), month, dayOfMonth)
    const year = Number(today.slice(0, 4))
    const thisYear = makeDay(year, month, dayOfMonth)
    // A date without a year that has already passed means next year's.
    return thisYear !== null && thisYear < today ? makeDay(year + 1, month, dayOfMonth) : thisYear
  }
  return null
}

function parseWeekdays(token: string, workdays: readonly number[]): number[] | null {
  if (/^每[天日]$/.test(token)) return [0, 1, 2, 3, 4, 5, 6]
  if (/^每个?工作日$/.test(token)) return [...workdays]
  const match = /^每(?:周|星期)([一二三四五六日天]+)$/.exec(token)
  if (!match) return null
  return [...new Set([...match[1]].map((char) => WEEKDAY[char]))].sort()
}

/**
 * Reads a line such as `写周报 !3 45m 周五 #会议`. A marker counts only as a
 * whole space-separated word, so `准备周五的演示` stays a plain title; the
 * first marker of each kind wins and everything else is the title.
 */
export function parseQuickAdd(input: string, today: Day, settings: Settings): QuickAdd {
  const result: QuickAdd = { title: '' }
  const titleWords: string[] = []

  for (const token of input.trim().split(/\s+/).filter(Boolean)) {
    const importance = result.importance === undefined ? parseImportance(token) : null
    const effortMin = result.effortMin === undefined ? parseEffort(token) : null
    const lane = result.lane === undefined ? parseLane(token, settings.lanes) : null
    const weekdays = result.weekdays === undefined ? parseWeekdays(token, settings.workdays) : null
    const due = result.due === undefined ? parseDue(token, today) : null

    if (importance !== null) result.importance = importance
    else if (effortMin !== null) result.effortMin = effortMin
    else if (lane !== null) result.lane = lane
    else if (weekdays !== null) result.weekdays = weekdays
    else if (due !== null) result.due = due
    else titleWords.push(token)
  }

  result.title = titleWords.join(' ')
  return result
}
