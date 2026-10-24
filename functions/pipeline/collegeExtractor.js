/**
 * Rule-based extraction of college names from web search results.
 * No AI and no network. Pure functions.
 * Finds names built around College / University / Institute / Institution / Academy,
 * and keeps a result only if its text mentions Chennai or a known Chennai area.
 */

const SEP = '\u00a6';

const KEYWORDS = new Set(['College', 'University', 'Institute', 'Institution', 'Academy']);

// Words that, on their own, do not identify a specific college.
const GENERIC = new Set([
  'college', 'university', 'institute', 'institution', 'academy', 'of', 'and', 'for', '&',
  'the', 'a', 'engineering', 'science', 'sciences', 'technology', 'arts', 'management',
  'medical', 'commerce', 'applied', 'higher', 'education', 'studies', 'research',
  'polytechnic', 'school',
]);

// Sentence-start / listicle words dropped from the front of a name.
const LEAD_STOP = new Set([
  'the', 'top', 'best', 'list', 'of', 'in', 'and', 'for', 'a', 'welcome', 'about', 'home',
  'apply', 'admission', 'admissions', 'courses', 'fees', 'ranking', 'rankings', 'popular',
  'leading', 'famous', 'visit', 'explore', 'join', 'contact',
]);

// Words that stop a name from growing to the right.
const TRAIL_STOP = new Set([
  'admission', 'admissions', 'course', 'courses', 'fees', 'placement', 'placements',
  'ranking', 'rankings', 'cutoff', 'review', 'reviews', 'contact', 'address', 'website',
]);

const CHENNAI_RE = new RegExp(
  '\\b(chennai|madras|guindy|tambaram|adyar|velachery|sholinganallur|omr|kelambakkam|' +
    'porur|kilpauk|egmore|anna nagar|perungudi|poonamallee|avadi|thalambur|siruseri|' +
    'chromepet|mylapore|taramani|nungambakkam)\\b',
  'i'
);

const MAX_NAME_CHARS = 80;
const MAX_BACKWARD_WORDS = 6;
const MAX_FORWARD_WORDS = 8;

const isCap = (w) => /^[A-Z]/.test(w);

/** Splits text into word tokens; `end: true` means a punctuation boundary follows the word. */
function tokenize(text) {
  const cleaned = String(text || '')
    .replace(/[\r\n\t]+/g, ` ${SEP} `)
    .replace(/\s[|\-\u2013\u2014\u2022\u00b7]\s/g, ` ${SEP} `);

  const toks = [];
  for (const raw of cleaned.split(/\s+/)) {
    if (!raw) continue;
    if (raw === SEP) {
      if (toks.length) toks[toks.length - 1].end = true;
      continue;
    }
    let w = raw;
    const lead = w.match(/^[("'\u201c\u2018\[]+/);
    if (lead) {
      w = w.slice(lead[0].length);
      if (toks.length) toks[toks.length - 1].end = true;
    }
    let end = false;
    for (;;) {
      if (/[,;:!?)\]"\u201d]$/.test(w)) {
        w = w.slice(0, -1);
        end = true;
      } else if (w.endsWith('.') && w.length - 1 >= 4 && !/^(?:[A-Za-z]\.)+$/.test(w)) {
        w = w.slice(0, -1);
        end = true;
      } else {
        break;
      }
    }
    if (!w) {
      if (end && toks.length) toks[toks.length - 1].end = true;
      continue;
    }
    toks.push({ w, end });
  }
  return toks;
}

function buildName(slice) {
  const words = slice.map((t) => t.w);
  while (words.length && LEAD_STOP.has(words[0].toLowerCase())) words.shift();
  if (!words.some((w) => !GENERIC.has(w.toLowerCase()))) return null;
  const name = words.join(' ');
  return name.length >= 6 && name.length <= MAX_NAME_CHARS ? name : null;
}

/** Returns the college names found in one piece of text (may contain repeats). */
function extractCollegeNames(text) {
  const toks = tokenize(text);
  const names = [];

  for (let i = 0; i < toks.length; i++) {
    if (!KEYWORDS.has(toks[i].w)) continue;

    // Walk left over capitalised words: "Madras Christian" + College.
    let start = i;
    while (start > 0 && i - start < MAX_BACKWARD_WORDS) {
      const p = toks[start - 1];
      if (p.end || !isCap(p.w)) break;
      start--;
    }

    // Walk right: "of Technology Madras", "of Science and Technology".
    let end = i;
    let hasOf = false;
    while (end - i < MAX_FORWARD_WORDS && !toks[end].end) {
      const n = toks[end + 1];
      if (!n) break;
      const lw = n.w.toLowerCase();

      if ((lw === 'of' || lw === 'for') && end === i) {
        const nn = toks[end + 2];
        if (nn && isCap(nn.w) && !TRAIL_STOP.has(nn.w.toLowerCase())) {
          end += 2;
          hasOf = true;
          continue;
        }
        break;
      }
      if ((lw === 'and' || lw === '&' || lw === 'for') && hasOf) {
        const nn = toks[end + 2];
        if (nn && isCap(nn.w) && !TRAIL_STOP.has(nn.w.toLowerCase())) {
          end += 2;
          continue;
        }
        break;
      }
      if (end > i && isCap(n.w) && !KEYWORDS.has(n.w) && !TRAIL_STOP.has(lw)) {
        end++;
        continue;
      }
      break;
    }

    const name = buildName(toks.slice(start, end + 1));
    if (name) names.push(name);
  }
  return names;
}

/**
 * @param {Array<{title?:string, content?:string, text?:string, url?:string}>} results
 *        merged Tavily + Exa results
 * @returns {Array<{name:string, url:string|null, mentions:number}>}
 *          de-duplicated, most-mentioned first, then A-Z, capped at `limit`
 */
function extractColleges(results, { limit = 15 } = {}) {
  const byKey = new Map();

  for (const r of Array.isArray(results) ? results : []) {
    if (!r || typeof r !== 'object') continue;
    const text = `${r.title || ''}\n${r.content || r.text || ''}`;
    if (!CHENNAI_RE.test(text)) continue;

    for (const name of new Set(extractCollegeNames(text))) {
      const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const entry = byKey.get(key);
      if (entry) {
        entry.mentions++;
        if (!entry.url && r.url) entry.url = r.url;
      } else {
        byKey.set(key, { name, url: r.url || null, mentions: 1 });
      }
    }
  }

  return [...byKey.values()]
    .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name))
    .slice(0, limit);
}

module.exports = { extractCollegeNames, extractColleges, tokenize };