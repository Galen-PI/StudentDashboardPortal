// ============================================================
// Transcripts.gs — Read/write student transcript data
// ============================================================

const SETTINGS_DEFAULTS = {
  weeklyHours: 10,
  activeWeeks: { w1: true, w2: true, w3: true, w4: true }
};

// ============================================================
// SECTION 1 — READ
// ============================================================

function getStudentTranscript(studentId) {
  try {
    const rows = readVaultRowsForStudent_(
      VAULT_SHEET_TRANSCRIPT_ROWS,
      VAULT_TRANSCRIPT_HEADERS,
      studentId
    );
    const courses = rows.map(row => ({
      rowId:         row.rowId,
      block:         Number(row.block) || 1,   // rows with no value default to Year 1
      sourceTabName: String(row.sourceTabName || '').trim(),
      courseId:      String(row.courseId || '').trim(),
      courseName:    String(row.courseName || '').trim(),
      instance:      String(row.instance || '').trim(),
      transfer:      row.transfer === true,
      subject:       String(row.subject || '').trim(),
      credit:        Number(row.credit) || 0,
      classHours:    Number(row.classHours) || 0,
      startDate:     row.startDate || null,
      adjStart:      row.adjStart || null,
      targetDate:    row.targetDate || null,
      completed:     row.completed === true
    }));

    const settings = getTranscriptSettings_(studentId);
    return {
      success:        true,
      studentId:      String(studentId).trim(),
      courses:        courses,
      settings:       settings,
      settingsSource: USE_HUB_SETTINGS ? 'hub' : 'academic_tracker'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}


// ============================================================
// SECTION 2 — SETTINGS
// ============================================================
function getTranscriptSettings_(studentId) {
  const id = String(studentId || '').trim();
  if (!id) return SETTINGS_DEFAULTS;
  try {
    const rows = readVaultRowsForStudent_(VAULT_SHEET_STUDENT_PACING, VAULT_STUDENT_PACING_HEADERS, id);
    if (!rows.length) return SETTINGS_DEFAULTS;
    const row = rows[0];
    const hours = Number(row.weeklyHours);
    return {
      weeklyHours: isFinite(hours) && hours > 0 ? hours : SETTINGS_DEFAULTS.weeklyHours,
      activeWeeks: {
        w1: row.w1 === true || String(row.w1).toUpperCase() === 'TRUE',
        w2: row.w2 === true || String(row.w2).toUpperCase() === 'TRUE',
        w3: row.w3 === true || String(row.w3).toUpperCase() === 'TRUE',
        w4: row.w4 === true || String(row.w4).toUpperCase() === 'TRUE',
      }
    };
  } catch (err) {
    Logger.log('getTranscriptSettings_ error: ' + err.message);
    return SETTINGS_DEFAULTS;
  }
}

function saveTranscriptSettings(studentId, settings) {
  const id = String(studentId || '').trim();
  if (!id) return { success: false, error: 'Student ID is required.' };

  try {
    return _withLock(() => {
      const sheet   = getVaultSheet_(VAULT_SHEET_STUDENT_PACING);
      const lastRow = sheet.getLastRow();
      const numCols = VAULT_STUDENT_PACING_HEADERS.length;
      let existingRowNum = null;
      if (lastRow >= VAULT_DATA_START_ROW) {
        const ids = sheet.getRange(VAULT_DATA_START_ROW, 1, lastRow - VAULT_DATA_START_ROW + 1, 1).getValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0] || '').trim() === id) { existingRowNum = VAULT_DATA_START_ROW + i; break; }
        }
      }
      const weeklyHours = settings.weeklyHours || SETTINGS_DEFAULTS.weeklyHours;
      const weeks = settings.activeWeeks || SETTINGS_DEFAULTS.activeWeeks;
      const row = [
        id, weeklyHours,
        weeks.w1 === true, weeks.w2 === true, weeks.w3 === true, weeks.w4 === true,
        new Date().toISOString(),
      ];

      if (existingRowNum) {
        sheet.getRange(existingRowNum, 1, 1, numCols).setValues([row]);
      } else {
        sheet.getRange(sheet.getLastRow() + 1, 1, 1, numCols).setValues([row]);
      }
      sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), 1).setNumberFormat('@');
      SpreadsheetApp.flush();
      logTranscriptWriteVault_(id, 'pacing', 'SETTINGS_UPDATED',
        `Student ${id}: ${weeklyHours}hrs, W1=${weeks.w1}, W2=${weeks.w2}, W3=${weeks.w3}, W4=${weeks.w4}`);

      return { success: true, studentId: id };
    });

  } catch (err) {
    return { success: false, error: err.message };
  }
}


// ============================================================
// SECTION 3 — SAVE EXISTING ROW
// ============================================================

