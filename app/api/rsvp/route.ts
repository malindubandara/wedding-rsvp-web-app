import { createHash } from 'node:crypto'
import { REPLY_KEY_PATTERN, validateRsvpFields, type RsvpApiResponse } from '@/lib/rsvp'

export const runtime = 'nodejs'
export const maxDuration = 30

function json(data: RsvpApiResponse, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

const scriptFailureHints = {
  CONFIGURATION_ERROR: 'Set SPREADSHEET_ID and RSVP_SECRET in Apps Script properties.',
  UNAUTHORIZED: 'The Apps Script RSVP_SECRET must match GOOGLE_APPS_SCRIPT_SECRET.',
  INVALID_REQUEST: 'Redeploy the current Code.gs as a new Apps Script version.',
  SHEET_ACCESS_ERROR: 'Run initializeRsvpSheet as the Sheet owner and check SPREADSHEET_ID.',
  SHEET_HEADERS_MISMATCH: 'The target tab has incompatible headers. Use a new empty tab via SHEET_NAME and run initializeRsvpSheet.',
  SAVE_FAILED: 'Run initializeRsvpSheet and check Apps Script Executions for the Sheet error.',
  SCRIPT_HTTP_ERROR: 'Check the Apps Script web app deployment URL and access settings.',
  SCRIPT_DEPLOYMENT_ERROR: 'The web app did not return JSON. Deploy as Me with access Anyone and use the /exec URL.',
  UNEXPECTED_SCRIPT_RESPONSE: 'Redeploy the current Code.gs and check the Apps Script deployment URL.',
} as const

function scriptFailure(code: unknown) {
  const safeCode = typeof code === 'string' && Object.prototype.hasOwnProperty.call(scriptFailureHints, code)
    ? code as keyof typeof scriptFailureHints
    : 'UNEXPECTED_SCRIPT_RESPONSE'
  // Only known codes and static guidance go into logs, never upstream text.
  console.error(`RSVP Apps Script ${safeCode}: ${scriptFailureHints[safeCode]}`)
  return json({ ok: false, message: "We couldn't save your reply. Please try again in a moment.", code: safeCode }, 502)
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return json({ ok: false, message: 'Please send your reply from our invitation page.' }, 403)
  }
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return json({ ok: false, message: 'Please refresh the invitation and try again.' }, 415)
  }
  if (Number(request.headers.get('content-length')) > 16384) {
    return json({ ok: false, message: 'Your reply is too long. Please shorten your note.' }, 413)
  }

  let input: Record<string, unknown>
  try {
    const text = await request.text()
    if (Buffer.byteLength(text, 'utf8') > 16384) {
      return json({ ok: false, message: 'Your reply is too long. Please shorten your note.' }, 413)
    }
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid body')
    input = parsed as Record<string, unknown>
  } catch {
    return json({ ok: false, message: 'Please refresh the invitation and try again.' }, 400)
  }

  const validation = validateRsvpFields(input)
  if (!validation.ok) {
    return json({ ok: false, message: 'Please check the highlighted details.', fieldErrors: validation.fieldErrors }, 400)
  }
  if (typeof input.replyKey !== 'string' || !REPLY_KEY_PATTERN.test(input.replyKey)) {
    return json({ ok: false, message: 'Please refresh the invitation and try again.' }, 400)
  }

  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL?.trim()
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET?.trim()
  // Only the deployed Google endpoint may receive the server-side secret.
  if (!scriptUrl || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(scriptUrl) || !secret || secret.length < 32) {
    console.error('RSVP Apps Script configuration is missing or invalid.')
    return json({ ok: false, message: 'RSVPs are temporarily unavailable. Please try again later.' }, 503)
  }

  try {
    const upstream = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        replyId: createHash('sha256').update(input.replyKey).digest('hex'),
        ...validation.data,
      }),
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    })
    if (!upstream.ok) return scriptFailure('SCRIPT_HTTP_ERROR')
    // Apps Script ContentService returns application errors in a JSON envelope.
    let result: unknown
    try { result = await upstream.json() }
    catch { return scriptFailure('SCRIPT_DEPLOYMENT_ERROR') }
    if (result && typeof result === 'object') {
      const response = result as Record<string, unknown>
      if (response.ok === true && (response.action === 'created' || response.action === 'updated')) {
        return json({ ok: true, action: response.action })
      }
      if (response.ok === false && response.code === 'BUSY') {
        return json({ ok: false, message: 'A few replies are arriving together. Please try again in a moment.' }, 503)
      }
      if (response.ok === false) return scriptFailure(response.code)
    }
    return scriptFailure('UNEXPECTED_SCRIPT_RESPONSE')
  } catch (error) {
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    // Never log the request body, reply key, Google response, or shared secret.
    console.error(timeout ? 'RSVP Apps Script request timed out.' : 'RSVP Apps Script save failed.')
    return json({ ok: false, message: timeout
      ? "We couldn't confirm your reply was saved. Please try again."
      : "We couldn't save your reply. Please try again in a moment." }, timeout ? 504 : 502)
  }
}
