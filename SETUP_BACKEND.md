# Backend setup — Supabase + Cloudflare Turnstile

The PWA works fully local with IndexedDB only. Following this guide adds a
shared server-side archive so future stats modules can query across all
viewers and sessions.

The architecture is intentionally minimal:

```
PWA  ──(batched POST + Turnstile token)──►  Supabase Edge Function (ingest)
                                              │
                                              ▼
                                            public.messages   (Postgres)
                                              ▲
PWA  ──────(read-only, anon SDK key)──────────┘
```

You'll need:
- A Supabase project (free tier is fine).
- A Cloudflare Turnstile site (free).
- The Supabase CLI installed locally (`npm i -g supabase` or `brew install supabase/tap/supabase`).
- ~15 minutes.

---

## 1. Create the Supabase project

1. Go to <https://supabase.com>, sign in, **New project**.
2. Pick the region closest to your users. Strong password.
3. Wait for provisioning (~2 min).
4. Note these from **Project Settings → API**:
   - **Project URL** → `https://YOUR-REF.supabase.co`
   - **anon public** key → put it nowhere yet, it isn't used by the PWA in this design (reads happen via the Supabase JS SDK only when stats modules ship; the ingest path uses no anon key at all).
   - **service_role** key → secret, will live only inside the Edge Function.

## 2. Apply the schema

```bash
git clone <this repo>
cd twitch-mood-radar
supabase link --project-ref YOUR-REF        # one-time
supabase db push                            # applies supabase/migrations/0001_messages.sql
```

This creates `public.messages` with the `(platform, msg_id)` primary key,
the validation trigger, and the RLS policies.

## 3. Create a Cloudflare Turnstile site

1. Go to <https://dash.cloudflare.com/?to=/:account/turnstile>, **Add site**.
2. **Domain**: where the PWA is hosted (e.g. `mood.example.com`). For local
   dev you can also add `127.0.0.1` and `localhost`.
3. **Widget mode**: **Managed** (recommended — invisible for most users,
   challenges only suspicious traffic).
4. After creation, copy:
   - **Site key** (public, goes in `config.runtime.json`)
   - **Secret key** (lives only in the Edge Function env)

## 4. Deploy the ingest Edge Function

```bash
supabase functions deploy ingest --no-verify-jwt
supabase secrets set TURNSTILE_SECRET_KEY=0xYOUR-SECRET
# Optional: lock CORS to your hosted domain. Default '*' is fine while testing.
supabase secrets set ALLOWED_ORIGINS=https://mood.example.com
```

`--no-verify-jwt` is required because the PWA calls this function
unauthenticated; the Turnstile token + the function's own validation are the
auth substitute.

Smoke-test:

```bash
curl -X POST https://YOUR-REF.supabase.co/functions/v1/ingest \
  -H 'content-type: application/json' \
  -d '{"messages":[],"turnstileToken":"x"}'
# Expected: {"error":"empty_batch"}  — confirms the function is reachable.
```

## 5. Wire the PWA

```bash
cp config.runtime.example.json config.runtime.json
# Edit config.runtime.json:
#   supabase.url     → https://YOUR-REF.supabase.co
#   turnstile.siteKey→ your Turnstile site key
```

`config.runtime.json` is gitignored so each deployment can point at its
own backend without committing. Serve it from the same origin as
`index.html`. If the file is missing, the sync loop logs once and exits;
the rest of the app works as before.

Open the PWA, open **OPTIONS** (top-right), expand **Server Sync
(Supabase)**, tick **Push messages to server archive**. Watch the browser
console — you should see Turnstile silently solve and the first batch POST
within a few seconds of any chat activity.

## 6. Verify in the database

```sql
-- In the Supabase SQL editor:
select platform, count(*) from messages group by 1;
select * from messages order by ts desc limit 20;
```

You should see rows with the original Twitch IRC `id` as `msg_id` and
`client_id` matching whatever opaque UUID your browser stored.

## Operational notes

- **Quotas (free tier)**: 500 MB Postgres, 2 GB egress/month, 500k Edge
  Function invocations/month. A typical busy channel produces ~30 MB/day
  of message rows, so you've got several months before hitting storage.
- **Bot abuse**: Turnstile solves invisibly for real visitors but
  challenges automated traffic. Combined with the BEFORE INSERT trigger
  (which rejects malformed rows), the function is hard to spam without
  burning real-CPU for each batch.
- **Cost ceiling**: if you ever exceed the free tier the project just
  pauses; it doesn't auto-bill. Add a billing cap on the Cloudflare side
  too if you're worried about Turnstile invocations.
- **Privacy**: this archive stores chat messages with usernames + display
  names. Twitch chat is already public, but be aware the archive is a
  durable record — add a delete-by-user RPC + UI if you ever ship this
  beyond your own use.
- **Reads**: the current PWA does not read from Supabase. That comes when
  the planned stats modules ship; they'll use the auto-generated REST
  API + the public anon key, gated only by RLS (`select` to `anon` is
  permitted in the migration).

## Disabling

Toggle **Server Sync (Supabase)** off in OPTIONS. The loop stops, IDB
keeps logging, and any rows already marked `synced=1` stay that way.
