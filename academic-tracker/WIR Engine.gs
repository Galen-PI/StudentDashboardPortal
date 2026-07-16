/****************************************************
 * WIR ENGINE V2 — FLAG-BASED SCORING (ACADEMICS ONLY)
 * ------------------------------------------------
 * Full replacement for the point-based WIR Engine.
 * Design goals (per design conversation):
 *   1. Independent, self-contained flags — each fires on
 *      its own rule, carries its own reason + actions.
 *   2. Explicit UNKNOWN — no-data students never silently
 *      score as "on track."
 *   3. Transparent composite tier — built from WHICH flags
 *      fired, not an opaque point total.
 *   4. Trade-week-aware date math — a student is never
 *      penalized for weeks they physically couldn't have
 *      been working on HS coursework.
 *   5. TABE is display-only — never scored here.
 *
 * WIRED UP (2026-07-15):
 *   gatherWIRInputForStudent (WIREngineDataGather.gs) now produces
 *   weekHistory / courseCountLeft / academicComplete /
 *   effectiveCourseDaysLeft / programDeadline directly — no more
 *   manual stitching needed in debug helpers.
 *
 *   runWeeklyWIRGenerationV2(weekLabel) is the new weekly entry
 *   point, writing through the existing WIRDataLayer.gs storage
 *   layer unchanged. Not yet swapped in for the old
 *   runWeeklyWIRGeneration() / generateWeeklyWIR() client wrapper —
 *   do that once you're satisfied with results across more test
 *   students.
 *
 * STILL TO VERIFY:
 *   - Run runWeeklyWIRGenerationV2() against a real week label on
 *     the full active roster (not just single-student debug calls)
 *     before trusting it in production. Watch for anything that
 *     throws on a student with unusual data (e.g., no course data
 *     row at all, no productivity rows at all).
 ****************************************************/

// ============================================================
// CONFIG — every number in this system lives here, on purpose,
// so tuning later doesn't require hunting through logic.
// ============================================================
const WIR2_CONFIG = {
  PROGRAM_DEADLINE_DAYS: 730,          // 2 years from anchor date
  PROGRAM_DEADLINE_CRITICAL_DAYS: 30,
  PROGRAM_DEADLINE_WARNING_DAYS: 90,

  PACE_WINDOW_HS_WEEKS: 4,             // rolling window, HS-weeks only
  PACE_BEHIND_THRESHOLD: 0.50,
  PACE_AT_RISK_THRESHOLD: 0.75,

  ZERO_PROGRESS_STREAK_WEEKS: 4,       // consecutive HS-weeks, 0 credits
  CONSECUTIVE_NO_HOURS_WEEKS: 2,       // consecutive HS-weeks, 0 hours

  FINAL_STRETCH_COURSE_COUNT: 5,       // courseCountLeft <= this

  // COURSE_PACING tiers — trade-week-adjusted "effective days"
  // past/until target date. Kept from the legacy granular scale.
  COURSE_CRITICAL_OVERDUE_DAYS: -11,   // <= this (very overdue)
  COURSE_HIGH_OVERDUE_MIN: -10,
  COURSE_HIGH_OVERDUE_MAX: -4,
  COURSE_AT_RISK_OVERDUE_MIN: -3,
  COURSE_AT_RISK_OVERDUE_MAX: -1,
  COURSE_CRITICAL_DAYS: 5,
  COURSE_CONSTRAINED_DAYS: 10,
  COURSE_WARNING_DAYS: 21,
};

// ============================================================
// HS-WEEK DETECTION
// ------------------------------------------------
// ORIGINAL DESIGN (kept here for context, NOT used): check the
// student's Weekly Schedule for a class name starting with "HSE"
// or "HSD" that week. This was abandoned after confirming Weekly
// Schedule only ever holds ~2 weeks of history (current/upcoming)
// — it cannot answer this question for any past week, which is
// exactly where every streak/pace flag needs to look.
//
// ACTUAL RULE: a week counts as an "HS-week" if the student had
// any assigned academic hours that week (Productivity Data
// `assignedHours > 0`). This is inferred uniformly for every
// week — including the current one — rather than using the real
// schedule for recent weeks and inference for older ones, to
// avoid a seam where the same student's numbers are computed two
// different ways depending on how recent the week is.
//
// A week with assignedHours === 0 (trade, new student, completed
// both, etc.) is NOT an HS-week and is skipped entirely by every
// metric below — never counted as a zero.
// ============================================================
function wirIsHSWeek_(assignedHours) {
  return Number(assignedHours) > 0;
}

