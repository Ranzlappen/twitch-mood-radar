/**
 * Unified settings layer.
 *
 * One main blob (moodradar_options_v2) holds every non-sensitive setting by
 * schema key; sensitive / large-payload keys (OAuth token, YT API key, regex
 * history, layout, resize, filter state) stay in their own localStorage keys.
 *
 * On first boot after upgrade, migrate() pulls the scattered raw v1 keys
 * (halflife, tlpoints, tlinterval, labelscale, bubblescale, feedfont, etc.)
 * into the blob so we have a single source of truth.
 *
 * Every set() dispatches a CustomEvent('settings:change', {detail:{key,value,scope}})
 * on document so modules can subscribe to live changes without importing setters.
 */
import { load, save, loadRaw } from './storage.js';
import { DEFAULT_OPTIONS, OPTIONS_STORAGE_KEY } from '../config.js';

export const OPTIONS_STORAGE_KEY_V2 = 'moodradar_options_v2';

// Scattered v1 keys that migrate into the v2 blob.
// { from: localStorage key, to: blob field, parse: fn, clamp: fn }
const MIGRATIONS = [
  { from:'moodradar_halflife_v1',        to:'halflifeSec',   parse:parseInt,   clamp:v=>clamp(v,1,60,10) },
  { from:'moodradar_tlpoints_v1',        to:'tlPoints',       parse:parseInt,   clamp:v=>clamp(v,50,1000,200) },
  { from:'moodradar_tlinterval_v1',      to:'tlInterval',     parse:parseInt,   clamp:v=>clamp(v,200,5000,1000) },
  { from:'moodradar_labelscale_v1',      to:'labelScale',     parse:parseFloat, clamp:v=>clamp(v,0.4,2.5,1.4) },
  { from:'moodradar_bubblescale_v1',     to:'bubbleScale',    parse:parseFloat, clamp:v=>clamp(v,0.3,1.5,1.0) },
  { from:'moodradar_feedfont_v1',        to:'feedFont',       parse:parseFloat, clamp:v=>clamp(v,0.1,20,2) },
  { from:'moodradar_outlierfont_v1',     to:'outlierFont',    parse:parseFloat, clamp:v=>clamp(v,0.1,20,2) },
  { from:'moodradar_filteredfeedfont_v1',to:'filteredFeedFont',parse:parseFloat,clamp:v=>clamp(v,0.1,20,2) },
  { from:'moodradar_userhistfont_v1',    to:'userHistFont',   parse:parseFloat, clamp:v=>clamp(v,0.5,4,1) },
  { from:'moodradar_userhistbots_v1',    to:'userHistBots',   parse:parseBool,  clamp:v=>!!v },
  { from:'moodradar_userhistscope_v1',   to:'userHistScope',  parse:String,     clamp:v=>(v==='all'?'all':'channel') },
];

// Extended defaults — merge scattered keys' defaults into DEFAULT_OPTIONS at runtime.
export const EXTENDED_DEFAULTS = {
  ...DEFAULT_OPTIONS,
  halflifeSec: 10,
  tlPoints: 200,
  tlInterval: 1000,
  labelScale: 1.4,
  bubbleScale: 1.0,
  feedFont: 2,
  outlierFont: 2,
  filteredFeedFont: 2,
  userHistFont: 1,
  userHistBots: false,
  userHistScope: 'channel',
};

let _cache = null;
const _listeners = new Map(); // key -> Set<fn>

function clamp(v, lo, hi, fallback) {
  if (typeof v !== 'number' || isNaN(v)) return fallback;
  return Math.min(hi, Math.max(lo, v));
}

function parseBool(s) {
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return !!s;
}

function readBlob() {
  if (_cache) return _cache;
  const saved = load(OPTIONS_STORAGE_KEY_V2, null);
  _cache = saved ? { ...EXTENDED_DEFAULTS, ...saved } : { ...EXTENDED_DEFAULTS };
  return _cache;
}

function writeBlob() {
  save(OPTIONS_STORAGE_KEY_V2, _cache);
}

/* ── public API ─────────────────────────────────────── */

export function get(key, fallback) {
  const blob = readBlob();
  if (key in blob) return blob[key];
  return fallback !== undefined ? fallback : EXTENDED_DEFAULTS[key];
}

export function set(key, value, opts = {}) {
  const blob = readBlob();
  const prev = blob[key];
  if (prev === value) return;
  blob[key] = value;
  writeBlob();
  if (!opts.silent) {
    try {
      document.dispatchEvent(new CustomEvent('settings:change', {
        detail: { key, value, prev, scope: opts.scope || 'global' },
      }));
    } catch {}
    const ls = _listeners.get(key);
    if (ls) ls.forEach(fn => { try { fn(value, prev); } catch {} });
  }
}

export function getAll() {
  return { ...readBlob() };
}

export function resetAll() {
  _cache = { ...EXTENDED_DEFAULTS };
  writeBlob();
  try {
    document.dispatchEvent(new CustomEvent('settings:reset'));
  } catch {}
}

export function on(key, fn) {
  if (!_listeners.has(key)) _listeners.set(key, new Set());
  _listeners.get(key).add(fn);
}

export function off(key, fn) {
  const ls = _listeners.get(key);
  if (ls) ls.delete(fn);
}

/**
 * One-shot migration: pull scattered v1 raw keys into the v2 blob if
 * they exist and the blob field isn't already set. Also absorb the legacy
 * OPTIONS_STORAGE_KEY (v1 options blob) if present.
 */
export function migrate() {
  const blob = readBlob();
  let touched = false;

  // Absorb legacy options blob (moodradar_options_v1)
  const legacyOptions = load(OPTIONS_STORAGE_KEY, null);
  if (legacyOptions && typeof legacyOptions === 'object') {
    for (const [k, v] of Object.entries(legacyOptions)) {
      if (!(k in blob) || blob[k] === EXTENDED_DEFAULTS[k]) {
        blob[k] = v;
        touched = true;
      }
    }
  }

  // Absorb scattered raw keys
  for (const m of MIGRATIONS) {
    if (m.to in blob && blob[m.to] !== EXTENDED_DEFAULTS[m.to]) continue;
    const raw = loadRaw(m.from, null);
    if (raw === null) continue;
    try {
      const parsed = m.parse(raw);
      const clamped = m.clamp(parsed);
      blob[m.to] = clamped;
      touched = true;
    } catch {}
  }

  if (touched) writeBlob();
  return touched;
}

// Convenience namespace export so callers can do `import * as settings ...`
export default { get, set, getAll, resetAll, on, off, migrate };
