// ============================================================
// Cohorts.gs — Monthly progress cohort summaries
// ============================================================

// ── Month-label normalizer ─────────────────────────────────────
function _normMonthLabel(label) {
  const MONTH_ABBR = {
    january:   'jan', february: 'feb', march:     'mar', april:   'apr',
    may:       'may', june:     'jun', july:      'jul', august:  'aug',
    september: 'sep', october:  'oct', november:  'nov', december:'dec',
  };
  const parts = String(label || '').toLowerCase().trim().split(/\s+/);
  if (parts.length !== 2) return String(label || '').toLowerCase().replace(/\s+/g, '');
  const month = MONTH_ABBR[parts[0]] || parts[0].slice(0, 3);
  return month + parts[1];
}

// ── HS Monthly Credits — parse + match + summarize in one pass ──
function buildHSMonthlyCohort(values, nameMap) {
  const empty = { byStudent: {}, cohort: [] };
  if (!values || values.length < 3) return empty;

  try {
    const idByName = {};
    (nameMap || []).forEach(m => {
      if (!m.id) return;
      [m.masterSheet, m.academicName, m.tradesName].forEach(n => {
        const key = _normLoose(n);
        if (key && !idByName[key]) idByName[key] = m.id;
      });
    });

    const lastCol = values[0] ? values[0].length : 0;
    const headerRow = values[0];
    const blocks = [];
    for (let col = 0; col < lastCol; col += 7) {
      const monthVal = headerRow[col + 1];
      if (!monthVal) break;
      let monthLabel = '';
      if (monthVal instanceof Date && !isNaN(monthVal.getTime())) {
        monthLabel = Utilities.formatDate(monthVal, Session.getScriptTimeZone(), 'MMM yyyy');
      } else {
        monthLabel = String(monthVal).trim();
      }
      if (!monthLabel) break;
      blocks.push({
        monthLabel,
        monthKey:    _normMonthLabel(monthLabel),
        nameIdx: col,
        snapshotIdx: col + 1,
        startIdx: col + 2,
        endIdx: col + 3,
        gainedIdx: col + 4,
      });
    }
    if (!blocks.length) return empty;

    const currentMonthKey = _normMonthLabel(
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM yyyy')
    );
    const byStudent = {};
    const dataRows  = values.slice(2);
    dataRows.forEach(row => {
      blocks.forEach(b => {
        const blockName = String(row[b.nameIdx] || '').trim();
        if (!blockName) return;

        const id = idByName[_normLoose(blockName)];
        if (!id) return;

        if (!byStudent[id]) byStudent[id] = { id, name: blockName, monthsByKey: {} };

        const snapshotRaw = row[b.snapshotIdx];
        if (String(snapshotRaw || '').trim().toLowerCase() === 'removed') return;

        const startCredits = _toNumber(row[b.startIdx]);
        const endRaw       = row[b.endIdx];
        const endCredits   = _toNumber(endRaw);
        const endMissing   = endCredits === null || endRaw === '';
        const isCurrentMonth = b.monthKey === currentMonthKey;
        const inProgress   = isCurrentMonth && endMissing;
        const gained = (!inProgress && !endMissing) ? _toNumber(row[b.gainedIdx]) : null;

        const snapshotDate = snapshotRaw instanceof Date
          ? (snapshotRaw.getMonth() + 1) + '/' + snapshotRaw.getDate() + '/' + snapshotRaw.getFullYear()
          : String(snapshotRaw || '').trim();

        byStudent[id].monthsByKey[b.monthKey] = {
          month: b.monthLabel,
          monthKey: b.monthKey,
          snapshotDate,
          startCredits,
          endCredits:    inProgress ? null : endCredits,
          creditsGained: gained,
          inProgress,
        };
      });
    });

    const monthOrder = blocks.map(b => b.monthKey);
    const finalByStudent = {};
    Object.values(byStudent).forEach(s => {
      const months = monthOrder.map(k => s.monthsByKey[k]).filter(Boolean);
      if (!months.length) return;
      const completed = months.filter(m => !m.inProgress && m.creditsGained !== null);
      const totalCreditsGained = +completed.reduce((sum, m) => sum + m.creditsGained, 0).toFixed(1);
      const last = months[months.length - 1];
      finalByStudent[s.id] = {
        id: s.id,
        name: s.name,
        months,
        totalCreditsGained,
        latestCredits: last.endCredits ?? last.startCredits,
        earliestCredits: months[0].startCredits,
      };
    });

    const cohort = blocks.map(b => {
      const entries = Object.values(finalByStudent)
        .map(s => s.months.find(m => m.monthKey === b.monthKey))
        .filter(Boolean);
      const completed  = entries.filter(m => !m.inProgress && m.creditsGained !== null);
      const gains = completed.map(m => m.creditsGained);
      const avgGained = gains.length ? +(gains.reduce((a, v) => a + v, 0) / gains.length).toFixed(1) : null;
      const totalGained = +gains.reduce((a, v) => a + v, 0).toFixed(1);
      return {
        month: b.monthLabel,
        studentCount:   entries.length,
        completedCount: completed.length,
        avgGained,
        totalGained,
      };
    }).filter(m => m.studentCount > 0);

    Logger.log('HS Monthly Cohort: ' + Object.keys(finalByStudent).length + ' students matched, ' + cohort.length + ' months');
    return { byStudent: finalByStudent, cohort };

  } catch(e) {
    Logger.log('buildHSMonthlyCohort error: ' + e.message);
    return empty;
  }
}

