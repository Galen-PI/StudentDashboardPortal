// ============================================================
// Parsers.gs — Sheet data parsers
// Each function accepts a values[][] array (from getDataRange().getValues()) and returns structured data. No spreadsheet I/O happens here.
// ============================================================

// ── Name Mapping ──────────────────────────────────────────────
function parseNameMapping(values) {
  if (!values || values.length < 2) return [];
  const maps = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const id               = String(row[0] || '').trim();
    const masterSheet      = String(row[1] || '').trim();
    const tradesName       = String(row[2] || '').trim();
    const academicName     = String(row[3] || '').trim();
    const tradeComplete    = String(row[4] || '').trim().toLowerCase();
    const academicComplete = String(row[5] || '').trim().toLowerCase();
    if (!id && !masterSheet && !tradesName && !academicName) continue;
    maps.push({
      id, masterSheet, tradesName, academicName,
      tradeCompleteFlag:    ['yes','true','1','complete'].includes(tradeComplete),
      academicCompleteFlag: ['yes','true','1','complete'].includes(academicComplete),
    });
  }
  Logger.log('Name Mapping: ' + maps.length + ' rows');
  return maps;
}

// ── Academic (HS + HiSET) ─────────────────────────────────────
// type: 'hs' | 'hiset'
function parseAcademicSheet(values, type) {
  if (!values || values.length < DATA_START_ROW) return [];
  const rows = [];
  for (let i = DATA_START_ROW - 1; i < values.length; i++) {
    const row         = values[i];
    const studentName = String(row[1] || '').trim(); // col B
    if (!studentName || studentName.toLowerCase() === 'student') continue;
    const base = {
      type,
      student:        studentName,
      pace:           row[2],
      progress:       row[3],
      percent:        _toPercent(row[4]),
      hours:          _toHours(row[5]),
      start:          _toDateStr(row[6]),
      graduation:     _toDateStr(row[7]),
      daysLeft:       _toNumber(row[8]),
      gCredits:       row[9],
      credits:        _toNumber(row[10]),
      next:           row[11],
      targetDate:     _toDateStr(row[12]),
      targetDaysLeft: _toNumber(row[13]),
      thisWeekHours:  _toHoursOrNWH(row[14]),
    };
    if (type === 'hs') {
      rows.push({
        ...base,
        lastWeekHours:     _toHours(row[15]),
        lastMonth:         _toHours(row[16]),
        lastMonthAssigned: _toHours(row[17]),
        thisWeekCredits:   _toNumber(row[18]),
      });
    } else {
      rows.push({ ...base, worked: _toHoursOrText(row[14]) });
    }
  }
  Logger.log(type + ': ' + rows.length + ' rows');
  return rows;
}

// ── Trades ────────────────────────────────────────────────────
function parseTradesSheet(values) {
  if (!values || values.length < TRADES_DATA_START_ROW) return [];
  const rows = [];
  for (let i = TRADES_DATA_START_ROW - 1; i < values.length; i++) {
    const row         = values[i];
    const studentName = String(row[1] || '').trim();
    if (!studentName || studentName.toLowerCase() === 'student') continue;
    rows.push({
      student:          studentName,
      tarName:          String(row[2]  || '').trim(),
      paceGap:          _toNumber(row[3]),
      status:           String(row[4]  || '').trim(),
      enrollment:       String(row[5]  || '').trim(),
      progress:         String(row[6]  || '').trim(),
      staffPct:         _toPercent(row[7]),
      studentPct:       _toPercent(row[8]),
      overallPct:       _toPercent(row[9]),
      etarStart:        _toDateStr(row[10]),
      earliestEnd:      _toDateStr(row[11]),
      daysToEarliest:   _toNumber(row[12]),
      etarProjectedEnd: _toDateStr(row[13]),
      daysLeft:         _toNumber(row[14]),
      weeklyPctChange:  _toWeeklyChange(row[15]),
    });
  }
  Logger.log('Trades: ' + rows.length + ' rows');
  return rows;
}

// ── Trade Monthly ─────────────────────────────────────────────
function parseTradeMonthlySheet(values) {
  if (!values || values.length < TRADE_MONTHLY_START) return [];

  const BLOCK_WIDTH = 7;
  const lastCol     = values[0] ? values[0].length : 0;
  if (lastCol < 1) return [];

  const headerRow = values[0];
  const months    = [];
  for (let colIdx = 0; colIdx < lastCol; colIdx += BLOCK_WIDTH) {
    const rawLabel = headerRow[colIdx];
    let monthLabel = '';
    if (rawLabel instanceof Date && !isNaN(rawLabel.getTime())) {
      monthLabel = Utilities.formatDate(rawLabel, Session.getScriptTimeZone(), 'MMM yyyy');
    } else {
      monthLabel = String(rawLabel || '').trim();
    }
    if (!monthLabel) break;
    months.push({ label: monthLabel, startCol: colIdx });
  }
  if (!months.length) return [];

  const results   = {};
  const dataRows  = values.slice(TRADE_MONTHLY_START - 1);
  const numMonths = months.length;

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    for (let m = 0; m < numMonths; m++) {
      const { label, startCol } = months[m];
      const studentName = String(row[startCol] || '').trim();
      if (!studentName) continue;

      const trade = String(row[startCol + 1] || '').trim();
      const key   = _norm(studentName) + '||' + _norm(trade);
      if (!results[key]) results[key] = { student: studentName, trade, months: [] };

      const statusRaw = String(row[startCol + 6] || '').trim();
      const endRaw    = row[startCol + 4];
      const gainRaw   = row[startCol + 5];
      if (!statusRaw && endRaw === '' && gainRaw === '') continue;

      results[key].months.push({
        month:          label,
        addedPostFirst: statusRaw.toLowerCase().includes('added post first'),
        overallGain:    _toPercent(gainRaw),
        endOverallPct:  _toPercent(endRaw),
      });
    }
  }

  const output = Object.values(results);
  Logger.log('Trade Monthly: ' + output.length + ' student-trade records');
  return output;
}

