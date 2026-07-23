// ============================================================
// CreditReport.gs — Weekly Credit Report Snapshot
// ============================================================

function getWeeklyCreditReport(fridayLabel) {
  try {
    const friday = fridayLabel ? _normVaultDateField_(fridayLabel, 'yyyy-MM-dd') : _defaultCreditReportWeek_();
    const monday = _mondayFromFriday_(friday); 
    const nameMap = readVaultSheetAsObjects_(VAULT_SHEET_NAME_MAPPING, VAULT_NAME_MAPPING_HEADERS);
    const nameById = {};
    nameMap.forEach(m => {const id = String(m.studentId || '').trim(); if (id) nameById[id] = String(m.masterName || '').trim() || id;});
    const hsdAssignments = getStudentHSDAssignments();
    const assignments = (hsdAssignments && hsdAssignments.assignments) || {};

    // Academic Snapshots — weekly cadence rows only, keyed to the Friday
    const snapRows = readVaultSheetAsObjects_(VAULT_SHEET_ACADEMIC_SNAPSHOTS, VAULT_ACADEMIC_SNAPSHOT_HEADERS)
      .filter(r => String(r.cadence || '').trim().toLowerCase() === 'weekly')
      .map(r => Object.assign({}, r, { snapshotDate: _normVaultDateField_(r.snapshotDate, 'yyyy-MM-dd') }))
      .filter(r => r.snapshotDate === friday);
    const creditsById = {};
    snapRows.forEach(r => {const id = String(r.studentId || '').trim();
      creditsById[id] = {
        gain: r.gain !== '' && r.gain !== undefined ? Number(r.gain) : null,
        creditsRemaining: r.creditsRemaining !== '' && r.creditsRemaining !== undefined ? Number(r.creditsRemaining) : null,
        status: r.status || '',
      };
    });
    // Productivity Data — hours worked, keyed to the Monday of the same week
    const prodRows = readVaultSheetAsObjects_(VAULT_SHEET_PRODUCTIVITY, VAULT_PRODUCTIVITY_HEADERS)
      .map(r => Object.assign({}, r, { weekLabel: _normVaultDateField_(r.weekLabel, 'yyyy-MM-dd') }))
      .filter(r => r.weekLabel === monday);
    const hoursById = {};
    prodRows.forEach(r => {
      const id = String(r.studentId || '').trim();
      hoursById[id] = {
        worked: r.actualWorkedTime !== '' && r.actualWorkedTime !== undefined ? Number(r.actualWorkedTime) : null,
        assigned: r.assignedHours !== '' && r.assignedHours !== undefined ? Number(r.assignedHours) : null,
      };
    });
    const rows = Object.keys(creditsById).map(id => {
      const credits = creditsById[id];
      const hours = hoursById[id] || { worked: null, assigned: null };
      return {
        studentId: id,
        name: nameById[id] || id,
        hsdClass: assignments[id] || 'Unassigned',
        creditsGained: credits.gain,
        creditsRemaining: credits.creditsRemaining,
        status: credits.status,
        hoursWorked: hours.worked,
        hoursAssigned: hours.assigned,
      };
    });

    // Group by HSD class
    const byClass = {};
    rows.forEach(r => {(byClass[r.hsdClass] = byClass[r.hsdClass] || []).push(r);});
    Object.values(byClass).forEach(list => {list.sort((a, b) => (b.creditsGained ?? -999) - (a.creditsGained ?? -999) || a.name.localeCompare(b.name));});
    const classOrder = ['HSD 2', 'HSD3', 'HSE/HSD1', 'Unassigned'];
    const groups = classOrder
      .filter(c => byClass[c] && byClass[c].length)
      .map(c => ({ hsdClass: c, students: byClass[c] }));
    Object.keys(byClass).forEach(c => {if (!classOrder.includes(c)) groups.push({ hsdClass: c, students: byClass[c] });});
    const totalGained = rows.reduce((s, r) => s + (r.creditsGained > 0 ? r.creditsGained : 0), 0);
    const gainerCount = rows.filter(r => r.creditsGained > 0).length;
    const zeroCount   = rows.filter(r => r.creditsGained === 0).length;
    const lostCount   = rows.filter(r => r.creditsGained < 0).length;
    return {
      success: true,
      weekLabel: friday,
      hasSnapshot: rows.length > 0,
      groups,
      summary: {
        totalStudents: rows.length,
        totalCreditsGained: +totalGained.toFixed(1),
        gainerCount,
        zeroCount,
        lostCount,
      },
    };
  } catch(e) {
    Logger.log('getWeeklyCreditReport error: ' + e.message);
    return { success: false, error: e.message };
  }
}

function _defaultCreditReportWeek_() {
  const today = new Date();
  const day = today.getDay(); // 0=Sun..6=Sat
  const diffToFriday = (day >= 5) ? (day - 5) : (day + 2);
  const friday = new Date(today);
  friday.setDate(today.getDate() - diffToFriday);
  return Utilities.formatDate(friday, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function _mondayFromFriday_(fridayStr) {
  const d = new Date(fridayStr + 'T00:00:00');
  d.setDate(d.getDate() - 4);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function getCreditReportSnapshots() {
  try {
    const rows = readVaultSheetAsObjects_(VAULT_SHEET_CREDIT_SNAPSHOTS, VAULT_CREDIT_SNAPSHOT_HEADERS);
    const list = rows.map(r => ({
      snapshotId: r.snapshotId,
      name: r.name,
      weekLabel: r.weekLabel,
      savedDate: r.savedDate,
      savedBy: r.savedBy,
    })).sort((a, b) => (b.savedDate || '').localeCompare(a.savedDate || ''));
    return { success: true, snapshots: list };
  } catch(e) {
    Logger.log('getCreditReportSnapshots error: ' + e.message);
    return { success: false, error: e.message };
  }
}

function getCreditReportSnapshot(snapshotId) {
  try {
    const rows = readVaultSheetAsObjects_(VAULT_SHEET_CREDIT_SNAPSHOTS, VAULT_CREDIT_SNAPSHOT_HEADERS);
    const row = rows.find(r => r.snapshotId === snapshotId);
    if (!row) return { success: false, error: 'Snapshot not found.' };
    const data = JSON.parse(row.reportJson);
    return Object.assign({}, data, {
      success: true,
      isSnapshot: true,
      snapshotName: row.name,
      snapshotSavedDate: row.savedDate,
      snapshotSavedBy: row.savedBy,
    });
  } catch(e) {
    Logger.log('getCreditReportSnapshot error: ' + e.message);
    return { success: false, error: e.message };
  }
}