// ── Trade Monthly % Gain cohort summary ──────────────────────
function getTradeMonthlyCohortSummary(tradeMonthlyData) {
  if (!tradeMonthlyData || !tradeMonthlyData.length) return [];
  const monthMap = {};
  tradeMonthlyData.forEach(record => {
    (record.months || []).forEach(m => {
      if (m.addedPostFirst) return;
      if (m.overallGain === null || m.overallGain === undefined) return;
      if (!monthMap[m.month]) monthMap[m.month] = { month: m.month, entries: [] };
      monthMap[m.month].entries.push({
        name: record.student,
        trade: record.trade,
        overallGain: m.overallGain,
        endPct: m.endOverallPct,
      });
    });
  });
  return Object.values(monthMap).filter(m => m.entries.length > 0).map(m => {
    const gains       = m.entries.map(e => e.overallGain);
    const avgGain      = gains.length ? +(gains.reduce((a, b) => a + b, 0) / gains.length).toFixed(1) : null;
    const stalledCount = gains.filter(v => v < 3).length;
    return {
      month: m.month,
      studentCount: m.entries.length,
      avgGain,
      stalledCount,
      stalledPct: m.entries.length ? +((stalledCount / m.entries.length) * 100).toFixed(1) : null,
    };
  });
}

// ============================================================
// VAULT PATH — HS Monthly cohort
// ------------------------------------------------------------
function buildHSMonthlyCohortFromVault_(academicSnapshotRows) {
  const empty = { byStudent: {}, cohort: [] };
  if (!academicSnapshotRows || !academicSnapshotRows.length) return empty;

  try {
    const currentMonthKey = _normMonthLabel(
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM yyyy')
    );

    const byStudentRaw = {};
    academicSnapshotRows.forEach(row => {
      if (String(row.cadence || '').trim().toLowerCase() !== 'monthly') return;
      const id = String(row.studentId || '').trim();
      if (!id) return;
      (byStudentRaw[id] = byStudentRaw[id] || []).push(row);
    });

    const finalByStudent = {};
    const monthEntries   = {}; // monthKey -> [{ month, creditsGained, inProgress }]

    Object.entries(byStudentRaw).forEach(([id, rows]) => {
      rows.sort((a, b) => String(a.snapshotDate || '') < String(b.snapshotDate || '') ? -1 : 1);

      const months = rows.map(row => {
        const dateStr = String(row.snapshotDate || '');
        const dateObj = _parseLocalDate(dateStr.slice(0, 10)) || new Date(dateStr);
        const monthLabel = !isNaN(dateObj.getTime())
          ? Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'MMM yyyy')
          : dateStr;
        const monthKey = _normMonthLabel(monthLabel);
        const isCurrentMonth = monthKey === currentMonthKey;
        const isNew = String(row.status || '').trim().toLowerCase() === 'new';  
        const inProgress = isCurrentMonth;
        const endCredits    = inProgress ? null : _toNumber(row.creditsEarned);
        const creditsGained = (inProgress || isNew) ? null : _toNumber(row.gain);
        const startCredits  = (endCredits !== null && creditsGained !== null)
          ? +(endCredits - creditsGained).toFixed(1)
          : null;
        if (!monthEntries[monthKey]) monthEntries[monthKey] = [];
        monthEntries[monthKey].push({ month: monthLabel, inProgress, creditsGained });
        return { month: monthLabel, monthKey, snapshotDate: dateStr, startCredits, endCredits, creditsGained, inProgress };
      });
      if (!months.length) return;
      const completed = months.filter(m => !m.inProgress && m.creditsGained !== null);
      const totalCreditsGained = +completed.reduce((sum, m) => sum + m.creditsGained, 0).toFixed(1);
      const last = months[months.length - 1];
      finalByStudent[id] = {
        id, name: null,
        months, totalCreditsGained,
        latestCredits:   last.endCredits ?? last.startCredits,
        earliestCredits: months[0].startCredits,
      };
    });
    const cohort = Object.entries(monthEntries).map(([monthKey, entries]) => {
      const completed  = entries.filter(e => !e.inProgress && e.creditsGained !== null);
      const gains       = completed.map(e => e.creditsGained);
      const avgGained   = gains.length ? +(gains.reduce((a, v) => a + v, 0) / gains.length).toFixed(1) : null;
      const totalGained = +gains.reduce((a, v) => a + v, 0).toFixed(1);
      return {
        month:          entries[0] ? entries[0].month : monthKey,
        studentCount:   entries.length,
        completedCount: completed.length,
        avgGained,
        totalGained,
      };
    }).filter(m => m.studentCount > 0)
      .sort((a, b) => new Date(a.month) - new Date(b.month));
    Logger.log('HS Monthly Cohort (vault): ' + Object.keys(finalByStudent).length + ' students, ' + cohort.length + ' months');
    return { byStudent: finalByStudent, cohort };
  } catch(e) {
    Logger.log('buildHSMonthlyCohortFromVault_ error: ' + e.message);
    return empty;
  }
}
// =========
// VAULT PATH — Trade Monthly cohort
// ---------
function reshapeTradeSnapshotsForCohort_(tradeSnapshotRows, nameMap) {
  const nameById = {};
  (nameMap || []).forEach(m => {
    if (m.studentId) nameById[String(m.studentId).trim()] = m.masterName || m.studentId;
  });
  const currentMonthKey = _normMonthLabel(
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM yyyy')
  );
  const byKey = {}; (tradeSnapshotRows || []).forEach(row => {
    if (String(row.cadence || '').trim().toLowerCase() !== 'monthly') return;
    const sid   = String(row.studentId || '').trim();
    const trade = String(row.trade || '').trim();
    if (!sid || !trade) return;
    const dateStr = String(row.snapshotDate || '');
    const dateObj = _parseLocalDate(dateStr.slice(0, 10)) || new Date(dateStr);
    const monthLabel = !isNaN(dateObj.getTime())
      ? Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'MMM yyyy')
      : dateStr;
    const monthKey = _normMonthLabel(monthLabel);
    const isCurrentMonth = monthKey === currentMonthKey;
    const isNew = String(row.status || '').trim().toLowerCase() === 'new';
    const key = sid + '||' + trade;
    if (!byKey[key]) byKey[key] = { student: nameById[sid] || sid, trade, months: [] };
    byKey[key].months.push({
      month:          monthLabel,
      addedPostFirst: isNew,
      inProgress:     isCurrentMonth,
      overallGain:    (isCurrentMonth || isNew) ? null : (row.gain !== undefined && row.gain !== '' ? Number(row.gain) : null),
      endOverallPct:  isCurrentMonth ? null : (row.overallPercent !== undefined && row.overallPercent !== '' ? Number(row.overallPercent) : null),
    });
  });
  return Object.values(byKey);
}
function getTradeMonthlyCohortSummaryFromVault_(tradeSnapshotRows, nameMap) {
  const reshaped = reshapeTradeSnapshotsForCohort_(tradeSnapshotRows, nameMap);
  return getTradeMonthlyCohortSummary(reshaped); // unchanged, reused as-is
}
