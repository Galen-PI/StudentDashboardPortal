// ============================================================
// BulkPacing.gs — "Assign Student Hours" bulk tool (Vault-only)
// ------------------------------------------------------------
// Scans every student's on-file weekly schedule, detects how
// many academic hours/week they're scheduled for and which
// bi-weekly rotation (weeks 1&3 vs 2&4) they're currently in,
// and lets staff batch-apply those as pacing settings.
//
// Pacing settings (weekly hours + active-week rotation) now live
// in their own Vault sheet, VAULT_SHEET_STUDENT_PACING, keyed by
// studentId — NOT Name Mapping columns O-S, which never existed
// in Vault's 5-column Name Mapping schema in the first place.
// Reads/writes here are upsert-not-delete, same principle as
// every other Vault write in this project.
// ============================================================

// NOTE: PACING_VALID_PERIODS / PACING_ACADEMIC_NAMES used to be
// this file's own local copy of the schedule-matching constants
// (now consolidated in Config.gs as SCHEDULE_VALID_PERIODS /
// SCHEDULE_ACADEMIC_NAMES). Intentionally NOT aliased here at
// top level — cross-file .gs load order isn't guaranteed, so a
// top-level `const X = Y` reaching into another file's top-level
// const risks a "cannot access before initialization" error if
// this file happens to load before Config.gs. Referenced directly
// inside the function body below instead, which is always safe
// since all files finish loading before any function runs.

// ============================================================
// SECTION 1 — SCAN ALL STUDENTS
// ============================================================

