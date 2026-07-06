// ============================================================
// TABE.gs — TABE test data management
// Handles CSV upload processing, history sheet maintenance, and cohort-level summaries. Parsing lives in Parsers.gs.
// ============================================================

// ── Upload ────────────────────────────────────────────────────
// Accepts a base64-encoded CSV string, parses it, and writes
// to the TABE Data and TABE History sheets in SS_HUB.
function uploadTABEData(base64Csv, role) {
  _requirePermission(role || ROLES.ADMIN, 'manage_overrides');
  try {
    const csv     = Utilities.newBlob(Utilities.base64Decode(base64Csv)).getDataAsString();
    const rows    = _parseTABECsv(csv);
    if (!rows.length) return { error: 'No valid student rows found in the CSV.' };

    const hubSS = SpreadsheetApp.openById(SS_HUB);
    _writeTABEDataSheet(hubSS, rows);
    _appendTABEHistory(hubSS, rows);
    _clearDashboardCache();

    return { success: true, count: rows.length };
  } catch(e) {
    Logger.log('uploadTABEData error: ' + e.message);
    return { error: e.message };
  }
}

// ── CIS Master Testing Roster HTML parsing ───────────────────
// CIS exports this report as an HTML file with a .xls extension.
// Unlike the old flat CSV (one row per student with precomputed
// prev/curr/best columns), this report lists RAW test attempts:
// one header block per student, followed by one row per test
// taken (grouped by subject, newest first), repeated across many
// printed "pages" with duplicate column headers in between.
function _tabeLooksLikeRosterHtml(str) {
  return /MASTER TESTING ROSTER REPORT/i.test(str) ||
         (/Student Name\s*\/\s*ID/i.test(str) && /TABE (Mathematics|Reading)/i.test(str));
}

