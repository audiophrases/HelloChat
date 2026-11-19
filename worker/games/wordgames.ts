// Word games: Name 10! (a list race), Emoji Story (one sentence from three pictures) and Don't Say It! (describe a
// word without the forbidden ones).
import { CATEGORIES, DESCRIBE, DICE, TABOO, type Category, type Taboo, type Thing } from '../content/words.ts';
import type { Base, Ctx, Game, Out } from './types.ts';
import { after, answerKey, base, both, count, deal, finish, forLevel, has, isQuestion, nameOf, othersNames, sample, says, saysAny, seats, seconds, settings, star, timer, wordCount } from './util.ts';

// ---------- Name 10! ----------

type Item = { id: string; text: string; by: string; ask: boolean };
type Name10 = Base & { cat: Category; seen: string[]; items: Item[]; goal: number; n: number; of: number; phase: 'play' | 'next'; got: number };
const LIST = settings({
    list: seconds('Time for each list', 100),
    goal: count('Things to name', 10, 3, 30),
    rounds: count('Lists in free play', 3, 1, 20),
});

function dealList(s: Name10, ctx: Ctx): void {
    s.cat = deal(forLevel(CATEGORIES, ctx.opts.level), s.seen, category => category.id, ctx.rnd);
    s.items = []; s.phase = 'play'; s.n += 1;
    s.due = ctx.now + LIST.ms(ctx, 'list');
}
const counted = (s: Name10): number => s.items.filter(item => !item.ask).length;

function listDone(s: Name10, ctx: Ctx): Out {
    if (counted(s) < s.goal) return {};
    for (const player of ctx.players) star(s, player.key, 2);
    s.got += 1; s.phase = 'next'; s.due = ctx.now + 5000;
    return { say: [{ text: `🎉 ${s.goal} ${s.cat.title}! Great teamwork.`, tone: 'good' }], fx: [{ kind: 'win' }] };
}

export const name10: Game<Name10> = {
    id: 'name10', kind: 'warmup', title: 'Name 10!', icon: '🔟', min: 2, max: 4, ideal: 3, minutes: 4, levels: ['A1', 'A2', 'B1'], settings: LIST.list,
    blurb: 'A race against the clock: name 10 things together, one word in each message.',
    how: ['Read the topic.', 'Write one thing in each message.', 'Get 10 together before the time ends!'],
    example: ['fridge', 'spoon', 'a big table', 'Is a cat OK? 😄'],
    create(ctx) {
        const s = { ...base(), seen: [], items: [], goal: LIST.get(ctx, 'goal'), n: 0, of: LIST.get(ctx, 'rounds'), got: 0 } as unknown as Name10;
        dealList(s, ctx);
        return s;
    },
    chat(s, ctx, from, text) {
        if (s.over || s.phase !== 'play') return {};
        const count = wordCount(text);
        if (count < 1 || count > 3 || text.includes('?')) return {};
        const key = answerKey(text);
        if (!key) return {};
        if (s.items.some(item => answerKey(item.text) === key || says(item.text, key) || says(key, item.text))) return { say: [{ to: from, text: `“${text.trim()}” is on the list already. Think of another one!`, tone: 'bad' }] };
        const known = !!saysAny(text, s.cat.words);
        s.items.push({ id: `i${s.items.length}`, text: key, by: from, ask: !known });
        if (!known) return {};
        star(s, from);
        return both({ fx: [{ to: from, kind: 'good' }] }, listDone(s, ctx));
    },
    act(s, ctx, from, act, data) {
        if (s.over || s.phase !== 'play' || act !== 'ok') return {};
        const item = s.items.find(entry => entry.id === (data as { id?: unknown })?.id);
        if (!item || !item.ask || item.by === from) return {};
        item.ask = false;
        star(s, item.by);
        return both({ fx: [{ to: item.by, kind: 'good' }] }, listDone(s, ctx));
    },
    tick(s, ctx) {
        if (s.over) return {};
        const out: Out = s.phase === 'play' ? { say: [{ text: `⏰ Time! You named ${counted(s)} ${s.cat.title}.` }] } : {};
        if (!ctx.opts.endless && s.n >= s.of) { s.over = true; s.due = null; return both(out, { fx: [{ kind: 'win' }] }); }
        dealList(s, ctx);
        return both(out, { say: [{ text: `Next: ${s.cat.emoji} ${s.cat.title}!` }] });
    },
    join: () => ({}),
    leave: () => ({}),
    view(s, ctx, me) {
        const have = counted(s);
        const toCheck = s.items.filter(item => item.ask && item.by !== me);
        return {
            now: s.over ? { tone: 'done', text: `You finished ${s.got} of ${s.of} lists. Well done!` }
                : s.phase === 'next' ? { tone: 'wait', text: `🎉 ${s.goal}! Next list coming…` }
                    : { tone: 'go', text: `Write ${s.cat.title} — one thing in each message!`, sub: toCheck.length ? `Is “${toCheck[0].text}” right? Tap 👍 on the list.` : `${have} of ${s.goal}. You and ${othersNames(ctx, me)} need ${Math.max(0, s.goal - have)} more.` },
            chat: { hint: 'One thing, then Enter' },
            board: [
                { w: 'card', emoji: s.cat.emoji, label: `Name ${s.goal}…`, title: s.cat.title },
                { w: 'items', goal: s.goal, act: 'ok', items: s.items.map(item => ({ id: item.id, text: item.text, by: item.by, ...(item.ask ? { ask: true } : {}) })) },
            ],
            timer: s.phase === 'play' ? timer(s, LIST.ms(ctx, 'list')) : null,
            seats: seats(s, ctx),
            round: ctx.opts.endless ? undefined : { n: s.n, of: s.of },
            over: s.over ? finish(s, ctx) : null,
        };
    },
    status: s => `${s.cat.title}: ${counted(s)}/${s.goal}`,
};

