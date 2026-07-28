// ============================================================
// DataFetch.gs — Runtime spreadsheet I/O
// ------------------------------------------------------------
// Owns: staff auth, WIR data shaping, override/notes writes
// (single/bulk/revert/merge), archive/restore, schedule upload,
// progress snapshots, email digest.
//
// - Every write to Overrides And Notes goes through _withLock()
//   (Helpers.gs) — shared sheet, unlocked write = lost data. Wrap
//   any new write path to it too.
// - Student ID is the only safe join key — see mergeStudents for
//   what broke when a previous version violated that.
// - Coerce sheet reads to string/number before sending to client —
//   raw Date objects silently become null over google.script.run.
// ============================================================

// ── Authentication ────────────────────────────────────────────

// Login entry point, re-checked every session (permissions can
// change). ADMIN_TOKEN bypasses Staff Roles lookup entirely.
// Cached 10 min/employee so a busy morning doesn't hammer the sheet.
function getRoleByEmployeeId(employeeId) {
  try {
    employeeId = String(employeeId || '').trim();
    if (!employeeId) return { error: 'No Employee ID provided.' };

    if (employeeId === ADMIN_TOKEN) {
      return { error: null, employeeId: 'ADMIN', name: 'Galen', role: ROLES.ADMIN, email: 'galen.jobcorps1@gmail.com' };
    }

    const cache    = CacheService.getScriptCache();
    const cacheKey = 'staffRole_' + employeeId;
    const cached   = cache.get(cacheKey);
    if (cached) {
      try { const p = JSON.parse(cached); if (p && !p.error) return p; } catch(e) {}
    }

    const adminSS = SpreadsheetApp.openById(SS_ADMIN);
    const sheet   = adminSS.getSheetByName(SHEET_STAFF_ROLES);
    if (!sheet) return { error: 'Staff Roles sheet not found.' };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { error: 'No staff on file.' };

    const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    const row    = values.find(r => String(r[0]).trim() === employeeId);
    if (!row) return { error: 'Employee ID not recognized.' };

    if (String(row[4]).trim().toUpperCase() !== 'TRUE') {
      return { error: 'Your account is inactive. Contact your administrator.' };
    }

    const result = {
      error: null,
      employeeId: String(row[0]).trim(),
      name:       String(row[1]).trim(),
      role:       String(row[2]).trim(),
      email:      String(row[3]).trim(),
    };
    cache.put(cacheKey, JSON.stringify(result), 600);
    return result;

  } catch(e) {
    Logger.log('getRoleByEmployeeId error: ' + e.message);
    return { error: 'Something went wrong. Please try again.' };
  }
}

// Feeds the counselor/instructor filter dropdowns — active staff
// with at least one trade listed only; empty trades = not shown.
function getCounselorList() {
  try {
    const sheet = SpreadsheetApp.openById(SS_ADMIN).getSheetByName(SHEET_STAFF_ROLES);
    if (!sheet) return { error: 'Staff Roles sheet not found.' };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { counselors: [] };

    const counselors = [];
    sheet.getRange(2, 1, lastRow - 1, 7).getValues().forEach(row => {
      const active    = String(row[4] || '').trim().toLowerCase();
      const tradesRaw = String(row[6] || '').trim();
      if (!['true','yes','1'].includes(active) || !tradesRaw) return;

      const trades = tradesRaw.split(',').map(t => t.trim()).filter(Boolean);
      if (!trades.length) return;

      counselors.push({
        id:    String(row[0] || '').trim(),
        name:  String(row[1] || '').trim(),
        role:  String(row[2] || '').trim(),
        email: String(row[3] || '').trim(),
        trades,
      });
    });

    counselors.sort((a, b) => a.name.localeCompare(b.name));
    return { counselors };
  } catch(e) {
    Logger.log('getCounselorList error: ' + e.message);
    return { error: e.message };
  }
}

// ============================================================
// ── WIR Data ─────────────────────────────────────────────────
// ============================================================

// Thin wrapper — only one storage path now, same pattern as
// getStudentSchedule below. Change here if a second path is added.
function getWIRData() {
  return getWIRDataFromVault_();
}

// Reshapes getAllStudentInterventions()'s report+case data into the
// flat rows the WIR tab expects. Every field stringified/trimmed —
// crosses the google.script.run boundary, see file header re: Dates.
function getWIRDataFromVault_() {
  try {
    const combined = getAllStudentInterventions(); // [{ report, caseData }]
    if (!combined.length) return { weekLabel: null, sheetName: null, fetchedAt: _todayStr(), rows: [] };

    let weekLabel = '';
    const rows = combined
      .filter(c => c.report)
      .map(({ report, caseData }) => {
        if (String(report.weekLabel || '') > weekLabel) weekLabel = String(report.weekLabel || '');
        return {
          student:           report.studentId,
          status:            String(report.status || '').trim(),
          priority:          String(report.priority || '').trim(),
          percent:           report.percent !== undefined && report.percent !== '' ? String(report.percent).trim() : '',
          weeklyTarget:      String(report.weeklyTarget || '').trim(),
          thisWeekHours:     String(report.thisWeekHours || '').trim(),
          lastActiveHours:   String(report.lastActiveHours || '').trim(),
          lastActiveLabel:   String(report.lastActiveLabel || '').trim(),
          credits:           String(report.creditsThisWeek || '').trim(),
          courseDaysLeft:    report.courseDaysLeft !== undefined && report.courseDaysLeft !== '' ? report.courseDaysLeft : null,
          issueTags:         String(report.issueTags || '').trim(),
          detectedPatterns:  String(report.detectedPatterns || '').trim(),
          adminPriority:     String(report.adminPriority || '').trim(),
          urgency:           String(report.urgency || '').trim(),
          instructorAction:  String(report.instructorAction || '').trim(),
          coordinatorAction: String(report.coordinatorAction || '').trim(),
          reason:            String(report.reason || '').trim(),
          streak:            String(report.streak || '').trim(),
          trajectory:        String(report.trajectory || '').trim(),
          gradGap:           String(report.gradGap || '').trim(),
          comments:          caseData ? String(caseData.comments || '').trim() : '',
          caseOwner:         caseData ? String(caseData.caseOwner || '').trim() : '',
          caseStatus:        caseData ? String(caseData.caseStatus || '').trim() : '',
          focus:             caseData ? String(caseData.focus || '').trim() : '',
          followUp:          caseData ? (_toDateStr(caseData.followUpDate) || '') : '',
          caseNotes:         caseData ? String(caseData.caseNotes || '').trim() : '',
          lastUpdated:       caseData ? (_toDateStr(caseData.lastUpdated) || '') : '',
        };
      });

    Logger.log('WIR (vault): ' + rows.length + ' rows, week ' + weekLabel);
    return { weekLabel, sheetName: null, fetchedAt: _todayStr(), rows };
  } catch(e) {
    Logger.log('getWIRDataFromVault_ error: ' + e.message);
    return null;
  }
}

// appendToWIRLog is a no-op under Vault — WIR Reports IS the log
// (append-only, idempotent, written directly by runWeeklyWIRGeneration
// in WIR Engine.gs via appendWIRReportRows). Kept as a no-op rather
// than removed so call sites don't each need their own flag check.
function appendToWIRLog(wirData, hubSS) {
  return;
}

// ============================================================
// ── Overrides ────────────────────────────────────────────────
// ============================================================

// Client-facing entry point for every override type (status, risk
// level, note, flags, HSD class, etc). See _applyOverrides in
// Profiles.gs for how these get read back at render time.
function setOverride(studentId, type, value, note, setBy, role) {
  _requirePermission(role || ROLES.ADMIN, 'manage_overrides');
  return setOverrideVault_(studentId, type, value, note, setBy);
}

// Undoes one override row. rowIndex must match getRecentChanges'
// last output — see revertChangeVault_'s staleness check below.
function revertChange(studentId, type, rowIndex, role) {
  _requirePermission(role || ROLES.ADMIN, 'revert_changes');
  return revertChangeVault_(studentId, type, rowIndex);
}

// Feeds "Recent Changes" — most recent 10 overrides, noisy/internal
// types filtered out.
function getRecentChanges() {
  return getRecentChangesVault_();
}

// ── Overrides — VAULT PATH ──────────────────────────────────────
// Direct port of the legacy Hub Overrides sheet, same 6-col shape.
// No rowId column, so row position is still how revert/delete finds
// a specific row — same rowIndex contract, just against
// VAULT_SHEET_OVERRIDES_NOTES now.

