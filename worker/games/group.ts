// Two games for a whole table: Find the Spy (everyone knows the place except one) and Pack the Bag (choose alone,
// then talk until everyone has chosen the same things).
import { SCENARIOS, SPY_PLACES, type Scenario, type Thing } from '../content/words.ts';
import type { Base, Ctx, Game, Out } from './types.ts';
import { after, base, both, count, deal, finish, forLevel, has, isQuestion, nameOf, others, othersNames, pick, sample, says, seats, seconds, settings, star, timer, wordCount } from './util.ts';

// ---------- Find the Spy ----------

type Spy = Base & {
    places: Thing[]; place: string; spy: string;
    asker: string; answerer: string;
    phase: 'ask' | 'answer' | 'vote' | 'guess' | 'show';
    asked: number; total: number;
    votes: Record<string, string>; caught: boolean | null; spyWon: boolean | null;
    round: number; of: number;
};
const SPY = settings({
    ask: seconds('Time to ask a question', 70),
    answer: seconds('Time to answer', 70),
    vote: seconds('Time to vote for the spy', 45),
    guess: seconds('Time for a caught spy to guess the place', 35),
    show: seconds('Time to see the answer', 9, 2, 60),
    questions: count('Questions each before the vote', 2, 1, 10),
    rounds: count('Rounds in free play', 2, 1, 20),
});
type SpyPhase = 'ask' | 'answer' | 'vote' | 'guess' | 'show';
const spyMs = (ctx: Ctx, phase: SpyPhase): number => SPY.ms(ctx, phase);

function dealSpy(s: Spy, ctx: Ctx): void {
    s.places = sample(SPY_PLACES, 8, ctx.rnd);
    s.place = pick(s.places, ctx.rnd).word;
    s.spy = pick(ctx.players, ctx.rnd).key;
    s.asker = pick(ctx.players, ctx.rnd).key;
    s.answerer = after(ctx, s.asker);
    s.phase = 'ask'; s.asked = 0; s.total = ctx.players.length * SPY.get(ctx, 'questions');
    s.votes = {}; s.caught = null; s.spyWon = null;
    s.round += 1;
    s.due = ctx.now + spyMs(ctx, 'ask');
}

function nextQuestion(s: Spy, ctx: Ctx): Out {
    s.asked += 1;
    if (s.asked >= s.total) {
        s.phase = 'vote'; s.due = ctx.now + spyMs(ctx, 'vote');
        return { say: [{ text: '🗳️ No more questions. Who is the spy? Vote!' }] };
    }
    s.asker = has(ctx, s.answerer) ? s.answerer : after(ctx, s.asker);
    s.answerer = after(ctx, s.asker);
    s.phase = 'ask'; s.due = ctx.now + spyMs(ctx, 'ask');
    return { fx: [{ to: s.asker, kind: 'turn' }] };
}

function countSpyVotes(s: Spy, ctx: Ctx): Out {
    const tally = new Map<string, number>();
    for (const vote of Object.values(s.votes)) tally.set(vote, (tally.get(vote) ?? 0) + 1);
    const most = Math.max(0, ...tally.values());
    const top = [...tally].filter(([, count]) => count === most).map(([key]) => key);
    s.caught = top.length === 1 && top[0] === s.spy;
    const spy = nameOf(ctx, s.spy);
    if (s.caught) {
        for (const player of ctx.players) if (s.votes[player.key] === s.spy) star(s, player.key, 2);
        s.phase = 'guess'; s.due = ctx.now + spyMs(ctx, 'guess');
        return { say: [{ text: `🕵️ Caught! ${spy} is the spy. But the spy has one last chance: guess the place!`, tone: 'good' }] };
    }
    star(s, s.spy, 4); s.spyWon = true;
    s.phase = 'show'; s.due = ctx.now + spyMs(ctx, 'show');
    return { say: [{ text: `😎 The spy escaped! It was ${spy}. The place was the ${s.place}.`, tone: 'bad' }], fx: [{ to: s.spy, kind: 'win' }] };
}

