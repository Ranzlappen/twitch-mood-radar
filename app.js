// =============================================================
//  OPTIONS DRAWER — comprehensive customization panel
// =============================================================
const OPTIONS_STORAGE_KEY = 'moodradar_options_v1';
const DEFAULT_OPTIONS = {
  density:'normal', gap:16, cardPad:18, fontScale:1,
  crtOpacity:1, gridOpacity:1,
  showSubtitle:true, showLegend:true, showDividers:true, compactStats:false,
  bubbleCount:22, bubbleSpeed:1, bubbleOpacity:0.28, bubbleHeight:260,
  pieLabels:true, pieAnimation:true, radarAnimation:true, radarGrid:true,
  timelineHeight:320, tlGrid:true, tlSmooth:true,
  approvalMini:true, approvalVerdict:true,
  wakeLockEnabled:false,
  cardVisibility:{}
};
let drawerOptions = { ...DEFAULT_OPTIONS };

// =============================================================
//  WAKE LOCK — prevent screen from dimming/locking
// =============================================================
let wakeLockSentinel = null;

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  if (wakeLockSentinel) return;
  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
    });
  } catch (e) {
    wakeLockSentinel = null;
  }
}

async function releaseWakeLock() {
  if (wakeLockSentinel) {
    await wakeLockSentinel.release();
    wakeLockSentinel = null;
  }
}

function loadOptions() {
  try {
    const saved = JSON.parse(localStorage.getItem(OPTIONS_STORAGE_KEY));
    if (saved) drawerOptions = { ...DEFAULT_OPTIONS, ...saved };
  } catch(e) {}
}
function saveOptions() {
  try { localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(drawerOptions)); } catch(e) {}
}

function toggleOptionsDrawer() {
  const d = document.getElementById('optionsDrawer');
  const o = document.getElementById('optionsOverlay');
  const open = !d.classList.contains('open');
  d.classList.toggle('open', open);
  o.classList.toggle('open', open);
}

// --- Individual live-preview setters ---
function setOptDensity(val) {
  drawerOptions.density = val;
  document.body.classList.remove('preset-dense','preset-loose');
  if (val === 'dense') document.body.classList.add('preset-dense');
  else if (val === 'loose') document.body.classList.add('preset-loose');
  saveOptions();
  setTimeout(() => {
    resizeBubbleCanvas();
    [pieChart,radarChart,approvalTimelineChart,throughputTimelineChart,timelineLinearChart,timelineLogChart]
      .filter(Boolean).forEach(c => c.resize());
  }, 100);
}
function setOptGap(v) {
  drawerOptions.gap = parseInt(v);
  document.documentElement.style.setProperty('--gap', v + 'px');
  document.getElementById('optGapVal').textContent = v + 'px';
  saveOptions();
}
function setOptCardPad(v) {
  drawerOptions.cardPad = parseInt(v);
  document.documentElement.style.setProperty('--card-pad', v + 'px');
  document.getElementById('optCardPadVal').textContent = v + 'px';
  saveOptions();
}
function setOptFontScale(v) {
  drawerOptions.fontScale = parseFloat(v);
  document.documentElement.style.setProperty('--font-scale', v);
  document.getElementById('optFontScaleVal').textContent = parseFloat(v).toFixed(2);
  saveOptions();
}
function setOptCrt(v) {
  drawerOptions.crtOpacity = parseFloat(v);
  document.documentElement.style.setProperty('--crt-opacity', v);
  document.getElementById('optCrtVal').textContent = Math.round(v * 100) + '%';
  saveOptions();
}
function setOptGridBg(v) {
  drawerOptions.gridOpacity = parseFloat(v);
  document.documentElement.style.setProperty('--grid-opacity', v);
  document.getElementById('optGridVal').textContent = Math.round(v * 100) + '%';
  saveOptions();
}
function setOptShowSubtitle(c) {
  drawerOptions.showSubtitle = c;
  document.querySelector('.subtitle').style.display = c ? '' : 'none';
  saveOptions();
}
function setOptShowLegend(c) {
  drawerOptions.showLegend = c;
  document.getElementById('moodLegend').style.display = c ? '' : 'none';
  saveOptions();
}
function setOptShowDividers(c) {
  drawerOptions.showDividers = c;
  document.querySelectorAll('.section-divider').forEach(el => el.style.display = c ? '' : 'none');
  saveOptions();
}
function setOptCompactStats(c) {
  drawerOptions.compactStats = c;
  document.querySelector('.stats-row').classList.toggle('compact', c);
  saveOptions();
}
function setOptBubbleCount(v) {
  drawerOptions.bubbleCount = parseInt(v);
  document.getElementById('optBubbleCountVal').textContent = v;
  saveOptions();
}
function setOptBubbleSpeed(v) {
  drawerOptions.bubbleSpeed = parseFloat(v);
  document.getElementById('optBubbleSpeedVal').textContent = parseFloat(v).toFixed(1) + 'x';
  saveOptions();
}
function setOptBubbleOpacity(v) {
  drawerOptions.bubbleOpacity = parseFloat(v);
  document.getElementById('optBubbleOpacityVal').textContent = Math.round(v * 100) + '%';
  saveOptions();
}
function setOptBubbleHeight(v) {
  drawerOptions.bubbleHeight = parseInt(v);
  document.documentElement.style.setProperty('--bubble-height', v + 'px');
  document.getElementById('optBubbleHeightVal').textContent = v + 'px';
  saveOptions();
  setTimeout(resizeBubbleCanvas, 50);
}
function setOptPieLabels(c) {
  drawerOptions.pieLabels = c;
  if (pieChart) pieChart.update('none');
  saveOptions();
}
function setOptPieAnimation(c) {
  drawerOptions.pieAnimation = c;
  if (pieChart) pieChart.options.animation.duration = c ? 350 : 0;
  saveOptions();
}
function setOptRadarAnimation(c) {
  drawerOptions.radarAnimation = c;
  if (radarChart) radarChart.options.animation.duration = c ? 400 : 0;
  saveOptions();
}
function setOptRadarGrid(c) {
  drawerOptions.radarGrid = c;
  if (radarChart) {
    radarChart.options.scales.r.grid.display = c;
    radarChart.options.scales.r.angleLines.display = c;
    radarChart.update('none');
  }
  saveOptions();
}
function setOptTimelineHeight(v) {
  drawerOptions.timelineHeight = parseInt(v);
  document.documentElement.style.setProperty('--timeline-height', v + 'px');
  document.getElementById('optTimelineHeightVal').textContent = v + 'px';
  saveOptions();
  [approvalTimelineChart,throughputTimelineChart,timelineLinearChart,timelineLogChart]
    .filter(Boolean).forEach(c => c.resize());
}
function setOptTlGrid(c) {
  drawerOptions.tlGrid = c;
  [timelineLinearChart,timelineLogChart,approvalTimelineChart,throughputTimelineChart].filter(Boolean).forEach(ch => {
    ch.options.scales.x.grid.display = c;
    ch.options.scales.y.grid.display = c;
    ch.update('none');
  });
  saveOptions();
}
function setOptTlSmooth(c) {
  drawerOptions.tlSmooth = c;
  const t = c ? 0.45 : 0;
  [timelineLinearChart,timelineLogChart,approvalTimelineChart,throughputTimelineChart].filter(Boolean).forEach(ch => {
    for (const ds of ch.data.datasets) ds.tension = t;
    ch.update('none');
  });
  saveOptions();
}
function setOptApprovalMini(c) {
  drawerOptions.approvalMini = c;
  document.getElementById('approvalMini').style.display = c ? '' : 'none';
  saveOptions();
}
function setOptApprovalVerdict(c) {
  drawerOptions.approvalVerdict = c;
  document.getElementById('approvalVerdict').style.display = c ? '' : 'none';
  saveOptions();
}
function setOptWakeLock(c) {
  drawerOptions.wakeLockEnabled = c;
  if (c) requestWakeLock();
  else releaseWakeLock();
  saveOptions();
}
function setOptCardVisibility(id, vis) {
  if (!drawerOptions.cardVisibility) drawerOptions.cardVisibility = {};
  drawerOptions.cardVisibility[id] = vis;
  const el = document.getElementById(id);
  if (el) el.style.display = vis ? '' : 'none';
  saveOptions();
  if (vis) setTimeout(() => notifyChartResize(id), 50);
}
function resetAllOptions() {
  drawerOptions = { ...DEFAULT_OPTIONS };
  saveOptions();
  applyAllOptions();
}

function applyAllOptions() {
  const o = drawerOptions;
  // Density
  document.body.classList.remove('preset-dense','preset-loose');
  if (o.density === 'dense') document.body.classList.add('preset-dense');
  else if (o.density === 'loose') document.body.classList.add('preset-loose');
  const densityEl = document.getElementById('optDensity');
  if (densityEl) densityEl.value = o.density;
  // CSS variables
  const root = document.documentElement.style;
  root.setProperty('--gap', o.gap + 'px');
  root.setProperty('--card-pad', o.cardPad + 'px');
  root.setProperty('--font-scale', o.fontScale);
  root.setProperty('--crt-opacity', o.crtOpacity);
  root.setProperty('--grid-opacity', o.gridOpacity);
  root.setProperty('--timeline-height', o.timelineHeight + 'px');
  root.setProperty('--bubble-height', o.bubbleHeight + 'px');
  // Slider values
  const sync = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  const text = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  sync('optGap', o.gap); text('optGapVal', o.gap + 'px');
  sync('optCardPad', o.cardPad); text('optCardPadVal', o.cardPad + 'px');
  sync('optFontScale', o.fontScale); text('optFontScaleVal', o.fontScale.toFixed(2));
  sync('optCrt', o.crtOpacity); text('optCrtVal', Math.round(o.crtOpacity * 100) + '%');
  sync('optGrid', o.gridOpacity); text('optGridVal', Math.round(o.gridOpacity * 100) + '%');
  // Toggles
  const chk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
  chk('optShowSubtitle', o.showSubtitle);
  document.querySelector('.subtitle').style.display = o.showSubtitle ? '' : 'none';
  chk('optShowLegend', o.showLegend);
  const legendEl = document.getElementById('moodLegend');
  if (legendEl) legendEl.style.display = o.showLegend ? '' : 'none';
  chk('optShowDividers', o.showDividers);
  document.querySelectorAll('.section-divider').forEach(el => el.style.display = o.showDividers ? '' : 'none');
  chk('optCompactStats', o.compactStats);
  const statsEl = document.querySelector('.stats-row');
  if (statsEl) statsEl.classList.toggle('compact', o.compactStats);
  // Bubbles
  sync('optBubbleCount', o.bubbleCount); text('optBubbleCountVal', o.bubbleCount);
  sync('optBubbleSpeed', o.bubbleSpeed); text('optBubbleSpeedVal', o.bubbleSpeed.toFixed(1) + 'x');
  sync('optBubbleOpacity', o.bubbleOpacity); text('optBubbleOpacityVal', Math.round(o.bubbleOpacity * 100) + '%');
  sync('optBubbleHeight', o.bubbleHeight); text('optBubbleHeightVal', o.bubbleHeight + 'px');
  // Charts
  chk('optPieLabels', o.pieLabels);
  chk('optPieAnimation', o.pieAnimation);
  chk('optRadarAnimation', o.radarAnimation);
  chk('optRadarGrid', o.radarGrid);
  // Timelines
  sync('optTimelineHeight', o.timelineHeight); text('optTimelineHeightVal', o.timelineHeight + 'px');
  chk('optTlGrid', o.tlGrid);
  chk('optTlSmooth', o.tlSmooth);
  // Approval
  chk('optApprovalMini', o.approvalMini);
  const miniEl = document.getElementById('approvalMini');
  if (miniEl) miniEl.style.display = o.approvalMini ? '' : 'none';
  chk('optApprovalVerdict', o.approvalVerdict);
  const verdEl = document.getElementById('approvalVerdict');
  if (verdEl) verdEl.style.display = o.approvalVerdict ? '' : 'none';
  // Wake lock
  chk('optWakeLock', o.wakeLockEnabled);
  // Card visibility
  const visMap = {
    pieCard:'optShowPie', radarCard:'optShowRadar', bubbleCard:'optShowBubble',
    approvalCard:'optShowApproval', approvalTimelineCard:'optShowApprovalTL',
    throughputTimelineCard:'optShowThroughputTL', timelineLinearCard:'optShowLinearTL',
    timelineLogCard:'optShowLogTL', feedCard:'optShowFeed',
    filteredFeedCard:'optShowFilteredFeed', outlierCard:'optShowOutlier'
  };
  for (const [cid, cbid] of Object.entries(visMap)) {
    const vis = o.cardVisibility[cid] !== false;
    chk(cbid, vis);
    const cel = document.getElementById(cid);
    if (cel) cel.style.display = vis ? '' : 'none';
  }
  // Apply to charts if ready
  if (chartsReady) {
    if (pieChart) pieChart.options.animation.duration = o.pieAnimation ? 350 : 0;
    if (radarChart) {
      radarChart.options.animation.duration = o.radarAnimation ? 400 : 0;
      radarChart.options.scales.r.grid.display = o.radarGrid;
      radarChart.options.scales.r.angleLines.display = o.radarGrid;
      radarChart.update('none');
    }
    [timelineLinearChart,timelineLogChart,approvalTimelineChart,throughputTimelineChart].filter(Boolean).forEach(ch => {
      ch.options.scales.x.grid.display = o.tlGrid;
      ch.options.scales.y.grid.display = o.tlGrid;
      for (const ds of ch.data.datasets) ds.tension = o.tlSmooth ? 0.45 : 0;
      ch.update('none');
    });
  }
  // Resize after all changes
  setTimeout(() => {
    resizeBubbleCanvas();
    [pieChart,radarChart,approvalTimelineChart,throughputTimelineChart,timelineLinearChart,timelineLogChart]
      .filter(Boolean).forEach(c => c.resize());
  }, 100);
}

// =============================================================
//  SETTINGS — preset and settings dropdown
// =============================================================
const PRESET_STORAGE_KEY = 'moodradar_preset_v1';
let currentPreset = (() => {
  try { return localStorage.getItem(PRESET_STORAGE_KEY) || 'dashboard'; }
  catch(e) { return 'dashboard'; }
})();

function savePreset(preset) {
  try { localStorage.setItem(PRESET_STORAGE_KEY, preset); } catch(e) {}
}

function toggleSettings() {
  document.getElementById('settingsDropdown').classList.toggle('open');
}

function applyPreset(preset) {
  currentPreset = preset;
  savePreset(preset);
  document.body.classList.remove('preset-list','preset-dense','preset-loose');
  if (preset === 'list') {
    document.body.classList.add('preset-list');
  } else if (preset === 'dense') {
    document.body.classList.add('preset-dense');
    // Also sync drawer density option
    drawerOptions.density = 'dense';
    const densityEl = document.getElementById('optDensity');
    if (densityEl) densityEl.value = 'dense';
    saveOptions();
  }
  // Update active state on buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === preset);
  });
  document.getElementById('settingsDropdown').classList.remove('open');

  // Resize bubble canvas after layout reflows
  setTimeout(resizeBubbleCanvas, 50);
  // Resize charts
  if (pieChart)              pieChart.resize();
  if (radarChart) { radarChart.resize(); radarChart.update('none'); }
  if (approvalTimelineChart) approvalTimelineChart.resize();
  if (throughputTimelineChart) throughputTimelineChart.resize();
  if (timelineLinearChart)   timelineLinearChart.resize();
  if (timelineLogChart)      timelineLogChart.resize();
}

// Close settings dropdown when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.settings-wrap')) {
    document.getElementById('settingsDropdown').classList.remove('open');
  }
});

// =============================================================
//  HELP MODAL CONTENT
// =============================================================
const HELP_CONTENT = {
  decay: {
    title: 'DECAY HALF-LIFE',
    body: `<p>The decay slider controls how quickly old messages lose their influence on the charts.</p>
<ul>
  <li><strong>Low (1-5s)</strong> - Only the last few seconds matter. Charts react instantly to spikes but are volatile.</li>
  <li><strong>Medium (20-30s)</strong> - Balanced view. Recent messages dominate but older context lingers.</li>
  <li><strong>High (60s)</strong> - Smooth, slow-moving charts that show broader trends over the full window.</li>
</ul>
<p>Technically this is the EWMA (exponential weighted moving average) half-life: a message this many seconds old has half the weight of a brand-new message.</p>`
  },
  mood: {
    title: 'MOOD DISTRIBUTION',
    body: `<p>Every chat message is classified into one of twelve moods using a keyword and emote dictionary:</p>
<ul>
  <li><strong>Hype</strong> - Excitement, celebration (PogChamp, LES GO, BANGER, GOAT)</li>
  <li><strong>Funny</strong> - Laughter and sarcasm (KEKW, OMEGALUL, LUL, Kappa)</li>
  <li><strong>Love</strong> - Affection and positivity (PogHeart, ILY, beautiful)</li>
  <li><strong>Toxic</strong> - Negativity and trolling (COPE, ratio, trash, MALDING)</li>
  <li><strong>Sad</strong> - Sadness and disappointment (Sadge, RIP, PepeHands, oof)</li>
  <li><strong>Calm</strong> - Relaxed, chill vibes (comfy, cozy, zen, good vibes)</li>
  <li><strong>Angry</strong> - Outright anger and fury (rage, WTF, STFU, triggered)</li>
  <li><strong>Excited</strong> - High energy enthusiasm (OMG, WOOO, pumped, epic)</li>
  <li><strong>Cringe</strong> - Awkward and uncomfortable (yikes, WeirdChamp, haHAA, sus)</li>
  <li><strong>Wholesome</strong> - Warm and heartfelt (blessed, adorable, precious, pure)</li>
  <li><strong>Confused</strong> - Baffled and lost (HUH, ???, Pepega, hold up)</li>
  <li><strong>Neutral</strong> - No strong signal detected</li>
</ul>
<p>Message length affects scoring. Longer messages with clear sentiment get higher weight. Very short messages contribute less.</p>`
  },
  radar: {
    title: 'INTERACTIVE MOOD WEB',
    body: `<p>The mood web visualizes all active moods as interconnected nodes.</p>
<ul>
  <li><strong>Nodes</strong> — Each node is a mood currently active in chat. Node size reflects its weighted percentage.</li>
  <li><strong>Connections</strong> — Lines connect moods that co-occur frequently. Thicker lines mean stronger co-occurrence.</li>
  <li><strong>Hover</strong> — Hover over a node to highlight it and its connections. Shows exact percentage.</li>
  <li><strong>Click</strong> — Click a node to pin-highlight it. Click again or click elsewhere to unpin.</li>
  <li><strong>Colors</strong> — Each node uses the mood's signature color from the legend.</li>
</ul>`
  },
  bubbles: {
    title: 'CONSENSUS BUBBLES',
    body: `<p>Each bubble represents a keyword or phrase appearing in chat.</p>
<ul>
  <li><strong>Size</strong> - Proportional to how frequently the term has appeared (time-weighted)</li>
  <li><strong>Color</strong> - Matches the mood of that keyword</li>
  <li><strong>Position</strong> - Bubbles gravitate toward center but repel each other to avoid overlap</li>
</ul>
<p>Hover over any bubble to see the exact term and its mood.</p>`
  },
  approval: {
    title: 'APPROVAL METER',
    body: `<p>Independently tracks whether chat is agreeing or pushing back, separate from overall mood.</p>
<p>Approval signals: facts, based, exactly, so true, preach, frfr, no cap, W take</p>
<p>Dissent signals: ratio, cap, wrong, nah, cope, bad take, L take, disagree</p>
<p>The slider position and score (+/-50) reflect the weighted balance right now.</p>`
  },
  feed: {
    title: 'LIVE FEED',
    body: `<p>Shows incoming messages in real time (1 in 5 shown to avoid DOM overload on fast chats).</p>
<ul>
  <li><strong>Mood tag</strong> - The detected emotional category of the message</li>
  <li><strong>Approval bar</strong> - Small colored bar: cyan = approving, orange = dissenting</li>
  <li><strong>BOT tag</strong> - Messages flagged as likely automated are shown dimmed and excluded from all scoring</li>
</ul>`
  },
  filteredFeed: {
    title: 'FILTERED FEED',
    body: `<p>A secondary live feed that shows only messages matching your regex filter in real time. The filter applies to each new incoming message as it arrives. Formatting is identical to the main Live Feed.</p>
<p><strong>Regex Examples:</strong></p>
<ul>
  <li><code>\\?</code> — Messages containing a question mark (default filter)</li>
  <li><code>^!</code> — Messages starting with !commands (e.g. !play, !song)</li>
  <li><code>(lol|lmao|rofl)</code> — Messages containing any of these words</li>
  <li><code>\\bgg\\b</code> — Match "gg" as a whole word (won't match "eggs")</li>
  <li><code>^[A-Z\\s]+$</code> — ALL CAPS messages only</li>
  <li><code>hype|pog</code> — Messages mentioning hype or pog</li>
  <li><code>^\\w{1,5}$</code> — Very short messages (1-5 characters)</li>
  <li><code>@\\w+</code> — Messages that @ mention someone</li>
</ul>
<p><strong>Tips:</strong> The regex is case-insensitive by default. Use <code>\\b</code> for word boundaries. Wrap alternations in <code>( )</code> groups. Backslash special characters like <code>? . * +</code> to match them literally.</p>`
  },
  outlier: {
    title: 'STANDOUT MESSAGES',
    body: `<p>Shows messages that deviate significantly from the current chat mood — the outliers.</p>
<ul>
  <li><strong>How it works</strong> - A message is flagged as a standout when its detected mood currently represents less than 15% of the weighted mood distribution and the message has meaningful sentiment strength.</li>
  <li><strong>Why it matters</strong> - These messages go against the grain of chat. They can reveal emerging mood shifts, contrarian opinions, or notable reactions before they become mainstream.</li>
  <li><strong>Formatting</strong> - Identical to the Live Feed. Mood tag and approval bar are shown for each standout message.</li>
</ul>`
  },
  chatAuth: {
    title: 'CHAT INPUT — HOW TO GET YOUR TOKEN',
    body: `<p>To send messages you need a Twitch <strong>OAuth token</strong> with chat permissions. Here's how to get one:</p>
<h4 style="margin:12px 0 6px;color:var(--accent)">OPTION A — Twitch Token Generator (easiest)</h4>
<ol>
  <li>Go to <a href="https://twitchtokengenerator.com" target="_blank" rel="noopener" style="color:var(--accent)">twitchtokengenerator.com</a></li>
  <li>Click <strong>"Custom Scope Token"</strong></li>
  <li>Under <em>Chat</em> scopes, enable <strong>user:write:chat</strong> (and optionally <strong>chat:edit</strong>)</li>
  <li>Click <strong>"Generate Token"</strong> and authorize with your Twitch account</li>
  <li>Copy the <strong>Access Token</strong> and paste it into the token field here</li>
</ol>
<h4 style="margin:12px 0 6px;color:var(--accent)">OPTION B — Twitch Developer Console (advanced)</h4>
<ol>
  <li>Go to <a href="https://dev.twitch.tv/console/apps" target="_blank" rel="noopener" style="color:var(--accent)">dev.twitch.tv/console/apps</a> and log in</li>
  <li>Click <strong>"Register Your Application"</strong></li>
  <li>Set Name to anything (e.g. "My Chat Token"), set OAuth Redirect URL to <code>https://localhost</code>, set Category to <em>Chat Bot</em></li>
  <li>Copy your <strong>Client ID</strong> from the app page</li>
  <li>Open this URL in your browser (replace YOUR_CLIENT_ID):<br>
    <code style="font-size:.85em;word-break:break-all">https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=YOUR_CLIENT_ID&redirect_uri=https://localhost&scope=user:write:chat+chat:edit</code></li>
  <li>Authorize with your Twitch account — you'll be redirected to localhost with the token in the URL fragment:<br>
    <code>https://localhost/#access_token=abc123def456&...</code></li>
  <li>Copy the <strong>access_token</strong> value and paste it here</li>
</ol>
<h4 style="margin:12px 0 6px;color:#ff4800">SECURITY NOTES</h4>
<ul>
  <li>Your token is stored <strong>locally in your browser</strong> (localStorage) — it is never sent to any server other than Twitch.</li>
  <li>Treat your token like a password. Never share it publicly.</li>
  <li>Tokens expire — if sending fails, generate a new one.</li>
  <li>You can revoke tokens at <a href="https://www.twitch.tv/settings/connections" target="_blank" rel="noopener" style="color:var(--accent)">twitch.tv/settings/connections</a></li>
</ul>`
  }
};

