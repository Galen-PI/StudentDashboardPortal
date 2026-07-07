// ============================================================
// Transcripts.gs — Read/write student transcript data
// from SS_ACADEMIC student tabs
//
// Settings migration: reads/writes from SS_HUB Name Mapping
// when USE_HUB_SETTINGS = true in Config.gs.
// Both sources work simultaneously during transition.
// ============================================================

// ── Constants ─────────────────────────────────────────────────
const TRANSCRIPT_COL = {
  CLASS_NUMBER:  1,   // A
  COURSE_ID:     2,   // B
  COURSE_NAME:   3,   // C
  INSTANCE:      4,   // D
  TRANSFER:      5,   // E
  SUBJECT:       6,   // F
  CREDIT:        7,   // G
  CLASS_HOURS:   8,   // H
  START_DATE:    9,   // I
  ADJ_START:    10,   // J
  TARGET_DATE:  11,   // K
  COMPLETED:    12    // L
};

const TRANSCRIPT_BLOCKS = [
  { start: 3,  end: 26, year: 1 },
  { start: 55, end: 77, year: 2 }
];

const TRANSCRIPT_SETTINGS_KEY = 'WEEKMAP';

const SETTINGS_DEFAULTS = {
  weeklyHours: 10,
  activeWeeks: { w1: true, w2: true, w3: true, w4: true }
};


// ============================================================
// SECTION 1 — MAIN READ FUNCTION
// ============================================================

