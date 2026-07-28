// ======
// Helpers.gs — Shared utility functions
// ======

// ── String / name normalization ───────────────────────────────
// Lowercases, collapses whitespace, strips punctuation except comma —
// base normalization every name comparison in the app builds on.
function _norm(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9, ]/g, '')
    .trim();
}

function _normLoose(name) {
  let n = _norm(name);
  if (!n) return '';
  if (n.includes(',')) {
    const parts = n.split(',').map(s => s.trim()).filter(Boolean);
    n = parts.reverse().join(' ');
  }
  // Drop single-letter tokens (middle initials) — masterName in Name
  // Mapping always includes one (e.g. "Adams, Mya L"), but external
  // rosters/exports usually don't, so keeping it here would make an
  // otherwise-identical name fail to match.
  return n.split(' ').filter(w => w.length > 1).sort().join(' ');
}

// ── Type coercions ────────────────────────────────────────────
// Plain numeric coercion, blank/invalid -> null (not 0 — 0 is a
// real value, blank isn't).
function _toNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

// Handles both "62%" strings and raw 0-1 fractions, normalizes both
// to a 0-100 number. The n>0 && n<=1 check is a heuristic — assumes
// nobody's storing a literal "0.5%" meaning half a percent.
function _toPercent(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'string') {
    const n = Number(val.replace('%', '').trim());
    if (isNaN(n)) return null;
    return +n.toFixed(1);
  }
  const n = Number(val);
  if (isNaN(n)) return null;
  if (n > 0 && n <= 1) return +(n * 100).toFixed(1);
  return +n.toFixed(1);
}

// Sheet time values arrive as either a Date (Sheets' native duration
// display) or a plain number — normalizes both to decimal hours.
// NWH/NMH/"No Weekly Hours" -> 0, not null (a student with no weekly
// hours logged something, just zero of it).
function _toHours(val) {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).trim();
  if (['NWH', 'NMH', 'No Weekly Hours'].includes(str)) return 0;
  if (val instanceof Date) {
    return +(val.getHours() + val.getMinutes() / 60 + val.getSeconds() / 3600).toFixed(2);
  }
  const n = Number(val);
  return isNaN(n) ? null : +n.toFixed(2);
}

// ── Date helpers ──────────────────────────────────────────────
// Normalizes a sheet Date OR an already-string date to 'yyyy-MM-dd'.
// Pre-1970 dates -> null (Sheets sometimes stores an empty date cell
// as epoch/negative-year garbage, not a real date).
function _toDateStr(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (val.getFullYear() < 1970) return null;
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const str = String(val).trim();
  if (!str || str === '—' || str === '-') return null;
  return str;
}

function _todayStr() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// Parses a 'yyyy-MM-dd' string as a LOCAL date (midnight in script
// timezone), not UTC — `new Date('yyyy-MM-dd')` parses as UTC
// midnight, which silently shifts a day off in any timezone west of
// UTC. Use this anywhere a date string needs to become a real Date.
function _parseLocalDate(str) {
  if (!str || str === 'null') return null;
  const parts = String(str).split('-');
  if (parts.length !== 3) return null;
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return isNaN(d.getTime()) ? null : d;
}

