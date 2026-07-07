// ============================================================
// BulkPacing.gs — "Assign Student Hours" bulk tool
// ------------------------------------------------------------
// Scans every student's on-file weekly schedule, detects how
// many academic hours/week they're scheduled for and which
// bi-weekly rotation (weeks 1&3 vs 2&4) they're currently in,
// and lets staff batch-apply those as pacing settings.
//
// Mirrors the exact logic already used elsewhere so results
// never drift from what the rest of the dashboard shows:
//   - Period/day schedule shape & ACADEMIC_NAMES matching:
//     same as getStudentSchedule() in DataFetch.gs
//   - Week-of-month bucketing (1-7/8-14/15-21/22+):
//     same as TargetDateEngine's day-of-month logic
//   - Settings storage (Name Mapping columns O-S):
//     same as saveSettingsToHub_() / getSettingsFromHub_()
//     in Transcripts.gs
// ============================================================

const PACING_VALID_PERIODS  = { M:[1,2,3,5,6], T:[1,2,3,5,6,7], W:[1,2,3,5,6], TH:[1,2,3,5,6,7], F:[1,2,3,5,6,7] };
const PACING_ACADEMIC_NAMES = ['HSD 2', 'HSD3', 'HSE/HSD1'];

// ============================================================
// SECTION 1 — SCAN ALL STUDENTS
// ============================================================

function scanAllStudentPacing() {
  try {
    const hubSS = SpreadsheetApp.openById(SS_HUB);

    // ── Name Mapping: student list + existing settings (cols A-S) ──
    const mapSheet = hubSS.getSheetByName(SHEET_MAPPING);
    if (!mapSheet) return { success: false, error: 'Name Mapping sheet not found.' };

    const mapLastRow = mapSheet.getLastRow();
    if (mapLastRow < 2) return { success: false, error: 'Name Mapping is empty.' };

    const mapData = mapSheet.getRange(2, 1, mapLastRow - 1, NM_COL_W4).getValues();

    // ── Schedule sheet: one row per student, batch-read once ──
    const schedSheet = hubSS.getSheetByName(SHEET_SCHEDULE);
    const scheduleByStudentId = {};
    if (schedSheet && schedSheet.getLastRow() > 1) {
      const schedValues = schedSheet.getDataRange().getValues();
      // Row 0 is header: Week, Student Name, Student ID, Schedule JSON
      for (let i = 1; i < schedValues.length; i++) {
        const sid = String(schedValues[i][2] || '').trim();
        if (!sid) continue;
        try {
          scheduleByStudentId[sid] = JSON.parse(String(schedValues[i][3] || '{}'));
        } catch (e) {
          // Malformed JSON for this student — treat as no schedule
        }
      }
    }

    const currentRotation = _pacingCurrentRotation_();

    const students = [];
    mapData.forEach(row => {
      const studentId = String(row[NM_COL_ID - 1] || '').trim();
      if (!studentId) return;

      const masterName = String(row[1] || '').trim();      // Col B
      const academicName = String(row[NM_COL_ACADEMIC_NAME - 1] || '').trim();
      const displayName = masterName || academicName || studentId;

      const schedule = scheduleByStudentId[studentId] || null;
      const hasSchedule = !!schedule;

      const detected = hasSchedule
        ? _pacingDetectFromSchedule_(schedule)
        : { hours: 0, activeWeeks: currentRotation };

      // Existing saved settings (cols O-S)
      const existingHoursRaw = Number(row[NM_COL_WEEKLY_HOURS - 1]);
      const hasExisting = isFinite(existingHoursRaw) && existingHoursRaw > 0;
      const existingHours = hasExisting ? existingHoursRaw : SETTINGS_DEFAULTS.weeklyHours;
      const existingActiveWeeks = {
        w1: row[NM_COL_W1 - 1] === true || row[NM_COL_W1 - 1] === 'TRUE',
        w2: row[NM_COL_W2 - 1] === true || row[NM_COL_W2 - 1] === 'TRUE',
        w3: row[NM_COL_W3 - 1] === true || row[NM_COL_W3 - 1] === 'TRUE',
        w4: row[NM_COL_W4 - 1] === true || row[NM_COL_W4 - 1] === 'TRUE',
      };

      let status;
      if (!hasSchedule) {
        status = 'no_schedule';
      } else if (!hasExisting) {
        status = 'new';
      } else if (
        Math.round(existingHours) !== Math.round(detected.hours) ||
        existingActiveWeeks.w1 !== detected.activeWeeks.w1 ||
        existingActiveWeeks.w2 !== detected.activeWeeks.w2 ||
        existingActiveWeeks.w3 !== detected.activeWeeks.w3 ||
        existingActiveWeeks.w4 !== detected.activeWeeks.w4
      ) {
        status = 'changed';
      } else {
        status = 'unchanged';
      }

      students.push({
        studentId,
        displayName,
        hasSchedule,
        status,
        detectedHours: detected.hours,
        detectedActiveWeeks: detected.activeWeeks,
        hasExisting,
        existingHours,
        existingActiveWeeks,
      });
    });

    students.sort((a, b) => a.displayName.localeCompare(b.displayName));

    return { success: true, students, currentRotation };

  } catch (err) {
    Logger.log('scanAllStudentPacing error: ' + err.message);
    return { success: false, error: err.message };
  }
}

