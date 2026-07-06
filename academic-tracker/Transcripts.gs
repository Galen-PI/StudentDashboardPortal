// ============================================================
// Transcripts.gs — Read/write student transcript data
// from SS_ACADEMIC student tabs
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

// ── Main read function ────────────────────────────────────────

function getStudentTranscript(studentId) {
  try {
    // Step 1 — resolve student name from ID via Name Mapping
    const studentName = getStudentNameById_(studentId);
    if (!studentName) {
      return { success: false, error: 'Student not found in Name Mapping: ' + studentId };
    }

    // Step 2 — open SS_ACADEMIC and find the student's tab
    const ss    = SpreadsheetApp.openById(SS_ACADEMIC);
    const sheet = ss.getSheetByName(studentName);
    if (!sheet) {
      return { success: false, error: 'No transcript sheet found for: ' + studentName };
    }

    // Step 3 — read both blocks
    const courses = [];
    TRANSCRIPT_BLOCKS.forEach(block => {
      const rows = readTranscriptBlock_(sheet, block);
      rows.forEach(row => courses.push(row));
    });

    // Step 4 — read student settings
    const settings = getTranscriptSettings_(studentName);

    // Step 5 — return structured payload
    return {
      success:     true,
      studentId:   studentId,
      studentName: studentName,
      courses:     courses,
      settings:    settings
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Block reader ──────────────────────────────────────────────

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

// ── Settings reader ───────────────────────────────────────────

function getTranscriptSettings_(studentName) {
  try {
    const props = PropertiesService.getScriptProperties();
    const key   = (k) => `${TRANSCRIPT_SETTINGS_KEY}::${studentName}::${k}`;

    return {
      weeklyHours: Number(props.getProperty(key('hours')) || 20),
      activeWeeks: {
        w1: props.getProperty(key('w1')) !== 'false',
        w2: props.getProperty(key('w2')) !== 'false',
        w3: props.getProperty(key('w3')) !== 'false',
        w4: props.getProperty(key('w4')) !== 'false'
      }
    };
  } catch (err) {
    // Return defaults if properties unavailable
    return {
      weeklyHours: 20,
      activeWeeks: { w1: true, w2: true, w3: true, w4: true }
    };
  }
}

// ── Name resolver ─────────────────────────────────────────────

function getStudentNameById_(studentId) {
  const ss      = SpreadsheetApp.openById(SS_HUB);
  const sheet   = ss.getSheetByName(SHEET_MAPPING);
  if (!sheet) return null;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(studentId).trim()) {
      return String(data[i][3]).trim();
    }
  }

  return null;
}

// ── Date formatter ────────────────────────────────────────────

function formatDate_(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function testGetTranscript() {
  const result = getStudentTranscript('2082094');
  Logger.log(JSON.stringify(result, null, 2));
}
// ── Save existing transcript row ──────────────────────────────

function saveTranscriptRow(studentId, rowData) {
  try {
    // Step 1 — resolve student name
    const studentName = getStudentNameById_(studentId);
    if (!studentName) {
      return { success: false, error: 'Student not found: ' + studentId };
    }

    // Step 2 — open sheet
    const ss    = SpreadsheetApp.openById(SS_ACADEMIC);
    const sheet = ss.getSheetByName(studentName);
    if (!sheet) {
      return { success: false, error: 'No transcript sheet found for: ' + studentName };
    }

    // Step 3 — validate row index
    const rowIndex = Number(rowData.rowIndex);
    if (!rowIndex || rowIndex < 3) {
      return { success: false, error: 'Invalid row index: ' + rowData.rowIndex };
    }

    // Step 4 — build the row values in column order A–L
    const values = buildRowValues_(rowData);

    // Step 5 — write to sheet
    sheet.getRange(rowIndex, 1, 1, 12).setValues([values]);

    // Step 6 — apply target date color if needed
    applyTargetDateColor_(sheet, rowIndex, rowData.targetDate, rowData.completed);

    // Step 7 — log it
    logTranscriptWrite_(studentName, rowIndex, 'UPDATED', rowData.courseName);

    return {
      success:   true,
      rowIndex:  rowIndex,
      studentId: studentId
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Add new transcript row ────────────────────────────────────

function addTranscriptRow(studentId, rowData) {
  try {
    // Step 1 — resolve student name
    const studentName = getStudentNameById_(studentId);
    if (!studentName) {
      return { success: false, error: 'Student not found: ' + studentId };
    }

    // Step 2 — open sheet
    const ss    = SpreadsheetApp.openById(SS_ACADEMIC);
    const sheet = ss.getSheetByName(studentName);
    if (!sheet) {
      return { success: false, error: 'No transcript sheet found for: ' + studentName };
    }

    // Step 3 — find next empty row in the correct block
    const block     = rowData.block === 2
      ? TRANSCRIPT_BLOCKS[1]
      : TRANSCRIPT_BLOCKS[0];
    const rowIndex  = findNextEmptyRow_(sheet, block);

    if (!rowIndex) {
      return {
        success: false,
        error:   'Block ' + block.year + ' is full — no empty rows available'
      };
    }

    // Step 4 — assign class number based on position in block
    rowData.classNumber = rowIndex - block.start + 1;

    // Step 5 — build and write row values
    const values = buildRowValues_(rowData);
    sheet.getRange(rowIndex, 1, 1, 12).setValues([values]);

    // Step 6 — apply target date color
    applyTargetDateColor_(sheet, rowIndex, rowData.targetDate, rowData.completed);

    // Step 7 — log it
    logTranscriptWrite_(studentName, rowIndex, 'ADDED', rowData.courseName);

    return {
      success:   true,
      rowIndex:  rowIndex,
      studentId: studentId
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Row builder ───────────────────────────────────────────────

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

// ── Target date color ─────────────────────────────────────────

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

// ── Empty row finder ──────────────────────────────────────────

function findNextEmptyRow_(sheet, block) {
  const numRows = block.end - block.start + 1;
  const data    = sheet.getRange(block.start, TRANSCRIPT_COL.COURSE_NAME, numRows, 1).getValues();

  for (let i = 0; i < data.length; i++) {
    if (!String(data[i][0]).trim()) {
      return block.start + i;
    }
  }

  return null; // block is full
}

// ── Write logger ──────────────────────────────────────────────

function logTranscriptWrite_(studentName, rowIndex, action, courseName) {
  try {
    const ss       = SpreadsheetApp.openById(SS_ACADEMIC);
    const logSheet = ss.getSheetByName('Transcript Log');
    if (!logSheet) return;

    logSheet.appendRow([
      new Date(),
      studentName,
      action,
      'Row ' + rowIndex,
      courseName || ''
    ]);
  } catch (e) {
    // Log failure is non-fatal — don't surface to user
  }
}
function testSaveTranscriptRow() {
  // Test editing Intermediate Algebra S1 — rowIndex 21 from our read test
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
