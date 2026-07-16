// ============================================================
// Productivity.gs — Productivity modal data
// ============================================================

// ── Main payload ──────────────────────────────────────────────
function getProductivityPayload() {
  if (USE_VAULT_PRODUCTIVITY) return getProductivityPayloadFromVault_();
}

// ============================================================
// VAULT PATH
// ============================================================
// Composes the same payload shape as the legacy version, but every
// piece comes from Vault: Name Mapping (masterName, single field —
// no tradesName/academicName to fold in like the legacy roster-name
// builder did), Productivity Data (flat weekly rows), TABE Data
// (schema-identical, reused via parseTABESheet unchanged).
//
// productivityData[].name is populated via Name Mapping's masterName
// lookup, same as everywhere else — if a studentId isn't in Name
// Mapping this falls back to the raw ID, which the frontend will
// display as-is rather than a proper name.
function getProductivityPayloadFromVault_() {
  try {
    const cache    = CacheService.getScriptCache();
    const cacheKey = 'productivityData';
    const cached   = _cacheGetChunked(cache, cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch(e) { /* fall through */ }
    }

    const nameMap = readVaultSheetAsObjects_(VAULT_SHEET_NAME_MAPPING, VAULT_NAME_MAPPING_HEADERS);

    const rosterNames = new Set();
    const nameById = {};
    nameMap.forEach(m => {
      const name = String(m.masterName || '').trim();
      if (name) {
        rosterNames.add(name.toLowerCase().replace(/[^a-z ]/g, '').trim().split(' ').filter(Boolean).sort().join(' '));
      }
      if (m.studentId) nameById[String(m.studentId).trim()] = name || String(m.studentId).trim();
    });

    const productivityRows   = readVaultSheetAsObjects_(VAULT_SHEET_PRODUCTIVITY, VAULT_PRODUCTIVITY_HEADERS);
    const productivityData   = _buildProductivityDataFromVault_(productivityRows, nameById);
    const productivityCohort = _buildProductivityCohortSummary(productivityData); // unchanged, reused as-is

    const tabeValues    = getVaultSheet_(VAULT_SHEET_TABE).getDataRange().getValues();
    const tabeByStudent = parseTABESheet(tabeValues); // unchanged, TABE schema-identical under Vault
    const tabeProfiles = Object.entries(tabeByStudent).map(([id, data]) => ({
      id,
      displayName: data.name,
      academicId:  id,
      tabe:        data,
    }));

    const dashboard = getDashboardData();
    const hsMonthlyCohort    = dashboard.hsMonthlyCohort    || [];
    const tradeMonthlyCohort = dashboard.tradeMonthlyCohort || [];

    const result = {
      productivityData,
      productivityCohort,
      rosterNames:      [...rosterNames],
      tabeProfiles,
      hsMonthlyCohort,
      tradeMonthlyCohort,
    };

    try {
      _cachePutChunked(cache, cacheKey, JSON.stringify(result), 1800);
    } catch(e) {
      Logger.log('Productivity cache put failed (non-fatal): ' + e.message);
    }

    return result;

  } catch(e) {
    Logger.log('getProductivityPayloadFromVault_ error: ' + e.message);
    return { error: e.message };
  }
}

