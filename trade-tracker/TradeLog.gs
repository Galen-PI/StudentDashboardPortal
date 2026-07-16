// ============================================================
// TradeUpload.gs — ETAR upload -> Vault
// ------------------------------------------------------------
// Replaces the old "TAR Tools" sidebar with a dashboard upload
// modal. Extraction logic below is a direct port of the legacy
// script - student ID, trade detection, percentages, begin
// date, and per-code proficiency counts are parsed exactly the
// same way, since that part already worked correctly.
//
// Difference: the legacy script matched a detected student NAME
// to a per-student tab and wrote counts into tracker cells.
// Vault has no per-student tabs - every ETAR already carries the
// real studentId (F5/G5 merged cell), so name matching is only
// a fallback for the rare ETAR with a blank/unreadable ID cell.
//
// Writes go to:
//   - VAULT_SHEET_TRADE_OVERVIEW (studentId+trade -> tarBeginDate,
//     staffPercent, studentPercent, overallPercent)
//   - VAULT_SHEET_TRADE_PROGRESS (studentId+trade+code ->
//     completedCount, avgRating)
// Both are upserts - existing rows for that studentId+trade are
// removed first, so a re-upload reflects the latest ETAR instead
// of accumulating stale rows.
// ============================================================

function uploadTradeETARData(rows, role) {
  _requirePermission(role || ROLES.ADMIN, 'manage_overrides');

  if (!rows || !rows.length) {
    return { success: false, error: 'No spreadsheet rows were received.' };
  }

  try {
    const tarInfo = extractTarInfoFromRows_(rows);
    if (!tarInfo.tradeKey) {
      return { success: false, error: 'Could not detect which trade this ETAR is for.' };
    }

    let studentId = extractStudentIdFromRows_(rows);
    let studentName = null;

    if (!studentId) {
      const rawName = extractStudentNameFromTarRows_(rows);
      if (!rawName) {
        return { success: false, error: 'Could not find a Student ID or Student Name in this ETAR.' };
      }
      const match = _matchStudentByName_(rawName);
      if (!match) {
        return { success: false, error: 'Found student name "' + rawName + '" but could not match it to anyone in Name Mapping.' };
      }
      studentId   = match.studentId;
      studentName = match.masterName;
    } else {
      const nameMap = readVaultSheetAsObjects_(VAULT_SHEET_NAME_MAPPING, VAULT_NAME_MAPPING_HEADERS);
      const found   = nameMap.find(r => String(r.studentId || '').trim() === String(studentId).trim());
      studentName   = found ? found.masterName : null;
    }

    const percentages  = extractTarCompletionPercentagesFromRows_(rows);
    const tarBeginDate = extractTarBeginDateFromRows_(rows);
    const parsed = tarInfo.tradeKey === 'BCT'
      ? countCompletedItemsFromBctRows_(rows)
      : countCompletedItemsFromRows_(rows);

    _upsertTradeOverviewRow_(studentId, tarInfo.tarName, tarBeginDate, percentages);
    const progressRowCount = _upsertTradeProgressRows_(studentId, tarInfo.tarName, parsed.counts, parsed.avgRatings);

    _clearDashboardCache();

    return {
      success:          true,
      studentId:        studentId,
      studentName:      studentName || '(not found in Name Mapping - check ID)',
      trade:            tarInfo.tarName,
      tarCode:          tarInfo.tarCode || null,
      staffPercent:     percentages.staff   || null,
      studentPercent:   percentages.student || null,
      overallPercent:   percentages.overall || null,
      tarBeginDate:     tarBeginDate ? _toDateStr(tarBeginDate) : null,
      proficiencyCodes: progressRowCount,
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

function _upsertTradeOverviewRow_(studentId, trade, tarBeginDate, percentages) {
  const sheet = getVaultSheet_(VAULT_SHEET_TRADE_OVERVIEW);
  const id    = String(studentId).trim();

  // Preserve any manually-set enrollmentStatus (see setTradeEnrollmentStatus
  // below) — the ETAR upload itself doesn't supply this field, so an
  // upsert here must not silently wipe out a value staff already set.
  const existingRows = readVaultSheetAsObjects_(VAULT_SHEET_TRADE_OVERVIEW, VAULT_TRADE_OVERVIEW_HEADERS)
    .filter(row => String(row.studentId || '').trim() === id && String(row.trade || '').trim() === trade);
  const preservedStatus = existingRows.length ? (existingRows[0].enrollmentStatus || '') : '';

  _deleteVaultRowsMatching_(sheet, VAULT_TRADE_OVERVIEW_HEADERS, row =>
    String(row.studentId || '').trim() === id && String(row.trade || '').trim() === trade
  );

  const rowValues = [
    id,
    trade,
    tarBeginDate ? _toDateStr(tarBeginDate) : '',
    percentStringToNumber_(percentages.staff),
    percentStringToNumber_(percentages.student),
    percentStringToNumber_(percentages.overall),
    preservedStatus,
  ];
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, VAULT_TRADE_OVERVIEW_HEADERS.length).setValues([rowValues]);
  sheet.getRange(sheet.getLastRow(), 1, 1, 1).setNumberFormat('@');
}

// Manual staff-set trade enrollment status. No reliable way to
// auto-extract this from the ETAR file itself was available
// (would need a real sample ETAR to find the right cell), so this
// is a small manual setter instead of a guess that could silently
// read the wrong cell into a field that feeds risk scoring.
//
// Accepted values — matched against what the two existing
// consumers of this field actually check for (both already in
// the codebase, neither changed by this fix):
//   'CO'          -> Helpers.gs:_computeTradePaceMetrics_ treats
//                    this as an exact-match "Completed" override
//                    for the pace-gap calculation.
//   'Withdrawn'    -> Profiles.gs's risk-scoring branch does a
//   'Inactive'        case-insensitive SUBSTRING match for
//                     "inactive" or "withdrawn" anywhere in this
//                     string, so either of these two words (or
//                     any string containing them) will trigger it.
//   '' / null     -> normal/active, no override either way.
function setTradeEnrollmentStatus(studentId, trade, status, role) {
  _requirePermission(role || ROLES.ADMIN, 'manage_overrides');
  const id = String(studentId).trim();
  const sheet = getVaultSheet_(VAULT_SHEET_TRADE_OVERVIEW);
  const rows = readVaultSheetAsObjects_(VAULT_SHEET_TRADE_OVERVIEW, VAULT_TRADE_OVERVIEW_HEADERS);
  const rowIndex = rows.findIndex(row =>
    String(row.studentId || '').trim() === id && String(row.trade || '').trim() === trade
  );
  if (rowIndex === -1) {
    return { success: false, error: 'No Trade Overview row found for that student + trade.' };
  }
  const statusCol = VAULT_TRADE_OVERVIEW_HEADERS.indexOf('enrollmentStatus') + 1;
  sheet.getRange(rowIndex + 2, statusCol).setValue(String(status || '').trim());
  _clearDashboardCache();
  return { success: true, studentId: id, trade: trade, enrollmentStatus: String(status || '').trim() };
}

function _upsertTradeProgressRows_(studentId, trade, counts, avgRatings) {
  const sheet = getVaultSheet_(VAULT_SHEET_TRADE_PROGRESS);
  const id    = String(studentId).trim();

  _deleteVaultRowsMatching_(sheet, VAULT_TRADE_PROGRESS_HEADERS, row =>
    String(row.studentId || '').trim() === id && String(row.trade || '').trim() === trade
  );

  const codes = Object.keys(counts || {}).sort(sortTarCodes_);
  if (!codes.length) return 0;

  const rows = codes.map(code => [
    id, trade, code,
    counts[code] || 0,
    avgRatings && avgRatings[code] !== undefined ? avgRatings[code] : '',
  ]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, VAULT_TRADE_PROGRESS_HEADERS.length).setValues(rows);
  sheet.getRange(sheet.getLastRow() - rows.length + 1, 1, rows.length, 1).setNumberFormat('@');
  return rows.length;
}

function _deleteVaultRowsMatching_(sheet, headers, predicateFn) {
  const lastRow = sheet.getLastRow();
  if (lastRow < VAULT_DATA_START_ROW) return;

  const numRows = lastRow - VAULT_DATA_START_ROW + 1;
  const values  = sheet.getRange(VAULT_DATA_START_ROW, 1, numRows, headers.length).getValues();

  const keepRows = [];
  values.forEach(row => {
    const obj = {};
    headers.forEach((key, i) => { obj[key] = row[i]; });
    if (!predicateFn(obj)) keepRows.push(row);
  });

  sheet.getRange(VAULT_DATA_START_ROW, 1, numRows, headers.length).clearContent();
  if (keepRows.length) {
    sheet.getRange(VAULT_DATA_START_ROW, 1, keepRows.length, headers.length).setValues(keepRows);
  }
}

function _matchStudentByName_(rawName) {
  const nameMap     = readVaultSheetAsObjects_(VAULT_SHEET_NAME_MAPPING, VAULT_NAME_MAPPING_HEADERS);
  const normTarget  = _norm(rawName);
  const looseTarget = _normLoose(rawName);

  let match = nameMap.find(r => _norm(r.masterName) === normTarget);
  if (!match) match = nameMap.find(r => _normLoose(r.masterName) === looseTarget);
  if (!match) return null;

  return { studentId: String(match.studentId).trim(), masterName: match.masterName };
}


// ============================================================
// EXTRACTION LOGIC - ported verbatim from the legacy TAR Tools
// script. Pure parsing, no spreadsheet access.
// ============================================================

function extractStudentNameFromTarRows_(rows) {
  if (!rows || rows.length === 0) return "";
  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i] || [];
    const row = rawRow.map(v => String(v == null ? "" : v).trim());
    const joined = row.filter(v => v !== "").join(" ").replace(/\s+/g, " ").trim();
    if (!joined) continue;

    let match = joined.match(/Student\s+Name\s*:?\s*(.+)$/i);
    if (match && match[1]) {
      const cleaned = cleanTarStudentName_(match[1]);
      if (isLikelyStudentName_(cleaned)) return cleaned;
    }

    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (/^Student\s+Name\s*:?\s*$/i.test(cell)) {
        for (let next = c + 1; next < row.length; next++) {
          const possibleName = cleanTarStudentName_(row[next]);
          if (isLikelyStudentName_(possibleName)) return possibleName;
        }
        for (let r = i + 1; r <= i + 3 && r < rows.length; r++) {
          const nextRow = (rows[r] || []).map(v => String(v == null ? "" : v).trim()).filter(v => v !== "");
          for (const value of nextRow) {
            const possibleName = cleanTarStudentName_(value);
            if (isLikelyStudentName_(possibleName)) return possibleName;
          }
        }
      }
      match = cell.match(/Student\s+Name\s*:?\s*(.+)$/i);
      if (match && match[1]) {
        const cleaned = cleanTarStudentName_(match[1]);
        if (isLikelyStudentName_(cleaned)) return cleaned;
      }
    }
  }

  const flatText = rows.map(row => row.map(v => String(v == null ? "" : v).trim()).filter(v => v !== "").join(" "))
    .join(" ").replace(/\s+/g, " ").trim();
  const fallbackMatch = flatText.match(/Student\s+Name\s*:?\s+(.+?)(?:Student\s+ID|TAR\s+Begin\s+Date|TAR\s+End\s+Date|Course\s+Name|TAR\s+Name|TAR\s+Code|$)/i);
  if (fallbackMatch && fallbackMatch[1]) {
    const cleaned = cleanTarStudentName_(fallbackMatch[1]);
    if (isLikelyStudentName_(cleaned)) return cleaned;
  }
  return "";
}

