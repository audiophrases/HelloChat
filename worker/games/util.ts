// Small tools every game uses. No imports beyond types, so node runs them directly in the tests.
import type { Level, View } from '../../shared/protocol.ts';
import type { Base, Ctx, Out, Player, Setting } from './types.ts';

export function shuffle<T>(items: readonly T[], rnd: () => number): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
export const pick = <T,>(items: readonly T[], rnd: () => number): T => items[Math.floor(rnd() * items.length)];
export const sample = <T,>(items: readonly T[], count: number, rnd: () => number): T[] => shuffle(items, rnd).slice(0, count);

// ---------- Reading what a student wrote ----------

export const plain = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’`]/g, "'");
export const wordsOf = (text: string): string[] => plain(text).match(/[\p{L}\p{N}]+(?:'[\p{L}]+)*/gu) ?? [];
export const wordCount = (text: string): number => wordsOf(text).length;

const QUESTION_START = /^(who|what|when|where|why|which|whose|how|do|does|did|is|are|am|was|were|can|could|will|would|should|have|has|had|may|shall)\b/;
// A question: it ends with "?" (or has one), or starts like one. Learners forget the mark more than the word order.
export function isQuestion(text: string, minWords = 2): boolean {
    const words = wordsOf(text);
    if (words.length < minWords) return false;
    return text.includes('?') || QUESTION_START.test(plain(text).trim());
}

// A word with its everyday endings: "dragon" is in "dragons", "dance" in "dancing", "city" in "cities".
function forms(word: string): string[] {
    const w = plain(word).trim();
    const out = new Set([w, `${w}s`, `${w}es`, `${w}ed`, `${w}d`, `${w}ing`, `${w}'s`]);
    if (w.endsWith('e')) { out.add(`${w.slice(0, -1)}ing`); }
    if (w.endsWith('y')) { out.add(`${w.slice(0, -1)}ies`); out.add(`${w.slice(0, -1)}ied`); }
    if (/[^aeiou][aeiou][^aeiouwxy]$/.test(w)) { const last = w.at(-1)!; out.add(`${w}${last}ing`); out.add(`${w}${last}ed`); }
    if (w.endsWith('f')) out.add(`${w.slice(0, -1)}ves`);
    if (w.endsWith('fe')) out.add(`${w.slice(0, -2)}ves`);
    return [...out];
}

// True when the text says the word (or words, for "ice cream"), in any everyday form.
export function says(text: string, word: string): boolean {
    const target = wordsOf(word);
    if (!target.length) return false;
    const words = wordsOf(text);
    const squeezed = words.join('');
    // "icecream" and "ice-cream" for "ice cream"
    if (target.length > 1 && squeezed.includes(target.join(''))) return true;
    const lastForms = forms(target.at(-1)!);
    for (let i = 0; i + target.length <= words.length; i++) {
        if (target.slice(0, -1).every((part, j) => words[i + j] === part) && lastForms.includes(words[i + target.length - 1])) return true;
    }
    return false;
}
export const saysAny = (text: string, words: readonly string[]): string | null => words.find(word => says(text, word)) ?? null;

// The same answer, however it is typed: no capitals, accents, articles or punctuation.
export const answerKey = (text: string): string => wordsOf(text).filter(word => !['a', 'an', 'the'].includes(word)).join(' ');

// ---------- Players and turns ----------

export const nameOf = (ctx: Ctx, key: string): string => ctx.players.find(player => player.key === key)?.name ?? 'Someone';
export const others = (ctx: Ctx, key: string): Player[] => ctx.players.filter(player => player.key !== key);
export const has = (ctx: Ctx, key: string | null | undefined): boolean => !!key && ctx.players.some(player => player.key === key);

// Whoever sits after this player; the first player when they have gone.
export function after(ctx: Ctx, key: string | null): string {
    const at = ctx.players.findIndex(player => player.key === key);
    return ctx.players[(at + 1) % ctx.players.length]?.key ?? '';
}

