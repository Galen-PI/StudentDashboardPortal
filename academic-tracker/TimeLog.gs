// ===========
// TimeLog.gs — Weekly time log entry (Edgenuity paste) -> Vault
// ===========

// ── Entry point — called from the Time Log tab ────────────────
function saveWeeklyTimeLog(studentId, weekLabel, rawLog, role) {
  _requirePermission(role || ROLES.ADMIN, 'edit_status');

  try {
    const id   = String(studentId).trim();
    const week = String(weekLabel).trim();
    if (!id)   return { success: false, error: 'Student ID is required.' };
    if (!week) return { success: false, error: 'Week is required.' };
    if (!rawLog || !rawLog.trim()) return { success: false, error: 'Paste a session log first.' };

    const parsed = _parseEdgenuityLog_(rawLog);
    const assigned = _getAssignedHoursForWeek_(id, week);

    const weekDate = _parseLocalDate(week);
    const monthLabel = weekDate
      ? Utilities.formatDate(weekDate, Session.getScriptTimeZone(), 'MMMM yyyy')
      : '';

    const sheet = getVaultSheet_(VAULT_SHEET_PRODUCTIVITY);
    _deleteVaultRowsMatching_(sheet, VAULT_PRODUCTIVITY_HEADERS, row =>
      String(row.studentId || '').trim() === id && String(row.weekLabel || '').trim() === week
    );

    let updatedBy = 'staff';
    try { updatedBy = Session.getActiveUser().getEmail() || 'staff'; } catch (e) {}

    const rowValues = [
      id, monthLabel, week,
      parsed.completedWork, parsed.idleTime, parsed.actualWorkedTime,
      assigned.assignedHours, assigned.source, 'staff_paste',
      new Date().toISOString(), updatedBy,
    ];
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, VAULT_PRODUCTIVITY_HEADERS.length).setValues([rowValues]);
    sheet.getRange(sheet.getLastRow(), 1, 1, 1).setNumberFormat('@'); // studentId stays text

    _clearDashboardCache();
    clearProductivityCache();

    return {
      success:             true,
      studentId:           id,
      weekLabel:           week,
      monthLabel:          monthLabel,
      completedWork:       parsed.completedWork,
      idleTime:            parsed.idleTime,
      actualWorkedTime:    parsed.actualWorkedTime,
      assignedHours:       assigned.assignedHours,
      assignedHoursSource: assigned.source,
      totalEntries:        parsed.totalEntries,
      idleEntries:         parsed.idleEntries,
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Read every week on file for one student, newest first ─────
function getStudentTimeLog(studentId) {
  try {
    const rows = readVaultRowsForStudent_(VAULT_SHEET_PRODUCTIVITY, VAULT_PRODUCTIVITY_HEADERS, studentId);

    const weeks = rows
      .map(r => ({
        weekLabel:        String(r.weekLabel || '').trim(),
        monthLabel:       String(r.monthLabel || '').trim(),
        completedWork:    Number(r.completedWork) || 0,
        idleTime:         Number(r.idleTime) || 0,
        actualWorkedTime: Number(r.actualWorkedTime) || 0,
        assignedHours:    Number(r.assignedHours) || 0,
        entryMethod:      String(r.entryMethod || '').trim(),
        lastUpdated:      r.lastUpdated instanceof Date ? r.lastUpdated.toISOString() : (r.lastUpdated || null),
      }))
      .filter(w => w.weekLabel)
      .sort((a, b) => b.weekLabel.localeCompare(a.weekLabel));

    return { success: true, studentId: String(studentId).trim(), weeks };

  } catch (err) {
    return { success: false, error: (err && err.message) || String(err) || 'Unknown error in getStudentTimeLog.' };
  }
}

// ── Parse a pasted Edgenuity session log ───────────────────────
function _parseEdgenuityLog_(log) {
  const text = String(log || '');

  const totalMatches = [...text.matchAll(/Week Totals:\s*(\d{1,2}:\d{2}:\d{2})/g)];
  if (!totalMatches.length) {
    throw new Error('Could not find "Week Totals:" in the pasted log. Make sure the full session log was copied.');
  }
  let totalSeconds = 0;
  totalMatches.forEach(m => { totalSeconds += _hmsToSeconds(m[1]); });

  const idleMatches = [...text.matchAll(/Idle Time:\s*(\d{1,2}:\d{2}:\d{2})/g)];
  let idleSeconds = 0;
  idleMatches.forEach(m => { idleSeconds += _hmsToSeconds(m[1]); });

  if (idleSeconds > totalSeconds) {
    throw new Error(
      'Idle time (' + _secondsToHms_(idleSeconds) + ') exceeds Total time (' + _secondsToHms_(totalSeconds) + ') — check the pasted log.'
    );
  }

  const completedWork    = +(totalSeconds / 3600).toFixed(2);
  const idleTime         = +(idleSeconds / 3600).toFixed(2);
  const actualWorkedTime = +Math.max(0, completedWork - idleTime).toFixed(2);

  return {
    completedWork, idleTime, actualWorkedTime,
    totalEntries: totalMatches.length,
    idleEntries:  idleMatches.length,
  };
}

function _secondsToHms_(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

function _getAssignedHoursForWeek_(studentId, weekLabel) {
  const rows = readVaultRowsForStudent_(VAULT_SHEET_STUDENT_PACING, VAULT_STUDENT_PACING_HEADERS, studentId);
  if (!rows.length) return { assignedHours: 0, source: 'no_pacing_settings' };

  const pacing = rows[0];
  const weeklyHours = Number(pacing.weeklyHours) || 0;

  const d = _parseLocalDate(weekLabel);
  if (!d) return { assignedHours: weeklyHours, source: 'pacing_settings_no_date' };

  const dayOfMonth = d.getDate();
  const bucket = dayOfMonth <= 7 ? 'w1' : dayOfMonth <= 14 ? 'w2' : dayOfMonth <= 21 ? 'w3' : 'w4';
  const isActive = pacing[bucket] === true || String(pacing[bucket]).toUpperCase() === 'TRUE';

  return { assignedHours: isActive ? weeklyHours : 0, source: 'pacing_settings' };
}
