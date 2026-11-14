// Three warm-ups that are nothing but questions and answers: Speed Chat, Question Ping-Pong and Hot Potato.
import { KEEP_TALKING, questionsFor, TOPICS } from '../content/questions.ts';
import type { Base, Ctx, Game } from './types.ts';
import { after, answerKey, base, deal, finish, has, isQuestion, nameOf, othersNames, pick, seats, star, timer, wordCount } from './util.ts';

const topicFor = (ctx: Ctx): { id: string; title: string; emoji: string; ask: string[] } => {
    if (ctx.opts.topic === 'custom' && ctx.opts.custom.length) return { id: 'custom', title: 'your teacher’s questions', emoji: '📝', ask: TOPICS[0].ask };
    const topic = TOPICS.find(item => item.id === ctx.opts.topic) ?? pick(TOPICS, ctx.rnd);
    return { id: topic.id, title: topic.title, emoji: topic.emoji, ask: topic.ask };
};

// ---------- Speed Chat ----------
// One question on the table; everyone writes three messages about it, then takes another.

type Speed = Base & { q: string; seen: string[]; count: Record<string, number>; said: Record<string, string[]>; n: number; of: number; goal: number; deck: string; emoji: string; since: number };
// A table that is stuck on a question may change it after this long; a table that has talked may change it at once.
const SKIP_MS = 45_000;
const everyoneTalked = (s: Speed, ctx: Ctx): boolean => ctx.players.every(player => (s.count[player.key] ?? 0) >= s.goal);

export const speedchat: Game<Speed> = {
    id: 'speedchat', kind: 'warmup', title: 'Speed Chat', icon: '⚡', min: 2, max: 3, ideal: 2, minutes: 4, levels: ['A1', 'A2', 'B1'],
    blurb: 'A question, a partner, three messages each. Then a new question!',
    how: ['Read the question.', 'Chat about it with your partner.', 'Write 3 messages to win a star.'],
    example: ['What do you do after school?', 'I play football. What about you?', 'I go home and play video games.'],
    create(ctx) {
        const s: Speed = { ...base(), q: '', seen: [], count: {}, said: {}, n: 0, of: 4, goal: ctx.opts.level === 'A1' ? 2 : 3, deck: '', emoji: '', since: ctx.now };
        next(s, ctx);
        return s;
    },
    chat(s, _ctx, from, text) {
        if (s.over || wordCount(text) < 2) return {};
        const key = answerKey(text);
        const said = s.said[from] ??= [];
        if (said.includes(key)) return {};
        said.push(key);
        const count = s.count[from] = (s.count[from] ?? 0) + 1;
        if (count === s.goal) { star(s, from); return { fx: [{ to: from, kind: 'star' }] }; }
        return {};
    },
    act(s, ctx, _from, act) {
        if (act !== 'next' || s.over) return {};
        if (!everyoneTalked(s, ctx) && ctx.now - s.since < SKIP_MS) return {};
        if (!ctx.opts.endless && s.n >= s.of) { s.over = true; return { say: [{ text: 'That was the last question. Great chatting!', tone: 'good' }] }; }
        next(s, ctx);
        return { say: [{ text: `New question: ${s.q}` }] };
    },
    tick: () => ({}),
    join: () => ({}),
    leave: () => ({}),
    view(s, ctx, me) {
        const mine = s.count[me] ?? 0;
        const everyone = everyoneTalked(s, ctx);
        return {
            now: s.over ? { tone: 'done', text: 'Great chatting!' }
                : mine < s.goal ? { tone: 'go', text: `Chat with ${othersNames(ctx, me)} about the question.`, sub: `Write ${s.goal} messages to win a star: ${'●'.repeat(mine)}${'○'.repeat(s.goal - mine)}` }
                    : { tone: 'go', text: everyone ? 'Great! Take a new question.' : `Star won! Keep talking with ${othersNames(ctx, me)}.`, sub: 'Ask a question to keep the chat going.' },
            starters: KEEP_TALKING[ctx.opts.level],
            actions: s.over ? [] : everyone ? [{ act: 'next', label: 'New question 🔄' }] : ctx.now - s.since >= SKIP_MS ? [{ act: 'next', label: 'Too difficult? New question 🔄', ghost: true }] : [],
            chat: {},
            board: [{ w: 'card', emoji: s.emoji, label: s.deck, title: s.q }],
            seats: seats(s, ctx, null, Object.fromEntries(ctx.players.map(player => [player.key, `${Math.min(s.count[player.key] ?? 0, s.goal)}/${s.goal}`]))),
            round: ctx.opts.endless ? undefined : { n: s.n, of: s.of },
            over: s.over ? finish(s, ctx) : null,
        };
    },
    status: s => `Question ${s.n}: ${s.q}`,
};