function cleanTarStudentName_(name) {
  return String(name || "")
    .replace(/Student\s+Name\s*:?/i, "")
    .replace(/Student\s+ID.*$/i, "")
    .replace(/TAR\s+Begin\s+Date.*$/i, "")
    .replace(/TAR\s+End\s+Date.*$/i, "")
    .replace(/Course\s+Name.*$/i, "")
    .replace(/TAR\s+Name.*$/i, "")
    .replace(/TAR\s+Code.*$/i, "")
    .replace(/TAR\s+Status.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyStudentName_(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/Student\s+Name/i.test(text)) return false;
  if (/Student\s+ID/i.test(text)) return false;
  if (/TAR\s+/i.test(text)) return false;
  if (/Course\s+Name/i.test(text)) return false;
  if (/Tulsa\s+Job\s+Corps/i.test(text)) return false;
  if (/Center\s+Information\s+System/i.test(text)) return false;
  if (/Training\s+Achievement\s+Record/i.test(text)) return false;
  if (/^\d+$/.test(text)) return false;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) return false;
  if (/^\d+(?:\.\d+)?%$/.test(text)) return false;
  if (!/[a-zA-Z]{2,}/.test(text)) return false;
  if (!/[\s,]/.test(text)) return false;
  return true;
}

function extractStudentIdFromRows_(rows) {
  if (!rows || rows.length < 5) return "";
  const row5 = rows[4] || [];
  const possibleValues = [row5[5], row5[6]];
  for (const value of possibleValues) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < (rows[r] || []).length; c++) {
      const cell = String(rows[r][c] || "").trim();
      if (/Student\s*ID/i.test(cell)) {
        for (let next = c + 1; next <= c + 3; next++) {
          const value = String(rows[r][next] || "").trim();
          if (value && !/Student\s*ID/i.test(value)) return value;
        }
      }
    }
  }
  return "";
}