// Groups flat Productivity Data rows by studentId and computes the
// same per-student summary shape getProductivityData() produced —
// peak/trough week, trend (first-half vs. second-half average),
// totals — just driven by whatever weeks actually exist in the
// data instead of a fixed April-June week list. month/week are
// left null per week (no fixed month grouping under Vault);
// `label` (== weekLabel) is the only grouping key
// _buildProductivityCohortSummary() needs, and it's reused unchanged.
function _buildProductivityDataFromVault_(productivityRows, nameById) {
  const byStudent = {};
  (productivityRows || []).forEach(row => {
    const sid = String(row.studentId || '').trim();
    if (!sid) return;
    (byStudent[sid] = byStudent[sid] || []).push(row);
  });

  const results = [];
  Object.entries(byStudent).forEach(([sid, rows]) => {
    rows.sort((a, b) => {
      const aKey = _normVaultDateField_(a.weekLabel, 'yyyy-MM-dd');
      const bKey = _normVaultDateField_(b.weekLabel, 'yyyy-MM-dd');
      return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
    });

    const weeks = [];
    let totalWorked   = 0;
    let totalAssigned = 0;

    rows.forEach(row => {
      const worked   = row.actualWorkedTime !== undefined && row.actualWorkedTime !== '' ? Number(row.actualWorkedTime) : null;
      const assigned = row.assignedHours     !== undefined && row.assignedHours     !== '' ? Number(row.assignedHours)     : null;

      // No assigned hours on file for this week — skip it entirely,
      // same rule the legacy path used for NOT_IN_MONTH/blank cells.
      if (assigned === null) return;

      const productivity = assigned > 0
        ? +(((worked || 0) / assigned) * 100).toFixed(1)
        : null;

      weeks.push({
        month:         _normVaultDateField_(row.monthLabel, 'MMM yyyy') || null,
        week:         null, // no week-number field exists — only monthLabel + weekLabel(date)
        label:        _normVaultDateField_(row.weekLabel, 'yyyy-MM-dd'),
        worked:       worked ?? 0,
        assigned,
        productivity,
        notScheduled: assigned === 0,
      });

      if (worked   !== null) totalWorked   += worked;
      if (assigned !== null) totalAssigned += assigned;
    });

    if (!weeks.length) return;

    const overallProductivity = totalAssigned > 0
      ? +((totalWorked / totalAssigned) * 100).toFixed(1)
      : null;

    const sorted     = [...weeks].filter(w => w.productivity !== null).sort((a, b) => b.productivity - a.productivity);
    const peakWeek   = sorted[0]                 || null;
    const troughWeek = sorted[sorted.length - 1] || null;

    const half      = Math.floor(weeks.length / 2);
    const firstHalf = weeks.slice(0, half);
    const secHalf   = weeks.slice(half);
    const avgFirst  = firstHalf.length ? firstHalf.reduce((s, w) => s + (w.productivity || 0), 0) / firstHalf.length : null;
    const avgSecond = secHalf.length   ? secHalf.reduce((s, w) => s + (w.productivity || 0), 0) / secHalf.length   : null;

    let trend = 'stable';
    if (avgFirst !== null && avgSecond !== null) {
      if (avgSecond - avgFirst >  5) trend = 'improving';
      if (avgSecond - avgFirst < -5) trend = 'declining';
    }

    results.push({
      name: nameById[sid] || sid,
      weeks,
      totalWorked:         +totalWorked.toFixed(2),
      totalAssigned:       +totalAssigned.toFixed(2),
      overallProductivity,
      peakWeek,
      troughWeek,
      trend,
      weeksWithData:       weeks.length,
    });
  });

  Logger.log('Productivity Data (vault): ' + results.length + ' students');
  return results;
}

function clearProductivityCache() {
  _cacheRemoveChunked(CacheService.getScriptCache(), 'productivityData');
  Logger.log('Productivity cache cleared.');
}

