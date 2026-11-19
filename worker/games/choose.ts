// Choose, then say why: Would you rather…?, This or that? and Agree or disagree? are the same game with other cards.
// Everyone chooses in secret, the choices are shown together, and each player tells the table their reason.
import { AGREE, REASONS, THIS_OR_THAT, WOULD_YOU_RATHER, type Choice } from '../content/cards.ts';
import type { Level } from '../../shared/protocol.ts';
import type { Base, Ctx, Game, Out } from './types.ts';
import { base, count, deal, finish, forLevel, list, nameOf, othersNames, says, seats, seconds, settings, star, timer, wordCount } from './util.ts';

type State = Base & {
    card: Choice; seen: string[]; picks: Record<string, number>; said: string[];
    phase: 'pick' | 'talk' | 'next'; n: number; of: number;
};
const T = settings({
    pick: seconds('Time to choose', 30),
    talk: seconds('Time to talk about each card', 90),
    words: count('Words in a reason (to win a star)', 4, 1, 15),
    rounds: count('Cards in free play', 4, 1, 20),
});

function make(def: Pick<Game, 'id' | 'title' | 'icon' | 'blurb' | 'how' | 'example' | 'levels'>, cards: Choice[]): Game<State> {
    const deck = (level: Level) => forLevel(cards, level);
    const dealCard = (s: State, ctx: Ctx): void => {
        s.card = deal(deck(ctx.opts.level), s.seen, card => card.id, ctx.rnd);
        s.picks = {}; s.said = []; s.phase = 'pick'; s.n += 1;
        s.due = ctx.now + T.ms(ctx, 'pick');
    };
    const reveal = (s: State, ctx: Ctx): Out => {
        s.phase = 'talk'; s.due = ctx.now + T.ms(ctx, 'talk');
        const lines = s.card.options.map((option, index) => {
            const names = ctx.players.filter(player => s.picks[player.key] === index).map(player => player.name);
            return names.length ? `${option.emoji} ${option.label}: ${list(names)}` : null;
        }).filter(Boolean);
        return { say: [{ text: lines.join('  ·  ') || 'Nobody chose!' }] };
    };
    const advance = (s: State, ctx: Ctx): Out => {
        if (!ctx.opts.endless && s.n >= s.of) { s.over = true; s.due = null; return { say: [{ text: 'That was the last card. Well done!', tone: 'good' }], fx: [{ kind: 'win' }] }; }
        dealCard(s, ctx);
        return {};
    };
    return {
        ...def, kind: 'warmup', min: 2, max: 4, ideal: 3, minutes: 5, settings: T.list,
        create(ctx) {
            const s = { ...base(), seen: [], picks: {}, said: [], phase: 'pick', n: 0, of: T.get(ctx, 'rounds') } as unknown as State;
            dealCard(s, ctx);
            return s;
        },
        chat(s, ctx, from, text) {
            if (s.over || s.phase !== 'talk' || s.said.includes(from) || wordCount(text) < T.get(ctx, 'words')) return {};
            s.said.push(from);
            star(s, from, says(text, 'because') ? 2 : 1);
            // Everyone has given a reason: the card stays, so the table can go on talking until someone takes the next one.
            return { fx: [{ to: from, kind: 'star' }] };
        },
        act(s, ctx, from, act, data) {
            if (s.over) return {};
            if (act === 'pick' && s.phase === 'pick') {
                const index = Number((data as { id?: unknown })?.id);
                if (!Number.isInteger(index) || index < 0 || index >= s.card.options.length) return {};
                s.picks[from] = index;
                return ctx.players.every(player => s.picks[player.key] !== undefined) ? reveal(s, ctx) : {};
            }
            if (act === 'next' && s.phase !== 'pick') return advance(s, ctx);
            return {};
        },
        tick(s, ctx) {
            if (s.over) return {};
            if (s.phase === 'pick') {
                if (Object.keys(s.picks).length) return reveal(s, ctx);
                s.due = ctx.now + T.ms(ctx, 'pick'); // nobody chose yet: the card waits
                return {};
            }
            return advance(s, ctx);
        },
        join: () => ({}),
        leave(s, ctx) {
            if (s.phase === 'pick' && ctx.players.length && ctx.players.every(player => s.picks[player.key] !== undefined)) return reveal(s, ctx);
            return {};
        },
        view(s, ctx, me) {
            const picked = s.picks[me] !== undefined;
            const waiting = ctx.players.filter(player => s.picks[player.key] === undefined && player.key !== me).map(player => player.name);
            const shown = s.phase !== 'pick';
            return {
                now: s.over ? { tone: 'done', text: 'All cards done. Well done!' }
                    : s.phase === 'pick' ? (picked
                        ? { tone: 'wait', text: `Waiting for ${list(waiting)} to choose…` }
                        : { tone: 'go', text: 'Choose one!', sub: 'Your table can’t see your choice yet.' })
                        : s.phase === 'talk' ? (ctx.players.every(player => s.said.includes(player.key)) ? { tone: 'go', text: 'Great reasons! Ask each other more, or take the next card.' }
                            : s.said.includes(me)
                            ? { tone: 'go', text: `Now ask ${othersNames(ctx, me)} about their choice.`, sub: 'Do you agree with them?' }
                            : { tone: 'go', text: `Tell ${othersNames(ctx, me)} WHY you chose it.`, sub: 'Use “because” for 2 stars.' })
                            : { tone: 'wait', text: 'Next card…' },
                starters: shown ? REASONS[ctx.opts.level] : [],
                actions: s.phase === 'talk' && ctx.players.every(player => s.said.includes(player.key) || s.picks[player.key] === undefined) || s.phase === 'next' ? [{ act: 'next', label: 'Next card ▶' }] : [],
                chat: {},
                board: [
                    { w: 'card', title: s.card.q, label: def.title },
                    { w: 'options', act: 'pick', off: shown, cols: s.card.options.length,
                        options: s.card.options.map((option, index) => ({ id: String(index), emoji: option.emoji, label: option.label, picked: s.picks[me] === index,
                            ...(shown ? { by: ctx.players.filter(player => s.picks[player.key] === index).map(player => player.key) } : {}) })) },
                ],
                timer: s.phase === 'next' ? null : timer(s, T.ms(ctx, s.phase === 'pick' ? 'pick' : 'talk')),
                seats: seats(s, ctx, null, Object.fromEntries(ctx.players.map(player => [player.key, s.phase === 'pick' ? (s.picks[player.key] !== undefined ? '✔' : '…') : s.said.includes(player.key) ? '💬' : '']))),
                round: ctx.opts.endless ? undefined : { n: s.n, of: s.of },
                over: s.over ? finish(s, ctx) : null,
            };
        },
        status: (s, ctx) => `Card ${s.n}: ${s.card.q} (${s.phase === 'pick' ? 'choosing' : `${s.said.map(key => nameOf(ctx, key)).join(', ') || 'nobody'} gave a reason`})`,
    };
}