function getStudentTranscript(studentId) {
  try {
    const studentName = getStudentNameById_(studentId);
    if (!studentName) {
      return { success: false, error: 'Student not found in Name Mapping: ' + studentId };
    }
    const ss    = SpreadsheetApp.openById(SS_ACADEMIC);
    const sheet = ss.getSheetByName(studentName);
    if (!sheet) {
      return { success: false, error: 'No transcript sheet found for: ' + studentName };
    }
    const courses = [];
    TRANSCRIPT_BLOCKS.forEach(block => {
      const rows = readTranscriptBlock_(sheet, block);
      rows.forEach(row => courses.push(row));
    });
    const settings = getTranscriptSettings_(studentId, studentName);
    return {
      success:     true,
      studentId:   studentId,
      studentName: studentName,
      courses:     courses,
      settings:    settings,
      settingsSource: USE_HUB_SETTINGS ? 'hub' : 'academic_tracker'
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}


// ============================================================
// SECTION 2 — BLOCK READER
// ============================================================

function readTranscriptBlock_(sheet, block) {
  const numRows = block.end - block.start + 1;
  const numCols = 12;
  const rows    = [];

  const data = sheet.getRange(block.start, 1, numRows, numCols).getValues();

  data.forEach((row, i) => {
    const courseName = String(row[TRANSCRIPT_COL.COURSE_NAME - 1] || '').trim();
    if (!courseName) return; // skip empty rows

    const startDate  = row[TRANSCRIPT_COL.START_DATE  - 1];
    const adjStart   = row[TRANSCRIPT_COL.ADJ_START   - 1];
    const targetDate = row[TRANSCRIPT_COL.TARGET_DATE - 1];

    rows.push({
      rowIndex:    block.start + i,
      block:       block.year,
      classNumber: row[TRANSCRIPT_COL.CLASS_NUMBER - 1] || '',
      courseId:    String(row[TRANSCRIPT_COL.COURSE_ID   - 1] || '').trim(),
      courseName:  courseName,
      instance:    String(row[TRANSCRIPT_COL.INSTANCE    - 1] || '').trim(),
      transfer:    row[TRANSCRIPT_COL.TRANSFER   - 1] === true,
      subject:     String(row[TRANSCRIPT_COL.SUBJECT     - 1] || '').trim(),
      credit:      Number(row[TRANSCRIPT_COL.CREDIT      - 1]) || 0,
      classHours:  Number(row[TRANSCRIPT_COL.CLASS_HOURS - 1]) || 0,
      startDate:   startDate instanceof Date ? formatDate_(startDate) : null,
      adjStart:    adjStart  instanceof Date ? formatDate_(adjStart)  : null,
      targetDate:  targetDate instanceof Date ? formatDate_(targetDate) : null,
      completed:   row[TRANSCRIPT_COL.COMPLETED  - 1] === true
    });
  });

  return rows;
}


// ============================================================
// SECTION 3 — SETTINGS (FEATURE-FLAGGED)
//
// USE_HUB_SETTINGS = false → reads from Academic Tracker
//                            ScriptProperties (current behavior)
// USE_HUB_SETTINGS = true  → reads from SS_HUB Name Mapping
//                            columns G-K
// ============================================================

function getTranscriptSettings_(studentId, studentName) {
  if (USE_HUB_SETTINGS) {
    return getSettingsFromHub_(studentId);
  } else {
    return getSettingsFromAcademicTracker_(studentName);
  }
}

function saveTranscriptSettings(studentId, settings) {
  if (USE_HUB_SETTINGS) {
    return saveSettingsToHub_(studentId, settings);
  } else {
    return saveSettingsToAcademicTracker_(studentId, settings);
  }
}

// ── Hub reader ────────────────────────────────────────────────

function getSettingsFromHub_(studentId) {
  try {
    const ss      = SpreadsheetApp.openById(SS_HUB);
    const sheet   = ss.getSheetByName(SHEET_MAPPING);
    if (!sheet) return SETTINGS_DEFAULTS;

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return SETTINGS_DEFAULTS;

    // Read all columns A-S (19 cols — existing A-N plus new O-S)
    const data = sheet.getRange(2, 1, lastRow - 1, NM_COL_W4).getValues();

    for (let i = 0; i < data.length; i++) {
      if (String(data[i][NM_COL_ID - 1]).trim() !== String(studentId).trim()) continue;

      const hours = Number(data[i][NM_COL_WEEKLY_HOURS - 1]);

      return {
        weeklyHours: isFinite(hours) && hours > 0 ? hours : SETTINGS_DEFAULTS.weeklyHours,
        activeWeeks: {
          w1: data[i][NM_COL_W1 - 1] === true || data[i][NM_COL_W1 - 1] === 'TRUE',
          w2: data[i][NM_COL_W2 - 1] === true || data[i][NM_COL_W2 - 1] === 'TRUE',
          w3: data[i][NM_COL_W3 - 1] === true || data[i][NM_COL_W3 - 1] === 'TRUE',
          w4: data[i][NM_COL_W4 - 1] === true || data[i][NM_COL_W4 - 1] === 'TRUE'
        }
      };
    }

    // Student not found in Hub — return defaults
    return SETTINGS_DEFAULTS;

  } catch (err) {
    Logger.log('getSettingsFromHub_ error: ' + err.message);
    return SETTINGS_DEFAULTS;
  }
}

// ── Hub writer ────────────────────────────────────────────────

function saveSettingsToHub_(studentId, settings) {
  try {
    const ss      = SpreadsheetApp.openById(SS_HUB);
    const sheet   = ss.getSheetByName(SHEET_MAPPING);
    if (!sheet) return { success: false, error: 'Name Mapping sheet not found' };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, error: 'Name Mapping is empty' };

    const ids = sheet.getRange(2, NM_COL_ID, lastRow - 1, 1).getValues();

    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() !== String(studentId).trim()) continue;

      const rowNum = i + 2;

      sheet.getRange(rowNum, NM_COL_WEEKLY_HOURS).setValue(settings.weeklyHours || SETTINGS_DEFAULTS.weeklyHours);
      sheet.getRange(rowNum, NM_COL_W1).setValue(settings.activeWeeks.w1 === true);
      sheet.getRange(rowNum, NM_COL_W2).setValue(settings.activeWeeks.w2 === true);
      sheet.getRange(rowNum, NM_COL_W3).setValue(settings.activeWeeks.w3 === true);
      sheet.getRange(rowNum, NM_COL_W4).setValue(settings.activeWeeks.w4 === true);

      SpreadsheetApp.flush();

      logTranscriptWrite_(
        'Hub Settings',
        rowNum,
        'SETTINGS_UPDATED',
        `Student ${studentId}: ${settings.weeklyHours}hrs, W1=${settings.activeWeeks.w1}, W2=${settings.activeWeeks.w2}, W3=${settings.activeWeeks.w3}, W4=${settings.activeWeeks.w4}`
      );

      return { success: true, studentId: studentId };
    }

    return { success: false, error: 'Student ID not found in Name Mapping: ' + studentId };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Academic Tracker reader (current / fallback) ──────────────

function getSettingsFromAcademicTracker_(studentName) {
  try {
    const props = PropertiesService.getScriptProperties();
    const key   = (k) => `${TRANSCRIPT_SETTINGS_KEY}::${studentName}::${k}`;

    const hours = Number(props.getProperty(key('hours')));

    return {
      weeklyHours: isFinite(hours) && hours > 0 ? hours : SETTINGS_DEFAULTS.weeklyHours,
      activeWeeks: {
        w1: props.getProperty(key('w1')) !== 'false',
        w2: props.getProperty(key('w2')) !== 'false',
        w3: props.getProperty(key('w3')) !== 'false',
        w4: props.getProperty(key('w4')) !== 'false'
      }
    };
  } catch (err) {
    return SETTINGS_DEFAULTS;
  }
}

// ── Academic Tracker writer (current / fallback) ──────────────

function saveSettingsToAcademicTracker_(studentId, settings) {
  try {
    const studentName = getStudentNameById_(studentId);
    if (!studentName) return { success: false, error: 'Student not found: ' + studentId };

    const props = PropertiesService.getScriptProperties();
    const key   = (k) => `${TRANSCRIPT_SETTINGS_KEY}::${studentName}::${k}`;

    props.setProperty(key('hours'), String(settings.weeklyHours || SETTINGS_DEFAULTS.weeklyHours));
    props.setProperty(key('w1'),    String(settings.activeWeeks.w1 === true));
    props.setProperty(key('w2'),    String(settings.activeWeeks.w2 === true));
    props.setProperty(key('w3'),    String(settings.activeWeeks.w3 === true));
    props.setProperty(key('w4'),    String(settings.activeWeeks.w4 === true));

    return { success: true, studentId: studentId };

  } catch (err) {
    return { success: false, error: err.message };
  }
}


// ============================================================
// SECTION 4 — SAVE EXISTING TRANSCRIPT ROW
// ============================================================

function saveTranscriptRow(studentId, rowData) {
  try {
    const studentName = getStudentNameById_(studentId);
    if (!studentName) {
      return { success: false, error: 'Student not found: ' + studentId };
    }

    const ss    = SpreadsheetApp.openById(SS_ACADEMIC);
    const sheet = ss.getSheetByName(studentName);
    if (!sheet) {
      return { success: false, error: 'No transcript sheet found for: ' + studentName };
    }

    const rowIndex = Number(rowData.rowIndex);
    if (!rowIndex || rowIndex < 3) {
      return { success: false, error: 'Invalid row index: ' + rowData.rowIndex };
    }

    const values = buildRowValues_(rowData);
    sheet.getRange(rowIndex, 1, 1, 12).setValues([values]);
    applyTargetDateColor_(sheet, rowIndex, rowData.targetDate, rowData.completed);
    logTranscriptWrite_(studentName, rowIndex, 'UPDATED', rowData.courseName);

    return { success: true, rowIndex: rowIndex, studentId: studentId };

  } catch (err) {
    return { success: false, error: err.message };
  }
}


// ============================================================
// SECTION 5 — ADD NEW TRANSCRIPT ROW
// ============================================================

function addTranscriptRow(studentId, rowData) {
  try {
    const studentName = getStudentNameById_(studentId);
    if (!studentName) {
      return { success: false, error: 'Student not found: ' + studentId };
    }

    const ss    = SpreadsheetApp.openById(SS_ACADEMIC);
    const sheet = ss.getSheetByName(studentName);
    if (!sheet) {
      return { success: false, error: 'No transcript sheet found for: ' + studentName };
    }

    const block    = rowData.block === 2 ? TRANSCRIPT_BLOCKS[1] : TRANSCRIPT_BLOCKS[0];
    const rowIndex = findNextEmptyRow_(sheet, block);

    if (!rowIndex) {
      return { success: false, error: 'Block ' + block.year + ' is full — no empty rows available' };
    }

    rowData.classNumber = rowIndex - block.start + 1;

    const values = buildRowValues_(rowData);
    sheet.getRange(rowIndex, 1, 1, 12).setValues([values]);
    applyTargetDateColor_(sheet, rowIndex, rowData.targetDate, rowData.completed);
    logTranscriptWrite_(studentName, rowIndex, 'ADDED', rowData.courseName);

    return { success: true, rowIndex: rowIndex, studentId: studentId };

  } catch (err) {
    return { success: false, error: err.message };
  }
}


// ============================================================
// SECTION 6 — COURSE CATALOGUE READER
// (Used by dashboard to populate course dropdowns)
// ============================================================

function getCourseCatalogue() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get('COURSE_CATALOGUE');
    if (cached) return JSON.parse(cached);

    const ss    = SpreadsheetApp.openById(SS_ACADEMIC);
    const sheet = ss.getSheetByName('Course Catalogue');
    if (!sheet) return { success: false, error: 'Course Catalogue not found' };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, courses: [] };

    const data    = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    const courses = [];

    data.forEach(row => {
      const name     = String(row[0] || '').trim();
      const category = String(row[1] || '').trim();
      const classId  = String(row[2] || '').trim();

      if (!name || !classId) return;

      courses.push({ className: name, category: category, classId: classId });
    });

    const result = { success: true, courses: courses };

    // Cache for 30 minutes — catalogue rarely changes
    try {
      cache.put('COURSE_CATALOGUE', JSON.stringify(result), 1800);
    } catch (e) {
      // Cache put failed (too large) — return uncached
    }

    return result;

  } catch (err) {
    return { success: false, error: err.message };
  }
}


