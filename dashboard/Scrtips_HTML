<script>
// ─────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────
let allProfiles  = [];
let activeRisk   = 'ALL';
let activeType   = 'ALL';
let wirWeekLabel = null;
let currentModalProfile = null;
let selectedIds  = new Set();
let _loadTimeoutHandle = null;
let _lastRenderFingerprint = '';
let _hsMonthlyByStudent = {};
let _hsMonthlyCohort    = [];
let _tradeMonthlyCohort = [];

// Small reusable warning glyph — same path as ICONS.alertTri, sized for
// inline use in status text. Uses currentColor so it inherits whatever
// color the surrounding span is set to, instead of relying on an emoji
// glyph that renders differently (and in color) across platforms.
const _warnGlyph = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;vertical-align:-1px;display:inline-block;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>';

// ── Session state ────────────────────────────────────────────
let _currentRole       = SERVER_ROLE       || '';
let _currentName       = SERVER_NAME       || '';
let _currentEmployeeId = SERVER_EMPLOYEE_ID || '';

// ────────────────────────────────────────────────────────────
// Themed confirm / prompt / toast — replaces native alert()/confirm()/
// prompt() so error and confirmation states stay inside the app's own
// theme instead of dropping into an unstyled browser dialog.
// ────────────────────────────────────────────────────────────
function _ensureThemedDialogEl() {
  if (document.getElementById('themedDialog')) return;
  const el = document.createElement('div');
  el.id = 'themedDialog';
  el.className = 'modal-overlay hidden';
  el.innerHTML = `
    <div class="modal-box" style="max-width:420px;">
      <div class="modal-header">
        <h2 id="themedDialogTitle">Please confirm</h2>
      </div>
      <div class="modal-body" style="padding:20px 22px;">
        <p id="themedDialogMessage" style="font-size:13px;color:var(--text-soft);line-height:1.6;margin-bottom:4px;"></p>
        <div id="themedDialogInputWrap" class="override-row hidden" style="margin-top:12px;">
          <input type="text" id="themedDialogInput" style="background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:var(--font);font-size:13px;padding:8px 10px;outline:none;width:100%;">
        </div>
        <div class="override-actions" style="margin-top:16px;">
          <button class="btn-override" id="themedDialogOk">Confirm</button>
          <button class="btn-override danger" id="themedDialogCancel">Cancel</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => { if (e.target === el) document.getElementById('themedDialogCancel').click(); });
}

function themedConfirm(message, opts) {
  opts = opts || {};
  _ensureThemedDialogEl();
  return new Promise(resolve => {
    const el        = document.getElementById('themedDialog');
    const okBtn      = document.getElementById('themedDialogOk');
    const cancelBtn  = document.getElementById('themedDialogCancel');
    document.getElementById('themedDialogTitle').textContent   = opts.title || 'Please confirm';
    document.getElementById('themedDialogMessage').textContent = message;
    document.getElementById('themedDialogInputWrap').classList.add('hidden');
    okBtn.textContent = opts.okLabel || 'Confirm';
    okBtn.className   = opts.danger ? 'btn-override danger' : 'btn-override';
    el.classList.remove('hidden');
    function cleanup(result) {
      el.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    }
    function onOk()     { cleanup(true); }
    function onCancel() { cleanup(false); }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}

function themedPrompt(message, defaultValue, opts) {
  opts = opts || {};
  _ensureThemedDialogEl();
  return new Promise(resolve => {
    const el         = document.getElementById('themedDialog');
    const inputWrap  = document.getElementById('themedDialogInputWrap');
    const input      = document.getElementById('themedDialogInput');
    const okBtn      = document.getElementById('themedDialogOk');
    const cancelBtn  = document.getElementById('themedDialogCancel');
    document.getElementById('themedDialogTitle').textContent   = opts.title || 'Enter a value';
    document.getElementById('themedDialogMessage').textContent = message;
    inputWrap.classList.remove('hidden');
    input.value = defaultValue || '';
    okBtn.textContent = opts.okLabel || 'Save';
    okBtn.className   = 'btn-override';
    el.classList.remove('hidden');
    setTimeout(() => input.focus(), 50);
    function cleanup(result) {
      el.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onOk()     { cleanup(input.value.trim() || null); }
    function onCancel() { cleanup(null); }
    function onKey(e)   { if (e.key === 'Enter') onOk(); if (e.key === 'Escape') onCancel(); }
    input.addEventListener('keydown', onKey);
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}

function showToast(message, type) {
  let toast = document.getElementById('themedToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'themedToast';
    toast.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:11px 20px;border-radius:7px;font-size:13px;font-weight:600;font-family:var(--font);box-shadow:var(--shadow-modal);z-index:500;opacity:0;transition:opacity 0.2s;pointer-events:none;max-width:420px;text-align:center;';
    document.body.appendChild(toast);
  }
  const isError = type === 'error';
  toast.textContent    = message;
  toast.style.background = 'var(--bg3)';
  toast.style.color      = isError ? 'var(--high)' : 'var(--ok)';
  toast.style.border     = '1px solid ' + (isError ? 'color-mix(in srgb, var(--high) 32%, transparent)' : 'color-mix(in srgb, var(--ok) 32%, transparent)');
  toast.style.opacity    = '1';
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, 3400);
}

// ────────────────────────────────────────────────────────────
// Client-side permission helper
// ────────────────────────────────────────────────────────────
const CLIENT_PERMISSIONS = {
  'Admin':               ['view','add_note','delete_note','edit_status','edit_risk','bulk_edit','merge','send_digest','manage_overrides','revert_changes'],
  'Program Manager':     ['view','add_note','delete_note','edit_status','edit_risk','bulk_edit','merge','send_digest','manage_overrides','revert_changes'],
  'Manager':             ['view','add_note','delete_note','edit_status','edit_risk','bulk_edit','merge','send_digest','manage_overrides','revert_changes'],
  'Counselor':           ['view','add_note','delete_note','edit_status','bulk_edit','merge','manage_overrides','revert_changes'],
  'Academic Instructor': ['view','add_note','edit_status','merge'],
};

function _can(permission) {
  if (!_currentRole) return false;
  return (CLIENT_PERMISSIONS[_currentRole] || []).includes(permission);
}

// ─────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('studentsBody').addEventListener('click', e => {
    const btn = e.target.closest('.detail-btn');
    if (btn) openModal(btn.dataset.id);
  });

  try {
    if (localStorage.getItem('dashColsExpanded')) {
      _colsExpanded = true;
      document.querySelectorAll('.col-expandable').forEach(el => el.classList.remove('hidden-col'));
      const btn = document.getElementById('expandColsBtn');
      if (btn) { btn.textContent = '－'; btn.classList.add('open'); }
    }
  } catch(e) {}

  _renderCustomPresets();
  _wirePresetSelectListener();

  try {
    const savedRole = localStorage.getItem('dashRole');
    if (savedRole) {
      const roleEl = document.getElementById('roleSelect');
      if (roleEl) roleEl.value = savedRole;
    }
  } catch(e) {}

  if (window.innerWidth <= 768) {
    _currentView = 'cards';
    document.getElementById('btnCardView').classList.add('active');
    document.getElementById('btnTableView').classList.remove('active');
  }

  if (_currentRole) {
    document.getElementById('loginScreen').classList.add('hidden');
    _applyRoleUI();
    loadData();
    initCounselorFilter();
  }
});

// ────────────────────────────────────────────────────────────
// Staff Login
// ────────────────────────────────────────────────────────────
function staffLogin() {
  const input = document.getElementById('employeeIdInput');
  const id    = (input ? input.value : '').trim();
  if (!id) {
    _showLoginError('Please enter your Employee ID.');
    return;
  }

  const btn = document.getElementById('staffLoginBtn');
  btn.disabled    = true;
  btn.textContent = 'Signing in…';
  _hideLoginError();

  google.script.run
    .withSuccessHandler(function(result) {
      btn.disabled    = false;
      btn.textContent = 'Sign In';
      if (result.error) { _showLoginError(result.error); return; }
      _currentRole       = result.role;
      _currentName       = result.name;
      _currentEmployeeId = result.employeeId;
      _completeLogin();
    })
    .withFailureHandler(function() {
      btn.disabled    = false;
      btn.textContent = 'Sign In';
      _showLoginError('Something went wrong. Please try again.');
    })
    .getRoleByEmployeeId(id);
}

function _showLoginError(msg) {
  const el = document.getElementById('staffLoginError');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}

function _hideLoginError() {
  const el = document.getElementById('staffLoginError');
  if (el) el.classList.remove('show');
}

function _completeLogin() {
  document.getElementById('loginScreen').classList.add('hidden');
  const wirLabel = document.getElementById('wirWeekLabel');
  if (wirLabel) wirLabel.textContent = _currentName + ' · ' + _currentRole;
  _applyRoleUI();
  loadData();
  initCounselorFilter();
}

function _applyRoleUI() {
  _setVisible('btnMergeProfiles',   _can('merge'));
  _setVisible('btnSendDigest',      _can('send_digest'));
  _setVisible('btnBulkEdit',        _can('bulk_edit'));
  _setVisible('bulkNoteBtn',        _can('add_note'));
  _setVisible('bulkStatusBtn',      _can('bulk_edit'));
  _setVisible('btnProductivity',    _can('send_digest'));

  if (_currentRole === 'Academic Instructor') {
    document.querySelectorAll('.btn-override-toggle').forEach(btn => {
      if (btn.textContent.trim() === 'Edit') btn.style.display = 'none';
    });
  }
}

function _setVisible(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? '' : 'none';
}

// ─────────────────────────────────────────────────────────────
// Data loading
// ─────────────────────────────────────────────────────────────
function loadData() {
  setLoading(true);
  _startLoadTimeoutWatch();
  google.script.run
    .withSuccessHandler(onDataLoaded)
    .withFailureHandler(onError)
    .getDashboardData();
}

function refreshData() {
  setLoading(true);
  _startLoadTimeoutWatch();
  google.script.run
    .withSuccessHandler(onDataLoaded)
    .withFailureHandler(onError)
    .refreshData();
}

function _startLoadTimeoutWatch() {
  if (_loadTimeoutHandle) clearTimeout(_loadTimeoutHandle);
  _loadTimeoutHandle = setTimeout(() => {
    const stillLoading = !document.getElementById('loadingState').classList.contains('hidden');
    if (stillLoading) {
      showError("The page is taking much longer than expected to load. This usually means the connection to Google's servers was blocked. Try refreshing, or opening this dashboard in a different browser.");
    }
  }, 25000);
}

function onDataLoaded(result) {
  setLoading(false);
  if (result.error) { showError(result.error); return; }

  allProfiles  = result.profiles || [];
  _hsMonthlyByStudent = result.hsMonthlyByStudent || {};
  _hsMonthlyCohort    = result.hsMonthlyCohort    || [];
  _tradeMonthlyCohort = result.tradeMonthlyCohort || [];
  wirWeekLabel = result.wirWeekLabel || null;

  renderSummaryCards(result.metrics || {});
  applyFilters();


  renderFreshnessBanner(result.lastUpdated, wirWeekLabel);

  document.getElementById('dashContent').classList.remove('hidden');

  if (result.lastUpdated) {
    const d = new Date(result.lastUpdated);
    document.getElementById('lastUpdated').textContent =
      'Updated ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const wirLabel = document.getElementById('wirWeekLabel');
  if (wirLabel && !_currentName) {
    wirLabel.textContent = wirWeekLabel ? 'WIR: ' + wirWeekLabel : '';
  }

  _maybeStartWalkthrough();
}

function onError(err) {
  setLoading(false);
  showError(typeof err === 'string' ? err : (err.message || 'Unknown error'));
}

// ─────────────────────────────────────────────────────────────
// Freshness Banner
// ─────────────────────────────────────────────────────────────
function renderFreshnessBanner(lastUpdated, wirLabel) {
  try {
    const banner  = document.getElementById('freshnessBanner');
    const sources = document.getElementById('freshnessSources');
    if (!banner || !sources) return;
    try { if (sessionStorage.getItem('freshnessDismissed')) return; } catch(e) {}

    const now   = new Date();
    const today = now.getDay();
    const hour  = now.getHours();

    const daysSinceFriday = today === 5 ? (hour >= 17 ? 0 : 7)
                          : today === 6 ? 1 : today === 0 ? 2 : today + 2;
    const lastFriday = new Date(now);
    lastFriday.setDate(now.getDate() - daysSinceFriday);

    const timeUpdateDays = [1, 3, 5];
    let daysSinceTime = 0;
    for (let d = 0; d <= 7; d++) {
      const checkDay = ((today - d) + 7) % 7;
      if (timeUpdateDays.includes(checkDay)) { daysSinceTime = d; break; }
    }

    const fmtDate = d => d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

    const items = [
      { label: 'Academic', sub: 'updates daily',                cls: 'fi-today', tip: 'High School & HiSET data refreshes daily from Edgenuity' },
      { label: 'Trades',   sub: 'as of ' + fmtDate(lastFriday), cls: daysSinceFriday <= 1 ? 'fi-today' : 'fi-week', tip: 'Trade Summary & monthly % data updates every Friday' },
      { label: 'Time',     sub: daysSinceTime === 0 ? 'updated today' : daysSinceTime === 1 ? 'updated yesterday' : daysSinceTime + ' days ago', cls: daysSinceTime <= 1 ? 'fi-today' : daysSinceTime <= 3 ? 'fi-week' : 'fi-old', tip: 'Worked time data updates Monday, Wednesday, and Friday' },
      { label: 'WIR',      sub: wirLabel ? 'week of ' + wirLabel : 'not loaded', cls: wirLabel ? 'fi-week' : 'fi-old', tip: 'Weekly Intervention Report — one report per week' },
    ];

    let sourcesHtml = items.map(i => `
      <span class="freshness-item ${i.cls}" title="${i.tip}">
        <span class="fi-dot"></span>
        <strong>${i.label}</strong>&nbsp;${i.sub}
      </span>`).join('');

    if (lastUpdated) {
      const lastUpdate = new Date(lastUpdated);
      const minsSince  = (Date.now() - lastUpdate.getTime()) / 60000;
      if (minsSince > 20) {
        sourcesHtml += `<span class="freshness-item fi-old">
          <span class="fi-dot"></span>
          <strong>Cache</strong>&nbsp;may be stale — last update ${Math.round(minsSince)} min ago
        </span>`;
      }
    }

    sources.innerHTML = sourcesHtml;
    banner.classList.remove('hidden');
  } catch(e) {}
}

function dismissFreshness() {
  document.getElementById('freshnessBanner').classList.add('hidden');
  try { sessionStorage.setItem('freshnessDismissed', '1'); } catch(e) {}
}

// ─────────────────────────────────────────────────────────────
// Summary Cards
// ─────────────────────────────────────────────────────────────
function renderSummaryCards(m) {
  const container = document.getElementById('summaryCards');
  const rc        = m.riskCounts || {};
  const total         = m.total            || 0;
  const high          = rc.HIGH            || 0;
  const medium        = rc.MEDIUM          || 0;
  const low           = rc.LOW             || 0;
  const unknown       = rc.UNKNOWN         || 0;
  const unmapped      = m.unmapped         || 0;
  const wir           = m.withIntervention || 0;
  const hasNotes      = m.hasNotes         || 0;

  const tradeComplete = allProfiles.filter(p =>
    p.tradeStatusOverride ? p.tradeStatusOverride === 'TRADE_COMPLETE' : !!p.tradeComplete
  ).length;
  const hsComplete = allProfiles.filter(p =>
    p.academicStatusOverride ? p.academicStatusOverride === 'HS_COMPLETE' : !!p.hsComplete
  ).length;

  const cards = [
    { label: 'Total Students',  value: total,        cls: 'accent', sub: 'in the system' },
    { label: 'Needs Attention', value: high,          cls: 'high',   sub: high   === 1 ? 'student' : 'students' },
    { label: 'Watch Closely',   value: medium,        cls: 'medium', sub: medium === 1 ? 'student' : 'students' },
    { label: 'On Track',        value: low,           cls: 'low',    sub: low    === 1 ? 'student' : 'students' },
    { label: 'No Data Yet',     value: unknown,       cls: 'accent', sub: unknown === 1 ? 'student' : 'students' },
    { label: 'Trade Complete',  value: tradeComplete, cls: 'low',    sub: 'finished trades' },
    { label: 'High School Complete', value: hsComplete, cls: 'low', sub: 'finished high school' },
    { label: 'Not Set Up',      value: unmapped,      cls: 'medium', sub: 'missing from map' },
    { label: 'Interventions',   value: wir,           cls: 'high',   sub: 'on WIR this week' },
    { label: 'With Notes',      value: hasNotes,      cls: 'accent', sub: 'have staff notes' },
  ];

  container.innerHTML = cards.map(c => `
    <div class="card card-${c.cls}">
      <div class="card-label">${c.label}</div>
      <div class="card-value ${c.cls}">${c.value}</div>
      <div class="card-sub">${c.sub}</div>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────────
function setRiskFilter(el) {
  document.querySelectorAll('[data-risk]').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  activeRisk = el.dataset.risk;
  applyFilters();
}

function setTypeFilter(el) {
  document.querySelectorAll('[data-type]').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  activeType = el.dataset.type;
  applyFilters();
}

function applyFilters() {
  const filtered = _getFilteredSorted();

  const sortKey     = document.getElementById('sortSelect').value;
  const fingerprint = _currentView + '|' + sortKey + '|' + filtered.map(p => p.id + p.risk.score).join(',');

  const countEl = document.getElementById('resultCount');
  countEl.textContent = `${filtered.length} student${filtered.length !== 1 ? 's' : ''}`;

  if (fingerprint === _lastRenderFingerprint) return;
  _lastRenderFingerprint = fingerprint;

  selectedIds.clear();
  updateBulkBar();

  if      (_currentView === 'cards')  renderCards(filtered);
  else if (_currentView === 'action') renderActionView(filtered);
  else                                renderTable(filtered);
}

function _getFilteredSorted() {
  const search  = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const sortKey = document.getElementById('sortSelect').value;

  let filtered = allProfiles.filter(p => {
    if (activeRisk !== 'ALL' && p.risk.level !== activeRisk) return false;
    if (activeType !== 'ALL') {
      if (activeType === 'HS'             && (!p.academic || p.academic.type !== 'HS'))    return false;
      if (activeType === 'HISET'          && (!p.academic || p.academic.type !== 'HISET')) return false;
      if (activeType === 'TRADES'         && (p.hasAcademic || !p.hasTrades))              return false;
      if (activeType === 'INTERVENTION'   && !p.hasIntervention)                           return false;
      if (activeType === 'TRADE_COMPLETE' && !p.tradeComplete)                             return false;
      if (activeType === 'HS_COMPLETE'    && !p.hsComplete)                                return false;
      if (activeType === 'UNMAPPED'       && !p.mappingMissing)                            return false;
    }
    if (search) {
      const hay = (p.displayName + ' ' + (p.academicId||'') + ' ' + (p.tradesId||'')).toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    switch (sortKey) {
      case 'risk': {
        const o = { HIGH:0, MEDIUM:1, LOW:2, UNKNOWN:3 };
        return (o[a.risk.level]||3) - (o[b.risk.level]||3);
      }
      case 'academicPct':  return (b.academic?.percent ?? -1) - (a.academic?.percent ?? -1);
      case 'tradesPct':    return (b.trades?.[0]?.overallPct ?? -1) - (a.trades?.[0]?.overallPct ?? -1);
      case 'tradeName': {
        const an = (a.tradeNameOverride || a.trades?.[0]?.tarName || (a.tradeComplete ? (a.completedTrades||[])[0] : '') || '').toString();
        const bn = (b.tradeNameOverride || b.trades?.[0]?.tarName || (b.tradeComplete ? (b.completedTrades||[])[0] : '') || '').toString();
        if (!an && !bn) return a.displayName.localeCompare(b.displayName);
        if (!an) return 1; if (!bn) return -1;
        return an.localeCompare(bn) || a.displayName.localeCompare(b.displayName);
      }
      case 'daysLeft': return (a.academic?.daysToGrad ?? 9999) - (b.academic?.daysToGrad ?? 9999);
      default:         return a.displayName.localeCompare(b.displayName);
    }
  });

  return filtered;
}
// ── COUNSELOR FILTER ─────────────────────────────────────────
// Loaded once on dashboard init, persisted to localStorage so
// the selection survives page refreshes.
 
const COUNSELOR_STORAGE_KEY = 'tjc_counselor_filter';
let _counselorList = []; // full list from Staff Roles
let _activeCounselorTrades = null; // Set of trade names, or null = all
 
function initCounselorFilter() {
  google.script.run
    .withSuccessHandler(function(result) {
      if (result.error || !result.counselors || !result.counselors.length) {
        document.getElementById('counselorFilterBar').style.display = 'none';
        return;
      }
      _counselorList = result.counselors;
      const sel = document.getElementById('counselorSelect');
      result.counselors.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = c.name + ' (' + c.trades.join(', ') + ')';
        sel.appendChild(opt);
      });
 
      // Restore saved selection
      const saved = localStorage.getItem(COUNSELOR_STORAGE_KEY);
      if (saved) {
        sel.value = saved;
        if (sel.value) _applySelectedCounselor(saved);
      }
    })
    .withFailureHandler(function() {
      document.getElementById('counselorFilterBar').style.display = 'none';
    })
    .getCounselorList();
}
 
