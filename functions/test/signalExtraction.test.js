const { extractSignals } = require("../pipeline/signalExtraction");
const sample = require("./fixtures/sampleQuestionnaire.json");

// Manual test runner — run with: node test/signalExtraction.test.js
// Pass your API key as an env var so it's never hardcoded:
//   GEMINI_API_KEY=your-key node test/signalExtraction.test.js
async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Set GEMINI_API_KEY env var before running this test.");
    process.exit(1);
  }

  try {
    const result = await extractSignals(apiKey, sample);
    console.log("✅ Signal extraction succeeded:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("❌ Signal extraction failed:", err.message);
    process.exit(1);
  }
}

run();