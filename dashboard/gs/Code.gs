// =========
// Code.gs — Main orchestrator
// ---------

// ── Web App Entry Point ───────────────────────────────────────
function doGet(e) {
  if (e && e.parameter && e.parameter.view === 'student') {
    return HtmlService
      .createTemplateFromFile('StudentView')
      .evaluate()
      .setTitle('My Progress — Tulsa Job Corps')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (e && e.parameter && e.parameter.studentId) {
    return ContentService
      .createTextOutput(JSON.stringify(getStudentProfile(e.parameter.studentId)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.scheduleId) {
    return ContentService
      .createTextOutput(JSON.stringify(getStudentSchedule(e.parameter.scheduleId)))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (!_isSystemEnabled()) {
    return HtmlService.createHtmlOutput(`
      <html><body style="font-family:sans-serif;display:flex;align-items:center;
      justify-content:center;height:100vh;margin:0;background:#1a1a18;color:#8a7a6a;">
        <div style="text-align:center;">
          <div style="font-size:32px;margin-bottom:16px;">🔒</div>
          <div style="font-size:18px;font-weight:700;color:#f0e8dc;margin-bottom:8px;">
            System Unavailable
          </div>
          <div style="font-size:13px;">
            The dashboard is currently offline for maintenance.<br>
            Contact your administrator for more information.
          </div>
        </div>
      </body></html>`)
      .setTitle('System Unavailable')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  const template = HtmlService.createTemplateFromFile('Dashboard');
  template.userRole   = '';
  template.userName   = '';
  template.employeeId = '';
  return template.evaluate()
    .setTitle('Student Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ── System enabled check ──────────────────────────────────────
function _isSystemEnabled() {
  try {
    const cache  = CacheService.getScriptCache();
    const cached = cache.get('systemEnabled');
    if (cached !== null) return cached === 'true';

    const adminSS = SpreadsheetApp.openById(SS_ADMIN);
    const sheet   = adminSS.getSheetByName(SHEET_SYSTEM_CONFIG);
    let result    = true;
    if (sheet) {
      const values = sheet.getDataRange().getValues();
      const row    = values.find(r => String(r[0]).trim() === 'SystemEnabled');
      if (row) result = String(row[1]).trim().toUpperCase() === 'TRUE';
    }
    cache.put('systemEnabled', String(result), 300);
    return result;
  } catch(e) {
    Logger.log('_isSystemEnabled error: ' + e.message);
    return true;
  }
}

// ── Dashboard data (public API) ───────────────────────────────
function getDashboardData() {
  try {
    const cache  = CacheService.getScriptCache();
    const cached = _cacheGetChunked(cache, 'dashboardData');
    if (cached) return JSON.parse(cached);
    return _rebuildDashboardData();
  } catch(err) {
    Logger.log('getDashboardData error: ' + err.message);
    return { error: err.message, profiles: [], metrics: {} };
  }
}

function refreshData() {
  _clearDashboardCache();
  return getDashboardData();
}


// ── Student profile lookup ────────────────────────────────────
function getStudentProfile(studentId) {
  try {
    studentId = String(studentId || '').trim();
    if (!studentId) return { error: 'No Student ID provided.' };
    const data = getDashboardData();
    if (data.error) return { error: 'Could not load data: ' + data.error };
    const profile = (data.profiles || []).find(p =>
      String(p.academicId || '').trim() === studentId ||
      String(p.tradesId   || '').trim() === studentId ||
      String(p.id         || '').trim() === studentId
    );
    return { error: null, profile: profile || null };
  } catch(e) {
    Logger.log('getStudentProfile error: ' + e.message);
    return { error: 'Something went wrong. Please try again.' };
  }
}

// ============================================================
// Core rebuild — Vault-only.
// ============================================================
function _rebuildDashboardData() {
  const t0    = Date.now();
  const cache = CacheService.getScriptCache();

  const nameMap           = readVaultSheetAsObjects_(VAULT_SHEET_NAME_MAPPING, VAULT_NAME_MAPPING_HEADERS);
  const tradeOverviewRows = readVaultSheetAsObjects_(VAULT_SHEET_TRADE_OVERVIEW, VAULT_TRADE_OVERVIEW_HEADERS);
  const tradeSnapshotRows = readVaultSheetAsObjects_(VAULT_SHEET_TRADE_SNAPSHOTS, VAULT_TRADE_SNAPSHOT_HEADERS);
  const productivityRows  = readVaultSheetAsObjects_(VAULT_SHEET_PRODUCTIVITY, VAULT_PRODUCTIVITY_HEADERS);
  const academicSnapshotRows = readVaultSheetAsObjects_(VAULT_SHEET_ACADEMIC_SNAPSHOTS, VAULT_ACADEMIC_SNAPSHOT_HEADERS);

  const allTranscriptRows = readVaultSheetAsObjects_(VAULT_SHEET_TRANSCRIPT_ROWS, VAULT_TRANSCRIPT_HEADERS);
  const transcriptRowsByStudent = {};
  allTranscriptRows.forEach(row => {
    const id = String(row.studentId || '').trim();
    if (!id) return;
    if (!transcriptRowsByStudent[id]) transcriptRowsByStudent[id] = [];
    transcriptRowsByStudent[id].push(row);
  });

  const courseDataById = {};
  nameMap.forEach(row => {
    const id = String(row.studentId || '').trim();
    if (!id) return;
    const courses = transcriptRowsByStudent[id];
    if (!courses || !courses.length) return; // no transcript rows yet -- surfaced separately, not silently defaulted
    courseDataById[id] = _computeCourseDataFromVaultRows_(courses);
  });

  const studentInfoRows = readVaultSheetAsObjects_(VAULT_SHEET_STUDENT_INFO, ['studentId', 'startDate', 'lastSynced']);
  const startDateById = {};
  studentInfoRows.forEach(row => {
    const id = String(row.studentId || '').trim();
    if (id) startDateById[id] = row.startDate || null;
  });

  const tabeValues    = getVaultSheet_(VAULT_SHEET_TABE).getDataRange().getValues();
  const tabeData       = parseTABESheet(tabeValues);

  const scheduleValues       = getVaultSheet_(VAULT_SHEET_WEEKLY_SCHEDULE).getDataRange().getValues();
  const scheduleByStudentId = parseVaultScheduleSheet(scheduleValues);

  const overridesValues = _ensureVaultOverridesSheet_().getDataRange().getValues();
  const overrides        = parseOverridesSheet(overridesValues);

  Logger.log('Vault sheet reads complete: ' + (Date.now() - t0) + 'ms');

  const wirCombined = getAllStudentInterventions();
  Logger.log('WIR read complete: ' + (Date.now() - t0) + 'ms');

  const profiles = buildStudentProfilesFromVault(
    nameMap, courseDataById, tradeOverviewRows, tradeSnapshotRows,
    productivityRows, wirCombined, scheduleByStudentId, tabeData, overrides,
    startDateById, academicSnapshotRows
  );
  Logger.log('Profile build complete: ' + (Date.now() - t0) + 'ms');

  const metrics = computeSummaryMetrics(profiles);

  const hsMonthlyResult    = buildHSMonthlyCohortFromVault_(academicSnapshotRows);
  const hsMonthlyByStudent = hsMonthlyResult.byStudent;
  const hsMonthlyCohort    = hsMonthlyResult.cohort;
  const tradeMonthlyCohort = getTradeMonthlyCohortSummaryFromVault_(tradeSnapshotRows, nameMap);
  const tabeCohort         = getTABECohortSummary(tabeData);

  const result = {
    profiles,
    metrics,
    wirWeekLabel:     _latestWeekLabelFromWirVault_(wirCombined),
    lastUpdated:      new Date().toISOString(),
    hsMonthlyByStudent,
    tradeMonthlyData: tradeSnapshotRows,
    hsMonthlyCohort,
    tradeMonthlyCohort,
    tabeCohort,
  };

  try {
    _cachePutChunked(cache, 'dashboardData', JSON.stringify(result), CACHE_TTL);
  } catch(e) {
    Logger.log('Cache put failed (non-fatal): ' + e.message);
  }

  try { writeProgressSnapshots(profiles, null); } catch(e) {
    Logger.log('Snapshot write failed (non-fatal): ' + e.message);
  }

  Logger.log('Total rebuild time: ' + (Date.now() - t0) + 'ms');
  return result;
}

function _latestWeekLabelFromWirVault_(wirCombined) {
  let latest = '';
  (wirCombined || []).forEach(c => {
    const label = c.report && c.report.weekLabel ? String(c.report.weekLabel) : '';
    if (label > latest) latest = label;
  });
  return latest || null;
}

// ── Cache warming ─────────────────────────────────────────────
function keepDashboardCacheWarm() {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(0)) {
      Logger.log('Cache warming skipped — another instance is running.');
      return;
    }
    _rebuildDashboardData();
    const now = new Date().toISOString();
    Logger.log('Cache warmed at ' + now);
    try {
      const adminSS = SpreadsheetApp.openById(SS_ADMIN);
      const sheet   = adminSS.getSheetByName(SHEET_SYSTEM_CONFIG);
      if (sheet) {
        const values = sheet.getDataRange().getValues();
        let found    = false;
        for (let i = 0; i < values.length; i++) {
          if (String(values[i][0]).trim() === 'LastCacheWarm') {
            sheet.getRange(i + 1, 2).setValue(now);
            found = true;
            break;
          }
        }
        if (!found) sheet.appendRow(['LastCacheWarm', now]);
      }
    } catch(e2) {
      Logger.log('Could not write LastCacheWarm (non-fatal): ' + e2.message);
    }
  } catch(e) {
    Logger.log('Cache warming failed (non-fatal): ' + e.message);
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}
function getDashboardAnnouncements() {
  const ss = SpreadsheetApp.openById("15AdLxifwIXSjT5ja9bpuBOhp8b6u4r2sniHbU4cA_2o");
  const sheet = ss.getSheetByName("Dashboard Announcements");

  if (!sheet) {
    Logger.log("Sheet not found");
    return [];
  }
  const data = sheet.getDataRange().getValues();
  Logger.log(data);
  data.shift();
  const results = data
    .filter(row => row[0] === true || row[0] === "TRUE")
    .map(row => ({
      priority: row[1],
      title: row[2],
      message: row[3],
      date: row[4] ? row[4].toString() : ""
    }));

  Logger.log(results);

  return results;
}
// ── Trigger management ────────────────────────────────────────
function installCacheWarmingTrigger() {
  removeCacheWarmingTrigger();
  ScriptApp.newTrigger('keepDashboardCacheWarm')
    .timeBased().everyMinutes(10).create();
  Logger.log('Cache warming trigger installed (every 10 min).');
}

function removeCacheWarmingTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'keepDashboardCacheWarm') ScriptApp.deleteTrigger(t);
  });
}