function countCompletedItemsFromRows_(rows) {
  const counts = {};
  const ratings = {};
  let currentCode = null;
  let pendingItemCode = null;
  let pendingItemRating = null;

  function finishPendingItem_() {
    if (!pendingItemCode) { pendingItemRating = null; return; }
    if (pendingItemRating !== null) {
      if (!ratings[pendingItemCode]) ratings[pendingItemCode] = [];
      ratings[pendingItemCode].push(pendingItemRating);
      if (pendingItemRating === 2 || pendingItemRating === 3) {
        counts[pendingItemCode] = (counts[pendingItemCode] || 0) + 1;
      }
    }
    pendingItemCode = null;
    pendingItemRating = null;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = (rows[i] || []).map(v => String(v == null ? "" : v).trim()).filter(v => v !== "");
    if (row.length === 0) continue;
    const joined = row.join(" ").replace(/\s+/g, " ").trim();
    if (isJunkTarLine_(joined)) continue;

    const sectionCode = getTarSectionCode_(joined);
    if (sectionCode) {
      finishPendingItem_();
      currentCode = sectionCode;
      if (counts[currentCode] === undefined) counts[currentCode] = 0;
      if (ratings[currentCode] === undefined) ratings[currentCode] = [];
      continue;
    }
    if (!currentCode) continue;

    const isMainItem = isTarMainItemLine_(joined);
    const rating = getTarRatingFromRow_(row, joined);

    if (isMainItem) {
      finishPendingItem_();
      pendingItemCode = currentCode;
      pendingItemRating = rating;
      continue;
    }
    if (pendingItemCode && pendingItemRating === null && rating !== null) {
      pendingItemRating = rating;
    }
  }
  finishPendingItem_();

  const avgRatings = {};
  Object.keys(ratings).forEach(code => {
    const nums = ratings[code].filter(n => typeof n === "number");
    avgRatings[code] = nums.length === 0 ? "" : Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 100) / 100;
  });

  return { counts, avgRatings };
}

