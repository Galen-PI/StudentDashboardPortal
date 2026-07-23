// ============================================================
// CourseSync.gs
// ============================================================

function removeCourseSyncTriggerOneTime() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(t => {if (t.getHandlerFunction() === 'syncStudentCourseData') {ScriptApp.deleteTrigger(t); removed++;}});
  Logger.log('Removed ' + removed + ' syncStudentCourseData trigger(s).');
}

const GRADUATION_CREDITS_REQUIRED = 23; // must match maxCredits total in 
function _computeCourseDataFromVaultRows_(courses) {
  const totalCredits = courses.reduce((s, c) => s + (Number(c.credit) || 0), 0);
  const totalHours   = courses.reduce((s, c) => s + (Number(c.classHours) || 0), 0);
  const remaining = courses.filter(c => c.completed !== true);
  const remainingHours = remaining.reduce((s, c) => s + (Number(c.classHours) || 0), 0);
  const earnedCredits = courses
    .filter(c => c.completed === true || c.transfer === true)
    .reduce((s, c) => s + (Number(c.credit) || 0), 0);
  const remainingCredits = Math.max(GRADUATION_CREDITS_REQUIRED - earnedCredits, 0);
  const completionPct = +Math.min((earnedCredits / GRADUATION_CREDITS_REQUIRED) * 100, 100).toFixed(1);
  const nonElective = remaining.filter(c => !String(c.courseName || '').toLowerCase().includes('pathway elective'));
  const candidates = nonElective.length ? nonElective : remaining;
  const withTarget = candidates.filter(c => c.targetDate);
  let nextCourseRow;
  if (withTarget.length) {nextCourseRow = withTarget.reduce((soonest, c) => _targetDateSortKey_(c.targetDate) < _targetDateSortKey_(soonest.targetDate) ? c : soonest);} else {
    nextCourseRow = candidates[0] || null;
  }

  return {
    remainingCredits: +remainingCredits.toFixed(2),
    remainingHours:   +remainingHours.toFixed(2),
    courseCountLeft:  remaining.length,
    nextCourse:       nextCourseRow ? String(nextCourseRow.courseName || '') : '',
    nextCourseHours:  nextCourseRow ? (Number(nextCourseRow.classHours) || 0) : 0,
    nextCourseTarget: nextCourseRow ? _isoToMDY_(nextCourseRow.targetDate) : '',
    totalCredits:     +totalCredits.toFixed(2),
    totalHours:       +totalHours.toFixed(2),
    completionPct,
  };
}

// Reformats a Vault ISO date string ("2026-08-09") to the same
function _isoToMDY_(isoStr) {
  if (!isoStr) return '';
  if (isoStr instanceof Date && !isNaN(isoStr.getTime())) {
    return (isoStr.getMonth() + 1) + '/' + isoStr.getDate() + '/' + isoStr.getFullYear();
  }
  const match = String(isoStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(isoStr);
  const year = match[1], month = Number(match[2]), day = Number(match[3]);
  return month + '/' + day + '/' + year;
}

function _targetDateSortKey_(v) {
  if (!v) return '';
  if (v instanceof Date && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v);
}

// ── Kept: debug/visibility helpers ───────────────────────────
function debugCourseDataLookup(studentId) {
  const allRows = readVaultSheetAsObjects_(VAULT_SHEET_TRANSCRIPT_ROWS, VAULT_TRANSCRIPT_HEADERS);
  const courses = allRows.filter(row => String(row.studentId).trim() === String(studentId).trim());
  if (!courses.length) {
    Logger.log('No transcript rows found for studentId: ' + studentId);
    return;
  }
  const result = _computeCourseDataFromVaultRows_(courses);
  Logger.log('Result for studentId ' + studentId + ' (' + courses.length + ' course rows):');
  Logger.log(JSON.stringify(result, null, 2));
  const remaining = courses.filter(c => c.completed !== true);
  Logger.log('All ' + remaining.length + ' incomplete course(s) on file, in row order:');
  remaining.forEach((c, i) => {
    Logger.log('  [' + i + '] ' + (c.courseName || '(no name)') +
      ' | targetDate: ' + (c.targetDate || '(blank)') +
      ' | startDate: ' + (c.startDate || '(blank)') +
      ' | classHours: ' + (c.classHours || 0));
  });
}

function debugCourseDataLookupTest() {
  debugCourseDataLookup('PUT_STUDENT_ID_HERE');
}

function debugSyncSkipped() {
  const nameRows = readVaultSheetAsObjects_(VAULT_SHEET_NAME_MAPPING, VAULT_NAME_MAPPING_HEADERS);
  const allTranscriptRows = readVaultSheetAsObjects_(VAULT_SHEET_TRANSCRIPT_ROWS, VAULT_TRANSCRIPT_HEADERS);
  const idsWithTranscripts = new Set(allTranscriptRows.map(r => String(r.studentId).trim()));
  const missing = nameRows.filter(row => {
    const isActive = row.active === true || String(row.active).toLowerCase() === 'true';
    const bothComplete =
      String(row.tradeComplete || '').trim().toUpperCase() === 'COMPLETE' &&
      String(row.academicComplete || '').trim().toUpperCase() === 'COMPLETE';
    if (!isActive || bothComplete || !row.studentId) return false;
    return !idsWithTranscripts.has(String(row.studentId).trim());
  });

  Logger.log('Students with no transcript rows (' + missing.length + '):');
  missing.forEach(m => Logger.log('  ' + (m.masterName || m.studentId)));
  return missing.length;
}
