// A whole lesson against the real Worker under `wrangler dev`: a teacher and five made-up students who join with the
// PIN, choose games, chat, are grouped for a class activity, change partners and reconnect.
//
//   npm run test:live          (after a build; dist/ must exist)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

// Deterministic local AI responses: these checks never spend a real API key.
let hintCalls = 0;
let allowParticipation = false;
let hintFails = false;
const ai = createServer(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    response.setHeader('content-type', 'application/json');
    if (request.url === '/v1/moderations') response.end(JSON.stringify({ results: [{ flagged: false, categories: {} }] }));
    else if (request.url === '/v1/decisions') response.end(JSON.stringify({ answers: [{ name: 'useful_participation', type: 'predicate', probability: allowParticipation ? .99 : 0 }] }));
    else if (request.url === '/v1/chat/completions') {
        hintCalls++;
        if (hintFails) { response.statusCode = 503; response.end('{}'); }
        else response.end(JSON.stringify({ choices: [{ message: { content: body.messages?.[0]?.content.startsWith('Help an English learner') ? 'Try: I think ... because ...' : '{"ok":true}' } }] }));
    } else { response.statusCode = 404; response.end('{}'); }
});
await new Promise(resolve => ai.listen(0, '127.0.0.1', resolve));
const aiOrigin = `http://127.0.0.1:${ai.address().port}`;

const root = path.join(import.meta.dirname, '..');
const wrangler = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const port = Number(process.env.LIVE_PORT || 8799);
const origin = `http://127.0.0.1:${port}`;
const state = path.join(root, '.wrangler', `live-test-${Date.now()}`);
if (!fs.existsSync(path.join(root, 'dist'))) { fs.mkdirSync(path.join(root, 'dist')); fs.writeFileSync(path.join(root, 'dist', 'index.html'), '<!doctype html><title>HelloChat</title>'); }