// ============================================================
// COURSE START DATE DERIVATION
//   First course ever  -> Student Info.startDate
//   Every course after -> previous course's targetDate
//                         (Transcript Rows, sorted by completion)
// ============================================================
function wirDeriveCourseStartDateFromRows_(startDate, transcriptRowsForStudent) {
  const transcriptRows = (transcriptRowsForStudent || [])
    .filter(r => String(r.completed || '').trim() !== '')
    .sort((a, b) => {
      const ad = _normVaultDateField_(a.targetDate, 'yyyy-MM-dd');
      const bd = _normVaultDateField_(b.targetDate, 'yyyy-MM-dd');
      return ad < bd ? -1 : ad > bd ? 1 : 0;
    });

  if (!transcriptRows.length) {
    // No completed courses on file yet — this IS their first course.
    return startDate;
  }

  const mostRecentlyCompleted = transcriptRows[transcriptRows.length - 1];
  const derivedStart = _normVaultDateField_(mostRecentlyCompleted.targetDate, 'yyyy-MM-dd');
  return derivedStart || startDate;
}

// Per-student wrapper — reads directly, used by single-student debug
// calls where re-reading a sheet once isn't a real cost.
function wirDeriveCourseStartDate_(studentId, currentCourseName) {
  const startDate = getStudentStartDate(studentId);
  const transcriptRows = readVaultRowsForStudent_(VAULT_SHEET_TRANSCRIPT_ROWS, VAULT_TRANSCRIPT_HEADERS, studentId);
  return wirDeriveCourseStartDateFromRows_(startDate, transcriptRows);
}

// ============================================================
// PROGRAM DEADLINE ANCHOR
//   Anchor = earlier of (Student Info.startDate) or
//            (earliest Trade Overview tarBeginDate)
//   Deadline = anchor + 730 days
// ============================================================
function wirComputeProgramDeadlineFromRows_(eduStart, tradeRowsForStudent) {
  let earliestTarBegin = null;
  (tradeRowsForStudent || []).forEach(r => {
    const d = _normVaultDateField_(r.tarBeginDate, 'yyyy-MM-dd');
    if (d && (!earliestTarBegin || d < earliestTarBegin)) earliestTarBegin = d;
  });

  let anchorStr = eduStart || null;
  if (earliestTarBegin && (!anchorStr || earliestTarBegin < anchorStr)) {
    anchorStr = earliestTarBegin;
  }

  if (!anchorStr) return { anchorDate: null, deadlineDate: null, daysLeft: null };

  const anchor = _parseLocalDate(anchorStr);
  if (!anchor) return { anchorDate: null, deadlineDate: null, daysLeft: null };

  const deadline = new Date(anchor.getTime());
  deadline.setDate(deadline.getDate() + WIR2_CONFIG.PROGRAM_DEADLINE_DAYS);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);

  const daysLeft = Math.round((deadline - today) / 86400000);

  return { anchorDate: anchorStr, deadlineDate: _toDateStr(deadline), daysLeft };
}

// Per-student wrapper — reads directly, used by single-student debug calls.
function wirComputeProgramDeadline_(studentId) {
  const eduStart = getStudentStartDate(studentId);
  const tradeRows = readVaultRowsForStudent_(VAULT_SHEET_TRADE_OVERVIEW, VAULT_TRADE_OVERVIEW_HEADERS, studentId);
  return wirComputeProgramDeadlineFromRows_(eduStart, tradeRows);
}

