// A whole lesson against the real Worker under `wrangler dev`: a teacher and five made-up students who join with the
// PIN, choose games, chat, are grouped for a class activity, change partners and reconnect.
//
//   npm run test:live          (after a build; dist/ must exist)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const root = path.join(import.meta.dirname, '..');
const wrangler = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const port = Number(process.env.LIVE_PORT || 8799);
const origin = `http://127.0.0.1:${port}`;
const state = path.join(root, '.wrangler', `live-test-${Date.now()}`);
if (!fs.existsSync(path.join(root, 'dist'))) { fs.mkdirSync(path.join(root, 'dist')); fs.writeFileSync(path.join(root, 'dist', 'index.html'), '<!doctype html><title>HelloChat</title>'); }

const child = spawn(process.execPath, [wrangler, 'dev', '--port', String(port), '--ip', '127.0.0.1', '--persist-to', state, '--show-interactive-dev-session=false',
    '--var', 'TESTER_MODE:1', '--var', `CREATE_PASSWORD_HASH:${crypto.createHash('sha256').update('tester').digest('hex')}`,
    '--var', 'OPENAI_API_KEY:', '--var', 'PINPLAY_API_URL:'], { cwd: root, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
child.stdout.on('data', chunk => { log += chunk; });
child.stderr.on('data', chunk => { log += chunk; });
const stop = code => { child.kill(); try { fs.rmSync(state, { recursive: true, force: true }); } catch { /* still held */ } process.exit(code); };

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
    await teacher('remove', { line: mine.id });
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

    status = await teacher('class', { open: false });
    assert.equal(status.open, false);
    await ana.until(() => ana.events.some(event => event.t === 'bye' && event.why === 'closed'), 'the class to close');
    await assert.rejects(api('/api/room/join', { pin: '123456' }, { 'x-student-token': 'tester:Ana' }), /not opened/);
    step('closing the class sends everyone out');
    console.log('\n  The live lesson passed.\n');
}

main().then(() => stop(0), error => { console.error(`\n  ✗ ${error.stack || error}\n`); if (process.env.LIVE_LOG) console.error(log.slice(-3000)); stop(1); });
