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
export const LABEL_SCALE_KEY = 'moodradar_labelscale_v1';
export const BUBBLE_SCALE_KEY = 'moodradar_bubblescale_v1';
export const OAUTH_STORAGE_KEY = 'moodradar_oauth_v1';
export const CHANNEL_HISTORY_KEY = 'moodradar_channels_v1';
export const FEED_FONT_KEY = 'moodradar_feedfont_v1';
export const OUTLIER_FONT_KEY = 'moodradar_outlierfont_v1';
export const FILTERED_FEED_FONT_KEY = 'moodradar_filteredfeedfont_v1';
export const RESIZE_STORAGE_KEY = 'moodradar_sizes_v2';
export const LAYOUT_STORAGE_KEY = 'moodradar_layout_v1';

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
  pieLabels:true, pieAnimation:true, radarAnimation:true, radarGrid:true,
  timelineHeight:320, tlGrid:true, tlSmooth:true,
  approvalMini:true, approvalVerdict:true,
  wakeLockEnabled:false,
  cardVisibility:{}
};

// --- Resizable Card IDs ---
export const RESIZABLE_IDS = ['pieCard','radarCard','bubbleCard','approvalCard','approvalTimelineCard','throughputTimelineCard','timelineLinearCard','timelineLogCard','feedCard','filteredFeedCard','outlierCard','chatInputCard'];

// --- Layout Sections ---
export const LAYOUT_SECTIONS = [
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
export const EMOTE_MAP = new Map([
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
export const EMOTE_REGEX = new RegExp(
  [...EMOTE_MAP.keys()].map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|'),
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
    body: `<p>A secondary live feed that shows only messages matching your regex filter in real time.</p>
<p><strong>Regex Examples:</strong></p>
<ul>
  <li><code>\\\\?</code> — Messages containing a question mark (default filter)</li>
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
  }
};