// ============================================================
// SECTION 7 — MASTER SCHEDULE HOURS READER
// (Pulls standard hours per course for auto-fill)
// ============================================================

function getMasterScheduleHours() {
  try {
    const cache  = CacheService.getScriptCache();
    const cached = cache.get('MASTER_SCHEDULE_HOURS');
    if (cached) return JSON.parse(cached);

    // Master schedule data is already in the dashboard
    // This reads from the Hub's Student Course Data sheet
    // which is populated by CourseSync.gs
    const ss    = SpreadsheetApp.openById(SS_HUB);
    const sheet = ss.getSheetByName(SHEET_STUDENT_COURSE_DATA);
    if (!sheet) return { success: false, error: 'Student Course Data not found' };

    // For now return the Hours reference table from Academic Tracker
    // This will be migrated to Hub in Phase 2
    const acSS    = SpreadsheetApp.openById(SS_ACADEMIC);
    const hoursSheet = acSS.getSheets().find(s =>
      s.getName().toLowerCase().includes('hours') ||
      s.getName().toLowerCase().includes('master schedule')
    );

    if (!hoursSheet) return { success: true, hours: {} };

    const lastRow = hoursSheet.getLastRow();
    if (lastRow < 2) return { success: true, hours: {} };

    const data  = hoursSheet.getRange(2, 1, lastRow - 1, 5).getValues();
    const hours = {};

    data.forEach(row => {
      const courseName = String(row[0] || '').trim();
      const classHours = Number(row[1]);
      if (!courseName) return;
      hours[courseName] = {
        hours:   isFinite(classHours) ? classHours : 0,
        units:   Number(row[2]) || 0,
        lessons: Number(row[3]) || 0
      };
    });

    const result = { success: true, hours: hours };

    try {
      cache.put('MASTER_SCHEDULE_HOURS', JSON.stringify(result), 1800);
    } catch (e) {}

    return result;

  } catch (err) {
    return { success: false, error: err.message };
  }
}


