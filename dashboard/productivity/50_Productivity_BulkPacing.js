// ============================================================
// BulkPacing.gs — "Assign Student Hours" bulk tool (Vault-only)
// ------------------------------------------------------------

// ============================================================
// SECTION 1 — SCAN ALL STUDENTS
// ============================================================

function scanAllStudentPacing() {
  try {
    const nameRows = readVaultSheetAsObjects_(VAULT_SHEET_NAME_MAPPING, VAULT_NAME_MAPPING_HEADERS);
    if (!nameRows.length) return { success: false, error: 'Name Mapping is empty.' };
    const pacingRows = readVaultSheetAsObjects_(VAULT_SHEET_STUDENT_PACING, VAULT_STUDENT_PACING_HEADERS);
    const pacingById = {};
    pacingRows.forEach(row => {
      const id = String(row.studentId || '').trim();
      if (id) pacingById[id] = row;
    });
    const scheduleByStudentId = _pacingLoadScheduleFromVault_();
    const currentRotation = _pacingCurrentRotation_();
    const observedRotationByStudentId = _pacingObservedRotationFromHistory_();
    const students = [];
    nameRows.forEach(row => {
      const studentId = String(row.studentId || '').trim();
      if (!studentId) return;
      const isActive = row.active === true || String(row.active).toLowerCase() === 'true';
      if (!isActive) return;
      const displayName = String(row.masterName || '').trim() || studentId;
      const schedule = scheduleByStudentId[studentId] || null;
      const hasSchedule = !!schedule;
      const observedRotation = observedRotationByStudentId[studentId] || null;
      const detected = hasSchedule
        ? _pacingDetectFromSchedule_(schedule, observedRotation)
        : { hours: 0, activeWeeks: observedRotation ? Object.assign({}, currentRotation, observedRotation) : currentRotation };

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
    }
  });

  return scheduleByStudentId;
}

// ── Detect weekly hours + rotation from one student's schedule JSON ──
function _pacingDetectFromSchedule_(schedule, observedRotation) {
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
  const activeWeeks = _pacingCurrentRotation_();
  if (observedRotation) Object.assign(activeWeeks, observedRotation);
  const currentBucket = 'w' + getCurrentWeekOfMonth_();
  activeWeeks[currentBucket] = hours > 0;

  return { hours, activeWeeks };
}

function _pacingCurrentRotation_() {
  const week = getCurrentWeekOfMonth_();
  const isOdd = week === 1 || week === 3;
  return isOdd
    ? { w1: true,  w2: false, w3: true,  w4: false }
    : { w1: false, w2: true,  w3: false, w4: true  };
}

// ── Observed rotation from real history ──────────────────────
function _pacingObservedRotationFromHistory_() {
  const rows = readVaultSheetAsObjects_(VAULT_SHEET_PRODUCTIVITY, VAULT_PRODUCTIVITY_HEADERS);
  const tally = {};
  rows.forEach(row => {
    const studentId = String(row.studentId || '').trim();
    if (!studentId) return;
    const d = _parseLocalDate(row.weekLabel);
    if (!d) return;
    const bucket = 'w' + _pacingDayOfMonthBucket_(d);
    const wasAssigned = Number(row.assignedHours) > 0;
    if (!tally[studentId]) {
      tally[studentId] = { w1: { t: 0, f: 0 }, w2: { t: 0, f: 0 }, w3: { t: 0, f: 0 }, w4: { t: 0, f: 0 } };
    }
    if (wasAssigned) tally[studentId][bucket].t++;
    else tally[studentId][bucket].f++;
  });

  const result = {};
  Object.entries(tally).forEach(([studentId, buckets]) => {
    const rotation = {};
    Object.entries(buckets).forEach(([bucket, counts]) => {
      if (counts.t + counts.f === 0) return;
      rotation[bucket] = counts.t >= counts.f;
    });
    if (Object.keys(rotation).length) result[studentId] = rotation;
  });
  return result;
}

function _pacingDayOfMonthBucket_(date) {
  const day = date.getDate();
  return day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : 4;
}

// ============================================================
// SECTION 2 — BATCH APPLY
// ============================================================
function batchApplyStudentPacing(updates) {
  try {
    if (!updates || !updates.length) return { success: false, error: 'No updates provided.' };
    return _withLock(() => {
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
    sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), 1).setNumberFormat('@');
    SpreadsheetApp.flush();
    return {
      success: true,
      applied,
      skipped,
      skippedCount: skipped.length,
    };
    });
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