function _tabeDecodeEntities(str) {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function _tabeStripTags(html) {
  return _tabeDecodeEntities(String(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// Parses the CIS Master Testing Roster HTML export into rows shaped
// to match TABE_HEADERS — same output contract as _parseTABECsv, so
// _writeTABEDataSheet / _appendTABEHistory need no further changes.
function _tabeParseRosterHtml(html) {
  const rowsHtml = [];
  const trRegex  = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(html)) !== null) rowsHtml.push(trMatch[1]);

  function cellsOf(trInner) {
    const cells = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(trInner)) !== null) cells.push(tdMatch[1]);
    return cells;
  }

  const studentsInOrder = [];
  const byId = {};
  let current = null;

  rowsHtml.forEach(trInner => {
    const cells = cellsOf(trInner);
    if (cells.length < 8) return; // banner/title rows have far fewer cells — skip

    const firstCellRaw = cells[0] || '';
    const divMatches    = [...firstCellRaw.matchAll(/<div>([\s\S]*?)<\/div>/gi)];

    // Student header row: first cell holds two stacked <div>s — name, then ID
    if (divMatches.length >= 2) {
      const name = _tabeStripTags(divMatches[0][1]);
      const id   = _tabeStripTags(divMatches[1][1]);
      if (!id || !name) return;
      if (!byId[id]) {
        current = { id, name, hsdStatus: '', math: [], reading: [] };
        byId[id] = current;
        studentsInOrder.push(current);
      } else {
        current = byId[id]; // continuation of same student across a page break
      }
      const hsdStatus = _tabeStripTags(cells[3] || '');
      if (hsdStatus) current.hsdStatus = hsdStatus;
      return;
    }

    // Otherwise, a test-attempt row for whichever student is "current"
    if (!current) return;
    const testType = _tabeStripTags(cells[4] || '');
    if (!testType) return; // blank filler row or repeated column-header row

    const validTest = _tabeStripTags(cells[7] || '').toUpperCase();
    if (validTest === 'N') return; // explicitly invalidated test — skip

    const testDate = _tabeStripTags(cells[8] || '');
    const scale    = parseFloat(_tabeStripTags(cells[9] || ''));
    const efl      = _tabeStripTags(cells[11] || '');
    const eflLevel = _tabeStripTags(cells[12] || '');
    if (!testDate || isNaN(scale)) return;

    const entry = { date: testDate, scale, efl, eflLevel };
    if (/mathematics/i.test(testType))    current.math.push(entry);
    else if (/reading/i.test(testType))   current.reading.push(entry);
  });

  const rows       = [];
  const reportDate = _todayStr();

  function summarize(tests) {
    if (!tests.length) return { attempts: 0, prev: null, curr: null, best: null, gain: '' };
    const sorted = [...tests].sort((a, b) => (_tabeParseDate(b.date) || 0) - (_tabeParseDate(a.date) || 0));
    const curr = sorted[0];
    const prev = sorted.length > 1 ? sorted[1] : null;
    const best = sorted.reduce((b, t) => (t.scale > b.scale ? t : b), sorted[0]);
    const gain = prev !== null ? (curr.scale - prev.scale) : '';
    return { attempts: sorted.length, prev, curr, best, gain };
  }

  studentsInOrder.forEach(s => {
    const math = summarize(s.math);
    const read = summarize(s.reading);

    rows.push([
      s.id, s.name, s.hsdStatus,
      String(math.attempts || ''),
      math.prev ? math.prev.date : '', math.prev ? String(math.prev.scale) : '', math.prev ? math.prev.efl : '', math.prev ? math.prev.eflLevel : '',
      math.curr ? math.curr.date : '', math.curr ? String(math.curr.scale) : '', math.curr ? math.curr.efl : '', math.curr ? math.curr.eflLevel : '',
      math.best ? math.best.date : '', math.best ? String(math.best.scale) : '', math.best ? math.best.efl : '', math.best ? math.best.eflLevel : '',
      math.gain === '' ? '' : String(math.gain),
      String(read.attempts || ''),
      read.prev ? read.prev.date : '', read.prev ? String(read.prev.scale) : '', read.prev ? read.prev.efl : '', read.prev ? read.prev.eflLevel : '',
      read.curr ? read.curr.date : '', read.curr ? String(read.curr.scale) : '', read.curr ? read.curr.efl : '', read.curr ? read.curr.eflLevel : '',
      read.best ? read.best.date : '', read.best ? String(read.best.scale) : '', read.best ? read.best.efl : '', read.best ? read.best.eflLevel : '',
      read.gain === '' ? '' : String(read.gain),
      reportDate,
    ]);
  });

  Logger.log('_tabeParseRosterHtml: parsed ' + rows.length + ' students from roster report');
  return rows;
}


