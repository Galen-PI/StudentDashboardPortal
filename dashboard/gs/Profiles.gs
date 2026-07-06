// ============================================================
// Profiles.gs — Student profile assembly
// Takes parsed data from all sources and merges it into unified student profile objects. No spreadsheet I/O happens here.
// ============================================================

// ── Main entry point ──────────────────────────────────────────
function buildStudentProfiles(
  nameMap, hsData, hisetData, tradesData,
  timeData, wirData, tradeMonthlyData,
  overrides, scheduleData, tabeData, studentCourseData
) {
  scheduleData      = scheduleData      || {};
  tabeData          = tabeData          || {};
  studentCourseData = studentCourseData || {};
  nameMap           = nameMap           || [];
  hsData            = hsData            || [];
  hisetData         = hisetData         || [];
  tradesData        = tradesData        || [];
  timeData          = timeData          || [];
  tradeMonthlyData  = tradeMonthlyData  || [];
  overrides         = overrides         || [];

  // ── Index overrides by student ID ────────────────────────
  const overridesByStudent = {};
  overrides.forEach(o => {
    (overridesByStudent[o.studentId] = overridesByStudent[o.studentId] || []).push(o);
  });

  // ── Build merge map (sourceId -> targetId) ────────────────
  const mergeMap = {};
  overrides.forEach(o => {
    if (o.type === 'merged_into' && o.value) mergeMap[o.studentId] = String(o.value).trim();
  });

  // ── Build lookup indexes (strict + loose) ─────────────────
  const hsIdx          = _indexBy(hsData,    r => _norm(r.student));
  const hisetIdx       = _indexBy(hisetData, r => _norm(r.student));
  const tradesIdx      = _indexByMulti(tradesData, r => _norm(r.student));
  const timeIdx        = _indexBy(timeData,  r => _norm(r.student));
  const hsLooseIdx     = _indexBy(hsData,    r => _normLoose(r.student));
  const hisetLooseIdx  = _indexBy(hisetData, r => _normLoose(r.student));
  const tradesLooseIdx = _indexByMulti(tradesData, r => _normLoose(r.student));
  const timeLooseIdx   = _indexBy(timeData,  r => _normLoose(r.student));

  // ── WIR index ─────────────────────────────────────────────
  const wirIdx       = {};
  const wirPrefixIdx = {};
  if (wirData && wirData.rows) {
    wirData.rows.forEach(r => {
      const key    = _norm(r.student);
      const prefix = key.slice(0, 20);
      if (!wirIdx[key])          wirIdx[key]          = r;
      if (!wirPrefixIdx[prefix]) wirPrefixIdx[prefix] = r;
    });
  }
  const wirWeekLabel = wirData ? wirData.weekLabel : null;
  function _wirLookup(normName) {
    return wirIdx[normName] || wirPrefixIdx[normName.slice(0, 20)] || null;
  }

  // ── Trade monthly index ───────────────────────────────────
  const tradeMonthlyIdx  = {};
  const tradeCompleteIdx = {};
  tradeMonthlyData.forEach(r => {
    const key = _norm(r.student) + '||' + _norm(r.trade);
    tradeMonthlyIdx[key] = r;
    const months = r.months || [];
    if (months.some(m => m.endOverallPct !== null && m.endOverallPct >= 100)) {
      const studentKey = _norm(r.student);
      (tradeCompleteIdx[studentKey] = tradeCompleteIdx[studentKey] || []).push(r.trade);
    }
  });

  function _completedTrades(normNames) {
    const out = new Set();
    normNames.forEach(n => { (tradeCompleteIdx[n] || []).forEach(t => out.add(t)); });
    return [...out];
  }

  // ── Build profiles from Name Mapping ──────────────────────
  const profiles  = [];
  const seenIds   = new Set();
  const seenNorms = new Set();
  const seenLoose = new Set();

  nameMap.forEach(map => {
    const rawId = String(map.id || '').trim();
    const id    = rawId || _tempId(map.masterSheet || map.academicName || map.tradesName);

    // Skip fully completed students (both trade and academic done)
    if (map.tradeCompleteFlag && map.academicCompleteFlag) {
      if (map.tradesName)   { seenNorms.add(_norm(map.tradesName));   seenLoose.add(_normLoose(map.tradesName)); }
      if (map.academicName) { seenNorms.add(_norm(map.academicName)); seenLoose.add(_normLoose(map.academicName)); }
      if (map.masterSheet)  { seenNorms.add(_norm(map.masterSheet));  seenLoose.add(_normLoose(map.masterSheet)); }
      if (rawId) seenIds.add(rawId);
      return;
    }

    if (seenIds.has(id)) {
      if (map.tradesName)   { seenNorms.add(_norm(map.tradesName));   seenLoose.add(_normLoose(map.tradesName)); }
      if (map.academicName) { seenNorms.add(_norm(map.academicName)); seenLoose.add(_normLoose(map.academicName)); }
      if (map.masterSheet)  { seenNorms.add(_norm(map.masterSheet));  seenLoose.add(_normLoose(map.masterSheet)); }
      return;
    }

    seenIds.add(id);
    const normTrades    = _norm(map.tradesName);
    const normAcademic  = _norm(map.academicName);
    const normMaster    = _norm(map.masterSheet);
    const looseTrades   = _normLoose(map.tradesName);
    const looseAcademic = _normLoose(map.academicName);
    const looseMaster   = _normLoose(map.masterSheet);

    if (normTrades)    seenNorms.add(normTrades);
    if (normAcademic)  seenNorms.add(normAcademic);
    if (normMaster)    seenNorms.add(normMaster);
    if (looseTrades)   seenLoose.add(looseTrades);
    if (looseAcademic) seenLoose.add(looseAcademic);
    if (looseMaster)   seenLoose.add(looseMaster);

    const hsRow    = hsIdx[normAcademic]    || hsIdx[normTrades]    || hsIdx[normMaster]    || hsLooseIdx[looseAcademic]    || hsLooseIdx[looseTrades]    || hsLooseIdx[looseMaster]    || null;
    const hisetRow = hisetIdx[normAcademic] || hisetIdx[normTrades] || hisetIdx[normMaster] || hisetLooseIdx[looseAcademic] || hisetLooseIdx[looseTrades] || hisetLooseIdx[looseMaster] || null;
    const tradeRows= tradesIdx[normTrades]  || tradesIdx[normAcademic] || tradesIdx[normMaster] || tradesLooseIdx[looseTrades] || tradesLooseIdx[looseAcademic] || tradesLooseIdx[looseMaster] || [];
    const timeRow  = timeIdx[normTrades]    || timeIdx[normAcademic]   || timeIdx[normMaster]   || timeLooseIdx[looseTrades]   || timeLooseIdx[looseAcademic]   || timeLooseIdx[looseMaster]   || null;
    const wirRow   = _wirLookup(normAcademic) || _wirLookup(normTrades) || _wirLookup(normMaster) || null;

    if (tradeRows.length) { seenNorms.add(_norm(tradeRows[0].student)); seenLoose.add(_normLoose(tradeRows[0].student)); }
    if (hsRow)    { seenNorms.add(_norm(hsRow.student));    seenLoose.add(_normLoose(hsRow.student)); }
    if (hisetRow) { seenNorms.add(_norm(hisetRow.student)); seenLoose.add(_normLoose(hisetRow.student)); }

    const completedTrades = _completedTrades([normTrades, normAcademic, normMaster].filter(Boolean));
    const displayName     = map.masterSheet || map.academicName || map.tradesName || id;

    profiles.push(_buildProfile({
      id, displayName, map,
      hsRow, hisetRow, tradeRows, timeRow, wirRow, wirWeekLabel,
      mappingMissing: false,
      tradeMonthlyIdx, completedTrades,
      scheduledAcademicHours: scheduleData[map.id] || null,
      tabe:       tabeData[rawId]                        || null,
      courseData: studentCourseData[map.academicName]    || null,
    }));
  });

  // ── Unmapped HS / HiSET students ──────────────────────────
  [...hsData, ...hisetData].forEach(row => {
    const norm  = _norm(row.student);
    const loose = _normLoose(row.student);
    if (seenNorms.has(norm) || seenLoose.has(loose)) return;
    const id = _tempId(row.student);
    if (seenIds.has(id)) return;
    seenIds.add(id); seenNorms.add(norm); seenLoose.add(loose);
    const tradeRows = tradesIdx[norm]  || tradesLooseIdx[loose] || [];
    const timeRow   = timeIdx[norm]    || timeLooseIdx[loose]   || null;
    const wirRow    = _wirLookup(norm) || null;
    if (tradeRows.length) { seenNorms.add(_norm(tradeRows[0].student)); seenLoose.add(_normLoose(tradeRows[0].student)); }
    profiles.push(_buildProfile({
      id, displayName: row.student,
      map: { id: '', masterSheet: '', tradesName: '', academicName: '', tradeCompleteFlag: false, academicCompleteFlag: false },
      hsRow:    row.type === 'hs'    ? row : null,
      hisetRow: row.type === 'hiset' ? row : null,
      tradeRows, timeRow, wirRow, wirWeekLabel,
      mappingMissing: true, tradeMonthlyIdx,
      completedTrades: _completedTrades([norm]),
      scheduledAcademicHours: null, tabe: null, courseData: null,
    }));
  });

  // ── Unmapped trades-only students ─────────────────────────
  [...new Set(tradesData.map(r => _norm(r.student)))].forEach(norm => {
    const tradeRows   = tradesIdx[norm] || [];
    const displayName = (tradeRows[0] || {}).student || norm;
    const loose       = _normLoose(displayName);
    if (seenNorms.has(norm) || seenLoose.has(loose)) return;
    const id = _tempId(displayName);
    if (seenIds.has(id)) return;
    seenIds.add(id); seenNorms.add(norm); seenLoose.add(loose);
    profiles.push(_buildProfile({
      id, displayName,
      map: { id: '', masterSheet: '', tradesName: displayName, academicName: '', tradeCompleteFlag: false, academicCompleteFlag: false },
      hsRow: null, hisetRow: null, tradeRows,
      timeRow:  timeIdx[norm]    || null,
      wirRow:   _wirLookup(norm) || null,
      wirWeekLabel, mappingMissing: true, tradeMonthlyIdx,
      completedTrades: _completedTrades([norm]),
      scheduledAcademicHours: null, tabe: null, courseData: null,
    }));
  });

  // ── Trade-complete-only students (no active trade record) ─
  Object.keys(tradeCompleteIdx).forEach(norm => {
    if (seenNorms.has(norm)) return;
    const sampleRow   = tradeMonthlyData.find(r => _norm(r.student) === norm);
    const displayName = sampleRow ? sampleRow.student : norm;
    const loose       = _normLoose(displayName);
    if (seenLoose.has(loose)) return;
    const id = _tempId(displayName);
    if (seenIds.has(id)) return;
    seenIds.add(id); seenNorms.add(norm); seenLoose.add(loose);
    profiles.push(_buildProfile({
      id, displayName,
      map: { id: '', masterSheet: '', tradesName: displayName, academicName: '', tradeCompleteFlag: false, academicCompleteFlag: false },
      hsRow:    hsIdx[norm]      || hsLooseIdx[loose]    || null,
      hisetRow: hisetIdx[norm]   || hisetLooseIdx[loose] || null,
      tradeRows: [],
      timeRow:  timeIdx[norm]    || timeLooseIdx[loose]  || null,
      wirRow:   _wirLookup(norm) || null,
      wirWeekLabel, mappingMissing: true, tradeMonthlyIdx,
      completedTrades: tradeCompleteIdx[norm],
      scheduledAcademicHours: null, tabe: null, courseData: null,
    }));
  });

  // ── Apply overrides + risk trend to all profiles ──────────
  profiles.forEach(p => {
    _applyOverrides(p, overridesByStudent);
    _computeRiskTrend(p);
  });

  const finalProfiles = _applyMerges(profiles, mergeMap);
  finalProfiles.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return finalProfiles;
}

