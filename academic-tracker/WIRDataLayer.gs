/****************************************************
 * WIR DATA LAYER
 * ------------------------------------------------
 * Read/write functions for the two WIR tables in
 * SS_VAULT:
 *
 *   WIR Reports         — computed, append-only.
 *                          One row per student per week.
 *                          Never edited after being written.
 *
 *   WIR Case Management — persistent, one row per student.
 *                          Never wiped/regenerated. Holds
 *                          the human layer (case owner,
 *                          status, notes, follow-up).
 *
 * Student ID is the ONLY join key used anywhere in this
 * file. No name matching, ever — that was the core bug
 * in the old system (case data preserved across weekly
 * sheet regeneration by matching student NAME).
 ****************************************************/

// ── CONFIG — adjust once SS_VAULT exists ───────────
const WIR_SS_VAULT_ID = '15AdLxifwIXSjT5ja9bpuBOhp8b6u4r2sniHbU4cA_2o';

const WIR_REPORTS_SHEET = 'WIR Reports';
const WIR_CASE_SHEET    = 'WIR Case Management';

// WIR Reports columns (1-indexed)
const WIR_R_COL = {
  STUDENT_ID:         1,
  WEEK_LABEL:         2,
  STATUS:             3,
  PRIORITY:           4,
  ADMIN_PRIORITY:     5,
  URGENCY:            6,
  PERCENT:            7,
  WEEKLY_TARGET:      8,
  THIS_WEEK_HOURS:    9,
  LAST_ACTIVE_HOURS: 10,
  LAST_ACTIVE_LABEL: 11,
  CREDITS_THIS_WEEK: 12,
  COURSE_DAYS_LEFT:  13,
  ISSUE_TAGS:        14,
  DETECTED_PATTERNS: 15,
  INSTRUCTOR_ACTION: 16,
  COORDINATOR_ACTION:17,
  REASON:            18,
  STREAK:            19,
  TRAJECTORY:        20,
  GRAD_GAP:          21,
  GENERATED_DATE:    22
};
const WIR_R_HEADERS = [
  'studentId', 'weekLabel', 'status', 'priority', 'adminPriority', 'urgency',
  'percent', 'weeklyTarget', 'thisWeekHours', 'lastActiveHours', 'lastActiveLabel',
  'creditsThisWeek', 'courseDaysLeft', 'issueTags', 'detectedPatterns',
  'instructorAction', 'coordinatorAction', 'reason', 'streak', 'trajectory',
  'gradGap', 'generatedDate'
];

// WIR Case Management columns (1-indexed)
const WIR_C_COL = {
  STUDENT_ID:    1,
  COMMENTS:      2,
  CASE_OWNER:    3,
  CASE_STATUS:   4,
  FOCUS:         5,
  FOLLOW_UP:     6,
  CASE_NOTES:    7,
  LAST_UPDATED:  8
};
const WIR_C_HEADERS = [
  'studentId', 'comments', 'caseOwner', 'caseStatus', 'focus',
  'followUpDate', 'caseNotes', 'lastUpdated'
];


/****************************************************
 * SHEET ACCESS / SETUP
 ****************************************************/
function _wirGetVault_() {
  return SpreadsheetApp.openById(WIR_SS_VAULT_ID);
}

function _wirEnsureReportsSheet_() {
  const ss = _wirGetVault_();
  let sheet = ss.getSheetByName(WIR_REPORTS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(WIR_REPORTS_SHEET);
    sheet.appendRow(WIR_R_HEADERS);
  }
  return sheet;
}

function _wirEnsureCaseSheet_() {
  const ss = _wirGetVault_();
  let sheet = ss.getSheetByName(WIR_CASE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(WIR_CASE_SHEET);
    sheet.appendRow(WIR_C_HEADERS);
  }
  return sheet;
}


/****************************************************
 * WIR REPORTS — READ
 ****************************************************/

// Every row for one student, most recent first. Used for
// streak/trajectory calculation (replaces old WIR Log reads).
function getWIRHistoryForStudent(studentId, limit) {
  const sheet = _wirEnsureReportsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, WIR_R_HEADERS.length).getValues();
  const id = String(studentId).trim();

  const rows = data
    .filter(row => String(row[WIR_R_COL.STUDENT_ID - 1]).trim() === id)
    .map(_wirRowToObject_)
    .sort((a, b) => (a.weekLabel < b.weekLabel ? 1 : -1)); // most recent first

  return limit ? rows.slice(0, limit) : rows;
}