// ── CSV parsing ───────────────────────────────────────────────
// Converts raw TABE CSV export into structured row arrays
// ready to write to the TABE Data sheet.
function _parseTABECsv(csv) {
  if (_tabeLooksLikeRosterHtml(csv)) {
    return _tabeParseRosterHtml(csv);
  }

  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const idCol   = headers.indexOf('student id');
  const nameCol = headers.indexOf('student name');
  if (idCol < 0 || nameCol < 0) throw new Error('CSV missing required "Student ID" or "Student Name" columns.');

  function col(label) { return headers.indexOf(label.toLowerCase()); }

  const rows       = [];
  const reportDate = _todayStr();

  for (let i = 1; i < lines.length; i++) {
    const cells = _splitCsvLine(lines[i]);
    const id    = String(cells[idCol]   || '').trim().replace(/"/g, '');
    const name  = String(cells[nameCol] || '').trim().replace(/"/g, '');
    if (!id || !name) continue;

    function val(label) {
      const c = col(label);
      return c >= 0 ? String(cells[c] || '').trim().replace(/"/g, '') : '';
    }

    rows.push([
      id, name, val('hsd status'),
      // Math
      val('math attempts'),
      val('math prev date'),  val('math prev scale'),  val('math prev efl'),  val('math prev efl level'),
      val('math curr date'),  val('math curr scale'),  val('math curr efl'),  val('math curr efl level'),
      val('math best date'),  val('math best scale'),  val('math best efl'),  val('math best efl level'),
      val('math gain'),
      // Reading
      val('read attempts'),
      val('read prev date'),  val('read prev scale'),  val('read prev efl'),  val('read prev efl level'),
      val('read curr date'),  val('read curr scale'),  val('read curr efl'),  val('read curr efl level'),
      val('read best date'),  val('read best scale'),  val('read best efl'),  val('read best efl level'),
      val('read gain'),
      reportDate,
    ]);
  }
  return rows;
}

// Handles quoted fields and commas within quotes
function _splitCsvLine(line) {
  const result = [];
  let current  = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Sheet writers ─────────────────────────────────────────────
// Overwrites the TABE Data sheet with the latest upload
function _writeTABEDataSheet(hubSS, rows) {
  let sheet = hubSS.getSheetByName(SHEET_TABE);
  if (!sheet) {
    sheet = hubSS.insertSheet(SHEET_TABE);
  } else {
    sheet.clearContents();
  }
  const allRows = [TABE_HEADERS, ...rows];
  sheet.getRange(1, 1, allRows.length, allRows[0].length).setValues(allRows);
  sheet.getRange(1, 1, 1, TABE_HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#1f2937')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  Logger.log('TABE Data: wrote ' + rows.length + ' rows');
}

// Appends new test entries to TABE History (one row per subtest per student)
// Skips entries that already exist for the same student + subject + date.
function _appendTABEHistory(hubSS, rows) {
  let sheet = hubSS.getSheetByName(SHEET_TABE_HISTORY);
  if (!sheet) {
    sheet = hubSS.insertSheet(SHEET_TABE_HISTORY);
    sheet.appendRow(TABE_HISTORY_HEADERS);
    sheet.getRange(1, 1, 1, TABE_HISTORY_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#1f2937')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }

  // Build a set of existing entries to avoid duplicates
  const lastRow  = sheet.getLastRow();
  const existing = new Set();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 4).getValues().forEach(r => {
      existing.add(String(r[0]) + '||' + String(r[2]) + '||' + String(r[3]));
    });
  }

  // Subtest column indices within each data row (matching TABE_HEADERS order)
  // Math current: cols 8-11, Reading current: cols 22-25
  const SUBTESTS = [
    { subject: 'Math',    dateIdx: 8,  scaleIdx: 9,  eflIdx: 10, eflLevelIdx: 11 },
    { subject: 'Reading', dateIdx: 22, scaleIdx: 23, eflIdx: 24, eflLevelIdx: 25 },
  ];

  const toAppend = [];
  rows.forEach(row => {
    const id   = String(row[0] || '').trim();
    const name = String(row[1] || '').trim();
    SUBTESTS.forEach(({ subject, dateIdx, scaleIdx, eflIdx, eflLevelIdx }) => {
      const date = String(row[dateIdx] || '').trim();
      if (!date || !String(row[scaleIdx] || '').trim()) return;
      const key = id + '||' + subject + '||' + date;
      if (existing.has(key)) return;
      existing.add(key);
      toAppend.push([id, name, subject, date, row[scaleIdx], row[eflIdx], row[eflLevelIdx]]);
    });
  });

  if (!toAppend.length) { Logger.log('TABE History: no new entries to append'); return; }
  sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, 7).setValues(toAppend);
  Logger.log('TABE History: appended ' + toAppend.length + ' new entries');
}

// ── Cohort summary ────────────────────────────────────────────
// Computes aggregate TABE stats for the dashboard cohort card.
// Accepts the tabeData map from parseTABESheet().
function getTABECohortSummary(tabeData) {
  if (!tabeData || !Object.keys(tabeData).length) {
    return { totalStudents: 0, math: null, reading: null };
  }

  const students  = Object.values(tabeData);
  const mathGains = [];
  const readGains = [];
  const mathLevels = {};
  const readLevels = {};

  students.forEach(s => {
    if (s.math) {
      if (s.math.gain !== null && !isNaN(s.math.gain)) mathGains.push(s.math.gain);
      const lvl = s.math.current && s.math.current.eflLevel;
      if (lvl) mathLevels[lvl] = (mathLevels[lvl] || 0) + 1;
    }
    if (s.reading) {
      if (s.reading.gain !== null && !isNaN(s.reading.gain)) readGains.push(s.reading.gain);
      const lvl = s.reading.current && s.reading.current.eflLevel;
      if (lvl) readLevels[lvl] = (readLevels[lvl] || 0) + 1;
    }
  });

  function summarize(gains, levels) {
    if (!gains.length) return null;
    const avg      = gains.reduce((a, b) => a + b, 0) / gains.length;
    const improved = gains.filter(g => g > 0).length;
    return {
      count:         gains.length,
      avgGain:       +avg.toFixed(1),
      improvedCount: improved,
      improvedPct:   +((improved / gains.length) * 100).toFixed(1),
      levelCounts:   levels,
    };
  }

  return {
    totalStudents: students.length,
    math:    summarize(mathGains, mathLevels),
    reading: summarize(readGains, readLevels),
  };
}

// ── Scheduled snapshot ────────────────────────────────────────
// Appends the current TABE predictions to a history sheet
// for trend tracking. Called by a monthly trigger.
function snapshotTABEGainPredictions() {
  try {
    const hubSS     = SpreadsheetApp.openById(SS_HUB);
    const predSheet = hubSS.getSheetByName(SHEET_TABE_PREDICTIONS);
    if (!predSheet) { Logger.log('snapshotTABEGainPredictions: predictions sheet not found'); return; }

    let histSheet = hubSS.getSheetByName(SHEET_TABE_HISTORY);
    if (!histSheet) {
      histSheet = hubSS.insertSheet(SHEET_TABE_HISTORY);
      histSheet.appendRow(TABE_PREDICTIONS_HEADERS);
      histSheet.getRange(1, 1, 1, TABE_PREDICTIONS_HEADERS.length)
        .setFontWeight('bold')
        .setBackground('#1f2937')
        .setFontColor('#ffffff');
      histSheet.setFrozenRows(1);
    }

    const lastPredRow = predSheet.getLastRow();
    if (lastPredRow < 2) { Logger.log('snapshotTABEGainPredictions: no predictions to snapshot'); return; }

    const predRows = predSheet.getRange(2, 1, lastPredRow - 1, TABE_PREDICTIONS_HEADERS.length).getValues();
    if (!predRows.length) return;

    histSheet.getRange(histSheet.getLastRow() + 1, 1, predRows.length, predRows[0].length).setValues(predRows);
    Logger.log('snapshotTABEGainPredictions: appended ' + predRows.length + ' rows');
  } catch(e) {
    Logger.log('snapshotTABEGainPredictions error: ' + e.message);
  }
}

// ── Trigger management ────────────────────────────────────────
function installTABESnapshotTrigger() {
  removeTABESnapshotTrigger();
  ScriptApp.newTrigger('snapshotTABEGainPredictions')
    .timeBased()
    .onMonthDay(1)
    .atHour(5)
    .create();
  Logger.log('TABE snapshot trigger installed — runs on the 1st of each month at 5am.');
}

function removeTABESnapshotTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'snapshotTABEGainPredictions') ScriptApp.deleteTrigger(t);
  });
}

