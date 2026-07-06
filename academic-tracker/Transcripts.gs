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