// ── Time ──────────────────────────────────────────────────────
function parseTimeSheet(values) {
  if (!values || values.length < TIME_DATA_START_ROW) return [];

  const firstRow    = values[0];
  const lastCol     = firstRow ? firstRow.length : 0;
  const numTimeCols = lastCol - 1;
  if (numTimeCols < 1) return [];

  // Build column metadata once
  const colMeta    = new Array(numTimeCols);
  let currentMonth = '';
  for (let i = 0; i < numTimeCols; i++) {
    const m = String((values[0][i + 1]) || '').trim();
    if (m) currentMonth = m;
    const week = String((values[1] ? values[1][i + 1] : '') || '').trim() || ('Wk ' + ((i % 4) + 1));
    colMeta[i] = { month: currentMonth, week, key: currentMonth + ' ' + week };
  }

  const NWH_SET = new Set(['NWH', 'NMH', 'No Weekly Hours']);
  const allRows = {};

  for (let i = TIME_DATA_START_ROW - 1; i < values.length; i++) {
    const row  = values[i];
    const name = String(row[0] || '').trim();
    if (!name) continue;

    let totalSeconds = 0;
    const sheetSecs  = {};

    const rowLen = Math.min(row.length - 1, numTimeCols);
    for (let c = 0; c < rowLen; c++) {
      const cell = row[c + 1];
      if (!cell && cell !== 0) continue;

      const str = String(cell).trim();
      if (NWH_SET.has(str)) continue;

      let secs = 0;
      if (cell instanceof Date) {
        secs = (cell.getHours() * 3600) + (cell.getMinutes() * 60) + cell.getSeconds();
      } else if (str.includes(':')) {
        secs = _hmsToSeconds(str);
      } else {
        const n = Number(str);
        if (!isNaN(n) && n > 0) secs = n * 3600;
      }
      if (secs <= 0) continue;

      totalSeconds += secs;
      const { key } = colMeta[c];
      sheetSecs[key] = (sheetSecs[key] || 0) + secs;
    }

    const totalHours = +(totalSeconds / 3600).toFixed(2);
    if (totalHours <= 0) continue;

    const sheets = {};
    for (const k in sheetSecs) {
      sheets[k] = +(sheetSecs[k] / 3600).toFixed(2);
    }

    if (!allRows[name]) {
      allRows[name] = { student: name, sheets, totalHours };
    } else {
      for (const k in sheets) {
        allRows[name].sheets[k] = (allRows[name].sheets[k] || 0) + sheets[k];
      }
      allRows[name].totalHours = +(allRows[name].totalHours + totalHours).toFixed(2);
    }
  }

  return Object.values(allRows).map(r => ({ ...r, totalHours: +r.totalHours.toFixed(2) }));
}

// ── Overrides ─────────────────────────────────────────────────
function parseOverridesSheet(values) {
  if (!values || values.length < 2) return [];
  const result = [];
  for (let i = 1; i < values.length; i++) {
    const row       = values[i];
    const studentId = String(row[0] || '').trim();
    const type      = String(row[1] || '').trim();
    if (!studentId || !type) continue;
    result.push({
      studentId,
      type,
      value:  row[2],
      note:   String(row[3] || '').trim(),
      setBy:  String(row[4] || '').trim(),
      date:   row[5],
    });
  }
  return result;
}

// ── Schedule ──────────────────────────────────────────────────
// Returns a map of studentId -> count of scheduled academic periods this week
function parseScheduleSheet(values) {
  if (!values || values.length < 2) return {};
  const ACADEMIC_NAMES = ['HSD 2', 'HSD3', 'HSE/HSD1'];
  const VALID_PERIODS  = {
    M:  [1, 2, 3, 5, 6],
    T:  [1, 2, 3, 5, 6, 7],
    W:  [1, 2, 3, 5, 6],
    TH: [1, 2, 3, 5, 6, 7],
    F:  [1, 2, 3, 5, 6, 7],
  };
  const result = {};
  for (let i = 1; i < values.length; i++) {
    const row       = values[i];
    const studentId = String(row[2] || '').trim();
    if (!studentId) continue;
    let schedule = {};
    try { schedule = JSON.parse(String(row[3] || '{}')); } catch(e) { continue; }
    let academicCount = 0;
    Object.entries(VALID_PERIODS).forEach(([day, validPeriods]) => {
      validPeriods.forEach(periodNum => {
        const entry = (schedule['Period ' + periodNum] || {})[day];
        if (!entry) return;
        if (ACADEMIC_NAMES.some(n => (entry.class || '').toLowerCase().includes(n.toLowerCase()))) {
          academicCount++;
        }
      });
    });
    result[studentId] = academicCount;
  }
  Logger.log('Schedule data: ' + Object.keys(result).length + ' students');
  return result;
}