// ============================================================
// WEEK HISTORY BUILDER
// Merges Productivity Data (hours) + Academic Snapshots (credits)
// with the HS-week map, producing one ordered array of weeks —
// this is what ZERO_PROGRESS_STREAK, CONSECUTIVE_NO_HOURS, and
// the rolling pace window all walk backward through.
// ============================================================
function wirBuildWeekHistoryFromRows_(prodRowsForStudent, snapRowsForStudent) {
  const prodRows = (prodRowsForStudent || [])
    .map(r => Object.assign({}, r, { weekLabel: _normVaultDateField_(r.weekLabel, 'yyyy-MM-dd') }));

  const snapRows = (snapRowsForStudent || [])
    .filter(r => String(r.cadence || '').trim().toLowerCase() === 'weekly')
    .map(r => Object.assign({}, r, { snapshotDate: _normVaultDateField_(r.snapshotDate, 'yyyy-MM-dd') }));

  const creditsByWeek = {};
  snapRows.forEach(r => {
    // Academic Snapshots' weekly snapshotDate is always a Friday
    // (end of week); Productivity Data's weekLabel is always the
    // Monday of that same week. Shift back 4 days so both sheets
    // key off the same date for the same calendar week — without
    // this, the two never match and credits silently read as 0.
    const fridayDate = _parseLocalDate(r.snapshotDate);
    if (!fridayDate) return;
    const mondayDate = new Date(fridayDate.getTime());
    mondayDate.setDate(mondayDate.getDate() - 4);
    const mondayKey = _toDateStr(mondayDate);
    creditsByWeek[mondayKey] = (r.gain !== undefined && r.gain !== '') ? Number(r.gain) : 0;
  });

  const weeks = prodRows.map(r => {
    const wl = r.weekLabel;
    const assigned = Number(r.assignedHours) || 0;
    return {
      weekLabel: wl,
      isHSWeek: wirIsHSWeek_(assigned),
      hoursWorked: Number(r.actualWorkedTime) || 0,
      hoursAssigned: assigned,
      creditsEarned: creditsByWeek[wl] !== undefined ? creditsByWeek[wl] : 0,
    };
  });

  weeks.sort((a, b) => a.weekLabel < b.weekLabel ? -1 : a.weekLabel > b.weekLabel ? 1 : 0);
  return weeks;
}

// Per-student wrapper — reads directly, used by single-student debug calls.
function wirBuildWeekHistory_(studentId) {
  const prodRows = readVaultRowsForStudent_(VAULT_SHEET_PRODUCTIVITY, VAULT_PRODUCTIVITY_HEADERS, studentId);
  const snapRows = readVaultRowsForStudent_(VAULT_SHEET_ACADEMIC_SNAPSHOTS, VAULT_ACADEMIC_SNAPSHOT_HEADERS, studentId);
  return wirBuildWeekHistoryFromRows_(prodRows, snapRows);
}

// ============================================================
// FLAG EVALUATION — each flag is a small, self-contained
// function: (input) -> { fired, severity, reason, instructorAction,
// adminAction } or null if it doesn't fire. No flag reads another
// flag's output — this is what makes each one auditable on its own.
// ============================================================

// Shared helper: walk backward through HS-weeks only (skipping
// non-HS weeks entirely), counting a consecutive run where
// `conditionFn(week)` is true. Stops at first HS-week that fails
// the condition.
function wirCountConsecutiveHSWeeks_(weekHistory, conditionFn) {
  let count = 0;
  for (let i = weekHistory.length - 1; i >= 0; i--) {
    const w = weekHistory[i];
    if (!w.isHSWeek) continue; // skip, doesn't break or extend the streak
    if (conditionFn(w)) count++;
    else break;
  }
  return count;
}

function wirFlag_ZeroProgressStreak_(s) {
  const streak = wirCountConsecutiveHSWeeks_(s.weekHistory, w => w.creditsEarned === 0);
  if (streak < WIR2_CONFIG.ZERO_PROGRESS_STREAK_WEEKS) return null;
  return {
    tag: 'ZERO_PROGRESS_STREAK',
    severity: 'SEVERE',
    reason: `No credits earned in ${streak} consecutive HS weeks.`,
    instructorAction: 'Meet with student this week to identify the specific blocker (comprehension, motivation, technical, personal). Do not wait for next week.',
    adminAction: 'Review case for escalation. Confirm instructor has met with student and documented a plan.',
  };
}

function wirFlag_ConsecutiveNoHours_(s) {
  const streak = wirCountConsecutiveHSWeeks_(s.weekHistory, w => w.hoursWorked === 0);
  if (streak < WIR2_CONFIG.CONSECUTIVE_NO_HOURS_WEEKS) return null;
  return {
    tag: 'CONSECUTIVE_NO_HOURS',
    severity: 'SEVERE',
    reason: `Zero hours logged in ${streak} consecutive HS weeks.`,
    instructorAction: 'Contact student directly this week. Confirm they are still engaged with the program.',
    adminAction: 'Immediate review. Notify counselor if pattern continues past this week.',
  };
}

function wirFlag_HoursNoCredit_(s) {
  const thisWeek = s.weekHistory[s.weekHistory.length - 1];
  if (!thisWeek || !thisWeek.isHSWeek) return null;
  if (thisWeek.hoursWorked > 0 && thisWeek.creditsEarned === 0) {
    return {
      tag: 'HOURS_NO_CREDIT',
      severity: 'MODERATE',
      reason: 'Student logged hours this week but earned zero credits — possible test block.',
      instructorAction: 'Verify whether student is blocked on a test requiring supervision.',
      adminAction: 'If a test block is confirmed, coordinate a supervised session this week.',
    };
  }
  return null;
}

