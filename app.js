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
  if (preset === 'list') {
    document.body.classList.add('preset-list');
  } else {
    document.body.classList.remove('preset-list');
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
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeHelp(); document.getElementById('settingsDropdown').classList.remove('open'); } });

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
  return escapedHtml.replace(EMOTE_REGEX, match => {
    const emoji = EMOTE_MAP.get(match);
    return emoji ? `<span title="${match}">${emoji}</span>` : match;
  });
}

// =============================================================
//  CONSTANTS & STATE
// =============================================================
const MOODS = ['hype','funny','love','toxic','sad','calm','angry','excited','cringe','wholesome','confused','neutral'];
const MOOD_COLORS = {hype:'#00ffe5',funny:'#ffe600',love:'#ff2d78',toxic:'#ff4800',sad:'#9b6ef3',calm:'#4fc3f7',angry:'#ff1744',excited:'#76ff03',cringe:'#e040fb',wholesome:'#ffab40',confused:'#78909c',neutral:'#2e3d5e'};

let HALF_LIFE_MS = 10_000;
const WINDOW_MS  = 120_000;
const QUEUE_CAP  = 5000;

const scoredMessages = [];
const keywordStore   = new Map();
const approvalStore  = [];
const msgQueue       = [];
let droppedMessages  = 0;

let ws = null;
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
  try { const v = parseFloat(localStorage.getItem(LABEL_SCALE_KEY)); return isNaN(v) ? 1.4 : Math.min(2.5, Math.max(0.8, v)); }
  catch(e) { return 1.4; }
})();

function updateLabelScale(v) {
  labelScale = Math.min(2.5, Math.max(0.8, parseFloat(v)));
  document.getElementById('labelScaleVal').textContent = labelScale.toFixed(1) + 'x';
  try { localStorage.setItem(LABEL_SCALE_KEY, labelScale); } catch(e) {}
  // Pie redraws on next update cycle; bubble redraws on next animation frame
  if (pieChart) pieChart.update('none');
}

// =============================================================
//  CHARTS
// =============================================================
let pieChart, radarChart, timelineLinearChart, timelineLogChart, approvalTimelineChart, throughputTimelineChart;

