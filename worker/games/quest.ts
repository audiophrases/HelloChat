// Side quests: the table picks one of three quest cards, talks, and writes one answer together. A quest with secret
// role cards cannot be solved alone; a quest with a known answer is checked; any other is a short report the teacher
// can read. The answer box opens only after everyone has written in the chat.
import { QUESTS, type Quest } from '../content/quests.ts';
import type { Level } from '../../shared/protocol.ts';
import type { Base, Ctx, Game, Out } from './types.ts';
import { base, count, finish, minutes, nameOf, othersNames, says, seats, seconds, settings, shuffle, star, timer, wordCount } from './util.ts';

type State = Base & {
    phase: 'choose' | 'talk' | 'next';
    offer: string[]; quest: string | null;
    msgs: Record<string, number>; need: number; tries: number;
    done: string[]; count: number; of: number;
    role: Record<string, string>;      // each player's secret card
    answer: string | null; right: boolean;
};
const T = settings({
    choose: seconds('Time to choose a quest card', 40),
    extra: minutes('Extra minutes on top of each card’s time', 2, 0, 30),
    need: count('Messages each before answering', 3, 0, 20, 2),
    answer: count('Words in a written answer', 6, 1, 40, 4),
    tries: count('Tries at a quest with one right answer', 4, 1, 10),
    show: seconds('Time to see the answer', 6, 2, 60),
    rounds: count('Quests in free play', 3, 1, 20),
});
const ORDER: Level[] = ['A1', 'A2', 'B1'];

const byId = (id: string | null): Quest | undefined => QUESTS.find(quest => quest.id === id);

// Three cards to choose from: of the table's level (or a little easier), for its size, not done yet, and of three
// different kinds when there are enough.
function offer(s: State, ctx: Ctx): void {
    const size = ctx.players.length <= 2 ? 'pair' : 'group';
    const level = ORDER.indexOf(ctx.opts.level);
    const fits = (quest: Quest) => (quest.size === 'any' || quest.size === size) && !s.done.includes(quest.id);
    let pool = QUESTS.filter(quest => fits(quest) && quest.level === ctx.opts.level);
    if (pool.length < 3) pool = QUESTS.filter(quest => fits(quest) && ORDER.indexOf(quest.level) <= level);
    if (pool.length < 3) { s.done = []; pool = QUESTS.filter(quest => (quest.size === 'any' || quest.size === size) && ORDER.indexOf(quest.level) <= level); }
    const picked: Quest[] = [];
    // First a quest with secret cards or a checked answer, so there is always one nobody can do alone.
    for (const want of [(quest: Quest) => !!quest.roles, (quest: Quest) => !quest.roles && !quest.accept, () => true]) {
        const next = shuffle(pool, ctx.rnd).find(quest => want(quest) && !picked.includes(quest) && !picked.some(other => other.cat === quest.cat));
        if (next) picked.push(next);
    }
    for (const quest of shuffle(pool, ctx.rnd)) { if (picked.length >= 3) break; if (!picked.includes(quest)) picked.push(quest); }
    s.offer = picked.map(quest => quest.id);
    s.phase = 'choose'; s.quest = null; s.answer = null; s.right = false;
    s.due = ctx.now + T.ms(ctx, 'choose');
}

// Every card is held by someone: with two players and three cards, one player holds two.
function dealRoles(s: State, ctx: Ctx, quest: Quest): void {
    s.role = {};
    if (!quest.roles) return;
    const players = shuffle(ctx.players, ctx.rnd);
    const count = Math.max(players.length, quest.roles.length);
    for (let i = 0; i < count; i++) {
        const key = players[i % players.length].key;
        const card = quest.roles[i % quest.roles.length];
        if (!(s.role[key] ?? '').includes(card)) s.role[key] = s.role[key] ? `${s.role[key]}\n${card}` : card;
    }
}

function start(s: State, ctx: Ctx, id: string): Out {
    const quest = byId(id);
    if (!quest) return {};
    s.quest = id; s.phase = 'talk'; s.msgs = {}; s.tries = 0;
    s.need = T.get(ctx, 'need');
    dealRoles(s, ctx, quest);
    s.due = ctx.now + Math.max(4 * 60_000, quest.minutes * 60_000 + T.ms(ctx, 'extra'));
    return { say: [{ text: `${quest.emoji} Quest: ${quest.title}` }] };
}

