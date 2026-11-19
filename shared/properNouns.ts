// Names students type in lower case ("ohio", "barcelona", "minecraft") that the dictionary only knows with a
// capital, or not at all. Each is accepted by the English word check. Kept to whole names that are not also
// everyday Spanish or Catalan words, so nothing in the class's own languages slips through ("Como", "Luna" and
// "Mira" are English names too, and are not here; nor are "pixar", "encanto" or "terrassa", which are "to pee",
// "charm" and "terrace" at home). Never a first name on its own either: with secret names on, a classmate's real
// name must stay stopped, so "mario", "elsa" or "aitana" are not here, and "billie" only works in "Billie Eilish".
// No imports, so the page and the worker share it. The teacher can allow more words on the teacher page.

const COUNTRIES = `afghanistan albania algeria andorra angola argentina armenia australia austria azerbaijan bahamas bahrain bangladesh
barbados belarus belgium belize benin bhutan bolivia bosnia botswana brazil brunei bulgaria burundi cambodia cameroon canada chad chile
china colombia comoros congo croatia cuba cyprus czechia denmark djibouti dominica ecuador egypt eritrea estonia eswatini ethiopia fiji
finland france gabon gambia georgia germany ghana greece grenada guatemala guinea guyana haiti honduras hungary iceland india indonesia
iran iraq ireland israel italy jamaica japan jordan kazakhstan kenya kiribati kosovo kuwait kyrgyzstan laos latvia lebanon lesotho
liberia libya liechtenstein lithuania luxembourg madagascar malawi malaysia maldives mali malta mauritania mauritius mexico micronesia
moldova monaco mongolia montenegro morocco mozambique myanmar namibia nauru nepal netherlands nicaragua niger nigeria norway oman
pakistan palau palestine panama paraguay peru philippines poland portugal qatar romania russia rwanda samoa senegal serbia seychelles
singapore slovakia slovenia somalia spain sudan suriname sweden switzerland syria taiwan tajikistan tanzania thailand togo tonga tunisia
turkey turkmenistan tuvalu uganda ukraine uruguay uzbekistan vanuatu vatican venezuela vietnam yemen zambia zimbabwe england scotland
wales britain america europe africa asia oceania antarctica catalonia catalunya andalusia galicia`;

const STATES = `alabama alaska arizona arkansas california colorado connecticut delaware florida hawaii idaho illinois indiana iowa kansas
kentucky louisiana maine maryland massachusetts michigan minnesota mississippi missouri montana nebraska nevada ohio oklahoma oregon
pennsylvania tennessee texas utah vermont virginia washington wisconsin wyoming`;

const CITIES = `london paris madrid barcelona valencia sevilla seville bilbao malaga zaragoza tarragona girona lleida reus salou sitges ibiza
mallorca majorca tenerife rome milan venice naples berlin munich hamburg amsterdam brussels lisbon porto dublin vienna prague budapest
warsaw moscow istanbul athens cairo dubai tokyo osaka beijing shanghai seoul bangkok delhi mumbai sydney melbourne toronto vancouver
montreal chicago boston miami orlando seattle denver houston dallas atlanta detroit vegas hollywood manhattan brooklyn york quebec havana
bogota caracas quito marrakech casablanca rabat tangier fez dakar lagos nairobi johannesburg liverpool manchester`;

// Near the school, around Spain, and where families come from.
const PLACES = `vendrell calafell cunit cubelles torredembarra altafulla cambrils portaventura montserrat penedes vilafranca vilanova
igualada sabadell badalona hospitalet mataro manresa vic montjuic tibidabo aragon navarra asturias cantabria murcia extremadura menorca
formentera lanzarote granada cordoba toledo salamanca vigo oviedo santander pamplona alicante benidorm almeria cadiz huelva burgos
valladolid segovia lima medellin montevideo guayaquil tetouan nador agadir oujda lahore karachi islamabad bucharest kyiv kiev`;

const APPS_AND_GAMES = `youtube youtuber youtubers minecraft fortnite roblox tiktok tiktoker instagram netflix spotify whatsapp snapchat discord
twitch google iphone ipad android samsung xbox playstation nintendo pokemon fifa nba nfl uefa disney marvel lego nike adidas mcdonalds
cocacola pepsi brawl clash gta valorant zelda luigi pikachu kirby amongus brawlhalla overwatch pinterest chatgpt gmail wikipedia duolingo
kahoot canva tetris pacman skyrim hogwarts`;

// Films, series, cartoons and their characters.
const SCREEN = `spiderman spidermen batman superman hulk avengers dreamworks shrek minions barbie moana olaf simba nemo grinch gru naruto
goku vegeta luffy anime manga voldemort jedi yoda vader spongebob simpsons totoro ghibli oppenheimer pinocchio garfield scooby snoopy
peppa bluey`;

// Singers and bands, footballers and other sports people, by the name everyone uses.
const MUSIC = `eilish rosalia quevedo shakira bizarrap beyonce rihanna eminem weeknd coldplay bts blackpink sheeran feid balvin ozuna duki
melendi estopa kpop`;
const SPORT = `barça atletico messi ronaldo neymar mbappe haaland lewandowski yamal pedri gavi raphinha vinicius bellingham modric lukaku
griezmann iniesta puyol gasol verstappen lebron laliga`;

