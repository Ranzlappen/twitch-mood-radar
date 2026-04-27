/**
 * Predictions UI — renders live Twitch channel predictions + a persisted
 * history feed.
 *
 * Mirrors `polls.js`: top section shows the currently-active prediction(s)
 * (one per connected channel), bottom section is a scrollable history of
 * recent resolved / canceled predictions. History rows are hydrated from
 * IndexedDB on boot.
 *
 * Predictions are channel-point bets with two outcomes (BLUE / PINK in
 * Twitch's standard color scheme) and a lifecycle of:
 *   ACTIVE → LOCKED → RESOLVED (winner highlighted)
 *                    or CANCELED (REFUNDED pill)
 *
 * Twitch's prediction API is unofficial — every field is treated as
 * potentially missing.
 */
import { state } from '../state.js';
import { esc } from '../utils/dom.js';
import { POLL_END_LINGER_MS } from '../config.js';
import { formatTimeAgo } from './polls.js';

let _tickTimer = null;

const TERMINAL_STATUSES = new Set([
  'RESOLVED', 'CANCELED', 'CANCEL_PENDING',
]);

export function initPredictionsUI() {
  if (_tickTimer) return;
  _tickTimer = setInterval(() => {
    if (state.activePredictions && state.activePredictions.size > 0) renderPredictions();
  }, 1000);
  renderPredictions();
}

