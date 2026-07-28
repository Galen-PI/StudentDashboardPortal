// ============================================================
// VaultConfig.gs — Single source of truth for Student Data Vault
// ============================================================

// ── Spreadsheet ID ────────────────────────────────────────────
const SS_VAULT = '15AdLxifwIXSjT5ja9bpuBOhp8b6u4r2sniHbU4cA_2o';


// ── Sheet names — SS_VAULT ────────────────────────────────────
const VAULT_SHEET_TRANSCRIPT_ROWS     = 'Transcript Rows';
const VAULT_SHEET_COURSE_CATALOGUE    = 'Course Catalogue';
const VAULT_SHEET_CLASSES_ORDER       = 'Master Schedule Hours';
const VAULT_SHEET_TRANSCRIPT_LOG      = 'Transcript Log';

const VAULT_SHEET_TABE                = 'TABE Data';
const VAULT_SHEET_TABE_HISTORY        = 'TABE History';
const VAULT_SHEET_TABE_PREDICTIONS    = 'TABE Gain Predictions';

const VAULT_SHEET_WEEKLY_SCHEDULE     = 'Weekly Schedule';

const VAULT_SHEET_PRODUCTIVITY        = 'Productivity Data';

const VAULT_SHEET_TRADE_CODES         = 'Trade Proficiency Codes';
const VAULT_SHEET_TRADE_PROGRESS      = 'Trade Progress';
const VAULT_SHEET_TRADE_OVERVIEW      = 'Trade Overview';
const VAULT_SHEET_TRADE_SNAPSHOTS     = 'Trade Snapshots';

const VAULT_SHEET_ACADEMIC_SNAPSHOTS  = 'Academic Snapshots';

const VAULT_SHEET_WIR_REPORTS         = 'WIR Reports';
const VAULT_SHEET_WIR_CASE            = 'WIR Case Management';
const VAULT_SHEET_STUDENT_INFO        = 'Student Info';

const VAULT_SHEET_NAME_MAPPING        = 'Name Mapping';
const VAULT_SHEET_OVERRIDES_NOTES     = 'Overrides And Notes';
const VAULT_SHEET_STUDENT_ALIASES     = 'Student Aliases'; 
const VAULT_SHEET_STUDENT_COURSE_DATA = 'Student Course Data';
const VAULT_SHEET_TESTING_ATTEMPTS    = 'Testing Attempts';


const VAULT_STUDENT_COURSE_DATA_HEADERS = ['studentId', 'remainingCredits', 'remainingHours', 'courseCountLeft', 'nextCourse', 'nextCourseHours', 'nextCourseTarget', 'totalCredits', 'totalHours', 'completionPct', 'lastSynced'];
const VAULT_SHEET_STUDENT_PACING = 'Student Pacing Settings'; // RETIRED — replaced by VAULT_SHEET_WEEKLY_HOURS_HISTORY below. Left in place, unread, per decision not to delete/migrate it.
const VAULT_STUDENT_PACING_HEADERS = ['studentId', 'weeklyHours', 'w1', 'w2', 'w3', 'w4', 'lastUpdated']

// Rolling 4-week real-schedule-derived hours per student — replaces
// the W1-4 rotation-bucket guessing system entirely. Purpose-built
// for pacing only; deliberately separate from Weekly Schedule
// (which Display and the instructor auto-filter still depend on
// unchanged) so reworking pacing can never affect either of those.
// One row per student per week; pruned to the most recent 4 weeks
// whenever a new week's row is written for that student.
const VAULT_SHEET_WEEKLY_HOURS_HISTORY = 'Weekly Hours History';
const VAULT_WEEKLY_HOURS_HISTORY_HEADERS = ['studentId', 'weekLabel', 'academicHoursThisWeek', 'hasTradeThisWeek', 'source', 'lastUpdated'];

