import { initialState, sanitizeSettings } from './game'
import { DEFAULT_SETTINGS, type GameState } from './types'

const KEY = 'pvz-todo:v1'

/** A save from localStorage, a cloud save, or an imported file, or null when it is not one. */
export function parseState(saved: unknown): GameState | null {
  const candidate = saved as Partial<GameState> | null
  if (candidate?.version !== 1 || !Array.isArray(candidate.tasks) || !Array.isArray(candidate.graves)) return null
  return {
    ...initialState(),
    ...candidate,
    settings: sanitizeSettings({ ...DEFAULT_SETTINGS, ...candidate.settings }),
  }
}

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(KEY)
    return (raw !== null && parseState(JSON.parse(raw))) || initialState()
  } catch {
    return initialState()
  }
}

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Storage is full or blocked: the game keeps running in memory.
  }
}
