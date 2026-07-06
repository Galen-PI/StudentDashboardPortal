// ============================================================
// CourseSync.gs — Student course data sync
// Reads individual student Edgenuity sheets from SS_ACADEMIC and writes summarized course data to the Student Course Data sheet in SS_HUB. Runs on a Monday 5am trigger.
// ============================================================

// ── Main sync entry point ─────────────────────────────────────
function syncStudentCourseData() {
  const t0 = Date.now();
  Logger.log('syncStudentCourseData: starting...');

  const hubSS      = SpreadsheetApp.openById(SS_HUB);
  const academicSS = SpreadsheetApp.openById(SS_ACADEMIC);

  // Get active HS students from Name Mapping
  const mapSheet = hubSS.getSheetByName(SHEET_MAPPING);
  if (!mapSheet) { Logger.log('syncStudentCourseData: Name Mapping sheet not found'); return; }

  const mapValues    = mapSheet.getDataRange().getValues();
  const activeStudents = [];
  for (let i = 1; i < mapValues.length; i++) {
    const row              = mapValues[i];
    const id               = String(row[0] || '').trim();
    const academicName     = String(row[3] || '').trim();
    const tradeComplete    = ['yes','true','1','complete'].includes(String(row[4] || '').trim().toLowerCase());
    const academicComplete = ['yes','true','1','complete'].includes(String(row[5] || '').trim().toLowerCase());
    if (!academicName || (tradeComplete && academicComplete)) continue;
    activeStudents.push({ id, academicName });
  }
  Logger.log('syncStudentCourseData: ' + activeStudents.length + ' active students');

  // Build a sheet-name → sheet map for fast lookup
  const sheetMap = {};
  academicSS.getSheets().forEach(s => { sheetMap[s.getName()] = s; });

  // Process each student
  const rows    = [COURSE_DATA_HEADERS];
  let synced    = 0;
  let skipped   = 0;
  const skippedNames = [];

  activeStudents.forEach(({ id, academicName }) => {
    const sheet = sheetMap[academicName];
    if (!sheet) {
      skipped++;
      skippedNames.push(academicName + ' (sheet not found)');
      return;
    }
    try {
      const courseData = _extractCoursesFromStudentSheet(sheet);
      if (!courseData) {
        skipped++;
        skippedNames.push(academicName + ' (no course data)');
        return;
      }
      rows.push([
        academicName,
        courseData.remainingCredits,
        courseData.remainingHours,
        courseData.courseCountLeft,
        courseData.nextCourse,
        courseData.nextCourseHours,
        courseData.nextCourseTarget,
        courseData.totalCredits,
        courseData.totalHours,
        courseData.completionPct,
        _todayStr(),
      ]);
      synced++;
    } catch(e) {
      skipped++;
      skippedNames.push(academicName + ' (error: ' + e.message + ')');
    }
  });

  // Write results to SS_HUB
  let courseSheet = hubSS.getSheetByName(SHEET_STUDENT_COURSE_DATA);
  if (!courseSheet) {
    courseSheet = hubSS.insertSheet(SHEET_STUDENT_COURSE_DATA);
  } else {
    courseSheet.clearContents();
  }

  if (rows.length > 1) {
    courseSheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    courseSheet.getRange(1, 1, 1, rows[0].length)
      .setFontWeight('bold')
      .setBackground('#1f2937')
      .setFontColor('#ffffff');
    courseSheet.setFrozenRows(1);
  }

  _clearDashboardCache();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  Logger.log([
    'syncStudentCourseData complete:',
    '  synced:  ' + synced,
    '  skipped: ' + skipped,
    '  time:    ' + elapsed + 's',
    skippedNames.length ? '  skipped names:\n    ' + skippedNames.join('\n    ') : '',
  ].filter(Boolean).join('\n'));
}

