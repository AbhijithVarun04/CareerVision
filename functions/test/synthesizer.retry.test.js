'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

// Replace callGemini BEFORE synthesizer.js loads (it destructures the export at require time).
const clientPath = require.resolve('../clients/geminiClient');
const script = { prompts: [], queue: [] };
require.cache[clientPath] = {
  id: clientPath, filename: clientPath, loaded: true,
  exports: {
    callGemini: async (_key, prompt) => {
      script.prompts.push(prompt);
      const next = script.queue.shift();
      if (next instanceof Error) throw next;
      return next;
    },
  },
};
const { synthesize } = require('../pipeline/synthesizer');
const { SIGNAL_DIMENSIONS } = require('../pipeline/signalExtraction');

const sig = () => Object.fromEntries(SIGNAL_DIMENSIONS.map((d) => [d, 5]));
const good = (career, over = {}) => ({
  career, median_salary_lpa: 6, demand_level: 'high', chennai_demand_note: null,
  degrees: [], certifications: [], required_signals: sig(), data_quality: 'good', ...over,
});
const reply = (careers) => JSON.stringify({ careers });
const rawItems = ['A', 'B'].map((career) => ({
  career, demandData: { tavilyAnswer: 'some evidence', sources: [] }, requirementData: { sources: [] },
}));

// Each test gets a clean script and a captured console.warn.
async function withScript(queue, fn) {
  script.prompts = []; script.queue = [...queue];
  const warnings = [];
  const realWarn = console.warn;
  console.warn = (...a) => warnings.push(a.join(' '));
  try { return await fn(warnings); } finally { console.warn = realWarn; }
}

const missingSalaryForB = () => { const b = good('B'); delete b.median_salary_lpa; return reply([good('A'), b]); };

test('the prompt defines median_salary_lpa as an output field (not only as rules)', async () => {
  await withScript([reply([good('A'), good('B')])], async () => {
    await synthesize('k', rawItems);
    assert.match(script.prompts[0], /^- "median_salary_lpa":/m);
  });
});

test('a rejected first answer is logged with its reason, then retried once', async () => {
  await withScript([missingSalaryForB(), reply([good('A'), good('B')])], async (warnings) => {
    const out = await synthesize('k', rawItems);
    assert.equal(out.length, 2);
    assert.equal(script.prompts.length, 2);
    assert.ok(
      warnings.some((w) => /attempt 1\/2/.test(w) && /invalid median_salary_lpa for 'B'/.test(w)),
      `expected a warning naming the validation error, got: ${JSON.stringify(warnings)}`
    );
  });
});

test('both attempts rejected: the thrown error carries the last reason', async () => {
  await withScript([missingSalaryForB(), missingSalaryForB()], async () => {
    await assert.rejects(
      () => synthesize('k', rawItems),
      /Synthesizer failed after retry: .*invalid median_salary_lpa for 'B'/
    );
    assert.equal(script.prompts.length, 2);
  });
});

test('an exhausted Gemini time budget is NOT retried (a second call would burn another full budget)', async () => {
  const budget = Object.assign(new Error('Gemini time budget (60000ms) exhausted'), { isBudgetError: true });
  await withScript([budget, reply([good('A'), good('B')])], async () => {
    await assert.rejects(() => synthesize('k', rawItems), /Synthesizer failed/);
    assert.equal(script.prompts.length, 1);
  });
});

test('API rejections that retrying cannot fix (400/401/403) are NOT retried', async () => {
  for (const status of [400, 401, 403]) {
    const apiErr = Object.assign(new Error(`HTTP ${status}`), { name: 'ApiError', status });
    await withScript([apiErr, reply([good('A'), good('B')])], async () => {
      await assert.rejects(() => synthesize('k', rawItems), /Synthesizer failed/);
      assert.equal(script.prompts.length, 1, `status ${status} should not be retried`);
    });
  }
});

test('other errors (e.g. a dropped connection) are still retried once', async () => {
  await withScript([new Error('socket hang up'), reply([good('A'), good('B')])], async () => {
    const out = await synthesize('k', rawItems);
    assert.equal(out.length, 2);
    assert.equal(script.prompts.length, 2);
  });
});