// Main processing loop — dequeues messages, classifies, updates visuals
import { state } from './state.js';
import { MOODS, MOOD_COLORS, QUEUE_CAP } from './config.js';
import { classifyMessage } from './analysis/sentiment.js';
import { detectBot } from './analysis/botDetector.js';
import { computeWeightedMoods, computeKeywordWeights, getDominant } from './analysis/ewma.js';
import { hexAlpha } from './utils/color.js';
import { fmtNum, setStatus } from './utils/dom.js';
import { updateBubbles } from './ui/bubbles.js';
import { updateApprovalMeter } from './ui/approval-meter.js';
import { pushTimelineSnapshot, pushApprovalTimelineSnapshot, pushThroughputTimelineSnapshot } from './ui/charts.js';

// Feed instances — imported lazily to avoid circular deps
let _mainFeed = null;
let _outlierFeed = null;
let _filteredFeed = null;

async function getFeeds() {
  if (!_mainFeed) {
    const mod = await import('./ui/feeds.js');
    _mainFeed = mod.mainFeed;
    _outlierFeed = mod.outlierFeed;
    _filteredFeed = mod.filteredFeed;
  }
  return { mainFeed: _mainFeed, outlierFeed: _outlierFeed, filteredFeed: _filteredFeed };
}

// Eagerly resolve feeds on first import
getFeeds();

export function enqueue(user, msg, ts, platform) {
  if (state.msgQueue.length >= QUEUE_CAP) { state.msgQueue.shift(); state.droppedMessages++; }
  state.msgQueue.push({ user, msg, ts, platform: platform || '' });
}

export function processingLoop() {
  state.rafHandle = requestAnimationFrame(processingLoop);
  state.frameIdx++;
  const now = Date.now();
  const burst = state.msgQueue.length > 500 ? 400 : state.msgQueue.length > 100 ? 200 : 120;
  const n = Math.min(state.msgQueue.length, burst);

  for (let i = 0; i < n; i++) {
    const { user, msg, ts, platform } = state.msgQueue.shift();
    if (state.botFilterEnabled) {
      const { botScore, isBot } = detectBot(user, msg, ts);
      if (isBot) {
        state.botMessagesFiltered++;
        state.botUsersDetected.add(user);
        if (i % 5 === 0 && _mainFeed) {
          _mainFeed.add(user, msg, 'bot', botScore, 0, platform);
          if (_filteredFeed) _filteredFeed.add(user, msg, 'bot', botScore, 0, platform);
        }
        continue;
      }
    }
    const { mood, strength, hits, approvalVote } = classifyMessage(msg);
    state.scoredMessages.push({ ts, mood, strength });
    state.uniqueUsers.add(user);
    state.totalMessages++;
    state.msgTimestamps.push(ts);
    if (approvalVote !== 0) state.approvalStore.push({ ts, vote: approvalVote });
    for (const { label, mood: m, weight } of hits) {
      if (!state.keywordStore.has(label)) state.keywordStore.set(label, []);
      state.keywordStore.get(label).push({ ts, w: weight, mood: m });
    }
    if (i % 5 === 0 && _mainFeed) {
      _mainFeed.add(user, msg, mood, 0, approvalVote, platform);
      if (_filteredFeed) _filteredFeed.add(user, msg, mood, 0, approvalVote, platform);
    }
    // Outlier detection: flag messages whose mood is underrepresented
    if (mood !== 'neutral' && strength >= 1.0 && state.totalMessages > 20) {
      const pct = computeWeightedMoods(ts);
      if (pct && pct[mood] < 15 && _outlierFeed) {
        _outlierFeed.add(user, msg, mood, 0, approvalVote, platform);
      }
    }
  }

  if (state.frameIdx % 8 === 0) updateVisuals();
  if (now - state.lastTimelineTs >= state.TIMELINE_INTERVAL) {
    pushTimelineSnapshot();
    pushApprovalTimelineSnapshot();
    pushThroughputTimelineSnapshot();
    state.lastTimelineTs = now;
  }
}

