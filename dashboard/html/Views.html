<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Student Progress — Tulsa Job Corps</title>
  <script>
    // Errors are logged to the console for debugging rather than surfaced
    // in the UI — this keeps failures from disrupting what staff see.
    window.onerror = function(msg, url, line, col, error) {
      console.error('[Dashboard error]', msg, 'at line', line, error);
      return false;
    };
    const SERVER_ROLE        = <?!= JSON.stringify(userRole); ?>;
    const SERVER_NAME        = <?!= JSON.stringify(userName); ?>;
    const SERVER_EMPLOYEE_ID = <?!= JSON.stringify(employeeId); ?>;
  </script>
  <?!= include('Themes'); ?>
  <?!= include('Styles'); ?>
 <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
</head>
<body>
<!-- ── EMPLOYEE ID LOGIN SCREEN ──────────────────────────── -->
<div id="loginScreen" class="sv-login-screen">
  <div class="sv-login-card">

    <div class="sv-login-brand">
      <div class="sv-login-logo">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"/>
        </svg>
      </div>
      <div class="sv-login-org">Tulsa Job Corps</div>
      <div class="sv-login-title">Student Dashboard</div>
      <div class="sv-login-subtitle">Enter your Employee ID to continue.</div>
    </div>

    <div class="sv-login-divider"></div>

    <label class="sv-login-label" for="employeeIdInput">Employee ID</label>
    <input
      type="text"
      id="employeeIdInput"
      class="sv-login-input"
      placeholder="Enter your ID"
      autocomplete="off"
      autocorrect="off"
      spellcheck="false"
      onkeydown="if(event.key==='Enter') staffLogin()"
    >

    <button class="sv-login-btn" id="staffLoginBtn" onclick="staffLogin()">
      Sign In
    </button>

    <div id="staffLoginError" class="sv-login-error"></div>

    <p class="sv-login-hint">
      Contact your administrator if you don't know your Employee ID.
    </p>

  </div>
</div>
<!-- ── SIDEBAR OVERLAY ──────────────────────────────────── -->
<div id="sidebarOverlay" class="sidebar-overlay" onclick="closeSidebar()"></div>

<!-- ── TOOLS SIDEBAR ────────────────────────────────────── -->
<aside id="toolsSidebar" class="sidebar">
  <div class="sidebar-header">
    <h2>Tools</h2>
    <button class="modal-close" onclick="closeSidebar()">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  </div>
  <div class="sidebar-body">

    <div class="sidebar-section-label">Data</div>

    <button class="sidebar-btn" onclick="exportCSV(); closeSidebar()">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
      <div class="sidebar-btn-inner">
        <span class="sb-label">Export CSV</span>
        <span class="sb-desc">Download the current filtered view</span>
      </div>
    </button>

    <button id="btnSendDigest" class="sidebar-btn" onclick="triggerDigest(); closeSidebar()">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
      <div class="sidebar-btn-inner">
        <span class="sb-label">Email Summary</span>
        <span class="sb-desc">Send high-risk digest to staff</span>
      </div>
    </button>
    <button class="sidebar-btn" onclick="openScheduleUpload(); closeSidebar()">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>
      <div class="sidebar-btn-inner">
        <span class="sb-label">Upload Schedule</span>
        <span class="sb-desc">Import this week's class schedule</span>
      </div>
    </button>
    <div class="sidebar-divider"></div>
    <div class="sidebar-section-label">Profiles</div>
    <button class="sidebar-btn" onclick="openTABEUpload(); closeSidebar()">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/></svg>
      <div class="sidebar-btn-inner">
        <span class="sb-label">Upload TABE Scores</span>
        <span class="sb-desc">Import CIS test report (.xls)</span>
      </div>
    </button>
    <div class="sidebar-divider"></div>
    <button id="btnMergeProfiles" class="sidebar-btn" onclick="openMergeModal(); closeSidebar()">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/></svg>
      <div class="sidebar-btn-inner">
        <span class="sb-label">Merge Profiles</span>
        <span class="sb-desc">Combine duplicate student records</span>
      </div>
    </button>

    <div class="sidebar-divider"></div>
    <div class="sidebar-section-label">View</div>

    <button class="sidebar-btn" onclick="openHistoryPanel(); closeSidebar()">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <div class="sidebar-btn-inner">
        <span class="sb-label">Change History</span>
        <span class="sb-desc">View and undo recent edits</span>
      </div>
    </button>

    <div class="sidebar-role-wrap">
      <label>Role preset</label>
      <select id="roleSelect" class="sidebar-role-select" onchange="applyRolePreset(this.value)">
        <option value="">— Select my role —</option>
        <option value="manager">Manager</option>
        <option value="counselor">Counselor</option>
        <option value="teacher">Teacher</option>
      </select>
    </div>

    <div class="sidebar-divider"></div>
    <div class="sidebar-section-label">Help</div>

    <button class="sidebar-btn" onclick="showRiskExplainer(); closeSidebar()">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"/></svg>
      <div class="sidebar-btn-inner">
        <span class="sb-label">How scoring works</span>
        <span class="sb-desc">Understand risk scores and flags</span>
      </div>
    </button>

    <button class="sidebar-btn" onclick="startWalkthrough(); closeSidebar()">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
      </svg>
      <div class="sidebar-btn-inner">
        <span class="sb-label">Restart Tour</span>
        <span class="sb-desc">Walk through the dashboard again</span>
      </div>
    </button>
    <div class="sidebar-divider"></div>
    <div class="sidebar-section-label">Productivity</div>
    
    <button onclick="openProductivityModal();" id="btnProductivity">Productivity</button>
    
    <div class="sidebar-divider"></div>
    
    <button class="sidebar-btn" onclick="runClearAllCaches(); closeSidebar()">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
      <div class="sidebar-btn-inner">
        <span class="sb-label">Clear Caches</span>
        <span class="sb-desc">Force fresh data from every sheet</span>
      </div>
    </button>

  </div>
