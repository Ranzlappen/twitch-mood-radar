-- twitch-mood-radar — server-side message archive
--
-- Design notes:
-- * (platform, msg_id) is the natural primary key. msg_id is either the
--   platform's native message ID (Twitch IRCv3 `id` tag) or, for platforms
--   that don't expose one, a deterministic content hash computed client-side
--   from (platform | channel | user_login | ts_ms | text). The PK provides
--   cross-client dedup for free: when two viewers ingest the same message,
--   the second INSERT collides and is dropped silently.
-- * No UPDATE / DELETE policy for the anon role — the Edge Function uses the
--   service role key for inserts. Anon clients can only SELECT (chat is
--   already public information; restricting reads buys nothing).
-- * Inserts go through a Cloudflare-Turnstile-gated Edge Function, not
--   straight from the browser, so the BEFORE INSERT validation trigger here
--   is defense-in-depth, not the only line of defense.

create extension if not exists pgcrypto;

create table if not exists public.messages (
  platform     text        not null,
  msg_id       text        not null,
  channel      text        not null,
  user_login   text        not null,
  user_display text,
  user_id      text,
  text         text        not null,
  ts           timestamptz not null,
  badges       jsonb,
  mood         text,
  approval_vote real,
  bot_score    real,
  is_bot       boolean     default false,
  client_id    text,
  ingested_at  timestamptz not null default now(),
  primary key (platform, msg_id)
);

-- Lookup paths used by the planned stats modules + user-history UI.
create index if not exists messages_user_ts_idx
  on public.messages (platform, user_login, ts desc);
create index if not exists messages_channel_ts_idx
  on public.messages (platform, channel, ts desc);
create index if not exists messages_ts_idx
  on public.messages (ts desc);

-- BEFORE INSERT validation. Cheap rejections that defeat casual fuzzing if
-- someone bypasses the Edge Function. Keep the rules conservative — false
-- positives here drop real chat silently.
create or replace function public.messages_validate()
returns trigger
language plpgsql
as $$
begin
  if new.platform not in ('twitch','kick','youtube','rumble') then
    raise exception 'invalid platform: %', new.platform;
  end if;
  if length(new.msg_id) < 8 or length(new.msg_id) > 128 then
    raise exception 'invalid msg_id length';
  end if;
  if length(new.user_login) = 0 or length(new.user_login) > 64 then
    raise exception 'invalid user_login length';
  end if;
  if length(new.channel) = 0 or length(new.channel) > 64 then
    raise exception 'invalid channel length';
  end if;
  if length(new.text) = 0 or length(new.text) > 4000 then
    raise exception 'invalid text length';
  end if;
  -- Reject timestamps more than 5 minutes in the future or older than 90 days.
  -- Real chat ingestion is near-realtime; anything else is suspect.
  if new.ts > now() + interval '5 minutes' then
    raise exception 'ts in future';
  end if;
  if new.ts < now() - interval '90 days' then
    raise exception 'ts too old';
  end if;
  -- Normalise casing on the dedup-relevant columns so two clients sending the
  -- same logical message with different casings can't both land.
  new.user_login := lower(new.user_login);
  new.channel    := lower(new.channel);
  new.platform   := lower(new.platform);
  return new;
end
$$;

drop trigger if exists messages_validate_trg on public.messages;
create trigger messages_validate_trg
  before insert on public.messages
  for each row execute function public.messages_validate();

-- ---------- Row-Level Security ----------
alter table public.messages enable row level security;

-- Anon (browser, anon API key) can read everything.
drop policy if exists messages_anon_select on public.messages;
create policy messages_anon_select
  on public.messages for select
  to anon
  using (true);

-- No anon insert/update/delete: writes only happen via the Edge Function
-- which authenticates with the service role key.

-- ---------- Read-side helpers (used by future stats modules) ----------
-- Recent message count per user/channel — typed RPC so the client doesn't
-- need to embed raw aggregate SQL.
create or replace function public.user_message_count(
  p_platform text,
  p_user_login text,
  p_since timestamptz default now() - interval '30 days'
) returns bigint
language sql
stable
as $$
  select count(*)::bigint
  from public.messages
  where platform = p_platform
    and user_login = lower(p_user_login)
    and ts >= p_since
$$;
