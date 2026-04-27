/**
 * Polls UI — renders live Twitch channel polls + a persisted history feed.
 *
 * Reads `state.activePolls` (Map<channelId, livePoll>) for the top section
 * and `state.pollHistory` (array, newest first) for the scrollable history
 * below. The history is hydrated from IndexedDB on boot and updated by the
 * app-level handler whenever a poll terminates.
 *
 * Twitch's poll API is unofficial — the renderer treats every field as
 * potentially missing and falls back to safe defaults.
 */
import { state } from '../state.js';
import { esc } from '../utils/dom.js';
import { POLL_END_LINGER_MS } from '../config.js';

let _tickTimer = null;

const TERMINAL_STATUSES = new Set([
  'COMPLETED', 'TERMINATED', 'ARCHIVED', 'MODERATED',
]);

export function initPollUI() {
  // Update countdowns once per second while there's at least one active poll.
  if (_tickTimer) return;
  _tickTimer = setInterval(() => {
    if (state.activePolls && state.activePolls.size > 0) renderPolls();
  }, 1000);
  renderPolls();
}

/** Whether a normalized poll status means the poll has terminated. */
export function isPollTerminal(status) {
  return TERMINAL_STATUSES.has(status);
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

/**
 * Build the persistable summary row for a finished poll. This is the shape
 * stored in IndexedDB and shown in the history feed.
 */
export function summarizePollForHistory(p) {
  const totalVotes = p.totalVotes
    || (p.choices || []).reduce((s, c) => s + (c.votes || 0), 0);
  return {
    id: p.id,
    channelId: p.channelId || '',
    channelLogin: p.channelLogin || '',
    platform: 'twitch',
    title: p.title || '',
    status: p.status || 'COMPLETED',
    startedAt: p.startedAtMs || 0,
    endedAt: p.endedAtMs || Date.now(),
    durationSeconds: p.durationSeconds || 0,
    totalVotes,
    choices: (p.choices || []).map(c => ({
      title: c.title || '',
      votes: c.votes || 0,
      baseVotes: c.baseVotes || 0,
      channelPointVotes: c.channelPointVotes || 0,
      bitsVotes: c.bitsVotes || 0,
    })),
  };
}

function numOrZero(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export function renderPolls() {
  renderActivePolls();
  renderPollHistory();
}

function renderActivePolls() {
  const list = document.getElementById('pollActiveList');
  if (!list) return;

  const polls = state.activePolls;
  if (!polls || polls.size === 0) {
    list.innerHTML = '<div class="poll-empty">No active polls</div>';
    return;
  }

  // Show newest first.
  const entries = Array.from(polls.values()).sort(
    (a, b) => (b.lastUpdate || 0) - (a.lastUpdate || 0)
  );

  list.innerHTML = entries.map(renderActivePollItem).join('');
}

function renderPollHistory() {
  const list = document.getElementById('pollHistoryList');
  if (!list) return;

  const history = state.pollHistory || [];
  if (history.length === 0) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = '<div class="event-history-title">RECENT POLLS</div>' +
    history.map(renderHistoryRow).join('');
}

function renderActivePollItem(p) {
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

function renderHistoryRow(row) {
  const totalVotes = row.totalVotes || 0;
  const choices = row.choices || [];
  const top = choices.reduce((best, c) => (c.votes || 0) > (best.votes || 0) ? c : best, choices[0] || { title: '', votes: 0 });
  const topPct = totalVotes > 0 ? Math.round(((top.votes || 0) / totalVotes) * 100) : 0;
  const winnerLabel = top && top.title
    ? esc(top.title) + ' · ' + topPct + '%'
    : '<span class="event-history-muted">no votes</span>';

  const channelChip = row.channelLogin
    ? '<span class="event-history-channel">' + esc(row.channelLogin.toUpperCase()) + '</span>'
    : '';

  return '<div class="event-history-row">' +
    '<div class="event-history-line1">' +
      channelChip +
      '<span class="event-history-title-text">' + esc(row.title || '(untitled poll)') + '</span>' +
    '</div>' +
    '<div class="event-history-line2">' +
      '<span class="event-history-winner">' + winnerLabel + '</span>' +
      '<span class="event-history-meta">' +
        formatNum(totalVotes) + ' votes · ' + formatTimeAgo(row.endedAt) +
      '</span>' +
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

export function formatTimeAgo(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const diff = Math.max(0, Date.now() - ms);
  const s = Math.floor(diff / 1000);
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  return d + 'd ago';
}

export const POLL_LINGER_MS = POLL_END_LINGER_MS;