export const wouldyourather = make({
    id: 'wyr', title: 'Would You Rather…?', icon: '🤔', levels: ['A1', 'A2', 'B1'],
    blurb: 'Two strange choices. Pick one, then say why!',
    how: ['Choose A or B in secret.', 'See what your table chose.', 'Tell them WHY. Use “because”.'],
    example: ['I chose the dragon because it can fly!', 'Really? I chose the unicorn because it is beautiful.', 'But a dragon is stronger!'],
}, WOULD_YOU_RATHER);

export const thisorthat = make({
    id: 'thisorthat', title: 'This or That?', icon: '⚖️', levels: ['A1', 'A2', 'B1'],
    blurb: 'Which do you like more? Pick fast, then say why.',
    how: ['Choose the one you like more.', 'See what your table chose.', 'Tell them WHY. Use “because”.'],
    example: ['I like night more because it is quiet.', 'I like day because I can play outside.', 'Me too!'],
}, THIS_OR_THAT);

export const agree = make({
    id: 'agree', title: 'Agree or Disagree?', icon: '👍', levels: ['A1', 'A2', 'B1'],
    blurb: 'Read the sentence. Do you agree? Tell your table why.',
    how: ['Read the sentence.', 'Choose: agree, disagree or it depends.', 'Tell your table WHY.'],
    example: ['I disagree because homework is boring.', 'I agree! It helps me remember.', 'It depends on the subject.'],
}, AGREE);
