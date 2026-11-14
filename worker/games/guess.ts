// Guessing games built on a secret card: Who am I? (a thing), Guess Who? (a made-up person, drawn with the avatar
// parts) and Same or Different? (two pictures, and nobody may say the word).
import type { Cell, Look } from '../../shared/protocol.ts';
import { DESCRIBE, thingSetsFor, withArticle, type Thing } from '../content/words.ts';
import type { Base, Ctx, Game, Out } from './types.ts';
import { base, both, finish, has, isQuestion, nameOf, othersNames, pick, sample, says, seats, shuffle, star, timer, wordCount } from './util.ts';

// ---------- Who am I? and Guess Who? ----------

type Card = { id: string; emoji?: string; word: string; look?: Look };
type Who = Base & {
    people: boolean;
    title: string; article: boolean; ask: string[];
    cards: Card[];
    secret: Record<string, string>;        // player -> card id
    target: Record<string, string>;        // player -> the classmate they must find out about
    done: Record<string, 'right' | 'out'>;
    wrong: Record<string, number>;
    crossed: Record<string, string[]>;
    asked: Record<string, number>;
    phase: 'play' | 'show';
    round: number; of: number;
};
const SHOW_MS = 7000;
const PLAY_MS = 270_000;
const PEOPLE = ['Mia', 'Leo', 'Zoe', 'Max', 'Ivy', 'Sam', 'Eva', 'Tom', 'Lily', 'Ben', 'Nora', 'Jack', 'Ruby', 'Finn', 'Amy', 'Luke'];
const PEOPLE_ASK = ['Has your person got glasses?', 'Is your person wearing a hat?', 'Has your person got long hair?', 'Has your person got dark hair?', 'Is your person smiling?', 'Is your person’s top blue?', 'Has your person got a beard?', 'Has your person got big eyes?'];

// Twelve people who differ in ways a learner can ask about: hair, hat, glasses, clothes.
function makePeople(ctx: Ctx): Card[] {
    const int = (count: number) => Math.floor(ctx.rnd() * count);
    return sample(PEOPLE, 12, ctx.rnd).map((name, index) => ({
        id: `p${index}`, word: name,
        look: { head: 0, skin: int(20), hairColor: int(25), hair: int(29), eyes: int(37), mouth: int(41), glasses: ctx.rnd() < 0.4 ? 1 + int(16) : 0, shirt: int(28), hat: ctx.rnd() < 0.35 ? 1 + int(28) : 0 },
    }));
}

function dealWho(s: Who, ctx: Ctx): void {
    if (s.people) {
        s.cards = makePeople(ctx);
        s.title = 'People'; s.article = false; s.ask = PEOPLE_ASK;
    } else {
        const set = pick(thingSetsFor(ctx.opts.level), ctx.rnd);
        s.cards = sample(set.things, 12, ctx.rnd).map((thing, index) => ({ id: `t${index}`, emoji: thing.emoji, word: thing.word }));
        s.title = set.title; s.article = set.article; s.ask = set.ask;
    }
    const secrets = shuffle(s.cards, ctx.rnd);
    const order = shuffle(ctx.players, ctx.rnd);
    s.secret = {}; s.target = {};
    order.forEach((player, index) => {
        s.secret[player.key] = secrets[index % secrets.length].id;
        s.target[player.key] = order[(index + 1) % order.length].key;
    });
    s.done = {}; s.wrong = {}; s.crossed = {}; s.asked = {};
    s.phase = 'play'; s.round += 1;
    s.due = ctx.now + PLAY_MS; // a round never waits for ever for a player who is away
}

const cardOf = (s: Who, id: string | undefined): Card | undefined => s.cards.find(card => card.id === id);
const named = (s: Who, card: Card | undefined): string => !card ? '?' : s.people ? card.word : withArticle({ emoji: card.emoji ?? '', word: card.word }, s);

function settle(s: Who, ctx: Ctx): Out {
    if (s.phase !== 'play' || !ctx.players.every(player => s.done[player.key])) return {};
    s.phase = 'show'; s.due = ctx.now + SHOW_MS;
    return { say: [{ text: `Everybody’s secret: ${ctx.players.map(player => `${player.name} = ${cardOf(s, s.secret[player.key])?.emoji ?? ''} ${cardOf(s, s.secret[player.key])?.word ?? '?'}`).join(', ')}` }] };
}

