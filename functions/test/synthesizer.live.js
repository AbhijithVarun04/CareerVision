const fs = require("fs");
const path = require("path");
const { extractSignals } = require("../pipeline/signalExtraction");
const { identifyCandidateCareers } = require("../pipeline/orchestrator");
const { fetchAllCandidateData } = require("../pipeline/dataFetch/parallelFetch");
const { synthesize } = require("../pipeline/synthesizer");
const sample = require("./fixtures/sampleQuestionnaire.json");

const CACHE = path.join(__dirname, "fixtures", "fetchedData.cache.json");

const SYNTHESIZED_CACHE = path.join(
  __dirname,
  "fixtures",
  "synthesized.cache.json"
);

// Run with:
//   GEMINI_API_KEY=... TAVILY_API_KEY=... EXA_API_KEY=... node test/synthesizer.live.js
async function run() {
  const { GEMINI_API_KEY, TAVILY_API_KEY, EXA_API_KEY } = process.env;
  if (!GEMINI_API_KEY || !TAVILY_API_KEY || !EXA_API_KEY) {
    console.error("Set GEMINI_API_KEY, TAVILY_API_KEY and EXA_API_KEY first.");
    process.exit(1);
  }

  try {
    let rawItems;
    if (fs.existsSync(CACHE)) {
      console.log("Using cached fetch data (delete the cache file to refetch).");
      rawItems = JSON.parse(fs.readFileSync(CACHE, "utf8"));
    } else {
      const signalProfile = await extractSignals(GEMINI_API_KEY, sample);
      const candidates = await identifyCandidateCareers(
        GEMINI_API_KEY, signalProfile, sample.priorityWeights
      );
      rawItems = await fetchAllCandidateData(
        { tavilyApiKey: TAVILY_API_KEY, exaApiKey: EXA_API_KEY }, candidates
      );
      fs.writeFileSync(CACHE, JSON.stringify(rawItems, null, 2));
      console.log("Fetched fresh data and cached it.");
    }

    console.log(`Synthesizing ${rawItems.length} careers...`);
    const result = await synthesize(GEMINI_API_KEY, rawItems);

    fs.writeFileSync(
      SYNTHESIZED_CACHE,
      JSON.stringify(result, null, 2)
    );

    console.log("✅ Synthesis succeeded. First 2 careers:");
    console.log(JSON.stringify(result.slice(0, 2), null, 2));
    console.log("\nSummary:");
    result.forEach((c) =>
      console.log(`${c.career}: ${c.median_salary_lpa ?? "n/a"} LPA | demand=${c.demand_level} | quality=${c.data_quality}`)
    );
  } catch (err) {
    console.error("❌ Synthesizer failed:", err.message);
    process.exit(1);
  }
}

run();