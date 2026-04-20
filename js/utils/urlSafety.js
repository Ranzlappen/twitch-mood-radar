/**
 * Client-side URL safety heuristic. No network calls, no API keys — runs
 * entirely in the browser so it works offline and never leaks click data.
 *
 * Returns:
 *   {
 *     verdict: 'safe' | 'caution' | 'suspicious' | 'blocked',
 *     reasons: string[],                 // human-readable risk notes
 *     parsed:  { scheme, host, port, path }  // normalized pieces
 *   }
 *
 * Scoring is additive. The thresholds are tuned to flag the most common
 * phishing patterns (IP hosts, punycode, brand-lookalike-in-subdomain,
 * sensitive keywords in path) without alarming on legitimate links.
 */

// Schemes that execute code or side-channel data — always blocked.
const DANGEROUS_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:'];

// Popular URL shorteners — destination can't be inspected, so warn.
const SHORTENERS = new Set([
  'bit.ly', 't.co', 'goo.gl', 'tinyurl.com', 'ow.ly', 'is.gd',
  'buff.ly', 'adf.ly', 'cutt.ly', 'rebrand.ly', 'shorte.st', 'bl.ink',
  'tiny.cc', 't.ly', 'rb.gy', 'shorturl.at', 'tr.im', 'x.co',
]);

// Heavily correlated with spam / phishing per abuse reports. Not a verdict
// on its own, but adds signal.
const SUSPICIOUS_TLDS = new Set([
  'zip', 'mov', 'top', 'xyz', 'tk', 'ml', 'ga', 'cf', 'gq',
  'click', 'country', 'stream', 'download', 'work', 'support',
  'loan', 'men', 'review', 'party', 'racing', 'rest', 'bid',
]);

// Common phishing targets. A subdomain that contains one of these but whose
// registrable domain is not the real thing is a classic homoglyph attack.
const BRAND_TARGETS = [
  'paypal', 'google', 'microsoft', 'apple', 'amazon', 'netflix',
  'steam', 'twitch', 'discord', 'instagram', 'facebook', 'twitter',
  'reddit', 'github', 'gmail', 'outlook', 'coinbase', 'binance',
  'metamask', 'kraken', 'blockchain',
];

// Real domains for the above brands — used to tell a real brand URL from a
// lookalike. Keyed by the brand token.
const BRAND_REAL_DOMAIN = {
  paypal:     ['paypal.com'],
  google:     ['google.com', 'googleapis.com', 'goog.le', 'youtube.com'],
  microsoft:  ['microsoft.com', 'live.com', 'office.com', 'azure.com'],
  apple:      ['apple.com', 'icloud.com'],
  amazon:     ['amazon.com', 'amazon.co.uk', 'amazon.de', 'amazonaws.com'],
  netflix:    ['netflix.com'],
  steam:      ['steamcommunity.com', 'steampowered.com', 'valvesoftware.com'],
  twitch:     ['twitch.tv'],
  discord:    ['discord.com', 'discord.gg', 'discordapp.com'],
  instagram:  ['instagram.com'],
  facebook:   ['facebook.com', 'fb.com'],
  twitter:    ['twitter.com', 'x.com'],
  reddit:     ['reddit.com'],
  github:     ['github.com', 'github.io', 'githubusercontent.com'],
  gmail:      ['gmail.com', 'google.com'],
  outlook:    ['outlook.com', 'live.com', 'microsoft.com'],
  coinbase:   ['coinbase.com'],
  binance:    ['binance.com', 'binance.us'],
  metamask:   ['metamask.io'],
  kraken:     ['kraken.com'],
  blockchain: ['blockchain.com', 'blockchain.info'],
};

// Path tokens that phishing pages lean on heavily.
const SENSITIVE_PATH_TOKENS = [
  'login', 'signin', 'sign-in', 'verify', 'verification', 'secure',
  'account', 'confirm', 'update', 'wallet', 'recover', 'unlock',
  'suspended', 'reset-password',
];

const IPV4_HOST_RE = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV6_HOST_RE = /^\[[0-9a-f:]+\]$/i;

/**
 * Extract the "registrable" (effective second-level) domain from a hostname.
 * Uses a small hardcoded list of double-barrel ccTLDs rather than the full
 * public-suffix list to avoid a heavy dependency. Good enough for phishing
 * heuristics — edge cases at most inflate the "suspicious subdomains" count.
 */