function wirFlag_NoHoursThisWeek_(s) {
  const thisWeek = s.weekHistory[s.weekHistory.length - 1];
  if (!thisWeek || !thisWeek.isHSWeek) return null;
  if (thisWeek.hoursWorked === 0) {
    return {
      tag: 'NO_HOURS_THIS_WEEK',
      severity: 'MODERATE',
      reason: 'No hours logged this week.',
      instructorAction: 'Check in with student — confirm reason for the missed week.',
      adminAction: 'Monitor. Escalate if this repeats next week.',
    };
  }
  return null;
}

function wirFlag_Pace_(s) {
  // Rolling window of the last N HS-weeks only (trade weeks skipped
  // entirely — never diluting the ratio).
  const hsWeeks = s.weekHistory.filter(w => w.isHSWeek);
  const recent = hsWeeks.slice(-WIR2_CONFIG.PACE_WINDOW_HS_WEEKS);
  if (!recent.length) return null;

  const worked = recent.reduce((sum, w) => sum + w.hoursWorked, 0);
  const assigned = recent.reduce((sum, w) => sum + w.hoursAssigned, 0);
  if (assigned <= 0) return null;

  const ratio = worked / assigned;

  if (ratio < WIR2_CONFIG.PACE_BEHIND_THRESHOLD) {
    return {
      tag: 'BEHIND_PACE',
      severity: 'MODERATE',
      reason: `Worked ${(ratio * 100).toFixed(0)}% of assigned hours over the last ${recent.length} HS weeks — behind pace.`,
      instructorAction: 'Review hours with student. Identify specific barriers to meeting expected hours.',
      adminAction: 'Weekly monitoring of hours trend. Flag if pattern continues 2+ more weeks.',
      _ratio: ratio,
    };
  }
  if (ratio < WIR2_CONFIG.PACE_AT_RISK_THRESHOLD) {
    return {
      tag: 'AT_RISK_PACE',
      severity: 'MILD',
      reason: `Worked ${(ratio * 100).toFixed(0)}% of assigned hours over the last ${recent.length} HS weeks — at-risk pace.`,
      instructorAction: 'Reinforce expected daily hours and pacing consistency during check-ins.',
      adminAction: 'No action required yet. Include in weekly summary review.',
      _ratio: ratio,
    };
  }
  return null;
}

function wirFlag_DecliningTrend_(s) {
  const hsWeeks = s.weekHistory.filter(w => w.isHSWeek);
  if (hsWeeks.length < 3) return null;
  const recent3 = hsWeeks.slice(-3);
  const ratios = recent3.map(w => w.hoursAssigned > 0 ? w.hoursWorked / w.hoursAssigned : null).filter(r => r !== null);
  if (ratios.length < 3) return null;

  const trend = ratios[0] - ratios[2]; // oldest minus newest, both as fractions
  if (trend > 0.03) { // more than 3 percentage points worse, newest vs oldest of the 3
    return {
      tag: 'DECLINING_TREND',
      severity: 'MILD',
      reason: 'Hours trend declining over the last 3 HS weeks.',
      instructorAction: 'Monitor engagement during academic block this week.',
      adminAction: 'No action required this week. Review again next week.',
    };
  }
  return null;
}

function wirFlag_ProgramDeadline_(s) {
  const pd = s.programDeadline;
  if (!pd || pd.daysLeft === null) return null;

  if (pd.daysLeft <= WIR2_CONFIG.PROGRAM_DEADLINE_CRITICAL_DAYS) {
    return {
      tag: 'PROGRAM_DEADLINE_CRITICAL',
      severity: 'SEVERE',
      reason: `${pd.daysLeft} day(s) remain before the 2-year program limit (anchor: ${pd.anchorDate}).`,
      instructorAction: 'Contact student immediately. Discuss credit acceleration options this week.',
      adminAction: 'Immediate case review. This is a hard institutional deadline — escalate today.',
    };
  }
  if (pd.daysLeft <= WIR2_CONFIG.PROGRAM_DEADLINE_WARNING_DAYS) {
    return {
      tag: 'PROGRAM_DEADLINE_WARNING',
      severity: 'MODERATE',
      reason: `${pd.daysLeft} day(s) remain before the 2-year program limit (anchor: ${pd.anchorDate}).`,
      instructorAction: 'Discuss timeline with student. Confirm remaining courses are realistically achievable.',
      adminAction: 'Add to weekly watch list. Re-check in 2 weeks.',
    };
  }
  return null;
}

