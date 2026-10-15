const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const { plain } = require('./load-ts.cjs')
const code = fs.readFileSync(path.join(__dirname, '../google-apps-script/Code.gs'), 'utf8')
const secret = 'test-only-secret-'.repeat(4)
const reply = { secret, replyId: 'b'.repeat(64), name: ' Guest ', attendance: 'accepted', guests: 2, notes: 'Hello' }

function script(options = {}) {
  const rows = []
  const metrics = { opens: 0, locks: 0, releases: 0, flushes: 0 }
  const properties = { SPREADSHEET_ID: 'test-spreadsheet', RSVP_SECRET: secret, ...options.properties }
  const sheet = {
    getLastRow: () => rows.length,
    getMaxRows: () => 1000,
    setFrozenRows() {},
    getRange(row, column, height = 1, width = 1) {
      return {
        getValues: () => Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => rows[row - 1 + i]?.[column - 1 + j] ?? '')),
        getValue: () => rows[row - 1]?.[column - 1] ?? '',
        setValues(values) {
          if (options.failWrite) throw new Error('Sheet error')
          values.forEach((cells, i) => {
            rows[row - 1 + i] ||= []
            cells.forEach((value, j) => {
              if (typeof value === 'string' && value.startsWith('=')) throw new Error('Unsafe formula')
              rows[row - 1 + i][column - 1 + j] = value
            })
          })
          return this
        },
        setFontWeight() { return this },
      }
    },
  }
  const context = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: name => properties[name] ?? null }) },
    LockService: { getScriptLock: () => ({ tryLock() { metrics.locks++; return !options.busy }, waitLock() { metrics.locks++ }, releaseLock() { metrics.releases++ } }) },
    SpreadsheetApp: { openById() { metrics.opens++; return { getSheetByName: () => sheet, insertSheet: () => sheet } }, flush() { metrics.flushes++ } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
    console: { error() {} },
  }
  vm.createContext(context)
  vm.runInContext(code, context)
  return { rows, metrics, initialize: () => context.initializeRsvpSheet(), post: input => context.doPost({ postData: { contents: JSON.stringify(input) } }), context }
}

test('initializes the dedicated sheet, creates a row, and updates it when retried', () => {
  const app = script()
  app.initialize()
  assert.equal(app.rows[0].length, 7)
  assert.deepEqual(app.post(reply), { ok: true, action: 'created' })
  const originalCreated = app.rows[1][1]
  assert.deepEqual(app.post({ ...reply, name: 'Renamed Guest', attendance: 'declined', guests: 4 }), { ok: true, action: 'updated' })
  assert.equal(app.rows.length, 2)
  assert.equal(app.rows[1][1], originalCreated)
  assert.equal(app.rows[1][3], 'Renamed Guest')
  assert.equal(app.rows[1][5], 0)
  assert.equal(app.metrics.locks, app.metrics.releases)
})

test('different browser keys keep identical names as separate replies', () => {
  const app = script()
  app.post(reply)
  app.post({ ...reply, replyId: 'c'.repeat(64) })
  assert.equal(app.rows.length, 3)
})

test('formula-like names and notes are written as literal text', () => {
  const app = script()
  assert.equal(app.post({ ...reply, name: '=HYPERLINK("example")', notes: ' =SUM(1,2)' }).ok, true)
  assert.ok(app.rows[1][3].startsWith("'="))
  assert.ok(app.rows[1][6].startsWith("'="))
})

test('rejects bad authentication and malformed input without accessing the sheet', () => {
  const app = script()
  for (const input of [{ ...reply, secret: 'wrong' }, { ...reply, name: ' ' }, { ...reply, guests: 0 }, { ...reply, attendance: 'maybe' }, { ...reply, notes: 'x'.repeat(1001) }, { ...reply, replyId: 'invalid' }, null]) {
    assert.equal(app.post(input).ok, false)
  }
  assert.equal(app.context.doPost({ postData: { contents: '{bad' } }).ok, false)
  assert.equal(app.metrics.opens, 0)
  assert.equal(app.metrics.locks, 0)
})

test('busy locks, missing configuration and write errors return failures', () => {
  const busy = script({ busy: true })
  assert.deepEqual(busy.post(reply), { ok: false, code: 'BUSY' })
  assert.equal(busy.metrics.releases, 0)
  assert.equal(script({ properties: { RSVP_SECRET: '' } }).post(reply).code, 'CONFIGURATION_ERROR')
  const failed = script({ failWrite: true })
  assert.equal(failed.post(reply).ok, false)
  assert.equal(failed.metrics.releases, 1)
})

test('incompatible headers are preserved rather than overwritten', () => {
  const app = script()
  app.rows.push(['Existing unrelated data'])
  assert.equal(app.post(reply).ok, false)
  assert.deepEqual(plain(app.rows), [['Existing unrelated data']])
})
