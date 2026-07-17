// ============================================================
// Parsers.gs — Sheet data parsers
// ============================================================

// ── TABE ──────────────────────────────────────────────────────
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

// ── Schedule — VAULT PATH ───────────────────────────────────────
function parseVaultScheduleSheet(values) {
  if (!values || values.length < 2) return {};
  const ACADEMIC_NAMES = SCHEDULE_ACADEMIC_NAMES;
  const VALID_PERIODS  = SCHEDULE_VALID_PERIODS;
  const result = {};
  for (let i = 1; i < values.length; i++) {
    const row       = values[i];
    const studentId = String(row[0] || '').trim();
    const slot      = String(row[2] || '').trim().toLowerCase();
    if (!studentId || slot !== 'current') continue;
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
  Logger.log('Schedule data (vault): ' + Object.keys(result).length + ' students');
  return result;
}
