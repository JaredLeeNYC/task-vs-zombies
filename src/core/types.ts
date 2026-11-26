import type { Day } from './dates'

export type Importance = 1 | 2 | 3

/** A piece of work: one zombie on the lawn. */
export interface Task {
  id: string
  title: string
  importance: Importance
  /** Estimated focus minutes: the zombie's full health. */
  effortMin: number
  /** Focus minutes spent on it, by day. */
  focus: Record<Day, number>
  due: Day | null
  /** Index into `Settings.lanes`. */
  lane: number
  createdOn: Day
  doneOn: Day | null
  /** The gravestone that raised it, for recurring work. */
  graveId: string | null
  /** The day the player forced it into the plan. */
  pinnedOn: Day | null
  /** The day the player froze it out of the plan. */
  skippedOn: Day | null
}

/** Recurring work: a gravestone that raises a zombie on the given weekdays. */
export interface Grave {
  id: string
  title: string
  importance: Importance
  effortMin: number
  lane: number
  /** 0 is Sunday. */
  weekdays: number[]
}

/** What the player enters to create a task, or a gravestone when `weekdays` is set. */
export interface Draft {
  title: string
  importance: Importance
  effortMin: number
  due: Day | null
  lane: number
  weekdays: number[] | null
}

export interface Settings {
  /** Focus minutes available per day: the daily sun. */
  focusMin: number
  pomodoroMin: number
  lanes: string[]
  /** 0 is Sunday. */
  workdays: number[]
  /** The working day runs from this hour to `dayEndHour`; zombies walk towards the house during it. */
  dayStartHour: number
  dayEndHour: number
  sound: boolean
}

export interface Focus {
  taskId: string
  /** Epoch milliseconds. */
  startedAt: number
  durationMin: number
}

/** What happened when a new day started, shown until the player dismisses it. */
export interface Briefing {
  previousDay: Day | null
  raisedIds: string[]
}

export interface GameState {
  version: 1
  tasks: Task[]
  graves: Grave[]
  settings: Settings
  lastOpenedOn: Day | null
  focus: Focus | null
  briefing: Briefing | null
}

export const LANE_COUNT = 5

export const DEFAULT_SETTINGS: Settings = {
  focusMin: 300,
  pomodoroMin: 25,
  lanes: ['主线', '会议沟通', '协作支持', '学习成长', '杂事'],
  workdays: [1, 2, 3, 4, 5],
  dayStartHour: 9,
  dayEndHour: 18,
  sound: true,
}
