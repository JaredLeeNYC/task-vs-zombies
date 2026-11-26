import { addDays, dayOf, isWorkday, weekStart, type Day } from './dates'
import type { Importance, Settings, Task } from './types'

export const HOUSE_HP = 100

/** Health one bite costs the house. */
export const BITE_DAMAGE: Record<Importance, number> = { 1: 5, 2: 10, 3: 15 }

export interface Bite {
  task: Task
  day: Day
  damage: number
}

export interface House {
  hp: number
  /** This week's bites, oldest first. */
  bites: Bite[]
}

/**
 * The house's health this week. A zombie that outlives its deadline bites once on every
 * working day after it, the day it is finally killed included. The house is repaired every Monday.
 */
export function assessHouse(tasks: readonly Task[], today: Day, workdays: readonly number[]): House {
  const bites: Bite[] = []
  for (let day = weekStart(today); day <= today; day = addDays(day, 1)) {
    if (!isWorkday(day, workdays)) continue
    for (const task of tasks) {
      const alive = task.createdOn <= day && (task.doneOn === null || task.doneOn >= day)
      if (alive && task.due !== null && task.due < day) bites.push({ task, day, damage: BITE_DAMAGE[task.importance] })
    }
  }
  const damage = bites.reduce((sum, bite) => sum + bite.damage, 0)
  return { hp: Math.max(0, HOUSE_HP - damage), bites }
}

/**
 * How much of the working day has passed at `now`, from 0 to 1. A day off counts as over,
 * so a zombie that reached the door on Friday evening stays there through the weekend.
 */
export function dayProgress(now: number, settings: Settings): number {
  const date = new Date(now)
  if (!isWorkday(dayOf(date), settings.workdays)) return 1
  const hour = date.getHours() + date.getMinutes() / 60
  const progress = (hour - settings.dayStartHour) / (settings.dayEndHour - settings.dayStartHour)
  return Math.min(1, Math.max(0, progress))
}
