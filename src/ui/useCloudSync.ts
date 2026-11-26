import { useCallback, useEffect, useRef, useState } from 'react'
import type { Action } from '../core/game'
import { parseState } from '../core/storage'
import { loadMeta, pullSnapshot, pushSnapshot, saveMeta, SYNC_URL, type Snapshot } from '../core/sync'
import type { GameState } from '../core/types'

const PUSH_DELAY_MS = 1500

export type SyncStatus = { kind: 'off' } | { kind: 'syncing' } | { kind: 'synced'; at: number } | { kind: 'error'; message: string }

/**
 * Keeps the save in step with the cloud when a sync code is set. The newer save wins, judged by when the
 * player last changed it; `markChanged` records such a change, so automatic updates such as a new day
 * starting never overwrite another device's work.
 */
export function useCloudSync(state: GameState, dispatch: (action: Action) => void) {
  const [initialMeta] = useState(loadMeta)
  const meta = useRef(initialMeta)
  const latest = useRef(state)
  useEffect(() => {
    latest.current = state
  }, [state])
  const [code, setCodeState] = useState(initialMeta.code)
  const [status, setStatus] = useState<SyncStatus>({ kind: 'syncing' })
  const pending = useRef(false)

  const adopt = useCallback(
    (snapshot: Snapshot) => {
      const remote = parseState(snapshot.state)
      if (remote === null) throw new Error('云端存档格式不对')
      meta.current = { ...meta.current, savedAt: snapshot.savedAt }
      saveMeta(meta.current)
      dispatch({ type: 'loadState', state: remote })
      dispatch({ type: 'startDay', now: Date.now() })
    },
    [dispatch],
  )

  const sync = useCallback(async () => {
    const current = meta.current.code
    if (!SYNC_URL || current === null) return
    try {
      pending.current = false
      const pulling = pullSnapshot(current)
      setStatus({ kind: 'syncing' })
      const remote = await pulling
      if (remote !== null && remote.savedAt > meta.current.savedAt) {
        adopt(remote)
      } else if (remote === null || remote.savedAt < meta.current.savedAt) {
        const newer = await pushSnapshot(current, { savedAt: meta.current.savedAt, state: latest.current })
        if (newer !== null) adopt(newer)
      }
      setStatus({ kind: 'synced', at: Date.now() })
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }, [adopt])

  const markChanged = useCallback(() => {
    meta.current = { ...meta.current, savedAt: Date.now() }
    saveMeta(meta.current)
    pending.current = true
  }, [])

  /**
   * `fresh` is true for a code just created on this device, whose save then goes up. A code typed in from
   * another device starts from "nothing changed here yet", so the cloud save comes down instead.
   */
  const setCode = useCallback((next: string | null, fresh = false) => {
    const savedAt = next === null ? meta.current.savedAt : fresh ? Date.now() : 0
    meta.current = { code: next, savedAt }
    saveMeta(meta.current)
    setCodeState(next)
  }, [])

  // Pull on start, when the code changes, and whenever the tab comes back.
  useEffect(() => {
    void sync()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [code, sync])

  // Push a little after the player stops changing things.
  useEffect(() => {
    if (!pending.current || code === null) return
    const timer = setTimeout(() => void sync(), PUSH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [state, code, sync])

  return {
    enabled: Boolean(SYNC_URL),
    code,
    setCode,
    status: SYNC_URL && code !== null ? status : ({ kind: 'off' } as SyncStatus),
    markChanged,
    syncNow: sync,
  }
}
