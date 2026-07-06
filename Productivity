// ============================================================
// Productivity.gs — Productivity modal data
// ============================================================

// ── Main payload ──────────────────────────────────────────────
function getProductivityPayload() {
  try {
    const cache    = CacheService.getScriptCache();
    const cacheKey = 'productivityData';
    const cached   = _cacheGetChunked(cache, cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch(e) { /* fall through */ }
    }

    const hubSS = SpreadsheetApp.openById(SS_HUB);

    // ── rosterNames from Name Mapping (cols B, C, D) ─────────
    const rosterNames = new Set();
    const mapSheet = hubSS.getSheetByName(SHEET_MAPPING);
    if (mapSheet && mapSheet.getLastRow() >= 2) {
      const mapValues = mapSheet.getRange(2, 1, mapSheet.getLastRow() - 1, 4).getValues();
      mapValues.forEach(row => {
        [row[1], row[2], row[3]].forEach(n => {
          const s = String(n || '').trim();
          if (s) rosterNames.add(
            s.toLowerCase().replace(/[^a-z ]/g, '').trim().split(' ').filter(Boolean).sort().join(' ')
          );
        });
      });
    }

    // ── Productivity data ─────────────────────────────────────
    const productivityData   = getProductivityData(hubSS);
    const productivityCohort = _buildProductivityCohortSummary(productivityData);

    // ── TABE profiles ─────────────────────────────────────────
    const tabeSheet  = hubSS.getSheetByName(SHEET_TABE);
    const tabeValues = tabeSheet ? tabeSheet.getDataRange().getValues() : [];
    const tabeByStudent = parseTABESheet(tabeValues);
    const tabeProfiles = Object.entries(tabeByStudent).map(([id, data]) => ({
      id,
      displayName: data.name,
      academicId:  id,
      tabe:        data,
    }));

    // ── HS + Trade monthly cohort — read straight from the dashboard,
    //     already correctly shaped by Cohorts.gs. No reshaping here.
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
    Logger.log('getProductivityPayload error: ' + e.message);
    return { error: e.message };
  }
}

function clearProductivityCache() {
  _cacheRemoveChunked(CacheService.getScriptCache(), 'productivityData');
  Logger.log('Productivity cache cleared.');
}

// ── Per-student weekly productivity data ──────────────────────
// Reads the Productivity Data sheet. Column layout:
//   Col A: Student Name
//   Col B+: Alternating "Xxx WkN Worked" / "Xxx WkN Assigned"
function getProductivityData(hubSS) {
  try {
    const sheet = hubSS.getSheetByName(SHEET_PRODUCTIVITY);
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

// ── Parse hours from a cell ───────────────────────────────────
// Handles Date objects (time values stored as 1899-12-30 epoch),
// numeric hours, HH:MM:SS strings, and NOT_IN_MONTH sentinel.
function _parseProductivityHours(val) {
  if (val === null || val === undefined) return null;
  if (String(val).trim() === 'NOT_IN_MONTH') return null;
  if (val === '' || val === 0) return 0;

  if (val instanceof Date) {
    // Google Sheets stores time durations as Date objects anchored
    // to 1899-12-30. getHours() (local time) gives the correct value.
    const h = val.getHours() + val.getMinutes() / 60 + val.getSeconds() / 3600;
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
// Internal version — takes productivityData array, returns cohort
// array in the shape ProductivityScripts.html expects.
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
// Public no-arg wrapper called by google.script.run
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
    Logger.log('productivityData is EMPTY');A
  }

  const firstWeek = (payload.productivityCohort || [])[0];
  if (firstWeek) Logger.log('First cohort week: ' + JSON.stringify(firstWeek));

  Logger.log('First rosterName: ' + (payload.rosterNames || [])[0]);
}

function runClearAllCaches() {
  google.script.run
    .withSuccessHandler(function() {
      alert('Caches cleared. Reloading dashboard...');
      loadData();
      if (typeof _productivityData !== 'undefined') {
        // Also force the productivity modal to refetch next time it's opened
        _productivityData = null;
        _cohortSummary = null;
        _hsMonthlyCohort = [];
        _tradeMonthlyCohort = [];
      }
    })
    .withFailureHandler(function(err) {
      alert('Failed to clear caches: ' + (err && err.message ? err.message : 'unknown error'));
    })
    .clearAllCaches();
}
