const test = require('node:test')
const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { loadTs } = require('./load-ts.cjs')

const secret = 'test-only-secret-'.repeat(4)
const env = { GOOGLE_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/test-deployment/exec', GOOGLE_APPS_SCRIPT_SECRET: secret }
const reply = { name: ' Test Guest ', attendance: 'accepted', guests: 2, notes: '=SUM(1,2)', replyKey: 'a'.repeat(64) }
const request = (body = reply, headers = {}) => new Request('http://localhost:3000/api/rsvp', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
})
function route(fetch, environment = env) {
  return loadTs('app/api/rsvp/route.ts', { fetch, process: { env: environment } }).POST
}

test('forwards normalized replies with a hashed edit key and server-only secret', async () => {
  let outgoing
  const post = route(async (url, options) => { outgoing = { url, options }; return Response.json({ ok: true, action: 'created' }) })
  const result = await post(request())
  assert.equal(result.status, 200)
  assert.equal(result.headers.get('Cache-Control'), 'no-store')
  assert.deepEqual(await result.json(), { ok: true, action: 'created' })
  const body = JSON.parse(outgoing.options.body)
  assert.equal(body.secret, secret)
  assert.equal(body.replyId, createHash('sha256').update(reply.replyKey).digest('hex'))
  assert.equal(body.replyKey, undefined)
  assert.equal(body.name, 'Test Guest')
  assert.equal(outgoing.options.redirect, 'follow')
})

test('edits use the same hashed identity and return the update acknowledgement', async () => {
  const ids = []
  const post = route(async (_, options) => { ids.push(JSON.parse(options.body).replyId); return Response.json({ ok: true, action: 'updated' }) })
  for (const name of ['Guest', 'Renamed Guest']) assert.equal((await (await post(request({ ...reply, name }))).json()).action, 'updated')
  assert.equal(ids[0], ids[1])
})

test('invalid input is rejected before any upstream call', async () => {
  let calls = 0
  const post = route(async () => { calls++; throw new Error('Must not call Google') })
  assert.equal((await post(request({ ...reply, name: ' ' }))).status, 400)
  assert.equal((await post(request({ ...reply, replyKey: 'invalid' }))).status, 400)
  assert.equal((await post(request({ ...reply, guests: 5 }))).status, 400)
  assert.equal((await post(request({ ...reply, notes: 'x'.repeat(20000) }))).status, 413)
  assert.equal((await post(request([], {}))).status, 400)
  assert.equal((await post(request(reply, { Origin: 'https://unrelated.example' }))).status, 403)
  assert.equal((await post(request(reply, { 'Content-Type': 'text/plain' }))).status, 415)
  assert.equal((await post(new Request('http://localhost:3000/api/rsvp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' }))).status, 400)
  assert.equal(calls, 0)
})

test('missing configuration and non-Google URLs never receive the secret', async () => {
  let calls = 0
  for (const settings of [{}, { ...env, GOOGLE_APPS_SCRIPT_URL: 'https://unrelated.example/exec' }, { ...env, GOOGLE_APPS_SCRIPT_SECRET: 'short' }]) {
    const post = route(async () => { calls++; }, settings)
    assert.equal((await post(request())).status, 503)
  }
  assert.equal(calls, 0)
})

test('Google errors, login HTML, busy responses and timeouts never become confirmation', async () => {
  const timeout = Object.assign(new Error('private details'), { name: 'TimeoutError' })
  const cases = [
    [() => Response.json({ ok: false, code: 'UNAUTHORIZED', secret }), 502],
    [() => new Response('<html>Sign in</html>'), 502],
    [() => Response.json({ ok: true }), 502],
    [() => new Response('Unavailable', { status: 503 }), 502],
    [() => Response.json({ ok: false, code: 'BUSY' }), 503],
    [() => { throw timeout }, 504],
  ]
  for (const [respond, expected] of cases) {
    const result = await route(async () => respond())(request())
    assert.equal(result.status, expected)
    const body = await result.text()
    assert.equal(JSON.parse(body).ok, false)
    assert.equal(body.includes(secret), false)
    assert.equal(body.includes('private details'), false)
  }
})

test('preserves known setup codes and logs safe guidance without leaking upstream content', async () => {
  for (const code of ['SAVE_FAILED', 'SHEET_ACCESS_ERROR', 'SHEET_HEADERS_MISMATCH', 'CONFIGURATION_ERROR', 'UNAUTHORIZED']) {
    const logs = []
    const post = loadTs('app/api/rsvp/route.ts', {
      process: { env },
      fetch: async () => Response.json({ ok: false, code, message: 'Private upstream details', secret }),
      console: { error: message => logs.push(message) },
    }).POST
    const response = await post(request())
    const result = await response.json()
    assert.equal(result.code, code)
    assert.equal(result.ok, false)
    assert.ok(logs.some(line => line.includes(code)))
    for (const output of [JSON.stringify(result), logs.join(' ')]) {
      assert.equal(output.includes(secret), false)
      assert.equal(output.includes('Private upstream details'), false)
    }
  }
})

test('unrecognized upstream codes are not reflected to guests', async () => {
  const response = await route(async () => Response.json({ ok: false, code: secret }))(request())
  assert.equal((await response.json()).code, 'UNEXPECTED_SCRIPT_RESPONSE')
})