// ── Build a single profile object ─────────────────────────────
function _buildProfile({
  id, displayName, map, hsRow, hisetRow, tradeRows, timeRow,
  wirRow, wirWeekLabel, mappingMissing, tradeMonthlyIdx,
  completedTrades, scheduledAcademicHours, tabe, courseData
}) {
  tradeRows       = Array.isArray(tradeRows)       ? tradeRows       : [];
  completedTrades = Array.isArray(completedTrades) ? completedTrades : [];

  const academicType = hsRow ? 'HS' : hisetRow ? 'HISET' : null;
  const acRow        = hsRow || hisetRow || null;
  const hsComplete   = map.academicCompleteFlag === true;

  const liveCompleteTrades = tradeRows
    .filter(t => t.overallPct !== null && t.overallPct !== undefined && t.overallPct >= 100)
    .map(t => t.tarName)
    .filter(Boolean);
  const allCompletedTrades = [...new Set([...liveCompleteTrades, ...completedTrades])];
  const tradeComplete      = map.tradeCompleteFlag || allCompletedTrades.length > 0;

  const academic    = _buildAcademic(acRow, academicType);
  const normDisplay = _norm(displayName);
  const normTrades  = _norm(map.tradesName || displayName);

  const trades = tradeRows.length
    ? tradeRows.map(t => _buildTradeRow(t, normTrades || normDisplay, normDisplay, tradeMonthlyIdx))
    : null;

  const time = timeRow ? {
    totalHours: timeRow.totalHours ?? null,
    sheets:     timeRow.sheets     || {},
  } : null;

  const intervention = wirRow ? _buildIntervention(wirRow, wirWeekLabel) : null;
  const risk = _calcRisk(academic, trades, time, hsComplete, tradeComplete, allCompletedTrades, intervention, scheduledAcademicHours);

  return {
    id,
    displayName,
    mappingMissing:         mappingMissing && !map.id,
    hsComplete,
    tradeComplete,
    completedTrades:        allCompletedTrades,
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
    academicId:             map.id || null,
    tradesId:               map.id || null,
    academic,
    trades,
    time,
    intervention,
    risk,
    hasAcademic:            !!academic,
    hasTrades:              !!(trades && trades.length),
    hasTime:                !!time,
    hasIntervention:        !!intervention,
    scheduledAcademicHours: scheduledAcademicHours || null,
    tabe:                   tabe || null,
    hasTABE:                !!(tabe && (tabe.math || tabe.reading)),
    courseData:             courseData || null,
  };
}