export function isPredictionTerminal(status) {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Normalize a Twitch PubSub prediction payload.
 *
 * Inner shape (defensive): { type, data: { event } } where event has
 * id, channel_id, title, status, created_at, ended_at, locked_at,
 * prediction_window_seconds, outcomes[{id,title,color,total_points,total_users}],
 * winning_outcome_id, ...
 */
export function normalizePredictionFrame(inner) {
  if (!inner || typeof inner !== 'object') return null;
  const data = inner.data;
  const ev = data && (data.event || data.prediction);
  if (!ev || typeof ev !== 'object') return null;

  const outcomes = Array.isArray(ev.outcomes) ? ev.outcomes.map((o, idx) => ({
    id: typeof o.id === 'string' ? o.id : String(idx),
    title: typeof o.title === 'string' ? o.title : '',
    color: typeof o.color === 'string' ? o.color.toUpperCase() : (idx === 0 ? 'BLUE' : 'PINK'),
    totalPoints: numOrZero(o.total_points),
    totalUsers: numOrZero(o.total_users),
  })) : [];

  const totalPoints = outcomes.reduce((s, o) => s + (o.totalPoints || 0), 0);
  const totalUsers = outcomes.reduce((s, o) => s + (o.totalUsers || 0), 0);

  return {
    eventType: typeof inner.type === 'string' ? inner.type : '',
    id: typeof ev.id === 'string' ? ev.id : '',
    channelId: typeof ev.channel_id === 'string' ? ev.channel_id : '',
    title: typeof ev.title === 'string' ? ev.title : '',
    status: typeof ev.status === 'string' ? ev.status : '',
    startedAt: typeof ev.created_at === 'string' ? ev.created_at : '',
    lockedAt: typeof ev.locked_at === 'string' ? ev.locked_at : '',
    endedAt: typeof ev.ended_at === 'string' ? ev.ended_at : '',
    predictionWindowSeconds: numOrZero(ev.prediction_window_seconds),
    winningOutcomeId: typeof ev.winning_outcome_id === 'string' ? ev.winning_outcome_id : '',
    totalPoints,
    totalUsers,
    outcomes,
  };
}

/** Build the persistable summary row for a finished prediction. */
export function summarizePredictionForHistory(p) {
  return {
    id: p.id,
    channelId: p.channelId || '',
    channelLogin: p.channelLogin || '',
    platform: 'twitch',
    title: p.title || '',
    status: p.status || 'RESOLVED',
    startedAt: p.startedAtMs || 0,
    lockedAt: p.lockedAtMs || 0,
    endedAt: p.endedAtMs || Date.now(),
    predictionWindowSeconds: p.predictionWindowSeconds || 0,
    totalChannelPoints: p.totalPoints || 0,
    totalUsers: p.totalUsers || 0,
    winningOutcomeId: p.winningOutcomeId || null,
    outcomes: (p.outcomes || []).map(o => ({
      id: o.id, title: o.title || '', color: o.color || 'BLUE',
      totalPoints: o.totalPoints || 0, totalUsers: o.totalUsers || 0,
    })),
  };
}

function numOrZero(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export function renderPredictions() {
  renderActivePredictions();
  renderPredictionHistory();
}

function renderActivePredictions() {
  const list = document.getElementById('predictionsActiveList');
  if (!list) return;

  const active = state.activePredictions;
  if (!active || active.size === 0) {
    list.innerHTML = '<div class="poll-empty">No active predictions</div>';
    return;
  }

  const entries = Array.from(active.values()).sort(
    (a, b) => (b.lastUpdate || 0) - (a.lastUpdate || 0)
  );
  list.innerHTML = entries.map(renderActivePredictionItem).join('');
}

function renderPredictionHistory() {
  const list = document.getElementById('predictionsHistoryList');
  if (!list) return;

  const history = state.predictionHistory || [];
  if (history.length === 0) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = '<div class="event-history-title">RECENT PREDICTIONS</div>' +
    history.map(renderHistoryRow).join('');
}

function renderActivePredictionItem(p) {
  const totalPoints = p.totalPoints
    || p.outcomes.reduce((s, o) => s + (o.totalPoints || 0), 0);

  const status = p.status || 'ACTIVE';
  const isResolved = status === 'RESOLVED';
  const isCanceled = status === 'CANCELED' || status === 'CANCEL_PENDING';
  const isLocked = status === 'LOCKED';
  const isActive = status === 'ACTIVE' || status === '';

  // Lock countdown when active. After lock, no countdown.
  const lockMs = p.lockedAtMs || (p.startedAtMs && p.predictionWindowSeconds
    ? p.startedAtMs + p.predictionWindowSeconds * 1000
    : 0);
  const remainSec = Math.max(0, Math.floor((lockMs - Date.now()) / 1000));
  let countdown = '';
  if (isActive) countdown = lockMs ? 'locks in ' + formatCountdown(remainSec) : 'open';
  else if (isLocked) countdown = 'awaiting result';
  else if (isResolved) countdown = 'resolved';
  else if (isCanceled) countdown = 'refunded';
  else countdown = status.replace(/_/g, ' ').toLowerCase();

  const outcomesHtml = (p.outcomes || []).map((o, i) => {
    const pct = totalPoints > 0 ? Math.round((o.totalPoints / totalPoints) * 100) : 0;
    const isWinner = isResolved && o.id && o.id === p.winningOutcomeId;
    const colorClass = (o.color === 'PINK') ? 'prediction-outcome-pink' : 'prediction-outcome-blue';
    const cls = ['prediction-outcome', colorClass];
    if (isWinner) cls.push('prediction-outcome-winner');
    if ((isResolved && !isWinner) || isCanceled) cls.push('prediction-outcome-loser');

    return '<div class="' + cls.join(' ') + '">' +
      '<div class="prediction-outcome-row">' +
        '<span class="prediction-outcome-swatch"></span>' +
        '<span class="prediction-outcome-title">' + esc(o.title || ('Outcome ' + (i + 1))) + '</span>' +
        '<span class="prediction-outcome-meta">' +
          '<span class="prediction-outcome-pct">' + pct + '%</span>' +
          '<span class="prediction-outcome-points">' + formatNum(o.totalPoints || 0) + ' CP</span>' +
        '</span>' +
      '</div>' +
      '<div class="prediction-bar"><div class="prediction-bar-fill" style="width:' + pct + '%"></div></div>' +
    '</div>';
  }).join('');

  const channelHeader = p.channelLogin
    ? '<div class="poll-channel">' + esc(p.channelLogin.toUpperCase()) + '</div>'
    : '';

  let statusLabel = 'LIVE';
  let statusClass = 'poll-status-live';
  if (isLocked) { statusLabel = 'LOCKED'; statusClass = 'poll-status-locked'; }
  else if (isResolved) { statusLabel = 'RESOLVED'; statusClass = 'poll-status-resolved'; }
  else if (isCanceled) { statusLabel = 'REFUNDED'; statusClass = 'poll-status-ended'; }

  const dim = (isResolved || isCanceled) ? ' poll-item-ended' : '';

  return '<div class="poll-item prediction-item' + dim + '">' +
    '<div class="poll-header">' +
      channelHeader +
      '<span class="poll-status ' + statusClass + '">' + statusLabel + '</span>' +
    '</div>' +
    '<div class="poll-title">' + esc(p.title || '(untitled prediction)') + '</div>' +
    '<div class="prediction-outcomes">' + outcomesHtml + '</div>' +
    '<div class="poll-footer">' +
      '<span class="poll-total">' + formatNum(totalPoints) + ' CP · ' + formatNum(p.totalUsers || 0) + ' users</span>' +
      '<span class="poll-countdown">' + esc(countdown) + '</span>' +
    '</div>' +
  '</div>';
}

function renderHistoryRow(row) {
  const status = row.status || 'RESOLVED';
  const totalPoints = row.totalChannelPoints || 0;
  const outcomes = row.outcomes || [];

  let resultLabel;
  if (status === 'CANCELED' || status === 'CANCEL_PENDING') {
    resultLabel = '<span class="event-history-muted">REFUNDED</span>';
  } else {
    const winner = outcomes.find(o => o.id && o.id === row.winningOutcomeId)
      || outcomes.reduce((best, c) => (c.totalPoints || 0) > (best.totalPoints || 0) ? c : best, outcomes[0] || { title: '', totalPoints: 0 });
    const winPct = totalPoints > 0 ? Math.round(((winner.totalPoints || 0) / totalPoints) * 100) : 0;
    const colorTag = winner && winner.color === 'PINK'
      ? '<span class="prediction-pink-dot"></span>'
      : '<span class="prediction-blue-dot"></span>';
    resultLabel = winner && winner.title
      ? colorTag + esc(winner.title) + ' · ' + winPct + '%'
      : '<span class="event-history-muted">no winner</span>';
  }

  const channelChip = row.channelLogin
    ? '<span class="event-history-channel">' + esc(row.channelLogin.toUpperCase()) + '</span>'
    : '';

  return '<div class="event-history-row">' +
    '<div class="event-history-line1">' +
      channelChip +
      '<span class="event-history-title-text">' + esc(row.title || '(untitled prediction)') + '</span>' +
    '</div>' +
    '<div class="event-history-line2">' +
      '<span class="event-history-winner">' + resultLabel + '</span>' +
      '<span class="event-history-meta">' +
        formatNum(totalPoints) + ' CP · ' + formatTimeAgo(row.endedAt) +
      '</span>' +
    '</div>' +
  '</div>';
}

function formatCountdown(seconds) {
  if (seconds <= 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return s + 's';
  return m + 'm ' + String(s).padStart(2, '0') + 's';
}

function formatNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return (n / 1000).toFixed(1) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(2) + 'k';
  return String(n | 0);
}

export const PREDICTION_LINGER_MS = POLL_END_LINGER_MS;
