const { callGemini } = require("../clients/geminiClient");
const { SIGNAL_DIMENSIONS } = require("./signalExtraction");

const DEMAND_LEVELS = ["very_high", "high", "moderate", "low", "unknown"];
const DATA_QUALITY_LEVELS = ["good", "partial", "poor"];

// Keep the prompt small: 12 careers x many long scraped pages is wasteful.
const MAX_SOURCES_PER_API = 3;
const MAX_CHARS_PER_SOURCE = 800;

/** Trims one career's raw fetch output down to what Gemini actually needs. */
function trimCareerData(item) {
  const demandSources = (item.demandData?.sources || [])
    .slice(0, MAX_SOURCES_PER_API)
    .map((s) => ({
      title: s.title,
      content: (s.content || "").slice(0, MAX_CHARS_PER_SOURCE),
    }));

  const requirementSources = (item.requirementData?.sources || [])
    .slice(0, MAX_SOURCES_PER_API)
    .map((s) => ({
      title: s.title,
      text: (s.text || "").slice(0, MAX_CHARS_PER_SOURCE),
    }));

  return {
    career: item.career,
    tavilyAnswer: item.demandData?.tavilyAnswer || null,
    demandSources,
    requirementSources,
  };
}

function hasEvidence(item) {
  const d = item.demandData || {};
  const r = item.requirementData || {};
  return (
    Boolean(d.tavilyAnswer) ||
    (d.sources || []).length > 0 ||
    (r.sources || []).length > 0
  );
}

function buildPrompt(trimmedItems) {
  return `You are normalizing raw web data about careers into clean structured attributes.

Raw data per career (may be messy, partial, or empty):
${JSON.stringify(trimmedItems, null, 2)}

For EACH career, in the SAME ORDER, return an object with exactly these fields:
- "career": exact career name as given
- "median_salary_lpa": a number (typical entry-level salary in lakhs per annum, LPA) or null; follow the SALARY RULES below
- "demand_level": one of "very_high", "high", "moderate", "low", "unknown", based only on the evidence (hiring volume, growth, job openings). Use "unknown" if there is no evidence.
- "chennai_demand_note": one short sentence about hiring demand for this role in Chennai (employers, openings, growth), or null. This field is ONLY about hiring demand. Ignore all salary information when writing this field. NEVER include ₹, LPA, salary, pay, compensation, or any salary range. Use null if the sources say nothing about Chennai-specific hiring demand.
- "degrees": array of degree/qualification names typically required (e.g. "B.E. Computer Science"). Empty array if not found.
- "certifications": array of relevant certifications. Empty array if not found.
- "required_signals": how much the ROLE ITSELF demands each of these exact dimensions, scored 0-10 (this describes the career, not any student): ${SIGNAL_DIMENSIONS.join(", ")}
- "data_quality": "good" (salary + demand + requirements all backed by data), "partial", or "poor"

SALARY RULES for "median_salary_lpa":
- The reader is a student about to start a degree, so report the typical
  ENTRY-LEVEL salary: freshers / 0-3 years of experience, in lakhs per annum (LPA).
- If the sources give figures by experience level, use the fresher / 0-3 year figure.
- If the sources give one overall average and nothing suggests it is for senior
  or experienced professionals, you may use it.
- If the only figures are clearly for senior, lead, principal, architect-level or
  5+ years of experience, return null. Do NOT use them, and do NOT scale them down.
- If a source gives a range, use its midpoint. Convert monthly figures
  (x12) and rupees to LPA (1 LPA = 100000 rupees per year). Ignore non-Indian salaries.
- Never guess. If the sources do not support a number, return null.

Rules:
- Do not invent facts that are not supported by the data, except required_signals, which is your general knowledge of what the role demands.
- Return ONLY a JSON object, no extra text:
{ "careers": [ { ...one object per career... } ] }`;
}

