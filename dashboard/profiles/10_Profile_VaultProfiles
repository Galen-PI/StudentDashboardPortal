// ============================================================
// ProfilesVault.gs — Student profile assembly (Vault-native)
// ------------------------------------------------------------
// Owns: turning raw Vault sheet rows into the profile objects the
// dashboard actually renders. One pass: read-shape-index everything
// up front, build one profile per active Name Mapping row, apply
// overrides/auto-clear/merges, sort, return.
// ============================================================

// The main assembly function — called once per dashboard rebuild
// with every sheet already read and passed in (no reads happen in
// here). Order of operations matters:
//   1. Build a bare profile per active student (academic/trades/
//      time/intervention/risk)
//   2. Apply overrides + compute risk trend
//   3. Auto-clear any stale NOT_STARTED/trade_name overrides the new
//      data invalidates (see AUTO_CLEAR_RULES_ below)
//   4. Apply merges (folds a merged student's data into their target
//      and drops their card — see _applyMerges in Profiles.gs)
//   5. Sort by display name
// Inactive students (Name Mapping active=false) are filtered out at
// step 1 and never become profiles at all — see getArchivedStudents
// in Datafetch.gs for how the Restore list still sees them.
function buildStudentProfilesFromVault(
  nameMap, courseDataById, tradeOverviewRows, tradeSnapshotRows,
  productivityRows, wirCombined, scheduleByStudentId, tabeById, overrides,
  startDateById, academicSnapshotRows, weeklyHoursHistoryByStudentId
) {
  weeklyHoursHistoryByStudentId = weeklyHoursHistoryByStudentId || {};
  academicSnapshotRows = academicSnapshotRows || [];
  const weeklySnapshotsByStudent_ = {};
  academicSnapshotRows
    .filter(r => String(r.cadence || '').trim().toLowerCase() === 'weekly')
    .forEach(r => {
      const id = String(r.studentId || '').trim();
      if (!id) return;
      const friday = _parseLocalDate(_normVaultDateField_(r.snapshotDate, 'yyyy-MM-dd'));
      if (!friday) return;
      const monday = new Date(friday.getTime());
      monday.setDate(monday.getDate() - 4);
      const mondayKey = _toDateStr(monday);
      if (!weeklySnapshotsByStudent_[id]) weeklySnapshotsByStudent_[id] = {};
      weeklySnapshotsByStudent_[id][mondayKey] =
        (r.gain !== undefined && r.gain !== '') ? Number(r.gain) : null;
    });
  nameMap              = nameMap              || [];
  courseDataById       = courseDataById       || {};
  tradeOverviewRows    = tradeOverviewRows    || [];
  tradeSnapshotRows    = tradeSnapshotRows    || [];
  productivityRows     = productivityRows     || [];
  wirCombined          = wirCombined          || [];
  scheduleByStudentId  = scheduleByStudentId  || {};
  tabeById             = tabeById             || {};
  overrides            = overrides            || [];
  startDateById        = startDateById        || {};

  const tradesByStudent = _indexByMulti(tradeOverviewRows, r => String(r.studentId || '').trim());

  const snapshotsByStudentTrade = {};
  tradeSnapshotRows.forEach(r => {
    const key = String(r.studentId || '').trim() + '||' + String(r.trade || '').trim();
    (snapshotsByStudentTrade[key] = snapshotsByStudentTrade[key] || []).push(r);
  });

  const productivityByStudent = _indexByMulti(productivityRows, r => String(r.studentId || '').trim());

  const wirByStudent = {};
  wirCombined.forEach(c => {
    if (c.report && c.report.studentId) wirByStudent[String(c.report.studentId).trim()] = c;
  });

  const tradeCompleteByStudent = {};
  tradeOverviewRows.forEach(r => {
    const pct = Number(r.overallPercent);
    if (!isNaN(pct) && pct >= 100) {
      const sid = String(r.studentId || '').trim();
      (tradeCompleteByStudent[sid] = tradeCompleteByStudent[sid] || []).push(r.trade);
    }
  });

  const overridesByStudent = {};
  overrides.forEach(o => {
    (overridesByStudent[o.studentId] = overridesByStudent[o.studentId] || []).push(o);
  });
  const mergeMap = {};
  overrides.forEach(o => {
    if (o.type === 'merged_into' && o.value) mergeMap[o.studentId] = String(o.value).trim();
  });

  const profiles = [];
  nameMap.forEach(map => {
    const id = String(map.studentId || '').trim();
    if (!id) return;

    const isActive = map.active === true || String(map.active).trim().toUpperCase() === 'TRUE';
    if (!isActive) return;

    const displayName       = String(map.masterName || '').trim() || id;
    const hsComplete        = String(map.academicComplete || '').trim().toUpperCase() === 'COMPLETE';
    const tradeCompleteFlag = String(map.tradeComplete || '').trim().toUpperCase() === 'COMPLETE';
    const examProgram       = String(map.examProgram || '').trim() || null;   // ← NEW

    const tradeRows   = tradesByStudent[id] || [];
    const productivity = productivityByStudent[id] || [];
    const wirEntry     = wirByStudent[id] || null;
    const tabe          = tabeById[id] || null;
    const scheduledAcademicHours = scheduleByStudentId[id] || null;
    const completedTrades = tradeCompleteByStudent[id] || [];

    const courseData = courseDataById[id] || null;

    // Computed for EVERY student, regardless of whether they have
    // academic course data — a pure-trades student (no HS/GED
    // enrollment at all) still needs "In Trades"/"Currently
    // Unassigned" to work, since that's exactly who those states are
    // for. Previously this only lived inside _buildAcademicFromCourseData_,
    // which returns null immediately for a student with no courseData —
    // silently skipping trade/unassigned detection for exactly the
    // students it matters most for.
    const studentWeeklyHistory = weeklyHoursHistoryByStudentId[id] || [];
    const resolvedThisWeek = _resolveAssignedHours_(studentWeeklyHistory, _currentWeekMondayLabel_());
    const thisWeekWorkedHours = (() => {
      const sortedWeeks = (productivity || [])
        .filter(p => p.weekLabel)
        .sort((a, b) => String(b.weekLabel).localeCompare(String(a.weekLabel)));
      const thisWeekRow = sortedWeeks.find(w => String(w.weekLabel) === _currentWeekMondayLabel_()) || null;
      return thisWeekRow ? (Number(thisWeekRow.actualWorkedTime) || 0) : null;
    })();

    const academic = _buildAcademicFromCourseData_(courseData, startDateById[id] || null, productivity, weeklySnapshotsByStudent_[id] || {}, map.examProgram, overridesByStudent[id], studentWeeklyHistory);

    const trades       = tradeRows.length
      ? tradeRows.map(t => _buildTradeRowFromVault_(t, snapshotsByStudentTrade))
      : null;
    const time          = _buildTimeFromProductivity_(productivity);
    const intervention = wirEntry ? _buildInterventionFromWirEntry_(wirEntry) : null;

    const tradeComplete = tradeCompleteFlag || completedTrades.length > 0;
    const risk = _calcRisk(
      academic, trades, time, hsComplete, tradeComplete,
      completedTrades, intervention, scheduledAcademicHours
    );

    profiles.push({
      id, displayName,
      // Previously hardcoded to false — never actually reflected
      // anything, so the "No Data" type filter could never match
      // any student. Now true when the student has neither
      // academic nor trade data (same condition as the risk-level
      // 'UNKNOWN' / "No Data Yet" chip).
      mappingMissing:         !academic && !(trades && trades.length),
      hsComplete,
      tradeComplete,
      examProgram,                              
      completedTrades,
      statusTag:              null,
      academicStatusOverride: null,
      tradeStatusOverride:    null,
      tradeNameOverride:      null,
      lastModified:           null,
      notes:                  [],
      progressSnapshot:       null,
      progressSnapshots:      [],
      isStale:                false,
      riskTrend:              null,
      staffNote:              null,
      hsdOverride:            null,
      academicId:             id,
      tradesId:               id,
      academic, trades, time, intervention, risk,
      // Top-level, computed for every student regardless of whether
      // they have academic course data — see the comment above where
      // these are resolved. This is what computeThisWeekDisplay_ (client)
      // should read from, not p.academic.thisWeek* (which only exists
      // for students with an academic profile section at all).
      thisWeekAssignedHours: resolvedThisWeek.assignedHours,
      thisWeekSource:        resolvedThisWeek.source,
      thisWeekHasTrade:      resolvedThisWeek.hasTrade,
      thisWeekWorkedHours,
      hasAcademic:            !!academic,
      hasTrades:              !!(trades && trades.length),
      hasTime:                !!time,
      hasIntervention:        !!intervention,
      scheduledAcademicHours: scheduledAcademicHours || null,
      tabe:                   tabe || null,
      hasTABE:                !!(tabe && (tabe.math || tabe.reading)),
      courseData:             courseData || null,
    });
  });

  // Second, separate auto-clear system — persists the clear back to
  // the sheet (writes an 'auto_clear_note' override row), unlike
  // _shouldAutoClearNotStarted_ (Profiles.gs/_applyOverrides above),
  // which only clears the in-memory value for this render.
  //
  // NOTE: rules 1 and 2 below (academic_status/trade_status
  // NOT_STARTED) check the exact same condition as
  // _shouldAutoClearNotStarted_, which already ran via _applyOverrides
  // just above. By the time these rules check, a real NOT_STARTED
  // match has usually already been nulled out in memory — so rules 1
  // and 2 rarely fire here in practice; _shouldAutoClearNotStarted_
  // beat them to it. Only rules 3 (TRADE_COMPLETE) and 4 (trade_name
  // mismatch) cover conditions _shouldAutoClearNotStarted_ doesn't
  // check, so those are the two doing real work. Worth consolidating
  // into one system rather than two that overlap.
  const AUTO_CLEAR_RULES_ = [
    {
      type: 'academic_status',
      matches: p => p.academicStatusOverride === 'NOT_STARTED' &&
                    !!(p.academic && p.academic.start && p.academic.targetDate),
      reason: 'Student has a start date and target date on file.',
    },
    {
      type: 'trade_status',
      matches: p => p.tradeStatusOverride === 'NOT_STARTED' && p.hasTrades === true,
      reason: 'Student has an active trade enrollment on file.',
    },
    {
      type: 'trade_status',
      matches: p => p.tradeStatusOverride === 'TRADE_COMPLETE' && p.hasTrades === true,
      reason: 'Student has an active (re-enrolled) trade on file, overriding a stale Complete status.',
    },
    {
      type: 'trade_name',
      matches: p => {
        if (!p.tradeNameOverride || !p.hasTrades) return false;
        const activeNames = (p.trades || []).map(t => t.tarName);
        return !activeNames.includes(p.tradeNameOverride);
      },
      reason: 'Overridden trade name no longer matches the student\'s active trade enrollment.',
    },
  ];

  const overrideFieldByType_ = {
    academic_status: 'academicStatusOverride',
    trade_status:    'tradeStatusOverride',
    trade_name:      'tradeNameOverride',
    hsd_class:       'hsdOverride',
  };

  profiles.forEach(p => {
    _applyOverrides(p, overridesByStudent);
    _computeRiskTrend(p);
  });

  const _overridesToAutoClear = [];
  profiles.forEach(p => {
    AUTO_CLEAR_RULES_.forEach(rule => {
      if (rule.matches(p)) {
        _overridesToAutoClear.push({ studentId: p.id, type: rule.type, reason: rule.reason });
        p[overrideFieldByType_[rule.type]] = null;
      }
    });
});

if (_overridesToAutoClear.length) {
  _writeAutoClearOverrides_(_overridesToAutoClear);
}

  const finalProfiles = _applyMerges(profiles, mergeMap);
  finalProfiles.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return finalProfiles;
}
// Persists auto-clears from AUTO_CLEAR_RULES_ above: deletes the
// stale override row and writes an audit-trail row explaining why.
// Best-effort — logs and swallows errors rather than throwing, since
// this runs as a side effect of a dashboard read and shouldn't be
// able to break the read itself.
function _writeAutoClearOverrides_(entries) {
  try {
    _withLock(() => {
      const sheet = _ensureVaultOverridesSheet_();
      entries.forEach(e => {
        _deleteMatchingVaultRows_(sheet, e.studentId, e.type);
      });
      const auditRows = entries.map(e => [e.studentId, 'auto_clear_note', e.reason, '', 'system', new Date()]);
      if (auditRows.length) {
        sheet.getRange(sheet.getLastRow() + 1, 1, auditRows.length, 6).setValues(auditRows);
      }
    });
  } catch (e) {
    Logger.log('_writeAutoClearOverrides_ error: ' + e.message);
  }
}
// ── Academic sub-object — built from Student Course Data ───────
// Returns null for a student with no courseData at all (pure-trades
// student, or academic enrollment not yet mapped) — see the
// mappingMissing/hasAcademic flags above for how callers detect that.
// thisWeek/lastWeek are resolved from Productivity Data by week
// label; assigned-hours resolution is delegated to
// _resolveAssignedHours_ rather than trusting a frozen snapshot — see
// the inline comment below for why that distinction matters.
function _buildAcademicFromCourseData_(courseData, startDateStr, productivity, weeklySnapshotsForStudent, examProgram, studentOverrides, studentWeeklyHoursHistory) {
  if (!courseData) return null;
  weeklySnapshotsForStudent = weeklySnapshotsForStudent || {};
  studentOverrides = studentOverrides || [];

  const graduation = _computeGraduationDate_(startDateStr, courseData.remainingCredits);
  const daysToGrad = graduation ? _daysUntil_(graduation) : null;

  // Sorted newest-first (unchanged from before)
  const sortedWeeks = (productivity || [])
    .filter(p => p.weekLabel)
    .sort((a, b) => String(b.weekLabel).localeCompare(String(a.weekLabel)));

  // Consecutive most-recent weeks logged at exactly 0 hours, stopping
  // at the first nonzero week — feeds the new Time/Data staleness
  // factor (a student with real historical hours who's gone quiet
  // recently, independent of whether they have an open WIR case).
  let recentZeroHourStreak = 0;
  for (const w of sortedWeeks) {
    const hrs = Number(w.actualWorkedTime) || 0;
    if (hrs === 0) recentZeroHourStreak++;
    else break;
  }
  const currentMondayLabel = _currentWeekMondayLabel_();
  const thisWeek   = sortedWeeks.find(w => String(w.weekLabel) === currentMondayLabel) || null;
  const thisWeekLogged = thisWeek !== null;
  const priorWeeks = sortedWeeks.filter(w => String(w.weekLabel) < currentMondayLabel);
  const lastWeek   = priorWeeks[0] || null;
  const thisWeekCredits = thisWeek && weeklySnapshotsForStudent[thisWeek.weekLabel] !== undefined
    ? weeklySnapshotsForStudent[thisWeek.weekLabel]
    : null;

  const thisWeekHours = thisWeek ? (Number(thisWeek.actualWorkedTime) || 0) : null;
  // Computed LIVE from Weekly Hours History on every rebuild — not
  // read from thisWeek.assignedHours/assignedHoursSource, which is
  // only a snapshot frozen at whatever moment the time log happened
  // to get pasted. That moment could be before that week's schedule
  // was even uploaded yet, in which case the frozen snapshot would
  // stay wrong forever even after the real schedule showed up later.
  // Recomputing here means it's always current as of this rebuild,
  // no matter when the underlying time log was pasted.
  const resolvedThisWeek = _resolveAssignedHours_(studentWeeklyHoursHistory || [], currentMondayLabel);
  const thisWeekSource = resolvedThisWeek.source;
  const thisWeekAssignedHours = resolvedThisWeek.assignedHours;
  // Derived from the REAL schedule data for this week (or a
  // majority vote across recent real weeks for fallback_pattern) —
  // not the static hasTrades/tradeComplete program-enrollment flags,
  // which don't reflect what a specific week's schedule shows (e.g.
  // MyPace 1/2, the pre-assignment period, would incorrectly read
  // as trade time under the old static-flag approach).
  const thisWeekHasTrade = resolvedThisWeek.hasTrade;
  const lastWeekHours = lastWeek ? (Number(lastWeek.actualWorkedTime) || 0) : null;
  const recentWeeks = sortedWeeks.filter(w => Number(w.assignedHours) > 0).slice(0, 4);

  const weeklyAvgHours = recentWeeks.length
    ? +(recentWeeks.reduce((s, w) => s + (Number(w.actualWorkedTime) || 0), 0) / recentWeeks.length).toFixed(1)
    : null;

  const monthWorked   = recentWeeks.reduce((s, w) => s + (Number(w.actualWorkedTime) || 0), 0);
  const monthAssigned = recentWeeks.reduce((s, w) => s + (Number(w.assignedHours) || 0), 0);
  const monthRatio     = recentWeeks.length && monthAssigned > 0 ? monthWorked / monthAssigned : null;

  const pace = monthRatio === null ? null
    : monthRatio < 0.50 ? 'Behind'
    : monthRatio < 0.75 ? 'At Risk'
    : 'On Track';

  const type = (String(examProgram || '').trim() || 'HS');
  const creditGainPoints = Object.entries(weeklySnapshotsForStudent)
    .filter(([, gain]) => gain !== null && gain !== undefined && !isNaN(Number(gain)))
    .map(([date, gain]) => ({ date, value: Number(gain) }));
  let creditTrend = _computeWeightedTrend_(creditGainPoints, 'rate');
  creditTrend = _applyPaceOverride_(creditTrend, studentOverrides, 'pace_multiplier');

  // ── Weekly hours-worked trend (last 4 weeks worked, weighted + acceleration-aware) ──
  const hoursPoints = recentWeeks.map(w => ({
    date:  String(w.weekLabel),
    value: Number(w.actualWorkedTime) || 0,
  }));
  const hoursTrend = _computeWeightedTrend_(hoursPoints, 'rate');

  return {
    type:              type,
    pace,                                    
    progress:          null,
    percent:           courseData.completionPct     ?? null,
    hours:             courseData.totalHours         ?? null,
    remainingHours:    courseData.remainingHours     ?? null,
    start:             startDateStr || null,
    graduation:        graduation,
    daysToGrad:        daysToGrad,
    gCredits:          null,
    credits:           courseData.remainingCredits   ?? null,  
    nextMilestone:     courseData.nextCourse         || null,
    targetDate:        courseData.nextCourseTarget   || null,
    targetDaysLeft:    courseData.nextCourseTarget ? _daysUntilMDY_(courseData.nextCourseTarget) : null,
    thisWeekHours,
    thisWeekSource,
    thisWeekAssignedHours,
    thisWeekHasTrade,
    thisWeekLogged,
    lastWeekHours,
    // Attendance-to-schedule ratio (old "Pace" meaning, kept as its
    // own signal) — hours actually worked ÷ hours scheduled over the
    // last 4 assigned weeks. Distinct from the new Pace factor, which
    // measures completion rate against the real 24-month deadline.
    attendanceRatio:   monthRatio,
    recentZeroHourStreak,
    lastMonth:         null,
    lastMonthAssigned: null,
    thisWeekCredits,                        
    worked:            null,
    weeklyAvgHours,
    creditTrend,
    hoursTrend,
  };
}

