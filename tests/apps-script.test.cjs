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
  const rows = options.rows || []
  const metrics = { opens: 0, locks: 0, releases: 0, flushes: 0, spreadsheetId: null, timeZone: 'Etc/UTC', styles: [], bandings: [], filter: null }
  const track = (method, ...args) => metrics.styles.push({ method, args })
  const properties = { SPREADSHEET_ID: 'test-spreadsheet', RSVP_SECRET: secret, ...options.properties }
  const sheet = {
    getLastRow: () => rows.length,
    getMaxRows: () => 1000,
    getBandings: () => [...metrics.bandings],
    getFilter: () => metrics.filter,
    getRange(row, column, height = 1, width = 1) {
      const range = {
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
        createFilter() {
          assert.equal(metrics.filter, null, 'Must not duplicate an existing filter')
          metrics.filter = { row, column, height, width }
          return metrics.filter
        },
        applyRowBanding() {
          const banding = { remove() { metrics.bandings.splice(metrics.bandings.indexOf(this), 1) } }
          for (const method of ['setHeaderRowColor', 'setFirstRowColor', 'setSecondRowColor']) {
            banding[method] = function (value) { track(method, value); return this }
          }
          metrics.bandings.push(banding)
          return banding
        },
      }
      for (const method of ['setFontWeight', 'setFontFamily', 'setFontSize', 'setFontColor', 'setVerticalAlignment', 'setWrap', 'setNote', 'setNumberFormat', 'setHorizontalAlignment', 'setBackgrounds', 'setFontColors']) {
        range[method] = function (...args) { track(method, { row, column, height, width }, ...args); return this }
      }
      return range
    },
  }
  for (const method of ['setFrozenRows', 'setHiddenGridlines', 'setRowHeight', 'setRowHeights', 'setColumnWidth', 'setColumnWidths', 'hideColumns', 'autoResizeRows']) {
    sheet[method] = (...args) => track(method, ...args)
  }
  const spreadsheet = {
    getSheetByName: () => sheet, insertSheet: () => sheet,
    getSpreadsheetTimeZone: () => metrics.timeZone,
    setSpreadsheetTimeZone: zone => { metrics.timeZone = zone },
  }
  const context = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: name => properties[name] ?? null }) },
    LockService: { getScriptLock: () => ({ tryLock() { metrics.locks++; return !options.busy }, waitLock() { metrics.locks++ }, releaseLock() { metrics.releases++ } }) },
    SpreadsheetApp: { openById(id) { metrics.opens++; metrics.spreadsheetId = id; if (options.failOpen) throw new Error('Private Google error details'); return spreadsheet }, flush() { metrics.flushes++ } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
    console: { error() {} },
    Date: options.Date || Date,
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
  assert.equal(app.post(reply).code, 'SHEET_HEADERS_MISMATCH')
  assert.deepEqual(plain(app.rows), [['Existing unrelated data']])
  assert.throws(() => app.initialize(), /Set SHEET_NAME to a new unused tab name/)
})

test('spreadsheet access failures return a safe specific code', () => {
  const app = script({ failOpen: true })
  assert.deepEqual(app.post(reply), { ok: false, code: 'SHEET_ACCESS_ERROR' })
  assert.throws(() => app.initialize(), /Check SPREADSHEET_ID/)
  assert.equal(app.rows.length, 0)
})

test('accepts a full spreadsheet URL and harmless header whitespace or case differences', () => {
  const app = script({ properties: { SPREADSHEET_ID: ' https://docs.google.com/spreadsheets/d/example-sheet-id/edit#gid=0 ' } })
  app.initialize()
  assert.equal(app.metrics.spreadsheetId, 'example-sheet-id')
  app.rows[0] = app.rows[0].map(header => ' ' + header.toLowerCase() + ' ')
  assert.equal(app.post(reply).ok, true)
})

