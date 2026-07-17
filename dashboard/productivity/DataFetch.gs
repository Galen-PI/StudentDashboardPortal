// ==============
// DataFetch.gs — Runtime spreadsheet I/O


// ── Authentication ────────────────────────────────────────────
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
function getWIRData() {
  return getWIRDataFromVault_();
}

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
function setOverride(studentId, type, value, note, setBy, role) {
  _requirePermission(role || ROLES.ADMIN, 'manage_overrides');
  return setOverrideVault_(studentId, type, value, note, setBy);
}

function revertChange(studentId, type, rowIndex, role) {
  _requirePermission(role || ROLES.ADMIN, 'revert_changes');
  return revertChangeVault_(studentId, type, rowIndex);
}

function getRecentChanges() {
  return getRecentChangesVault_();
}

// ── Overrides — VAULT PATH ──────────────────────────────────────
// Same six-column shape and row-per-change model as the legacy
// Hub Overrides sheet — Overrides And Notes is a direct port, not
// a redesign. There's no rowId column here (unlike Transcript
// Rows), so row position is still how a specific row gets located
// for revert/delete, same rowIndex contract as before, just against
// VAULT_SHEET_OVERRIDES_NOTES instead of the Hub sheet.

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

function _deleteMatchingVaultRows_(sheet, studentId, type) {
  const lastRow = sheet.getLastRow();
  if (lastRow < VAULT_DATA_START_ROW) return;
  const data = sheet.getRange(VAULT_DATA_START_ROW, 1, lastRow - VAULT_DATA_START_ROW + 1, 2).getValues();
  const toDelete = data
    .map((row, i) => (String(row[0]).trim() === String(studentId).trim() && String(row[1]).trim() === type) ? i + VAULT_DATA_START_ROW : null)
    .filter(Boolean);
  toDelete.sort((a, b) => b - a).forEach(rowIdx => sheet.deleteRow(rowIdx));
}

function _touchLastModifiedVault_(studentId, setBy) {
  const sheet = _ensureVaultOverridesSheet_();
  _deleteMatchingVaultRows_(sheet, studentId, 'last_modified');
  sheet.appendRow([studentId, 'last_modified', new Date().toISOString(), '', setBy || '', new Date()]);
}

function _setOverrideRawVault_(studentId, type, value, note, setBy) {
  const sheet = _ensureVaultOverridesSheet_();
  _deleteMatchingVaultRows_(sheet, studentId, type);
  if (value !== '' && value !== null && value !== undefined) {
    sheet.appendRow([studentId, type, value, note || '', setBy || '', new Date()]);
  }
}

function setOverrideVault_(studentId, type, value, note, setBy) {
  return _withLock(() => {
    _setOverrideRawVault_(studentId, type, value, note, setBy);
    if (type !== 'last_modified') _touchLastModifiedVault_(studentId, setBy);
    _clearDashboardCache();
    return { success: true };
  });
}

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
    sheet.deleteRow(rowIndex);
    _clearDashboardCache();
    return { success: true };
  });
}

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
        if (rowDate === noteTimestamp) { sheet.deleteRow(i + VAULT_DATA_START_ROW); break; }
      }
    }
    _clearDashboardCache();
    return { success: true };
  });
}

// ============================================================
// ── Bulk operations ──────────────────────────────────────────
// ============================================================
function bulkAddNote(studentIds, noteText, setBy, role) {
  _requirePermission(role || ROLES.ADMIN, 'add_note');
  studentIds = (studentIds || []).map(id => String(id).trim()).filter(Boolean);
  noteText   = String(noteText || '').trim();
  if (!studentIds.length || !noteText) throw new Error('Student IDs and note text are required.');

  return _withLock(() => {
    const sheet = _ensureVaultOverridesSheet_();
    const now   = new Date();
    const noteRows  = studentIds.map(id => [id, 'note',          noteText,             '', setBy || 'staff', now]);
    const stampRows = studentIds.map(id => [id, 'last_modified', now.toISOString(), '', setBy || '',       now]);
    const allRows   = [...noteRows, ...stampRows];
    if (allRows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, allRows.length, 6).setValues(allRows);
    }
    _clearDashboardCache();
    return { success: true, count: studentIds.length };
  });
}

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
    const toDelete = [];
    existing.forEach((row, i) => {
      const rowId   = String(row[0] || '').trim();
      const rowType = String(row[1] || '').trim();
      if (!idSet.has(rowId)) return;
      if (academicStatus && rowType === 'academic_status') toDelete.push(i + VAULT_DATA_START_ROW);
      if (tradeStatus    && rowType === 'trade_status')    toDelete.push(i + VAULT_DATA_START_ROW);
    });
    toDelete.sort((a, b) => b - a).forEach(row => sheet.deleteRow(row));

    const newRows   = [];
    const stampRows = studentIds.map(id => [id, 'last_modified', now.toISOString(), '', setBy || '', now]);
    studentIds.forEach(id => {
      if (academicStatus) newRows.push([id, 'academic_status', academicStatus, '', setBy || 'staff', now]);
      if (tradeStatus)    newRows.push([id, 'trade_status',    tradeStatus,    '', setBy || 'staff', now]);
    });
    const allRows = [...newRows, ...stampRows];
    if (allRows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, allRows.length, 6).setValues(allRows);
    }
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

    // Re-point all mapping rows from source to target
    const lastRow  = mapSheet.getLastRow();
    let repointed  = 0;
    if (lastRow >= VAULT_DATA_START_ROW) {
      const ids = mapSheet.getRange(VAULT_DATA_START_ROW, 1, lastRow - VAULT_DATA_START_ROW + 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0] || '').trim() === sourceId) {
          mapSheet.getRange(i + VAULT_DATA_START_ROW, 1).setValue(targetId);
          repointed++;
        }
      }
    }

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
      toDeleteRows.sort((a, b) => b - a).forEach(r => ovSheet.deleteRow(r));
      if (toAppend.length) {
        ovSheet.getRange(ovSheet.getLastRow() + 1, 1, toAppend.length, 6).setValues(toAppend);
      }
    }

    _setOverrideRawVault_(sourceId, 'merged_into', targetId, 'Merged via dashboard', setBy || 'staff');
    _touchLastModifiedVault_(targetId, setBy || 'staff');
    _clearDashboardCache();
    return { success: true, repointedMappingRows: repointed, carriedOverrides: carried };
  });
}

