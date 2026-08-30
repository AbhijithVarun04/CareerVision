const { extractSignals } = require("../pipeline/signalExtraction");
const { identifyCandidateCareers } = require("../pipeline/orchestrator");
const { fetchAllCandidateData } = require("../pipeline/dataFetch/parallelFetch");
const sample = require("./fixtures/sampleQuestionnaire.json");

// Run with:
//   GEMINI_API_KEY=... TAVILY_API_KEY=... EXA_API_KEY=... node test/orchestrator.test.js
async function run() {
  const geminiKey = process.env.GEMINI_API_KEY;
  const tavilyKey = process.env.TAVILY_API_KEY;
  const exaKey = process.env.EXA_API_KEY;

  if (!geminiKey || !tavilyKey || !exaKey) {
    console.error("Set GEMINI_API_KEY, TAVILY_API_KEY, and EXA_API_KEY env vars first.");
    process.exit(1);
  }

  try {
    console.log("Step 1: Extracting signals...");
    const signalProfile = await extractSignals(geminiKey, sample);
    console.log(`✅ Got ${Object.keys(signalProfile.signals).length} signal dimensions.\n`);

    console.log("Step 2: Identifying candidate careers...");
    const candidates = await identifyCandidateCareers(
      geminiKey,
      signalProfile,
      sample.priorityWeights
    );
    console.log(`✅ Got ${candidates.length} candidates:`, candidates, "\n");

    console.log("Step 3: Fetching live data for all candidates (this may take a bit)...");
    const results = await fetchAllCandidateData(
      { tavilyApiKey: tavilyKey, exaApiKey: exaKey },
      candidates
    );
    console.log(`✅ Fetched data for ${results.length} candidates.\n`);

    console.log("Sample result (first candidate):");
    console.log(JSON.stringify(results[0], null, 2));
  } catch (err) {
    console.error("❌ Pipeline failed:", err.message);
    process.exit(1);
  }
}

run();