// COURSE_PACING — trade-week-adjusted. "Effective days" walks
// only HS-weeks between course start and target date; if the
// target date has passed, this becomes an overdue calculation.
function wirComputeEffectiveCourseDays_(courseStartDate, courseTargetDate, weekHistory) {
  if (!courseStartDate || !courseTargetDate) return null;

  const start = _parseLocalDate(courseStartDate);
  const target = _parseLocalDate(courseTargetDate);
  if (!start || !target) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Simple version: raw calendar days to/from target, then
  // subtract calendar days that fell in non-HS weeks between
  // start and today (or target, whichever is earlier).
  const endForAdjustment = today < target ? today : target;
  let nonHSDaysElapsed = 0;
  weekHistory.forEach(w => {
    const wDate = _parseLocalDate(w.weekLabel);
    if (!wDate) return;
    if (wDate >= start && wDate <= endForAdjustment && !w.isHSWeek) {
      nonHSDaysElapsed += 7; // one non-HS week = 7 days not counted against the student
    }
  });

  const rawDaysLeft = Math.round((target - today) / 86400000);
  // Adjust: give back the non-HS days as extra runway.
  return rawDaysLeft + nonHSDaysElapsed;
}

function wirFlag_CoursePacing_(s) {
  const days = s.effectiveCourseDaysLeft;
  if (days === null || days === undefined) return null;
  const C = WIR2_CONFIG;

  if (days <= C.COURSE_CRITICAL_OVERDUE_DAYS) {
    return {
      tag: 'COURSE_CRITICAL_OVERDUE',
      severity: 'SEVERE',
      reason: `Current course target passed ${Math.abs(days)} effective day(s) ago — critically overdue.`,
      instructorAction: 'Contact student immediately during academic block. Provide same-day supervised work time.',
      adminAction: 'Immediate review. Schedule intervention meeting within 24-48 hours.',
    };
  }
  if (days >= C.COURSE_HIGH_OVERDUE_MIN && days <= C.COURSE_HIGH_OVERDUE_MAX) {
    return {
      tag: 'COURSE_HIGH_OVERDUE',
      severity: 'SEVERE',
      reason: `Current course target passed ${Math.abs(days)} effective day(s) ago.`,
      instructorAction: 'Schedule 1-on-1 check-in this week. Identify barriers.',
      adminAction: 'Review weekly hours trend. Notify counselor if pattern continues.',
    };
  }
  if (days >= C.COURSE_AT_RISK_OVERDUE_MIN && days <= C.COURSE_AT_RISK_OVERDUE_MAX) {
    return {
      tag: 'COURSE_AT_RISK_OVERDUE',
      severity: 'MODERATE',
      reason: `Current course target passed ${Math.abs(days)} effective day(s) ago — at risk.`,
      instructorAction: 'Monitor engagement closely this week.',
      adminAction: 'Weekly monitoring. Flag if unresolved next week.',
    };
  }
  if (days >= 0 && days <= C.COURSE_CRITICAL_DAYS) {
    return {
      tag: 'COURSE_CRITICAL',
      severity: 'SEVERE',
      reason: `Current course due in ${days} effective day(s). Immediate focus needed.`,
      instructorAction: 'Contact student immediately. Provide supervised work time this week.',
      adminAction: 'Immediate review required.',
    };
  }
  if (days > C.COURSE_CRITICAL_DAYS && days <= C.COURSE_CONSTRAINED_DAYS) {
    return {
      tag: 'COURSE_CONSTRAINED',
      severity: 'MODERATE',
      reason: `Current course due in ${days} effective day(s) — hours below target.`,
      instructorAction: 'Reinforce daily hour expectations this week.',
      adminAction: 'Weekly monitoring of hours trend.',
    };
  }
  if (days > C.COURSE_CONSTRAINED_DAYS && days <= C.COURSE_WARNING_DAYS) {
    return {
      tag: 'COURSE_WARNING',
      severity: 'MODERATE',
      reason: `Current course due in ${days} effective day(s) — approaching deadline.`,
      instructorAction: 'Monitor progress. Reinforce pacing consistency.',
      adminAction: 'No immediate action required. Include in weekly summary.',
    };
  }
  return null;
}