// ── Build academic sub-object ─────────────────────────────────
function _buildAcademic(acRow, academicType) {
  if (!acRow) return null;
  return {
    type:              academicType,
    pace:              acRow.pace              ?? null,
    progress:          acRow.progress          ?? null,
    percent:           acRow.percent           ?? null,
    hours:             acRow.hours             ?? null,
    start:             acRow.start             ?? null,
    graduation:        acRow.graduation        ?? null,
    daysToGrad:        acRow.daysLeft          ?? null,
    gCredits:          acRow.gCredits          ?? null,
    credits:           acRow.credits           ?? null,
    nextMilestone:     acRow.next              || null,
    targetDate:        acRow.targetDate        ?? null,
    targetDaysLeft:    acRow.targetDaysLeft    ?? null,
    thisWeekHours:     acRow.thisWeekHours     ?? null,
    lastWeekHours:     acRow.lastWeekHours     ?? null,
    lastMonth:         acRow.lastMonth         ?? null,
    lastMonthAssigned: acRow.lastMonthAssigned ?? null,
    thisWeekCredits:   acRow.thisWeekCredits   ?? null,
    worked:            acRow.worked            ?? null,
  };
}

// ── Build trade row sub-object ────────────────────────────────
function _buildTradeRow(t, normStudent, normDisplay, tradeMonthlyIdx) {
  const tarNorm = _norm(t.tarName || '');
  const monthly = tradeMonthlyIdx[normStudent + '||' + tarNorm]
               || tradeMonthlyIdx[normDisplay  + '||' + tarNorm]
               || null;
  return {
    tarName:          t.tarName          ?? null,
    paceGap:          t.paceGap          ?? null,
    status:           t.status           ?? null,
    enrollment:       t.enrollment       ?? null,
    progress:         t.progress         ?? null,
    staffPct:         t.staffPct         ?? null,
    studentPct:       t.studentPct       ?? null,
    overallPct:       t.overallPct       ?? null,
    etarStart:        t.etarStart        ?? null,
    earliestEnd:      t.earliestEnd      ?? null,
    daysToEarliest:   t.daysToEarliest   ?? null,
    etarProjectedEnd: t.etarProjectedEnd ?? null,
    daysToETAR:       t.daysLeft         ?? null,
    weeklyPctChange:  t.weeklyPctChange  ?? null,
    monthlyProgress:  monthly ? monthly.months : [],
  };
}

