'use strict';

/**
 * Plain-language reasoning for one scored career.
 *
 * Rule-based: no AI call, no network, never throws. It only restates numbers
 * the scoring engine already produced, so it cannot add claims the data does
 * not support.
 *
 * career:  one scored career from scoreCareers (plus optional verifier_note)
 * weights: engine weights { interest, salary, demand } (need not sum to 1)
 */

const clamp01 = (v) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;

const pct = (v) => Math.round(clamp01(v) * 100);

const KNOWN_DEMAND = {
  very_high: 'Hiring demand is very high.',
  high: 'Hiring demand is high.',
  moderate: 'Hiring demand is moderate.',
  low: 'Hiring demand is low.',
};

const FACTOR_LABEL = {
  interest: 'how well it fits your interests and strengths',
  salary: 'its starting salary',
  demand: 'job demand',
};

function fitBand(fit) {
  if (fit >= 0.8) return 'a strong fit';
  if (fit >= 0.6) return 'a good fit';
  if (fit >= 0.4) return 'a partial fit';
  return 'a weak fit';
}

function hasSalary(c) {
  return (
    typeof c.median_salary_lpa === 'number' &&
    Number.isFinite(c.median_salary_lpa) &&
    c.median_salary_lpa > 0
  );
}

function salarySentence(c) {
  if (!hasSalary(c)) return 'We could not find a reliable starting salary for this role.';
  const lakh = String(Number(c.median_salary_lpa.toFixed(2))); // 8 -> "8", 9.55 -> "9.55"
  const s = clamp01(c.salary_score);
  let relative = '';
  if (s >= 0.75) relative = ' (among the higher-paying options in your shortlist)';
  else if (s <= 0.25) relative = ' (among the lower-paying options in your shortlist)';
  return `Typical starting salary is about ₹${lakh} lakh per year${relative}.`;
}

function demandSentence(c) {
  return KNOWN_DEMAND[c.demand_level] || 'We could not confirm current hiring demand.';
}

function normaliseWeights(w) {
  if (!w || typeof w !== 'object') return null;
  const vals = [w.interest, w.salary, w.demand];
  if (vals.some((x) => typeof x !== 'number' || !Number.isFinite(x) || x < 0)) return null;
  const total = vals[0] + vals[1] + vals[2];
  if (total <= 0) return null;
  return { interest: vals[0] / total, salary: vals[1] / total, demand: vals[2] / total };
}

// The factor that added the most points to the overall score. Factors with
// missing data (imputed by the engine) are never credited.
function biggestContributor(c, weights) {
  const w = normaliseWeights(weights);
  if (!w) return null;
  const parts = [['interest', w.interest * clamp01(c.interest_fit)]];
  if (hasSalary(c)) parts.push(['salary', w.salary * clamp01(c.salary_score)]);
  if (KNOWN_DEMAND[c.demand_level]) parts.push(['demand', w.demand * clamp01(c.demand_score)]);
  let best = parts[0];
  for (const p of parts) if (p[1] > best[1]) best = p; // ties: first listed wins
  return best[1] > 0 ? best[0] : null;
}

function qualitySentence(c) {
  if (c.data_quality === 'good') return null;
  if (c.data_quality === 'poor') {
    return 'We found very little reliable data for this role, so treat these figures with caution.';
  }
  return 'Some details for this role could not be confirmed, so treat these figures with care.';
}

function formatReasoning(career, weights) {
  const c = career && typeof career === 'object' ? career : null;
  if (!c) return '';

  const parts = [];
  const fit = clamp01(c.interest_fit);
  parts.push(`Your answers are ${fitBand(fit)} for this career (interest fit ${pct(fit)}%).`);
  parts.push(salarySentence(c));
  parts.push(demandSentence(c));

  const driver = biggestContributor(c, weights);
  if (driver) {
    parts.push(`The biggest boost to its overall score comes from ${FACTOR_LABEL[driver]}.`);
  }

  const quality = qualitySentence(c);
  if (quality) parts.push(quality);

  // Optional hook for the Verifier (flag-only): a short plain-language note.
  if (typeof c.verifier_note === 'string' && c.verifier_note.trim()) {
    parts.push(c.verifier_note.trim());
  }

  return parts.join(' ');
}

module.exports = { formatReasoning };