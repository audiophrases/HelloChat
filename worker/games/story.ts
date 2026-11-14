// Story Dice (a story the table writes one sentence at a time, each with a picture word) and Spot the Lie (two
// true sentences and one lie about yourself; the table asks questions and votes).
import { DICE, STORY_STARTS, type Thing } from '../content/words.ts';
import type { Base, Ctx, Game, Out } from './types.ts';
import { after, base, both, finish, has, isQuestion, nameOf, others, othersNames, sample, says, seats, shuffle, star, timer, wordCount } from './util.ts';

// ---------- Story Dice ----------

type Dice = Base & { dice: Thing[]; at: number; lines: { by: string; text: string }[]; turn: string; n: number };
const WRITE_MS = 100_000;

function dealDice(s: Dice, ctx: Ctx): void {
    s.dice = sample(DICE, Math.min(8, Math.max(6, ctx.players.length * 2)), ctx.rnd);
    s.at = 0; s.lines = []; s.n += 1;
    s.due = ctx.now + WRITE_MS;
}

export const storydice: Game<Dice> = {
    id: 'storydice', kind: 'board', title: 'Story Dice', icon: '🎲', min: 2, max: 4, ideal: 3, minutes: 10, levels: ['A1', 'A2', 'B1'],
    blurb: 'Write a crazy story together: one sentence each, with the picture on the die.',
    how: ['Look at the picture on the die.', 'Your turn? Write the next sentence with that word.', 'Take turns until the story ends.'],
    example: ['One day, a dragon woke up very hungry.', 'It flew to town and ordered a giant pizza.', '😂 Then what?'],
    create(ctx) {
        const s = { ...base(), turn: ctx.players[0].key, n: 0 } as unknown as Dice;
        dealDice(s, ctx);
        return s;
    },
    chat(s, ctx, from, text) {
        if (s.over || from !== s.turn || s.at >= s.dice.length) return {};
        const die = s.dice[s.at];
        if (!says(text, die.word)) return wordCount(text) >= 5 ? { say: [{ to: from, text: `For the story, use the word “${die.word}” ${die.emoji} in your sentence.` }] } : {};
        if (wordCount(text) < 5) return { say: [{ to: from, text: 'Write a full sentence for the story: 5 words or more.' }] };
        s.lines.push({ by: from, text: text.trim() });
        star(s, from, wordCount(text) >= 10 ? 2 : 1);
        s.at += 1;
        if (s.at >= s.dice.length) {
            for (const player of ctx.players) star(s, player.key);
            if (ctx.opts.endless) { s.due = ctx.now + 15_000; return { say: [{ text: '📖 THE END! Read your story together. A new story starts soon.', tone: 'good' }], fx: [{ kind: 'win' }] }; }
            s.over = true; s.due = null;
            return { say: [{ text: '📖 THE END! Read your story together.', tone: 'good' }], fx: [{ kind: 'win' }] };
        }
        s.turn = after(ctx, from);
        s.due = ctx.now + WRITE_MS;
        return { fx: [{ to: from, kind: 'star' }, { to: s.turn, kind: 'turn' }] };
    },
    act: () => ({}),
    tick(s, ctx) {
        if (s.over) return {};
        if (s.at >= s.dice.length) { dealDice(s, ctx); s.turn = after(ctx, s.turn); return { say: [{ text: `A new story! ${nameOf(ctx, s.turn)} starts.` }] }; }
        const slow = nameOf(ctx, s.turn);
        s.turn = after(ctx, s.turn);
        s.due = ctx.now + WRITE_MS;
        return { say: [{ text: `⏰ ${slow} needs more time. ${nameOf(ctx, s.turn)}, you write the next sentence!` }], fx: [{ to: s.turn, kind: 'turn' }] };
    },
    join: () => ({}),
    leave(s, ctx) { if (ctx.players.length && !has(ctx, s.turn)) { s.turn = ctx.players[0].key; s.due = ctx.now + WRITE_MS; } return {}; },
    view(s, ctx, me) {
        const mine = s.turn === me;
        const ended = s.at >= s.dice.length;
        const die = s.dice[Math.min(s.at, s.dice.length - 1)];
        return {
            now: s.over || ended ? { tone: s.over ? 'done' : 'wait', text: '📖 The End! Read your story together.', sub: s.over ? undefined : 'A new story starts soon…' }
                : mine ? { tone: 'go', text: `✍️ Your turn! Write the next sentence with “${die.word}” ${die.emoji}.`, sub: '5 words or more. 10 words = 2 stars!' }
                    : { tone: 'wait', text: `${nameOf(ctx, s.turn)} is writing with ${die.emoji} ${die.word}…`, sub: 'You can help with ideas in the chat.' },
            starters: mine && !ended ? STORY_STARTS[ctx.opts.level] : ['Good idea!', 'What happens next?', 'Maybe …'],
            chat: { hint: mine && !ended ? `The next sentence, with “${die.word}”` : undefined },
            board: [{ w: 'story', label: 'Our story', lines: s.lines,
                dice: s.dice.map((item, index) => ({ emoji: item.emoji, word: item.word, state: index < s.at ? 'done' as const : index === s.at ? 'now' as const : 'next' as const })) }],
            timer: ended ? null : timer(s, WRITE_MS),
            seats: seats(s, ctx, ended ? null : s.turn),
            over: s.over ? finish(s, ctx, 'The End!') : null,
        };
    },
    status: (s, ctx) => `Sentence ${Math.min(s.at + 1, s.dice.length)}/${s.dice.length}; ${nameOf(ctx, s.turn)} writes`,
};