// ── Build intervention sub-object ─────────────────────────────
function _buildIntervention(wirRow, wirWeekLabel) {
  return {
    weekLabel:         wirWeekLabel              || '',
    status:            wirRow.status             || null,
    priority:          wirRow.priority           || null,
    adminPriority:     wirRow.adminPriority      || null,
    urgency:           wirRow.urgency            || null,
    percent:           wirRow.percent            || null,
    thisWeekHours:     wirRow.thisWeekHours      || null,
    lastActiveHours:   wirRow.lastActiveHours    || null,
    lastActiveLabel:   wirRow.lastActiveLabel    || null,
    credits:           wirRow.credits            || null,
    courseDaysLeft:    wirRow.courseDaysLeft     ?? null,
    issueTags:         wirRow.issueTags          || null,
    detectedPatterns:  wirRow.detectedPatterns   || null,
    instructorAction:  wirRow.instructorAction   || null,
    coordinatorAction: wirRow.coordinatorAction  || null,
    reason:            wirRow.reason             || null,
    streak:            wirRow.streak             || null,
    trajectory:        wirRow.trajectory         || null,
    gradGap:           wirRow.gradGap            || null,
    comments:          wirRow.comments           || null,
    caseOwner:         wirRow.caseOwner          || null,
    caseStatus:        wirRow.caseStatus         || null,
    focus:             wirRow.focus              || null,
    followUp:          wirRow.followUp           || null,
    caseNotes:         wirRow.caseNotes          || null,
    lastUpdated:       wirRow.lastUpdated        || null,
  };
}