</aside>

<!-- ── TOP NAV ──────────────────────────────────────────── -->
<nav class="topnav">
  <div class="nav-brand">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="22" height="22">
      <path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"/>
    </svg>
    <div>
      <div class="nav-title">Tulsa Job Corps</div>
      <div class="nav-subtitle">Student Progress</div>
    </div>
  </div>

  <div class="nav-actions">
    <span id="wirWeekLabel" class="wir-week-nav"></span>
    <span id="lastUpdated" class="last-updated"></span>

    <button class="btn btn-nav" onclick="refreshData()">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
      Refresh
    </button>

    <div style="position:relative;">
      <button class="btn-theme" onclick="toggleThemeDropdown()" id="themeToggle" title="Change theme">
        <svg id="iconTheme" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z"/></svg>
      </button>
      <div id="themeDropdown" style="
        display:none;
        position:absolute;
        top:calc(100% + 6px);
        right:0;
        background:var(--bg2);
        border:1px solid var(--border-bright);
        border-radius:7px;
        box-shadow:var(--shadow-modal);
        z-index:200;
        min-width:140px;
        overflow:hidden;
      ">
        <div style="padding:6px 10px;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid var(--border);">
          Theme
        </div>
      </div>
    </div>
    <button class="btn-tools" onclick="openSidebar()" title="Menu">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/></svg>
    </button>
  </div>
</nav>

