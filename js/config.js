// All constants, storage keys, static data, and dictionaries

// --- Storage Keys ---
export const OPTIONS_STORAGE_KEY = 'moodradar_options_v1';
export const PRESET_STORAGE_KEY = 'moodradar_preset_v1';
export const HALFLIFE_KEY = 'moodradar_halflife_v1';
export const TL_POINTS_KEY = 'moodradar_tlpoints_v1';
export const TL_INTERVAL_KEY = 'moodradar_tlinterval_v1';
export const REGEX_STORAGE_KEY = 'moodradar_regex_v1';
export const REGEX_HISTORY_KEY = 'moodradar_regexhistory_v1';
export const REGEX_DEFAULT = '\\?';
export const USER_FILTER_STORAGE_KEY = 'moodradar_userfilter_v1';
export const FILTER_SIMPLE_STATE_KEY = 'moodradar_filtersimple_v1';
export const FILTER_TAB_KEY = 'moodradar_filtertab_v1';
export const LABEL_SCALE_KEY = 'moodradar_labelscale_v1';
export const BUBBLE_SCALE_KEY = 'moodradar_bubblescale_v1';
export const OAUTH_STORAGE_KEY = 'moodradar_oauth_v1';
export const CHANNEL_HISTORY_KEY = 'moodradar_channels_v1';
export const FEED_FONT_KEY = 'moodradar_feedfont_v1';
export const OUTLIER_FONT_KEY = 'moodradar_outlierfont_v1';
export const FILTERED_FEED_FONT_KEY = 'moodradar_filteredfeedfont_v1';
export const RESIZE_STORAGE_KEY = 'moodradar_sizes_v2';
export const LAYOUT_STORAGE_KEY = 'moodradar_layout_v1';
export const USER_HIST_FONT_KEY = 'moodradar_userhistfont_v1';
export const USER_HIST_BOTS_KEY = 'moodradar_userhistbots_v1';
export const USER_HIST_SCOPE_KEY = 'moodradar_userhistscope_v1';
export const USER_HIST_SIZE_KEY = 'moodradar_userhistsize_v1';
export const USER_HIST_POS_KEY  = 'moodradar_userhistpos_v1';

// User-message history (IndexedDB)
export const HISTORY_DB_NAME = 'moodradar_history_v1';
export const HISTORY_DB_VERSION = 1;
export const HISTORY_DB_STORE = 'messages';
export const HISTORY_RETENTION_DAYS_KEY = 'moodradar_histdays_v1';
export const HISTORY_MAX_ROWS_KEY = 'moodradar_histrows_v1';
export const HISTORY_ENABLED_KEY = 'moodradar_histenabled_v1';
export const DEFAULT_HISTORY_RETENTION_DAYS = 14;
export const DEFAULT_HISTORY_MAX_ROWS = 50_000;
export const HISTORY_FLUSH_MS = 3000;
export const HISTORY_FLUSH_BATCH = 500;
export const HISTORY_PRUNE_INTERVAL_MS = 1_800_000;
export const HISTORY_QUOTA_TRIM_FRACTION = 0.2;

// --- Processing Constants ---
export const WINDOW_MS = 120_000;
export const QUEUE_CAP = 5000;
export const BOT_THRESHOLD = 60;
export const RECONNECT_DELAY_MS = 10_000;
export const CHANNEL_HISTORY_MAX = 20;
export const USER_PROFILE_WINDOW = 60_000;
export const RESIZE_DEBOUNCE_MS = 180;

// --- Mood System ---
export const MOODS = ['hype','funny','love','toxic','sad','calm','angry','excited','cringe','wholesome','confused','neutral'];
export const MOOD_COLORS = {hype:'#00ffe5',funny:'#ffe600',love:'#ff2d78',toxic:'#ff4800',sad:'#9b6ef3',calm:'#4fc3f7',angry:'#ff1744',excited:'#76ff03',cringe:'#e040fb',wholesome:'#ffab40',confused:'#78909c',neutral:'#2e3d5e'};