function showHelp(key) {
  const h = HELP_CONTENT[key];
  if (!h) return;
  document.getElementById('helpTitle').textContent = h.title;
  document.getElementById('helpBody').innerHTML = h.body;
  document.getElementById('helpOverlay').classList.add('open');
}
function closeHelp() { document.getElementById('helpOverlay').classList.remove('open'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeHelp(); document.getElementById('settingsDropdown').classList.remove('open'); document.getElementById('optionsDrawer').classList.remove('open'); document.getElementById('optionsOverlay').classList.remove('open'); } });

// =============================================================
//  SANITIZATION
// =============================================================
function sanitize(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/[\uFFFD\u200B\u200C\u200D\uFEFF]/g, '').replace(/\s{2,}/g, ' ').trim();
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// =============================================================
//  EMOTE RENDERING — lightweight text-to-emoji mapping
// =============================================================
const EMOTE_MAP = new Map([
  // Twitch-style emotes → Unicode
  ['PogChamp','😲'],['Kappa','😏'],['KEKW','🤣'],['OMEGALUL','😂'],['LUL','😆'],
  ['4Head','😄'],['Kreygasm','😫'],['BibleThump','😢'],['ResidentSleeper','😴'],
  ['PepeHands','😭'],['Sadge','😞'],['monkaS','😰'],['monkaW','😨'],['COPIUM','🤡'],
  ['Pog','😮'],['PogO','😳'],['catJAM','🐱'],['ratJAM','🐀'],['PepeJAM','🎵'],
  ['GIGACHAD','🗿'],['5Head','🧠'],['WeirdChamp','😬'],['haHAA','😬'],['Pepega','🤪'],
  ['PauseChamp','😮'],['SadChamp','😔'],['FeelsBad','😟'],['PepeSad','😿'],
  ['PeepoCry','😭'],['PogHeart','💖'],['Prayge','🙏'],['monkaMad','😡'],
  ['PepeRage','🤬'],['MonkaMad','😤'],
  // Common text emotes
  [':)','🙂'],[':D','😄'],[';)','😉'],[':P','😛'],[':(','😞'],[':O','😮'],
  ['<3','❤️'],['xD','😂'],['XD','😂'],[':3','😺'],['D:','😧'],
  ['B)','😎'],['>:(',  '😠'],[':/','😕'],[':*','😘'],
  // Common emoji shortcodes
  [':fire:','🔥'],[':heart:','❤️'],[':skull:','💀'],[':clown:','🤡'],
  [':crown:','👑'],[':eyes:','👀'],[':pray:','🙏'],[':100:','💯'],
  [':cap:','🧢'],[':goat:','🐐'],[':W:','🔥'],[':L:','💀'],
  [':clap:','👏'],[':thumbsup:','👍'],[':thumbsdown:','👎'],
]);
const EMOTE_REGEX = new RegExp(
  [...EMOTE_MAP.keys()].map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|'),
  'g'
);

function renderEmotes(escapedHtml) {
  // Pass 1: replace hardcoded text emotes with Unicode emoji (fallback)
  let html = escapedHtml.replace(EMOTE_REGEX, match => {
    const emoji = EMOTE_MAP.get(match);
    return emoji ? `<span title="${match}">${emoji}</span>` : match;
  });
  // Pass 2: replace third-party emote codes with actual emote images
  if (thirdPartyEmotes.size > 0) {
    html = html.replace(/(?:^|\s)(\S+)(?=\s|$)/g, (full, word) => {
      const emote = thirdPartyEmotes.get(word);
      if (!emote) return full;
      const img = `<img class="chat-emote" src="${emote.url}" alt="${word}" title="${word} (${emote.source})" loading="lazy">`;
      return full.replace(word, img);
    });
  }
  return html;
}

// =============================================================
//  THIRD-PARTY EMOTES — BTTV, 7TV, FrankerFaceZ
// =============================================================
// Primary room/channel — points to the first connected Twitch slot (for chat input compat)
let currentRoomId = null;
let currentChannelName = '';
// Global merged emote maps (union of all connected slots)
const bttvEmotes = new Map();
const seventvEmotes = new Map();
const ffzEmotes = new Map();
const thirdPartyEmotes = new Map(); // merged: code → { url, source, id }

async function fetchBTTVEmotes(roomId, targetMap) {
  targetMap.clear();
  try {
    const [globalRes, channelRes] = await Promise.all([
      fetch('https://api.betterttv.net/3/cached/emotes/global'),
      fetch('https://api.betterttv.net/3/cached/users/twitch/' + roomId)
    ]);
    if (globalRes.ok) {
      const global = await globalRes.json();
      for (const e of global) {
        targetMap.set(e.code, { url: 'https://cdn.betterttv.net/emote/' + e.id + '/1x', id: e.id, source: 'bttv' });
      }
    }
    if (channelRes.ok) {
      const data = await channelRes.json();
      const channelEmotes = (data.channelEmotes || []).concat(data.sharedEmotes || []);
      for (const e of channelEmotes) {
        targetMap.set(e.code, { url: 'https://cdn.betterttv.net/emote/' + e.id + '/1x', id: e.id, source: 'bttv' });
      }
    }
  } catch(e) { /* silently fail — emotes are optional */ }
}

async function fetch7TVEmotes(roomId, targetMap) {
  targetMap.clear();
  try {
    const [globalRes, channelRes] = await Promise.all([
      fetch('https://7tv.io/v3/emote-sets/global'),
      fetch('https://7tv.io/v3/users/twitch/' + roomId)
    ]);
    if (globalRes.ok) {
      const data = await globalRes.json();
      const emotes = data.emotes || [];
      for (const e of emotes) {
        const fileHost = e.data && e.data.host;
        if (!fileHost) continue;
        const baseUrl = 'https:' + fileHost.url;
        const file = (fileHost.files || []).find(f => f.name === '1x.webp') || (fileHost.files || [])[0];
        if (!file) continue;
        targetMap.set(e.name, { url: baseUrl + '/' + file.name, id: e.id, source: '7tv' });
      }
    }
    if (channelRes.ok) {
      const user = await channelRes.json();
      const emoteSet = user.emote_set;
      if (emoteSet && emoteSet.emotes) {
        for (const e of emoteSet.emotes) {
          const fileHost = e.data && e.data.host;
          if (!fileHost) continue;
          const baseUrl = 'https:' + fileHost.url;
          const file = (fileHost.files || []).find(f => f.name === '1x.webp') || (fileHost.files || [])[0];
          if (!file) continue;
          targetMap.set(e.name, { url: baseUrl + '/' + file.name, id: e.id, source: '7tv' });
        }
      }
    }
  } catch(e) { /* silently fail */ }
}

async function fetchFFZEmotes(channelName, targetMap) {
  targetMap.clear();
  try {
    const [globalRes, channelRes] = await Promise.all([
      fetch('https://api.frankerfacez.com/v1/set/global'),
      fetch('https://api.frankerfacez.com/v1/room/' + channelName)
    ]);
    function extractFFZ(data) {
      const sets = data.sets || {};
      for (const setId of Object.keys(sets)) {
        const emotes = sets[setId].emoticons || [];
        for (const e of emotes) {
          const url = e.urls && (e.urls['1'] || e.urls['2'] || e.urls['4']);
          if (!url) continue;
          const fullUrl = url.startsWith('//') ? 'https:' + url : url;
          targetMap.set(e.name, { url: fullUrl, id: e.id, source: 'ffz' });
        }
      }
    }
    if (globalRes.ok) extractFFZ(await globalRes.json());
    if (channelRes.ok) extractFFZ(await channelRes.json());
  } catch(e) { /* silently fail */ }
}

async function loadSlotEmotes(conn) {
  await Promise.all([
    fetchBTTVEmotes(conn.currentRoomId, conn.bttvEmotes),
    fetch7TVEmotes(conn.currentRoomId, conn.seventvEmotes),
    fetchFFZEmotes(conn.channelName, conn.ffzEmotes)
  ]);
  mergeAllEmotes();
}

function mergeAllEmotes() {
  bttvEmotes.clear(); seventvEmotes.clear(); ffzEmotes.clear(); thirdPartyEmotes.clear();
  for (const conn of connections) {
    if (!conn.loggingActive) continue;
    for (const [k, v] of conn.ffzEmotes) { ffzEmotes.set(k, v); thirdPartyEmotes.set(k, v); }
    for (const [k, v] of conn.seventvEmotes) { seventvEmotes.set(k, v); thirdPartyEmotes.set(k, v); }
    for (const [k, v] of conn.bttvEmotes) { bttvEmotes.set(k, v); thirdPartyEmotes.set(k, v); }
  }
  console.log('[MoodRadar] Merged emotes from ' + connections.filter(c=>c.loggingActive).length + ' feeds — ' + thirdPartyEmotes.size + ' total');
}

// =============================================================
//  CHAT INPUT — OAuth, send messages, emote picker
// =============================================================
const OAUTH_STORAGE_KEY = 'moodradar_oauth_v1';
let twitchOAuthToken = '';
let twitchClientId = '';
let twitchUserId = '';
let twitchUserLogin = '';
let emotePickerOpen = false;
let emotePickerTab = 'bttv';

// Restore saved token on load
(function restoreOAuth() {
  const saved = localStorage.getItem(OAUTH_STORAGE_KEY);
  if (saved) {
    twitchOAuthToken = saved;
    validateToken(saved).then(ok => {
      if (ok) updateAuthStatus(twitchUserLogin);
    });
  }
})();

async function validateToken(token) {
  try {
    const clean = token.replace(/^oauth:/i, '');
    const res = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { 'Authorization': 'OAuth ' + clean }
    });
    if (!res.ok) return false;
    const data = await res.json();
    twitchClientId = data.client_id || '';
    twitchUserId = data.user_id || '';
    twitchUserLogin = data.login || '';
    twitchOAuthToken = clean;
    return true;
  } catch(e) { return false; }
}

function updateAuthStatus(login) {
  const el = document.getElementById('chatAuthStatus');
  if (!el) return;
  const copyBtn = document.getElementById('copyErrorBtn');
  if (copyBtn) copyBtn.style.display = 'none';
  if (login) {
    el.textContent = login;
    el.style.color = 'var(--accent)';
  } else {
    el.textContent = 'not connected';
    el.style.color = 'var(--muted)';
  }
}

function copyAuthError() {
  const el = document.getElementById('chatAuthStatus');
  if (!el || !el.textContent) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    const btn = document.getElementById('copyErrorBtn');
    if (btn) { btn.textContent = 'COPIED'; setTimeout(() => btn.textContent = 'COPY', 1500); }
  }).catch(() => {});
}

function showCopyErrorBtn() {
  const btn = document.getElementById('copyErrorBtn');
  if (btn) btn.style.display = '';
}

async function setOAuthToken() {
  const input = document.getElementById('oauthTokenInput');
  const raw = (input.value || '').trim();
  if (!raw) return;
  const ok = await validateToken(raw);
  if (ok) {
    try { localStorage.setItem(OAUTH_STORAGE_KEY, twitchOAuthToken); } catch(e) {}
    updateAuthStatus(twitchUserLogin);
    input.value = '';
  } else {
    updateAuthStatus('');
    const el = document.getElementById('chatAuthStatus');
    if (el) { el.textContent = 'invalid token'; el.style.color = '#ff4800'; }
    showCopyErrorBtn();
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chatMessageInput');
  const msg = (input.value || '').trim();
  if (!msg) return;
  if (!twitchOAuthToken || !twitchClientId) {
    const el = document.getElementById('chatAuthStatus');
    if (el) { el.textContent = 'set token first'; el.style.color = '#ff4800'; }
    showCopyErrorBtn();
    return;
  }
  if (!currentRoomId) {
    const el = document.getElementById('chatAuthStatus');
    if (el) { el.textContent = 'connect to channel first'; el.style.color = '#ff4800'; }
    showCopyErrorBtn();
    return;
  }
  const btn = document.getElementById('chatSendBtn');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch('https://api.twitch.tv/helix/chat/messages', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + twitchOAuthToken,
        'Client-Id': twitchClientId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        broadcaster_id: currentRoomId,
        sender_id: twitchUserId,
        message: msg
      })
    });
    if (res.ok) {
      input.value = '';
    } else {
      const err = await res.json().catch(() => ({}));
      const el = document.getElementById('chatAuthStatus');
      if (el) { el.textContent = err.message || 'send failed'; el.style.color = '#ff4800'; }
      showCopyErrorBtn();
    }
  } catch(e) {
    const el = document.getElementById('chatAuthStatus');
    if (el) { el.textContent = 'network error'; el.style.color = '#ff4800'; }
    showCopyErrorBtn();
  }
  setTimeout(() => { if (btn) btn.disabled = false; }, 1500);
}

// --- Emote Picker ---
function toggleEmotePicker() {
  emotePickerOpen = !emotePickerOpen;
  const modal = document.getElementById('emotePickerModal');
  if (!modal) return;
  modal.style.display = emotePickerOpen ? 'flex' : 'none';
  if (emotePickerOpen) renderEmotePickerGrid(emotePickerTab, '');
}

function switchEmoteTab(source) {
  emotePickerTab = source;
  document.querySelectorAll('.emote-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.source === source);
  });
  const search = document.getElementById('emoteSearch');
  renderEmotePickerGrid(source, search ? search.value : '');
}

function filterEmotePicker(query) {
  renderEmotePickerGrid(emotePickerTab, query);
}

function renderEmotePickerGrid(source, filter) {
  const grid = document.getElementById('emotePickerGrid');
  if (!grid) return;
  let sourceMap;
  if (source === 'bttv') sourceMap = bttvEmotes;
  else if (source === '7tv') sourceMap = seventvEmotes;
  else sourceMap = ffzEmotes;
  const lowerFilter = (filter || '').toLowerCase();
  let html = '';
  let count = 0;
  for (const [code, emote] of sourceMap) {
    if (lowerFilter && !code.toLowerCase().includes(lowerFilter)) continue;
    if (count++ > 300) break; // cap for performance
    html += '<img class="emote-pick" src="' + emote.url + '" alt="' + esc(code) + '" title="' + esc(code) + '" onclick="insertEmote(\'' + esc(code).replace(/'/g, "\\'") + '\')" loading="lazy">';
  }
  if (!html) html = '<div class="emote-picker-empty">No emotes loaded — connect to a channel first</div>';
  grid.innerHTML = html;
}

function insertEmote(code) {
  const input = document.getElementById('chatMessageInput');
  if (!input) return;
  const start = input.selectionStart || input.value.length;
  const before = input.value.slice(0, start);
  const after = input.value.slice(start);
  const space = before.length > 0 && !before.endsWith(' ') ? ' ' : '';
  input.value = before + space + code + ' ' + after;
  input.focus();
  const pos = start + space.length + code.length + 1;
  input.setSelectionRange(pos, pos);
}

// =============================================================
//  CONSTANTS & STATE
// =============================================================
const MOODS = ['hype','funny','love','toxic','sad','calm','angry','excited','cringe','wholesome','confused','neutral'];
const MOOD_COLORS = {hype:'#00ffe5',funny:'#ffe600',love:'#ff2d78',toxic:'#ff4800',sad:'#9b6ef3',calm:'#4fc3f7',angry:'#ff1744',excited:'#76ff03',cringe:'#e040fb',wholesome:'#ffab40',confused:'#78909c',neutral:'#2e3d5e'};

const HALFLIFE_KEY = 'moodradar_halflife_v1';
let HALF_LIFE_MS = (() => {
  try { const v = parseInt(localStorage.getItem(HALFLIFE_KEY)); return isNaN(v) ? 10_000 : Math.min(60_000, Math.max(1_000, v * 1000)); }
  catch(e) { return 10_000; }
})();
const WINDOW_MS  = 120_000;
const QUEUE_CAP  = 5000;

const scoredMessages = [];
const keywordStore   = new Map();
const approvalStore  = [];
const msgQueue       = [];
let droppedMessages  = 0;

let totalMessages = 0;
const uniqueUsers   = new Set();
const msgTimestamps = [];
const tsThroughput  = [];
let prevDominant = null;
let chartsReady  = false;
let rafHandle    = null;
let frameIdx     = 0;
const TL_POINTS_KEY   = 'moodradar_tlpoints_v1';
const TL_INTERVAL_KEY = 'moodradar_tlinterval_v1';
let TIMELINE_POINTS   = (() => { try { const v=parseInt(localStorage.getItem(TL_POINTS_KEY)); return isNaN(v)?200:Math.min(1000,Math.max(50,v)); } catch(e){ return 200; } })();
let TIMELINE_INTERVAL = (() => { try { const v=parseInt(localStorage.getItem(TL_INTERVAL_KEY)); return isNaN(v)?1000:Math.min(5000,Math.max(200,v)); } catch(e){ return 1000; } })();
let lastTimelineTs = 0;
const REGEX_STORAGE_KEY  = 'moodradar_regex_v1';
const REGEX_HISTORY_KEY  = 'moodradar_regexhistory_v1';
const REGEX_DEFAULT      = '\\?';

// =============================================================
//  SENTIMENT DATA
// =============================================================
const RAW = {
  hype:[
    ['poggers',2,'PogChamp'],['pogchamp',2,'PogChamp'],['pog ',1,'Pog'],
    ['pogg',1,'Pog'],['pago',1,'PogO'],['pogo',1,'PogO'],
    ['letsgo',2,'LETS GO'],['letsgoo',2,'LETS GO'],['lesgo',2,'LES GO'],
    ['ez ',1,'EZ'],['gg',1,'GG'],['based',2,'BASED'],['goat',2,'GOAT'],
    ['fire',1,'fire'],['banger',2,'BANGER'],['clutch',2,'CLUTCH'],
    ['monkaw',2,'monkaW'],['ratjam',1,'ratJAM'],['yooo',1,'YOOO'],
    ['omgclap',2,'CLAP'],['hype',1,'HYPE'],['insane',1,'INSANE'],
    ['incredible',1,'INCREDIBLE'],['crazy',1,'CRAZY'],['goated',2,'GOATED'],
    ['gigachad',3,'GIGACHAD'],['pausechamp',2,'PauseChamp'],['5head',2,'5Head'],
    ['clap',1,'CLAP'],['w ',1,'W'],['ww',1,'WW'],['lgooo',1,'LES GO'],
  ],
  funny:[
    ['omegalul',3,'OMEGALUL'],['kekw',2,'KEKW'],['lul ',1,'LUL'],
    ['lmao',1,'LMAO'],['lmfao',2,'LMFAO'],['haha',1,'haha'],
    ['kappa',1,'Kappa'],['rofl',1,'ROFL'],['xd',1,'XD'],
    ['lol ',1,'lol'],['copium',1,'COPIUM'],['dead',2,'dead'],
    ['bruh',1,'bruh'],['4head',2,'4Head'],['clown',1,'clown'],
    ['skill issue',2,'skill issue'],['pepejam',2,'PepeJAM'],
    ['hilarious',1,'hilarious'],['residentsleeper',2,'ResidentSleeper'],
    ['biblethump',1,'BibleThump'],['pepehands',1,'PepeHands'],
  ],
  love:[
    ['<3',2,'love'],['love',1,'love'],
    ['king',1,'KING'],['queen',1,'QUEEN'],['beststreamer',2,'best streamer'],
    ['bestchat',2,'best chat'],['cute',1,'cute'],[' ily ',2,'ILY'],
    ['pogheart',2,'PogHeart'],['pepeloveyou',2,'love'],['beautiful',1,'beautiful'],
    ['amazing',1,'amazing'],['perfect',1,'perfect'],['goated',1,'GOATED'],
    ['respect',2,'RESPECT'],['legend',2,'LEGEND'],['w streamer',2,'W streamer'],
  ],
  toxic:[
    ['trash',2,'trash'],['hate',2,'HATE'],['booo',1,'booo'],
    ['malding',2,'MALDING'],['mald',1,'mald'],['cope',1,'COPE'],
    ['rekt',1,'REKT'],
    ['ez clap',2,'EZ clap'],['noob',1,'noob'],['boring',1,'boring'],
    ['loser',1,'loser'],
    ['ratio',1,'RATIO'],['down bad',1,'down bad'],['terrible',1,'terrible'],
    ['l streamer',2,'L streamer'],['trash streamer',3,'trash streamer'],
    ['caught',1,'caught'],['diffed',2,'diffed'],
  ],
  sad:[
    ['sadge',2,'Sadge'],['feelsbadman',2,'FeelsBad'],['rip',1,'RIP'],
    ['pepesad',2,'PepeSad'],['oof',1,'oof'],['prayge',1,'Prayge'],
    ['f in chat',2,'F in chat'],['peepocry',2,'PeepoCry'],
    ['sadchamp',2,'SadChamp'],['pepehands',2,'PepeHands'],['noo',1,'nooo'],
    ['unfortunate',1,'unfortunate'],['disappointing',1,'disappointing'],
    ['biblethump',2,'BibleThump'],['crying',1,'crying'],['rip streamer',2,'RIP'],
  ],
  calm:[
    ['chill',2,'chill'],['relax',1,'relax'],['comfy',2,'comfy'],['cozy',2,'cozy'],
    ['peaceful',2,'peaceful'],['zen',1,'zen'],['vibes',1,'vibes'],['good vibes',2,'good vibes'],
    ['chilling',1,'chilling'],['relaxing',1,'relaxing'],['calm',1,'calm'],['soothing',1,'soothing'],
    ['pepecomfy',2,'comfy'],['catjam',1,'catJAM'],['easy',1,'easy'],['smooth',1,'smooth'],
  ],
  angry:[
    ['rage',2,'RAGE'],['furious',2,'FURIOUS'],['mad',1,'MAD'],['angry',1,'ANGRY'],
    ['stfu',2,'STFU'],['fk',1,'FK'],['wtf',2,'WTF'],['pissed',2,'PISSED'],
    ['livid',2,'LIVID'],['fuming',2,'FUMING'],['raging',2,'RAGING'],
    ['peperage',2,'PepeRage'],['monkamad',2,'MonkaMad'],['triggered',2,'TRIGGERED'],
    ['reeee',2,'REEEE'],['outraged',2,'OUTRAGED'],
  ],
  excited:[
    ['lets goo',2,'LETS GOO'],['hyped',2,'HYPED'],['omg',1,'OMG'],['wooo',2,'WOOO'],
    ['whoa',1,'WHOA'],['yay',1,'YAY'],['woot',1,'WOOT'],['pumped',2,'PUMPED'],
    ['epic',1,'EPIC'],['amazing ',1,'AMAZING'],['stoked',2,'STOKED'],
    ['lit ',2,'LIT'],['sicko',1,'SICKO'],['popoff',2,'POP OFF'],['electric',1,'ELECTRIC'],
  ],
  cringe:[
    ['cringe',2,'cringe'],['yikes',2,'YIKES'],['awkward',1,'awkward'],
    ['secondhand',2,'secondhand'],['embarrassing',2,'embarrassing'],['cringy',2,'cringy'],
    ['monkas',1,'monkaS'],['haHAA',2,'haHAA'],['weird',1,'weird'],
    ['weirdchamp',2,'WeirdChamp'],['sus',1,'SUS'],['sussy',1,'SUSSY'],
    ['uncanny',1,'uncanny'],['icky',1,'icky'],
  ],
  wholesome:[
    ['wholesome',2,'wholesome'],['blessed',2,'BLESSED'],['heartwarming',2,'heartwarming'],
    ['kind',1,'kind'],['sweet',1,'sweet'],['precious',2,'precious'],
    ['adorable',2,'adorable'],['goodguy',2,'good guy'],['faith in humanity',3,'faith'],
    ['thankful',1,'thankful'],['grateful',1,'grateful'],['touching',2,'touching'],
    ['pure',1,'pure'],['innocent',1,'innocent'],
  ],
  confused:[
    ['huh',1,'HUH'],['what',1,'WHAT'],['confused',1,'confused'],['wut',1,'WUT'],
    ['???',2,'???'],['idk',1,'IDK'],['lost',1,'lost'],['wait',1,'WAIT'],
    ['excuse me',2,'excuse me'],['hold up',2,'HOLD UP'],['how',1,'HOW'],
    ['brain hurts',2,'brain hurts'],['makes no sense',2,'no sense'],['pepega',2,'Pepega'],
  ]
};

const TERM_MAP = new Map();
for (const [mood, arr] of Object.entries(RAW)) {
  for (const [term, w, label] of arr) {
    if (!TERM_MAP.has(term) || TERM_MAP.get(term).weight < w)
      TERM_MAP.set(term, { mood, weight:w, label });
  }
}
const TERM_KEYS = [...TERM_MAP.keys()];

// =============================================================
//  APPROVAL / DISSENT TERMS
// =============================================================
const APPROVAL_TERMS = new Map([
  ['facts',+2.5],['true',+1.5],['exactly',+2.0],['real',+1.5],
  ['based',+2.0],['correct',+2.0],['yes',+1.5],['yep',+1.5],['yup',+1.5],
  ['agreed',+2.5],['agree',+2.0],['this',+1.0],['100',+2.0],
  ['fr ',+1.5],['frfr',+2.0],['no cap',+2.0],['nocap',+2.0],
  ['preach',+2.5],['w take',+2.5],['gg',+1.0],['letsgo',+2.0],
  ['poggers',+1.5],['pogchamp',+1.5],['pog ',+1.0],['ez',+1.0],
  ['goated',+2.0],['goat',+1.5],['banger',+2.0],['king',+1.5],
  ['queen',+1.5],['love this',+2.5],['love it',+2.5],[' ily ',+1.5],
  ['wholesome',+2.0],['perfect',+2.0],['amazing',+1.5],['genius',+2.5],
  ['smart',+1.5],['smart take',+2.5],['true that',+2.5],['clap',+1.5],
  ['respect',+2.0],['fire',+1.5],['valid',+2.0],['say it',+2.0],
  ['so true',+2.5],['gigachad',+2.0],['5head',+1.5],['w streamer',+3.0],
  ['no',-1.5],['nope',-1.5],['nah',-2.0],['wrong',-2.0],['false',-2.0],
  ['cap',-2.0],['ratio',-2.5],['l take',-2.5],['bad take',-2.5],
  ['disagree',-2.5],['cope',-2.0],['copium',-2.0],['malding',-2.0],
  ['mald',-1.5],['booo',-2.0],['cringe',-2.0],['trash',-2.0],
  ['terrible',-2.0],['horrible',-2.5],['awful',-2.5],['garbage',-2.5],
  ['shut up',-2.5],['stop',-1.5],['boring',-2.0],['skill issue',-2.0],
  ['noob',-1.5],['loser',-1.5],['rekt',-1.5],['ez clap',-1.5],
  ['lol no',-2.0],['actually no',-2.5],['bro what',-2.0],
  ['l streamer',-3.0],['trash streamer',-3.0],
]);
const APPROVAL_KEYS = [...APPROVAL_TERMS.keys()];

// =============================================================
//  BOT DETECTION
// =============================================================
const BOT_THRESHOLD = 60;
const KNOWN_BOTS = new Set([
  'nightbot','streamelements','fossabot','moobot','streamlabs','streamlobby',
  'soundalerts','pretzelrocks','wizebot','coebot','ohbot','ankhbot',
  'phantombot','deepbot','botisimo','commanderroot','electricallongboard',
  'streamholics','sery_bot','kofistreambot','streamcaptainbot','p0lizei_',
  'slooobot','logviewer','bot_zeigt_bilder','stoveybot','roflgator',
  'starstreambot','titlechange_bot','repost_bot','v_and_k','00ragzy00',
  'pokemoncommunitygame','buttsbot','drapsnatt','unmodurated','stay_hydrated_bot',
  'streamstatusbot','hnlbot','fursuit_cam_bot','leppunen','mirrobot','scripter_',
  'notestreambot','toplistbot','streamcraftbot','0ax2','0x00000',
]);

function usernameScore(user) {
  if (KNOWN_BOTS.has(user)) return 100;
  let s = 0;
  if (/bot$/i.test(user)) s += 35;
  if (/streambot/i.test(user)) s += 40;
  if (/^bot/i.test(user)) s += 25;
  const num = user.match(/\d+$/);
  if (num) { if (num[0].length >= 6) s += 25; else if (num[0].length >= 4) s += 10; }
  if (user.length <= 5 && /\d/.test(user)) s += 10;
  if (user.length >= 16 && /^[a-z0-9]+$/.test(user)) s += 15;
  return Math.min(s, 80);
}

const userProfiles = new Map();
const USER_PROFILE_WINDOW = 60_000;

function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h;
}