// ============================================================
// ── Progress snapshots ───────────────────────────────────────
// ============================================================
// Writes weekly risk/progress snapshots used for stale detection and trend arrows
function writeProgressSnapshots(profiles, hubSS) {
  return writeProgressSnapshotsVault_(profiles);
}

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
      sheet.deleteRows(sorted[j], j - i + 1);
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

  let expectedWeekHours = 0;
  Object.entries(VALID_PERIODS).forEach(([day, validPeriods]) => {
    validPeriods.forEach(periodNum => {
      const entry = (schedule['Period ' + periodNum] || {})[day];
      if (!entry) return;
      if (ACADEMIC_NAMES.some(n => (entry.class || '').toLowerCase().includes(n.toLowerCase()))) {
        expectedWeekHours++;
      }
    });
  });

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

function saveWeeklySchedule(base64Data, role) {
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
    let students  = [];
    let skipped   = [];

    if (isMaster) {
      const DAY_COLS = { M:3, T:5, W:6, TH:7, F:8 };
      allSheets.forEach(sheet => {
        const values = sheet.getDataRange().getValues();
        if (weekLabel === 'This Week') {
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
      const match  = String(values[0][2] || '').match(/As Of:\s+\w+,\s+(\w+\s+\d+,\s+\d+)/);
      if (match) {
        const d = new Date(match[1]);
        if (!isNaN(d.getTime())) {
          const day = d.getDay();
          const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
          const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
          const fmt = dt => (dt.getMonth() + 1) + '/' + dt.getDate();
          weekLabel = fmt(mon) + ' – ' + fmt(fri) + '/' + fri.getFullYear();
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

    return _writeWeeklyScheduleToVault_(students, weekLabel, skipped);
  } catch(e) {
    Logger.log('saveWeeklySchedule error: ' + e.message);
    return { error: 'Failed to save schedule: ' + e.message };
  }
}

// ── Weekly Schedule write — VAULT PATH ──────────────────────────
// Auto-registers any student appearing in a schedule upload who
// isn't already in Name Mapping — previously only Roster Upload
// could add a new student; a student who shows up on a schedule
// before ever appearing on a roster export would otherwise be
// silently dropped (their Weekly Schedule row would get written,
// but nothing else in the app would recognize them, since Name
// Mapping is the join key for almost everything). New rows are
// added with active:true and blank tradeComplete/academicComplete/
// examProgram — the same "unknown yet, fill in later" state
// Roster Upload uses for a brand-new student. This never touches
// or overwrites an existing Name Mapping row for a student who's
// already there.
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

function _writeWeeklyScheduleToVault_(students, weekLabel, skipped) {
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

    // 2. Delete displaced 'last' rows bottom-up.
    rowsToDelete.sort((a, b) => b - a).forEach(rowNum => sheet.deleteRow(rowNum));

    // 3. Append new 'current' rows.
    if (rowsToAppend.length) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rowsToAppend.length, numCols).setValues(rowsToAppend);
      // Guard against Sheets auto-converting studentId/weekLabel-looking
      // strings to numbers/dates — same fix already applied in WIR Reports.
      sheet.getRange(startRow, 1, rowsToAppend.length, 2).setNumberFormat('@');
    }

    const schedCache = CacheService.getScriptCache();
    _cacheRemoveChunked(schedCache, 'dashboardData');
    const cacheKeys = students.map(s => 'schedule_' + s.id);
    for (let i = 0; i < cacheKeys.length; i += 100) schedCache.removeAll(cacheKeys.slice(i, i + 100));

    return { success: true, weekLabel, studentCount: students.length, skipped, skippedCount: skipped.length };
  });
}

// ============================================================
// ── Email digest ─────────────────────────────────────────────
// ============================================================
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