// Gets-or-creates the sheet — defensive, so a fresh Vault copy
// doesn't need manual setup before overrides work.
function _ensureVaultOverridesSheet_() {
  const ss = getVaultSpreadsheet_();
  let sheet = ss.getSheetByName(VAULT_SHEET_OVERRIDES_NOTES);
  if (!sheet) {
    sheet = ss.insertSheet(VAULT_SHEET_OVERRIDES_NOTES);
    sheet.appendRow(VAULT_OVERRIDES_NOTES_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Finds the existing row (1-based sheet row number) for one
// student+type combination, or null if none exists. Read-only, no
// mutation — safe to call without a lock on its own.
function _findVaultOverrideRow_(sheet, studentId, type) {
  const lastRow = sheet.getLastRow();
  if (lastRow < VAULT_DATA_START_ROW) return null;
  const data = sheet.getRange(VAULT_DATA_START_ROW, 1, lastRow - VAULT_DATA_START_ROW + 1, 2).getValues();
  const targetId = String(studentId).trim();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === targetId && String(data[i][1]).trim() === type) {
      return i + VAULT_DATA_START_ROW;
    }
  }
  return null;
}

// Clears (blanks in place, does NOT delete/shift) the existing row
// for one student+type, if any exists. Every consumer of this sheet
// already skips rows with an empty studentId/type (see
// parseOverridesSheet), so a blanked row is completely safe to leave
// sitting there — the whole point of not deleting it is that
// deleteRow() physically shifts every row below it up by one, which
// is exactly what made two concurrent writers to DIFFERENT students
// able to corrupt each other's row positions. In-place clearing never
// moves anything else, so that collision can't happen anymore.
function _deleteMatchingVaultRows_(sheet, studentId, type) {
  const row = _findVaultOverrideRow_(sheet, studentId, type);
  if (row) sheet.getRange(row, 1, 1, VAULT_OVERRIDES_NOTES_HEADERS.length).clearContent();
}

// Stamps "last modified" as its own override row — the single
// source for "when was this student last touched," regardless of
// which override type actually changed. Called from nearly every
// write path below (not from setOverrideVault_ writing last_modified
// itself — that'd be circular). Updates the existing last_modified
// row in place if this student already has one, instead of clearing
// it and appending a fresh row every single touch — that old pattern
// meant the sheet grew by one row on literally every write to any
// override type for any student, forever.
function _touchLastModifiedVault_(studentId, setBy) {
  const sheet = _ensureVaultOverridesSheet_();
  const rowValues = [studentId, 'last_modified', new Date().toISOString(), '', setBy || '', new Date()];
  const existingRow = _findVaultOverrideRow_(sheet, studentId, 'last_modified');
  if (existingRow) {
    sheet.getRange(existingRow, 1, 1, VAULT_OVERRIDES_NOTES_HEADERS.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

// Low-level single-row write, no locking of its own — callers wrap
// this in _withLock. Empty/null/undefined value clears the override
// instead of storing an empty row. Updates the existing row in place
// if one exists for this student+type, rather than clearing it and
// appending a new row at the end of the sheet — same reasoning as
// _touchLastModifiedVault_ above.
function _setOverrideRawVault_(studentId, type, value, note, setBy) {
  const sheet = _ensureVaultOverridesSheet_();
  const clearing = (value === '' || value === null || value === undefined);
  const existingRow = _findVaultOverrideRow_(sheet, studentId, type);

  if (clearing) {
    if (existingRow) sheet.getRange(existingRow, 1, 1, VAULT_OVERRIDES_NOTES_HEADERS.length).clearContent();
    return;
  }

  const rowValues = [studentId, type, value, note || '', setBy || '', new Date()];
  if (existingRow) {
    sheet.getRange(existingRow, 1, 1, VAULT_OVERRIDES_NOTES_HEADERS.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

// Locked, client-facing single-override write. Re-stamps
// last_modified on every type except last_modified itself. Still
// locked — two writes to the exact same student+type at the exact
// same instant could otherwise both see "no existing row" and both
// append, leaving a duplicate — but each locked operation is now a
// single-row find-and-update instead of a full-sheet clear+rewrite,
// so the lock is held for milliseconds, not however long a whole-
// sheet operation takes. That's what actually shrinks how long any
// other user's unrelated write has to wait.
function setOverrideVault_(studentId, type, value, note, setBy) {
  return _withLock(() => {
    _setOverrideRawVault_(studentId, type, value, note, setBy);
    if (type !== 'last_modified') _touchLastModifiedVault_(studentId, setBy);
    _clearDashboardCache();
    return { success: true };
  });
}

// Clears (does not delete/shift) one override row by position, but
// only after confirming it still matches the studentId+type the
// client expects — protects against reverting the wrong row if the
// sheet shifted between the client loading Recent Changes and
// clicking revert. Uses clearContent() instead of deleteRow() for the
// same reason as _deleteMatchingVaultRows_ above — no row shifting,
// no collision risk with a concurrent write elsewhere in the sheet.
function revertChangeVault_(studentId, type, rowIndex) {
  return _withLock(() => {
    const sheet = _ensureVaultOverridesSheet_();
    const lastRow = sheet.getLastRow();
    if (rowIndex < VAULT_DATA_START_ROW || rowIndex > lastRow) {
      throw new Error('Row no longer exists — it may have already been reverted.');
    }
    const check = sheet.getRange(rowIndex, 1, 1, 2).getValues()[0];
    if (String(check[0]).trim() !== String(studentId).trim() || String(check[1]).trim() !== type) {
      throw new Error('Row has changed since the history was loaded — please refresh.');
    }
    sheet.getRange(rowIndex, 1, 1, VAULT_OVERRIDES_NOTES_HEADERS.length).clearContent();
    _clearDashboardCache();
    return { success: true };
  });
}

// Most recent 10 override rows across ALL students, newest first.
// Internal bookkeeping types (progress_snapshot, last_modified,
// merged_into) filtered out — not things staff would "revert."
function getRecentChangesVault_() {
  try {
    const sheet = _ensureVaultOverridesSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < VAULT_DATA_START_ROW) return [];

    const SKIP_TYPES = new Set(['progress_snapshot', 'last_modified', 'merged_into']);
    const values  = sheet.getRange(VAULT_DATA_START_ROW, 1, lastRow - VAULT_DATA_START_ROW + 1, 6).getValues();
    const changes = [];

    for (let i = values.length - 1; i >= 0; i--) {
      const row  = values[i];
      const type = String(row[1] || '').trim();
      if (SKIP_TYPES.has(type)) continue;
      const studentId = String(row[0] || '').trim();
      if (!studentId) continue;
      const date = row[5];
      changes.push({
        studentId, type,
        value:    String(row[2] || '').trim(),
        note:     String(row[3] || '').trim(),
        setBy:    String(row[4] || '').trim(),
        date:     date instanceof Date ? date.toISOString() : String(date),
        rowIndex: i + VAULT_DATA_START_ROW,
      });
      if (changes.length >= 10) break;
    }
    return changes;
  } catch(e) {
    Logger.log('getRecentChangesVault_ error: ' + e.message);
    return [];
  }
}
// ============================================================
// ── Archive / Restore ─────────────────────────────────────────
// ============================================================
// Active must be a direct Name Mapping edit — buildStudentProfilesFromVault
// filters inactive students out before overrides are ever applied, so an
// override here would be invisible. This writes straight to the sheet,
// then logs an audit entry in Overrides And Notes so it shows in history
// (the log entry is just a record — Name Mapping's active column is the
// actual source of truth; reverting the log entry does NOT restore the
// student — use restoreStudent() / setStudentActive(id, true, ...) for that).
function setStudentActive(studentId, isActive, employeeId, role) {
  _requirePermission(role || ROLES.ADMIN, 'manage_overrides');
  studentId = String(studentId || '').trim();
  if (!studentId) throw new Error('Student ID is required.');

  return _withLock(() => {
    const ss    = getVaultSpreadsheet_();
    const sheet = ss.getSheetByName(VAULT_SHEET_NAME_MAPPING);
    const headers = VAULT_NAME_MAPPING_HEADERS;
    const idCol     = headers.indexOf('studentId');
    const activeCol = headers.indexOf('active');

    const lastRow = sheet.getLastRow();
    if (lastRow < VAULT_DATA_START_ROW) throw new Error('Name Mapping is empty.');
    const ids = sheet.getRange(VAULT_DATA_START_ROW, idCol + 1, lastRow - VAULT_DATA_START_ROW + 1, 1).getValues();

    let rowIndex = -1;
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === studentId) { rowIndex = i + VAULT_DATA_START_ROW; break; }
    }
    if (rowIndex === -1) throw new Error('Student not found in Name Mapping: ' + studentId);

    sheet.getRange(rowIndex, activeCol + 1).setValue(isActive);

    const notesSheet = _ensureVaultOverridesSheet_();
    notesSheet.appendRow([studentId, isActive ? 'restored' : 'archived', '', '', employeeId || 'staff', new Date()]);

    _clearDashboardCache();
    return { success: true, studentId, active: isActive };
  });
}
// Tracks when the roster (Name Mapping active/inactive state) was
// last touched — surfaced in the UI as a "data current as of" label.
// Property-based rather than a sheet cell so it doesn't need its own
// row/column anywhere.
function _setRosterLastUpdated_(isoString) {
  PropertiesService.getScriptProperties().setProperty('RosterLastUpdated', isoString);
}
function _getRosterLastUpdated_() {
  return PropertiesService.getScriptProperties().getProperty('RosterLastUpdated') || null;
}
// Restore list — reads Name Mapping directly since inactive students
// never make it into buildStudentProfilesFromVault's output.
function getArchivedStudents() {
  const ss    = getVaultSpreadsheet_();
  const sheet = ss.getSheetByName(VAULT_SHEET_NAME_MAPPING);
  const headers = VAULT_NAME_MAPPING_HEADERS;
  const idCol     = headers.indexOf('studentId');
  const nameCol   = headers.indexOf('masterName');
  const activeCol = headers.indexOf('active');

  const lastRow = sheet.getLastRow();
  if (lastRow < VAULT_DATA_START_ROW) return { success: true, archived: [] };

  const data = sheet.getRange(VAULT_DATA_START_ROW, 1, lastRow - VAULT_DATA_START_ROW + 1, headers.length).getValues();
  const archived = [];
  data.forEach(row => {
    const isActive = row[activeCol] === true || String(row[activeCol]).trim().toUpperCase() === 'TRUE';
    if (!isActive) {
      archived.push({ studentId: String(row[idCol]).trim(), displayName: String(row[nameCol]).trim() || String(row[idCol]).trim() });
    }
  });
  return { success: true, archived };
}
// ============================================================
// ── Notes ────────────────────────────────────────────────────
// ============================================================

// Appends a single staff note. Unlike most override types, notes are
// NOT "last write wins" — every call adds a new row rather than
// replacing one, since a student can have many notes over time.
function addStudentNote(studentId, noteText, setBy, role) {
  _requirePermission(role || ROLES.ADMIN, 'add_note');
  studentId = String(studentId || '').trim();
  noteText  = String(noteText  || '').trim();
  if (!studentId || !noteText) throw new Error('Student ID and note text are required.');

  return _withLock(() => {
    const sheet = _ensureVaultOverridesSheet_();
    sheet.appendRow([studentId, 'note', noteText, '', setBy || 'staff', new Date()]);
    _touchLastModifiedVault_(studentId, setBy);
    _clearDashboardCache();
    return { success: true };
  });
}

// Deletes exactly one note by matching studentId + its stored
// timestamp — searched newest-first since a delete request usually
// targets a note the staff member just saw at the top of the list.
function deleteStudentNote(studentId, noteTimestamp, role) {
  _requirePermission(role || ROLES.ADMIN, 'delete_note');
  studentId     = String(studentId     || '').trim();
  noteTimestamp = String(noteTimestamp || '').trim();
  if (!studentId || !noteTimestamp) throw new Error('Student ID and note timestamp are required.');

  return _withLock(() => {
    const sheet = _ensureVaultOverridesSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < VAULT_DATA_START_ROW) return { success: true };
    const data = sheet.getRange(VAULT_DATA_START_ROW, 1, lastRow - VAULT_DATA_START_ROW + 1, 6).getValues();
    for (let i = data.length - 1; i >= 0; i--) {
      if (String(data[i][0] || '').trim() === studentId && String(data[i][1] || '').trim() === 'note') {
        const rowDate = data[i][5] instanceof Date ? data[i][5].toISOString() : String(data[i][5]);
        if (rowDate === noteTimestamp) { sheet.getRange(i + VAULT_DATA_START_ROW, 1, 1, 6).clearContent(); break; }
      }
    }
    _clearDashboardCache();
    return { success: true };
  });
}

// ============================================================
// ── Bulk operations ──────────────────────────────────────────
// ============================================================

// Same note-append as addStudentNote, but for a whole selected list
// at once — one batched write instead of one appendRow per student,
// same read-once/write-once pattern used throughout this file.
function bulkAddNote(studentIds, noteText, setBy, role) {
  _requirePermission(role || ROLES.ADMIN, 'add_note');
  studentIds = (studentIds || []).map(id => String(id).trim()).filter(Boolean);
  noteText   = String(noteText || '').trim();
  if (!studentIds.length || !noteText) throw new Error('Student IDs and note text are required.');

  return _withLock(() => {
    const sheet   = _ensureVaultOverridesSheet_();
    const now     = new Date();
    const idSet   = new Set(studentIds);
    const lastRow = sheet.getLastRow();

    const lastModifiedRowById = {};
    if (lastRow >= VAULT_DATA_START_ROW) {
      const existing = sheet.getRange(VAULT_DATA_START_ROW, 1, lastRow - VAULT_DATA_START_ROW + 1, 2).getValues();
      existing.forEach((row, i) => {
        const rowId   = String(row[0] || '').trim();
        const rowType = String(row[1] || '').trim();
        if (idSet.has(rowId) && rowType === 'last_modified') lastModifiedRowById[rowId] = i + VAULT_DATA_START_ROW;
      });
    }

    const noteRows = studentIds.map(id => [id, 'note', noteText, '', setBy || 'staff', now]);
    sheet.getRange(sheet.getLastRow() + 1, 1, noteRows.length, 6).setValues(noteRows);

    studentIds.forEach(id => {
      const rowValues = [id, 'last_modified', now.toISOString(), '', setBy || '', now];
      const existingRow = lastModifiedRowById[id];
      if (existingRow) {
        sheet.getRange(existingRow, 1, 1, 6).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }
    });

    _clearDashboardCache();
    return { success: true, count: studentIds.length };
  });
}

// Sets academic_status and/or trade_status for a whole selected list
// at once — reads the sheet once, clears any existing status rows
// for just these students/types, then writes everything (new status
// rows + last_modified stamps) in a single range write.
function bulkSetStatus(studentIds, academicStatus, tradeStatus, setBy, role) {
  _requirePermission(role || ROLES.ADMIN, 'bulk_edit');
  studentIds = (studentIds || []).map(id => String(id).trim()).filter(Boolean);
  if (!studentIds.length) throw new Error('No student IDs provided.');
  if (!academicStatus && !tradeStatus) throw new Error('At least one status must be provided.');

  return _withLock(() => {
    const sheet   = _ensureVaultOverridesSheet_();
    const now     = new Date();
    const idSet   = new Set(studentIds);
    const lastRow = sheet.getLastRow();

    const existing = lastRow >= VAULT_DATA_START_ROW
      ? sheet.getRange(VAULT_DATA_START_ROW, 1, lastRow - VAULT_DATA_START_ROW + 1, 2).getValues()
      : [];

    // Clear (not delete/shift) any existing academic_status/
    // trade_status rows for these students, and note which students
    // already have a last_modified row (and where) so it can be
    // updated in place below instead of always appending a new one.
    const toClear = [];
    const lastModifiedRowById = {};
    existing.forEach((row, i) => {
      const rowId   = String(row[0] || '').trim();
      const rowType = String(row[1] || '').trim();
      if (!idSet.has(rowId)) return;
      if (academicStatus && rowType === 'academic_status') toClear.push(i + VAULT_DATA_START_ROW);
      if (tradeStatus    && rowType === 'trade_status')    toClear.push(i + VAULT_DATA_START_ROW);
      if (rowType === 'last_modified') lastModifiedRowById[rowId] = i + VAULT_DATA_START_ROW;
    });
    toClear.forEach(row => sheet.getRange(row, 1, 1, 6).clearContent());

    const newRows = [];
    studentIds.forEach(id => {
      if (academicStatus) newRows.push([id, 'academic_status', academicStatus, '', setBy || 'staff', now]);
      if (tradeStatus)    newRows.push([id, 'trade_status',    tradeStatus,    '', setBy || 'staff', now]);
    });
    if (newRows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 6).setValues(newRows);
    }

    // last_modified: update in place for students who already have a
    // row, append for the rest — avoids growing the sheet by one row
    // per student on every single bulk action, forever.
    studentIds.forEach(id => {
      const rowValues = [id, 'last_modified', now.toISOString(), '', setBy || '', now];
      const existingRow = lastModifiedRowById[id];
      if (existingRow) {
        sheet.getRange(existingRow, 1, 1, 6).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }
    });

    _clearDashboardCache();
    return { success: true, count: studentIds.length };
  });
}

// ============================================================
// ── Merge students ───────────────────────────────────────────
// ============================================================
function mergeStudents(sourceId, targetId, setBy, role) {
  _requirePermission(role || ROLES.ADMIN, 'merge');
  sourceId = String(sourceId || '').trim();
  targetId = String(targetId || '').trim();
  if (!sourceId || !targetId) throw new Error('Both a source and target student must be selected.');
  if (sourceId === targetId) throw new Error('Cannot merge a student into themselves.');

  return _withLock(() => {
    const mapSheet = getVaultSheet_(VAULT_SHEET_NAME_MAPPING);

    // Confirm both students actually exist in Name Mapping before doing
    // anything — a merge into/from a nonexistent ID would otherwise fail
    // silently downstream (source's profile would just never resolve,
    // and _applyMerges would quietly no-op).
    const lastRow = mapSheet.getLastRow();
    let sourceExists = false, targetExists = false;
    if (lastRow >= VAULT_DATA_START_ROW) {
      const ids = mapSheet.getRange(VAULT_DATA_START_ROW, 1, lastRow - VAULT_DATA_START_ROW + 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        const id = String(ids[i][0] || '').trim();
        if (id === sourceId) sourceExists = true;
        if (id === targetId) targetExists = true;
      }
    }
    if (!sourceExists) throw new Error('Source student not found in Name Mapping.');
    if (!targetExists) throw new Error('Target student not found in Name Mapping.');

    // Deliberately NOT repointing the source's Name Mapping row to
    // targetId. The merge itself happens one layer up, in
    // _applyMerges (Profiles.gs): it looks up the source profile by
    // its OWN id, folds any academic/trade/time/intervention data the
    // target is missing into the target profile, then filters the
    // source's card out of the final list using the 'merged_into'
    // override set below. All of that depends on the source's Name
    // Mapping row still carrying its real, original studentId — a
    // previous version of this function overwrote that ID to match
    // targetId instead, which left two Name Mapping rows sharing the
    // same ID (a duplicate dashboard card) AND broke _applyMerges's
    // own lookup (byId[sourceId] came back empty, since nothing had
    // that id anymore), so the carry-over logic silently never ran.
    //
    // Note: this only merges the two students' DASHBOARD profiles.
    // It does not repoint sourceId -> targetId inside Productivity
    // Data, Trade Overview, Transcript Rows, Academic Snapshots, etc.
    // If a future need arises to fully consolidate a student's raw
    // history under one ID (not just their dashboard card), that's a
    // separate, larger change touching every Vault sheet keyed by
    // studentId — flag it separately rather than folding it in here.

    // Carry non-duplicate overrides from source to target
    const ovSheet   = _ensureVaultOverridesSheet_();
    const ovLastRow = ovSheet.getLastRow();
    let carried     = 0;

    if (ovLastRow >= VAULT_DATA_START_ROW) {
      const ovData       = ovSheet.getRange(VAULT_DATA_START_ROW, 1, ovLastRow - VAULT_DATA_START_ROW + 1, 6).getValues();
      const targetTypes  = new Set(ovData.filter(r => String(r[0]).trim() === targetId).map(r => String(r[1]).trim()));
      const toAppend     = [];
      const toDeleteRows = [];
      ovData.forEach((row, i) => {
        const rowId   = String(row[0] || '').trim();
        const rowType = String(row[1] || '').trim();
        if (rowId !== sourceId) return;
        if (rowType === 'merged_into') { toDeleteRows.push(i + VAULT_DATA_START_ROW); return; }
        if (!targetTypes.has(rowType)) { toAppend.push([targetId, rowType, row[2], row[3], row[4], row[5]]); carried++; }
        toDeleteRows.push(i + VAULT_DATA_START_ROW);
      });
      toDeleteRows.forEach(r => ovSheet.getRange(r, 1, 1, 6).clearContent());
      if (toAppend.length) {
        ovSheet.getRange(ovSheet.getLastRow() + 1, 1, toAppend.length, 6).setValues(toAppend);
      }
    }

    _setOverrideRawVault_(sourceId, 'merged_into', targetId, 'Merged via dashboard', setBy || 'staff');
    _touchLastModifiedVault_(targetId, setBy || 'staff');
    _clearDashboardCache();
    return { success: true, carriedOverrides: carried };
  });
}

// ============================================================
// ── Progress snapshots ───────────────────────────────────────
// ============================================================
// Writes weekly risk/progress snapshots used for stale detection and trend arrows

// Thin wrapper — see getWIRData above for why these one-line
// pass-throughs exist (single storage path, kept for call-site
// stability if a second path is ever added).
function writeProgressSnapshots(profiles, hubSS) {
  return writeProgressSnapshotsVault_(profiles);
}

// Runs after every dashboard rebuild. For each active student, keeps
// at most one retained snapshot (the most recent) and skips writing
// a new one if the last snapshot is under 6 days old — this is what
// "weekly" snapshot cadence actually means here, there's no time-based
// trigger enforcing it. Snapshots older than SNAPSHOT_PRUNE_DAYS get
// deleted outright so this sheet doesn't grow unbounded.
function writeProgressSnapshotsVault_(profiles) {
  if (!profiles || !profiles.length) return;

  // Locked: this both deletes stale rows AND appends new ones in the
  // same Overrides sheet other functions read/write (notes, status
  // overrides, merges). Without a lock, an overlapping cache-warm run
  // or a staff action mid-write can see a half-pruned sheet or race
  // the append.
  return _withLock(() => {
  const sheet = _ensureVaultOverridesSheet_();

  const todayStr = _todayStr();
  const lastRow  = sheet.getLastRow();
  if (lastRow < VAULT_DATA_START_ROW) return;

  const data    = sheet.getRange(VAULT_DATA_START_ROW, 1, lastRow - VAULT_DATA_START_ROW + 1, 6).getValues();
  const cutoff  = new Date();
  cutoff.setDate(cutoff.getDate() - SNAPSHOT_PRUNE_DAYS);

  const rowsToDelete  = [];
  const retainedSnaps = {};

  data.forEach((row, i) => {
    if (String(row[1]).trim() !== 'progress_snapshot') return;
    const studentId = String(row[0]).trim();
    const d         = row[5] instanceof Date ? row[5] : new Date(row[5]);
    if (isNaN(d.getTime()) || d < cutoff) {
      rowsToDelete.push(i + VAULT_DATA_START_ROW);
    } else {
      if (!retainedSnaps[studentId] || d > retainedSnaps[studentId].date) {
        retainedSnaps[studentId] = { rowIndex: i + VAULT_DATA_START_ROW, date: d };
      }
    }
  });

  if (rowsToDelete.length) {
    const sorted = rowsToDelete.sort((a, b) => b - a);
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j] - sorted[j + 1] === 1) j++;
      sheet.getRange(sorted[j], 1, j - i + 1, 6).clearContent();
      i = j + 1;
    }
  }

  const newRows = [];
  profiles.forEach(p => {
    const acPct    = p.academic ? p.academic.percent : null;
    const trPct    = p.trades && p.trades.length ? p.trades[0].overallPct : null;
    const existing = retainedSnaps[p.id];
    if (existing && (Date.now() - existing.date.getTime()) / 86400000 < 6) return;
    newRows.push([
      p.id, 'progress_snapshot',
      JSON.stringify({ acPct, trPct, score: p.risk ? p.risk.score : null, date: todayStr }),
      '', 'system', new Date(),
    ]);
  });

  if (!newRows.length) {
    Logger.log('Snapshots (vault): nothing to write — all up to date');
    return;
  }
  sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 6).setValues(newRows);
  Logger.log('Snapshots (vault): wrote ' + newRows.length + ' new rows');
  });
}