// --- Default Options ---
export const DEFAULT_OPTIONS = {
  density:'normal', gap:16, cardPad:18, fontScale:1,
  crtOpacity:1, gridOpacity:1,
  showSubtitle:true, showLegend:true, showDividers:true, compactStats:false,
  bubbleCount:22, bubbleSpeed:1, bubbleOpacity:0.28, bubbleHeight:260,
  pieLabels:true, pieAnimation:true,
  timelineHeight:320, tlGrid:true, tlSmooth:true,
  approvalMini:true, approvalVerdict:true,
  wakeLockEnabled:false,
  renderTextEmoji:true,
  cardVisibility:{}
};

// --- Resizable Card IDs ---
export const RESIZABLE_IDS = ['pieCard','topWordsCard','bubbleCard','approvalCard','approvalTimelineCard','throughputTimelineCard','timelineLinearCard','timelineLogCard','feedCard','filteredFeedCard','outlierCard','chatInputCard'];

// --- Layout Sections ---
export const LAYOUT_SECTIONS = [
  { id:'pieCard',             label:'Mood Distribution' },
  { id:'topWordsCard',        label:'Top 10 Substrings' },
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

// --- Known Bots ---
export const KNOWN_BOTS = new Set([
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

// --- Sentiment Raw Data ---
export const RAW = {
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

// Build TERM_MAP from RAW
export const TERM_MAP = new Map();
for (const [mood, arr] of Object.entries(RAW)) {
  for (const [term, w, label] of arr) {
    if (!TERM_MAP.has(term) || TERM_MAP.get(term).weight < w)
      TERM_MAP.set(term, { mood, weight:w, label });
  }
}
export const TERM_KEYS = [...TERM_MAP.keys()];

// --- Approval / Dissent Terms ---
export const APPROVAL_TERMS = new Map([
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
export const APPROVAL_KEYS = [...APPROVAL_TERMS.keys()];

// --- Emote Map (text → emoji) ---
// Authored with natural punctuation; keys are HTML-escaped at load time so
// matching works against messages that have already been passed through esc().
const _RAW_EMOTE_MAP = new Map([
  ['PogChamp','😲'],['Kappa','😏'],['KEKW','🤣'],['OMEGALUL','😂'],['LUL','😆'],
  ['4Head','😄'],['Kreygasm','😫'],['BibleThump','😢'],['ResidentSleeper','😴'],
  ['PepeHands','😭'],['Sadge','😞'],['monkaS','😰'],['monkaW','😨'],['COPIUM','🤡'],
  ['Pog','😮'],['PogO','😳'],['catJAM','🐱'],['ratJAM','🐀'],['PepeJAM','🎵'],
  ['GIGACHAD','🗿'],['5Head','🧠'],['WeirdChamp','😬'],['haHAA','😬'],['Pepega','🤪'],
  ['PauseChamp','😮'],['SadChamp','😔'],['FeelsBad','😟'],['PepeSad','😿'],
  ['PeepoCry','😭'],['PogHeart','💖'],['Prayge','🙏'],['monkaMad','😡'],
  ['PepeRage','🤬'],['MonkaMad','😤'],
  [':)','🙂'],[':D','😄'],[';)','😉'],[':P','😛'],[':(','😞'],[':O','😮'],
  ['<3','❤️'],['xD','😂'],['XD','😂'],[':3','😺'],['D:','😧'],
  ['B)','😎'],['>:(','😠'],[':/','😕'],[':*','😘'],
  [':fire:','🔥'],[':heart:','❤️'],[':skull:','💀'],[':clown:','🤡'],
  [':crown:','👑'],[':eyes:','👀'],[':pray:','🙏'],[':100:','💯'],
  [':cap:','🧢'],[':goat:','🐐'],[':W:','🔥'],[':L:','💀'],
  [':clap:','👏'],[':thumbsup:','👍'],[':thumbsdown:','👎'],
]);
const _escEmoteKey = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const EMOTE_MAP = new Map();
for (const [k, v] of _RAW_EMOTE_MAP) EMOTE_MAP.set(_escEmoteKey(k), v);
export const EMOTE_REGEX = new RegExp(
  [...EMOTE_MAP.keys()].map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|'),
  'g'
);

// Unescaped variants for DOM-based rendering paths that operate on raw
// message text rather than HTML-escaped strings.
export const RAW_EMOTE_MAP = new Map(_RAW_EMOTE_MAP);
export const RAW_EMOTE_REGEX = new RegExp(
  [..._RAW_EMOTE_MAP.keys()].map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|'),
  'g'
);

// --- Help Content ---
export const HELP_CONTENT = {
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
  topWords: {
    title: 'TOP 10 SUBSTRINGS',
    body: `<p>Shows the ten most-used standalone words across the live chat over the last 2 minutes, ranked by raw frequency.</p>
<ul>
  <li><strong>Standalone matching</strong> — "gg" inside "toggle" does NOT count. Only whole tokens are tallied, split on punctuation and whitespace.</li>
  <li><strong>Decay</strong> — Each word's count reflects occurrences in the past ~120 seconds. Older mentions drop off automatically.</li>
  <li><strong>Emotes</strong> — Emote names (Kappa, PogChamp, …) count as words. URLs and pure numbers are ignored.</li>
  <li><strong>Within-message dedupe</strong> — One user typing "gg gg gg gg" in one message is +1 for "gg", not +4.</li>
  <li><strong>Stopwords</strong> — Common function words (the, and, to, is, …) are filtered by default. Click the &#9881; icon in the title bar to add your own or unblock defaults; your list is saved locally.</li>
  <li><strong>Bot filter</strong> — Messages from detected bots are skipped when the bot filter is on, same as every other module.</li>
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
    body: `<p>A secondary live feed that shows only messages matching your filter in real time. Click the <strong>FILTER</strong> pill in the feed's title bar to open the editor.</p>
<h4 style="margin:12px 0 6px;color:var(--accent)">TWO FIELDS (combined with AND)</h4>
<ul>
  <li><strong>MESSAGE REGEX</strong> — a case-insensitive JavaScript regular expression tested against the message text. Invalid regex is highlighted red and won't apply.</li>
  <li><strong>USERNAME CONTAINS</strong> — a literal substring, case-insensitive, tested against the sender's name. Suggestions are populated from chatters seen so far.</li>
</ul>
<p>Leave either one empty to skip that filter. Leave both empty and the filtered feed shows nothing.</p>
<h4 style="margin:12px 0 6px;color:var(--accent)">LIVE PREVIEW</h4>
<p>While the modal is open, you'll see a running match count ("X of Y recent") and a small preview of the most recent matches. Preview data is only collected while the modal is open — close and reopen to start fresh.</p>
<h4 style="margin:12px 0 6px;color:var(--accent)">PERSISTENCE</h4>
<p>Click <strong>Apply</strong> to activate the filter. It keeps running in the background whether the modal is open or closed, and is restored on reload. The button in the title bar lights up with your current filter when active. Click <strong>Clear</strong> to turn the filter off.</p>
<h4 style="margin:12px 0 6px;color:var(--accent)">SAVED FILTERS</h4>
<p>Every applied filter is remembered (up to 20, newest first). Click one to restore, or press <strong>×</strong> to delete it. Press Escape or click outside the modal to close without applying.</p>
<h4 style="margin:12px 0 6px;color:var(--accent)">REGEX EXAMPLES</h4>
<ul>
  <li><code>\\\\?</code> — Messages containing a question mark</li>
  <li><code>^!</code> — Messages starting with !commands</li>
  <li><code>(lol|lmao|rofl)</code> — Messages containing any of these words</li>
  <li><code>\\\\bgg\\\\b</code> — Match "gg" as a whole word</li>
  <li><code>^[A-Z\\\\s]+$</code> — ALL CAPS messages only</li>
  <li><code>hype|pog</code> — Messages mentioning hype or pog</li>
</ul>`
  },
  outlier: {
    title: 'STANDOUT MESSAGES',
    body: `<p>Shows messages that deviate significantly from the current chat mood — the outliers.</p>
<ul>
  <li><strong>How it works</strong> - A message is flagged as a standout when its detected mood currently represents less than 15% of the weighted mood distribution and the message has meaningful sentiment strength.</li>
  <li><strong>Why it matters</strong> - These messages go against the grain of chat. They can reveal emerging mood shifts, contrarian opinions, or notable reactions before they become mainstream.</li>
</ul>`
  },
  chatAuth: {
    title: 'CHAT INPUT — HOW TO GET YOUR TOKEN',
    body: `<p>To send messages you need a Twitch <strong>OAuth token</strong> with chat permissions.</p>
<h4 style="margin:12px 0 6px;color:var(--accent)">OPTION A — Twitch Token Generator (easiest)</h4>
<ol>
  <li>Go to twitchtokengenerator.com</li>
  <li>Click <strong>"Custom Scope Token"</strong></li>
  <li>Under Chat scopes, enable <strong>user:write:chat</strong></li>
  <li>Click <strong>"Generate Token"</strong> and authorize</li>
  <li>Copy the Access Token and paste it here</li>
</ol>
<h4 style="margin:12px 0 6px;color:#ff4800">SECURITY NOTES</h4>
<ul>
  <li>Your token is stored <strong>locally in your browser</strong> (localStorage) — never sent to any server other than Twitch.</li>
  <li>Treat your token like a password. Never share it publicly.</li>
  <li>Tokens expire — if sending fails, generate a new one.</li>
</ul>`
  },
  youtubeApiKey: {
    title: 'YOUTUBE API KEY — FREE SETUP',
    body: `<p>YouTube blocks browser-only chat polling via CORS. The clean workaround is a <strong>free YouTube Data API v3 key</strong> from Google Cloud. <strong>No billing required.</strong></p>
<h4 style="margin:12px 0 6px;color:#00ffe5">COST: $0 — GUARANTEED</h4>
<ul>
  <li>YouTube Data API v3 has a <strong>hard daily cap of 10,000 units</strong>. When hit, requests return HTTP 403 — Google does <strong>not</strong> charge overage.</li>
  <li>You can only be charged if you (a) submit a quota-increase form, (b) wait for approval, and (c) manually enable billing. None of this happens automatically.</li>
  <li>This app adds a second safety layer: a local budget (default 9,000) that pauses polling before Google's cap.</li>
</ul>
<h4 style="margin:12px 0 6px;color:var(--accent)">STEP 1 — CREATE A GOOGLE CLOUD PROJECT</h4>
<ol>
  <li>Go to <strong>console.cloud.google.com</strong> and sign in with any Google account.</li>
  <li>Click the project dropdown at the top → <strong>"New Project"</strong>. Name it anything (e.g. <code>mood-radar</code>). Leave "Organization" as-is. Click <strong>Create</strong>.</li>
  <li>Select the new project from the dropdown.</li>
</ol>
<h4 style="margin:12px 0 6px;color:var(--accent)">STEP 2 — ENABLE THE YOUTUBE DATA API</h4>
<ol>
  <li>In the search bar at top, type <strong>"YouTube Data API v3"</strong>.</li>
  <li>Click the result → click <strong>Enable</strong>.</li>
</ol>
<h4 style="margin:12px 0 6px;color:var(--accent)">STEP 3 — CREATE AN API KEY</h4>
<ol>
  <li>In the left nav: <strong>APIs & Services → Credentials</strong>.</li>
  <li>Click <strong>"+ Create credentials" → "API key"</strong>.</li>
  <li>Copy the key (starts with <code>AIza...</code>).</li>
</ol>
<h4 style="margin:12px 0 6px;color:var(--accent)">STEP 4 — RESTRICT THE KEY (recommended)</h4>
<p>Click <strong>"Edit API key"</strong> on the key you just made and add these restrictions — extra safety in case the key ever leaks:</p>
<ul>
  <li><strong>Application restrictions:</strong> "HTTP referrers" → add your domain (e.g. <code>*.ranzlappen.com/*</code>) plus <code>http://localhost/*</code> if you run it locally.</li>
  <li><strong>API restrictions:</strong> "Restrict key" → select only <strong>YouTube Data API v3</strong>.</li>
</ul>
<p>This is optional but strongly recommended. An unrestricted key leaked on the web could be used by others, burning through your 10k daily quota.</p>
<h4 style="margin:12px 0 6px;color:var(--accent)">STEP 5 — PASTE IT HERE</h4>
<ol>
  <li>Paste the key into the <strong>API KEY</strong> field in this drawer.</li>
  <li>Click <strong>Save</strong>.</li>
  <li>Connect a YouTube channel that's currently live — chat will start flowing.</li>
</ol>
<h4 style="margin:12px 0 6px;color:var(--accent)">QUOTA ARITHMETIC</h4>
<ul>
  <li>Each poll for new messages = <strong>5 units</strong>. Each initial connect = <strong>1 unit</strong> extra.</li>
  <li>Units burned per hour = <code>3600 / min-poll-seconds × 5</code>. Yield at 9,000 budget by setting:
    <ul>
      <li><strong>2s</strong> (Google minimum) → ≈ 1 hour</li>
      <li><strong>5s</strong> (default) → ≈ 2.5 hours</li>
      <li><strong>10s</strong> → ≈ 5 hours</li>
      <li><strong>30s</strong> (max) → ≈ 15 hours</li>
    </ul>
  </li>
  <li>Use the <strong>MIN POLL</strong> slider in this drawer to stretch the daily quota — the live "≈ Xh" label shows the projected yield.</li>
  <li>Tradeoff: longer poll interval = more latency before new messages appear. On <em>extremely</em> fast chats (>50 msg/s), very long intervals can drop older messages because each call returns at most 200 items.</li>
  <li>Multiple YouTube feeds share the same daily counter.</li>
</ul>
<h4 style="margin:12px 0 6px;color:#ff4800">NOTES</h4>
<ul>
  <li>The key is stored <strong>locally in your browser</strong> only (localStorage). Never uploaded.</li>
  <li>The local usage counter resets at your <strong>local midnight</strong>. Google's real counter resets at <strong>midnight Pacific Time</strong>. If you burn near the cap right at local midnight, the daily budget protects you from drift.</li>
  <li>If Google ever returns 403 <code>quotaExceeded</code>, the app marks the day as exhausted until local midnight — reconnect attempts won't burn through.</li>
</ul>
<h4 style="margin:12px 0 6px;color:var(--accent)">IF 10,000 UNITS ISN'T ENOUGH</h4>
<p>Be warned: Google's quota-increase process for YouTube Data API v3 is <strong>not a simple click-to-raise</strong>. It routes to a dedicated application form (<code>support.google.com/youtube/contact/yt_api_form</code>) that asks for business details, expected traffic, and the justification for why your use case needs more. Approval for personal/hobby projects is <strong>unreliable</strong> and can take weeks. For most users: don't bother.</p>
<p><strong>Realistic lever — raise the MIN POLL slider first.</strong> That single slider in this drawer multiplies your daily yield for free:</p>
<ul>
  <li><strong>5s</strong> (default) → ≈ 2.5 h/day</li>
  <li><strong>10s</strong> → ≈ 5 h/day</li>
  <li><strong>15s</strong> → ≈ 7.5 h/day</li>
  <li><strong>30s</strong> (max) → ≈ 15 h/day</li>
</ul>
<p>10s is barely noticeable latency for mood analysis and gives you double the chat time. 30s covers a full workday of continuous chat on the free tier.</p>
<p><strong>Theoretical workaround — second project, second 10k quota.</strong> Each Google Cloud project gets an independent 10k/day quota. You could create a second project, enable the API on it, and make a second key. But <em>this app only holds one key at a time</em>, so you'd be manually swapping keys when one hits its cap — awkward UX. Not recommended.</p>
<p>If you genuinely do need more than ~15 hours/day of low-latency YouTube chat analysis, the quota-increase form is still the only official path. Otherwise, the MIN POLL slider is almost always the right answer.</p>`
  },
  rumbleWorker: {
    title: 'RUMBLE CHAT PROXY — SETUP',
    body: `<p><strong>Rumble sits behind Cloudflare's bot protection</strong>, which now rejects fetches from every major free serverless provider — Cloudflare Workers, Deno Deploy, Vercel, Netlify. Any proxy running on a known datacenter IP receives a "Just a moment..." challenge page instead of chat HTML.</p>
<p>The only reliable free path is running the proxy on a <strong>residential IP</strong> — your home PC, an old laptop, a Raspberry Pi, a NAS — and exposing it via a tunnel.</p>
<h4 style="margin:12px 0 6px;color:#ff4800">WHAT DOES NOT WORK</h4>
<ul>
  <li>Cloudflare Workers (blocked — CF challenges its own Worker egress into CF-protected sites)</li>
  <li>Deno Deploy (blocked — shared datacenter IP pool)</li>
  <li>Vercel, Netlify, Render, Railway serverless functions (blocked — same reason)</li>
  <li>Public CORS proxies (all blocked)</li>
</ul>
<h4 style="margin:12px 0 6px;color:var(--accent)">RECOMMENDED SETUP</h4>
<ol>
  <li>Install <strong>Node.js</strong> or <strong>Deno</strong> on any always-on machine at home.</li>
  <li>Save the code below as <code>rumble-proxy.js</code> and run it:
    <br><code>deno run --allow-net rumble-proxy.js</code>
    <br>or port to Node with <code>http.createServer</code>.</li>
  <li>Expose it publicly with one of:
    <ul>
      <li><strong>Cloudflare Tunnel</strong> (free) — egresses from your home IP, so CF's bot check doesn't fire</li>
      <li><strong>Tailscale Funnel</strong> (free)</li>
      <li>Port-forward + a dynamic-DNS service</li>
    </ul>
  </li>
  <li>Paste the public URL (e.g. <code>https://rumble-proxy.yourdomain.com</code>) into the <strong>Proxy URL</strong> input in this drawer and click <strong>Save</strong>.</li>
  <li>Reconnect the Rumble feed — chat will start flowing.</li>
</ol>
<h4 style="margin:12px 0 6px;color:var(--accent)">PROXY CODE (Deno)</h4>
<pre style="background:#06060f;border:1px solid var(--border);border-radius:6px;padding:10px;font-size:.7em;line-height:1.45;color:var(--text);overflow:auto;max-height:260px;white-space:pre;font-family:'Share Tech Mono',monospace;margin:0 0 8px"><code>Deno.serve({ port: 8787 }, async (req) =&gt; {
  const u = new URL(req.url);
  if (u.pathname !== '/rumble/messages') {
    return new Response('not found', { status: 404 });
  }
  const streamId = u.searchParams.get('streamId');
  if (!streamId) return new Response('missing streamId', { status: 400 });

  const page = await fetch(
    'https://rumble.com/' + encodeURIComponent(streamId),
    { headers: { 'user-agent': 'Mozilla/5.0' } }
  );
  const html = await page.text();
  const m = html.match(/"chat_id"\\s*:\\s*(\\d+)/)
         || html.match(/chat\\/api\\/chat\\/(\\d+)/);
  if (!m) return new Response('chat id not found', { status: 404 });

  const api = await fetch(
    'https://rumble.com/chat/api/chat/' + m[1] + '/messages',
    { headers: { 'user-agent': 'Mozilla/5.0' } }
  );
  const body = await api.text();
  return new Response(body, {
    status: api.status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
    },
  });
});</code></pre>
<h4 style="margin:12px 0 6px;color:var(--accent)">ENDPOINT SHAPE</h4>
<p>The app always calls <code>GET /rumble/messages?streamId=&lt;id&gt;</code> and expects Rumble's chat JSON in response. Any host that implements that path works — the code above is just one way to do it.</p>
<h4 style="margin:12px 0 6px;color:#ff4800">NOTES</h4>
<ul>
  <li>Only <strong>live</strong> streams have active chat. VODs return no messages.</li>
  <li>The saved URL lives in your browser only — nothing is uploaded.</li>
  <li>No trailing slash needed on the saved URL.</li>
  <li>If Rumble changes their page markup and the regex stops matching, tweak it in the proxy code and restart.</li>
  <li>If you don't have a home machine to run this on, Rumble chat in this app isn't realistically usable right now. Twitch, YouTube, and Kick work without any proxy.</li>
</ul>`
  }
};
