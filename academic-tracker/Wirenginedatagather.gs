/****************************************************
 * WIREngineDataGather.gs — V2
 * ------------------------------------------------
 * Gathers one student's raw inputs for the flag-based WIR Engine (WIREngineV2.gs).
 ****************************************************/

// ── Active roster — unchanged from the original file ────────
// Same "active + not both complete" filter used everywhere else that builds a student list from Name Mapping.
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
function gatherWIRInputForStudent(studentId, weekLabel) {
  const id = String(studentId).trim();
  const nameMapRow = readVaultRowsForStudent_(VAULT_SHEET_NAME_MAPPING, VAULT_NAME_MAPPING_HEADERS, id)[0];
  const academicComplete = !!nameMapRow &&
    String(nameMapRow.academicComplete || '').trim().toUpperCase() === 'COMPLETE';

  // ── Week history —
  const weekHistory = wirBuildWeekHistory_(id);
  const hasAnyData = weekHistory.length > 0;

  // ── Course data — remaining courses/credits, next course
  const transcriptRowsForStudent = readVaultRowsForStudent_(VAULT_SHEET_TRANSCRIPT_ROWS, VAULT_TRANSCRIPT_HEADERS, id);
  const courseData = transcriptRowsForStudent.length
    ? _computeCourseDataFromVaultRows_(transcriptRowsForStudent)
    : null;
  const courseCountLeft = courseData ? Number(courseData.courseCountLeft) : null;
  const nextCourseTarget = courseData ? _normVaultDateField_(courseData.nextCourseTarget, 'yyyy-MM-dd') : null;

  // ── Course pacing — trade-week-adjusted effective days left, derived from the course's start date (first course ever -> Student Info.startDate; every course after -> previous course's targetDate in Transcript Rows).
  let effectiveCourseDaysLeft = null;
  if (courseData && nextCourseTarget) {
    const courseStartDate = wirDeriveCourseStartDate_(id, courseData.nextCourse);
    effectiveCourseDaysLeft = wirComputeEffectiveCourseDays_(courseStartDate, nextCourseTarget, weekHistory);
  }

  // ── Program deadline — anchor = earlier of Edgenuity start
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
    creditsRemaining: courseData ? Number(courseData.remainingCredits) : null,
    percent: courseData ? Number(courseData.completionPct) || 0 : 0,
  };
}

// ── Debug helper — 
function debugGatherWIRInput(studentId, weekLabel) {
  const result = gatherWIRInputForStudent(studentId, weekLabel);
  Logger.log(JSON.stringify(result, null, 2));
}