// ── Risk calculation ──────────────────────────────────────────
function _calcRisk(academic, trades, time, hsComplete, tradeComplete, completedTrades, intervention, scheduledAcademicHours) {
  const flags = [];
  let score   = 0;

  if (academic) {
    const pace = String(academic.pace || '').toLowerCase();
    if (pace.includes('at risk')) {
      score += 40; flags.push('Academic at-risk pace');
    } else if (pace.includes('behind') || pace.includes('slow')) {
      score += 30; flags.push('Behind academic pace');
    }
    if (academic.percent !== null && academic.percent < 50) {
      score += 20; flags.push('Low academic completion (<50%)');
    }
    if (academic.daysToGrad !== null && academic.daysToGrad < 30
        && academic.percent !== null && academic.percent < 90) {
      score += 25; flags.push('Graduation deadline approaching');
    }
    const thisWk = academic.thisWeekHours;
    if (thisWk !== 'NWH' && (thisWk === null || thisWk === 0)) {
      score += 15; flags.push('No academic hours logged this week');
    }
  }

  if (trades && trades.length) {
    trades.forEach(t => {
      const tradeName  = t.tarName || 'Trade';
      const isBCT      = tradeName.toUpperCase() === 'BCT';
      const isComplete = (t.overallPct !== null && t.overallPct >= 100)
                       || completedTrades.includes(tradeName);

      if (isComplete) { flags.push(tradeName + ': ✅ Trade Complete'); return; }

      if ((t.paceGap || 0) < -10) {
        score += 20; flags.push(tradeName + ': large pace gap (' + t.paceGap + '%)');
      }
      if (String(t.status || '').toLowerCase().match(/inactive|withdrawn/)) {
        score += 15; flags.push(tradeName + ': inactive/withdrawn');
      }
      if (t.overallPct !== null && t.overallPct < 25
          && t.daysToETAR !== null && t.daysToETAR < 60) {
        score += 25; flags.push(tradeName + ': very low progress near ETAR deadline');
      }

      const threshold = isBCT ? 1.5 : 3.0;
      const monthly   = t.monthlyProgress || [];
      const scorable  = monthly.filter(m =>
        !m.addedPostFirst &&
        m.overallGain !== null &&
        (m.endOverallPct === null || m.endOverallPct < 100)
      );
      if (!scorable.length) return;

      const recent        = scorable.slice(-2);
      const stalledMonths = recent.filter(m => m.overallGain < threshold);
      const lastMonth     = recent[recent.length - 1];
      const lastGain      = lastMonth ? lastMonth.overallGain : null;
      const lastEndPct    = lastMonth ? lastMonth.endOverallPct : null;
      const consecutiveStall = stalledMonths.length === 2 && recent.length === 2;
      const singleStall      = stalledMonths.length >= 1 && !consecutiveStall;

      if (consecutiveStall) {
        const avgGain = (recent.reduce((a, m) => a + m.overallGain, 0) / recent.length).toFixed(1);
        score += isBCT ? 15 : 25;
        flags.push(tradeName + ': stalled for 2 consecutive months (avg gain ' + avgGain + '%, expected ≥' + threshold + '%)');
        if (lastEndPct !== null && lastEndPct < 25) {
          score += 10; flags.push(tradeName + ': stalled with very low overall completion (' + lastEndPct + '%)');
        }
      } else if (singleStall) {
        score += isBCT ? 10 : 15;
        flags.push(tradeName + ': low monthly gain (' + (lastGain !== null ? lastGain.toFixed(1) : '?') + '% — expected ≥' + threshold + '%)');
        if (lastEndPct !== null && lastEndPct < 25) {
          score += 10; flags.push(tradeName + ': low gain with low overall completion (' + lastEndPct + '%)');
        }
      }
    });
  }

  if ((!trades || !trades.length) && completedTrades.length) {
    completedTrades.forEach(name => { flags.push(name + ': ✅ Trade Complete'); });
  }

  // Scheduled hours comparison (weekdays only)
  if (academic && scheduledAcademicHours !== null && scheduledAcademicHours > 0) {
    const thisWk = academic.thisWeekHours;
    const actual = (thisWk === 'NWH' || thisWk === null) ? 0 : +thisWk;
    if (actual === 0) {
      score += 25; flags.push('No hours logged — scheduled for ' + scheduledAcademicHours + ' academic periods this week');
    } else if (actual < scheduledAcademicHours * 0.5) {
      score += 15; flags.push('Behind scheduled hours — logged ' + actual.toFixed(1) + 'h of ' + scheduledAcademicHours + ' scheduled academic periods');
    }
  }

  const consideredComplete = hsComplete || tradeComplete;
  if (time) {
    if ((time.totalHours || 0) < 1) {
      score += 20; flags.push('Minimal total logged time');
    }
  } else if (!consideredComplete) {
    score += 10; flags.push('No time data found');
  }

  if (intervention) {
    const adminP  = String(intervention.adminPriority || intervention.priority || '').toUpperCase();
    const urgency = String(intervention.urgency || '').toUpperCase();
    const cStatus = String(intervention.caseStatus || '').toLowerCase();
    if      (adminP === 'CRITICAL') { score += 40; flags.push('Intervention: CRITICAL admin priority this week'); }
    else if (adminP === 'HIGH')     { score += 25; flags.push('Intervention: HIGH admin priority this week'); }
    else if (adminP === 'MEDIUM')   { score += 10; flags.push('Intervention: MEDIUM admin priority this week'); }
    if      (urgency === 'IMMEDIATE') { score += 20; flags.push('Intervention: IMMEDIATE urgency'); }
    else if (urgency === 'URGENT')    { score += 10; flags.push('Intervention: URGENT'); }
    if (cStatus === 'open') { score += 15; flags.push('Active open intervention case'); }
  }

  const hasAnyData = !!academic || (trades && trades.length) || !!time || hsComplete || tradeComplete;
  if (!hasAnyData) { score += 20; flags.push('No academic or trades data'); }

  score = Math.min(score, 100);
  const level = !hasAnyData ? 'UNKNOWN'
              : score >= 60  ? 'HIGH'
              : score >= 30  ? 'MEDIUM'
              : 'LOW';

  return { level, score, flags, overridden: false };
}

