'use strict';
const { GoogleGenAI } = require('@google/genai');

const DEFAULT_MODEL_CHAIN = [
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
];
const MAX_ATTEMPTS_PER_MODEL = 1;
const BASE_DELAY_MS = 1000;
const CALL_TIMEOUT_MS = 30000;        // per HTTP attempt
const DEFAULT_TOTAL_BUDGET_MS = 60000; // for the whole callGemini call, all models and retries
// Gemini rejects request deadlines below 10 seconds.
const MIN_SERVER_DEADLINE_MS = 10000;
const RETRYABLE_STATUS = new Set([500, 502, 503]);

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getStatus(err) {
  if (typeof err?.status === 'number') return err.status;
  if (typeof err?.code === 'number' && err.code >= 100) return err.code; // ignore DOMException's legacy code 20
  const m = /\b(4\d\d|5\d\d)\b/.exec(String(err?.message || ''));
  return m ? Number(m[1]) : null;
}

// 'retry' = same model again, 'next' = skip to the next model, 'fatal' = stop now
function classify(err) {
  if (err?.name === 'SyntaxError' || err?.isEmptyResponse) return 'retry';
  // Client-side timeout (AbortError) or the SDK's own timeout error.
  if (err?.name === 'AbortError' || /timeout|timed out|abort/i.test(String(err?.message || ''))) {
    return 'next';
  }
  const status = getStatus(err);
  // 429: rate-limited. 504: the server-side deadline (the SDK sends X-Server-Timeout
  // with our timeout), so the model was too slow: retrying it will not help.
  if (status === 429 || status === 504) return 'next';
  if (status === null) return 'retry'; // network-level failure
  if (RETRYABLE_STATUS.has(status)) return 'retry';
  if (status === 404) return 'next'; // model name not available
  return 'fatal'; // 400/401/403: retrying won't help
}

function cleanJsonText(text) {
  if (!text || !text.trim()) {
    const e = new Error('Gemini returned an empty response');
    e.isEmptyResponse = true;
    throw e;
  }
  const clean = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  JSON.parse(clean); // throws SyntaxError if invalid -> classified as 'retry'
  return clean;
}

/**
 * callGemini(apiKey, prompt, options?)
 * Returns a raw JSON string (same contract as before).
 *
 * options.models         override the model chain
 * options.timeoutMs      per-attempt timeout (default 30 s)
 * options.totalBudgetMs  cap for the whole call, all models and retries (default 60 s)
 *
 * Test hooks (never set in production): options.client, options.baseUrl,
 * options.sleep, options.now
 */
async function callGemini(apiKey, prompt, options = {}) {
  const models = options.models || DEFAULT_MODEL_CHAIN;
  const minAttemptMs = options.minAttemptMs ?? MIN_SERVER_DEADLINE_MS; // test hook only
  const timeoutMs = Math.max(minAttemptMs, options.timeoutMs || CALL_TIMEOUT_MS);
  const budgetMs = options.totalBudgetMs || DEFAULT_TOTAL_BUDGET_MS;
  const now = options.now || Date.now;
  const sleep = options.sleep || defaultSleep;
  const ai =
    options.client ||
    new GoogleGenAI({
      apiKey,
      ...(options.baseUrl ? { httpOptions: { baseUrl: options.baseUrl } } : {}),
    });

  const startedAt = now();
  const remaining = () => budgetMs - (now() - startedAt);
  let lastError;

  for (const model of models) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
      const left = remaining();
      if (left < minAttemptMs) {
        const e = new Error(
          `Gemini time budget (${budgetMs}ms) exhausted; last error: ${lastError?.message ?? 'none'}`
        );
        e.isBudgetError = true;
        e.cause = lastError;
        throw e;
      }
      const attemptTimeout = Math.floor(Math.min(timeoutMs, left));
      const t0 = now();
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            httpOptions: { timeout: attemptTimeout },
          },
        });
        let cleaned;
        try {
          cleaned = cleanJsonText(response.text);
        } catch (parseErr) {
          // Helps tell "truncated output" (MAX_TOKENS) from "model wrote bad JSON".
          parseErr.finishReason = response?.candidates?.[0]?.finishReason;
          throw parseErr;
        }
        console.log(`[gemini] answered by ${model} in ${now() - t0}ms`);
        return cleaned;
      } catch (err) {
        lastError = err;
        const action = classify(err);
        console.warn(
          `[gemini] ${model} attempt ${attempt}/${MAX_ATTEMPTS_PER_MODEL} failed after ` +
            `${now() - t0}ms (${getStatus(err) ?? err.name}` +
            `${err.finishReason ? `, finishReason=${err.finishReason}` : ''}): ${action}`
        );
        if (action === 'fatal') throw err;
        if (action === 'next') break;
        if (attempt < MAX_ATTEMPTS_PER_MODEL) {
          const delay = BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 300;
          await sleep(Math.min(delay, Math.max(0, remaining())));
        }
      }
    }
  }
  if (remaining() < minAttemptMs) {
    const e = new Error(
      `Gemini time budget (${budgetMs}ms) exhausted; last error: ${lastError?.message ?? 'none'}`
    );
    e.isBudgetError = true;
    e.cause = lastError;
    throw e;
  }
  throw lastError;
}

module.exports = {
  callGemini,
  MIN_SERVER_DEADLINE_MS,
  classify,
  DEFAULT_MODEL_CHAIN,
  MAX_ATTEMPTS_PER_MODEL,
};