function wirFlag_FinalStretchSlipping_(s, paceFlag) {
  if (!paceFlag) return null; // requires BEHIND_PACE or AT_RISK_PACE to already be firing
  if (s.courseCountLeft === null || s.courseCountLeft === undefined) return null;
  if (s.courseCountLeft > WIR2_CONFIG.FINAL_STRETCH_COURSE_COUNT) return null;

  return {
    tag: 'FINAL_STRETCH_SLIPPING',
    severity: 'MODERATE',
    reason: `Only ${s.courseCountLeft} course(s) remaining, but currently slipping on pace — stakes are higher this close to completion.`,
    instructorAction: 'Prioritize this student this week — they are close to finishing but losing momentum.',
    adminAction: 'Add to weekly watch list as a near-completion priority.',
  };
}

// ============================================================
// MAIN EVALUATION — runs every flag independently, then builds
// the composite tier transparently from which ones fired.
// ============================================================
function wirEvaluateStudent_(s) {
  if (s.academicComplete) {
    return {
      tier: 'COMPLETE',
      flags: [],
      reason: 'Academic program complete. No further intervention needed.',
      instructorAction: 'No action required.',
      adminAction: 'No action required.',
    };
  }

  if (!s.hasAnyData) {
    return {
      tier: 'UNKNOWN',
      flags: [],
      reason: 'No academic data found for this student.',
      instructorAction: 'Verify student is enrolled and Vault data sources are populated correctly.',
      adminAction: 'Investigate missing data before assuming this student is on track.',
    };
  }

  const fired = [];

  const paceFlag = wirFlag_Pace_(s);
  if (paceFlag) fired.push(paceFlag);

  [
    wirFlag_ZeroProgressStreak_(s),
    wirFlag_ConsecutiveNoHours_(s),
    wirFlag_HoursNoCredit_(s),
    wirFlag_NoHoursThisWeek_(s),
    wirFlag_DecliningTrend_(s),
    wirFlag_ProgramDeadline_(s),
    wirFlag_CoursePacing_(s),
    wirFlag_FinalStretchSlipping_(s, paceFlag),
  ].forEach(f => { if (f) fired.push(f); });

  if (!fired.length) {
    return {
      tier: 'LOW',
      flags: [],
      reason: 'Meeting hours target and pace. No flags fired.',
      instructorAction: 'Routine monitoring. Reinforce positive performance.',
      adminAction: 'No action required.',
    };
  }

  const severeCount = fired.filter(f => f.severity === 'SEVERE').length;
  const moderateCount = fired.filter(f => f.severity === 'MODERATE').length;
  const hasProgramDeadlineCritical = fired.some(f => f.tag === 'PROGRAM_DEADLINE_CRITICAL');

  let tier;
  if (hasProgramDeadlineCritical) tier = 'HIGH';
  else if (severeCount >= 1) tier = 'HIGH';
  else if (moderateCount >= 2) tier = 'HIGH';
  else if (moderateCount === 1) tier = 'MEDIUM';
  else tier = 'LOW'; // only mild flags fired

  // Severity order for concatenation: SEVERE, then MODERATE, then MILD
  const order = { SEVERE: 0, MODERATE: 1, MILD: 2 };
  fired.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    tier,
    flags: fired.map(f => f.tag),
    reason: fired.map(f => f.reason).join(' '),
    instructorAction: fired.map(f => f.instructorAction).join(' '),
    adminAction: fired.map(f => f.adminAction).join(' '),
  };
}

// ============================================================
// DEBUG HELPERS — run these on real students before trusting
// this in a real weekly run.
// ============================================================
// ============================================================
// UI-FACING ENTRY POINTS — these are the exact function names
// Scripts.html calls via google.script.run. The old point-based
// engine had functions with these names; this file (the V2
// rewrite) didn't, which is why "generateWeeklyWIR is not a
// function" / "previewWIRForStudent is not a function" showed up
// after pasting this file in. These wrap the V2 flag engine to
// match what the UI already expects, so no front-end changes
// are needed.
// ============================================================

