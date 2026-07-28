// ============================================================
// TradeSnapshotsIngest.gs — Auto-generated Weekly/Monthly Trade Snapshots
// ------------------------------------------------------------
const TRADE_PERCENT_IGNORE_THRESHOLD = 25.0;

// cadence: 'weekly' | 'monthly'
// dateOverride: optional 'yyyy-MM-dd' string — defaults to today (run this ON the actual Friday / last day of month)
function generateTradeSnapshot(cadence, dateOverride, employeeId) {
  try {
    if (cadence !== 'weekly' && cadence !== 'monthly') {
      Logger.log('generateTradeSnapshot: invalid or missing cadence ("' + cadence + '") — must be "weekly" or "monthly". ' +
        'If you ran this directly from the editor with no arguments, use debugTradeSnapshot() instead.');
      return { success: false, error: 'Cadence must be "weekly" or "monthly".' };
    }

    const snapshotDate = dateOverride
      ? _normVaultDateField_(dateOverride, 'yyyy-MM-dd')
      : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

    const nameMap = readVaultSheetAsObjects_(VAULT_SHEET_NAME_MAPPING, VAULT_NAME_MAPPING_HEADERS);
    const activeIds = new Set(
      nameMap
        .filter(m => m.active === true || String(m.active).trim().toUpperCase() === 'TRUE')
        .map(m => String(m.studentId || '').trim())
    );

    const tradeOverviewRows = readVaultSheetAsObjects_(VAULT_SHEET_TRADE_OVERVIEW, VAULT_TRADE_OVERVIEW_HEADERS);

    const existingSnaps = readVaultSheetAsObjects_(VAULT_SHEET_TRADE_SNAPSHOTS, VAULT_TRADE_SNAPSHOT_HEADERS)
      .filter(r => String(r.cadence || '').trim().toLowerCase() === cadence)
      .map(r => Object.assign({}, r, { snapshotDate: _normVaultDateField_(r.snapshotDate, 'yyyy-MM-dd') }));

    // Most recent PRIOR snapshot per studentId+trade (strictly before today's target date)
    const priorByKey = {};
    existingSnaps.forEach(r => {
      const id    = String(r.studentId || '').trim();
      const trade = String(r.trade || '').trim();
      if (!id || !trade) return;
      const key = id + '||' + trade;
      if (r.snapshotDate >= snapshotDate) return; // skip today's or future rows
      if (!priorByKey[key] || r.snapshotDate > priorByKey[key].snapshotDate) {
        priorByKey[key] = r;
      }
    });

    // Already-run guard: don't create a duplicate row if this cadence+date
    // already exists for a given studentId+trade
    const alreadyDoneToday = new Set(
      existingSnaps
        .filter(r => r.snapshotDate === snapshotDate)
        .map(r => String(r.studentId || '').trim() + '||' + String(r.trade || '').trim())
    );

    const rowsToWrite = [];
    let skippedInactive = 0, skippedNoData = 0, skippedAlreadyDone = 0, newBaselines = 0;

    tradeOverviewRows.forEach(row => {
      const id    = String(row.studentId || '').trim();
      const trade = String(row.trade || '').trim();
      if (!id || !trade) return;
      if (!activeIds.has(id)) { skippedInactive++; return; }

      const key = id + '||' + trade;
      if (alreadyDoneToday.has(key)) { skippedAlreadyDone++; return; }

      const overallPercent = row.overallPercent !== '' && row.overallPercent !== undefined && row.overallPercent !== null
        ? Number(row.overallPercent) : null;
      if (overallPercent === null || isNaN(overallPercent)) { skippedNoData++; return; }

      const prior = priorByKey[key];

      let gain = null;
      let status;

      if (!prior) {
        status = 'New';
        newBaselines++;
      } else {
        const priorPercent = Number(prior.overallPercent);
        const change = overallPercent - priorPercent; // positive = progress (percent went up)

        if (Math.abs(change) > TRADE_PERCENT_IGNORE_THRESHOLD) {
          status = 'Ignored: ' + Math.abs(change).toFixed(1) + ' point change is over ' + TRADE_PERCENT_IGNORE_THRESHOLD.toFixed(1);
          gain = null;
        } else if (change === 0) {
          status = 'No change';
          gain = 0;
        } else {
          gain = +change.toFixed(2);
          status = gain > 0
            ? gain + '% gained'
            : Math.abs(gain) + '% lost';
        }
      }

      rowsToWrite.push({
        studentId: id,
        trade: trade,
        cadence: cadence,
        snapshotDate: snapshotDate,
        overallPercent: overallPercent,
        gain: gain,
        status: status,
      });
    });

    if (rowsToWrite.length) {
      // Locked: this runs off a cadence trigger (weekly/monthly) — an
      // overlapping run for the same cadence could otherwise append
      // duplicate snapshot rows for the same student+trade+date.
      _withLock(() => {
        appendVaultRows_(VAULT_SHEET_TRADE_SNAPSHOTS, VAULT_TRADE_SNAPSHOT_HEADERS, rowsToWrite);
      });
    }

    return {
      success: true,
      cadence,
      snapshotDate,
      written: rowsToWrite.length,
      newBaselines,
      skippedInactive,
      skippedNoData,
      skippedAlreadyDone,
    };
  } catch(e) {
    Logger.log('generateTradeSnapshot error: ' + e.message);
    return { success: false, error: e.message };
  }
}

function _runWeeklyTradeSnapshot_() {
  generateTradeSnapshot('weekly', null, 'trigger');
}
function _runMonthlyTradeSnapshot_() {
  generateTradeSnapshot('monthly', null, 'trigger');
}
function installTradeSnapshotTriggers() {
  removeTradeSnapshotTriggers();
  ScriptApp.newTrigger('_runWeeklyTradeSnapshot_')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(16)
    .create();
  ScriptApp.newTrigger('_runMonthlyTradeSnapshot_')
    .timeBased()
    .onMonthDay(1)
    .atHour(5)
    .create();
  Logger.log('Trade Snapshot triggers installed — weekly every Friday at 4pm, monthly on the 1st at 5am.');
}
function removeTradeSnapshotTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => {
    const fn = t.getHandlerFunction();
    if (fn === '_runWeeklyTradeSnapshot_' || fn === '_runMonthlyTradeSnapshot_') {
      ScriptApp.deleteTrigger(t);
    }
  });
}