const DOUBLE_BARREL_TLDS = new Set([
  'co.uk', 'ac.uk', 'gov.uk', 'org.uk', 'net.uk',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp',
  'com.au', 'net.au', 'org.au', 'gov.au',
  'co.nz', 'net.nz', 'org.nz',
  'com.br', 'com.mx', 'co.in', 'co.za', 'com.sg',
]);

function _registrable(host) {
  const parts = host.split('.');
  if (parts.length < 2) return host;
  const last2 = parts.slice(-2).join('.');
  const last3 = parts.slice(-3).join('.');
  if (parts.length >= 3 && DOUBLE_BARREL_TLDS.has(last2)) return last3;
  return last2;
}

export function analyzeUrl(rawUrl) {
  const reasons = [];
  const parsed = { scheme: '', host: '', port: '', path: '', raw: rawUrl || '' };

  if (!rawUrl || typeof rawUrl !== 'string') {
    return { verdict: 'blocked', reasons: ['Empty or invalid URL.'], parsed };
  }

  const lower = rawUrl.toLowerCase();
  for (const bad of DANGEROUS_SCHEMES) {
    if (lower.startsWith(bad)) {
      return {
        verdict: 'blocked',
        reasons: [`Dangerous scheme "${bad}" — executes code or exfiltrates data.`],
        parsed,
      };
    }
  }

  let u;
  try { u = new URL(rawUrl); }
  catch {
    return { verdict: 'suspicious', reasons: ['URL failed to parse.'], parsed };
  }

  parsed.scheme = u.protocol.replace(':', '');
  parsed.host   = u.hostname;
  parsed.port   = u.port;
  parsed.path   = u.pathname + u.search + u.hash;

  let score = 0;

  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return {
      verdict: 'blocked',
      reasons: [`Unexpected scheme "${u.protocol}".`],
      parsed,
    };
  }
  if (u.protocol === 'http:') {
    score += 1;
    reasons.push('Not HTTPS — traffic is unencrypted.');
  }

  if (u.username || u.password) {
    score += 4;
    reasons.push('URL contains embedded credentials (user:pass@host).');
  }

  if (IPV4_HOST_RE.test(u.hostname) || IPV6_HOST_RE.test(u.hostname)) {
    score += 4;
    reasons.push('Host is a raw IP address, not a domain name.');
  }

  if (u.hostname.includes('xn--')) {
    score += 4;
    reasons.push('Host uses punycode (possible homoglyph / IDN attack).');
  }

  const host = u.hostname.toLowerCase();
  const labels = host.split('.');
  const tld = labels[labels.length - 1] || '';
  if (SUSPICIOUS_TLDS.has(tld)) {
    score += 2;
    reasons.push(`Top-level domain ".${tld}" is frequently abused.`);
  }

  if (labels.length > 5) {
    score += 1;
    reasons.push(`Unusually deep subdomain chain (${labels.length} labels).`);
  }

  if (u.port && u.port !== '80' && u.port !== '443') {
    score += 1;
    reasons.push(`Non-standard port :${u.port}.`);
  }

  const reg = _registrable(host);
  if (SHORTENERS.has(reg)) {
    score += 2;
    reasons.push(`URL shortener (${reg}) — real destination is hidden.`);
  }

  for (const brand of BRAND_TARGETS) {
    const contains = host.includes(brand);
    if (!contains) continue;
    const realList = BRAND_REAL_DOMAIN[brand] || [];
    const isReal = realList.some(d => host === d || host.endsWith('.' + d));
    if (!isReal) {
      score += 4;
      reasons.push(`Looks like "${brand}" but the real domain is ${realList[0]}. Possible spoof.`);
      break;
    }
  }

  const pathLower = parsed.path.toLowerCase();
  for (const token of SENSITIVE_PATH_TOKENS) {
    if (pathLower.includes('/' + token) || pathLower.includes(token + '.')) {
      score += 1;
      reasons.push(`Path contains sensitive keyword "${token}".`);
      break;
    }
  }

  if (rawUrl.length > 160) {
    score += 1;
    reasons.push('Very long URL.');
  }

  let verdict;
  if (score >= 6) verdict = 'suspicious';
  else if (score >= 2) verdict = 'caution';
  else verdict = 'safe';

  if (!reasons.length) reasons.push('No known risk signals detected.');

  return { verdict, reasons, parsed };
}