// ============================================================
// ── Schedule ─────────────────────────────────────────────────
// ============================================================

// Shared derivation logic so today/expected-hours calculations
// can never drift — same rationale as shared helpers in BulkPacing.gs.
function _computeScheduleDerived_(weekLabel, schedule) {
  const VALID_PERIODS  = SCHEDULE_VALID_PERIODS;
  const DAY_LABELS     = { M:'Monday', T:'Tuesday', W:'Wednesday', TH:'Thursday', F:'Friday' };
  const JS_DAY_MAP     = { 1:'M', 2:'T', 3:'W', 4:'TH', 5:'F' };
  const ACADEMIC_NAMES = SCHEDULE_ACADEMIC_NAMES;
  const jsDay    = new Date().getDay();
  const todayKey = JS_DAY_MAP[jsDay] || null;
  const isWeekend = !todayKey;

  let expectedWeekHours = _countAcademicPeriodsInSchedule_(schedule);

  let todaySchedule      = null;
  let expectedTodayHours = null;
  if (!isWeekend && todayKey) {
    todaySchedule      = {};
    expectedTodayHours = 0;
    (VALID_PERIODS[todayKey] || []).forEach(periodNum => {
      const entry = (schedule['Period ' + periodNum] || {})[todayKey];
      if (!entry || !entry.class) return;
      todaySchedule['Period ' + periodNum] = entry;
      if (ACADEMIC_NAMES.some(n => (entry.class || '').toLowerCase().includes(n.toLowerCase()))) {
        expectedTodayHours++;
      }
    });
  }

  return {
    weekLabel, schedule, todaySchedule,
    todayLabel: todayKey ? DAY_LABELS[todayKey] : null,
    expectedWeekHours, expectedTodayHours, isWeekend,
  };
}