// ---------- Spot the Lie ----------

type Lie = Base & {
    teller: string; told: Record<string, number>; each: number;
    phase: 'write' | 'ask' | 'vote' | 'show';
    raw: string[];                 // two true sentences, then the lie, as written
    order: number[];               // how they are shown
    votes: Record<string, number>; // voter -> index into raw
    asked: Record<string, number>; ready: string[];
};
const MS = { write: 150_000, ask: 100_000, vote: 40_000, show: 8000 };

function startTeller(s: Lie, ctx: Ctx, teller: string): void {
    s.teller = teller; s.phase = 'write'; s.raw = []; s.order = []; s.votes = {}; s.asked = {}; s.ready = [];
    s.due = ctx.now + MS.write;
}

function nextTeller(s: Lie, ctx: Ctx): Out {
    s.told[s.teller] = (s.told[s.teller] ?? 0) + 1;
    let next = after(ctx, s.teller);
    for (let i = 0; i < ctx.players.length && (s.told[next] ?? 0) >= s.each; i++) next = after(ctx, next);
    if (!ctx.opts.endless && (s.told[next] ?? 0) >= s.each) { s.over = true; s.due = null; return { fx: [{ kind: 'win' }] }; }
    startTeller(s, ctx, next);
    return { say: [{ text: `Now ${nameOf(ctx, next)} writes two true sentences and one lie.` }], fx: [{ to: next, kind: 'turn' }] };
}

function reveal(s: Lie, ctx: Ctx): Out {
    s.phase = 'show'; s.due = ctx.now + MS.show;
    const voters = others(ctx, s.teller);
    const right = voters.filter(player => s.votes[player.key] === 2);
    for (const player of right) star(s, player.key, 2);
    star(s, s.teller, voters.length - right.length);
    const teller = nameOf(ctx, s.teller);
    return {
        say: [{ text: `🤥 The lie was: “${s.raw[2]}” ${right.length ? `${right.map(player => player.name).join(' and ')} spotted it!` : `${teller} fooled everyone!`}`, tone: right.length ? 'good' : 'info' }],
        fx: [...right.map(player => ({ to: player.key, kind: 'good' as const })), ...(right.length < voters.length ? [{ to: s.teller, kind: 'good' as const }] : [])],
    };
}

