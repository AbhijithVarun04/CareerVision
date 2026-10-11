'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  scoreCareers, computeInterestFit, computeSalaryScores, computeDemandScore,
  normalizeWeights, DIMENSIONS, NULL_SALARY_SCORE, EQUAL_SALARY_SCORE,
} = require('../pipeline/scoringEngine');

const sig = (v) => Object.fromEntries(DIMENSIONS.map((d) => [d, v]));
const career = (name, o = {}) => ({
  career_name: name, median_salary_lpa: 10, demand_level: 'moderate',
  required_signals: sig(5), ...o,
});
const W = { interest: 1 / 3, salary: 1 / 3, demand: 1 / 3 };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !== ${b}`);

test('interest_fit: identical = 1, maximally different = 0', () => {
  assert.equal(computeInterestFit(sig(5), sig(5)), 1);
  assert.equal(computeInterestFit(sig(0), sig(10)), 0);
});

test('interest_fit: partial gap is linear', () => {
  close(computeInterestFit(sig(5), sig(7.5)), 0.5); // mean gap 2.5 / tolerance 5
});

test('salary: min-max across candidates', () => {
  const s = computeSalaryScores([
    { median_salary_lpa: 10 }, { median_salary_lpa: 20 }, { median_salary_lpa: 30 },
  ]);
  assert.deepEqual(s, [0, 0.5, 1]);
});

test('salary: null/invalid get the defined penalty and do not affect min/max', () => {
  const s = computeSalaryScores([
    { median_salary_lpa: null }, { median_salary_lpa: 10 }, { median_salary_lpa: 20 },
    { median_salary_lpa: -5 }, { median_salary_lpa: 'x' },
  ]);
  assert.deepEqual(s, [NULL_SALARY_SCORE, 0, 1, NULL_SALARY_SCORE, NULL_SALARY_SCORE]);
});

test('salary: all equal -> neutral for all', () => {
  const s = computeSalaryScores([{ median_salary_lpa: 8 }, { median_salary_lpa: 8 }]);
  assert.deepEqual(s, [EQUAL_SALARY_SCORE, EQUAL_SALARY_SCORE]);
});

test('salary: only one known value -> neutral for it, penalty for nulls', () => {
  const s = computeSalaryScores([{ median_salary_lpa: 12 }, { median_salary_lpa: null }]);
  assert.deepEqual(s, [EQUAL_SALARY_SCORE, NULL_SALARY_SCORE]);
});

test('salary: all null -> every career gets the same penalty', () => {
  const s = computeSalaryScores([{ median_salary_lpa: null }, { median_salary_lpa: null }]);
  assert.deepEqual(s, [NULL_SALARY_SCORE, NULL_SALARY_SCORE]);
});

test('demand: fixed mapping, unknown and unrecognized values are low', () => {
  assert.equal(computeDemandScore('very_high'), 1);
  assert.equal(computeDemandScore('high'), 0.75);
  assert.equal(computeDemandScore('moderate'), 0.5);
  assert.equal(computeDemandScore('low'), 0.25);
  assert.equal(computeDemandScore('unknown'), 0.25);
  assert.equal(computeDemandScore('banana'), 0.25);
  assert.equal(computeDemandScore(undefined), 0.25);
  assert.equal(computeDemandScore('toString'), 0.25); // not fooled by prototype keys
});

test('final_score matches the hand-computed formula', () => {
  const careers = [
    career('A', { median_salary_lpa: 20, demand_level: 'high', required_signals: sig(5) }),
    career('B', { median_salary_lpa: 10, demand_level: 'low', required_signals: sig(10) }),
  ];
  const r = scoreCareers(sig(5), careers, { interest: 0.5, salary: 0.3, demand: 0.2 });
  assert.equal(r[0].career_name, 'A');
  close(r[0].final_score, 0.5 * 1 + 0.3 * 1 + 0.2 * 0.75); // 0.95
  close(r[1].final_score, 0.5 * 0 + 0.3 * 0 + 0.2 * 0.25); // 0.05
  assert.deepEqual(r.map((c) => c.rank), [1, 2]);
});

test('weights at 1/0/0 rank purely by interest, 0/1/0 by salary, 0/0/1 by demand', () => {
  const careers = [
    career('Fit', { required_signals: sig(5), median_salary_lpa: 5, demand_level: 'low' }),
    career('Pay', { required_signals: sig(9), median_salary_lpa: 40, demand_level: 'low' }),
    career('Hot', { required_signals: sig(9), median_salary_lpa: 5, demand_level: 'very_high' }),
  ];
  assert.equal(scoreCareers(sig(5), careers, { interest: 1, salary: 0, demand: 0 })[0].career_name, 'Fit');
  assert.equal(scoreCareers(sig(5), careers, { interest: 0, salary: 1, demand: 0 })[0].career_name, 'Pay');
  assert.equal(scoreCareers(sig(5), careers, { interest: 0, salary: 0, demand: 1 })[0].career_name, 'Hot');
});

test('weights that do not sum to 1 are normalized (2:1:1 == 0.5:0.25:0.25)', () => {
  const careers = [career('A', { median_salary_lpa: 20 }), career('B', { median_salary_lpa: 10, demand_level: 'high' })];
  assert.deepEqual(
    scoreCareers(sig(5), careers, { interest: 2, salary: 1, demand: 1 }),
    scoreCareers(sig(5), careers, { interest: 0.5, salary: 0.25, demand: 0.25 })
  );
});

test('invalid weights throw', () => {
  assert.throws(() => normalizeWeights({ interest: 0, salary: 0, demand: 0 }));
  assert.throws(() => normalizeWeights({ interest: -1, salary: 1, demand: 1 }));
  assert.throws(() => normalizeWeights({ interest: NaN, salary: 1, demand: 1 }));
  assert.throws(() => normalizeWeights({ interest: 1, salary: 1 }));
  assert.throws(() => normalizeWeights(null));
});

test('invalid student signals / careers throw', () => {
  const bad = sig(5); bad.creativity = 11;
  assert.throws(() => scoreCareers(bad, [career('A')], W));
  const missing = sig(5); delete missing.leadership;
  assert.throws(() => scoreCareers(missing, [career('A')], W));
  assert.throws(() => scoreCareers(sig(5), [], W));
  assert.throws(() => scoreCareers(sig(5), [career('A', { required_signals: null })], W));
  assert.throws(() => scoreCareers(sig(5), [{ ...career('A'), career_name: '' }], W));
});

test('deterministic: same input twice gives identical output', () => {
  const careers = [
    career('A', { median_salary_lpa: 12, demand_level: 'high', required_signals: sig(4) }),
    career('B', { median_salary_lpa: null, demand_level: 'unknown', required_signals: sig(8) }),
    career('C', { median_salary_lpa: 30, demand_level: 'low', required_signals: sig(6) }),
  ];
  const w = { interest: 0.5, salary: 0.3, demand: 0.2 };
  assert.deepEqual(scoreCareers(sig(5), careers, w), scoreCareers(sig(5), careers, w));
});

test('tie-break is stable: input order does not change the ranking', () => {
  const careers = [career('Zeta'), career('Alpha'), career('Mid')]; // all identical scores
  const r1 = scoreCareers(sig(5), careers, W).map((c) => c.career_name);
  const r2 = scoreCareers(sig(5), [...careers].reverse(), W).map((c) => c.career_name);
  assert.deepEqual(r1, ['Alpha', 'Mid', 'Zeta']);
  assert.deepEqual(r2, r1);
});

test('tie on final_score falls back to higher interest_fit first', () => {
  // Same final, different interest: B has better fit but worse demand (weights chosen to tie).
  const careers = [
    career('A', { required_signals: sig(5), demand_level: 'low' }),       // interest 1, demand .25
    career('B', { required_signals: sig(7.5), demand_level: 'very_high' }), // interest .5, demand 1
  ];
  const r = scoreCareers(sig(5), careers, { interest: 0.6, salary: 0, demand: 0.4 });
  // A: .6*1 + .4*.25 = .70 ; B: .6*.5 + .4*1 = .70
  assert.equal(r[0].final_score, r[1].final_score);
  assert.equal(r[0].career_name, 'A');
});

test('does not mutate its inputs', () => {
  const careers = [career('A'), career('B')];
  const snapshot = JSON.stringify(careers);
  scoreCareers(sig(5), careers, W);
  assert.equal(JSON.stringify(careers), snapshot);
});