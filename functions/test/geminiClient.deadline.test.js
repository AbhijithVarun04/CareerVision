'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { GoogleGenAI } = require('@google/genai');
const { callGemini } = require('../clients/geminiClient');

const OK = '{"ok":true}';
const MIN_DEADLINE_S = 10; // Gemini API rule seen in production: request deadlines under 10 s are rejected (HTTP 400)
const apiError = (status) => Object.assign(new Error(`HTTP ${status}`), { name: 'ApiError', status });

function deadlineRejection(seconds) {
  return Object.assign(
    new Error(JSON.stringify({ error: {
      code: 400,
      message: `Manually set deadline ${seconds}s is too short. Minimum allowed deadline is ${MIN_DEADLINE_S}s.`,
      status: 'INVALID_ARGUMENT',
    } })),
    { name: 'ApiError', status: 400 }
  );
}

function fakeClock() {
  const c = { t: 0 };
  c.now = () => c.t;
  c.sleep = async (ms) => { c.t += ms; };
  return c;
}

// Fake Gemini: rejects deadlines under 10 s exactly like the real API, records every call.
function strictFakeClient(clock, steps) {
  const log = [];
  let i = 0;
  return {
    log,
    models: {
      async generateContent({ model, config }) {
        const timeout = config.httpOptions.timeout;
        log.push({ model, timeout, startedAt: clock.t });
        const seconds = Math.ceil(timeout / 1000); // what the SDK sends as X-Server-Timeout
        if (seconds < MIN_DEADLINE_S) throw deadlineRejection(seconds);
        const step = steps[Math.min(i++, steps.length - 1)];
        clock.t += Math.min(step.ms ?? 0, timeout);
        if (step.error) throw step.error;
        return { text: step.text ?? OK };
      },
    },
  };
}

const run = (clock, client, extra = {}) =>
  callGemini('unused', 'prompt', {
    client, now: clock.now, sleep: clock.sleep, models: ['A', 'B', 'C'], ...extra,
  });

test('REPRODUCTION: a nearly spent budget must not send a sub-10s deadline (the emulator failure)', async () => {
  const clock = fakeClock();
  // Two slow 503s on model A leave ~5.1-5.4 s of the 60 s budget for model B.
  const client = strictFakeClient(clock, [
    { ms: 26800, error: apiError(503) },
    { ms: 26800, error: apiError(503) },
    { ms: 1000 },
  ]);
  await assert.rejects(
    () => run(clock, client, { models: ['A', 'B'], totalBudgetMs: 60000 }),
    (e) => {
      assert.notEqual(e.status, 400, `got the invalid-deadline 400: ${e.message}`);
      return e.isBudgetError === true;
    }
  );
  assert.ok(client.log.every((l) => l.timeout >= 10000), 'no attempt may carry a deadline under 10 s');
  assert.ok(clock.t <= 60000, `simulated time ${clock.t} exceeded the 60000ms budget`);
});

test('a timeoutMs below the 10 s API minimum is raised to 10 s', async () => {
  const clock = fakeClock();
  const client = strictFakeClient(clock, [{ ms: 100 }]);
  assert.equal(await run(clock, client, { timeoutMs: 3000 }), OK);
  assert.equal(client.log[0].timeout, 10000);
});

// Tiny deterministic PRNG so the property test is reproducible.
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('PROPERTY: over 300 random outage patterns, no attempt is invalid or outlives the budget', async () => {
  const rand = mulberry32(12345);
  const kinds = [
    () => ({ ms: rand() * 30000, error: apiError(503) }),
    () => ({ ms: rand() * 30000, error: apiError(504) }),
    () => ({ ms: rand() * 5000, error: apiError(429) }),
    () => ({ ms: rand() * 20000, text: 'not json' }),
    () => ({ ms: rand() * 20000 }), // success
  ];
  for (let run_i = 0; run_i < 300; run_i++) {
    const budget = 20000 + Math.floor(rand() * 70000);
    const steps = Array.from({ length: 12 }, () => kinds[Math.floor(rand() * kinds.length)]());
    const clock = fakeClock();
    const client = strictFakeClient(clock, steps);
    let err;
    try {
      await run(clock, client, { totalBudgetMs: budget });
    } catch (e) { err = e; }

    const label = `run ${run_i} (budget ${budget})`;
    if (err) assert.notEqual(err.status, 400, `${label}: invalid-deadline 400 leaked: ${err.message}`);
    for (const l of client.log) {
      assert.ok(l.timeout >= 10000, `${label}: attempt deadline ${l.timeout} < 10 s`);
      assert.ok(l.timeout <= 30000, `${label}: attempt deadline ${l.timeout} > 30 s`);
      assert.ok(l.startedAt + l.timeout <= budget, `${label}: attempt could outlive the budget`);
    }
    assert.ok(clock.t <= budget, `${label}: simulated time ${clock.t} > budget`);
  }
});

test('real SDK: timeout 5400 ms becomes a 6 s deadline header and a Gemini-like server rejects it', async () => {
  const seen = [];
  const server = http.createServer((req, res) => {
    const seconds = Number(req.headers['x-server-timeout']);
    seen.push(seconds);
    res.setHeader('content-type', 'application/json');
    if (seconds < MIN_DEADLINE_S) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: {
        code: 400, status: 'INVALID_ARGUMENT',
        message: `Manually set deadline ${seconds}s is too short. Minimum allowed deadline is ${MIN_DEADLINE_S}s.`,
      } }));
    }
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: OK }] } }] }));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  // (a) the exact production error, reproduced with the bare SDK
  const ai = new GoogleGenAI({ apiKey: 'k', httpOptions: { baseUrl } });
  await assert.rejects(
    () => ai.models.generateContent({ model: 'm', contents: 'hi', config: { httpOptions: { timeout: 5400 } } }),
    (e) => e.status === 400 && /Manually set deadline 6s is too short/.test(e.message)
  );

  // (b) callGemini against the same strict server works and sends the full 30 s deadline
  assert.equal(await callGemini('k', 'hi', { baseUrl, models: ['m'] }), OK);

  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  assert.deepEqual(seen, [6, 30]);
});