export function updateVisuals() {
  if (!state.chartsReady) return;
  const now = Date.now();
  const pct = computeWeightedMoods(now);
  const dominant = getDominant(pct);
  const col = MOOD_COLORS[dominant];

  if (pct) {
    state.pieChart.data.datasets[0].data = MOODS.map(m => pct[m]);
    state.pieChart.update('none');
  }

  const kwList = computeKeywordWeights(now);

  // Update radar chart
  if (pct && state.radarChart) {
    const moodsForWeb = MOODS.filter(m => m !== 'neutral');
    const radarData = moodsForWeb.map(m => Math.round(pct[m]));
    state.radarChart.data.datasets[0].data = radarData;
    const radarMax = Math.max(...radarData);
    state.radarChart.options.scales.r.max = Math.max(10, Math.ceil(radarMax * 1.15));
    const rc = MOOD_COLORS[dominant];
    state.radarChart.data.datasets[0].borderColor = rc;
    state.radarChart.data.datasets[0].backgroundColor = hexAlpha(rc, 0.1);
    state.radarChart.data.datasets[0].pointBackgroundColor = rc;
    state.radarChart.update('none');
  }

  updateBubbles(kwList.slice(0, (state.drawerOptions.bubbleCount || 22) + 6).map((k, i) => ({ ...k, count: i + 1 })));

  const domEl = document.getElementById('dominantMood');
  domEl.textContent = dominant.toUpperCase() + ' DOMINANT';
  domEl.style.color = col;
  domEl.style.textShadow = `0 0 26px ${hexAlpha(col, .45)}`;
  domEl.classList.add('visible');

  if (state.prevDominant && state.prevDominant !== dominant) {
    const alertEl = document.getElementById('shiftAlert');
    alertEl.textContent = 'MOOD SHIFT - ' + state.prevDominant.toUpperCase() + ' TO ' + dominant.toUpperCase();
    alertEl.classList.add('show');
    clearTimeout(alertEl._t);
    alertEl._t = setTimeout(() => alertEl.classList.remove('show'), 5000);
    ['pieCard', 'radarCard'].forEach(id => {
      const el = document.getElementById(id);
      el.classList.add('flush');
      clearTimeout(el._ft);
      el._ft = setTimeout(() => el.classList.remove('flush'), 1800);
    });
  }
  state.prevDominant = dominant;

  // Approval meter
  updateApprovalMeter(now);

  // Stats
  const now2 = Date.now();
  document.getElementById('statMessages').textContent = fmtNum(state.totalMessages);
  document.getElementById('statUsers').textContent = fmtNum(state.uniqueUsers.size);
  document.getElementById('statQueue').textContent = state.msgQueue.length;
  document.getElementById('statDropped').textContent = state.droppedMessages;
  document.getElementById('statBotMsgs').textContent = fmtNum(state.botMessagesFiltered);
  document.getElementById('statBotUsers').textContent = fmtNum(state.botUsersDetected.size);
  const cut60 = now2 - 60000;
  while (state.msgTimestamps.length && state.msgTimestamps.peekFirst() < cut60) state.msgTimestamps.shift();
  document.getElementById('statRate').textContent = state.msgTimestamps.length;
  const cut3 = now2 - 3000;
  while (state.tsThroughput.length && state.tsThroughput.peekFirst() < cut3) state.tsThroughput.shift();
  const mps = (state.tsThroughput.length / 3).toFixed(1);
  const bp = Math.min(100, state.tsThroughput.length / 3 / 50 * 100);
  const fill = document.getElementById('tbarFill');
  fill.style.width = bp + '%';
  fill.style.background = bp > 80 ? '#ff4800' : bp > 50 ? '#ffe600' : '#00ffe5';
  document.getElementById('tbarLabel').textContent = mps + ' msg/s';
}

