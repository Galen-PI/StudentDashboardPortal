// ============================================================
// TradeProficiency.gs — per-code trade proficiency breakdown
// ------------------------------------------------------------
// ============================================================

function getStudentTradeProficiency(studentId) {
  try {
    const id = String(studentId).trim();
    if (!id) return { success: false, error: 'Student ID is required.' };

    const progressRows = readVaultRowsForStudent_(VAULT_SHEET_TRADE_PROGRESS, VAULT_TRADE_PROGRESS_HEADERS, id);
    if (!progressRows.length) return { success: true, studentId: id, trades: [] };

    const codeRows = readVaultSheetAsObjects_(VAULT_SHEET_TRADE_CODES, VAULT_TRADE_CODES_HEADERS);
    const refByTrade = {};
    codeRows.forEach(row => {
      const trade = String(row.trade || '').trim();
      if (!trade) return;
      (refByTrade[trade] = refByTrade[trade] || []).push(row);
    });

    const progressByTrade = {};
    progressRows.forEach(row => {
      const trade = String(row.trade || '').trim();
      if (!trade) return;
      (progressByTrade[trade] = progressByTrade[trade] || []).push(row);
    });

    const trades = Object.entries(progressByTrade).map(([trade, rows]) => {
      const refs = refByTrade[trade] || [];
      const codes = rows.map((row, i) => {
        const ref = refs[i] || null; // positional match, not key-based
        const proficienciesCount = ref ? Number(ref.proficienciesCount) || 0 : 0;
        const completedCount     = Number(row.completedCount) || 0;
        const missingCount       = Math.max(proficienciesCount - completedCount, 0);
        const pctCompleted       = proficienciesCount > 0
          ? +((completedCount / proficienciesCount) * 100).toFixed(1)
          : null;
        const avgRatingRaw = row.avgRating;
        const avgRating = (avgRatingRaw !== '' && avgRatingRaw !== null && avgRatingRaw !== undefined)
          ? Number(avgRatingRaw) : null;

        return {
          code: String(row.code || '').trim(),
          category: ref ? String(ref.category || '').trim() : '',
          proficienciesCount, completedCount, missingCount, pctCompleted, avgRating,
        };
      });
      return { trade, codes };
      // Note: deliberately NOT re-sorted alphabetically here — keeping
      // document order is exactly what makes the positional match work.
    });

    return { success: true, studentId: id, trades };

  } catch (err) {
    return { success: false, error: err.message };
  }
}
