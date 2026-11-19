// Two games on a grid: Spot the Difference (each player sees a slightly different grid of pictures, and only talking
// finds the differences) and Tic-Tac-Talk (win a square by writing a good sentence with its word).
import type { Cell } from '../../shared/protocol.ts';
import { thingSetsFor, WORD_SETS, type Thing, type WordSet } from '../content/words.ts';
import type { Base, Ctx, Game, Out } from './types.ts';
import { after, base, both, count, deal, finish, forLevel, has, nameOf, others, othersNames, pick, sample, says, seats, seconds, settings, shuffle, star, timer, wordCount } from './util.ts';

// ---------- Spot the Difference ----------

const COLS = 4;
const ROWS = 3;
const SPOT = settings({
    play: seconds('Time to find the differences', 330),
    diffs: count('Differences to find', 5, 1, 8, 4),
    hearts: count('Wrong taps allowed (hearts)', 3, 1, 10),
    show: seconds('Time to see the answers', 7, 2, 60),
    rounds: count('Pictures in free play', 2, 1, 20),
});
const cellId = (index: number): string => `${'ABCD'[index % COLS]}${Math.floor(index / COLS) + 1}`;

type Spot = Base & {
    title: string;
    grids: Record<string, Thing[]>;
    diffs: number[]; found: number[]; hearts: number;
    n: number; of: number; phase: 'play' | 'show';
};

function dealSpot(s: Spot, ctx: Ctx): void {
    const set = pick(thingSetsFor(ctx.opts.level), ctx.rnd);
    const things = shuffle(set.things, ctx.rnd);
    const shown = things.slice(0, COLS * ROWS);
    const spare = things.slice(COLS * ROWS);
    const diffs = Math.min(SPOT.get(ctx, 'diffs'), COLS * ROWS);
    s.title = set.title;
    s.diffs = sample(shown.map((_, index) => index), diffs, ctx.rnd).sort((a, b) => a - b);
    s.grids = Object.fromEntries(ctx.players.map(player => [player.key, [...shown]]));
    // In each different square one player has another picture. Everyone has at least one, when there are enough.
    const order = shuffle(ctx.players, ctx.rnd);
    s.diffs.forEach((cell, index) => { s.grids[order[index % order.length].key][cell] = spare[index % spare.length]; });
    s.found = []; s.hearts = SPOT.get(ctx, 'hearts'); s.phase = 'play'; s.n += 1; s.due = ctx.now + SPOT.ms(ctx, 'play');
}

