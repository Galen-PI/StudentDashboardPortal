// ============================================================
// Predictions.gs — Prediction models
// ============================================================

// ── HS Graduation Predictions ─────────────────────────────────
function _computeHSGraduationPredictions(profiles, hsMonthlyData) {
  if (!profiles || !profiles.length) return [];

  const monthlyByStudent = hsMonthlyData|| {};

  const today        = new Date();
  const twoMonthsOut = new Date(today.getFullYear(), today.getMonth() + 2, today.getDate());
  const predictions  = [];

  profiles.forEach(p => {
    if (p.hsComplete) return;
    if (!p.academic || p.academic.type !== 'HS') return;

    const ac         = p.academic;
    const courseData = p.courseData || null;

    const graduationDate = ac.graduation ? _parseLocalDate(ac.graduation) : null;
    if (!graduationDate) return;
    if (graduationDate > twoMonthsOut) return;
    if (graduationDate < new Date(today.getFullYear(), today.getMonth() - 1, 1)) return;

    const creditsLeft = ac.credits !== null && ac.credits !== undefined
      ? ac.credits
      : courseData ? courseData.remainingCredits : null;

    const remainingHours = courseData ? courseData.remainingHours : null;

    const monthlyRecord   = monthlyByStudent[p.academicId] || null;
    const completedMonths = monthlyRecord
      ? (monthlyRecord.months || []).filter(m => !m.inProgress && m.creditsGained !== null && m.creditsGained > 0)
      : [];

    let monthlyRate = null;
    if (completedMonths.length >= 2) {
      const recent = completedMonths.slice(-3);
      monthlyRate  = +(recent.reduce((s, m) => s + m.creditsGained, 0) / recent.length).toFixed(2);
    } else if (completedMonths.length === 1) {
      monthlyRate = completedMonths[0].creditsGained;
    }

    const weeklyAvgHours = ac.weeklyAvgHours || null;
    const pace           = ac.pace ? String(ac.pace).trim() : null;

    let score = 0;
    const notes = [];

    // Signal 1: credits remaining (0–25 pts)
    if (creditsLeft !== null) {
      if (creditsLeft <= 2)       { score += 25; notes.push('Almost done — ' + creditsLeft + ' credit(s) left'); }
      else if (creditsLeft <= 5)  { score += 18; notes.push(creditsLeft + ' credits remaining'); }
      else if (creditsLeft <= 10) { score += 10; notes.push(creditsLeft + ' credits remaining'); }
      else                        { score +=  3; notes.push(creditsLeft + ' credits remaining — significant work ahead'); }
    }

    // Signal 2: monthly rate vs credits left (0–20 pts)
    if (monthlyRate !== null && creditsLeft !== null && monthlyRate > 0) {
      const monthsNeeded = creditsLeft / monthlyRate;
      if (monthsNeeded <= 1)      { score += 20; notes.push('At current pace (~' + monthlyRate + ' cr/mo), on track to finish in < 1 month'); }
      else if (monthsNeeded <= 2) { score += 14; notes.push('At current pace (~' + monthlyRate + ' cr/mo), ~' + monthsNeeded.toFixed(1) + ' months to finish'); }
      else if (monthsNeeded <= 3) { score +=  7; notes.push('At current pace (~' + monthlyRate + ' cr/mo), ~' + monthsNeeded.toFixed(1) + ' months to finish'); }
      else                        { score +=  2; notes.push('Pace (' + monthlyRate + ' cr/mo) may not be enough to finish on time'); }
    } else if (monthlyRate === null) {
      notes.push('No monthly credit history on file');
    }

    // Signal 3: Edgenuity pace flag (0–15 pts)
    if (pace) {
      const paceLower = pace.toLowerCase();
      if (paceLower.includes('ahead'))                              { score += 15; notes.push('Edgenuity pace: ' + pace); }
      else if (paceLower.includes('on'))                           { score += 10; notes.push('Edgenuity pace: ' + pace); }
      else if (paceLower.includes('slow') || paceLower.includes('behind')) { score +=  2; notes.push('Edgenuity pace: ' + pace + ' — may need support'); }
    }

    // Signal 4: completion % (0–15 pts)
    const academicPct = ac.percent;
    if (academicPct !== null) {
      if (academicPct >= 95)      { score += 15; notes.push(academicPct + '% complete'); }
      else if (academicPct >= 85) { score += 10; notes.push(academicPct + '% complete'); }
      else if (academicPct >= 70) { score +=  6; notes.push(academicPct + '% complete'); }
      else                        { score +=  2; notes.push(academicPct + '% complete — still significant coursework remaining'); }
    }

    // Signal 5: remaining hours vs weekly pace (0–15 pts)
    if (remainingHours !== null && weeklyAvgHours !== null && weeklyAvgHours > 0) {
      const weeksToFinish  = remainingHours / weeklyAvgHours;
      const weeksUntilGrad = (graduationDate - today) / (7 * 86400000);
      if (weeksToFinish <= weeksUntilGrad * 0.8) { score += 15; notes.push('Remaining hours (' + remainingHours + 'h) achievable at current pace (' + weeklyAvgHours + 'h/wk)'); }
      else if (weeksToFinish <= weeksUntilGrad)   { score +=  8; notes.push('Remaining hours (' + remainingHours + 'h) tight but possible at ' + weeklyAvgHours + 'h/wk'); }
      else                                         { score +=  2; notes.push('Remaining hours (' + remainingHours + 'h) may exceed time available at ' + weeklyAvgHours + 'h/wk'); }
    } else if (remainingHours !== null) {
      notes.push(remainingHours + 'h of coursework remaining');
    }

    // Signal 6: risk level (0–10 pts)
    const riskLevel = p.risk ? p.risk.level : null;
    if (riskLevel === 'LOW')         { score += 10; }
    else if (riskLevel === 'MEDIUM') { score +=  5; notes.push('Flagged as medium risk'); }
    else if (riskLevel === 'HIGH')   { score +=  0; notes.push('Flagged as high risk'); }

    score = Math.min(100, Math.max(0, score));

    const likelihood = score >= 65 ? 'On Track'
                     : score >= 40 ? 'At Risk'
                     : 'Unlikely';

    predictions.push({
      id:               p.id,
      name:             p.displayName,
      graduationDate:   ac.graduation || '',
      likelihood,
      score,
      creditsLeft:      creditsLeft     !== null ? +creditsLeft     : null,
      remainingHours:   remainingHours  !== null ? +remainingHours  : null,
      weeklyAvgHours:   weeklyAvgHours  !== null ? +weeklyAvgHours  : null,
      monthlyRate,
      academicPct,
      pace,
      nextCourse:       courseData ? courseData.nextCourse       : null,
      nextCourseTarget: courseData ? courseData.nextCourseTarget : null,
      riskLevel,
      notes,
      monthsOfHistory:  completedMonths.length,
    });
  });

  const order = { 'On Track': 0, 'At Risk': 1, 'Unlikely': 2 };
  predictions.sort((a, b) =>
    (order[a.likelihood] - order[b.likelihood]) || (b.score - a.score)
  );

  Logger.log('getHSGraduationPredictions: ' + predictions.length + ' predictions generated');
  return predictions;
}
