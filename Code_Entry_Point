// ============================================================
// Code.gs — Main orchestrator
// Handles the web app entry point, dashboard data rebuild, and cache warming trigger. All parsing, profile building, and business logic lives in dedicated files.
// ============================================================

// ── Web App Entry Point ───────────────────────────────────────
function doGet(e) {
  // Student-facing view
  if (e && e.parameter && e.parameter.view === 'student') {
    return HtmlService
      .createTemplateFromFile('StudentView')
      .evaluate()
      .setTitle('My Progress — Tulsa Job Corps')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // JSON API endpoints (used by external callers)
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

  // System disabled check
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

  // Main staff dashboard
  const template = HtmlService.createTemplateFromFile('Dashboard');
  template.userRole   = '';
  template.userName   = '';
  template.employeeId = '';
  return template.evaluate()
    .setTitle('Student Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Allows Dashboard.html to include other HTML files via <?!= include('filename'); ?>
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ── System enabled check ──────────────────────────────────────
// Cached for 5 minutes to avoid opening SS_ADMIN on every request
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
  _cacheRemoveChunked(CacheService.getScriptCache(), 'dashboardData');
  return _rebuildDashboardData();
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

// ── Core rebuild ──────────────────────────────────────────────
function _rebuildDashboardData() {
  const t0    = Date.now();
  const cache = CacheService.getScriptCache();

  // 1. Open SS_HUB once and batch-read all sheets
  const hubSS        = SpreadsheetApp.openById(SS_HUB);
  const allSheetData = _readAllHubSheets(hubSS);
  Logger.log('Sheet reads complete: ' + (Date.now() - t0) + 'ms');

  // 2. Parse all sheet data into structured objects
  const nameMap           = parseNameMapping(allSheetData.mapping);
  const hsData            = parseAcademicSheet(allSheetData.hs,    'hs');
  const hisetData         = parseAcademicSheet(allSheetData.hiset, 'hiset');
  const tradesData        = parseTradesSheet(allSheetData.trades);
  const timeData          = parseTimeSheet(allSheetData.time);
  const tradeMonthlyData  = parseTradeMonthlySheet(allSheetData.tradeMonthly);
  const overrides         = parseOverridesSheet(allSheetData.overrides);
  const scheduleData      = parseScheduleSheet(allSheetData.schedule);
  const tabeData          = parseTABESheet(allSheetData.tabe);
  const studentCourseData = parseStudentCourseData(allSheetData.studentCourseData);
  Logger.log('Data parse complete: ' + (Date.now() - t0) + 'ms');

  // 3. Fetch WIR data (separate spreadsheet, cached separately)
  const wirData = _getWIRDataCached(cache);
  Logger.log('WIR read complete: ' + (Date.now() - t0) + 'ms');

  // 4. Append WIR to log if it's a new week
  if (wirData && wirData.rows && wirData.rows.length) {
    try {
      const lastWIRSheet = cache.get('lastWIRSheetName');
      if (lastWIRSheet !== wirData.sheetName) {
        appendToWIRLog(wirData, hubSS);
        cache.put('lastWIRSheetName', wirData.sheetName, CACHE_TTL);
      }
    } catch(e) {
      Logger.log('WIR log append failed (non-fatal): ' + e.message);
    }
  }

  // 5. Build unified student profiles
  const profiles = buildStudentProfiles(
    nameMap, hsData, hisetData, tradesData,
    timeData, wirData, tradeMonthlyData,
    overrides, scheduleData, tabeData, studentCourseData
  );
  Logger.log('Profile build complete: ' + (Date.now() - t0) + 'ms');

  // 6. Compute derived summaries
  const metrics            = computeSummaryMetrics(profiles);
  const hsMonthlyResult    = buildHSMonthlyCohort(allSheetData.hsMonthly, nameMap);
  const hsMonthlyByStudent = hsMonthlyResult.byStudent;
  const hsMonthlyCohort    = hsMonthlyResult.cohort;
  const tradeMonthlyCohort = getTradeMonthlyCohortSummary(tradeMonthlyData);
  const tabeCohort         = getTABECohortSummary(tabeData);

  const result = {
    profiles,
    metrics,
    wirWeekLabel:     wirData ? wirData.weekLabel : null,
    lastUpdated:      new Date().toISOString(),
    hsMonthlyByStudent,
    tradeMonthlyData,
    hsMonthlyCohort,
    tradeMonthlyCohort,
    tabeCohort,
  };

  // 7. Cache the result
  try {
    _cachePutChunked(cache, 'dashboardData', JSON.stringify(result), CACHE_TTL);
  } catch(e) {
    Logger.log('Cache put failed (non-fatal): ' + e.message);
  }

  // 8. Write progress snapshots (non-blocking)
  try { writeProgressSnapshots(profiles, hubSS); } catch(e) {
    Logger.log('Snapshot write failed (non-fatal): ' + e.message);
  }

  Logger.log('Total rebuild time: ' + (Date.now() - t0) + 'ms');
  return result;
}

// ── Batch sheet reader ────────────────────────────────────────
// Opens SS_HUB once and reads all required sheets in one pass.
// Returns a map of key -> values[][] for each sheet.
function _readAllHubSheets(hubSS) {
  const SHEET_NAMES = {
    hs:               SHEET_HS,
    hiset:            SHEET_HISET,
    trades:           SHEET_TRADES,
    mapping:          SHEET_MAPPING,
    tradeMonthly:     SHEET_TRADE_MONTHLY,
    time:             SHEET_TIME,
    overrides:        SHEET_OVERRIDES,
    schedule:         SHEET_SCHEDULE,
    hsMonthly:        SHEET_HS_MONTHLY,
    tabe:             SHEET_TABE,
    studentCourseData: SHEET_STUDENT_COURSE_DATA,
  };

  // Build a name -> sheet map to avoid repeated getSheetByName calls
  const sheetMap = {};
  hubSS.getSheets().forEach(s => { sheetMap[s.getName()] = s; });

  const result = {};
  Object.entries(SHEET_NAMES).forEach(([key, name]) => {
    const sheet = sheetMap[name];
    if (!sheet || sheet.getLastRow() < 1) {
      result[key] = [];
      Logger.log('Sheet not found or empty: ' + name);
      return;
    }
    try {
      result[key] = sheet.getDataRange().getValues();
    } catch(e) {
      result[key] = [];
      Logger.log('Error reading sheet ' + name + ': ' + e.message);
    }
  });

  return result;
}

// ── WIR data with short-TTL cache ────────────────────────────
function _getWIRDataCached(cache) {
  const cacheKey = 'wirData';
  const cached   = _cacheGetChunked(cache, cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch(e) { /* fall through */ }
  }
  const wirData = getWIRData();
  if (wirData) {
    try {
      _cachePutChunked(cache, cacheKey, JSON.stringify(wirData), WIR_CACHE_TTL);
    } catch(e) {
      Logger.log('WIR cache put failed (non-fatal): ' + e.message);
    }
  }
  return wirData;
}

// ── Cache warming ─────────────────────────────────────────────
// Runs on a 10-minute trigger. Uses a lock to prevent multiple
// instances from rebuilding simultaneously.
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

function debugForceFullClear() {
  const cache = CacheService.getScriptCache();
  _cacheRemoveChunked(cache, 'dashboardData');
  _cacheRemoveChunked(cache, 'productivityData');
  _cacheRemoveChunked(cache, 'wirData');
  Logger.log('All caches cleared.');
}