// "Ana", "Ana and Ben", "Ana, Ben and Cleo"
export function list(names: readonly string[]): string {
    if (names.length <= 1) return names[0] ?? '';
    return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
export const othersNames = (ctx: Ctx, key: string): string => list(others(ctx, key).map(player => player.name)) || 'your partner';

export function star(s: Base, key: string, count = 1): void {
    if (count > 0) s.stars[key] = (s.stars[key] ?? 0) + count;
}
export const base = (): Base => ({ stars: {}, due: null, over: false });

export const seats = (s: Base, ctx: Ctx, turn?: string | null, tags: Record<string, string> = {}): View['seats'] =>
    ctx.players.map(player => ({ key: player.key, stars: s.stars[player.key] ?? 0, ...(turn === player.key ? { turn: true } : {}), ...(tags[player.key] ? { tag: tags[player.key] } : {}) }));

export const timer = (s: Base, total: number): View['timer'] => (s.due ? { ends: s.due, total } : null);

// The end of a game: who did best, in one friendly line each.
export function finish(s: Base, ctx: Ctx, title = 'Well done!'): NonNullable<View['over']> {
    const ranked = [...ctx.players].sort((a, b) => (s.stars[b.key] ?? 0) - (s.stars[a.key] ?? 0));
    return { title, lines: ranked.map(player => `${player.name}: ${s.stars[player.key] ?? 0} ⭐`) };
}

// Content by level: the level's own cards first, then easier ones, so a deck is never empty.
const ORDER: Level[] = ['A1', 'A2', 'B1'];
export function forLevel<T extends { level: Level }>(items: readonly T[], level: Level): T[] {
    const exact = items.filter(item => item.level === level);
    if (exact.length >= 8) return exact;
    const at = ORDER.indexOf(level);
    const near = items.filter(item => ORDER.indexOf(item.level) <= at);
    return near.length ? near : [...items];
}

// A deck that never runs out and repeats nothing until everything was seen: ids already dealt are kept in `seen`.
export function deal<T>(items: readonly T[], seen: string[], idOf: (item: T) => string, rnd: () => number): T {
    let fresh = items.filter(item => !seen.includes(idOf(item)));
    if (!fresh.length) { seen.length = 0; fresh = [...items]; }
    const card = pick(fresh, rnd);
    seen.push(idOf(card));
    return card;
}

// ---------- What the teacher can change ----------

type Spec = Omit<Setting, 'key'>;
export const seconds = (label: string, def: number, min = 5, max = 900): Spec => ({ label, unit: 's', def, min, max });
export const minutes = (label: string, def: number, min = 0, max = 30): Spec => ({ label, unit: 'min', def, min, max });
export const count = (label: string, def: number, min: number, max: number, a1?: number): Spec => ({ label, unit: 'n', def, min, max, ...(a1 === undefined ? {} : { a1 }) });

// A game's settings: the list for the teacher page, and the value a table plays with (the teacher's, kept within
// limits, or the usual one for the table's level).
export function settings<K extends string>(specs: Record<K, Spec>) {
    const list: Setting[] = (Object.keys(specs) as K[]).map(key => ({ key, ...specs[key] }));
    const get = (ctx: Ctx, key: K): number => {
        const spec = specs[key];
        const value = ctx.opts.tune?.[key];
        if (typeof value === 'number' && Number.isFinite(value)) return Math.min(spec.max, Math.max(spec.min, Math.round(value)));
        return ctx.opts.level === 'A1' && spec.a1 !== undefined ? spec.a1 : spec.def;
    };
    const ms = (ctx: Ctx, key: K): number => get(ctx, key) * (specs[key].unit === 'min' ? 60_000 : 1000);
    return { list, get, ms };
}

// Two things the game says, one after the other.
export const both = (a: Out, b: Out): Out => ({
    ...(a.say || b.say ? { say: [...(a.say ?? []), ...(b.say ?? [])] } : {}),
    ...(a.fx || b.fx ? { fx: [...(a.fx ?? []), ...(b.fx ?? [])] } : {}),
    ...(a.report ?? b.report ? { report: a.report ?? b.report } : {}),
});
