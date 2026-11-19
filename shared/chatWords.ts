// Words of the chat that are not in an English dictionary: the ones that are fine, the text-speak with an obvious
// fix, and words from the class's own languages (Spanish and Catalan) with their English. No imports, so the page
// and the worker share them.

// Said out loud and typed everywhere, but not in a dictionary.
export const CHAT_WORDS = new Set(['lol', 'omg', 'ok', 'okay', 'hi', 'hey', 'yeah', 'yep', 'nope', 'wow', 'hmm', 'hm', 'uh', 'um',
  'oh', 'aw', 'yay', 'bye', 'plaza', 'pixel', 'emoji']);

// Text-speak is not English either, but it has an obvious fix.
export const TEXT_SPEAK: Record<string, string> = {
  u: 'you', r: 'are', ur: 'your', y: 'why', pls: 'please', plz: 'please', thx: 'thanks', thnx: 'thanks', ty: 'thank you',
  im: "I'm", dont: "don't", cant: "can't", wont: "won't", didnt: "didn't", doesnt: "doesn't", isnt: "isn't", ive: "I've",
  idk: "I don't know", bc: 'because', cuz: 'because', gonna: 'going to', wanna: 'want to', gotta: 'have to'
};

// The class's own languages (Spanish and Catalan): the English word is the suggestion, rather than a look-alike
// such as "six" for "si". The word is still stopped.
export const HOME_WORDS: Record<string, string> = {
  si: 'yes', 'sí': 'yes', hola: 'hello', adios: 'bye', 'adiós': 'bye', adeu: 'bye', 'adéu': 'bye', gracias: 'thank you',
  'gràcies': 'thank you', gracies: 'thank you', merci: 'thank you', vale: 'OK', valeee: 'OK', bueno: 'well', bé: 'well', bien: 'good',
  pero: 'but', 'però': 'but', que: 'what', 'qué': 'what', 'què': 'what', como: 'how', 'cómo': 'how', com: 'how', donde: 'where',
  'dónde': 'where', quien: 'who', 'quién': 'who', qui: 'who', porque: 'because', 'perquè': 'because', perque: 'because',
  mira: 'look', tio: 'dude', 'tío': 'dude', tia: 'girl', 'tía': 'girl', jaja: 'haha', jajaja: 'haha', perdon: 'sorry', 'perdón': 'sorry',
  'perdó': 'sorry', amiga: 'friend', amic: 'friend', nada: 'nothing', res: 'nothing', mucho: 'a lot', molt: 'very', tambien: 'too',
  'también': 'too', 'també': 'too', aqui: 'here', 'aquí': 'here', alli: 'there', 'allí': 'there', alla: 'there',
};