function makeWho(def: Pick<Game, 'id' | 'kind' | 'title' | 'icon' | 'blurb' | 'how' | 'example' | 'minutes'>, people: boolean, rounds: number): Game<Who> {
    return {
        ...def, min: 2, max: 4, ideal: 2, levels: ['A1', 'A2', 'B1'],
        create(ctx) {
            const s = { ...base(), people, round: 0, of: rounds } as unknown as Who;
            dealWho(s, ctx);
            return s;
        },
        chat(s, _ctx, from, text) {
            if (s.over || s.phase !== 'play') return {};
            const mine = cardOf(s, s.secret[from]);
            if (mine && says(text, mine.word)) return { block: s.people ? `🤫 Don’t say your person’s name!` : `🤫 Don’t say your secret word! Answer “Yes” or “No”.` };
            if (!s.done[from] && isQuestion(text, 3)) {
                s.asked[from] = (s.asked[from] ?? 0) + 1;
                if (s.asked[from] <= 2) star(s, from);
            }
            return {};
        },
        act(s, ctx, from, act, data) {
            if (s.over || s.phase !== 'play') return {};
            const id = String((data as { id?: unknown })?.id ?? '');
            const card = cardOf(s, id);
            if (!card) return {};
            if (act === 'cross') {
                const crossed = s.crossed[from] ??= [];
                s.crossed[from] = crossed.includes(id) ? crossed.filter(item => item !== id) : [...crossed, id];
                return {};
            }
            if (act !== 'guess' || s.done[from]) return {};
            const target = s.target[from];
            if (id === s.secret[target]) {
                s.done[from] = 'right';
                star(s, from, Math.max(1, 3 - (s.wrong[from] ?? 0)));
                return both({ say: [{ text: `🎉 ${nameOf(ctx, from)} found out: ${nameOf(ctx, target)} is ${named(s, card)}!`, tone: 'good' }], fx: [{ to: from, kind: 'good' }] }, settle(s, ctx));
            }
            s.wrong[from] = (s.wrong[from] ?? 0) + 1;
            s.crossed[from] = [...new Set([...(s.crossed[from] ?? []), id])];
            if (s.wrong[from] >= 3) {
                s.done[from] = 'out';
                return both({ say: [{ to: from, text: `No more guesses! ${nameOf(ctx, target)} was ${named(s, cardOf(s, s.secret[target]))}.`, tone: 'bad' }], fx: [{ to: from, kind: 'bad' }] }, settle(s, ctx));
            }
            return { say: [{ to: from, text: `❌ Not ${named(s, card)}. Ask ${nameOf(ctx, target)} more questions!`, tone: 'bad' }], fx: [{ to: from, kind: 'bad' }] };
        },
        tick(s, ctx) {
            if (s.over) return {};
            if (s.phase === 'play') {
                for (const player of ctx.players) s.done[player.key] ??= 'out';
                return both({ say: [{ text: '⏰ Time is up for this round!' }] }, settle(s, ctx));
            }
            if (!ctx.opts.endless && s.round >= s.of) { s.over = true; s.due = null; return { fx: [{ kind: 'win' }] }; }
            dealWho(s, ctx);
            return { say: [{ text: 'New round: new secrets!' }] };
        },
        join(s, ctx, key) {
            // Someone new: a secret nobody has, and the first player to find out about. Nobody asks about them until the next round.
            const free = s.cards.filter(card => !Object.values(s.secret).includes(card.id));
            s.secret[key] = pick(free.length ? free : s.cards, ctx.rnd).id;
            s.target[key] = ctx.players.find(player => player.key !== key)?.key ?? key;
            return {};
        },
        leave(s, ctx, key) {
            for (const player of ctx.players) {
                if (s.target[player.key] !== key) continue;
                const next = ctx.players.find(other => other.key !== player.key && !Object.entries(s.target).some(([who, target]) => who !== player.key && target === other.key && has(ctx, who)))
                    ?? ctx.players.find(other => other.key !== player.key);
                if (next) s.target[player.key] = next.key;
            }
            return settle(s, ctx);
        },
        view(s, ctx, me) {
            const target = s.target[me];
            const targetName = nameOf(ctx, target);
            const mine = cardOf(s, s.secret[me]);
            const askers = ctx.players.filter(player => s.target[player.key] === me && !s.done[player.key]).map(player => player.name);
            const done = s.done[me];
            const show = s.phase === 'show' || s.over;
            const cells: Cell[] = s.cards.map(card => ({
                id: card.id, emoji: card.emoji, label: card.word, look: card.look,
                state: (show || done) && card.id === s.secret[target] ? 'found' : (s.crossed[me] ?? []).includes(card.id) ? 'out' : 'free',
                off: !!done || show,
            }));
            return {
                now: s.over ? { tone: 'done', text: 'All secrets found. Well done!' }
                    : show ? { tone: 'wait', text: 'All the secrets are out! New round…' }
                        : done ? { tone: askers.length ? 'go' : 'wait', text: done === 'right' ? `You found it! ${targetName} is ${named(s, cardOf(s, s.secret[target]))}.` : `${targetName} was ${named(s, cardOf(s, s.secret[target]))}.`,
                            sub: askers.length ? `Now answer ${askers.join(' and ')}: Yes or No!` : 'Wait for the others.' }
                            : { tone: 'go', text: `Ask ${targetName} yes/no questions. Then tap ${s.people ? `${targetName}’s person` : `what ${targetName} is`}!`,
                                sub: askers.length ? `${askers.join(' and ')} will ask about YOU: answer Yes or No.` : undefined },
                starters: done ? ['Yes!', 'No.', 'Sometimes.', 'I don’t know.'] : [...s.ask.slice(0, 6), 'Yes!', 'No.'],
                chat: {},
                board: [
                    { w: 'card', tone: 'secret', label: 'Only you can see this', emoji: s.people ? '🤫' : mine?.emoji, title: s.people ? `Your person: ${mine?.word ?? '?'}` : `You are ${named(s, mine)}`,
                        text: s.people ? 'Find your person in the pictures. Answer questions about them.' : 'Don’t say this word. Answer Yes or No.' },
                    { w: 'grid', cols: 4, cells, act: 'guess', cross: true, label: s.people ? `Who is ${targetName}’s person?` : `What is ${targetName}?` },
                    { w: 'meter', label: 'Guesses left', icon: '❤️', value: 3 - (s.wrong[me] ?? 0), max: 3 },
                ],
                timer: s.phase === 'play' ? timer(s, PLAY_MS) : null,
                seats: seats(s, ctx, null, Object.fromEntries(ctx.players.map(player => [player.key, s.done[player.key] === 'right' ? '✔' : s.done[player.key] === 'out' ? '✖' : '']))),
                round: ctx.opts.endless ? undefined : { n: s.round, of: s.of },
                over: s.over ? finish(s, ctx) : null,
            };
        },
        status: (s, ctx) => `${s.title}, round ${s.round}: ${ctx.players.filter(player => s.done[player.key]).length}/${ctx.players.length} have guessed`,
    };
}

