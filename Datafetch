// ============================================================
// DataFetch.gs — Runtime spreadsheet I/O
// Reads and writes live data: WIR, overrides, notes, bulk ops, progress snapshots, schedule upload, and email digest. All pure logic lives in Helpers.gs, Parsers.gs, Profiles.gs.
// ============================================================

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

// ── WIR Data ──────────────────────────────────────────────────
// Reads the most recent Weekly Intervention Report sheet from SS_ACADEMIC
function getWIRData() {
  try {
    const ss       = SpreadsheetApp.openById(SS_ACADEMIC);
    const wirSheet = ss.getSheets().find(s => s.getName().startsWith('Weekly Intervention Reports'));
    if (!wirSheet) { Logger.log('getWIRData: no WIR sheet found'); return null; }

    const sheetName = wirSheet.getName();
    const weekLabel = sheetName.includes(':') ? sheetName.split(':')[1].trim() : sheetName;
    const lastRow   = wirSheet.getLastRow();
    if (lastRow < 2) return { weekLabel, sheetName, fetchedAt: _todayStr(), rows: [] };

    const rows = [];
    wirSheet.getRange(2, 1, lastRow - 1, 27).getDisplayValues().forEach(row => {
      const student = String(row[0] || '').trim();
      if (!student || student.toLowerCase() === 'student') return;
      rows.push({
        student,
        status:            String(row[1]  || '').trim(),
        priority:          String(row[2]  || '').trim(),
        percent:           String(row[3]  || '').trim(),
        weeklyTarget:      String(row[4]  || '').trim(),
        thisWeekHours:     row[5] instanceof Date
          ? Utilities.formatDate(row[5], Session.getScriptTimeZone(), 'HH:mm:ss')
          : String(row[5] || '').trim(),
        lastActiveHours:   String(row[6]  || '').trim(),
        lastActiveLabel:   String(row[7]  || '').trim(),
        credits:           String(row[8]  || '').trim(),
        courseDaysLeft:    row[9] !== '' ? row[9] : null,
        issueTags:         String(row[10] || '').trim(),
        detectedPatterns:  String(row[11] || '').trim(),
        adminPriority:     String(row[12] || '').trim(),
        urgency:           String(row[13] || '').trim(),
        instructorAction:  String(row[14] || '').trim(),
        coordinatorAction: String(row[15] || '').trim(),
        reason:            String(row[16] || '').trim(),
        streak:            String(row[17] || '').trim(),
        trajectory:        String(row[18] || '').trim(),
        gradGap:           String(row[19] || '').trim(),
        comments:          String(row[20] || '').trim(),
        caseOwner:         String(row[21] || '').trim(),
        caseStatus:        String(row[22] || '').trim(),
        focus:             String(row[23] || '').trim(),
        followUp:          row[24] instanceof Date ? _toDateStr(row[24]) : String(row[24] || '').trim(),
        caseNotes:         String(row[25] || '').trim(),
        lastUpdated:       row[26] instanceof Date ? _toDateStr(row[26]) : String(row[26] || '').trim(),
      });
    });
    Logger.log('WIR: ' + rows.length + ' rows from "' + sheetName + '"');
    return { weekLabel, sheetName, fetchedAt: _todayStr(), rows };
  } catch(e) {
    Logger.log('getWIRData error: ' + e.message);
    return null;
  }
}

