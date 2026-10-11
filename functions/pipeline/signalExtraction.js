const { callGemini } = require("../clients/geminiClient");

/**
 * Fixed vocabulary of signal dimensions we always score.
 * Keeping this fixed (not letting Gemini invent new keys) is what
 * makes the output safe to feed into a deterministic scoring engine later.
 */
const SIGNAL_DIMENSIONS = [
  "analytical_thinking",
  "creativity",
  "people_orientation",
  "technical_aptitude",
  "leadership",
  "structure_preference", // low = prefers flexible/changing work, high = prefers routine/structured
  "independence_preference", // low = prefers teamwork, high = prefers solo work
  "risk_tolerance",
];

function buildPrompt(questionnaireResponse) {
  return `You are extracting structured career-relevant signals from a student's questionnaire answers.

Student's answers (raw):
${JSON.stringify(questionnaireResponse, null, 2)}

Score the student from 0 to 10 on EACH of these exact dimensions (use exactly these keys, no others):
${SIGNAL_DIMENSIONS.join(", ")}

Rules:
- Base scores only on what's implied by their answers — do not invent unstated traits.
- Write the summary in the second person, speaking directly to the student ("You enjoy...", "You do your best work..."). Never write "this student" or "the student". Use plain, friendly words and describe only what their answers show.
- Return ONLY a JSON object shaped exactly like this, with no extra text:
{
  "signals": {
    "analytical_thinking": <0-10 number>,
    "creativity": <0-10 number>,
    "people_orientation": <0-10 number>,
    "technical_aptitude": <0-10 number>,
    "leadership": <0-10 number>,
    "structure_preference": <0-10 number>,
    "independence_preference": <0-10 number>,
    "risk_tolerance": <0-10 number>
  },
  "summary": "<one or two plain-English sentences, written to the student as 'you'>"
}`;
}

function validateSignalProfile(parsed) {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Signal extraction: response is not an object");
  }
  if (!parsed.signals || typeof parsed.signals !== "object") {
    throw new Error("Signal extraction: missing 'signals' object");
  }
  for (const dim of SIGNAL_DIMENSIONS) {
    const value = parsed.signals[dim];
    if (typeof value !== "number" || value < 0 || value > 10) {
      throw new Error(`Signal extraction: invalid or missing score for '${dim}'`);
    }
  }
  if (typeof parsed.summary !== "string" || parsed.summary.trim() === "") {
    throw new Error("Signal extraction: missing 'summary' string");
  }
  return parsed;
}

/**
 * Main entry point for this pipeline stage.
 * @param {string} apiKey - Gemini API key (from Secret Manager, passed in by the caller)
 * @param {object} questionnaireResponse - raw answers from Flutter (interests, hobbies, strengths, workStyles, priorityWeights)
 * @returns {Promise<{signals: object, summary: string}>}
 */
async function extractSignals(apiKey, questionnaireResponse) {
  const prompt = buildPrompt(questionnaireResponse);
  const rawText = await callGemini(apiKey, prompt);

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`Signal extraction: Gemini returned invalid JSON: ${rawText}`);
  }

  return validateSignalProfile(parsed);
}

module.exports = { extractSignals, SIGNAL_DIMENSIONS, validateSignalProfile };