<!-- ── MAIN CONTENT ─────────────────────────────────────── -->
<main class="main">

  <div id="loadingState" class="loading-state">
    <div class="spinner"></div>
    <p>Loading student data…</p>
  </div>

  <div id="errorState" class="error-state hidden">
    <div class="error-icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="40" height="40"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
    </div>
    <p id="errorMsg">Something went wrong.</p>
    <button class="btn btn-primary" onclick="loadData()">Try again</button>
  </div>

  <div id="dashContent" class="hidden">

    <!-- ── DATA FRESHNESS BANNER ──────────────────────────── -->
    <div id="freshnessBanner" class="freshness-banner hidden">
      <div class="freshness-sources" id="freshnessSources"></div>
      <button class="freshness-dismiss" onclick="dismissFreshness()">✕</button>
    </div>

    <!-- ── SUMMARY CARDS ──────────────────────────────────── -->
    <section class="summary-cards" id="summaryCards"></section>

    <!-- ── FILTERS ────────────────────────────────────────── -->
    <section class="filter-bar">

      <!-- SEARCH -->
      <div class="search-wrap">
        <span class="search-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
          </svg>
        </span>
        <input type="text" id="searchInput" class="search-input"
          placeholder="Search student…" oninput="applyFilters()">
      </div>

      <!-- RISK CHIPS -->
      <div class="filter-chips">
        <button class="chip active"          data-risk="ALL"     onclick="setRiskFilter(this)">All</button>
        <button class="chip chip-high"       data-risk="HIGH"    onclick="setRiskFilter(this)">Needs Attention</button>
        <button class="chip chip-medium"     data-risk="MEDIUM"  onclick="setRiskFilter(this)">Watch Closely</button>
        <button class="chip chip-low"        data-risk="LOW"     onclick="setRiskFilter(this)">On Track</button>
        <button class="chip chip-unknown"    data-risk="UNKNOWN" onclick="setRiskFilter(this)">No Data Yet</button>
      </div>

      <!-- TYPE CHIPS -->
      <div class="filter-chips">
        <button class="chip active"              data-type="ALL"            onclick="setTypeFilter(this)">All Types</button>
        <button class="chip"                     data-type="HS"             onclick="setTypeFilter(this)">High School</button>
        <button class="chip"                     data-type="HISET"          onclick="setTypeFilter(this)">HiSET / GED</button>
        <button class="chip"                     data-type="TRADES"         onclick="setTypeFilter(this)">Trades Only</button>
        <button class="chip chip-complete"       data-type="TRADE_COMPLETE" onclick="setTypeFilter(this)">Trade Complete</button>
        <button class="chip chip-intervention"   data-type="INTERVENTION"   onclick="setTypeFilter(this)">WIR</button>
        <button class="chip chip-unmapped"       data-type="UNMAPPED"       onclick="setTypeFilter(this)">Not Set Up</button>
      </div>

      <!-- FILTER FOOTER: presets + sort + view toggle -->
      <div class="filter-footer">

        <div class="presets-wrap">
          <select id="presetSelect" class="sort-select" onchange="applyPreset(this.value)" title="Filter presets">
            <option value="">Presets…</option>
            <optgroup label="Built-in">
              <option value="__high_risk">Needs Attention</option>
              <option value="__unmapped">Not Set Up</option>
              <option value="__has_wir">Weekly Intervention Report</option>
              <option value="__trade_complete">Trade Complete</option>
              <option value="__high_risk_trades">Needs Attention + Trades</option>
              <option value="__stale">No Recent Updates</option>
            </optgroup>
            <optgroup label="Saved" id="customPresetsGroup"></optgroup>
          </select>
          <button class="btn-preset-save" onclick="savePreset()">+ Save</button>
        </div>

        <div class="sort-wrap">
          <select id="sortSelect" class="sort-select" onchange="applyFilters()">
            <option value="name">Name A–Z</option>
            <option value="risk">Risk (highest first)</option>
            <option value="academicPct">Academic %</option>
            <option value="tradesPct">Trades %</option>
            <option value="tradeName">Trade Name A–Z</option>
            <option value="daysLeft">Est. Graduation</option>
          </select>
        </div>

        <div class="view-toggle-wrap">
          <button class="btn-view-toggle active" id="btnTableView" onclick="setView('table')" title="Table view">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/>
            </svg>
            Table
          </button>
          <button class="btn-view-toggle" id="btnCardView" onclick="setView('cards')" title="Card view">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/>
            </svg>
            Cards
          </button>
          <button class="btn-view-toggle" id="btnActionView" onclick="setView('action')" title="Action needed view">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
            </svg>
            Action
          </button>
        </div>
      </div>

      <!-- CARDS GRID -->
      <div id="cardsGrid" class="cards-grid hidden"></div>

      <!-- ACTION NEEDED VIEW -->
      <div id="actionView" class="hidden">
        <div class="action-view-header">
          <div>
            <div class="action-view-title">Action Needed</div>
            <div class="action-view-sub">Most urgent students first — intervention, deadlines, missing hours</div>
          </div>
          <span class="action-refresh-note" id="actionViewDate"></span>
        </div>
        <div class="action-view" id="actionGroups"></div>
      </div>
      
      <!-- ── COUNSELOR FILTER BAR ─────────────────────────────── -->
      <div id="counselorFilterBar" style="
        display:flex;align-items:center;gap:10px;
        padding:10px 16px;
        background:var(--bg2);
        border-bottom:1px solid var(--border);
        flex-wrap:wrap;
      ">
        <span style="font-size:12px;font-weight:600;color:var(--text-muted);white-space:nowrap;">
          Filter by Counselor:
        </span>
        <select id="counselorSelect" onchange="applyCounselorFilter()" style="
          font-size:13px;padding:5px 10px;
          background:var(--bg3);color:var(--text);
          border:1px solid var(--border);border-radius:6px;
          cursor:pointer;min-width:180px;
        ">
          <option value="">— All Students —</option>
        </select>
        <button id="counselorClearBtn" onclick="clearCounselorFilter()" style="
          display:none;
          font-size:12px;padding:5px 12px;
          background:var(--accent-mid);color:var(--bg-nav);
          border:none;border-radius:6px;cursor:pointer;font-weight:600;
        ">✕ Clear Filter</button>
        <span id="counselorFilterLabel" style="
          font-size:12px;color:var(--text-muted);font-style:italic;
        "></span>
      </div>
    </section>

    <!-- RESULT COUNT -->
    <div class="result-bar">
      <span id="resultCount" class="result-count"></span>
    </div>

    <!-- ── TABLE ──────────────────────────────────────────── -->
    <section class="table-wrap">
      <table class="students-table" id="studentsTable">
        <thead>
          <tr>
            <th><input type="checkbox" id="selectAll" onchange="toggleSelectAll(this)" title="Select all"></th>
            <th>Student</th>
            <th>Risk</th>
            <th>Status</th>
            <th class="col-academic-pct col-expandable hidden-col">Academic %</th>
            <th>Trade</th>
            <th class="col-trade-pct col-expandable hidden-col">Trade %</th>
            <th>This Week</th>
            <th class="col-etar col-expandable hidden-col">ETAR</th>
            <th>WIR</th>
            <th>
              <button class="btn-expand-cols" onclick="toggleExtraCols()" id="expandColsBtn" title="Show more columns">＋</button>
            </th>
          </tr>
        </thead>
        <tbody id="studentsBody"></tbody>
      </table>
      <div id="noResults" class="no-results hidden">No students match your filters.</div>
    </section>

    <!-- ── BULK ACTION BAR ────────────────────────────────── -->
    <div id="bulkBar" class="bulk-bar hidden">
      <span id="bulkCount" class="bulk-count"></span>
      <button id="bulkNoteBtn" class="btn-bulk" onclick="openBulkNote()">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>
        Add Note to All
      </button>
      <button id="bulkStatusBtn" class="btn-bulk" onclick="openBulkStatus()">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"/></svg>
        Edit Status
      </button>
      <button class="btn-bulk danger" onclick="clearSelection()">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        Clear
      </button>
    </div>

  </div><!-- end dashContent -->
