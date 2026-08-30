const { fetchCareerDemandData } = require("./tavilyClient");
const { fetchCareerRequirementData } = require("./exaClient");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries a fetch function on rate-limit errors with a short backoff.
 * Exa's free tier caps at 10 req/sec, so a burst of 12+ concurrent
 * candidates can trip it — this absorbs that instead of losing data.
 */
async function withRetry(fn, { retries = 2, delayMs = 1200 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit = err.message && err.message.toLowerCase().includes("rate limit");
      if (isRateLimit && attempt < retries) {
        await sleep(delayMs * (attempt + 1)); // backs off a bit more each retry
        continue;
      }
      throw err;
    }
  }
}

/**
 * Runs an array of async tasks with a max concurrency limit,
 * instead of firing all of them at once via Promise.all.
 */
async function runWithConcurrencyLimit(tasks, limit) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const currentIndex = index++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

/**
 * For each candidate career, fetches Tavily (demand/salary) and Exa (requirements).
 * Exa calls are throttled to respect its 10 req/sec free-tier limit; Tavily has
 * more headroom so it stays fully concurrent.
 *
 * @param {object} keys - { tavilyApiKey, exaApiKey }
 * @param {string[]} candidateCareers
 * @returns {Promise<Array<{career: string, demandData: object, requirementData: object}>>}
 */
async function fetchAllCandidateData(keys, candidateCareers) {
  // Tavily: fully concurrent, no known tight rate limit at this volume.
  const demandPromises = candidateCareers.map((career) =>
    fetchCareerDemandData(keys.tavilyApiKey, career).catch((err) => {
      console.error(`Tavily fetch failed for ${career}:`, err.message);
      return { career, tavilyAnswer: null, sources: [], error: err.message };
    })
  );

  // Exa: throttled to 5 concurrent requests, with retry-on-rate-limit.
  const requirementTasks = candidateCareers.map((career) => async () => {
    try {
      return await withRetry(() => fetchCareerRequirementData(keys.exaApiKey, career));
    } catch (err) {
      console.error(`Exa fetch failed for ${career}:`, err.message);
      return { career, sources: [], error: err.message };
    }
  });

  const [demandResults, requirementResults] = await Promise.all([
    Promise.all(demandPromises),
    runWithConcurrencyLimit(requirementTasks, 5),
  ]);

  return candidateCareers.map((career, i) => ({
    career,
    demandData: demandResults[i],
    requirementData: requirementResults[i],
  }));
}

module.exports = { fetchAllCandidateData };