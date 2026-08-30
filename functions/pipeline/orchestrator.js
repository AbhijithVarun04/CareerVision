const { callGemini } = require("../clients/geminiClient");

function buildShortlistPrompt(signalProfile, priorityWeights) {
  return `You are shortlisting career candidates for a student based on their signal profile.

Signal scores (0-10 each):
${JSON.stringify(signalProfile.signals, null, 2)}

Student summary: ${signalProfile.summary}

Student's stated priorities (weights sum to 1.0):
- Interest fit: ${priorityWeights.interestWeight}
- Salary: ${priorityWeights.salaryWeight}
- Market demand: ${priorityWeights.demandWeight}

Identify 10 to 15 real, distinct career titles that plausibly fit this student's profile.
Career recommendations are NOT geographically restricted — consider careers broadly, not just those common in any one city or region.

Rules:
- Return ONLY real, commonly recognized career/job titles (e.g. "Data Analyst", "Mechanical Engineer", "UX Designer") — no vague categories.
- No duplicates. No made-up job titles.
- Return ONLY a JSON object shaped exactly like this, no extra text:
{
  "candidates": ["Career Title 1", "Career Title 2", ...]
}`;
}

function validateShortlist(parsed) {
  if (!parsed || !Array.isArray(parsed.candidates)) {
    throw new Error("Orchestrator: response missing 'candidates' array");
  }
  if (parsed.candidates.length < 5 || parsed.candidates.length > 20) {
    throw new Error(
      `Orchestrator: unexpected candidate count (${parsed.candidates.length}) — expected roughly 10-15`
    );
  }
  for (const c of parsed.candidates) {
    if (typeof c !== "string" || c.trim() === "") {
      throw new Error("Orchestrator: invalid candidate entry");
    }
  }
  return parsed.candidates;
}

/**
 * Identifies ~10-15 candidate careers from the student's signal profile.
 * @param {string} geminiApiKey
 * @param {object} signalProfile - output of extractSignals() — { signals, summary }
 * @param {object} priorityWeights - { interestWeight, salaryWeight, demandWeight }
 * @returns {Promise<string[]>} candidate career titles
 */
async function identifyCandidateCareers(geminiApiKey, signalProfile, priorityWeights) {
  const prompt = buildShortlistPrompt(signalProfile, priorityWeights);
  const rawText = await callGemini(geminiApiKey, prompt);

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`Orchestrator: Gemini returned invalid JSON: ${rawText}`);
  }

  return validateShortlist(parsed);
}

module.exports = { identifyCandidateCareers, validateShortlist };