// Thin wrapper — same single-storage-path pattern as getWIRData/
// writeProgressSnapshots above.
function getStudentSchedule(studentId) {
  return getStudentScheduleFromVault_(studentId);
}

// ── Schedule read — VAULT PATH ──────────────────────────────────
// Only the 'current' slot is relevant for a live read — 'last'
// exists purely as a rollback/comparison copy, same as BulkPacing's
// _pacingLoadScheduleFromVault_.
function getStudentScheduleFromVault_(studentId) {
  try {
    studentId = String(studentId || '').trim();
    if (!studentId) return { error: 'No student ID.' };

    const cache    = CacheService.getScriptCache();
    const cacheKey = 'schedule_' + studentId;
    const cached   = cache.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch(e) {}
    }

    const rows = readVaultRowsForStudent_(VAULT_SHEET_WEEKLY_SCHEDULE, VAULT_SCHEDULE_HEADERS, studentId);
    const currentRow = rows.find(r => String(r.slot || '').trim().toLowerCase() === 'current');

    if (!currentRow) {
      const result = { weekLabel: null, schedule: null };
      cache.put(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    }

    const weekLabel = String(currentRow.weekLabel || '').trim();
    let schedule = {};
    try { schedule = JSON.parse(String(currentRow.scheduleJson || '{}')); }
    catch(e) { return { weekLabel, schedule: null }; }

    const result = _computeScheduleDerived_(weekLabel, schedule);
    try { cache.put(cacheKey, JSON.stringify(result), result.isWeekend ? CACHE_TTL : 300); } catch(e) {}
    return result;
  } catch(e) {
    Logger.log('getStudentScheduleFromVault_ error: ' + e.message);
    return { error: 'Could not load schedule.' };
  }
}

