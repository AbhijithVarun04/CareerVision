'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyRecommendations, DIMENSIONS } = require('../pipeline/verifier');
const { SIGNAL_DIMENSIONS } = require('../pipeline/signalExtraction');

const sig = (over = {}) => ({
  ...Object.fromEntries(SIGNAL_DIMENSIONS.map((d) => [d, 5])),
  ...over,
});
const STUDENT = sig({ analytical_thinking: 1, creativity: 2, technical_aptitude: 2, leadership: 3 });

const career = (over = {}) => ({
  career_name: 'Alpha',
  rank: 1,
  final_score: 0.9,
  interest_fit: 0.8,
  salary_score: 1,
  demand_score: 1,
  median_salary_lpa: 9,
  demand_level: 'high',
  data_quality: 'good',
  required_signals: sig(),
  ...over,
});

const verifyOne = (over, student = STUDENT) => verifyRecommendations([career(over)], student)[0];

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
}

test('a clean career is verified, with no note, and keeps every field', () => {
  const out = verifyOne({});
  assert.deepEqual(out, { ...career(), verified_flag: true });
  assert.ok(!('verifier_note' in out));
});

test('limited data fails verification but adds no note (the Formatter words it)', () => {
  for (const q of ['partial', 'poor', undefined]) {
    const out = verifyOne({ data_quality: q });
    assert.equal(out.verified_flag, false);
    assert.ok(!('verifier_note' in out));
  }
});

test('a hard mismatch fails verification and names the skill in plain words', () => {
  const out = verifyOne({ required_signals: sig({ technical_aptitude: 9 }) });
  assert.equal(out.verified_flag, false);
  assert.equal(
    out.verifier_note,
    'This role usually calls for strong technical skills, which your answers show less of.'
  );
});

test('mismatch thresholds: required >= 7 and student <= 3, both inclusive', () => {
  assert.equal(verifyOne({ required_signals: sig({ leadership: 7 }) }).verified_flag, false); // 7 vs 3
  assert.equal(verifyOne({ required_signals: sig({ leadership: 6.9 }) }).verified_flag, true);
  assert.equal(
    verifyOne({ required_signals: sig({ leadership: 7 }) }, sig({ leadership: 3.1 })).verified_flag,
    true
  );
});

test('at most two mismatches are named, biggest gap first, ties by dimension order', () => {
  const three = verifyOne({
    required_signals: sig({ analytical_thinking: 10, creativity: 8, leadership: 7 }),
  });
  assert.equal(
    three.verifier_note,
    'This role usually calls for strong analytical thinking and a lot of creativity, which your answers show less of.'
  );
  const tie = verifyOne(
    { required_signals: sig({ creativity: 8, analytical_thinking: 8 }) },
    sig({ analytical_thinking: 3, creativity: 3 })
  );
  assert.equal(
    tie.verifier_note,
    'This role usually calls for strong analytical thinking and a lot of creativity, which your answers show less of.'
  );
});

test('weak interest fit adds a stretch note; exactly 50% is fine', () => {
  const weak = verifyOne({ interest_fit: 0.49 });
  assert.equal(weak.verified_flag, false);
  assert.equal(weak.verifier_note, 'Treat this as a stretch option rather than a close match.');
  const edge = verifyOne({ interest_fit: 0.5 });
  assert.equal(edge.verified_flag, true);
  assert.ok(!('verifier_note' in edge));
});

test('mismatch and weak fit notes are combined, mismatch first', () => {
  const out = verifyOne({ interest_fit: 0.3, required_signals: sig({ technical_aptitude: 9 }) });
  assert.equal(
    out.verifier_note,
    'This role usually calls for strong technical skills, which your answers show less of. ' +
      'Treat this as a stretch option rather than a close match.'
  );
});

test('order, length, ranks and scores are preserved and inputs are not mutated', () => {
  const ranked = deepFreeze([
    career({ career_name: 'A', rank: 1, final_score: 0.9 }),
    career({ career_name: 'B', rank: 2, final_score: 0.5, data_quality: 'poor' }),
    career({ career_name: 'C', rank: 3, final_score: 0.2, interest_fit: 0.3 }),
  ]);
  deepFreeze(STUDENT);
  const out = verifyRecommendations(ranked, STUDENT);
  assert.notEqual(out, ranked);
  assert.deepEqual(out.map((c) => c.career_name), ['A', 'B', 'C']);
  assert.deepEqual(out.map((c) => c.rank), [1, 2, 3]);
  assert.deepEqual(out.map((c) => c.final_score), [0.9, 0.5, 0.2]);
  assert.deepEqual(out.map((c) => c.verified_flag), [true, false, false]);
});

test('unusable data means "not verified", never a crash or an invented note', () => {
  for (const over of [{ required_signals: undefined }, { required_signals: {} }]) {
    const out = verifyOne(over);
    assert.equal(out.verified_flag, false);
    assert.ok(!('verifier_note' in out));
  }
  const noStudent = verifyRecommendations([career()], null)[0];
  assert.equal(noStudent.verified_flag, false);
  assert.ok(!('verifier_note' in noStudent));
});

test('the phrase table covers exactly the 8 signal dimensions', () => {
  assert.deepEqual([...DIMENSIONS].sort(), [...SIGNAL_DIMENSIONS].sort());
});

test('a non-array input is rejected', () => {
  assert.throws(() => verifyRecommendations(null, STUDENT), TypeError);
});