// Default stopword set — grammatical function words only. Kept intentionally
// conservative: chat interjections like gg, lol, xd, pog, kek are NOT here so
// they remain counted in the top-10 substrings module.
export const DEFAULT_STOPWORDS = Object.freeze(new Set([
  'a','an','the',
  'and','or','but','nor','so','yet','if','as','than','then','because','while','though','although','until','unless','when','whenever','where','wherever','whether',
  'is','am','are','was','were','be','been','being',
  'do','does','did','doing','done',
  'have','has','had','having',
  'will','would','shall','should','can','could','may','might','must',
  'to','of','in','on','at','by','for','from','with','into','onto','upon','about','above','after','against','along','among','around','before','behind','below','beneath','beside','between','beyond','down','during','except','inside','near','off','out','outside','over','past','through','throughout','toward','towards','under','underneath','up','via','within','without',
  'i','me','my','mine','myself',
  'you','your','yours','yourself','yourselves',
  'he','him','his','himself',
  'she','her','hers','herself',
  'it','its','itself',
  'we','us','our','ours','ourselves',
  'they','them','their','theirs','themselves',
  'this','that','these','those',
  'who','whom','whose','which','what',
  'there','here','where',
  'not','no',
  'all','any','both','each','few','more','most','other','some','such','only','own','same','too','very','just',
  'also','even','still','again','ever','never','always','often','sometimes','now',
  's','t','d','ll','re','ve','m',
  'don','didn','doesn','isn','wasn','weren','aren','hasn','haven','hadn','won','wouldn','shouldn','couldn','can',
  'im','ive','id','ill','youre','youve','youll','hes','shes','its','were','theyre','theyve','theyll','wasnt','isnt','arent','dont','doesnt','didnt','wont','cant','hasnt','havent',
]));
