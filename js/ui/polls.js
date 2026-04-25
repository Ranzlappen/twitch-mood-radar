/**
 * Polls UI — renders live Twitch channel polls.
 *
 * Reads from `state.polls` (a Map keyed by channelId) and renders one block
 * per active poll. Ended polls linger briefly so the result is visible, then
 * are removed by the app-level handler.
 *
 * Twitch's poll API is unofficial — the renderer treats every field as
 * potentially missing and falls back to safe defaults.
 */
import { state } from '../state.js';
import { esc } from '../utils/dom.js';
import { POLL_END_LINGER_MS } from '../config.js';

let _tickTimer = null;

export function initPollUI() {
  // Update countdowns once per second while there's at least one active poll.
  if (_tickTimer) return;
  _tickTimer = setInterval(() => {
    if (state.polls && state.polls.size > 0) renderPolls();
  }, 1000);
  renderPolls();
}

/**
 * Normalize a Twitch PubSub poll payload into a stable shape used by the UI.
 *
 * Inner shape (defensive): { type, data: { poll: { ... } } }
 * Returns null if the frame can't be interpreted as a poll.
 */
export function normalizePollFrame(inner) {
  if (!inner || typeof inner !== 'object') return null;
  const data = inner.data;
  const poll = data && data.poll;
  if (!poll || typeof poll !== 'object') return null;

  const choices = Array.isArray(poll.choices) ? poll.choices.map(c => {
    const v = (c && c.votes) || {};
    return {
      title: typeof c.title === 'string' ? c.title : '',
      votes: numOrZero(v.total) || numOrZero(c.total_voters),
      baseVotes: numOrZero(v.base),
      channelPointVotes: numOrZero(v.channel_points),
      bitsVotes: numOrZero(v.bits),
    };
  }) : [];

  return {
    eventType: typeof inner.type === 'string' ? inner.type : '',
    id: typeof poll.poll_id === 'string' ? poll.poll_id : '',
    channelId: typeof poll.owned_by === 'string' ? poll.owned_by : '',
    title: typeof poll.title === 'string' ? poll.title : '',
    status: typeof poll.status === 'string' ? poll.status : '',
    startedAt: typeof poll.started_at === 'string' ? poll.started_at : '',
    endedAt: typeof poll.ended_at === 'string' ? poll.ended_at : '',
    durationSeconds: numOrZero(poll.duration_seconds),
    remainingMs: numOrZero(poll.remaining_duration_milliseconds),
    totalVotes: numOrZero(poll.votes && poll.votes.total),
    choices,
  };
}

function numOrZero(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export function renderPolls() {
  const list = document.getElementById('pollList');
  if (!list) return;

  const polls = state.polls;
  if (!polls || polls.size === 0) {
    list.innerHTML = '<div class="poll-empty">No active polls</div>';
    return;
  }

  // Show newest first.
  const entries = Array.from(polls.values()).sort(
    (a, b) => (b.lastUpdate || 0) - (a.lastUpdate || 0)
  );

  list.innerHTML = entries.map(renderPollItem).join('');
}

function renderPollItem(p) {
  const totalVotes = p.totalVotes
    || p.choices.reduce((s, c) => s + (c.votes || 0), 0);

  const isActive = p.status === 'ACTIVE' || p.status === '';
  const ended = !isActive;

  const remainSec = Math.max(0, Math.floor((p.endsAt - Date.now()) / 1000));
  const countdown = isActive
    ? formatCountdown(remainSec)
    : (p.status ? p.status.replace(/_/g, ' ') : 'ENDED');

  const choicesHtml = (p.choices || []).map((c, i) => {
    const pct = totalVotes > 0 ? Math.round((c.votes / totalVotes) * 100) : 0;
    const cp = c.channelPointVotes || 0;
    const cpBadge = cp > 0
      ? '<span class="poll-cp-badge" title="Channel-point votes">★ ' + formatNum(cp) + '</span>'
      : '';
    return '<div class="poll-choice' + (isActive ? '' : ' poll-choice-ended') + '">' +
      '<div class="poll-choice-row">' +
        '<span class="poll-choice-title">' + esc(c.title || ('Choice ' + (i + 1))) + '</span>' +
        '<span class="poll-choice-meta">' + cpBadge +
          '<span class="poll-choice-pct">' + pct + '%</span>' +
          '<span class="poll-choice-votes">' + formatNum(c.votes || 0) + '</span>' +
        '</span>' +
      '</div>' +
      '<div class="poll-bar"><div class="poll-bar-fill" style="width:' + pct + '%"></div></div>' +
    '</div>';
  }).join('');

  const channelHeader = p.channelLogin
    ? '<div class="poll-channel">' + esc(p.channelLogin.toUpperCase()) + '</div>'
    : '';

  const statusClass = isActive ? 'poll-status-live' : 'poll-status-ended';
  const statusLabel = isActive ? 'LIVE' : 'ENDED';

  return '<div class="poll-item' + (ended ? ' poll-item-ended' : '') + '">' +
    '<div class="poll-header">' +
      channelHeader +
      '<span class="poll-status ' + statusClass + '">' + statusLabel + '</span>' +
    '</div>' +
    '<div class="poll-title">' + esc(p.title || '(untitled poll)') + '</div>' +
    '<div class="poll-choices">' + choicesHtml + '</div>' +
    '<div class="poll-footer">' +
      '<span class="poll-total">' + formatNum(totalVotes) + ' votes</span>' +
      '<span class="poll-countdown">' + esc(countdown) + '</span>' +
    '</div>' +
  '</div>';
}

function formatCountdown(seconds) {
  if (seconds <= 0) return 'ending';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return s + 's';
  return m + 'm ' + String(s).padStart(2, '0') + 's';
}

function formatNum(n) {
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(2) + 'k';
  return String(n | 0);
}

export const POLL_LINGER_MS = POLL_END_LINGER_MS;
