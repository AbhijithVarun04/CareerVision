const { GoogleGenAI } = require("@google/genai");

/**
 * Thin wrapper around the Gemini SDK so every pipeline stage
 * calls Gemini the same way, with the same model/config.
 */
function getClient(apiKey) {
  return new GoogleGenAI({ apiKey });
}

/**
 * Calls Gemini with a prompt and returns the raw text response.
 * Callers are responsible for JSON.parse-ing it and handling errors.
 */
async function callGemini(apiKey, prompt) {
  const ai = getClient(apiKey);
  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash", // free-tier friendly, good enough for extraction/formatting tasks
    contents: prompt,
    config: {
      responseMimeType: "application/json", // forces valid JSON output, no markdown fences to strip
    },
  });
  return response.text;
}

module.exports = { callGemini };