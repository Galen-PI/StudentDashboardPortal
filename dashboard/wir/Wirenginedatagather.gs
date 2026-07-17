/****************************************************
 * WIREngineDataGather.gs — V2
 * ------------------------------------------------
 * Gathers one student's raw inputs for the flag-based WIR
 * Engine (WIREngineV2.gs). Replaces the old point-based
 * engine's gather step.
 *
 * SUPERSEDED FROM THE OLD FILE (kept only as historical
 * context, not used):
 *   - monthRatio (plain rolling 4-week ratio, no trade-week
 *     awareness) -> replaced by weekHistory + the pace flag's
 *     own HS-week-filtered rolling window.
 *   - _wirGetActiveWeekFlag_ (Student Pacing Settings W1-W4
 *     toggle) -> superseded by the assignedHours-based
 *     HS-week inference. If Student Pacing Settings still
 *     serves some OTHER purpose outside WIR, leave that file/
 *     table alone — just no longer read here.
 *   - targetDaysLeft / _wirComputeTargetDaysLeft_ (raw calendar
 *     days to nextCourseTarget) -> replaced by
 *     wirComputeEffectiveCourseDays_ (trade-week-adjusted).
 *
 * CONFIRMED FIXES FROM TESTING (2026-07-15 test session):
 *   - Weekly Schedule only holds ~2 weeks of history and
 *     cannot answer "was this an HS week" for any prior week.
 *     HS-week is now inferred from assignedHours > 0 in
 *     Productivity Data, uniformly for every week.
 *   - Academic Snapshots' weekly snapshotDate is always a
 *     Friday; Productivity Data's weekLabel is always the
 *     Monday of the same week. wirBuildWeekHistory_ shifts
 *     the Friday date back 4 days before using it as a lookup
 *     key against Productivity Data — without this, credits
 *     silently read as 0 for every week.
 ****************************************************/

// ── Active roster — unchanged from the original file ────────
// Same "active + not both complete" filter used everywhere else
// that builds a student list from Name Mapping.
function getActiveStudentIdsForWIR() {
  const nameRows = readVaultSheetAsObjects_(VAULT_SHEET_NAME_MAPPING, VAULT_NAME_MAPPING_HEADERS);
  return nameRows
    .filter(row => {
      const isActive = row.active === true || String(row.active).toLowerCase() === 'true';
      const tradeComplete = String(row.tradeComplete || '').trim().toUpperCase() === 'COMPLETE';
      const academicComplete = String(row.academicComplete || '').trim().toUpperCase() === 'COMPLETE';
      return isActive && !tradeComplete && !academicComplete && row.studentId;
    })
    .map(row => String(row.studentId).trim());
}

// ── Per-student input gather — V2 shape ──────────────────────
// Produces exactly what wirEvaluateStudent_() in WIREngineV2.gs
// consumes. weekLabel is accepted for API-compatibility with the
// old signature (used as the "as-of" week for course pacing/
// deadline snapshots) but the flag engine itself walks the full
// weekHistory rather than evaluating a single week in isolation.
function gatherWIRInputForStudent(studentId, weekLabel) {
  const id = String(studentId).trim();

  // ── Completion status — checked first; if true, the engine
  // short-circuits and skips all flag evaluation for this student.
  const nameMapRow = readVaultRowsForStudent_(VAULT_SHEET_NAME_MAPPING, VAULT_NAME_MAPPING_HEADERS, id)[0];
  const academicComplete = !!nameMapRow &&
    String(nameMapRow.academicComplete || '').trim().toUpperCase() === 'COMPLETE';

  // ── Week history — hours, credits, HS-week inference, for
  // every week on file. This is what every streak/pace flag
  // walks backward through.
  const weekHistory = wirBuildWeekHistory_(id);
  const hasAnyData = weekHistory.length > 0;

  // ── Course data — remaining courses/credits, next course
  // target date.
  // Course data is now computed LIVE from Transcript Rows, matching
  // the same redesign applied in Code.gs and AcademicCreditsIngest.gs
  // -- Student Course Data is no longer synced or read anywhere.
  const transcriptRowsForStudent = readVaultRowsForStudent_(VAULT_SHEET_TRANSCRIPT_ROWS, VAULT_TRANSCRIPT_HEADERS, id);
  const courseData = transcriptRowsForStudent.length
    ? _computeCourseDataFromVaultRows_(transcriptRowsForStudent)
    : null;

  const courseCountLeft = courseData ? Number(courseData.courseCountLeft) : null;
  const nextCourseTarget = courseData ? _normVaultDateField_(courseData.nextCourseTarget, 'yyyy-MM-dd') : null;

  // ── Course pacing — trade-week-adjusted effective days left,
  // derived from the course's start date (first course ever ->
  // Student Info.startDate; every course after -> previous
  // course's targetDate in Transcript Rows).
  let effectiveCourseDaysLeft = null;
  if (courseData && nextCourseTarget) {
    const courseStartDate = wirDeriveCourseStartDate_(id, courseData.nextCourse);
    effectiveCourseDaysLeft = wirComputeEffectiveCourseDays_(courseStartDate, nextCourseTarget, weekHistory);
  }

  // ── Program deadline — anchor = earlier of Edgenuity start
  // date / earliest Trade Overview tarBeginDate; deadline =
  // anchor + 730 days.
  const programDeadline = wirComputeProgramDeadline_(id);

  return {
    studentId: id,
    weekLabel: weekLabel || null,
    academicComplete,
    hasAnyData,
    weekHistory,
    courseCountLeft,
    effectiveCourseDaysLeft,
    programDeadline,
    // Passthroughs kept for anything downstream (Profiles.gs,
    // WIRDataLayer row-writing) that still expects these fields —
    // not used by the flag engine itself.
    creditsRemaining: courseData ? Number(courseData.remainingCredits) : null,
    percent: courseData ? Number(courseData.completionPct) || 0 : 0,
  };
}

// ── Debug helper — inspect one student's gathered input before
// trusting it in a real run.
function debugGatherWIRInput(studentId, weekLabel) {
  const result = gatherWIRInputForStudent(studentId, weekLabel);
  Logger.log(JSON.stringify(result, null, 2));
}
