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
    
    // ── Signal 2 now uses the real weekly credit-gain trend instead of
    const creditTrend = ac.creditTrend || null;
    const weeklyRate   = creditTrend && creditTrend.effectiveRatePerWeek !== null
      ? creditTrend.effectiveRatePerWeek : null;

    const weeklyAvgHours = ac.weeklyAvgHours || null;
    const hoursTrend      = ac.hoursTrend || null;
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

    // Signal 2: weekly credit-gain trend vs credits left (0–20 pts)
    if (weeklyRate !== null && creditsLeft !== null && weeklyRate > 0) {
      const weeksNeeded = creditsLeft / weeklyRate;
      if (weeksNeeded <= 4)       { score += 20; notes.push('At trend pace (~' + weeklyRate + ' cr/wk), on track to finish in about ' + weeksNeeded.toFixed(1) + ' week(s)'); }
      else if (weeksNeeded <= 8)  { score += 14; notes.push('At trend pace (~' + weeklyRate + ' cr/wk), ~' + weeksNeeded.toFixed(1) + ' weeks to finish'); }
      else if (weeksNeeded <= 12) { score +=  7; notes.push('At trend pace (~' + weeklyRate + ' cr/wk), ~' + weeksNeeded.toFixed(1) + ' weeks to finish'); }
      else                        { score +=  2; notes.push('Trend pace (' + weeklyRate + ' cr/wk) may not be enough to finish on time'); }
      if (creditTrend.trendLabel && creditTrend.trendLabel.indexOf('accelerating') === 0) {
        notes.push('Recent behavior change: credit pace is accelerating (×' + creditTrend.accelerationFactor + ')');
      } else if (creditTrend.trendLabel && creditTrend.trendLabel.indexOf('decelerating') === 0) {
        notes.push('Recent behavior change: credit pace is slowing down (×' + creditTrend.accelerationFactor + ')');
      }
    } else if (!creditTrend || creditTrend.pointsUsed < 1) {
      notes.push('No weekly credit history on file to establish a trend');
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

    // Signal 5: remaining hours vs trend-adjusted weekly hours (0–15 pts)
    const effectiveWeeklyHours = hoursTrend && hoursTrend.effectiveRatePerWeek !== null
      ? hoursTrend.effectiveRatePerWeek : weeklyAvgHours;
    if (remainingHours !== null && effectiveWeeklyHours !== null && effectiveWeeklyHours > 0) {
      const weeksToFinish  = remainingHours / effectiveWeeklyHours;
      const weeksUntilGrad = (graduationDate - today) / (7 * 86400000);
      if (weeksToFinish <= weeksUntilGrad * 0.8) { score += 15; notes.push('Remaining hours (' + remainingHours + 'h) achievable at trend pace (' + effectiveWeeklyHours + 'h/wk)'); }
      else if (weeksToFinish <= weeksUntilGrad)   { score +=  8; notes.push('Remaining hours (' + remainingHours + 'h) tight but possible at ' + effectiveWeeklyHours + 'h/wk'); }
      else                                         { score +=  2; notes.push('Remaining hours (' + remainingHours + 'h) may exceed time available at ' + effectiveWeeklyHours + 'h/wk'); }
      if (hoursTrend && hoursTrend.trendLabel && hoursTrend.trendLabel.indexOf('accelerating') === 0) {
        notes.push('Recent behavior change: hours worked is trending up (×' + hoursTrend.accelerationFactor + ')');
      } else if (hoursTrend && hoursTrend.trendLabel && hoursTrend.trendLabel.indexOf('decelerating') === 0) {
        notes.push('Recent behavior change: hours worked is trending down (×' + hoursTrend.accelerationFactor + ')');
      }
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
      weeklyRate,
      creditTrend,
      hoursTrend,
      academicPct,
      pace,
      nextCourse:       courseData ? courseData.nextCourse       : null,
      nextCourseTarget: courseData ? courseData.nextCourseTarget : null,
      riskLevel,
      notes,
    });
  });

  const order = { 'On Track': 0, 'At Risk': 1, 'Unlikely': 2 };
  predictions.sort((a, b) =>
    (order[a.likelihood] - order[b.likelihood]) || (b.score - a.score)
  );
  Logger.log('getHSGraduationPredictions: ' + predictions.length + ' predictions generated');
  return predictions;
}