// ── TABE Gain Predictions ─────────────────────────────────────
// Reads TABE History sheet, computes weekly gain rate per student
// per subject using full test history, ranks by predicted weeks
// to reach next EFL level. Returns top N for each subject.
//
// Called directly by getLatestTABEGainSnapshot() below, and also
// by snapshotTABEGainPredictions() on the monthly trigger.
function getTABEGainPredictions(topN) {
  topN = topN || 10;
  try {
    const hubSS = SpreadsheetApp.openById(SS_HUB);
    const sheet = hubSS.getSheetByName(SHEET_TABE_HISTORY);
    if (!sheet) return { reading: [], math: [], error: 'TABE History sheet not found yet — upload TABE scores at least once.' };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { reading: [], math: [], error: 'No history recorded yet.' };

    const values = sheet.getRange(2, 1, lastRow - 1, TABE_HISTORY_HEADERS.length).getValues();

    // Group by student ID + subject
    const grouped = {};
    values.forEach(row => {
      const id      = String(row[0] || '').trim();
      const name    = String(row[1] || '').trim();
      const subject = String(row[2] || '').trim();
      const scale   = Number(row[4]);
      if (!id || !subject || isNaN(scale)) return;

      // Date column may be a Date object or string — normalise both to ms + string
      const rawDate = row[3];
      let dateMs = null;
      let dateStr = '';
      if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
        dateMs  = rawDate.getTime();
        dateStr = (rawDate.getMonth()+1) + '/' + rawDate.getDate() + '/' + rawDate.getFullYear();
      } else {
        dateStr = String(rawDate || '').trim();
        dateMs  = _tabeParseDate(dateStr);
      }
      if (!dateMs || !dateStr) return;

      const key = id + '||' + subject;
      if (!grouped[key]) grouped[key] = { id, name, subject, tests: [] };
      grouped[key].tests.push({ dateMs, date: dateStr, scale });
    });

    const results = { Reading: [], Math: [] };

    Object.values(grouped).forEach(g => {
      if (!TABE_THRESHOLDS[g.subject]) return;

      // Dedup by date+score
      const uniqueTests = [];
      const seen = new Set();
      g.tests.sort((a, b) => a.dateMs - b.dateMs);
      g.tests.forEach(t => {
        const k = t.dateMs + '|' + t.scale;
        if (seen.has(k)) return;
        seen.add(k);
        uniqueTests.push(t);
      });

      if (uniqueTests.length < 2) return;

      const first        = uniqueTests[0];
      const latest       = uniqueTests[uniqueTests.length - 1];
      const currentScale = latest.scale;
      const currentLevel = _tabeLevelForScore(g.subject, currentScale);
      if (!currentLevel) return;

      const nextThreshold = _tabeNextThreshold(g.subject, currentLevel);
      if (nextThreshold === null) return; // already Level 6

      const pointsToNext = nextThreshold - currentScale;
      if (pointsToNext <= 0) return;

      const totalDays  = (latest.dateMs - first.dateMs) / 86400000;
      const totalWeeks = totalDays / 7;
      if (totalWeeks <= 0) return;

      const totalGain  = latest.scale - first.scale;
      const weeklyRate = totalGain / totalWeeks;
      if (weeklyRate <= 0) return;

      const predictedWeeks = pointsToNext / weeklyRate;

      results[g.subject].push({
        id:             g.id,
        name:           g.name,
        subject:        g.subject,
        currentScale,
        currentLevel,
        nextLevel:      currentLevel + 1,
        pointsToNext,
        weeklyRate:     +weeklyRate.toFixed(2),
        predictedWeeks: +predictedWeeks.toFixed(1),
        testsOnFile:    uniqueTests.length,
        firstTestDate:  first.date,
        latestTestDate: latest.date,
        totalGainSoFar: totalGain,
        spanWeeks:      +totalWeeks.toFixed(1),
      });
    });

    results.Reading.sort((a, b) => a.predictedWeeks - b.predictedWeeks);
    results.Math.sort((a, b) => a.predictedWeeks - b.predictedWeeks);

    return {
      reading: results.Reading.slice(0, topN).map((s, i) => ({ ...s, rank: i + 1 })),
      math:    results.Math.slice(0, topN).map((s, i) => ({ ...s, rank: i + 1 })),
      error:   null,
    };

  } catch(e) {
    Logger.log('getTABEGainPredictions error: ' + e.message);
    return { reading: [], math: [], error: e.message };
  }
}

