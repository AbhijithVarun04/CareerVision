'use strict';
const { SIGNAL_DIMENSIONS: RAW_DIMS } = require('./signalExtraction');

const DIMENSIONS = Array.isArray(RAW_DIMS) ? RAW_DIMS : Object.keys(RAW_DIMS);

// ---- Tunable constants (all documented, all deterministic) ----
const SIGNAL_MIN = 0;
const SIGNAL_MAX = 10;
// Average per-dimension gap at which interest_fit hits 0 (gap of 5 on a 0-10 scale).
const MISMATCH_TOLERANCE = 5;
const NULL_SALARY_SCORE = 0.25;   // unknown salary is not rewarded
const EQUAL_SALARY_SCORE = 0.5;   // everyone has the same salary, or only one known value
const DEMAND_SCORES = Object.freeze({
  very_high: 1,
  high: 0.75,
  moderate: 0.5,
  low: 0.25,
  unknown: 0.25,
});
const SCORE_DECIMALS = 4;

const round = (x) => {
  const f = 10 ** SCORE_DECIMALS;
  return Math.round(x * f) / f;
};

function assertSignals(obj, label) {
  if (!obj || typeof obj !== 'object') {
    throw new Error(`${label}: signals missing`);
  }
  for (const dim of DIMENSIONS) {
    const v = obj[dim];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < SIGNAL_MIN || v > SIGNAL_MAX) {
      throw new Error(`${label}: "${dim}" must be a number in [${SIGNAL_MIN}, ${SIGNAL_MAX}], got ${v}`);
    }
  }
}

/** 1 = identical profile, 0 = average gap >= MISMATCH_TOLERANCE. */
function computeInterestFit(studentSignals, requiredSignals) {
  let totalGap = 0;
  for (const dim of DIMENSIONS) {
    totalGap += Math.abs(studentSignals[dim] - requiredSignals[dim]);
  }
  const meanGap = totalGap / DIMENSIONS.length;
  return Math.max(0, 1 - meanGap / MISMATCH_TOLERANCE);
}

function validSalary(s) {
  return typeof s === 'number' && Number.isFinite(s) && s > 0;
}

/** Min-max across candidates that have a valid salary. Returns one score per career. */
function computeSalaryScores(careers) {
  const known = careers.map((c) => c.median_salary_lpa).filter(validSalary);
  const min = Math.min(...known);
  const max = Math.max(...known);
  return careers.map((c) => {
    const s = c.median_salary_lpa;
    if (!validSalary(s)) return NULL_SALARY_SCORE;
    if (max === min) return EQUAL_SALARY_SCORE;
    return (s - min) / (max - min);
  });
}

function computeDemandScore(level) {
  return Object.prototype.hasOwnProperty.call(DEMAND_SCORES, level)
    ? DEMAND_SCORES[level]
    : DEMAND_SCORES.unknown;
}

/** Accepts {interest, salary, demand}; validates and re-normalizes to sum 1. */
function normalizeWeights(w) {
  if (!w || typeof w !== 'object') throw new Error('weights missing');
  const vals = ['interest', 'salary', 'demand'].map((k) => w[k]);
  if (vals.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0)) {
    throw new Error('weights must be finite, non-negative numbers');
  }
  const sum = vals[0] + vals[1] + vals[2];
  if (sum <= 0) throw new Error('weights must not all be zero');
  return { interest: vals[0] / sum, salary: vals[1] / sum, demand: vals[2] / sum };
}

/**
 * scoreCareers(studentSignals, careers, weights)
 *  studentSignals: the 8-dimension map (signalProfile.signals)
 *  careers: synthesizer output array (career_name, median_salary_lpa, demand_level, required_signals, ...)
 *  weights: {interest, salary, demand}
 * Returns a NEW array sorted best-first, each item = original fields + scores + rank.
 */
function scoreCareers(studentSignals, careers, weights) {
  assertSignals(studentSignals, 'student');
  if (!Array.isArray(careers) || careers.length === 0) {
    throw new Error('careers must be a non-empty array');
  }
  careers.forEach((c, i) => {
    if (!c || typeof c.career_name !== 'string' || !c.career_name) {
      throw new Error(`careers[${i}]: career_name missing`);
    }
    assertSignals(c.required_signals, c.career_name);
  });

  const w = normalizeWeights(weights);
  const salaryScores = computeSalaryScores(careers);

  const scored = careers.map((c, i) => {
    const interest = computeInterestFit(studentSignals, c.required_signals);
    const salary = salaryScores[i];
    const demand = computeDemandScore(c.demand_level);
    const final = w.interest * interest + w.salary * salary + w.demand * demand;
    return {
      ...c,
      interest_fit: round(interest),
      salary_score: round(salary),
      demand_score: round(demand),
      final_score: round(final),
    };
  });

  // Total order: final desc, then interest_fit desc, then name A-Z (code-unit compare,
  // locale-independent), so the result never depends on input order.
  scored.sort((a, b) => {
    if (b.final_score !== a.final_score) return b.final_score - a.final_score;
    if (b.interest_fit !== a.interest_fit) return b.interest_fit - a.interest_fit;
    if (a.career_name < b.career_name) return -1;
    if (a.career_name > b.career_name) return 1;
    return 0;
  });

  return scored.map((c, i) => ({ ...c, rank: i + 1 }));
}

module.exports = {
  scoreCareers,
  computeInterestFit,
  computeSalaryScores,
  computeDemandScore,
  normalizeWeights,
  DIMENSIONS,
  DEMAND_SCORES,
  NULL_SALARY_SCORE,
  EQUAL_SALARY_SCORE,
  MISMATCH_TOLERANCE,
};