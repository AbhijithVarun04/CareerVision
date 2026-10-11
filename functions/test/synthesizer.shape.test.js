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
const rawItems = ['A', 'B'].map((career) => ({
  career, demandData: { tavilyAnswer: 'some evidence', sources: [] }, requirementData: { sources: [] },
}));

async function withScript(queue, fn) {
  script.prompts = []; script.queue = [...queue];
  const warnings = [];
  const realWarn = console.warn;
  console.warn = (...a) => warnings.push(a.join(' '));
  try { return await fn(warnings); } finally { console.warn = realWarn; }
}

test('a bare top-level array (no "careers" wrapper) is accepted', async () => {
  await withScript([JSON.stringify([good('A'), good('B')])], async () => {
    const out = await synthesize('k', rawItems);
    assert.deepEqual(out.map((c) => c.career), ['A', 'B']);
    assert.equal(script.prompts.length, 1, 'should not need a retry');
  });
});

test('an object whose only array is under a different key is accepted', async () => {
  await withScript([JSON.stringify({ results: [good('A'), good('B')] })], async () => {
    const out = await synthesize('k', rawItems);
    assert.equal(out.length, 2);
    assert.equal(script.prompts.length, 1);
  });
});

test('ambiguous or empty shapes are still rejected', async () => {
  const bad = [
    JSON.stringify({ a: [good('A')], b: [good('B')] }), // two arrays: ambiguous
    JSON.stringify({}),                                  // nothing usable
    JSON.stringify({ careers: 'nope' }),                 // wrong type
  ];
  for (const response of bad) {
    await withScript([response, response], async () => {
      await assert.rejects(() => synthesize('k', rawItems), /missing 'careers' array/);
      assert.equal(script.prompts.length, 2);
    });
  }
});

test('the shape tolerance does not loosen content validation', async () => {
  const b = good('B'); delete b.median_salary_lpa;
  const response = JSON.stringify([good('A'), b]);
  await withScript([response, response], async () => {
    await assert.rejects(() => synthesize('k', rawItems), /invalid median_salary_lpa for 'B'/);
  });
});

test('a rejected response is logged with how it starts, so the shape can be diagnosed', async () => {
  await withScript([JSON.stringify({ foo: 1, bar: 2 }), JSON.stringify([good('A'), good('B')])], async (warnings) => {
    await synthesize('k', rawItems);
    assert.ok(
      warnings.some((w) => /attempt 1\/2 failed/.test(w) && /response starts: \{"foo":1/.test(w)),
      `got: ${JSON.stringify(warnings)}`
    );
  });
});