</main>

<!-- ── DETAIL MODAL ──────────────────────────────────────── -->
<div id="detailModal" class="modal-overlay hidden" onclick="closeModal(event)">
  <div class="modal-box">
    <div class="modal-header">
      <h2 id="modalName"></h2>
      <div id="modalBadges" class="modal-badges"></div>
      <button class="btn-override-toggle no-print" onclick="toggleOverridePanel()">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"/></svg>
        Edit
      </button>
      <button class="btn-override-toggle no-print" onclick="printStudentDetail()">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z"/></svg>
        Print
      </button>
      <button class="modal-close no-print" onclick="closeModalButton()">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-body" id="modalBody"></div>
  </div>
</div>

<!-- ── RISK SCORE EXPLAINER ──────────────────────────────── -->
<div id="riskExplainer" class="explainer-overlay hidden" onclick="closeRiskExplainer()">
  <div class="explainer-box" onclick="event.stopPropagation()">
    <div class="explainer-header">
      <h3>How scoring works</h3>
      <button class="modal-close" onclick="closeRiskExplainer()">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="explainer-body">
      <p class="explainer-intro">Each student gets a score from 0–100. Higher means more at risk. Points from multiple factors add together, weighted so that graduation timeline risk always dominates.</p>
      <div class="explainer-levels">
        <div class="explainer-level high"><strong>Needs Attention</strong> — Score 60 or above. Immediate action needed.</div>
        <div class="explainer-level medium"><strong>Watch Closely</strong> — Score 30–59. Monitor this week.</div>
        <div class="explainer-level low"><strong>On Track</strong> — Score 0–29. No major concerns.</div>
        <div class="explainer-level unknown"><strong>No Data Yet</strong> — No academic, trades, or time data found.</div>
      </div>
      <div class="explainer-group">
        <div class="explainer-group-title">Academic Factors</div>
        <div class="explainer-item"><span class="explainer-pts">+40</span> Student is flagged as at-risk pace in Edgenuity</div>
        <div class="explainer-item"><span class="explainer-pts">+30</span> Student is behind or slow on academic pace</div>
        <div class="explainer-item"><span class="explainer-pts">+25</span> Graduation deadline is within 30 days and less than 90% complete</div>
        <div class="explainer-item"><span class="explainer-pts">+20</span> Academic completion is below 50%</div>
        <div class="explainer-item"><span class="explainer-pts">+15</span> No academic hours logged this week</div>
      </div>
      <div class="explainer-group">
        <div class="explainer-group-title">Trades Factors</div>
        <div class="explainer-item"><span class="explainer-pts">+25</span> Very low trade progress (under 25%) with less than 60 days to ETAR</div>
        <div class="explainer-item"><span class="explainer-pts">+20</span> Pace gap is more than 10% behind</div>
        <div class="explainer-item"><span class="explainer-pts">+15</span> Trade program status is inactive or withdrawn</div>
        <div class="explainer-item"><span class="explainer-pts">+25</span> Stalled for 2 consecutive months (non-BCT, below 3% gain)</div>
        <div class="explainer-item"><span class="explainer-pts">+15</span> Low monthly gain — below 3% in the most recent month (non-BCT)</div>
        <div class="explainer-item"><span class="explainer-pts">+15</span> BCT: stalled for 2 consecutive months below 1.5% gain</div>
        <div class="explainer-item"><span class="explainer-pts">+10</span> BCT: low monthly gain below 1.5% this month</div>
        <div class="explainer-item"><span class="explainer-pts">+10</span> Stalled or low gain AND overall completion still under 25%</div>
      </div>
      <div class="explainer-group">
        <div class="explainer-group-title">Weekly Intervention Report Factors</div>
        <div class="explainer-item"><span class="explainer-pts">+40</span> Admin priority is CRITICAL this week</div>
        <div class="explainer-item"><span class="explainer-pts">+25</span> Admin priority is HIGH this week</div>
        <div class="explainer-item"><span class="explainer-pts">+20</span> Urgency is IMMEDIATE</div>
        <div class="explainer-item"><span class="explainer-pts">+15</span> Student has an open case</div>
        <div class="explainer-item"><span class="explainer-pts">+10</span> Admin priority is MEDIUM / urgency is URGENT</div>
      </div>
      <div class="explainer-group">
        <div class="explainer-group-title">Time &amp; Data Factors</div>
        <div class="explainer-item"><span class="explainer-pts">+20</span> Less than 1 total hour logged</div>
        <div class="explainer-item"><span class="explainer-pts">+20</span> No academic or trades data found at all</div>
        <div class="explainer-item"><span class="explainer-pts">+10</span> No time data found</div>
      </div>
      <p class="explainer-note">Trade Complete students are excluded from trades risk flags. BCT uses a lower monthly gain threshold (1.5%). A score of 0 with real data on file is still On Track — No Data Yet means no data exists at all. Max score is 100.</p>
    </div>
  </div>
