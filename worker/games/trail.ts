// Question Trail: a path, a die and a question on almost every square. Landing on a square starts a small
// conversation: an answer, a follow-up question from the table, and a reply.
import { KEEP_TALKING, questionsFor } from '../content/questions.ts';
import type { Base, Ctx, Game, Out } from './types.ts';
import { after, base, both, count, deal, finish, has, isQuestion, nameOf, others, othersNames, seats, seconds, settings, shuffle, star, timer, wordCount } from './util.ts';

type Kind = 'start' | 'q' | 'ask' | 'all' | 'star' | 'again' | 'back' | 'end';
type Phase = 'roll' | 'answer' | 'follow' | 'reply' | 'ask' | 'askreply' | 'all';
type Trail = Base & {
    squares: { emoji: string; kind: Kind }[];
    pos: Record<string, number>;
    turn: string; phase: Phase; die: number | null;
    card: string | null; seen: string[];
    answered: string[];           // on an "everyone answers" square
    asker: string | null;         // who asked the follow-up
    turns: number;
};

const EMOJI: Record<Kind, string> = { start: '🏁', q: '💬', ask: '❓', all: '👥', star: '⭐', again: '🎲', back: '↩️', end: '🏆' };
const T = settings({
    roll: seconds('Time to roll (then it rolls by itself)', 25),
    answer: seconds('Time to answer the question', 90),
    follow: seconds('Time for the table to ask a follow-up', 45),
    reply: seconds('Time to answer the follow-up', 60),
    ask: seconds('❓ square: time to ask the table', 60),
    askreply: seconds('❓ square: time for the table to answer', 60),
    all: seconds('👥 square: time for everyone to answer', 80),
    words: count('Words in an answer', 5, 1, 20, 4),
});
const ms = (ctx: Ctx, phase: Phase): number => T.ms(ctx, phase);
const LENGTH = 18;

function layout(rnd: () => number): Trail['squares'] {
    const middle: Kind[] = shuffle<Kind>(['q', 'q', 'q', 'q', 'q', 'q', 'q', 'q', 'ask', 'ask', 'ask', 'all', 'all', 'star', 'again', 'back'], rnd);
    // The first square after the start is always a question, so the first roll starts a conversation.
    const first = middle.indexOf('q');
    [middle[0], middle[first]] = [middle[first], middle[0]];
    return (['start', ...middle, 'end'] as Kind[]).slice(0, LENGTH).map(kind => ({ emoji: EMOJI[kind], kind }));
}

const minWords = (ctx: Ctx) => T.get(ctx, 'words');

function nextTurn(s: Trail, ctx: Ctx): void {
    s.turn = after(ctx, s.turn);
    s.phase = 'roll'; s.card = null; s.die = null; s.answered = []; s.asker = null;
    s.turns += 1;
    s.due = ctx.now + ms(ctx, 'roll');
}

function roll(s: Trail, ctx: Ctx): Out {
    const player = nameOf(ctx, s.turn);
    s.die = 1 + Math.floor(ctx.rnd() * 3);
    const last = s.squares.length - 1;
    s.pos[s.turn] = Math.min(last, (s.pos[s.turn] ?? 0) + s.die);
    const square = s.squares[s.pos[s.turn]];
    const moved = `🎲 ${player} rolled a ${s.die}`;
    const question = () => deal(questionsFor(ctx.opts.topic, ctx.opts.level, ctx.opts.custom).questions, s.seen, item => item, ctx.rnd);
    switch (square.kind) {
        case 'end':
            star(s, s.turn, 3);
            s.over = true; s.due = null;
            return { say: [{ text: `${moved} and reached the end! 🏆`, tone: 'good' }], fx: [{ kind: 'win' }] };
        case 'star':
            star(s, s.turn, 2);
            nextTurn(s, ctx);
            return { say: [{ text: `${moved}: a star square! ⭐⭐`, tone: 'good' }], fx: [{ to: s.turn, kind: 'turn' }] };
        case 'again':
            s.phase = 'roll'; s.due = ctx.now + ms(ctx, 'roll');
            return { say: [{ text: `${moved}: roll again!` }] };
        case 'back':
            s.pos[s.turn] = Math.max(0, s.pos[s.turn] - 2);
            nextTurn(s, ctx);
            return { say: [{ text: `${moved}: oh no, back 2 squares! ↩️`, tone: 'bad' }], fx: [{ to: s.turn, kind: 'turn' }] };
        case 'ask':
            s.phase = 'ask'; s.card = null; s.due = ctx.now + ms(ctx, 'ask');
            return { say: [{ text: `${moved}: ${player} asks the table a question! ❓` }] };
        case 'all':
            s.phase = 'all'; s.card = question(); s.answered = []; s.due = ctx.now + ms(ctx, 'all');
            return { say: [{ text: `${moved}: everyone answers! 👥 ${s.card}` }] };
        default:
            s.phase = 'answer'; s.card = question(); s.due = ctx.now + ms(ctx, 'answer');
            return { say: [{ text: `${moved}. Question for ${player}: ${s.card}` }] };
    }
}

