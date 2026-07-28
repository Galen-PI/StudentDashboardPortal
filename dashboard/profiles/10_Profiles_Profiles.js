// ============================================================
// Profiles.gs — Shared profile helpers
// ------------------------------------------------------------

// Rescaled from a 100-point max to 200 — same relative weighting
// throughout, just twice the resolution, so students who are
// meaningfully different in severity are less likely to land on the
// exact same score. RISK_SCORE_SCALE is applied once, at the source
// (inside addFlag() below), so every individual point value AND the
// category caps below stay in proportion automatically — nothing to
// keep in sync by hand across the many addFlag(...) call sites in
// this function.
const RISK_SCORE_SCALE = 2;
const RISK_CATEGORY_CAP = 45 * RISK_SCORE_SCALE;

// Separate, smaller cap for Time & Data Factors — this category's checks

const RISK_DATA_CATEGORY_CAP = 30 * RISK_SCORE_SCALE;

// ── Risk calculation ──────────────────────────────────────────
// Scored per-category, each capped independently, then summed and
// clamped to 100 — not a flat point total.
//   - Academic: includes WIR/intervention severity (an intervention
//     IS an academic-side signal, so it isn't its own category)
//   - Trades: summed per-trade, capped per trade
//   - Data/Time: own smaller cap — missing time data alone shouldn't
//     push someone to HIGH
//   - UNKNOWN overrides everything: zero data anywhere = explicitly
//     unknown, never defaults to LOW
function _calcRisk(academic, trades, time, hsComplete, tradeComplete, completedTrades, intervention, scheduledAcademicHours) {
  const flags = [];  
  const flagsDetailed = [];
  let score   = 0;
  function addFlag(label, points) {
    const scaledPoints = points * RISK_SCORE_SCALE;
    flags.push(label);
    flagsDetailed.push({ label, points: scaledPoints });
    return scaledPoints;
  }
  const hasScheduleData = scheduledAcademicHours !== null && scheduledAcademicHours > 0;
  let academicScore = 0;
  if (academic && !hsComplete) {

    // ── Pace: completion rate vs. the real 24-month program deadline ──
    // Replaces the old flat "graduation deadline within 30 days" cliff
    // check entirely. Required rate = hours still needed ÷ weeks left
    // until the hard 24-month cap from start date. Actual rate =
    // weeklyAvgHours (already computed, last 4 assigned weeks).
    // Guards: no flag if remainingHours is negligible (effectively
    // done), no flag if weeklyAvgHours is null (no recent assigned
    // weeks — a "no data" situation, not a "bad pace" one), auto-severe
    // if already past the hard cap with real work remaining.
    if (academic.start && academic.remainingHours !== null && academic.remainingHours !== undefined
        && academic.remainingHours > 0.5) {
      const startDate = _parseLocalDate(String(academic.start).slice(0, 10));
      if (startDate) {
        const hardCapDate      = _addMonths_(startDate, 24);
        const daysUntilHardCap = _daysUntil_(_toDateStr(hardCapDate));
        if (daysUntilHardCap !== null) {
          if (daysUntilHardCap <= 0) {
            academicScore += addFlag('Past the 24-month program deadline with coursework remaining', 45);
          } else if (academic.weeklyAvgHours !== null && academic.weeklyAvgHours !== undefined) {
            const weeksLeft      = daysUntilHardCap / 7;
            const requiredPerWeek = academic.remainingHours / weeksLeft;
            if (requiredPerWeek > 0) {
              const paceRatio = academic.weeklyAvgHours / requiredPerWeek;
              const pctOfNeeded = (paceRatio * 100).toFixed(0);
              if (paceRatio < 0.25) {
                academicScore += addFlag('Pace: severely behind rate needed to finish by deadline (' + pctOfNeeded + '% of required pace)', 45);
              } else if (paceRatio < 0.50) {
                academicScore += addFlag('Pace: behind rate needed to finish by deadline (' + pctOfNeeded + '% of required pace)', 35);
              } else if (paceRatio < 0.75) {
                academicScore += addFlag('Pace: at risk of missing deadline at current rate (' + pctOfNeeded + '% of required pace)', 25);
              }
            }
          }
        }
      }
    }

    // ── Attendance: hours worked vs. hours scheduled, last 4 assigned weeks ──
    // This is the OLD "Pace" logic (monthRatio), kept as its own
    // distinct signal — attendance and completion-rate are different
    // questions and both worth knowing independently.
    if (academic.attendanceRatio !== null && academic.attendanceRatio !== undefined) {
      const ar = academic.attendanceRatio;
      const pctAttended = (ar * 100).toFixed(0);
      if (ar < 0.50) {
        academicScore += addFlag('Attendance: behind schedule (' + pctAttended + '% of scheduled hours worked)', 20);
      } else if (ar < 0.75) {
        academicScore += addFlag('Attendance: inconsistent (' + pctAttended + '% of scheduled hours worked)', 12);
      }
    }

    // ── Trend: recent trajectory, independent of current position ──
    // Uses hoursTrend, already computed but previously unused by
    // scoring. Only ever adds risk (decelerating); accelerating/steady
    // add nothing.
    if (academic.hoursTrend && academic.hoursTrend.trendLabel === 'decelerating') {
      academicScore += addFlag('Hours-worked trend decelerating recently', 10);
    }

    if (academic.percent !== null && academic.percent < 50) {
      academicScore += addFlag('Low academic completion (<50%)', 20);
    }
    if (!hasScheduleData) {
      const thisWk = academic.thisWeekHours;
      if (thisWk !== 'NWH' && (thisWk === null || thisWk === 0)) {
        academicScore += addFlag('No academic hours logged this week', 15);
      }
    }
  }

  if (trades && trades.length) {
    trades.forEach(t => {
      const tradeName  = t.tarName || 'Trade';
      const isBCT      = tradeName.toUpperCase() === 'BCT';
      const isComplete = (t.overallPct !== null && t.overallPct >= 100)
                       || completedTrades.includes(tradeName);
      if (isComplete) { flags.push(tradeName + ': Trade Complete'); return; }
      let tradeScore = 0;

      // ── Trade Position: tiered paceGap (actual % vs. expected % for
      // a 150-workday window), replacing the old flat -10% cutoff.
      // ETAR proximity folded in as a small bonus rather than its own
      // full-weight flag, since it mostly restates what a severely
      // negative paceGap already shows.
      const pg = (typeof t.paceGap === 'number') ? t.paceGap : null;
      if (pg !== null) {
        if (pg < -30) {
          tradeScore += addFlag(tradeName + ': well behind expected pace (' + pg + '%)', 30);
        } else if (pg < -15) {
          tradeScore += addFlag(tradeName + ': behind expected pace (' + pg + '%)', 20);
        } else if (pg < -5) {
          tradeScore += addFlag(tradeName + ': slightly behind expected pace (' + pg + '%)', 10);
        }
      }
      if (t.daysToETAR !== null && t.daysToETAR < 60) {
        tradeScore += addFlag(tradeName + ': ETAR deadline within 60 days', 10);
      }

      if (String(t.status || '').toLowerCase().match(/inactive|withdrawn/)) {
        tradeScore += addFlag(tradeName + ': inactive/withdrawn', 15);
      }

      // ── Trade Trend: monthly gain stall detection. Completion-bonus
      // flag removed — paceGap above already reflects low completion,
      // so it was double-counting the same number.
      const threshold = isBCT ? 1.5 : 3.0;
      const monthly   = t.monthlyProgress || [];
      const scorable  = monthly.filter(m =>
        !m.addedPostFirst &&
        m.overallGain !== null &&
        (m.endOverallPct === null || m.endOverallPct < 100)
      );
      if (scorable.length) {
        const recent        = scorable.slice(-2);
        const stalledMonths = recent.filter(m => m.overallGain < threshold);
        const lastMonth     = recent[recent.length - 1];
        const lastGain      = lastMonth ? lastMonth.overallGain : null;
        const consecutiveStall = stalledMonths.length === 2 && recent.length === 2;
        const singleStall      = stalledMonths.length >= 1 && !consecutiveStall;
        if (consecutiveStall) {
          const avgGain = (recent.reduce((a, m) => a + m.overallGain, 0) / recent.length).toFixed(1);
          tradeScore += addFlag(tradeName + ': stalled for 2 consecutive months (avg gain ' + avgGain + '%, expected ≥' + threshold + '%)', isBCT ? 12 : 20);
        } else if (singleStall) {
          tradeScore += addFlag(tradeName + ': low monthly gain (' + (lastGain !== null ? lastGain.toFixed(1) : '?') + '% — expected ≥' + threshold + '%)', isBCT ? 8 : 12);
        }
      }

      score += Math.min(tradeScore, RISK_CATEGORY_CAP);
    });
  }

  if ((!trades || !trades.length) && completedTrades.length) {completedTrades.forEach(name => { flags.push(name + ': Trade Complete'); });}

  if (academic && !hsComplete && hasScheduleData) {
    const thisWk = academic.thisWeekHours;
    const actual = (thisWk === 'NWH' || thisWk === null) ? 0 : +thisWk;
    if (actual === 0) {academicScore += addFlag('No hours logged — scheduled for ' + scheduledAcademicHours + ' academic periods this week', 25);} 
      else if (actual < scheduledAcademicHours * 0.5) {academicScore += addFlag('Behind scheduled hours — logged ' + actual.toFixed(1) + 'h of ' + scheduledAcademicHours + ' scheduled academic periods', 15);}
  }

  const hasAnyData = !!academic || (trades && trades.length) || !!time || hsComplete || tradeComplete;
  let dataScore = 0;
  const consideredComplete = hsComplete || tradeComplete;
  if (time) {
    if ((time.totalHours || 0) < 1) {dataScore += addFlag('Minimal total logged time', 20);}
  } else if (!consideredComplete && hasAnyData) {
    dataScore += addFlag('No time data found', 10);
  }

  // ── Staleness: consecutive recent zero-hour weeks despite real
  // historical hours — catches "used to log time, went quiet" even
  // when there's no open WIR case to surface it any other way.
  if (time && (time.totalHours || 0) > 10 && academic
      && academic.recentZeroHourStreak !== null && academic.recentZeroHourStreak !== undefined
      && academic.recentZeroHourStreak >= 2) {
    dataScore += addFlag('No hours logged for ' + academic.recentZeroHourStreak + ' consecutive weeks despite ' + time.totalHours.toFixed(1) + 'h logged historically', 15);
  }

  // WIR/Intervention Factors — urgency dropped: it was a pure 1:1
  // relabeling of adminPriority/tier (HIGH→IMMEDIATE, MEDIUM→HIGH),
  // never an independent signal, so scoring both always double-counted
  // the same underlying tier.
  if (intervention) {
    const adminP  = String(intervention.adminPriority || intervention.priority || '').toUpperCase();
    const cStatus = String(intervention.caseStatus || '').toLowerCase();
    const isProgramDeadlineCritical = String(intervention.issueTags || intervention.detectedPatterns || '').includes('PROGRAM_DEADLINE_CRITICAL');
    if      (isProgramDeadlineCritical) { academicScore += addFlag('Intervention: program-deadline flag — most severe case the engine flags', 40); }
    else if (adminP === 'HIGH')     { academicScore += addFlag('Intervention: HIGH admin priority this week', 25); }
    else if (adminP === 'MEDIUM')   { academicScore += addFlag('Intervention: MEDIUM admin priority this week', 10); }
    if (cStatus === 'open') { academicScore += addFlag('Active open intervention case', 15); }
  }

  score += Math.min(academicScore, RISK_CATEGORY_CAP);

  if (!hasAnyData) { dataScore += addFlag('No academic or trades data', 20); }
  score += Math.min(dataScore, RISK_DATA_CATEGORY_CAP);
  score = Math.min(score, 200);

  // ── Level, with tightened LOW vs UNKNOWN distinction ──
  // A clean/no-flag result only counts as a trusted LOW if at least
  // 2 of the 3 data source types (academic/trades/time) are present,
  // OR the student has a real completion flag (hsComplete/tradeComplete
  // is confirmed evidence on its own — doesn't need a second source).
  // Otherwise "nothing to flag yet" (e.g. a freshly-enrolled student
  // with one trade and no monthly history) falls back to UNKNOWN rather
  // than reading as a confirmed clean bill of health.
  const sourceCount = [!!academic, !!(trades && trades.length), !!time].filter(Boolean).length;
  const hasEnoughForLow = sourceCount >= 2 || hsComplete || tradeComplete;
  const level = !hasAnyData ? 'UNKNOWN'
              : score >= 120  ? 'HIGH'
              : score >= 60   ? 'MEDIUM'
              : hasEnoughForLow ? 'LOW'
              : 'UNKNOWN';

  return { level, score, flags, flagsDetailed, overridden: false };
}