export const whoami = makeWho({
    id: 'whoami', kind: 'warmup', title: 'Who Am I?', icon: '🕵️', minutes: 5,
    blurb: 'You are a secret animal or thing. Ask yes/no questions to find your partner’s secret.',
    how: ['You have a secret card. Don’t say it!', 'Ask your partner yes/no questions.', 'Tap the picture when you know the answer.'],
    example: ['Are you an animal?', 'Yes!', 'Can you fly?', 'No. Have you got four legs?'],
}, false, 2);

export const guesswho = makeWho({
    id: 'guesswho', kind: 'board', title: 'Guess Who?', icon: '🧑‍🤝‍🧑', minutes: 8,
    blurb: 'Twelve faces. Ask about hair, hats and glasses to find your partner’s secret person.',
    how: ['You have a secret person.', 'Ask yes/no questions about how they look.', 'Cross out faces. Tap the right one to win!'],
    example: ['Has your person got glasses?', 'No. Is your person wearing a hat?', 'Yes! Is the hat red?'],
}, true, 3);

// ---------- Same or Different? ----------

type Same = Base & {
    title: string; cards: Record<string, Thing>; same: boolean;
    answers: Record<string, boolean>; talked: number;
    phase: 'talk' | 'show'; n: number; of: number; score: number;
};

function dealSame(s: Same, ctx: Ctx): void {
    const set = pick(thingSetsFor(ctx.opts.level), ctx.rnd);
    const [first, second] = sample(set.things, 2, ctx.rnd);
    s.title = set.title;
    s.same = ctx.rnd() < 0.45;
    const odd = pick(ctx.players, ctx.rnd).key;
    s.cards = Object.fromEntries(ctx.players.map(player => [player.key, !s.same && player.key === odd ? second : first]));
    s.answers = {}; s.talked = 0; s.phase = 'talk'; s.n += 1; s.due = ctx.now + 150_000;
}

