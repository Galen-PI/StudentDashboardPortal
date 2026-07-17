// ============================================================
// Profiles.gs — Shared profile helpers
// ------------------------------------------------------------

// ── Risk calculation ──────────────────────────────────────────
function _calcRisk(academic, trades, time, hsComplete, tradeComplete, completedTrades, intervention, scheduledAcademicHours) {
  const flags = [];
  let score   = 0;

  // Completion guard -- a student marked academically complete
  // should never be scored on academic pace/hours/deadline data,
  // even if that data is stale (e.g. course-data recompute hasn't
  // caught up yet after a course was just finished). Without this,
  // a "Complete" tag and a "Needs Attention" risk score could
  // display simultaneously and contradict each other.
  if (academic && !hsComplete) {
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

      if (isComplete) { flags.push(tradeName + ': Trade Complete'); return; }

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
    completedTrades.forEach(name => { flags.push(name + ': Trade Complete'); });
  }

  // Scheduled hours comparison (weekdays only)
  if (academic && !hsComplete && scheduledAcademicHours !== null && scheduledAcademicHours > 0) {
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
      case 'trade_projected_end':     profile.tradeProjectedEndOverride     = o.value; break;
      case 'trade_enrollment_status': profile.tradeEnrollmentStatusOverride = o.value; break;
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
function _shouldAutoClearNotStarted_(profile, type) {
  if (type === 'academic_status') {
    return profile.academicStatusOverride === 'NOT_STARTED' &&
           !!(profile.academic && profile.academic.start && profile.academic.targetDate);
  }
  if (type === 'trade_status') {
    return profile.tradeStatusOverride === 'NOT_STARTED' &&
           profile.hasTrades === true;
  }
  return false;
}

// Writes a fresh, blank override row for each entry — same effect as
// staff clicking "Clear" on that override, just done automatically.
// Overrides are last-write-wins per student+type, so appending a
// blank one here overrides the old NOT_STARTED value going forward.

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
