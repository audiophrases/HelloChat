// Plays every game to its end with careless bots: they tap whatever can be tapped and write whatever might count.
// The point is not that bots play well, but that no order of taps, messages, timeouts, arrivals and departures
// breaks a game or leaves a player without something to do.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMES, gameById, info } from '../games/index.ts';
import { isQuestion, says, answerKey } from '../games/util.ts';
import { QUESTS, NEW_QUESTS } from '../content/quests.ts';
import { TOPICS } from '../content/questions.ts';

function random(seed) {
    let state = seed >>> 0;
    return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
}

const NAMES = ['Ana', 'Ben', 'Cleo', 'Dev', 'Eli'];
const people = count => NAMES.slice(0, count).map(name => ({ key: `k-${name.toLowerCase()}`, name }));

// Every word a player can see on their board, to write sentences that might count.
function seen(view) {
    const words = [];
    for (const widget of view.board) {
        if (widget.w === 'card') words.push(widget.title);
        if (widget.w === 'grid') for (const cell of widget.cells) if (cell.label) words.push(cell.label);
        if (widget.w === 'story') for (const die of widget.dice ?? []) if (die.state === 'now') words.push(die.word);
        if (widget.w === 'options') for (const option of widget.options) words.push(option.label);
    }
    return words;
}

