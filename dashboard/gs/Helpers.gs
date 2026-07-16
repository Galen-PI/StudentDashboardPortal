// ======
// Helpers.gs — Shared utility functions
// ======

// ── String / name normalization ───────────────────────────────

// Strict norm — preserves comma structure (Last, First)
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
  return n.split(' ').filter(Boolean).sort().join(' ');
}

// ── Type coercions ────────────────────────────────────────────

function _toNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

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

function _toHoursOrNWH(val) {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).trim();
  if (['NWH', 'NMH', 'No Weekly Hours'].includes(str)) return 'NWH';
  return _toHours(val);
}

function _toHoursOrText(val) {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).trim();
  if (['No Weekly Hours', 'NWH', 'NMH'].includes(str)) return 0;
  return _toHours(val);
}

function _toWeeklyChange(val) {
  if (val === null || val === undefined || val === '') return null;
  if (String(val).trim().toLowerCase() === 'none') return 0;
  const n = Number(val);
  return isNaN(n) ? null : +n.toFixed(2);
}

// ── Date helpers ──────────────────────────────────────────────

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

function _parseLocalDate(str) {
  if (!str || str === 'null') return null;
  const parts = String(str).split('-');
  if (parts.length !== 3) return null;
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return isNaN(d.getTime()) ? null : d;
}

// ── Time helpers ──────────────────────────────────────────────

function _hmsToSeconds(str) {
  if (!str) return 0;
  const parts = String(str).split(':').map(Number);
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  return 0;
}

// ── Array / index helpers ─────────────────────────────────────

function _indexBy(arr, keyFn) {
  const idx = {};
  arr.forEach(item => {
    const k = keyFn(item);
    if (k && !idx[k]) idx[k] = item;
  });
  return idx;
}

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

// ── ID helpers ────────────────────────────────────────────────

// Generates a temporary ID for unmapped students
function _tempId(name) {
  return 'UNMAP_' + _norm(name).replace(/[^a-z0-9]/g, '_').slice(0, 40);
}

// ── Permission helpers ────────────────────────────────────────

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
// ── Trade pace helpers ─────────────────────────────────────────


const TRADE_EARLIEST_END_WORKDAYS = 150; 
const TRADE_PACE_WINDOW_DAYS      = 150; 


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

function _computeTradePaceMetrics_(overallPercentRaw, tarBeginDateStr, tradeName, enrollmentStatus) {
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

  // Pace Gap — mirrors the legacy formula's branches exactly.
  if (String(enrollmentStatus || '').trim().toUpperCase() === 'CO') {
    result.paceGap = 'Completed';
    return result;
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
function _computeGradGap_(s) {
  return s.programDeadline && s.programDeadline.daysLeft != null ? s.programDeadline.daysLeft : '';
}
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
// Rules (per the Verify Roster modal's own description):
//   - Never downgrades an existing "Complete" status back to incomplete
//   - Adds new students to Name Mapping if not already present
//   - Never removes/deactivates existing active students
// ============================================================

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
          // New student — add to Name Mapping, active by default
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
    throw new Error(e.message); // surfaces to withFailureHandler on the client
  }
}