const pieLabelPlugin = {
  id: 'pieLabels',
  afterDraw(chart) {
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
  const top = kwList.slice(0, 22);
  const maxScore = top[0]?.score || 1;
  const maxR = Math.min(W, H) * 0.42; // never exceed ~42% of smallest dimension
  const existing = new Map(bubbles.map(b => [b.label, b]));
  const next = [];
  for (const { label, score, mood } of top) {
    const targetR = Math.min(16 + (score / maxScore) * 55, maxR);
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
  const SPRING_K = 0.004;

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
    const effR = Math.min(b.r, Math.min(W, H) * 0.48);
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
    bubCtx.fillStyle = hexAlpha(col, isHov?0.52:0.28);
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

  updateBubbles(kwList.slice(0,28).map((k,i)=>({...k,count:i+1})));

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
  hist = hist.filter(h => h !== clean);   // remove duplicate
  hist.unshift(clean);                    // add to front
  if (hist.length > CHANNEL_HISTORY_MAX) hist = hist.slice(0, CHANNEL_HISTORY_MAX);
  try { localStorage.setItem(CHANNEL_HISTORY_KEY, JSON.stringify(hist)); } catch(e) {}
}

function deleteChannelFromHistory(name) {
  let hist = loadChannelHistory().filter(h => h !== name);
  try { localStorage.setItem(CHANNEL_HISTORY_KEY, JSON.stringify(hist)); } catch(e) {}
  renderChannelHistory();
}

function renderChannelHistory() {
  const dropdown = document.getElementById('channelHistoryDropdown');
  const hist = loadChannelHistory();
  const filter = sanitize(document.getElementById('channelInput').value.trim().toLowerCase().replace(/^#/,''));

  const filtered = filter ? hist.filter(h => h.startsWith(filter)) : hist;

  if (filtered.length === 0) {
    dropdown.innerHTML = '<div class="history-empty">No saved channels</div>';
    return;
  }

  dropdown.innerHTML = filtered.map(name =>
    `<div class="history-item" onmousedown="selectChannel('${esc(name)}')">
      <span class="history-item-name">${esc(name)}</span>
      <button class="history-delete" onmousedown="event.stopPropagation();deleteChannelFromHistory('${esc(name)}')" title="Remove">×</button>
    </div>`
  ).join('');
}

function openChannelHistory() {
  renderChannelHistory();
  document.getElementById('channelHistoryDropdown').classList.add('open');
}

function closeChannelHistory() {
  document.getElementById('channelHistoryDropdown').classList.remove('open');
}

function selectChannel(name) {
  document.getElementById('channelInput').value = name;
  closeChannelHistory();
}

function handleChannelKey(e) {
  if (e.key === 'Escape') { closeChannelHistory(); return; }
  if (e.key === 'Enter')  { closeChannelHistory(); connectChat(); return; }
}

// Close dropdown when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.input-wrap')) closeChannelHistory();
});

// =============================================================
//  CONNECTION STATE — loggingActive flag + reconnect logic
// =============================================================
let loggingActive    = false;   // true only when user has intentionally connected
let reconnectAttempt = 0;
const MAX_RECONNECT  = 3;
const RECONNECT_DELAY_MS = 10_000;
let reconnectTimer   = null;

function setDisconnectedState(shouldReconnect) {
  if (loggingActive) {
    document.body.classList.add('disconnected');
  }
  if (shouldReconnect && loggingActive && reconnectAttempt < MAX_RECONNECT) {
    reconnectAttempt++;
    const attemptNum = reconnectAttempt;
    setStatus(`Disconnected. Reconnecting in 10s (attempt ${attemptNum}/${MAX_RECONNECT})...`, 'error');
    reconnectTimer = setTimeout(() => {
      if (loggingActive) connectChat(true); // true = is a reconnect attempt
    }, RECONNECT_DELAY_MS);
  } else if (loggingActive && reconnectAttempt >= MAX_RECONNECT) {
    setStatus('Reconnect failed after ' + MAX_RECONNECT + ' attempts. Click Connect to retry.', 'error');
  }
}

// =============================================================
//  WEBSOCKET
// =============================================================
function connectChat(isReconnect) {
  const raw = sanitize(document.getElementById('channelInput').value.trim().toLowerCase());
  if (!raw) { setStatus('Enter a channel name first.','error'); return; }

  // Close existing connection cleanly without clearing loggingActive
  if (ws) { ws.close(); ws = null; }
  if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = null; }
  msgQueue.length = 0;

  if (!isReconnect) {
    initCharts();
    reconnectAttempt = 0;  // reset counter on fresh manual connect
  }

  loggingActive = true;
  document.body.classList.remove('disconnected');
  clearTimeout(reconnectTimer);

  const channel = raw.startsWith('#') ? raw : '#'+raw;
  setStatus('Connecting to '+channel+'...','');
  document.getElementById('connectBtn').disabled = true;

  ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
  ws.onopen = () => {
    ws.send('CAP REQ :twitch.tv/commands twitch.tv/tags');
    ws.send('PASS SCHMOOPIIE');
    ws.send('NICK justinfan'+(Math.random()*80000+1000|0));
    ws.send('JOIN '+channel);
  };
  ws.onmessage = (event) => {
    const now = Date.now();
    const lines = event.data.split('\r\n');
    for (let i=0; i<lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      if (line.startsWith('PING')) { ws.send('PONG :tmi.twitch.tv'); continue; }
      if (line.includes('366')||(line.includes('JOIN')&&line.includes(channel))) {
        // Successful join — reset reconnect counter, save to history
        reconnectAttempt = 0;
        document.body.classList.remove('disconnected');
        saveChannelToHistory(channel);
        setStatus('<span class="live-dot"></span>LIVE - '+channel.replace('#','').toUpperCase(),'live');
        if (!rafHandle) { lastTimelineTs=now; rafHandle=requestAnimationFrame(processingLoop); }
      }
      if (!line.includes('PRIVMSG')) continue;
      const privIdx=line.indexOf('PRIVMSG'), colonIdx=line.indexOf(':',privIdx);
      if (colonIdx<0) continue;
      const msgText=line.slice(colonIdx+1);
      const atStart=line.charCodeAt(0)===64;
      const userStart=atStart?line.indexOf(' :')+2:1;
      const bangIdx=line.indexOf('!',userStart);
      if (bangIdx<0) continue;
      const user=line.slice(userStart,bangIdx);
      tsThroughput.push(now);
      enqueue(user,msgText,now);
    }
  };
  ws.onerror = () => {
    document.getElementById('connectBtn').disabled=false;
    setDisconnectedState(true);
  };
  ws.onclose = () => {
    document.getElementById('connectBtn').disabled=false;
    // Only treat as unexpected if loggingActive (not a manual disconnect)
    setDisconnectedState(loggingActive);
  };
}

function disconnectChat() {
  loggingActive = false;                        // user intentionally stopped
  clearTimeout(reconnectTimer);
  reconnectAttempt = 0;
  document.body.classList.remove('disconnected');
  if (ws) { ws.close(); ws=null; }
  if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle=null; }
  msgQueue.length=0;
  setStatus('Disconnected.','');
  document.getElementById('connectBtn').disabled=false;
}

