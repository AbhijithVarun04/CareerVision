const { tavily } = require("@tavily/core");

/**
 * Fetches live demand/salary-relevant web data for a specific career,
 * scoped with a Chennai/India flavor per the brief's scoping rule
 * (informational tag, not a hard filter on the career itself).
 */
async function fetchCareerDemandData(apiKey, careerName) {
  const client = tavily({ apiKey });

  const response = await client.search(
    `${careerName} job demand salary India 2026`,
    {
      searchDepth: "basic",
      maxResults: 5,
      includeAnswer: true, // Tavily's own synthesized answer — useful raw signal for the Synthesizer stage
    }
  );

  return {
    career: careerName,
    tavilyAnswer: response.answer || null,
    sources: (response.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
    })),
  };
}

module.exports = { fetchCareerDemandData };