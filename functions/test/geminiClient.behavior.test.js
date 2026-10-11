'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {
  callGemini, classify, MAX_ATTEMPTS_PER_MODEL,
} = require('../clients/geminiClient');

const OK = '{"ok":true}';
const apiError = (status) => Object.assign(new Error(`HTTP ${status}`), { name: 'ApiError', status });
const abortError = () => Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });

// Simulated time: sleeping and "network time" only move this clock, so tests run instantly.
function fakeClock() {
  const c = { t: 0 };
  c.now = () => c.t;
  c.sleep = async (ms) => { c.t += ms; };
  return c;
}

// steps are consumed in order (the last one repeats). `ms` = simulated server time,
// capped by the per-attempt timeout the client asked for, like the real SDK would.
function fakeClient(clock, steps) {
  const log = [];
  let i = 0;
  return {
    log,
    models: {
      async generateContent({ model, config }) {
        const step = steps[Math.min(i++, steps.length - 1)];
        const timeout = config.httpOptions.timeout;
        log.push({ model, timeout });
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

test('classify: 504/429/timeouts skip to next model, 5xx retries, 4xx is fatal', () => {
  assert.equal(classify(apiError(504)), 'next');
  assert.equal(classify(apiError(429)), 'next');
  assert.equal(classify(abortError()), 'next');
  assert.equal(classify(apiError(404)), 'next');
  assert.equal(classify(apiError(503)), 'retry');
  assert.equal(classify(apiError(500)), 'retry');
  assert.equal(classify(new SyntaxError('bad json')), 'retry');
  assert.equal(classify(apiError(400)), 'fatal');
  assert.equal(classify(apiError(401)), 'fatal');
  assert.equal(classify(apiError(403)), 'fatal');
});

test('a 504 moves to the next model without retrying the same one', async () => {
  const clock = fakeClock();
  const client = fakeClient(clock, [{ ms: 30000, error: apiError(504) }, { ms: 1000 }]);
  assert.equal(await run(clock, client), OK);
  assert.deepEqual(client.log.map((l) => l.model), ['A', 'B']);
});

test('503 is retried on the same model up to the cap, then the next model is used', async () => {
  const clock = fakeClock();
  const errors = Array.from({ length: MAX_ATTEMPTS_PER_MODEL }, () => ({ ms: 500, error: apiError(503) }));
  const client = fakeClient(clock, [...errors, { ms: 500 }]);
  assert.equal(await run(clock, client), OK);
  assert.deepEqual(
    client.log.map((l) => l.model),
    [...Array(MAX_ATTEMPTS_PER_MODEL).fill('A'), 'B']
  );
});

test('429 skips immediately; 401 is thrown at once with no fallback', async () => {
  let clock = fakeClock();
  let client = fakeClient(clock, [{ error: apiError(429) }, { ms: 100 }]);
  assert.equal(await run(clock, client), OK);
  assert.deepEqual(client.log.map((l) => l.model), ['A', 'B']);

  clock = fakeClock();
  client = fakeClient(clock, [{ error: apiError(401) }]);
  await assert.rejects(() => run(clock, client), (e) => e.status === 401);
  assert.equal(client.log.length, 1);
});

test('invalid JSON is retried; fenced JSON is cleaned to a plain string', async () => {
  const clock = fakeClock();
  const client = fakeClient(clock, [{ text: 'not json' }, { text: '```json\n{"a":1}\n```' }]);
  assert.equal(await run(clock, client), '{"a":1}');
  assert.deepEqual(client.log.map((l) => l.model), ['A', 'B']);
});



test('total budget bounds the whole call and shrinks the per-attempt timeout', async () => {
  const clock = fakeClock();
  const client = fakeClient(clock, [
    { ms: 30000, error: apiError(503) },
    { ms: 30000, error: apiError(503) },
    { ms: 30000, error: apiError(503) },
  ]);

  await assert.rejects(
    () => run(clock, client, { totalBudgetMs: 75000 }),
    (e) => e.isBudgetError === true && /budget/i.test(e.message)
  );

  assert.ok(clock.t <= 75000, `simulated time ${clock.t} exceeded the 75000ms budget`);
  assert.ok(client.log.every((l) => l.timeout <= 30000));
  assert.ok(client.log.length < 6);
});

test('real SDK: a hung request is aborted by the per-attempt timeout, then the next model is tried', async () => {
  const seen = [];
  const server = http.createServer((req) => {
    seen.push({ url: req.url, serverTimeout: req.headers['x-server-timeout'] });
    // never respond
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const t0 = Date.now();
  await assert.rejects(() =>
    callGemini('fake-key', 'hi', { baseUrl, models: ['m1', 'm2'], timeoutMs: 400, totalBudgetMs: 5000, minAttemptMs: 100 })
  );
  const elapsed = Date.now() - t0;

  server.closeAllConnections();
  await new Promise((r) => server.close(r));

  assert.equal(seen.length, 2, 'one request per model: a timeout means next model, not a same-model retry');
  assert.ok(seen[0].url.includes('m1') && seen[1].url.includes('m2'));
  assert.equal(seen[0].serverTimeout, '1'); // SDK sends ceil(400ms / 1000) seconds
  assert.ok(elapsed >= 700 && elapsed < 3000, `elapsed ${elapsed}ms should be about 2 x 400ms`);
});