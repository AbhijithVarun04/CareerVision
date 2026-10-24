'use strict';
const { extractColleges } = require('./collegeExtractor');

const MAX_RESULTS = 8;
const MAX_TEXT_CHARS = 3000;
const MAX_INPUT_CHARS = 200;

const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');

function inputError(message) {
  const e = new Error(message);
  e.invalidArgument = true;
  return e;
}

function cleanField(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length > MAX_INPUT_CHARS) {
    throw inputError(`${field} is invalid`);
  }
  return clean(value) || null;
}

/** Validates the callable's request data. Throws an Error with invalidArgument = true. */
function cleanCollegeInput(data) {
  const course = cleanField(data?.course, 'course');
  const careerName = cleanField(data?.careerName, 'careerName');
  if (!course && !careerName) throw inputError('A course or career is required');
  return { course, careerName };
}

/** One query for both engines. Falls back to the career name when no course is chosen. */
function buildQuery(course, careerName) {
  const c = clean(course);
  if (c) return `${c} colleges in Chennai`;
  const k = clean(careerName);
  if (!k) throw new Error('A course or career name is required');
  return `${k} courses colleges in Chennai`;
}

async function tavilySearch(apiKey, query) {
  const { tavily } = require('@tavily/core');
  const response = await tavily({ apiKey }).search(query, {
    searchDepth: 'basic',
    maxResults: MAX_RESULTS,
  });
  return (response.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
  }));
}

async function exaSearch(apiKey, query) {
  const Exa = require('exa-js').default;
  const result = await new Exa(apiKey).searchAndContents(query, {
    type: 'auto',
    numResults: MAX_RESULTS,
    text: true,
  });
  return (result.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    text: r.text ? r.text.slice(0, MAX_TEXT_CHARS) : null,
  }));
}

/**
 * @param {{tavilyApiKey:string, exaApiKey:string}} keys
 * @param {{course:string|null, careerName:string|null}} input  (already cleaned)
 * @param {{tavilySearch?:Function, exaSearch?:Function}} deps  test hooks, never set in production
 * @returns {Promise<{query:string, colleges:Array, sourceCount:number}>}
 */
async function findChennaiColleges(keys, input, deps = {}) {
  const searchTavily = deps.tavilySearch || tavilySearch;
  const searchExa = deps.exaSearch || exaSearch;
  const query = buildQuery(input.course, input.careerName);

  const settled = await Promise.allSettled([
    searchTavily(keys.tavilyApiKey, query),
    searchExa(keys.exaApiKey, query),
  ]);

  const results = [];
  const errors = [];
  [['tavily', settled[0]], ['exa', settled[1]]].forEach(([name, s]) => {
    if (s.status === 'fulfilled' && Array.isArray(s.value)) results.push(...s.value);
    else errors.push(`${name}: ${s.reason?.message ?? 'unexpected response'}`);
  });

  if (errors.length === 2) throw new Error(`College search failed (${errors.join('; ')})`);
  if (errors.length === 1) console.warn(`[collegeSearch] one source failed: ${errors[0]}`);

  return { query, colleges: extractColleges(results), sourceCount: results.length };
}

module.exports = { findChennaiColleges, buildQuery, cleanCollegeInput };