// Projects a graduation date from remaining credits: whichever is
// SOONER of (a) the 24-month hard program cap from start date, or
// (b) a pace-based projection (max of a 23-credits/year pace and a
// flat 20-credits/month pace, from TODAY — not from start date, so
// this re-projects fresh on every rebuild rather than drifting from
// an original estimate).
function _computeGraduationDate_(startDateStr, remainingCredits) {
  if (!startDateStr) return null;
  if (remainingCredits === null || remainingCredits === undefined) return null;

  const start = _parseLocalDate(String(startDateStr).slice(0, 10));
  if (!start) return null;

  const hardCap = _addMonths_(start, 24);

  const monthsByYearlyPace  = Math.ceil(remainingCredits / (23 / 12));
  const monthsByMonthlyPace = Math.ceil(remainingCredits / 20);
  const monthsNeeded = Math.max(monthsByYearlyPace, monthsByMonthlyPace);

  const paceProjected = _addMonths_(new Date(), monthsNeeded);

  const result = hardCap < paceProjected ? hardCap : paceProjected;
  return _toDateStr(result);
}

function _addMonths_(date, months) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

// Days from today to a 'yyyy-MM-dd' string, both sides clamped to
// midnight so it's a clean day count, not affected by time-of-day.
function _daysUntil_(dateStr) {
  const d = _parseLocalDate(dateStr);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}