function messageScore(msg, lower) {
  let s = 0;
  if (msg.startsWith('!')) s += 20;
  if (/https?:\/\//i.test(msg)) s += 15;
  const words = lower.split(/\s+/);
  if (words.length >= 3) {
    const rep = 1 - new Set(words).size / words.length;
    if (rep > 0.7) s += 20; else if (rep > 0.5) s += 10;
  }
  if (msg.length > 200) s += 15;
  if (msg.length > 400) s += 20;
  const an = (msg.match(/[a-zA-Z0-9]/g)||[]).length;
  if (msg.length > 5 && an / msg.length < 0.2) s += 15;
  return s;
}

function detectBot(user, msg, ts) {
  const lower = msg.toLowerCase();
  let score = usernameScore(user);
  if (score >= 100) return { botScore:100, isBot:true };
  score += messageScore(msg, lower);
  if (!userProfiles.has(user)) userProfiles.set(user, { msgs:[],lengths:[],flagCount:0 });
  const p = userProfiles.get(user);
  while (p.msgs.length && ts - p.msgs[0].ts > USER_PROFILE_WINDOW) p.msgs.shift();
  p.msgs.push({ ts, hash:hashStr(lower.trim()) });
  const rate = p.msgs.length / (USER_PROFILE_WINDOW / 60_000);
  if (rate > 30) score += 30; else if (rate > 15) score += 15; else if (rate > 8) score += 5;
  if (p.msgs.length >= 3) {
    const hashes = p.msgs.slice(-10).map(m => m.hash);
    const rep = 1 - new Set(hashes).size / hashes.length;
    if (rep > 0.8) score += 30; else if (rep > 0.5) score += 15; else if (rep > 0.3) score += 5;
  }
  p.lengths.push(msg.length);
  if (p.lengths.length > 20) p.lengths.shift();
  if (p.lengths.length >= 5) {
    const mean = p.lengths.reduce((a,b)=>a+b,0) / p.lengths.length;
    const sd = Math.sqrt(p.lengths.reduce((a,b)=>a+(b-mean)**2,0) / p.lengths.length);
    if (mean > 10 && sd < 2) score += 20; else if (mean > 10 && sd < 5) score += 8;
  }
  if (score >= BOT_THRESHOLD) {
    p.flagCount++;
    if (p.flagCount >= 5) score = Math.min(score + 20, 100);
  }
  return { botScore:Math.min(score,100), isBot:score >= BOT_THRESHOLD };
}

let botMessagesFiltered = 0;
let botUsersDetected    = new Set();
let botFilterEnabled    = true;
let approvalDisplayVal  = 50;
let approvalHistory     = Array(40).fill(50);

// =============================================================
//  CLASSIFICATION — length weighting + strength cap
// =============================================================
function classifyMessage(msg) {
  const lower = msg.toLowerCase();
  const scores = {hype:0,funny:0,love:0,toxic:0,sad:0,calm:0,angry:0,excited:0,cringe:0,wholesome:0,confused:0};
  const hits = [];

  for (let i = 0; i < TERM_KEYS.length; i++) {
    const term = TERM_KEYS[i];
    if (lower.includes(term)) {
      const { mood, weight, label } = TERM_MAP.get(term);
      scores[mood] += weight;
      hits.push({ label, mood, weight });
    }
  }

  const capR = (msg.match(/[A-Z]/g)||[]).length / (msg.length||1);
  if (capR > 0.65 && msg.length > 5) scores.toxic += 0.6;

  let best = 'neutral', bestS = 0;
  for (const [m, s] of Object.entries(scores)) if (s > bestS) { bestS = s; best = m; }

  const wordCount = lower.split(/\s+/).filter(w => w.length > 0).length;
  let lengthMult;
  if      (wordCount <= 1)  lengthMult = 0.5;
  else if (wordCount <= 3)  lengthMult = 0.75;
  else if (wordCount <= 7)  lengthMult = 1.0;
  else if (wordCount <= 15) lengthMult = 1.2;
  else                      lengthMult = 1.35;

  const strength = Math.max(0.3, Math.min(bestS, 4.0) * lengthMult);

  let approvalVote = 0;
  for (let i = 0; i < APPROVAL_KEYS.length; i++) {
    if (lower.includes(APPROVAL_KEYS[i])) approvalVote += APPROVAL_TERMS.get(APPROVAL_KEYS[i]);
  }
  approvalVote *= lengthMult;
  if (capR > 0.65 && msg.length > 4) approvalVote *= 1.4;

  return { mood:best, strength, hits, approvalVote };
}

// =============================================================
//  EWMA SCORING
// =============================================================
function expWeight(ageMs) { return Math.exp(-ageMs * 0.693147 / HALF_LIFE_MS); }

function pruneWindow(now) {
  while (scoredMessages.length && now - scoredMessages[0].ts > WINDOW_MS) scoredMessages.shift();
}

function computeWeightedMoods(now) {
  pruneWindow(now);
  const totals = {hype:0,funny:0,love:0,toxic:0,sad:0,calm:0,angry:0,excited:0,cringe:0,wholesome:0,confused:0,neutral:0};
  let sumW = 0;
  for (const { ts, mood, strength } of scoredMessages) {
    const w = expWeight(now - ts) * strength;
    totals[mood] += w; sumW += w;
  }
  if (sumW === 0) return null;
  const pct = {};
  for (const k of MOODS) pct[k] = totals[k] / sumW * 100;
  return pct;
}

function computeKeywordWeights(now) {
  const cutoff = now - WINDOW_MS;
  for (const [k, arr] of keywordStore) {
    while (arr.length && arr[0].ts < cutoff) arr.shift();
    if (arr.length === 0) keywordStore.delete(k);
  }
  const result = [];
  for (const [label, arr] of keywordStore) {
    let score = 0;
    const moodTotals = {};
    for (const { ts, w, mood:m } of arr) {
      const ew = expWeight(now - ts) * w;
      score += ew;
      moodTotals[m] = (moodTotals[m]||0) + ew;
    }
    let bestM = 'neutral', bestV = 0;
    for (const [m,v] of Object.entries(moodTotals)) if (v > bestV) { bestV = v; bestM = m; }
    result.push({ label, score, mood:bestM });
  }
  result.sort((a,b) => b.score - a.score);
  return result;
}

function computeApproval(now) {
  const cutoff = now - WINDOW_MS;
  while (approvalStore.length && approvalStore[0].ts < cutoff) approvalStore.shift();
  if (approvalStore.length === 0) return null;
  let sumPos = 0, sumNeg = 0, sumW = 0;
  for (const { ts, vote } of approvalStore) {
    const w = expWeight(now - ts);
    if (vote > 0) sumPos += vote * w; else sumNeg += Math.abs(vote) * w;
    sumW += w;
  }
  if (sumW === 0) return null;
  const total = sumPos + sumNeg || 0.001;
  return 50 + (sumPos - sumNeg) / total * 50;
}

function approvalVerdict(score) {
  if (score > 88) return ['OVERWHELMING APPROVAL','#00ffe5'];
  if (score > 74) return ['STRONG APPROVAL','#00ddcc'];
  if (score > 62) return ['LEANING APPROVAL','#00bb99'];
  if (score > 54) return ['MILD APPROVAL','#44aa88'];
  if (score > 46) return ['MIXED - DIVIDED CHAT','#8888aa'];
  if (score > 38) return ['MILD DISSENT','#cc7755'];
  if (score > 26) return ['LEANING DISSENT','#ee5533'];
  if (score > 14) return ['STRONG DISSENT','#ff3311'];
  return ['OVERWHELMING REJECTION','#ff4800'];
}

function enqueue(user, msg, ts) {
  if (msgQueue.length >= QUEUE_CAP) { msgQueue.shift(); droppedMessages++; }
  msgQueue.push({ user, msg, ts });
}

// =============================================================
//  LABEL SCALE — controls font size for pie slices and bubbles
//  Range 0.8–2.5, default 1.4. Persisted to localStorage.
// =============================================================
const LABEL_SCALE_KEY = 'moodradar_labelscale_v1';
let labelScale = (() => {
  try { const v = parseFloat(localStorage.getItem(LABEL_SCALE_KEY)); return isNaN(v) ? 1.4 : Math.min(2.5, Math.max(0.4, v)); }
  catch(e) { return 1.4; }
})();

function updateLabelScale(v) {
  labelScale = Math.min(2.5, Math.max(0.4, parseFloat(v)));
  document.getElementById('labelScaleVal').textContent = labelScale.toFixed(1) + 'x';
  try { localStorage.setItem(LABEL_SCALE_KEY, labelScale); } catch(e) {}
  // Pie redraws on next update cycle; bubble redraws on next animation frame
  if (pieChart) pieChart.update('none');
}

// =============================================================
//  BUBBLE SCALE — controls bubble radius in consensus bubbles
//  Range 0.3–1.5, default 1.0. Persisted to localStorage.
// =============================================================
const BUBBLE_SCALE_KEY = 'moodradar_bubblescale_v1';
let bubbleScale = (() => {
  try { const v = parseFloat(localStorage.getItem(BUBBLE_SCALE_KEY)); return isNaN(v) ? 1.0 : Math.min(1.5, Math.max(0.3, v)); }
  catch(e) { return 1.0; }
})();

function updateBubbleScale(v) {
  bubbleScale = Math.min(1.5, Math.max(0.3, parseFloat(v)));
  document.getElementById('bubbleScaleVal').textContent = bubbleScale.toFixed(2) + 'x';
  try { localStorage.setItem(BUBBLE_SCALE_KEY, bubbleScale); } catch(e) {}
}

// =============================================================
//  CHARTS
// =============================================================
let pieChart, radarChart, timelineLinearChart, timelineLogChart, approvalTimelineChart, throughputTimelineChart;

const pieLabelPlugin = {
  id: 'pieLabels',
  afterDraw(chart) {
    if (!drawerOptions.pieLabels) return;
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const data = chart.data.datasets[0].data;
    const labels = chart.data.labels;
    const total = data.reduce((a,b)=>a+b,0) || 1;
    ctx.save();
    meta.data.forEach((arc, i) => {
      const pct = data[i] / total * 100;
      if (pct < 4) return;
      const { x, y } = arc.tooltipPosition();
      // Apply labelScale to font sizes
      const bigFont   = Math.round((pct > 15 ? 13 : 10) * labelScale);
      const smallFont = Math.round((pct > 15 ? 11 :  9) * labelScale);
      ctx.font = `bold ${bigFont}px 'Orbitron', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4;
      const offset = Math.round(7 * labelScale);
      if (pct > 12) {
        ctx.fillText(labels[i], x, y - offset);
        ctx.font = `${smallFont}px 'Share Tech Mono', monospace`;
        ctx.fillText(pct.toFixed(0) + '%', x, y + offset);
      } else {
        ctx.fillText(pct.toFixed(0) + '%', x, y);
      }
      ctx.shadowBlur = 0;
    });
    ctx.restore();
  }
};

// Plugin: draws a dashed horizontal line at y=50 on the approval timeline
const approvalMidlinePlugin = {
  id: 'approvalMidline',
  afterDraw(chart) {
    const yScale = chart.scales.y;
    if (!yScale) return;
    const y = yScale.getPixelForValue(50);
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(chart.chartArea.left, y);
    ctx.lineTo(chart.chartArea.right, y);
    ctx.stroke();
    ctx.restore();
  }
};

function initCharts() {
  if (chartsReady) return;
  chartsReady = true;
  Chart.defaults.color = '#4a4a7a';
  Chart.defaults.font.family = 'Share Tech Mono';

  pieChart = new Chart(document.getElementById('pieChart'), {
    type: 'pie',
    plugins: [pieLabelPlugin],
    data: {
      labels: MOODS.map(m => m.toUpperCase()),
      datasets:[{ data:MOODS.map((_,i)=>i===MOODS.length-1?100:0), backgroundColor:MOODS.map(m=>MOOD_COLORS[m]), borderColor:'#06060f', borderWidth:3, hoverOffset:10 }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      animation:{duration:350, easing:'easeOutCubic'},
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:c=>` ${c.label}: ${c.parsed.toFixed(1)}%`}, backgroundColor:'#0d0d1f', borderColor:'#1a1a36', borderWidth:1}
      }
    }
  });

  const moodsForWeb = MOODS.filter(m => m !== 'neutral');
  radarChart = new Chart(document.getElementById('radarChart'), {
    type: 'radar',
    data: {
      labels: moodsForWeb.map(m => m.toUpperCase()),
      datasets:[{ label:'Mood Weight', data: moodsForWeb.map(() => 0), fill:true,
        backgroundColor:'rgba(0,255,229,.09)', borderColor:'#00ffe5', borderWidth:2.5,
        pointBackgroundColor:'#00ffe5', pointBorderColor:'#06060f', pointRadius:4, pointHoverRadius:7 }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      animation:{duration:400, easing:'easeOutCubic'},
      scales:{r:{min:0,max:10,ticks:{display:false},grid:{color:'rgba(255,255,255,.055)'},angleLines:{color:'rgba(255,255,255,.065)'},pointLabels:{color:'#7a7aaa',font:{family:'Share Tech Mono',size:10,weight:'700'}}}},
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.chart.data.labels[c.dataIndex]}: ${c.parsed.r.toFixed(1)}%`}, backgroundColor:'#0d0d1f', borderColor:'#1a1a36', borderWidth:1}}
    }
  });

  // Approval tick marks
  const tickContainer = document.getElementById('approvalTicks');
  for (let i = 0; i < 9; i++) {
    const t = document.createElement('div');
    t.className = 'approval-tick';
    tickContainer.appendChild(t);
  }

  // Approval mini bars
  const miniContainer = document.getElementById('approvalMini');
  for (let i = 0; i < 40; i++) {
    const b = document.createElement('div');
    b.className = 'approval-mini-bar';
    b.style.height = '3px';
    b.style.background = '#333355';
    miniContainer.appendChild(b);
  }

  // Timeline charts — one linear, one log
  const moodsForTL = MOODS.filter(m => m !== 'neutral');

  function makeTimelineDatasets() {
    return moodsForTL.map(m => ({
      label:m.toUpperCase(), data:Array(TIMELINE_POINTS).fill(null),
      borderColor:MOOD_COLORS[m], backgroundColor:'transparent',
      borderWidth:2, pointRadius:0, tension:0.45, fill:false
    }));
  }

  timelineLinearChart = new Chart(document.getElementById('timelineLinearChart'), {
    type:'line',
    data:{ labels:Array(TIMELINE_POINTS).fill(''), datasets:makeTimelineDatasets() },
    options:{
      responsive:true, maintainAspectRatio:false, animation:false,
      interaction:{mode:'index',intersect:false},
      scales:{
        x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#2e2e58',maxRotation:0,font:{size:8}}},
        y:{
          type:'linear', min:0, max:10,
          grid:{color:'rgba(255,255,255,.04)'},
          ticks:{color:'#2e2e58',font:{size:8},callback:v=>v+'%'}
        }
      },
      plugins:{
        legend:{display:false},
        tooltip:{backgroundColor:'#0d0d1f',borderColor:'#1a1a36',borderWidth:1}
      }
    }
  });

  timelineLogChart = new Chart(document.getElementById('timelineLogChart'), {
    type:'line',
    data:{ labels:Array(TIMELINE_POINTS).fill(''), datasets:makeTimelineDatasets() },
    options:{
      responsive:true, maintainAspectRatio:false, animation:false,
      interaction:{mode:'index',intersect:false},
      scales:{
        x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#2e2e58',maxRotation:0,font:{size:8}}},
        y:{
          type:'logarithmic', min:0.5, max:100,
          grid:{color:'rgba(255,255,255,.04)'},
          ticks:{
            color:'#2e2e58',font:{size:8},
            callback(v) {
              if (v === 0.5) return '<1%';
              if ([1,2,5,10,20,50,100].includes(v)) return v + '%';
              return null;
            }
          }
        }
      },
      plugins:{
        legend:{display:false},
        tooltip:{backgroundColor:'#0d0d1f',borderColor:'#1a1a36',borderWidth:1}
      }
    }
  });

  // Approval timeline — single line showing approval score over time
  approvalTimelineChart = new Chart(document.getElementById('approvalTimelineChart'), {
    type:'line',
    plugins: [approvalMidlinePlugin],
    data:{ labels:Array(TIMELINE_POINTS).fill(''), datasets:[{
      label:'APPROVAL', data:Array(TIMELINE_POINTS).fill(null),
      borderColor:'#00ffe5', backgroundColor:'rgba(0,255,229,.08)',
      borderWidth:2, pointRadius:0, tension:0.45, fill:true
    }] },
    options:{
      responsive:true, maintainAspectRatio:false, animation:false,
      interaction:{mode:'index',intersect:false},
      scales:{
        x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#2e2e58',maxRotation:0,font:{size:8}}},
        y:{
          type:'linear', min:0, max:100,
          grid:{color:'rgba(255,255,255,.04)'},
          ticks:{color:'#2e2e58',font:{size:8},callback:function(v){
            if(v===0) return 'DISSENT';
            if(v===50) return 'NEUTRAL';
            if(v===100) return 'APPROVAL';
            return v+'%';
          }}
        }
      },
      plugins:{
        legend:{display:false},
        tooltip:{backgroundColor:'#0d0d1f',borderColor:'#1a1a36',borderWidth:1}
      }
    }
  });

  // Throughput timeline — single line showing msg/s over time (same style as approval)
  throughputTimelineChart = new Chart(document.getElementById('throughputTimelineChart'), {
    type:'line',
    data:{ labels:Array(TIMELINE_POINTS).fill(''), datasets:[{
      label:'THROUGHPUT', data:Array(TIMELINE_POINTS).fill(null),
      borderColor:'#00ffe5', backgroundColor:'rgba(0,255,229,.08)',
      borderWidth:2, pointRadius:0, tension:0.45, fill:true
    }] },
    options:{
      responsive:true, maintainAspectRatio:false, animation:false,
      interaction:{mode:'index',intersect:false},
      scales:{
        x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#2e2e58',maxRotation:0,font:{size:8}}},
        y:{
          type:'linear', min:0,
          grid:{color:'rgba(255,255,255,.04)'},
          ticks:{color:'#2e2e58',font:{size:8},callback:function(v){ return v+' msg/s'; }}
        }
      },
      plugins:{
        legend:{display:false},
        tooltip:{backgroundColor:'#0d0d1f',borderColor:'#1a1a36',borderWidth:1}
      }
    }
  });

  initBubbles();
}