export const spotdiff: Game<Spot> = {
    id: 'spotdiff', kind: 'board', title: 'Spot the Difference', icon: '🔍', min: 2, max: 3, ideal: 2, minutes: 8, levels: ['A1', 'A2', 'B1'], settings: SPOT.list,
    blurb: 'Your pictures are almost the same. Talk to find the squares that are different!',
    how: ['You and your partner have different pictures.', 'Ask: “What is in A1?”', 'Tap the squares that are different.'],
    example: ['What is in A1?', 'I have a dog in A1.', 'Me too. What about B1?', 'A lion!  Mine is different!'],
    create(ctx) {
        const s = { ...base(), n: 0, of: SPOT.get(ctx, 'rounds') } as unknown as Spot;
        dealSpot(s, ctx);
        return s;
    },
    chat: () => ({}),
    act(s, ctx, from, act, data) {
        if (s.over || s.phase !== 'play' || act !== 'tap') return {};
        const id = String((data as { id?: unknown })?.id ?? '');
        const cell = Array.from({ length: COLS * ROWS }, (_, index) => index).find(index => cellId(index) === id);
        if (cell === undefined || s.found.includes(cell)) return {};
        if (!s.diffs.includes(cell)) {
            s.hearts = Math.max(0, s.hearts - 1);
            const out: Out = { say: [{ text: `❌ ${nameOf(ctx, from)} tapped ${id}, but ${id} is the same for everyone.`, tone: 'bad' }], fx: [{ kind: 'bad' }] };
            if (s.hearts > 0) return out;
            s.phase = 'show'; s.due = ctx.now + SPOT.ms(ctx, 'show');
            return both(out, { say: [{ text: `No hearts left! The differences were in ${s.diffs.map(cellId).join(', ')}.` }] });
        }
        s.found.push(cell);
        star(s, from);
        const out: Out = { say: [{ text: `✅ ${nameOf(ctx, from)} found a difference in ${id}!`, tone: 'good' }], fx: [{ kind: 'good' }] };
        if (s.found.length < s.diffs.length) return out;
        for (const player of ctx.players) star(s, player.key, 2);
        s.phase = 'show'; s.due = ctx.now + SPOT.ms(ctx, 'show');
        return both(out, { say: [{ text: '🎉 You found them all!', tone: 'good' }], fx: [{ kind: 'win' }] });
    },
    tick(s, ctx) {
        if (s.over) return {};
        if (s.phase === 'play') { s.phase = 'show'; s.due = ctx.now + SPOT.ms(ctx, 'show'); return { say: [{ text: `⏰ Time is up! The differences were in ${s.diffs.map(cellId).join(', ')}.` }] }; }
        if (!ctx.opts.endless && s.n >= s.of) { s.over = true; s.due = null; return {}; }
        dealSpot(s, ctx);
        return { say: [{ text: 'New pictures! Find the differences.' }] };
    },
    join(s, ctx, key) { s.grids[key] = [...(s.grids[ctx.players.find(player => player.key !== key)?.key ?? ''] ?? [])]; return {}; },
    leave: () => ({}),
    view(s, ctx, me) {
        const grid = s.grids[me] ?? [];
        const show = s.phase === 'show' || s.over;
        const cells: Cell[] = grid.map((thing, index) => ({
            id: cellId(index), emoji: thing.emoji, label: thing.word, sub: cellId(index),
            state: s.found.includes(index) ? 'found' : show && s.diffs.includes(index) ? 'hot' : 'free',
            off: show || s.found.includes(index),
        }));
        const left = s.diffs.length - s.found.length;
        return {
            now: s.over ? { tone: 'done', text: 'Sharp eyes and good questions. Well done!' }
                : show ? { tone: 'wait', text: left ? `The differences were in ${s.diffs.map(cellId).join(', ')}.` : '🎉 You found them all!', sub: 'New pictures coming…' }
                    : { tone: 'go', text: `${left} square${left === 1 ? ' is' : 's are'} different. Ask ${othersNames(ctx, me)} about the pictures!`, sub: 'Found a difference? Tap that square. Careful: a wrong tap costs a heart.' },
            starters: ['What is in A1?', 'I have … in B2.', 'Is there … in C3?', 'Me too!', 'Mine is different!', 'What about D1?'],
            chat: {},
            board: [
                { w: 'grid', cols: COLS, cells, act: 'tap', coords: true, label: `Your pictures (${s.title})` },
                { w: 'meter', label: 'Found', icon: '🔍', value: s.found.length, max: s.diffs.length },
                { w: 'meter', label: 'Hearts', icon: '❤️', value: s.hearts, max: Math.max(s.hearts, SPOT.get(ctx, 'hearts')) },
            ],
            seats: seats(s, ctx),
            timer: s.phase === 'play' ? timer(s, SPOT.ms(ctx, 'play')) : null,
            round: ctx.opts.endless ? undefined : { n: s.n, of: s.of },
            over: s.over ? finish(s, ctx) : null,
        };
    },
    status: s => `Found ${s.found.length}/${s.diffs.length}, ${s.hearts} hearts`,
};

// ---------- Tic-Tac-Talk ----------

type Square = { word: string; owner: string | null };
type Tic = Base & {
    size: number; set: { title: string; tip: string }; seen: string[];
    cells: Square[]; turn: string;
    phase: 'pick' | 'write' | 'judge' | 'done';
    pick: number | null; sentence: string | null; votes: Record<string, boolean>;
    winner: string | null; line: number[]; games: number;
};
const TIC = settings({
    pick: seconds('Time to choose a square', 30),
    write: seconds('Time to write the sentence', 90),
    judge: seconds('Time for the others to judge it', 30),
    words: count('Words in the sentence', 5, 1, 20),
    end: seconds('Time to see the board before a new one', 8, 2, 60),
});

function dealTic(s: Tic, ctx: Ctx): void {
    const set: WordSet = deal(forLevel(WORD_SETS, ctx.opts.level), s.seen, item => item.id, ctx.rnd);
    s.size = ctx.players.length > 2 ? 4 : 3;
    s.set = { title: set.title, tip: set.tip };
    s.cells = sample(set.words, s.size * s.size, ctx.rnd).map(word => ({ word, owner: null }));
    s.phase = 'pick'; s.pick = null; s.sentence = null; s.votes = {}; s.winner = null; s.line = [];
    s.games += 1;
    s.due = ctx.now + TIC.ms(ctx, 'pick');
}