// One Sheets API call for every sheet instead of one
// getDataRange().getValues() call per sheet.
// - Master export = 150+ tabs = 150+ round-trips without this
// - REQUIRES "Sheets API" Advanced Service enabled (Services (+) ->
//   Sheets API)
// - Returns array of 2D value arrays, same order as sheetNames, same
//   shape as .getValues() (formatted-string cells — parsers here
//   already treat cells as strings)
function _batchReadAllSheetValues_(spreadsheetId, sheetNames) {
  const response = Sheets.Spreadsheets.get(spreadsheetId, {
    ranges: sheetNames,
    fields: 'sheets(data(rowData(values(formattedValue))))',
  });

  return (response.sheets || []).map(sheet => {
    const rowData = (sheet.data && sheet.data[0] && sheet.data[0].rowData) || [];
    return rowData.map(row =>
      (row.values || []).map(cell => cell.formattedValue || '')
    );
  });
}

// Entry point for the schedule upload modal.
// - Handles both formats: "master" export (one tab/student, >5
//   sheets) and single-sheet export (one row/student)
// - Converts uploaded .xlsx to a temp Google Sheet first — Apps
//   Script can't parse .xlsx directly — then deletes both the
//   upload and the converted copy once parsed
// - weekLabelKeyOverride forces a specific Monday (backfill) instead
//   of trusting the file's embedded "As Of" date — see
//   isCurrentWeekUpload in _writeWeeklyScheduleToVault_
function saveWeeklySchedule(base64Data, role, weekLabelKeyOverride) {
  _requirePermission(role || ROLES.ADMIN, 'manage_overrides');
  try {
    const decoded     = Utilities.base64Decode(base64Data);
    const blob        = Utilities.newBlob(decoded, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'temp_schedule.xlsx');
    const tempFile    = DriveApp.createFile(blob);
    const fileId      = tempFile.getId();
    const convertedFile = Drive.Files.copy({ title: 'temp_schedule_converted', mimeType: MimeType.GOOGLE_SHEETS }, fileId);
    const convertedId   = convertedFile.id;
    tempFile.setTrashed(true);

    let schedSS;
    try {
      schedSS = SpreadsheetApp.openById(convertedId);
    } catch(e) {
      try { DriveApp.getFileById(convertedId).setTrashed(true); } catch(e2) {}
      return { error: 'Could not open file. Please try again.' };
    }

    const allSheets = schedSS.getSheets();
    const isMaster  = allSheets.length > 5;
    const VALID_PERIODS = SCHEDULE_VALID_PERIODS;

    let weekLabel = 'This Week';
    let weekLabelKey = _currentWeekMondayLabel_(); // canonical yyyy-MM-dd Monday key for Weekly Hours History — falls back to the actual current week if the file's date can't be parsed

    // A week explicitly picked in the upload UI always wins over
    // whatever the file's own "As Of" text parses to — the whole
    // point of the picker is deliberate control (backfilling a past
    // week, or fixing one the file's embedded date got wrong).
    const pickedMonday = weekLabelKeyOverride ? _parseLocalDate(weekLabelKeyOverride) : null;
    if (pickedMonday) {
      weekLabelKey = weekLabelKeyOverride;
      const fri = new Date(pickedMonday); fri.setDate(pickedMonday.getDate() + 4);
      const fmt = dt => (dt.getMonth() + 1) + '/' + dt.getDate();
      weekLabel = fmt(pickedMonday) + ' – ' + fmt(fri) + '/' + fri.getFullYear();
    }
    let students  = [];
    let skipped   = [];

    if (isMaster) {
      const DAY_COLS = { M:3, T:5, W:6, TH:7, F:8 };
      const sheetNames = allSheets.map(sh => sh.getName());
      const allSheetValues = _batchReadAllSheetValues_(convertedId, sheetNames);

      allSheets.forEach((sheet, sheetIdx) => {
        const values = allSheetValues[sheetIdx] || [];
        if (!pickedMonday && weekLabel === 'This Week') {
          for (let i = 0; i < Math.min(5, values.length); i++) {
            const match = String(values[i][1] || '').match(/As Of:\s+\w+,\s+(\w+\s+\d+,\s+\d+)/);
            if (match) {
              const d = new Date(match[1]);
              if (!isNaN(d.getTime())) {
                const day = d.getDay();
                const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
                const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
                const fmt = dt => (dt.getMonth() + 1) + '/' + dt.getDate();
                weekLabel = fmt(mon) + ' – ' + fmt(fri) + '/' + fri.getFullYear();
                weekLabelKey = _toDateStr(mon);
              }
              break;
            }
          }
        }
        let studentInfo = null; let dayHeaderIdx = null;
        for (let i = 0; i < values.length; i++) {
          if (String(values[i][2] || '').trim() === 'Student:') { studentInfo = String(values[i][3] || '').trim(); dayHeaderIdx = i + 1; break; }
        }
        if (!studentInfo) { skipped.push({ sheet: sheet.getName(), reason: 'No student info found' }); return; }
        const lines = studentInfo.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) { skipped.push({ sheet: sheet.getName(), reason: 'Could not parse student cell' }); return; }
        const name = lines[0]; const sid = lines[1].trim();
        if (!/^\d{6,8}$/.test(sid)) { skipped.push({ sheet: sheet.getName(), name, reason: 'Invalid ID: ' + sid }); return; }
        const schedule = {};
        for (let i = dayHeaderIdx + 1; i < values.length; i++) {
          const row = values[i]; const periodNum = parseInt(row[2], 10);
          if (isNaN(periodNum) || periodNum === 4) continue;
          const periodKey = 'Period ' + periodNum;
          if (!schedule[periodKey]) schedule[periodKey] = {};
          Object.entries(DAY_COLS).forEach(([day, col]) => {
            if (!VALID_PERIODS[day].includes(periodNum)) return;
            const cell = String(row[col] || '').trim();
            if (!cell) return;
            const cellLines = cell.split('\n').map(l => l.trim()).filter(Boolean);
            schedule[periodKey][day] = { class: cellLines[0] || '', location: cellLines[1] || '' };
          });
        }
        if (!Object.keys(schedule).length) { skipped.push({ sheet: sheet.getName(), name, id: sid, reason: 'No schedule entries found' }); return; }
        students.push({ name, id: sid, schedule });
      });
    } else {
      const sheet  = allSheets[0];
      const values = sheet.getDataRange().getValues();
      const match  = !pickedMonday ? String(values[0][2] || '').match(/As Of:\s+\w+,\s+(\w+\s+\d+,\s+\d+)/) : null;
      if (match) {
        const d = new Date(match[1]);
        if (!isNaN(d.getTime())) {
          const day = d.getDay();
          const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
          const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
          const fmt = dt => (dt.getMonth() + 1) + '/' + dt.getDate();
          weekLabel = fmt(mon) + ' – ' + fmt(fri) + '/' + fri.getFullYear();
          weekLabelKey = _toDateStr(mon);
        }
      }
      const headerRow  = values[3];
      const periodCols = [];
      for (let c = 1; c < headerRow.length; c++) {
        const parts     = String(headerRow[c] || '').trim().split('\n').map(s => s.trim()).filter(Boolean);
        const periodNum = parseInt(parts[0], 10);
        if (!isNaN(periodNum) && periodNum !== 4) periodCols.push({ index: c, periodNum });
      }
      for (let r = 4; r < values.length; r++) {
        const studentCell = String(values[r][0] || '').trim();
        if (!studentCell) continue;
        const lines = studentCell.split('\n').map(s => s.trim()).filter(Boolean);
        if (lines.length < 2) continue;
        const name = lines[0]; const sid = lines[1].trim();
        if (!/^\d{6,8}$/.test(sid)) continue;
        const schedule = {};
        periodCols.forEach(col => {
          const cell = String(values[r][col.index] || '').trim();
          if (!cell) return;
          const cellLines = cell.split('\n').map(s => s.trim()).filter(Boolean);
          const periodKey = 'Period ' + col.periodNum;
          if (!schedule[periodKey]) schedule[periodKey] = {};
          Object.keys(VALID_PERIODS).forEach(day => {
            if (!VALID_PERIODS[day].includes(col.periodNum)) return;
            schedule[periodKey][day] = { class: cellLines[0] || '', location: cellLines[1] || '' };
          });
        });
        if (Object.keys(schedule).length) students.push({ name, id: sid, schedule });
        else skipped.push({ row: r + 1, name, id: sid, reason: 'No schedule entries' });
      }
    }

    try { DriveApp.getFileById(convertedId).setTrashed(true); } catch(e2) {}
    if (!students.length) return { error: 'No students found in the file.' };

    return _writeWeeklyScheduleToVault_(students, weekLabel, skipped, weekLabelKey);
  } catch(e) {
    Logger.log('saveWeeklySchedule error: ' + e.message);
    return { error: 'Failed to save schedule: ' + e.message };
  }
}