// ---------- Emoji Story ----------

type Emoji = Base & {
    dice: Thing[]; seen: string[]; lines: Record<string, string>; votes: Record<string, string>; asked: string[];
    phase: 'write' | 'vote' | 'talk' | 'next'; n: number; of: number;
};
const EMOJI = settings({
    write: seconds('Time to write the sentence', 100),
    vote: seconds('Time to vote (3 or 4 players)', 40),
    talk: seconds('Time to ask about the stories', 50),
    words: count('Words in the sentence', 5, 1, 20),
    rounds: count('Stories in free play', 3, 1, 20),
});

function dealEmoji(s: Emoji, ctx: Ctx): void {
    s.dice = sample(DICE.filter(die => !s.seen.includes(die.word)), 3, ctx.rnd);
    if (s.dice.length < 3) { s.seen = []; s.dice = sample(DICE, 3, ctx.rnd); }
    s.seen.push(...s.dice.map(die => die.word));
    s.lines = {}; s.votes = {}; s.asked = []; s.phase = 'write'; s.n += 1;
    s.due = ctx.now + EMOJI.ms(ctx, 'write');
}

function showStories(s: Emoji, ctx: Ctx): Out {
    const writers = ctx.players.filter(player => s.lines[player.key]);
    const say = writers.map(player => ({ text: `📖 ${player.name}: ${s.lines[player.key]}` }));
    if (writers.length >= 3) { s.phase = 'vote'; s.due = ctx.now + EMOJI.ms(ctx, 'vote'); }
    else if (writers.length) { s.phase = 'talk'; s.due = ctx.now + EMOJI.ms(ctx, 'talk'); }
    else { s.phase = 'next'; s.due = ctx.now + 2000; }
    return { say };
}

function countVotes(s: Emoji, ctx: Ctx): Out {
    const tally = new Map<string, number>();
    for (const vote of Object.values(s.votes)) tally.set(vote, (tally.get(vote) ?? 0) + 1);
    const most = Math.max(0, ...tally.values());
    const winners = most ? [...tally].filter(([, count]) => count === most).map(([key]) => key) : [];
    for (const key of winners) star(s, key, 2);
    s.phase = 'next'; s.due = ctx.now + 6000;
    return winners.length ? { say: [{ text: `🏆 Favourite story: ${winners.map(key => nameOf(ctx, key)).join(' and ')}!`, tone: 'good' }], fx: winners.map(key => ({ to: key, kind: 'win' as const })) } : {};
}