</div>

<!-- ── BULK NOTE MODAL ───────────────────────────────────── -->
<div id="bulkNoteModal" class="modal-overlay hidden" onclick="closeBulkModal(event,'bulkNoteModal')">
  <div class="modal-box" style="max-width:480px;">
    <div class="modal-header">
      <h2>Add Note to Selected Students</h2>
      <button class="modal-close" onclick="document.getElementById('bulkNoteModal').classList.add('hidden')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-body" style="padding:20px 22px;">
      <p id="bulkNoteDesc" style="font-size:13px;color:var(--text-muted);margin-bottom:12px;"></p>
      <textarea id="bulkNoteInput" class="note-textarea" placeholder="Note text…" rows="4" style="width:100%"></textarea>
      <div class="override-actions" style="margin-top:10px;">
        <button class="btn-override" onclick="confirmBulkNote()">Add to All</button>
        <button class="btn-override danger" onclick="document.getElementById('bulkNoteModal').classList.add('hidden')">Cancel</button>
      </div>
      <div id="bulkNoteProgress" style="font-size:12px;color:var(--text-muted);margin-top:8px;"></div>
      <div id="bulkNoteError" class="override-error"></div>
    </div>
  </div>
</div>

<!-- ── BULK STATUS MODAL ─────────────────────────────────── -->
<div id="bulkStatusModal" class="modal-overlay hidden" onclick="closeBulkModal(event,'bulkStatusModal')">
  <div class="modal-box" style="max-width:480px;">
    <div class="modal-header">
      <h2>Edit Status for Selected Students</h2>
      <button class="modal-close" onclick="document.getElementById('bulkStatusModal').classList.add('hidden')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-body" style="padding:20px 22px;">
      <p id="bulkStatusDesc" style="font-size:13px;color:var(--text-muted);margin-bottom:12px;"></p>
      <div class="override-form">
        <div class="override-row">
          <label>Academic / HS Status</label>
          <select id="bulkAcademicStatus">
            <option value="">— No change —</option>
            <option value="HS">HS</option>
            <option value="HISET">HISET</option>
            <option value="HS_COMPLETE">Finished HS</option>
            <option value="NOT_STARTED">Not Started</option>
          </select>
        </div>
        <div class="override-row">
          <label>Trades Status</label>
          <select id="bulkTradeStatus">
            <option value="">— No change —</option>
            <option value="TRADES">Trades</option>
            <option value="TRADE_COMPLETE">Trade Complete</option>
            <option value="NOT_STARTED">Not Started</option>
          </select>
        </div>
      </div>
      <div class="override-actions" style="margin-top:12px;">
        <button class="btn-override" onclick="confirmBulkStatus()">Apply to All</button>
        <button class="btn-override danger" onclick="document.getElementById('bulkStatusModal').classList.add('hidden')">Cancel</button>
      </div>
      <div id="bulkStatusProgress" style="font-size:12px;color:var(--text-muted);margin-top:8px;"></div>
      <div id="bulkStatusError" class="override-error"></div>
    </div>
  </div>
</div>

<!-- ── DIGEST MODAL ──────────────────────────────────────── -->
<div id="digestModal" class="modal-overlay hidden" onclick="closeDigestModal(event)">
  <div class="modal-box" style="max-width:460px;">
    <div class="modal-header">
      <h2>Email Summary</h2>
      <button class="modal-close" onclick="document.getElementById('digestModal').classList.add('hidden')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-body" style="padding:20px 22px;">
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:14px;">Enter one or more email addresses, separated by commas or new lines.</p>
      <div class="override-row">
        <label>Recipients</label>
        <textarea id="digestEmailInput" class="note-textarea" placeholder="name@example.com&#10;another@example.com" rows="4" style="width:100%;"></textarea>
      </div>
      <div id="digestPreview" style="font-size:12px;color:var(--text-muted);margin-top:10px;min-height:18px;"></div>
      <div class="override-actions" style="margin-top:12px;">
        <button class="btn-override" id="digestSendBtn" onclick="confirmDigest()">Send</button>
        <button class="btn-override danger" onclick="document.getElementById('digestModal').classList.add('hidden')">Cancel</button>
      </div>
      <div id="digestError" class="override-error"></div>
      <div id="digestSuccess" class="override-saved"></div>
    </div>
  </div>
