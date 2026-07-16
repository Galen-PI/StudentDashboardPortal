// ============================================================
// AcademicCreditsIngest.gs — Auto-generated Weekly/Monthly Academic Snapshots
// ------------------------------------------------------------
// Reads each active student's CURRENT remainingCredits directly from
// Student Course Data (live, synced automatically), compares it to
// their most recent prior Academic Snapshots row of the same cadence,
// computes gain/status itself, and appends one new row per student.
// No external report or paste-in required — this IS the snapshot.
// ============================================================

const ACADEMIC_CREDITS_IGNORE_THRESHOLD = 5.0;

// cadence: 'weekly' | 'monthly'
// dateOverride: optional 'yyyy-MM-dd' string — defaults to today (run this ON the actual Friday / last day of month)
function generateAcademicSnapshot(cadence, dateOverride, employeeId) {
  try {
    if (cadence !== 'weekly' && cadence !== 'monthly') {
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

    // Course data is now computed LIVE from Transcript Rows,
    // matching the same change made in Code.gs -- Student Course
    // Data is no longer synced or read anywhere.
    const allTranscriptRows = readVaultSheetAsObjects_(VAULT_SHEET_TRANSCRIPT_ROWS, VAULT_TRANSCRIPT_HEADERS);
    const transcriptRowsByStudent = {};
    allTranscriptRows.forEach(row => {
      const id = String(row.studentId || '').trim();
      if (!id) return;
      if (!transcriptRowsByStudent[id]) transcriptRowsByStudent[id] = [];
      transcriptRowsByStudent[id].push(row);
    });
    const courseData = Object.keys(transcriptRowsByStudent).map(id => {
      const computed = _computeCourseDataFromVaultRows_(transcriptRowsByStudent[id]);
      computed.studentId = id;
      return computed;
    });

    const existingSnaps = readVaultSheetAsObjects_(VAULT_SHEET_ACADEMIC_SNAPSHOTS, VAULT_ACADEMIC_SNAPSHOT_HEADERS)
      .filter(r => String(r.cadence || '').trim().toLowerCase() === cadence)
      .map(r => Object.assign({}, r, { snapshotDate: _normVaultDateField_(r.snapshotDate, 'yyyy-MM-dd') }));

    // Most recent PRIOR snapshot per student (strictly before today's target date)
    const priorByStudent = {};
    existingSnaps.forEach(r => {
      const id = String(r.studentId || '').trim();
      if (r.snapshotDate >= snapshotDate) return; // skip today's or future rows
      if (!priorByStudent[id] || r.snapshotDate > priorByStudent[id].snapshotDate) {
        priorByStudent[id] = r;
      }
    });

    // Already-run guard: don't create a duplicate row if this cadence+date already exists for a student
    const alreadyDoneToday = new Set(
      existingSnaps.filter(r => r.snapshotDate === snapshotDate).map(r => String(r.studentId || '').trim())
    );

    const rowsToWrite = [];
    let skippedInactive = 0, skippedNoData = 0, skippedAlreadyDone = 0, newBaselines = 0;

    courseData.forEach(cd => {
      const id = String(cd.studentId || '').trim();
      if (!id) return;
      if (!activeIds.has(id)) { skippedInactive++; return; }
      if (alreadyDoneToday.has(id)) { skippedAlreadyDone++; return; }

      const remaining = cd.remainingCredits !== '' && cd.remainingCredits !== undefined && cd.remainingCredits !== null
        ? Number(cd.remainingCredits) : null;
      if (remaining === null || isNaN(remaining)) { skippedNoData++; return; }

      const prior = priorByStudent[id];

      let gain = null;
      let status;

      if (!prior) {
        status = 'New';
        newBaselines++;
      } else {
        const priorRemaining = Number(prior.creditsRemaining);
        const change = remaining - priorRemaining; // positive = remaining WENT UP (lost progress)

        if (Math.abs(change) > ACADEMIC_CREDITS_IGNORE_THRESHOLD) {
          status = 'Ignored: ' + Math.abs(change).toFixed(1) + ' credit change is over ' + ACADEMIC_CREDITS_IGNORE_THRESHOLD.toFixed(1);
          gain = null;
        } else if (change === 0) {
          status = 'No change';
          gain = 0;
        } else {
          gain = +(-change).toFixed(2); // positive = progress (fewer remaining)
          status = gain > 0
            ? gain + ' fewer credit(s) remaining'
            : Math.abs(gain) + ' credit(s) added';
        }
      }

      rowsToWrite.push({
        studentId: id,
        cadence: cadence,
        snapshotDate: snapshotDate,
        creditsRemaining: remaining,
        gain: gain,
        status: status,
      });
    });

    if (rowsToWrite.length) {
      appendVaultRows_(VAULT_SHEET_ACADEMIC_SNAPSHOTS, VAULT_ACADEMIC_SNAPSHOT_HEADERS, rowsToWrite);
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
    Logger.log('generateAcademicSnapshot error: ' + e.message);
    return { success: false, error: e.message };
  }
}

function _runWeeklyAcademicSnapshot_() {
  generateAcademicSnapshot('weekly', null, 'trigger');
}
function _runMonthlyAcademicSnapshot_() {
  generateAcademicSnapshot('monthly', null, 'trigger');
}
function installAcademicSnapshotTriggers() {
  removeAcademicSnapshotTriggers();
  ScriptApp.newTrigger('_runWeeklyAcademicSnapshot_')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(16)
    .create();
  ScriptApp.newTrigger('_runMonthlyAcademicSnapshot_')
    .timeBased()
    .onMonthDay(1)
    .atHour(5)
    .create();
  Logger.log('Academic Snapshot triggers installed — weekly every Friday at 4pm, monthly on the 1st at 5am.');
}
function removeAcademicSnapshotTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => {
    const fn = t.getHandlerFunction();
    if (fn === '_runWeeklyAcademicSnapshot_' || fn === '_runMonthlyAcademicSnapshot_') {
      ScriptApp.deleteTrigger(t);
    }
  });
}