// Just the latest week's row for one student (what the dashboard
// Intervention tab shows by default).
function getLatestWIRReport(studentId) {
  const history = getWIRHistoryForStudent(studentId, 1);
  return history.length ? history[0] : null;
}

// Every student's latest row — for the Case Manager list view.
// One row per student (their most recent week only), not the
// full history.
function getAllLatestWIRReports() {
  const sheet = _wirEnsureReportsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, WIR_R_HEADERS.length).getValues();

  const latestByStudent = {};
  data.forEach(row => {
    const obj = _wirRowToObject_(row);
    const existing = latestByStudent[obj.studentId];
    if (!existing || obj.weekLabel > existing.weekLabel) {
      latestByStudent[obj.studentId] = obj;
    }
  });

  return Object.values(latestByStudent);
}

function _wirRowToObject_(row) {
  const obj = {};
  WIR_R_HEADERS.forEach((key, i) => { obj[key] = row[i]; });
  // Defensive normalization — in case a row was written before the
  // text-format fix and got auto-converted to a Date by Sheets.
  obj.studentId = _wirNormalizeKeyPart_(obj.studentId);
  obj.weekLabel = _wirNormalizeKeyPart_(obj.weekLabel);
  return obj;
}


/****************************************************
 * WIR REPORTS — WRITE
 * Append-only. A row, once written, is never edited.
 * Re-running the engine for a week that already has rows
 * should APPEND new rows only for students not yet covered
 * that week, or produce a fresh set for a new week — it
 * should never rewrite/delete existing rows.
 ****************************************************/

// Bulk write — used by the engine after computing a full
// week's worth of rows. Skips students who already have a
// row for that exact studentId + weekLabel (idempotent re-run
// protection), rather than duplicating them.
function appendWIRReportRows(rowObjects) {
  if (!rowObjects || !rowObjects.length) return { written: 0, skipped: 0 };

  const sheet = _wirEnsureReportsSheet_();
  const lastRow = sheet.getLastRow();

  // Force studentId and weekLabel columns to plain text BEFORE writing —
  // otherwise Sheets auto-detects "2026-07-06"-style strings as dates and
  // silently converts them, which breaks the dedupe key comparison below
  // (a Date object read back never string-equals the original text).
  sheet.getRange(1, WIR_R_COL.STUDENT_ID, Math.max(sheet.getMaxRows(), 2), 1).setNumberFormat('@');
  sheet.getRange(1, WIR_R_COL.WEEK_LABEL, Math.max(sheet.getMaxRows(), 2), 1).setNumberFormat('@');

  // Force percent column to plain decimal number (e.g. 42.5, not "42.5%")
  // so it can never be auto-formatted as a percent-string by Sheets.
  sheet.getRange(1, WIR_R_COL.PERCENT, Math.max(sheet.getMaxRows(), 2), 1).setNumberFormat('0.00');

  const existingKeys = new Set();
  if (lastRow >= 2) {
    const existing = sheet.getRange(2, 1, lastRow - 1, 2).getValues(); // studentId, weekLabel
    existing.forEach(row => {
      existingKeys.add(_wirNormalizeKeyPart_(row[0]) + '::' + _wirNormalizeKeyPart_(row[1]));
    });
  }

  const toWrite = [];
  let skipped = 0;

  rowObjects.forEach(obj => {
    const key = _wirNormalizeKeyPart_(obj.studentId) + '::' + _wirNormalizeKeyPart_(obj.weekLabel);
    if (existingKeys.has(key)) { skipped++; return; }

    toWrite.push(WIR_R_HEADERS.map(h => obj[h] !== undefined ? obj[h] : ''));
  });

  if (toWrite.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, toWrite.length, WIR_R_HEADERS.length)
      .setValues(toWrite);
  }

  return { written: toWrite.length, skipped };
}

// Normalizes a value for key-comparison purposes. Handles the case where
// Sheets has silently turned a date-looking string into an actual Date
// object — converts it back to a plain yyyy-MM-dd string so comparisons
// against freshly-passed-in strings still match correctly.
function _wirNormalizeKeyPart_(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(val || '').trim();
}


/****************************************************
 * WIR CASE MANAGEMENT — READ
 ****************************************************/