function next(s: Speed, ctx: Ctx): void {
    const deck = questionsFor(ctx.opts.topic, ctx.opts.level, ctx.opts.custom);
    s.q = deal(deck.questions, s.seen, question => question, ctx.rnd);
    s.deck = deck.title; s.emoji = deck.emoji;
    s.count = {}; s.said = {};
    s.n += 1; s.since = ctx.now;
}

// ---------- Question Ping-Pong ----------
// The ball moves each time its holder asks a question. Answer, then ask: how long can the rally go?

type Ping = Base & { topic: string; emoji: string; ask: string[]; holder: string; hits: number; best: number; goal: number; asked: string[]; wins: number; drops: number };
const SERVE_MS = 60_000;
const HIT_MS = 45_000;

export const pingpong: Game<Ping> = {
    id: 'pingpong', kind: 'warmup', title: 'Question Ping-Pong', icon: '🏓', min: 2, max: 3, ideal: 2, minutes: 4, levels: ['A1', 'A2', 'B1'],
    blurb: 'Answer, then ask a new question. Every question hits the ball back!',
    how: ['You have the ball? Ask a question.', 'Your partner answers and asks you a question.', 'Don’t stop! Get 10 hits together.'],
    example: ['Do you like pizza?', 'Yes, I love it! What is your favourite food?', 'I like pasta. Can you cook?'],
    create(ctx) {
        const topic = topicFor(ctx);
        return { ...base(), topic: topic.title, emoji: topic.emoji, ask: topic.ask, holder: ctx.players[0].key, hits: 0, best: 0, goal: ctx.opts.level === 'A1' ? 8 : 10, asked: [], wins: 0, drops: 0, due: ctx.now + SERVE_MS };
    },
    chat(s, ctx, from, text) {
        if (s.over || from !== s.holder) return {};
        if (!isQuestion(text, 3)) return {};
        const key = answerKey(text.replace(/[^?]*[.!]\s*/g, '')) || answerKey(text);
        if (s.asked.includes(key)) return { say: [{ to: from, text: 'You asked that already. Ask a NEW question!', tone: 'bad' }] };
        s.asked.push(key);
        s.hits += 1; s.best = Math.max(s.best, s.hits);
        star(s, from);
        s.holder = after(ctx, from);
        s.due = ctx.now + HIT_MS;
        if (s.hits < s.goal) return { fx: [{ to: s.holder, kind: 'turn' }] };
        // The rally reached its goal: a bonus for everyone, and a new topic.
        for (const player of ctx.players) star(s, player.key, 2);
        s.wins += 1;
        if (!ctx.opts.endless) { s.over = true; s.due = null; return { say: [{ text: `🏆 ${s.goal} hits! What a rally!`, tone: 'good' }], fx: [{ kind: 'win' }] }; }
        const topic = topicFor({ ...ctx, opts: { ...ctx.opts, topic: 'mix' } });
        Object.assign(s, { topic: topic.title, emoji: topic.emoji, ask: topic.ask, hits: 0, asked: [] });
        s.due = ctx.now + SERVE_MS;
        return { say: [{ text: `🏆 ${s.goal} hits! New topic: ${topic.title}. Can you do it again?`, tone: 'good' }], fx: [{ kind: 'win' }] };
    },
    act: () => ({}),
    tick(s, ctx) {
        if (s.over) return {};
        const dropped = s.hits > 0;
        s.hits = 0; s.asked = []; s.drops += 1;
        // Outside a class round the game also ends after a few dropped balls, so no table is left waiting for ever.
        if (!ctx.opts.endless && s.drops >= 4) { s.over = true; s.due = null; return { say: [{ text: `The game is over. Your best rally: ${s.best} hits!` }] }; }
        s.due = ctx.now + SERVE_MS;
        return dropped ? { say: [{ text: `⏰ Too slow: the ball dropped! ${nameOf(ctx, s.holder)} serves again.`, tone: 'bad' }], fx: [{ kind: 'bad' }] } : {};
    },
    join: () => ({}),
    leave(s, ctx) { if (!has(ctx, s.holder)) s.holder = ctx.players[0]?.key ?? ''; return {}; },
    view(s, ctx, me) {
        const mine = s.holder === me;
        const holder = nameOf(ctx, s.holder);
        return {
            now: s.over ? { tone: 'done', text: s.wins ? `🏆 ${s.goal} hits! Great rally!` : `Best rally: ${s.best} hits. Good game!` }
                : mine ? (s.hits === 0
                    ? { tone: 'go', text: `🏓 You serve! Ask ${nameOf(ctx, after(ctx, me))} a question about ${s.topic}.`, sub: 'Your message needs a question mark: ?' }
                    : { tone: 'go', text: '🏓 Your ball! Answer, then ask a new question.', sub: 'The ball goes back when you ask a question (?).' })
                    : { tone: 'wait', text: `${holder} has the ball…`, sub: `Read ${holder}'s question and get ready to answer.` },
            starters: mine ? s.ask : KEEP_TALKING[ctx.opts.level].slice(0, 3),
            chat: { hint: mine ? 'Answer, then ask a question?' : undefined },
            board: [
                { w: 'card', emoji: s.emoji, label: 'Ask about', title: s.topic },
                { w: 'rally', hits: s.hits, goal: s.goal, best: s.best, holder: s.holder, order: ctx.players.map(player => player.key) },
            ],
            timer: timer(s, s.hits === 0 ? SERVE_MS : HIT_MS),
            seats: seats(s, ctx, s.holder),
            over: s.over ? finish(s, ctx, 'What a rally!') : null,
        };
    },
    status: (s, ctx) => `Rally ${s.hits}/${s.goal} (best ${s.best}); ${nameOf(ctx, s.holder)} has the ball`,
};