// Called by the "Generate Weekly WIR" button.
// Must return: { success, written, skipped, weekLabel, error? }
function generateWeeklyWIR(weekLabel, employeeId, role) {
  _requirePermission(role || ROLES.ADMIN, 'manage_overrides');
  try {
    const result = runWeeklyWIRGenerationV2(weekLabel);
    return {
      success: true,
      written: result.written,
      skipped: result.skipped,
      weekLabel: weekLabel,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function previewWIRForStudent(studentId, weekLabel, role) {
  try {
    const s = gatherWIRInputForStudent(studentId, weekLabel);
    const result = wirEvaluateStudent_(s);

    const thisWeek = s.weekHistory[s.weekHistory.length - 1] || null;
    const wirTierScoreByTier = { HIGH: 80, MEDIUM: 50, LOW: 10, COMPLETE: 0, UNKNOWN: 0 };

    const urgencyLabel = result.tier === 'HIGH' ? 'IMMEDIATE'
      : result.tier === 'MEDIUM' ? 'HIGH'
      : 'NORMAL';

    return {
      success: true,
      priority: result.tier,
      urgencyLabel: urgencyLabel,
      wirTierScore: wirTierScoreByTier[result.tier] != null ? wirTierScoreByTier[result.tier] : 0,
      reason: result.reason,
      tags: result.flags,
      input: {
        thisWeekHours: thisWeek ? thisWeek.hoursWorked : null,
        weeklyTarget: thisWeek ? thisWeek.hoursAssigned : null,
        isActiveWeek: thisWeek ? thisWeek.isHSWeek : null,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Weekly entry point — evaluates every active student and writes
// results via WIRDataLayer.gs's appendWIRReportRows(). Mirrors the
// old runWeeklyWIRGeneration()'s role.
//
// PERFORMANCE (fixed 2026-07-15): the original version called
// gatherWIRInputForStudent per student, which re-read Name Mapping,
// Productivity Data, Academic Snapshots, Transcript Rows (twice),
// Trade Overview, and Student Info FROM SCRATCH for every single
// student -- ~7 full-sheet reads x 171 students = ~1,200 reads in
// one run. A real run hit ~4+ minutes before being manually killed,
// right at the edge of Apps Script's 6-minute execution limit --
// and since appendWIRReportRows only ran once at the very end, a
// timeout would have lost the ENTIRE run, not just the unprocessed
// students.
//
// Fixed by reading each sheet exactly ONCE up front, grouping by
// studentId in memory (same pattern already proven in CourseSync --
// 163 students, 2.4 seconds), and writing in chunks as it goes so a
// future timeout only loses whatever hadn't been written yet, not
// everything.
function _formatGradGap_(daysLeft) {
  if (daysLeft == null) return '';
  if (daysLeft < 0)   return `⛔ ${Math.abs(daysLeft)}d over limit`;
  if (daysLeft <= 60) return `🟡 ${daysLeft}d left`;
  return `🟢 ${daysLeft}d left`;
}

function runWeeklyWIRGenerationV2(weekLabel) {
  if (!weekLabel) throw new Error('weekLabel is required, e.g. "2026-07-06"');
  const t0 = Date.now();

  const studentIds = getActiveStudentIdsForWIR();
  Logger.log('runWeeklyWIRGenerationV2: ' + studentIds.length + ' active students found.');

  // ── Read every sheet ONCE, group by studentId ────────────────
  const nameMapRows   = readVaultSheetAsObjects_(VAULT_SHEET_NAME_MAPPING, VAULT_NAME_MAPPING_HEADERS);
  const prodRows      = readVaultSheetAsObjects_(VAULT_SHEET_PRODUCTIVITY, VAULT_PRODUCTIVITY_HEADERS);
  const snapRows      = readVaultSheetAsObjects_(VAULT_SHEET_ACADEMIC_SNAPSHOTS, VAULT_ACADEMIC_SNAPSHOT_HEADERS);
  const transcriptRows = readVaultSheetAsObjects_(VAULT_SHEET_TRANSCRIPT_ROWS, VAULT_TRANSCRIPT_HEADERS);
  const tradeRows     = readVaultSheetAsObjects_(VAULT_SHEET_TRADE_OVERVIEW, VAULT_TRADE_OVERVIEW_HEADERS);
  const studentInfoSheet = _wirEnsureStudentInfoSheet_();
  const studentInfoLastRow = studentInfoSheet.getLastRow();
  const studentInfoRows = studentInfoLastRow >= 2
    ? studentInfoSheet.getRange(2, 1, studentInfoLastRow - 1, WIR_SI_HEADERS.length).getValues()
    : [];

  Logger.log('runWeeklyWIRGenerationV2: all sheets read in ' + (Date.now() - t0) + 'ms.');

  function groupBy_(rows) {
    const map = {};
    rows.forEach(r => {
      const id = String(r.studentId || '').trim();
      if (!id) return;
      if (!map[id]) map[id] = [];
      map[id].push(r);
    });
    return map;
  }

  const nameMapById    = {};
  nameMapRows.forEach(r => { const id = String(r.studentId || '').trim(); if (id) nameMapById[id] = r; });
  const prodByStudent  = groupBy_(prodRows);
  const snapByStudent  = groupBy_(snapRows);
  const transcriptByStudent = groupBy_(transcriptRows);
  const tradeByStudent = groupBy_(tradeRows);
  const startDateById  = {};
  studentInfoRows.forEach(row => {
    const id = _wirNormalizeKeyPart_(row[0]);
    if (id) startDateById[id] = _wirNormalizeKeyPart_(row[1]) || null;
  });

  // ── Evaluate each student using only in-memory data — no reads
  // inside this loop at all ────────────────────────────────────
  const CHUNK_SIZE = 25;
  let pendingRows = [];
  let totalWritten = 0;
  let totalSkipped = 0;

  function flushChunk_() {
    if (!pendingRows.length) return;
    const result = appendWIRReportRows(pendingRows);
    totalWritten += result.written;
    totalSkipped += result.skipped;
    pendingRows = [];
  }

  studentIds.forEach((studentId, idx) => {
    const nameMapRow = nameMapById[studentId] || null;
    const academicComplete = !!nameMapRow &&
      String(nameMapRow.academicComplete || '').trim().toUpperCase() === 'COMPLETE';

    const weekHistory = wirBuildWeekHistoryFromRows_(
      prodByStudent[studentId] || [], snapByStudent[studentId] || []
    );
    const hasAnyData = weekHistory.length > 0;

    const startDate = startDateById[studentId] || null;
    const studentTranscriptRows = transcriptByStudent[studentId] || [];
    const studentTradeRows = tradeByStudent[studentId] || [];

    const courseData = studentTranscriptRows.length
      ? _computeCourseDataFromVaultRows_(studentTranscriptRows)
      : null;

    let effectiveCourseDaysLeft = null;
    const nextCourseTarget = courseData ? _normVaultDateField_(courseData.nextCourseTarget, 'yyyy-MM-dd') : null;
    if (courseData && nextCourseTarget) {
      const courseStartDate = wirDeriveCourseStartDateFromRows_(startDate, studentTranscriptRows);
      effectiveCourseDaysLeft = wirComputeEffectiveCourseDays_(courseStartDate, nextCourseTarget, weekHistory);
    }

    const programDeadline = wirComputeProgramDeadlineFromRows_(startDate, studentTradeRows);

    const s = {
      studentId,
      weekLabel,
      academicComplete,
      hasAnyData,
      weekHistory,
      courseCountLeft: courseData ? Number(courseData.courseCountLeft) : null,
      effectiveCourseDaysLeft,
      programDeadline,
      creditsRemaining: courseData ? Number(courseData.remainingCredits) : null,
      percent: courseData ? Number(courseData.completionPct) || 0 : 0,
    };

    const result = wirEvaluateStudent_(s);
    const thisWeek = weekHistory.length ? weekHistory[weekHistory.length - 1] : null;

    pendingRows.push({
      studentId,
      weekLabel,
      status: result.tier,
      priority: result.tier,
      adminPriority: result.tier,
      urgency: result.tier === 'HIGH' ? 'IMMEDIATE' : (result.tier === 'MEDIUM' ? 'HIGH' : 'NORMAL'),
      percent: s.percent,
      weeklyTarget:     thisWeek ? thisWeek.hoursAssigned : '',
      thisWeekHours:    thisWeek ? thisWeek.hoursWorked   : '',
      lastActiveHours:  '',
      lastActiveLabel:  '',
      creditsThisWeek:  thisWeek ? thisWeek.creditsEarned : '',
      courseDaysLeft:   s.effectiveCourseDaysLeft != null ? s.effectiveCourseDaysLeft : '',
      issueTags: result.flags.join('; '),
      detectedPatterns: result.flags.join('; '),
      instructorAction: result.instructorAction,
      coordinatorAction: result.adminAction,
      reason: result.reason,
      streak: '',
      trajectory: '',
      gradGap: _computeGradGap_(s),
      generatedDate: new Date().toISOString(),
    });

    if (pendingRows.length >= CHUNK_SIZE) flushChunk_();

    if ((idx + 1) % 50 === 0) {
      Logger.log('runWeeklyWIRGenerationV2: ' + (idx + 1) + '/' + studentIds.length +
        ' processed, ' + (Date.now() - t0) + 'ms elapsed.');
    }
  });

  flushChunk_(); // write whatever's left under CHUNK_SIZE

  Logger.log('runWeeklyWIRGenerationV2 complete: ' + totalWritten + ' written, ' +
    totalSkipped + ' already existed, total time ' + (Date.now() - t0) + 'ms.');
  return { written: totalWritten, skipped: totalSkipped };
}