// setTimelineScale removed — two dedicated timeline charts now handle linear/log separately

// =============================================================
//  BUBBLE PHYSICS ENGINE — spring gravity
// =============================================================
const bubCanvas = document.getElementById('bubbleCanvas');
const bubCtx    = bubCanvas.getContext('2d');
let bubbles      = [];
let hoveredBubble = null;
const tip = document.getElementById('bubbleTip');

function resizeBubbleCanvas() {
  const parent = bubCanvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  // Sync canvas display size to parent container boundaries
  if (parent) {
    const pw = parent.clientWidth;
    const ph = parent.clientHeight || bubCanvas.offsetHeight;
    if (pw > 0) bubCanvas.style.width = pw + 'px';
    if (ph > 0) bubCanvas.style.height = ph + 'px';
  }
  bubCanvas.width  = bubCanvas.offsetWidth * dpr;
  bubCanvas.height = bubCanvas.offsetHeight * dpr;
  bubCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Re-clamp existing bubbles to new bounds
  const W = bubCanvas.offsetWidth, H = bubCanvas.offsetHeight;
  for (const b of bubbles) {
    b.x = Math.max(b.r + 4, Math.min(W - b.r - 4, b.x));
    b.y = Math.max(b.r + 4, Math.min(H - b.r - 4, b.y));
  }
}

function initBubbles() {
  resizeBubbleCanvas();
  window.addEventListener('resize', resizeBubbleCanvas);
  bubCanvas.addEventListener('mousemove', onBubbleHover);
  bubCanvas.addEventListener('mouseleave', () => { hoveredBubble = null; tip.style.opacity = '0'; });
  bubAnimLoop();
}

function onBubbleHover(e) {
  const rect = bubCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  hoveredBubble = null; tip.style.opacity = '0';
  for (const b of bubbles) {
    const dx = mx - b.x, dy = my - b.y;
    if (dx*dx + dy*dy < b.r*b.r) {
      hoveredBubble = b;
      tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY - 14) + 'px';
      tip.style.opacity = '1';
      tip.textContent = sanitize(b.label) + ' - ' + b.mood;
      break;
    }
  }
}

function updateBubbles(kwList) {
  const W = bubCanvas.offsetWidth, H = bubCanvas.offsetHeight;
  if (!W || !H) return;
  const top = kwList.slice(0, drawerOptions.bubbleCount || 22);
  const maxScore = top[0]?.score || 1;
  const maxR = Math.min(W, H) * 0.42 * bubbleScale; // scale by bubble scale slider
  const existing = new Map(bubbles.map(b => [b.label, b]));
  const next = [];
  for (const { label, score, mood } of top) {
    const targetR = Math.min((16 + (score / maxScore) * 55) * bubbleScale, maxR);
    if (existing.has(label)) {
      const b = existing.get(label);
      b.targetR = targetR; b.mood = mood; b.score = score;
      next.push(b);
    } else {
      const angle = Math.random() * Math.PI * 2;
      const sr = Math.min(W, H) * 0.15;
      next.push({ label, mood, score,
        x:W/2 + Math.cos(angle)*sr, y:H/2 + Math.sin(angle)*sr,
        vx:(Math.random()-0.5)*0.4, vy:(Math.random()-0.5)*0.4,
        r:targetR*0.3, targetR });
    }
  }
  bubbles = next;
}

function bubAnimLoop() {
  requestAnimationFrame(bubAnimLoop);
  const W = bubCanvas.offsetWidth, H = bubCanvas.offsetHeight;
  if (!W || !H) return;
  bubCtx.clearRect(0, 0, W, H);
  const cx = W/2, cy = H/2;
  const SPRING_K = 0.004 * (drawerOptions.bubbleSpeed || 1);

  for (const b of bubbles) {
    b.r += (b.targetR - b.r) * 0.05;
    const dx = cx - b.x, dy = cy - b.y;
    b.vx += dx * SPRING_K; b.vy += dy * SPRING_K;
    b.vx += (Math.random()-0.5)*0.015; b.vy += (Math.random()-0.5)*0.015;
    b.vx *= 0.90; b.vy *= 0.90;
    const spd = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
    if (spd > 1.5) { b.vx = b.vx/spd*1.5; b.vy = b.vy/spd*1.5; }
    b.x += b.vx; b.y += b.vy;
    // Clamp radius to fit within canvas
    const effR = Math.min(b.r, Math.min(W, H) * 0.48 * bubbleScale);
    b.r = effR;
    const pad = 4;
    if (b.x-b.r<pad)    { b.x=b.r+pad;     b.vx= Math.abs(b.vx)*0.3; }
    if (b.x+b.r>W-pad)  { b.x=W-b.r-pad;   b.vx=-Math.abs(b.vx)*0.3; }
    if (b.y-b.r<pad)    { b.y=b.r+pad;     b.vy= Math.abs(b.vy)*0.3; }
    if (b.y+b.r>H-pad)  { b.y=H-b.r-pad;   b.vy=-Math.abs(b.vy)*0.3; }
  }

  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i+1; j < bubbles.length; j++) {
        const a = bubbles[i], b = bubbles[j];
        const dx = b.x-a.x, dy = b.y-a.y;
        const distSq = dx*dx+dy*dy;
        const minD = a.r+b.r+2;
        if (distSq < minD*minD) {
          const dist = Math.sqrt(distSq)||0.001;
          const overlap = (minD-dist)*0.5;
          const nx = dx/dist, ny = dy/dist;
          a.x -= nx*overlap; a.y -= ny*overlap;
          b.x += nx*overlap; b.y += ny*overlap;
          const relV = (b.vx-a.vx)*nx + (b.vy-a.vy)*ny;
          if (relV < 0) {
            a.vx -= nx*relV*0.25; a.vy -= ny*relV*0.25;
            b.vx += nx*relV*0.25; b.vy += ny*relV*0.25;
          }
        }
      }
    }
  }

  for (const b of bubbles) {
    const col = MOOD_COLORS[b.mood]||'#2e3d5e';
    const isHov = b === hoveredBubble;
    bubCtx.beginPath();
    bubCtx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    bubCtx.fillStyle = hexAlpha(col, isHov ? 0.52 : (drawerOptions.bubbleOpacity || 0.28));
    bubCtx.fill();
    if (isHov) { bubCtx.shadowColor=col; bubCtx.shadowBlur=16; }
    bubCtx.strokeStyle = hexAlpha(col, isHov?1.0:0.65);
    bubCtx.lineWidth = isHov?2.5:1.5;
    bubCtx.stroke();
    bubCtx.shadowBlur = 0;
    if (b.r < 12) continue;
    // Apply labelScale; base range 9–20px (was 9–13px)
    const fontSize = Math.max(9, Math.min(b.r * 0.42 * labelScale, 20 * labelScale));
    bubCtx.font = `bold ${Math.round(fontSize)}px 'Share Tech Mono', monospace`;
    bubCtx.textAlign = 'center'; bubCtx.textBaseline = 'middle';
    bubCtx.fillStyle = isHov?'#fff':'rgba(255,255,255,0.88)';
    const txt = b.label.length>11 ? b.label.slice(0,10)+'.' : b.label;
    bubCtx.fillText(txt, b.x, b.y, b.r*1.75);
  }
}

// =============================================================
//  VISUALS UPDATE
// =============================================================
function updateVisuals() {
  if (!chartsReady) return;
  const now = Date.now();
  const pct = computeWeightedMoods(now);
  const dominant = getDominant(pct);
  const col = MOOD_COLORS[dominant];

  if (pct) { pieChart.data.datasets[0].data = MOODS.map(m=>pct[m]); pieChart.update('none'); }

  const kwList = computeKeywordWeights(now);

  // Update mood web (radar chart) with current weighted moods
  if (pct && radarChart) {
    const moodsForWeb = MOODS.filter(m => m !== 'neutral');
    const radarData = moodsForWeb.map(m => Math.round(pct[m]));
    radarChart.data.datasets[0].data = radarData;
    const radarMax = Math.max(...radarData);
    radarChart.options.scales.r.max = Math.max(10, Math.ceil(radarMax * 1.15));
    const rc = MOOD_COLORS[dominant];
    radarChart.data.datasets[0].borderColor = rc;
    radarChart.data.datasets[0].backgroundColor = hexAlpha(rc, 0.1);
    radarChart.data.datasets[0].pointBackgroundColor = rc;
    radarChart.update('none');
  }

  updateBubbles(kwList.slice(0, (drawerOptions.bubbleCount || 22) + 6).map((k,i)=>({...k,count:i+1})));

  const domEl = document.getElementById('dominantMood');
  domEl.textContent = dominant.toUpperCase() + ' DOMINANT';
  domEl.style.color = col;
  domEl.style.textShadow = `0 0 26px ${hexAlpha(col,.45)}`;
  domEl.classList.add('visible');

  if (prevDominant && prevDominant !== dominant) {
    const alertEl = document.getElementById('shiftAlert');
    alertEl.textContent = 'MOOD SHIFT - ' + prevDominant.toUpperCase() + ' TO ' + dominant.toUpperCase();
    alertEl.classList.add('show');
    clearTimeout(alertEl._t);
    alertEl._t = setTimeout(() => alertEl.classList.remove('show'), 5000);
    ['pieCard','radarCard'].forEach(id => {
      const el = document.getElementById(id);
      el.classList.add('flush');
      clearTimeout(el._ft);
      el._ft = setTimeout(() => el.classList.remove('flush'), 1800);
    });
  }
  prevDominant = dominant;

  const approvalRaw = computeApproval(now);
  if (approvalRaw !== null) {
    approvalDisplayVal += (approvalRaw - approvalDisplayVal) * 0.18;
    const val = approvalDisplayVal;
    const pctV = Math.max(2, Math.min(98, val));
    const thumb = document.getElementById('approvalThumb');
    thumb.style.left = pctV + '%';
    let thumbCol;
    if (val >= 50) { const t=(val-50)/50; thumbCol=lerpColor('#8888aa','#00ffe5',t); }
    else           { const t=(50-val)/50; thumbCol=lerpColor('#8888aa','#ff4800',t); }
    thumb.style.background = '#0d0d1f';
    thumb.style.color = thumbCol;
    thumb.style.borderColor = thumbCol;
    thumb.style.boxShadow = `0 0 22px ${thumbCol}99, 0 0 8px ${thumbCol}55`;
    const signedScore = Math.round(val - 50);
    const scoreEl = document.getElementById('approvalScore');
    scoreEl.textContent = (signedScore >= 0 ? '+' : '') + signedScore;
    scoreEl.style.color = thumbCol;
    scoreEl.style.textShadow = `0 0 24px ${thumbCol}88`;
    const [vText,vCol] = approvalVerdict(val);
    const verdictEl = document.getElementById('approvalVerdict');
    verdictEl.textContent = vText; verdictEl.style.color = vCol;
    approvalHistory.push(val);
    if (approvalHistory.length > 40) approvalHistory.shift();
    const bars = document.getElementById('approvalMini').children;
    for (let i = 0; i < bars.length; i++) {
      const v = approvalHistory[i]??50;
      const h = Math.max(3, Math.abs(v-50)/50*28);
      let bc;
      if (v>=50) { const t=(v-50)/50; bc=lerpColor('#555577','#00ffe5',t); }
      else       { const t=(50-v)/50; bc=lerpColor('#555577','#ff4800',t); }
      bars[i].style.height = h+'px'; bars[i].style.background = bc;
    }
  }

  const now2 = Date.now();
  document.getElementById('statMessages').textContent = fmtNum(totalMessages);
  document.getElementById('statUsers').textContent    = fmtNum(uniqueUsers.size);
  document.getElementById('statQueue').textContent    = msgQueue.length;
  document.getElementById('statDropped').textContent  = droppedMessages;
  document.getElementById('statBotMsgs').textContent  = fmtNum(botMessagesFiltered);
  document.getElementById('statBotUsers').textContent = fmtNum(botUsersDetected.size);
  const cut60 = now2-60000;
  while (msgTimestamps.length && msgTimestamps[0]<cut60) msgTimestamps.shift();
  document.getElementById('statRate').textContent = msgTimestamps.length;
  const cut3 = now2-3000;
  while (tsThroughput.length && tsThroughput[0]<cut3) tsThroughput.shift();
  const mps = (tsThroughput.length/3).toFixed(1);
  const bp = Math.min(100, tsThroughput.length/3/50*100);
  const fill = document.getElementById('tbarFill');
  fill.style.width = bp+'%';
  fill.style.background = bp>80?'#ff4800':bp>50?'#ffe600':'#00ffe5';
  document.getElementById('tbarLabel').textContent = mps+' msg/s';
}

function pushTimelineSnapshot() {
  const pct = computeWeightedMoods(Date.now());
  const label = new Date().toLocaleTimeString([],{minute:'2-digit',second:'2-digit'});

  // Push to linear timeline
  if (timelineLinearChart) {
    timelineLinearChart.data.labels.push(label); timelineLinearChart.data.labels.shift();
    MOODS.filter(m=>m!=='neutral').forEach((m,i)=>{
      const val = pct ? Math.round(pct[m]) : 0;
      timelineLinearChart.data.datasets[i].data.push(val);
      timelineLinearChart.data.datasets[i].data.shift();
    });
    // Dynamic Y-axis: scale to highest currently displayed value
    let tlMax = 0;
    timelineLinearChart.data.datasets.forEach(ds => {
      ds.data.forEach(v => { if (v !== null && v > tlMax) tlMax = v; });
    });
    timelineLinearChart.options.scales.y.max = Math.max(10, Math.ceil(tlMax * 1.15));
    timelineLinearChart.update('none');
  }

  // Push to log timeline (floor at 0.5 to avoid log(0))
  if (timelineLogChart) {
    timelineLogChart.data.labels.push(label); timelineLogChart.data.labels.shift();
    MOODS.filter(m=>m!=='neutral').forEach((m,i)=>{
      let val = pct ? Math.round(pct[m]) : 0;
      if (val < 0.5) val = 0.5;
      timelineLogChart.data.datasets[i].data.push(val);
      timelineLogChart.data.datasets[i].data.shift();
    });
    timelineLogChart.update('none');
  }
}

function pushApprovalTimelineSnapshot() {
  if (!approvalTimelineChart) return;
  const val = Math.round(approvalDisplayVal);
  const label = new Date().toLocaleTimeString([],{minute:'2-digit',second:'2-digit'});
  approvalTimelineChart.data.labels.push(label);
  approvalTimelineChart.data.labels.shift();
  approvalTimelineChart.data.datasets[0].data.push(val);
  approvalTimelineChart.data.datasets[0].data.shift();
  // Tint line color based on current approval
  let lineCol;
  if (val >= 50) { const t=(val-50)/50; lineCol=lerpColor('#8888aa','#00ffe5',t); }
  else           { const t=(50-val)/50; lineCol=lerpColor('#8888aa','#ff4800',t); }
  approvalTimelineChart.data.datasets[0].borderColor = lineCol;
  approvalTimelineChart.data.datasets[0].backgroundColor = hexAlpha(lineCol, 0.08);
  approvalTimelineChart.update('none');
}

function pushThroughputTimelineSnapshot() {
  if (!throughputTimelineChart) return;
  const now = Date.now();
  const cut3 = now - 3000;
  // Use tsThroughput already maintained in updateVisuals
  const mps = parseFloat((tsThroughput.filter(t => t >= cut3).length / 3).toFixed(1));
  const label = new Date().toLocaleTimeString([],{minute:'2-digit',second:'2-digit'});
  throughputTimelineChart.data.labels.push(label);
  throughputTimelineChart.data.labels.shift();
  throughputTimelineChart.data.datasets[0].data.push(mps);
  throughputTimelineChart.data.datasets[0].data.shift();
  // Tint line color based on throughput intensity
  let lineCol;
  if (mps > 30) lineCol = '#ff4800';
  else if (mps > 15) lineCol = '#ffe600';
  else lineCol = '#00ffe5';
  throughputTimelineChart.data.datasets[0].borderColor = lineCol;
  throughputTimelineChart.data.datasets[0].backgroundColor = hexAlpha(lineCol, 0.08);
  throughputTimelineChart.update('none');
}

function showDecayRecommendation() {
  const now = Date.now();
  const cut3 = now - 3000;
  const currentMps = parseFloat((tsThroughput.filter(t => t >= cut3).length / 3).toFixed(1));
  let rec, details;
  if (currentMps < 2) {
    rec = '20-40s';
    details = 'Low throughput (' + currentMps.toFixed(1) + ' msg/s). Use a higher decay so sparse messages linger long enough for meaningful mood detection.';
  } else if (currentMps < 10) {
    rec = '10-20s';
    details = 'Moderate throughput (' + currentMps.toFixed(1) + ' msg/s). A balanced decay gives responsive charts without excessive volatility.';
  } else if (currentMps < 30) {
    rec = '5-10s';
    details = 'High throughput (' + currentMps.toFixed(1) + ' msg/s). Lower decay keeps charts snappy and reflects fast-moving sentiment shifts.';
  } else {
    rec = '2-5s';
    details = 'Very high throughput (' + currentMps.toFixed(1) + ' msg/s). Use short decay to track rapid swings without chart lag.';
  }
  showHelp('_decayRec');
  document.getElementById('helpTitle').textContent = 'DECAY RECOMMENDATION';
  document.getElementById('helpBody').innerHTML =
    '<p><strong>Current throughput:</strong> ' + currentMps.toFixed(1) + ' msg/s</p>' +
    '<p><strong>Recommended decay:</strong> ' + rec + '</p>' +
    '<p>' + details + '</p>' +
    '<p style="margin-top:12px;color:var(--muted);font-size:.85em"><strong>Timeline chart tips:</strong></p>' +
    '<ul style="color:var(--muted);font-size:.85em">' +
    '<li><strong>Max Points</strong> — More points = longer history visible, but heavier rendering. 150-300 is ideal for most streams.</li>' +
    '<li><strong>Interval</strong> — Lower interval = more frequent snapshots. Use 500-1000ms for fast chats, 2000-3000ms for slow ones.</li>' +
    '<li>If charts feel sluggish, try reducing Max Points or increasing Interval.</li>' +
    '</ul>';
}

// =============================================================
//  FEED
// =============================================================
const feedPending = [];
let feedRafId = null;

function addFeedItem(user, msg, mood, botScore, approvalVote) {
  feedPending.push({ user, msg, mood, botScore:botScore||0, approvalVote:approvalVote||0 });
  if (!feedRafId) feedRafId = requestAnimationFrame(flushFeed);
}

function flushFeed() {
  feedRafId = null;
  const list = document.getElementById('feedList');
  const frag = document.createDocumentFragment();
  for (const { user, msg, mood, botScore, approvalVote } of feedPending.splice(0,25)) {
    const el = document.createElement('div');
    const isBot = mood === 'bot';
    el.className = 'feed-item' + (isBot?' feed-bot':'');
    const safeUser = sanitize(user);
    const safeMsg  = sanitize(msg);
    const moodTag = isBot
      ? `<span class="feed-mood mood-bot">BOT ${botScore}</span>`
      : `<span class="feed-mood mood-${mood}">${mood}</span>`;
    let apvTag = '';
    if (!isBot) {
      const apvPct = Math.round(Math.min(100, Math.max(0, (approvalVote+8)/16*100)));
      let apvColor;
      if (approvalVote>1) apvColor='#00ffe5';
      else if (approvalVote<-1) apvColor='#ff4800';
      else apvColor='#4a4a7a';
      const apvNum = approvalVote>0 ? '+'+approvalVote.toFixed(1) : approvalVote.toFixed(1);
      apvTag = `<span class="feed-apv"><span class="feed-apv-bar"><span class="feed-apv-fill" style="width:${apvPct}%;background:${apvColor}"></span></span><span class="feed-apv-num" style="color:${apvColor}">${apvNum}</span></span>`;
    }
    el.innerHTML = `<span class="feed-user">${esc(safeUser)}</span><span class="feed-msg">${renderEmotes(esc(safeMsg))}</span>${moodTag}${apvTag}`;
    frag.appendChild(el);
  }
  list.appendChild(frag);
  while (list.children.length > 60) list.removeChild(list.firstChild);
  list.scrollTop = list.scrollHeight;
}

// =============================================================
//  OUTLIER (STANDOUT) FEED — rendering
// =============================================================
const outlierPending = [];
let outlierRafId = null;

function addOutlierItem(user, msg, mood, approvalVote) {
  outlierPending.push({ user, msg, mood, approvalVote:approvalVote||0 });
  if (!outlierRafId) outlierRafId = requestAnimationFrame(flushOutlierFeed);
}