export const emojistory: Game<Emoji> = {
    id: 'emojistory', kind: 'warmup', title: 'Emoji Story', icon: '📖', min: 2, max: 4, ideal: 3, minutes: 5, levels: ['A1', 'A2', 'B1'], settings: EMOJI.list,
    blurb: 'Three pictures, one sentence. Whose tiny story is the funniest?',
    how: ['Look at the 3 pictures.', 'Write ONE sentence with them. It is secret!', 'Read all the stories and choose your favourite.'],
    example: ['The dragon ate a pizza on the moon.', '😂 Why was the dragon on the moon?', 'Because it was hungry!'],
    create(ctx) {
        const s = { ...base(), seen: [], n: 0, of: EMOJI.get(ctx, 'rounds') } as unknown as Emoji;
        dealEmoji(s, ctx);
        return s;
    },
    chat(s, ctx, from, text) {
        if (s.over) return {};
        if (s.phase === 'write' && !s.lines[from]) {
            const used = s.dice.filter(die => says(text, die.word)).length;
            const words = EMOJI.get(ctx, 'words');
            if (wordCount(text) < words || used < 2) {
                return { block: used < 2 ? `Use the picture words in your sentence: ${s.dice.map(die => die.word).join(', ')}.` : `Write a longer sentence (${words} words or more).` };
            }
            s.lines[from] = text.trim();
            star(s, from, used === 3 ? 2 : 1);
            const out: Out = { fx: [{ to: from, kind: 'star' }] };
            return ctx.players.every(player => s.lines[player.key]) ? { secret: true, ...both(out, showStories(s, ctx)) } : { secret: true, ...out };
        }
        if (s.phase === 'talk' && !s.asked.includes(from) && isQuestion(text, 3)) {
            s.asked.push(from);
            star(s, from);
            if (ctx.players.every(player => s.asked.includes(player.key))) { s.phase = 'next'; s.due = ctx.now + 15_000; }
            return { fx: [{ to: from, kind: 'star' }] };
        }
        return {};
    },
    act(s, ctx, from, act, data) {
        if (s.over) return {};
        if (act === 'vote' && s.phase === 'vote') {
            const key = String((data as { id?: unknown })?.id ?? '');
            if (key === from || !s.lines[key] || !has(ctx, key)) return {};
            s.votes[from] = key;
            return ctx.players.every(player => s.votes[player.key]) ? countVotes(s, ctx) : {};
        }
        if (act === 'next' && (s.phase === 'talk' || s.phase === 'next')) return advance(s, ctx);
        return {};
    },
    tick(s, ctx) {
        if (s.over) return {};
        if (s.phase === 'write') return showStories(s, ctx);
        if (s.phase === 'vote') return countVotes(s, ctx);
        return advance(s, ctx);
    },
    join: () => ({}),
    leave(s, ctx) {
        if (s.phase === 'write' && ctx.players.length && ctx.players.every(player => s.lines[player.key])) return showStories(s, ctx);
        if (s.phase === 'vote' && ctx.players.every(player => s.votes[player.key])) return countVotes(s, ctx);
        return {};
    },
    view(s, ctx, me) {
        const wrote = !!s.lines[me];
        const words = s.dice.map(die => die.word);
        return {
            now: s.over ? { tone: 'done', text: 'Lovely stories. Well done!' }
                : s.phase === 'write' ? (wrote
                    ? { tone: 'wait', text: `Your story is in! Waiting for ${ctx.players.filter(player => !s.lines[player.key]).map(player => player.name).join(' and ')}…` }
                    : { tone: 'go', text: `Write ONE sentence with: ${words.join(', ')}.`, sub: 'It stays secret until everyone has written.' })
                    : s.phase === 'vote' ? (s.votes[me] ? { tone: 'wait', text: 'Thanks! Counting the votes…' } : { tone: 'go', text: 'Which story do you like best? Tap it!' })
                        : s.phase === 'talk' ? (s.asked.includes(me) ? { tone: 'go', text: `Answer ${othersNames(ctx, me)}’s question about your story.` } : { tone: 'go', text: `Read the stories. Ask ${othersNames(ctx, me)} a question about theirs!` })
                            : { tone: 'wait', text: 'New pictures coming…' },
            starters: s.phase === 'write' ? ['One day,', 'There was a', 'Yesterday,'] : s.phase === 'talk' ? ['Why did …?', 'What happened next?', 'Where was …?', 'Because …'] : [],
            actions: s.phase === 'talk' || s.phase === 'next' ? [{ act: 'next', label: 'New pictures ▶', ghost: s.phase === 'talk' && !ctx.players.every(player => s.asked.includes(player.key)) }] : [],
            chat: { secret: s.phase === 'write' && !wrote, hint: s.phase === 'write' && !wrote ? `A sentence with ${words.join(', ')}` : undefined },
            board: [
                { w: 'story', label: 'Use these pictures', dice: s.dice.map(die => ({ emoji: die.emoji, word: die.word, state: 'now' as const })),
                    lines: s.phase === 'write' ? (wrote ? [{ by: me, text: s.lines[me] }] : []) : ctx.players.filter(player => s.lines[player.key]).map(player => ({ by: player.key, text: s.lines[player.key] })) },
                ...(s.phase === 'vote' ? [{ w: 'options' as const, act: 'vote', label: 'Your favourite', cols: 1,
                    options: ctx.players.filter(player => s.lines[player.key] && player.key !== me).map(player => ({ id: player.key, label: s.lines[player.key], face: player.key, picked: s.votes[me] === player.key })) }] : []),
            ],
            timer: s.phase === 'write' ? timer(s, EMOJI.ms(ctx, 'write')) : null,
            seats: seats(s, ctx, null, Object.fromEntries(ctx.players.map(player => [player.key, s.phase === 'write' ? (s.lines[player.key] ? '✔' : '✍️') : '']))),
            round: ctx.opts.endless ? undefined : { n: s.n, of: s.of },
            over: s.over ? finish(s, ctx) : null,
        };
    },
    status: s => `Story ${s.n}: ${s.dice.map(die => die.emoji).join('')} (${s.phase})`,
};