export const trail: Game<Trail> = {
    id: 'trail', kind: 'board', title: 'Question Trail', icon: '🎲', min: 2, max: 4, ideal: 3, minutes: 12, levels: ['A1', 'A2', 'B1'], settings: T.list,
    blurb: 'Roll the die, move, and answer the question on your square. Your table asks you more!',
    how: ['Your turn? Tap ROLL.', 'Answer the question on your square.', 'The others ask you one more question. Then the next player rolls.'],
    example: ['I usually play football on Saturdays.', 'Who do you play with?', 'I play with my cousins in the park.'],
    create(ctx) {
        return { ...base(), squares: layout(ctx.rnd), pos: Object.fromEntries(ctx.players.map(player => [player.key, 0])), turn: ctx.players[0].key, phase: 'roll',
            die: null, card: null, seen: [], answered: [], asker: null, turns: 1, due: ctx.now + ms(ctx, 'roll') };
    },
    chat(s, ctx, from, text) {
        if (s.over) return {};
        const count = wordCount(text);
        const mine = from === s.turn;
        if (s.phase === 'answer' && mine) {
            if (count < minWords(ctx)) return { say: [{ to: from, text: `Write a longer answer: ${minWords(ctx)} words or more.` }] };
            star(s, from, count >= 10 ? 2 : 1);
            if (ctx.players.length < 2) { nextTurn(s, ctx); return {}; }
            s.phase = 'follow'; s.due = ctx.now + ms(ctx, 'follow');
            return { fx: [{ to: from, kind: 'star' }] };
        }
        if (s.phase === 'follow' && !mine && isQuestion(text, 3)) {
            star(s, from);
            s.asker = from; s.phase = 'reply'; s.due = ctx.now + ms(ctx, 'reply');
            return { fx: [{ to: from, kind: 'star' }, { to: s.turn, kind: 'turn' }] };
        }
        if (s.phase === 'reply' && mine && count >= 3) {
            star(s, from);
            nextTurn(s, ctx);
            return { fx: [{ to: from, kind: 'star' }, { to: s.turn, kind: 'turn' }] };
        }
        if (s.phase === 'ask' && mine && isQuestion(text, 3)) {
            star(s, from);
            s.card = text.trim(); s.phase = 'askreply'; s.due = ctx.now + ms(ctx, 'askreply');
            return { fx: [{ to: from, kind: 'star' }] };
        }
        if (s.phase === 'askreply' && !mine && count >= 3) {
            star(s, from);
            nextTurn(s, ctx);
            return { fx: [{ to: from, kind: 'star' }, { to: s.turn, kind: 'turn' }] };
        }
        if (s.phase === 'all' && !s.answered.includes(from) && count >= minWords(ctx) - 1) {
            s.answered.push(from);
            star(s, from);
            if (ctx.players.every(player => s.answered.includes(player.key))) { nextTurn(s, ctx); return { fx: [{ to: from, kind: 'star' }, { to: s.turn, kind: 'turn' }] }; }
            return { fx: [{ to: from, kind: 'star' }] };
        }
        return {};
    },
    act(s, ctx, from, act) {
        if (s.over || act !== 'roll' || s.phase !== 'roll' || from !== s.turn) return {};
        return roll(s, ctx);
    },
    tick(s, ctx) {
        if (s.over) return {};
        if (s.phase === 'roll') return roll(s, ctx); // the die rolls by itself for a player who is away
        const slow = s.phase === 'follow' || s.phase === 'askreply' || s.phase === 'all' ? null : nameOf(ctx, s.turn);
        nextTurn(s, ctx);
        return both(slow ? { say: [{ text: `⏰ Time is up for ${slow}.` }] } : {}, { say: [{ text: `${nameOf(ctx, s.turn)}’s turn to roll.` }], fx: [{ to: s.turn, kind: 'turn' }] });
    },
    join(s, _ctx, key) { s.pos[key] = 0; return {}; },
    leave(s, ctx) {
        if (!ctx.players.length || has(ctx, s.turn)) return {};
        s.turn = ctx.players[0].key; s.phase = 'roll'; s.card = null; s.due = ctx.now + ms(ctx, 'roll');
        return {};
    },
    view(s, ctx, me) {
        const mine = s.turn === me;
        const player = nameOf(ctx, s.turn);
        const rest = othersNames(ctx, me);
        const now = (): { tone: 'go' | 'wait' | 'done'; text: string; sub?: string } => {
            if (s.over) return { tone: 'done', text: 'The trail is finished. Well done!' };
            switch (s.phase) {
                case 'roll': return mine ? { tone: 'go', text: '🎲 Your turn! Tap ROLL.' } : { tone: 'wait', text: `${player} is rolling…` };
                case 'answer': return mine ? { tone: 'go', text: 'Answer the question on the card.', sub: `Write ${minWords(ctx)} words or more. 10 words = 2 stars!` }
                    : { tone: 'wait', text: `${player} is answering…`, sub: 'Read the answer. Then you ask a question!' };
                case 'follow': return mine ? { tone: 'wait', text: `Good answer! ${rest} will ask you a question…` }
                    : { tone: 'go', text: `Ask ${player} ONE question about the answer.`, sub: 'The first question wins a star. Don’t forget the ?' };
                case 'reply': return mine ? { tone: 'go', text: `Answer ${nameOf(ctx, s.asker ?? '')}’s question.` } : { tone: 'wait', text: `${player} is answering ${s.asker === me ? 'your' : 'the'} question…` };
                case 'ask': return mine ? { tone: 'go', text: `Ask ${rest} any question you like!`, sub: 'Your message needs a ?' } : { tone: 'wait', text: `${player} is thinking of a question for you…` };
                case 'askreply': return mine ? { tone: 'wait', text: `Waiting for ${rest} to answer…` } : { tone: 'go', text: `Answer ${player}’s question!`, sub: 'The first answer wins a star.' };
                default: return s.answered.includes(me) ? { tone: 'wait', text: `Waiting for ${others(ctx, me).filter(other => !s.answered.includes(other.key)).map(other => other.name).join(' and ') || 'the table'}…` }
                    : { tone: 'go', text: 'Everyone answers this question. You too!' };
            }
        };
        const ask = questionsFor(ctx.opts.topic, ctx.opts.level, ctx.opts.custom).ask;
        const asking = (s.phase === 'follow' && !mine) || (s.phase === 'ask' && mine);
        return {
            now: now(),
            starters: asking ? ['Why …?', 'When …?', 'Who … with?', 'Where …?', ...ask.slice(0, 2)] : KEEP_TALKING[ctx.opts.level].slice(2, 6),
            actions: !s.over && s.phase === 'roll' && mine ? [{ act: 'roll', label: '🎲 ROLL' }] : [],
            chat: {},
            board: [
                { w: 'path', squares: s.squares, tokens: ctx.players.map(player => ({ key: player.key, at: s.pos[player.key] ?? 0 })), die: s.die },
                ...(s.card ? [{ w: 'card' as const, emoji: s.phase === 'all' ? '👥' : s.phase === 'askreply' ? '❓' : '💬',
                    label: s.phase === 'all' ? 'Everyone answers' : s.phase === 'askreply' ? `${player} asks` : `Question for ${player}`, title: s.card }] : []),
            ],
            timer: timer(s, ms(ctx, s.phase)),
            seats: seats(s, ctx, s.turn),
            over: s.over ? finish(s, ctx) : null,
        };
    },
    status: (s, ctx) => `${nameOf(ctx, s.turn)}’s turn (${s.phase}); furthest square ${Math.max(0, ...ctx.players.map(player => s.pos[player.key] ?? 0))}/${s.squares.length - 1}`,
};