function flushOutlierFeed() {
  outlierRafId = null;
  const list = document.getElementById('outlierFeedList');
  const frag = document.createDocumentFragment();
  for (const { user, msg, mood, approvalVote } of outlierPending.splice(0,25)) {
    const el = document.createElement('div');
    el.className = 'feed-item';
    const safeUser = sanitize(user);
    const safeMsg  = sanitize(msg);
    const moodTag = `<span class="feed-mood mood-${mood}">${mood}</span>`;
    const apvPct = Math.round(Math.min(100, Math.max(0, (approvalVote+8)/16*100)));
    let apvColor;
    if (approvalVote>1) apvColor='#00ffe5';
    else if (approvalVote<-1) apvColor='#ff4800';
    else apvColor='#4a4a7a';
    const apvNum = approvalVote>0 ? '+'+approvalVote.toFixed(1) : approvalVote.toFixed(1);
    const apvTag = `<span class="feed-apv"><span class="feed-apv-bar"><span class="feed-apv-fill" style="width:${apvPct}%;background:${apvColor}"></span></span><span class="feed-apv-num" style="color:${apvColor}">${apvNum}</span></span>`;
    el.innerHTML = `<span class="feed-user">${esc(safeUser)}</span><span class="feed-msg">${renderEmotes(esc(safeMsg))}</span>${moodTag}${apvTag}`;
    frag.appendChild(el);
  }
  list.appendChild(frag);
  while (list.children.length > 40) list.removeChild(list.firstChild);
  list.scrollTop = list.scrollHeight;
}

// =============================================================
//  MAIN PROCESSING LOOP
// =============================================================
function processingLoop() {
  rafHandle = requestAnimationFrame(processingLoop);
  frameIdx++;
  const now = Date.now();
  const burst = msgQueue.length>500?400:msgQueue.length>100?200:120;
  const n = Math.min(msgQueue.length, burst);

  for (let i = 0; i < n; i++) {
    const { user, msg, ts } = msgQueue.shift();
    if (botFilterEnabled) {
      const { botScore, isBot } = detectBot(user, msg, ts);
      if (isBot) {
        botMessagesFiltered++;
        botUsersDetected.add(user);
        if (i%5===0) { addFeedItem(user, msg, 'bot', botScore, 0); addFilteredFeedItem(user, msg, 'bot', botScore, 0); }
        continue;
      }
    }
    const { mood, strength, hits, approvalVote } = classifyMessage(msg);
    scoredMessages.push({ ts, mood, strength });
    uniqueUsers.add(user);
    totalMessages++;
    msgTimestamps.push(ts);
    if (approvalVote !== 0) approvalStore.push({ ts, vote:approvalVote });
    for (const { label, mood:m, weight } of hits) {
      if (!keywordStore.has(label)) keywordStore.set(label, []);
      keywordStore.get(label).push({ ts, w:weight, mood:m });
    }
    if (i%5===0) { addFeedItem(user, msg, mood, 0, approvalVote); addFilteredFeedItem(user, msg, mood, 0, approvalVote); }
    // Outlier detection: flag messages whose mood is underrepresented
    if (mood !== 'neutral' && strength >= 1.0 && totalMessages > 20) {
      const pct = computeWeightedMoods(ts);
      if (pct && pct[mood] < 15) {
        addOutlierItem(user, msg, mood, approvalVote);
      }
    }
  }

  if (frameIdx%8===0) updateVisuals();
  if (now-lastTimelineTs >= TIMELINE_INTERVAL) { pushTimelineSnapshot(); pushApprovalTimelineSnapshot(); pushThroughputTimelineSnapshot(); lastTimelineTs=now; }
}

// =============================================================
//  CHANNEL HISTORY — localStorage persistence
// =============================================================
const CHANNEL_HISTORY_KEY = 'moodradar_channels_v1';
const CHANNEL_HISTORY_MAX = 20;

function loadChannelHistory() {
  try { return JSON.parse(localStorage.getItem(CHANNEL_HISTORY_KEY) || '[]'); }
  catch(e) { return []; }
}

function saveChannelToHistory(name) {
  const clean = name.replace(/^#/,'').toLowerCase().trim();
  if (!clean) return;
  let hist = loadChannelHistory();
  hist = hist.filter(h => h !== clean);
  hist.unshift(clean);
  if (hist.length > CHANNEL_HISTORY_MAX) hist = hist.slice(0, CHANNEL_HISTORY_MAX);
  try { localStorage.setItem(CHANNEL_HISTORY_KEY, JSON.stringify(hist)); } catch(e) {}
}

function deleteChannelFromHistory(name, slotId) {
  let hist = loadChannelHistory().filter(h => h !== name);
  try { localStorage.setItem(CHANNEL_HISTORY_KEY, JSON.stringify(hist)); } catch(e) {}
  renderChannelHistory(slotId != null ? slotId : 0);
}

function renderChannelHistory(slotId) {
  const dropdown = document.getElementById('channelHistoryDropdown_' + slotId);
  const input = document.getElementById('channelInput_' + slotId);
  if (!dropdown || !input) return;
  const hist = loadChannelHistory();
  const filter = sanitize(input.value.trim().toLowerCase().replace(/^#/,''));
  const filtered = filter ? hist.filter(h => h.startsWith(filter)) : hist;

  if (filtered.length === 0) {
    dropdown.innerHTML = '<div class="history-empty">No saved channels</div>';
    return;
  }

  dropdown.innerHTML = filtered.map(name =>
    `<div class="history-item" onmousedown="selectChannel(${slotId},'${esc(name)}')">
      <span class="history-item-name">${esc(name)}</span>
      <button class="history-delete" onmousedown="event.stopPropagation();deleteChannelFromHistory('${esc(name)}',${slotId})" title="Remove">\u00d7</button>
    </div>`
  ).join('');
}

function openChannelHistory(slotId) {
  renderChannelHistory(slotId);
  const dd = document.getElementById('channelHistoryDropdown_' + slotId);
  if (dd) dd.classList.add('open');
}

function closeChannelHistory(slotId) {
  const dd = document.getElementById('channelHistoryDropdown_' + slotId);
  if (dd) dd.classList.remove('open');
}

function selectChannel(slotId, name) {
  const input = document.getElementById('channelInput_' + slotId);
  if (input) input.value = name;
  closeChannelHistory(slotId);
}

function handleChannelKey(slotId, e) {
  if (e.key === 'Escape') { closeChannelHistory(slotId); return; }
  if (e.key === 'Enter')  { closeChannelHistory(slotId); connectSlot(slotId); return; }
}

// Close all dropdowns when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.input-wrap')) {
    for (const conn of connections) closeChannelHistory(conn.id);
  }
});

// =============================================================
//  MULTI-FEED CONNECTION — slot model + multi-platform support
// =============================================================
const MAX_FEEDS = 10;
const RECONNECT_DELAY_MS = 10_000;
const connections = [];
let slotIdCounter = 0;

const PLATFORM_PLACEHOLDERS = {
  twitch: 'channel name', kick: 'channel name',
  youtube: 'channel name, @handle, or video URL', rumble: 'stream ID or channel'
};
const PLATFORM_PREFIXES = {
  twitch: '#', kick: '#', youtube: '\u25b6', rumble: '\u25b6'
};

function createSlot(id) {
  return {
    id,
    platform: 'twitch',
    channel: '',
    ws: null,
    pollTimer: null,
    loggingActive: false,
    reconnectAttempt: 0,
    reconnectTimer: null,
    currentRoomId: null,
    channelName: '',
    status: 'idle',
    bttvEmotes: new Map(),
    seventvEmotes: new Map(),
    ffzEmotes: new Map(),
  };
}

function getSlot(slotId) {
  return connections.find(c => c.id === slotId);
}

function anySlotActive() {
  return connections.some(c => c.loggingActive);
}

function updatePrimaryRoomId() {
  const twitchSlot = connections.find(c => c.platform === 'twitch' && c.loggingActive && c.currentRoomId);
  currentRoomId = twitchSlot ? twitchSlot.currentRoomId : null;
  currentChannelName = twitchSlot ? twitchSlot.channelName : '';
}

// --- Per-slot status ---
function setSlotStatus(slotId, text, cls) {
  const dot = document.getElementById('slotDot_' + slotId);
  const txt = document.getElementById('slotStatusText_' + slotId);
  if (dot) {
    dot.className = 'slot-dot' + (cls ? ' slot-dot-' + cls : '');
  }
  if (txt) txt.textContent = text;
  updateGlobalStatus();
}

function updateGlobalStatus() {
  const live = connections.filter(c => c.status === 'live');
  const active = connections.filter(c => c.loggingActive);
  const bar = document.getElementById('statusBar');
  if (!bar) return;
  if (live.length === 0 && active.length === 0) {
    bar.innerHTML = 'Enter a channel name and connect';
    bar.className = 'status-bar';
  } else if (live.length === active.length && live.length > 0) {
    const names = live.map(c => c.channelName.toUpperCase()).join(', ');
    bar.innerHTML = '<span class="live-dot"></span>' + live.length + '/' + active.length + ' FEEDS LIVE \u2014 ' + names;
    bar.className = 'status-bar live';
  } else {
    bar.innerHTML = live.length + '/' + active.length + ' feeds connected';
    bar.className = 'status-bar' + (live.length > 0 ? ' live' : '');
  }
  // Disconnected pulsing border when any active slot has error
  const anyError = connections.some(c => c.loggingActive && (c.status === 'error' || c.status === 'reconnecting'));
  document.body.classList.toggle('disconnected', anyError);
}

// --- Per-slot disconnected/reconnect logic ---
function setSlotDisconnectedState(slotId, shouldReconnect) {
  const conn = getSlot(slotId);
  if (!conn) return;
  if (shouldReconnect && conn.loggingActive) {
    conn.reconnectAttempt++;
    conn.status = 'reconnecting';
    setSlotStatus(slotId, 'Reconnecting (attempt ' + conn.reconnectAttempt + ')...', 'reconnecting');
    conn.reconnectTimer = setTimeout(() => {
      if (conn.loggingActive) connectSlot(slotId, true);
    }, RECONNECT_DELAY_MS);
  }
}

// =============================================================
//  CORS Proxy Utility — tries multiple proxies for cross-origin
// =============================================================
async function fetchViaCorsProxy(url, timeoutMs, fetchOptions) {
  timeoutMs = timeoutMs || 10000;
  fetchOptions = fetchOptions || {};
  var isPost = fetchOptions.method && fetchOptions.method.toUpperCase() === 'POST';
  var enc = encodeURIComponent(url);
  // Build proxy list — POST-safe proxies first for POST requests
  var attempts;
  if (isPost) {
    attempts = [
      url,
      'https://corsproxy.io/?' + enc,
      'https://api.allorigins.win/raw?url=' + enc,
      'https://cors-anywhere.herokuapp.com/' + url,
      'https://crossorigin.me/' + url,
    ];
  } else {
    attempts = [
      url,
      'https://corsproxy.io/?' + enc,
      'https://api.allorigins.win/raw?url=' + enc,
      'https://api.codetabs.com/v1/proxy?quest=' + enc,
      'https://cors-anywhere.herokuapp.com/' + url,
      'https://crossorigin.me/' + url,
    ];
  }
  for (var i = 0; i < attempts.length; i++) {
    try {
      var controller = new AbortController();
      var timer = setTimeout(function() { controller.abort(); }, timeoutMs);
      var opts = {};
      for (var k in fetchOptions) { if (fetchOptions.hasOwnProperty(k)) opts[k] = fetchOptions[k]; }
      opts.signal = controller.signal;
      var res = await fetch(attempts[i], opts);
      clearTimeout(timer);
      if (res.ok) {
        if (i > 0) console.log('[MoodRadar] CORS proxy succeeded: ' + attempts[i].split('?')[0]);
        return res;
      }
      console.warn('[MoodRadar] Proxy returned HTTP ' + res.status + ': ' + attempts[i].split('?')[0]);
    } catch (e) {
      console.warn('[MoodRadar] Proxy failed (' + (e.name || 'error') + '): ' + attempts[i].split('?')[0]);
    }
  }
  console.error('[MoodRadar] All CORS proxies failed for: ' + url);
  return null;
}

// =============================================================
//  CONNECT / DISCONNECT — multi-platform, multi-slot
// =============================================================
function connectSlot(slotId, isReconnect) {
  const conn = getSlot(slotId);
  if (!conn) return;
  const input = document.getElementById('channelInput_' + slotId);
  const raw = sanitize((input ? input.value : '').trim().toLowerCase());
  if (!raw) { setSlotStatus(slotId, 'Enter a name', 'error'); return; }

  // Block duplicates
  const dup = connections.find(c => c.id !== slotId && c.loggingActive && c.platform === conn.platform && c.channelName === raw);
  if (dup) { setSlotStatus(slotId, 'Already connected', 'error'); return; }

  // Close existing connection for this slot
  if (conn.ws) { conn.ws.close(); conn.ws = null; }
  if (conn.pollTimer) { clearTimeout(conn.pollTimer); conn.pollTimer = null; }

  if (!isReconnect) {
    conn.reconnectAttempt = 0;
    // Only init charts on the very first connection
    if (!connections.some(c => c.loggingActive)) initCharts();
  }

  conn.loggingActive = true;
  conn.channelName = raw;
  conn.status = 'connecting';
  clearTimeout(conn.reconnectTimer);
  setSlotStatus(slotId, 'Connecting...', 'connecting');

  const connectBtn = document.getElementById('slotConnectBtn_' + slotId);
  if (connectBtn) connectBtn.disabled = true;

  console.log('[MoodRadar] Connecting slot ' + slotId + ' — platform: ' + conn.platform + ', channel: ' + conn.channelName);
  if (conn.platform === 'twitch') connectTwitch(conn);
  else if (conn.platform === 'kick') connectKick(conn);
  else if (conn.platform === 'youtube') connectYouTube(conn);
  else if (conn.platform === 'rumble') connectRumble(conn);
}

// --- Twitch IRC WebSocket ---
function connectTwitch(conn) {
  const channel = conn.channelName.startsWith('#') ? conn.channelName : '#' + conn.channelName;
  conn.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
  conn.ws.onopen = () => {
    conn.ws.send('CAP REQ :twitch.tv/commands twitch.tv/tags');
    conn.ws.send('PASS SCHMOOPIIE');
    conn.ws.send('NICK justinfan' + (Math.random() * 80000 + 1000 | 0));
    conn.ws.send('JOIN ' + channel);
  };
  conn.ws.onmessage = (event) => {
    const now = Date.now();
    const lines = event.data.split('\r\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      if (line.startsWith('PING')) { conn.ws.send('PONG :tmi.twitch.tv'); continue; }
      if (line.includes('ROOMSTATE') && !conn.currentRoomId) {
        const roomMatch = line.match(/room-id=(\d+)/);
        if (roomMatch) {
          conn.currentRoomId = roomMatch[1];
          updatePrimaryRoomId();
          loadSlotEmotes(conn);
        }
      }
      if (line.includes('366') || (line.includes('JOIN') && line.includes(channel))) {
        conn.reconnectAttempt = 0;
        conn.status = 'live';
        saveChannelToHistory(conn.channelName);
        setSlotStatus(conn.id, 'LIVE', 'live');
        if (!rafHandle) { lastTimelineTs = now; rafHandle = requestAnimationFrame(processingLoop); }
      }
      if (!line.includes('PRIVMSG')) continue;
      const privIdx = line.indexOf('PRIVMSG'), colonIdx = line.indexOf(':', privIdx);
      if (colonIdx < 0) continue;
      const msgText = line.slice(colonIdx + 1);
      const atStart = line.charCodeAt(0) === 64;
      const userStart = atStart ? line.indexOf(' :') + 2 : 1;
      const bangIdx = line.indexOf('!', userStart);
      if (bangIdx < 0) continue;
      const user = line.slice(userStart, bangIdx);
      tsThroughput.push(now);
      enqueue(user, msgText, now);
    }
  };
  conn.ws.onerror = () => {
    const btn = document.getElementById('slotConnectBtn_' + conn.id);
    if (btn) btn.disabled = false;
    setSlotDisconnectedState(conn.id, true);
  };
  conn.ws.onclose = () => {
    const btn = document.getElementById('slotConnectBtn_' + conn.id);
    if (btn) btn.disabled = false;
    setSlotDisconnectedState(conn.id, conn.loggingActive);
  };
}

// --- Kick Pusher WebSocket ---
async function connectKick(conn) {
  var slug = conn.channelName;
  setSlotStatus(conn.id, 'Resolving...', 'connecting');
  console.info('[MoodRadar][Kick] Kick connection uses unofficial Pusher WebSocket. No official API available.');
  console.log('[MoodRadar][Kick] Resolving channel: ' + slug);
  var btn = document.getElementById('slotConnectBtn_' + conn.id);
  var chatroomId = null;

  // Support direct numeric chatroom ID input (bypasses channel resolution)
  if (/^\d+$/.test(slug)) {
    chatroomId = parseInt(slug, 10);
    console.log('[MoodRadar][Kick] Using direct chatroom ID: ' + chatroomId);
  } else {
    // Resolve slug → chatroom ID via Kick API with CORS proxy fallbacks
    var kickApis = [
      'https://kick.com/api/v2/channels/' + encodeURIComponent(slug),
      'https://kick.com/api/v1/channels/' + encodeURIComponent(slug),
    ];
    for (var a = 0; a < kickApis.length && !chatroomId; a++) {
      try {
        console.log('[MoodRadar][Kick] Trying API: ' + kickApis[a]);
        var res = await fetchViaCorsProxy(kickApis[a], 12000);
        if (res) {
          var data = await res.json();
          console.log('[MoodRadar][Kick] API response keys:', Object.keys(data));
          chatroomId = (data.chatroom && data.chatroom.id) || data.chatroom_id || null;
          if (chatroomId) console.log('[MoodRadar][Kick] Resolved chatroom ID: ' + chatroomId);
        }
      } catch (e) {
        console.warn('[MoodRadar][Kick] API attempt failed:', e.message);
      }
    }
  }

  if (!chatroomId) {
    conn.loggingActive = false;
    conn.status = 'error';
    console.error('[MoodRadar][Kick] Channel resolution failed for: ' + slug);
    setSlotStatus(conn.id, 'Channel not found. Try numeric chatroom ID.', 'error');
    if (btn) btn.disabled = false;
    return;
  }

  // Try connecting with known Pusher keys (Kick has rotated keys historically)
  var pusherKeys = ['eb1d5f283081a78b932c', '32cbd69e4b950bf97679'];
  var connected = false;

  for (var ki = 0; ki < pusherKeys.length && !connected; ki++) {
    var pusherKey = pusherKeys[ki];
    var wsUrl = 'wss://ws-us2.pusher.com/app/' + pusherKey + '?protocol=7&client=js&version=7.6.0&flash=false';
    console.log('[MoodRadar][Kick] Trying Pusher key ' + (ki + 1) + '/' + pusherKeys.length + ': ' + pusherKey.slice(0, 8) + '...');

    connected = await new Promise(function(resolve) {
      if (conn.ws) { conn.ws.close(); conn.ws = null; }
      conn.ws = new WebSocket(wsUrl);
      var handshakeTimer = setTimeout(function() {
        console.warn('[MoodRadar][Kick] Pusher handshake timeout for key ' + pusherKey.slice(0, 8) + '...');
        if (conn.ws) { conn.ws.close(); conn.ws = null; }
        resolve(false);
      }, 15000);

      conn.ws.onmessage = function(event) {
        try {
          var data = JSON.parse(event.data);
          console.log('[MoodRadar][Kick] Pusher event: ' + data.event);
          if (data.event === 'pusher:connection_established') {
            clearTimeout(handshakeTimer);
            console.log('[MoodRadar][Kick] Pusher connected, subscribing to chatrooms.' + chatroomId + '.v2');
            conn.ws.send(JSON.stringify({
              event: 'pusher:subscribe',
              data: { channel: 'chatrooms.' + chatroomId + '.v2' }
            }));
            // Set a subscription timeout
            handshakeTimer = setTimeout(function() {
              console.warn('[MoodRadar][Kick] Subscription timeout — no subscription_succeeded received');
              // Still resolve true — connection works, subscription might just not send ack
              resolve(true);
            }, 10000);
          }
          if (data.event === 'pusher_internal:subscription_succeeded') {
            clearTimeout(handshakeTimer);
            console.log('[MoodRadar][Kick] Subscription succeeded');
            resolve(true);
          }
          if (data.event === 'pusher:error') {
            console.error('[MoodRadar][Kick] Pusher error:', data.data);
            clearTimeout(handshakeTimer);
            if (conn.ws) { conn.ws.close(); conn.ws = null; }
            resolve(false);
          }
        } catch (e) { /* ignore parse errors */ }
      };
      conn.ws.onerror = function() {
        clearTimeout(handshakeTimer);
        console.warn('[MoodRadar][Kick] WebSocket error for key ' + pusherKey.slice(0, 8) + '...');
        resolve(false);
      };
      conn.ws.onclose = function() {
        clearTimeout(handshakeTimer);
      };
    });
  }

  if (!connected || !conn.ws) {
    conn.loggingActive = false;
    conn.status = 'error';
    console.error('[MoodRadar][Kick] All Pusher keys failed');
    setSlotStatus(conn.id, 'Pusher connection failed. Kick may have changed their API.', 'error');
    if (btn) btn.disabled = false;
    return;
  }

  // Connected — set up persistent message handler
  conn.reconnectAttempt = 0;
  conn.status = 'live';
  saveChannelToHistory(conn.channelName);
  setSlotStatus(conn.id, 'LIVE', 'live');
  if (btn) btn.disabled = false;
  if (!rafHandle) { lastTimelineTs = Date.now(); rafHandle = requestAnimationFrame(processingLoop); }

  conn.ws.onmessage = function(event) {
    try {
      var data = JSON.parse(event.data);
      if (data.event === 'App\\Events\\ChatMessageEvent') {
        var msgData = JSON.parse(data.data);
        var user = (msgData.sender && (msgData.sender.username || msgData.sender.slug)) || 'unknown';
        var msg = msgData.content || '';
        if (msg) {
          var now = Date.now();
          tsThroughput.push(now);
          enqueue(user, msg, now);
        }
      }
      if (data.event === 'pusher:ping') {
        conn.ws.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
      }
    } catch (e) { /* ignore parse errors */ }
  };
  conn.ws.onerror = function() {
    console.warn('[MoodRadar][Kick] WebSocket error on live connection');
    if (btn) btn.disabled = false;
    setSlotDisconnectedState(conn.id, true);
  };
  conn.ws.onclose = function() {
    console.log('[MoodRadar][Kick] WebSocket closed');
    if (btn) btn.disabled = false;
    setSlotDisconnectedState(conn.id, conn.loggingActive);
  };
}

// --- YouTube Live Chat ---
// Uses innertube JSON APIs via CORS proxy — no API key required.
// Channel names, @handles, and URLs are all resolved to video IDs.

// Known YouTube innertube API key (public, embedded in YouTube's frontend)
var YT_INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
var YT_CLIENT_VERSION = '2.20260414.01.00';