// ── TABE ──────────────────────────────────────────────────────
// Returns a map: studentId -> { name, hsdStatus, math, reading, reportDate }
function parseTABESheet(values) {
  if (!values || values.length < 2) return {};
  const result = {};
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const id  = String(row[0] || '').trim();
    if (!id) continue;
    const math    = _tabeReadSubtest(row, 3);
    const reading = _tabeReadSubtest(row, 17);
    if (math || reading) {
      result[id] = {
        name:       String(row[1]  || '').trim(),
        hsdStatus:  String(row[2]  || '').trim(),
        math,
        reading,
        reportDate: String(row[31] || '').trim(),
      };
    }
  }
  Logger.log('TABE: loaded ' + Object.keys(result).length + ' student records');
  return result;
}

// Reads one math or reading subtest block from a TABE sheet row
// startIdx is the column index of the "attempts" cell for that subtest
function _tabeReadSubtest(row, startIdx) {
  const attempts = parseInt(row[startIdx], 10);
  if (!attempts || isNaN(attempts)) return null;

  const prevDate  = _tabeFormatDate(row[startIdx + 1]);
  const prevScale = parseInt(row[startIdx + 2], 10);
  const prevEFL   = parseInt(row[startIdx + 3], 10);
  const prevEFLL  = String(row[startIdx + 4] || '').trim();

  const currDate  = _tabeFormatDate(row[startIdx + 5]);
  const currScale = parseInt(row[startIdx + 6], 10);
  const currEFL   = parseInt(row[startIdx + 7], 10);
  const currEFLL  = String(row[startIdx + 8] || '').trim();

  const bestDate  = _tabeFormatDate(row[startIdx + 9]);
  const bestScale = parseInt(row[startIdx + 10], 10);
  const bestEFL   = parseInt(row[startIdx + 11], 10);
  const bestEFLL  = String(row[startIdx + 12] || '').trim();

  const gainRaw = row[startIdx + 13];
  const gain    = (gainRaw !== '' && gainRaw !== null && gainRaw !== undefined)
    ? parseInt(gainRaw, 10) : null;

  if (!currDate || isNaN(currScale)) return null;

  return {
    attempts,
    current:  { date: currDate,  scale: currScale,  efl: isNaN(currEFL)  ? null : currEFL,  eflLevel: currEFLL  },
    previous: prevDate && !isNaN(prevScale)
      ? { date: prevDate, scale: prevScale, efl: isNaN(prevEFL) ? null : prevEFL, eflLevel: prevEFLL }
      : null,
    best:     { date: bestDate,  scale: bestScale,  efl: isNaN(bestEFL)  ? null : bestEFL,  eflLevel: bestEFLL  },
    gain:     isNaN(gain) ? null : gain,
  };
}

// Formats a date value from a TABE sheet cell as M/D/YYYY string
function _tabeFormatDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return (val.getMonth() + 1) + '/' + val.getDate() + '/' + val.getFullYear();
  }
  return String(val).trim();
}

// ── Student Course Data ───────────────────────────────────────
// Returns a map: academicName -> courseData object
function parseStudentCourseData(values) {
  if (!values || values.length < 2) return {};
  const result = {};
  for (let i = 1; i < values.length; i++) {
    const row  = values[i];
    const name = String(row[0] || '').trim();
    if (!name) continue;
    result[name] = {
      remainingCredits:  _toNumber(row[1]) ?? 0,
      remainingHours:    _toNumber(row[2]) ?? 0,
      courseCountLeft:   _toNumber(row[3]) ?? 0,
      nextCourse:        String(row[4] || '').trim(),
      nextCourseHours:   _toNumber(row[5]) ?? 0,
      nextCourseTarget: (() => {
        const raw = row[6];
        if (!raw) return '';
        if (raw instanceof Date && !isNaN(raw.getTime())) {
          return (raw.getMonth() + 1) + '/' + raw.getDate() + '/' + raw.getFullYear();
        }
        return String(raw).trim();
      })(),
      totalCredits:  _toNumber(row[7]) ?? 0,
      totalHours:    _toNumber(row[8]) ?? 0,
      completionPct: _toNumber(row[9]) ?? 0,
      lastSynced:    String(row[10] || '').trim(),
    };
  }
  Logger.log('Student Course Data: loaded ' + Object.keys(result).length + ' records');
  return result;
}
