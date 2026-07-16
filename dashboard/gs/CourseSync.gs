// ============================================================
// CourseSync.gs — DEPRECATED as a sync job (2026-07-15 redesign)
// ------------------------------------------------------------
// Student Course Data is no longer written to. Course data is now
// computed LIVE from Transcript Rows on every dashboard rebuild
// (see Code.gs, _rebuildDashboardData), using the exact same
// _computeCourseDataFromVaultRows_ math this file always used —
// it's kept here unchanged and reused, not duplicated.
//
// WHY: Student Course Data was a synced, weekly-refreshed copy of
// Transcript Rows. Anything that changed between Monday runs (a
// completed course, a corrected transcript) wouldn't show up
// anywhere downstream — Overview, risk scoring, WIR — until the
// next sync. This caused a real, confirmed bug: a student who
// finished her program mid-week continued to score as "Needs
// Attention" on stale, incomplete-looking numbers days later.
// Removing the synced middle layer removes the entire class of
// staleness bug, since there's nothing left to go stale.
//
// REMOVED:
//   - syncStudentCourseData()          (the batch job itself)
//   - _writeStudentCourseDataToVault_() (wrote to the now-unused sheet)
//   - installCourseSyncTrigger() / removeCourseSyncTrigger()
//     If you had this trigger installed, run
//     removeCourseSyncTriggerOneTime() below once, then delete it.
//
// KEPT (still doing real work, called from Code.gs now instead of
// from the old batch job):
//   - _computeCourseDataFromVaultRows_()
//   - _isoToMDY_()
//
// KEPT (still useful — this is now your standing visibility check
// for the "new student, no transcript yet" gap, since real
// automation isn't possible without an external transcript-import
// source. Recommend running this on a schedule, e.g. weekly
// alongside the roster upload, or adding its output to whatever
// digest email already exists):
//   - debugSyncSkipped()
//
// Student Course Data (the sheet) can be left alone — nothing
// reads or writes it anymore, it's a frozen historical artifact.
// Safe to delete once you've confirmed nothing else references it.
// ============================================================

// One-time cleanup — run this once from the Apps Script editor to
// remove the old Monday 5am trigger, then delete this function.
function removeCourseSyncTriggerOneTime() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'syncStudentCourseData') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  Logger.log('Removed ' + removed + ' syncStudentCourseData trigger(s).');
}

// ── Kept: the actual math, unchanged ─────────────────────────
// Computes the same summary shape the legacy per-tab scan used to
// produce, but from an array of flat Transcript Rows objects.
// remainingCredits always uses the sum-of-incomplete-course-credits
// approach — the legacy "L30 formula" special case had no Vault
// equivalent, and its own fallback logic already computed it this
// same way.
function _computeCourseDataFromVaultRows_(courses) {
  const totalCredits = courses.reduce((s, c) => s + (Number(c.credit) || 0), 0);
  const totalHours   = courses.reduce((s, c) => s + (Number(c.classHours) || 0), 0);

  const remaining = courses.filter(c => c.completed !== true);
  const remainingCredits = remaining.reduce((s, c) => s + (Number(c.credit) || 0), 0);
  const remainingHours   = remaining.reduce((s, c) => s + (Number(c.classHours) || 0), 0);

  const completionPct = totalCredits > 0
    ? +((1 - remainingCredits / totalCredits) * 100).toFixed(1)
    : 0;

  const nextCourseRow =
    remaining.find(c => !String(c.courseName || '').toLowerCase().includes('pathway elective'))
    || remaining[0]
    || null;

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
// M/D/YYYY display format the legacy path produced.
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
}

// Standing visibility check for the "new student, no transcript
// yet" gap. Run this periodically (recommend: weekly, alongside
// the roster upload) rather than discovering it by accident.
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