// Same as _daysUntil_ but for M/D/YYYY-style strings (course
// catalogue dates) instead of 'yyyy-MM-dd' — separate function
// because `new Date(mdyStr)` parses that format fine directly, no
// need for _parseLocalDate's yyyy-MM-dd-specific splitting.
function _daysUntilMDY_(mdyStr) {
  const d = new Date(mdyStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

// Builds one trade's display row from a Trade Overview record.
// snapshotsByStudentTrade is keyed studentId||tradeName since one
// student can have snapshot history for multiple trades.
function _buildTradeRowFromVault_(t, snapshotsByStudentTrade, studentOverrides) {
  studentOverrides = studentOverrides || [];
  const sid = String(t.studentId || '').trim();
  const key = sid + '||' + String(t.trade || '').trim();
  const snapshots = snapshotsByStudentTrade[key] || [];

  const paceMetrics = _computeTradePaceMetrics_(
    t.overallPercent, _toDateStr(t.tarBeginDate), t.trade
  );
  const weeklyPctPoints = snapshots
    .filter(s => String(s.cadence || '').trim().toLowerCase() === 'weekly')
    .map(s => ({ date: s.snapshotDate, value: Number(s.overallPercent) }));
  let tradeTrend = _computeWeightedTrend_(weeklyPctPoints, 'cumulative');
  tradeTrend = _applyPaceOverride_(tradeTrend, studentOverrides, 'trade_pace_multiplier');

  return {
    tarName:          t.trade                          ?? null,
    paceGap:          paceMetrics.paceGap,
    progress:         null,
    staffPct:         t.staffPercent   !== undefined ? _toPercent(t.staffPercent)   : null,
    studentPct:       t.studentPercent !== undefined ? _toPercent(t.studentPercent) : null,
    overallPct:       t.overallPercent !== undefined ? _toPercent(t.overallPercent) : null,
    etarStart:        _toDateStr(t.tarBeginDate) ?? null,
    earliestEnd:      paceMetrics.earliestEnd,
    daysToEarliest:   paceMetrics.daysToEarliest,
    etarProjectedEnd: paceMetrics.earliestEnd,       
    daysToETAR:       paceMetrics.daysToEarliest,
    weeklyPctChange:  _computeWeeklyPctChange_(snapshots), // kept for anything still reading the old single-delta field
    monthlyProgress:  _buildMonthlyProgressFromSnapshots_(snapshots),
    tradeTrend,
  };
}

// Filters a trade's snapshot history down to monthly-cadence rows
// for the stall/pace-check logic in _calcRisk (Profiles.gs).
// addedPostFirst flags a snapshot marked 'New' — a student added
// mid-month shouldn't have that partial month counted as a stall.
function _buildMonthlyProgressFromSnapshots_(snapshots) {
  return snapshots
    .filter(s => String(s.cadence || '').trim().toLowerCase() === 'monthly')
    .map(s => ({
      month:          s.snapshotDate || '',
      addedPostFirst: String(s.status || '').trim().toLowerCase() === 'new',
      overallGain:    s.gain            !== undefined && s.gain            !== '' ? Number(s.gain)            : null,
      endOverallPct:  s.overallPercent  !== undefined && s.overallPercent  !== '' ? Number(s.overallPercent)  : null,
    }));
}

// Rolls up a student's Productivity Data rows into total hours +
// per-week breakdown. Returns null (not a zero object) if there's no
// usable data at all — hasTime downstream depends on this
// null-vs-object distinction, not on totalHours being 0.
function _buildTimeFromProductivity_(productivity) {
  if (!productivity || !productivity.length) return null;

  let totalHours = 0;
  const sheets = {};
  productivity.forEach(p => {
    const hrs = Number(p.actualWorkedTime);
    if (isNaN(hrs)) return;
    totalHours += hrs;
    const label = String(p.weekLabel || '').trim();
    if (label) sheets[label] = (sheets[label] || 0) + hrs;
  });

  if (totalHours <= 0) return null;
  return {
    totalHours: +totalHours.toFixed(2),
    sheets,
  };
}

// Reshapes a WIR report + case management pair into the flat
// intervention sub-object a profile carries. caseData is optional —
// a student can have a WIR report with no case opened yet.
function _buildInterventionFromWirEntry_(entry) {
  const report  = entry.report  || {};
  const caseData = entry.caseData || null;
  return {
    weekLabel:         report.weekLabel         || '',
    status:            report.status            || null,
    priority:          report.priority          || null,
    adminPriority:     report.adminPriority     || null,
    urgency:           report.urgency           || null,
    percent:           report.percent           ?? null,
    thisWeekHours:     report.thisWeekHours     || null,
    lastActiveHours:   report.lastActiveHours   || null,
    lastActiveLabel:   report.lastActiveLabel   || null,
    credits:           report.creditsThisWeek   || null,
    courseDaysLeft:    report.courseDaysLeft    ?? null,
    issueTags:         report.issueTags         || null,
    detectedPatterns:  report.detectedPatterns  || null,
    instructorAction:  report.instructorAction  || null,
    coordinatorAction: report.coordinatorAction || null,
    reason:            report.reason            || null,
    streak:            report.streak            || null,
    trajectory:        report.trajectory        || null,
    gradGap:           report.gradGap           || null,
    comments:          caseData ? caseData.comments      || null : null,
    caseOwner:         caseData ? caseData.caseOwner     || null : null,
    caseStatus:        caseData ? caseData.caseStatus    || null : null,
    focus:             caseData ? caseData.focus         || null : null,
    followUp:          caseData ? (_toDateStr(caseData.followUpDate) || null) : null,
    caseNotes:         caseData ? caseData.caseNotes     || null : null,
    lastUpdated:       caseData ? (_toDateStr(caseData.lastUpdated) || null) : null,
  };
}