function applyCounselorFilter() {
  const sel  = document.getElementById('counselorSelect');
  const name = sel.value;
  if (!name) {
    clearCounselorFilter();
    return;
  }
  localStorage.setItem(COUNSELOR_STORAGE_KEY, name);
  _applySelectedCounselor(name);
}
 
function _applySelectedCounselor(name) {
  const counselor = _counselorList.find(c => c.name === name);
  if (!counselor) return;

  _activeCounselorTrades = new Set(counselor.trades.map(t => t.toLowerCase()));

  // Update UI chrome
  document.getElementById('counselorClearBtn').style.display = '';
  document.getElementById('counselorFilterLabel').textContent =
    'Showing: ' + counselor.trades.join(', ');

  applyFilters();
}
 
function clearCounselorFilter() {
  _activeCounselorTrades = null;
  localStorage.removeItem(COUNSELOR_STORAGE_KEY);
  document.getElementById('counselorSelect').value = '';
  document.getElementById('counselorClearBtn').style.display = 'none';
  document.getElementById('counselorFilterLabel').textContent = '';
  applyFilters();
}

function _counselorMatchesTrade(trade) {
  if (!_activeCounselorTrades) return true; // no filter active — show all
  return _activeCounselorTrades.has(String(trade || '').toLowerCase());
}
// ─────────────────────────────────────────────────────────────
// Table Rendering
// ─────────────────────────────────────────────────────────────
function renderTable(profiles) {
  const tbody = document.getElementById('studentsBody');
  const noRes = document.getElementById('noResults');

  if (!Array.isArray(profiles) || profiles.length === 0) {
    tbody.innerHTML = '';
    noRes.classList.remove('hidden');
    return;
  }
  noRes.classList.add('hidden');

  tbody.innerHTML = profiles.map(p => {
    const d = _buildStudentDisplay(p);
    const isChecked = selectedIds.has(p.id);
    return `
      <tr class="${isChecked ? 'row-selected' : ''}">
        <td style="width:36px;text-align:center;">
          <input type="checkbox" class="row-check" data-id="${esc(p.id)}"
            ${isChecked ? 'checked' : ''} onchange="toggleRowSelect(this)">
        </td>
        <td>
          <div class="student-name">${esc(p.displayName || 'Unknown')}</div>
          <div class="student-id">
            ${p.academicId ? `<span class="student-id-chip" onclick="copyId(event, '${esc(p.academicId)}')" title="Click to copy ID">ID: ${esc(p.academicId)}</span>` : ''}
            ${p.mappingMissing && !p.hsComplete ? '<span class="type-tag tag-warn">Not Set Up</span>' : ''}
            ${p.statusTag ? `<span class="status-tag-badge">${esc(p.statusTag)}</span>` : ''}
            ${p.isStale ? '<span class="stale-badge">Stale</span>' : ''}
            ${p.notes?.length ? `<span class="notes-badge">${p.notes.length}</span>` : ''}
          </div>
        </td>
        <td>
          <span class="risk-badge risk-${d.riskLevel}">${riskLevelLabel(d.riskLevel)}</span>
          ${d.trendHtml}
        </td>
        <td>${d.academicCell}</td>
        <td class="col-academic-pct col-expandable hidden-col">${progressBar(d.acPct, 'academic')}</td>
        <td>${d.tradesNameCell}</td>
        <td class="col-trade-pct col-expandable hidden-col">${d.tradesPctCell}</td>
        <td>${d.thisWkCell}</td>
        <td class="col-etar col-expandable hidden-col">${d.etarCell}</td>
        <td>${d.intBadge}</td>
        <td>
          <div class="action-btns">
            <button class="detail-btn" data-id="${esc(p.id || '')}">View</button>
            <button class="btn-quick-edit" onclick="openQuickEdit('${esc(p.id || '')}')">Edit</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function interventionBadge(intervention) {
  if (!intervention) return '—';
  const p   = (intervention.adminPriority || intervention.priority || '').toUpperCase();
  const cls = p === 'CRITICAL' ? 'int-critical'
            : p === 'HIGH'     ? 'int-high'
            : p === 'MEDIUM'   ? 'int-medium'
            : 'int-low';
  return `<span class="int-badge ${cls}">${p || 'WIR'}</span>`;
}

function progressBar(pct, type) {
  if (pct === null || pct === undefined) return '<span style="color:var(--text-muted)">—</span>';
  const clamped    = Math.min(Math.max(pct, 0), 100);
  const colorClass = type === 'trades' ? 'trades'
                   : pct >= 75 ? 'good' : pct >= 40 ? 'warning' : 'danger';
  return `<div class="prog-wrap">
    <div class="prog-bar"><div class="prog-fill ${colorClass}" style="width:${clamped}%"></div></div>
    <span class="prog-label">${(+pct).toFixed(0)}%</span>
  </div>`;
}

function riskLevelLabel(level) {
  return { HIGH: 'Needs Attention', MEDIUM: 'Watch Closely', LOW: 'On Track', UNKNOWN: 'No Data Yet' }[level] || level;
}

// ─────────────────────────────────────────────────────────────
// Shared student display computed values
// ─────────────────────────────────────────────────────────────
function _buildStudentDisplay(p) {
  const acPct      = p.academic?.percent ?? null;
  const trPct      = p.trades?.[0]?.overallPct ?? null;
  const daysToETAR = p.trades?.[0]?.daysToETAR ?? null;
  const thisWkHr   = p.academic?.thisWeekHours ?? null;
  const riskLevel  = p.risk?.level || 'UNKNOWN';
  const acadType   = p.academic?.type || '';

  let tradeStatus = 'NOT_STARTED';
  if (p.tradeComplete)                      tradeStatus = 'COMPLETE';
  else if (p.trades && p.trades.length > 0)  tradeStatus = 'ACTIVE';
  const effectiveTradeStatus = p.tradeStatusOverride || tradeStatus;

  const ACADEMIC_STATUS_MAP = {
    HS:          { label: 'HS',          cls: 'tag-hs' },
    HISET:       { label: 'HISET',       cls: 'tag-hiset' },
    HS_COMPLETE: { label: 'HS Complete', cls: 'tag-complete' },
    NOT_STARTED: { label: 'Not Started', cls: 'tag-warn' },
  };
  let academicTag = '';
  if (p.academicStatusOverride) {
    const m = ACADEMIC_STATUS_MAP[p.academicStatusOverride];
    if (m) academicTag = `<span class="type-tag ${m.cls}">${esc(m.label)}</span>`;
  } else if (p.hsComplete) {
    academicTag = '<span class="type-tag tag-complete">HS Complete</span>';
  } else if (acadType) {
    academicTag = `<span class="type-tag tag-${acadType.toLowerCase()}">${acadType}</span>`;
  }

  const TRADE_STATUS_MAP = {
    TRADES:         { label: 'Trades',         cls: 'tag-trades' },
    TRADE_COMPLETE: { label: 'Trade Complete', cls: 'tag-complete' },
    NOT_STARTED:    { label: 'Not Started',    cls: 'tag-warn' },
  };
  let tradesTag = '';
  if (p.tradeStatusOverride) {
    const m = TRADE_STATUS_MAP[p.tradeStatusOverride];
    if (m) tradesTag = `<span class="type-tag ${m.cls}">${esc(m.label)}</span>`;
  } else if (tradeStatus === 'COMPLETE') {
    tradesTag = '<span class="type-tag tag-complete">Trade Complete</span>';
  } else if (tradeStatus === 'ACTIVE') {
    tradesTag = '<span class="type-tag tag-trades">Trades</span>';
  } else {
    tradesTag = '<span class="type-tag tag-warn">Not Started</span>';
  }

  let tradesNameCell = '—';
  if (p.tradeNameOverride) {
    tradesNameCell = esc(p.tradeNameOverride);
  } else if (effectiveTradeStatus === 'ACTIVE' || effectiveTradeStatus === 'TRADES') {
    tradesNameCell = esc(p.trades?.[0]?.tarName || '—');
  } else if (effectiveTradeStatus === 'TRADE_COMPLETE' || effectiveTradeStatus === 'COMPLETE') {
    tradesNameCell = p.completedTrades?.length ? esc(p.completedTrades.join(', ')) : 'Completed';
  } else {
    tradesNameCell = '<span class="type-tag tag-warn">Not Started</span>';
  }

  const tradesPctCell = (effectiveTradeStatus === 'TRADE_COMPLETE' || effectiveTradeStatus === 'COMPLETE')
    ? '<span class="type-tag tag-complete">100%</span>'
    : progressBar(trPct, 'trades');

  const isUSNorNotStarted =
    p.academicStatusOverride === 'NOT_STARTED' ||
    p.tradeStatusOverride    === 'NOT_STARTED' ||
    p.tradeNameOverride      === 'USN'         ||
    (p.trades?.[0]?.tarName?.toUpperCase() === 'USN');

  let thisWkCell;
  if (p.hsComplete) {
    thisWkCell = '<span class="in-trades-badge">Full Time Trades</span>';
  } else if (isUSNorNotStarted && p.hasTrades) {
    thisWkCell = '<span class="in-trades-badge">In Trades</span>';
  } else if (isUSNorNotStarted && !p.hasTrades) {
    thisWkCell = '<span style="color:var(--text-muted);font-size:12px;">—</span>';
  } else if (thisWkHr === 'NWH') {
    thisWkCell = '<span class="in-trades-badge">In Trades</span>';
  } else if (thisWkHr !== null && thisWkHr !== undefined) {
    thisWkCell = (+thisWkHr).toFixed(1) + ' h';
  } else {
    thisWkCell = '—';
  }

  const etarCell = daysToETAR !== null
    ? `<span style="color:${daysToETAR < 30 ? 'var(--high)' : daysToETAR < 90 ? 'var(--medium)' : 'var(--low)'};font-weight:600">${daysToETAR}d</span>`
    : '—';

  const tradeName = p.tradeNameOverride
    || p.trades?.[0]?.tarName
    || (p.tradeComplete ? (p.completedTrades?.[0] || 'Complete') : null);

  return {
    acPct, trPct, riskLevel, acadType, tradeStatus, effectiveTradeStatus,
    academicTag, tradesTag,
    academicCell: academicTag + tradesTag || '<span class="type-tag">—</span>',
    tradesNameCell, tradesPctCell, thisWkCell, etarCell, tradeName,
    intBadge: p.hasIntervention ? interventionBadge(p.intervention) : '—',
    trendHtml: riskTrendIcon(p.riskTrend),
  };
}

// ─────────────────────────────────────────────────────────────
// Detail Modal
// ─────────────────────────────────────────────────────────────
function openModal(id) {
  const p = allProfiles.find(x => x.id === id);
  if (!p) return;

  try {
    currentModalProfile = p;
    document.getElementById('modalName').textContent = p.displayName;
 
    const badges = [];
    if (p.hsComplete)                      badges.push('<span class="type-tag tag-complete">HS Complete</span>');
    if (p.academic)                        badges.push(`<span class="type-tag tag-${(p.academic.type || 'unknown').toLowerCase()}">${p.academic.type || 'Unknown'}</span>`);
    if (p.hasTrades)                       badges.push('<span class="type-tag tag-trades">Trades</span>');
    if (p.tradeComplete)                   badges.push(`<span class="type-tag tag-complete">Trade Complete${p.completedTrades?.length ? ' — ' + esc(p.completedTrades.join(', ')) : ''}</span>`);
    if (p.hasIntervention)                 badges.push(interventionBadge(p.intervention));
    badges.push(`<span class="risk-badge risk-${p.risk.level}">${riskLevelLabel(p.risk.level)}</span>`);
    if (p.mappingMissing && !p.hsComplete) badges.push('<span class="type-tag tag-warn">Not Set Up</span>');
 
    document.getElementById('modalBadges').innerHTML = badges.join('');
    document.getElementById('modalBody').innerHTML   = buildModalBody(p);
    document.getElementById('detailModal').classList.remove('hidden');
  } catch(err) {
    // Log the real detail to the console for debugging, but keep the
    // person's screen calm — a toast, not a debug dump in a blank tab.
    console.error('Error opening modal for', p.displayName, err);
    showToast('Could not open details for ' + p.displayName + ' — try refreshing the page.', 'error');
  }
}

function buildModalBody(p) {
  let left  = '';
  let right = '';

  const score     = p.risk.score || 0;
  const level     = p.risk.level || 'UNKNOWN';
  const levelDesc = level === 'HIGH'   ? 'Needs immediate attention'
                  : level === 'MEDIUM' ? 'Worth watching this week'
                  : level === 'LOW'    ? 'Things look good'
                  : 'Need more data to evaluate this student';

  left += `<div class="risk-score-block">
    <div class="risk-score-ring">
      <div class="risk-score-center">
        <span class="risk-score-number risk-${level}">${score}</span>
        <span class="risk-score-label">/ 100</span>
      </div>
    </div>
    <div class="risk-score-detail">
      <div class="risk-score-level" style="color:var(--${level === 'HIGH' ? 'high' : level === 'MEDIUM' ? 'medium' : level === 'LOW' ? 'low' : 'unknown'})">${riskLevelLabel(level)}</div>
      <div class="risk-score-desc">${levelDesc}</div>
      ${p.risk.flags && p.risk.flags.length ? `<div style="margin-top:6px;font-size:11px;color:var(--text-muted)">${p.risk.flags.length} flag${p.risk.flags.length !== 1 ? 's' : ''} · <button class="risk-info-btn" onclick="showRiskExplainer()">How is this scored?</button></div>` : ''}
    </div>
  </div>`;

  left += buildRiskSparkline(p);

  if (p.statusTag) {
    left += `<div class="info-section">
      <h3>${ICONS.status} Status</h3>
      <span class="status-tag-badge">${esc(p.statusTag)}</span>
    </div>`;
  }

  left += buildOverridePanel(p);
  left += buildNotesSection(p);

  left += `<div class="info-section identity-strip">
    <h3>${ICONS.identity} Identity</h3>
    <div class="identity-row">
      ${p.academicId ? `<span class="id-chip">Academic&nbsp;<strong>${esc(p.academicId)}</strong></span>` : ''}
      ${p.tradesId   ? `<span class="id-chip">Trades&nbsp;<strong>${esc(p.tradesId)}</strong></span>`   : ''}
      <span class="id-chip">${p.mappingMissing ? 'Not in name map' : 'Mapped'}</span>
      ${p.hsComplete    ? '<span class="id-chip tag-complete">HS Complete</span>'    : ''}
      ${p.tradeComplete ? '<span class="id-chip tag-complete">Trade Complete</span>' : ''}
      ${p.lastModified  ? `<span class="id-chip">Modified ${formatTimestamp(p.lastModified)}</span>` : ''}
    </div>
  </div>`;

  if (p.academic) {
    const a = p.academic;
    const thisWkDisplay = a.thisWeekHours === 'NWH' ? 'In Trades this week'
                        : a.thisWeekHours !== null   ? num(a.thisWeekHours) + ' h'
                        : '—';

    left += `<div class="info-section"><h3>${ICONS.academic} Academic</h3>
      <div class="info-row"><span class="label tip" data-tip="The academic program this student is enrolled in.">Type ⓘ</span><span class="value">${esc(a.type || '—')}</span></div>
      <div class="info-row"><span class="label tip" data-tip="Whether the student is on track, ahead, or behind pace.">Pace ⓘ</span><span class="value">${esc(a.pace || '—')}</span></div>
      <div class="info-row"><span class="label tip" data-tip="Overall percentage of academic coursework completed.">Progress ⓘ</span><div class="value">${a.percent !== null ? progressBar(a.percent, 'academic') : '—'}</div></div>
      <div class="info-row"><span class="label tip" data-tip="Total academic hours logged since enrollment.">Total Hours ⓘ</span><span class="value">${num(a.hours)} h</span></div>
      <div class="info-row"><span class="label tip" data-tip="The date the student started their academic program.">Start Date ⓘ</span><span class="value">${esc(a.start || '—')}</span></div>
      <div class="info-row"><span class="label tip" data-tip="The target graduation date.">Graduation Date ⓘ</span><span class="value">${esc(a.graduation || '—')}</span></div>
      <div class="info-row"><span class="label tip" data-tip="Estimated days until graduation based on current progress.">Days to Grad ⓘ</span><span class="value">${a.daysToGrad != null ? a.daysToGrad + ' days' : '—'}</span></div>
      <div class="info-row"><span class="label tip" data-tip="Credits still needed before graduating.">Credits Remaining ⓘ</span><span class="value">${a.credits != null ? a.credits : '—'}</span></div>
      <div class="info-row"><span class="label tip" data-tip="The next course or milestone to complete.">Next Milestone ⓘ</span><span class="value">${esc(a.nextMilestone || '—')}</span></div>
      <div class="info-row"><span class="label tip" data-tip="Deadline for completing the next milestone.">Target Date ⓘ</span><span class="value">${esc(a.targetDate || '—')}</span></div>
      <div class="info-row"><span class="label tip" data-tip="Days remaining until the next milestone target date.">Target Days Left ⓘ</span><span class="value">${a.targetDaysLeft != null ? a.targetDaysLeft + ' days' : '—'}</span></div>
      <div class="info-row"><span class="label tip" data-tip="Academic hours logged so far this week.">This Week ⓘ</span><span class="value">${esc(thisWkDisplay)}</span></div>
      <div class="info-row"><span class="label tip" data-tip="Academic hours logged last week.">Last Week Hrs ⓘ</span><span class="value">${a.lastWeekHours !== null ? num(a.lastWeekHours) + ' h' : '—'}</span></div>
      <div class="info-row"><span class="label tip" data-tip="Course credits earned this week.">This Wk Credits ⓘ</span><span class="value">${num(a.thisWeekCredits)}</span></div>
    </div>`;
  }

  if (p.risk.flags && p.risk.flags.length) {
    const isMedium = level === 'MEDIUM';
    left += `<div class="info-section"><h3>${ICONS.risk} Risk Flags</h3><div class="risk-flags">`;
    p.risk.flags.forEach(f => {
      left += `<div class="risk-flag ${isMedium ? 'medium' : ''}">${esc(f)}</div>`;
    });
    left += '</div></div>';
  }

  if (p.trades && p.trades.length) {
    let tradesHtml = `<div class="info-section"><h3>${ICONS.trades} Trades (${p.trades.length} program${p.trades.length > 1 ? 's' : ''})</h3>`;
    p.trades.forEach(t => {
      tradesHtml += `<div class="trade-card">
        <h4>${esc(t.tarName || '—')}</h4>
        ${infoRowsWithTips([
          ['Status',             t.status    || '—',   'Current enrollment status.'],
          ['Pace Gap',           pct(t.paceGap),       'How far ahead or behind expected pace. Negative = behind.'],
          ['Overall %',          pct(t.overallPct),    'Total percentage of trade program completed.'],
          ['Staff %',            pct(t.staffPct),      'Percentage as recorded by the trade instructor.'],
          ['Student %',          pct(t.studentPct),    'Percentage as self-reported by the student.'],
          ['Enrollment',         t.enrollment || '—',  'Enrollment type for this trade.'],
          ['ETAR Start',         t.etarStart  || '—',  'Date the student started this trade.'],
          ['ETAR Projected End', t.etarProjectedEnd || '—', 'Estimated completion date at current pace.'],
          ['Days to ETAR',       t.daysToETAR != null ? t.daysToETAR + ' days' : '—', 'Days remaining until projected trade completion.'],
          ['Wkly % Change',      t.weeklyPctChange != null ? t.weeklyPctChange + '%' : '—', 'How much trade % changed in the most recent week.'],
        ])}
      </div>`;
    });
    tradesHtml += '</div>';
    right += tradesHtml;
  } else if (p.tradeComplete) {
    let tradesHtml = `<div class="info-section"><h3>${ICONS.trades} Trades</h3>`;
    (p.completedTrades || []).forEach(name => {
      tradesHtml += `<div class="trade-card">
        <h4>${esc(name)}</h4>
        <div class="info-row"><span class="label">Status</span><span class="value">Trade Complete (100%)</span></div>
        <div class="info-row"><span class="label">Note</span><span class="value">No longer on active Trade Summary — completion based on Trade Monthly history.</span></div>
      </div>`;
    });
    tradesHtml += '</div>';
    right += tradesHtml;
  }

  if (p.intervention) right += buildInterventionSection(p.intervention);

  if (p.time) {
    const MONTHS = ['April','May','June','July','August','September'];
    let timeHtml = `<div class="info-section"><h3>${ICONS.time} Time Logged</h3>
      <div class="info-row"><span class="label tip" data-tip="Total hours logged across all time sheets.">Total Hours ⓘ</span><span class="value">${num(p.time.totalHours)} h</span></div>`;

    const sheets    = p.time.sheets || {};
    const monthKeys = Object.keys(sheets).filter(k => MONTHS.some(m => k.startsWith(m)));
    if (monthKeys.length) {
      timeHtml += '<div class="time-months">';
      MONTHS.forEach(month => {
        const monthEntries = Object.entries(sheets).filter(([k]) => k.startsWith(month));
        if (!monthEntries.length) return;
        timeHtml += `<div class="time-month"><div class="time-month-label">${month}</div><div class="time-weeks">`;
        monthEntries.forEach(([key, hrs], i) => {
          const wkLabel = key.replace(month, '').trim() || `W${i+1}`;
          timeHtml += `<div class="time-week"><span class="tw-label">${esc(wkLabel)}</span><span class="tw-val">${num(hrs)}h</span></div>`;
        });
        timeHtml += '</div></div>';
      });
      timeHtml += '</div>';
    } else {
      Object.entries(sheets).forEach(([sheet, hrs]) => {
        timeHtml += `<div class="info-row"><span class="label">${esc(sheet)}</span><span class="value">${num(hrs)} h</span></div>`;
      });
    }
    timeHtml += '</div>';
    right += timeHtml;
  }

  right += buildScheduleSection(p);
  right += buildTABESection(p);
  right += buildHSMonthlySection(p);
  right += buildTradeMonthlySection(p);

  return `<div class="modal-columns">
    <div class="modal-col">${left}</div>
    <div class="modal-col">${right}</div>
  </div>`;
}

function buildInterventionSection(iv) {
  const p = (iv.adminPriority || iv.priority || '').toUpperCase();
  const priorityClass = p === 'CRITICAL' ? 'int-critical'
                      : p === 'HIGH'     ? 'int-high'
                      : p === 'MEDIUM'   ? 'int-medium'
                      : 'int-low';

  let html = `<div class="info-section intervention-section ${priorityClass}-border">
    <h3>${ICONS.wir} Weekly Check-In Report${iv.weekLabel ? `<span class="wir-week-chip">${esc(iv.weekLabel)}</span>` : ''}</h3>`;

  html += `<div class="wir-status-row">
    ${iv.adminPriority ? `<span class="int-badge ${priorityClass}">${esc(iv.adminPriority)}</span>` : ''}
    ${iv.urgency       ? `<span class="urgency-badge urgency-${iv.urgency.toLowerCase()}">${esc(iv.urgency)}</span>` : ''}
    ${iv.status        ? `<span class="wir-status-text">${esc(iv.status)}</span>` : ''}
  </div>`;

  if (iv.gradGap && iv.gradGap.trim()) {
    const g = iv.gradGap.trim();
    const isOver   = g.includes('over limit') || g.startsWith('⛔');
    const isYellow = g.startsWith('🟡');
    // Derived from the same theme tokens as everywhere else, instead of
    // a hand-picked rgba snapshot that only matched the dark theme.
    const bgColor  = isOver ? 'var(--high-glow)' : isYellow ? 'var(--medium-glow)' : 'var(--accent-glow)';
    const txtColor = isOver ? 'var(--high)' : isYellow ? 'var(--medium)' : 'var(--low)';
    html += `<div style="background:${bgColor};border-radius:6px;padding:10px 14px;margin-bottom:10px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:11px;font-weight:600;color:var(--text-muted);">Grad Window</span>
      <span style="font-size:15px;font-weight:700;color:${txtColor}">${esc(g)}</span>
    </div>`;
  }

  if (iv.reason) html += `<div class="wir-reason">${esc(iv.reason)}</div>`;

  html += `<div class="wir-metrics">
    ${iv.percent        ? `<div class="wir-metric"><span class="wm-label">Progress</span><span class="wm-val">${pctStr(iv.percent)}</span></div>` : ''}
    ${iv.thisWeekHours  ? `<div class="wir-metric"><span class="wm-label">This Week</span><span class="wm-val">${esc(iv.thisWeekHours)}</span></div>` : ''}
    ${iv.credits        ? `<div class="wir-metric"><span class="wm-label">Credits</span><span class="wm-val">${esc(iv.credits)}</span></div>` : ''}
    ${iv.courseDaysLeft !== null && iv.courseDaysLeft !== undefined ? `<div class="wir-metric"><span class="wm-label">Course Days</span><span class="wm-val">${esc(String(iv.courseDaysLeft))}</span></div>` : ''}
    ${iv.streak     ? `<div class="wir-metric"><span class="wm-label">Streak</span><span class="wm-val">${esc(iv.streak)}</span></div>` : ''}
    ${iv.trajectory ? `<div class="wir-metric"><span class="wm-label">Trajectory</span><span class="wm-val">${esc(iv.trajectory)}</span></div>` : ''}
  </div>`;

  if (iv.issueTags) {
    const tags = iv.issueTags.split(';').map(t => t.trim()).filter(Boolean);
    if (tags.length) {
      const visible  = tags.slice(0, 3);
      const overflow = tags.slice(3);
      const uid      = 'wir-tags-' + Math.random().toString(36).slice(2, 7);
      html += '<div class="wir-tags">';
      html += visible.map(t => `<span class="wir-tag">${esc(t)}</span>`).join('');
      if (overflow.length) {
        html += `<span class="wir-tag" onclick="
          const el=document.getElementById('${uid}');const btn=this;
          if(el.style.display==='none'){el.style.display='contents';btn.textContent='− less';}
          else{el.style.display='none';btn.textContent='+${overflow.length} more';}
        " style="cursor:pointer;border-color:var(--border-bright);color:var(--accent-mid);">+${overflow.length} more</span>`;
        html += `<span id="${uid}" style="display:none;">${overflow.map(t => `<span class="wir-tag">${esc(t)}</span>`).join('')}</span>`;
      }
      html += '</div>';
    }
  }

  if (iv.instructorAction || iv.coordinatorAction) {
    html += '<div class="wir-actions">';
    if (iv.instructorAction)  html += `<div class="wir-action-box"><div class="wir-action-label">Instructor Action</div><div class="wir-action-text">${esc(iv.instructorAction)}</div></div>`;
    if (iv.coordinatorAction) html += `<div class="wir-action-box"><div class="wir-action-label">Coordinator Action</div><div class="wir-action-text">${esc(iv.coordinatorAction)}</div></div>`;
    html += '</div>';
  }

  const caseRows = [];
  if (iv.caseOwner)  caseRows.push(['Case Owner',  iv.caseOwner]);
  if (iv.caseStatus) caseRows.push(['Case Status', iv.caseStatus]);
  if (iv.focus)      caseRows.push(['Focus',       iv.focus]);
  if (iv.followUp)   caseRows.push(['Follow Up',   iv.followUp]);

  if (caseRows.length || iv.caseNotes) {
    const caseUid = 'case-' + Math.random().toString(36).slice(2, 7);
    html += `<div style="margin-top:8px;">
      <button onclick="
        const el=document.getElementById('${caseUid}');const open=el.style.display!=='none';
        el.style.display=open?'none':'block';
        this.textContent=open?'▸ Case details':'▾ Case details';
      " style="background:none;border:none;cursor:pointer;font-size:11px;font-weight:600;color:var(--text-muted);padding:4px 0;">
        ▸ Case details
      </button>
      <div id="${caseUid}" style="display:none;">
        ${caseRows.length ? infoRows(caseRows) : ''}
        ${iv.caseNotes ? `<div class="wir-notes" style="margin-top:8px;"><div class="wir-notes-label">Case Notes</div><div class="wir-notes-text">${esc(iv.caseNotes)}</div></div>` : ''}
      </div>
    </div>`;
  }

  html += '</div>';
  return html;
}

