/**
 * Translate a simple, non-regex filter state into a JavaScript regex source
 * string, and (best-effort) translate a regex source back into a simple state
 * so a user's prior filter can be re-edited in Simple mode.
 */

// Preset definitions — label shown in UI, regex fragment compiled into the
// simple-mode source. Ordered; identity is by `id`.
export const FILTER_PRESETS = [
  { id: 'questions', label: 'Questions',  pattern: '\\?' },
  { id: 'commands',  label: 'Commands',   pattern: '^!' },
  { id: 'allcaps',   label: 'All caps',   pattern: '^[A-Z\\s\\W]+$' },
  { id: 'mentions',  label: 'Mentions',   pattern: '@\\w+' },
  { id: 'links',     label: 'Links',      pattern: 'https?://' },
];
export const PRESET_BY_ID = new Map(FILTER_PRESETS.map(p => [p.id, p]));
export const PRESET_BY_PATTERN = new Map(FILTER_PRESETS.map(p => [p.pattern, p.id]));

export function escapeRegExp(str) {
  return String(str).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * @param {object} simple
 * @param {string[]} simple.include    — chips OR'd together (alongside presets)
 * @param {string[]} simple.exclude    — terms that must not appear
 * @param {boolean}  simple.wholeWord  — wrap include chips in \b…\b
 * @param {string[]} simple.presets    — preset ids that are toggled on
 * @returns {{ source: string, ok: boolean }}
 */
export function buildRegexFromSimple(simple) {
  const include = Array.isArray(simple?.include) ? simple.include.filter(Boolean) : [];
  const exclude = Array.isArray(simple?.exclude) ? simple.exclude.filter(Boolean) : [];
  const presetIds = Array.isArray(simple?.presets) ? simple.presets : [];
  const wholeWord = Boolean(simple?.wholeWord);

  const includeAlts = [];
  for (const term of include) {
    const esc = escapeRegExp(term);
    includeAlts.push(wholeWord ? `\\b${esc}\\b` : esc);
  }
  for (const id of presetIds) {
    const p = PRESET_BY_ID.get(id);
    if (p) includeAlts.push(p.pattern);
  }

  const excludeAlts = exclude.map(escapeRegExp);

  if (!includeAlts.length && !excludeAlts.length) return { source: '', ok: true };

  let source = '';
  if (excludeAlts.length) {
    source += `^(?!.*(?:${excludeAlts.join('|')}))`;
  }
  if (includeAlts.length) {
    source += excludeAlts.length ? `(?=.*(?:${includeAlts.join('|')}))` : `(?:${includeAlts.join('|')})`;
  }
  if (excludeAlts.length && !includeAlts.length) {
    source += '.*';
  }

  try { new RegExp(source, 'i'); return { source, ok: true }; }
  catch { return { source, ok: false }; }
}

/**
 * Best-effort reverse: inspect a regex source and return a simple state if
 * recognized, otherwise null. Recognized shapes are the exact ones produced
 * by buildRegexFromSimple.
 */
export function parseSimpleFromRegex(source) {
  if (typeof source !== 'string' || !source) {
    return { include: [], exclude: [], wholeWord: false, presets: [] };
  }
  let rest = source;
  const exclude = [];
  const mExc = rest.match(/^\^\(\?!\.\*\(\?:([^)]+)\)\)/);
  if (mExc) {
    for (const alt of _splitAlts(mExc[1])) {
      const u = _unescape(alt);
      if (u !== null) exclude.push(u);
      else return null;
    }
    rest = rest.slice(mExc[0].length);
  }

  let include = [];
  let presets = [];
  let wholeWord = false;

  const body = mExc && rest === '.*' ? '' : rest;
  if (body) {
    let alts = null;
    const mLookahead = body.match(/^\(\?=\.\*\(\?:([^)]+)\)\)$/);
    const mDirect    = body.match(/^\(\?:([^)]+)\)$/);
    if (mLookahead) alts = _splitAlts(mLookahead[1]);
    else if (mDirect) alts = _splitAlts(mDirect[1]);
    else return null;

    for (const alt of alts) {
      const presetId = PRESET_BY_PATTERN.get(alt);
      if (presetId) { presets.push(presetId); continue; }
      const mWord = alt.match(/^\\b(.*)\\b$/);
      if (mWord) {
        const u = _unescape(mWord[1]);
        if (u === null) return null;
        wholeWord = true;
        include.push(u);
        continue;
      }
      const u = _unescape(alt);
      if (u === null) return null;
      include.push(u);
    }
  }

  return { include, exclude, wholeWord, presets };
}

// Split alternation pattern on `|` while respecting escapes. Inputs here come
// from buildRegexFromSimple which only produces `\b`, escaped literals, and
// the preset fragments — none contain unescaped pipes outside groups.
function _splitAlts(src) {
  const out = [];
  let buf = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\\' && i + 1 < src.length) {
      buf += c + src[i + 1];
      i++;
    } else if (c === '|') {
      out.push(buf);
      buf = '';
    } else {
      buf += c;
    }
  }
  out.push(buf);
  return out;
}

// Reverse escapeRegExp. Returns null if the input is anything other than
// escaped-literal characters (i.e. it's real regex, not a simple chip).
function _unescape(src) {
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') {
      if (i + 1 >= src.length) return null;
      const n = src[i + 1];
      if (!/[-\/\\^$*+?.()|[\]{}]/.test(n)) return null;
      out += n;
      i++;
    } else if (/[.^$*+?()[\]{}|\\]/.test(c)) {
      return null;
    } else {
      out += c;
    }
  }
  return out;
}
