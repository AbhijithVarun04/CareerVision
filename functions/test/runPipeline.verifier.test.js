'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { runPipeline } = require('../pipeline/runPipeline');

const DIMS = [
  'analytical_thinking', 'creativity', 'people_orientation', 'technical_aptitude',
  'leadership', 'structure_preference', 'independence_preference', 'risk_tolerance',
];
const sig = (n) => Object.fromEntries(DIMS.map((d) => [d, n]));

const STUDENT = sig(8);
const KEYS = { geminiApiKey: 'x', tavilyApiKey: 'y', exaApiKey: 'z' };
const QUESTIONNAIRE = {
  priorityWeights: { interestWeight: 0.5, salaryWeight: 0.25, demandWeight: 0.25 },
};

const base = { chennai_demand_note: null, degrees: [], certifications: [] };
const CAREERS = [
  { ...base, career: 'Alpha', median_salary_lpa: 10, demand_level: 'high', required_signals: sig(8), data_quality: 'good' },
  { ...base, career: 'Beta', median_salary_lpa: 6, demand_level: 'low', required_signals: sig(2), data_quality: 'partial' },
  { ...base, career: 'Gamma', median_salary_lpa: 8, demand_level: 'moderate', required_signals: sig(5), data_quality: 'good' },
];
const ENGINE_ORDER = ['Alpha', 'Gamma', 'Beta'];

function deps(extra = {}) {
  return {
    extractSignals: async () => ({ signals: STUDENT, summary: 'You like tech.' }),
    identifyCandidateCareers: async () => CAREERS.map((c) => c.career),
    fetchAllCandidateData: async () => [],
    synthesize: async () => CAREERS,
    guardCareer: (c) => c,
    ...extra,
  };
}

const run = (extra) => runPipeline(KEYS, QUESTIONNAIRE, deps(extra));
const names = (r) => r.ranked.map((c) => c.career_name);

test('the default verifier annotates the careers but keeps the engine order', async () => {
  const r = await run();
  assert.deepEqual(names(r), ENGINE_ORDER);
  // Alpha is a clean match; Gamma and Beta fit this student below 50%.
  assert.deepEqual(r.ranked.map((c) => c.verified_flag), [true, false, false]);
  assert.equal(r.ranked[0].verifier_note, undefined);
  const stretch = 'Treat this as a stretch option rather than a close match.';
  assert.equal(r.ranked[1].verifier_note, stretch);
  assert.ok(r.ranked[1].reasoning_text.endsWith(stretch));
});

test('a well-behaved verifier is used, and its note reaches the reasoning text', async () => {
  const r = await run({
    verify: (scored) =>
      scored.map((c) => ({ ...c, verified_flag: true, verifier_note: 'Check this.' })),
  });
  assert.deepEqual(names(r), ENGINE_ORDER);
  assert.ok(r.ranked.every((c) => c.verified_flag === true));
  assert.ok(r.ranked.every((c) => c.reasoning_text.endsWith('Check this.')));
});

test('verifier receives the ranked list and the student signals', async () => {
  let seen;
  await run({
    verify: (scored, studentSignals) => {
      seen = { count: scored.length, studentSignals };
      return scored;
    },
  });
  assert.equal(seen.count, 3);
  assert.deepEqual(seen.studentSignals, STUDENT);
});

test('a verifier that reorders, drops or changes scores is ignored', async (t) => {
  t.mock.method(console, 'error', () => {});
  const bad = {
    reorder: (scored) => [...scored].reverse().map((c) => ({ ...c, verified_flag: true })),
    drop: (scored) => scored.slice(1).map((c) => ({ ...c, verified_flag: true })),
    rescored: (scored) => scored.map((c) => ({ ...c, final_score: 1, verified_flag: true })),
  };
  for (const [label, verify] of Object.entries(bad)) {
    const r = await run({ verify });
    assert.deepEqual(names(r), ENGINE_ORDER, label);
    assert.ok(r.ranked.every((c) => c.verified_flag === false), label);
  }
});

test('a verifier that throws does not break the pipeline', async (t) => {
  t.mock.method(console, 'error', () => {});
  const r = await run({
    verify: () => {
      throw new Error('boom');
    },
  });
  assert.deepEqual(names(r), ENGINE_ORDER);
  assert.ok(r.ranked.every((c) => c.verified_flag === false));
});