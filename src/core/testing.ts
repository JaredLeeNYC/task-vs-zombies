import type { Task } from './types'

/** A task for tests: an ordinary 30-minute zombie created on Monday 2026-11-23. */
export function makeTestTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: overrides.id,
    importance: 2,
    effortMin: 30,
    focus: {},
    due: null,
    lane: 0,
    createdOn: '2026-11-23',
    doneOn: null,
    graveId: null,
    pinnedOn: null,
    skippedOn: null,
    ...overrides,
  }
}
