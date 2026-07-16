// ============================================================
// TranscriptAutoPopulate.gs
// ------------------------------------------------------------
// Auto-populates a brand-new student's transcript from the
// Master Schedule Hours course plan. Only runs if the student
// has ZERO existing transcript rows — meant for newly added
// students, not for editing existing transcripts.
// ============================================================

// Grade level for core courses that repeat once per year.
// Anything not in this map is treated as an elective (no fixed
// grade) and gets bucketed into Year 2 per Galen's instruction.
const CORE_COURSE_GRADE_MAP_ = {
  'English 1': 9, 'Physical Science': 9, 'Oklahoma History': 9,
  'American Government': 9, 'Biology': 9, 'Algebra 1': 9,

  'English 2': 10, 'Earth and Space': 10, 'Geometry': 10,

  'English 3': 11, 'Intermediate Algebra': 11, 'US History': 11,

  'English 4': 12, 'Algebra 2': 12, 'World History': 12,
};

function _gradeForCourse_(baseName) {
  return CORE_COURSE_GRADE_MAP_[baseName] || null; // null = elective
}

function _blockForGrade_(grade) {
  if (grade === 9 || grade === 10) return 1;
  if (grade === 11 || grade === 12) return 2;
  return 2; // electives → Year 2, per instruction
}

function _splitMasterScheduleCourseName_(rawName) {
  const name = String(rawName || '').trim();
  if (name.startsWith('S1 ')) return { instance: 'S1', base: name.slice(3).trim() };
  if (name.startsWith('S2 ')) return { instance: 'S2', base: name.slice(3).trim() };
  return { instance: '', base: name };
}

const TRANSCRIPT_AUTO_POPULATE_COURSES_ = new Set([
  'English 1', 'Physical Science', 'Oklahoma History', 'American Government', 'Biology',
  'Algebra 1', 'English 2', 'Earth and Space', 'Geometry', 'English 3', 'Intermediate Algebra',
  'US History', 'Trade Completion', 'English 4', 'Algebra 2', 'World History',
  'Financial Literacy', 'Intro to Art', 'Language 1', 'Pathway Elective 1', 'Pathway Elective 2',
  'Pathway Elective 3', 'Pathway Elective 4', 'Pathway Elective 5', 'Pathway Elective 6',
]);

function autoPopulateTranscript(studentId, employeeId, role) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, error: 'Another change is saving right now — please wait a moment and try again.' };
  }

  try {
    if (!studentId) return { success: false, error: 'No student ID provided.' };

    _requirePermission(role || ROLES.ADMIN, 'edit_transcript');

    const existingRows = readVaultRowsForStudent_(VAULT_SHEET_TRANSCRIPT_ROWS, VAULT_TRANSCRIPT_HEADERS, studentId);
    if (existingRows.length > 0) {
      return { success: true, skipped: true, message: 'This student already has transcript rows — auto-populate only applies to new, empty transcripts.' };
    }

    const masterRows = readVaultSheetAsObjects_(VAULT_SHEET_CLASSES_ORDER, VAULT_CLASSES_ORDER_HEADERS)
      .filter(r => String(r.courseName || '').trim() !== '')
      .filter(r => {
        const { base } = _splitMasterScheduleCourseName_(r.courseName);
        return TRANSCRIPT_AUTO_POPULATE_COURSES_.has(base);
      });

    const catalogueRows = readVaultSheetAsObjects_(VAULT_SHEET_COURSE_CATALOGUE, VAULT_COURSE_CATALOGUE_HEADERS);

    const nowIso = new Date().toISOString();

    const newRows = masterRows.map(m => {
      const { instance, base } = _splitMasterScheduleCourseName_(m.courseName);
      const grade = _gradeForCourse_(base);
      const block = _blockForGrade_(grade);

      const matches = catalogueRows.filter(c => String(c.className || '').trim() === base);
      const catalogueMatch = instance
        ? (matches.find(c => String(c.classId || '').endsWith('-' + instance)) || matches[0])
        : matches[0];

      return {
        studentId,
        sourceTabName: '',
        rowId: Utilities.getUuid(),
        courseId: catalogueMatch ? catalogueMatch.classId : '',
        courseName: base,
        instance,
        transfer: false,
        subject: catalogueMatch ? catalogueMatch.category : '',
        credit: m.units || 0,
        classHours: m.hours || 0,
        startDate: '',
        adjStart: '',
        targetDate: '',
        completed: false,
        lastModified: nowIso,
        block,
      };
    });

    if (!newRows.length) {
      return { success: true, added: 0, message: 'No matching courses found to populate.' };
    }

    appendVaultRows_(VAULT_SHEET_TRANSCRIPT_ROWS, VAULT_TRANSCRIPT_HEADERS, newRows);

    return { success: true, added: newRows.length };
  } catch (err) {
    return { success: false, error: err.message || 'Auto-populate failed.' };
  } finally {
    lock.releaseLock();
  }
}