// ─────────────────────────────────────────────────────────────
// Risk Explainer
// ─────────────────────────────────────────────────────────────
function showRiskExplainer()  { document.getElementById('riskExplainer').classList.remove('hidden'); }
function closeRiskExplainer() { document.getElementById('riskExplainer').classList.add('hidden'); }

// ─────────────────────────────────────────────────────────────
// Modal helpers
// ─────────────────────────────────────────────────────────────
function infoRows(rows) {
  return rows.map(([label, value]) =>
    `<div class="info-row"><span class="label">${esc(label)}</span><span class="value">${esc(String(value ?? '—'))}</span></div>`
  ).join('');
}
function infoRowsWithTips(rows) {
  return rows.map(([label, value, tip]) =>
    `<div class="info-row">
      <span class="label" style="cursor:default;" ${tip ? `title="${esc(tip)}"` : ''}>
        ${esc(label)}${tip ? ' <span style="color:var(--text-muted);font-size:10px;">ⓘ</span>' : ''}
      </span>
      <span class="value">${esc(String(value ?? '—'))}</span>
    </div>`
  ).join('');
}
function closeModal(e) {
  if (e && e.target !== document.getElementById('detailModal')) return;
  document.getElementById('detailModal').classList.add('hidden');
}
function closeModalButton() { document.getElementById('detailModal').classList.add('hidden'); }

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('detailModal').classList.add('hidden');
    document.getElementById('riskExplainer').classList.add('hidden');
    document.getElementById('mergeModal').classList.add('hidden');
    document.getElementById('digestModal').classList.add('hidden');
  }
});
// ── HS Monthly Progress Section ───────────────────────────
function buildHSMonthlySection(p) {
  if (!p.academic || p.academic.type !== 'HS') return '';

  const student = _hsMonthlyByStudent[p.academicId];
  if (!student || !student.months.length) return '';

  const uid = 'hsmonthly-' + (p.id || '').replace(/\W/g, '');

  let html = `<div class="info-section">
    <h3 onclick="toggleSection('${uid}', this)" style="cursor:pointer;">
      ${ICONS.sparkline} Academic Progress Over Time
      <span style="font-size:11px;font-weight:400;color:var(--text-muted);margin-left:6px;">${student.months.length} month${student.months.length !== 1 ? 's' : ''}</span>
      <span style="margin-left:auto;font-size:11px;color:var(--text-muted);">▾</span>
    </h3>
    <div id="${uid}">`;

  const totalGained = student.totalCreditsGained;
  html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;">
    <div style="background:var(--bg4);border:1px solid var(--border);border-radius:6px;padding:10px;text-align:center;">
      <div style="font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Credits at Start</div>
      <div style="font-size:18px;font-weight:700;color:var(--text);">${student.earliestCredits ?? '—'}</div>
    </div>
    <div style="background:var(--bg4);border:1px solid var(--border);border-radius:6px;padding:10px;text-align:center;">
      <div style="font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Credits Now</div>
      <div style="font-size:18px;font-weight:700;color:var(--text);">${student.latestCredits ?? '—'}</div>
    </div>
    <div style="background:var(--bg4);border:1px solid var(--border);border-radius:6px;padding:10px;text-align:center;">
      <div style="font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Total Reduced</div>
      <div style="font-size:18px;font-weight:700;color:${totalGained > 0 ? 'var(--low)' : totalGained < 0 ? 'var(--high)' : 'var(--text)'};">${totalGained > 0 ? '-' + totalGained : totalGained}</div>
    </div>
  </div>`;

  html += `<table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead>
      <tr style="background:var(--bg4);border-bottom:2px solid var(--border);">
        <th style="padding:7px 10px;text-align:left;color:var(--text-muted);font-size:11px;font-weight:700;text-transform:uppercase;">Month</th>
        <th style="padding:7px 10px;text-align:center;color:var(--text-muted);font-size:11px;font-weight:700;text-transform:uppercase;">Start</th>
        <th style="padding:7px 10px;text-align:center;color:var(--text-muted);font-size:11px;font-weight:700;text-transform:uppercase;">End</th>
        <th style="padding:7px 10px;text-align:center;color:var(--text-muted);font-size:11px;font-weight:700;text-transform:uppercase;">Reduced</th>
        <th style="padding:7px 10px;text-align:center;color:var(--text-muted);font-size:11px;font-weight:700;text-transform:uppercase;">Status</th>
      </tr>
    </thead>
    <tbody>`;

  student.months.forEach(m => {
    const gained  = m.creditsGained;
    const color   = m.inProgress ? 'var(--text-muted)'
                  : gained > 0   ? 'var(--low)'
                  : gained === 0 ? 'var(--medium)'
                  : 'var(--high)';
    const gainStr = m.inProgress ? '—'
                  : gained > 0   ? '-' + gained
                  : gained === 0 ? '0'
                  : gained === null ? '—'
                  : '+' + Math.abs(gained) + ' ' + _warnGlyph;
    const status  = m.inProgress ? '<span style="color:var(--text-muted);font-style:italic;">In Progress</span>'
                  : gained === null ? '<span style="color:var(--text-muted);">No Data</span>'
                  : gained < 0   ? `<span style="color:var(--high);">${_warnGlyph} Credits Added</span>`
                  : gained === 0 ? '<span style="color:var(--medium);">No Change</span>'
                  : '<span style="color:var(--low);">✓ Progress</span>';

    html += `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:8px 10px;font-weight:600;color:var(--accent-mid);">${esc(m.month)}</td>
      <td style="padding:8px 10px;text-align:center;">${m.startCredits ?? '—'}</td>
      <td style="padding:8px 10px;text-align:center;">${m.inProgress ? '<span style="color:var(--text-muted);font-style:italic;">Pending</span>' : (m.endCredits ?? '—')}</td>
      <td style="padding:8px 10px;text-align:center;font-weight:700;color:${color};">${gainStr}</td>
      <td style="padding:8px 10px;text-align:center;">${status}</td>
    </tr>`;
  });

  html += `</tbody></table></div></div>`;
  return html;
}

// ── Trade Monthly Progress Section ────────────────────────
function buildTradeMonthlySection(p) {
  if (!p.trades || !p.trades.length) return '';

  const normName = p.displayName.toLowerCase().replace(/[^a-z ]/g, '').trim().split(' ').filter(Boolean).sort().join(' ');
  const tradeRecords = (p.trades || []).map(t => {
    return {
      tarName:  t.tarName,
      monthly:  t.monthlyProgress || [],
    };
  }).filter(t => t.monthly.length > 0);

  if (!tradeRecords.length) return '';

  const uid = 'trademonthly-' + (p.id || '').replace(/\W/g, '');

  let html = `<div class="info-section">
    <h3 onclick="toggleSection('${uid}', this)" style="cursor:pointer;">
      ${ICONS.trades} Trade Progress Over Time
      <span style="margin-left:auto;font-size:11px;color:var(--text-muted);">▾</span>
    </h3>
    <div id="${uid}">`;

  const MONTH_ORDER = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

  tradeRecords.forEach(t => {
    t.monthly = [...t.monthly].sort((a, b) => {
      const [am, ay] = String(a.month).split(' ');
      const [bm, by] = String(b.month).split(' ');
      const aKey = (parseInt(ay) || 0) * 100 + (MONTH_ORDER[(am || '').toLowerCase().slice(0,3)] ?? 0);
      const bKey = (parseInt(by) || 0) * 100 + (MONTH_ORDER[(bm || '').toLowerCase().slice(0,3)] ?? 0);
      return aKey - bKey;
    });

    if (tradeRecords.length > 1) {
      html += `<div style="font-size:13px;font-weight:700;color:var(--accent);margin-bottom:10px;">${esc(t.tarName)}</div>`;
    }

    html += `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px;">
      <thead>
        <tr style="background:var(--bg4);border-bottom:2px solid var(--border);">
          <th style="padding:7px 10px;text-align:left;color:var(--text-muted);font-size:11px;font-weight:700;text-transform:uppercase;">Month</th>
          <th style="padding:7px 10px;text-align:center;color:var(--text-muted);font-size:11px;font-weight:700;text-transform:uppercase;">End %</th>
          <th style="padding:7px 10px;text-align:center;color:var(--text-muted);font-size:11px;font-weight:700;text-transform:uppercase;">Gain</th>
          <th style="padding:7px 10px;text-align:center;color:var(--text-muted);font-size:11px;font-weight:700;text-transform:uppercase;">Status</th>
        </tr>
      </thead>
      <tbody>`;

    t.monthly.forEach(m => {
      const gain    = (m.overallGain    !== undefined) ? m.overallGain    : null;
      const endPct  = (m.endOverallPct  !== undefined) ? m.endOverallPct  : null;
      const isComplete = endPct !== null && endPct >= 100;
      const isStalled  = !m.addedPostFirst && gain !== null && gain < 3;
      const color   = isComplete  ? 'var(--low)'
                    : isStalled   ? 'var(--high)'
                    : (gain !== null && gain > 3) ? 'var(--low)'
                    : 'var(--medium)';
      const status  = isComplete        ? '<span style="color:var(--low);">✓ Complete</span>'
                    : m.addedPostFirst   ? '<span style="color:var(--text-muted);">Added Mid-Program</span>'
                    : isStalled         ? `<span style="color:var(--high);">${_warnGlyph} Stalled</span>`
                    : (gain === null && endPct === null) ? '<span style="color:var(--text-muted);">No Data</span>'
                    : '<span style="color:var(--low);">✓ Progress</span>';

      html += `<tr style="border-bottom:1px solid var(--border);">
        <td style="padding:8px 10px;font-weight:600;color:var(--accent-mid);">${esc(m.month)}</td>
        <td style="padding:8px 10px;text-align:center;">${endPct !== null ? endPct.toFixed(1) + '%' : '—'}</td>
        <td style="padding:8px 10px;text-align:center;font-weight:700;color:${color};">
          ${gain !== null ? '+' + gain.toFixed(1) + '%' : '—'}
        </td>
        <td style="padding:8px 10px;text-align:center;">${status}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
  });

  html += `</div></div>`;
  return html;
}

