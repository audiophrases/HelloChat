import NSpell from 'nspell';
import { insultIn, slurIn } from '../shared/safety.ts';
import { CAPITALS_ONLY, PROPER_NOUNS, phraseWords, properName } from '../shared/properNouns.ts';
import { CHAT_WORDS, HOME_WORDS, TEXT_SPEAK } from '../shared/chatWords.ts';

// Checks that every word in a message is English, with a way to fix each one.
// A dictionary cannot tell a typo from another language, so both are stopped:
// "recieve" and "gracias" are told apart only by how good the suggestions are.

// sure: the first suggestion is very likely what was meant (a near miss, a name, text-speak, a word from home),
// so the student already has the fix; otherwise a teacher may need to help.
export type Misspelling = { word: string; suggestions: string[]; sure?: boolean; banned?: boolean };

const LAUGH = /^(ha|he)+h?$/i;

const WORD = /\p{L}+(?:['’]\p{L}+)*/gu;

export type Checker = (text: string, names?: string[]) => Misspelling[];

export type Dictionary = { aff: string; dic: string };

// Letters stretched for feeling, as in "helloooo", "nooo" or "yesss": the word with each run of a repeated
// letter as one letter or two. "siiii" becomes "si" and "sii", which are still not English.
function unstretched(word: string): string[] {
  const runs = word.match(/(.)\1*/gu) ?? [];
  if (!runs.some(run => run.length > 1)) return [];
  let words = [''];
  for (const run of runs) {
    words = words.flatMap(start => run.length > 1 ? [start + run[0], start + run[0] + run[0]] : [start + run]);
    if (words.length > 64) return [];
  }
  return words.filter(short => short !== word);
}

// How many letters must change to turn one word into the other.
function editDistance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}

// The listed name closest to a misspelt word, written as it is usually written ("Fortnite"), if it is close enough.
function nearestProper(plain: string): { name: string; distance: number } | undefined {
  let best: { name: string; distance: number } | undefined;
  for (const entry of PROPER_NOUNS) {
    if (entry.length < 4 || Math.abs(entry.length - plain.length) > 2) continue;
    const distance = editDistance(plain, entry);
    if (distance <= (plain.length >= 7 ? 2 : 1) && (!best || distance < best.distance)) best = { name: properName(entry), distance };
  }
  return best;
}

// aff and dic are a Hunspell dictionary, as in the dictionary-en package: American
// English, the one dialect the class uses, so every suggestion is American. `alsoAccept`
// is another dictionary (British) whose words are fine when typed but never suggested.
export function createChecker(aff: string, dic: string, alsoAccept?: Dictionary): Checker {
  const speller = NSpell(aff, dic);
  const other = alsoAccept && NSpell(alsoAccept.aff, alsoAccept.dic);
  const correct = (word: string) => speller.correct(word) || !!other?.correct(word);
  return (text, names = []) => {
    // Classmates' names, with and without accents: "alvaro" is Àlvaro.
    const bare = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '');
    const known = new Set(names.flatMap(name => [name.toLowerCase(), bare(name.toLowerCase())]).flatMap(name => name.split(/[^\p{L}]+/u)).filter(Boolean));
    // Name words as written ("Lamine", not "lamine"), to suggest for a misspelt name.
    const nameWords = new Map<string, string>();
    for (const part of names.flatMap(name => name.split(/[^\p{L}]+/u)).filter(part => part.length > 3)) {
      const key = part.toLowerCase();
      if (!nameWords.has(key) || /^\p{Lu}/u.test(part)) nameWords.set(key, part);
    }
    // Words of a well-known full name in this message ("billie eilish"): fine together, not alone.
    const phrased = phraseWords(text);
    const found = new Map<string, Misspelling>();
    for (const [raw] of text.matchAll(WORD)) {
      const word = raw.replace(/’/g, "'");
      const lower = word.toLowerCase();
      // A slur, or a name thrown as an insult, is never all right and never gets a suggestion: "nigg" must not be offered "nigh".
      if (!found.has(lower) && (slurIn(word) || insultIn(word))) { found.set(lower, { word: raw, suggestions: [], banned: true }); continue; }
      if (found.has(lower) || CHAT_WORDS.has(lower) || LAUGH.test(lower) || known.has(lower) || known.has(bare(lower))) continue;
      // Places, games, films, artists and the like typed in lower case ("ohio", "minecraft"), and full names.
      if (PROPER_NOUNS.has(lower) || PROPER_NOUNS.has(bare(lower)) || phrased.has(bare(lower))) continue;
      // Short names that are everyday words at home, only in capitals: "ESO", not "eso".
      if (CAPITALS_ONLY.has(lower) && word === word.toUpperCase()) continue;
      if (lower === 'a' || lower === 'i') continue;
      if (TEXT_SPEAK[lower]) { found.set(lower, { word: raw, suggestions: [TEXT_SPEAK[lower]], sure: true }); continue; }
      if (lower.length > 1 && correct(word)) continue;
      // Hunspell is case-sensitive: a word that is only fine in lower case, in capitals.
      if (lower.length > 1 && correct(lower)) continue;
      // "i'm", "i'll", "i've", "i'd": the dictionary only has them with a capital I.
      if (/^i'\p{L}/u.test(lower) && correct('I' + lower.slice(1))) continue;
      if (unstretched(lower).some(short => CHAT_WORDS.has(short) || LAUGH.test(short) || known.has(short) || (short.length > 1 && correct(short)))) continue;
      // Learners type "cafe" and "café" alike: accents do not make a word foreign.
      const plain = lower.normalize('NFD').replace(/\p{M}/gu, '');
      if (plain !== lower && (correct(plain) || known.has(plain))) continue;
      const home = HOME_WORDS[lower] ?? HOME_WORDS[plain] ?? unstretched(lower).map(short => HOME_WORDS[short]).find(Boolean);
      // A name typed nearly right ("lamaine" for Lamine) is offered the name first.
      const nameMatch = lower.length > 3 ? [...nameWords].map(([key, written]) => ({ written, distance: editDistance(plain, key.normalize('NFD').replace(/\p{M}/gu, '')) }))
        .filter(item => item.distance <= 2).sort((a, b) => a.distance - b.distance)[0] : undefined;
      const name = nameMatch?.written;
      const words = lower.length > 1 ? speller.suggest(lower) : [];
      // A name from the lists typed nearly right ("Fornite", "miencraft"): one letter off, or two in a long word.
      // After the dictionary's best word when that is as close ("salas": sales, then Salah).
      const proper = !name && plain.length >= 4 ? nearestProper(plain) : undefined;
      const nearWord = !!proper && words.some(candidate => editDistance(plain, candidate.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')) <= proper.distance);
      const withProper = proper ? (nearWord ? [words[0], proper.name, ...words.slice(1)] : [proper.name, ...words]) : words;
      // Never a suggestion that would itself be stopped ("Epstein" for "epstien").
      const suggestions = home ? [home] : [...new Set(name ? [name, ...words] : withProper)].filter(item => !slurIn(item) && !insultIn(item)).slice(0, 3);
      // Sure only when there is no doubt: a word from home, a name one letter off (two in a long name), or a
      // dictionary word one letter off with no other word as close ("beatiful"; not "dancying", which could be two).
      const strip = (text: string) => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
      const close = words.filter(candidate => editDistance(plain, strip(candidate)) <= 1);
      const sureName = !!nameMatch && nameMatch.distance <= (plain.length >= 7 ? 2 : 1);
      const sureProper = !!proper && !nearWord && !close.length;
      found.set(lower, { word: raw, suggestions, sure: !!home || sureName || sureProper || (!name && !proper && plain.length > 3 && close.length === 1 && close[0] === words[0]) });
    }
    // One spelt out across words ("n i g g a") or with signs inside ("n.i.g.g.a").
    const hidden = slurIn(text) ?? insultIn(text);
    if (hidden && ![...found.values()].some(item => item.banned)) found.set(`#${hidden}`, { word: hidden, suggestions: [], banned: true });
    return [...found.values()];
  };
}