// ── Apply manual overrides ────────────────────────────────────
function _applyOverrides(profile, overridesByStudent) {
  const ov = overridesByStudent[profile.id];
  if (!ov) return profile;

  ov.forEach(o => {
    switch (o.type) {
      case 'academic_status': profile.academicStatusOverride = o.value; break;
      case 'trade_status':    profile.tradeStatusOverride    = o.value; break;
      case 'trade_name':      profile.tradeNameOverride      = o.value; break;
      case 'status_tag':      profile.statusTag              = o.value; break;
      case 'staff_note':      profile.staffNote              = o.value; break;
      case 'risk_level':
        profile.risk.level    = o.value;
        profile.risk.overridden = true;
        break;
      case 'flag_add':
        if (o.value) profile.risk.flags.push(o.value);
        break;
      case 'flag_remove':
        if (o.value) profile.risk.flags = profile.risk.flags.filter(f => !f.includes(o.value));
        break;
      case 'last_modified':
        if (o.value) profile.lastModified = o.value;
        break;
      case 'note':
        if (!profile.notes) profile.notes = [];
        profile.notes.push({
          text:  String(o.value || '').trim(),
          setBy: String(o.setBy || '').trim(),
          date:  o.date ? (o.date instanceof Date ? o.date.toISOString() : String(o.date)) : null,
        });
        break;
      case 'progress_snapshot':
        try {
          const snap = JSON.parse(o.value);
          if (!profile.progressSnapshots) profile.progressSnapshots = [];
          profile.progressSnapshots.push(snap);
          if (!profile.progressSnapshot || snap.date > profile.progressSnapshot.date) {
            profile.progressSnapshot = snap;
          }
        } catch(e) { /* ignore malformed */ }
        break;
    }
  });

  // Stale detection — only for active students with snapshot history
  if (profile.progressSnapshot && !profile.hsComplete && !profile.tradeComplete) {
    const snap      = profile.progressSnapshot;
    const snapDate  = new Date(snap.date);
    const daysSince = (Date.now() - snapDate.getTime()) / 86400000;

    if (daysSince >= STALE_THRESHOLD_DAYS) {
      const currentAcPct = profile.academic ? profile.academic.percent : null;
      const currentTrPct = profile.trades && profile.trades.length ? profile.trades[0].overallPct : null;
      const acStale = currentAcPct !== null && snap.acPct !== null && currentAcPct === snap.acPct && profile.hasAcademic;
      const trStale = currentTrPct !== null && snap.trPct !== null && currentTrPct === snap.trPct && profile.hasTrades;

      if (acStale || trStale) {
        profile.isStale = true;
        const staleWeeks = Math.floor(daysSince / 7);
        if (acStale && trStale) {
          profile.risk.flags.push('No academic or trades progress in ' + staleWeeks + '+ weeks');
        } else if (acStale) {
          profile.risk.flags.push('Academic % unchanged for ' + staleWeeks + '+ weeks');
        } else {
          profile.risk.flags.push('Trades % unchanged for ' + staleWeeks + '+ weeks');
        }
        if (!profile.risk.overridden) {
          profile.risk.score = Math.min(profile.risk.score + 15, 100);
          if      (profile.risk.score >= 60 && profile.risk.level !== 'HIGH')   profile.risk.level = 'HIGH';
          else if (profile.risk.score >= 30 && profile.risk.level === 'LOW')    profile.risk.level = 'MEDIUM';
        }
      }
    }
  }
  return profile;
}