// ─────────────────────────────────────────────────────────────
// Overrides
// ─────────────────────────────────────────────────────────────
function toggleOverridePanel() {
  const panel = document.getElementById('overridePanel');
  if (panel) panel.classList.toggle('hidden');
}

function buildOverridePanel(p) {
  const ACADEMIC_STATUS_OPTIONS = [
    { value: 'HS',           label: 'HS' },
    { value: 'HISET',        label: 'HISET' },
    { value: 'HS_COMPLETE',  label: 'HS Complete' },
    { value: 'NOT_STARTED',  label: 'Not Started' },
  ];
  const TRADE_STATUS_OPTIONS = [
    { value: 'TRADES',         label: 'Trades' },
    { value: 'TRADE_COMPLETE', label: 'Trade Complete' },
    { value: 'NOT_STARTED',    label: 'Not Started' },
  ];
  const TRADE_NAME_OPTIONS = ['BCT','Carpentry','CNA','Culinary','Security','USN','Pharmacy Technician','OTP in Advanced Manufacturing'];

  const currentAcademicStatus = p.academicStatusOverride || '';
  const currentTradeStatus    = p.tradeStatusOverride    || '';
  const currentTrade          = p.tradeNameOverride      || '';

  return `<div id="overridePanel" class="info-section hidden">
    <h3>${ICONS.overrides} Manual Overrides</h3>
    <div class="override-form">
      <div class="override-row">
        <label>Academic / HS Status</label>
        <select id="ovAcademicStatus">
          <option value="">— No override (use computed) —</option>
          ${ACADEMIC_STATUS_OPTIONS.map(o => `<option value="${o.value}" ${currentAcademicStatus===o.value?'selected':''}>${esc(o.label)}</option>`).join('')}
        </select>
        <div class="override-actions">
          <button class="btn-override" onclick="saveOverride('academic_status')">Save</button>
          <button class="btn-override danger" onclick="clearOverride('academic_status')">Clear</button>
        </div>
      </div>
      <div class="override-row">
        <label>Trades Status</label>
        <select id="ovTradeStatus">
          <option value="">— No override (use computed) —</option>
          ${TRADE_STATUS_OPTIONS.map(o => `<option value="${o.value}" ${currentTradeStatus===o.value?'selected':''}>${esc(o.label)}</option>`).join('')}
        </select>
        <div class="override-actions">
          <button class="btn-override" onclick="saveOverride('trade_status')">Save</button>
          <button class="btn-override danger" onclick="clearOverride('trade_status')">Clear</button>
        </div>
      </div>
      <div class="override-row">
        <label>Trade Name</label>
        <select id="ovTradeName">
          <option value="">— No override (use computed) —</option>
          ${TRADE_NAME_OPTIONS.map(t => `<option value="${esc(t)}" ${currentTrade===t?'selected':''}>${esc(t)}</option>`).join('')}
        </select>
        <div class="override-actions">
          <button class="btn-override" onclick="saveOverride('trade_name')">Save</button>
          <button class="btn-override danger" onclick="clearOverride('trade_name')">Clear</button>
        </div>
      </div>
      <div id="overrideSaved" class="override-saved">Saved — refreshing…</div>
      <div id="overrideError" class="override-error"></div>
    </div>
  </div>`;
}

function saveOverride(type) {
  if (!currentModalProfile) return;
  const id = currentModalProfile.id;
  let value = '';
  if      (type === 'academic_status') { value = document.getElementById('ovAcademicStatus').value; if (!value) { clearOverride(type); return; } }
  else if (type === 'trade_status')    { value = document.getElementById('ovTradeStatus').value;    if (!value) { clearOverride(type); return; } }
  else if (type === 'trade_name')      { value = document.getElementById('ovTradeName').value;      if (!value) { clearOverride(type); return; } }
  applyOverrideLocally(id, type, value);
  google.script.run.withFailureHandler(err => onOverrideError(id, err)).setOverride(id, type, value, '', _currentEmployeeId, _currentRole);
}

function clearOverride(type) {
  if (!currentModalProfile) return;
  const id = currentModalProfile.id;
  applyOverrideLocally(id, type, '');
  google.script.run.withFailureHandler(err => onOverrideError(id, err)).setOverride(id, type, '', '', 'staff');
}

function applyOverrideLocally(id, type, value) {
  const p = allProfiles.find(x => x.id === id);
  if (!p) return;
  if      (type === 'academic_status') p.academicStatusOverride = value || null;
  else if (type === 'trade_status')    p.tradeStatusOverride    = value || null;
  else if (type === 'trade_name')      p.tradeNameOverride      = value || null;
  currentModalProfile = p;
  applyFilters();
  openModal(id);
  const flash = document.getElementById('overrideSaved');
  if (flash) { flash.classList.add('show'); setTimeout(() => flash.classList.remove('show'), 1500); }
}

function onOverrideError(id, err) {
  const msg = typeof err === 'string' ? err : (err?.message || 'Save failed — please try again.');
  const box = document.getElementById('overrideError');
  if (box) { box.textContent = msg; box.classList.add('show'); setTimeout(() => box.classList.remove('show'), 4000); }
}

// ─────────────────────────────────────────────────────────────
// Merge Students
// ─────────────────────────────────────────────────────────────
function openMergeModal()        { renderMergePanel(); document.getElementById('mergeModal').classList.remove('hidden'); }
function closeMergeModal(e)      { if (e && e.target !== document.getElementById('mergeModal')) return; document.getElementById('mergeModal').classList.add('hidden'); }
function closeMergeModalButton() { document.getElementById('mergeModal').classList.add('hidden'); }

function _mergeSourceSummary(p) {
  const parts = [];
  if (p.academic)        parts.push(p.academic.type || 'Academic');
  if (p.hasTrades)       parts.push('Trades: ' + (p.trades?.[0]?.tarName || '?'));
  if (p.tradeComplete)   parts.push('Trade Complete');
  if (p.hasTime)         parts.push('Time logged');
  if (p.hasIntervention) parts.push('WIR');
  if (!parts.length)     parts.push('No data');
  return parts.join(', ');
}

function renderMergePanel(sourceId, targetId) {
  const sorted  = [...allProfiles].sort((a, b) => a.displayName.localeCompare(b.displayName));
  const options = sorted.map(p => `<option value="${esc(p.id)}">${esc(p.displayName)} — ${esc(_mergeSourceSummary(p))}</option>`).join('');
  const source  = sourceId ? allProfiles.find(x => x.id === sourceId) : null;
  const target  = targetId ? allProfiles.find(x => x.id === targetId) : null;

  let preview = '';
  if (source && target) {
    if (source.id === target.id) {
      preview = `<div class="merge-warning">Source and target are the same student — pick two different profiles.</div>`;
    } else {
      preview = `<div class="merge-preview"><b>${esc(source.displayName)}</b> will be merged into <b>${esc(target.displayName)}</b>.<br><br>
        Any data the target is missing will be copied from the source. The target's existing data takes priority.
        <b>${esc(source.displayName)}</b> will no longer appear after the next refresh.</div>
      <div class="merge-warning">${_warnGlyph} This cannot be easily undone. Double-check these are the same person before merging.</div>`;
    }
  } else {
    preview = `<div class="merge-preview">Select the duplicate profile (source) and the one to keep (target).</div>`;
  }

  const canMerge = source && target && source.id !== target.id;
  document.getElementById('mergePanelBody').innerHTML = `
    <div class="merge-row"><label>Duplicate profile (will be merged away)</label>
      <select id="mergeSource" onchange="onMergeSelectChange()"><option value="">— Select student —</option>${options}</select></div>
    <div class="merge-row"><label>Keep this profile (merge target)</label>
      <select id="mergeTarget" onchange="onMergeSelectChange()"><option value="">— Select student —</option>${options}</select></div>
    ${preview}
    <div class="override-actions">
      <button class="btn-override" ${canMerge ? '' : 'disabled style="opacity:.5;cursor:not-allowed;"'} onclick="confirmMergeWithDialog()">Merge</button>
      <button class="btn-override danger" onclick="closeMergeModalButton()">Cancel</button>
    </div>
    <div id="mergeError" class="override-error"></div>
    <div id="mergeSaved" class="override-saved">Merged — refreshing…</div>
  `;
  if (sourceId) document.getElementById('mergeSource').value = sourceId;
  if (targetId) document.getElementById('mergeTarget').value = targetId;
}

function onMergeSelectChange() {
  renderMergePanel(document.getElementById('mergeSource').value, document.getElementById('mergeTarget').value);
}

function confirmMergeWithDialog() {
  const sourceId = document.getElementById('mergeSource').value;
  const targetId = document.getElementById('mergeTarget').value;
  if (!sourceId || !targetId || sourceId === targetId) return;
  const source = allProfiles.find(x => x.id === sourceId);
  const target = allProfiles.find(x => x.id === targetId);
  if (!source || !target) return;
  themedConfirm(
    `"${source.displayName}" will be removed from the dashboard after the next refresh. This is difficult to undo.`,
    { title: `Merge "${source.displayName}" into "${target.displayName}"?`, okLabel: 'Merge', danger: true }
  ).then(ok => {
    if (ok) confirmMerge(sourceId, targetId);
  });
}

function confirmMerge(sourceId, targetId) {
  const btn = document.querySelector('#mergePanelBody .btn-override');
  if (btn) { btn.disabled = true; btn.textContent = 'Merging…'; }
  google.script.run
    .withSuccessHandler(() => {
      const flash = document.getElementById('mergeSaved');
      if (flash) flash.classList.add('show');
      google.script.run
        .withSuccessHandler(result => { onDataLoaded(result); closeMergeModalButton(); })
        .withFailureHandler(onError)
        .refreshData();
    })
    .withFailureHandler(err => {
      const msg = typeof err === 'string' ? err : (err?.message || 'Merge failed — please try again.');
      const box = document.getElementById('mergeError');
      if (box) { box.textContent = msg; box.classList.add('show'); }
      if (btn) { btn.disabled = false; btn.textContent = 'Merge'; }
    })
    .mergeStudents(sourceId, targetId, _currentEmployeeId, _currentRole);
}

