// ============================================================
// Config.gs — Single source of truth for all constants
// ============================================================

// ── Spreadsheet IDs ──────────────────────────────────────────
const SS_ADMIN    = '1EIAtya9M3sVedSYYwvv81aQWUbPUsrdVoUrwyDtWTO0';

// ── Admin access ──────────────────────────────────────────────
const ADMIN_EMAILS = [
  'galen.jobcorps1@gmail.com',
  'braydepike13@gmail.com',
];
const ADMIN_TOKEN = 'MS4245';

// ── Periods ───────────────────────────────────
const SCHEDULE_ACADEMIC_NAMES = ['HSD 2', 'HSD3', 'HSE/HSD1'];
const SCHEDULE_VALID_PERIODS  = {
  M:  [1, 2, 3, 5, 6],
  T:  [1, 2, 3, 5, 6, 7],
  W:  [1, 2, 3, 5, 6],
  TH: [1, 2, 3, 5, 6, 7],
  F:  [1, 2, 3, 5, 6, 7],
}
// ── Sheet names — SS_ADMIN ───────────────────────────────────
const SHEET_STAFF_ROLES         = 'Staff Roles';
const SHEET_SYSTEM_CONFIG       = 'System Config';
const SHEET_DIGEST_RECIPIENTS   = 'Digest Recipients';

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
  'Admin':               ['view','add_note','delete_note','edit_status','edit_risk','bulk_edit','merge','send_digest','manage_overrides','revert_changes','edit_transcript','edit_timelog'],
  'Program Manager':     ['view','add_note','delete_note','edit_status','edit_risk','bulk_edit','merge','send_digest','manage_overrides','revert_changes','edit_transcript','edit_timelog'],
  'Manager':             ['view','add_note','delete_note','edit_status','edit_risk','bulk_edit','merge','send_digest','manage_overrides','revert_changes','edit_transcript','edit_timelog'],
  'Counselor':           ['view','add_note','delete_note','edit_status','bulk_edit','merge','manage_overrides','revert_changes'],
  'Academic Instructor': ['view','add_note','edit_status','merge','edit_transcript','edit_timelog'],
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
const STALE_THRESHOLD_DAYS = 21;

// ── Trade totals ──────────────────────────────────────────────
const TOTAL_CREDITS_REQUIRED = 23;

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
// ── Migration flags ───────────────────────────────────────────
const USE_HUB_SETTINGS = true;