function getCaseManagement(studentId) {
  const sheet = _wirEnsureCaseSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const id = String(studentId).trim();
  const data = sheet.getRange(2, 1, lastRow - 1, WIR_C_HEADERS.length).getValues();

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][WIR_C_COL.STUDENT_ID - 1]).trim() === id) {
      const obj = {};
      WIR_C_HEADERS.forEach((key, j) => { obj[key] = data[i][j]; });
      obj._rowNum = i + 2; // for internal use by the writer
      return obj;
    }
  }
  return null;
}

function getAllCaseManagement() {
  const sheet = _wirEnsureCaseSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  const data = sheet.getRange(2, 1, lastRow - 1, WIR_C_HEADERS.length).getValues();
  const byStudent = {};

  data.forEach(row => {
    const obj = {};
    WIR_C_HEADERS.forEach((key, i) => { obj[key] = row[i]; });
    byStudent[obj.studentId] = obj;
  });

  return byStudent;
}


/****************************************************
 * WIR CASE MANAGEMENT — WRITE
 * One row per student, created on first save, updated
 * in place after that. Never deleted by a regeneration —
 * this table is completely independent of WIR Reports.
 ****************************************************/

function saveCaseManagement(studentId, fields) {
  studentId = String(studentId || '').trim();
  if (!studentId) throw new Error('Student ID is required.');

  return _withWirLock_(() => {
    const sheet = _wirEnsureCaseSheet_();
    const existing = getCaseManagement(studentId);

    const rowValues = WIR_C_HEADERS.map(key => {
      if (key === 'studentId') return studentId;
      if (key === 'lastUpdated') return new Date();
      return fields[key] !== undefined ? fields[key]
        : (existing ? existing[key] : '');
    });

    if (existing) {
      sheet.getRange(existing._rowNum, 1, 1, WIR_C_HEADERS.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return { success: true, studentId };
  });
}


/****************************************************
 * COMBINED READ — what the dashboard's Intervention
 * tab actually wants: latest computed report + the
 * persistent case data, joined by Student ID.
 ****************************************************/
function getStudentIntervention(studentId) {
  return {
    report: getLatestWIRReport(studentId),
    caseData: getCaseManagement(studentId)
  };
}

// Combined list version, for the Case Manager overview screen.
function getAllStudentInterventions() {
  const reports = getAllLatestWIRReports();
  const caseByStudent = getAllCaseManagement();

  return reports.map(report => ({
    report,
    caseData: caseByStudent[report.studentId] || null
  }));
}


/****************************************************
 * LOCK HELPER
 * Prevents concurrent writes from clobbering each other —
 * same pattern as the main dashboard's _withLock.
 ****************************************************/
function _withWirLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}


/****************************************************
 * STUDENT INFO
 * ------------------------------------------------
 * Small table for static, one-time-set facts about a
 * student — right now just startDate. One row per
 * student, no duplication.
 *
 * IMPORTANT: the engine reads startDate from HERE, never
 * from Updated Grid directly. Updated Grid is only touched
 * by the manual sync function below, run occasionally —
 * never as part of a live engine run. This means a problem
 * with that external file (permissions, structure changes,
 * the other teacher reorganizing it) can never break the
 * engine mid-run.
 ****************************************************/

const WIR_STUDENT_INFO_SHEET = 'Student Info';
const WIR_SI_HEADERS = ['studentId', 'startDate', 'lastSynced'];

// Read-only source — NOT owned by this system. Belongs to
// another teacher / corporate tracking process.
// We ONLY pull Student ID + start date from this file — every
// other column (completion %, projected date, etc.) is computed
// from our own data instead, never sourced from here.
const UPDATED_GRID_ID = '1P_EodXdM5fE200hR503S_zfRvwvPP0-a1Y0mYy4Rqew';
const UPDATED_GRID_STUDENT_ID_COL = 1; // A
const UPDATED_GRID_START_DATE_COL = 5; // E — "Edgenuity/HSE Enrollment Date"
const UPDATED_GRID_DATA_START_ROW = 4; // verify against the real sheet before running

function _wirEnsureStudentInfoSheet_() {
  const ss = _wirGetVault_();
  let sheet = ss.getSheetByName(WIR_STUDENT_INFO_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(WIR_STUDENT_INFO_SHEET);
    sheet.appendRow(WIR_SI_HEADERS);
  }
  return sheet;
}

function getStudentStartDate(studentId) {
  const sheet = _wirEnsureStudentInfoSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const id = String(studentId).trim();
  const data = sheet.getRange(2, 1, lastRow - 1, WIR_SI_HEADERS.length).getValues();

  for (let i = 0; i < data.length; i++) {
    if (_wirNormalizeKeyPart_(data[i][0]) === id) {
      return _wirNormalizeKeyPart_(data[i][1]) || null;
    }
  }
  return null;
}

// Manual sync — run this occasionally (e.g. monthly, or whenever
// you're aware new students have been added to Updated Grid).
// NEVER called automatically by the engine itself.
const UPDATED_GRID_SHEET_NAME = 'Need HSD';

function syncStartDatesFromUpdatedGrid() {
  const gridSS = SpreadsheetApp.openById(UPDATED_GRID_ID);
  const gridSheet = gridSS.getSheetByName(UPDATED_GRID_SHEET_NAME);
  if (!gridSheet) {
    throw new Error('Could not find sheet "' + UPDATED_GRID_SHEET_NAME + '" in Updated Grid.');
  }
  const lastRow = gridSheet.getLastRow();

  if (lastRow < UPDATED_GRID_DATA_START_ROW) {
    Logger.log('syncStartDatesFromUpdatedGrid: no data rows found.');
    return { synced: 0, skipped: 0 };
  }

  Logger.log('syncStartDatesFromUpdatedGrid: sheet reports lastRow = ' + lastRow);

  // Safety cap — if lastRow is wildly larger than expected (a common
  // Sheets quirk where old formatting on now-empty rows inflates this
  // number), reading the full "range" could be slow or hang. Cap it and
  // log a warning rather than blindly reading thousands of empty rows.
  const SANITY_CAP = 1000;
  const effectiveLastRow = Math.min(lastRow, SANITY_CAP);
  if (lastRow > SANITY_CAP) {
    Logger.log('WARNING: lastRow (' + lastRow + ') looks unusually large — capping read at row ' + SANITY_CAP + '. This may mean old formatting on empty rows is inflating the sheet\'s reported size.');
  }

  const numRows = effectiveLastRow - UPDATED_GRID_DATA_START_ROW + 1;
  const gridData = gridSheet.getRange(
    UPDATED_GRID_DATA_START_ROW, 1, numRows,
    Math.max(UPDATED_GRID_STUDENT_ID_COL, UPDATED_GRID_START_DATE_COL)
  ).getValues();

  const infoSheet = _wirEnsureStudentInfoSheet_();
  const infoLastRow = infoSheet.getLastRow();

  // Build existing studentId -> rowNum map so this is an upsert, not
  // a blind append (re-running the sync shouldn't duplicate rows).
  const existingRowByStudent = {};
  if (infoLastRow >= 2) {
    const existing = infoSheet.getRange(2, 1, infoLastRow - 1, 1).getValues();
    existing.forEach((row, i) => {
      existingRowByStudent[_wirNormalizeKeyPart_(row[0])] = i + 2;
    });
  }

  let synced = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  gridData.forEach(row => {
    const studentId = _wirNormalizeKeyPart_(row[UPDATED_GRID_STUDENT_ID_COL - 1]);
    const startDateRaw = row[UPDATED_GRID_START_DATE_COL - 1];

    if (!studentId || !startDateRaw) { skipped++; return; }

    const startDate = startDateRaw instanceof Date
      ? Utilities.formatDate(startDateRaw, Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : String(startDateRaw).trim();

    const existingRow = existingRowByStudent[studentId];
    if (existingRow) {
      infoSheet.getRange(existingRow, 1, 1, 3).setValues([[studentId, startDate, now]]);
    } else {
      infoSheet.appendRow([studentId, startDate, now]);
    }
    synced++;
  });

  // Force text formatting so studentId/startDate can't get
  // auto-converted the way weekLabel did in WIR Reports.
  infoSheet.getRange(1, 1, Math.max(infoSheet.getMaxRows(), 2), 2).setNumberFormat('@');

  Logger.log('syncStartDatesFromUpdatedGrid: ' + synced + ' synced, ' + skipped + ' skipped (missing ID or date)');
  return { synced, skipped };
}


/****************************************************
 * TEST — run this once to confirm the round-trip works
 * before building anything on top of this file.
 * Writes fake data, reads it back, alerts with results.
 * Safe to run repeatedly (idempotent WIR Reports write,
 * upsert-style Case Management write).
 ****************************************************/

function testWIRDataLayer() {
  const testStudentId = 'TEST_0001';
  const testWeek = '2026-07-06';

  // 1. Write a fake WIR Reports row
  const writeResult = appendWIRReportRows([{
    studentId: testStudentId,
    weekLabel: testWeek,
    status: 'Engagement Issue',
    priority: 'Medium',
    adminPriority: 'Medium',
    urgency: 'Normal',
    percent: '42.5%',
    weeklyTarget: 10,
    thisWeekHours: 4.5,
    lastActiveHours: 6,
    lastActiveLabel: 'Jun 29-Jul 3',
    creditsThisWeek: 0,
    courseDaysLeft: 12,
    issueTags: 'Low Activity',
    detectedPatterns: 'Trend Declining',
    instructorAction: 'Schedule check-in',
    coordinatorAction: 'Monitor',
    reason: 'Test row — safe to delete',
    streak: '',
    trajectory: 'Stable',
    gradGap: _computeGradGap_(s),
    generatedDate: new Date().toISOString()
  }]);

  // 2. Write/update a fake Case Management row
  saveCaseManagement(testStudentId, {
    comments: 'This is a test row from testWIRDataLayer()',
    caseOwner: 'Test Runner',
    caseStatus: 'Open',
    focus: 'Testing',
    followUpDate: '',
    caseNotes: 'Safe to delete this row.'
  });

  // 3. Read both back individually
  const latestReport = getLatestWIRReport(testStudentId);
  const caseData = getCaseManagement(testStudentId);

  // 4. Read back via the combined join
  const combined = getStudentIntervention(testStudentId);

  // 5. Read back via the "all students" list functions
  const allReports = getAllLatestWIRReports();
  const allCases = getAllCaseManagement();

  const summary =
    'WIR Data Layer Test Results\n\n' +
    'WIR Reports write: ' + writeResult.written + ' written, ' + writeResult.skipped + ' skipped\n\n' +
    'getLatestWIRReport found row: ' + (latestReport ? 'YES' : 'NO') + '\n' +
    (latestReport ? '  status: ' + latestReport.status + ', percent: ' + latestReport.percent + '\n' : '') +
    '\ngetCaseManagement found row: ' + (caseData ? 'YES' : 'NO') + '\n' +
    (caseData ? '  caseOwner: ' + caseData.caseOwner + ', caseStatus: ' + caseData.caseStatus + '\n' : '') +
    '\nCombined join (getStudentIntervention):\n' +
    '  report present: ' + (combined.report ? 'YES' : 'NO') + '\n' +
    '  caseData present: ' + (combined.caseData ? 'YES' : 'NO') + '\n' +
    '\ngetAllLatestWIRReports found ' + allReports.length + ' student(s) total\n' +
    'getAllCaseManagement found ' + Object.keys(allCases).length + ' student(s) total\n' +
    '\nRun again — write count should show "skipped" not "written" ' +
    '(idempotent check), and case row should update in place, not duplicate.';

  Logger.log(summary);
  Logger.log('(Check View > Logs or View > Executions to see this summary)');
}

// Run this after you're satisfied the test worked, to remove the
// fake TEST_0001 rows from both sheets.
function cleanupWIRTestData() {
  const testStudentId = 'TEST_0001';
  const vault = _wirGetVault_();

  const reportsSheet = vault.getSheetByName(WIR_REPORTS_SHEET);
  if (reportsSheet) {
    const lastRow = reportsSheet.getLastRow();
    if (lastRow >= 2) {
      const ids = reportsSheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = ids.length - 1; i >= 0; i--) {
        if (String(ids[i][0]).trim() === testStudentId) {
          reportsSheet.deleteRow(i + 2);
        }
      }
    }
  }

  const caseSheet = vault.getSheetByName(WIR_CASE_SHEET);
  if (caseSheet) {
    const lastRow = caseSheet.getLastRow();
    if (lastRow >= 2) {
      const ids = caseSheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = ids.length - 1; i >= 0; i--) {
        if (String(ids[i][0]).trim() === testStudentId) {
          caseSheet.deleteRow(i + 2);
        }
      }
    }
  }

  Logger.log('Test data cleaned up.');
}