export const spy: Game<Spy> = {
    id: 'spy', kind: 'board', title: 'Find the Spy', icon: '🕵️', min: 3, max: 4, ideal: 4, minutes: 10, levels: ['A2', 'B1'], settings: SPY.list,
    blurb: 'Everyone knows the secret place… except the spy. Ask clever questions to find who is pretending!',
    how: ['You all know the secret place. The spy doesn’t!', 'Take turns: ask a question about the place, but don’t say it.', 'Vote: who is the spy?'],
    example: ['What do you wear in this place?', 'Hmm… normal clothes, I think.', 'Do you go there every week?', 'Yes, with my mum.'],
    create(ctx) {
        const s = { ...base(), round: 0, of: SPY.get(ctx, 'rounds') } as unknown as Spy;
        dealSpy(s, ctx);
        return s;
    },
    chat(s, ctx, from, text) {
        if (s.over) return {};
        if ((s.phase === 'ask' || s.phase === 'answer') && from !== s.spy && says(text, s.place)) return { block: '🤫 Don’t say the place! The spy is listening.' };
        if (s.phase === 'ask' && from === s.asker && isQuestion(text, 3)) {
            star(s, from);
            s.phase = 'answer'; s.due = ctx.now + spyMs(ctx, 'answer');
            return { fx: [{ to: s.answerer, kind: 'turn' }] };
        }
        if (s.phase === 'answer' && from === s.answerer && wordCount(text) >= 3) {
            star(s, from);
            return nextQuestion(s, ctx);
        }
        return {};
    },
    act(s, ctx, from, act, data) {
        if (s.over) return {};
        const id = String((data as { id?: unknown })?.id ?? '');
        if (act === 'vote' && s.phase === 'vote') {
            if (id === from || !has(ctx, id)) return {};
            s.votes[from] = id;
            return ctx.players.every(player => s.votes[player.key]) ? countSpyVotes(s, ctx) : {};
        }
        if (act === 'place' && s.phase === 'guess' && from === s.spy) {
            const place = s.places[Number(id.replace('p', ''))]?.word;
            if (!place) return {};
            s.spyWon = place === s.place;
            if (s.spyWon) star(s, s.spy, 3); else for (const player of others(ctx, s.spy)) star(s, player.key, 2);
            s.phase = 'show'; s.due = ctx.now + spyMs(ctx, 'show');
            return { say: [{ text: s.spyWon ? `😎 The spy guessed it: the ${s.place}! The spy wins.` : `🎉 Wrong! The spy said “${place}”, but it was the ${s.place}. The table wins!`, tone: s.spyWon ? 'bad' : 'good' }], fx: [{ kind: 'win' }] };
        }
        return {};
    },
    tick(s, ctx) {
        if (s.over) return {};
        if (s.phase === 'ask' || s.phase === 'answer') return both({ say: [{ text: `⏰ Too slow, ${nameOf(ctx, s.phase === 'ask' ? s.asker : s.answerer)}!` }] }, nextQuestion(s, ctx));
        if (s.phase === 'vote') return countSpyVotes(s, ctx);
        if (s.phase === 'guess') {
            for (const player of others(ctx, s.spy)) star(s, player.key, 2);
            s.spyWon = false; s.phase = 'show'; s.due = ctx.now + spyMs(ctx, 'show');
            return { say: [{ text: `⏰ The spy did not guess. It was the ${s.place}. The table wins!`, tone: 'good' }] };
        }
        if (!ctx.opts.endless && s.round >= s.of) { s.over = true; s.due = null; return { fx: [{ kind: 'win' }] }; }
        dealSpy(s, ctx);
        return { say: [{ text: 'New round: a new place and a new spy!' }] };
    },
    join: () => ({}),
    leave(s, ctx, key) {
        if (ctx.players.length < 2) return {};
        if (key === s.spy && s.phase !== 'show') { s.phase = 'show'; s.due = ctx.now + 3000; return { say: [{ text: `The spy left the table! The place was the ${s.place}.` }] }; }
        if (!has(ctx, s.asker)) s.asker = ctx.players[0].key;
        if (!has(ctx, s.answerer) || s.answerer === s.asker) s.answerer = after(ctx, s.asker);
        if (s.phase === 'vote' && ctx.players.every(player => s.votes[player.key])) return countSpyVotes(s, ctx);
        return {};
    },
    view(s, ctx, me) {
        const amSpy = s.spy === me;
        const asker = nameOf(ctx, s.asker);
        const answerer = nameOf(ctx, s.answerer);
        const place = s.places.find(item => item.word === s.place);
        const left = Math.max(0, s.total - s.asked);
        const show = s.phase === 'show' || s.over;
        const now = (): { tone: 'go' | 'wait' | 'done'; text: string; sub?: string } => {
            if (s.over) return { tone: 'done', text: 'Case closed. Well done!' };
            switch (s.phase) {
                case 'ask': return s.asker === me ? { tone: 'go', text: `Ask ${answerer} a question about the place.`, sub: amSpy ? 'You are the spy: ask something that sounds like you know!' : 'Don’t make it too easy: the spy is reading!' }
                    : { tone: 'wait', text: `${asker} is asking ${s.answerer === me ? 'YOU' : answerer} a question…`, sub: `${left} question${left === 1 ? '' : 's'} left. Who sounds strange?` };
                case 'answer': return s.answerer === me ? { tone: 'go', text: `Answer ${asker}’s question.`, sub: amSpy ? 'You are the spy: pretend you know the place!' : 'Don’t say the place!' }
                    : { tone: 'wait', text: `${answerer} is answering…`, sub: 'Does the answer sound right?' };
                case 'vote': return s.votes[me] ? { tone: 'wait', text: 'Vote in! Waiting for the others…' } : { tone: 'go', text: 'Who is the spy? Tap a player!' };
                case 'guess': return amSpy ? { tone: 'go', text: 'They caught you! Last chance: tap the secret place.' } : { tone: 'wait', text: `${nameOf(ctx, s.spy)} is the spy! The spy is guessing the place…` };
                default: return { tone: 'wait', text: `The spy was ${nameOf(ctx, s.spy)}. The place was the ${s.place}.`, sub: 'New round soon…' };
            }
        };
        return {
            now: now(),
            starters: s.phase === 'ask' && s.asker === me ? ['What do you do there?', 'What can you see there?', 'Who works there?', 'When do you go there?', 'What do you wear there?', 'Is it noisy there?']
                : s.phase === 'answer' && s.answerer === me ? ['I usually …', 'You can …', 'There are …', 'It depends, but …'] : [],
            chat: {},
            board: [
                amSpy && !show ? { w: 'card', tone: 'bad', emoji: '🕵️', label: 'Only you can see this', title: 'You are the SPY!', text: 'You don’t know the place. Listen, pretend, and work it out.' }
                    : { w: 'card', tone: 'secret', emoji: place?.emoji, label: show ? 'The secret place' : 'Only you can see this', title: `The ${s.place}`, text: show ? `The spy was ${nameOf(ctx, s.spy)}.` : 'Everyone knows this place, except the spy. Don’t say it!' },
                s.phase === 'vote' ? { w: 'options', act: 'vote', label: 'Who is the spy?', cols: 3, off: !!s.votes[me],
                    options: others(ctx, me).map(player => ({ id: player.key, label: player.name, face: player.key, picked: s.votes[me] === player.key })) }
                    : { w: 'grid', cols: 4, label: s.phase === 'guess' && amSpy ? 'Tap the secret place' : 'It is one of these places', act: s.phase === 'guess' && amSpy ? 'place' : undefined,
                        cells: s.places.map((item, index) => ({ id: `p${index}`, emoji: item.emoji, label: item.word, state: show && item.word === s.place ? 'found' as const : 'free' as const, off: !(s.phase === 'guess' && amSpy) })) },
                ...(s.phase === 'ask' || s.phase === 'answer' ? [{ w: 'meter' as const, label: 'Questions left', icon: '❓', value: left, max: s.total }] : []),
            ],
            timer: show ? null : timer(s, spyMs(ctx, s.phase)),
            seats: seats(s, ctx, s.phase === 'ask' ? s.asker : s.phase === 'answer' ? s.answerer : null, show ? { [s.spy]: '🕵️' } : {}),
            round: ctx.opts.endless ? undefined : { n: s.round, of: s.of },
            over: s.over ? finish(s, ctx) : null,
        };
    },
    status: (s, ctx) => `Place: ${s.place}; spy: ${nameOf(ctx, s.spy)}; ${s.phase} (${s.asked}/${s.total} questions)`,
};

