// ============================================================
// Helpers.gs — Shared utility functions
// ============================================================

// ── String / name normalization ───────────────────────────────

// Strict norm — preserves comma structure (Last, First)
function _norm(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9, ]/g, '')
    .trim();
}

// Loose norm — reverses Last, First → First Last and sorts words
// Used for fuzzy matching across sheets with inconsistent name formats
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
  // Sheets sometimes stores percentages as decimals (0.85 instead of 85)
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

// Returns 'NWH' string for "in trades" cells, otherwise hours number
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

// Converts a Sheets date or string to YYYY-MM-DD
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
// Returns today as YYYY-MM-DD in script timezone
function _todayStr() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
// Parses a YYYY-MM-DD string as LOCAL midnight (avoids UTC offset shifting the date)
// new Date("2026-08-01") = UTC midnight = July 31 in Central time — use this instead
function _parseLocalDate(str) {
  if (!str || str === 'null') return null;
  const parts = String(str).split('-');
  if (parts.length !== 3) return null;
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return isNaN(d.getTime()) ? null : d;
}

// ── Time helpers ──────────────────────────────────────────────

// Converts HH:MM:SS or HH:MM string to total seconds
function _hmsToSeconds(str) {
  if (!str) return 0;
  const parts = String(str).split(':').map(Number);
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  return 0;
}

// ── Array / index helpers ─────────────────────────────────────

// Builds a single-value index (first match wins)
function _indexBy(arr, keyFn) {
  const idx = {};
  arr.forEach(item => {
    const k = keyFn(item);
    if (k && !idx[k]) idx[k] = item;
  });
  return idx;
}

// Builds a multi-value index (all matches collected into arrays)
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
// Apps Script cache values are limited to 100KB each.
// These helpers split large JSON payloads into chunks automatically.

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
