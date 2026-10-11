'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { runPipeline } = require('./pipeline/runPipeline');

if (!getApps().length) initializeApp();

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const TAVILY_API_KEY = defineSecret('TAVILY_API_KEY');
const EXA_API_KEY = defineSecret('EXA_API_KEY');

// TEMPORARY: Auth isn't built yet. Set REQUIRE_AUTH = true before any real deploy.
const REQUIRE_AUTH = false;
const DEV_UID = 'dev-user';

const MAX_ITEMS = 20;
const MAX_TEXT = 200;

function cleanStringList(value, field, { required }) {
  if (!Array.isArray(value)) throw new HttpsError('invalid-argument', `${field} must be a list`);
  if (required && value.length === 0) throw new HttpsError('invalid-argument', `${field} needs at least one selection`);
  if (value.length > MAX_ITEMS) throw new HttpsError('invalid-argument', `${field} has too many items`);
  return value.map((v) => {
    if (typeof v !== 'string' || v.length > MAX_TEXT) {
      throw new HttpsError('invalid-argument', `${field} contains an invalid item`);
    }
    return v.trim();
  });
}

function cleanOptionalText(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length > MAX_TEXT) {
    throw new HttpsError('invalid-argument', `${field} is invalid`);
  }
  return value.trim() || null;
}

// Returns a new object containing ONLY the fields we expect.
function validateQuestionnaire(q) {
  if (!q || typeof q !== 'object') throw new HttpsError('invalid-argument', 'questionnaire missing');
  const pw = q.priorityWeights;
  const w = [pw?.interestWeight, pw?.salaryWeight, pw?.demandWeight];
  if (w.some((x) => typeof x !== 'number' || !Number.isFinite(x) || x < 0) || w.reduce((a, b) => a + b, 0) <= 0) {
    throw new HttpsError('invalid-argument', 'priorityWeights are invalid');
  }
  return {
    interests: cleanStringList(q.interests, 'interests', { required: true }),
    interestsOther: cleanOptionalText(q.interestsOther, 'interestsOther'),
    hobbies: cleanStringList(q.hobbies, 'hobbies', { required: false }),
    hobbiesOther: cleanOptionalText(q.hobbiesOther, 'hobbiesOther'),
    strengths: cleanStringList(q.strengths, 'strengths', { required: true }),
    strengthsOther: cleanOptionalText(q.strengthsOther, 'strengthsOther'),
    workStyles: cleanStringList(q.workStyles, 'workStyles', { required: true }),
    workStylesOther: cleanOptionalText(q.workStylesOther, 'workStylesOther'),
    priorityWeights: {
      interestWeight: w[0],
      salaryWeight: w[1],
      demandWeight: w[2],
    },
  };
}

// Firestore rejects `undefined`; a JSON round-trip drops it (and turns NaN into null).
const clean = (o) => JSON.parse(JSON.stringify(o));

async function saveAttempt(uid, questionnaire, result) {
  const db = getFirestore();
  const attemptRef = db.collection('students').doc(uid).collection('attempts').doc();
  const batch = db.batch();

  batch.set(attemptRef, {
    ...clean({
      status: 'completed',
      questionnaire,
      signal_profile: result.signalProfile,
      priority_weights: result.weights,
      // The exact engine input, so any ranking can be replayed and audited later.
      candidates_snapshot: result.candidates,
      pipeline_version: 1,
    }),
    attempt_date: FieldValue.serverTimestamp(),
  });

  const recommendations = result.ranked.map((c) => {
    const ref = attemptRef.collection('recommendations').doc();
    const data = clean({
      career_name: c.career_name,
      rank: c.rank,
      fit_score: c.interest_fit,
      salary_score: c.salary_score,
      demand_score: c.demand_score,
      final_score: c.final_score,
      reasoning_text: c.reasoning_text,
      verified_flag: c.verified_flag,
      median_salary_lpa: c.median_salary_lpa ?? null,
      demand_level: c.demand_level ?? 'unknown',
      chennai_demand_note: c.chennai_demand_note ?? null,
      degrees: c.degrees ?? [],
      certifications: c.certifications ?? [],
      data_quality: c.data_quality ?? 'partial',
    });
    batch.set(ref, data);
    return { id: ref.id, ...data };
  });

  await batch.commit();
  // Same normalization the scoring engine applies (divide by the sum), so the
  // app can show the priorities that produced the overall score.
  const pw = questionnaire.priorityWeights;
  const total = pw.interestWeight + pw.salaryWeight + pw.demandWeight; // > 0, checked in validateQuestionnaire
  const weights = {
    interest: pw.interestWeight / total,
    salary: pw.salaryWeight / total,
    demand: pw.demandWeight / total,
  };

  return { attemptId: attemptRef.id, summary: result.signalProfile.summary, weights, recommendations };
}

exports.submitAssessment = onCall(
  {
    region: 'asia-south1',
    secrets: [GEMINI_API_KEY, TAVILY_API_KEY, EXA_API_KEY],
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (request) => {
    if (REQUIRE_AUTH && !request.auth) {
      throw new HttpsError('unauthenticated', 'Please sign in first.');
    }
    const uid = request.auth?.uid ?? DEV_UID;
    const questionnaire = validateQuestionnaire(request.data?.questionnaire);

    let result;
    try {
      result = await runPipeline(
        {
          geminiApiKey: GEMINI_API_KEY.value(),
          tavilyApiKey: TAVILY_API_KEY.value(),
          exaApiKey: EXA_API_KEY.value(),
        },
        questionnaire
      );
    } catch (err) {
      logger.error('Pipeline failed', { message: err.message, stack: err.stack });
      throw new HttpsError('internal', 'We could not generate recommendations right now. Please try again.');
    }

    return saveAttempt(uid, questionnaire, result);
  }
);