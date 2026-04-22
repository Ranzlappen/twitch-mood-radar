// twitch-mood-radar — /functions/v1/ingest
//
// Receives a batch of chat messages from a PWA client, verifies the included
// Cloudflare Turnstile token, and bulk-upserts into public.messages with
// (platform, msg_id) as the conflict key so cross-client duplicates collapse
// into a single row.
//
// Why an Edge Function instead of letting the browser write directly:
//   - Anon SDK keys are public. With RLS-INSERT-anon, anyone can script
//     unlimited fake rows. Turnstile gives us a "you are probably a real
//     browser" attestation that's expensive to forge at scale.
//   - The service role key never leaves this function — the browser never
//     sees it.
//
// Required environment variables (set via `supabase secrets set ...`):
//   SUPABASE_URL              — auto-provided in the Edge runtime
//   SUPABASE_SERVICE_ROLE_KEY — auto-provided in the Edge runtime
//   TURNSTILE_SECRET_KEY      — your Cloudflare Turnstile secret key
//
// Request shape (POST application/json):
//   {
//     turnstileToken: string,           // token from turnstile.render() in PWA
//     clientId: string,                 // stable per-browser uuid (audit only)
//     messages: Array<{
//       platform: 'twitch'|'kick'|'youtube'|'rumble',
//       msg_id: string,                 // native id OR sha256(...) hex prefix
//       channel: string,
//       user_login: string,
//       user_display?: string,
//       user_id?: string,
//       text: string,
//       ts: number,                     // unix ms
//       badges?: unknown,
//       mood?: string,
//       approval_vote?: number,
//       bot_score?: number,
//       is_bot?: boolean
//     }>
//   }
//
// Response:
//   { inserted: number, skipped: number, errors: string[] }
//
// The MAX_BATCH cap below combined with one Turnstile token = one batch
// gives us a natural rate limit: a bot would need to solve a Turnstile
// challenge per ~500 messages, which is the scaling property we want.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_BATCH = 500;
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '*').split(',').map((s) => s.trim());

interface IncomingMessage {
  platform: string;
  msg_id: string;
  channel: string;
  user_login: string;
  user_display?: string;
  user_id?: string;
  text: string;
  ts: number;
  badges?: unknown;
  mood?: string;
  approval_vote?: number;
  bot_score?: number;
  is_bot?: boolean;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    ALLOWED_ORIGINS.includes('*') || (origin && ALLOWED_ORIGINS.includes(origin))
      ? origin || '*'
      : ALLOWED_ORIGINS[0] || '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY not set');
    return false;
  }
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body: form });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data && data.success);
  } catch (err) {
    console.error('turnstile verify failed', err);
    return false;
  }
}

function sanitiseMessage(m: IncomingMessage): Record<string, unknown> | null {
  if (!m || typeof m !== 'object') return null;
  const platform = String(m.platform || '').toLowerCase();
  const msgId = String(m.msg_id || '').trim();
  const channel = String(m.channel || '').toLowerCase().trim();
  const userLogin = String(m.user_login || '').toLowerCase().trim();
  const text = String(m.text || '');
  const tsMs = Number(m.ts);

  if (!['twitch', 'kick', 'youtube', 'rumble'].includes(platform)) return null;
  if (msgId.length < 8 || msgId.length > 128) return null;
  if (!channel || channel.length > 64) return null;
  if (!userLogin || userLogin.length > 64) return null;
  if (!text || text.length > 4000) return null;
  if (!isFinite(tsMs)) return null;

  return {
    platform,
    msg_id: msgId,
    channel,
    user_login: userLogin,
    user_display: m.user_display ? String(m.user_display).slice(0, 64) : null,
    user_id: m.user_id ? String(m.user_id).slice(0, 64) : null,
    text,
    ts: new Date(tsMs).toISOString(),
    badges: m.badges ?? null,
    mood: m.mood ? String(m.mood).slice(0, 32) : null,
    approval_vote: typeof m.approval_vote === 'number' ? m.approval_vote : null,
    bot_score: typeof m.bot_score === 'number' ? m.bot_score : null,
    is_bot: Boolean(m.is_bot),
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, origin);
  }

  let body: { turnstileToken?: string; clientId?: string; messages?: IncomingMessage[] };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, origin);
  }

  const token = String(body.turnstileToken || '');
  const clientId = String(body.clientId || '').slice(0, 64) || null;
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (!token) return jsonResponse({ error: 'missing_turnstile_token' }, 400, origin);
  if (!messages.length) return jsonResponse({ error: 'empty_batch' }, 400, origin);
  if (messages.length > MAX_BATCH) {
    return jsonResponse({ error: 'batch_too_large', max: MAX_BATCH }, 400, origin);
  }

  // Rough proxy for the requester's IP — used as a soft signal in Turnstile.
  const ip =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null;

  const ok = await verifyTurnstile(token, ip);
  if (!ok) return jsonResponse({ error: 'turnstile_failed' }, 403, origin);

  const sanitised: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const m of messages) {
    const s = sanitiseMessage(m);
    if (!s) { skipped++; continue; }
    if (clientId) s.client_id = clientId;
    sanitised.push(s);
  }
  if (!sanitised.length) {
    return jsonResponse({ inserted: 0, skipped, errors: ['no_valid_rows'] }, 200, origin);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // ignoreDuplicates: true → conflicting rows are silently dropped, not raised
  // as errors. The Postgres PK + this flag is the cross-client dedup story.
  const { error, count } = await supabase
    .from('messages')
    .upsert(sanitised, { onConflict: 'platform,msg_id', ignoreDuplicates: true, count: 'exact' });

  if (error) {
    console.error('upsert failed', error);
    return jsonResponse({ error: 'db_error', details: error.message }, 500, origin);
  }

  const inserted = typeof count === 'number' ? count : sanitised.length;
  return jsonResponse(
    { inserted, skipped, deduped: sanitised.length - inserted },
    200,
    origin,
  );
});
