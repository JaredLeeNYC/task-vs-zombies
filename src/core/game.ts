import { dayOf, weekdayOf, type Day } from './dates'
import { DEFAULT_SETTINGS, type Draft, type GameState, type Grave, type Settings, type Task } from './types'

export type TaskPatch = Partial<Pick<Task, 'title' | 'importance' | 'effortMin' | 'due' | 'lane'>>

/** `now` is epoch milliseconds; the day an action happens on is derived from it. */
export type Action =
  | { type: 'startDay'; now: number }
  | { type: 'addTask'; now: number; id: string; draft: Draft }
  | { type: 'editTask'; id: string; patch: TaskPatch }
  | { type: 'deleteTask'; id: string }
  | { type: 'killTask'; now: number; id: string }
  | { type: 'reviveTask'; id: string }
  | { type: 'pinTask'; now: number; id: string }
  | { type: 'skipTask'; now: number; id: string }
  | { type: 'startFocus'; now: number; taskId: string; durationMin: number }
  | { type: 'stopFocus'; now: number }
  | { type: 'deleteGrave'; id: string }
  | { type: 'dismissBriefing' }
  | { type: 'updateSettings'; patch: Partial<Settings> }

export function initialState(): GameState {
  return {
    version: 1,
    tasks: [],
    graves: [],
    settings: DEFAULT_SETTINGS,
    lastOpenedOn: null,
    focus: null,
    briefing: null,
  }
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback
}

function clampEffort(minutes: number): number {
  return clamp(minutes, 5, 2400, 30)
}

export function sanitizeSettings(settings: Settings): Settings {
  const workdays = [...new Set(settings.workdays)].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  const dayStartHour = clamp(settings.dayStartHour, 0, 23, DEFAULT_SETTINGS.dayStartHour)
  return {
    focusMin: clamp(settings.focusMin, 30, 900, DEFAULT_SETTINGS.focusMin),
    pomodoroMin: clamp(settings.pomodoroMin, 5, 120, DEFAULT_SETTINGS.pomodoroMin),
    lanes: DEFAULT_SETTINGS.lanes.map((name, index) => settings.lanes[index]?.trim() || name),
    workdays: workdays.length > 0 ? workdays.sort() : DEFAULT_SETTINGS.workdays,
    dayStartHour,
    dayEndHour: Math.max(dayStartHour + 1, clamp(settings.dayEndHour, 1, 24, DEFAULT_SETTINGS.dayEndHour)),
    sound: Boolean(settings.sound),
  }
}

function mapTask(tasks: Task[], id: string, change: (task: Task) => Task): Task[] {
  return tasks.map((task) => (task.id === id ? change(task) : task))
}

function makeTask(source: Omit<Draft, 'weekdays'>, id: string, today: Day, graveId: string | null): Task {
  return {
    id,
    title: source.title.trim(),
    importance: source.importance,
    effortMin: clampEffort(source.effortMin),
    focus: {},
    due: source.due,
    lane: source.lane,
    createdOn: today,
    doneOn: null,
    graveId,
    pinnedOn: null,
    skippedOn: null,
  }
}

/**
 * Raises today's zombie from every gravestone scheduled for today. A grave
 * whose last zombie is still walking raises nothing: that one is overdue
 * instead of doubled.
 */
function raiseFromGraves(tasks: Task[], graves: Grave[], today: Day): { tasks: Task[]; raisedIds: string[] } {
  const raised: Task[] = []
  for (const grave of graves) {
    const id = `${grave.id}@${today}`
    const scheduled = grave.weekdays.includes(weekdayOf(today))
    const blocked = tasks.some((task) => task.id === id || (task.graveId === grave.id && task.doneOn === null))
    if (scheduled && !blocked) raised.push(makeTask({ ...grave, due: today }, id, today, grave.id))
  }
  return { tasks: [...tasks, ...raised], raisedIds: raised.map((task) => task.id) }
}