// ============================================================
// SECTION 8 — ONE-TIME SETTINGS SEEDER
// Run once to populate Name Mapping columns O-S
// from existing Academic Tracker ScriptProperties
// Scales safely to 300 students — writes in one batch operation
// ============================================================

function seedHubSettings() {
  try {
    const hubSS     = SpreadsheetApp.openById(SS_HUB);
    const nmSheet   = hubSS.getSheetByName(SHEET_MAPPING);
    if (!nmSheet) throw new Error('Name Mapping sheet not found in Hub');

    const lastRow = nmSheet.getLastRow();
    if (lastRow < 2) throw new Error('Name Mapping is empty');

    // Read columns A-D (ID, Master Name, Trade Name, Academic Name)
    // We only need academic name (col D) to look up existing settings
    const data = nmSheet.getRange(2, 1, lastRow - 1, 4).getValues();

    // Add headers to columns O-S if not already there
    const headerRow       = nmSheet.getRange(1, NM_COL_WEEKLY_HOURS, 1, 5);
    const existingHeaders = headerRow.getValues()[0];

    if (!existingHeaders[0]) {
      headerRow.setValues([[
        'Weekly Hours', 'W1 Active', 'W2 Active', 'W3 Active', 'W4 Active'
      ]]);
      headerRow
        .setFontWeight('bold')
        .setBackground('#1f2937')
        .setFontColor('#ffffff')
        .setHorizontalAlignment('center');
    }

    // For each student, read existing settings from ScriptProperties
    const props      = PropertiesService.getScriptProperties();
    const outputRows = [];
    let   seeded     = 0;
    let   defaulted  = 0;

    data.forEach((row, i) => {
      const studentName = String(row[NM_COL_ACADEMIC_NAME - 1] || '').trim();

      if (!studentName) {
        outputRows.push([
          SETTINGS_DEFAULTS.weeklyHours,
          SETTINGS_DEFAULTS.activeWeeks.w1,
          SETTINGS_DEFAULTS.activeWeeks.w2,
          SETTINGS_DEFAULTS.activeWeeks.w3,
          SETTINGS_DEFAULTS.activeWeeks.w4
        ]);
        defaulted++;
        return;
      }

      const key   = (k) => `${TRANSCRIPT_SETTINGS_KEY}::${studentName}::${k}`;
      const hours = Number(props.getProperty(key('hours')));

      // Check if student has any existing settings
      const hasSettings = props.getProperty(key('w1')) !== null ||
                          props.getProperty(key('w2')) !== null ||
                          props.getProperty(key('hours')) !== null;

      if (hasSettings) {
        outputRows.push([
          isFinite(hours) && hours > 0 ? hours : SETTINGS_DEFAULTS.weeklyHours,
          props.getProperty(key('w1')) !== 'false',
          props.getProperty(key('w2')) !== 'false',
          props.getProperty(key('w3')) !== 'false',
          props.getProperty(key('w4')) !== 'false'
        ]);
        seeded++;
      } else {
        // No existing settings — use defaults
        outputRows.push([
          SETTINGS_DEFAULTS.weeklyHours,
          SETTINGS_DEFAULTS.activeWeeks.w1,
          SETTINGS_DEFAULTS.activeWeeks.w2,
          SETTINGS_DEFAULTS.activeWeeks.w3,
          SETTINGS_DEFAULTS.activeWeeks.w4
        ]);
        defaulted++;
      }
    });

    // Write all settings to Name Mapping G-K in one batch
    if (outputRows.length > 0) {
      nmSheet.getRange(2, NM_COL_WEEKLY_HOURS, outputRows.length, 5)
        .setValues(outputRows);

      // Format the new columns
      nmSheet.getRange(2, NM_COL_WEEKLY_HOURS, outputRows.length, 1)
        .setNumberFormat('0')
        .setHorizontalAlignment('center');

      nmSheet.getRange(2, NM_COL_W1, outputRows.length, 4)
        .setHorizontalAlignment('center');
    }

    SpreadsheetApp.flush();

    Logger.log(`seedHubSettings complete: ${seeded} migrated from properties, ${defaulted} seeded with defaults`);

    // Show result in Apps Script editor
    const ui = SpreadsheetApp.getUi ? SpreadsheetApp.getUi() : null;
    const msg = `Settings seeded successfully.\n\n` +
                `Migrated from Academic Tracker: ${seeded}\n` +
                `Seeded with defaults (10hrs, all weeks): ${defaulted}\n\n` +
                `Next step: open Name Mapping in SS_HUB and verify columns G-K.`;

    if (ui) {
      try { ui.alert(msg); } catch(e) { Logger.log(msg); }
    } else {
      Logger.log(msg);
    }

    return { success: true, seeded: seeded, defaulted: defaulted };

  } catch (err) {
    Logger.log('seedHubSettings error: ' + err.message);
    return { success: false, error: err.message };
  }
}