</div>

<!-- ── MERGE PROFILES MODAL ──────────────────────────────── -->
<div id="mergeModal" class="modal-overlay hidden" onclick="closeMergeModal(event)">
  <div class="modal-box" style="max-width:560px;">
    <div class="modal-header">
      <h2>Merge Profiles</h2>
      <button class="modal-close" onclick="closeMergeModalButton()">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-body" style="padding:20px 22px;">
      <div class="merge-panel" id="mergePanelBody"></div>
    </div>
  </div>
</div>

<!-- ── QUICK EDIT DRAWER ─────────────────────────────────── -->
<div id="qeOverlay" class="sidebar-overlay" onclick="closeQuickEdit()"></div>
<div id="qeDrawer" class="qe-drawer">
  <div class="qe-header">
    <h3 id="qeStudentName">Edit Student</h3>
    <button class="modal-close" onclick="closeQuickEdit()">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  </div>
  <div class="qe-body">

    <div class="qe-field">
      <label class="qe-label">What program are they in?</label>
      <select id="qeAcademicStatus" class="qe-select">
        <option value="">— No change —</option>
        <option value="HS">High School (HS)</option>
        <option value="HISET">HiSET / GED</option>
        <option value="HS_COMPLETE">Finished High School</option>
        <option value="NOT_STARTED">Not Started Yet</option>
      </select>
      <span class="qe-hint">Only set this if the dashboard shows the wrong program type.</span>
    </div>

    <div class="qe-divider"></div>

    <div class="qe-field">
      <label class="qe-label">Where are they in their trade?</label>
      <select id="qeTradeStatus" class="qe-select">
        <option value="">— No change —</option>
        <option value="TRADES">Active in Trades</option>
        <option value="TRADE_COMPLETE">Trade Complete</option>
        <option value="NOT_STARTED">Not Started Yet</option>
      </select>
    </div>

    <div class="qe-field">
      <label class="qe-label">Which trade? (if wrong or missing)</label>
      <select id="qeTradeName" class="qe-select">
        <option value="">— No change —</option>
        <option value="BCT">BCT</option>
        <option value="Carpentry">Carpentry</option>
        <option value="CNA">CNA</option>
        <option value="Culinary">Culinary</option>
        <option value="Security">Security</option>
        <option value="USN">USN</option>
        <option value="Pharmacy Technician">Pharmacy Technician</option>
        <option value="OTP in Advanced Manufacturing">OTP in Advanced Manufacturing</option>
      </select>
    </div>

    <div class="qe-divider"></div>

    <div class="qe-field">
      <label class="qe-label">Add a note</label>
      <textarea id="qeNoteInput" class="qe-textarea" placeholder="Optional — leave blank to skip…"></textarea>
      <span class="qe-hint">Notes are visible to all staff and saved permanently.</span>
    </div>

  </div>
  <div class="qe-footer">
    <button class="qe-save" id="qeSaveBtn" onclick="saveQuickEdit()">Save Changes</button>
    <div id="qeStatus" class="qe-status"></div>
  </div>
</div>

<!-- ── CHANGE HISTORY MODAL ──────────────────────────────── -->
<div id="historyModal" class="modal-overlay hidden" onclick="closeHistoryModal(event)">
  <div class="modal-box" style="max-width:560px;">
    <div class="modal-header">
      <h2>Change History</h2>
      <button class="modal-close" onclick="document.getElementById('historyModal').classList.add('hidden')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="modal-body" style="padding:20px 22px;">
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">
        Last 10 manual changes. Reverting removes the override — the dashboard will recompute that field automatically.
      </p>
      <div id="historyList"></div>
      <div id="historyEmpty" class="hidden" style="font-size:13px;color:var(--text-muted);text-align:center;padding:32px 0;">
        No recent changes found.
      </div>
      <div id="historyLoading" style="font-size:13px;color:var(--text-muted);text-align:center;padding:32px 0;">
        Loading…
      </div>
    </div>
  </div>
</div>

<!-- ── WALKTHROUGH ───────────────────────────────────────── -->
<div id="wtBackdrop" class="wt-backdrop"></div>
<div id="wtSpotlight" class="wt-spotlight" style="display:none"></div>
<div id="wtTooltip" class="wt-tooltip" style="display:none">
  <div id="wtStepLabel" class="wt-step-label"></div>
  <div id="wtTitle" class="wt-title"></div>
  <div id="wtBody" class="wt-body"></div>
  <div class="wt-actions">
    <button class="wt-btn-skip" onclick="skipWalkthrough()">Skip tour</button>
    <div class="wt-dots" id="wtDots"></div>
    <button class="wt-btn-next" id="wtNextBtn" onclick="walkthroughNext()">Next →</button>
  </div>