// Food and shops, and dishes that English borrowed.
const FOOD_AND_BRANDS = `fanta nutella oreo oreos doritos cheetos pringles haribo colacao kfc telepizza starbucks mercadona primark decathlon
ikea lidl aldi carrefour shein temu xiaomi huawei lenovo sony microsoft tesla lamborghini ferrari porsche bmw audi toyota nissan ramen
carbonara churros churro empanada empanadas arepa arepas falafel chorizo`;

// Days, months and holidays, languages and peoples: in the dictionary only with a capital ("christmas", "english").
const CALENDAR = `monday tuesday wednesday thursday friday saturday sunday january february april june july september october november
december christmas xmas easter halloween hanukkah ramadan eid diwali`;
const PEOPLES = `english spanish catalan french german italian portuguese chinese japanese korean arabic russian ukrainian romanian moroccan
american british african european asian latin mexican argentinian argentine colombian peruvian venezuelan brazilian indian pakistani
bolivian ecuadorian chilean cuban dominican irish scottish greek turkish swedish norwegian finnish swiss austrian belgian egyptian
nigerian senegalese filipino thai vietnamese bulgarian hungarian algerian tunisian uruguayan paraguayan honduran canadian australian
galician andalusian`;

// Short forms said everywhere, and words too new for the dictionary.
const SHORT_AND_NEW = `tv pc wifi gif gifs dj usb ufo ufos gps cpu bbc nasa dna mvp npc npcs influencer influencers gamers vlog vlogger
esports livestream`;

export const PROPER_NOUNS: ReadonlySet<string> = new Set(
    `${COUNTRIES} ${STATES} ${CITIES} ${PLACES} ${APPS_AND_GAMES} ${SCREEN} ${MUSIC} ${SPORT} ${FOOD_AND_BRANDS} ${CALENDAR} ${PEOPLES} ${SHORT_AND_NEW}`
        .split(/\s+/).filter(Boolean));

// Names of more than one word, accepted only all together: "camila cabello", but not "cabello" (Spanish for hair),
// and "lamine yamal", but not "lamine" alone (a first name, maybe a classmate's).
export const PROPER_PHRASES: readonly string[] = `billie eilish|camila cabello|bad bunny|karol g|rauw alejandro|peso pluma|dua lipa|ariana grande|
olivia rodrigo|bruno mars|harry styles|taylor swift|lola indigo|myke towers|daddy yankee|lamine yamal|cristiano ronaldo|mohamed salah|
rafa nadal|carlos alcaraz|fernando alonso|marc marquez|xavi hernandez|real madrid|real betis|athletic bilbao|camp nou|super mario|
harry potter|star wars|stranger things|squid game|toy story|inside out|kung fu panda|despicable me|hello kitty|one piece|dragon ball|
iron man|among us|free fire|brawl stars|clash royale|stumble guys|subway surfers|geometry dash|rocket league|call of duty|san andreas|
grand theft auto|burger king|chupa chups|el vendrell|coma ruga|sant salvador|roda de bera|segur de calafell|sant jordi|sagrada familia|
park guell|costa brava|gran canaria|buenos aires|la paz|santo domingo|san juan|new york|los angeles|san francisco|las vegas|
rio de janeiro|sao paulo|vilanova i la geltru`.split('|').map(phrase => phrase.trim()).filter(Boolean);

// Short names that are everyday words at home, accepted only in capitals: "ESO", not "eso" ("that").
export const CAPITALS_ONLY: ReadonlySet<string> = new Set(['eso', 'ies']);

// How a name is written when it is suggested for a near miss: "Fortnite" for "fornite", "GTA" for "gat".
const WRITTEN: Record<string, string> = {
    youtube: 'YouTube', youtuber: 'YouTuber', youtubers: 'YouTubers', tiktok: 'TikTok', tiktoker: 'TikToker', iphone: 'iPhone', ipad: 'iPad',
    playstation: 'PlayStation', whatsapp: 'WhatsApp', mcdonalds: 'McDonalds', cocacola: 'CocaCola', pokemon: 'Pokémon', chatgpt: 'ChatGPT',
    spongebob: 'SpongeBob', amongus: 'Among Us', pacman: 'Pacman', kpop: 'Kpop', wifi: 'WiFi', 'barça': 'Barça', laliga: 'LaLiga',
    portaventura: 'PortAventura', esports: 'esports', influencer: 'influencer', influencers: 'influencers', gamers: 'gamers', vlog: 'vlog',
    vlogger: 'vlogger', livestream: 'livestream',
};
const CAPITALS = /^(?:tv|pc|gif|gifs|dj|usb|ufo|ufos|gps|cpu|bbc|nasa|dna|mvp|npc|npcs|gta|bts|kfc|bmw|nba|nfl|uefa|fifa)$/;
export function properName(entry: string): string {
    if (WRITTEN[entry]) return WRITTEN[entry];
    if (CAPITALS.test(entry)) return entry.toUpperCase();
    return entry.charAt(0).toUpperCase() + entry.slice(1);
}

// Lower case, no accents, every run of other characters one space: "Coma-ruga" and "coma ruga" read the same.
const flat = (text: string): string => ` ${text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}]+/gu, ' ').trim()} `;
const PHRASES_FLAT = PROPER_PHRASES.map(phrase => flat(phrase));

// The words of every listed full name in a message, lower case without accents, to accept them there.
export function phraseWords(text: string): Set<string> {
    const plain = flat(text);
    const found = new Set<string>();
    for (const phrase of PHRASES_FLAT) if (plain.includes(phrase)) for (const word of phrase.trim().split(' ')) found.add(word);
    return found;
}