function _ytParseVideoId(input) {
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  var m = input.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ||
          input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/) ||
          input.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

// Resolve a channel name/@handle to a live video ID.
// Strategy 1: innertube search API (JSON POST, no HTML scraping)
// Strategy 2: scrape channel /live page via CORS proxy
async function _ytResolveChannelToLive(input, statusCb) {
  var raw = input.trim();

  // --- Strategy 1: Innertube search API ---
  // Search for "{channel} live" with live stream filter (params "EgJAAQ==")
  if (statusCb) statusCb('Searching for live stream...');
  try {
    var searchBody = JSON.stringify({
      context: { client: { clientName: 'WEB', clientVersion: YT_CLIENT_VERSION } },
      query: raw + ' live',
      params: 'EgJAAQ=='
    });
    var searchRes = await fetchViaCorsProxy(
      'https://www.youtube.com/youtubei/v1/search?key=' + YT_INNERTUBE_KEY,
      15000,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: searchBody }
    );
    if (searchRes) {
      var searchData = await searchRes.json();
      try {
        var sections = searchData.contents &&
          searchData.contents.twoColumnSearchResultsRenderer &&
          searchData.contents.twoColumnSearchResultsRenderer.primaryContents &&
          searchData.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer &&
          searchData.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents;
        if (sections) {
          // First pass: find a result with a LIVE badge
          for (var s = 0; s < sections.length; s++) {
            var items = sections[s].itemSectionRenderer && sections[s].itemSectionRenderer.contents;
            if (!items) continue;
            for (var i = 0; i < items.length; i++) {
              var vr = items[i].videoRenderer;
              if (!vr || !vr.videoId) continue;
              var isLive = false;
              if (vr.badges) {
                for (var b = 0; b < vr.badges.length; b++) {
                  var lbl = vr.badges[b].metadataBadgeRenderer && vr.badges[b].metadataBadgeRenderer.label;
                  if (lbl && lbl.toUpperCase().indexOf('LIVE') !== -1) isLive = true;
                }
              }
              if (vr.thumbnailOverlays) {
                for (var o = 0; o < vr.thumbnailOverlays.length; o++) {
                  var sty = vr.thumbnailOverlays[o].thumbnailOverlayTimeStatusRenderer &&
                            vr.thumbnailOverlays[o].thumbnailOverlayTimeStatusRenderer.style;
                  if (sty === 'LIVE') isLive = true;
                }
              }
              if (isLive) return vr.videoId;
            }
          }
          // Second pass: return first video result as best guess
          for (var s2 = 0; s2 < sections.length; s2++) {
            var items2 = sections[s2].itemSectionRenderer && sections[s2].itemSectionRenderer.contents;
            if (!items2) continue;
            for (var i2 = 0; i2 < items2.length; i2++) {
              if (items2[i2].videoRenderer && items2[i2].videoRenderer.videoId) return items2[i2].videoRenderer.videoId;
            }
          }
        }
      } catch (e) { /* parse error, fall through */ }
    }
  } catch (e) { /* search failed, try page scraping */ }

  // --- Strategy 2: Scrape channel /live page via CORS proxy ---
  var urls = [];
  if (/^https?:\/\//.test(raw)) urls.push(raw);
  var handle = raw.startsWith('@') ? raw : '@' + raw.replace(/\s+/g, '');
  urls.push('https://www.youtube.com/' + handle + '/live');
  var slug = raw.replace(/^@/, '').replace(/\s+/g, '');
  urls.push('https://www.youtube.com/c/' + slug + '/live');

  for (var u = 0; u < urls.length; u++) {
    if (statusCb) statusCb('Trying channel page (' + (u + 1) + '/' + urls.length + ')...');
    try {
      var res = await fetchViaCorsProxy(urls[u], 12000);
      if (!res) continue;
      var html = await res.text();
      var liveMatch = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"[^}]*?"isLive"\s*:\s*true/);
      if (liveMatch) return liveMatch[1];
      if (urls[u].indexOf('/live') !== -1) {
        var vidMatch = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
        if (vidMatch) return vidMatch[1];
      }
    } catch (e) { /* try next */ }
  }
  return null;
}

function _ytExtractMessages(actions) {
  var msgs = [];
  for (var i = 0; i < (actions || []).length; i++) {
    var action = actions[i];
    var item = (action.addChatItemAction && action.addChatItemAction.item) || null;
    if (!item && action.replayChatItemAction && action.replayChatItemAction.actions) {
      var inner = action.replayChatItemAction.actions[0];
      item = inner && inner.addChatItemAction && inner.addChatItemAction.item;
    }
    var renderer = item && (item.liveChatTextMessageRenderer || item.liveChatPaidMessageRenderer);
    if (!renderer) continue;
    var user = (renderer.authorName && renderer.authorName.simpleText) || 'unknown';
    var runs = (renderer.message && renderer.message.runs) || [];
    var msg = '';
    for (var r = 0; r < runs.length; r++) {
      msg += runs[r].text || (runs[r].emoji && runs[r].emoji.emojiId) || '';
    }
    if (msg) msgs.push({ user: user, msg: msg });
  }
  return msgs;
}

// Extract a chat continuation token from a nested innertube response object
function _ytFindContinuation(obj) {
  if (!obj) return null;
  // liveChatRenderer path (from 'next' or chat page responses)
  try {
    var conts = obj.contents && obj.contents.liveChatRenderer && obj.contents.liveChatRenderer.continuations;
    if (conts && conts[0]) {
      return (conts[0].invalidationContinuationData && conts[0].invalidationContinuationData.continuation) ||
             (conts[0].timedContinuationData && conts[0].timedContinuationData.continuation) ||
             (conts[0].reloadContinuationData && conts[0].reloadContinuationData.continuation) || null;
    }
  } catch(e) {}
  // conversationBar path (from 'next' endpoint for video pages)
  try {
    var bar = obj.contents && obj.contents.twoColumnWatchNextResults && obj.contents.twoColumnWatchNextResults.conversationBar;
    var chatRenderer = bar && bar.liveChatRenderer;
    if (chatRenderer && chatRenderer.continuations && chatRenderer.continuations[0]) {
      return (chatRenderer.continuations[0].reloadContinuationData && chatRenderer.continuations[0].reloadContinuationData.continuation) ||
             (chatRenderer.continuations[0].invalidationContinuationData && chatRenderer.continuations[0].invalidationContinuationData.continuation) ||
             (chatRenderer.continuations[0].timedContinuationData && chatRenderer.continuations[0].timedContinuationData.continuation) || null;
    }
  } catch(e) {}
  return null;
}

async function connectYouTube(conn) {
  setSlotStatus(conn.id, 'Resolving...', 'connecting');
  console.info('[MoodRadar][YouTube] YouTube connection uses unofficial methods. For compliant access, use a YouTube Data API v3 key.');
  console.log('[MoodRadar][YouTube] Connecting for: ' + conn.channelName);
  var btn = document.getElementById('slotConnectBtn_' + conn.id);

  // Try to parse as a direct video ID or video URL first
  var videoId = _ytParseVideoId(conn.channelName);
  if (videoId) console.log('[MoodRadar][YouTube] Parsed video ID: ' + videoId);

  // If not a video ID, treat as channel name/@handle and resolve to live stream
  if (!videoId) {
    setSlotStatus(conn.id, 'Looking for live stream...', 'connecting');
    console.log('[MoodRadar][YouTube] Resolving channel to live stream...');
    videoId = await _ytResolveChannelToLive(conn.channelName, function(msg) {
      setSlotStatus(conn.id, msg, 'connecting');
    });
    if (!videoId) {
      conn.loggingActive = false;
      conn.status = 'error';
      console.error('[MoodRadar][YouTube] No live stream found for: ' + conn.channelName);
      setSlotStatus(conn.id, 'No live stream found for this channel', 'error');
      if (btn) btn.disabled = false;
      return;
    }
    console.log('[MoodRadar][YouTube] Resolved to video ID: ' + videoId);
  }

  // === Approach 1: Innertube 'next' API — get chat continuation token ===
  // This calls YouTube's JSON API directly (no HTML scraping) so it works
  // reliably through CORS proxies without hitting consent/bot pages.
  var continuation = null;

  try {
    setSlotStatus(conn.id, 'Connecting to chat...', 'connecting');
    console.log('[MoodRadar][YouTube] Approach 1: innertube next API (client version: ' + YT_CLIENT_VERSION + ')');
    var nextBody = JSON.stringify({
      context: { client: { clientName: 'WEB', clientVersion: YT_CLIENT_VERSION } },
      videoId: videoId
    });
    var nextRes = await fetchViaCorsProxy(
      'https://www.youtube.com/youtubei/v1/next?key=' + YT_INNERTUBE_KEY,
      15000,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: nextBody }
    );
    if (nextRes) {
      var nextData = await nextRes.json();
      continuation = _ytFindContinuation(nextData);
      if (continuation) console.log('[MoodRadar][YouTube] Got continuation token via innertube next');
      else console.warn('[MoodRadar][YouTube] innertube next returned data but no continuation token');
    } else {
      console.warn('[MoodRadar][YouTube] innertube next API call failed (all proxies)');
    }
  } catch (e) {
    console.warn('[MoodRadar][YouTube] Approach 1 error:', e.message);
  }

  // === Approach 2: Scrape live_chat page as fallback ===
  if (!continuation) {
    try {
      setSlotStatus(conn.id, 'Trying chat page...', 'connecting');
      console.log('[MoodRadar][YouTube] Approach 2: scraping live_chat page');
      var chatPageUrl = 'https://www.youtube.com/live_chat?is_popout=1&v=' + videoId;
      var pageRes = await fetchViaCorsProxy(chatPageUrl, 15000);
      if (pageRes) {
        var html = await pageRes.text();
        var m = html.match(/(?:var\s+ytInitialData|window\["ytInitialData"\])\s*=\s*(\{.+?\});\s*<\/script>/s);
        if (m) {
          try {
            continuation = _ytFindContinuation(JSON.parse(m[1]));
            if (continuation) console.log('[MoodRadar][YouTube] Got continuation token via chat page scraping');
          } catch(e) {
            console.warn('[MoodRadar][YouTube] Failed to parse ytInitialData from chat page');
          }
        } else {
          console.warn('[MoodRadar][YouTube] No ytInitialData found in chat page HTML');
        }
      } else {
        console.warn('[MoodRadar][YouTube] Chat page fetch failed (all proxies)');
      }
    } catch (e) {
      console.warn('[MoodRadar][YouTube] Approach 2 error:', e.message);
    }
  }

  if (continuation) {
    // Go live with innertube polling
    console.log('[MoodRadar][YouTube] LIVE — starting innertube polling for video ' + videoId);
    conn.status = 'live';
    conn.reconnectAttempt = 0;
    saveChannelToHistory(conn.channelName);
    setSlotStatus(conn.id, 'LIVE', 'live');
    if (btn) btn.disabled = false;
    if (!rafHandle) { lastTimelineTs = Date.now(); rafHandle = requestAnimationFrame(processingLoop); }

    var ytCtx = { cont: continuation, attempt: 0 };
    function pollInnertube() {
      if (!conn.loggingActive) return;
      var body = JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: YT_CLIENT_VERSION } },
        continuation: ytCtx.cont
      });
      fetchViaCorsProxy(
        'https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=' + YT_INNERTUBE_KEY,
        12000,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body }
      ).then(function(res) {
        if (!res) throw new Error('all proxies failed');
        return res.json();
      }).then(function(data) {
        var liveChatCont = data.continuationContents && data.continuationContents.liveChatContinuation;
        if (!liveChatCont) throw new Error('no chat data');

        var actions = liveChatCont.actions || [];
        var msgs = _ytExtractMessages(actions);
        var ts = Date.now();
        for (var m = 0; m < msgs.length; m++) {
          tsThroughput.push(ts);
          enqueue(msgs[m].user, msgs[m].msg, ts);
        }

        var conts = liveChatCont.continuations;
        if (conts && conts[0]) {
          ytCtx.cont = (conts[0].invalidationContinuationData && conts[0].invalidationContinuationData.continuation) ||
                       (conts[0].timedContinuationData && conts[0].timedContinuationData.continuation) ||
                       (conts[0].reloadContinuationData && conts[0].reloadContinuationData.continuation) ||
                       ytCtx.cont;
        }

        var interval = 5000;
        if (conts && conts[0] && conts[0].timedContinuationData && conts[0].timedContinuationData.timeoutMs) {
          interval = parseInt(conts[0].timedContinuationData.timeoutMs) || 5000;
        }

        ytCtx.attempt = 0;
        if (conn.loggingActive) conn.pollTimer = setTimeout(pollInnertube, Math.max(interval, 2000));
      }).catch(function(e) {
        ytCtx.attempt++;
        console.warn('[MoodRadar][YouTube] Poll error (attempt ' + ytCtx.attempt + '/5):', e.message);
        if (ytCtx.attempt < 5 && conn.loggingActive) {
          conn.pollTimer = setTimeout(pollInnertube, 8000);
        } else {
          conn.status = 'error';
          console.error('[MoodRadar][YouTube] Polling gave up after 5 attempts');
          setSlotStatus(conn.id, 'Poll failed — check console for details', 'error');
          conn.loggingActive = false;
        }
      });
    }
    pollInnertube();
    return;
  }

  // === Approach 3: YouTube Data API v3 (requires API key in localStorage) ===
  console.log('[MoodRadar][YouTube] Approaches 1 & 2 failed. Trying API key fallback...');
  var YT_API_KEY_STORAGE = 'moodradar_yt_apikey_v1';
  var apiKey = '';
  try { apiKey = localStorage.getItem(YT_API_KEY_STORAGE) || ''; } catch(e) {}
  if (!apiKey) {
    conn.loggingActive = false;
    conn.status = 'error';
    setSlotStatus(conn.id, 'CORS proxies failed. Set API key in console.', 'error');
    console.log('%c[MoodRadar][YouTube] All CORS proxy methods failed.\n' +
      'To use YouTube, set a Data API v3 key:\n' +
      '  localStorage.setItem("moodradar_yt_apikey_v1", "YOUR_KEY")\n' +
      'Get a free key at console.cloud.google.com (enable YouTube Data API v3).', 'color: #ff4800; font-weight: bold');
    if (btn) btn.disabled = false;
    return;
  }

  setSlotStatus(conn.id, 'Resolving via API key...', 'connecting');
  var liveChatId;
  try {
    var res = await fetch('https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=' + videoId + '&key=' + apiKey);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    var items = data.items || [];
    liveChatId = items[0] && items[0].liveStreamingDetails && items[0].liveStreamingDetails.activeLiveChatId;
  } catch (e) {
    conn.loggingActive = false;
    conn.status = 'error';
    setSlotStatus(conn.id, 'Resolve failed', 'error');
    if (btn) btn.disabled = false;
    try { localStorage.removeItem(YT_API_KEY_STORAGE); } catch(e2) {}
    return;
  }

  if (!liveChatId) {
    conn.loggingActive = false;
    conn.status = 'error';
    setSlotStatus(conn.id, 'No live chat found', 'error');
    if (btn) btn.disabled = false;
    return;
  }

  conn.status = 'live';
  conn.reconnectAttempt = 0;
  saveChannelToHistory(conn.channelName);
  setSlotStatus(conn.id, 'LIVE', 'live');
  if (btn) btn.disabled = false;
  if (!rafHandle) { lastTimelineTs = Date.now(); rafHandle = requestAnimationFrame(processingLoop); }

  var nextPageToken = null;
  var ytPollAttempt = 0;
  async function pollYouTube() {
    if (!conn.loggingActive) return;
    var params = 'liveChatId=' + liveChatId + '&part=snippet,authorDetails&maxResults=200&key=' + apiKey +
      (nextPageToken ? '&pageToken=' + nextPageToken : '');
    try {
      var res = await fetch('https://www.googleapis.com/youtube/v3/liveChat/messages?' + params);
      if (!res.ok) {
        if (res.status === 403) {
          conn.status = 'error';
          setSlotStatus(conn.id, 'Quota exceeded', 'error');
          conn.loggingActive = false;
          return;
        }
        throw new Error('HTTP ' + res.status);
      }
      var data = await res.json();
      nextPageToken = data.nextPageToken || null;
      var interval = data.pollingIntervalMillis || 3000;
      var ts = Date.now();
      for (var i = 0; i < (data.items || []).length; i++) {
        var item = data.items[i];
        var user = (item.authorDetails && item.authorDetails.displayName) || 'unknown';
        var msg = (item.snippet && item.snippet.displayMessage) || '';
        if (msg) { tsThroughput.push(ts); enqueue(user, msg, ts); }
      }
      ytPollAttempt = 0;
      if (conn.loggingActive) conn.pollTimer = setTimeout(pollYouTube, Math.max(interval, 2000));
    } catch (e) {
      ytPollAttempt++;
      if (ytPollAttempt < 5 && conn.loggingActive) {
        conn.pollTimer = setTimeout(pollYouTube, 5000);
      } else {
        conn.status = 'error';
        setSlotStatus(conn.id, 'Poll failed', 'error');
        conn.loggingActive = false;
      }
    }
  }
  pollYouTube();
}

// --- Rumble REST polling ---
async function connectRumble(conn) {
  setSlotStatus(conn.id, 'Resolving...', 'connecting');
  console.info('[MoodRadar][Rumble] Rumble connection uses unofficial methods. No official API available.');
  console.log('[MoodRadar][Rumble] Connecting for: ' + conn.channelName);
  var btn = document.getElementById('slotConnectBtn_' + conn.id);
  var channelInput = conn.channelName;

  // --- Approach 1: Try to resolve chat ID from Rumble page via CORS proxy ---
  var chatId = null;
  var pageUrls = [
    'https://rumble.com/' + encodeURIComponent(channelInput),
    'https://rumble.com/c/' + encodeURIComponent(channelInput),
    'https://rumble.com/user/' + encodeURIComponent(channelInput),
  ];
  // If input looks like a full URL, try it directly
  if (channelInput.startsWith('http')) {
    pageUrls.unshift(channelInput);
  }
  // If input looks like a video ID (e.g., v4u3abc), prepend rumble.com
  if (/^v[a-z0-9]+$/i.test(channelInput)) {
    pageUrls.unshift('https://rumble.com/' + channelInput);
  }

  for (var p = 0; p < pageUrls.length && !chatId; p++) {
    try {
      setSlotStatus(conn.id, 'Trying Rumble page ' + (p + 1) + '/' + pageUrls.length + '...', 'connecting');
      console.log('[MoodRadar][Rumble] Trying page: ' + pageUrls[p]);
      var pageRes = await fetchViaCorsProxy(pageUrls[p], 12000);
      if (!pageRes) { console.warn('[MoodRadar][Rumble] No response for ' + pageUrls[p]); continue; }
      var html = await pageRes.text();
      // Look for chat ID patterns in the page HTML
      var chatMatch = html.match(/"chat_id"\s*:\s*(\d+)/) ||
                      html.match(/"chatId"\s*:\s*(\d+)/) ||
                      html.match(/data-chat-id="(\d+)"/) ||
                      html.match(/chatroom[_-]?id['"]\s*[:=]\s*['"]?(\d+)/i) ||
                      html.match(/"channel_id"\s*:\s*(\d+)/) ||
                      html.match(/chat\/api\/chat\/(\d+)/);
      if (chatMatch) {
        chatId = chatMatch[1];
        console.log('[MoodRadar][Rumble] Found chat ID: ' + chatId);
      } else {
        console.warn('[MoodRadar][Rumble] No chat ID found in page HTML (length: ' + html.length + ')');
      }
    } catch (e) {
      console.warn('[MoodRadar][Rumble] Page fetch error:', e.message);
    }
  }

  // --- Approach 2: If we found a chat ID, try direct polling via CORS proxy ---
  if (chatId) {
    console.log('[MoodRadar][Rumble] Starting direct polling with chat ID: ' + chatId);
    conn.status = 'live';
    conn.reconnectAttempt = 0;
    saveChannelToHistory(conn.channelName);
    setSlotStatus(conn.id, 'LIVE (direct)', 'live');
    if (btn) btn.disabled = false;
    if (!rafHandle) { lastTimelineTs = Date.now(); rafHandle = requestAnimationFrame(processingLoop); }

    var directPollAttempt = 0;
    var seenIds = new Set();
    async function pollRumbleDirect() {
      if (!conn.loggingActive) return;
      try {
        var chatUrl = 'https://rumble.com/chat/api/chat/' + chatId + '/messages';
        var res = await fetchViaCorsProxy(chatUrl, 10000);
        if (!res) throw new Error('proxy failed');
        var data = await res.json();
        var messages = data.messages || data.data || (Array.isArray(data) ? data : []);
        var ts = Date.now();
        for (var i = 0; i < messages.length; i++) {
          var item = messages[i];
          var msgId = item.id || (item.time + '_' + (item.username || ''));
          if (seenIds.has(msgId)) continue;
          seenIds.add(msgId);
          // Limit seen set size
          if (seenIds.size > 2000) { var iter = seenIds.values(); iter.next(); seenIds.delete(iter.next().value); }
          var user = item.username || (item.user && item.user.username) || item.name || 'unknown';
          var msg = item.text || item.message || item.content || '';
          if (msg) { tsThroughput.push(ts); enqueue(user, msg, ts); }
        }
        directPollAttempt = 0;
        if (conn.loggingActive) conn.pollTimer = setTimeout(pollRumbleDirect, 5000);
      } catch (e) {
        directPollAttempt++;
        if (directPollAttempt < 5 && conn.loggingActive) {
          conn.pollTimer = setTimeout(pollRumbleDirect, 8000);
        } else {
          conn.status = 'error';
          setSlotStatus(conn.id, 'Direct poll failed. Try custom proxy.', 'error');
          conn.loggingActive = false;
        }
      }
    }
    pollRumbleDirect();
    return;
  }

  // --- Approach 3: Fall back to custom proxy URL ---
  console.log('[MoodRadar][Rumble] Direct resolution failed. Trying custom proxy fallback.');
  var RUMBLE_PROXY_STORAGE = 'moodradar_rumble_proxy_v1';
  var proxyUrl = '';
  try { proxyUrl = localStorage.getItem(RUMBLE_PROXY_STORAGE) || ''; } catch(e) {}
  if (!proxyUrl) {
    // Prompt as last resort — explain what's needed
    proxyUrl = (prompt(
      'Could not resolve Rumble chat directly (CORS).\n\n' +
      'Rumble requires a proxy server to bypass browser restrictions.\n' +
      'Enter your proxy URL (e.g., https://your-proxy.web.app):\n\n' +
      'The proxy must implement: GET /rumble/messages?streamId=...\n' +
      'Your URL will be saved to localStorage for future use.'
    ) || '').trim();
    if (!proxyUrl) {
      conn.loggingActive = false;
      conn.status = 'error';
      setSlotStatus(conn.id, 'No proxy URL configured', 'error');
      if (btn) btn.disabled = false;
      return;
    }
    try { localStorage.setItem(RUMBLE_PROXY_STORAGE, proxyUrl); } catch(e) {}
  }

  // Validate proxy is reachable before going live
  setSlotStatus(conn.id, 'Testing proxy...', 'connecting');
  try {
    var testRes = await fetch(proxyUrl + '/rumble/messages?streamId=' + encodeURIComponent(channelInput), {
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
    });
    if (!testRes.ok) throw new Error('HTTP ' + testRes.status);
  } catch (e) {
    conn.loggingActive = false;
    conn.status = 'error';
    setSlotStatus(conn.id, 'Proxy unreachable (' + (e.message || 'error') + ')', 'error');
    if (btn) btn.disabled = false;
    // Clear stored proxy so user can try a different one next time
    try { localStorage.removeItem(RUMBLE_PROXY_STORAGE); } catch(e2) {}
    return;
  }

  conn.status = 'live';
  conn.reconnectAttempt = 0;
  saveChannelToHistory(conn.channelName);
  setSlotStatus(conn.id, 'LIVE (proxy)', 'live');
  if (btn) btn.disabled = false;
  if (!rafHandle) { lastTimelineTs = Date.now(); rafHandle = requestAnimationFrame(processingLoop); }

  // Start polling loop via custom proxy
  var lastMessageId = null;
  var rumblePollAttempt = 0;
  async function pollRumble() {
    if (!conn.loggingActive) return;
    var params = 'streamId=' + encodeURIComponent(conn.channelName) + (lastMessageId ? '&after=' + lastMessageId : '');
    try {
      var res = await fetch(proxyUrl + '/rumble/messages?' + params);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      var messages = data.messages || data.data || [];
      var ts = Date.now();
      for (var i = 0; i < messages.length; i++) {
        var item = messages[i];
        var user = item.username || (item.user && item.user.username) || 'unknown';
        var msg = item.text || item.message || '';
        if (item.id) lastMessageId = item.id;
        if (msg) { tsThroughput.push(ts); enqueue(user, msg, ts); }
      }
      rumblePollAttempt = 0;
      if (conn.loggingActive) conn.pollTimer = setTimeout(pollRumble, 5000);
    } catch (e) {
      rumblePollAttempt++;
      if (rumblePollAttempt < 5 && conn.loggingActive) {
        conn.pollTimer = setTimeout(pollRumble, 8000);
      } else {
        conn.status = 'error';
        setSlotStatus(conn.id, 'Poll failed', 'error');
        conn.loggingActive = false;
      }
    }
  }
  pollRumble();
}

// --- Disconnect ---
function disconnectSlot(slotId) {
  const conn = getSlot(slotId);
  if (!conn) return;
  conn.loggingActive = false;
  clearTimeout(conn.reconnectTimer);
  conn.reconnectAttempt = 0;
  conn.currentRoomId = null;
  conn.channelName = '';
  conn.status = 'idle';
  if (conn.ws) { conn.ws.close(); conn.ws = null; }
  if (conn.pollTimer) { clearTimeout(conn.pollTimer); conn.pollTimer = null; }
  conn.bttvEmotes.clear(); conn.seventvEmotes.clear(); conn.ffzEmotes.clear();
  mergeAllEmotes();
  updatePrimaryRoomId();
  setSlotStatus(slotId, '', '');
  const btn = document.getElementById('slotConnectBtn_' + slotId);
  if (btn) btn.disabled = false;
  // If no slots active, stop processing
  if (!anySlotActive()) {
    if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = null; }
    msgQueue.length = 0;
  }
}

function disconnectAll() {
  for (const conn of connections) {
    conn.loggingActive = false;
    clearTimeout(conn.reconnectTimer);
    conn.reconnectAttempt = 0;
    conn.currentRoomId = null;
    conn.channelName = '';
    conn.status = 'idle';
    if (conn.ws) { conn.ws.close(); conn.ws = null; }
    if (conn.pollTimer) { clearTimeout(conn.pollTimer); conn.pollTimer = null; }
    conn.bttvEmotes.clear(); conn.seventvEmotes.clear(); conn.ffzEmotes.clear();
    setSlotStatus(conn.id, '', '');
    const btn = document.getElementById('slotConnectBtn_' + conn.id);
    if (btn) btn.disabled = false;
  }
  mergeAllEmotes();
  updatePrimaryRoomId();
  if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = null; }
  msgQueue.length = 0;
  document.body.classList.remove('disconnected');
  setStatus('Disconnected.', '');
}