test('stores real dates in Sri Lanka time and keeps creation time when a reply changes', () => {
  let instant = '2026-10-15T20:45:30.000Z'
  class Clock extends Date {
    constructor(...args) { super(args.length ? args[0] : instant) }
  }
  const app = script({ Date: Clock })
  assert.equal(app.post(reply).ok, true)
  assert.equal(app.metrics.timeZone, 'Asia/Colombo')
  assert.equal(app.rows[0][1], 'Created At (Sri Lanka)')
  assert.equal(app.rows[1][1].toISOString(), instant)
  assert.equal(app.rows[1][2].toISOString(), instant)
  const local = new Intl.DateTimeFormat('en-GB', {
    timeZone: app.metrics.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(app.rows[1][1])
  assert.equal(local, '16/10/2026, 02:15')
  instant = '2026-10-16T01:00:00.000Z'
  assert.equal(app.post({ ...reply, attendance: 'declined' }).ok, true)
  assert.equal(app.rows[1][1].toISOString(), '2026-10-15T20:45:30.000Z')
  assert.equal(app.rows[1][2].toISOString(), instant)
  assert.ok(app.metrics.styles.some(style => style.method === 'setNumberFormat' && style.args[0].row === 2 && style.args[1].includes('AM/PM')))
})

test('upgrades legacy UTC text dates without shifting instants or changing guest data', () => {
  const headers = ['Reply Key Hash', 'Created At (UTC)', 'Updated At (UTC)', 'Name', 'Attendance', 'Guests', 'Notes']
  const app = script({ rows: [headers, [reply.replyId, '2026-10-15T20:45:30.000Z', '2026-10-15T21:30:00Z', "'=Guest", 'accepted', 2, "'=SUM(1,2)"]] })
  app.initialize()
  assert.equal(app.rows[1][1].toISOString(), '2026-10-15T20:45:30.000Z')
  assert.equal(app.rows[1][2].toISOString(), '2026-10-15T21:30:00.000Z')
  assert.deepEqual(app.rows[1].slice(3), ["'=Guest", 'accepted', 2, "'=SUM(1,2)"])
  const created = app.rows[1][1]
  app.initialize()
  assert.equal(app.rows[1][1], created, 'Migration must be idempotent')
  assert.equal(app.post({ ...reply, name: 'Updated' }).action, 'updated')
  assert.equal(app.rows.length, 2)
  assert.equal(app.rows[1][1], created)
})

test('upgrades legacy headers automatically on save and preserves unknown date text', () => {
  const app = script()
  app.rows.push(['Reply Key Hash', ' Created At (UTC) ', 'updated at (utc)', 'Name', 'Attendance', 'Guests', 'Notes'])
  app.rows.push(['a'.repeat(64), '2026-10-15T18:30:00Z', 'manually entered', 'Older guest', 'declined', 0, 'Kept'])
  assert.equal(app.post(reply).action, 'created')
  assert.equal(app.rows[1][1].toISOString(), '2026-10-15T18:30:00.000Z')
  assert.equal(app.rows[1][2], 'manually entered')
  assert.equal(app.rows[0][2], 'Updated At (Sri Lanka)')
})

test('formats existing and new attendance, keeps filters and banding stable on repeated setup', () => {
  const app = script()
  app.post(reply)
  app.post({ ...reply, replyId: 'c'.repeat(64), attendance: 'declined' })
  app.initialize()
  app.initialize()
  assert.equal(app.metrics.bandings.length, 1)
  assert.deepEqual(app.metrics.filter, { row: 1, column: 1, height: 1000, width: 7 })
  const colors = app.metrics.styles.filter(style => style.method === 'setBackgrounds').at(-1)
  assert.deepEqual(plain(colors.args[1]), [['#e3eddf'], ['#f7e6e2']])
  assert.ok(app.metrics.styles.some(style => style.method === 'hideColumns' && style.args[0] === 1))
  assert.ok(app.metrics.styles.some(style => style.method === 'setFrozenRows' && style.args[0] === 1))
})