const child = spawn(process.execPath, [wrangler, 'dev', '--port', String(port), '--ip', '127.0.0.1', '--persist-to', state, '--show-interactive-dev-session=false',
    '--var', 'TESTER_MODE:1', '--var', `CREATE_PASSWORD_HASH:${crypto.createHash('sha256').update('tester').digest('hex')}`,
    '--var', 'OPENAI_API_KEY:local-test-key', '--var', `OPENAI_BASE_URL:${aiOrigin}`, '--var', 'PINPLAY_API_URL:'], { cwd: root, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
child.stdout.on('data', chunk => { log += chunk; });
child.stderr.on('data', chunk => { log += chunk; });
const stop = code => { child.kill(); ai.close(); try { fs.rmSync(state, { recursive: true, force: true }); } catch { /* still held */ } process.exit(code); };

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let teacherToken = '';
async function api(url, body, headers = {}) {
    const response = await fetch(origin + url, body === undefined ? { headers } : { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(`${url}: ${result.error || response.status}`), { status: response.status });
    return result;
}
const teacher = (url, body) => api(`/api/teacher/${url}`, body, { 'x-teacher-session': teacherToken });

class Student {
    constructor(name) { this.name = name; this.token = `tester:${name}`; this.events = []; this.table = null; this.lounge = null; this.lines = []; this.me = null; }
    async join(pin) {
        const { ticket } = await api('/api/room/join', { pin, avatar: { skin: 1, hairColor: 2, hair: 3, eyes: 4, mouth: 5, glasses: 0, shirt: 6, hat: 0 } }, { 'x-student-token': this.token });
        this.ws = new WebSocket(`${origin.replace('http', 'ws')}/api/room/ws?ticket=${ticket}`);
        this.closed = null;
        this.ws.onclose = event => { this.closed = event.code || -1; };
        this.ws.onmessage = event => {
            if (event.data === 'pong') return;
            const message = JSON.parse(event.data);
            this.events.push(message);
            if (message.t === 'welcome') this.me = message.me;
            if (message.t === 'table') { this.table = message.table; this.lines = message.table?.lines ?? []; if (message.table) this.lounge = null; }
            if (message.t === 'lounge') this.lounge = message.lounge;
            if (message.t === 'view' && this.table?.id === message.id) this.table.view = message.view;
            if (message.t === 'members' && this.table?.id === message.id) this.table.members = message.members;
            if (message.t === 'line') this.lines.push(message.line);
            if (message.t === 'sent' && message.line) this.lines.push(message.line);
        };
        await new Promise((resolve, reject) => { this.ws.onopen = resolve; this.ws.onerror = reject; });
        await this.until(() => this.me, 'a welcome');
    }
    send(message) { this.ws.send(JSON.stringify(message)); }
    say(text) { const cid = crypto.randomUUID(); this.send({ t: 'chat', text, cid }); return this.until(() => this.events.find(event => (event.t === 'sent' || event.t === 'refused') && event.cid === cid), `an answer to "${text}"`); }
    async until(check, what, ms = 8000) {
        const end = Date.now() + ms;
        while (Date.now() < end) { const value = check(); if (value) return value; await sleep(25); }
        throw new Error(`${this.name} waited for ${what}. Table: ${JSON.stringify(this.table?.view?.now)}; lounge: ${JSON.stringify(this.lounge?.queued)}`);
    }
}

async function main() {
    for (let attempt = 0; ; attempt++) {
        try { if ((await fetch(`${origin}/api/health`)).ok) break; } catch { /* still starting */ }
        if (attempt > 120) throw new Error(`The server did not start.\n${log}`);
        await sleep(500);
    }
    const step = text => console.log(`  ✓ ${text}`);

    await assert.rejects(api('/api/teacher/login', { password: 'wrong' }), /Wrong password/);
    ({ token: teacherToken } = await api('/api/teacher/login', { password: 'tester' }));
    let status = await teacher('status');
    assert.equal(status.open, false);
    await assert.rejects(api('/api/room/join', { pin: '123456' }, { 'x-student-token': 'tester:Ana' }), /not opened/);
    status = await teacher('class', { open: true });
    assert.match(status.pin, /^\d{6}$/);
    assert.ok(status.games.length >= 20 && status.topics.length > 10);
    await assert.rejects(api('/api/room/join', { pin: '000000' }, { 'x-student-token': 'tester:Ana' }), /PIN/);
    await assert.rejects(api('/api/room/join', { pin: status.pin }, { 'x-student-token': 'nobody' }), /sign.in|unavailable/i);
    step('the teacher opens the class; a wrong PIN and a stranger are refused');

    const [ana, ben, cleo, dev, eli] = ['Ana', 'Ben', 'Cleo', 'Dev', 'Eli'].map(name => new Student(name));
    await ana.join(status.pin); await ben.join(status.pin);
    await ana.until(() => ana.lounge?.free && ana.lounge.games.length >= 20, 'the lounge with games');
    assert.equal(ana.me.name, 'Ana');
    step('students arrive in the lounge and see the games');

    // Free play: two students choose the same game and are seated together.
    ana.send({ t: 'queue', game: 'wyr' });
    await ben.until(() => ben.lounge?.waiting.wyr?.includes('Ana'), 'Ana waiting for Would You Rather');
    ben.send({ t: 'queue', game: 'wyr' });
    await ana.until(() => ana.table?.game.id === 'wyr', 'a table', 12000);
    await ben.until(() => ben.table?.game.id === 'wyr', 'a table');
    assert.equal(ana.table.members.length, 2);
    assert.equal(ana.table.view.now.tone, 'go');
    step('free play: two students who pick the same game get a table');

    ana.send({ t: 'act', act: 'pick', data: { id: '0' } });
    await ana.until(() => ana.table.view.now.tone === 'wait', 'waiting for Ben');
    ben.send({ t: 'act', act: 'pick', data: { id: '1' } });
    await ana.until(() => /WHY/.test(ana.table.view.now.text), 'the reason step');
    const sent = await ana.say('I chose this one because it is more fun');
    assert.equal(sent.t, 'sent');
    await ben.until(() => ben.lines.some(line => line.text.includes('more fun') && line.name === 'Ana'), "Ana's message");
    await ana.until(() => ana.table.view.seats.find(seat => seat.key === ana.me.key).stars === 2, 'two stars for a reason with because');
    await ana.until(() => ana.events.some(event => event.t === 'xp' && event.gained === 2), 'experience for the stars');
    step('choosing, chatting and stars work; stars become experience at once');

    const rude = await ben.say('you are stupid');
    assert.equal(rude.t, 'refused');
    assert.ok(!ana.lines.some(line => line.text.includes('stupid')));
    await sleep(750);
    const tooFast = [ben.say('This is my first message now'), ben.say('This is my second message now')];
    assert.ok((await Promise.all(tooFast)).some(result => result.t === 'refused'), 'two messages at once: one waits');
    step('unkind messages and floods are stopped');

    // The teacher looks in, talks to the table and removes a message.
    status = await teacher('status');
    assert.equal(status.tables.length, 1);
    assert.equal(status.tables[0].members.length, 2);
    assert.ok(status.students.find(student => student.name === 'Ana').messages >= 1);
    assert.ok(status.students.find(student => student.name === 'Ben').blocked >= 1);
    await teacher('say', { to: 'table', id: status.tables[0].id, text: 'Great reasons, you two!' });
    await ana.until(() => ana.lines.some(line => line.from === 'teacher'), "the teacher's line");
    const transcript = await teacher(`transcript?id=${status.tables[0].id}`);
    const mine = transcript.lines.find(line => line.text.includes('more fun'));
    assert.ok(transcript.lines.some(line => line.status === 'blocked'));
    const xpBeforeStar = status.students.find(student => student.key === ana.me.key).xp;
    await teacher('chat-star', { id: mine.id });
    const starred = await teacher('chat-star', { id: mine.id });
    assert.equal(starred.students.find(student => student.key === ana.me.key).xp, xpBeforeStar + 5);
    assert.equal((await teacher(`transcript?id=${status.tables[0].id}`)).lines.find(line => line.id === mine.id).starred, true);
    ben.send({ t: 'played', id: mine.id });
    await sleep(100);
    assert.equal((await teacher('heard?q=more%20fun')).plays[0]?.key, ben.me.key);
    ana.send({ t: 'tab', hidden: true }); ana.send({ t: 'tab', hidden: true });
    await sleep(100);
    const awayAna = (await teacher('status')).students.find(student => student.key === ana.me.key);
    assert.equal(awayAna.tabSwitches, 1);
    assert.equal(awayAna.away, true, 'the teacher sees Ana away right now');
    assert.ok(awayAna.awaySince > 0);
    await ana.until(() => ana.events.some(event => event.t === 'tabs' && event.count === 1), 'her own count of leaving the page');
    ana.send({ t: 'tab', hidden: false });
    await sleep(100);
    const backAna = (await teacher('status')).students.find(student => student.key === ana.me.key);
    assert.equal(backAna.away, false); assert.equal(backAna.awaySince, null); assert.equal(backAna.tabSwitches, 1);
    ana.send({ t: 'attempt', text: 'draftonlyword', reason: 'English check' });
    await sleep(100);
    assert.equal((await teacher(`history?key=${ana.me.key}&q=draftonlyword`)).lines[0]?.status, 'draft');
    await assert.rejects(api('/api/teacher/history'), error => error.status === 401);
    await teacher('say', { to: 'student', id: ana.me.key, text: 'A private check in' });
    await ana.until(() => ana.events.some(event => event.t === 'private' && event.lines.some(line => line.text === 'A private check in')), 'a private teacher message');
    assert.ok(!ben.events.some(event => event.t === 'private' && event.lines.some(line => line.text === 'A private check in')));
    ana.send({ t: 'private', text: 'Thank you for helping me', cid: 'private-one' });
    await ana.until(() => ana.events.some(event => event.t === 'sent' && event.cid === 'private-one'), 'private reply');
    assert.equal((await teacher(`private?key=${ana.me.key}`)).lines.at(-1).from, 'student');
    assert.ok((await teacher(`history?key=${ana.me.key}&q=helping`)).lines.some(line => line.status === 'private'));
    assert.equal((await teacher(`history?key=${ben.me.key}&q=helping`)).lines.length, 0);
    await teacher('words', { words: ['more fun', 'andrei'] });
    await sleep(750);
    assert.equal((await ben.say('fr33 4ndr3i')).t, 'refused');
    assert.equal((await teacher('status')).blocked.words.find(term => term.words === 'more fun').removed, 1);
    assert.ok((await teacher('status')).blocked.words.find(term => term.words === 'andrei').stopped >= 1);
    await teacher('unblock', { key: 'more fun' });
    step('chat stars award once; playback, tab switches, drafts, private replies and disguised lesson words work');
    // The lesson word filter already removed this line.
    await ben.until(() => ben.events.some(event => event.t === 'retract' && event.line === mine.id), 'the message taken down');
    await teacher('mute', { key: ana.me.key, on: true });
    assert.equal((await ana.say('Can anybody read this message')).t, 'refused');
    await teacher('mute', { key: ana.me.key, on: false });
    step('the teacher sees the table, writes to it, removes a message and pauses a student');

    // A class activity: everyone is seated, rounds change partners.
    await cleo.join(status.pin); await dev.join(status.pin); await eli.join(status.pin);
    status = await teacher('start', { game: 'speedchat', level: 'A1', size: 2, rounds: 2, minutes: 5, topic: 'food' });
    assert.equal(status.session.rounds, 2);
    const all = [ana, ben, cleo, dev, eli];
    for (const student of all) await student.until(() => student.table?.game.id === 'speedchat' && student.table.session?.round === 1, 'a Speed Chat table');
    const sizes = [...new Set(all.map(student => student.table.id))].map(id => all.filter(student => student.table.id === id).length).sort();
    assert.deepEqual(sizes, [2, 3]);
    assert.ok(all.every(student => student.table.view.board[0].title.length > 5));
    const partners = new Map(all.map(student => [student.name, student.table.members.map(member => member.name).filter(name => name !== student.name)]));
    await ana.say('I like pizza a lot');
    await sleep(750);
    await ana.say('What about you, do you like it?');
    await ana.until(() => ana.table.view.seats.find(seat => seat.key === ana.me.key).stars >= 1, 'a star for two messages at A1');
    status = await teacher('next', {});
    assert.equal(status.session.round, 2);
    for (const student of all) await student.until(() => student.table?.session?.round === 2, 'round 2');
    const pairs = all.filter(student => student.table.members.length === 2);
    assert.ok(pairs.some(student => !partners.get(student.name).includes(student.table.members.find(member => member.name !== student.name).name)), 'new partners');
    step('a class activity seats everyone (2 + 3) and a new round brings new partners');

    // A dropped connection keeps the seat; coming back restores the chat.
    await ben.say('I usually eat pasta on Sundays');
    const tableBefore = ben.table.id;
    ben.ws.close();
    await sleep(300);
    const again = new Student('Ben');
    await again.join(status.pin);
    await again.until(() => again.table?.id === tableBefore, 'the same table after reconnecting');
    assert.ok(again.table.lines.some(line => line.text.includes('pasta')));
    step('a student who reconnects is back at the same table with the chat');

    // A second window takes the seat over.
    const second = new Student('Cleo');
    await second.join(status.pin);
    await cleo.until(() => cleo.events.some(event => event.t === 'bye' && event.why === 'replaced'), 'the first window to be told');
    step('a second window replaces the first');

    status = await teacher('end', {});
    assert.equal(status.session, null);
    await ana.until(() => !ana.table && ana.lounge?.free, 'the lounge after the activity');

    // A board game with a quest answer, checked by the game.
    status = await teacher('start', { game: 'quest', level: 'A1', size: 2, rounds: 1, minutes: 0, topic: 'mix' });
    await ana.until(() => ana.table?.game.id === 'quest', 'a quest table');
    const mates = [ana, again, second, dev, eli].filter(student => student.table?.id === ana.table.id || (student === ana));
    await sleep(200);
    const options = ana.table.view.board.find(widget => widget.w === 'options').options;
    assert.equal(options.length, 3);
    ana.send({ t: 'act', act: 'pick', data: { id: options[0].id } });
    await ana.until(() => ana.table.view.board.some(widget => widget.w === 'card'), 'the quest card');
    step(`quests: a table of ${mates.length} picks one of three cards`);

    const report = await teacher('report?names=hide');
    assert.ok(report.prompt.includes('Student 1') && !report.prompt.includes('Ana:'));
    assert.ok(report.key.some(entry => entry.real.includes('Ana')));
    step('the class report hides names');

    ana.send({ t: 'languageHint', text: 'How can I start explaining my opinion?' });
    ana.send({ t: 'languageHint', text: 'How can I start explaining my opinion?' });
    await ana.until(() => ana.events.some(event => event.t === 'languageHint' && event.text.startsWith('Try:')), 'one language hint');
    assert.equal(hintCalls, 1);
    await sleep(2100);
    ana.send({ t: 'languageHint', text: 'Give me another useful phrase' });
    await sleep(200); assert.equal(hintCalls, 1, 'one hint per student per lesson');
    hintFails = true;
    dev.send({ t: 'languageHint', text: 'How can I describe a place?' });
    await dev.until(() => dev.events.some(event => event.t === 'languageHint' && !event.used), 'a failed hint preserves allowance');
    hintFails = false; await sleep(2100);
    dev.send({ t: 'languageHint', text: 'How can I describe a place?' });
    await dev.until(() => dev.events.some(event => event.t === 'languageHint' && event.text.startsWith('Try:')), 'a retry after service recovery');
    allowParticipation = true;
    await eli.say('Where would you like to travel during the summer?');
    await eli.until(() => eli.events.some(event => event.t === 'xp' && event.reason === 'Useful contribution' && event.gained === 1), 'AI participation XP');
    step('AI hints spend one persisted allowance, recover from outages, and useful participation earns XP');
    for (const student of [ana, dev, eli]) student.send({ t: 'attempt', text: 'purple revolution', reason: 'English check' });
    await sleep(150);
    const repetition = (await teacher('status')).blocked.repeats.find(item => item.words.includes('revolution'));
    assert.ok(repetition, 'repetition across students is offered for blocking');
    await teacher('allow-repeat', repetition);
    assert.ok(!(await teacher('status')).blocked.repeats.some(item => item.key === repetition.key));

    // Name and character edits survive authenticated reconnects.
    const editedLook = { ...ana.me.look, shirt: 2 };
    await teacher('student', { key: ana.me.key, name: 'Anita', look: editedLook });
    const renamed = new Student('Ana'); await renamed.join(status.pin);
    assert.equal(renamed.me.name, 'Anita'); assert.equal(renamed.me.look.shirt, 2);
    await renamed.until(() => renamed.events.some(event => event.t === 'controls' && event.hintUsed), 'hint allowance survives reconnect');
    await assert.rejects(teacher('classroom', { name: 'Other class' }), /Close the class/);
    const savedXp = (await teacher('status')).students.find(student => student.key === ana.me.key).xp;

    status = await teacher('class', { open: false });
    assert.equal(status.open, false);
    await renamed.until(() => renamed.events.some(event => event.t === 'bye' && event.why === 'closed'), 'the class to close');
    await assert.rejects(api('/api/room/join', { pin: '123456' }, { 'x-student-token': 'tester:Ana' }), /not opened/);
    step('closing the class sends everyone out');
    const mainPin = status.classes.find(item => item.id === 'main').pin;
    assert.match(mainPin, /^\d{6}$/);
    const other = await teacher('classroom', { name: '  Other   class ' });
    assert.equal(other.students.length, 0); assert.equal((await teacher('history')).lines.length, 0);
    const otherClass = other.classes.find(item => item.id === other.activeClass);
    assert.equal(otherClass.name, 'Other class', 'names are tidied');
    assert.match(otherClass.pin, /^\d{6}$/); assert.notEqual(otherClass.pin, mainPin, 'each class has its own PIN');
    const otherOpen = await teacher('class', { open: true });
    assert.equal(otherOpen.pin, otherClass.pin, 'a class opens with its own PIN');
    await assert.rejects(api('/api/room/join', { pin: mainPin }, { 'x-student-token': 'tester:Cleo' }), /PIN for My class, which is not open/);
    await teacher('class', { open: false });
    await assert.rejects(teacher('classroom-name', { id: 'main', name: '   ' }), /class name/);
    const renamedClass = await teacher('classroom-name', { id: 'main', name: '4ESOB' });
    assert.equal(renamedClass.classes.find(item => item.id === 'main').name, '4ESOB');
    assert.equal(renamedClass.classes.find(item => item.id === 'main').pin, mainPin, 'renaming keeps the PIN');
    const newPin = (await teacher('classroom-pin', { id: otherClass.id })).classes.find(item => item.id === otherClass.id).pin;
    assert.notEqual(newPin, otherClass.pin, 'a new PIN replaces the old one');
    const restored = await teacher('classroom', { id: 'main' });
    assert.equal(restored.students.find(student => student.key === ana.me.key).xp, savedXp);
    assert.equal(restored.students.find(student => student.key === ana.me.key).name, 'Anita');
    assert.ok((await teacher('history?q=draftonlyword')).lines.length);
    assert.equal((await teacher(`private?key=${ana.me.key}`)).lines.at(-1).text, 'Thank you for helping me');
    for (let i = 0; i < 105; i++) await teacher('say', { to: 'student', id: ana.me.key, text: `archive pagination ${i}` });
    const pageOne = await teacher('history?q=archive%20pagination');
    const pageTwo = await teacher(`history?q=archive%20pagination&before=${pageOne.next}`);
    assert.equal(pageOne.lines.length, 100); assert.equal(pageTwo.lines.length, 5); assert.equal(pageTwo.next, null);
    assert.equal(new Set([...pageOne.lines, ...pageTwo.lines].map(line => line.id)).size, 105);
    const reopened = await teacher('class', { open: true });
    assert.equal(reopened.pin, mainPin, 'the same PIN and link next lesson');
    await assert.rejects(api('/api/room/join', { pin: otherClass.pin }, { 'x-student-token': 'tester:Dev' }), /Check the class PIN/);
    assert.equal(reopened.blocked.words.length, 0);
    assert.ok(reopened.blocked.before.includes('andrei'));
    const newLesson = new Student('Ana'); await newLesson.join(reopened.pin);
    await newLesson.until(() => newLesson.events.some(event => event.t === 'controls' && !event.hintUsed), 'new lesson gets a new hint');
    await teacher('class', { open: false });
    step('saved classes isolate and restore progress, edits and histories; lesson word rules reset');
    step('each class keeps its PIN and link for good; classes can be renamed and given a new PIN');
    console.log('\n  The live lesson passed.\n');
}

main().then(() => stop(0), error => { console.error(`\n  ✗ ${error.stack || error}\n`); if (process.env.LIVE_LOG) console.error(log.slice(-3000)); stop(1); });