function flushChatterData() {
  // -- Data stores --
  scoredMessages.length = 0;
  keywordStore.clear();
  approvalStore.length = 0;
  msgQueue.length = 0;
  droppedMessages = 0;
  totalMessages = 0;
  uniqueUsers.clear();
  msgTimestamps.length = 0;
  tsThroughput.length = 0;
  prevDominant = null;
  frameIdx = 0;

  // -- Bot detection --
  userProfiles.clear();
  botMessagesFiltered = 0;
  botUsersDetected = new Set();

  // -- Approval display --
  approvalDisplayVal = 50;
  approvalHistory = Array(40).fill(50);

  // -- Bubbles --
  bubbles = [];

  // -- Feed pending queues --
  feedPending.length = 0;
  outlierPending.length = 0;
  filteredFeedPending.length = 0;

  // -- Reset timeline timestamp --
  lastTimelineTs = 0;

  // -- Pie chart: reset to initial (100% neutral) --
  if (pieChart) {
    pieChart.data.datasets[0].data = MOODS.map((_, i) => i === MOODS.length - 1 ? 100 : 0);
    pieChart.update('none');
  }

  // -- Radar chart: reset to all zeros --
  if (radarChart) {
    const moodsForWeb = MOODS.filter(m => m !== 'neutral');
    radarChart.data.datasets[0].data = moodsForWeb.map(() => 0);
    radarChart.options.scales.r.max = 10;
    radarChart.data.datasets[0].borderColor = '#00ffe5';
    radarChart.data.datasets[0].backgroundColor = 'rgba(0,255,229,.09)';
    radarChart.data.datasets[0].pointBackgroundColor = '#00ffe5';
    radarChart.update('none');
  }

  // -- Timeline charts: fill with null --
  [timelineLinearChart, timelineLogChart].filter(Boolean).forEach(ch => {
    ch.data.labels = Array(TIMELINE_POINTS).fill('');
    ch.data.datasets.forEach(ds => { ds.data = Array(TIMELINE_POINTS).fill(null); });
    ch.update('none');
  });
  if (timelineLinearChart) {
    timelineLinearChart.options.scales.y.max = 10;
  }

  // -- Approval timeline: reset --
  if (approvalTimelineChart) {
    approvalTimelineChart.data.labels = Array(TIMELINE_POINTS).fill('');
    approvalTimelineChart.data.datasets[0].data = Array(TIMELINE_POINTS).fill(null);
    approvalTimelineChart.data.datasets[0].borderColor = '#00ffe5';
    approvalTimelineChart.data.datasets[0].backgroundColor = 'rgba(0,255,229,.08)';
    approvalTimelineChart.update('none');
  }

  // -- Throughput timeline: reset --
  if (throughputTimelineChart) {
    throughputTimelineChart.data.labels = Array(TIMELINE_POINTS).fill('');
    throughputTimelineChart.data.datasets[0].data = Array(TIMELINE_POINTS).fill(null);
    throughputTimelineChart.data.datasets[0].borderColor = '#00ffe5';
    throughputTimelineChart.data.datasets[0].backgroundColor = 'rgba(0,255,229,.08)';
    throughputTimelineChart.update('none');
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

// Backward-compat wrappers
function connectChat(isReconnect) { connectSlot(connections[0] ? connections[0].id : 0, isReconnect); }
function disconnectChat() { disconnectAll(); }

// =============================================================
//  SLOT UI — dynamic slot rows
// =============================================================
function switchSlotPlatform(slotId, platform) {
  const conn = getSlot(slotId);
  if (!conn) return;
  if (conn.loggingActive) disconnectSlot(slotId);
  conn.platform = platform;
  const input = document.getElementById('channelInput_' + slotId);
  const prefix = document.getElementById('inputPrefix_' + slotId);
  if (input) input.placeholder = PLATFORM_PLACEHOLDERS[platform] || 'channel name';
  if (prefix) prefix.textContent = PLATFORM_PREFIXES[platform] || '#';
}

function renderSlotHTML(conn) {
  const isFirst = conn.id === connections[0].id;
  return '<div class="connection-slot" id="slot_' + conn.id + '" data-slot="' + conn.id + '">' +
    '<select class="platform-select" id="slotPlatform_' + conn.id + '" onchange="switchSlotPlatform(' + conn.id + ',this.value)" aria-label="Platform">' +
      '<option value="twitch"' + (conn.platform==='twitch'?' selected':'') + '>Twitch</option>' +
      '<option value="kick"' + (conn.platform==='kick'?' selected':'') + '>Kick (unofficial)</option>' +
      '<option value="youtube"' + (conn.platform==='youtube'?' selected':'') + '>YouTube (unofficial)</option>' +
      '<option value="rumble"' + (conn.platform==='rumble'?' selected':'') + '>Rumble (unofficial)</option>' +
    '</select>' +
    '<div class="input-wrap" style="position:relative">' +
      '<span class="input-prefix" id="inputPrefix_' + conn.id + '">' + (PLATFORM_PREFIXES[conn.platform] || '#') + '</span>' +
      '<input type="text" id="channelInput_' + conn.id + '" placeholder="' + (PLATFORM_PLACEHOLDERS[conn.platform] || 'channel name') + '" spellcheck="false" autocomplete="off" ' +
        'onfocus="openChannelHistory(' + conn.id + ')" oninput="openChannelHistory(' + conn.id + ')" ' +
        'onblur="setTimeout(function(){closeChannelHistory(' + conn.id + ')},150)" ' +
        'onkeydown="handleChannelKey(' + conn.id + ',event)" aria-label="Channel name"/>' +
      '<div class="channel-history-dropdown" id="channelHistoryDropdown_' + conn.id + '"></div>' +
    '</div>' +
    '<button class="btn btn-connect" id="slotConnectBtn_' + conn.id + '" onclick="connectSlot(' + conn.id + ')">Connect</button>' +
    '<button class="btn btn-disconnect slot-disconnect-btn" onclick="disconnectSlot(' + conn.id + ')">Disconnect</button>' +
    '<span class="slot-status">' +
      '<span class="slot-dot" id="slotDot_' + conn.id + '"></span>' +
      '<span class="slot-status-text" id="slotStatusText_' + conn.id + '"></span>' +
    '</span>' +
    (isFirst ? '' : '<button class="btn-slot-remove" onclick="removeSlot(' + conn.id + ')" title="Remove feed">\u00d7</button>') +
  '</div>';
}

function renderAllSlots() {
  const container = document.getElementById('connectionSlots');
  if (!container) return;
  container.innerHTML = connections.map(c => renderSlotHTML(c)).join('');
  // Update add-feed button visibility
  const addBtn = document.getElementById('addFeedBtn');
  if (addBtn) addBtn.style.display = connections.length >= MAX_FEEDS ? 'none' : '';
}

function addSlot() {
  if (connections.length >= MAX_FEEDS) return;
  const id = slotIdCounter++;
  const conn = createSlot(id);
  connections.push(conn);
  renderAllSlots();
}

function removeSlot(slotId) {
  const idx = connections.findIndex(c => c.id === slotId);
  if (idx <= 0) return; // never remove slot 0 (first slot)
  disconnectSlot(slotId);
  connections.splice(idx, 1);
  renderAllSlots();
}

// Initialize first slot
(function initSlots() {
  const id = slotIdCounter++;
  connections.push(createSlot(id));
})()

function updateHalfLife(v) {
  HALF_LIFE_MS=parseInt(v)*1000;
  document.getElementById('hlVal').textContent=v+'s';
  try { localStorage.setItem(HALFLIFE_KEY, v); } catch(e) {}
}

// =============================================================
//  UTILS
// =============================================================
function getDominant(pct) {
  if (!pct) return 'neutral';
  let best='neutral', bestV=0;
  for (const m of MOODS) if (m!=='neutral'&&pct[m]>bestV) { bestV=pct[m]; best=m; }
  return best;
}
function hexAlpha(hex, a) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}
function lerpColor(hexA, hexB, t) {
  const ra=parseInt(hexA.slice(1,3),16), ga=parseInt(hexA.slice(3,5),16), ba=parseInt(hexA.slice(5,7),16);
  const rb=parseInt(hexB.slice(1,3),16), gb=parseInt(hexB.slice(3,5),16), bb=parseInt(hexB.slice(5,7),16);
  const r=Math.round(ra+(rb-ra)*t), g=Math.round(ga+(gb-ga)*t), b=Math.round(ba+(bb-ba)*t);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
function fmtNum(n) { return n>=1000?(n/1000).toFixed(1)+'k':n; }
function setStatus(html, cls) {
  const el=document.getElementById('statusBar');
  el.innerHTML=html;
  el.className='status-bar'+(cls?' '+cls:'');
}

// =============================================================
//  RESIZE SYSTEM — custom drag handles + ResizeObserver + localStorage
//
//  Each resizable card gets a .resize-handle div injected at its
//  bottom-right. Dragging it updates the card's height directly.
//  ResizeObserver watches the card and calls chart.resize() so
//  all housed visuals redraw correctly at the new dimensions.
//  Heights are saved to localStorage and restored on page load.
// =============================================================
const RESIZE_STORAGE_KEY = 'moodradar_sizes_v2';
const RESIZE_DEBOUNCE_MS = 180;
const RESIZABLE_IDS = ['pieCard','radarCard','bubbleCard','approvalCard','approvalTimelineCard','throughputTimelineCard','timelineLinearCard','timelineLogCard','feedCard','filteredFeedCard','outlierCard','chatInputCard'];
let isRestoringLayout = false; // guard against ResizeObserver overwriting saved sizes during init/layout rebuild

function saveSizes() {
  if (isRestoringLayout) return; // don't overwrite saved sizes during init/layout rebuild
  const sizes = {};
  for (const id of RESIZABLE_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    sizes[id] = { h: el.offsetHeight, w: el.offsetWidth };
    if (el.dataset.manualWidth) sizes[id].mw = 1; // flag: user explicitly resized width
  }
  try { localStorage.setItem(RESIZE_STORAGE_KEY, JSON.stringify(sizes)); } catch(e) {}
}

function restoreSizes() {
  let sizes;
  try { sizes = JSON.parse(localStorage.getItem(RESIZE_STORAGE_KEY) || 'null'); } catch(e) {}
  if (!sizes) return;
  const isCustom = document.body.classList.contains('preset-custom');
  for (const id of RESIZABLE_IDS) {
    const el = document.getElementById(id);
    if (!el || !sizes[id]) continue;
    // Support both old format (number) and new format ({h,w,mw})
    if (typeof sizes[id] === 'number') {
      el.style.height = sizes[id] + 'px';
    } else {
      if (sizes[id].h) el.style.height = sizes[id].h + 'px';
      // Only restore width in custom layout where cards live inside flex rows
      if (sizes[id].mw && isCustom && sizes[id].w) {
        el.style.width = sizes[id].w + 'px';
        el.style.flex = 'none';
        el.dataset.manualWidth = '1';
      }
    }
  }
}

function notifyChartResize(cardId) {
  if (cardId === 'pieCard'              && pieChart)             { pieChart.resize(); pieChart.update('none'); }
  if (cardId === 'radarCard'            && radarChart)           { radarChart.resize(); radarChart.update('none'); }
  if (cardId === 'approvalTimelineCard' && approvalTimelineChart) approvalTimelineChart.resize();
  if (cardId === 'throughputTimelineCard' && throughputTimelineChart) throughputTimelineChart.resize();
  if (cardId === 'timelineLinearCard'   && timelineLinearChart)  timelineLinearChart.resize();
  if (cardId === 'timelineLogCard'      && timelineLogChart)     timelineLogChart.resize();
  if (cardId === 'bubbleCard')                                   resizeBubbleCanvas();
}

function addResizeHandle(el) {
  const handle = document.createElement('div');
  handle.className = 'resize-handle';
  handle.title = 'Drag corner to resize';
  el.appendChild(handle);

  let startX = 0, startY = 0, startW = 0, startH = 0;
  let debounceTimer = null;

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    startW = el.offsetWidth;
    startH = el.offsetHeight;

    function onMove(e) {
      const newH = Math.max(80, startH + (e.clientY - startY));
      const newW = Math.max(120, startW + (e.clientX - startX));
      el.style.height = newH + 'px';
      el.style.width = newW + 'px';
      el.style.flex = 'none';
      el.style.maxWidth = '100%';
      el.dataset.manualWidth = '1';
      notifyChartResize(el.id);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(saveSizes, RESIZE_DEBOUNCE_MS);
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      saveSizes();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Touch support
  handle.addEventListener('touchstart', e => {
    e.preventDefault();
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    startW = el.offsetWidth;
    startH = el.offsetHeight;

    function onMove(e) {
      const t = e.touches[0];
      const newH = Math.max(80, startH + (t.clientY - startY));
      const newW = Math.max(120, startW + (t.clientX - startX));
      el.style.height = newH + 'px';
      el.style.width = newW + 'px';
      el.style.flex = 'none';
      el.style.maxWidth = '100%';
      el.dataset.manualWidth = '1';
      notifyChartResize(el.id);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(saveSizes, RESIZE_DEBOUNCE_MS);
    }
    function onEnd() {
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      saveSizes();
    }
    el.addEventListener('touchmove', onMove, { passive:false });
    el.addEventListener('touchend', onEnd);
  }, { passive:false });
}

function setupResizeObserver() {
  if (!window.ResizeObserver) return;
  let debounceTimer = null;
  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      notifyChartResize(entry.target.id);
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!isRestoringLayout) saveSizes();
    }, RESIZE_DEBOUNCE_MS);
  });
  for (const id of RESIZABLE_IDS) {
    const el = document.getElementById(id);
    if (el) { addResizeHandle(el); observer.observe(el); }
  }
}


// =============================================================
//  FEED FONT SIZE SLIDER
// =============================================================
const FEED_FONT_KEY = 'moodradar_feedfont_v1';
let feedFontSize = (() => {
  try { const v = parseFloat(localStorage.getItem(FEED_FONT_KEY)); return isNaN(v) ? 2 : Math.min(20, Math.max(0.1, v)); }
  catch(e) { return 2; }
})();

function updateFeedFontSize(v) {
  feedFontSize = Math.min(20, Math.max(0.1, parseFloat(v)));
  document.getElementById('feedFontVal').textContent = feedFontSize.toFixed(2);
  try { localStorage.setItem(FEED_FONT_KEY, feedFontSize); } catch(e) {}
  applyFeedFontSize();
}

function applyFeedFontSize() {
  const list = document.getElementById('feedList');
  if (!list) return;
  list.style.fontSize = feedFontSize + 'em';
  list.style.lineHeight = Math.max(1.2, 1.4 + (feedFontSize - 2) * 0.15).toFixed(2);
}

// =============================================================
//  OUTLIER (STANDOUT) FEED — font size
// =============================================================
const OUTLIER_FONT_KEY = 'moodradar_outlierfont_v1';
let outlierFontSize = (() => {
  try { const v = parseFloat(localStorage.getItem(OUTLIER_FONT_KEY)); return isNaN(v) ? 2 : Math.min(20, Math.max(0.1, v)); }
  catch(e) { return 2; }
})();

function updateOutlierFontSize(v) {
  outlierFontSize = Math.min(20, Math.max(0.1, parseFloat(v)));
  document.getElementById('outlierFontVal').textContent = outlierFontSize.toFixed(2);
  try { localStorage.setItem(OUTLIER_FONT_KEY, outlierFontSize); } catch(e) {}
  applyOutlierFontSize();
}

function applyOutlierFontSize() {
  const list = document.getElementById('outlierFeedList');
  if (!list) return;
  list.style.fontSize = outlierFontSize + 'em';
  list.style.lineHeight = Math.max(1.2, 1.4 + (outlierFontSize - 2) * 0.15).toFixed(2);
}

// =============================================================
//  FILTERED FEED — regex-based secondary feed
// =============================================================
const FILTERED_FEED_FONT_KEY = 'moodradar_filteredfeedfont_v1';
let filteredFeedFontSize = (() => {
  try { const v = parseFloat(localStorage.getItem(FILTERED_FEED_FONT_KEY)); return isNaN(v) ? 2 : Math.min(20, Math.max(0.1, v)); }
  catch(e) { return 2; }
})();
let filteredFeedRegex = null;

function updateFilteredFeedFontSize(v) {
  filteredFeedFontSize = Math.min(20, Math.max(0.1, parseFloat(v)));
  document.getElementById('filteredFeedFontVal').textContent = filteredFeedFontSize.toFixed(2);
  try { localStorage.setItem(FILTERED_FEED_FONT_KEY, filteredFeedFontSize); } catch(e) {}
  applyFilteredFeedFontSize();
}

function applyFilteredFeedFontSize() {
  const list = document.getElementById('filteredFeedList');
  if (!list) return;
  list.style.fontSize = filteredFeedFontSize + 'em';
  list.style.lineHeight = Math.max(1.2, 1.4 + (filteredFeedFontSize - 2) * 0.15).toFixed(2);
}

function updateFilteredFeedRegex(v) {
  const input = document.getElementById('filteredFeedRegex');
  if (!v.trim()) {
    filteredFeedRegex = null;
    input.classList.remove('regex-error');
    try { localStorage.setItem(REGEX_STORAGE_KEY, ''); } catch(e) {}
    return;
  }
  try {
    filteredFeedRegex = new RegExp(v, 'i');
    input.classList.remove('regex-error');
    try { localStorage.setItem(REGEX_STORAGE_KEY, v); } catch(e) {}
    saveRegexToHistory(v);
  } catch(e) {
    filteredFeedRegex = null;
    input.classList.add('regex-error');
  }
}

// --- Regex history (dropdown of previously used patterns) ---
function loadRegexHistory() {
  try { return JSON.parse(localStorage.getItem(REGEX_HISTORY_KEY)) || []; }
  catch(e) { return []; }
}
function saveRegexToHistory(pattern) {
  let hist = loadRegexHistory();
  hist = hist.filter(h => h !== pattern);
  hist.unshift(pattern);
  if (hist.length > 20) hist.length = 20;
  try { localStorage.setItem(REGEX_HISTORY_KEY, JSON.stringify(hist)); } catch(e) {}
}
function deleteRegexFromHistory(pattern) {
  let hist = loadRegexHistory().filter(h => h !== pattern);
  try { localStorage.setItem(REGEX_HISTORY_KEY, JSON.stringify(hist)); } catch(e) {}
  renderRegexHistory();
}
function renderRegexHistory() {
  const dropdown = document.getElementById('regexHistoryDropdown');
  if (!dropdown) return;
  const hist = loadRegexHistory();
  const input = document.getElementById('filteredFeedRegex');
  const filter = (input.value || '').trim().toLowerCase();
  const filtered = filter ? hist.filter(h => h.toLowerCase().includes(filter)) : hist;
  if (filtered.length === 0) {
    dropdown.innerHTML = '<div class="history-empty">No saved patterns</div>';
    return;
  }
  dropdown.innerHTML = filtered.map(p =>
    `<div class="history-item" onmousedown="selectRegexHistory('${p.replace(/'/g,"\\'")}')">` +
      `<span class="history-item-name">${esc(p)}</span>` +
      `<button class="history-delete" onmousedown="event.stopPropagation();deleteRegexFromHistory('${p.replace(/'/g,"\\'")}');event.preventDefault();" title="Remove">&times;</button>` +
    `</div>`
  ).join('');
}
function selectRegexHistory(pattern) {
  const input = document.getElementById('filteredFeedRegex');
  input.value = pattern;
  updateFilteredFeedRegex(pattern);
  closeRegexHistory();
}
function openRegexHistory() {
  const dropdown = document.getElementById('regexHistoryDropdown');
  if (!dropdown) return;
  renderRegexHistory();
  dropdown.classList.add('open');
}
function closeRegexHistory() {
  const dropdown = document.getElementById('regexHistoryDropdown');
  if (dropdown) dropdown.classList.remove('open');
}