// ── Compute risk trend arrow ──────────────────────────────────
function _computeRiskTrend(profile) {
  const snaps = (profile.progressSnapshots || [])
    .filter(s => s.score !== null && s.score !== undefined);
  if (!snaps.length) return;
  snaps.sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);
  const delta = profile.risk.score - snaps[0].score;
  profile.riskTrend = delta > 5 ? 'up' : delta < -5 ? 'down' : 'stable';
}

// ── Apply merges ──────────────────────────────────────────────
function _applyMerges(profiles, mergeMap) {
  if (!mergeMap || !Object.keys(mergeMap).length) return profiles;
  const byId = {};
  profiles.forEach(p => { byId[p.id] = p; });

  Object.keys(mergeMap).forEach(sourceId => {
    const source = byId[sourceId];
    const target = byId[mergeMap[sourceId]];
    if (!source || !target) return;

    if (!target.academic  && source.academic)  { target.academic   = source.academic;  target.hasAcademic  = true; }
    if ((!target.trades || !target.trades.length) && source.trades && source.trades.length) {
      target.trades   = source.trades;  target.hasTrades   = true;
    }
    if (!target.time       && source.time)       { target.time       = source.time;      target.hasTime       = true; }
    if (!target.intervention && source.intervention) {
      target.intervention   = source.intervention; target.hasIntervention = true;
    }
    if (source.completedTrades && source.completedTrades.length) {
      target.completedTrades = [...new Set([...(target.completedTrades || []), ...source.completedTrades])];
      target.tradeComplete   = target.tradeComplete || source.completedTrades.length > 0;
    }
    if (!target.hsComplete && source.hsComplete) target.hsComplete = true;
    if (source.lastModified && (!target.lastModified || source.lastModified > target.lastModified)) {
      target.lastModified = source.lastModified;
    }

    const wasOverridden = target.risk && target.risk.overridden;
    target.risk = _calcRisk(
      target.academic, target.trades, target.time,
      target.hsComplete, target.tradeComplete, target.completedTrades || [],
      target.intervention
    );
    if (wasOverridden) target.risk.overridden = true;
  });

  return profiles.filter(p => !mergeMap[p.id]);
}

