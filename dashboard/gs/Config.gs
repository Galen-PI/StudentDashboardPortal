// ============================================================
// Config.gs — Single source of truth for all constants
// ============================================================

// ── Spreadsheet IDs ──────────────────────────────────────────
const SS_HUB      = '1cVjsX_WidmHfFNXTBGcRqwJ5U7Iln0QI9_dargB_UMw';
const SS_ACADEMIC = '1IUA-_4LPasXMXp1qfcYiex-PC5WOT7cnY_K1XHCPJEg';
const SS_ADMIN    = '1EIAtya9M3sVedSYYwvv81aQWUbPUsrdVoUrwyDtWTO0';

// ── Admin access ──────────────────────────────────────────────
const ADMIN_EMAILS = [
  'galen.jobcorps1@gmail.com',
  'braydepike13@gmail.com',
];
const ADMIN_TOKEN = 'MS4245';

// ── Sheet names — SS_HUB ─────────────────────────────────────
const SHEET_HS                  = 'High School Summary';
const SHEET_HISET               = 'HISET/GED Summary';
const SHEET_TRADES              = 'Trade Summary';
const SHEET_MAPPING             = 'Name Mapping';
const SHEET_TRADE_MONTHLY       = 'Trade Monthly Percentage';
const SHEET_TIME                = 'TimeTable 2026';
const SHEET_WIR_LOG             = 'WIR Log';
const SHEET_OVERRIDES           = 'Manual Overrides';
const SHEET_HS_MONTHLY          = 'HS Monthly Percentage';
const SHEET_SCHEDULE            = 'Weekly Schedule';
const SHEET_PRODUCTIVITY        = 'Productivity Data';
const SHEET_TABE                = 'TABE Data';
const SHEET_TABE_HISTORY        = 'TABE History';
const SHEET_TABE_PREDICTIONS    = 'TABE Gain Predictions';
const SHEET_STUDENT_COURSE_DATA = 'Student Course Data';

// ── Sheet names — SS_ADMIN ───────────────────────────────────
const SHEET_STAFF_ROLES         = 'Staff Roles';
const SHEET_SYSTEM_CONFIG       = 'System Config';
const SHEET_DIGEST_RECIPIENTS   = 'Digest Recipients';

// ── Data start rows (1-indexed) ───────────────────────────────
const DATA_START_ROW        = 7;   // HS / HiSET summary sheets
const TRADES_DATA_START_ROW = 6;   // Trade Summary sheet
const TIME_DATA_START_ROW   = 3;   // TimeTable sheet
const TRADE_MONTHLY_START   = 3;   // Trade Monthly sheet

// ── Roles ─────────────────────────────────────────────────────
const ROLES = {
  ADMIN:               'Admin',
  PROGRAM_MANAGER:     'Program Manager',
  MANAGER:             'Manager',
  COUNSELOR:           'Counselor',
  ACADEMIC_INSTRUCTOR: 'Academic Instructor',
};

// ── Role → permissions map ────────────────────────────────────
const ROLE_PERMISSIONS = {
  'Admin':               ['view','add_note','delete_note','edit_status','edit_risk','bulk_edit','merge','send_digest','manage_overrides','revert_changes'],
  'Program Manager':     ['view','add_note','delete_note','edit_status','edit_risk','bulk_edit','merge','send_digest','manage_overrides','revert_changes'],
  'Manager':             ['view','add_note','delete_note','edit_status','edit_risk','bulk_edit','merge','send_digest','manage_overrides','revert_changes'],
  'Counselor':           ['view','add_note','delete_note','edit_status','bulk_edit','merge','manage_overrides','revert_changes'],
  'Academic Instructor': ['view','add_note','edit_status','merge'],
};

// ── Cache settings ────────────────────────────────────────────
const CACHE_TTL        = 1800;  // seconds — 30 minutes
const CACHE_CHUNK_SIZE = 70000; // characters per cache chunk
const WIR_CACHE_TTL    = 600;   // seconds — 10 minutes