// ── EFL level helpers ─────────────────────────────────────────
function _tabeLevelForScore(subject, scale) {
  const bands = TABE_THRESHOLDS[subject];
  if (!bands) return null;
  for (let i = 0; i < bands.length; i++) {
    if (scale >= bands[i][0] && scale <= bands[i][1]) return i + 1;
  }
  if (scale > bands[bands.length - 1][1]) return bands.length;
  return null;
}

function _tabeNextThreshold(subject, currentLevel) {
  const bands = TABE_THRESHOLDS[subject];
  if (!bands || currentLevel >= bands.length) return null;
  return bands[currentLevel][0];
}

function _tabeParseDate(dateStr) {
  if (!dateStr) return null;
  // Handle Date objects directly
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr.getTime();
  const str = String(dateStr).trim();
  if (!str) return null;
  // M/D/YYYY or MM/DD/YYYY
  if (str.includes('/')) {
    const p = str.split('/');
    if (p.length === 3) {
      const d = new Date(parseInt(p[2]), parseInt(p[0]) - 1, parseInt(p[1]));
      if (!isNaN(d.getTime())) return d.getTime();
    }
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const p = str.split('-');
    const d = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
    if (!isNaN(d.getTime())) return d.getTime();
  }
  // Full date string fallback (e.g. "Thu Jun 25 2026 00:00:00 GMT-0500")
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback.getTime();
}

