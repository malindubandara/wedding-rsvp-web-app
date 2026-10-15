/**
 * Deploy as a Web app: execute as Me, access Anyone.
 * Script properties: SPREADSHEET_ID, RSVP_SECRET (32+ characters).
 * Optional property: SHEET_NAME (defaults to RSVPs).
 * The shared secret is sent only by the Next.js server, never by a guest browser.
 */
var RSVP_HEADERS = ['Reply Key Hash', 'Created At (UTC)', 'Updated At (UTC)', 'Name', 'Attendance', 'Guests', 'Notes'];

function doPost(event) {
  var properties = PropertiesService.getScriptProperties();
  var secret = properties.getProperty('RSVP_SECRET');
  var spreadsheetId = properties.getProperty('SPREADSHEET_ID');
  if (!secret || secret.length < 32 || !spreadsheetId) return jsonReply_({ ok: false, code: 'CONFIGURATION_ERROR' });

  var input;
  try {
    if (!event || !event.postData || typeof event.postData.contents !== 'string' || event.postData.contents.length > 16384) {
      return jsonReply_({ ok: false, code: 'INVALID_REQUEST' });
    }
    input = JSON.parse(event.postData.contents);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid request');
  } catch (error) {
    return jsonReply_({ ok: false, code: 'INVALID_REQUEST' });
  }
  if (input.secret !== secret) return jsonReply_({ ok: false, code: 'UNAUTHORIZED' });
  if (!validReply_(input)) return jsonReply_({ ok: false, code: 'INVALID_REQUEST' });

  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    // Keep lookup and write together so retries and concurrent edits use one row.
    locked = lock.tryLock(10000);
    if (!locked) return jsonReply_({ ok: false, code: 'BUSY' });
    var sheet = getRsvpSheet_(properties);
    var lastRow = sheet.getLastRow();
    var keys = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues() : [];
    var row = 0;
    for (var i = 0; i < keys.length; i++) {
      if (keys[i][0] === input.replyId) { row = i + 2; break; }
    }
    var updated = row > 0;
    var now = new Date().toISOString();
    var createdAt = updated ? sheet.getRange(row, 2).getValue() : now;
    if (!updated) row = lastRow + 1;
    if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), row - sheet.getMaxRows());
    sheet.getRange(row, 1, 1, RSVP_HEADERS.length).setValues([[
      input.replyId, createdAt, now, cellText_(input.name.trim()), input.attendance,
      input.attendance === 'declined' ? 0 : input.guests, cellText_((input.notes || '').trim())
    ]]);
    SpreadsheetApp.flush();
    return jsonReply_({ ok: true, action: updated ? 'updated' : 'created' });
  } catch (error) {
    console.error('RSVP save failed. Check script properties, sheet headers, and spreadsheet access.');
    return jsonReply_({ ok: false, code: 'SAVE_FAILED' });
  } finally {
    if (locked) lock.releaseLock();
  }
}

/** Run once in the editor to authorize spreadsheet access and create the tab. */
function initializeRsvpSheet() {
  var properties = PropertiesService.getScriptProperties();
  var secret = properties.getProperty('RSVP_SECRET');
  if (!properties.getProperty('SPREADSHEET_ID') || !secret || secret.length < 32) {
    throw new Error('Set SPREADSHEET_ID and RSVP_SECRET (at least 32 characters) in Script properties first.');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { getRsvpSheet_(properties); SpreadsheetApp.flush(); }
  finally { lock.releaseLock(); }
}

function getRsvpSheet_(properties) {
  var spreadsheet = SpreadsheetApp.openById(properties.getProperty('SPREADSHEET_ID'));
  var sheetName = properties.getProperty('SHEET_NAME') || 'RSVPs';
  var sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, RSVP_HEADERS.length).setValues([RSVP_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else {
    var headers = sheet.getRange(1, 1, 1, RSVP_HEADERS.length).getValues()[0];
    for (var i = 0; i < RSVP_HEADERS.length; i++) {
      if (headers[i] !== RSVP_HEADERS[i]) throw new Error('Unexpected sheet headers');
    }
  }
  return sheet;
}

function validReply_(input) {
  return typeof input.replyId === 'string' && /^[a-f0-9]{64}$/.test(input.replyId)
    && typeof input.name === 'string' && input.name.trim().length > 0 && input.name.trim().length <= 120
    && (input.attendance === 'accepted' || input.attendance === 'declined')
    && (input.attendance === 'declined' || (typeof input.guests === 'number' && Number.isInteger(input.guests) && input.guests >= 1 && input.guests <= 4))
    && (input.notes === undefined || (typeof input.notes === 'string' && input.notes.length <= 1000));
}

function cellText_(value) {
  // setValues interprets leading '=' as a formula. Keep guest text literal.
  return /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
}

function jsonReply_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