// ============================================================
// SECTION 9 — HELPERS
// ============================================================

function buildRowValues_(rowData) {
  return [
    rowData.classNumber || '',
    rowData.courseId    || '',
    rowData.courseName  || '',
    rowData.instance    || '',
    rowData.transfer    === true ? true : false,
    rowData.subject     || '',
    Number(rowData.credit)     || 0,
    Number(rowData.classHours) || 0,
    rowData.startDate  ? new Date(rowData.startDate)  : '',
    rowData.adjStart   ? new Date(rowData.adjStart)   : '',
    rowData.targetDate ? new Date(rowData.targetDate) : '',
    rowData.completed  === true ? true : false
  ];
}

function applyTargetDateColor_(sheet, rowIndex, targetDate, completed) {
  const cell = sheet.getRange(rowIndex, TRANSCRIPT_COL.TARGET_DATE);

  if (completed || !targetDate) {
    cell.setBackground(null);
    return;
  }

  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  cell.setBackground(target < today ? '#FFC7CE' : '#C6EFCE');
}

function findNextEmptyRow_(sheet, block) {
  const numRows = block.end - block.start + 1;
  const data    = sheet.getRange(block.start, TRANSCRIPT_COL.COURSE_NAME, numRows, 1).getValues();

  for (let i = 0; i < data.length; i++) {
    if (!String(data[i][0]).trim()) return block.start + i;
  }

  return null;
}