function saveTranscriptRow(studentId, rowData) {
  try {
    if (!rowData.rowId) {
      return { success: false, error: 'rowId is required to save an existing row.' };
    }
    return _withLock(() => {
      const sheet = getVaultSheet_(VAULT_SHEET_TRANSCRIPT_ROWS);
      const lastRow = sheet.getLastRow();
      if (lastRow < VAULT_DATA_START_ROW) {
        return { success: false, error: 'Transcript Rows is empty.' };
      }
      const numRows = lastRow - VAULT_DATA_START_ROW + 1;
      const data = sheet.getRange(VAULT_DATA_START_ROW, 1, numRows, VAULT_TRANSCRIPT_HEADERS.length).getValues();
      const targetId = String(studentId).trim();
      const targetRowId = String(rowData.rowId).trim();
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]).trim() !== targetId) continue;
        if (String(data[i][2]).trim() !== targetRowId) continue; // col index 2 = rowId (studentId, sourceTabName, rowId, ...)
        const sheetRow = VAULT_DATA_START_ROW + i;
        const values = buildVaultRowValues_(targetId, targetRowId, rowData);
        sheet.getRange(sheetRow, 1, 1, VAULT_TRANSCRIPT_HEADERS.length).setValues([values]);
        sheet.getRange(sheetRow, 11, 1, 3).setNumberFormat('@');

        logTranscriptWriteVault_(targetId, targetRowId, 'UPDATED', rowData.courseName);

        return { success: true, rowId: targetRowId, studentId: targetId };
      }
      return { success: false, error: 'Row not found — studentId ' + targetId + ', rowId ' + targetRowId };
    });

  } catch (err) {
    return { success: false, error: err.message };
  }
}
function saveTranscriptRows(studentId, rowsArray) {
  try {
    if (!Array.isArray(rowsArray) || !rowsArray.length) {
      return { success: false, error: 'No rows to save.' };
    }
    return _withLock(() => {
      const sheet = getVaultSheet_(VAULT_SHEET_TRANSCRIPT_ROWS);
      const lastRow = sheet.getLastRow();
      if (lastRow < VAULT_DATA_START_ROW) {
        return { success: false, error: 'Transcript Rows is empty.' };
      }
      const numRows = lastRow - VAULT_DATA_START_ROW + 1;
      const data = sheet.getRange(VAULT_DATA_START_ROW, 1, numRows, VAULT_TRANSCRIPT_HEADERS.length).getValues();
      const targetId = String(studentId).trim();
      const results = rowsArray.map(rowData => {
        const targetRowId = String(rowData.rowId || '').trim();
        if (!targetRowId) return { success: false, rowId: null, error: 'rowId is required.' };

        for (let i = 0; i < data.length; i++) {
          if (String(data[i][0]).trim() !== targetId) continue;
          if (String(data[i][2]).trim() !== targetRowId) continue;

          const sheetRow = VAULT_DATA_START_ROW + i;
          const values = buildVaultRowValues_(targetId, targetRowId, rowData);
          sheet.getRange(sheetRow, 1, 1, VAULT_TRANSCRIPT_HEADERS.length).setValues([values]);
          sheet.getRange(sheetRow, 11, 1, 3).setNumberFormat('@');

          logTranscriptWriteVault_(targetId, targetRowId, 'UPDATED', rowData.courseName);
          return { success: true, rowId: targetRowId };
        }
        return { success: false, rowId: targetRowId, error: 'Row not found.' };
      });

      const failed = results.filter(r => !r.success);
      return {
        success: failed.length === 0,
        results,
        studentId: targetId,
        error: failed.length ? (failed.length + ' of ' + results.length + ' rows failed to save.') : null,
      };
    });

  } catch (err) {
    return { success: false, error: err.message };
  }
}


// ============================================================
// SECTION 4 — ADD NEW ROW
// ============================================================