// ── Latest snapshot for UI ────────────────────────────────────
// Called via google.script.run.getLatestTABEGainSnapshot()
// Computes live from TABE History — no separate predictions sheet needed.
function getLatestTABEGainSnapshot() {
  try {
    const result = getTABEGainPredictions(10);
    return {
      reading:      result.reading || [],
      math:         result.math    || [],
      snapshotDate: _todayStr(),
      error:        result.error   || null,
    };
  } catch(e) {
    Logger.log('getLatestTABEGainSnapshot error: ' + e.message);
    return { reading: [], math: [], snapshotDate: null, error: e.message };
  }
}
// Detects CIS's fake-.xls-but-actually-HTML export format
function _looksLikeHtmlTable(str) {
  return /<html[\s>]|<table[\s>]/i.test(str.slice(0, 3000));
}

// Extracts table rows (array of cell-string arrays) from an HTML table export
function _parseHtmlTableRows(html) {
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  const tableHtml  = tableMatch ? tableMatch[1] : html;
  const rows = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(tableHtml)) !== null) {
    const cells = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(trMatch[1])) !== null) {
      let text = cellMatch[1].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '');
      cells.push(_decodeHtmlEntities(text).trim());
    }
    if (cells.some(c => c !== '')) rows.push(cells);
  }
  return rows;
}

function _decodeHtmlEntities(str) {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

// Legacy plain-CSV path, unchanged behavior — now returns array of arrays
function _parseDelimitedTextRows(csv) {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.map(l => _splitCsvLine(l));
}
// ── Debug ─────────────────────────────────────────────────────
function debugTABEGainPredictions() {
  const result = getTABEGainPredictions(10);
  if (result.error) { Logger.log('ERROR: ' + result.error); return; }
  Logger.log('=== TOP 10 READING ===');
  result.reading.forEach((s, i) =>
    Logger.log((i+1) + '. ' + s.name + ' — Level ' + s.currentLevel + ' (' + s.currentScale +
      ') → Level ' + s.nextLevel + ' | needs +' + s.pointsToNext +
      ' | rate: ' + s.weeklyRate + ' pts/wk | ~' + s.predictedWeeks + ' wks'));
  Logger.log('=== TOP 10 MATH ===');
  result.math.forEach((s, i) =>
    Logger.log((i+1) + '. ' + s.name + ' — Level ' + s.currentLevel + ' (' + s.currentScale +
      ') → Level ' + s.nextLevel + ' | needs +' + s.pointsToNext +
      ' | rate: ' + s.weeklyRate + ' pts/wk | ~' + s.predictedWeeks + ' wks'));
}