// One row per student, per week, per course — captures the
// COURSES WORKED ON breakdown from the Edgenuity session log paste,
// which _parseEdgenuityLog_ (TimeLog.gs) previously discarded (it
// only kept the week-level Week Totals/Idle Time). activitiesCompleted
// is a raw count, not a percentage — compare against
// getMasterScheduleHours()'s 'lessons' count for that course name to
// get a rough %-through-course, keeping in mind a student who's
// pre-tested out of some lessons will show as further behind than
// they really are (see the parser's own comments for more).
const VAULT_SHEET_COURSE_ACTIVITY = 'Weekly Course Activity';
const VAULT_COURSE_ACTIVITY_HEADERS = ['studentId', 'weekLabel', 'courseName', 'activityHours', 'reviewHours', 'activitiesCompleted', 'lastUpdated'];
// source values: 'real_upload' (counted from an actual uploaded
// schedule this week), 'fallback_pattern' (this week's upload was
// missed; derived from >=3-of-4 prior real weeks agreeing), or
// 'no_data_yet' (no real upload yet this week, still within the
// Monday/Tuesday grace window — not a guess, just not there yet).
const VAULT_NAME_MAPPING_HEADERS = ['studentId', 'masterName', 'tradeComplete', 'academicComplete', 'active', 'examProgram'];
const VAULT_SHEET_CREDIT_SNAPSHOTS = 'Credit Report Snapshots';
const VAULT_CREDIT_SNAPSHOT_HEADERS = ['snapshotId','name','weekLabel','savedDate','savedBy','reportJson'];

// Custom columns — staff-defined extra fields on the table. Definitions
// (which columns exist, in what order) live in one small sheet; the
// actual per-student values live in a separate flat table, same
// pattern as everything else in the Vault.
const VAULT_SHEET_CUSTOM_COLUMN_DEFS   = 'Custom Column Defs';
const VAULT_CUSTOM_COLUMN_DEFS_HEADERS = ['columnName', 'sortOrder', 'createdBy', 'createdDate'];
const VAULT_SHEET_CUSTOM_COLUMN_VALUES = 'Custom Column Values';
const VAULT_CUSTOM_COLUMN_VALUES_HEADERS = ['studentId', 'columnName', 'value', 'lastUpdated'];

// ── Data start rows ──────────────────────────────────────
const VAULT_DATA_START_ROW = 2;

// ── Name Mapping column indices (1-based) ─────────────────────
const VNM_COL_ID                = 1; // studentId
const VNM_COL_MASTER_NAME       = 2; // masterName
const VNM_COL_TRADE_COMPLETE    = 3; // tradeComplete
const VNM_COL_ACADEMIC_COMPLETE = 4; // academicComplete
const VNM_COL_ACTIVE            = 5; // active (true/false)

// ── Transcript Rows headers ────────────────────────────────────
const VAULT_TRANSCRIPT_HEADERS = [
  'studentId', 'sourceTabName', 'rowId', 'courseId', 'courseName', 'instance', 'transfer',
  'subject', 'credit', 'classHours', 'startDate', 'adjStart', 'targetDate',
  'completed', 'lastModified', 'block',
];
// ── Testing Attmpets Rows headers ────────────────────────────────────
const VAULT_TESTING_ATTEMPTS_HEADERS = [
  'rowId', 'studentId', 'examProgram', 'subtest', 'dateTested',
  'score', 'result', 'enteredBy', 'enteredDate'
];
// ── Course Catalogue / Classes Order headers ───────────────────
const VAULT_COURSE_CATALOGUE_HEADERS = ['className', 'category', 'classId'];
const VAULT_CLASSES_ORDER_HEADERS    = ['courseName', 'hours', 'units', 'lessons', 'minimumHours'];

// ── Weekly Schedule headers ─────────────────────────────────────
const VAULT_SCHEDULE_HEADERS = ['studentId', 'weekLabel', 'slot', 'scheduleJson', 'lastUpdated'];

// ── Productivity Data headers ───────────────────────────────────
const VAULT_PRODUCTIVITY_HEADERS = [
  'studentId', 'monthLabel', 'weekLabel', 'completedWork', 'idleTime',
  'actualWorkedTime', 'assignedHours', 'assignedHoursSource', 'entryMethod',
  'lastUpdated', 'lastUpdatedBy',
];

// Productivity week exclusions — a separate sheet rather than new
// columns bolted onto the live, heavily-used Productivity Data sheet
// above (a real column-position mismatch already bit this app once
// today). Lets staff mark a specific student+week as excluded from
// percentage/pacing calculations, with a reason (sick, appointment,
// worked outside scheduled hours, etc.) — without touching the
// underlying logged data at all.
const VAULT_SHEET_PRODUCTIVITY_EXCLUSIONS = 'Productivity Exclusions';
const VAULT_PRODUCTIVITY_EXCLUSIONS_HEADERS = ['studentId', 'weekLabel', 'reason', 'setBy', 'setDate'];