// Appends current WIR rows to the WIR Log sheet, replacing any existing rows for the same week
function appendToWIRLog(wirData, hubSS) {
  if (!wirData || !wirData.rows || !wirData.rows.length) return;
  let logSheet = hubSS.getSheetByName(SHEET_WIR_LOG);
  if (!logSheet) {
    logSheet = hubSS.insertSheet(SHEET_WIR_LOG);
    logSheet.appendRow([
      'Week Label','Fetched Date','Student','Status','Priority','Progress %',
      'Weekly Target','This Week Hours','Last Active Hours','Last Active Label',
      'Credits This Week','Course Days Left','Issue Tags','Detected Patterns',
      'Admin Priority','Urgency','Instructor Action','Coordinator Action','Reason',
      'Comments','Case Owner','Case Status','Focus','Follow Up','Case Notes','Last Updated',
    ]);
    logSheet.setFrozenRows(1);
    logSheet.getRange(1, 1, 1, 26).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
  }

  const weekLabel = wirData.weekLabel;
  const fetchedAt = wirData.fetchedAt || _todayStr();
  const lastRow   = logSheet.getLastRow();

  // Remove existing rows for this week before appending fresh data
  if (lastRow > 1) {
    const labels    = logSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    const matchRows = labels.map((r, i) => String(r[0]).trim() === weekLabel ? i + 2 : null).filter(Boolean);
    matchRows.sort((a, b) => b - a);
    if (matchRows.length) {
      let i = 0;
      while (i < matchRows.length) {
        let j = i;
        while (j + 1 < matchRows.length && matchRows[j] - matchRows[j + 1] === 1) j++;
        logSheet.deleteRows(matchRows[j], j - i + 1);
        i = j + 1;
      }
    }
  }

  const newRows = wirData.rows.map(r => [
    weekLabel, fetchedAt, r.student, r.status, r.priority, r.percent,
    r.weeklyTarget, r.thisWeekHours, r.lastActiveHours, r.lastActiveLabel,
    r.credits, r.courseDaysLeft !== null ? r.courseDaysLeft : '',
    r.issueTags, r.detectedPatterns, r.adminPriority, r.urgency,
    r.instructorAction, r.coordinatorAction, r.reason,
    r.comments, r.caseOwner, r.caseStatus, r.focus,
    r.followUp, r.caseNotes, r.lastUpdated,
  ]);
  if (newRows.length) {
    logSheet.getRange(logSheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
  }
  Logger.log('WIR Log: wrote ' + newRows.length + ' rows for "' + weekLabel + '"');
}

// ── Overrides ─────────────────────────────────────────────────
function setOverride(studentId, type, value, note, setBy, role) {
  _requirePermission(role || ROLES.ADMIN, 'manage_overrides');
  return _withLock(() => {
    const hubSS = SpreadsheetApp.openById(SS_HUB);
    const sheet = _ensureOverridesSheet(hubSS);
    _deleteMatchingRows(sheet, studentId, type);
    if (value !== '' && value !== null && value !== undefined) {
      sheet.appendRow([studentId, type, value, note || '', setBy || '', new Date()]);
    }
    if (type !== 'last_modified') _touchLastModified(hubSS, sheet, studentId, setBy);
    _clearDashboardCache();
    return { success: true };
  });
}

function revertChange(studentId, type, rowIndex, role) {
  _requirePermission(role || ROLES.ADMIN, 'revert_changes');
  return _withLock(() => {
    const hubSS = SpreadsheetApp.openById(SS_HUB);
    const sheet = hubSS.getSheetByName(SHEET_OVERRIDES);
    if (!sheet) throw new Error('Overrides sheet not found.');
    const lastRow = sheet.getLastRow();
    if (rowIndex < OVERRIDES_START_ROW || rowIndex > lastRow) {
      throw new Error('Row no longer exists — it may have already been reverted.');
    }
    const check = sheet.getRange(rowIndex, 1, 1, 2).getValues()[0];
    if (String(check[0]).trim() !== studentId || String(check[1]).trim() !== type) {
      throw new Error('Row has changed since the history was loaded — please refresh.');
    }
    sheet.deleteRow(rowIndex);
    _clearDashboardCache();
    return { success: true };
  });
}

function getRecentChanges() {
  try {
    const hubSS = SpreadsheetApp.openById(SS_HUB);
    const sheet = hubSS.getSheetByName(SHEET_OVERRIDES);
    if (!sheet) return [];
    const lastRow = sheet.getLastRow();
    if (lastRow < OVERRIDES_START_ROW) return [];

    const SKIP_TYPES = new Set(['progress_snapshot', 'last_modified', 'merged_into']);
    const values  = sheet.getRange(OVERRIDES_START_ROW, 1, lastRow - OVERRIDES_START_ROW + 1, 6).getValues();
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
        rowIndex: i + OVERRIDES_START_ROW,
      });
      if (changes.length >= 10) break;
    }
    return changes;
  } catch(e) {
    Logger.log('getRecentChanges error: ' + e.message);
    return [];
  }
}