// ── Schedule upload ──────────────────────────────────────────
function openScheduleUpload() {
  document.getElementById('scheduleUploadModal').classList.remove('hidden');
  document.getElementById('scheduleFileInput').value = '';
  document.getElementById('scheduleUploadStatus').textContent = '';
  document.getElementById('scheduleUploadStatus').className = 'schedule-status';
  document.getElementById('scheduleUploadBtn').disabled = true;
  document.getElementById('schedulePreview').innerHTML = '';
  document.getElementById('schedulePreview').classList.add('hidden');
}

function closeScheduleUpload() {
  document.getElementById('scheduleUploadModal').classList.add('hidden');
}

function onScheduleFileSelected(input) {
  const file = input.files[0];
  if (!file) return;

  const status = document.getElementById('scheduleUploadStatus');
  status.textContent = 'Reading file…';
  status.className = 'schedule-status';

  if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
    status.textContent = '✕ Please upload an .xls or .xlsx file.';
    status.className = 'schedule-status err';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const bytes  = new Uint8Array(e.target.result);
      let binary   = '';
      const chunk  = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);

      const preview = document.getElementById('schedulePreview');
      preview.innerHTML = `
        <div class="schedule-preview-row">
          <span class="sp-label">File</span><span class="sp-val">${file.name}</span>
        </div>
        <div class="schedule-preview-row">
          <span class="sp-label">Size</span><span class="sp-val">${(file.size / 1024).toFixed(1)} KB</span>
        </div>
        <div class="schedule-preview-row">
          <span class="sp-label">Status</span><span class="sp-val" style="color:var(--ok)">Ready to upload</span>
        </div>
      `;
      preview.classList.remove('hidden');
      preview.dataset.base64 = base64;

      status.textContent = 'Ready to upload — parsing will happen on the server.';
      status.className = 'schedule-status ok';
      document.getElementById('scheduleUploadBtn').disabled = false;

    } catch(err) {
      status.textContent = '✕ Could not read file: ' + err.message;
      status.className = 'schedule-status err';
    }
  };
  reader.readAsArrayBuffer(file);
}


function confirmScheduleUpload() {
  const preview = document.getElementById('schedulePreview');
  const base64  = preview.dataset.base64;
  if (!base64) return;

  const btn    = document.getElementById('scheduleUploadBtn');
  const status = document.getElementById('scheduleUploadStatus');

  btn.disabled       = true;
  btn.textContent    = 'Uploading…';
  status.textContent = 'Sending to server…';
  status.className   = 'schedule-status';

  google.script.run
    .withSuccessHandler(function(result) {
      btn.textContent = 'Upload Schedule';
      if (result.error) {
        status.textContent = '✕ ' + result.error;
        status.className   = 'schedule-status err';
        btn.disabled       = false;
        return;
      }

      if (result.skippedCount && result.skippedCount > 0) {
        const skippedNames = (result.skipped || [])
          .map(s => s.name ? s.name : (s.sheet ? 'Tab: ' + s.sheet : 'Unknown'))
          .join(', ');
        status.innerHTML = `
          <div style="color:var(--ok);margin-bottom:6px;">✓ Saved ${result.studentCount} student${result.studentCount !== 1 ? 's' : ''} for ${esc(result.weekLabel)}</div>
          <div style="color:var(--warn);font-size:12px;">${_warnGlyph} ${result.skippedCount} skipped: ${esc(skippedNames)}</div>
          <div style="margin-top:10px;">
            <button class="btn-override" onclick="closeScheduleUpload()" style="max-width:160px;">Close</button>
          </div>`;
        status.className = 'schedule-status';
        // Don't auto-close so staff can read the skipped list
      } else {
        status.textContent = `✓ Saved ${result.studentCount} student${result.studentCount !== 1 ? 's' : ''} for ${result.weekLabel}`;
        status.className   = 'schedule-status ok';
        setTimeout(() => closeScheduleUpload(), 1800);
      }
    })
    .withFailureHandler(function(err) {
      btn.textContent    = 'Upload Schedule';
      btn.disabled       = false;
      status.textContent = '✕ Upload failed: ' + (err?.message || 'Please try again.');
      status.className   = 'schedule-status err';
    })
    .saveWeeklySchedule(base64, _currentRole);
}
function openTABEUpload() {
  document.getElementById('tabeUploadModal').classList.remove('hidden');
  document.getElementById('tabeFileInput').value       = '';
  document.getElementById('tabeUploadStatus').textContent = '';
  document.getElementById('tabeUploadStatus').className   = 'schedule-status';
  document.getElementById('tabeUploadBtn').disabled       = true;
  document.getElementById('tabePreview').innerHTML        = '';
  document.getElementById('tabePreview').classList.add('hidden');
}
 
function closeTABEUpload() {
  document.getElementById('tabeUploadModal').classList.add('hidden');
}
 
function onTABEFileSelected(input) {
  const file   = input.files[0];
  const status = document.getElementById('tabeUploadStatus');
  if (!file) return;
 
  status.textContent = 'Reading file…';
  status.className   = 'schedule-status';
 
  if (!file.name.toLowerCase().endsWith('.xls') && !file.name.toLowerCase().endsWith('.xlsx')) {
    status.textContent = '✕ Please upload the .xls file exported from CIS.';
    status.className   = 'schedule-status err';
    return;
  }
 
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const bytes  = new Uint8Array(e.target.result);
      let   binary = '';
      const chunk  = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
 
      const preview = document.getElementById('tabePreview');
      preview.innerHTML = `
        <div class="schedule-preview-row"><span class="sp-label">File</span><span class="sp-val">${esc(file.name)}</span></div>
        <div class="schedule-preview-row"><span class="sp-label">Size</span><span class="sp-val">${(file.size / 1024).toFixed(1)} KB</span></div>
        <div class="schedule-preview-row"><span class="sp-label">Status</span><span class="sp-val" style="color:var(--ok)">Ready to upload</span></div>
      `;
      preview.classList.remove('hidden');
      preview.dataset.base64 = base64;
 
      status.textContent = 'Ready to upload.';
      status.className   = 'schedule-status ok';
      document.getElementById('tabeUploadBtn').disabled = false;
    } catch(err) {
      status.textContent = '✕ Could not read file: ' + err.message;
      status.className   = 'schedule-status err';
    }
  };
  reader.readAsArrayBuffer(file);
}
 
function confirmTABEUpload() {
  const preview = document.getElementById('tabePreview');
  const base64  = preview.dataset.base64;
  if (!base64) return;
 
  const btn    = document.getElementById('tabeUploadBtn');
  const status = document.getElementById('tabeUploadStatus');
  btn.disabled    = true;
  btn.textContent = 'Uploading…';
  status.textContent = 'Sending to server…';
  status.className   = 'schedule-status';
 
  google.script.run
    .withSuccessHandler(function(result) {
      btn.textContent = 'Upload Scores';
      if (result.error) {
        status.textContent = '✕ ' + result.error;
        status.className   = 'schedule-status err';
        btn.disabled       = false;
        return;
      }
 
      if (result.skippedCount && result.skippedCount > 0) {
        const skippedNames = (result.skipped || []).map(s => s.name || s.id).join(', ');
        status.innerHTML = `
          <div style="color:var(--ok);margin-bottom:6px;">✓ Loaded ${result.studentCount} students from report dated ${esc(result.reportDate)}</div>
          <div style="color:var(--warn);font-size:12px;">${_warnGlyph} ${result.skippedCount} skipped (no valid tests): ${esc(skippedNames)}</div>
          <div style="margin-top:10px;"><button class="btn-override" onclick="closeTABEUpload()" style="max-width:160px;">Close</button></div>`;
        status.className = 'schedule-status';
      } else {
        status.textContent = `✓ Loaded ${result.studentCount} students from report dated ${result.reportDate}`;
        status.className   = 'schedule-status ok';
        setTimeout(() => closeTABEUpload(), 1800);
      }
    })
    .withFailureHandler(function(err) {
      btn.textContent    = 'Upload Scores';
      btn.disabled       = false;
      status.textContent = '✕ Upload failed: ' + (err && err.message ? err.message : 'Please try again.');
      status.className   = 'schedule-status err';
    })
    .uploadTABEData(base64, _currentRole);

}
// ─────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────
function setLoading(on) {
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('errorState').classList.add('hidden');

  if (!on && _loadTimeoutHandle) { clearTimeout(_loadTimeoutHandle); _loadTimeoutHandle = null; }

  if (on) {
    document.getElementById('dashContent').classList.remove('hidden');
    document.getElementById('noResults').classList.add('hidden');

    const skeletonRow = () => `
      <tr class="skeleton-row">
        <td><div class="skeleton-cell short"></div></td>
        <td><div class="skeleton-cell wide"></div></td>
        <td><div class="skeleton-cell short"></div></td>
        <td><div class="skeleton-cell med"></div></td>
        <td><div class="skeleton-cell med"></div></td>
        <td><div class="skeleton-cell short"></div></td>
        <td><div class="skeleton-cell med"></div></td>
        <td><div class="skeleton-cell short"></div></td>
        <td><div class="skeleton-cell short"></div></td>
        <td><div class="skeleton-cell short"></div></td>
        <td><div class="skeleton-cell med"></div></td>
      </tr>`;

    document.getElementById('studentsBody').innerHTML =
      Array(12).fill(0).map(skeletonRow).join('');

    document.getElementById('summaryCards').innerHTML =
      Array(9).fill(0).map(() => `
        <div class="card card-neutral" style="min-height:108px;">
          <div class="skeleton-cell short" style="margin-bottom:12px;height:10px;"></div>
          <div class="skeleton-cell med"   style="height:28px;margin-bottom:8px;"></div>
          <div class="skeleton-cell wide"  style="height:10px;"></div>
        </div>`).join('');
  } else {
    document.getElementById('dashContent').classList.remove('hidden');
  }
}

