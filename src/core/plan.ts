import { addDays, isWorkday, workdaysLeft, type Day } from './dates'
import type { Importance, Settings, Task } from './types'

/** Health left on a zombie that has outlived its estimate. */
const OVERTIME_MIN = 15
/** The plan never opens a slot when less sun than this is left. */
const MIN_SLOT_MIN = 10
/** Work without a deadline starts this many working days out and creeps closer as it ages. */
const NO_DUE_FAR = 9
const NO_DUE_NEAR = 3
const WEIGHT: Record<Importance, number> = { 1: 1, 2: 2, 3: 3 }
/** Lifts everything that must be touched today above everything that can wait. */
const MUST_TODAY_BONUS = 100

export function spentMin(task: Task): number {
  return Object.values(task.focus).reduce((sum, minutes) => sum + minutes, 0)
}

export function spentOn(task: Task, day: Day): number {
  return task.focus[day] ?? 0
}

/** How dangerous a task is today. */
export interface Threat {
  task: Task
  /** Working days until the deadline; null without one. */
  left: number | null
  /** Working days until work on it has to start: 0 is today, negative is too late. */
  slack: number
  /** Health left when today started. */
  remainingMin: number
  /** Minutes it should get today to stay on track. */
  shareMin: number
  mustToday: boolean
  score: number
}

function roundUpTo5(minutes: number): number {
  return Math.ceil(minutes / 5) * 5
}

function shareOf(remainingMin: number, left: number | null, settings: Settings): number {
  if (left === null) return Math.min(remainingMin, 2 * settings.pomodoroMin)
  if (left <= 0) return remainingMin
  const evenSplit = roundUpTo5(remainingMin / (left + 1))
  return Math.min(remainingMin, Math.max(evenSplit, settings.pomodoroMin))
}

export function assess(task: Task, today: Day, settings: Settings): Threat {
  const spentBefore = spentMin(task) - spentOn(task, today)
  const remainingMin = spentBefore < task.effortMin ? task.effortMin - spentBefore : OVERTIME_MIN
  const left = task.due === null ? null : workdaysLeft(today, task.due, settings.workdays)

  let slack: number
  if (left === null) {
    const ageWorkdays = -workdaysLeft(today, task.createdOn, settings.workdays)
    slack = Math.max(NO_DUE_NEAR, NO_DUE_FAR - ageWorkdays)
  } else {
    // A job bigger than one day of sun has to start before its deadline day.
    slack = left - (Math.ceil(remainingMin / settings.focusMin) - 1)
  }

  const mustToday = slack <= 0
  const urgency = slack < 0 ? 8 + 2 * Math.min(-slack, 4) : 8 / (slack + 1)
  return {
    task,
    left,
    slack,
    remainingMin,
    shareMin: shareOf(remainingMin, left, settings),
    mustToday,
    score: (mustToday ? MUST_TODAY_BONUS : 0) + WEIGHT[task.importance] * urgency,
  }
}

function byThreat(a: Threat, b: Threat): number {
  return (
    b.score - a.score ||
    (a.task.due ?? '9999').localeCompare(b.task.due ?? '9999') ||
    a.task.createdOn.localeCompare(b.task.createdOn) ||
    a.task.id.localeCompare(b.task.id)
  )
}

export interface PlanEntry extends Threat {
  plannedMin: number
  spentTodayMin: number
  done: boolean
  /** Today's share is finished, whether or not the zombie is dead. */
  cleared: boolean
}

export interface Plan {
  /** Today's targets: open ones first in attack order, finished ones last. */
  entries: PlanEntry[]
  /** Open tasks that did not fit into today's sun, most dangerous first. */
  later: Threat[]
  /** Tasks the player froze for today. */
  frozen: Threat[]
  /** Tasks that must be touched today but get less sun than they need. */
  breached: Threat[]
  sunTotalMin: number
  sunPlannedMin: number
  sunUsedMin: number
}

/**
 * Today's plan: everything already worked on, killed, or pinned today stays in,
 * then the most dangerous remaining tasks fill the sun that is left.
 */
export function buildPlan(tasks: readonly Task[], settings: Settings, today: Day): Plan {
  const threats = tasks
    .filter((task) => task.doneOn === null || task.doneOn === today)
    .map((task) => assess(task, today, settings))
    .sort(byThreat)

  const isFrozen = ({ task }: Threat) => task.doneOn === null && task.skippedOn === today
  const isCommitted = ({ task }: Threat) =>
    task.doneOn !== null || spentOn(task, today) > 0 || task.pinnedOn === today

  const frozen = threats.filter(isFrozen)
  const candidates = threats.filter((threat) => !isFrozen(threat))
  const frozenSpentMin = frozen.reduce((sum, { task }) => sum + spentOn(task, today), 0)
  let budgetMin = settings.focusMin - frozenSpentMin

  const entries: PlanEntry[] = []
  for (const threat of candidates.filter(isCommitted)) {
    const spentTodayMin = spentOn(threat.task, today)
    const done = threat.task.doneOn !== null
    // A kill without the timer still cost the time the task was planned to take.
    const plannedMin = done && spentTodayMin > 0 ? spentTodayMin : Math.max(threat.shareMin, spentTodayMin)
    budgetMin -= plannedMin
    entries.push({ ...threat, plannedMin, spentTodayMin, done, cleared: done || spentTodayMin >= plannedMin })
  }

  const later: Threat[] = []
  for (const threat of candidates.filter((candidate) => !isCommitted(candidate))) {
    if (budgetMin < MIN_SLOT_MIN) {
      later.push(threat)
      continue
    }
    const plannedMin = Math.min(threat.shareMin, budgetMin)
    budgetMin -= plannedMin
    entries.push({ ...threat, plannedMin, spentTodayMin: 0, done: false, cleared: false })
  }

  const rank = (entry: PlanEntry) => (entry.done ? 2 : entry.cleared ? 1 : 0)
  entries.sort((a, b) => rank(a) - rank(b) || byThreat(a, b))

  return {
    entries,
    later,
    frozen,
    breached: [...entries.filter((entry) => !entry.done && entry.plannedMin < entry.shareMin), ...later, ...frozen].filter(
      (threat) => threat.mustToday,
    ),
    sunTotalMin: settings.focusMin,
    sunPlannedMin: entries.reduce((sum, entry) => sum + entry.plannedMin, 0),
    sunUsedMin:
      frozenSpentMin + entries.reduce((sum, entry) => sum + (entry.done ? entry.plannedMin : entry.spentTodayMin), 0),
  }
}

export interface Activity {
  focusMin: number
  kills: number
}

export function activityOn(tasks: readonly Task[], day: Day): Activity {
  return {
    focusMin: tasks.reduce((sum, task) => sum + spentOn(task, day), 0),
    kills: tasks.filter((task) => task.doneOn === day).length,
  }
}

/**
 * Consecutive working days, ending today, with a kill or focus time.
 * Days off never break the streak, and neither does a today that has not started yet.
 */
export function streak(tasks: readonly Task[], today: Day, workdays: readonly number[]): number {
  const activeDays = new Set<Day>()
  for (const task of tasks) {
    if (task.doneOn !== null) activeDays.add(task.doneOn)
    for (const [day, minutes] of Object.entries(task.focus)) {
      if (minutes > 0) activeDays.add(day)
    }
  }
  if (activeDays.size === 0) return 0

  const earliest = [...activeDays].sort()[0]
  let count = 0
  for (let day = today; day >= earliest; day = addDays(day, -1)) {
    if (activeDays.has(day)) count += 1
    else if (day !== today && isWorkday(day, workdays)) break
  }
  return count
}