// ── Notes ─────────────────────────────────────────────────────
function addStudentNote(studentId, noteText, setBy, role) {
  _requirePermission(role || ROLES.ADMIN, 'add_note');
  studentId = String(studentId || '').trim();
  noteText  = String(noteText  || '').trim();
  if (!studentId || !noteText) throw new Error('Student ID and note text are required.');
  return _withLock(() => {
    const hubSS = SpreadsheetApp.openById(SS_HUB);
    const sheet = _ensureOverridesSheet(hubSS);
    sheet.appendRow([studentId, 'note', noteText, '', setBy || 'staff', new Date()]);
    _touchLastModified(hubSS, sheet, studentId, setBy);
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
    const hubSS = SpreadsheetApp.openById(SS_HUB);
    const sheet = hubSS.getSheetByName(SHEET_OVERRIDES);
    if (!sheet) return { success: true };
    const lastRow = sheet.getLastRow();
    if (lastRow < OVERRIDES_START_ROW) return { success: true };
    const data = sheet.getRange(OVERRIDES_START_ROW, 1, lastRow - OVERRIDES_START_ROW + 1, 6).getValues();
    for (let i = data.length - 1; i >= 0; i--) {
      if (String(data[i][0] || '').trim() === studentId && String(data[i][1] || '').trim() === 'note') {
        const rowDate = data[i][5] instanceof Date ? data[i][5].toISOString() : String(data[i][5]);
        if (rowDate === noteTimestamp) { sheet.deleteRow(i + OVERRIDES_START_ROW); break; }
      }
    }
    _clearDashboardCache();
    return { success: true };
  });
}

// ── Bulk operations ───────────────────────────────────────────
function bulkAddNote(studentIds, noteText, setBy, role) {
  _requirePermission(role || ROLES.ADMIN, 'add_note');
  studentIds = (studentIds || []).map(id => String(id).trim()).filter(Boolean);
  noteText   = String(noteText || '').trim();
  if (!studentIds.length || !noteText) throw new Error('Student IDs and note text are required.');
  return _withLock(() => {
    const hubSS = SpreadsheetApp.openById(SS_HUB);
    const sheet = _ensureOverridesSheet(hubSS);
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
    const hubSS   = SpreadsheetApp.openById(SS_HUB);
    const sheet   = _ensureOverridesSheet(hubSS);
    const now     = new Date();
    const idSet   = new Set(studentIds);
    const lastRow = sheet.getLastRow();

    // Remove existing status rows for these students
    const existing = lastRow >= OVERRIDES_START_ROW
      ? sheet.getRange(OVERRIDES_START_ROW, 1, lastRow - OVERRIDES_START_ROW + 1, 2).getValues()
      : [];
    const toDelete = [];
    existing.forEach((row, i) => {
      const rowId   = String(row[0] || '').trim();
      const rowType = String(row[1] || '').trim();
      if (!idSet.has(rowId)) return;
      if (academicStatus && rowType === 'academic_status') toDelete.push(i + OVERRIDES_START_ROW);
      if (tradeStatus    && rowType === 'trade_status')    toDelete.push(i + OVERRIDES_START_ROW);
    });
    toDelete.sort((a, b) => b - a).forEach(row => sheet.deleteRow(row));

    // Write new status rows + last_modified stamps
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

// ── Merge students ────────────────────────────────────────────
function mergeStudents(sourceId, targetId, setBy, role) {
  _requirePermission(role || ROLES.ADMIN, 'merge');
  sourceId = String(sourceId || '').trim();
  targetId = String(targetId || '').trim();
  if (!sourceId || !targetId) throw new Error('Both a source and target student must be selected.');
  if (sourceId === targetId) throw new Error('Cannot merge a student into themselves.');

  return _withLock(() => {
    const hubSS    = SpreadsheetApp.openById(SS_HUB);
    const mapSheet = hubSS.getSheetByName(SHEET_MAPPING);
    if (!mapSheet) throw new Error('Sheet not found: ' + SHEET_MAPPING);

    // Re-point all mapping rows from source to target
    const lastRow  = mapSheet.getLastRow();
    let repointed  = 0;
    if (lastRow >= 2) {
      const ids = mapSheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0] || '').trim() === sourceId) {
          mapSheet.getRange(i + 2, 1).setValue(targetId);
          repointed++;
        }
      }
    }

    // Carry non-duplicate overrides from source to target
    const ovSheet = hubSS.getSheetByName(SHEET_OVERRIDES);
    let carried   = 0;
    if (ovSheet) {
      const ovLastRow = ovSheet.getLastRow();
      if (ovLastRow >= OVERRIDES_START_ROW) {
        const ovData       = ovSheet.getRange(OVERRIDES_START_ROW, 1, ovLastRow - OVERRIDES_START_ROW + 1, 6).getValues();
        const targetTypes  = new Set(ovData.filter(r => String(r[0]).trim() === targetId).map(r => String(r[1]).trim()));
        const toAppend     = [];
        const toDeleteRows = [];
        ovData.forEach((row, i) => {
          const rowId   = String(row[0] || '').trim();
          const rowType = String(row[1] || '').trim();
          if (rowId !== sourceId) return;
          if (rowType === 'merged_into') { toDeleteRows.push(i + OVERRIDES_START_ROW); return; }
          if (!targetTypes.has(rowType)) { toAppend.push([targetId, rowType, row[2], row[3], row[4], row[5]]); carried++; }
          toDeleteRows.push(i + OVERRIDES_START_ROW);
        });
        toDeleteRows.sort((a, b) => b - a).forEach(r => ovSheet.deleteRow(r));
        if (toAppend.length) {
          ovSheet.getRange(ovSheet.getLastRow() + 1, 1, toAppend.length, 6).setValues(toAppend);
        }
      }
    }

    _setOverrideRaw(hubSS, sourceId, 'merged_into', targetId, 'Merged via dashboard', setBy || 'staff');
    const ovSheetForStamp = hubSS.getSheetByName(SHEET_OVERRIDES);
    if (ovSheetForStamp) _touchLastModified(hubSS, ovSheetForStamp, targetId, setBy || 'staff');
    _clearDashboardCache();
    return { success: true, repointedMappingRows: repointed, carriedOverrides: carried };
  });
}