// ── Detect weekly hours + rotation from one student's schedule JSON ──
function _pacingDetectFromSchedule_(schedule) {
  let hours = 0;
  Object.entries(PACING_VALID_PERIODS).forEach(([day, validPeriods]) => {
    validPeriods.forEach(periodNum => {
      const entry = (schedule['Period ' + periodNum] || {})[day];
      if (!entry || !entry.class) return;
      if (PACING_ACADEMIC_NAMES.some(n => (entry.class || '').toLowerCase().includes(n.toLowerCase()))) {
        hours++;
      }
    });
  });

  return { hours, activeWeeks: _pacingCurrentRotation_() };
}

// ── Which bi-weekly rotation is "now", using the same day-of-month
//    week buckets as TargetDateEngine (1-7=w1, 8-14=w2, 15-21=w3, 22+=w4) ──
function _pacingCurrentRotation_() {
  const dayOfMonth = new Date().getDate();
  const week = dayOfMonth <= 7 ? 1 : dayOfMonth <= 14 ? 2 : dayOfMonth <= 21 ? 3 : 4;
  const isOdd = week === 1 || week === 3;
  return isOdd
    ? { w1: true,  w2: false, w3: true,  w4: false }
    : { w1: false, w2: true,  w3: false, w4: true  };
}

// ============================================================
// SECTION 2 — BATCH APPLY
// ============================================================

function batchApplyStudentPacing(updates) {
  try {
    if (!updates || !updates.length) return { success: false, error: 'No updates provided.' };

    const hubSS   = SpreadsheetApp.openById(SS_HUB);
    const sheet   = hubSS.getSheetByName(SHEET_MAPPING);
    if (!sheet) return { success: false, error: 'Name Mapping sheet not found.' };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, error: 'Name Mapping is empty.' };

    const ids = sheet.getRange(2, NM_COL_ID, lastRow - 1, 1).getValues().map(r => String(r[0] || '').trim());

    const idToRowNum = {};
    ids.forEach((id, i) => { if (id) idToRowNum[id] = i + 2; });

    let applied = 0;
    const skipped = [];

    // Batch the writes: build one contiguous range write per row rather
    // than 5 separate setValue calls per student (matches the batching
    // style used elsewhere, e.g. seedHubSettings()).
    updates.forEach(u => {
      const rowNum = idToRowNum[u.studentId];
      if (!rowNum) { skipped.push(u.studentId); return; }

      const weeklyHours = u.weeklyHours || SETTINGS_DEFAULTS.weeklyHours;
      const weeks = u.activeWeeks || SETTINGS_DEFAULTS.activeWeeks;

      sheet.getRange(rowNum, NM_COL_WEEKLY_HOURS, 1, 5).setValues([[
        weeklyHours,
        weeks.w1 === true,
        weeks.w2 === true,
        weeks.w3 === true,
        weeks.w4 === true,
      ]]);

      applied++;

      logTranscriptWrite_(
        'Hub Settings (Bulk)',
        rowNum,
        'SETTINGS_UPDATED',
        `Student ${u.studentId}: ${weeklyHours}hrs, W1=${weeks.w1}, W2=${weeks.w2}, W3=${weeks.w3}, W4=${weeks.w4}`
      );
    });

    SpreadsheetApp.flush();

    return {
      success: true,
      applied,
      skipped,
      skippedCount: skipped.length,
    };

  } catch (err) {
    Logger.log('batchApplyStudentPacing error: ' + err.message);
    return { success: false, error: err.message };
  }
}