// ── Summary metrics ───────────────────────────────────────────
function computeSummaryMetrics(profiles) {
  const total      = profiles.length;
  const riskCounts = { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
  profiles.forEach(p => { riskCounts[p.risk?.level || 'UNKNOWN']++; });

  const withIntervention = profiles.filter(p => p.hasIntervention).length;
  const unmapped         = profiles.filter(p => p.mappingMissing).length;
  const stale            = profiles.filter(p => p.isStale).length;
  const hasNotes         = profiles.filter(p => p.notes && p.notes.length).length;

  const avgAcademicPct = _avg(
    profiles.filter(p => p.academic && p.academic.percent !== null).map(p => p.academic.percent)
  );
  const avgTradesPct = _avg(
    profiles.filter(p => p.trades && p.trades.length && p.trades[0].overallPct !== null).map(p => p.trades[0].overallPct)
  );

  return {
    total, riskCounts,
    withAcademic:    profiles.filter(p => p.hasAcademic).length,
    withTrades:      profiles.filter(p => p.hasTrades).length,
    withBoth:        profiles.filter(p => p.hasAcademic && p.hasTrades).length,
    withTime:        profiles.filter(p => p.hasTime).length,
    withIntervention,
    unmapped,
    tradeComplete:   profiles.filter(p => p.tradeComplete).length,
    overridden:      profiles.filter(p => p.risk && p.risk.overridden).length,
    stale,
    hasNotes,
    avgAcademicPct:  avgAcademicPct !== null ? +avgAcademicPct.toFixed(1) : null,
    avgTradesPct:    avgTradesPct   !== null ? +avgTradesPct.toFixed(1)   : null,
  };
}
