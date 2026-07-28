// ── Custom Columns ────────────────────────────────────────────────
// Lets staff add their own extra columns to the table — a name and a
// free-text value per student. Definitions (which columns exist, in
// what order) live in one small sheet; the actual per-student values
// live in a separate flat table, same one-read-one-write pattern used
// everywhere else in the Vault.

function _ensureCustomColumnDefsSheet_() {
  const ss = getVaultSpreadsheet_();
  let sheet = ss.getSheetByName(VAULT_SHEET_CUSTOM_COLUMN_DEFS);
  if (!sheet) {
    sheet = ss.insertSheet(VAULT_SHEET_CUSTOM_COLUMN_DEFS);
    sheet.appendRow(VAULT_CUSTOM_COLUMN_DEFS_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function _ensureCustomColumnValuesSheet_() {
  const ss = getVaultSpreadsheet_();
  let sheet = ss.getSheetByName(VAULT_SHEET_CUSTOM_COLUMN_VALUES);
  if (!sheet) {
    sheet = ss.insertSheet(VAULT_SHEET_CUSTOM_COLUMN_VALUES);
    sheet.appendRow(VAULT_CUSTOM_COLUMN_VALUES_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Returns everything the client needs in one call: the ordered list
// of column definitions, and every stored value (studentId/columnName
// pairs) so the client can build its own per-student lookup without a
// second round-trip.
function getCustomColumnData() {
  try {
    const defsSheet = _ensureCustomColumnDefsSheet_();
    const defs = readVaultSheetAsObjects_(VAULT_SHEET_CUSTOM_COLUMN_DEFS, VAULT_CUSTOM_COLUMN_DEFS_HEADERS)
      .filter(d => String(d.columnName || '').trim())
      .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
      .map(d => String(d.columnName).trim());

    _ensureCustomColumnValuesSheet_();
    const values = readVaultSheetAsObjects_(VAULT_SHEET_CUSTOM_COLUMN_VALUES, VAULT_CUSTOM_COLUMN_VALUES_HEADERS)
      .filter(v => String(v.studentId || '').trim() && String(v.columnName || '').trim())
      .map(v => ({ studentId: String(v.studentId).trim(), columnName: String(v.columnName).trim(), value: v.value || '' }));

    return { success: true, columns: defs, values };
  } catch (e) {
    Logger.log('getCustomColumnData error: ' + e.message);
    return { success: false, error: e.message, columns: [], values: [] };
  }
}

// Adds a new custom column definition. Silently no-ops (returns
// success either way) if the name already exists — adding the same
// column twice shouldn't be an error a person has to think about.
function addCustomColumn(columnName, role) {
  _requirePermission(role || ROLES.ADMIN, 'manage_overrides');
  const name = String(columnName || '').trim();
  if (!name) return { success: false, error: 'Column name is required.' };

  return _withLock(() => {
    const sheet = _ensureCustomColumnDefsSheet_();
    const existing = readVaultSheetAsObjects_(VAULT_SHEET_CUSTOM_COLUMN_DEFS, VAULT_CUSTOM_COLUMN_DEFS_HEADERS);
    if (existing.some(d => String(d.columnName || '').trim().toLowerCase() === name.toLowerCase())) {
      return { success: true, columnName: name, alreadyExisted: true };
    }
    const maxOrder = existing.reduce((max, d) => Math.max(max, Number(d.sortOrder) || 0), 0);
    sheet.appendRow([name, maxOrder + 1, Session.getActiveUser().getEmail() || '', new Date().toISOString()]);
    return { success: true, columnName: name };
  });
}

// Removes a custom column definition AND every stored value for it —
// a column a person deletes shouldn't leave orphaned data silently
// sitting in Custom Column Values forever.
function removeCustomColumn(columnName, role) {
  _requirePermission(role || ROLES.ADMIN, 'manage_overrides');
  const name = String(columnName || '').trim();
  if (!name) return { success: false, error: 'Column name is required.' };

  return _withLock(() => {
    const defsSheet = _ensureCustomColumnDefsSheet_();
    const defsLastRow = defsSheet.getLastRow();
    if (defsLastRow >= VAULT_DATA_START_ROW) {
      const defsData = defsSheet.getRange(VAULT_DATA_START_ROW, 1, defsLastRow - VAULT_DATA_START_ROW + 1, VAULT_CUSTOM_COLUMN_DEFS_HEADERS.length).getValues();
      defsData.forEach((row, i) => {
        if (String(row[0] || '').trim().toLowerCase() === name.toLowerCase()) {
          defsSheet.getRange(VAULT_DATA_START_ROW + i, 1, 1, VAULT_CUSTOM_COLUMN_DEFS_HEADERS.length).clearContent();
        }
      });
    }

    const valuesSheet = _ensureCustomColumnValuesSheet_();
    const valuesLastRow = valuesSheet.getLastRow();
    let clearedCount = 0;
    if (valuesLastRow >= VAULT_DATA_START_ROW) {
      const valuesData = valuesSheet.getRange(VAULT_DATA_START_ROW, 1, valuesLastRow - VAULT_DATA_START_ROW + 1, VAULT_CUSTOM_COLUMN_VALUES_HEADERS.length).getValues();
      valuesData.forEach((row, i) => {
        if (String(row[1] || '').trim().toLowerCase() === name.toLowerCase()) {
          valuesSheet.getRange(VAULT_DATA_START_ROW + i, 1, 1, VAULT_CUSTOM_COLUMN_VALUES_HEADERS.length).clearContent();
          clearedCount++;
        }
      });
    }

    _clearDashboardCache();
    return { success: true, columnName: name, valuesCleared: clearedCount };
  });
}

// Upserts one student's value for one custom column — matched by
// studentId+columnName, updated in place if it already exists rather
// than appended, same reasoning as everywhere else duplicates have
// bitten this app today.
function saveCustomColumnValue(studentId, columnName, value, role) {
  _requirePermission(role || ROLES.ADMIN, 'manage_overrides');
  const id   = String(studentId || '').trim();
  const name = String(columnName || '').trim();
  if (!id || !name) return { success: false, error: 'Student ID and column name are required.' };

  return _withLock(() => {
    const sheet = _ensureCustomColumnValuesSheet_();
    const lastRow = sheet.getLastRow();
    let existingRowNum = null;
    if (lastRow >= VAULT_DATA_START_ROW) {
      const data = sheet.getRange(VAULT_DATA_START_ROW, 1, lastRow - VAULT_DATA_START_ROW + 1, 2).getValues();
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][0] || '').trim() === id && String(data[i][1] || '').trim().toLowerCase() === name.toLowerCase()) {
          existingRowNum = VAULT_DATA_START_ROW + i;
          break;
        }
      }
    }

    const rowValues = [id, name, String(value || ''), new Date().toISOString()];
    if (existingRowNum) {
      sheet.getRange(existingRowNum, 1, 1, VAULT_CUSTOM_COLUMN_VALUES_HEADERS.length).setValues([rowValues]);
    } else {
      const newRow = sheet.getLastRow() + 1;
      sheet.getRange(newRow, 1, 1, VAULT_CUSTOM_COLUMN_VALUES_HEADERS.length).setValues([rowValues]);
      sheet.getRange(newRow, 1, 1, 1).setNumberFormat('@');
    }
    return { success: true };
  });
}
