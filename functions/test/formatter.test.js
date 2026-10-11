'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { formatReasoning } = require('../pipeline/formatter');

const W = { interest: 0.5, salary: 0.25, demand: 0.25 };
const strong = {
  interest_fit: 0.88,
  salary_score: 1,
  demand_score: 1,
  median_salary_lpa: 9.55,
  demand_level: 'very_high',
  data_quality: 'good',
};

test('full reasoning for a strong, well-supported career', () => {
  assert.equal(
    formatReasoning(strong, W),
    'Your answers are a strong fit for this career (interest fit 88%). ' +
      'Typical starting salary is about ₹9.55 lakh per year (among the higher-paying options in your shortlist). ' +
      'Hiring demand is very high. ' +
      'The biggest boost to its overall score comes from how well it fits your interests and strengths.'
  );
});

test('interest-fit bands', () => {
  const cases = [
    [0.8, 'a strong fit'],
    [0.79, 'a good fit'],
    [0.6, 'a good fit'],
    [0.59, 'a partial fit'],
    [0.4, 'a partial fit'],
    [0.39, 'a weak fit'],
  ];
  for (const [fit, band] of cases) {
    assert.match(
      formatReasoning({ ...strong, interest_fit: fit }, W),
      new RegExp(`^Your answers are ${band} for this career`)
    );
  }
});

test('salary formatting drops trailing zeros', () => {
  assert.match(formatReasoning({ ...strong, median_salary_lpa: 8 }, W), /about ₹8 lakh per year/);
  assert.match(formatReasoning({ ...strong, median_salary_lpa: 12.5 }, W), /about ₹12.5 lakh per year/);
});

test('relative salary wording only for high or low salary scores', () => {
  const mid = formatReasoning({ ...strong, median_salary_lpa: 6, salary_score: 0.5 }, W);
  assert.ok(mid.includes('about ₹6 lakh per year.'));
  assert.ok(!mid.includes('options in your shortlist'));
  const low = formatReasoning({ ...strong, median_salary_lpa: 4, salary_score: 0.2 }, W);
  assert.ok(low.includes('among the lower-paying options in your shortlist'));
});

test('missing salary and unknown demand are stated, never credited', () => {
  const salaryHeavy = { interest: 0.1, salary: 0.8, demand: 0.1 };
  const out = formatReasoning(
    {
      interest_fit: 0.5,
      salary_score: 0.25, // engine default for a missing salary
      demand_score: 0.25,
      median_salary_lpa: null,
      demand_level: 'unknown',
      data_quality: 'partial',
    },
    salaryHeavy
  );
  assert.ok(out.includes('We could not find a reliable starting salary for this role.'));
  assert.ok(out.includes('We could not confirm current hiring demand.'));
  assert.ok(out.includes('comes from how well it fits your interests and strengths'));
});

test('biggest contributor follows the weights', () => {
  const out = formatReasoning(
    { ...strong, interest_fit: 0.5 },
    { interest: 0.1, salary: 0.8, demand: 0.1 }
  );
  assert.ok(out.includes('comes from its starting salary'));
});

test('data quality notes', () => {
  assert.ok(!formatReasoning(strong, W).includes('treat these figures'));
  assert.ok(formatReasoning({ ...strong, data_quality: 'poor' }, W).includes('very little reliable data'));
  assert.ok(formatReasoning({ ...strong, data_quality: 'partial' }, W).includes('could not be confirmed'));
  // a missing data_quality is treated like partial
  assert.ok(formatReasoning({ ...strong, data_quality: undefined }, W).includes('could not be confirmed'));
});

test('optional verifier note is appended at the end', () => {
  const out = formatReasoning({ ...strong, verifier_note: ' Check this against your own plans. ' }, W);
  assert.ok(out.endsWith('Check this against your own plans.'));
});

test('never throws on junk input', () => {
  assert.equal(formatReasoning(null, W), '');
  const out = formatReasoning({}, {});
  assert.equal(typeof out, 'string');
  assert.ok(!out.includes('biggest boost'));
  assert.equal(typeof formatReasoning(strong, undefined), 'string');
});