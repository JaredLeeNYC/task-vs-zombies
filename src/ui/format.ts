import { diffDays, weekdayOf, type Day } from '../core/dates'
import type { Threat } from '../core/plan'
import type { Importance } from '../core/types'

export const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export const ZOMBIE_NAMES: Record<Importance, string> = { 1: '普通僵尸', 2: '路障僵尸', 3: '铁桶僵尸' }
export const IMPORTANCE_NAMES: Record<Importance, string> = { 1: '低', 2: '中', 3: '高' }

const RELATIVE_NAMES: Record<number, string> = { [-1]: '昨天', 0: '今天', 1: '明天', 2: '后天' }

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`
  const rest = minutes % 60
  return rest === 0 ? `${minutes / 60} 小时` : `${Math.floor(minutes / 60)} 小时 ${rest} 分`
}

export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function formatDay(day: Day, today: Day): string {
  const relative = RELATIVE_NAMES[diffDays(today, day)]
  if (relative) return relative
  const [, month, date] = day.split('-').map(Number)
  return `${month}/${date} ${WEEKDAY_NAMES[weekdayOf(day)]}`
}

export function formatLongDay(day: Day): string {
  const [, month, date] = day.split('-').map(Number)
  return `${month}月${date}日 ${WEEKDAY_NAMES[weekdayOf(day)]}`
}

export function formatWeekdays(weekdays: readonly number[]): string {
  if (weekdays.length === 7) return '每天'
  // Monday first, Sunday last.
  const ordered = [...weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  return `每周${ordered.map((day) => WEEKDAY_NAMES[day][1]).join('')}`
}

export function deadlineLabel({ task, left, mustToday }: Threat, today: Day): string {
  if (task.due === null || left === null) return '无截止'
  if (left < 0) return `逾期 ${-left} 个工作日`
  const label = `${formatDay(task.due, today)}到期`
  return mustToday && left > 0 ? `${label}·量大今天得开工` : label
}

export function deadlineTone({ mustToday, slack }: Threat): 'danger' | 'warn' | 'calm' {
  return mustToday ? 'danger' : slack <= 2 ? 'warn' : 'calm'
}