</div>
<script>
const ICONS = {
  academic:    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"/></svg>',
  trades:      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"/></svg>',
  risk:        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>',
  identity:    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>',
  notes:       '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>',
  overrides:   '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>',
  sparkline:   '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/></svg>',
  wir:         '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/></svg>',
  time:        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  status:      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z"/></svg>',
  blocked:     '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>',
  alertTri:    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>',
  calendar:    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>',
  flag:        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"/></svg>',
  checkCircle: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  clock:       '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  noData:      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"/></svg>',
  edit:        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"/></svg>',
  trophy:      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9a.75.75 0 01-.75-.75v-1.5a.75.75 0 01.75-.75h9a.75.75 0 01.75.75v1.5a.75.75 0 01-.75.75zM7.5 3.75h9v6a4.5 4.5 0 01-9 0v-6zM7.5 5.25H4.875A1.875 1.875 0 003 7.125v.75a3.375 3.375 0 003.375 3.375H7.5M16.5 5.25h2.625A1.875 1.875 0 0121 7.125v.75a3.375 3.375 0 01-3.375 3.375H16.5M12 15.75v2.25"/></svg>',
};
</script>
<?!= include('Scripts'); ?>

<script>
// ── Theme toggle ─────────────────────────────────────────
const THEMES = [
  { key: 'dark',      label: 'Rust Dark',   dot: '#C4622E' },
  { key: 'light',     label: 'Rust Light',  dot: '#9A4020' },
  { key: 'obsidian',  label: 'Obsidian',    dot: '#C8A878' },
  { key: 'atlas',     label: 'Atlas',       dot: '#D2B48C' },
  { key: 'forest',    label: 'Forest',      dot: '#7BAF5A' },
  { key: 'desert',    label: 'Desert',      dot: '#C87A3A' },
  { key: 'ocean',     label: 'Ocean',       dot: '#3A9EBF' },
  { key: 'arctic',    label: 'Arctic',      dot: '#3A6E8A' },
  { key: 'midnight',  label: 'Midnight',    dot: '#5A78C8' },
  { key: 'slate',     label: 'Slate',       dot: '#C8A84A' },
  { key: 'burgundy',  label: 'Burgundy',    dot: '#C84A6A' },
  { key: 'navy',      label: 'Navy',        dot: '#B89040' },
  { key: 'ember',     label: 'Ember',       dot: '#D4782A' },
  { key: 'walnut',    label: 'Walnut',      dot: '#B8843A' },
  { key: 'coffee',    label: 'Coffee',      dot: '#B07840' },
  { key: 'autumn',    label: 'Autumn',      dot: '#C86828' },
  { key: 'graphite',  label: 'Graphite',    dot: '#E05A28' },
  { key: 'cobalt',    label: 'Cobalt',      dot: '#4A90D0' },
  { key: 'sage',      label: 'Sage',        dot: '#4A7A50' },
  { key: 'plum',      label: 'Plum',        dot: '#B870A0' },
];

function toggleThemeDropdown() {
  const dropdown = document.getElementById('themeDropdown');
  const isOpen   = dropdown.style.display !== 'none';
  if (isOpen) {
    dropdown.style.display = 'none';
    return;
  }

  // Build dropdown items
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  dropdown.innerHTML = `
    <div style="padding:6px 10px;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid var(--border);">
      Theme
    </div>
    <div style="max-height:280px;overflow-y:auto;">
      ${THEMES.map(t => `
        <button onclick="applyTheme('${t.key}');closeThemeDropdown();" style="
          display:flex;align-items:center;gap:10px;
          width:100%;padding:9px 14px;
          background:${t.key === current ? 'var(--accent-glow)' : 'none'};
          border:none;border-bottom:1px solid var(--border);
          color:${t.key === current ? 'var(--accent)' : 'var(--text-soft)'};
          font-family:var(--font);font-size:13px;font-weight:${t.key === current ? '700' : '500'};
          cursor:pointer;text-align:left;
          transition:background 0.12s,color 0.12s;
        " onmouseover="this.style.background='var(--bg4)'"
          onmouseout="this.style.background='${t.key === current ? 'var(--accent-glow)' : 'none'}'">
          <span style="
            width:12px;height:12px;border-radius:50%;flex-shrink:0;
            background:${t.dot};
            border:2px solid var(--border-bright);
          "></span>
          ${t.label}
          ${t.key === current ? '<span style="margin-left:auto;font-size:10px;color:var(--accent);">✓</span>' : ''}
        </button>`).join('')}
    </div>
  `;
  dropdown.style.display = 'block';
}

function closeThemeDropdown() {
  document.getElementById('themeDropdown').style.display = 'none';
}

function applyTheme(key) {
  document.documentElement.setAttribute('data-theme', key);
  try { localStorage.setItem('dashTheme', key); } catch(e) {}
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  const dropdown = document.getElementById('themeDropdown');
  const toggle   = document.getElementById('themeToggle');
  if (dropdown && !dropdown.contains(e.target) && !toggle.contains(e.target)) {
    dropdown.style.display = 'none';
  }
});

