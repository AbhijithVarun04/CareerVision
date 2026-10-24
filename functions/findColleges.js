"use strict";
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const {findChennaiColleges, cleanCollegeInput} = require("./pipeline/collegeSearch");

const TAVILY_API_KEY = defineSecret("TAVILY_API_KEY");
const EXA_API_KEY = defineSecret("EXA_API_KEY");

exports.findColleges = onCall(
    {
      region: "asia-south1",
      secrets: [TAVILY_API_KEY, EXA_API_KEY],
      timeoutSeconds: 60,
      memory: "256MiB",
    },
    async (request) => {
    // Every call must come from a signed-in student; there is no bypass.
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Please sign in first.");
      }

      let input;
      try {
        input = cleanCollegeInput(request.data);
      } catch (err) {
        throw new HttpsError("invalid-argument", err.message);
      }

      try {
        const {query, colleges} = await findChennaiColleges(
            {tavilyApiKey: TAVILY_API_KEY.value(), exaApiKey: EXA_API_KEY.value()},
            input,
        );
        return {query, colleges};
      } catch (err) {
        logger.error("College search failed", {message: err.message});
        throw new HttpsError("internal", "We could not load colleges right now. Please try again.");
      }
    },
);