const filteredFeedPending = [];
let filteredFeedRafId = null;

function addFilteredFeedItem(user, msg, mood, botScore, approvalVote) {
  if (filteredFeedRegex && !filteredFeedRegex.test(msg)) return;
  if (!filteredFeedRegex) return; // only show when filter is active
  filteredFeedPending.push({ user, msg, mood, botScore:botScore||0, approvalVote:approvalVote||0 });
  if (!filteredFeedRafId) filteredFeedRafId = requestAnimationFrame(flushFilteredFeed);
}

function flushFilteredFeed() {
  filteredFeedRafId = null;
  const list = document.getElementById('filteredFeedList');
  const frag = document.createDocumentFragment();
  for (const { user, msg, mood, botScore, approvalVote } of filteredFeedPending.splice(0,25)) {
    const el = document.createElement('div');
    const isBot = mood === 'bot';
    el.className = 'feed-item' + (isBot?' feed-bot':'');
    const safeUser = sanitize(user);
    const safeMsg  = sanitize(msg);
    const moodTag = isBot
      ? `<span class="feed-mood mood-bot">BOT ${botScore}</span>`
      : `<span class="feed-mood mood-${mood}">${mood}</span>`;
    let apvTag = '';
    if (!isBot) {
      const apvPct = Math.round(Math.min(100, Math.max(0, (approvalVote+8)/16*100)));
      let apvColor;
      if (approvalVote>1) apvColor='#00ffe5';
      else if (approvalVote<-1) apvColor='#ff4800';
      else apvColor='#4a4a7a';
      const apvNum = approvalVote>0 ? '+'+approvalVote.toFixed(1) : approvalVote.toFixed(1);
      apvTag = `<span class="feed-apv"><span class="feed-apv-bar"><span class="feed-apv-fill" style="width:${apvPct}%;background:${apvColor}"></span></span><span class="feed-apv-num" style="color:${apvColor}">${apvNum}</span></span>`;
    }
    el.innerHTML = `<span class="feed-user">${esc(safeUser)}</span><span class="feed-msg">${renderEmotes(esc(safeMsg))}</span>${moodTag}${apvTag}`;
    frag.appendChild(el);
  }
  list.appendChild(frag);
  while (list.children.length > 60) list.removeChild(list.firstChild);
  list.scrollTop = list.scrollHeight;
}

// =============================================================
//  TIMELINE SETTINGS — max points + update interval
// =============================================================
function updateTimelinePoints(v) {
  const pts = Math.min(1000, Math.max(50, parseInt(v)));
  document.getElementById('tlPointsVal').textContent = pts;
  try { localStorage.setItem(TL_POINTS_KEY, pts); } catch(e) {}
  resizeTimelineData(pts);
  TIMELINE_POINTS = pts;
}

function updateTimelineInterval(v) {
  TIMELINE_INTERVAL = Math.min(5000, Math.max(200, parseInt(v)));
  document.getElementById('tlIntervalVal').textContent = TIMELINE_INTERVAL + 'ms';
  try { localStorage.setItem(TL_INTERVAL_KEY, TIMELINE_INTERVAL); } catch(e) {}
}

function resizeTimelineData(newPts) {
  const charts = [timelineLinearChart, timelineLogChart, approvalTimelineChart, throughputTimelineChart].filter(Boolean);
  for (const chart of charts) {
    const labels = chart.data.labels;
    const datasets = chart.data.datasets;
    if (newPts > labels.length) {
      const pad = newPts - labels.length;
      chart.data.labels = Array(pad).fill('').concat(labels);
      for (const ds of datasets) ds.data = Array(pad).fill(null).concat(ds.data);
    } else if (newPts < labels.length) {
      const trim = labels.length - newPts;
      chart.data.labels = labels.slice(trim);
      for (const ds of datasets) ds.data = ds.data.slice(trim);
    }
    chart.update('none');
  }
}

// =============================================================
//  LEGEND RENDERING — dynamic from MOODS array
// =============================================================
function renderMoodLegend() {
  const el = document.getElementById('moodLegend');
  if (!el) return;
  el.innerHTML = MOODS.map(m => {
    const col = m === 'neutral' ? '#4a6688' : `var(--${m})`;
    return `<div class="legend-item"><span class="legend-dot" style="background:${col}"></span>${m.charAt(0).toUpperCase()+m.slice(1)}</div>`;
  }).join('');
}

// =============================================================
//  LAYOUT MANAGER — reorder + inline/stacked controls
// =============================================================
const LAYOUT_STORAGE_KEY = 'moodradar_layout_v1';
const LAYOUT_SECTIONS = [
  { id:'pieCard',             label:'Mood Distribution' },
  { id:'radarCard',           label:'Mood Web' },
  { id:'bubbleCard',          label:'Consensus Bubbles' },
  { id:'approvalCard',        label:'Approval Meter' },
  { id:'approvalTimelineCard', label:'Approval Timeline' },
  { id:'throughputTimelineCard', label:'Throughput Timeline' },
  { id:'timelineLinearCard',  label:'Timeline (Linear)' },
  { id:'timelineLogCard',     label:'Timeline (Log)' },
  { id:'feedCard',            label:'Live Feed' },
  { id:'filteredFeedCard',    label:'Filtered Feed' },
  { id:'outlierCard',         label:'Standout Messages' },
  { id:'chatInputCard',       label:'Chat Input' },
];

let layoutOrder = LAYOUT_SECTIONS.map(s => s.id);
let layoutInline = {}; // id -> true means "inline with next"
let layoutAlignItems = 'start';     // flex-start | center | stretch
let layoutJustifyContent = 'start'; // flex-start | center | between

function loadLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY));
    if (saved && saved.order) {
      // Validate all IDs exist
      const validIds = new Set(LAYOUT_SECTIONS.map(s => s.id));
      const filtered = saved.order.filter(id => validIds.has(id));
      // Add any missing IDs at end
      for (const s of LAYOUT_SECTIONS) { if (!filtered.includes(s.id)) filtered.push(s.id); }
      layoutOrder = filtered;
      layoutInline = saved.inline || {};
    }
    if (saved && saved.alignItems) layoutAlignItems = saved.alignItems;
    if (saved && saved.justifyContent) layoutJustifyContent = saved.justifyContent;
  } catch(e) {}
}

function saveLayout() {
  try { localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({
    order:layoutOrder, inline:layoutInline,
    alignItems:layoutAlignItems, justifyContent:layoutJustifyContent
  })); } catch(e) {}
}

function renderLayoutManager() {
  const container = document.getElementById('layoutItemList');
  container.innerHTML = '';
  for (let i = 0; i < layoutOrder.length; i++) {
    const id = layoutOrder[i];
    const section = LAYOUT_SECTIONS.find(s => s.id === id);
    if (!section) continue;
    const item = document.createElement('div');
    item.className = 'layout-item';
    item.draggable = true;
    item.dataset.idx = i;
    const isInline = !!layoutInline[id];
    item.innerHTML = `<span class="drag-handle">&#x2630;</span>` +
      `<span class="layout-item-label">${section.label}</span>` +
      `<button class="layout-inline-toggle ${isInline?'active':''}" onclick="toggleLayoutInline('${id}',this)" title="${isInline ? 'Currently side-by-side with next section. Click to stack vertically instead.' : 'Currently stacked vertically. Click to place side-by-side with next section.'}">${isInline?'⬌ SIDE':'⬍ STACK'}</button>`;

    item.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', i);
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', e => { e.preventDefault(); item.style.borderColor='var(--accent)'; });
    item.addEventListener('dragleave', () => { item.style.borderColor='transparent'; });
    item.addEventListener('drop', e => {
      e.preventDefault();
      item.style.borderColor='transparent';
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      const toIdx = parseInt(item.dataset.idx);
      if (fromIdx === toIdx) return;
      const [moved] = layoutOrder.splice(fromIdx, 1);
      layoutOrder.splice(toIdx, 0, moved);
      saveLayout();
      renderLayoutManager();
    });
    container.appendChild(item);
  }

  // Render flexbox alignment options
  renderFlexOptions();
}

function renderFlexOptions() {
  let wrap = document.getElementById('layoutFlexOptions');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'layoutFlexOptions';
    wrap.className = 'layout-flex-options';
    const itemList = document.getElementById('layoutItemList');
    itemList.parentNode.insertBefore(wrap, itemList.nextSibling);
  }
  const alignOpts = [
    { val:'start', label:'TOP' },
    { val:'center', label:'CENTER' },
    { val:'stretch', label:'STRETCH' }
  ];
  const justifyOpts = [
    { val:'start', label:'LEFT' },
    { val:'center', label:'CENTER' },
    { val:'between', label:'SPREAD' }
  ];
  wrap.innerHTML =
    `<div class="flex-opt-group"><span class="flex-opt-label">ALIGN</span>` +
    alignOpts.map(o => `<button class="flex-opt-btn${layoutAlignItems===o.val?' active':''}" onclick="setLayoutAlign('${o.val}')">${o.label}</button>`).join('') +
    `</div>` +
    `<div class="flex-opt-group"><span class="flex-opt-label">JUSTIFY</span>` +
    justifyOpts.map(o => `<button class="flex-opt-btn${layoutJustifyContent===o.val?' active':''}" onclick="setLayoutJustify('${o.val}')">${o.label}</button>`).join('') +
    `</div>`;
}

function setLayoutAlign(val) {
  layoutAlignItems = val;
  saveLayout();
  renderFlexOptions();
}

function setLayoutJustify(val) {
  layoutJustifyContent = val;
  saveLayout();
  renderFlexOptions();
}

function toggleLayoutInline(id, btn) {
  layoutInline[id] = !layoutInline[id];
  btn.classList.toggle('active', layoutInline[id]);
  btn.textContent = layoutInline[id] ? '⬌ SIDE' : '⬍ STACK';
  btn.title = layoutInline[id]
    ? 'Currently side-by-side with next section. Click to stack vertically instead.'
    : 'Currently stacked vertically. Click to place side-by-side with next section.';
  saveLayout();
}

function applyCustomLayout() {
  isRestoringLayout = true; // guard against ResizeObserver during DOM rebuild
  document.body.classList.remove('preset-list');
  document.body.classList.add('preset-custom');
  currentPreset = 'custom';
  savePreset('custom');
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === 'custom');
  });

  const container = document.getElementById('customLayoutContainer');
  container.innerHTML = '';

  // Clear manual-width flags and flex overrides before rebuilding rows
  for (const id of layoutOrder) {
    const el = document.getElementById(id);
    if (el) { el.style.flex = ''; delete el.dataset.manualWidth; }
  }

  // Group sections into rows: consecutive items with inline=true are grouped together
  // The last inline item in a run pulls the next non-inline item into the same row
  let i = 0;
  while (i < layoutOrder.length) {
    const id = layoutOrder[i];
    const el = document.getElementById(id);
    if (!el) { i++; continue; }

    if (layoutInline[id]) {
      // Collect all consecutive inline items + the next non-inline item
      const rowEls = [el];
      i++;
      while (i < layoutOrder.length) {
        const nextEl = document.getElementById(layoutOrder[i]);
        if (!nextEl) { i++; continue; }
        rowEls.push(nextEl);
        if (!layoutInline[layoutOrder[i]]) { i++; break; }
        i++;
      }
      const row = document.createElement('div');
      row.className = 'layout-row layout-align-' + layoutAlignItems + ' layout-justify-' + layoutJustifyContent;
      for (const re of rowEls) row.appendChild(re);
      container.appendChild(row);
    } else {
      const row = document.createElement('div');
      row.className = 'layout-row layout-align-' + layoutAlignItems + ' layout-justify-' + layoutJustifyContent;
      row.appendChild(el);
      container.appendChild(row);
      i++;
    }
  }

  // Re-apply saved sizes after DOM rebuild so heights/widths persist
  restoreSizes();

  document.getElementById('settingsDropdown').classList.remove('open');
  setTimeout(() => {
    resizeBubbleCanvas();
    if (pieChart) pieChart.resize();
    if (radarChart) { radarChart.resize(); radarChart.update('none'); }
    if (approvalTimelineChart) approvalTimelineChart.resize();
    if (throughputTimelineChart) throughputTimelineChart.resize();
    if (timelineLinearChart) timelineLinearChart.resize();
    if (timelineLogChart) timelineLogChart.resize();
    isRestoringLayout = false; // release guard after layout is stable
  }, 50);
}

// Override applyPreset to handle 'custom', 'dense', and restore default DOM for dashboard/list
const _origApplyPreset = applyPreset;
applyPreset = function(preset) {
  if (preset === 'custom') {
    document.getElementById('layoutManagerSection').style.display = 'block';
    renderLayoutManager();
    applyCustomLayout();
    savePreset('custom');
    return;
  }
  isRestoringLayout = true; // guard against ResizeObserver during DOM rebuild
  document.getElementById('layoutManagerSection').style.display = 'none';
  document.body.classList.remove('preset-custom');

  // Restore elements to their default containers if they were moved
  restoreDefaultDOM();

  _origApplyPreset(preset);

  // Re-apply persisted sizes after DOM rearrangement
  restoreSizes();

  // Sync density option in drawer when preset changes
  if (preset === 'dense') {
    drawerOptions.density = 'dense';
  } else if (preset === 'dashboard' || preset === 'list') {
    drawerOptions.density = 'normal';
    document.body.classList.remove('preset-dense','preset-loose');
  }
  const dEl = document.getElementById('optDensity');
  if (dEl) dEl.value = drawerOptions.density;
  saveOptions();
  setTimeout(() => { isRestoringLayout = false; }, 200);
};

function restoreDefaultDOM() {
  const app = document.querySelector('.app');
  const customContainer = document.getElementById('customLayoutContainer');
  const chartsTop = document.querySelector('.charts-top');

  // Collect all card elements by ID (safe references survive DOM moves)
  const allCardIds = ['pieCard','radarCard','bubbleCard','approvalCard','approvalTimelineCard','throughputTimelineCard','timelineLinearCard','timelineLogCard','feedCard','filteredFeedCard','outlierCard','chatInputCard'];
  const cards = {};
  for (const id of allCardIds) {
    const el = document.getElementById(id);
    if (el) {
      // Detach from current parent (custom layout row or wherever it is)
      if (el.parentNode) el.parentNode.removeChild(el);
      cards[id] = el;
    }
  }

  // Clear custom layout wrapper rows (now empty of cards)
  customContainer.innerHTML = '';

  // Ensure we have exactly 3 section dividers in the app
  let dividers = Array.from(app.querySelectorAll('.section-divider'));
  while (dividers.length < 3) {
    const d = document.createElement('div');
    d.className = 'section-divider';
    app.insertBefore(d, customContainer);
    dividers.push(d);
  }

  // Restore pie + radar into charts-top grid
  if (chartsTop) {
    // Remove any stale children
    while (chartsTop.firstChild) chartsTop.removeChild(chartsTop.firstChild);
    if (cards.pieCard) chartsTop.appendChild(cards.pieCard);
    if (cards.radarCard) chartsTop.appendChild(cards.radarCard);
  }

  // Insert remaining cards in default order before customLayoutContainer
  const insertionRef = customContainer;
  const defaultOrderEls = [
    dividers[0],
    cards.bubbleCard,
    dividers[1],
    cards.approvalCard,
    cards.approvalTimelineCard,
    cards.throughputTimelineCard,
    dividers[2],
    cards.timelineLinearCard,
    cards.timelineLogCard,
    cards.feedCard,
    cards.filteredFeedCard,
    cards.outlierCard,
    cards.chatInputCard,
  ].filter(Boolean);

  for (const el of defaultOrderEls) {
    if (el.parentNode) el.parentNode.removeChild(el);
    app.insertBefore(el, insertionRef);
  }
}

window.onload = function() {
  // Render multi-slot connection UI
  renderAllSlots();

  // Init label scale slider with saved/default value
  const slider = document.getElementById('labelScaleSlider');
  if (slider) slider.value = labelScale;
  document.getElementById('labelScaleVal').textContent = labelScale.toFixed(1) + 'x';

  // Init bubble scale slider with saved/default value
  const bsSlider = document.getElementById('bubbleScaleSlider');
  if (bsSlider) bsSlider.value = bubbleScale;
  document.getElementById('bubbleScaleVal').textContent = bubbleScale.toFixed(2) + 'x';

  // Init feed font size slider
  const feedSlider = document.getElementById('feedFontSlider');
  if (feedSlider) feedSlider.value = feedFontSize;
  document.getElementById('feedFontVal').textContent = feedFontSize.toFixed(2);
  applyFeedFontSize();

  // Init filtered feed font size slider
  const filteredFeedSlider = document.getElementById('filteredFeedFontSlider');
  if (filteredFeedSlider) filteredFeedSlider.value = filteredFeedFontSize;
  document.getElementById('filteredFeedFontVal').textContent = filteredFeedFontSize.toFixed(2);
  applyFilteredFeedFontSize();

  // Init regex filter from storage (default: \?)
  const savedRegex = localStorage.getItem(REGEX_STORAGE_KEY) ?? REGEX_DEFAULT;
  if (savedRegex) {
    const regexInput = document.getElementById('filteredFeedRegex');
    if (regexInput) {
      regexInput.value = savedRegex;
      updateFilteredFeedRegex(savedRegex);
    }
  }

  // Wire regex history dropdown open/close
  {
    const regexInput = document.getElementById('filteredFeedRegex');
    if (regexInput) {
      regexInput.addEventListener('focus', openRegexHistory);
      regexInput.addEventListener('blur', () => setTimeout(closeRegexHistory, 150));
    }
  }

  // Init outlier font size slider
  const outlierSlider = document.getElementById('outlierFontSlider');
  if (outlierSlider) outlierSlider.value = outlierFontSize;
  document.getElementById('outlierFontVal').textContent = outlierFontSize.toFixed(2);
  applyOutlierFontSize();

  // Init timeline settings sliders
  const tlPtsSlider = document.getElementById('tlPointsSlider');
  if (tlPtsSlider) tlPtsSlider.value = TIMELINE_POINTS;
  document.getElementById('tlPointsVal').textContent = TIMELINE_POINTS;
  const tlIntSlider = document.getElementById('tlIntervalSlider');
  if (tlIntSlider) tlIntSlider.value = TIMELINE_INTERVAL;
  document.getElementById('tlIntervalVal').textContent = TIMELINE_INTERVAL + 'ms';

  // Init half-life slider with saved/default value
  const savedHL = HALF_LIFE_MS / 1000;
  const hlSlider = document.getElementById('hlSlider');
  if (hlSlider) hlSlider.value = savedHL;
  document.getElementById('hlVal').textContent = savedHL + 's';

  // Render dynamic mood legend
  renderMoodLegend();

  // Load layout config
  loadLayout();

  // Tablet viewport defaults on first visit (no saved preset = first visit)
  const isFirstVisit = localStorage.getItem(PRESET_STORAGE_KEY) === null;
  const isTablet = window.innerWidth >= 600 && window.innerWidth <= 1366;
  if (isFirstVisit && isTablet) {
    currentPreset = 'custom';

    // Row 1: pie + radar + bubble + approval (SIDE pulls next STACK into same row)
    // Row 2: 4 timelines (SIDE pulls logTL STACK into same row)
    // Feeds + chat: each stacked on own row
    layoutInline = {
      pieCard: true, radarCard: true, bubbleCard: true,
      approvalTimelineCard: true, throughputTimelineCard: true, timelineLinearCard: true
    };

    // Set parameters
    labelScale = 0.6;
    bubbleScale = 0.4;
    TIMELINE_POINTS = 100;
    TIMELINE_INTERVAL = 500;

    // Update sliders to reflect new values
    if (slider) slider.value = labelScale;
    document.getElementById('labelScaleVal').textContent = labelScale.toFixed(1) + 'x';
    if (bsSlider) bsSlider.value = bubbleScale;
    document.getElementById('bubbleScaleVal').textContent = bubbleScale.toFixed(2) + 'x';
    if (tlPtsSlider) tlPtsSlider.value = TIMELINE_POINTS;
    document.getElementById('tlPointsVal').textContent = TIMELINE_POINTS;
    if (tlIntSlider) tlIntSlider.value = TIMELINE_INTERVAL;
    document.getElementById('tlIntervalVal').textContent = TIMELINE_INTERVAL + 'ms';

    // Ultra dense density
    drawerOptions.density = 'dense';

    // Default card heights: 400px for top 4 cards
    try {
      localStorage.setItem(RESIZE_STORAGE_KEY, JSON.stringify({
        pieCard: { h: 200 }, radarCard: { h: 200 },
        bubbleCard: { h: 200 }, approvalCard: { h: 200 }
      }));
    } catch(e) {}

    // Persist all state so layout survives reload
    saveLayout();
    savePreset('custom');
    try { localStorage.setItem(LABEL_SCALE_KEY, labelScale); } catch(e) {}
    try { localStorage.setItem(BUBBLE_SCALE_KEY, bubbleScale); } catch(e) {}
    try { localStorage.setItem(TL_POINTS_KEY, TIMELINE_POINTS); } catch(e) {}
    try { localStorage.setItem(TL_INTERVAL_KEY, TIMELINE_INTERVAL); } catch(e) {}
    saveOptions();
  }

  initCharts();
  setupResizeObserver();

  // Guard against ResizeObserver overwriting saved sizes during init
  isRestoringLayout = true;

  // Restore saved preset (must happen after charts init and resize observer setup)
  if (currentPreset && currentPreset !== 'dashboard') {
    applyPreset(currentPreset);
  } else {
    // Ensure dashboard button shows active
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === 'dashboard');
    });
  }

  // Restore sizes after preset is applied (preset may change layout)
  restoreSizes();

  // Load and apply Options Drawer settings
  loadOptions();
  applyAllOptions();

  // Re-acquire wake lock when tab becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && drawerOptions.wakeLockEnabled) {
      requestWakeLock();
    }
  });

  // Re-trigger chart resize after sizes restored, then release guard
  setTimeout(() => {
    for (const id of RESIZABLE_IDS) notifyChartResize(id);
    setTimeout(() => { isRestoringLayout = false; }, 300);
  }, 100);
};
