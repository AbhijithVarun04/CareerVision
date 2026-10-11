'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { runPipeline, toEngineWeights } = require('../pipeline/runPipeline');
const { DIMENSIONS } = require('../pipeline/scoringEngine');

const sig = (v) => Object.fromEntries(DIMENSIONS.map((d) => [d, v]));
const keys = { geminiApiKey: 'g', tavilyApiKey: 't', exaApiKey: 'e' };
const questionnaire = {
  interests: ['Technology & Computers'],
  priorityWeights: { interestWeight: 0.56, salaryWeight: 0.22, demandWeight: 0.22 },
};

function makeDeps(overrides = {}) {
  const calls = [];
  const captured = {};
  const deps = {
    extractSignals: async () => { calls.push('signals'); return { signals: sig(5), summary: 's' }; },
    identifyCandidateCareers: async (k, sp, pw) => {
      calls.push('shortlist'); captured.shortlistWeights = pw; return ['A', 'B'];
    },
    fetchAllCandidateData: async (ks, titles) => {
      calls.push('fetch'); captured.fetchKeys = ks;
      return titles.map((career) => ({ career, demandData: {}, requirementData: {} }));
    },
    synthesize: async (k, raw) => {
      calls.push('synth');
      return raw.map(({ career }) => ({
        career,
        median_salary_lpa: career === 'B' ? null : 8,
        demand_level: 'high',
        chennai_demand_note: null,
        degrees: [], certifications: [],
        required_signals: sig(career === 'A' ? 5 : 8),
        data_quality: 'good',
      }));
    },
    ...overrides,
  };
  return { calls, captured, deps };
}

test('stages run in order and API keys are routed correctly', async () => {
  const { calls, captured, deps } = makeDeps();
  await runPipeline(keys, questionnaire, deps);
  assert.deepEqual(calls, ['signals', 'shortlist', 'fetch', 'synth']);
  assert.deepEqual(captured.fetchKeys, { tavilyApiKey: 't', exaApiKey: 'e' });
  assert.deepEqual(captured.shortlistWeights, questionnaire.priorityWeights);
});

test('weights are mapped from Flutter names to engine names', async () => {
  const { deps } = makeDeps();
  const r = await runPipeline(keys, questionnaire, deps);
  assert.deepEqual(r.weights, { interest: 0.56, salary: 0.22, demand: 0.22 });
});

test('ranked output is sorted, ranked 1..n, and uses career_name', async () => {
  const { deps } = makeDeps();
  const { ranked } = await runPipeline(keys, questionnaire, deps);
  assert.deepEqual(ranked.map((c) => c.career_name), ['A', 'B']);
  assert.deepEqual(ranked.map((c) => c.rank), [1, 2]);
});

test('guardCareer is applied (null salary downgrades quality)', async () => {
  const { deps } = makeDeps();
  const { ranked } = await runPipeline(keys, questionnaire, deps);
  assert.equal(ranked.find((c) => c.career_name === 'B').data_quality, 'partial');
  assert.equal(ranked.find((c) => c.career_name === 'A').data_quality, 'good');
});

test('verifier and formatter fields are present on every career', async () => {
  const { deps } = makeDeps();
  const { ranked } = await runPipeline(keys, questionnaire, deps);
  for (const c of ranked) {
    assert.equal(typeof c.verified_flag, 'boolean');
    assert.ok(typeof c.reasoning_text === 'string' && c.reasoning_text.length > 0);
  }
  // A matches the student exactly and has good data; B has limited data and only a 40% fit.
  const a = ranked.find((c) => c.career_name === 'A');
  const b = ranked.find((c) => c.career_name === 'B');
  assert.equal(a.verified_flag, true);
  assert.equal(b.verified_flag, false);
  assert.ok(b.reasoning_text.endsWith('Treat this as a stretch option rather than a close match.'));
});

test('a failing stage rejects the whole run', async () => {
  const { deps } = makeDeps({ extractSignals: async () => { throw new Error('boom'); } });
  await assert.rejects(() => runPipeline(keys, questionnaire, deps), /boom/);
});

test('missing weights throw; input is not mutated', async () => {
  assert.throws(() => toEngineWeights(null));
  const { deps } = makeDeps();
  const snapshot = JSON.stringify(questionnaire);
  await runPipeline(keys, questionnaire, deps);
  assert.equal(JSON.stringify(questionnaire), snapshot);
});