// Bulk wrapper for backfilling many historical weeks at once — runs
// saveWeeklySchedule once per file in filesArray, instead of the
// client calling it N times by hand. Each entry needs its own
// weekLabelKeyOverride: backlog uploads require deliberate week
// control (see the comment on weekLabelKeyOverride above) since
// there's no reliable way to guess which historical week an
// arbitrary file belongs to just from its contents. Each file is
// processed through the exact same, already-proven single-file path
// — this doesn't change what gets written or how, just automates
// running it multiple times.
function saveWeeklySchedulesBulk(filesArray, role) {
  _requirePermission(role || ROLES.ADMIN, 'manage_overrides');
  if (!Array.isArray(filesArray) || !filesArray.length) {
    return { success: false, error: 'No files provided.', results: [] };
  }

  const results = filesArray.map((f, i) => {
    if (!f || !f.base64Data || !f.weekLabelKeyOverride) {
      return { index: i, success: false, weekLabelKeyOverride: f && f.weekLabelKeyOverride || null, error: 'Missing file data or week for this entry.' };
    }
    try {
      const result = saveWeeklySchedule(f.base64Data, role, f.weekLabelKeyOverride);
      if (result && result.error) {
        return { index: i, success: false, weekLabelKeyOverride: f.weekLabelKeyOverride, error: result.error };
      }
      return { index: i, success: true, weekLabelKeyOverride: f.weekLabelKeyOverride, result };
    } catch (e) {
      return { index: i, success: false, weekLabelKeyOverride: f.weekLabelKeyOverride, error: e.message };
    }
  });

  const succeeded = results.filter(r => r.success).length;
  return {
    success: succeeded > 0,
    total:   filesArray.length,
    succeeded,
    failed:  filesArray.length - succeeded,
    results,
  };
}

// ── Weekly Schedule write — VAULT PATH ──────────────────────────
// Auto-registers any student on a schedule upload who isn't in Name
// Mapping yet.
// - Previously only Roster Upload could add students — a student on
//   a schedule before ever appearing on a roster would get their
//   Weekly Schedule row written but stay invisible everywhere else,
//   since Name Mapping is the join key for nearly everything
// - New rows: active:true, blank tradeComplete/academicComplete/
//   examProgram — same "unknown yet, fill in later" state as a
//   brand-new Roster Upload student
// - Never touches an existing Name Mapping row
function _registerNewStudentsFromSchedule_(students) {
  const sheet = getVaultSheet_(VAULT_SHEET_NAME_MAPPING);
  const rows  = readVaultSheetAsObjects_(VAULT_SHEET_NAME_MAPPING, VAULT_NAME_MAPPING_HEADERS);
  const knownIds = new Set(rows.map(r => String(r.studentId || '').trim()));

  const newRows = [];
  const seenThisBatch = new Set();
  students.forEach(s => {
    const sid = String(s.id).trim();
    if (!sid || knownIds.has(sid) || seenThisBatch.has(sid)) return;
    seenThisBatch.add(sid);
    newRows.push([sid, s.name || '', '', '', true, '']);
  });

  if (newRows.length) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRows.length, VAULT_NAME_MAPPING_HEADERS.length).setValues(newRows);
    sheet.getRange(startRow, 1, newRows.length, 1).setNumberFormat('@');
    Logger.log('_registerNewStudentsFromSchedule_: added ' + newRows.length + ' new student(s) to Name Mapping.');
  }
}