// ── Per-student weekly productivity data (legacy path only) ────
function getProductivityData(hubSS) {
  try {
    const sheet = hubSS.getSheetByName(VAULT_SHEET_PRODUCTIVITY);
    if (!sheet) {
      Logger.log('Productivity Data sheet not found — skipping.');
      return [];
    }
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const values = sheet.getRange(2, 1, lastRow - 1, 25).getValues();

    const WEEKS = [
      { month: 'April', week: 1, workedIdx: 1,  assignedIdx: 2  },
      { month: 'April', week: 2, workedIdx: 3,  assignedIdx: 4  },
      { month: 'April', week: 3, workedIdx: 5,  assignedIdx: 6  },
      { month: 'April', week: 4, workedIdx: 7,  assignedIdx: 8  },
      { month: 'May',   week: 1, workedIdx: 9,  assignedIdx: 10 },
      { month: 'May',   week: 2, workedIdx: 11, assignedIdx: 12 },
      { month: 'May',   week: 3, workedIdx: 13, assignedIdx: 14 },
      { month: 'May',   week: 4, workedIdx: 15, assignedIdx: 16 },
      { month: 'June',  week: 1, workedIdx: 17, assignedIdx: 18 },
      { month: 'June',  week: 2, workedIdx: 19, assignedIdx: 20 },
      { month: 'June',  week: 3, workedIdx: 21, assignedIdx: 22 },
      { month: 'June',  week: 4, workedIdx: 23, assignedIdx: 24 },
    ];

    const results = [];

    values.forEach(row => {
      const name = String(row[0] || '').trim();
      if (!name || name.toLowerCase().includes('name')) return;

      const weeks = [];
      let totalWorked   = 0;
      let totalAssigned = 0;

      WEEKS.forEach(w => {
        const worked   = _parseProductivityHours(row[w.workedIdx]);
        const assigned = _parseProductivityHours(row[w.assignedIdx]);

        // null = NOT_IN_MONTH or blank — skip this week entirely
        if (assigned === null) return;

        const productivity = assigned > 0
          ? +((worked / assigned) * 100).toFixed(1)
          : null;

        weeks.push({
          month:        w.month,
          week:         w.week,
          label:        w.month + ' Wk' + w.week,
          worked:       worked ?? 0,
          assigned,
          productivity,
          notScheduled: assigned === 0,
        });

        if (worked   !== null) totalWorked   += worked;
        if (assigned !== null) totalAssigned += assigned;
      });

      if (!weeks.length) return;

      const overallProductivity = totalAssigned > 0
        ? +((totalWorked / totalAssigned) * 100).toFixed(1)
        : null;

      // Peak / trough
      const sorted     = [...weeks].filter(w => w.productivity !== null)
        .sort((a, b) => b.productivity - a.productivity);
      const peakWeek   = sorted[0]                 || null;
      const troughWeek = sorted[sorted.length - 1] || null;

      // Trend
      const half      = Math.floor(weeks.length / 2);
      const firstHalf = weeks.slice(0, half);
      const secHalf   = weeks.slice(half);
      const avgFirst  = firstHalf.length
        ? firstHalf.reduce((s, w) => s + (w.productivity || 0), 0) / firstHalf.length : null;
      const avgSecond = secHalf.length
        ? secHalf.reduce((s, w) => s + (w.productivity || 0), 0) / secHalf.length : null;

      let trend = 'stable';
      if (avgFirst !== null && avgSecond !== null) {
        if (avgSecond - avgFirst >  5) trend = 'improving';
        if (avgSecond - avgFirst < -5) trend = 'declining';
      }

      results.push({
        name,
        weeks,
        totalWorked:         +totalWorked.toFixed(2),
        totalAssigned:       +totalAssigned.toFixed(2),
        overallProductivity,
        peakWeek,
        troughWeek,
        trend,
        weeksWithData:       weeks.length,
      });
    });

    Logger.log('Productivity Data: ' + results.length + ' students');
    return results;

  } catch(e) {
    Logger.log('getProductivityData error: ' + e.message);
    return [];
  }
}

// ── Parse hours from a cell (legacy path only — Vault stores
// plain decimals already, no Date-duration cells or NOT_IN_MONTH
// markers to unpack) ─────────────────────────────────────────
function _parseProductivityHours(val) {
  if (val === null || val === undefined) return null;
  if (String(val).trim() === 'NOT_IN_MONTH') return null;
  if (val === '' || val === 0) return 0;
 
  if (val instanceof Date) {
    // Sheets duration cells use Dec 30, 1899 as their zero point.
    // Using elapsed time from that epoch (rather than .getHours())
    // correctly captures durations of 24 hours or more.
    const SHEETS_EPOCH = new Date(1899, 11, 30);
    const diffMs = val.getTime() - SHEETS_EPOCH.getTime();
    const h = diffMs / (1000 * 60 * 60);
    return h > 0 ? +h.toFixed(2) : 0;
  }
 
  const str = String(val).trim();
  if (!str || str === '—' || str === '-') return 0;
 
  if (str.includes(':')) {
    const parts = str.split(':').map(Number);
    if (parts.length === 3) return +((parts[0] + parts[1] / 60 + parts[2] / 3600)).toFixed(2);
    if (parts.length === 2) return +((parts[0] + parts[1] / 60)).toFixed(2);
  }
 
  const n = Number(str);
  return isNaN(n) ? 0 : +n.toFixed(2);
}

