
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const clientPath = path.join(
  __dirname,
  '..',
  'clients',
  'geminiClient.js'
);

const source = fs.readFileSync(clientPath, 'utf8');

test('Gemini client has per-attempt and total-call timeouts', () => {
  assert.match(source, /CALL_TIMEOUT_MS\s*=\s*30000/);
  assert.match(source, /DEFAULT_TOTAL_BUDGET_MS\s*=\s*60000/);
  assert.match(source, /timeout:\s*attemptTimeout/);
});

test('Gemini timeout errors are classified to skip the model', () => {
  assert.match(source, /err\?\.name === 'AbortError'/);
  assert.match(source, /timeout\|timed out\|abort/i);
  assert.match(source, /status === 429 \|\| status === 504/);
});