// ============================================================
// TestingAttempts.gs — HiSET / GED subtest tracking
// ============================================================

function getStudentTestingData(studentId) {
  try {
    if (!studentId) return { success: false, error: 'No student ID provided.' };

    // Look up examProgram from Name Mapping
    const nameMapRows = readVaultSheetAsObjects_(VAULT_SHEET_NAME_MAPPING, VAULT_NAME_MAPPING_HEADERS);
    const mapRow = nameMapRows.find(r => String(r.studentId).trim() === String(studentId).trim());
    const examProgram = mapRow ? mapRow.examProgram : null;

    if (!examProgram || (examProgram !== 'HiSET' && examProgram !== 'GED')) {
      return { success: false, error: 'This student is not on HiSET or GED.' };
    }

    const attemptRows = readVaultRowsForStudent_(VAULT_SHEET_TESTING_ATTEMPTS, VAULT_TESTING_ATTEMPTS_HEADERS, studentId);

    const bySubtest = {};
    attemptRows.forEach(row => {
      const subtest = row.subtest;
      const attempt = {
        rowId:  row.rowId,
        date:   row.dateTested ? String(row.dateTested) : null,
        score:  row.score !== '' ? row.score : null,
        result: row.result,
      };
      if (!bySubtest[subtest]) bySubtest[subtest] = [];
      bySubtest[subtest].push(attempt);
    });

    const subtests = Object.keys(bySubtest).map(name => {
      const attempts = bySubtest[name].sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
      const latest = attempts[0];
      return {
        name,
        status: latest ? latest.result : 'Not Taken',
        attempts,
      };
    });

    return { success: true, examProgram, subtests };
  } catch (err) {
    return { success: false, error: 'Failed to load testing data: ' + err.message };
  }
}

function saveTestingAttempt(studentId, examProgram, subtest, date, score, result, employeeId, role) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, error: 'Another change is saving right now — please wait a moment and try again.' };
  }

  try {
    if (!studentId || !examProgram || !subtest || !date || !result) {
      return { success: false, error: 'Missing required fields.' };
    }
    if (result !== 'Pass' && result !== 'Fail') {
      return { success: false, error: 'Result must be Pass or Fail.' };
    }

    _requirePermission(role || ROLES.ADMIN, 'edit_transcript');

    const rowId = Utilities.getUuid();
    const enteredDate = new Date().toISOString();

    appendVaultRows_(VAULT_SHEET_TESTING_ATTEMPTS, VAULT_TESTING_ATTEMPTS_HEADERS, [{
      rowId, studentId, examProgram, subtest,
      dateTested: date,
      score: score !== null && score !== undefined ? score : '',
      result,
      enteredBy: employeeId || 'staff',
      enteredDate,
    }]);

    return getStudentTestingData(studentId);
  } catch (err) {
    return { success: false, error: 'Save failed: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}