// Three in a row, in any direction, on a board of any size.
function winningLine(cells: Square[], size: number, owner: string): number[] {
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
                const line = [0, 1, 2].map(step => ({ row: row + dr * step, col: col + dc * step }));
                if (line.every(spot => spot.row >= 0 && spot.row < size && spot.col >= 0 && spot.col < size && cells[spot.row * size + spot.col].owner === owner)) {
                    return line.map(spot => spot.row * size + spot.col);
                }
            }
        }
    }
    return [];
}

function pass(s: Tic, ctx: Ctx): void {
    s.turn = after(ctx, s.turn);
    s.phase = 'pick'; s.pick = null; s.sentence = null; s.votes = {};
    s.due = ctx.now + TIC.ms(ctx, 'pick');
}

function judged(s: Tic, ctx: Ctx): Out {
    const judges = others(ctx, s.turn);
    const yes = judges.filter(player => s.votes[player.key] !== false).length; // no vote in time counts as a yes
    const player = nameOf(ctx, s.turn);
    if (yes * 2 < judges.length) {
        const out: Out = { say: [{ text: `👎 Not yet! ${player} doesn’t get the square. Tell ${player} how to make it better.`, tone: 'bad' }] };
        pass(s, ctx);
        return both(out, { fx: [{ to: s.turn, kind: 'turn' }] });
    }
    s.cells[s.pick!].owner = s.turn;
    star(s, s.turn);
    const line = winningLine(s.cells, s.size, s.turn);
    if (line.length) {
        star(s, s.turn, 3);
        s.winner = s.turn; s.line = line; s.phase = 'done';
        if (ctx.opts.endless) s.due = ctx.now + TIC.ms(ctx, 'end'); else { s.over = true; s.due = null; }
        return { say: [{ text: `🏆 Three in a row! ${player} wins!`, tone: 'good' }], fx: [{ kind: 'win' }] };
    }
    if (s.cells.every(cell => cell.owner)) {
        s.phase = 'done';
        if (ctx.opts.endless) s.due = ctx.now + TIC.ms(ctx, 'end'); else { s.over = true; s.due = null; }
        return { say: [{ text: 'The board is full: a draw! 🤝' }] };
    }
    const out: Out = { say: [{ text: `👍 ${player} wins the square “${s.cells[s.pick!].word}”.`, tone: 'good' }] };
    pass(s, ctx);
    return both(out, { fx: [{ to: s.turn, kind: 'turn' }] });
}

