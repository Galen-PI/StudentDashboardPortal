function getProductivityData(hubSS) {
  try {
    const sheet = hubSS.getSheetByName(VAULT_SHEET_PRODUCTIVITY);
    if (!sheet) {
      Logger.log('Productivity Data sheet not found — skipping.');
      return [];
    }
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    const values = sheet.getRange(2, 1, lastRow - 1, 25).getValues();
    const WEEKS = [
      { month:'April', week:1, workedIdx:1, assignedIdx:2 },
      { month:'April', week:2, workedIdx:3, assignedIdx:4 },
      { month:'April', week:3, workedIdx:5, assignedIdx:6 },
      { month:'April', week:4, workedIdx:7, assignedIdx:8 },
      { month:'May', week:1, workedIdx:9, assignedIdx:10 },
      { month:'May', week:2, workedIdx:11, assignedIdx:12 },
      { month:'May', week:3, workedIdx:13, assignedIdx:14 },
      { month:'May', week:4, workedIdx:15, assignedIdx:16 },
      { month:'June', week:1, workedIdx:17, assignedIdx:18 },
      { month:'June', week:2, workedIdx:19, assignedIdx:20 },
      { month:'June', week:3, workedIdx:21, assignedIdx:22 },
      { month:'June', week:4, workedIdx:23, assignedIdx:24 },
    ];
    const results = [];
    values.forEach(row => {
      const name = String(row[0] || '').trim();
      if (!name || name.toLowerCase().includes('name')) return;
      const weeks = [];
      let totalWorked = 0;
      let totalAssigned = 0;
      WEEKS.forEach(w => {
        const worked = _parseProductivityHours(row[w.workedIdx]);
        const assigned = _parseProductivityHours(row[w.assignedIdx]);
        if (assigned === null) return;
        const productivity = assigned > 0
          ? +((worked / assigned) * 100).toFixed(1)
          : null;
        weeks.push({
          month: w.month,
          week: w.week,
          label: w.month + ' Wk' + w.week,
          worked: worked ?? 0,
          assigned,
          productivity,
          notScheduled: assigned === 0,
        });
        if (worked !== null) totalWorked += worked;
        if (assigned !== null) totalAssigned += assigned;
      });
      if (!weeks.length) return;
      const overallProductivity = totalAssigned > 0
        ? +((totalWorked / totalAssigned) * 100).toFixed(1)
        : null;
      const sorted = [...weeks]
        .filter(w => w.productivity !== null)
        .sort((a,b) => b.productivity - a.productivity);
      const peakWeek = sorted[0] || null;
      const troughWeek = sorted[sorted.length - 1] || null;
      const half = Math.floor(weeks.length / 2);
      const firstHalf = weeks.slice(0, half);
      const secHalf = weeks.slice(half);
      const avgFirst = firstHalf.length
        ? firstHalf.reduce((s,w)=>s+(w.productivity||0),0) / firstHalf.length
        : null;
      const avgSecond = secHalf.length
        ? secHalf.reduce((s,w)=>s+(w.productivity||0),0) / secHalf.length
        : null;
      let trend = 'stable';
      if (avgFirst !== null && avgSecond !== null) {
        if (avgSecond - avgFirst > 5) trend = 'improving';
        if (avgSecond - avgFirst < -5) trend = 'declining';
      }
      results.push({
        name,
        weeks,
        totalWorked: +totalWorked.toFixed(2),
        totalAssigned: +totalAssigned.toFixed(2),
        overallProductivity,
        peakWeek,
        troughWeek,
        trend,
        weeksWithData: weeks.length,
      });
    });
    Logger.log('Productivity Data: ' + results.length + ' students');
    return results;
  } catch(e) {
    Logger.log('getProductivityData error: ' + e.message);
    return [];
  }
}

function _parseProductivityHours(val) {
  if (val === null || val === undefined) return null;
  if (String(val).trim() === 'NOT_IN_MONTH') return null;
  if (val === '' || val === 0) return 0;
  if (val instanceof Date) {
    const SHEETS_EPOCH = new Date(1899,11,30);
    const diffMs = val.getTime() - SHEETS_EPOCH.getTime();
    const h = diffMs / (1000 * 60 * 60);
    return h > 0 ? +h.toFixed(2) : 0;
  }
  const str = String(val).trim();
  if (!str || str === '—' || str === '-') return 0;
  if (str.includes(':')) {
    const parts = str.split(':').map(Number);
    if (parts.length === 3)
      return +((parts[0] + parts[1]/60 + parts[2]/3600)).toFixed(2);
    if (parts.length === 2)
      return +((parts[0] + parts[1]/60)).toFixed(2);
  }
  const n = Number(str);
  return isNaN(n) ? 0 : +n.toFixed(2);
}

function _buildProductivityCohortSummary(productivityData) {
  if (!productivityData || !productivityData.length) return [];
  const weekMap = {};
  productivityData.forEach(student => {
    student.weeks.forEach(w => {
      if (!weekMap[w.label]) {
        weekMap[w.label] = {
          label:w.label,
          month:w.month,
          week:w.week,
          students:[]
        };
      }
      weekMap[w.label].students.push({
        name:student.name,
        worked:w.worked,
        assigned:w.assigned,
        productivity:w.productivity,
      });
    });
  });
  return Object.values(weekMap).map(w => {
    const productivities = w.students.map(s=>s.productivity).filter(v=>v!==null);
    const assignedVals = w.students.map(s=>s.assigned).filter(v=>v!==null && v>0);
    const workedVals = w.students.map(s=>s.worked).filter(v=>v!==null);
    const avg = arr => arr.length
      ? +(arr.reduce((s,v)=>s+v,0)/arr.length).toFixed(1)
      : null;
    return {
      label:w.label,
      month:w.month,
      week:w.week,
      studentCount:w.students.length,
      avgProductivity:avg(productivities),
      avgAssigned:avg(assignedVals),
      avgWorked:avg(workedVals),
      minProductivity:productivities.length ? +Math.min(...productivities).toFixed(1) : null,
      maxProductivity:productivities.length ? +Math.max(...productivities).toFixed(1) : null,
    };
  });
}