// ── Progress snapshots ────────────────────────────────────────
// Writes weekly risk/progress snapshots used for stale detection and trend arrows
function writeProgressSnapshots(profiles, hubSS) {
  if (!profiles || !profiles.length) return;
  const sheet = hubSS.getSheetByName(SHEET_OVERRIDES);
  if (!sheet) return;

  const todayStr = _todayStr();
  const lastRow  = sheet.getLastRow();
  if (lastRow < OVERRIDES_START_ROW) return;

  const data    = sheet.getRange(OVERRIDES_START_ROW, 1, lastRow - OVERRIDES_START_ROW + 1, 6).getValues();
  const cutoff  = new Date();
  cutoff.setDate(cutoff.getDate() - SNAPSHOT_PRUNE_DAYS);

  const rowsToDelete  = [];
  const retainedSnaps = {};

  data.forEach((row, i) => {
    if (String(row[1]).trim() !== 'progress_snapshot') return;
    const studentId = String(row[0]).trim();
    const d         = row[5] instanceof Date ? row[5] : new Date(row[5]);
    if (isNaN(d.getTime()) || d < cutoff) {
      rowsToDelete.push(i + OVERRIDES_START_ROW);
    } else {
      if (!retainedSnaps[studentId] || d > retainedSnaps[studentId].date) {
        retainedSnaps[studentId] = { rowIndex: i + OVERRIDES_START_ROW, date: d };
      }
    }
  });

  // Batch delete stale rows bottom-up
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

  // Write snapshots only for students that need a fresh one
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
    Logger.log('Snapshots: nothing to write — all up to date');
    return;
  }
  sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 6).setValues(newRows);
  Logger.log('Snapshots: wrote ' + newRows.length + ' new rows');
}