function showError(msg) {
  document.getElementById('errorState').classList.remove('hidden');
  document.getElementById('errorMsg').textContent = msg;
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function pct(v)    { return v !== null && v !== undefined ? (+v).toFixed(1) + '%' : '—'; }
function pctStr(v) {
  if (v === null || v === undefined || v === '') return '—';
  const n = parseFloat(String(v).replace('%', ''));
  return isNaN(n) ? '—' : n.toFixed(1) + '%';
}
function num(v) { return v !== null && v !== undefined ? (+v).toFixed(1) : '—'; }

function formatTimestamp(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
      + ', ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch(e) { return '—'; }
}

// ─────────────────────────────────────────────────────────────
// Click-to-copy student ID
// ─────────────────────────────────────────────────────────────
function copyId(event, id) {
  event.stopPropagation();
  const el   = event.currentTarget;
  const orig = el.textContent;

  function _showCopied() {
    el.textContent = 'Copied!';
    el.classList.add('copied');
    setTimeout(() => { el.textContent = orig; el.classList.remove('copied'); }, 1500);
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(id).then(_showCopied).catch(() => {
      // Clipboard API failed (e.g. non-HTTPS); fall back
      const ta = document.createElement('textarea');
      ta.value = id; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      _showCopied();
    });
  } else {
    const ta = document.createElement('textarea');
    ta.value = id; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    _showCopied();
  }
}

// ─────────────────────────────────────────────────────────────
// Quick Edit Drawer
// ─────────────────────────────────────────────────────────────
let _qeStudentId = null;

function openQuickEdit(id) {
  const p = allProfiles.find(x => x.id === id);
  if (!p) return;
  _qeStudentId = id;
  document.getElementById('qeStudentName').textContent  = p.displayName;
  document.getElementById('qeAcademicStatus').value     = p.academicStatusOverride || '';
  document.getElementById('qeTradeStatus').value        = p.tradeStatusOverride    || '';
  document.getElementById('qeTradeName').value          = p.tradeNameOverride      || '';
  document.getElementById('qeNoteInput').value          = '';
  const status = document.getElementById('qeStatus');
  status.textContent = ''; status.className = 'qe-status';
  document.getElementById('qeSaveBtn').disabled = false;
  document.getElementById('qeDrawer').classList.add('open');
  document.getElementById('qeOverlay').classList.add('open');
}

function closeQuickEdit() {
  document.getElementById('qeDrawer').classList.remove('open');
  document.getElementById('qeOverlay').classList.remove('open');
  _qeStudentId = null;
}

// ─────────────────────────────────────────────────────────────
// Change History
// ─────────────────────────────────────────────────────────────
function openHistoryPanel() {
  document.getElementById('historyModal').classList.remove('hidden');
  document.getElementById('historyList').innerHTML = '';
  document.getElementById('historyEmpty').classList.add('hidden');
  document.getElementById('historyLoading').style.display = 'block';
  google.script.run
    .withSuccessHandler(renderHistory)
    .withFailureHandler(err => {
      document.getElementById('historyLoading').style.display = 'none';
      document.getElementById('historyList').innerHTML =
        `<p style="color:var(--high);font-size:13px;">${esc(err?.message || 'Failed to load history.')}</p>`;
    })
    .getRecentChanges();
}

function closeHistoryModal(e) {
  if (e && e.target !== document.getElementById('historyModal')) return;
  document.getElementById('historyModal').classList.add('hidden');
}

const HISTORY_TYPE_LABELS = {
  academic_status: { label: 'Academic status' },
  trade_status:    { label: 'Trade status'    },
  trade_name:      { label: 'Trade name'      },
  risk_level:      { label: 'Risk level'      },
  flag_add:        { label: 'Flag added'       },
  flag_remove:     { label: 'Flag removed'     },
  status_tag:      { label: 'Status tag'       },
  note:            { label: 'Note added'       },
  staff_note:      { label: 'Staff note'       },
};

function renderHistory(changes) {
  document.getElementById('historyLoading').style.display = 'none';
  if (!changes || !changes.length) {
    document.getElementById('historyEmpty').classList.remove('hidden');
    return;
  }

  const list = document.getElementById('historyList');
  list.innerHTML = changes.map(c => {
    const meta    = HISTORY_TYPE_LABELS[c.type] || { label: c.type };
    const profile = allProfiles.find(x => x.id === c.studentId);
    const name    = profile ? profile.displayName : c.studentId;
    const when    = c.date ? formatTimestamp(c.date) : '—';
    const who     = c.setBy || 'staff';

    let valueDisplay = esc(c.value);
    if (c.type === 'note' && c.value && c.value.length > 60) valueDisplay = esc(c.value.slice(0, 60)) + '…';

    const canRevert = c.type !== 'note' && c.type !== 'staff_note';
    const initials  = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    return `<div class="history-item">
      <div class="history-icon">${initials}</div>
      <div class="history-detail">
        <div class="history-name">${esc(name)}</div>
        <div class="history-change">${esc(meta.label)}${c.value ? ` → <strong>${valueDisplay}</strong>` : ''}</div>
        <div class="history-meta">by ${esc(who)} · ${when}</div>
      </div>
      ${canRevert ? `<button class="btn-revert" onclick="confirmRevert(this,'${esc(c.studentId)}','${esc(c.type)}',${c.rowIndex})">Undo</button>` : ''}
    </div>`;
  }).join('');
}

function confirmRevert(btn, studentId, type, rowIndex) {
  themedConfirm(
    `The override will be removed and the dashboard will recompute that field.`,
    { title: `Undo this "${type}" change?`, okLabel: 'Undo', danger: true }
  ).then(ok => {
    if (!ok) return;
    btn.disabled = true; btn.textContent = '…';
    google.script.run
      .withSuccessHandler(() => {
        const p = allProfiles.find(x => x.id === studentId);
        if (p) {
          if (type === 'academic_status') p.academicStatusOverride = null;
          if (type === 'trade_status')    p.tradeStatusOverride    = null;
          if (type === 'trade_name')      p.tradeNameOverride      = null;
          if (type === 'risk_level')      p.risk.overridden        = false;
          if (type === 'status_tag')      p.statusTag              = null;
        }
        applyFilters();
        btn.textContent = 'Done'; btn.style.color = 'var(--low)'; btn.style.borderColor = 'color-mix(in srgb, var(--low) 30%, transparent)';
      })
      .withFailureHandler(err => {
        btn.disabled = false; btn.textContent = 'Undo';
        showToast(err?.message || 'Revert failed — please try again.', 'error');
      })
      .revertChange(studentId, type, rowIndex, _currentRole);
  });
}

// ─────────────────────────────────────────────────────────────
// First-Visit Walkthrough
// ─────────────────────────────────────────────────────────────
const WT_STEPS = [
  { title: 'Welcome', body: 'This is the student progress dashboard for Tulsa Job Corps. It pulls from your academic, trades, and intervention data automatically. Here\'s a quick look at the four things you\'ll use most.', target: null, position: 'center' },
  { title: 'Start with the red ones', body: 'Students marked Needs Attention have the highest risk scores based on academic pace, trade progress, and WIR flags. Check this filter first thing each morning.', target: '[data-risk="HIGH"]', position: 'below' },
  { title: 'Action view cuts through the noise', body: 'Switch to Action view when you want students grouped by what actually needs doing — critical interventions, graduation deadlines coming up, students with no hours this week.', target: '#btnActionView', position: 'below' },
  { title: 'Edit without opening the full record', body: 'The Edit button on each row lets you update a student\'s program, trade, or leave a note in a few seconds. You don\'t need to open the full detail view for quick changes.', target: '.btn-quick-edit', position: 'left' },
  { title: 'You\'re set', body: 'Use the filter chips to narrow the list. The menu in the top right has exports, merge tools, and change history. If something looks wrong on a student record, the Edit button is your first stop.', target: null, position: 'center' },
];
let _wtStep = 0;

function startWalkthrough() { _wtStep = 0; document.getElementById('wtBackdrop').classList.add('active'); _renderWtStep(); }

function skipWalkthrough() {
  document.getElementById('wtBackdrop').classList.remove('active');
  document.getElementById('wtSpotlight').style.display = 'none';
  document.getElementById('wtTooltip').style.display   = 'none';
  try {
    const key = 'dashWalkthroughDone_' + (_currentEmployeeId || 'anon');
    localStorage.setItem(key, '1');
  } catch(e) {}
}

function walkthroughNext() {
  _wtStep++;
  if (_wtStep >= WT_STEPS.length) { skipWalkthrough(); return; }
  _renderWtStep();
}

function _renderWtStep() {
  const step      = WT_STEPS[_wtStep];
  const spotlight = document.getElementById('wtSpotlight');
  const tooltip   = document.getElementById('wtTooltip');
  const isLast    = _wtStep === WT_STEPS.length - 1;

  document.getElementById('wtDots').innerHTML = WT_STEPS.map((_, i) =>
    `<div class="wt-dot ${i === _wtStep ? 'active' : ''}"></div>`).join('');
  document.getElementById('wtStepLabel').textContent = `Step ${_wtStep + 1} of ${WT_STEPS.length}`;
  document.getElementById('wtTitle').textContent     = step.title;
  document.getElementById('wtBody').textContent      = step.body;
  document.getElementById('wtNextBtn').textContent   = isLast ? 'Done' : 'Next →';

  if (step.target) {
    const el = document.querySelector(step.target);
    if (el) {
      const r = el.getBoundingClientRect(); const pad = 6;
      spotlight.style.display = 'block';
      spotlight.style.top     = (r.top    - pad) + 'px';
      spotlight.style.left    = (r.left   - pad) + 'px';
      spotlight.style.width   = (r.width  + pad * 2) + 'px';
      spotlight.style.height  = (r.height + pad * 2) + 'px';
      tooltip.style.display = 'block';
      tooltip.style.transform = '';
      const TW = 300, TH = 200, vw = window.innerWidth, vh = window.innerHeight;
      if (step.position === 'below')     { tooltip.style.top = Math.min(r.bottom + pad + 12, vh - TH - 16) + 'px'; tooltip.style.left = Math.min(Math.max(r.left, 16), vw - TW - 16) + 'px'; }
      else if (step.position === 'left') { tooltip.style.top = Math.max(r.top, 16) + 'px'; tooltip.style.left = Math.max(r.left - TW - 20, 16) + 'px'; }
      else                               { tooltip.style.top = Math.min(r.bottom + 12, vh - TH - 16) + 'px'; tooltip.style.left = Math.min(Math.max(r.left, 16), vw - TW - 16) + 'px'; }
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
  }
  spotlight.style.display = 'none';
  tooltip.style.display   = 'block';
  tooltip.style.top = '50%'; tooltip.style.left = '50%'; tooltip.style.transform = 'translate(-50%, -50%)';
}

function _maybeStartWalkthrough() {
  try {
    const key = 'dashWalkthroughDone_' + (_currentEmployeeId || 'anon');
    if (localStorage.getItem(key)) return;
  } catch(e) { return; }
  setTimeout(startWalkthrough, 800);
}

// ─────────────────────────────────────────────────────────────
// View Toggle
// ─────────────────────────────────────────────────────────────
let _currentView = 'table';

function setView(view) {
  _currentView = view;
  document.getElementById('btnTableView').classList.toggle('active',  view === 'table');
  document.getElementById('btnCardView').classList.toggle('active',   view === 'cards');
  document.getElementById('btnActionView').classList.toggle('active', view === 'action');
  document.querySelector('.table-wrap').classList.toggle('hidden', view !== 'table');
  document.getElementById('cardsGrid').classList.toggle('hidden',   view !== 'cards');
  document.getElementById('actionView').classList.toggle('hidden',  view !== 'action');
  try { localStorage.setItem('dashView', view); } catch(e) {}
  applyFilters();
}

function renderCards(profiles) {
  const grid = document.getElementById('cardsGrid');
  if (!grid) return;
  if (!profiles.length) { grid.innerHTML = ''; return; }

  grid.innerHTML = profiles.map(p => {
    const d       = _buildStudentDisplay(p);
    const level   = p.risk?.level || 'UNKNOWN';
    const score   = p.risk?.score ?? 0;
    const flags   = (p.risk?.flags || []).slice(0, 2);
    const gradGap = p.intervention?.gradGap?.trim() || null;

    let gwColor = 'var(--text-muted)';
    if (gradGap) {
      if (gradGap.includes('over limit') || gradGap.startsWith('⛔')) gwColor = 'var(--high)';
      else if (gradGap.startsWith('🟡')) gwColor = 'var(--medium)';
      else gwColor = 'var(--low)';
    }

    const barColor = d.acPct >= 75 ? 'var(--low)' : d.acPct >= 40 ? 'var(--medium)' : d.acPct !== null ? 'var(--high)' : 'var(--bg4)';

    return `
      <div class="student-card card-risk-${level}">
        <div class="sc-top">
          <div class="sc-name-wrap">
            <div class="sc-name">${esc(p.displayName)}</div>
            <div class="sc-sub">
              ${p.academic ? `<span class="type-tag tag-${p.academic.type.toLowerCase()}" style="margin:0">${p.academic.type}</span>` : ''}
              ${d.tradeName ? `<span class="type-tag tag-trades" style="margin:0">${esc(d.tradeName)}</span>` : ''}
              ${p.isStale ? '<span class="stale-badge" style="margin:0">Stale</span>' : ''}
            </div>
          </div>
          <div class="sc-score ${level}" title="Risk score">${score}</div>
        </div>
        <div class="sc-bars">
          ${d.acPct !== null ? `<div class="sc-bar-row"><span class="sc-bar-label">Academic</span><div class="sc-bar-wrap"><div class="sc-bar-fill" style="width:${Math.min(d.acPct,100)}%;background:${barColor}"></div></div><span class="sc-bar-pct">${d.acPct.toFixed(0)}%</span></div>` : ''}
          ${d.trPct !== null ? `<div class="sc-bar-row"><span class="sc-bar-label">Trade</span><div class="sc-bar-wrap"><div class="sc-bar-fill" style="width:${Math.min(d.trPct,100)}%;background:var(--accent-dim)"></div></div><span class="sc-bar-pct">${d.trPct.toFixed(0)}%</span></div>` : ''}
        </div>
        ${flags.length ? `<div class="sc-flags">${flags.map(f => `<div class="sc-flag ${level === 'MEDIUM' ? 'medium' : ''}">${esc(f)}</div>`).join('')}</div>` : ''}
        <div class="sc-footer">
          ${gradGap ? `<span class="sc-grad-window" style="color:${gwColor}">${esc(gradGap)}</span>` : '<span class="sc-grad-window" style="color:var(--text-muted)">—</span>'}
          ${d.intBadge}
          <div style="display:flex;gap:6px;margin-left:auto;">
            <button class="detail-btn" data-id="${esc(p.id)}" style="padding:4px 10px;font-size:11px;">View</button>
            <button class="btn-quick-edit" onclick="openQuickEdit('${esc(p.id)}')" style="font-size:11px;">Edit</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────
// Action Needed View
// ─────────────────────────────────────────────────────────────
function renderActionView(profiles) {
  const container = document.getElementById('actionGroups');
  const dateEl    = document.getElementById('actionViewDate');
  if (!container) return;
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  const groups = [
    { key: 'grad_critical', icon: ICONS.blocked,     cls: 'critical', title: 'Over Program Limit',               sub: 'Graduation window has passed — immediate action required',       test: p => (p.intervention?.gradGap || '').includes('over limit') },
    { key: 'wir_critical',  icon: ICONS.alertTri,    cls: 'critical', title: 'Critical Intervention This Week',  sub: 'Admin priority is CRITICAL in the latest WIR',                   test: p => (p.intervention?.adminPriority || '').toUpperCase() === 'CRITICAL' },
    { key: 'grad_watch',    icon: ICONS.calendar,    cls: 'high',     title: 'Graduation Deadline — Under 60 Days', sub: 'Students approaching the two-year program limit',             test: p => { const g = p.intervention?.gradGap || ''; if (g.includes('over limit')) return false; if (g.startsWith('🟡')) return true; const m = g.match(/(\d+)d left/); return !!m && parseInt(m[1], 10) <= 60; } },
    { key: 'wir_high',      icon: ICONS.flag,        cls: 'high',     title: 'High Intervention Priority',        sub: 'Admin priority is HIGH in the latest WIR',                      test: p => { const pri = (p.intervention?.adminPriority || '').toUpperCase(); const critg = p.intervention?.gradGap || ''; return pri === 'HIGH' && !critg.includes('over limit'); } },
    { key: 'followup',      icon: ICONS.checkCircle, cls: 'follow',   title: 'Follow-Up Due',                     sub: 'WIR follow-up date is today or in the past',                    test: p => { if (!p.intervention?.followUp) return false; const d = new Date(p.intervention.followUp); if (isNaN(d.getTime())) return false; const t = new Date(); t.setHours(0,0,0,0); return d <= t; } },
    { key: 'no_hours',      icon: ICONS.clock,       cls: 'medium',   title: 'No Academic Hours This Week',       sub: 'Students with zero hours logged so far this week',               test: p => { const h = p.academic?.thisWeekHours; return h !== 'NWH' && (h === null || h === 0) && p.hasAcademic; } },
    { key: 'stale',         icon: ICONS.noData,      cls: 'medium',   title: 'No Recent Progress Updates',        sub: 'Progress % unchanged for 3+ weeks — possible data gap',          test: p => p.isStale === true },
  ];

  const placed = new Set();
  container.innerHTML = groups.map((g, groupIdx) => {
    const members = profiles.filter(p => { if (placed.has(p.id)) return false; return g.test(p); });
    members.forEach(p => placed.add(p.id));
    const bodyId  = 'ag-body-' + groupIdx;
    const isEmpty = members.length === 0;

    const rows = isEmpty
      ? `<div class="action-empty">No students in this group right now.</div>`
      : members.map(p => {
          const acPct = p.academic?.percent ?? null;
          const trPct = p.trades?.[0]?.overallPct ?? null;
          const gradG = p.intervention?.gradGap?.trim() || '';
          const wir   = p.intervention ? interventionBadge(p.intervention) : '';
          let detail  = '';
          if (acPct !== null) detail += `Academic ${acPct.toFixed(0)}%`;
          if (trPct !== null) detail += (detail ? ' · ' : '') + `Trade ${trPct.toFixed(0)}%`;
          if (gradG)          detail += (detail ? ' · ' : '') + gradG;
          return `<div class="action-row">
            <div class="ar-name-wrap">
              <div class="ar-name">${esc(p.displayName)}</div>
              <div class="ar-detail">${esc(detail || '—')}</div>
            </div>
            <div class="ar-badges">${wir}${p.isStale ? '<span class="stale-badge" style="margin:0">Stale</span>' : ''}</div>
            <div class="ar-actions">
              <button class="detail-btn" data-id="${esc(p.id)}" style="padding:4px 10px;font-size:11px;">View</button>
              <button class="btn-quick-edit" onclick="openQuickEdit('${esc(p.id)}')" style="font-size:11px;">Edit</button>
            </div>
          </div>`;
        }).join('');

    return `
      <div class="action-group">
        <div class="action-group-header" onclick="toggleActionGroup(this, '${bodyId}')">
          <div class="ag-icon ${g.cls}">${g.icon}</div>
          <div class="ag-label"><div class="ag-title">${g.title}</div><div class="ag-sub">${g.sub}</div></div>
          <div class="ag-count ${g.cls}">${members.length}</div>
          <span class="ag-chevron ${isEmpty ? 'collapsed' : ''}">▾</span>
        </div>
        <div class="action-group-body ${isEmpty ? 'hidden' : ''}" id="${bodyId}">${rows}</div>
      </div>`;
  }).join('');
}

function toggleActionGroup(header, bodyId) {
  const body    = document.getElementById(bodyId);
  const chevron = header.querySelector('.ag-chevron');
  if (!body) return;
  const isHidden = body.classList.contains('hidden');
  body.classList.toggle('hidden', !isHidden);
  chevron.classList.toggle('collapsed', !isHidden);
  header.classList.toggle('collapsed', !isHidden);
}

async function saveQuickEdit() {
  if (!_qeStudentId) return;
  const id        = _qeStudentId;
  const acStatus  = document.getElementById('qeAcademicStatus').value;
  const trStatus  = document.getElementById('qeTradeStatus').value;
  const tradeName = document.getElementById('qeTradeName').value;
  const noteText  = (document.getElementById('qeNoteInput').value || '').trim();
  const statusEl  = document.getElementById('qeStatus');
  const btn       = document.getElementById('qeSaveBtn');

  if (!acStatus && !trStatus && !tradeName && !noteText) {
    statusEl.textContent = 'Nothing to save — make a change first.';
    statusEl.className   = 'qe-status err show';
    return;
  }

  btn.disabled = true; btn.textContent = 'Saving…';
  statusEl.textContent = ''; statusEl.className = 'qe-status';

  const saves = [];
  if (acStatus)  saves.push(() => new Promise(res => google.script.run.withSuccessHandler(res).withFailureHandler(res).setOverride(id, 'academic_status', acStatus, '', 'staff')));
  if (trStatus)  saves.push(() => new Promise(res => google.script.run.withSuccessHandler(res).withFailureHandler(res).setOverride(id, 'trade_status',    trStatus,  '', 'staff')));
  if (tradeName) saves.push(() => new Promise(res => google.script.run.withSuccessHandler(res).withFailureHandler(res).setOverride(id, 'trade_name',      tradeName, '', 'staff')));
  if (noteText)  saves.push(() => new Promise(res => google.script.run.withSuccessHandler(res).withFailureHandler(res).addStudentNote(id, noteText, _currentEmployeeId, _currentRole)));

  for (const fn of saves) await fn();

  const p = allProfiles.find(x => x.id === id);
  if (p) {
    if (acStatus)  p.academicStatusOverride = acStatus;
    if (trStatus)  p.tradeStatusOverride    = trStatus;
    if (tradeName) p.tradeNameOverride      = tradeName;
    if (noteText)  { if (!p.notes) p.notes = []; p.notes.unshift({ text: noteText, setBy: 'staff', date: new Date().toISOString() }); }
  }
  applyFilters();
  btn.textContent = 'Save Changes'; btn.disabled = false;
  statusEl.textContent = 'Saved!'; statusEl.className = 'qe-status show';
  setTimeout(() => { statusEl.className = 'qe-status'; closeQuickEdit(); }, 1200);
}

// ─────────────────────────────────────────────────────────────
// CSV Export
// ─────────────────────────────────────────────────────────────
function exportCSV() {
  const filtered = _getFilteredSorted();
  const headers  = ['Student','ID','Risk Level','Risk Score','Stale','Academic Type','Academic %','Pace','Days to Grad','This Week Hrs','Trade Name','Trade %','Trade Status','Days to ETAR','WIR Priority','WIR Urgency','Has Intervention','Total Time Hrs','Last Modified','Notes Count','Not Set Up'];
  const csvRows  = [headers];

  filtered.forEach(p => {
    const effectiveTradeStatus = p.tradeStatusOverride || (p.tradeComplete ? 'COMPLETE' : p.hasTrades ? 'ACTIVE' : 'NOT_STARTED');
    const tradeName = p.tradeNameOverride || p.trades?.[0]?.tarName || (p.tradeComplete ? (p.completedTrades||[]).join('; ') : '');
    csvRows.push([
      p.displayName, p.academicId || '', p.risk.level, p.risk.score, p.isStale ? 'Yes' : 'No',
      p.academic?.type || '', p.academic?.percent ?? '', p.academic?.pace || '', p.academic?.daysToGrad ?? '',
      p.academic?.thisWeekHours === 'NWH' ? 'In Trades' : (p.academic?.thisWeekHours ?? ''),
      tradeName, p.trades?.[0]?.overallPct ?? (p.tradeComplete ? 100 : ''), effectiveTradeStatus,
      p.trades?.[0]?.daysToETAR ?? '', p.intervention?.adminPriority || '', p.intervention?.urgency || '',
      p.hasIntervention ? 'Yes' : 'No', p.time?.totalHours ?? '',
      p.lastModified ? formatTimestamp(p.lastModified) : '', (p.notes || []).length, p.mappingMissing ? 'Yes' : 'No',
    ]);
  });

  const csv  = csvRows.map(row => row.map(cell => { const s = String(cell ?? '').replace(/"/g,'""'); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s; }).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'students_' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
// Staff Notes
// ─────────────────────────────────────────────────────────────
function buildNotesSection(p) {
  const notes = (p.notes || []).slice().sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1);

  let html = `<div id="notesSection" class="info-section"><h3>${ICONS.notes} Staff Notes</h3>`;

  if (notes.length) {
    html += '<div class="notes-list">';
    notes.forEach(n => {
      const ts    = n.date ? formatTimestamp(n.date) : '';
      const tsRaw = n.date || '';
      html += `<div class="note-item">
        <div class="note-meta">
          <span class="note-author">${esc(n.setBy || 'Staff')}</span>
          <span class="note-date">${ts}</span>
          <button class="note-delete" onclick="deleteNote('${esc(p.id)}','${esc(tsRaw)}')" title="Delete note">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="note-text">${esc(n.text)}</div>
      </div>`;
    });
    html += '</div>';
  } else {
    html += '<div class="note-empty">No notes yet.</div>';
  }

  html += `<div class="note-add">
    <textarea id="noteInput" class="note-textarea" placeholder="Add a note…" rows="2"></textarea>
    <button class="btn-override" onclick="saveNote('${esc(p.id)}')">Add Note</button>
    <div id="noteSaved" class="override-saved">Note saved</div>
    <div id="noteError"  class="override-error"></div>
  </div></div>`;

  return html;
}

function saveNote(studentId) {
  const input = document.getElementById('noteInput');
  const text  = (input ? input.value : '').trim();
  if (!text) return;
  input.disabled = true;
  google.script.run
    .withSuccessHandler(() => {
      const flash = document.getElementById('noteSaved');
      if (flash) { flash.classList.add('show'); setTimeout(() => flash.classList.remove('show'), 1500); }
      const p = allProfiles.find(x => x.id === studentId);
      if (p) {
        if (!p.notes) p.notes = [];
        p.notes.unshift({ text, setBy: 'staff', date: new Date().toISOString() });
        currentModalProfile = p;
        openModal(studentId);
      }
    })
    .withFailureHandler(err => {
      const box = document.getElementById('noteError');
      if (box) { box.textContent = (err?.message || 'Save failed — try again.'); box.classList.add('show'); setTimeout(() => box.classList.remove('show'), 4000); }
      if (input) input.disabled = false;
    })
    .addStudentNote(studentId, text, _currentEmployeeId, _currentRole);
}

function deleteNote(studentId, noteTimestamp) {
  themedConfirm('This note will be permanently removed.', { title: 'Delete this note?', okLabel: 'Delete', danger: true }).then(ok => {
    if (!ok) return;
    google.script.run
      .withSuccessHandler(() => {
        const p = allProfiles.find(x => x.id === studentId);
        if (p && p.notes) {
          p.notes = p.notes.filter(n => (n.date || '') !== noteTimestamp);
          currentModalProfile = p;
          openModal(studentId);
        }
      })
      .withFailureHandler(err => showToast(err?.message || 'Delete failed — try again.', 'error'))
      .deleteStudentNote(studentId, noteTimestamp, _currentRole);
  });
}

// ─────────────────────────────────────────────────────────────
// Risk Trend Arrow
// ─────────────────────────────────────────────────────────────
function riskTrendIcon(trend) {
  if (!trend) return '';
  if (trend === 'up')     return '<span class="trend-up"    title="Risk increasing">▲</span>';
  if (trend === 'down')   return '<span class="trend-down"  title="Risk decreasing">▼</span>';
  if (trend === 'stable') return '<span class="trend-stable" title="Risk stable">→</span>';
  return '';
}

// ─────────────────────────────────────────────────────────────
// Filter Presets
// ─────────────────────────────────────────────────────────────
const BUILTIN_PRESETS = {
  '__high_risk':        { risk: 'HIGH', type: 'ALL',            search: '' },
  '__unmapped':         { risk: 'ALL',  type: 'UNMAPPED',       search: '' },
  '__has_wir':          { risk: 'ALL',  type: 'INTERVENTION',   search: '' },
  '__trade_complete':   { risk: 'ALL',  type: 'TRADE_COMPLETE', search: '' },
  '__high_risk_trades': { risk: 'HIGH', type: 'TRADES',         search: '' },
  '__stale':            { risk: 'ALL',  type: 'ALL',            search: '', staleOnly: true },
};

function applyPreset(value) {
  if (!value) return;
  document.getElementById('presetSelect').value = '';
  const preset = BUILTIN_PRESETS[value] || _loadCustomPresets()[value];
  if (!preset) return;
  const riskBtn = document.querySelector(`[data-risk="${preset.risk || 'ALL'}"]`);
  if (riskBtn) { document.querySelectorAll('[data-risk]').forEach(b => b.classList.remove('active')); riskBtn.classList.add('active'); activeRisk = preset.risk || 'ALL'; }
  const typeBtn = document.querySelector(`[data-type="${preset.type || 'ALL'}"]`);
  if (typeBtn) { document.querySelectorAll('[data-type]').forEach(b => b.classList.remove('active')); typeBtn.classList.add('active'); activeType = preset.type || 'ALL'; }
  const searchEl = document.getElementById('searchInput');
  if (searchEl) searchEl.value = preset.search || '';

  if (preset.staleOnly) {
    _staleOnlyActive = true;
  } else {
    _staleOnlyActive = false;
  }
  applyFilters();
}

let _staleOnlyActive = false;

const _originalGetFilteredSorted = _getFilteredSorted;
// Override to inject stale filtering
function _getFilteredSorted() {
  let results = allProfiles.filter(p => {
    if (activeRisk !== 'ALL' && p.risk.level !== activeRisk) return false;
    if (activeType !== 'ALL') {
      if (activeType === 'HS'             && (!p.academic || p.academic.type !== 'HS'))    return false;
      if (activeType === 'HISET'          && (!p.academic || p.academic.type !== 'HISET')) return false;
      if (activeType === 'TRADES'         && (p.hasAcademic || !p.hasTrades))              return false;
      if (activeType === 'INTERVENTION'   && !p.hasIntervention)                           return false;
      if (activeType === 'TRADE_COMPLETE' && !p.tradeComplete)                             return false;
      if (activeType === 'UNMAPPED'       && !p.mappingMissing)                            return false;
    }
    const search = (document.getElementById('searchInput').value || '').toLowerCase().trim();
    if (search) {
      const hay = (p.displayName + ' ' + (p.academicId||'') + ' ' + (p.tradesId||'')).toLowerCase();
      if (!hay.includes(search)) return false;
    }

    if (_staleOnlyActive && !p.isStale) return false;

    // Counselor trade filter
    if (_activeCounselorTrades) {
      const tradeName = (
        p.tradeNameOverride ||
        p.trades?.[0]?.tarName ||
        (p.tradeComplete ? (p.completedTrades?.[0] || '') : '')
      ).toLowerCase();
      if (!_activeCounselorTrades.has(tradeName)) return false;
    }

    return true;
  });

  const sortKey = document.getElementById('sortSelect').value;
  results.sort((a, b) => {
    switch (sortKey) {
      case 'risk': {
        const o = { HIGH:0, MEDIUM:1, LOW:2, UNKNOWN:3 };
        return (o[a.risk.level]||3) - (o[b.risk.level]||3);
      }
      case 'academicPct':  return (b.academic?.percent ?? -1) - (a.academic?.percent ?? -1);
      case 'tradesPct':    return (b.trades?.[0]?.overallPct ?? -1) - (a.trades?.[0]?.overallPct ?? -1);
      case 'tradeName': {
        const an = (a.tradeNameOverride || a.trades?.[0]?.tarName || (a.tradeComplete ? (a.completedTrades||[])[0] : '') || '').toString();
        const bn = (b.tradeNameOverride || b.trades?.[0]?.tarName || (b.tradeComplete ? (b.completedTrades||[])[0] : '') || '').toString();
        if (!an && !bn) return a.displayName.localeCompare(b.displayName);
        if (!an) return 1; if (!bn) return -1;
        return an.localeCompare(bn) || a.displayName.localeCompare(b.displayName);
      }
      case 'daysLeft': return (a.academic?.daysToGrad ?? 9999) - (b.academic?.daysToGrad ?? 9999);
      default:         return a.displayName.localeCompare(b.displayName);
    }
  });

  return results;
}

function savePreset() {
  themedPrompt('Give this filter combination a name so you can reuse it later.', '', { title: 'Save preset' }).then(name => {
    if (!name) return;
    const key    = 'custom_' + Date.now();
    const preset = { name: name.trim(), risk: activeRisk, type: activeType, search: (document.getElementById('searchInput').value || '').trim() };
    const existing = _loadCustomPresets();
    existing[key] = preset;
    try { localStorage.setItem('dashPresets', JSON.stringify(existing)); } catch(e) {}
    _renderCustomPresets();
  });
}

function _loadCustomPresets() {
  try { return JSON.parse(localStorage.getItem('dashPresets') || '{}'); } catch(e) { return {}; }
}

function _renderCustomPresets() {
  const group = document.getElementById('customPresetsGroup');
  if (!group) return;
  const presets = _loadCustomPresets();
  const keys    = Object.keys(presets);
  group.innerHTML = keys.length
    ? keys.map(k => `<option value="${esc(k)}">${esc(presets[k].name)}</option>`).join('')
    : '<option disabled>No custom presets yet</option>';
}

function _wirePresetSelectListener() {
  const presetEl = document.getElementById('presetSelect');
  if (!presetEl) return;
  presetEl.addEventListener('change', function() {
    const val = this.value;
    if (!val || val.startsWith('__')) return;
    const presets = _loadCustomPresets();
    if (!presets[val]) return;
    applyPreset(val);
  });
}

// Also clear stale filter when chips are clicked manually
const _origSetRiskFilter = setRiskFilter;
setRiskFilter = function(el) { _staleOnlyActive = false; _origSetRiskFilter(el); };
const _origSetTypeFilter = setTypeFilter;
setTypeFilter = function(el) { _staleOnlyActive = false; _origSetTypeFilter(el); };

// ─────────────────────────────────────────────────────────────
// Bulk Selection
// ─────────────────────────────────────────────────────────────
function toggleRowSelect(checkbox) {
  const id = checkbox.dataset.id;
  if (checkbox.checked) { selectedIds.add(id); checkbox.closest('tr').classList.add('row-selected'); }
  else                  { selectedIds.delete(id); checkbox.closest('tr').classList.remove('row-selected'); }
  updateBulkBar();
  const allChecks   = document.querySelectorAll('.row-check');
  const allChecked  = [...allChecks].every(c => c.checked);
  const someChecked = [...allChecks].some(c => c.checked);
  const selectAll   = document.getElementById('selectAll');
  if (selectAll) { selectAll.checked = allChecked; selectAll.indeterminate = someChecked && !allChecked; }
}

function toggleSelectAll(checkbox) {
  document.querySelectorAll('.row-check').forEach(c => {
    c.checked = checkbox.checked;
    const id = c.dataset.id;
    if (checkbox.checked) { selectedIds.add(id); c.closest('tr').classList.add('row-selected'); }
    else                  { selectedIds.delete(id); c.closest('tr').classList.remove('row-selected'); }
  });
  updateBulkBar();
}

function clearSelection() {
  selectedIds.clear();
  document.querySelectorAll('.row-check').forEach(c => { c.checked = false; c.closest('tr').classList.remove('row-selected'); });
  const sa = document.getElementById('selectAll');
  if (sa) { sa.checked = false; sa.indeterminate = false; }
  updateBulkBar();
}

function updateBulkBar() {
  const bar   = document.getElementById('bulkBar');
  const count = document.getElementById('bulkCount');
  if (!bar) return;
  if (selectedIds.size >= 2) { bar.classList.remove('hidden'); count.textContent = `${selectedIds.size} students selected`; }
  else                       { bar.classList.add('hidden'); }
}

// ─────────────────────────────────────────────────────────────
// Collapsible extra columns
// ─────────────────────────────────────────────────────────────
let _colsExpanded = false;

function toggleExtraCols() {
  _colsExpanded = !_colsExpanded;
  document.querySelectorAll('.col-expandable').forEach(el => el.classList.toggle('hidden-col', !_colsExpanded));
  const btn = document.getElementById('expandColsBtn');
  if (btn) { btn.textContent = _colsExpanded ? '－' : '＋'; btn.classList.toggle('open', _colsExpanded); btn.title = _colsExpanded ? 'Hide extra columns' : 'Show more columns'; }
  try { localStorage.setItem('dashColsExpanded', _colsExpanded ? '1' : ''); } catch(e) {}
}

// ─────────────────────────────────────────────────────────────
// Bulk Actions
// ─────────────────────────────────────────────────────────────
function closeBulkModal(e, id) { if (e && e.target !== document.getElementById(id)) return; document.getElementById(id).classList.add('hidden'); }

function openBulkNote() {
  const n = selectedIds.size;
  document.getElementById('bulkNoteDesc').textContent = `This note will be added to all ${n} selected students.`;
  document.getElementById('bulkNoteInput').value = '';
  document.getElementById('bulkNoteProgress').textContent = '';
  const errEl = document.getElementById('bulkNoteError');
  if (errEl) { errEl.textContent = ''; errEl.classList.remove('show'); }
  document.getElementById('bulkNoteModal').classList.remove('hidden');
}

function openBulkStatus() {
  const n = selectedIds.size;
  document.getElementById('bulkStatusDesc').textContent = `Status overrides will be applied to all ${n} selected students. Leave a field blank to skip it.`;
  document.getElementById('bulkAcademicStatus').value = '';
  document.getElementById('bulkTradeStatus').value    = '';
  document.getElementById('bulkStatusProgress').textContent = '';
  const errEl = document.getElementById('bulkStatusError');
  if (errEl) { errEl.textContent = ''; errEl.classList.remove('show'); }
  document.getElementById('bulkStatusModal').classList.remove('hidden');
}

async function confirmBulkNote() {
  const text = (document.getElementById('bulkNoteInput').value || '').trim();
  if (!text) return;

  const ids  = [...selectedIds];
  const prog = document.getElementById('bulkNoteProgress');
  prog.textContent = `Saving note for ${ids.length} students…`;

  google.script.run
    .withSuccessHandler(function(result) {
      prog.textContent = `✓ Note added to ${result.count} students.`;
      ids.forEach(id => {
        const p = allProfiles.find(x => x.id === id);
        if (p) {
          if (!p.notes) p.notes = [];
          p.notes.unshift({ text, setBy: _currentEmployeeId, date: new Date().toISOString() });
        }
      });
      applyFilters();
      setTimeout(() => {
        document.getElementById('bulkNoteModal').classList.add('hidden');
        clearSelection();
      }, 1500);
    })
    .withFailureHandler(function(err) {
      const msg = err?.message || 'Save failed — please try again.';
      prog.textContent = '';
      const box = document.getElementById('bulkNoteError');
      box.textContent = msg.includes('lock') || msg.includes('saving')
        ? 'Another change is in progress — wait a moment and try again.'
        : msg;
      box.classList.add('show');
    })
    .bulkAddNote(ids, text, _currentEmployeeId, _currentRole);
}

async function confirmBulkStatus() {
  const acStatus = document.getElementById('bulkAcademicStatus').value;
  const trStatus = document.getElementById('bulkTradeStatus').value;
  if (!acStatus && !trStatus) { showToast('Select at least one status to apply.', 'error'); return; }

  const ids  = [...selectedIds];
  const prog = document.getElementById('bulkStatusProgress');
  prog.textContent = `Applying to ${ids.length} students…`;

  google.script.run
    .withSuccessHandler(function(result) {
      prog.textContent = `✓ Applied to ${result.count} students.`;
      ids.forEach(id => {
        const p = allProfiles.find(x => x.id === id);
        if (p) {
          if (acStatus) p.academicStatusOverride = acStatus;
          if (trStatus) p.tradeStatusOverride    = trStatus;
        }
      });
      applyFilters();
      setTimeout(() => {
        document.getElementById('bulkStatusModal').classList.add('hidden');
        clearSelection();
      }, 1500);
    })
    .withFailureHandler(function(err) {
      const msg = err?.message || 'Save failed — please try again.';
      prog.textContent = '';
      const box = document.getElementById('bulkStatusError');
      box.textContent = msg.includes('lock') || msg.includes('saving')
        ? 'Another change is in progress — wait a moment and try again.'
        : msg;
      box.classList.add('show');
    })
    .bulkSetStatus(ids, acStatus, trStatus, _currentEmployeeId, _currentRole);
}

// ─────────────────────────────────────────────────────────────
// Risk Sparkline
// ─────────────────────────────────────────────────────────────
function buildRiskSparkline(p) {
  const snaps = (p.progressSnapshots || []).filter(s => s.score !== null && s.score !== undefined && s.date).sort((a, b) => a.date < b.date ? -1 : 1);
  if (snaps.length < 2) return '';

  const W = 260, H = 72, PAD = { t: 8, r: 8, b: 20, l: 28 };
  const innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b;
  const scores = snaps.map(s => s.score);
  const minS   = Math.max(0,   Math.min(...scores) - 10);
  const maxS   = Math.min(100, Math.max(...scores) + 10);
  const range  = maxS - minS || 1;
  const xScale = i => PAD.l + (i / (snaps.length - 1)) * innerW;
  const yScale = s => PAD.t + innerH - ((s - minS) / range) * innerH;
  const points   = snaps.map((s, i) => `${xScale(i).toFixed(1)},${yScale(s.score).toFixed(1)}`);
  const path     = 'M' + points.join('L');
  const fillPath = path + `L${xScale(snaps.length-1).toFixed(1)},${(PAD.t+innerH).toFixed(1)}L${PAD.l.toFixed(1)},${(PAD.t+innerH).toFixed(1)}Z`;
  const latest    = snaps[snaps.length - 1].score;
  const lineColor = latest >= 60 ? 'var(--high)' : latest >= 30 ? 'var(--medium)' : 'var(--low)';
  const fillColor = latest >= 60 ? 'color-mix(in srgb, var(--high) 12%, transparent)' : latest >= 30 ? 'color-mix(in srgb, var(--medium) 12%, transparent)' : 'color-mix(in srgb, var(--low) 12%, transparent)';
  const fmtDate   = d => { try { const dt = new Date(d); return (dt.getMonth()+1) + '/' + dt.getDate(); } catch(e) { return d; } };
  const dots      = snaps.map((s, i) => { const cx = xScale(i).toFixed(1), cy = yScale(s.score).toFixed(1), c = s.score >= 60 ? 'var(--high)' : s.score >= 30 ? 'var(--medium)' : 'var(--low)'; return `<circle cx="${cx}" cy="${cy}" r="3" fill="${c}" stroke="var(--bg3)" stroke-width="1.5"><title>${fmtDate(s.date)}: ${s.score}</title></circle>`; }).join('');
  const y30 = yScale(30).toFixed(1), y60 = yScale(60).toFixed(1);

  return `<div class="info-section sparkline-section">
    <h3>${ICONS.sparkline} Risk Score History <span style="font-weight:400;font-size:11px;color:var(--text-muted);">(${snaps.length} snapshots)</span></h3>
    <svg viewBox="0 0 ${W} ${H}" width="100%" style="overflow:visible;">
      ${minS < 60 && maxS > 60 ? `<line x1="${PAD.l}" y1="${y60}" x2="${W-PAD.r}" y2="${y60}" stroke="color-mix(in srgb, var(--high) 25%, transparent)" stroke-width="1" stroke-dasharray="3,3"/><text x="${PAD.l-4}" y="${y60}" text-anchor="end" font-size="8" fill="var(--text-muted)" dominant-baseline="middle">60</text>` : ''}
      ${minS < 30 && maxS > 30 ? `<line x1="${PAD.l}" y1="${y30}" x2="${W-PAD.r}" y2="${y30}" stroke="color-mix(in srgb, var(--medium) 25%, transparent)" stroke-width="1" stroke-dasharray="3,3"/><text x="${PAD.l-4}" y="${y30}" text-anchor="end" font-size="8" fill="var(--text-muted)" dominant-baseline="middle">30</text>` : ''}
      <path d="${fillPath}" fill="${fillColor}"/>
      <path d="${path}" fill="none" stroke="${lineColor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      <text x="${PAD.l}" y="${H-4}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${fmtDate(snaps[0].date)}</text>
      <text x="${W-PAD.r}" y="${H-4}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${fmtDate(snaps[snaps.length-1].date)}</text>
      <text x="${xScale(snaps.length-1).toFixed(1)}" y="${(yScale(latest)-7).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="${lineColor}">${latest}</text>
    </svg>
  </div>`;
}

// ─────────────────────────────────────────────────────────────
// Print student detail
// ─────────────────────────────────────────────────────────────
function printStudentDetail() { window.print(); }

// ─────────────────────────────────────────────────────────────
// Role-based presets
// ─────────────────────────────────────────────────────────────
const ROLE_PRESETS = {
  manager:   { risk: 'ALL',  type: 'ALL',          search: '', sort: 'risk',        label: 'Manager view' },
  counselor: { risk: 'ALL',  type: 'INTERVENTION', search: '', sort: 'risk',        label: 'Counselor view' },
  teacher:   { risk: 'HIGH', type: 'ALL',          search: '', sort: 'academicPct', label: 'Teacher view' },
};

function applyRolePreset(role) {
  if (!role) return;
  try { localStorage.setItem('dashRole', role); } catch(e) {}
  const preset = ROLE_PRESETS[role];
  if (!preset) return;
  const riskBtn = document.querySelector(`[data-risk="${preset.risk}"]`);
  if (riskBtn) { document.querySelectorAll('[data-risk]').forEach(b => b.classList.remove('active')); riskBtn.classList.add('active'); activeRisk = preset.risk; }
  const typeBtn = document.querySelector(`[data-type="${preset.type}"]`);
  if (typeBtn) { document.querySelectorAll('[data-type]').forEach(b => b.classList.remove('active')); typeBtn.classList.add('active'); activeType = preset.type; }
  const sortEl   = document.getElementById('sortSelect');
  if (sortEl && preset.sort) sortEl.value = preset.sort;
  const searchEl = document.getElementById('searchInput');
  if (searchEl) searchEl.value = preset.search || '';
  applyFilters();
}

// ─────────────────────────────────────────────────────────────
// Email Digest
// ─────────────────────────────────────────────────────────────
function triggerDigest() {
  const highCount   = allProfiles.filter(p => p.risk && p.risk.level === 'HIGH').length;
  const mediumCount = allProfiles.filter(p => p.risk && p.risk.level === 'MEDIUM').length;
  const preview     = document.getElementById('digestPreview');
  if (preview) preview.textContent = `${highCount} high-risk and ${mediumCount} watch-closely students will be included.`;
  try { const saved = localStorage.getItem('digestRecipients'); const input = document.getElementById('digestEmailInput'); if (saved && input) input.value = saved; } catch(e) {}
  document.getElementById('digestError').classList.remove('show');
  document.getElementById('digestSuccess').classList.remove('show');
  document.getElementById('digestModal').classList.remove('hidden');
}

function closeDigestModal(e) {
  if (e && e.target !== document.getElementById('digestModal')) return;
  document.getElementById('digestModal').classList.add('hidden');
}

function confirmDigest() {
  const raw        = (document.getElementById('digestEmailInput').value || '');
  const recipients = raw.split(/[\n,]+/).map(s => s.trim()).filter(s => s.includes('@'));
  if (!recipients.length) {
    const errEl = document.getElementById('digestError');
    errEl.textContent = 'Please enter at least one valid email address.';
    errEl.classList.add('show');
    return;
  }
  try { localStorage.setItem('digestRecipients', raw); } catch(e) {}
  const btn = document.getElementById('digestSendBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  document.getElementById('digestError').classList.remove('show');
  google.script.run
    .withSuccessHandler(result => {
      if (btn) { btn.disabled = false; btn.textContent = 'Send'; }
      const ok = document.getElementById('digestSuccess');
      ok.textContent = `Sent to ${result.sent} recipient${result.sent !== 1 ? 's' : ''} — ${result.highRisk} high-risk and ${result.mediumRisk || 0} watch-closely students included.`;
      ok.classList.add('show');
      setTimeout(() => { ok.classList.remove('show'); document.getElementById('digestModal').classList.add('hidden'); }, 2500);
    })
    .withFailureHandler(err => {
      if (btn) { btn.disabled = false; btn.textContent = 'Send'; }
      const errEl = document.getElementById('digestError');
      errEl.textContent = err?.message || 'Send failed — please try again.';
      errEl.classList.add('show');
    })
    .sendDigest(recipients, _currentRole);
}

// ─────────────────────────────────────────────────────────────
// Schedule section in staff modal
// ─────────────────────────────────────────────────────────────
function buildScheduleSection(p) {
  const studentId = p.academicId || p.id || '';
  if (!studentId) return '';

  const uid = 'schedule-' + studentId.replace(/\W/g, '');

  google.script.run
    .withSuccessHandler(function(result) {
      const container = document.getElementById(uid);
      if (!container) return;
      if (result.error || !result.weekLabel) {
        container.innerHTML = '';
        return;
      }

      const isWeekend  = result.isWeekend;
      const todayLabel = result.todayLabel;

      let html = `<div class="info-section">
        <h3>${ICONS.calendar} Schedule <span style="font-weight:400;font-size:11px;color:var(--text-muted);">${esc(result.weekLabel)}</span></h3>`;

      if (!isWeekend && result.expectedWeekHours > 0) {
        html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;">
          <div style="background:var(--bg4);border:1px solid var(--border);border-radius:6px;padding:10px;text-align:center;">
            <div style="font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Expected This Week</div>
            <div style="font-size:18px;font-weight:700;color:var(--text);">${result.expectedWeekHours} h</div>
          </div>
          <div style="background:var(--bg4);border:1px solid var(--border);border-radius:6px;padding:10px;text-align:center;">
            <div style="font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Expected Today</div>
            <div style="font-size:18px;font-weight:700;color:var(--text);">${result.expectedTodayHours !== null ? result.expectedTodayHours + ' h' : '—'}</div>
          </div>
          <div style="background:var(--bg4);border:1px solid var(--border);border-radius:6px;padding:10px;text-align:center;">
            <div style="font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Worked This Week</div>
            <div style="font-size:18px;font-weight:700;color:${
              p.academic && p.academic.thisWeekHours !== null && p.academic.thisWeekHours !== 'NWH' && result.expectedWeekHours > 0
                ? (+p.academic.thisWeekHours >= result.expectedWeekHours * 0.5 ? 'var(--low)' : 'var(--high)')
                : 'var(--text)'
            };">${
              p.academic && p.academic.thisWeekHours !== null
                ? (p.academic.thisWeekHours === 'NWH' ? 'In Trades' : (+p.academic.thisWeekHours).toFixed(1) + ' h')
                : '—'
            }</div>
          </div>
        </div>`;
      }

      if (!isWeekend && todayLabel) {
        html += `<div style="font-size:11px;font-weight:700;color:var(--accent-mid);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">${esc(todayLabel)}'s Schedule</div>`;
        const todaySched = result.todaySchedule || {};
        const slots = Object.keys(todaySched).sort((a, b) =>
          (parseInt(a.replace('Period ','')) || 0) - (parseInt(b.replace('Period ','')) || 0)
        );
        if (!slots.length) {
          html += `<div style="font-size:12px;color:var(--text-muted);font-style:italic;">No classes scheduled today.</div>`;
        } else {
          slots.forEach(slot => {
            const entry = todaySched[slot];
            const ACADEMIC_NAMES = ['HSD 2', 'HSD3', 'HSE/HSD1'];
            const isAcademic = ACADEMIC_NAMES.some(n => (entry.class || '').toLowerCase().includes(n.toLowerCase()));
            html += `<div class="info-row">
              <span class="label" style="font-size:11px;white-space:nowrap;">
                ${esc(slot)}${isAcademic ? '<span style="color:var(--accent-mid);font-size:10px;margin-left:4px;">●</span>' : ''}
              </span>
              <span class="value" style="text-align:right;">
                <div style="font-size:13px;">${esc(entry.class || '—')}</div>
                ${entry.location ? `<div style="font-size:11px;color:var(--text-muted);margin-top:1px;">${esc(entry.location)}</div>` : ''}
              </span>
            </div>`;
          });
        }

        const schedule = result.schedule || {};
        const DAYS = ['M','T','W','TH','F'];
        const DAY_LABELS = { M:'Mon', T:'Tue', W:'Wed', TH:'Thu', F:'Fri' };
        const allPeriods = [...new Set(Object.keys(schedule))].sort((a,b) =>
          (parseInt(a.replace('Period ',''))||0) - (parseInt(b.replace('Period ',''))||0)
        );
        if (allPeriods.length) {
          const weekUid = 'sched-week-' + uid;
          html += `<div style="margin-top:12px;">
            <button onclick="
              const el=document.getElementById('${weekUid}');const open=el.style.display!=='none';
              el.style.display=open?'none':'block';this.textContent=open?'▸ Full week schedule':'▾ Full week schedule';
            " style="background:none;border:none;cursor:pointer;font-size:11px;font-weight:600;color:var(--text-muted);padding:4px 0;">
              ▸ Full week schedule
            </button>
            <div id="${weekUid}" style="display:none;margin-top:8px;overflow-x:auto;">
              <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead>
                  <tr>
                    <th style="padding:5px 8px;background:var(--bg4);border:1px solid var(--border);text-align:left;color:var(--text-muted);font-size:10px;text-transform:uppercase;">Period</th>
                    ${DAYS.map(d => `<th style="padding:5px 8px;background:var(--bg4);border:1px solid var(--border);text-align:left;color:var(--text-muted);font-size:10px;">${DAY_LABELS[d]}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${allPeriods.map(period => {
                    if (period === 'Period 4') return '';
                    return `<tr>
                      <td style="padding:6px 8px;border:1px solid var(--border);background:var(--bg4);font-weight:600;color:var(--accent-mid);white-space:nowrap;">${esc(period)}</td>
                      ${DAYS.map(day => {
                        const entry = (schedule[period] || {})[day];
                        return `<td style="padding:6px 8px;border:1px solid var(--border);vertical-align:top;">
                          ${entry ? `<div style="font-weight:600;color:var(--text);">${esc(entry.class)}</div>${entry.location ? `<div style="color:var(--text-muted);font-size:11px;">${esc(entry.location)}</div>` : ''}` : '<span style="color:var(--border-bright);">—</span>'}
                        </td>`;
                      }).join('')}
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>`;
        }

      } else if (isWeekend) {
        html += `<div style="font-size:12px;color:var(--text-muted);font-style:italic;">No schedule on weekends.</div>`;
      }

      if (!result.schedule || !Object.keys(result.schedule).length) {
        html += `<div style="font-size:12px;color:var(--text-muted);font-style:italic;margin-top:8px;">No schedule on file for this week.</div>`;
      }

      html += '</div>';
      container.innerHTML = html;
    })
    .withFailureHandler(function() {
      const container = document.getElementById(uid);
      if (container) container.innerHTML = '';
    })
    .getStudentSchedule(studentId);

  // Skeleton placeholder while the async call above is pending, so the
  // section doesn't flash an empty "no schedule" state on every open.
  return `<div id="${uid}">
    <div class="info-section">
      <h3>${ICONS.calendar} Schedule</h3>
      <div style="display:flex;gap:8px;align-items:center;padding:8px 0;">
        <div class="skeleton-cell med" style="height:11px;width:60%;"></div>
      </div>
    </div>
  </div>`;
}
// ── buildTABESection ──────────────────────────────────────
// Renders the TABE scores section in the student detail modal.
function buildTABESection(p) {
  if (!p.tabe || (!p.tabe.math && !p.tabe.reading)) return '';
 
  const t = p.tabe;
  const uid = 'tabe-' + (p.id || '').replace(/\W/g, '');
 
  function scoreColor(scale) {
    if (!scale) return 'var(--text-muted)';
    if (scale >= 566) return 'var(--low)';       // High Intermediate+
    if (scale >= 511) return 'var(--low)';        // Low Intermediate+
    if (scale >= 461) return 'var(--medium)';     // Beginning Basic
    return 'var(--high)';                         // Beginning Literacy
  }
 
  function gainHtml(gain) {
    if (gain === null || gain === undefined) return '<span style="color:var(--text-muted)">—</span>';
    const color = gain > 0 ? 'var(--low)' : gain < 0 ? 'var(--high)' : 'var(--text-muted)';
    const arrow = gain > 0 ? '▲' : gain < 0 ? '▼' : '→';
    return `<span style="font-weight:700;color:${color};">${arrow} ${gain > 0 ? '+' : ''}${gain}</span>`;
  }
 
  function subtestBlock(label, sub) {
    if (!sub) return `
      <div style="background:var(--bg4);border:1px solid var(--border);border-radius:6px;padding:14px 16px;">
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">${label}</div>
        <div style="font-size:12px;color:var(--text-muted);font-style:italic;">No test record on file.</div>
      </div>`;
 
    const curr = sub.current;
    const prev = sub.previous;
    const best = sub.best;
 
    return `
      <div style="background:var(--bg4);border:1px solid var(--border);border-radius:6px;padding:14px 16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
          <div style="font-size:11px;color:var(--text-muted);">${sub.attempts} attempt${sub.attempts !== 1 ? 's' : ''}</div>
        </div>
 
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
          <div style="background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:10px;text-align:center;">
            <div style="font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">Previous</div>
            <div style="font-size:20px;font-weight:800;color:${prev ? scoreColor(prev.scale) : 'var(--text-muted)'};">
              ${prev ? prev.scale : '—'}
            </div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${prev ? prev.date : ''}</div>
          </div>
          <div style="background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:10px;text-align:center;">
            <div style="font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">Current</div>
            <div style="font-size:20px;font-weight:800;color:${scoreColor(curr.scale)};">${curr.scale}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${curr.date}</div>
          </div>
          <div style="background:var(--bg3);border:1px solid ${best.scale === curr.scale ? 'color-mix(in srgb, var(--low) 30%, transparent)' : 'var(--border)'};border-radius:5px;padding:10px;text-align:center;">
            <div style="font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">Best</div>
            <div style="font-size:20px;font-weight:800;color:${scoreColor(best.scale)};">${best.scale}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${best.date}</div>
          </div>
        </div>
 
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;">
          <span style="font-size:12px;color:var(--text-muted);font-weight:600;">Gain / Loss</span>
          <span style="font-size:14px;">${gainHtml(sub.gain)}</span>
        </div>
 
        ${curr.eflLevel ? `
        <div style="margin-top:8px;padding:7px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:11px;color:var(--text-muted);font-weight:600;">Current EFL</span>
          <span style="font-size:12px;font-weight:700;color:${scoreColor(curr.scale)};">${curr.efl !== null ? curr.efl : '—'}</span>
        </div>` : ''}
      </div>`;
  }
 
  return `
    <div class="info-section">
      <h3 onclick="toggleSection('${uid}', this)" style="cursor:pointer;">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:13px;height:13px;opacity:.6;flex-shrink:0;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/></svg>
        TABE Scores
        ${t.reportDate ? `<span style="font-size:11px;font-weight:400;color:var(--text-muted);margin-left:6px;">as of ${esc(t.reportDate)}</span>` : ''}
        <span style="margin-left:auto;font-size:11px;color:var(--text-muted);">▾</span>
      </h3>
      <div id="${uid}" style="display:flex;flex-direction:column;gap:10px;">
        ${subtestBlock('Mathematics', t.math)}
        ${subtestBlock('Reading', t.reading)}
      </div>
    </div>`;
}
 
 

function _fmtLastUpdated(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return 'Updated ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch(e) { return ''; }
}
</script>