function addTranscriptRow(studentId, rowData) {
  try {
    const targetId = String(studentId).trim();
    const newRowId = targetId + '_' + Utilities.getUuid();
    const values = buildVaultRowValues_(targetId, newRowId, rowData);
    return _withLock(() => {
      const sheet = getVaultSheet_(VAULT_SHEET_TRANSCRIPT_ROWS);
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, VAULT_TRANSCRIPT_HEADERS.length).setValues([values]);
      sheet.getRange(sheet.getLastRow(), 1, 1, 2).setNumberFormat('@');
      sheet.getRange(sheet.getLastRow(), 11, 1, 3).setNumberFormat('@');

      logTranscriptWriteVault_(targetId, newRowId, 'ADDED', rowData.courseName);

      return { success: true, rowId: newRowId, studentId: targetId };
    });

  } catch (err) {
    return { success: false, error: err.message };
  }
}
function addTranscriptRows(studentId, rowsArray) {
  try {
    const targetId = String(studentId).trim();
    if (!Array.isArray(rowsArray) || !rowsArray.length) {
      return { success: false, error: 'No rows to add.' };
    }

    const newRowIds = rowsArray.map(() => targetId + '_' + Utilities.getUuid());
    const valueRows = rowsArray.map((rowData, i) => buildVaultRowValues_(targetId, newRowIds[i], rowData));

    return _withLock(() => {
      const sheet     = getVaultSheet_(VAULT_SHEET_TRANSCRIPT_ROWS);
      const startRow  = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, valueRows.length, VAULT_TRANSCRIPT_HEADERS.length).setValues(valueRows);

      // Same text-format guards as the single-row path, applied across
      // the whole written block in one call instead of per row.
      sheet.getRange(startRow, 1, valueRows.length, 2).setNumberFormat('@');
      sheet.getRange(startRow, 11, valueRows.length, 3).setNumberFormat('@');

      rowsArray.forEach((rowData, i) => {
        logTranscriptWriteVault_(targetId, newRowIds[i], 'ADDED', rowData.courseName);
      });

      return { success: true, rowIds: newRowIds, studentId: targetId };
    });

  } catch (err) {
    return { success: false, error: err.message };
  }
}


// ============================================================
// SECTION 5 — COURSE CATALOGUE READER
// ============================================================

function getCourseCatalogue() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get('VAULT_COURSE_CATALOGUE');
    if (cached) return JSON.parse(cached);

    const rows = readVaultSheetAsObjects_(VAULT_SHEET_COURSE_CATALOGUE, VAULT_COURSE_CATALOGUE_HEADERS);

    const courses = rows
      .filter(row => row.className && row.classId)
      .map(row => ({
        className: String(row.className).trim(),
        category:  String(row.category || '').trim(),
        classId:   String(row.classId).trim()
      }));

    const result = { success: true, courses: courses };

    try {
      cache.put('VAULT_COURSE_CATALOGUE', JSON.stringify(result), 1800);
    } catch (e) {}

    return result;

  } catch (err) {
    return { success: false, error: err.message };
  }
}


// ============================================================
// SECTION 6 — MASTER SCHEDULE HOURS READEr
// ============================================================

function getMasterScheduleHours() {
  try {
    const cache  = CacheService.getScriptCache();
    const cached = cache.get('VAULT_MASTER_SCHEDULE_HOURS');
    if (cached) return JSON.parse(cached);

    const rows = readVaultSheetAsObjects_(VAULT_SHEET_CLASSES_ORDER, VAULT_CLASSES_ORDER_HEADERS);

    const hours = {};
    rows.forEach(row => {
      const courseName = String(row.courseName || '').trim();
      if (!courseName) return;
      hours[courseName] = {
        hours:        Number(row.hours) || 0,
        units:        Number(row.units) || 0,
        lessons:      Number(row.lessons) || 0,
        minimumHours: Number(row.minimumHours) || 0
      };
    });

    const result = { success: true, hours: hours };

    try {
      cache.put('VAULT_MASTER_SCHEDULE_HOURS', JSON.stringify(result), 1800);
    } catch (e) {}

    return result;

  } catch (err) {
    return { success: false, error: err.message };
  }
}


// ============================================================
// SECTION 7 — HELPERS
// ============================================================
function buildVaultRowValues_(studentId, rowId, rowData) {
  return [
    studentId,
    rowData.sourceTabName || '',
    rowId,
    rowData.courseId    || '',
    rowData.courseName  || '',
    rowData.instance    || '',
    rowData.transfer    === true ? true : false,
    rowData.subject     || '',
    Number(rowData.credit)     || 0,
    Number(rowData.classHours) || 0,
    rowData.startDate  || '',
    rowData.adjStart   || '',
    rowData.targetDate || '',
    rowData.completed  === true ? true : false,
    new Date().toISOString(),
    rowData.block === 2 ? 2 : 1,
  ];
}

// Writes to Vault's Transcript Log, keyed by studentId + rowId.
function logTranscriptWriteVault_(studentId, rowId, action, detail) {
  try {
    const sheet = getVaultSheet_(VAULT_SHEET_TRANSCRIPT_LOG);
    sheet.appendRow([new Date().toISOString(), studentId, action, rowId, detail || '']);
  } catch (e) {
    // Non-fatal — log failure never surfaces to user
  }
}


// ============================================================
// SECTION 8 — TARGET DATE ENGINE (CLIENT-SIDE PORT)
// Pure calculation, no data source dependency.
// ============================================================