function getStudentNameById_(studentId) {
  const ss      = SpreadsheetApp.openById(SS_HUB);
  const sheet   = ss.getSheetByName(SHEET_MAPPING);
  if (!sheet) return null;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(studentId).trim()) {
      return String(data[i][3]).trim(); // Column D — Academic Name
    }
  }

  return null;
}

function formatDate_(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function logTranscriptWrite_(studentName, rowIndex, action, detail) {
  try {
    const ss       = SpreadsheetApp.openById(SS_ACADEMIC);
    const logSheet = ss.getSheetByName('Transcript Log');
    if (!logSheet) return;
    logSheet.appendRow([new Date(), studentName, action, 'Row ' + rowIndex, detail || '']);
  } catch (e) {
    // Non-fatal — log failure never surfaces to user
  }
}


// ============================================================
// SECTION 10 — TARGET DATE ENGINE (CLIENT-SIDE PORT)
// ============================================================

function calculateTargetDateJS(courseHours, startDateStr, settings) {
  // This function is called client-side in the dashboard HTML
  // It's duplicated here for reference and server-side testing

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
// SECTION 11 — TEST FUNCTIONS
// ============================================================

function testGetTranscript() {
  const result = getStudentTranscript('2082094');
  Logger.log(JSON.stringify(result, null, 2));
}

function testSaveTranscriptRow() {
  const result = saveTranscriptRow('2082094', {
    rowIndex:    21,
    classNumber: 19,
    courseId:    'MA-0024-S1',
    courseName:  'Intermediate Algebra',
    instance:    '1',
    transfer:    false,
    subject:     'Math',
    credit:      0.5,
    classHours:  49,
    startDate:   '2026-01-06',
    adjStart:    null,
    targetDate:  '2026-03-15',
    completed:   false,
    block:       1
  });
  Logger.log(JSON.stringify(result, null, 2));
}

function testGetSettings() {
  // Test reading settings for Austin
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
  // Test the pure JS target date engine
  const result = calculateTargetDateJS(49, '2026-01-06', {
    weeklyHours: 10,
    activeWeeks: { w1: true, w2: true, w3: true, w4: true }
  });
  Logger.log('Target date: ' + result);
  // Expected: approximately 2026-06-xx depending on weekday distribution
}

function testSeedHubSettings() {
  // DRY RUN — logs what would be seeded without writing
  const props   = PropertiesService.getScriptProperties();
  const hubSS   = SpreadsheetApp.openById(SS_HUB);
  const nmSheet = hubSS.getSheetByName(SHEET_MAPPING);
  const lastRow = nmSheet.getLastRow();
  const data    = nmSheet.getRange(2, 1, lastRow - 1, 4).getValues();

  Logger.log('Students in Name Mapping: ' + data.length);

  let withSettings  = 0;
  let withoutSettings = 0;

  data.forEach(row => {
    const academicName = String(row[3] || '').trim();
    if (!academicName) return;

    const key        = (k) => `${TRANSCRIPT_SETTINGS_KEY}::${academicName}::${k}`;
    const hasSettings = props.getProperty(key('w1')) !== null ||
                        props.getProperty(key('hours')) !== null;

    if (hasSettings) withSettings++;
    else withoutSettings++;
  });

  Logger.log(`Students with existing settings: ${withSettings}`);
  Logger.log(`Students to be seeded with defaults: ${withoutSettings}`);
  Logger.log('Run seedHubSettings() to write to Name Mapping columns O-S.');
}
// ============================================================
// AuditTranscriptCategories.gs — One-time punch list generator
// ------------------------------------------------------------
// Scans every student's transcript sheet in SS_ACADEMIC and
// flags any completed/transfer course row where the Subject
// column isn't an exact match to one of the 7 valid categories.
// Those are exactly the rows that are silently falling into
// Electives (uncapped) instead of their real category.
//
// Run auditTranscriptCategories() from the Apps Script editor.
// It writes a report sheet called "Category Audit" into
// SS_ACADEMIC with one row per problem course, so you can work
// through them as a checklist instead of opening every student
// one at a time to go hunting.
// ============================================================

const VALID_CATEGORIES_ = ['English', 'Math', 'Science', 'Social Studies', 'Language', 'Fine Arts', 'Electives'];

function auditTranscriptCategories() {
  const ss = SpreadsheetApp.openById(SS_ACADEMIC);
  const sheets = ss.getSheets();

  const problems = [];
  let studentsScanned = 0;
  let rowsScanned = 0;

  sheets.forEach(sheet => {
    const name = sheet.getName();
    // Skip known non-student sheets
    if (name === 'Course Catalogue' || name === 'Transcript Log' || name.toLowerCase().includes('hours')) return;

    let hasTranscriptShape = false;

    TRANSCRIPT_BLOCKS.forEach(block => {
      const numRows = block.end - block.start + 1;
      let data;
      try {
        data = sheet.getRange(block.start, 1, numRows, 12).getValues();
      } catch (e) {
        return; // sheet too small / not a transcript — skip this block
      }

      data.forEach((row, i) => {
        const courseName = String(row[2] || '').trim();  // col C
        if (!courseName) return; // empty row, skip

        hasTranscriptShape = true;
        rowsScanned++;

        const courseId  = String(row[1]  || '').trim();  // col B
        const transfer  = row[4]  === true;               // col E
        const subject   = String(row[5]  || '').trim();  // col F
        const credit    = Number(row[6]) || 0;            // col G
        const completed = row[11] === true;               // col L

        // Only rows that actually contribute credit (completed or transfer)
        // are the ones affected by the Electives-dumping bug — in-progress
        // courses don't get counted yet, so skip them here.
        if (!completed && !transfer) return;

        const isValidCategory = VALID_CATEGORIES_.includes(subject);
        if (isValidCategory) return; // this one's fine

        problems.push([
          name,                       // Student sheet name
          block.start + i,            // Row number in that sheet
          block.year,                 // Year 1 or 2
          courseName,
          courseId || '(blank)',
          subject || '(blank)',
          credit,
          transfer ? 'Transfer' : 'Completed',
        ]);
      });
    });

    if (hasTranscriptShape) studentsScanned++;
  });

  // ── Write report sheet ──────────────────────────────────────
  let report = ss.getSheetByName('Category Audit');
  if (report) report.clear();
  else report = ss.insertSheet('Category Audit');

  const headers = ['Student Sheet', 'Row #', 'Year', 'Course Name', 'Course ID', 'Current Subject/Category', 'Credit', 'Status'];
  report.getRange(1, 1, 1, headers.length).setValues([headers]);
  report.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1f2937')
    .setFontColor('#ffffff');
  report.setFrozenRows(1);

  if (problems.length) {
    report.getRange(2, 1, problems.length, headers.length).setValues(problems);
    report.autoResizeColumns(1, headers.length);
  }

  const summary = `Scanned ${studentsScanned} students, ${rowsScanned} course rows. Found ${problems.length} row(s) with an invalid category needing a manual fix.`;
  Logger.log(summary);

  const ui = SpreadsheetApp.getUi ? SpreadsheetApp.getUi() : null;
  if (ui) {
    try { ui.alert(summary + '\n\nSee the "Category Audit" sheet for the full list.'); } catch (e) { /* non-fatal */ }
  }

  return { studentsScanned, rowsScanned, problemsFound: problems.length };
}
