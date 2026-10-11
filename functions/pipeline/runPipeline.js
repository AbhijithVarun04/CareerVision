'use strict';
const { extractSignals } = require('./signalExtraction');
const { identifyCandidateCareers } = require('./orchestrator');
const { fetchAllCandidateData } = require('./dataFetch/parallelFetch');
const { synthesize, guardCareer } = require('./synthesizer');
const { scoreCareers } = require('./scoringEngine');
const { formatReasoning } = require('./formatter');
const { verifyRecommendations } = require('./verifier');

const defaultDeps = {
  extractSignals,
  identifyCandidateCareers,
  fetchAllCandidateData,
  synthesize,
  guardCareer,
  scoreCareers,
  verify: verifyRecommendations,
};

/** Flutter sends interestWeight/salaryWeight/demandWeight; the engine wants interest/salary/demand. */
function toEngineWeights(pw) {
  if (!pw || typeof pw !== 'object') throw new Error('priorityWeights missing');
  return {
    interest: pw.interestWeight,
    salary: pw.salaryWeight,
    demand: pw.demandWeight,
  };
}

// ---- Verifier plumbing ----
// verifyStub is the fallback: it only marks every career "not verified".
function verifyStub(ranked) {
  return ranked.map((c) => ({ ...c, verified_flag: false }));
}

// Hard rule: a Verifier only annotates. It must never reorder, drop or add
// careers, and never change the engine's rank or final score.
function keepsRanking(before, after) {
  if (!Array.isArray(after) || after.length !== before.length) return false;
  return before.every((c, i) => {
    const a = after[i];
    return (
      a &&
      a.career_name === c.career_name &&
      a.rank === c.rank &&
      a.final_score === c.final_score
    );
  });
}

// Runs the Verifier but never lets it change the ranking or break the run.
function applyVerifier(verify, scored, studentSignals) {
  try {
    const out = verify(scored, studentSignals);
    if (keepsRanking(scored, out)) return out;
    console.error('[pipeline] verifier changed the ranking; ignoring its output');
  } catch (err) {
    console.error('[pipeline] verifier failed; ignoring its output:', err.message);
  }
  return verifyStub(scored);
}
// ---------------------------

async function timed(timings, name, fn) {
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    timings[name] = Date.now() - t0;
  }
}

/**
 * keys: { geminiApiKey, tavilyApiKey, exaApiKey }
 * questionnaire: the object from QuestionnaireResponse.toJson()
 */
async function runPipeline(keys, questionnaire, deps = {}) {
  const d = { ...defaultDeps, ...deps };
  const weights = toEngineWeights(questionnaire.priorityWeights);
  const timings = {};

  const signalProfile = await timed(timings, 'signals', () =>
    d.extractSignals(keys.geminiApiKey, questionnaire)
  );

  const titles = await timed(timings, 'shortlist', () =>
    d.identifyCandidateCareers(keys.geminiApiKey, signalProfile, questionnaire.priorityWeights)
  );

  const raw = await timed(timings, 'fetch', () =>
    d.fetchAllCandidateData(
      { tavilyApiKey: keys.tavilyApiKey, exaApiKey: keys.exaApiKey },
      titles
    )
  );

  const synthesized = await timed(timings, 'synthesize', () =>
    d.synthesize(keys.geminiApiKey, raw)
  );

  // guardCareer is idempotent, so applying it here is safe even if synthesize already did.
  const candidates = synthesized
    .map((c) => d.guardCareer(c))
    .map((c) => ({ ...c, career_name: c.career }));

  const scored = d.scoreCareers(signalProfile.signals, candidates, weights);
  const verified = applyVerifier(d.verify, scored, signalProfile.signals);
  const ranked = verified.map((c) => ({ ...c, reasoning_text: formatReasoning(c, weights) }));

  console.log('[pipeline] stage timings (ms):', JSON.stringify(timings));
  return { signalProfile, weights, candidates, ranked, timings };
}

module.exports = { runPipeline, toEngineWeights };