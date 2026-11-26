import type { Action } from '../core/game'
import type { Draft } from '../core/types'

/** The action that adds `draft` right now, under a fresh id. Call it from event handlers only. */
export function addTaskAction(draft: Draft): Action {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  return { type: 'addTask', now: Date.now(), id, draft }
}
