const Exa = require("exa-js").default;

/**
 * Fetches live degree/certification/requirement data for a specific career.
 */
async function fetchCareerRequirementData(apiKey, careerName) {
  const exa = new Exa(apiKey);

  const result = await exa.searchAndContents(
    `degree requirements qualifications to become a ${careerName}`,
    {
      type: "auto",
      numResults: 5,
      text: true,
    }
  );

  return {
    career: careerName,
    sources: (result.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      text: r.text ? r.text.slice(0, 1500) : null, // cap length — Synthesizer only needs enough to extract structured fields, not full pages
    })),
  };
}

module.exports = { fetchCareerRequirementData };