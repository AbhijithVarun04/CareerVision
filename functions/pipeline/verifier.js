'use strict';

/**
 * Rule-based, flag-only Verifier.
 *
 * It only annotates: it returns the same careers in the same order with a
 * `verified_flag` and, when useful, a plain-language `verifier_note`. It never
 * reorders, drops or rescores anything, and it makes no AI or network call.
 * (runPipeline.js also enforces the "never change the ranking" rule.)
 *
 * verified_flag is true only if ALL of these hold:
 *   - data_quality is 'good'  (the wording for limited data comes from the Formatter)
 *   - no hard mismatch: no dimension the role requires at REQUIRED_HIGH or more
 *     where the student scored STUDENT_LOW or less
 *   - interest_fit is at least MIN_INTEREST_FIT
 */

const REQUIRED_HIGH = 7;
const STUDENT_LOW = 3;
const MIN_INTEREST_FIT = 0.5;
const MAX_MISMATCHES_SHOWN = 2;

// Same 8 dimensions as SIGNAL_DIMENSIONS in signalExtraction.js (a test keeps them in sync).
const DIMENSION_PHRASE = {
  analytical_thinking: 'strong analytical thinking',
  creativity: 'a lot of creativity',
  people_orientation: 'working closely with people',
  technical_aptitude: 'strong technical skills',
  leadership: 'taking the lead',
  structure_preference: 'structured, routine work',
  independence_preference: 'working independently',
  risk_tolerance: 'comfort with risk and uncertainty',
};
const DIMENSIONS = Object.keys(DIMENSION_PHRASE);

const isScore = (v) => typeof v === 'number' && Number.isFinite(v);

// Returns null when the two profiles cannot be compared at all.
function findMismatches(required, student) {
  if (!required || typeof required !== 'object' || !student || typeof student !== 'object') {
    return null;
  }
  const found = [];
  let compared = 0;
  DIMENSIONS.forEach((dim, order) => {
    const r = required[dim];
    const s = student[dim];
    if (!isScore(r) || !isScore(s)) return;
    compared += 1;
    if (r >= REQUIRED_HIGH && s <= STUDENT_LOW) found.push({ dim, gap: r - s, order });
  });
  if (compared === 0) return null;
  found.sort((a, b) => b.gap - a.gap || a.order - b.order); // biggest gap first, ties by dimension order
  return found;
}

function verifyCareer(c, studentSignals) {
  const notes = [];
  let passed = true;

  if (c.data_quality !== 'good') passed = false;

  const mismatches = findMismatches(c.required_signals, studentSignals);
  if (mismatches === null) {
    passed = false; // could not compare with the student's answers
  } else if (mismatches.length > 0) {
    passed = false;
    const list = mismatches
      .slice(0, MAX_MISMATCHES_SHOWN)
      .map((m) => DIMENSION_PHRASE[m.dim])
      .join(' and ');
    notes.push(`This role usually calls for ${list}, which your answers show less of.`);
  }

  if (!isScore(c.interest_fit)) {
    passed = false;
  } else if (c.interest_fit < MIN_INTEREST_FIT) {
    passed = false;
    notes.push('Treat this as a stretch option rather than a close match.');
  }

  const out = { ...c, verified_flag: passed };
  if (notes.length > 0) out.verifier_note = notes.join(' ');
  return out;
}

/**
 * ranked: scored careers from the engine (already in final order)
 * studentSignals: { analytical_thinking, ... } on the 0-10 scale
 * Returns a NEW array, same order and length; inputs are not mutated.
 */
function verifyRecommendations(ranked, studentSignals) {
  if (!Array.isArray(ranked)) throw new TypeError('verifyRecommendations: ranked must be an array');
  return ranked.map((c) => verifyCareer(c, studentSignals));
}

module.exports = {
  verifyRecommendations,
  REQUIRED_HIGH,
  STUDENT_LOW,
  MIN_INTEREST_FIT,
  DIMENSIONS,
};