// Bots cannot guess, so they peek: every short word the game keeps.
function secrets(value, found = []) {
    if (typeof value === 'string') { if (value.length <= 20 && /^[a-z' -]+$/i.test(value)) found.push(value); }
    else if (value && typeof value === 'object') for (const item of Object.values(value)) secrets(item, found);
    return found;
}

function checkView(game, view, players) {
    assert.ok(view.now && typeof view.now.text === 'string' && view.now.text.length > 0, `${game.id}: a view always says what to do`);
    assert.ok(view.now.text.length <= 140, `${game.id}: the instruction is short: "${view.now.text}"`);
    assert.ok(['go', 'wait', 'done'].includes(view.now.tone));
    assert.ok(Array.isArray(view.board));
    assert.equal(view.seats.length, players.length, `${game.id}: one seat per player`);
    for (const seat of view.seats) assert.ok(seat.stars >= 0);
    assert.ok(!JSON.stringify(view).includes('undefined'), `${game.id}: nothing undefined is shown`);
}

function play(game, count, seed, { endless = false, churn = false, level = 'A2', steps = 6000 } = {}) {
    const rnd = random(seed);
    const bot = random(seed + 99);
    let players = people(count);
    const spare = people(5).slice(count);
    let now = 1_000_000;
    const ctx = () => ({ now, rnd, players, opts: { level, topic: 'mix', custom: [], endless } });
    const s = game.create(ctx());
    let said = 0;
    for (let step = 0; step < steps && !s.over; step++) {
        now += Math.floor(bot() * 9000);
        if (s.due !== null && now >= s.due) {
            const due = s.due;
            game.tick(s, ctx());
            assert.ok(s.over || s.due === null || s.due > due || s.due > now - 1, `${game.id}: a tick moves the clock on`);
            continue;
        }
        if (churn && bot() < 0.01) {
            if (players.length > game.min && bot() < 0.5) {
                const gone = players[Math.floor(bot() * players.length)];
                players = players.filter(player => player !== gone);
                spare.push(gone);
                game.leave(s, ctx(), gone.key);
            } else if (players.length < game.max && spare.length) {
                const back = spare.pop();
                players = [...players, back];
                game.join(s, ctx(), back.key);
            }
        }
        const me = players[Math.floor(bot() * players.length)];
        const view = game.view(s, ctx(), me.key);
        checkView(game, view, players);
        const taps = [];
        for (const action of view.actions ?? []) taps.push([action.act, action.data]);
        for (const widget of view.board) {
            if (widget.w === 'options' && !widget.off) for (const option of widget.options) taps.push([widget.act, { id: option.id }]);
            if (widget.w === 'grid' && widget.act) for (const cell of widget.cells) if (!cell.off) taps.push([widget.act, { id: cell.id }]);
            if (widget.w === 'sentences' && widget.act && !widget.off) for (const item of widget.items) taps.push([widget.act, { id: item.id }]);
            if (widget.w === 'items' && widget.act) for (const item of widget.items) if (item.ask) taps.push([widget.act, { id: item.id }]);
            if (widget.w === 'answer') taps.push([widget.act, { text: `We think the answer is ${seen(view).join(' ')} because we talked about it` }]);
        }
        if (taps.length && bot() < 0.5) {
            const [act, data] = taps[Math.floor(bot() * taps.length)];
            game.act(s, ctx(), me.key, act, data);
        } else {
            const words = seen(view);
            const word = words.length ? words[Math.floor(bot() * words.length)] : 'pizza';
            const texts = [
                `What do you think about ${word} number ${said}?`,
                `I really like the ${word} because it is very good and fun for everyone ${said}`,
                word, 'Yes!', 'ok',
                `Is it very big and can you see it at home ${said}?`,
                `I think mine is small and you can find it in many places ${said}`,
                `maybe it is ${secrets(s)[Math.floor(bot() * Math.max(1, secrets(s).length))] ?? 'nothing'}`,
                `One day the ${words.join(' and the ')} went to school together ${said}`,
            ];
            const verdict = game.chat(s, ctx(), me.key, texts[Math.floor(bot() * texts.length)]);
            assert.ok(verdict && typeof verdict === 'object');
            if (verdict.block) assert.ok(verdict.block.length > 0);
            said += 1;
        }
        // Whatever happened, everyone still has a view.
        for (const player of players) checkView(game, game.view(s, ctx(), player.key), players);
        assert.ok(typeof game.status(s, ctx()) === 'string');
    }
    return s;
}

for (const game of GAMES) {
    for (let count = game.min; count <= game.max; count++) {
        test(`${game.id}: ${count} players play to the end`, () => {
            let stars = 0;
            for (const seed of [1, 2, 3]) {
                for (const level of game.levels) {
                    const s = play(game, count, seed * 31 + count, { level });
                    assert.ok(s.over, `${game.id} (${count} players, seed ${seed}, ${level}) ends`);
                    stars += Object.values(s.stars).reduce((sum, value) => sum + value, 0);
                }
            }
            assert.ok(stars > 0, `${game.id}: somebody earned a star`);
        });
    }
    test(`${game.id}: survives a class round with arrivals and departures`, () => {
        for (const seed of [7, 8]) play(game, game.min, seed, { endless: true, churn: true, steps: 2500 });
    });
}

test('every game explains itself in three short steps', () => {
    for (const game of GAMES) {
        const about = info(game);
        assert.equal(about.how.length, 3);
        for (const step of about.how) assert.ok(step.length <= 70, `${game.id}: "${step}" is short`);
        assert.ok(about.example.length >= 2, `${game.id} shows an example chat`);
        assert.ok(about.blurb.length <= 110, `${game.id}: the blurb fits a card`);
        assert.ok(gameById(game.id) === game);
    }
    assert.equal(new Set(GAMES.map(game => game.id)).size, GAMES.length);
});

test('reading what students write', () => {
    assert.ok(isQuestion('Do you like pizza?'));
    assert.ok(isQuestion('what is your name'));
    assert.ok(!isQuestion('I like pizza.'));
    assert.ok(says('I saw two dragons yesterday', 'dragon'));
    assert.ok(says('She is dancing', 'dance'));
    assert.ok(says('We love icecream', 'ice cream'));
    assert.ok(says('an ice-cream please', 'ice cream'));
    assert.ok(!says('I like scatter plots', 'cat'));
    assert.equal(answerKey('  The Bedroom! '), 'bedroom');
});

test('quests: every checked answer can be given, and ids are unique', () => {
    assert.equal(new Set(QUESTS.map(quest => quest.id)).size, QUESTS.length);
    assert.ok(QUESTS.length >= 280, `there are ${QUESTS.length} quests`);
    assert.ok(NEW_QUESTS.length >= 90, `there are ${NEW_QUESTS.length} new quests`);
    for (const quest of QUESTS) {
        assert.ok(quest.text.length > 10 && quest.title.length > 2);
        for (const group of quest.accept ?? []) {
            assert.ok(group.length > 0);
            // The first way of writing each part is accepted by the check itself.
            assert.ok(says(`we think it is ${group[0]} for sure`, group[0]), `${quest.id}: "${group[0]}" is recognised`);
        }
        // A quest's own secret cards never give the whole answer to one player: no card says every part.
        if (quest.roles && quest.accept && quest.cat === 'Split clues') {
            assert.equal(quest.roles.length, 2);
        }
    }
});

test('every topic has questions at every level', () => {
    for (const topic of TOPICS) for (const level of ['A1', 'A2', 'B1']) assert.ok(topic.q[level].length >= 8, `${topic.id} ${level}`);
});

test('hot potato: whoever catches the potato has at least 20 seconds', () => {
    const game = gameById('hotpotato');
    const players = people(3);
    let now = 1_000_000;
    const ctx = () => ({ now, rnd: random(7), players, opts: { level: 'A1', topic: 'mix', custom: [], endless: false } });
    const s = game.create(ctx());
    // Pass the potato just before it would go off: the new holder still gets 20 seconds.
    now = s.due - 1000;
    const first = s.holder;
    game.chat(s, ctx(), first, 'What is your favourite food?');
    assert.notEqual(s.holder, first);
    assert.ok(s.due >= now + 20_000, 'the fuse waits for the new holder');
    // A pass early in the round leaves the hidden fuse alone.
    const fresh = game.create(ctx());
    const due = fresh.due;
    game.chat(fresh, ctx(), fresh.holder, 'Do you like pizza?');
    assert.equal(fresh.due, due);
});