export function flushChatterData() {
  // -- Data stores --
  state.scoredMessages.length = 0;
  state.keywordStore.clear();
  state.approvalStore.length = 0;
  state.msgQueue.clear();
  state.droppedMessages = 0;
  state.totalMessages = 0;
  state.uniqueUsers.clear();
  state.msgTimestamps.clear();
  state.tsThroughput.clear();
  state.prevDominant = null;
  state.frameIdx = 0;

  // -- Bot detection --
  state.userProfiles.clear();
  state.botMessagesFiltered = 0;
  state.botUsersDetected = new Set();

  // -- Approval display --
  state.approvalDisplayVal = 50;
  state.approvalHistory = Array(40).fill(50);

  // -- Bubbles --
  state.bubbles = [];

  // -- Reset timeline timestamp --
  state.lastTimelineTs = 0;

  // -- Pie chart: reset to initial (100% neutral) --
  if (state.pieChart) {
    state.pieChart.data.datasets[0].data = MOODS.map((_, i) => i === MOODS.length - 1 ? 100 : 0);
    state.pieChart.update('none');
  }

  // -- Radar chart: reset to all zeros --
  if (state.radarChart) {
    const moodsForWeb = MOODS.filter(m => m !== 'neutral');
    state.radarChart.data.datasets[0].data = moodsForWeb.map(() => 0);
    state.radarChart.options.scales.r.max = 10;
    state.radarChart.data.datasets[0].borderColor = '#00ffe5';
    state.radarChart.data.datasets[0].backgroundColor = 'rgba(0,255,229,.09)';
    state.radarChart.data.datasets[0].pointBackgroundColor = '#00ffe5';
    state.radarChart.update('none');
  }

  // -- Timeline charts: fill with null --
  [state.timelineLinearChart, state.timelineLogChart].filter(Boolean).forEach(ch => {
    ch.data.labels = Array(state.TIMELINE_POINTS).fill('');
    ch.data.datasets.forEach(ds => { ds.data = Array(state.TIMELINE_POINTS).fill(null); });
    ch.update('none');
  });
  if (state.timelineLinearChart) {
    state.timelineLinearChart.options.scales.y.max = 10;
  }

  // -- Approval timeline: reset --
  if (state.approvalTimelineChart) {
    state.approvalTimelineChart.data.labels = Array(state.TIMELINE_POINTS).fill('');
    state.approvalTimelineChart.data.datasets[0].data = Array(state.TIMELINE_POINTS).fill(null);
    state.approvalTimelineChart.data.datasets[0].borderColor = '#00ffe5';
    state.approvalTimelineChart.data.datasets[0].backgroundColor = 'rgba(0,255,229,.08)';
    state.approvalTimelineChart.update('none');
  }

  // -- Throughput timeline: reset --
  if (state.throughputTimelineChart) {
    state.throughputTimelineChart.data.labels = Array(state.TIMELINE_POINTS).fill('');
    state.throughputTimelineChart.data.datasets[0].data = Array(state.TIMELINE_POINTS).fill(null);
    state.throughputTimelineChart.data.datasets[0].borderColor = '#00ffe5';
    state.throughputTimelineChart.data.datasets[0].backgroundColor = 'rgba(0,255,229,.08)';
    state.throughputTimelineChart.update('none');
  }

  // -- Clear feed lists --
  document.getElementById('feedList').innerHTML = '';
  document.getElementById('outlierFeedList').innerHTML = '';
  document.getElementById('filteredFeedList').innerHTML = '';

  // -- Reset stat displays --
  document.getElementById('statMessages').textContent = '0';
  document.getElementById('statRate').textContent = '0';
  document.getElementById('statQueue').textContent = '0';
  document.getElementById('statUsers').textContent = '0';
  document.getElementById('statDropped').textContent = '0';
  document.getElementById('statBotMsgs').textContent = '0';
  document.getElementById('statBotUsers').textContent = '0';

  // -- Reset dominant mood display --
  const domEl = document.getElementById('dominantMood');
  domEl.textContent = '-';
  domEl.style.color = '';
  domEl.style.textShadow = '';
  domEl.classList.remove('visible');

  // -- Reset approval meter --
  const thumb = document.getElementById('approvalThumb');
  thumb.style.left = '50%';
  thumb.style.background = '#0d0d1f';
  thumb.style.color = '#8888aa';
  thumb.style.borderColor = '#8888aa';
  thumb.style.boxShadow = '';
  document.getElementById('approvalScore').textContent = '+0';
  document.getElementById('approvalScore').style.color = '#8888aa';
  document.getElementById('approvalScore').style.textShadow = '';
  const verdictEl = document.getElementById('approvalVerdict');
  verdictEl.textContent = 'NEUTRAL';
  verdictEl.style.color = '#8888aa';

  // -- Reset approval mini bars --
  const bars = document.getElementById('approvalMini').children;
  for (let i = 0; i < bars.length; i++) {
    bars[i].style.height = '3px';
    bars[i].style.background = '#333355';
  }

  // -- Reset throughput bar --
  const fill = document.getElementById('tbarFill');
  fill.style.width = '0%';
  fill.style.background = '#00ffe5';
  document.getElementById('tbarLabel').textContent = '0.0 msg/s';

  // -- Clear bubble canvas --
  const bubCanvas = document.getElementById('bubbleCanvas');
  const bubCtx = bubCanvas.getContext('2d');
  bubCtx.clearRect(0, 0, bubCanvas.width, bubCanvas.height);

  // -- Flush animation on button --
  const flushBtn = document.getElementById('flushDataBtn');
  if (flushBtn) {
    flushBtn.classList.remove('flushing');
    void flushBtn.offsetWidth; // reflow to restart animation
    flushBtn.classList.add('flushing');
    flushBtn.addEventListener('animationend', () => flushBtn.classList.remove('flushing'), { once: true });
  }

  setStatus('Data flushed.', '');
}
