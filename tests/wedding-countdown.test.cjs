const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTs, plain } = require('./load-ts.cjs')
const { getWeddingCountdown, WEDDING_DAY_START, WEDDING_DAY_END } = loadTs('lib/wedding-countdown.ts')

test('counts down to midnight in Sri Lanka, matching the configured calendar day', () => {
  assert.equal(WEDDING_DAY_START, Date.parse('2026-11-27T00:00:00+05:30'))
  assert.equal(WEDDING_DAY_END, Date.parse('2026-11-28T00:00:00+05:30'))
  assert.deepEqual(plain(getWeddingCountdown(Date.parse('2026-11-26T18:29:59Z'))), { status: 'upcoming', remaining: 1000 })
})

test('switches to the wedding-day message at exactly Sri Lankan midnight', () => {
  assert.deepEqual(plain(getWeddingCountdown(Date.parse('2026-11-26T18:30:00Z'))), { status: 'today', remaining: 0 })
})

test('keeps the wedding-day message throughout the day, including after the old 10 AM target', () => {
  for (const date of ['2026-11-27T01:00:00+05:30', '2026-11-27T10:00:00+05:30', '2026-11-27T23:59:59.999+05:30']) {
    assert.deepEqual(plain(getWeddingCountdown(Date.parse(date))), { status: 'today', remaining: 0 })
  }
})

test('switches to the married message at the end of the wedding day and never returns negative time', () => {
  for (const date of ['2026-11-27T18:30:00Z', '2027-01-01T00:00:00Z']) {
    assert.deepEqual(plain(getWeddingCountdown(Date.parse(date))), { status: 'past', remaining: 0 })
  }
})

test('uses the same wedding day for guests in different timezones', () => {
  const sriLanka = getWeddingCountdown(Date.parse('2026-11-27T01:00:00+05:30'))
  const california = getWeddingCountdown(Date.parse('2026-11-26T11:30:00-08:00'))
  assert.deepEqual(plain(sriLanka), plain(california))
})