function getTarSectionCode_(text) {
  let match = text.match(/^([A-Z]{1,2})\.\s+[A-Za-z0-9]/);
  if (match) return match[1];
  match = text.match(/^(\d{1,2}\.0)\s+[A-Za-z0-9]/);
  if (match) return match[1];
  return null;
}

function isTarMainItemLine_(text) {
  return /^(\d+(?:\.\d+)?)\.?\s+/.test(text);
}

function countCompletedItemsFromBctRows_(rows) {
  const counts = {};
  const ratings = {};
  let currentCode = null;
  let pendingItemCode = null;
  let pendingItemRating = null;

  function finishPendingItem_() {
    if (!pendingItemCode) { pendingItemRating = null; return; }
    if (pendingItemRating !== null) {
      if (!ratings[pendingItemCode]) ratings[pendingItemCode] = [];
      ratings[pendingItemCode].push(pendingItemRating);
      if (pendingItemRating === 2 || pendingItemRating === 3) {
        counts[pendingItemCode] = (counts[pendingItemCode] || 0) + 1;
      }
    }
    pendingItemCode = null;
    pendingItemRating = null;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = (rows[i] || []).map(v => String(v == null ? "" : v).trim()).filter(v => v !== "");
    if (row.length === 0) continue;
    const joined = row.join(" ").replace(/\s+/g, " ").trim();
    if (!joined || isJunkTarLine_(joined)) continue;

    const sectionCode = getBctSectionCode_(joined);
    if (sectionCode) {
      finishPendingItem_();
      currentCode = sectionCode;
      if (counts[currentCode] === undefined) counts[currentCode] = 0;
      if (ratings[currentCode] === undefined) ratings[currentCode] = [];
      continue;
    }
    if (!currentCode) continue;

    const isMainItem = isBctMainItemLine_(joined);
    const rating = getTarRatingFromRow_(row, joined);

    if (isMainItem) {
      finishPendingItem_();
      pendingItemCode = currentCode;
      pendingItemRating = rating;
      continue;
    }
    if (pendingItemCode && pendingItemRating === null && rating !== null) {
      pendingItemRating = rating;
    }
  }
  finishPendingItem_();

  const avgRatings = {};
  Object.keys(ratings).forEach(code => {
    const nums = ratings[code].filter(n => typeof n === "number");
    avgRatings[code] = nums.length === 0 ? "" : Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 100) / 100;
  });

  return { counts, avgRatings };
}