// ── Apply manual overrides ────────────────────────────────────
// Layers staff-set overrides onto an already-built profile. Must run
// AFTER _calcRisk — risk_level/flag_add/flag_remove mutate profile.risk
// directly.
//
// Also does stale-detection at the end (separate job, bolted on here
// since it needs the post-override profile state): compares today's
// %s against the last progress_snapshot, bumps risk if unchanged past
// STALE_THRESHOLD_DAYS.
function _applyOverrides(profile, overridesByStudent) {
  const ov = overridesByStudent[profile.id];
  if (!ov) return profile;
  ov.forEach(o => {
    switch (o.type) {
      case 'academic_status':
        profile.academicStatusOverride = o.value;
        if (_shouldAutoClearNotStarted_(profile, 'academic_status')) profile.academicStatusOverride = null;
        break;
      case 'trade_projected_end':     profile.tradeProjectedEndOverride     = o.value; break;
      case 'trade_enrollment_status': profile.tradeEnrollmentStatusOverride = o.value; break;
      case 'trade_status':
        profile.tradeStatusOverride = o.value;
        if (_shouldAutoClearNotStarted_(profile, 'trade_status')) profile.tradeStatusOverride = null;
        break;
      case 'trade_name':      profile.tradeNameOverride      = o.value; break;
      case 'hsd_class':       profile.hsdOverride            = o.value; break;
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
          profile.risk.score = Math.min(profile.risk.score + 15 * RISK_SCORE_SCALE, 200);
          if      (profile.risk.score >= 120 && profile.risk.level !== 'HIGH')   profile.risk.level = 'HIGH';
          else if (profile.risk.score >= 60  && profile.risk.level === 'LOW')    profile.risk.level = 'MEDIUM';
        }
      }
    }
  }
  return profile;
}
// Self-heals a stale NOT_STARTED override once real data proves the
// student started. Only checks academic_status/trade_status — the
// only two types NOT_STARTED gets set on.
// (Wired into _applyOverrides above — July 2026 audit, this existed
// but had no caller for a while.)
function _shouldAutoClearNotStarted_(profile, type) {
  if (type === 'academic_status') {return profile.academicStatusOverride === 'NOT_STARTED' && !!(profile.academic && profile.academic.start && profile.academic.targetDate);}
  if (type === 'trade_status') {return profile.tradeStatusOverride === 'NOT_STARTED' && profile.hasTrades === true;}
  return false;
}