/** Ends the running focus session and credits its minutes to the day it started on. */
function settleFocus(state: GameState, now: number): GameState {
  const { focus } = state
  if (!focus) return state
  const elapsedMin = Math.floor((now - focus.startedAt) / 60_000)
  const minutes = Math.max(0, Math.min(elapsedMin, focus.durationMin))
  const day = dayOf(new Date(focus.startedAt))
  const tasks =
    minutes === 0
      ? state.tasks
      : mapTask(state.tasks, focus.taskId, (task) => ({
          ...task,
          focus: { ...task.focus, [day]: (task.focus[day] ?? 0) + minutes },
        }))
  return { ...state, tasks, focus: null }
}

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'startDay': {
      const today = dayOf(new Date(action.now))
      if (state.lastOpenedOn === today) return state
      const { tasks, raisedIds } = raiseFromGraves(state.tasks, state.graves, today)
      return { ...state, tasks, lastOpenedOn: today, briefing: { previousDay: state.lastOpenedOn, raisedIds } }
    }

    case 'addTask': {
      const today = dayOf(new Date(action.now))
      const { draft, id } = action
      if (draft.title.trim() === '') return state
      if (draft.weekdays === null) return { ...state, tasks: [...state.tasks, makeTask(draft, id, today, null)] }

      const grave: Grave = {
        id,
        title: draft.title.trim(),
        importance: draft.importance,
        effortMin: clampEffort(draft.effortMin),
        lane: draft.lane,
        weekdays: draft.weekdays,
      }
      const graves = [...state.graves, grave]
      return { ...state, graves, tasks: raiseFromGraves(state.tasks, [grave], today).tasks }
    }

    case 'editTask': {
      const { patch } = action
      return {
        ...state,
        tasks: mapTask(state.tasks, action.id, (task) => ({
          ...task,
          ...patch,
          title: patch.title?.trim() || task.title,
          effortMin: patch.effortMin === undefined ? task.effortMin : clampEffort(patch.effortMin),
        })),
      }
    }

    case 'deleteTask':
      return {
        ...state,
        tasks: state.tasks.filter((task) => task.id !== action.id),
        focus: state.focus?.taskId === action.id ? null : state.focus,
      }

    case 'killTask': {
      const settled = state.focus?.taskId === action.id ? settleFocus(state, action.now) : state
      const today = dayOf(new Date(action.now))
      return { ...settled, tasks: mapTask(settled.tasks, action.id, (task) => ({ ...task, doneOn: today })) }
    }

    case 'reviveTask':
      return { ...state, tasks: mapTask(state.tasks, action.id, (task) => ({ ...task, doneOn: null })) }

    case 'pinTask': {
      const today = dayOf(new Date(action.now))
      return {
        ...state,
        tasks: mapTask(state.tasks, action.id, (task) => ({
          ...task,
          pinnedOn: task.pinnedOn === today ? null : today,
          skippedOn: null,
        })),
      }
    }

    case 'skipTask': {
      const today = dayOf(new Date(action.now))
      const settled = state.focus?.taskId === action.id ? settleFocus(state, action.now) : state
      return {
        ...settled,
        tasks: mapTask(settled.tasks, action.id, (task) => ({
          ...task,
          skippedOn: task.skippedOn === today ? null : today,
          pinnedOn: null,
        })),
      }
    }

    case 'startFocus': {
      const settled = settleFocus(state, action.now)
      const target = settled.tasks.find((task) => task.id === action.taskId)
      if (!target || target.doneOn !== null) return settled
      return {
        ...settled,
        focus: { taskId: action.taskId, startedAt: action.now, durationMin: clamp(action.durationMin, 1, 240, 25) },
      }
    }

    case 'stopFocus':
      return settleFocus(state, action.now)

    case 'deleteGrave':
      return {
        ...state,
        graves: state.graves.filter((grave) => grave.id !== action.id),
        tasks: state.tasks.map((task) => (task.graveId === action.id ? { ...task, graveId: null } : task)),
      }

    case 'dismissBriefing':
      return { ...state, briefing: null }

    case 'updateSettings':
      return { ...state, settings: sanitizeSettings({ ...state.settings, ...action.patch }) }
  }
}
