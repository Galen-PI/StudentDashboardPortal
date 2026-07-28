// ===========
// TimeLog.gs — Weekly time log entry (Edgenuity paste) -> Vault
// ===========

// ── Entry point — called from the Time Log tab ────────────────
// Handles a paste covering ONE week or MANY months in exactly the
// same way — each week in the pasted text carries its own date
// range (Edgenuity's 'Week N: ...' header), so that's what decides
// which week each row belongs to, not the week the client happened
// to have selected in the picker. weekLabel (the picker's value) is
// no longer used to place data — kept as a parameter for now so the
// existing client call doesn't need to change, but every week
// actually written comes from parsing the paste itself.
function saveWeeklyTimeLog(studentId, weekLabel, rawLog, role) {
  _requirePermission(role || ROLES.ADMIN, 'edit_status');

  try {
    const id = String(studentId).trim();
    if (!id) return { success: false, error: 'Student ID is required.' };
    if (!rawLog || !rawLog.trim()) return { success: false, error: 'Paste a session log first.' };

    const parsed = _parseEdgenuityLog_(rawLog); // throws on unrecoverable parse problems — caught below

    // Read-only prep work, done BEFORE acquiring the lock below —
    // none of this writes anything, so it doesn't need exclusive
    // access, and doing it here means the lock is only held for the
    // actual sheet mutations, not for N reads of Weekly Hours History
    // (one per week in the paste).
    const prepared = parsed.weeks.map(w => {
      const assigned = _getAssignedHoursForWeek_(id, w.weekLabel);
      const weekDate = _parseLocalDate(w.weekLabel);
      const monthLabel = weekDate
        ? Utilities.formatDate(weekDate, Session.getScriptTimeZone(), 'MMMM yyyy')
        : '';
      return { w, assigned, monthLabel };
    });

    // Locked: even with targeted clearing (not a full-sheet
    // operation, see below), two concurrent saves to the exact same
    // student+week could still both scan-and-find 'no existing row'
    // and both append, leaving a duplicate. One lock covers every
    // week in this paste, since saving a multi-week paste is
    // logically one action.
    return _withLock(() => {
      const sheet = getVaultSheet_(VAULT_SHEET_PRODUCTIVITY);
      const numCols = VAULT_PRODUCTIVITY_HEADERS.length;
      let updatedBy = 'staff';
      try { updatedBy = Session.getActiveUser().getEmail() || 'staff'; } catch (e) {}

      // Clear just this student's rows for the weeks in THIS paste —
      // one read to find them, then only those specific rows get
      // touched. Productivity Data already has 1000+ rows across all
      // students, and Time Log saves happen constantly, so a full-
      // sheet clear+rewrite here (the old _deleteVaultRowsMatching_
      // call) was one of the most contended spots in the app — any
      // other staff member's unrelated save had to wait for a
      // multi-thousand-row rewrite to finish first.
      const targetWeeks = new Set(parsed.weeks.map(w => w.weekLabel));
      const lastRow = sheet.getLastRow();
      if (lastRow >= VAULT_DATA_START_ROW) {
        const existing = sheet.getRange(VAULT_DATA_START_ROW, 1, lastRow - VAULT_DATA_START_ROW + 1, 3).getValues();
        existing.forEach((row, i) => {
          if (String(row[0] || '').trim() === id && targetWeeks.has(String(row[2] || '').trim())) {
            sheet.getRange(VAULT_DATA_START_ROW + i, 1, 1, numCols).clearContent();
          }
        });
      }

      const newProdRows = prepared.map(p => [
        id, p.monthLabel, p.w.weekLabel,
        p.w.completedWork, p.w.idleTime, p.w.actualWorkedTime,
        p.assigned.assignedHours, p.assigned.source, 'staff_paste',
        new Date().toISOString(), updatedBy,
      ]);
      const firstNewRow = sheet.getLastRow() + 1;
      sheet.getRange(firstNewRow, 1, newProdRows.length, numCols).setValues(newProdRows);
      sheet.getRange(firstNewRow, 1, newProdRows.length, 1).setNumberFormat('@'); // studentId stays text

      const allCourses = prepared.filter(p => p.w.courses.length);
      if (allCourses.length) {
        _writeWeeklyCourseActivityBatch_(id, allCourses.map(p => ({ weekLabel: p.w.weekLabel, courses: p.w.courses })));
      }

      _clearDashboardCache();
      clearProductivityCache();

      const savedWeeks = prepared.map(p => ({
        weekLabel:           p.w.weekLabel,
        edgenuityStart:      p.w.edgenuityStart,
        edgenuityEnd:        p.w.edgenuityEnd,
        monthLabel:          p.monthLabel,
        completedWork:       p.w.completedWork,
        idleTime:            p.w.idleTime,
        actualWorkedTime:    p.w.actualWorkedTime,
        assignedHours:       p.assigned.assignedHours,
        assignedHoursSource: p.assigned.source,
        courses:             p.w.courses,
        courseCountMismatch: p.w.courseCountMismatch,
      }));

      return {
        success:    true,
        studentId:  id,
        weekCount:  savedWeeks.length,
        weeks:      savedWeeks,
      };
    });

  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Gets-or-creates Weekly Course Activity — brand new as of this
// feature, so no existing Vault copy will have it yet. Same pattern
// as _ensureVaultOverridesSheet_ (Datafetch.gs).
function _ensureVaultCourseActivitySheet_() {
  const ss = getVaultSpreadsheet_();
  let sheet = ss.getSheetByName(VAULT_SHEET_COURSE_ACTIVITY);
  if (!sheet) {
    sheet = ss.insertSheet(VAULT_SHEET_COURSE_ACTIVITY);
    sheet.appendRow(VAULT_COURSE_ACTIVITY_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function _ensureProductivityExclusionsSheet_() {
  const ss = getVaultSpreadsheet_();
  let sheet = ss.getSheetByName(VAULT_SHEET_PRODUCTIVITY_EXCLUSIONS);
  if (!sheet) {
    sheet = ss.insertSheet(VAULT_SHEET_PRODUCTIVITY_EXCLUSIONS);
    sheet.appendRow(VAULT_PRODUCTIVITY_EXCLUSIONS_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Marks (or clears) a single student+week as excluded from
// percentage/pacing calculations — for weeks a student was out sick,
// had an appointment, or worked on their high school outside their
// scheduled class time in a way that throws off the assigned-vs-worked
// percentage for that week. Doesn't touch the underlying logged data
// at all — the row still shows in the student's own Time Log, just
// tagged and left out of aggregates.
function setProductivityExclusion(studentId, weekLabel, reason, role) {
  _requirePermission(role || ROLES.ADMIN, 'manage_overrides');
  const id = String(studentId || '').trim();
  const wk = _toDateStr(weekLabel);
  if (!id || !wk) return { success: false, error: 'Student ID and week are required.' };

  return _withLock(() => {
    const sheet = _ensureProductivityExclusionsSheet_();
    const lastRow = sheet.getLastRow();
    let existingRowNum = null;
    if (lastRow >= VAULT_DATA_START_ROW) {
      const data = sheet.getRange(VAULT_DATA_START_ROW, 1, lastRow - VAULT_DATA_START_ROW + 1, 2).getValues();
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][0] || '').trim() === id && _toDateStr(data[i][1]) === wk) {
          existingRowNum = VAULT_DATA_START_ROW + i;
          break;
        }
      }
    }

    // Empty reason means "clear the exclusion" — remove the row
    // rather than leave a reason-less exclusion sitting around.
    const cleanReason = String(reason || '').trim();
    if (!cleanReason) {
      if (existingRowNum) sheet.getRange(existingRowNum, 1, 1, VAULT_PRODUCTIVITY_EXCLUSIONS_HEADERS.length).clearContent();
      clearProductivityCache();
      return { success: true, cleared: true };
    }

    const rowValues = [id, wk, cleanReason, Session.getActiveUser().getEmail() || '', new Date().toISOString()];
    if (existingRowNum) {
      sheet.getRange(existingRowNum, 1, 1, VAULT_PRODUCTIVITY_EXCLUSIONS_HEADERS.length).setValues([rowValues]);
    } else {
      const newRow = sheet.getLastRow() + 1;
      sheet.getRange(newRow, 1, 1, VAULT_PRODUCTIVITY_EXCLUSIONS_HEADERS.length).setValues([rowValues]);
      sheet.getRange(newRow, 1, 1, 2).setNumberFormat('@'); // studentId + weekLabel columns
    }
    clearProductivityCache();
    return { success: true, cleared: false };
  });
}

// Writes one row per course for this student+week into Weekly Course
// Activity, replacing any existing rows for the same student+week
// first (re-pasting a corrected log shouldn't leave old per-course
// rows sitting alongside new ones). Called from inside
// saveWeeklyTimeLog's existing lock — not locked here itself, since
// a second lock acquisition on the same request would just wait on
// itself.
// Writes course-activity rows for EVERY week in one save, in a
// single read-filter-write pass — same fix as the Productivity Data
// write above. weekedCourses is [{weekLabel, courses}, ...], one
// entry per week that actually had course data.
function _writeWeeklyCourseActivityBatch_(studentId, weekedCourses) {
  const sheet = _ensureVaultCourseActivitySheet_();
  const numCols = VAULT_COURSE_ACTIVITY_HEADERS.length;
  const targetWeeks = new Set(weekedCourses.map(wc => wc.weekLabel));

  const lastRow = sheet.getLastRow();
  if (lastRow >= VAULT_DATA_START_ROW) {
    const existing = sheet.getRange(VAULT_DATA_START_ROW, 1, lastRow - VAULT_DATA_START_ROW + 1, 2).getValues();
    existing.forEach((row, i) => {
      if (String(row[0] || '').trim() === studentId && targetWeeks.has(String(row[1] || '').trim())) {
        sheet.getRange(VAULT_DATA_START_ROW + i, 1, 1, numCols).clearContent();
      }
    });
  }

  const now = new Date().toISOString();
  const rows = [];
  weekedCourses.forEach(wc => {
    wc.courses.forEach(c => {
      rows.push([studentId, wc.weekLabel, c.courseName, c.activityHours, c.reviewHours, c.activitiesCompleted, now]);
    });
  });
  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, numCols).setValues(rows);
  }
}

// ── Read every week on file for one student, newest first ─────
function getStudentTimeLog(studentId) {
  try {
    const rows = readVaultRowsForStudent_(VAULT_SHEET_PRODUCTIVITY, VAULT_PRODUCTIVITY_HEADERS, studentId);
    const courseRows = _readCourseActivityForStudent_(studentId);

    // Same defense _resolveAssignedHours_ already uses for exactly
    // this problem: a weekLabel cell that ever got auto-converted to
    // a real Sheets Date (instead of staying plain 'yyyy-MM-dd' text)
    // fails a naive String() comparison silently — normWeek re-derives
    // the ISO string from a Date if needed, or falls back to a plain
    // trimmed string otherwise.
    const normWeek = v => _toDateStr(v) || String(v || '').trim();

    const coursesByWeek = {};
    courseRows.forEach(r => {
      const wl = normWeek(r.weekLabel);
      if (!wl) return;
      if (!coursesByWeek[wl]) coursesByWeek[wl] = [];
      coursesByWeek[wl].push({
        courseName:          String(r.courseName || '').trim(),
        activityHours:       Number(r.activityHours) || 0,
        reviewHours:         Number(r.reviewHours) || 0,
        activitiesCompleted: Number(r.activitiesCompleted) || 0,
      });
    });

    const weeks = rows
      .map(r => ({
        weekLabel:        normWeek(r.weekLabel),
        monthLabel:       String(r.monthLabel || '').trim(),
        completedWork:    Number(r.completedWork) || 0,
        idleTime:         Number(r.idleTime) || 0,
        actualWorkedTime: Number(r.actualWorkedTime) || 0,
        assignedHours:    Number(r.assignedHours) || 0,
        entryMethod:      String(r.entryMethod || '').trim(),
        lastUpdated:      r.lastUpdated instanceof Date ? r.lastUpdated.toISOString() : (r.lastUpdated || null),
        courses:          [],
      }))
      .filter(w => w.weekLabel)
      .sort((a, b) => b.weekLabel.localeCompare(a.weekLabel));

    weeks.forEach(w => { w.courses = coursesByWeek[w.weekLabel] || []; });

    return { success: true, studentId: String(studentId).trim(), weeks };

  } catch (err) {
    return { success: false, error: (err && err.message) || String(err) || 'Unknown error in getStudentTimeLog.' };
  }
}

// Weekly Course Activity is created lazily on first save (see
// _ensureVaultCourseActivitySheet_) — if nobody's pasted a log with
// course data yet, the sheet doesn't exist at all, and
// readVaultRowsForStudent_ would throw trying to read it. This
// checks existence first so a brand-new Vault copy (or one where
// this feature just hasn't been used yet) still shows Time Log
// history fine, just with no course breakdowns.
function _readCourseActivityForStudent_(studentId) {
  const ss = getVaultSpreadsheet_();
  const sheet = ss.getSheetByName(VAULT_SHEET_COURSE_ACTIVITY);
  if (!sheet) return [];
  return readVaultRowsForStudent_(VAULT_SHEET_COURSE_ACTIVITY, VAULT_COURSE_ACTIVITY_HEADERS, studentId);
}

// ── Parse a pasted Edgenuity session log ───────────────────────
// Splits on Edgenuity's own 'Week N: MM/DD/YYYY - MM/DD/YYYY  Week
// Totals:HH:MM:SS  <activities>' header lines — these appear for
// every week in the paste, whether it's a single week or a multi-
// month range, so this same logic handles both without needing a
// separate code path. Confirmed against real multi-month paste data
// (July 2026): Edgenuity's week start date is always a SUNDAY, while
// every other join key in this app (Weekly Hours History,
// Productivity Data, Academic Snapshots) is Monday-anchored — so
// each week's label is computed as Edgenuity's start date + 1 day,
// not used as-is. Getting this wrong would silently misalign every
// week by one day against the rest of the app with no error thrown.
function _parseEdgenuityLog_(log) {
  const text = String(log || '');

  const weekHeaderRegex = /Week\s+\d+:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*Week Totals:\s*(\d{1,2}:\d{2}:\d{2})\s*(\d+)/g;
  const headers = [...text.matchAll(weekHeaderRegex)];
  if (!headers.length) {
    throw new Error('Could not find a "Week N: <start> - <end>  Week Totals:" line in the pasted log. Make sure the full session log was copied.');
  }

  const weeks = headers.map((h, i) => {
    const bodyStart = h.index;
    const bodyEnd   = (i + 1 < headers.length) ? headers[i + 1].index : text.length;
    const body      = text.slice(bodyStart, bodyEnd);

    const edgenuityStart = _parseEdgenuitySlashDate_(h[1]);
    if (!edgenuityStart) throw new Error('Could not parse the week start date "' + h[1] + '" in the pasted log.');
    const monday = new Date(edgenuityStart.getTime());
    monday.setDate(monday.getDate() + 1); // Edgenuity Sun-start -> this app's Monday-anchored label
    const weekLabel = _toDateStr(monday);

    const totalSeconds = _hmsToSeconds(h[3]);
    const weekActivityTotal = parseInt(h[4], 10) || 0;

    const idleMatches = [...body.matchAll(/Idle Time:\s*(\d{1,2}:\d{2}:\d{2})/g)];
    let idleSeconds = 0;
    idleMatches.forEach(m => { idleSeconds += _hmsToSeconds(m[1]); });
    if (idleSeconds > totalSeconds) {
      throw new Error(
        'Week of ' + h[1] + ': idle time (' + _secondsToHms_(idleSeconds) + ') exceeds total time (' + _secondsToHms_(totalSeconds) + ') — check the pasted log.'
      );
    }

    const completedWork    = +(totalSeconds / 3600).toFixed(2);
    const idleTime         = +(idleSeconds / 3600).toFixed(2);
    const actualWorkedTime = +Math.max(0, completedWork - idleTime).toFixed(2);

    // COURSES WORKED ON — one entry per course touched in a given
    // session, possibly several sessions per day and several courses
    // per session. The leading '*' before a course name is
    // INCONSISTENT in real Edgenuity output — some entries have it,
    // some don't (confirmed in real data) — so it's optional in the
    // regex and any leading '*' is stripped from the captured name
    // afterward rather than trusted to be excluded by the regex
    // itself (a `\*?` right before the capture group turned out not
    // to reliably exclude it, likely due to how the engine picks its
    // leftmost successful match position — stripping in code
    // sidesteps the ambiguity entirely).
    const courseRegex = /\*?\s*([^\n\r]+?)\s*[\r\n]+\s*Activity Time:\s*(\d{1,2}:\d{2}:\d{2})\s*[\r\n]+\s*Review Time:\s*(\d{1,2}:\d{2}:\d{2})\s*[\r\n]+\s*(\d+)/g;
    const byName = {};
    let courseActivitySum = 0;
    [...body.matchAll(courseRegex)].forEach(m => {
      const name = m[1].replace(/^\*\s*/, '').trim();
      const activityHours = +(_hmsToSeconds(m[2]) / 3600).toFixed(2);
      const reviewHours    = +(_hmsToSeconds(m[3]) / 3600).toFixed(2);
      const count = parseInt(m[4], 10) || 0;
      courseActivitySum += count;
      if (!byName[name]) byName[name] = { courseName: name, activityHours: 0, reviewHours: 0, activitiesCompleted: 0 };
      byName[name].activityHours     = +(byName[name].activityHours + activityHours).toFixed(2);
      byName[name].reviewHours       = +(byName[name].reviewHours + reviewHours).toFixed(2);
      byName[name].activitiesCompleted += count;
    });
    const courses = Object.values(byName);

    // Doesn't block the save — hours are the primary thing this
    // function exists to capture. Surfaced back to the caller so the
    // UI can flag it per-week instead of silently trusting an
    // incomplete course parse for that one week.
    const courseCountMismatch = courses.length > 0 && courseActivitySum !== weekActivityTotal;

    return {
      weekLabel,
      edgenuityStart: h[1],
      edgenuityEnd:   h[2],
      completedWork, idleTime, actualWorkedTime,
      courses, courseCountMismatch,
      weekActivityTotal, courseActivitySum,
    };
  });

  return { weeks };
}

// Parses Edgenuity's 'MM/DD/YYYY' date format — distinct from
// _parseLocalDate (Helpers.gs), which only handles this app's own
// 'yyyy-MM-dd' convention.
function _parseEdgenuitySlashDate_(mdY) {
  const parts = String(mdY || '').split('/');
  if (parts.length !== 3) return null;
  const m = parseInt(parts[0], 10), d = parseInt(parts[1], 10), y = parseInt(parts[2], 10);
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

function _secondsToHms_(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

// Replaces the old W1-4 rotation-bucket guess entirely. Priority:
//   1. A real uploaded schedule exists for the requested week ->
//      use it directly. Ground truth, no guessing.
//   2. No upload yet, but it's the CURRENT week and still within
//      the Monday/Tuesday grace window -> honestly 'no_data_yet',
//      not a guess dressed up as an answer.
//   3. No upload for an OLDER week that was genuinely missed ->
//      look at up to 4 real prior weeks; only apply a pattern if
//      at least 3 of them agree (all academic-with-similar-hours,
//      or all zero/trade). Otherwise 'uncertain' rather than force
//      a guess onto noisy history.
//   4. No history at all (brand new student) -> nothing to show;
//      'no_data_yet', same as case 2 — there's genuinely nothing
//      to guess from yet, not a wrong answer to hide.
// Thin wrapper for single-student use (TimeLog.gs, at time-log-paste
// time) — reads this one student's history, then delegates to the
// pure resolver below. NOT used by the dashboard rebuild anymore;
// see _resolveAssignedHours_ + ProfilesVault.gs for the live,
// no-extra-reads version used there.
function _getAssignedHoursForWeek_(studentId, weekLabel) {
  const historyRows = readVaultRowsForStudent_(VAULT_SHEET_WEEKLY_HOURS_HISTORY, VAULT_WEEKLY_HOURS_HISTORY_HEADERS, studentId);
  return _resolveAssignedHours_(historyRows, weekLabel);
}

// Pure decision logic — takes an ALREADY-LOADED array of one
// student's Weekly Hours History rows (no sheet reading in here at
// all), so the dashboard rebuild can call this once per student
// using data it already read in bulk, instead of this function doing
// its own per-student sheet read like the old version did.
//   1. Real upload exists for this week -> use it directly.
//   2. No upload yet, current week, still in the grace window ->
//      honestly 'no_data_yet'.
//   3. No upload for an older week that was genuinely missed ->
//      look at up to 4 real prior weeks; only apply a pattern if at
//      least 3 agree. Otherwise 'uncertain'.
//   4. No history at all -> 'no_data_yet' — nothing to guess from.
function _resolveAssignedHours_(historyRows, weekLabel) {
  const isTrue = v => v === true || String(v).toUpperCase() === 'TRUE';
  // Handles BOTH a plain 'yyyy-MM-dd' string and a raw Sheets Date
  // object (which happens if a cell ever lost its text formatting —
  // see the fix in _writeWeeklyHoursHistoryBatch_). Without this,
  // a corrupted weekLabel cell fails every exact-string comparison
  // below silently, with no visible sign anything's wrong.
  const normWeek = v => _toDateStr(v) || String(v || '').trim();
  const targetWeek = normWeek(weekLabel);

  const thisWeekRow = historyRows.find(r => normWeek(r.weekLabel) === targetWeek);
  if (thisWeekRow) {
    return {
      assignedHours: Number(thisWeekRow.academicHoursThisWeek) || 0,
      source: 'real_upload',
      hasTrade: isTrue(thisWeekRow.hasTradeThisWeek),
    };
  }

  const isCurrentWeek = targetWeek === _currentWeekMondayLabel_();
  if (isCurrentWeek && _withinScheduleGraceWindow_()) {
    return { assignedHours: 0, source: 'no_data_yet', hasTrade: null };
  }

  // Fallback: look at up to 4 real prior weeks (most recent first),
  // requiring real per-week rows, not guesses of guesses.
  const priorWeeks = historyRows
    .filter(r => r.source === 'real_upload' && normWeek(r.weekLabel) < targetWeek)
    .sort((a, b) => normWeek(b.weekLabel).localeCompare(normWeek(a.weekLabel)))
    .slice(0, 4);

  if (!priorWeeks.length) {
    return { assignedHours: 0, source: 'no_data_yet', hasTrade: null }; // nothing to fall back to — genuinely no data, not a guess
  }

  const academicWeeks = priorWeeks.filter(r => Number(r.academicHoursThisWeek) > 0);
  const tradeWeeks    = priorWeeks.filter(r => Number(r.academicHoursThisWeek) === 0);

  if (academicWeeks.length >= 3) {
    const avgHours = academicWeeks.reduce((s, r) => s + Number(r.academicHoursThisWeek), 0) / academicWeeks.length;
    return { assignedHours: Math.round(avgHours * 100) / 100, source: 'fallback_pattern', hasTrade: null };
  }
  if (tradeWeeks.length >= 3) {
    // Majority vote on whether those zero-academic weeks were
    // genuinely trade weeks vs. genuinely unassigned (e.g. MyPace) —
    // both show academicHoursThisWeek === 0, only hasTradeThisWeek
    // tells them apart.
    const tradeCount = tradeWeeks.filter(r => isTrue(r.hasTradeThisWeek)).length;
    return { assignedHours: 0, source: 'fallback_pattern', hasTrade: tradeCount > tradeWeeks.length / 2 };
  }

  // History is genuinely mixed (e.g. 2 academic / 2 trade) — no
  // confident pattern, say so rather than force a guess.
  return { assignedHours: 0, source: 'uncertain', hasTrade: null };
}

// Refreshes stale assignedHours/assignedHoursSource on EXISTING
// Productivity Data rows — for a row saved before any schedule
// existed for that week (frozen at assignedHours: 0, source:
// 'no_data_yet' or 'uncertain'), this re-runs the same
// _resolveAssignedHours_ lookup saveWeeklyTimeLog uses at paste time,
// now that a real schedule may be on file (e.g. after a backlog
// schedule upload for historical weeks). completedWork/idleTime/
// actualWorkedTime are never touched — those came from the original
// Time Log paste and were already correct; this only repairs the one
// column that depends on a schedule existing, which time logs don't
// control. Pass studentIds to limit the scan, or omit/leave empty to
// check every student on file.
function repairAssignedHoursForExistingWeeks(studentIds, role) {
  _requirePermission(role || ROLES.ADMIN, 'manage_overrides');

  return _withLock(() => {
    const sheet = getVaultSheet_(VAULT_SHEET_PRODUCTIVITY);
    const lastRow = sheet.getLastRow();
    if (lastRow < VAULT_DATA_START_ROW) return { success: true, updated: 0, scanned: 0 };

    const numCols = VAULT_PRODUCTIVITY_HEADERS.length;
    const data = sheet.getRange(VAULT_DATA_START_ROW, 1, lastRow - VAULT_DATA_START_ROW + 1, numCols).getValues();
    const idFilter = (studentIds && studentIds.length) ? new Set(studentIds.map(id => String(id).trim())) : null;

    // Weekly Hours History read ONCE and grouped by student, so
    // _resolveAssignedHours_ (a pure function, no sheet access of its
    // own) can be called per row without a separate read each time —
    // this can scan every Productivity Data row without the cost
    // scaling by number-of-rows-times-a-fresh-read.
    const historyRows = readVaultSheetAsObjects_(VAULT_SHEET_WEEKLY_HOURS_HISTORY, VAULT_WEEKLY_HOURS_HISTORY_HEADERS);
    const historyByStudent = {};
    historyRows.forEach(r => {
      const sid = String(r.studentId || '').trim();
      if (!sid) return;
      (historyByStudent[sid] = historyByStudent[sid] || []).push(r);
    });

    const assignedColIdx = VAULT_PRODUCTIVITY_HEADERS.indexOf('assignedHours');
    const sourceColIdx   = VAULT_PRODUCTIVITY_HEADERS.indexOf('assignedHoursSource');
    let updated = 0;

    data.forEach((row, i) => {
      const sid = String(row[0] || '').trim();
      if (!sid) return;
      if (idFilter && !idFilter.has(sid)) return;
      const weekLabel = String(row[2] || '').trim();
      if (!weekLabel) return;

      const resolved = _resolveAssignedHours_(historyByStudent[sid] || [], weekLabel);
      // Only overwrite when there's now a REAL schedule on file —
      // never replace an existing value with another guess
      // ('fallback_pattern'/'uncertain'), only with a confirmed
      // upload.
      if (resolved.source !== 'real_upload') return;

      const oldAssigned = Number(row[assignedColIdx]) || 0;
      const oldSource    = String(row[sourceColIdx] || '').trim();
      if (resolved.assignedHours === oldAssigned && resolved.source === oldSource) return; // already correct

      const sheetRow = VAULT_DATA_START_ROW + i;
      sheet.getRange(sheetRow, assignedColIdx + 1, 1, 2).setValues([[resolved.assignedHours, resolved.source]]);
      updated++;
    });

    _clearDashboardCache();
    clearProductivityCache();

    return { success: true, updated, scanned: data.length };
  });
}

// Grace window for the current week only: through Tuesday, a
// missing upload is just "not here yet," not a fallback situation.
function _withinScheduleGraceWindow_() {
  const day = new Date().getDay(); // 0=Sun, 1=Mon, 2=Tue, ...
  return day === 1 || day === 2 || day === 0; // Mon, Tue, or weekend rollover from a fresh Monday not yet uploaded
}

// Diagnostic — run this manually from the Apps Script editor (select
// this function in the dropdown, click Run) and read the result in
// View > Executions. Traces every step of the This Week resolution
// for one student, since the client-side symptom (wrong badge) could
// come from several different places and this pins down exactly
// which one.
function debugThisWeekResolution(studentId) {
  const id = String(studentId || '').trim();
  Logger.log('=== This Week diagnostic for studentId: ' + id + ' ===');

  const historyRows = readVaultRowsForStudent_(VAULT_SHEET_WEEKLY_HOURS_HISTORY, VAULT_WEEKLY_HOURS_HISTORY_HEADERS, id);
  Logger.log('Weekly Hours History rows found: ' + historyRows.length);
  historyRows
    .sort((a, b) => String(b.weekLabel).localeCompare(String(a.weekLabel)))
    .forEach(r => {
      Logger.log('  weekLabel=' + r.weekLabel + ' (type: ' + typeof r.weekLabel + ')' // 'object' here means the cell got silently converted to a real Date — the bug this function was built to catch
        + ' | academicHoursThisWeek=' + r.academicHoursThisWeek + ' (type: ' + typeof r.academicHoursThisWeek + ')'
        + ' | hasTradeThisWeek=' + r.hasTradeThisWeek + ' (type: ' + typeof r.hasTradeThisWeek + ')'
        + ' | source=' + r.source
        + ' | lastUpdated=' + r.lastUpdated);
    });

  const currentMonday = _currentWeekMondayLabel_();
  Logger.log('Server current-week Monday key: ' + currentMonday);
  Logger.log('Within Mon/Tue grace window right now: ' + _withinScheduleGraceWindow_());

  const result = _resolveAssignedHours_(historyRows, currentMonday);
  Logger.log('_resolveAssignedHours_ returned: ' + JSON.stringify(result));

  // Also show exactly what the fallback path sees, using the same
  // normalized comparison the real resolver uses.
  const normWeek = v => _toDateStr(v) || String(v || '').trim();
  const priorWeeks = historyRows
    .filter(r => r.source === 'real_upload' && normWeek(r.weekLabel) < currentMonday)
    .sort((a, b) => normWeek(b.weekLabel).localeCompare(normWeek(a.weekLabel)))
    .slice(0, 4);
  Logger.log('Prior real weeks considered for fallback (' + priorWeeks.length + '): '
    + priorWeeks.map(r => r.weekLabel + '=' + r.academicHoursThisWeek).join(', '));

  Logger.log('=== End diagnostic ===');
  return result;
}

// Runs the REAL rebuild's exact data path for one student — NOT the
// standalone resolver call above, which reads Weekly Hours History
// fresh and directly. This instead replicates exactly what
// _rebuildDashboardData (Code.gs) + buildStudentProfilesFromVault
// (ProfilesVault.gs) do: bulk-read + group ALL sheets the same way,
// then compute this one student's resolvedThisWeek/thisWeekWorkedHours
// from that grouped data — so if the real dashboard is showing
// something different than debugThisWeekResolution found, this will
// show WHERE in that pipeline the two diverge, instead of guessing.
function debugRealPipelineThisWeek(studentId) {
  const id = String(studentId || '').trim();
  Logger.log('=== REAL PIPELINE diagnostic for studentId: ' + id + ' ===');

  const weeklyHoursHistoryRows = readVaultSheetAsObjects_(VAULT_SHEET_WEEKLY_HOURS_HISTORY, VAULT_WEEKLY_HOURS_HISTORY_HEADERS);
  const weeklyHoursHistoryByStudentId = {};
  weeklyHoursHistoryRows.forEach(row => {
    const sid = String(row.studentId || '').trim();
    if (!sid) return;
    if (!weeklyHoursHistoryByStudentId[sid]) weeklyHoursHistoryByStudentId[sid] = [];
    weeklyHoursHistoryByStudentId[sid].push(row);
  });

  Logger.log('Total Weekly Hours History rows read (whole sheet): ' + weeklyHoursHistoryRows.length);
  Logger.log('Total distinct students grouped: ' + Object.keys(weeklyHoursHistoryByStudentId).length);

  const studentWeeklyHistory = weeklyHoursHistoryByStudentId[id] || [];
  Logger.log('Rows found for THIS student via the real grouping: ' + studentWeeklyHistory.length);
  studentWeeklyHistory.forEach(r => {
    Logger.log('  weekLabel=' + r.weekLabel + ' (type: ' + typeof r.weekLabel + ') | academicHoursThisWeek=' + r.academicHoursThisWeek + ' | source=' + r.source);
  });

  const currentMonday = _currentWeekMondayLabel_();
  Logger.log('Server current-week Monday key: ' + currentMonday);

  const resolvedThisWeek = _resolveAssignedHours_(studentWeeklyHistory, currentMonday);
  Logger.log('resolvedThisWeek (via real grouping path): ' + JSON.stringify(resolvedThisWeek));

  // Now check the Productivity Data side, exactly like
  // _buildAcademicFromCourseData_/the top-level thisWeekWorkedHours
  // computation both do.
  const productivityRows = readVaultRowsForStudent_(VAULT_SHEET_PRODUCTIVITY, VAULT_PRODUCTIVITY_HEADERS, id);
  Logger.log('Productivity Data rows found for this student: ' + productivityRows.length);
  const sortedWeeks = productivityRows
    .filter(p => p.weekLabel)
    .sort((a, b) => String(b.weekLabel).localeCompare(String(a.weekLabel)));
  const thisWeekRow = sortedWeeks.find(w => String(w.weekLabel) === currentMonday) || null;
  Logger.log('Productivity Data row matching current week (' + currentMonday + '): ' + (thisWeekRow ? JSON.stringify(thisWeekRow) : 'NONE FOUND'));
  const thisWeekWorkedHours = thisWeekRow ? (Number(thisWeekRow.actualWorkedTime) || 0) : null;
  Logger.log('thisWeekWorkedHours (real computation): ' + thisWeekWorkedHours + ' (type: ' + typeof thisWeekWorkedHours + ')');

  Logger.log('=== End real pipeline diagnostic ===');
  return { resolvedThisWeek, thisWeekWorkedHours };
}

// Calls the REAL, live getStudentProfile() — the actual function the
// deployed app uses to serve a profile to the client — and logs
// exactly what it returns for this student's "this week" fields.
// Every other diagnostic so far has REPRODUCED the pipeline's logic
// in a standalone way; this is the one thing that hadn't been
// directly checked: whether the live, client-facing function itself
// returns the correct values, as opposed to a parallel diagnostic
// construction that might not perfectly match what's actually
// deployed and running.
function debugLiveProfileThisWeek(studentId) {
  const id = String(studentId || '').trim();
  Logger.log('=== LIVE getStudentProfile diagnostic for studentId: ' + id + ' ===');
  const result = getStudentProfile(id);
  if (result.error) {
    Logger.log('getStudentProfile returned an error: ' + result.error);
    return result;
  }
  const p = result.profile;
  if (!p) {
    Logger.log('getStudentProfile returned no matching profile for this ID.');
    return result;
  }
  Logger.log('p.thisWeekAssignedHours = ' + p.thisWeekAssignedHours + ' (type: ' + typeof p.thisWeekAssignedHours + ')');
  Logger.log('p.thisWeekSource        = ' + p.thisWeekSource + ' (type: ' + typeof p.thisWeekSource + ')');
  Logger.log('p.thisWeekWorkedHours   = ' + p.thisWeekWorkedHours + ' (type: ' + typeof p.thisWeekWorkedHours + ')');
  Logger.log('p.thisWeekHasTrade      = ' + p.thisWeekHasTrade + ' (type: ' + typeof p.thisWeekHasTrade + ')');
  Logger.log('p.hasAcademic           = ' + p.hasAcademic);
  Logger.log('p.academic exists       = ' + (!!p.academic));
  if (p.academic) {
    Logger.log('p.academic.thisWeekSource      = ' + p.academic.thisWeekSource);
    Logger.log('p.academic.thisWeekHours       = ' + p.academic.thisWeekHours);
  }
  Logger.log('=== End live profile diagnostic ===');
  return p;
}
function _runDebugThisWeek() {
  debugThisWeekResolution('2037298');
}