// ── Compute risk trend arrow ──────────────────────────────────
// Compares against the OLDEST retained snapshot, not most recent —
// a "since we started watching" trend, not week-over-week. ±5 points
// = noise floor, reads as 'stable'.
function _computeRiskTrend(profile) {
  const snaps = (profile.progressSnapshots || [])
    .filter(s => s.score !== null && s.score !== undefined);
  if (!snaps.length) return;
  snaps.sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);
  const delta = profile.risk.score - snaps[0].score;
  profile.riskTrend = delta > 5 ? 'up' : delta < -5 ? 'down' : 'stable';
}

// ── Apply merges ──────────────────────────────────────────────
// The real merge work — mergeStudents (Datafetch.gs) only writes the
// 'merged_into' override; this is where source's data actually gets
// folded into target and source's card gets hidden.
// "Fill gaps, don't overwrite" — target keeps its own data if it has
// any; only inherits from source where target is missing something.
// Assumes source/target hold COMPLEMENTARY data, not conflicting
// records for the same domain.
// Requires source's Name Mapping row to still exist under its own
// original ID (byId[sourceId] must resolve) — see mergeStudents.
function _applyMerges(profiles, mergeMap) {
  if (!mergeMap || !Object.keys(mergeMap).length) return profiles;
  const byId = {};
  profiles.forEach(p => { byId[p.id] = p; });
  Object.keys(mergeMap).forEach(sourceId => {
    const source = byId[sourceId];
    const target = byId[mergeMap[sourceId]];
    if (!source || !target) return;
    if (!target.academic  && source.academic)  { target.academic   = source.academic;  target.hasAcademic  = true; }
    if ((!target.trades || !target.trades.length) && source.trades && source.trades.length) {target.trades   = source.trades;  target.hasTrades   = true;}
    if (!target.time       && source.time)       { target.time       = source.time;      target.hasTime       = true; }
    if (!target.intervention && source.intervention) {target.intervention   = source.intervention; target.hasIntervention = true;}
    if (source.completedTrades && source.completedTrades.length) {target.completedTrades = [...new Set([...(target.completedTrades || []), ...source.completedTrades])]; target.tradeComplete   =  target.tradeComplete || source.completedTrades.length > 0;}
    if (!target.hsComplete && source.hsComplete) target.hsComplete = true;
    if (source.lastModified && (!target.lastModified || source.lastModified > target.lastModified)) {target.lastModified = source.lastModified;}
    const wasOverridden = target.risk && target.risk.overridden;
    target.risk = _calcRisk(
      target.academic, target.trades, target.time,
      target.hsComplete, target.tradeComplete, target.completedTrades || [],
      target.intervention, target.scheduledAcademicHours
    );
    if (wasOverridden) target.risk.overridden = true;
  });
  return profiles.filter(p => !mergeMap[p.id]);
}

// ── Summary metrics ───────────────────────────────────────────
// Rollup counts/averages shown in the dashboard's top summary bar.
// Pure aggregation over an already-built profiles array — no reads,
// no side effects, safe to call as often as needed for re-renders.
function computeSummaryMetrics(profiles) {
  const total      = profiles.length;
  const riskCounts = { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
  profiles.forEach(p => { riskCounts[p.risk?.level || 'UNKNOWN']++; });
  const withIntervention = profiles.filter(p => p.hasIntervention && p.hasAcademic).length;
  const unmapped         = profiles.filter(p => p.mappingMissing).length;
  const stale            = profiles.filter(p => p.isStale).length;
  const hasNotes         = profiles.filter(p => p.notes && p.notes.length).length;
  const avgAcademicPct = _avg(profiles.filter(p => p.academic && p.academic.percent !== null).map(p => p.academic.percent));
  const avgTradesPct = _avg( profiles.filter(p => p.trades && p.trades.length && p.trades[0].overallPct !== null).map(p => p.trades[0].overallPct));
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
