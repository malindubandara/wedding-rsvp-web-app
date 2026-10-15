/**
 * Deploy as a Web app: execute as Me, access Anyone.
 * Script properties: SPREADSHEET_ID, RSVP_SECRET (32+ characters).
 * Optional property: SHEET_NAME (defaults to RSVPs).
 * The shared secret is sent only by the Next.js server, never by a guest browser.
 */
var RSVP_TIME_ZONE = 'Asia/Colombo';
var RSVP_DATE_FORMAT = 'dd mmm yyyy, hh:mm:ss AM/PM';
var RSVP_HEADERS = ['Reply Key Hash', 'Created At (Sri Lanka)', 'Updated At (Sri Lanka)', 'Name', 'Attendance', 'Guests', 'Notes'];
var RSVP_LEGACY_HEADERS = ['Reply Key Hash', 'Created At (UTC)', 'Updated At (UTC)', 'Name', 'Attendance', 'Guests', 'Notes'];

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
    var now = new Date();
    var createdAt = updated ? sheet.getRange(row, 2).getValue() : now;
    if (!updated) row = lastRow + 1;
    if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), row - sheet.getMaxRows());
    sheet.getRange(row, 1, 1, RSVP_HEADERS.length).setValues([[
      input.replyId, createdAt, now, cellText_(input.name.trim()), input.attendance,
      input.attendance === 'declined' ? 0 : input.guests, cellText_((input.notes || '').trim())
    ]]);
    sheet.getRange(row, 2, 1, 2).setNumberFormat(RSVP_DATE_FORMAT);
    styleAttendance_(sheet.getRange(row, 5), [[input.attendance]]);
    sheet.autoResizeRows(row, 1);
    SpreadsheetApp.flush();
    return jsonReply_({ ok: true, action: updated ? 'updated' : 'created' });
  } catch (error) {
    var code = error && (error.rsvpCode === 'SHEET_ACCESS_ERROR' || error.rsvpCode === 'SHEET_HEADERS_MISMATCH') ? error.rsvpCode : 'SAVE_FAILED';
    console.error('RSVP save failed [' + code + ']. Run initializeRsvpSheet in the editor for setup details.');
    return jsonReply_({ ok: false, code: code });
  } finally {
    if (locked) lock.releaseLock();
  }
}

/** Run in the editor to authorize access, upgrade old dates, and refresh styling. */
function initializeRsvpSheet() {
  var properties = PropertiesService.getScriptProperties();
  var secret = properties.getProperty('RSVP_SECRET');
  if (!properties.getProperty('SPREADSHEET_ID') || !secret || secret.length < 32) {
    throw new Error('Set SPREADSHEET_ID and RSVP_SECRET (at least 32 characters) in Script properties first.');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { getRsvpSheet_(properties, true); SpreadsheetApp.flush(); }
  finally { lock.releaseLock(); }
}

function getRsvpSheet_(properties, refreshStyle) {
  var spreadsheetId = properties.getProperty('SPREADSHEET_ID').trim();
  // Accept a copied Sheet URL as well as the ID on its own.
  var urlId = spreadsheetId.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  if (urlId) spreadsheetId = urlId[1];
  var spreadsheet;
  try { spreadsheet = SpreadsheetApp.openById(spreadsheetId); }
  catch (error) {
    throw setupError_('SHEET_ACCESS_ERROR', 'Cannot open the spreadsheet. Check SPREADSHEET_ID and authorize this script using the Google account that owns the Sheet.');
  }
  var sheetName = (properties.getProperty('SHEET_NAME') || 'RSVPs').trim() || 'RSVPs';
  var sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  var empty = sheet.getLastRow() === 0;
  var legacy = false;
  if (!empty) {
    var headers = sheet.getRange(1, 1, 1, RSVP_HEADERS.length).getValues()[0];
    legacy = headersMatch_(headers, RSVP_LEGACY_HEADERS);
    if (!legacy && !headersMatch_(headers, RSVP_HEADERS)) {
      throw setupError_('SHEET_HEADERS_MISMATCH', 'The RSVP tab has incompatible headers. Set SHEET_NAME to a new unused tab name (for example RSVPs_v2), then run initializeRsvpSheet again. Existing data has not been changed.');
    }
  }
  // Dates are absolute instants; Sheets displays them using this time zone.
  // Do not add 5:30 to the timestamp itself, which would change the saved instant.
  if (spreadsheet.getSpreadsheetTimeZone() !== RSVP_TIME_ZONE) {
    spreadsheet.setSpreadsheetTimeZone(RSVP_TIME_ZONE);
  }
  if (empty || legacy || refreshStyle) {
    migrateRsvpDates_(sheet);
    sheet.getRange(1, 1, 1, RSVP_HEADERS.length).setValues([RSVP_HEADERS]);
    styleRsvpSheet_(sheet);
  }
  return sheet;
}

function headersMatch_(headers, expected) {
  return expected.every(function (label, index) {
    return String(headers[index]).trim().toLowerCase() === label.toLowerCase();
  });
}

function migrateRsvpDates_(sheet) {
  var count = sheet.getLastRow() - 1;
  if (count < 1) return;
  var dates = sheet.getRange(2, 2, count, 2).getValues();
  dates.forEach(function (row, index) {
    row.forEach(function (value, column) {
      // Old versions stored ISO UTC strings. Leave other cell values untouched.
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) return;
      var date = new Date(value);
      if (!isNaN(date.getTime())) sheet.getRange(index + 2, column + 2).setValues([[date]]);
    });
  });
}

