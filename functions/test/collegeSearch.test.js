const test = require('node:test');
const assert = require('node:assert');
const { findChennaiColleges, buildQuery, cleanCollegeInput } = require('../pipeline/collegeSearch');

const KEYS = { tavilyApiKey: 'tk', exaApiKey: 'ek' };
const quiet = () => test.mock.method(console, 'warn', () => {});

test('buildQuery uses the course, tidied', () => {
  assert.strictEqual(buildQuery('  B.Sc.   Statistics ', 'x'), 'B.Sc. Statistics colleges in Chennai');
});

test('buildQuery falls back to the career name and throws when both are empty', () => {
  assert.strictEqual(buildQuery(null, 'Data Analyst'), 'Data Analyst courses colleges in Chennai');
  assert.throws(() => buildQuery(null, '  '), /required/);
});

test('merges both sources, passes the right keys and the same query to each', async () => {
  const calls = [];
  const out = await findChennaiColleges(KEYS, { course: 'BCA', careerName: 'Dev' }, {
    tavilySearch: async (k, q) => {
      calls.push(['t', k, q]);
      return [{ title: 'Loyola College', content: 'Chennai', url: 't1' }];
    },
    exaSearch: async (k, q) => {
      calls.push(['e', k, q]);
      return [{ title: 'x', text: 'Chennai. Anna University.', url: 'e1' }];
    },
  });
  assert.deepStrictEqual(calls, [
    ['t', 'tk', 'BCA colleges in Chennai'],
    ['e', 'ek', 'BCA colleges in Chennai'],
  ]);
  assert.strictEqual(out.query, 'BCA colleges in Chennai');
  assert.deepStrictEqual(out.colleges.map((c) => c.name), ['Anna University', 'Loyola College']);
  assert.strictEqual(out.sourceCount, 2);
});

test('one failing source still returns the other source\'s colleges', async () => {
  quiet();
  const out = await findChennaiColleges(KEYS, { course: 'BCA', careerName: null }, {
    tavilySearch: async () => { throw new Error('429'); },
    exaSearch: async () => [{ title: 'Loyola College', text: 'Chennai', url: 'e1' }],
  });
  test.mock.restoreAll();
  assert.deepStrictEqual(out.colleges.map((c) => c.name), ['Loyola College']);
});

test('a non-array response counts as a failed source', async () => {
  quiet();
  const out = await findChennaiColleges(KEYS, { course: 'BCA', careerName: null }, {
    tavilySearch: async () => null,
    exaSearch: async () => [{ title: 'Loyola College', text: 'Chennai', url: 'e1' }],
  });
  test.mock.restoreAll();
  assert.strictEqual(out.colleges.length, 1);
});

test('both sources failing rejects with a clear error', async () => {
  await assert.rejects(
    findChennaiColleges(KEYS, { course: 'BCA', careerName: null }, {
      tavilySearch: async () => { throw new Error('a'); },
      exaSearch: async () => { throw new Error('b'); },
    }),
    /College search failed/
  );
});

test('no results gives an empty list, not an error', async () => {
  const out = await findChennaiColleges(KEYS, { course: 'BCA', careerName: null }, {
    tavilySearch: async () => [],
    exaSearch: async () => [],
  });
  assert.deepStrictEqual(out.colleges, []);
  assert.strictEqual(out.sourceCount, 0);
});

test('cleanCollegeInput trims and accepts either field', () => {
  assert.deepStrictEqual(cleanCollegeInput({ course: '  BCA  ', careerName: null }), { course: 'BCA', careerName: null });
  assert.deepStrictEqual(cleanCollegeInput({ careerName: 'Data  Analyst' }), { course: null, careerName: 'Data Analyst' });
});

test('cleanCollegeInput rejects empty, non-string and overlong input', () => {
  assert.throws(() => cleanCollegeInput({}), /required/);
  assert.throws(() => cleanCollegeInput(undefined), /required/);
  assert.throws(() => cleanCollegeInput({ course: 5 }), /course is invalid/);
  assert.throws(() => cleanCollegeInput({ course: 'x'.repeat(201) }), /course is invalid/);
});