// Writes both Weekly Schedule (current/last slots) and Weekly Hours
// History from one upload. Locked — touches Name Mapping too, via
// _registerNewStudentsFromSchedule_ below.
function _writeWeeklyScheduleToVault_(students, weekLabel, skipped, weekLabelKey) {
  return _withLock(() => {
    _registerNewStudentsFromSchedule_(students);

    const sheet   = getVaultSheet_(VAULT_SHEET_WEEKLY_SCHEDULE);
    const lastRow = sheet.getLastRow();
    const numCols = VAULT_SCHEDULE_HEADERS.length;

    const existing = lastRow >= VAULT_DATA_START_ROW
      ? sheet.getRange(VAULT_DATA_START_ROW, 1, lastRow - VAULT_DATA_START_ROW + 1, numCols).getValues()
      : [];

    // Index existing rows by studentId -> { current: {rowNum, values}, last: {rowNum, values} }
    const byStudent = {};
    existing.forEach((row, i) => {
      const sid  = String(row[0] || '').trim();
      const slot = String(row[2] || '').trim().toLowerCase();
      if (!sid || (slot !== 'current' && slot !== 'last')) return;
      if (!byStudent[sid]) byStudent[sid] = {};
      byStudent[sid][slot] = { rowNum: VAULT_DATA_START_ROW + i, values: row };
    });

    const now = new Date().toISOString();
    const rowsToRewrite = []; // old 'current' rows demoted to 'last', in place
    const rowsToDelete  = []; // old 'last' rows being displaced
    const rowsToAppend  = []; // brand-new 'current' rows for this upload

    // Added/dropped diff vs. whoever was 'current' before this upload
    // — computed here, before byStudent's 'current' entries get
    // superseded below. Only meaningful for a genuine current-week
    // upload (isCurrentWeekUpload, computed just below) — a backlog
    // upload doesn't touch 'current' at all, so there's nothing to
    // diff against.
    const previousCurrentIds = new Set(
      Object.keys(byStudent).filter(sid => byStudent[sid].current)
    );
    const newIds = new Set(students.map(s => String(s.id).trim()));
    const droppedIds = [...previousCurrentIds].filter(sid => !newIds.has(sid));
    const addedStudents = students.filter(s => !previousCurrentIds.has(String(s.id).trim()))
      .map(s => ({ id: s.id, name: s.name }));

    // Backlog upload (deliberately-picked PAST week) must never touch
    // 'current'/'last' — those feed Display/instructor filter, which
    // need the TRUE current schedule always. Weekly Hours History
    // (below) is the only thing a backlog upload should populate.
    //
    // NOT an exact-match check against _currentWeekMondayLabel_() —
    // too strict, caused a real bug: any small mismatch (timezone
    // edge cases, file date parsing slightly off) silently skipped
    // the Weekly Schedule write while Hours History still updated —
    // "one system fresh, the other not." Now: backlog only if picked
    // week is unambiguously OLDER than today's real current week;
    // current week or future still updates normally.
    const isCurrentWeekUpload = !weekLabelKey || weekLabelKey >= _currentWeekMondayLabel_();

    if (isCurrentWeekUpload) {
      students.forEach(s => {
        const sid   = String(s.id).trim();
        const entry = byStudent[sid];
        const prevCurrent = entry && entry.current;
        const prevLast    = entry && entry.last;

        if (prevLast) rowsToDelete.push(prevLast.rowNum);

        if (prevCurrent) {
          const demoted = prevCurrent.values.slice();
          demoted[2] = 'last'; // slot column
          rowsToRewrite.push({ rowNum: prevCurrent.rowNum, values: demoted });
        }

        rowsToAppend.push([sid, weekLabel, 'current', JSON.stringify(s.schedule), now]);
      });

      // 1. Rewrite demoted rows in place — no row-count change.
      rowsToRewrite.forEach(({ rowNum, values }) => {
        sheet.getRange(rowNum, 1, 1, numCols).setValues([values]);
      });

      // 2. Clear displaced 'last' rows in place (not delete/shift).
      rowsToDelete.forEach(rowNum => sheet.getRange(rowNum, 1, 1, numCols).clearContent());

      // 3. Append new 'current' rows.
      if (rowsToAppend.length) {
        const startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, rowsToAppend.length, numCols).setValues(rowsToAppend);
        // Guard against Sheets auto-converting studentId/weekLabel-looking
        // strings to numbers/dates — same fix already applied in WIR Reports.
        sheet.getRange(startRow, 1, rowsToAppend.length, 2).setNumberFormat('@');
      }
    }

    // Weekly Hours History — separate pacing-only sheet, written
    // REGARDLESS of isCurrentWeekUpload (the whole point of a backlog
    // upload).
    // - Uses each student's PREVIOUS 'current' schedule (still in
    //   byStudent, untouched if this is backlog) to union same-week
    //   re-uploads (Wed/Fri changes) instead of overwriting earlier
    //   hours. Genuine backlog weeks: 'current' belongs to a
    //   different week, so no union happens — correct either way.
    // - Batched like the write above: one read, compute in memory,
    //   one write. ~165 students = seconds not minutes — same
    //   N-reads mistake the WIR engine was rebuilt to get away from.
    if (weekLabelKey) {
      _writeWeeklyHoursHistoryBatch_(students, weekLabel, weekLabelKey, byStudent);
    }

    const schedCache = CacheService.getScriptCache();
    _cacheRemoveChunked(schedCache, 'dashboardData');
    const cacheKeys = students.map(s => 'schedule_' + s.id);
    for (let i = 0; i < cacheKeys.length; i += 100) schedCache.removeAll(cacheKeys.slice(i, i + 100));

    let droppedStudents = [];
    if (isCurrentWeekUpload && droppedIds.length) {
      const mappingRows = readVaultSheetAsObjects_(VAULT_SHEET_NAME_MAPPING, VAULT_NAME_MAPPING_HEADERS);
      const nameById = {};
      mappingRows.forEach(r => { nameById[String(r.studentId || '').trim()] = r.masterName || ''; });
      droppedStudents = droppedIds.map(sid => ({ id: sid, name: nameById[sid] || '' }));
    }

    return {
      success: true, weekLabel, studentCount: students.length, skipped, skippedCount: skipped.length,
      added:   isCurrentWeekUpload ? addedStudents   : [],
      dropped: isCurrentWeekUpload ? droppedStudents : [],
    };
  });
}

// Guards against a corrupted/hand-edited scheduleJson cell breaking
// the whole batch write — returns null on parse failure instead of
// throwing, so one bad row doesn't take down everyone else's schedule
// history write in the same run.
function _safeParseScheduleJson_(raw) {
  try { return JSON.parse(String(raw || '{}')); } catch (e) { return null; }
}

// Batched Weekly Hours History write for an entire upload — reads
// the sheet exactly once, computes every student's new/updated row
// in memory, then writes/deletes in as few sheet API calls as
// possible. Replaces what was previously a read+write per student.
function _writeWeeklyHoursHistoryBatch_(students, weekLabel, weekLabelKey, scheduleByStudent) {
  const sheet   = getVaultSheet_(VAULT_SHEET_WEEKLY_HOURS_HISTORY);
  const lastRow = sheet.getLastRow();
  const numCols = VAULT_WEEKLY_HOURS_HISTORY_HEADERS.length;

  const existing = lastRow >= VAULT_DATA_START_ROW
    ? sheet.getRange(VAULT_DATA_START_ROW, 1, lastRow - VAULT_DATA_START_ROW + 1, numCols).getValues()
    : [];

  // Index existing rows by studentId -> array of { rowNum, weekLabelKey }
  const byStudent = {};
  existing.forEach((row, i) => {
    const sid = String(row[0] || '').trim();
    if (!sid) return;
    if (!byStudent[sid]) byStudent[sid] = [];
    byStudent[sid].push({ rowNum: VAULT_DATA_START_ROW + i, weekLabelKey: String(row[1] || '').trim() });
  });

  const now = new Date().toISOString();
  const rowsToRewrite = []; // { rowNum, values } — updating this week's row in place
  const rowsToAppend  = []; // brand-new week row for a student with no existing row for it

  students.forEach(s => {
    const sid = String(s.id).trim();
    const entry = scheduleByStudent[sid];
    const prevCurrentSchedule = (entry && entry.current) ? _safeParseScheduleJson_(entry.current.values[3]) : null;
    const prevCurrentWeekLabel = (entry && entry.current) ? String(entry.current.values[1] || '').trim() : null;
    const isSameWeekReupload = prevCurrentSchedule && prevCurrentWeekLabel === weekLabel;

    const effectiveSchedule = isSameWeekReupload
      ? _unionSchedules_(prevCurrentSchedule, s.schedule)
      : s.schedule;
    const academicHours = _countAcademicPeriodsInSchedule_(effectiveSchedule);
    const hasTrade = _scheduleHasTradePeriods_(effectiveSchedule);
    const newRowValues = [sid, weekLabelKey, academicHours, hasTrade, 'real_upload', now];

    const studentRows = byStudent[sid] || [];
    const thisWeekRow = studentRows.find(r => r.weekLabelKey === weekLabelKey);

    if (thisWeekRow) {
      rowsToRewrite.push({ rowNum: thisWeekRow.rowNum, values: newRowValues });
    } else {
      rowsToAppend.push(newRowValues);
    }

    // No pruning here anymore. This sheet used to keep only a
    // rolling window of each student's most recent few weeks — fine
    // when it only ever needed to answer "what's assigned this
    // week," but directly incompatible with also being the source of
    // full historical scheduled-hours data (charts, backfills). A
    // routine, completely normal current-week upload confirmed this
    // in practice: it silently wiped real backfilled history the
    // moment it ran, because from its perspective those weeks were
    // simply "old." At roughly 165 students x 52 weeks/year, this
    // sheet is nowhere near large enough to need automatic deletion
    // — a few thousand rows a year is not a real size problem for a
    // Sheet.
  });

  // 1. Rewrite in place — no row-count change. Re-applies the same
  //    text-format guard as the append path below — without this,
  //    a rewrite (not a fresh append) could let Sheets silently
  //    convert weekLabel into a real Date object instead of keeping
  //    it as the plain 'yyyy-MM-dd' string every comparison in
  //    _resolveAssignedHours_ expects. That mismatch is invisible
  //    just looking at the sheet (still displays as the same date)
  //    but breaks the exact-string lookup completely.
  rowsToRewrite.forEach(({ rowNum, values }) => {
    sheet.getRange(rowNum, 1, 1, numCols).setValues([values]);
    sheet.getRange(rowNum, 1, 1, 2).setNumberFormat('@');
  });

  // 2. Append brand-new week rows for students with no row for this
  //    week yet, all in one range write.
  if (rowsToAppend.length) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rowsToAppend.length, numCols).setValues(rowsToAppend);
    sheet.getRange(startRow, 1, rowsToAppend.length, 2).setNumberFormat('@');
  }
}

// ============================================================
// ── Email digest ─────────────────────────────────────────────
// ============================================================