function advance(s: Emoji, ctx: Ctx): Out {
    if (!ctx.opts.endless && s.n >= s.of) { s.over = true; s.due = null; return { fx: [{ kind: 'win' }] }; }
    dealEmoji(s, ctx);
    return { say: [{ text: `New pictures: ${s.dice.map(die => `${die.emoji} ${die.word}`).join(', ')}` }] };
}

// ---------- Don't Say It! ----------

type Dont = Base & {
    describer: string; card: Taboo; seen: string[]; score: number; got: number; skips: number;
    turn: number; turns: number; phase: 'play' | 'between';
};
const DONT = settings({
    turn: seconds('Time for each describer', 90),
    skips: count('Skips per turn', 2, 0, 10),
    turns: count('Turns each in free play', 2, 1, 10),
});

function dealWord(s: Dont, ctx: Ctx): void {
    s.card = deal(forLevel(TABOO, ctx.opts.level), s.seen, card => card.word, ctx.rnd);
}

export const dontsayit: Game<Dont> = {
    id: 'dontsayit', kind: 'board', title: 'Don’t Say It!', icon: '🚫', min: 2, max: 4, ideal: 3, minutes: 8, levels: ['A1', 'A2', 'B1'], settings: DONT.list,
    blurb: 'Describe the secret word, but the red words are forbidden. Your team guesses!',
    how: ['One player sees a secret word.', 'Describe it. Don’t use the red words!', 'The others type the word. How many can you get?'],
    example: ['It is a place. Children go there.', 'A park?', 'No. There are teachers and books.', 'School!'],
    create(ctx) {
        const s = { ...base(), describer: ctx.players[0].key, seen: [], score: 0, got: 0, skips: 0, turn: 1, turns: ctx.players.length * DONT.get(ctx, 'turns'), phase: 'play' } as unknown as Dont;
        dealWord(s, ctx);
        s.due = ctx.now + DONT.ms(ctx, 'turn');
        return s;
    },
    chat(s, ctx, from, text) {
        if (s.over || s.phase !== 'play') return {};
        if (from === s.describer) {
            const hit = saysAny(text, [s.card.word, ...s.card.banned]);
            return hit ? { block: `🚫 You can’t say “${hit}”! Use other words.` } : {};
        }
        if (!says(text, s.card.word)) return {};
        star(s, from); star(s, s.describer);
        s.score += 1; s.got += 1;
        const word = s.card.word;
        dealWord(s, ctx);
        return { say: [{ text: `✅ ${nameOf(ctx, from)} got it: ${word.toUpperCase()}! New word for ${nameOf(ctx, s.describer)}.`, tone: 'good' }], fx: [{ kind: 'good' }] };
    },
    act(s, ctx, from, act) {
        if (s.over || s.phase !== 'play' || act !== 'skip' || from !== s.describer || s.skips >= DONT.get(ctx, 'skips')) return {};
        const word = s.card.word;
        s.skips += 1;
        dealWord(s, ctx);
        return { say: [{ text: `⏭ Skipped. The word was ${word.toUpperCase()}.` }] };
    },
    tick(s, ctx) {
        if (s.over) return {};
        if (s.phase === 'play') {
            const out: Out = { say: [{ text: `⏰ Time! The last word was ${s.card.word.toUpperCase()}. ${nameOf(ctx, s.describer)} described ${s.got} word${s.got === 1 ? '' : 's'}.` }] };
            if (!ctx.opts.endless && s.turn >= s.turns) { s.over = true; s.due = null; return both(out, { fx: [{ kind: 'win' }] }); }
            s.phase = 'between'; s.due = ctx.now + 5000;
            return out;
        }
        s.describer = after(ctx, s.describer);
        s.turn += 1; s.got = 0; s.skips = 0; s.phase = 'play';
        dealWord(s, ctx);
        s.due = ctx.now + DONT.ms(ctx, 'turn');
        return { say: [{ text: `${nameOf(ctx, s.describer)} describes now!` }], fx: [{ to: s.describer, kind: 'turn' }] };
    },
    join: () => ({}),
    leave(s, ctx) {
        if (has(ctx, s.describer) || !ctx.players.length) return {};
        s.describer = ctx.players[0].key; s.got = 0; s.skips = 0;
        dealWord(s, ctx);
        return {};
    },
    view(s, ctx, me) {
        const mine = s.describer === me;
        const describer = nameOf(ctx, s.describer);
        return {
            now: s.over ? { tone: 'done', text: `Your team got ${s.score} words. Well done!` }
                : s.phase === 'between' ? { tone: 'wait', text: `Next: ${nameOf(ctx, after(ctx, s.describer))} describes!` }
                    : mine ? { tone: 'go', text: `Describe the word to ${othersNames(ctx, me)}.`, sub: 'Don’t say the word or the red words!' }
                        : { tone: 'go', text: `Read ${describer}’s clues and type the word!`, sub: 'Guess as many times as you like. Ask questions too.' },
            starters: mine ? DESCRIBE[ctx.opts.level] : ['Is it a thing?', 'Is it a place?', 'Is it …?', 'Can you eat it?'],
            actions: mine && s.phase === 'play' && !s.over ? [{ act: 'skip', label: `Skip ⏭ (${DONT.get(ctx, 'skips') - s.skips} left)`, ghost: true }].filter(() => s.skips < DONT.get(ctx, 'skips')) : [],
            chat: { hint: mine ? 'Describe it…' : 'Guess the word…' },
            board: [
                mine || s.over
                    ? { w: 'card', tone: 'secret', label: 'Describe this word', title: s.card.word.toUpperCase(), banned: s.card.banned }
                    : { w: 'card', label: `${describer} is describing…`, emoji: '❓', title: '? ? ?', text: 'Type your guess in the chat.' },
                { w: 'meter', label: 'Words your team got', icon: '✅', value: s.score, max: Math.max(s.score, 10) },
            ],
            timer: s.phase === 'play' ? timer(s, DONT.ms(ctx, 'turn')) : null,
            seats: seats(s, ctx, s.describer),
            round: ctx.opts.endless ? undefined : { n: s.turn, of: s.turns },
            over: s.over ? finish(s, ctx, `${s.score} words!`) : null,
        };
    },
    status: (s, ctx) => `${nameOf(ctx, s.describer)} describes “${s.card.word}”; team score ${s.score}`,
};