function calculateTargetDateJS(courseHours, startDateStr, settings) {
  // This function is called client-side in the dashboard HTML.
  // Duplicated here for reference and server-side testing.

  if (!startDateStr || !courseHours || courseHours <= 0) return null;

  const startDate = new Date(startDateStr);
  if (isNaN(startDate.getTime())) return null;

  const weeklyHours  = settings.weeklyHours || SETTINGS_DEFAULTS.weeklyHours;
  const allowedWeeks = settings.activeWeeks || SETTINGS_DEFAULTS.activeWeeks;

  const hasActiveWeek = allowedWeeks.w1 || allowedWeeks.w2 ||
                        allowedWeeks.w3 || allowedWeeks.w4;
  if (!hasActiveWeek) return null;

  let remainingHours = courseHours;
  let cursor         = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  let safety = 0;

  while (remainingHours > 0 && safety++ < 5000) {
    const dayOfMonth = cursor.getDate();
    const week       = dayOfMonth <= 7  ? 1
                     : dayOfMonth <= 14 ? 2
                     : dayOfMonth <= 21 ? 3 : 4;
    const isWeekday  = cursor.getDay() >= 1 && cursor.getDay() <= 5;
    const weekKey    = 'w' + week;

    if (isWeekday && allowedWeeks[weekKey]) {
      const weekdaysInWeek = countWeekdaysInMonthWeek_JS(cursor, week);
      if (weekdaysInWeek > 0) remainingHours -= weeklyHours / weekdaysInWeek;
    }

    if (remainingHours <= 0) break;
    cursor.setDate(cursor.getDate() + 1);
  }

  if (remainingHours > 0) return null;

  const y = cursor.getFullYear();
  const m = String(cursor.getMonth() + 1).padStart(2, '0');
  const d = String(cursor.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function countWeekdaysInMonthWeek_JS(date, week) {
  const year     = date.getFullYear();
  const month    = date.getMonth();
  const startDay = week === 1 ? 1  : week === 2 ? 8  : week === 3 ? 15 : 22;
  const lastDay  = new Date(year, month + 1, 0).getDate();
  const endDay   = week === 1 ? 7  : week === 2 ? 14 : week === 3 ? 21 : lastDay;

  let count = 0;
  for (let day = startDay; day <= endDay; day++) {
    const d = new Date(year, month, day).getDay();
    if (d >= 1 && d <= 5) count++;
  }
  return count;
}


// ============================================================
// SECTION 9 — TEST FUNCTIONS
// ============================================================

function testGetTranscript() {
  const result = getStudentTranscript('2082094'); // adjust to a real studentId in Vault
  Logger.log(JSON.stringify(result, null, 2));
}

function testAddTranscriptRow() {
  const result = addTranscriptRow('TEST_STUDENT_0001', {
    courseId:   'TEST-101',
    courseName: 'Test Course — safe to delete',
    instance:   '1',
    transfer:   false,
    subject:    'Electives',
    credit:     0.5,
    classHours: 40,
    startDate:  '2026-07-09',
    adjStart:   '',
    targetDate: '2026-08-09',
    completed:  false,
    block:      1
  });
  Logger.log(JSON.stringify(result, null, 2));
  // Note the returned rowId — use it in testSaveTranscriptRow below.
}

function testSaveTranscriptRow(rowIdFromAddTest) {
  const result = saveTranscriptRow('TEST_STUDENT_0001', {
    rowId:      rowIdFromAddTest,
    courseId:   'TEST-101',
    courseName: 'Test Course — UPDATED',
    instance:   '1',
    transfer:   false,
    subject:    'Electives',
    credit:     0.5,
    classHours: 40,
    startDate:  '2026-07-09',
    adjStart:   '',
    targetDate: '2026-08-09',
    completed:  true,
    block:      1
  });
  Logger.log(JSON.stringify(result, null, 2));
}

function testGetSettings() {
  const result = getStudentTranscript('2082094');
  Logger.log('Settings source: ' + result.settingsSource);
  Logger.log('Settings: ' + JSON.stringify(result.settings, null, 2));
}

function testSaveSettings() {
  const result = saveTranscriptSettings('2082094', {
    weeklyHours: 10,
    activeWeeks: { w1: true, w2: false, w3: true, w4: false }
  });
  Logger.log(JSON.stringify(result, null, 2));
}

function testTargetDateEngine() {
  const result = calculateTargetDateJS(49, '2026-01-06', {
    weeklyHours: 10,
    activeWeeks: { w1: true, w2: true, w3: true, w4: true }
  });
  Logger.log('Target date: ' + result);
}

function testGetCourseCatalogue() {
  const result = getCourseCatalogue();
  Logger.log('Course count: ' + (result.courses ? result.courses.length : 0));
  Logger.log(JSON.stringify(result.courses ? result.courses.slice(0, 3) : result, null, 2));
}

function testGetMasterScheduleHours() {
  const result = getMasterScheduleHours();
  const keys = result.hours ? Object.keys(result.hours) : [];
  Logger.log('Course count: ' + keys.length);
  if (keys.length) Logger.log('Sample: ' + keys[0] + ' -> ' + JSON.stringify(result.hours[keys[0]]));
}