function getBctSectionCode_(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  let match = clean.match(/^(\d{1,2}\.0)\s+[A-Za-z]/);
  if (match) return match[1];
  match = clean.match(/^(\d{1,2})\.?\s+[A-Z][A-Za-z\s/&,-]+$/);
  if (match) return match[1] + ".0";
  match = clean.match(/^([A-Z]{1,3})\.\s+[A-Za-z]/);
  if (match) return match[1];
  return null;
}

function isBctMainItemLine_(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (/^\d{1,2}\.0\s+[A-Za-z]/.test(clean)) return false;
  if (/^\d{1,2}\.?\s+[A-Z][A-Za-z\s/&,-]+$/.test(clean)) return false;
  if (/^[A-Z]{1,3}\.\s+[A-Za-z]/.test(clean)) return false;
  return /^\d{1,2}\.\d+\s+/.test(clean);
}

function getTarRatingFromRow_(row, joinedText) {
  for (const cell of row) {
    if (cell === "1" || cell === "2" || cell === "3") return Number(cell);
  }
  let match = joinedText.match(/\s([123])\s+\d{1,2}\/\d{1,2}\/\d{4}/);
  if (match) return Number(match[1]);
  match = joinedText.match(/\s([123])\s*$/);
  if (match) return Number(match[1]);
  return null;
}

function isJunkTarLine_(text) {
  const junkPatterns = [
    /^Training Achievement Record Items/i, /^Rating/i, /^Proficiency/i, /^Attained/i,
    /^Student Acknowledgement/i, /^Student Name/i, /^Student ID/i, /^TAR Begin Date/i,
    /^TAR End Date/i, /^TAR Name/i, /^TAR Code/i, /^TAR Status/i, /^Course Name/i,
    /^FOR OFFICIAL USE ONLY/i, /^Rating\s*:/i, /^Staff % Completed/i,
    /^Student % Completed/i, /^Overall % Completed/i, /^Tulsa Job Corps Center/i,
    /^STUDENT TRAINING ACHIEVEMENT RECORD REPORT/i,
    /^\d{1,2}\/\d{1,2}\/\d{4}.*Center Information System Page/i, /^-+$/
  ];
  return junkPatterns.some(pattern => pattern.test(text));
}

function sortTarCodes_(a, b) {
  const isNumA = /^\d/.test(a);
  const isNumB = /^\d/.test(b);
  if (isNumA && isNumB) return parseFloat(a) - parseFloat(b);
  if (isNumA) return -1;
  if (isNumB) return 1;
  return codeToNumber_(a) - codeToNumber_(b);
}

function codeToNumber_(code) {
  let n = 0;
  for (let i = 0; i < code.length; i++) n = n * 26 + (code.charCodeAt(i) - 64);
  return n;
}

function extractTarCompletionPercentagesFromRows_(rows) {
  const lines = rows.map(row => row.map(v => String(v == null ? "" : v).trim()).filter(v => v !== "").join(" ").replace(/\s+/g, " ").trim())
    .filter(line => line !== "");

  const result = { staff: "", student: "", overall: "" };

  for (let i = 0; i < lines.length; i++) {
    if (/Staff\s*%\s*Completed/i.test(lines[i])) {
      const windowText = lines.slice(i, i + 10).join(" ");
      const percents = windowText.match(/\d+(?:\.\d+)?%/g) || [];
      if (percents.length >= 1) result.staff = percents[0];
      if (percents.length >= 2) result.student = percents[1];
      if (percents.length >= 3) result.overall = percents[2];
      break;
    }
  }
  if (!result.overall) {
    for (let i = 0; i < lines.length; i++) {
      if (/Overall\s*%\s*Completed/i.test(lines[i])) {
        const windowText = lines.slice(i, i + 5).join(" ");
        const percents = windowText.match(/\d+(?:\.\d+)?%/g) || [];
        if (percents.length >= 1) result.overall = percents[0];
        break;
      }
    }
  }
  if (!result.student) {
    for (let i = 0; i < lines.length; i++) {
      if (/Student\s*%\s*Completed/i.test(lines[i])) {
        const windowText = lines.slice(i, i + 5).join(" ");
        const percents = windowText.match(/\d+(?:\.\d+)?%/g) || [];
        if (percents.length >= 1) result.student = percents[0];
        break;
      }
    }
  }
  return result;
}