// ---------- Pack the Bag ----------

type Bag = Base & {
    sc: Scenario; seen: string[];
    picks: Record<string, string[]>; msgs: Record<string, number>;
    phase: 'solo' | 'agree' | 'show'; n: number; of: number; agreed: boolean; nudged: boolean;
};
const BAG = settings({
    solo: seconds('Time to choose alone', 45),
    agree: seconds('Time to talk and agree', 300),
    show: seconds('Time to see the result', 7, 2, 60),
    need: count('Messages each before agreeing', 2, 0, 20),  // so a table cannot agree in silence
    rounds: count('Stories in free play', 2, 1, 20),
});
type BagPhase = 'solo' | 'agree' | 'show';
const bagMs = (ctx: Ctx, phase: BagPhase): number => BAG.ms(ctx, phase);

function dealBag(s: Bag, ctx: Ctx): void {
    s.sc = deal(forLevel(SCENARIOS, ctx.opts.level), s.seen, item => item.id, ctx.rnd);
    s.picks = {}; s.msgs = {}; s.phase = 'solo'; s.agreed = false; s.nudged = false; s.n += 1;
    s.due = ctx.now + bagMs(ctx, 'solo');
}

const sameSet = (a: string[], b: string[]): boolean => a.length === b.length && a.every(item => b.includes(item));
function common(s: Bag, ctx: Ctx): string[] {
    const [first, ...rest] = ctx.players.map(player => s.picks[player.key] ?? []);
    return (first ?? []).filter(item => rest.every(picks => picks.includes(item)));
}