export const samediff: Game<Same> = {
    id: 'samediff', kind: 'warmup', title: 'Same or Different?', icon: '🪞', min: 2, max: 3, ideal: 2, minutes: 5, levels: ['A1', 'A2', 'B1'],
    blurb: 'You each have a secret picture. Describe it, don’t name it. Are they the same?',
    how: ['You have a secret picture.', 'Describe it. Don’t say the word!', 'Same or different? Decide together.'],
    example: ['Mine is an animal. It is big.', 'Mine too! Is it grey?', 'No, it is brown. It lives on a farm.'],
    create(ctx) {
        const s = { ...base(), n: 0, of: 5, score: 0 } as unknown as Same;
        dealSame(s, ctx);
        return s;
    },
    chat(s, _ctx, from, text) {
        if (s.over || s.phase !== 'talk') return {};
        const mine = s.cards[from];
        if (mine && says(text, mine.word)) return { block: `🤫 Don’t say “${mine.word}”! Describe it with other words.` };
        if (wordCount(text) >= 2) s.talked += 1;
        return {};
    },
    act(s, ctx, from, act, data) {
        if (s.over || s.phase !== 'talk' || act !== 'answer') return {};
        if (s.talked < 2) return { say: [{ to: from, text: 'Talk first! Describe your picture to your table.', tone: 'bad' }] };
        s.answers[from] = (data as { same?: unknown })?.same === true;
        if (!ctx.players.every(player => s.answers[player.key] !== undefined)) return {};
        return showSame(s, ctx);
    },
    tick(s, ctx) {
        if (s.over) return {};
        if (s.phase === 'talk') return showSame(s, ctx); // time is up: whoever did not answer is not right
        if (!ctx.opts.endless && s.n >= s.of) { s.over = true; s.due = null; return { fx: [{ kind: 'win' }] }; }
        dealSame(s, ctx);
        return {};
    },
    join(s, ctx, key) { s.cards[key] = s.cards[ctx.players[0].key] ?? Object.values(s.cards)[0]; return {}; },
    leave(s, ctx) {
        if (s.phase === 'talk' && ctx.players.length && ctx.players.every(player => s.answers[player.key] !== undefined)) return showSame(s, ctx);
        return {};
    },
    view(s, ctx, me) {
        const mine = s.cards[me];
        const answered = s.answers[me] !== undefined;
        const show = s.phase === 'show';
        return {
            now: s.over ? { tone: 'done', text: `You got ${s.score} right. Well done!` }
                : show ? { tone: 'wait', text: s.same ? 'They were the SAME!' : 'They were DIFFERENT!', sub: ctx.players.map(player => `${player.name}: ${s.cards[player.key]?.emoji} ${s.cards[player.key]?.word}`).join('  ·  ') }
                    : answered ? { tone: 'wait', text: `You said ${s.answers[me] ? 'SAME' : 'DIFFERENT'}. Waiting for ${othersNames(ctx, me)}…` }
                        : { tone: 'go', text: `Describe your picture to ${othersNames(ctx, me)}. Don’t say the word!`, sub: 'Are your pictures the same or different? Then tap your answer.' },
            starters: show ? [] : [...DESCRIBE[ctx.opts.level].slice(0, 4), 'Is yours …?', 'Mine too!', 'Mine is different.'],
            actions: show || s.over || answered ? [] : [{ act: 'answer', label: '🟰 Same', data: { same: true } }, { act: 'answer', label: '≠ Different', data: { same: false } }],
            chat: {},
            board: [
                { w: 'card', tone: 'secret', label: 'Only you can see this', emoji: mine?.emoji, title: mine?.word ?? '?', text: 'Describe it. Don’t say this word!' },
                ...(show ? [{ w: 'card' as const, tone: (s.answers[me] === s.same ? 'good' : 'bad') as 'good' | 'bad', title: s.answers[me] === s.same ? 'You were right! ⭐⭐' : 'Not this time!', text: ctx.players.map(player => `${player.name}: ${s.cards[player.key]?.emoji} ${s.cards[player.key]?.word}`).join('   ') }] : []),
            ],
            timer: s.phase === 'talk' ? timer(s, 150_000) : null,
            seats: seats(s, ctx, null, Object.fromEntries(ctx.players.map(player => [player.key, s.answers[player.key] !== undefined ? '✔' : '']))),
            round: ctx.opts.endless ? undefined : { n: s.n, of: s.of },
            over: s.over ? finish(s, ctx) : null,
        };
    },
    status: s => `Card ${s.n} (${s.title}): ${Object.keys(s.answers).length} answered`,
};

function showSame(s: Same, ctx: Ctx): Out {
    s.phase = 'show'; s.due = ctx.now + 6000;
    const right = ctx.players.filter(player => s.answers[player.key] === s.same);
    for (const player of right) star(s, player.key, 2);
    if (right.length === ctx.players.length) s.score += 1;
    const cards = [...new Set(ctx.players.map(player => `${s.cards[player.key].emoji} ${s.cards[player.key].word}`))].join(' and ');
    return {
        say: [{ text: `${s.same ? '🟰 The same' : '≠ Different'}: ${cards}. ${right.length === ctx.players.length ? 'Everyone was right!' : right.length ? `${right.map(player => player.name).join(' and ')} got it right.` : 'Nobody got it!'}`, tone: right.length ? 'good' : 'bad' }],
        fx: ctx.players.map(player => ({ to: player.key, kind: s.answers[player.key] === s.same ? 'good' as const : 'bad' as const })),
    };
}