// ── Cohort weekly summary ─────────────────────────────────────
// No Vault branch needed — operates on already-built productivityData
// (either path), grouping purely by w.label. Confirmed compatible
// as-is; reused unchanged by getProductivityPayloadFromVault_ above.
function _buildProductivityCohortSummary(productivityData) {
  if (!productivityData || !productivityData.length) return [];

  const weekMap = {};
  productivityData.forEach(student => {
    student.weeks.forEach(w => {
      if (!weekMap[w.label]) {
        weekMap[w.label] = { label: w.label, month: w.month, week: w.week, students: [] };
      }
      weekMap[w.label].students.push({
        name:         student.name,
        worked:       w.worked,
        assigned:     w.assigned,
        productivity: w.productivity,
      });
    });
  });

  return Object.values(weekMap).map(w => {
    const productivities = w.students.map(s => s.productivity).filter(v => v !== null);
    const assignedVals   = w.students.map(s => s.assigned).filter(v => v !== null && v > 0);
    const workedVals     = w.students.map(s => s.worked).filter(v => v !== null);

    const avg = arr => arr.length
      ? +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1)
      : null;

    return {
      label:           w.label,
      month:           w.month,
      week:            w.week,
      studentCount:    w.students.length,
      avgProductivity: avg(productivities),
      avgAssigned:     avg(assignedVals),
      avgWorked:       avg(workedVals),
      minProductivity: productivities.length ? +Math.min(...productivities).toFixed(1) : null,
      maxProductivity: productivities.length ? +Math.max(...productivities).toFixed(1) : null,
    };
  });
}

// ── HS Graduation Predictions (Graduates tab) ─────────────────
// No branch needed — getDashboardData() already dispatches
// internally, and _computeHSGraduationPredictions (Predictions.gs)
// is a pure function of whatever profiles/hsMonthlyByStudent it's
// given. IMPORTANT: see the note delivered alongside this file —
// under the Vault profile path, p.academic.type and p.academic.graduation
// are currently always null (ProfilesVault.gs has no source for
// either), so this will silently return zero graduates once
// USE_VAULT_PROFILES is on. That gap lives in ProfilesVault.gs /
// Vault schema availability, not here.
function getHSGraduationPredictions() {
  try {
    const dashboard = getDashboardData();
    if (dashboard.error) return { error: dashboard.error, graduates: [] };

    const predictions = _computeHSGraduationPredictions(
      dashboard.profiles           || [],
      dashboard.hsMonthlyByStudent || {}
    );

    const now      = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const weeksLeft = +((monthEnd - now) / (7 * 86400000)).toFixed(1);

    return {
      graduates:   predictions,
      month:       Utilities.formatDate(now, Session.getScriptTimeZone(), 'MMMM yyyy'),
      weeksLeft,
      generatedAt: now.toISOString(),
      error:       null,
    };
  } catch(e) {
    Logger.log('getHSGraduationPredictions error: ' + e.message);
    return { error: e.message, graduates: [] };
  }
}

// ── Debug helpers ─────────────────────────────────────────────
function debugProductivityPayload() {
  const payload = getProductivityPayload();
  Logger.log('Error: '                  + (payload.error || 'none'));
  Logger.log('productivityData length: ' + (payload.productivityData   || []).length);
  Logger.log('productivityCohort length:' + (payload.productivityCohort || []).length);
  Logger.log('rosterNames length: '     + (payload.rosterNames         || []).length);
  Logger.log('tabeProfiles length: '    + (payload.tabeProfiles        || []).length);
  Logger.log('hsMonthlyCohort length: ' + (payload.hsMonthlyCohort     || []).length);
  Logger.log('tradeMonthlyCohort length:' + (payload.tradeMonthlyCohort || []).length);

  const first = (payload.productivityData || [])[0];
  if (first) {
    Logger.log('First student: '         + first.name);
    Logger.log('First student weeks: '   + first.weeks.length);
    Logger.log('First week: '            + JSON.stringify(first.weeks[0]));
    Logger.log('overallProductivity: '   + first.overallProductivity);
    Logger.log('trend: '                 + first.trend);
  } else {
    Logger.log('productivityData is EMPTY');
  }

  const firstWeek = (payload.productivityCohort || [])[0];
  if (firstWeek) Logger.log('First cohort week: ' + JSON.stringify(firstWeek));

  Logger.log('First rosterName: ' + (payload.rosterNames || [])[0]);
}



// ── Normalize a Vault date-ish field that Sheets may have silently
// auto-converted from a plain string into a real Date object.
// Always returns a clean, stable string so two rows for the same
// calendar week/month can never fracture into separate groups just
// because one was written with a different time-of-day component.
function _normVaultDateField_(val, fmt) {
  if (val instanceof Date && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), fmt);
  }
  return String(val || '').trim();
}