// ── Schedule ──────────────────────────────────────────────────
function getStudentSchedule(studentId) {
  try {
    studentId = String(studentId || '').trim();
    if (!studentId) return { error: 'No student ID.' };

    const cache    = CacheService.getScriptCache();
    const cacheKey = 'schedule_' + studentId;
    const cached   = cache.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch(e) {}
    }

    const hubSS = SpreadsheetApp.openById(SS_HUB);
    const sheet = hubSS.getSheetByName(SHEET_SCHEDULE);
    if (!sheet) return { weekLabel: null, schedule: null };

    const values    = sheet.getDataRange().getValues();
    if (values.length < 2) return { weekLabel: null, schedule: null };

    const weekLabel = String(values[1][0] || '').trim();
    const row       = values.slice(1).find(r => String(r[2] || '').trim() === studentId);

    if (!row) {
      const result = { weekLabel, schedule: null };
      cache.put(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    }

    let schedule = {};
    try { schedule = JSON.parse(String(row[3] || '{}')); } catch(e) { return { weekLabel, schedule: null }; }

    const VALID_PERIODS  = { M:[1,2,3,5,6], T:[1,2,3,5,6,7], W:[1,2,3,5,6], TH:[1,2,3,5,6,7], F:[1,2,3,5,6,7] };
    const DAY_LABELS     = { M:'Monday', T:'Tuesday', W:'Wednesday', TH:'Thursday', F:'Friday' };
    const JS_DAY_MAP     = { 1:'M', 2:'T', 3:'W', 4:'TH', 5:'F' };
    const ACADEMIC_NAMES = ['HSD 2', 'HSD3', 'HSE/HSD1'];

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

    const result = {
      weekLabel, schedule, todaySchedule,
      todayLabel: todayKey ? DAY_LABELS[todayKey] : null,
      expectedWeekHours, expectedTodayHours, isWeekend,
    };
    try { cache.put(cacheKey, JSON.stringify(result), isWeekend ? CACHE_TTL : 300); } catch(e) {}
    return result;
  } catch(e) {
    Logger.log('getStudentSchedule error: ' + e.message);
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
    const VALID_PERIODS = { M:[1,2,3,5,6], T:[1,2,3,5,6,7], W:[1,2,3,5,6], TH:[1,2,3,5,6,7], F:[1,2,3,5,6,7] };

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

    const hubSS    = SpreadsheetApp.openById(SS_HUB);
    let schedSheet = hubSS.getSheetByName(SHEET_SCHEDULE);
    if (!schedSheet) schedSheet = hubSS.insertSheet(SHEET_SCHEDULE);
    schedSheet.clearContents();

    const rows = [['Week', 'Student Name', 'Student ID', 'Schedule JSON']];
    students.forEach(s => rows.push([weekLabel, s.name, s.id, JSON.stringify(s.schedule)]));
    schedSheet.getRange(1, 1, rows.length, 4).setValues(rows);
    schedSheet.getRange(1, 1, 1, 4).setFontWeight('bold');

    const schedCache = CacheService.getScriptCache();
    _cacheRemoveChunked(schedCache, 'dashboardData');
    const cacheKeys = students.map(s => 'schedule_' + s.id);
    for (let i = 0; i < cacheKeys.length; i += 100) schedCache.removeAll(cacheKeys.slice(i, i + 100));

    return { success: true, weekLabel, studentCount: students.length, skipped, skippedCount: skipped.length };
  } catch(e) {
    Logger.log('saveWeeklySchedule error: ' + e.message);
    return { error: 'Failed to save schedule: ' + e.message };
  }
}

// ── Email digest ──────────────────────────────────────────────
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
    const hubSS = SpreadsheetApp.openById(SS_HUB);
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

// ── Override sheet helpers ────────────────────────────────────
function _ensureOverridesSheet(hubSS) {
  let sheet = hubSS.getSheetByName(SHEET_OVERRIDES);
  if (!sheet) {
    sheet = hubSS.insertSheet(SHEET_OVERRIDES);
    sheet.appendRow(['Student ID', 'Override Type', 'Value', 'Note', 'Set By', 'Date']);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
  }
  return sheet;
}

// Deletes all rows matching studentId + type, from bottom up
function _deleteMatchingRows(sheet, studentId, type) {
  const lastRow = sheet.getLastRow();
  if (lastRow < OVERRIDES_START_ROW) return;
  const data     = sheet.getRange(OVERRIDES_START_ROW, 1, lastRow - OVERRIDES_START_ROW + 1, 2).getValues();
  const toDelete = data.map((row, i) => (row[0] === studentId && row[1] === type) ? i + OVERRIDES_START_ROW : null).filter(Boolean);
  toDelete.sort((a, b) => b - a).forEach(rowIdx => sheet.deleteRow(rowIdx));
}

function _touchLastModified(hubSS, sheet, studentId, setBy) {
  _deleteMatchingRows(sheet, studentId, 'last_modified');
  sheet.appendRow([studentId, 'last_modified', new Date().toISOString(), '', setBy || '', new Date()]);
}

function _setOverrideRaw(hubSS, studentId, type, value, note, setBy) {
  const sheet = _ensureOverridesSheet(hubSS);
  _deleteMatchingRows(sheet, studentId, type);
  if (value !== '' && value !== null && value !== undefined) {
    sheet.appendRow([studentId, type, value, note || '', setBy || '', new Date()]);
  }
}