function styleRsvpSheet_(sheet) {
  var maxRows = sheet.getMaxRows();
  var table = sheet.getRange(1, 1, maxRows, RSVP_HEADERS.length);
  table.setFontFamily('Arial').setFontSize(11).setFontColor('#344232')
    .setVerticalAlignment('middle');
  sheet.getBandings().forEach(function (banding) { banding.remove(); });
  table.applyRowBanding()
    .setHeaderRowColor('#344232')
    .setFirstRowColor('#ffffff')
    .setSecondRowColor('#f4f6ef');
  sheet.getRange(1, 1, 1, RSVP_HEADERS.length)
    .setFontWeight('bold').setFontSize(12).setFontColor('#ffffff').setWrap(true);
  sheet.setFrozenRows(1);
  sheet.setHiddenGridlines(true);
  sheet.setRowHeight(1, 52);
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidths(2, 2, 225);
  sheet.setColumnWidth(4, 230);
  sheet.setColumnWidth(5, 140);
  sheet.setColumnWidth(6, 85);
  sheet.setColumnWidth(7, 360);
  // Guests see only their form. Hide the internal edit key in the owner's table.
  sheet.hideColumns(1);
  sheet.getRange(1, 1).setNote('Internal reply identifier. Keep this column intact so guests can update their reply.');
  sheet.getRange(1, 2, 1, 2).setNote('Sri Lanka time (Asia/Colombo, UTC+05:30). Dates stay sortable as real date values.');
  if (maxRows > 1) {
    sheet.setRowHeights(2, maxRows - 1, 36);
    sheet.getRange(2, 2, maxRows - 1, 2).setNumberFormat(RSVP_DATE_FORMAT);
    sheet.getRange(2, 4, maxRows - 1, 1).setWrap(true);
    sheet.getRange(2, 5, maxRows - 1, 2).setHorizontalAlignment('center');
    sheet.getRange(2, 6, maxRows - 1, 1).setNumberFormat('0');
    sheet.getRange(2, 7, maxRows - 1, 1).setWrap(true);
  }
  if (!sheet.getFilter()) table.createFilter();
  var replyCount = sheet.getLastRow() - 1;
  if (replyCount > 0) {
    var attendance = sheet.getRange(2, 5, replyCount, 1);
    styleAttendance_(attendance, attendance.getValues());
    sheet.autoResizeRows(2, replyCount);
  }
}

function styleAttendance_(range, values) {
  range.setFontWeight('bold').setHorizontalAlignment('center')
    .setBackgrounds(values.map(function (row) {
      return [row[0] === 'accepted' ? '#e3eddf' : row[0] === 'declined' ? '#f7e6e2' : '#ffffff'];
    }))
    .setFontColors(values.map(function (row) {
      return [row[0] === 'accepted' ? '#2f5738' : row[0] === 'declined' ? '#914d43' : '#344232'];
    }));
}

function setupError_(code, message) {
  var error = new Error(message);
  error.rsvpCode = code;
  return error;
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
