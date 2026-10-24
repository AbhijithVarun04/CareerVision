const test = require('node:test');
const assert = require('node:assert');
const { extractCollegeNames, extractColleges } = require('../pipeline/collegeExtractor');

test('finds several colleges in one sentence', () => {
  assert.deepStrictEqual(
    extractCollegeNames('Loyola College and Madras Christian College are popular in Chennai.'),
    ['Loyola College', 'Madras Christian College']
  );
});

test('a comma ends the name', () => {
  assert.deepStrictEqual(extractCollegeNames('Anna University, Chennai'), ['Anna University']);
});

test('follows "of ..." chains, including a trailing place name', () => {
  assert.deepStrictEqual(
    extractCollegeNames('Indian Institute of Technology Madras offers B.Tech'),
    ['Indian Institute of Technology Madras']
  );
  assert.deepStrictEqual(
    extractCollegeNames('College of Engineering Guindy'),
    ['College of Engineering Guindy']
  );
});

test('generic names with no identifying word are dropped', () => {
  assert.deepStrictEqual(extractCollegeNames('The College of Engineering offers courses'), []);
  assert.deepStrictEqual(extractCollegeNames('Best College in Chennai'), []);
});

test('listicle lead words are stripped and "and" works inside an "of" chain', () => {
  assert.deepStrictEqual(
    extractCollegeNames('Top SRM Institute of Science and Technology'),
    ['SRM Institute of Science and Technology']
  );
});

test('plural headings such as "Colleges" are ignored', () => {
  assert.deepStrictEqual(extractCollegeNames('Top Engineering Colleges in Chennai 2026'), []);
});

test('extractColleges keeps only results that mention Chennai or a Chennai area', () => {
  const out = extractColleges([
    { title: 'Loyola College', content: 'Located in Chennai', url: 'u1' },
    { title: 'Stanford University', content: 'California', url: 'u2' },
  ]);
  assert.deepStrictEqual(out.map((c) => c.name), ['Loyola College']);
  assert.strictEqual(out[0].url, 'u1');
});

test('extractColleges de-duplicates, counts mentions and sorts by them', () => {
  const out = extractColleges([
    { title: 'Top colleges in Chennai', content: 'Loyola College. Anna University.', url: 'u1' },
    { title: 'Loyola College Chennai', content: '', url: 'u2' },
  ]);
  assert.deepStrictEqual(out.map((c) => [c.name, c.mentions]), [
    ['Loyola College', 2],
    ['Anna University', 1],
  ]);
  assert.strictEqual(out[0].url, 'u1');
});

test('extractColleges caps the list (default 15, adjustable)', () => {
  const content = Array.from({ length: 20 }, (_, i) => `Kollam${String.fromCharCode(65 + i)} College.`).join(' ');
  const res = [{ title: 'Chennai', content, url: 'u' }];
  assert.strictEqual(extractColleges(res).length, 15);
  assert.strictEqual(extractColleges(res, { limit: 3 }).length, 3);
});

test('extractColleges tolerates junk input', () => {
  assert.deepStrictEqual(extractColleges(null), []);
  assert.deepStrictEqual(extractColleges([null, {}, { title: 5 }, 'x']), []);
});

test('Exa-style results (text field instead of content) are read too', () => {
  const out = extractColleges([{ title: 'x', text: 'Chennai | Ethiraj College for Women', url: 'e1' }]);
  assert.deepStrictEqual(out.map((c) => c.name), ['Ethiraj College for Women']);
});