// ---------- Hot Potato ----------
// Ask a question to pass the potato. Nobody knows when it goes off.

type Potato = Base & { holder: string; lives: Record<string, number>; topic: string; emoji: string; ask: string[]; asked: string[]; booms: number; of: number; phase: 'play' | 'boom'; lost: string | null };
const fuse = (ctx: Ctx) => ctx.now + 35_000 + Math.floor(ctx.rnd() * 30_000);

export const hotpotato: Game<Potato> = {
    id: 'hotpotato', kind: 'warmup', title: 'Hot Potato', icon: '🥔', min: 2, max: 4, ideal: 3, minutes: 5, levels: ['A1', 'A2', 'B1'],
    blurb: 'Ask a question to pass the potato, before it goes BOOM!',
    how: ['You have the potato? Ask a question, fast!', 'The potato goes to the next player.', 'BOOM! Don’t hold it when it explodes.'],
    example: ['What is your favourite food?', 'Pizza! Do you like fish?', 'No, I don’t. Can you cook?'],
    create(ctx) {
        const topic = topicFor(ctx);
        return { ...base(), holder: pick(ctx.players, ctx.rnd).key, lives: Object.fromEntries(ctx.players.map(player => [player.key, 3])),
            topic: topic.title, emoji: topic.emoji, ask: topic.ask, asked: [], booms: 0, of: 5, phase: 'play', lost: null, due: fuse(ctx) };
    },
    chat(s, ctx, from, text) {
        if (s.over || s.phase !== 'play' || from !== s.holder || !isQuestion(text, 3)) return {};
        const key = answerKey(text.replace(/[^?]*[.!]\s*/g, '')) || answerKey(text);
        if (s.asked.includes(key)) return { say: [{ to: from, text: 'That question was asked already. Ask a NEW one, quick!', tone: 'bad' }] };
        s.asked.push(key);
        star(s, from);
        s.holder = after(ctx, from);
        return { fx: [{ to: s.holder, kind: 'turn' }] };
    },
    act: () => ({}),
    tick(s, ctx) {
        if (s.over) return {};
        if (s.phase === 'boom') {
            // The next round: a new topic, and whoever was caught starts.
            const topic = topicFor({ ...ctx, opts: { ...ctx.opts, topic: ctx.opts.topic === 'custom' ? 'custom' : 'mix' } });
            Object.assign(s, { topic: topic.title, emoji: topic.emoji, ask: topic.ask, asked: [], phase: 'play', lost: null });
            s.due = fuse(ctx);
            return { say: [{ text: `New round! Ask about: ${s.topic}. ${nameOf(ctx, s.holder)} starts.` }] };
        }
        s.lives[s.holder] = Math.max(0, (s.lives[s.holder] ?? 3) - 1);
        s.booms += 1; s.lost = s.holder; s.phase = 'boom';
        const out = { say: [{ text: `💥 BOOM! ${nameOf(ctx, s.holder)} had the potato.`, tone: 'bad' as const }], fx: [{ kind: 'boom' as const }] };
        if (!ctx.opts.endless && (s.booms >= s.of || s.lives[s.holder] === 0)) {
            const most = Math.max(...ctx.players.map(player => s.lives[player.key] ?? 0));
            for (const player of ctx.players) if ((s.lives[player.key] ?? 0) === most) star(s, player.key, 2);
            s.over = true; s.due = null;
            return out;
        }
        if (ctx.opts.endless && s.lives[s.holder] === 0) s.lives[s.holder] = 3; // nobody is ever out in a class round
        s.due = ctx.now + 4000;
        return out;
    },
    join(s, _ctx, key) { s.lives[key] = 3; return {}; },
    leave(s, ctx) { if (!has(ctx, s.holder)) s.holder = ctx.players[0]?.key ?? ''; return {}; },
    view(s, ctx, me) {
        const mine = s.holder === me;
        const holder = nameOf(ctx, s.holder);
        const nextName = nameOf(ctx, after(ctx, s.holder));
        return {
            now: s.over ? { tone: 'done', text: 'The potato is gone. Good game!' }
                : s.phase === 'boom' ? { tone: 'wait', text: `💥 BOOM! ${s.lost === me ? 'You' : nameOf(ctx, s.lost ?? '')} lost a heart.`, sub: 'Next round in a moment…' }
                    : mine ? { tone: 'go', text: `🥔 You have the potato! Ask ${nextName} a question, quick!`, sub: `Ask about ${s.topic}. Your question needs a ?` }
                        : { tone: 'wait', text: `${holder} has the potato…`, sub: after(ctx, s.holder) === me ? 'You are next! Answer, then ask a question.' : 'Read and get ready.' },
            starters: mine ? s.ask : ['Yes, I do.', 'No, I don’t.', 'I think …'],
            chat: { hint: mine ? 'Ask a question to pass the potato?' : undefined },
            board: [
                { w: 'card', emoji: s.emoji, label: 'Ask about', title: s.topic },
                { w: 'bomb', holder: s.holder, lives: s.lives, boom: s.phase === 'boom' },
            ],
            seats: seats(s, ctx, s.holder),
            round: ctx.opts.endless ? undefined : { n: Math.min(s.booms + 1, s.of), of: s.of },
            over: s.over ? finish(s, ctx, 'Good game!') : null,
        };
    },
    status: (s, ctx) => `${nameOf(ctx, s.holder)} has the potato (${s.booms} booms)`,
};
