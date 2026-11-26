// Cloud save for 任务大战僵尸. A sync code is the only credential: whoever has it can read and
// replace that save, so codes are long random strings and the key stored in KV is their hash.
//
//   GET /state  Authorization: Bearer <code>          -> 200 { savedAt, state } | 404
//   PUT /state  Authorization: Bearer <code>, body { savedAt, state }
//               -> 200 { savedAt }, or 409 with the stored { savedAt, state } when it is newer.

interface Env {
  STATES: {
    get(key: string): Promise<string | null>
    put(key: string, value: string): Promise<void>
  }
}

const MAX_BYTES = 1_000_000

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json',
}

function reply(body: string, status = 200): Response {
  return new Response(body, { status, headers: HEADERS })
}

function error(message: string, status: number): Response {
  return reply(JSON.stringify({ error: message }), status)
}

async function keyFor(request: Request): Promise<string | null> {
  const code = request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{20,100})$/)?.[1]
  if (!code) return null
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
  return `state:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS })
    if (new URL(request.url).pathname !== '/state') return error('not found', 404)
    const key = await keyFor(request)
    if (key === null) return error('missing or malformed sync code', 401)

    const stored = await env.STATES.get(key)
    if (request.method === 'GET') return stored === null ? error('no save yet', 404) : reply(stored)
    if (request.method !== 'PUT') return error('method not allowed', 405)

    const text = await request.text()
    if (text.length > MAX_BYTES) return error('save too large', 413)
    let body: { savedAt?: unknown; state?: unknown }
    try {
      body = JSON.parse(text)
    } catch {
      return error('body is not JSON', 400)
    }
    const { savedAt, state } = body
    if (typeof savedAt !== 'number' || typeof state !== 'object' || state === null) return error('expected { savedAt, state }', 400)

    // Last change wins: a device that was offline must not overwrite a newer save from another device.
    if (stored !== null && (JSON.parse(stored) as { savedAt: number }).savedAt > savedAt) return reply(stored, 409)
    await env.STATES.put(key, JSON.stringify({ savedAt, state }))
    return reply(JSON.stringify({ savedAt }))
  },
}