function isNumberInRange(v, min, max) {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

/**
 * Validates Gemini's output and returns it ordered to match expectedCareers.
 * Throws on anything malformed so bad data never reaches the Scoring Engine.
 */
function validateSynthesis(parsed, expectedCareers) {
  if (!parsed || !Array.isArray(parsed.careers)) {
    throw new Error("Synthesizer: response missing 'careers' array");
  }

  const byName = new Map(parsed.careers.map((c) => [c && c.career, c]));
  const ordered = [];

  for (const name of expectedCareers) {
    const c = byName.get(name);
    if (!c) throw new Error(`Synthesizer: missing career '${name}' in response`);

    if (c.median_salary_lpa !== null && !isNumberInRange(c.median_salary_lpa, 0.1, 500)) {
      throw new Error(`Synthesizer: invalid median_salary_lpa for '${name}'`);
    }
    if (!DEMAND_LEVELS.includes(c.demand_level)) {
      throw new Error(`Synthesizer: invalid demand_level for '${name}'`);
    }
    if (c.chennai_demand_note !== null && typeof c.chennai_demand_note !== "string") {
      throw new Error(`Synthesizer: invalid chennai_demand_note for '${name}'`);
    }
    for (const field of ["degrees", "certifications"]) {
      if (!Array.isArray(c[field]) || !c[field].every((x) => typeof x === "string")) {
        throw new Error(`Synthesizer: invalid '${field}' for '${name}'`);
      }
    }
    if (!c.required_signals || typeof c.required_signals !== "object") {
      throw new Error(`Synthesizer: missing required_signals for '${name}'`);
    }
    for (const dim of SIGNAL_DIMENSIONS) {
      if (!isNumberInRange(c.required_signals[dim], 0, 10)) {
        throw new Error(`Synthesizer: invalid required_signals.${dim} for '${name}'`);
      }
    }
    if (!DATA_QUALITY_LEVELS.includes(c.data_quality)) {
      throw new Error(`Synthesizer: invalid data_quality for '${name}'`);
    }
    ordered.push(c);
  }
  return ordered;
}

/**
 * Deterministic guard: if a career had NO fetched evidence at all, don't trust
 * any salary/demand Gemini produced for it. Forces honest "unknown" values.
 */
function applyEvidenceGuard(synthesized, rawItems) {
  return synthesized.map((c, i) => {
    if (hasEvidence(rawItems[i])) return c;
    return {
      ...c,
      median_salary_lpa: null,
      demand_level: "unknown",
      chennai_demand_note: null,
      data_quality: "poor",
    };
  });
}

/**
 * Models in JSON mode sometimes return the careers list without the {"careers": [...]} wrapper
 * (a bare array, or the array under another key). Accept those shapes; everything inside is
 * still validated strictly by validateSynthesis.
 */
function normalizeSynthesisShape(parsed) {
  if (Array.isArray(parsed)) return { careers: parsed };
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed.careers)) {
    const arrays = Object.values(parsed).filter(Array.isArray);
    if (arrays.length === 1) return { careers: arrays[0] };
  }
  return parsed;
}

/**
 * Pipeline stage entry point.
 * @param {string} geminiApiKey
 * @param {Array} rawItems - output of fetchAllCandidateData()
 * @returns {Promise<Array>} one structured attribute object per career, same order
 */
async function synthesize(geminiApiKey, rawItems) {
  const expectedCareers = rawItems.map((r) => r.career);
  const prompt = buildPrompt(rawItems.map(trimCareerData));

  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) { // one retry on malformed output
    let rawText;
    try {
      rawText = await callGemini(geminiApiKey, prompt);
      const parsed = normalizeSynthesisShape(JSON.parse(rawText));
      const validated = validateSynthesis(parsed, expectedCareers);

      const guarded = applyEvidenceGuard(validated, rawItems);

      return guarded.map(guardCareer);
    } catch (err) {
      lastError = err;
      const preview = rawText ? ` | response starts: ${rawText.slice(0, 160).replace(/\s+/g, " ")}` : "";
      console.warn(`[synthesizer] attempt ${attempt}/2 failed: ${err.message}${preview}`);
      // Retrying cannot help if the Gemini client already used up its time budget,
      // or if the API rejected the request itself (bad request / bad key).
      if (err.isBudgetError || [400, 401, 403].includes(err.status)) break;
    }
  }
  throw new Error(`Synthesizer failed after retry: ${lastError.message}`);
}

// Words that mean the note is talking about pay instead of hiring demand.
const SALARY_TALK = /₹|\brs\.?\b|\binr\b|\blpa\b|\blakh|\bsalar|\bpay\b|\bpaid\b|\bcompensation\b|\bctc\b|\bearn/i;

function guardCareer(c) {
  const out = { ...c };

  if (typeof out.chennai_demand_note === 'string' && SALARY_TALK.test(out.chennai_demand_note)) {
    out.chennai_demand_note = null;
  }

  const hasSalary = typeof out.median_salary_lpa === 'number';
  const demandKnown = out.demand_level !== 'unknown';
  if (out.data_quality === 'good' && !(hasSalary && demandKnown)) {
    out.data_quality = 'partial';
  }
  return out;
}

module.exports = {
  synthesize,
  validateSynthesis,
  applyEvidenceGuard,
  trimCareerData,
  guardCareer,
  normalizeSynthesisShape
};