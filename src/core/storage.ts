import { initialState, sanitizeSettings } from './game'
import { DEFAULT_SETTINGS, type GameState } from './types'

const KEY = 'pvz-todo:v1'

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return initialState()
    const saved = JSON.parse(raw)
    if (saved?.version !== 1 || !Array.isArray(saved.tasks) || !Array.isArray(saved.graves)) return initialState()
    return {
      ...initialState(),
      ...saved,
      settings: sanitizeSettings({ ...DEFAULT_SETTINGS, ...saved.settings }),
    }
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
