const test = require("node:test");
const assert = require("node:assert");
const {
  validateSynthesis,
  applyEvidenceGuard,
  guardCareer,
  buildPrompt,
  tidyList,
} = require("../pipeline/synthesizer");
const { SIGNAL_DIMENSIONS } = require("../pipeline/signalExtraction");

function validCareer(name, overrides = {}) {
  const required_signals = {};
  SIGNAL_DIMENSIONS.forEach((d) => (required_signals[d] = 5));
  return {
    career: name,
    median_salary_lpa: 12,
    demand_level: "high",
    chennai_demand_note: null,
    degrees: ["B.E. Computer Science"],
    certifications: [],
    required_signals,
    data_quality: "good",
    ...overrides,
  };
}

test("accepts valid output and preserves expected order", () => {
  const parsed = { careers: [validCareer("B"), validCareer("A")] };
  const result = validateSynthesis(parsed, ["A", "B"]);
  assert.deepStrictEqual(result.map((c) => c.career), ["A", "B"]);
});

test("rejects output missing an expected career", () => {
  const parsed = { careers: [validCareer("A")] };
  assert.throws(() => validateSynthesis(parsed, ["A", "B"]), /missing career 'B'/);
});

test("rejects invalid demand_level", () => {
  const parsed = { careers: [validCareer("A", { demand_level: "huge" })] };
  assert.throws(() => validateSynthesis(parsed, ["A"]), /demand_level/);
});

test("rejects out-of-range required signal", () => {
  const c = validCareer("A");
  c.required_signals.creativity = 14;
  assert.throws(() => validateSynthesis({ careers: [c] }, ["A"]), /creativity/);
});

test("rejects absurd salary", () => {
  const parsed = { careers: [validCareer("A", { median_salary_lpa: 99999 })] };
  assert.throws(() => validateSynthesis(parsed, ["A"]), /median_salary_lpa/);
});

test("evidence guard nulls salary/demand when nothing was fetched", () => {
  const synthesized = [validCareer("A")];
  const raw = [{
    career: "A",
    demandData: { tavilyAnswer: null, sources: [], error: "failed" },
    requirementData: { sources: [], error: "failed" },
  }];
  const [guarded] = applyEvidenceGuard(synthesized, raw);
  assert.strictEqual(guarded.median_salary_lpa, null);
  assert.strictEqual(guarded.demand_level, "unknown");
  assert.strictEqual(guarded.data_quality, "poor");
});

test("evidence guard leaves data untouched when evidence exists", () => {
  const synthesized = [validCareer("A")];
  const raw = [{
    career: "A",
    demandData: { tavilyAnswer: "Median is 12 LPA", sources: [] },
    requirementData: { sources: [] },
  }];
  const [guarded] = applyEvidenceGuard(synthesized, raw);
  assert.strictEqual(guarded.median_salary_lpa, 12);
});

test('guardCareer: salary talk in Chennai note is nulled', () => {
  const base = {
    median_salary_lpa: 6,
    demand_level: 'high',
    data_quality: 'good'
  };

  assert.equal(
    guardCareer({
      ...base,
      chennai_demand_note: 'Chennai offers 9.5 to 12 LPA.'
    }).chennai_demand_note,
    null
  );

  assert.equal(
    guardCareer({
      ...base,
      chennai_demand_note: 'Average salary is high in Chennai.'
    }).chennai_demand_note,
    null
  );
});

test('guardCareer: a pure hiring-demand note is kept', () => {
  const note = 'Many IT firms in OMR are hiring for this role.';

  const r = guardCareer({
    median_salary_lpa: 6,
    demand_level: 'high',
    data_quality: 'good',
    chennai_demand_note: note,
  });

  assert.equal(r.chennai_demand_note, note);
});

test('guardCareer: "good" is downgraded when salary is null or demand is unknown', () => {
  const g = (o) =>
    guardCareer({
      chennai_demand_note: null,
      data_quality: 'good',
      ...o
    }).data_quality;

  assert.equal(
    g({ median_salary_lpa: null, demand_level: 'high' }),
    'partial'
  );

  assert.equal(
    g({ median_salary_lpa: 6, demand_level: 'unknown' }),
    'partial'
  );

  assert.equal(
    g({ median_salary_lpa: 6, demand_level: 'high' }),
    'good'
  );
});

test('guardCareer: never upgrades quality and does not mutate input', () => {
  const input = {
    median_salary_lpa: null,
    demand_level: 'unknown',
    data_quality: 'poor',
    chennai_demand_note: null
  };

  const snapshot = JSON.stringify(input);

  assert.equal(
    guardCareer(input).data_quality,
    'poor'
  );

  assert.equal(
    JSON.stringify(input),
    snapshot
  );
});

test('buildPrompt asks for full degree names and sourced certifications', () => {
  const p = buildPrompt([{ career: 'A', tavilyAnswer: null, demandSources: [], requirementSources: [] }]);
  assert.match(p, /FULL, official degree names/);
  assert.match(p, /Never a bare subject name/);
  assert.match(p, /Only include certifications supported by the sources/);
  assert.match(p, /Never invent one/);
});

test('tidyList: trims, capitalises, de-duplicates and drops empties', () => {
  assert.deepStrictEqual(
    tidyList(['  maths ', 'Maths', '', '   ', 'B.Sc.   Statistics', 'b.sc. statistics']),
    ['Maths', 'B.Sc. Statistics']
  );
});

test('tidyList: caps the list and drops overlong entries', () => {
  const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  assert.strictEqual(tidyList(many).length, 5);
  assert.deepStrictEqual(tidyList(['x'.repeat(101), 'BCA']), ['BCA']);
});

test('tidyList: ignores non-strings and returns non-arrays unchanged', () => {
  assert.deepStrictEqual(tidyList([null, 5, 'BCA']), ['BCA']);
  assert.strictEqual(tidyList(undefined), undefined);
});

test('tidyList is idempotent', () => {
  const once = tidyList(['  statistics ', 'B.Tech  IT']);
  assert.deepStrictEqual(tidyList(once), once);
});

test('guardCareer tidies degrees and certifications without mutating input', () => {
  const input = {
    median_salary_lpa: 6,
    demand_level: 'high',
    data_quality: 'good',
    chennai_demand_note: null,
    degrees: ['maths', 'Maths '],
    certifications: [],
  };
  const snapshot = JSON.stringify(input);
  const r = guardCareer(input);
  assert.deepStrictEqual(r.degrees, ['Maths']);
  assert.deepStrictEqual(r.certifications, []);
  assert.strictEqual(JSON.stringify(input), snapshot);
});

test('guardCareer leaves a career without degrees/certifications fields alone', () => {
  const r = guardCareer({ median_salary_lpa: 6, demand_level: 'high', data_quality: 'good', chennai_demand_note: null });
  assert.ok(!('degrees' in r));
  assert.ok(!('certifications' in r));
});