// Monday-anchored week label for TODAY — the canonical join key used
// across Productivity Data, Weekly Hours History, and Academic
// Snapshots (weekly cadence). Everything that needs "which week is
// this" derives it from here, not by reading a field back off a row.
function _currentWeekMondayLabel_() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
  return Utilities.formatDate(monday, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// Counts academic periods in a schedule JSON blob — the one true
// implementation, shared by schedule display (_computeScheduleDerived_
// in Datafetch.gs) and the Weekly Hours History writer below.
// Previously duplicated separately in two places (and a third,
// now-retired copy in BulkPacing.gs's _pacingDetectFromSchedule_).
function _countAcademicPeriodsInSchedule_(schedule) {
  let count = 0;
  Object.entries(SCHEDULE_VALID_PERIODS).forEach(([day, validPeriods]) => {
    validPeriods.forEach(periodNum => {
      const entry = (schedule['Period ' + periodNum] || {})[day];
      if (!entry || !entry.class) return;
      if (SCHEDULE_ACADEMIC_NAMES.some(n => (entry.class || '').toLowerCase().includes(n.toLowerCase()))) {
        count++;
      }
    });
  });
  return count;
}

// Whether a schedule shows ANY trade period this week — used to
// decide "In Trades" vs "Currently Unassigned" from the real
// schedule, instead of the static hasTrades/tradeComplete profile
// flags (which reflect program enrollment, not what this specific
// week's schedule actually shows).
function _scheduleHasTradePeriods_(schedule) {
  return Object.entries(SCHEDULE_VALID_PERIODS).some(([day, validPeriods]) =>
    validPeriods.some(periodNum => {
      const entry = (schedule['Period ' + periodNum] || {})[day];
      if (!entry || !entry.class) return false;
      return SCHEDULE_TRADE_NAMES.some(n => (entry.class || '').toLowerCase().includes(n.toLowerCase()));
    })
  );
}

// Unions two schedules for the same week (e.g. Monday's upload vs a
// Wednesday/Friday re-upload after a schedule change) — a period
// counts as academic if it was academic in EITHER version, so a
// mid-week change can't erase evidence that real academic time
// happened earlier in the week. Returns a merged schedule blob in
// the same shape, suitable for passing straight into
// _countAcademicPeriodsInSchedule_.
function _unionSchedules_(scheduleA, scheduleB) {
  const merged = {};
  const allPeriodKeys = new Set([...Object.keys(scheduleA || {}), ...Object.keys(scheduleB || {})]);
  allPeriodKeys.forEach(periodKey => {
    const dayEntriesA = (scheduleA || {})[periodKey] || {};
    const dayEntriesB = (scheduleB || {})[periodKey] || {};
    const allDays = new Set([...Object.keys(dayEntriesA), ...Object.keys(dayEntriesB)]);
    merged[periodKey] = {};
    allDays.forEach(day => {
      // Prefer whichever entry is academic, so the union always
      // favors "this period was academic at some point this week"
      // over whatever the later upload happened to show.
      const entryA = dayEntriesA[day];
      const entryB = dayEntriesB[day];
      const aIsAcademic = entryA && entryA.class && SCHEDULE_ACADEMIC_NAMES.some(n => entryA.class.toLowerCase().includes(n.toLowerCase()));
      merged[periodKey][day] = aIsAcademic ? entryA : (entryB || entryA);
    });
  });
  return merged;
}
// ── Trend calculation ─────────────────────────────────────────
// Weighted rate-of-change over the last 4 data points, with an
// acceleration multiplier if there's enough history to detect a
// speed-up/slow-down.
// - mode 'rate': points are already per-period values (e.g. hours/week)
// - mode 'cumulative': points are running totals — diffs them first
//   (e.g. overall % complete over time -> per-period gain)
// - Weighting favors recent points (most recent point = highest weight)
// - Acceleration compares the first half of the window's average vs
//   the second half's; >1.15x = "accelerating", <0.85x = "decelerating"
// - effectiveRatePerWeek = weighted rate × acceleration factor — the
//   number actually used for pace/projection math elsewhere
function _computeWeightedTrend_(points, mode) {
  mode = mode === 'cumulative' ? 'cumulative' : 'rate';

  const clean = (points || [])
    .filter(p => p && p.date && p.value !== null && p.value !== undefined && !isNaN(Number(p.value)))
    .map(p => ({ date: String(p.date), value: Number(p.value) }))
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
    .slice(-4); // last 4 points on file, oldest → newest

  const empty = {
    rawRatePerWeek: null, weightedRatePerWeek: null, accelerationFactor: null,
    effectiveRatePerWeek: null, trendLabel: 'insufficient data', pointsUsed: 0,
  };

  let series;
  if (mode === 'cumulative') {
    if (clean.length < 2) return empty;
    series = [];
    for (let i = 1; i < clean.length; i++) series.push(clean[i].value - clean[i - 1].value);
  } else {
    if (clean.length < 1) return empty;
    series = clean.map(p => p.value);
  }

  if (series.length < 1) return empty;

  const rawRatePerWeek = +(series.reduce((s, v) => s + v, 0) / series.length).toFixed(3);

  let weightedSum = 0, weightTotal = 0;
  series.forEach((v, i) => {
    const weight = i + 1; // most recent counts most
    weightedSum += v * weight;
    weightTotal += weight;
  });
  const weightedRatePerWeek = +(weightedSum / weightTotal).toFixed(3);

  let accelerationFactor = null;
  let trendLabel = 'steady';
  if (series.length >= 3) {
    const half   = Math.floor(series.length / 2);
    const first  = series.slice(0, half);
    const second = series.slice(half);
    const avgFirst  = first.reduce((s, v) => s + v, 0) / first.length;
    const avgSecond = second.reduce((s, v) => s + v, 0) / second.length;
    if (Math.abs(avgFirst) < 0.001) {
      accelerationFactor = avgSecond > 0.001 ? 2 : 1; // flat → moving reads as a real acceleration
    } else {
      accelerationFactor = avgSecond / avgFirst;
    }
    accelerationFactor = +Math.max(0.25, Math.min(accelerationFactor, 3)).toFixed(2);
    if (accelerationFactor > 1.15)      trendLabel = 'accelerating';
    else if (accelerationFactor < 0.85) trendLabel = 'decelerating';
  } else {
    trendLabel = 'steady (not enough history yet to detect a change)';
  }

  const effectiveRatePerWeek = accelerationFactor !== null
    ? +(weightedRatePerWeek * accelerationFactor).toFixed(3)
    : weightedRatePerWeek;

  return { rawRatePerWeek, weightedRatePerWeek, accelerationFactor, effectiveRatePerWeek, trendLabel, pointsUsed: clean.length };
}

// Applies a manual pace-multiplier override on top of a computed
// trend (e.g. staff says "double their expected pace" for a student
// on an accommodation). No-op if no override of this type exists.
function _applyPaceOverride_(trend, overridesForStudent, overrideType) {
  if (!trend || trend.effectiveRatePerWeek === null) return trend;
  const ov = (overridesForStudent || []).find(o => o.type === overrideType);
  if (!ov) return Object.assign({}, trend, { overrideMultiplier: null });
  const mult = Number(ov.value);
  if (isNaN(mult) || mult <= 0) return Object.assign({}, trend, { overrideMultiplier: null });
  return Object.assign({}, trend, {
    overrideMultiplier: mult,
    effectiveRatePerWeek: +(trend.effectiveRatePerWeek * mult).toFixed(3),
    trendLabel: trend.trendLabel + ' (manual pace override ×' + mult + ' applied)',
  });
}

// ── Time helpers ──────────────────────────────────────────────
// Parses "H:MM:SS" or "MM:SS" sheet time strings to plain seconds.
function _hmsToSeconds(str) {
  if (!str) return 0;
  const parts = String(str).split(':').map(Number);
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  return 0;
}

// ── Array / index helpers ─────────────────────────────────────
// Groups an array into {key: [items]} — one key can hold many rows
// (e.g. a student with multiple trade enrollments). For one-row-per-
// key lookups, this is still the function to use; there's no
// single-value variant anymore (removed, zero callers — see July
// 2026 audit).
function _indexByMulti(arr, keyFn) {
  const idx = {};
  arr.forEach(item => {
    const k = keyFn(item);
    if (!k) return;
    if (!idx[k]) idx[k] = [];
    idx[k].push(item);
  });
  return idx;
}

function _avg(nums) {
  if (!nums || !nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// ── Permission helpers ────────────────────────────────────────
// ROLE_PERMISSIONS (AppConfig.gs) maps role -> allowed permission
// strings. _requirePermission throws (not returns false) so callers
// can skip their own error handling — just call it and let it bail.
function _hasPermission(role, permission) {
  if (!role) return false;
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

function _requirePermission(role, permission) {
  if (!_hasPermission(role, permission)) {
    throw new Error('You do not have permission to perform this action.');
  }
}

// ── Lock helper ───────────────────────────────────────────────

// Wraps a function in a script lock to prevent concurrent edits
function _withLock(fn) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_TIMEOUT_MS);
  } catch(e) {
    throw new Error('Another change is being saved right now — please try again in a moment.');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// ── Chunked cache helpers ─────────────────────────────────────
// CacheService caps a single value at 100KB — dashboard data for
// ~165 students blows past that easily. These split/rejoin a big
// string across N numbered keys plus one _meta key holding the
// chunk count, so callers can just get/put a normal string without
// worrying about the underlying split.
function _cachePutChunked(cache, key, str, ttl) {
  const chunks = [];
  for (let i = 0; i < str.length; i += CACHE_CHUNK_SIZE) {
    chunks.push(str.slice(i, i + CACHE_CHUNK_SIZE));
  }
  if (chunks.length > 99) {
    Logger.log('Data too large to cache (' + chunks.length + ' chunks) — skipping.');
    _cacheRemoveChunked(cache, key);
    return;
  }
  _cacheRemoveChunked(cache, key);
  const entries = {};
  entries[key + '_meta'] = String(chunks.length);
  chunks.forEach((chunk, i) => { entries[key + '_' + i] = chunk; });
  cache.putAll(entries, ttl);
}

function _cacheGetChunked(cache, key) {
  const meta = cache.get(key + '_meta');
  if (!meta) return null;
  const count = parseInt(meta, 10);
  if (!count || isNaN(count)) return null;
  const keys = [];
  for (let i = 0; i < count; i++) keys.push(key + '_' + i);
  const parts = cache.getAll(keys);
  let result = '';
  for (let i = 0; i < count; i++) {
    const part = parts[key + '_' + i];
    if (part === undefined || part === null) return null;
    result += part;
  }
  return result;
}

function _cacheRemoveChunked(cache, key) {
  const meta = cache.get(key + '_meta');
  if (!meta) { cache.remove(key); return; }
  const count = parseInt(meta, 10) || 0;
  const keys = [key + '_meta'];
  for (let i = 0; i < count; i++) keys.push(key + '_' + i);
  cache.removeAll(keys);
}

function _clearDashboardCache() {
  _cacheRemoveChunked(CacheService.getScriptCache(), 'dashboardData');
}

// Backs the "Clear Caches" button (Scripts.html -> runClearAllCaches
// -> google.script.run.clearAllCaches()).
// - Was missing entirely until the July 2026 audit — button called a
//   server function that didn't exist, failed every click
// - Clears both known chunked-cache buckets (dashboardData,
//   productivityData), reports back which ones actually had
//   something cached (client shows { label, cleared, count })
function clearAllCaches() {
  try {
    const cache = CacheService.getScriptCache();
    const buckets = [
      { key: 'dashboardData',    label: 'Dashboard data' },
      { key: 'productivityData', label: 'Productivity data' },
    ];

    const results = buckets.map(b => {
      const meta = cache.get(b.key + '_meta');
      const count = meta ? (parseInt(meta, 10) || 0) : 0;
      const wasCached = !!meta || cache.get(b.key) !== null;
      _cacheRemoveChunked(cache, b.key);
      return { label: b.label, cleared: wasCached, count: count || undefined };
    });

    return { success: true, results };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
// ── Trade pace helpers ─────────────────────────────────────────
// TRADE_EARLIEST_END_WORKDAYS: minimum workdays before a trade can
// possibly be complete — used for "Earliest End" display, not a
// pace judgment.
// TRADE_PACE_WINDOW_DAYS: the window Pace Gap measures progress
// against. Currently equal, but kept as two separate constants since
// they answer different questions and could diverge later.
const TRADE_EARLIEST_END_WORKDAYS = 150;
const TRADE_PACE_WINDOW_DAYS      = 150;

// Adds N workdays (Mon-Fri only) to a date.
function _addWorkdays_(startDate, numWorkdays) {
  const d = new Date(startDate);
  d.setHours(0, 0, 0, 0);
  let added = 0;
  while (added < numWorkdays) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day >= 1 && day <= 5) added++;
  }
  return d;
}

// Computes Pace Gap + Earliest End for one trade enrollment. 'CO'
// (completed) enrollment status short-circuits to 'Completed'; no
// start date or no percent short-circuits to blank (matches the
// legacy formula's behavior exactly — see branches below).
function _computeTradePaceMetrics_(overallPercentRaw, tarBeginDateStr, tradeName) {
  const result = { paceGap: null, earliestEnd: null, daysToEarliest: null };

  if (!tradeName || tradeName === 'Undecided/Shadow/New') return result;

  const start = tarBeginDateStr ? _parseLocalDate(String(tarBeginDateStr).slice(0, 10)) : null;

  // Earliest End / Days to Earliest — computable regardless of
  // enrollment status, as long as there's a start date.
  if (start) {
    const earliestEndDate = _addWorkdays_(start, TRADE_EARLIEST_END_WORKDAYS);
    result.earliestEnd    = _toDateStr(earliestEndDate);
    result.daysToEarliest = _daysUntil_(result.earliestEnd);
  }

  if (overallPercentRaw === null || overallPercentRaw === undefined || !start) {
    return result; // stays null — matches the formula's blank ("") case
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startMidnight = new Date(start);
  startMidnight.setHours(0, 0, 0, 0);

  if (today < startMidnight) {
    result.paceGap = 'Not Started';
    return result;
  }

  const daysElapsed      = (today - startMidnight) / 86400000;
  const expectedFraction = Math.min(1, Math.max(0, daysElapsed / TRADE_PACE_WINDOW_DAYS));
  result.paceGap = +((overallPercentRaw - expectedFraction) * 100).toFixed(1); // e.g. +22.3
  return result;
}
// Shared by WIRDataLayer.gs and WIR_Engine.gs — was duplicated
// identically in both files; consolidated here so a future edit
// to one can't silently drift from the other.
function _computeGradGap_(s) {
  return s.programDeadline && s.programDeadline.daysLeft != null ? s.programDeadline.daysLeft : '';
}

// Legacy single-delta weekly % change (latest weekly snapshot minus
// the one before it) — kept for any display still reading this
// field directly. Newer trend logic uses _computeWeightedTrend_
// instead, which looks at more than 2 points.
function _computeWeeklyPctChange_(snapshots) {
  const weekly = snapshots
    .filter(s => String(s.cadence || '').trim().toLowerCase() === 'weekly')
    .sort((a, b) => String(a.snapshotDate || '') < String(b.snapshotDate || '') ? -1 : 1);
  if (weekly.length < 2) return null;
  const latest = weekly[weekly.length - 1];
  const prev   = weekly[weekly.length - 2];
  const latestPct = Number(latest.overallPercent);
  const prevPct   = Number(prev.overallPercent);
  if (isNaN(latestPct) || isNaN(prevPct)) return null;
  return +(latestPct - prevPct).toFixed(1);
}

// ── Centralized week-of-month calculation ────────────────────
function getCurrentWeekOfMonth_(dateInput) {
  const override = PropertiesService.getScriptProperties().getProperty('CURRENT_WEEK_OVERRIDE');
  if (override) return parseInt(override, 10);

  const d = dateInput ? new Date(dateInput) : new Date();
  const day = d.getDate();
  if (day <= 7)  return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4; // covers days 22-31 as "week 4" — no separate W5 concept
}

// Manual dev-testing override for getCurrentWeekOfMonth_ above — no
// UI exposure, run from the Apps Script editor to force a specific
// week-of-month for testing. Not a forgotten feature, just editor-only.
function setWeekOverride(weekNum) {
  const props = PropertiesService.getScriptProperties();
  if (weekNum) props.setProperty('CURRENT_WEEK_OVERRIDE', String(weekNum));
  else         props.deleteProperty('CURRENT_WEEK_OVERRIDE');
}

function getWeekOverride() {
  return PropertiesService.getScriptProperties().getProperty('CURRENT_WEEK_OVERRIDE') || null;
}
// ============================================================
// writeResults — backing function for Verify Roster upload
// ------------------------------------------------------------
// Cross-checks parsed CIS roster data against Name Mapping.
//   - Never downgrades an existing "Complete" status back to incomplete
//   - Adds new students to Name Mapping if not already present
//   - Never removes/deactivates existing active students
// ============================================================

// r.tradeComplete/r.academicComplete are self-generated by the
// RosterProcessor.html client (exact 'Complete' string it builds
// itself), so the strict === check below is safe — not user-typed
// input that could vary in casing.
function writeResults(results) {
  try {
    if (!results || !results.length) {
      return { added: 0, updated: 0 };
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const sheet = getVaultSheet_(VAULT_SHEET_NAME_MAPPING);
      const existing = readVaultSheetAsObjects_(VAULT_SHEET_NAME_MAPPING, VAULT_NAME_MAPPING_HEADERS);

      const rowIndexById = {}; // studentId -> 0-based index into existing[]
      existing.forEach((row, i) => {
        const id = String(row.studentId || '').trim();
        if (id) rowIndexById[id] = i;
      });

      let added = 0;
      let updated = 0;
      const newRows = [];

      results.forEach(r => {
        const id = String(r.id || '').trim();
        if (!id) return;

        const incomingTradeComplete    = r.tradeComplete    === 'Complete';
        const incomingAcademicComplete = r.academicComplete === 'Complete';

        const existingIndex = rowIndexById[id];

        if (existingIndex !== undefined) {
          const row = existing[existingIndex];
          const currentTradeComplete    = String(row.tradeComplete    || '').trim().toUpperCase() === 'COMPLETE';
          const currentAcademicComplete = String(row.academicComplete || '').trim().toUpperCase() === 'COMPLETE';

          // Never downgrade — only ever flip false -> true, never true -> false
          const newTradeComplete    = currentTradeComplete    || incomingTradeComplete;
          const newAcademicComplete = currentAcademicComplete || incomingAcademicComplete;

          const changed = (newTradeComplete !== currentTradeComplete) || (newAcademicComplete !== currentAcademicComplete);

          if (changed) {
            const sheetRow = VAULT_DATA_START_ROW + existingIndex;
            sheet.getRange(sheetRow, VNM_COL_TRADE_COMPLETE).setValue(newTradeComplete ? 'Complete' : '');
            sheet.getRange(sheetRow, VNM_COL_ACADEMIC_COMPLETE).setValue(newAcademicComplete ? 'Complete' : '');
            updated++;
          }
        } else {
          newRows.push({
            studentId: id,
            masterName: r.name || id,
            tradeComplete: incomingTradeComplete ? 'Complete' : '',
            academicComplete: incomingAcademicComplete ? 'Complete' : '',
            active: true,
          });
          added++;
        }
      });

      if (newRows.length) {
        appendVaultRows_(VAULT_SHEET_NAME_MAPPING, VAULT_NAME_MAPPING_HEADERS, newRows);
      }

      return { added, updated };
    } finally {
      lock.releaseLock();
    }
  } catch(e) {
    Logger.log('writeResults error: ' + e.message);
    throw new Error(e.message);
  }
}