function complete(s: State, ctx: Ctx, quest: Quest, stars: number, line: string, tone: 'good' | 'info'): Out {
    for (const player of ctx.players) star(s, player.key, stars);
    s.done.push(quest.id); s.count += 1;
    s.phase = 'next'; s.due = ctx.now + T.ms(ctx, 'show');
    return { say: [{ text: line, tone }], fx: [{ kind: tone === 'good' ? 'win' : 'star' }] };
}

const talked = (s: State, ctx: Ctx): boolean => ctx.players.every(player => (s.msgs[player.key] ?? 0) >= s.need);

export const quest: Game<State> = {
    id: 'quest', kind: 'quest', title: 'Side Quests', icon: '🗺️', min: 2, max: 4, ideal: 2, minutes: 10, levels: ['A1', 'A2', 'B1'], settings: T.list,
    blurb: 'Pick a quest card. Share your secret clues, role-play or decide together, then write one answer.',
    how: ['Choose one quest card together.', 'Chat! Some players have secret cards to share.', 'Write ONE answer for your table.'],
    example: ['My clue says the cat is not in the kitchen.', 'Mine says kitchen, garden or bedroom!', 'And not in the garden… so it’s the bedroom!'],
    create(ctx) {
        const s = { ...base(), msgs: {}, need: T.get(ctx, 'need'), tries: 0, done: [], count: 0, of: T.get(ctx, 'rounds'), role: {} } as unknown as State;
        offer(s, ctx);
        return s;
    },
    chat(s, ctx, from, text) {
        if (s.over || s.phase !== 'talk' || wordCount(text) < 2) return {};
        const before = talked(s, ctx);
        s.msgs[from] = (s.msgs[from] ?? 0) + 1;
        if (s.msgs[from] === s.need) star(s, from);
        return !before && talked(s, ctx) ? { say: [{ text: '✍️ Good talking! Now write your table’s answer in the box.' }] } : {};
    },
    act(s, ctx, from, act, data) {
        if (s.over) return {};
        if (act === 'pick' && s.phase === 'choose') {
            const id = String((data as { id?: unknown })?.id ?? '');
            return s.offer.includes(id) ? start(s, ctx, id) : {};
        }
        if (act === 'other' && s.phase === 'talk' && Object.values(s.msgs).reduce((sum, count) => sum + count, 0) < 2) {
            offer(s, ctx); // changed their mind before starting
            return {};
        }
        if (act !== 'answer' || s.phase !== 'talk') return {};
        const quest = byId(s.quest);
        const text = String((data as { text?: unknown })?.text ?? '').trim().slice(0, 400);
        if (!quest || !text) return {};
        if (!talked(s, ctx)) return { say: [{ to: from, text: `Chat first! Everyone writes ${s.need} messages.` }] };
        if (quest.accept) {
            if (quest.accept.every(group => group.some(word => says(text, word)))) {
                s.answer = text; s.right = true;
                return complete(s, ctx, quest, Math.max(1, 4 - s.tries), `✅ Correct! ${nameOf(ctx, from)} wrote: “${text}”`, 'good');
            }
            s.tries += 1;
            if (s.tries >= T.get(ctx, 'tries')) { s.answer = text; return complete(s, ctx, quest, 1, `The answer was: ${quest.accept.map(group => group[0]).join(' + ')}. Good try!`, 'info'); }
            const part = quest.accept.length > 1 && quest.accept.some(group => group.some(word => says(text, word)));
            return { say: [{ text: `❌ “${text}” is not right yet${part ? ', but part of it is' : ''}. Share your clues again and try once more!${s.tries >= 2 && quest.hint ? ` Hint: ${quest.hint}` : ''}`, tone: 'bad' }], fx: [{ kind: 'bad' }] };
        }
        const min = T.get(ctx, 'answer');
        if (wordCount(text) < min) return { say: [{ to: from, text: `Write a longer answer: ${min} words or more.` }] };
        s.answer = text;
        return { ...complete(s, ctx, quest, 3, `✅ Quest complete! ${nameOf(ctx, from)} wrote: “${text}”`, 'good'), report: { quest: quest.id, title: quest.title, text, by: from } };
    },
    tick(s, ctx) {
        if (s.over) return {};
        if (s.phase === 'choose') return start(s, ctx, s.offer[0]);
        if (s.phase === 'talk') { if (s.quest) s.done.push(s.quest); offer(s, ctx); return { say: [{ text: '⏰ Time for a new quest! Choose a card.' }] }; }
        if (!ctx.opts.endless && s.count >= s.of) { s.over = true; s.due = null; return { fx: [{ kind: 'win' }] }; }
        offer(s, ctx);
        return {};
    },
    join(s, ctx, key) {
        const current = byId(s.quest);
        if (s.phase === 'talk' && current?.roles) s.role[key] = current.roles[ctx.players.length % current.roles.length];
        return {};
    },
    leave(s, ctx, key) {
        // The cards of someone who left go to a player still at the table, so the quest can still be solved.
        const card = s.role[key];
        delete s.role[key];
        if (card && ctx.players.length) { const heir = ctx.players[0].key; s.role[heir] = s.role[heir] ? `${s.role[heir]}\n${card}` : card; }
        return {};
    },
    view(s, ctx, me) {
        const current = byId(s.quest);
        const mine = s.msgs[me] ?? 0;
        const ready = talked(s, ctx);
        if (s.phase === 'choose' || !current) {
            return {
                now: s.over ? { tone: 'done', text: `${s.count} quests complete. Well done!` } : { tone: 'go', text: 'Choose a quest card for your table!', sub: `Talk with ${othersNames(ctx, me)}: which one looks fun?` },
                starters: ['Which one do you want?', 'Let’s do number …', 'I like the first one.', 'OK!'],
                chat: {},
                board: s.over ? [] : [{ w: 'options', act: 'pick', cols: 3, label: 'Tap one card',
                    options: s.offer.map(id => byId(id)).filter((item): item is Quest => !!item).map(item => ({ id: item.id, emoji: item.emoji, label: item.title, sub: `${item.cat} · ${item.minutes} min` })) }],
                timer: s.over ? null : timer(s, T.ms(ctx, 'choose')),
                seats: seats(s, ctx),
                round: ctx.opts.endless ? undefined : { n: Math.min(s.count + 1, s.of), of: s.of },
                over: s.over ? finish(s, ctx, 'Quests complete!') : null,
            };
        }
        const done = s.phase === 'next';
        return {
            now: done ? { tone: 'wait', text: s.right || !current.accept ? '✅ Quest complete!' : 'Good try!', sub: 'Next quest cards coming…' }
                : !ready ? (mine < s.need
                    ? { tone: 'go', text: s.role[me] ? `Tell ${othersNames(ctx, me)} what your secret card says!` : `Talk about the quest with ${othersNames(ctx, me)}.`, sub: `Everyone writes ${s.need} messages first: ${'●'.repeat(mine)}${'○'.repeat(s.need - mine)}` }
                    : { tone: 'go', text: `Keep talking! ${ctx.players.filter(player => (s.msgs[player.key] ?? 0) < s.need).map(player => player.name).join(' and ')} must write more.` })
                    : { tone: 'go', text: '✍️ Write your table’s answer in the box.', sub: current.accept ? 'Agree first! A wrong answer costs a star.' : 'One answer for everyone. Agree on it in the chat first.' },
            starters: s.role[me] ? ['My card says …', 'What does your card say?', 'So the answer is …', 'I think …'] : ['I think …', 'What do you think?', 'Let’s write …', 'I agree.'],
            actions: !done && !ready && Object.values(s.msgs).reduce((sum, count) => sum + count, 0) < 2 ? [{ act: 'other', label: 'Other cards ↩', ghost: true }] : [],
            chat: {},
            board: [
                { w: 'card', emoji: current.emoji, label: `${current.cat} · ${current.level}`, title: current.title, text: current.text },
                ...(s.role[me] ? [{ w: 'card' as const, tone: 'secret' as const, emoji: '🤫', label: 'Your secret card: only you can see it', title: s.role[me] }] : []),
                ...(done ? (s.answer ? [{ w: 'card' as const, tone: (s.right || !current.accept ? 'good' : 'plain') as 'good' | 'plain', label: 'Your answer', title: s.answer }] : [])
                    : ready ? [{ w: 'answer' as const, act: 'answer', label: 'Your table’s answer', placeholder: current.accept ? 'Write the answer…' : 'Write your answer together…', min: 1, max: 400 }] : []),
            ],
            seats: seats(s, ctx, null, Object.fromEntries(ctx.players.map(player => [player.key, `${Math.min(s.msgs[player.key] ?? 0, s.need)}/${s.need}`]))),
            round: ctx.opts.endless ? undefined : { n: Math.min(s.count + 1, s.of), of: s.of },
            over: null,
        };
    },
    status: s => (s.phase === 'choose' ? 'Choosing a quest' : `${byId(s.quest)?.title ?? 'Quest'} (${s.count} done)`),
};