export const tictac: Game<Tic> = {
    id: 'tictac', kind: 'board', title: 'Tic-Tac-Talk', icon: '⭕', min: 2, max: 4, ideal: 2, minutes: 8, levels: ['A1', 'A2', 'B1'], settings: TIC.list,
    blurb: 'Three in a row wins. To take a square, write a good sentence with its word.',
    how: ['Tap a square.', 'Write a sentence with the word.', 'Your partner says 👍 or 👎. Get three in a row!'],
    example: ['Yesterday I went to the park with my dog.', '👍 Good sentence!', 'My turn. I never eat fish because I don’t like it.'],
    create(ctx) {
        const s = { ...base(), seen: [], turn: ctx.players[0].key, games: 0 } as unknown as Tic;
        dealTic(s, ctx);
        return s;
    },
    chat(s, ctx, from, text) {
        if (s.over || s.phase !== 'write' || from !== s.turn || s.pick === null) return {};
        const word = s.cells[s.pick].word;
        const words = TIC.get(ctx, 'words');
        if (!says(text, word)) return wordCount(text) >= Math.min(words, 4) ? { say: [{ to: from, text: `To win the square, use “${word}” in your sentence.` }] } : {};
        if (wordCount(text) < words) return { say: [{ to: from, text: `Make your sentence longer: ${words} word${words === 1 ? '' : 's'} or more.` }] };
        s.sentence = text.trim();
        if (ctx.players.length < 2) return judged(s, ctx);
        s.phase = 'judge'; s.votes = {}; s.due = ctx.now + TIC.ms(ctx, 'judge');
        return {};
    },
    act(s, ctx, from, act, data) {
        if (s.over) return {};
        if (act === 'cell' && s.phase === 'pick' && from === s.turn) {
            const index = s.cells.findIndex((_, at) => `c${at}` === (data as { id?: unknown })?.id);
            if (index < 0 || s.cells[index].owner) return {};
            s.pick = index; s.phase = 'write'; s.due = ctx.now + TIC.ms(ctx, 'write');
            return {};
        }
        if (act === 'judge' && s.phase === 'judge' && from !== s.turn) {
            s.votes[from] = (data as { ok?: unknown })?.ok === true;
            return others(ctx, s.turn).every(player => s.votes[player.key] !== undefined) ? judged(s, ctx) : {};
        }
        return {};
    },
    tick(s, ctx) {
        if (s.over) return {};
        if (s.phase === 'done') { dealTic(s, ctx); s.turn = after(ctx, s.turn); return { say: [{ text: `New board: ${s.set.title}. ${nameOf(ctx, s.turn)} starts.` }] }; }
        if (s.phase === 'judge') return judged(s, ctx);
        const slow = nameOf(ctx, s.turn);
        pass(s, ctx);
        return { say: [{ text: `⏰ Time is up for ${slow}. ${nameOf(ctx, s.turn)}’s turn.` }], fx: [{ to: s.turn, kind: 'turn' }] };
    },
    join: () => ({}),
    leave(s, ctx) {
        if (!ctx.players.length) return {};
        if (!has(ctx, s.turn)) { s.turn = ctx.players[0].key; s.phase = 'pick'; s.pick = null; s.due = ctx.now + TIC.ms(ctx, 'pick'); return {}; }
        if (s.phase === 'judge' && others(ctx, s.turn).every(player => s.votes[player.key] !== undefined)) return judged(s, ctx);
        return {};
    },
    view(s, ctx, me) {
        const mine = s.turn === me;
        const player = nameOf(ctx, s.turn);
        const word = s.pick === null ? '' : s.cells[s.pick].word;
        const cells: Cell[] = s.cells.map((cell, index) => ({
            id: `c${index}`, label: cell.word, owner: cell.owner ?? undefined,
            state: s.line.includes(index) ? 'found' : cell.owner ? (cell.owner === me ? 'mine' : 'taken') : s.pick === index ? 'hot' : 'free',
            off: !!cell.owner || !mine || s.phase !== 'pick',
        }));
        return {
            now: s.over || s.phase === 'done' ? { tone: s.over ? 'done' : 'wait', text: s.winner ? `🏆 ${s.winner === me ? 'You win' : `${nameOf(ctx, s.winner)} wins`}! Three in a row.` : 'A draw! 🤝', sub: s.over ? undefined : 'New board coming…' }
                : s.phase === 'pick' ? (mine ? { tone: 'go', text: 'Your turn! Tap a square.', sub: 'Choose a word you can make a sentence with.' } : { tone: 'wait', text: `${player} is choosing a square…` })
                    : s.phase === 'write' ? (mine ? { tone: 'go', text: `Write a sentence with “${word}”.`, sub: `${TIC.get(ctx, 'words')} words or more. Make it true or funny!` } : { tone: 'wait', text: `${player} is writing a sentence with “${word}”…`, sub: 'Then you decide: is it good English?' })
                        : mine ? { tone: 'wait', text: `${othersNames(ctx, me)} ${others(ctx, me).length > 1 ? 'are' : 'is'} checking your sentence…` }
                            : s.votes[me] !== undefined ? { tone: 'wait', text: 'Thanks! Waiting for the others…' } : { tone: 'go', text: `Is ${player}’s sentence good English?`, sub: `“${s.sentence}”` },
            starters: s.phase === 'write' && mine ? [s.set.tip] : [],
            actions: s.phase === 'judge' && !mine && s.votes[me] === undefined ? [{ act: 'judge', label: '👍 Good sentence', data: { ok: true } }, { act: 'judge', label: '👎 Not yet', data: { ok: false }, ghost: true }] : [],
            chat: { hint: s.phase === 'write' && mine ? `A sentence with “${word}”` : undefined },
            board: [
                { w: 'grid', cols: s.size, cells, act: 'cell', label: s.set.title },
                ...(s.sentence && s.phase === 'judge' ? [{ w: 'card' as const, label: `${player}’s sentence with “${word}”`, title: s.sentence }] : []),
            ],
            timer: s.phase === 'done' ? null : timer(s, TIC.ms(ctx, s.phase)),
            seats: seats(s, ctx, s.phase === 'done' ? null : s.turn),
            over: s.over ? finish(s, ctx, s.winner ? `${nameOf(ctx, s.winner)} wins!` : 'A draw!') : null,
        };
    },
    status: (s, ctx) => `${nameOf(ctx, s.turn)}’s turn (${s.phase}); ${s.cells.filter(cell => cell.owner).length}/${s.cells.length} squares taken`,
};
