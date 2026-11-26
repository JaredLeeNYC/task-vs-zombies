/** The sync worker in `worker/`. Without it the app keeps its save in this browser only. */
export const SYNC_URL: string | undefined = import.meta.env.VITE_SYNC_URL

const META_KEY = 'pvz-todo:sync'

/** What the cloud stores: the whole save and when the player last changed it. */
export interface Snapshot {
  savedAt: number
  state: unknown
}

export interface SyncMeta {
  code: string | null
  /** Epoch milliseconds of the last change by the player on this device, or of the cloud save it adopted. */
  savedAt: number
}

export function loadMeta(): SyncMeta {
  try {
    const meta = JSON.parse(localStorage.getItem(META_KEY) ?? 'null') as Partial<SyncMeta> | null
    return { code: typeof meta?.code === 'string' ? meta.code : null, savedAt: Number(meta?.savedAt) || 0 }
  } catch {
    return { code: null, savedAt: 0 }
  }
}

export function saveMeta(meta: SyncMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // Storage is full or blocked, as in saveState.
  }
}

/** 128 random bits, URL-safe. */
export function newSyncCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function isSyncCode(code: string): boolean {
  return /^[A-Za-z0-9_-]{20,100}$/.test(code)
}

async function request(code: string, init?: RequestInit): Promise<Response> {
  if (!SYNC_URL) throw new Error('云同步没有配置')
  const headers = { Authorization: `Bearer ${code}`, 'Content-Type': 'application/json' }
  return fetch(`${SYNC_URL}/state`, { ...init, headers })
}

/** The cloud save, or null when this code has none yet. */
export async function pullSnapshot(code: string): Promise<Snapshot | null> {
  const response = await request(code)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`云端返回 ${response.status}`)
  return response.json()
}

/** Uploads the save; when the cloud holds a newer one, returns that instead. */
export async function pushSnapshot(code: string, snapshot: Snapshot): Promise<Snapshot | null> {
  const response = await request(code, { method: 'PUT', body: JSON.stringify(snapshot) })
  if (response.status === 409) return response.json()
  if (!response.ok) throw new Error(`云端返回 ${response.status}`)
  return null
}