// Restore saved theme on load
(function() {
  try {
    const saved = localStorage.getItem('dashTheme');
    const valid = THEMES.find(t => t.key === saved);
    if (valid) applyTheme(valid.key);
    else applyTheme('dark');
  } catch(e) { applyTheme('dark'); }
})();

// ── Sidebar ──────────────────────────────────────────────
function openSidebar() {
  document.getElementById('toolsSidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('open');
}
function closeSidebar() {
  document.getElementById('toolsSidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}
(function() {
  const tooltip = document.getElementById('dashTooltip');
  if (!tooltip) return;

  document.addEventListener('mouseover', function(e) {
    const el = e.target.closest('.tip');
    if (!el) return;
    const tip = el.getAttribute('data-tip');
    if (!tip) return;
    tooltip.textContent = tip;
    tooltip.classList.add('show');
  });

  document.addEventListener('mousemove', function(e) {
    if (!tooltip.classList.contains('show')) return;
    const x = e.clientX + 14;
    const y = e.clientY + 14;
    const w = tooltip.offsetWidth  || 220;
    const h = tooltip.offsetHeight || 60;
    tooltip.style.left = (x + w > window.innerWidth  ? e.clientX - w - 8 : x) + 'px';
    tooltip.style.top  = (y + h > window.innerHeight ? e.clientY - h - 8 : y) + 'px';
  });

  document.addEventListener('mouseout', function(e) {
    const el = e.target.closest('.tip');
    if (el) tooltip.classList.remove('show');
  });
})();
</script>
<div id="scheduleUploadModal" class="modal-overlay hidden" onclick="if(event.target===this)closeScheduleUpload()">
  <div class="modal-box" style="max-width:480px;">
    <div class="modal-header">
      <h2>Upload Weekly Schedule</h2>
      <button class="modal-close" onclick="closeScheduleUpload()">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-body" style="padding:22px;">
 
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:18px;line-height:1.6;">
        Select the weekly <strong style="color:var(--text);">.xlsx</strong> schedule file. If you have the .xls version, open it in Excel or Google Sheets and save as .xlsx first.
      </p>
 
      <div class="override-row" style="margin-bottom:14px;">
        <label>Schedule file (.xls)</label>
        <input
          type="file"
          id="scheduleFileInput"
          accept=".xls,.xlsx"
          onchange="onScheduleFileSelected(this)"
          style="background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:var(--font);font-size:13px;padding:7px 10px;width:100%;cursor:pointer;"
        >
      </div>
 
      <div id="schedulePreview" class="hidden" style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:12px 14px;margin-bottom:14px;font-size:13px;">
      </div>
 
      <div id="scheduleUploadStatus" class="schedule-status"></div>
 
      <div class="override-actions" style="margin-top:14px;">
        <button class="btn-override" id="scheduleUploadBtn" onclick="confirmScheduleUpload()" disabled>
          Upload Schedule
        </button>
        <button class="btn-override danger" onclick="closeScheduleUpload()">Cancel</button>
      </div>
 
    </div>
  </div>
</div>
<div id="tabeUploadModal" class="modal-overlay hidden" onclick="if(event.target===this)closeTABEUpload()">
  <div class="modal-box" style="max-width:480px;">
    <div class="modal-header">
      <h2>Upload TABE Scores</h2>
      <button class="modal-close" onclick="closeTABEUpload()">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-body" style="padding:22px;">
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:18px;line-height:1.6;">
        Export the <strong style="color:var(--text);">Master Testing Roster Report</strong> from CIS
        (Test: TABE 13/14) and upload the <strong style="color:var(--text);">.xls</strong> file here.
        Previous scores, current scores, and gains will be calculated automatically.
      </p>
 
      <div class="override-row" style="margin-bottom:14px;">
        <label>TABE report file (.xls)</label>
        <input
          type="file"
          id="tabeFileInput"
          accept=".xls,.xlsx"
          onchange="onTABEFileSelected(this)"
          style="background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:var(--font);font-size:13px;padding:7px 10px;width:100%;cursor:pointer;"
        >
      </div>
 
      <div id="tabePreview" class="hidden" style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:12px 14px;margin-bottom:14px;font-size:13px;"></div>
 
      <div id="tabeUploadStatus" class="schedule-status"></div>
 
      <div class="override-actions" style="margin-top:14px;">
        <button class="btn-override" id="tabeUploadBtn" onclick="confirmTABEUpload()" disabled>
          Upload Scores
        </button>
        <button class="btn-override danger" onclick="closeTABEUpload()">Cancel</button>
      </div>
    </div>
  </div>
</div>
<div id="dashTooltip"></div>
<?!= include('ProductivityModal') ?>
<?!= include('ProductivityScripts') ?>
</body>
</html>