// ── Overrides sheet ───────────────────────────────────────────
const OVERRIDES_START_ROW = 2;
const LOCK_TIMEOUT_MS     = 10000;
const SNAPSHOT_PRUNE_DAYS = 28;

// ── Stale detection ───────────────────────────────────────────
const STALE_THRESHOLD_DAYS = 21; // 3 weeks

// ── Trade totals ──────────────────────────────────────────────
const TOTAL_CREDITS_REQUIRED = 23; // Oklahoma HS graduation requirement

// ── TABE headers ─────────────────────────────────────────────
const TABE_HEADERS = [
  'Student ID', 'Student Name', 'HSD Status',
  'Math Attempts', 'Math Prev Date', 'Math Prev Scale', 'Math Prev EFL', 'Math Prev EFL Level',
  'Math Curr Date', 'Math Curr Scale', 'Math Curr EFL', 'Math Curr EFL Level',
  'Math Best Date', 'Math Best Scale', 'Math Best EFL', 'Math Best EFL Level', 'Math Gain',
  'Read Attempts', 'Read Prev Date', 'Read Prev Scale', 'Read Prev EFL', 'Read Prev EFL Level',
  'Read Curr Date', 'Read Curr Scale', 'Read Curr EFL', 'Read Curr EFL Level',
  'Read Best Date', 'Read Best Scale', 'Read Best EFL', 'Read Best EFL Level', 'Read Gain',
  'Report Date',
];

const TABE_HISTORY_HEADERS = [
  'Student ID', 'Student Name', 'Subject', 'Test Date', 'Scale Score', 'EFL', 'EFL Level',
];

const TABE_PREDICTIONS_HEADERS = [
  'Snapshot Date', 'Subject', 'Rank', 'Student ID', 'Student Name',
  'Current Level', 'Current Scale', 'Next Level', 'Points To Next',
  'Weekly Rate', 'Predicted Weeks', 'Tests On File', 'Span Weeks',
];

// ── TABE EFL score thresholds ────────────────────────────────
// Each entry: [minScore, maxScore] for that level (1-indexed by position)
const TABE_THRESHOLDS = {
  Reading: [
    [300, 441], // Level 1 — Beginning ABE Literacy
    [442, 478], // Level 2 — Beginning Basic Education
    [479, 517], // Level 3 — Low Intermediate Basic Ed
    [518, 559], // Level 4 — High Intermediate Basic Ed
    [560, 616], // Level 5 — Low Adult Secondary Ed
    [617, 800], // Level 6 — High Adult Secondary Ed
  ],
  Math: [
    [300, 448],
    [449, 495],
    [496, 536],
    [537, 595],
    [596, 657],
    [658, 800],
  ],
};

// ── Student course data headers ───────────────────────────────
const COURSE_DATA_HEADERS = [
  'Student Name', 'Remaining Credits', 'Remaining Hours',
  'Course Count Remaining', 'Next Course', 'Next Course Hours',
  'Next Course Target Date', 'Total Credits', 'Total Hours',
  'Completion %', 'Last Synced',
];
// ── Migration flags ───────────────────────────────────────────
const USE_HUB_SETTINGS    = true;
const USE_HUB_TRANSCRIPTS = false;
const USE_HUB_TRADES      = false;
const USE_HUB_TIMETABLE   = false;

// ── Name Mapping column indices (1-based) ─────────────────────
const NM_COL_ID                = 1;
const NM_COL_MASTER_NAME       = 2;
const NM_COL_TRADE_NAME        = 3;
const NM_COL_ACADEMIC_NAME     = 4;
const NM_COL_TRADE_COMPLETE    = 5;
const NM_COL_ACADEMIC_COMPLETE = 6;
const NM_COL_WEEKLY_HOURS      = 15;
const NM_COL_W1                = 16;
const NM_COL_W2                = 17;
const NM_COL_W3                = 18;
const NM_COL_W4                = 19;
