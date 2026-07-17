// ============================================================
// TeacherFilter.gs
const TEACHER_HSD_CLASSES = ['HSD 2', 'HSD3', 'HSE/HSD1'];
function getStudentHSDAssignments() {
  if (USE_VAULT_SCHEDULE) return getStudentHSDAssignmentsFromVault_();
  try {
    const hubSS = SpreadsheetApp.openById(SS_VAULT);
    const schedSheet = hubSS.getSheetByName(SHEET_SCHEDULE);
    if (!schedSheet || schedSheet.getLastRow() < 2) {
      return { success: true, assignments: {} };
    }
    const schedValues = schedSheet.getDataRange().getValues();
    const assignments = {};
    for (let i = 1; i < schedValues.length; i++) {
      const studentId = String(schedValues[i][2] || '').trim();
      if (!studentId) continue;
      let schedule;
      try {
        schedule = JSON.parse(String(schedValues[i][3] || '{}'));
      } catch (e) {
        continue; // malformed schedule JSON — skip this student
      }
      const matchedClass = _findHSDClassInSchedule_(schedule);
      if (matchedClass) assignments[studentId] = matchedClass;
    }

    return { success: true, assignments };

  } catch (err) {
    Logger.log('getStudentHSDAssignments error: ' + err.message);
    return { success: false, error: err.message, assignments: {} };
  }
}

// ── VAULT PATH ────────────────────────────────────────────────
function getStudentHSDAssignmentsFromVault_() {
  try {
    const rows = readVaultSheetAsObjects_(VAULT_SHEET_WEEKLY_SCHEDULE, VAULT_SCHEDULE_HEADERS);
    const assignments = {};

    rows.forEach(row => {
      if (String(row.slot || '').trim().toLowerCase() !== 'current') return;
      const studentId = String(row.studentId || '').trim();
      if (!studentId) return;

      let schedule;
      try {
        schedule = JSON.parse(String(row.scheduleJson || '{}'));
      } catch (e) {
        return; // malformed schedule JSON — skip this student
      }

      const matchedClass = _findHSDClassInSchedule_(schedule);
      if (matchedClass) assignments[studentId] = matchedClass;
    });

    return { success: true, assignments };

  } catch (err) {
    Logger.log('getStudentHSDAssignmentsFromVault_ error: ' + err.message);
    return { success: false, error: err.message, assignments: {} };
  }
}

function _findHSDClassInSchedule_(schedule) {
  for (const periodKey in schedule) {
    const dayEntries = schedule[periodKey];
    for (const day in dayEntries) {
      const entry = dayEntries[day];
      if (!entry || !entry.class) continue;
      const className = String(entry.class).toLowerCase();
      for (const hsdName of TEACHER_HSD_CLASSES) {
        if (className.includes(hsdName.toLowerCase())) return hsdName;
      }
    }
  }
  return null;
}
