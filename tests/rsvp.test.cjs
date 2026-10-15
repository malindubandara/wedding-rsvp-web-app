const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTs, plain } = require('./load-ts.cjs')
const { validateRsvpFields, getNameError } = loadTs('lib/rsvp.ts')
const reply = { name: ' Test Guest ', attendance: 'accepted', guests: 2, notes: ' Hello ' }

test('valid replies are trimmed and keep Unicode names', () => {
  assert.deepEqual(plain(validateRsvpFields(reply)), { ok: true, data: { ...reply, name: 'Test Guest', notes: 'Hello' } })
  assert.equal(validateRsvpFields({ ...reply, name: 'අමා' }).ok, true)
})

test('declined replies have zero guests and optional notes default to empty', () => {
  const result = validateRsvpFields({ name: 'Guest', attendance: 'declined', guests: 4 })
  assert.equal(result.ok, true)
  assert.equal(result.data.guests, 0)
  assert.equal(result.data.notes, '')
})

test('blank, missing and overlong names use custom errors', () => {
  for (const name of ['', '   ', null, 'x'.repeat(121)]) {
    assert.ok(validateRsvpFields({ ...reply, name }).fieldErrors.name)
  }
  assert.ok(getNameError('   '))
  assert.equal(getNameError('Guest'), '')
})

test('rejects malformed attendance, guest counts and notes', () => {
  for (const guests of [0, 5, 1.5, '2', null, NaN]) assert.ok(validateRsvpFields({ ...reply, guests }).fieldErrors.guests)
  assert.ok(validateRsvpFields({ ...reply, attendance: 'maybe' }).fieldErrors.attendance)
  assert.ok(validateRsvpFields({ ...reply, notes: 'x'.repeat(1001) }).fieldErrors.notes)
  assert.ok(validateRsvpFields({ ...reply, notes: {} }).fieldErrors.notes)
  for (const value of [null, [], 'text']) assert.equal(validateRsvpFields(value).ok, false)
})