function extractTarInfoFromRows_(rows) {
  const lines = rows.map(row => row.map(v => String(v == null ? "" : v).trim()).filter(v => v !== "").join(" ").replace(/\s+/g, " ").trim())
    .filter(line => line !== "");
  const joined = lines.join(" ");
  const result = { tarName: "", tarCode: "", tradeKey: "" };

  const codeMatch = joined.match(/\b([A-Z]{3,6}-\d{3}-[A-Z]{3}-\d{2})\b/);
  if (codeMatch) result.tarCode = codeMatch[1];

  if (/Building Construction Technology/i.test(joined) || /\bBCT\b/i.test(joined) || /Construction Technology/i.test(joined)) {
    result.tarName = "Building Construction Technology"; result.tradeKey = "BCT";
  } else if (/Pharmacy Technician/i.test(joined) || /PHARM-100-OJC-19/i.test(joined)) {
    result.tarName = "Pharmacy Technician"; result.tradeKey = "PHARMACY";
  } else if (/Certified Nurse Assistant/i.test(joined) || /NURSE-100-OJC-15/i.test(joined)) {
    result.tarName = "Certified Nurse Assistant"; result.tradeKey = "CNA";
  } else if (/Culinary Arts/i.test(joined) || /CULIN-100-OJC-19/i.test(joined)) {
    result.tarName = "Culinary Arts"; result.tradeKey = "CULINARY";
  } else if (/Security/i.test(joined) || /SECUR-100-OJC-13/i.test(joined)) {
    result.tarName = "Security"; result.tradeKey = "SECURITY";
  } else if (/Carpentry/i.test(joined) || /CARPT-100-UBC-18/i.test(joined)) {
    result.tarName = "Carpentry"; result.tradeKey = "CARPENTRY";
  }
  return result;
}

function percentStringToNumber_(value) {
  const text = String(value || "").replace("%", "").trim();
  const numberValue = Number(text);
  if (isNaN(numberValue)) return "";
  return numberValue / 100;
}

function extractTarBeginDateFromRows_(rows) {
  if (!rows || rows.length === 0) return "";
  const possibleDates = [];
  if (rows[9] && rows[9][10] !== undefined) possibleDates.push(rows[9][10]);
  if (rows[10] && rows[10][10] !== undefined) possibleDates.push(rows[10][10]);
  for (const value of possibleDates) {
    const parsedDate = normalizeTarDateValue_(value);
    if (parsedDate) return parsedDate;
  }
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cellText = String(row[c] == null ? "" : row[c]).trim();
      if (/TAR\s+Begin\s+Date/i.test(cellText)) {
        for (let nextCol = c + 1; nextCol <= c + 4 && nextCol < row.length; nextCol++) {
          const parsedDate = normalizeTarDateValue_(row[nextCol]);
          if (parsedDate) return parsedDate;
        }
        for (let nextRow = r + 1; nextRow <= r + 4 && nextRow < rows.length; nextRow++) {
          const nextRowValues = rows[nextRow] || [];
          const parsedDate = normalizeTarDateValue_(nextRowValues[c]);
          if (parsedDate) return parsedDate;
        }
        for (let nearbyRow = r; nearbyRow <= r + 4 && nearbyRow < rows.length; nearbyRow++) {
          const nearbyValues = rows[nearbyRow] || [];
          for (let nearbyCol = 0; nearbyCol < nearbyValues.length; nearbyCol++) {
            const parsedDate = normalizeTarDateValue_(nearbyValues[nearbyCol]);
            if (parsedDate) return parsedDate;
          }
        }
      }
    }
  }
  return "";
}

function normalizeTarDateValue_(value) {
  if (value === null || value === undefined || value === "") return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) return value;
  if (typeof value === "number" && !isNaN(value)) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!isNaN(date)) return date;
  }
  const text = String(value).trim();
  if (!text) return "";
  const match = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (match) {
    const date = new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
    if (!isNaN(date)) return date;
  }
  return "";
}