function updateHalfLife(v) {
  HALF_LIFE_MS=parseInt(v)*1000;
  document.getElementById('hlVal').textContent=v+'s';
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
const RESIZABLE_IDS = ['pieCard','radarCard','bubbleCard','approvalCard','approvalTimelineCard','throughputTimelineCard','timelineLinearCard','timelineLogCard','feedCard','filteredFeedCard','outlierCard'];

function saveSizes() {
  const sizes = {};
  for (const id of RESIZABLE_IDS) {
    const el = document.getElementById(id);
    if (el) {
      sizes[id] = { h: el.offsetHeight };
      if (el.style.width) sizes[id].w = el.offsetWidth;
    }
  }
  try { localStorage.setItem(RESIZE_STORAGE_KEY, JSON.stringify(sizes)); } catch(e) {}
}

function restoreSizes() {
  let sizes;
  try { sizes = JSON.parse(localStorage.getItem(RESIZE_STORAGE_KEY) || 'null'); } catch(e) {}
  if (!sizes) return;
  for (const id of RESIZABLE_IDS) {
    const el = document.getElementById(id);
    if (!el || !sizes[id]) continue;
    // Support both old format (number) and new format ({h,w})
    if (typeof sizes[id] === 'number') {
      el.style.height = sizes[id] + 'px';
    } else {
      if (sizes[id].h) el.style.height = sizes[id].h + 'px';
      if (sizes[id].w) el.style.width = sizes[id].w + 'px';
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
      el.style.maxWidth = '100%';
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
      el.style.maxWidth = '100%';
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
    debounceTimer = setTimeout(saveSizes, RESIZE_DEBOUNCE_MS);
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
  document.body.classList.remove('preset-list');
  document.body.classList.add('preset-custom');
  currentPreset = 'custom';
  savePreset('custom');
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === 'custom');
  });

  const container = document.getElementById('customLayoutContainer');
  container.innerHTML = '';

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

  document.getElementById('settingsDropdown').classList.remove('open');
  setTimeout(() => {
    resizeBubbleCanvas();
    if (pieChart) pieChart.resize();
    if (radarChart) { radarChart.resize(); radarChart.update('none'); }
    if (approvalTimelineChart) approvalTimelineChart.resize();
    if (throughputTimelineChart) throughputTimelineChart.resize();
    if (timelineLinearChart) timelineLinearChart.resize();
    if (timelineLogChart) timelineLogChart.resize();
  }, 50);
}

// Override applyPreset to handle 'custom' and restore default DOM for dashboard/list
const _origApplyPreset = applyPreset;
applyPreset = function(preset) {
  if (preset === 'custom') {
    document.getElementById('layoutManagerSection').style.display = 'block';
    renderLayoutManager();
    applyCustomLayout();
    savePreset('custom');
    return;
  }
  document.getElementById('layoutManagerSection').style.display = 'none';
  document.body.classList.remove('preset-custom');

  // Restore elements to their default containers if they were moved
  restoreDefaultDOM();

  _origApplyPreset(preset);
};

function restoreDefaultDOM() {
  const app = document.querySelector('.app');
  const customContainer = document.getElementById('customLayoutContainer');
  const chartsTop = document.querySelector('.charts-top');

  // Collect all card elements by ID (safe references survive DOM moves)
  const allCardIds = ['pieCard','radarCard','bubbleCard','approvalCard','approvalTimelineCard','throughputTimelineCard','timelineLinearCard','timelineLogCard','feedCard','filteredFeedCard','outlierCard'];
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
  ].filter(Boolean);

  for (const el of defaultOrderEls) {
    if (el.parentNode) el.parentNode.removeChild(el);
    app.insertBefore(el, insertionRef);
  }
}

window.onload = function() {
  // Init label scale slider with saved/default value
  const slider = document.getElementById('labelScaleSlider');
  if (slider) slider.value = labelScale;
  document.getElementById('labelScaleVal').textContent = labelScale.toFixed(1) + 'x';

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

  // Render dynamic mood legend
  renderMoodLegend();

  // Load layout config
  loadLayout();

  initCharts();
  setupResizeObserver();

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
  // Re-trigger chart resize after sizes restored
  setTimeout(() => {
    for (const id of RESIZABLE_IDS) notifyChartResize(id);
  }, 100);
};