// ── Extract course data from one student sheet ─────────────────
// Reads the Edgenuity course table from a student's individual sheet.
// Returns a summarized object or null if no usable data is found.
function _extractCoursesFromStudentSheet(sheet) {
  // ── Layout (1-indexed, as shown in spreadsheet) ───────────
  // Block 1: header row 2, data rows 3–26
  //   B=CourseID, C=CourseName, F=Subject, G=Credits, H=Hours,
  //   I=StartDate, J=AdjStart, K=TargetDate, L=Completed(checkbox)
  // Credits remaining (live formula): L30 (merged L30:L33)
  //
  // Block 2: header row 54, data rows 55–77
  // Credits remaining (live formula): L81 (merged L81:L82)
  //
  // Columns (0-indexed): B=1, C=2, F=5, G=6, H=7, I=8, J=9, K=10, L=11

  try {
    const lastRow = sheet.getLastRow();
    if (lastRow < 3) return null;

    // Read the whole sheet in one call — avoids multiple round trips
    const values = sheet.getRange(1, 1, Math.min(lastRow, 85), 12).getValues();

    const COL_COURSE_ID  = 1;  // B
    const COL_NAME       = 2;  // C
    const COL_CREDITS    = 6;  // G
    const COL_HOURS      = 7;  // H
    const COL_TARGET     = 10; // K
    const COL_COMPLETE   = 11; // L (checkbox — TRUE = done)

    // ── Helper: parse one block of rows ───────────────────
    function parseBlock(dataStart, dataEnd) {
      const courses = [];
      for (let r = dataStart; r <= dataEnd && r < values.length; r++) {
        const row      = values[r];
        const courseId = String(row[COL_COURSE_ID] || '').trim();
        const name     = String(row[COL_NAME]      || '').trim();
        if (!courseId && !name) continue;
        // Skip placeholder rows (e.g. "Pathway Elective" with no ID)
        const displayName = name || courseId;
        const credits     = _toNumber(row[COL_CREDITS]) || 0;
        const hours       = _toNumber(row[COL_HOURS])   || 0;
        const isComplete  = row[COL_COMPLETE] === true;
        const target      = _formatDateCell(row[COL_TARGET]);
        courses.push({ courseId, name: displayName, credits, hours, isComplete, target });
      }
      return courses;
    }

    // Block 1: rows 3–26 → 0-indexed 2–25
    const block1 = parseBlock(2, 25);
    // Block 2: rows 55–77 → 0-indexed 54–76
    const block2 = parseBlock(54, 76);
    const allCourses = [...block1, ...block2];

    if (!allCourses.length) return null;

    // ── Credits remaining — read live formula result ───────
    // L30 = row 30, col L = col 12 (1-indexed) → 0-indexed row 29, col 11
    // L81 = row 81, col L → 0-indexed row 80, col 11
    // We read these directly to get the formula result, not recompute.
    let remainingCredits = null;
    try {
      const credRow1 = sheet.getRange(30, 12).getValue();
      const credRow2 = lastRow >= 81 ? sheet.getRange(81, 12).getValue() : null;
      // L30 formula already sums both blocks, so prefer it
      const v1 = _toNumber(credRow1);
      if (v1 !== null && v1 >= 0) {
        remainingCredits = v1;
      } else {
        // Fallback: sum incomplete course credits manually
        remainingCredits = allCourses
          .filter(c => !c.isComplete)
          .reduce((s, c) => s + c.credits, 0);
      }
    } catch(e) {
      remainingCredits = allCourses
        .filter(c => !c.isComplete)
        .reduce((s, c) => s + c.credits, 0);
    }

    // ── Totals ─────────────────────────────────────────────
    const totalCredits = allCourses.reduce((s, c) => s + c.credits, 0);
    const totalHours   = allCourses.reduce((s, c) => s + c.hours,   0);
    const remaining    = allCourses.filter(c => !c.isComplete);
    const remainingHours = remaining.reduce((s, c) => s + c.hours, 0);

    const completionPct = totalCredits > 0
      ? +((1 - remainingCredits / totalCredits) * 100).toFixed(1)
      : 0;

    // Next course = first incomplete, skipping pure placeholders
    const nextCourse = remaining.find(c => !c.name.toLowerCase().includes('pathway elective'))
      || remaining[0]
      || null;

    return {
      remainingCredits:  +remainingCredits.toFixed(2),
      remainingHours:    +remainingHours.toFixed(2),
      courseCountLeft:   remaining.length,
      nextCourse:        nextCourse ? nextCourse.name   : '',
      nextCourseHours:   nextCourse ? nextCourse.hours  : 0,
      nextCourseTarget:  nextCourse ? nextCourse.target : '',
      totalCredits:      +totalCredits.toFixed(2),
      totalHours:        +totalHours.toFixed(2),
      completionPct,
    };

  } catch(e) {
    Logger.log('_extractCoursesFromStudentSheet error: ' + e.message);
    return null;
  }
}

// Formats a date cell value to M/D/YYYY string
function _formatDateCell(val) {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    return (val.getMonth() + 1) + '/' + val.getDate() + '/' + val.getFullYear();
  }
  return String(val).trim();
}

// ── Debug helpers ─────────────────────────────────────────────
// Run these manually from the Apps Script editor to diagnose sync issues.

// Lists students that were skipped on the last sync run
function debugSyncSkipped() {
  const hubSS      = SpreadsheetApp.openById(SS_HUB);
  const academicSS = SpreadsheetApp.openById(SS_ACADEMIC);
  const mapSheet   = hubSS.getSheetByName(SHEET_MAPPING);
  if (!mapSheet) { Logger.log('Name Mapping sheet not found'); return; }

  const mapValues = mapSheet.getDataRange().getValues();
  const sheetMap  = {};
  academicSS.getSheets().forEach(s => { sheetMap[s.getName()] = s; });

  const missing = [];
  for (let i = 1; i < mapValues.length; i++) {
    const row              = mapValues[i];
    const academicName     = String(row[3] || '').trim();
    const tradeComplete    = ['yes','true','1','complete'].includes(String(row[4] || '').trim().toLowerCase());
    const academicComplete = ['yes','true','1','complete'].includes(String(row[5] || '').trim().toLowerCase());
    if (!academicName || (tradeComplete && academicComplete)) continue;
    if (!sheetMap[academicName]) missing.push(academicName);
  }

  Logger.log('Students with no matching sheet (' + missing.length + '):');
  missing.forEach(n => Logger.log('  ' + n));
}

// Runs the sync for a single student and logs the result
function debugSyncSingleStudent(academicName) {
  const academicSS = SpreadsheetApp.openById(SS_ACADEMIC);
  const sheet      = academicSS.getSheetByName(academicName);
  if (!sheet) { Logger.log('Sheet not found: ' + academicName); return; }
  const result = _extractCoursesFromStudentSheet(sheet);
  Logger.log('Result for ' + academicName + ':');
  Logger.log(JSON.stringify(result, null, 2));
}

// ── Trigger management ────────────────────────────────────────
function installCourseSyncTrigger() {
  removeCourseSyncTrigger();
  ScriptApp.newTrigger('syncStudentCourseData')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(5)
    .create();
  Logger.log('Course sync trigger installed — runs every Monday at 5am.');
}

function removeCourseSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'syncStudentCourseData') ScriptApp.deleteTrigger(t);
  });
}