export const spotlie: Game<Lie> = {
    id: 'spotlie', kind: 'board', title: 'Spot the Lie', icon: '🤥', min: 2, max: 4, ideal: 3, minutes: 10, levels: ['A2', 'B1', 'A1'],
    blurb: 'Two true sentences and one lie about you. Can your table find the lie?',
    how: ['Write 2 TRUE sentences and 1 LIE about you.', 'The others ask you questions.', 'They vote: which sentence is the lie?'],
    example: ['I have three cats.', 'Really? What are their names?', 'Luna, Coco and… Tiger.', 'Hmm! I think that is the lie.'],
    create(ctx) {
        const s = { ...base(), told: {}, each: ctx.players.length <= 2 ? 2 : 1 } as unknown as Lie;
        startTeller(s, ctx, ctx.players[0].key);
        return s;
    },
    chat(s, ctx, from, text) {
        if (s.over) return {};
        if (s.phase === 'write' && from === s.teller) {
            if (wordCount(text) < 4) return { block: 'Write a full sentence about you (4 words or more).' };
            s.raw.push(text.trim());
            if (s.raw.length < 3) return { secret: true };
            s.order = shuffle([0, 1, 2], ctx.rnd);
            s.phase = 'ask'; s.due = ctx.now + MS.ask;
            return { secret: true, say: [{ text: `🕵️ ${nameOf(ctx, s.teller)} wrote 3 sentences. One is a LIE! Ask questions to find it.` }] };
        }
        if (s.phase === 'ask' && from !== s.teller && isQuestion(text, 3)) {
            s.asked[from] = (s.asked[from] ?? 0) + 1;
            if (s.asked[from] <= 2) { star(s, from); return { fx: [{ to: from, kind: 'star' }] }; }
        }
        return {};
    },
    act(s, ctx, from, act, data) {
        if (s.over || from === s.teller) return {};
        if (act === 'ready' && s.phase === 'ask') {
            if (!s.ready.includes(from)) s.ready.push(from);
            if (!others(ctx, s.teller).every(player => s.ready.includes(player.key))) return {};
            s.phase = 'vote'; s.due = ctx.now + MS.vote;
            return { say: [{ text: 'Time to vote: which sentence is the lie?' }] };
        }
        if (act === 'vote' && s.phase === 'vote') {
            const index = Number(String((data as { id?: unknown })?.id ?? '').replace('s', ''));
            if (![0, 1, 2].includes(index)) return {};
            s.votes[from] = index;
            return others(ctx, s.teller).every(player => s.votes[player.key] !== undefined) ? reveal(s, ctx) : {};
        }
        return {};
    },
    tick(s, ctx) {
        if (s.over) return {};
        if (s.phase === 'write') return both({ say: [{ text: `⏰ ${nameOf(ctx, s.teller)} needs more time. Next player!` }] }, nextTeller(s, ctx));
        if (s.phase === 'ask') { s.phase = 'vote'; s.due = ctx.now + MS.vote; return { say: [{ text: 'Time to vote: which sentence is the lie?' }] }; }
        if (s.phase === 'vote') return reveal(s, ctx);
        return nextTeller(s, ctx);
    },
    join: () => ({}),
    leave(s, ctx) {
        if (!ctx.players.length) return {};
        if (!has(ctx, s.teller)) { startTeller(s, ctx, ctx.players[0].key); return {}; }
        if (s.phase === 'vote' && others(ctx, s.teller).every(player => s.votes[player.key] !== undefined)) return reveal(s, ctx);
        return {};
    },
    view(s, ctx, me) {
        const mine = s.teller === me;
        const teller = nameOf(ctx, s.teller);
        const shown = s.phase !== 'write';
        const sentences = shown ? s.order.map(index => ({
            id: `s${index}`, text: s.raw[index],
            ...(s.phase === 'show' ? { state: index === 2 ? 'lie' as const : 'true' as const, by: others(ctx, s.teller).filter(player => s.votes[player.key] === index).map(player => player.key) } : {}),
        })) : [];
        const step = s.raw.length;
        return {
            now: s.over ? { tone: 'done', text: 'No more secrets. Well done!' }
                : s.phase === 'write' ? (mine
                    ? { tone: 'go', text: step === 0 ? 'Write a TRUE sentence about you. (1 of 3)' : step === 1 ? 'Write another TRUE sentence about you. (2 of 3)' : 'Now write a LIE about you! (3 of 3)', sub: 'It stays secret. The game mixes the three sentences.' }
                    : { tone: 'wait', text: `${teller} is writing 2 true sentences and 1 lie… 🤫`, sub: 'Get your questions ready!' })
                    : s.phase === 'ask' ? (mine
                        ? { tone: 'go', text: `Answer ${othersNames(ctx, me)}’s questions. Don’t tell them the lie!`, sub: 'You can make up details for your lie.' }
                        : s.ready.includes(me) ? { tone: 'wait', text: 'You are ready to vote. Waiting for the others…' } : { tone: 'go', text: `One sentence is a lie! Ask ${teller} questions to find it.`, sub: 'Your first 2 questions win stars.' })
                        : s.phase === 'vote' ? (mine ? { tone: 'wait', text: `${othersNames(ctx, me)} ${others(ctx, me).length > 1 ? 'are' : 'is'} voting…` }
                            : s.votes[me] !== undefined ? { tone: 'wait', text: 'Vote in! Waiting for the others…' } : { tone: 'go', text: 'Which sentence is the LIE? Tap it!' })
                            : { tone: 'wait', text: `The lie was: “${s.raw[2]}”`, sub: 'Next player soon…' },
            starters: s.phase === 'ask' ? (mine ? ['Yes, it’s true!', 'Because …', 'It was …'] : ['When did you …?', 'Where …?', 'Who …?', 'Is it true that …?', 'Tell me more about …']) : s.phase === 'write' && mine ? ['I have …', 'I can …', 'Last year I …', 'I have never …', 'My favourite … is …'] : [],
            actions: s.phase === 'ask' && !mine && !s.ready.includes(me) ? [{ act: 'ready', label: 'I’m ready to vote ✋', ghost: true }] : [],
            chat: { secret: s.phase === 'write' && mine, hint: s.phase === 'write' && mine ? (step < 2 ? 'A true sentence about you' : 'A lie about you') : undefined },
            board: [
                shown ? { w: 'sentences', label: `${teller}’s three sentences`, items: sentences, act: 'vote', off: s.phase !== 'vote' || mine || s.votes[me] !== undefined }
                    : mine ? { w: 'sentences', label: 'Your sentences (secret)', items: s.raw.map((text, index) => ({ id: `s${index}`, text: `${index < 2 ? '✅ True' : '🤥 Lie'}: ${text}` })), off: true }
                        : { w: 'card', emoji: '🤫', label: `${teller} is writing`, title: `${step} of 3 sentences`, text: 'Two will be true. One will be a lie.' },
            ],
            timer: s.phase === 'show' ? null : timer(s, MS[s.phase]),
            seats: seats(s, ctx, s.teller),
            over: s.over ? finish(s, ctx) : null,
        };
    },
    status: (s, ctx) => `${nameOf(ctx, s.teller)} tells (${s.phase})`,
};