// ── Trade headers ────────────────────────────────────────────────
const VAULT_TRADE_CODES_HEADERS    = ['trade', 'code', 'category', 'proficienciesCount'];
const VAULT_TRADE_PROGRESS_HEADERS = ['studentId', 'trade', 'code', 'completedCount', 'avgRating', 'lastUpdated'];
const VAULT_TRADE_OVERVIEW_HEADERS = [
  'studentId', 'trade', 'tarBeginDate', 'staffPercent', 'studentPercent', 'overallPercent', 'lastUpdated',
];
const VAULT_TRADE_SNAPSHOT_HEADERS = ['studentId', 'trade', 'snapshotDate', 'cadence', 'overallPercent', 'gain', 'status'];

// ── Academic Snapshots headers ──────────────────────────────────
const VAULT_ACADEMIC_SNAPSHOT_HEADERS = ['studentId', 'cadence', 'snapshotDate', 'creditsRemaining', 'gain', 'status'];

// ── TABE headers (identical to legacy — schema matched 1:1) ────
function VAULT_TABE_HEADERS_() { return TABE_HEADERS; }
function VAULT_TABE_HISTORY_HEADERS_() { return TABE_HISTORY_HEADERS; }
function VAULT_TABE_PREDICTIONS_HEADERS_() { return TABE_PREDICTIONS_HEADERS; }

// ── Overrides And Notes headers ─────────────────────────────────
const VAULT_OVERRIDES_NOTES_HEADERS = ['studentId', 'type', 'value', 'note', 'setBy', 'date'];

// ── Trade totals (reuse existing constant — same 23-credit rule) ─
function VAULT_TOTAL_CREDITS_REQUIRED_() { return TOTAL_CREDITS_REQUIRED; }

// ── Migration flags
const USE_VAULT_TRANSCRIPTS = true;
const USE_VAULT_TABE        = true;
const USE_VAULT_SCHEDULE    = true;
const USE_VAULT_PRODUCTIVITY = true;
const USE_VAULT_TRADES      = true;
const USE_VAULT_WIR         = true;
const USE_VAULT_ACADEMIC_SNAPSHOTS = true;
const USE_VAULT_NAME_MAPPING = true;
const USE_VAULT_OVERRIDES = true;
const USE_VAULT_PROFILES  = true;


// ============================================================
// SHARED VAULT CONNECTOR HELPERS
// ============================================================

let _vaultSpreadsheetCache_ = null;

function getVaultSpreadsheet_() {
  if (!_vaultSpreadsheetCache_) {
    _vaultSpreadsheetCache_ = SpreadsheetApp.openById(SS_VAULT);
  }
  return _vaultSpreadsheetCache_;
}


function getVaultSheet_(sheetName) {
  const ss = getVaultSpreadsheet_();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Vault sheet not found: "' + sheetName + '". Check VaultConfig.gs sheet name constants.');
  }
  return sheet;
}

function readVaultSheetAsObjects_(sheetName, headers) {
  const sheet = getVaultSheet_(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < VAULT_DATA_START_ROW) return [];

  const numRows = lastRow - VAULT_DATA_START_ROW + 1;
  const values = sheet.getRange(VAULT_DATA_START_ROW, 1, numRows, headers.length).getValues();

  return values.map(row => {
    const obj = {};
    headers.forEach((key, i) => { obj[key] = row[i]; });
    return obj;
  });
}

function readVaultRowsForStudent_(sheetName, headers, studentId) {
  const id = String(studentId).trim();
  return readVaultSheetAsObjects_(sheetName, headers)
    .filter(row => String(row.studentId).trim() === id);
}


function appendVaultRows_(sheetName, headers, rowObjects) {
  if (!rowObjects || !rowObjects.length) return 0;
  const sheet = getVaultSheet_(sheetName);
  const values = rowObjects.map(obj => headers.map(h => obj[h] !== undefined ? obj[h] : ''));
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
  return values.length;
}