// Builds and sends the HTML email digest (high/medium risk tables +
// summary counts) to a given recipient list. Called both manually
// from the sidebar and by the Monday-morning trigger below. Recipient
// list is whatever's passed in — the trigger path resolves that via
// _getDigestRecipients, a manual send can pass any list the UI collects.
function sendDigest(recipientList, role) {
  _requirePermission(role || ROLES.ADMIN, 'send_digest');
  const data = getDashboardData();
  if (data.error) throw new Error('Could not load dashboard data: ' + data.error);

  const profiles   = data.profiles || [];
  const metrics    = data.metrics  || {};
  const highRisk   = profiles.filter(p => p.risk && p.risk.level === 'HIGH').sort((a, b) => b.risk.score - a.risk.score);
  const mediumRisk = profiles.filter(p => p.risk && p.risk.level === 'MEDIUM').sort((a, b) => b.risk.score - a.risk.score);
  const now        = new Date();
  const dateLabel  = Utilities.formatDate(now, Session.getScriptTimeZone(), 'MMMM d, yyyy');

  function buildRows(list) {
    return list.map(p => {
      const acPct = p.academic ? (p.academic.percent !== null ? p.academic.percent.toFixed(0) + '%' : '—') : '—';
      const trPct = p.trades && p.trades.length ? (p.trades[0].overallPct !== null ? p.trades[0].overallPct.toFixed(0) + '%' : '—') : '—';
      const trade = p.tradeNameOverride || (p.trades && p.trades.length ? p.trades[0].tarName : '') || (p.tradeComplete ? (p.completedTrades || []).join(', ') : '—');
      const wir   = p.intervention ? (p.intervention.adminPriority || p.intervention.priority || '—') : '—';
      const trend = p.riskTrend === 'up' ? '▲' : p.riskTrend === 'down' ? '▼' : p.riskTrend === 'stable' ? '→' : '';
      const flags = (p.risk.flags || []).slice(0, 3).map(f => `<li style="margin:2px 0;color:#555;">${f}</li>`).join('');
      const stale = p.isStale ? '<span style="background:#fff3cd;color:#856404;padding:1px 6px;border-radius:4px;font-size:11px;">⏸ Stale</span>' : '';
      return `<tr style="border-bottom:1px solid #eee;">
        <td style="padding:10px 12px;font-weight:600;color:#1a1a2e;min-width:160px;">
          ${p.displayName}<br><span style="font-size:11px;color:#888;">${p.academicId ? 'ID: ' + p.academicId : ''}</span>${stale}
        </td>
        <td style="padding:10px 12px;text-align:center;">
          <span style="background:${p.risk.level === 'HIGH' ? '#fde8e8' : '#fff3e0'};color:${p.risk.level === 'HIGH' ? '#c0392b' : '#b7600a'};padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;">
            ${p.risk.score} ${trend}
          </span>
        </td>
        <td style="padding:10px 12px;text-align:center;color:#444;">${acPct}</td>
        <td style="padding:10px 12px;text-align:center;color:#444;">${trade}<br><span style="color:#888;font-size:11px;">${trPct}</span></td>
        <td style="padding:10px 12px;text-align:center;color:#444;">${wir}</td>
        <td style="padding:10px 12px;font-size:11px;color:#555;min-width:200px;"><ul style="margin:0;padding-left:16px;">${flags}</ul></td>
      </tr>`;
    }).join('');
  }

  const tableHtml = (title, rows, count) => !count ? '' : `
    <div style="padding:20px 28px 0;">
      <div style="font-size:14px;font-weight:700;margin-bottom:10px;color:#1a1a1a;">${title} (${count})</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#f3f4f6;border-bottom:2px solid #dcdcdc;">
          <th style="padding:10px 14px;text-align:left;font-size:12px;color:#333;">Student</th>
          <th style="padding:10px 14px;text-align:center;font-size:12px;color:#333;">Risk</th>
          <th style="padding:10px 14px;text-align:center;font-size:12px;color:#333;">Acad %</th>
          <th style="padding:10px 14px;text-align:center;font-size:12px;color:#333;">Trade</th>
          <th style="padding:10px 14px;text-align:center;font-size:12px;color:#333;">WIR</th>
          <th style="padding:10px 14px;font-size:12px;color:#333;">Flags</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;background:#fff;}.title{background:linear-gradient(135deg,#1a1a3e,#2d2d6b);padding:24px 28px;color:white;}.footer{background:#f8f8f8;padding:14px 28px;font-size:11px;color:#888;border-top:1px solid #e6e6e6;}</style>
    </head><body>
    <div class="title"><h1 style="margin:0;font-size:20px;">🎓 Student Dashboard Digest</h1><p style="margin:4px 0 0;font-size:12px;color:#cfcff5;">Tulsa Job Corps — ${dateLabel}</p></div>
    <table style="width:100%;border-collapse:collapse;border-bottom:1px solid #ddd;">
      <tr>
        <td style="padding:12px;text-align:center;"><div style="font-size:22px;font-weight:700;color:#c0392b;">${metrics.riskCounts ? metrics.riskCounts.HIGH || 0 : highRisk.length}</div><div style="font-size:11px;color:#666;">High Risk</div></td>
        <td style="padding:12px;text-align:center;border-left:1px solid #eee;"><div style="font-size:22px;font-weight:700;color:#e67e22;">${metrics.riskCounts ? metrics.riskCounts.MEDIUM || 0 : mediumRisk.length}</div><div style="font-size:11px;color:#666;">Medium Risk</div></td>
        <td style="padding:12px;text-align:center;border-left:1px solid #eee;"><div style="font-size:22px;font-weight:700;color:#333;">${metrics.withIntervention || 0}</div><div style="font-size:11px;color:#666;">Open WIR</div></td>
        <td style="padding:12px;text-align:center;border-left:1px solid #eee;"><div style="font-size:22px;font-weight:700;color:#555;">${profiles.filter(p => p.isStale).length}</div><div style="font-size:11px;color:#666;">Stale Data</div></td>
      </tr>
    </table>
    ${tableHtml('🔴 High Risk Students',  buildRows(highRisk),   highRisk.length)}
    ${tableHtml('🟡 Watch Closely',       buildRows(mediumRisk), mediumRisk.length)}
    <div class="footer">Sent from Student Dashboard · Tulsa Job Corps · ${dateLabel}</div>
    </body></html>`;

  const recipients = (recipientList || []).map(e => String(e).trim()).filter(e => e.includes('@'));
  if (!recipients.length) throw new Error('No recipients configured.');

  recipients.forEach(email => {
    GmailApp.sendEmail(
      email,
      `[Dashboard] ${highRisk.length} High Risk, ${mediumRisk.length} Watch Closely — ${dateLabel}`,
      '',
      { htmlBody: html, name: 'Student Dashboard' }
    );
  });

  Logger.log('Digest sent to ' + recipients.join(', '));
  return { success: true, sent: recipients.length, highRisk: highRisk.length, mediumRisk: mediumRisk.length };
}

// Handler function for the Monday 8am trigger installed below.
// Wrapped in its own try/catch since a trigger-fired function has no
// caller to report errors to — a thrown error here would just show
// up silently in the Executions log, so this logs explicitly instead.
function scheduledWeeklyDigest() {
  try {
    const recipients = _getDigestRecipients();
    if (!recipients.length) { Logger.log('Scheduled digest skipped — no recipients configured.'); return; }
    const result = sendDigest(recipients, ROLES.ADMIN);
    Logger.log('Scheduled digest sent: ' + JSON.stringify(result));
  } catch(e) {
    Logger.log('Scheduled digest error: ' + e.message);
  }
}

// Reads the DigestRecipients named range in the Vault spreadsheet —
// edit that named range directly in Sheets to change who gets the
// Monday digest, no code change needed. Returns [] (not an error) if
// the named range is missing or empty, so scheduledWeeklyDigest can
// just skip quietly rather than fail.
function _getDigestRecipients() {
  try {
    const hubSS = SpreadsheetApp.openById(SS_VAULT);
    const named = hubSS.getRangeByName('DigestRecipients');
    if (named) {
      const vals = named.getValues().flat().map(v => String(v || '').trim()).filter(v => v.includes('@'));
      if (vals.length) return vals;
    }
  } catch(e) { Logger.log('_getDigestRecipients error: ' + e.message); }
  return [];
}

// One-time setup — run manually from the Apps Script editor once to
// install the Monday 8am trigger. Safe to re-run: always removes any
// existing trigger with the same handler first so you can't end up
// with duplicates silently sending the digest twice.
function installDigestTrigger() {
  removeDigestTrigger();
  ScriptApp.newTrigger('scheduledWeeklyDigest').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  Logger.log('Weekly digest trigger installed — runs every Monday at 8am.');
}
function removeDigestTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'scheduledWeeklyDigest') ScriptApp.deleteTrigger(t);
  });
}
