'use strict';
// Offline test fixture: writes two FAKE attempts into the Firestore EMULATOR.
// The numbers are invented for UI testing and are not pipeline output.

const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refusing to run: FIRESTORE_EMULATOR_HOST is not set. This script must only write to the emulator.');
  process.exit(1);
}
const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node scripts/seedEmulator.js <uid>');
  process.exit(1);
}

initializeApp({ projectId: 'careervision-app' });
const db = getFirestore();

const DEMAND = { very_high: 1, high: 0.75, moderate: 0.5, low: 0.25, unknown: 0.25 };
const round4 = (n) => Math.round(n * 10000) / 10000;

// [name, fit, salaryScore, median_salary_lpa, demand_level, degrees, certifications, data_quality]
const OLDER = [
  ['Software Developer', 0.82, 0.6, 6.5, 'high', ['B.E. Computer Science and Engineering', 'B.Tech Information Technology'], ['AWS Certified Cloud Practitioner'], 'good'],
  ['Data Analyst', 0.74, 0.45, 5.0, 'high', ['B.Sc Statistics', 'B.Sc Computer Science'], [], 'good'],
  ['Cloud Architect', 0.7, 1.0, 12.0, 'very_high', ['B.E. Computer Science and Engineering'], ['AWS Certified Solutions Architect Associate'], 'good'],
  ['UX Designer', 0.55, 0.3, 4.2, 'moderate', [], [], 'partial'],
  ['Civil Engineer', 0.4, 0.25, null, 'moderate', ['B.E. Civil Engineering'], [], 'partial'],
];
const NEWER = [
  ['Cloud Architect', 0.78, 1.0, 12.0, 'very_high', ['B.E. Computer Science and Engineering'], ['AWS Certified Solutions Architect Associate'], 'good'],
  ['Software Developer', 0.8, 0.6, 6.5, 'high', ['B.E. Computer Science and Engineering', 'B.Tech Information Technology'], ['AWS Certified Cloud Practitioner'], 'good'],
  ['Cybersecurity Analyst', 0.72, 0.7, 8.0, 'very_high', ['B.E. Computer Science and Engineering'], ['CompTIA Security+'], 'good'],
  ['Data Analyst', 0.7, 0.45, 5.0, 'high', ['B.Sc Statistics', 'B.Sc Computer Science'], [], 'good'],
  ['UX Designer', 0.58, 0.3, 4.2, 'moderate', [], [], 'partial'],
];

async function seed(rows, weights, date, label) {
  const attemptRef = db.collection('students').doc(uid).collection('attempts').doc();
  const scored = rows
    .map(([name, fit, sal, lpa, demandLevel, degrees, certs, quality]) => {
      const dem = DEMAND[demandLevel];
      return {
        career_name: name,
        fit_score: fit,
        salary_score: sal,
        demand_score: dem,
        final_score: round4(weights.interest * fit + weights.salary * sal + weights.demand * dem),
        reasoning_text: 'TEST DATA: seeded for UI testing.',
        verified_flag: quality === 'good',
        median_salary_lpa: lpa,
        demand_level: demandLevel,
        chennai_demand_note: null,
        degrees,
        certifications: certs,
        data_quality: quality,
      };
    })
    .sort((a, b) => b.final_score - a.final_score)
    .map((c, i) => ({ ...c, rank: i + 1 }));

  await attemptRef.set({
    status: 'completed',
    questionnaire: {},
    signal_profile: { summary: `TEST DATA (${label}): seeded attempt, not a real assessment.` },
    priority_weights: weights,
    candidates_snapshot: [],
    pipeline_version: 1,
    attempt_date: Timestamp.fromDate(date),
  });
  for (const c of scored) await attemptRef.collection('recommendations').doc().set(c);
  console.log(`Seeded ${label}: ${attemptRef.id} (${scored.length} careers)`);
}

(async () => {
  const dayMs = 24 * 60 * 60 * 1000;
  await seed(OLDER, { interest: 0.5, salary: 0.25, demand: 0.25 }, new Date(Date.now() - 7 * dayMs), 'older');
  await seed(NEWER, { interest: 0.34, salary: 0.33, demand: 0.33 }, new Date(), 'newer');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});