function scanAllStudentPacing() {
  try {
    // ── Student list — Vault Name Mapping (5-column schema) ──────
    const nameRows = readVaultSheetAsObjects_(VAULT_SHEET_NAME_MAPPING, VAULT_NAME_MAPPING_HEADERS);
    if (!nameRows.length) return { success: false, error: 'Name Mapping is empty.' };

    // ── Existing pacing settings — dedicated Vault sheet, ID-keyed ──
    const pacingRows = readVaultSheetAsObjects_(VAULT_SHEET_STUDENT_PACING, VAULT_STUDENT_PACING_HEADERS);
    const pacingById = {};
    pacingRows.forEach(row => {
      const id = String(row.studentId || '').trim();
      if (id) pacingById[id] = row;
    });

    // ── Schedule lookup — Vault Weekly Schedule, 'current' slot only ──
    const scheduleByStudentId = _pacingLoadScheduleFromVault_();

    const currentRotation = _pacingCurrentRotation_();

    const students = [];
    nameRows.forEach(row => {
      const studentId = String(row.studentId || '').trim();
      if (!studentId) return;

      const isActive = row.active === true || String(row.active).toLowerCase() === 'true';
      if (!isActive) return;

      const displayName = String(row.masterName || '').trim() || studentId;

      const schedule = scheduleByStudentId[studentId] || null;
      const hasSchedule = !!schedule;

      const detected = hasSchedule
        ? _pacingDetectFromSchedule_(schedule)
        : { hours: 0, activeWeeks: currentRotation };

      // Existing saved settings, from Student Pacing Settings
      const existing = pacingById[studentId] || null;
      const existingHoursRaw = existing ? Number(existing.weeklyHours) : NaN;
      const hasExisting = existing != null && isFinite(existingHoursRaw) && existingHoursRaw > 0;
      const existingHours = hasExisting ? existingHoursRaw : SETTINGS_DEFAULTS.weeklyHours;
      const existingActiveWeeks = existing ? {
        w1: existing.w1 === true || String(existing.w1).toUpperCase() === 'TRUE',
        w2: existing.w2 === true || String(existing.w2).toUpperCase() === 'TRUE',
        w3: existing.w3 === true || String(existing.w3).toUpperCase() === 'TRUE',
        w4: existing.w4 === true || String(existing.w4).toUpperCase() === 'TRUE',
      } : { w1: false, w2: false, w3: false, w4: false };

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

    return { success: true, students, currentRotation, scheduleSource: 'vault' };

  } catch (err) {
    Logger.log('scanAllStudentPacing error: ' + err.message);
    return { success: false, error: err.message };
  }
}

// ── Vault schedule loader — 2-slot rotation format, only reads
function _pacingLoadScheduleFromVault_() {
  const scheduleByStudentId = {};
  const rows = readVaultSheetAsObjects_(VAULT_SHEET_WEEKLY_SCHEDULE, VAULT_SCHEDULE_HEADERS);

  rows.forEach(row => {
    if (String(row.slot).trim().toLowerCase() !== 'current') return;
    const sid = String(row.studentId || '').trim();
    if (!sid) return;
    try {
      scheduleByStudentId[sid] = JSON.parse(String(row.scheduleJson || '{}'));
    } catch (e) {
      // Malformed JSON for this student — treat as no schedule
    }
  });

  return scheduleByStudentId;
}

// ── Detect weekly hours + rotation from one student's schedule JSON ──
function _pacingDetectFromSchedule_(schedule) {
  let hours = 0;
  Object.entries(SCHEDULE_VALID_PERIODS).forEach(([day, validPeriods]) => {
    validPeriods.forEach(periodNum => {
      const entry = (schedule['Period ' + periodNum] || {})[day];
      if (!entry || !entry.class) return;
      if (SCHEDULE_ACADEMIC_NAMES.some(n => (entry.class || '').toLowerCase().includes(n.toLowerCase()))) {
        hours++;
      }
    });
  });

  // Ground-truth check for the CURRENT week only — this is the one
  // week we actually have real schedule data for (Weekly Schedule
  // only holds the 'current' slot). If the schedule shows academic
  // periods this week, this week really is an academic week; if it
  // shows none, it's a trade week. This corrects the current bucket
  // against real data instead of assuming. We still can't verify
  // the OTHER three rotation weeks this way — there's no schedule
  // data for weeks we haven't uploaded yet — so those three stay on
  // the calendar-alternation assumption from _pacingCurrentRotation_().
  const activeWeeks = _pacingCurrentRotation_();
  const currentBucket = 'w' + getCurrentWeekOfMonth_();
  activeWeeks[currentBucket] = hours > 0;

  return { hours, activeWeeks };
}

// ── Which bi-weekly rotation is "now" — routed through the shared
//    getCurrentWeekOfMonth_() (Helpers.gs) so setWeekOverride()
//    actually takes effect here too, same as TimeLog.gs. ──
function _pacingCurrentRotation_() {
  const week = getCurrentWeekOfMonth_();
  const isOdd = week === 1 || week === 3;
  return isOdd
    ? { w1: true,  w2: false, w3: true,  w4: false }
    : { w1: false, w2: true,  w3: false, w4: true  };
}

// ============================================================
// SECTION 2 — BATCH APPLY
// ------------------------------------------------------------
// Upsert into VAULT_SHEET_STUDENT_PACING, keyed by studentId —
// same upsert-not-delete principle as TABE Data / Weekly Schedule
// / Student Course Data.
// ============================================================

function batchApplyStudentPacing(updates) {
  try {
    if (!updates || !updates.length) return { success: false, error: 'No updates provided.' };

    const sheet   = getVaultSheet_(VAULT_SHEET_STUDENT_PACING);
    const lastRow = sheet.getLastRow();
    const numCols = VAULT_STUDENT_PACING_HEADERS.length;

    const existingIdToRow = {};
    if (lastRow >= VAULT_DATA_START_ROW) {
      sheet.getRange(VAULT_DATA_START_ROW, 1, lastRow - VAULT_DATA_START_ROW + 1, 1).getValues()
        .forEach((r, i) => {
          const id = String(r[0] || '').trim();
          if (id) existingIdToRow[id] = VAULT_DATA_START_ROW + i;
        });
    }

    const now = new Date().toISOString();
    const toAppend = [];
    let applied = 0;
    const skipped = [];

    updates.forEach(u => {
      const studentId = String(u.studentId || '').trim();
      if (!studentId) { skipped.push(u.studentId); return; }

      const weeklyHours = u.weeklyHours || SETTINGS_DEFAULTS.weeklyHours;
      const weeks = u.activeWeeks || SETTINGS_DEFAULTS.activeWeeks;

      const row = [
        studentId, weeklyHours,
        weeks.w1 === true, weeks.w2 === true, weeks.w3 === true, weeks.w4 === true,
        now,
      ];

      const rowNum = existingIdToRow[studentId];
      if (rowNum) {
        sheet.getRange(rowNum, 1, 1, numCols).setValues([row]);
      } else {
        toAppend.push(row);
      }
      applied++;

      logTranscriptWriteVault_(
        studentId,
        'pacing',
        'SETTINGS_UPDATED',
        `Student ${studentId}: ${weeklyHours}hrs, W1=${weeks.w1}, W2=${weeks.w2}, W3=${weeks.w3}, W4=${weeks.w4}`
      );
    });

    if (toAppend.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, numCols).setValues(toAppend);
    }
    // Guard studentId against Sheets auto-converting numeric-looking IDs
    sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), 1).setNumberFormat('@');

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


// ============================================================
// VAULT DEBUG HELPER
// ============================================================

function debugPacingScheduleSourceVault() {
  const scheduleByStudentId = _pacingLoadScheduleFromVault_();
  const ids = Object.keys(scheduleByStudentId);
  Logger.log('Students with a "current" Vault schedule: ' + ids.length);
  if (ids.length) {
    Logger.log('Sample studentId: ' + ids[0]);
    Logger.log('Detected pacing: ' + JSON.stringify(_pacingDetectFromSchedule_(scheduleByStudentId[ids[0]])));
  }
}