function checkAgreed(s: Bag, ctx: Ctx): Out {
    if (s.phase !== 'agree' || !ctx.players.length) return {};
    const first = s.picks[ctx.players[0].key] ?? [];
    if (first.length !== s.sc.pick || !ctx.players.every(player => sameSet(s.picks[player.key] ?? [], first))) return {};
    const need = BAG.get(ctx, 'need');
    const quiet = ctx.players.filter(player => (s.msgs[player.key] ?? 0) < need);
    if (quiet.length) {
        if (s.nudged) return {};
        s.nudged = true;
        return { say: [{ text: `You chose the same things! But first, ${quiet.map(player => player.name).join(' and ')}: tell the table WHY (${need} message${need === 1 ? '' : 's'} each).` }] };
    }
    for (const player of ctx.players) star(s, player.key, 4);
    s.agreed = true; s.phase = 'show'; s.due = ctx.now + bagMs(ctx, 'show');
    const items = s.sc.items.filter((_, index) => first.includes(`i${index}`)).map(item => `${item.emoji} ${item.word}`).join(', ');
    return { say: [{ text: `🤝 You agree! Your choice: ${items}.`, tone: 'good' }], fx: [{ kind: 'win' }] };
}

export const packbag: Game<Bag> = {
    id: 'packbag', kind: 'board', title: 'Pack the Bag', icon: '🎒', min: 2, max: 4, ideal: 3, minutes: 8, levels: ['A1', 'A2', 'B1'], settings: BAG.list,
    blurb: 'Choose 3 things alone. Then talk until your whole table chooses the SAME 3.',
    how: ['Read the story. Choose 3 things alone.', 'See what the others chose.', 'Talk and change your choices until you all agree!'],
    example: ['I think we need water because it is hot.', 'OK, but why did you choose the ball?', 'Because we will be bored!', 'Hmm… a knife is more useful.'],
    create(ctx) {
        const s = { ...base(), seen: [], n: 0, of: BAG.get(ctx, 'rounds') } as unknown as Bag;
        dealBag(s, ctx);
        return s;
    },
    chat(s, ctx, from, text) {
        if (s.over || s.phase !== 'agree' || wordCount(text) < 3) return {};
        s.msgs[from] = (s.msgs[from] ?? 0) + 1;
        if (s.msgs[from] === BAG.get(ctx, 'need')) star(s, from);
        return checkAgreed(s, ctx);
    },
    act(s, ctx, from, act, data) {
        if (s.over || act !== 'toggle' || s.phase === 'show') return {};
        const id = String((data as { id?: unknown })?.id ?? '');
        if (!s.sc.items.some((_, index) => `i${index}` === id)) return {};
        const picks = s.picks[from] ??= [];
        if (picks.includes(id)) s.picks[from] = picks.filter(item => item !== id);
        else if (picks.length >= s.sc.pick) return { say: [{ to: from, text: `Only ${s.sc.pick}! Tap one of your choices to take it out first.` }] };
        else picks.push(id);
        if (s.phase === 'solo') {
            if (!ctx.players.every(player => (s.picks[player.key] ?? []).length === s.sc.pick)) return {};
            s.phase = 'agree'; s.due = ctx.now + bagMs(ctx, 'agree');
            return both({ say: [{ text: 'Everyone has chosen. Now look at the choices, talk, and agree on the same 3!' }] }, checkAgreed(s, ctx));
        }
        return checkAgreed(s, ctx);
    },
    tick(s, ctx) {
        if (s.over) return {};
        if (s.phase === 'solo') { s.phase = 'agree'; s.due = ctx.now + bagMs(ctx, 'agree'); return { say: [{ text: 'Time to talk! Look at the choices and agree on the same 3.' }] }; }
        if (s.phase === 'agree') {
            const shared = common(s, ctx).length;
            for (const player of ctx.players) star(s, player.key, shared);
            s.phase = 'show'; s.due = ctx.now + bagMs(ctx, 'show');
            return { say: [{ text: `⏰ Time is up! You agreed on ${shared} of ${s.sc.pick}.` }] };
        }
        if (!ctx.opts.endless && s.n >= s.of) { s.over = true; s.due = null; return { fx: [{ kind: 'win' }] }; }
        dealBag(s, ctx);
        return { say: [{ text: `Next: ${s.sc.emoji} ${s.sc.title}` }] };
    },
    join: () => ({}),
    leave: (s, ctx) => checkAgreed(s, ctx),
    view(s, ctx, me) {
        const mine = s.picks[me] ?? [];
        const open = s.phase !== 'solo';
        const shared = common(s, ctx).length;
        return {
            now: s.over ? { tone: 'done', text: 'Bags packed. Well done!' }
                : s.phase === 'solo' ? (mine.length === s.sc.pick ? { tone: 'wait', text: `Waiting for ${othersNames(ctx, me)} to choose…` } : { tone: 'go', text: `Choose ${s.sc.pick} things. (${mine.length} of ${s.sc.pick})`, sub: 'Only you see your choices for now.' })
                    : s.phase === 'agree' ? { tone: 'go', text: `Talk and agree! Everyone must choose the SAME ${s.sc.pick} things.`, sub: `You all agree on ${shared} of ${s.sc.pick}. Say why, then tap to change your choices.` }
                        : { tone: 'wait', text: s.agreed ? '🤝 You all agree!' : `You agreed on ${shared} of ${s.sc.pick}.`, sub: 'Next one soon…' },
            starters: open ? ['I think we need … because …', 'Why did you choose …?', 'OK, let’s take …', 'I agree.', 'I don’t agree because …', 'What about …?'] : [],
            chat: {},
            board: [
                { w: 'card', emoji: s.sc.emoji, label: s.sc.title, title: s.sc.text },
                { w: 'options', act: 'toggle', cols: 5, off: s.phase === 'show', label: `Choose ${s.sc.pick}`,
                    options: s.sc.items.map((item, index) => ({ id: `i${index}`, emoji: item.emoji, label: item.word, picked: mine.includes(`i${index}`),
                        ...(open ? { by: ctx.players.filter(player => (s.picks[player.key] ?? []).includes(`i${index}`)).map(player => player.key) } : {}) })) },
            ],
            timer: s.phase === 'show' ? null : timer(s, bagMs(ctx, s.phase)),
            seats: seats(s, ctx, null, Object.fromEntries(ctx.players.map(player => [player.key, s.phase === 'solo' ? ((s.picks[player.key] ?? []).length === s.sc.pick ? '✔' : '…') : '']))),
            round: ctx.opts.endless ? undefined : { n: s.n, of: s.of },
            over: s.over ? finish(s, ctx) : null,
        };
    },
    status: (s, ctx) => `${s.sc.title} (${s.phase}); agree on ${common(s, ctx).length}/${s.sc.pick}`,
};
