// Plays a little of every game in real Chrome tabs and saves pictures of what students and the teacher see, under
// .wrangler/shots. A way to look at every screen after a change without gathering four people.
//
//   npm run build && node scripts/browser-check.mjs            (every game)
//   node scripts/browser-check.mjs trail spy                   (only these)
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const root = path.join(import.meta.dirname, '..');
const wrangler = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const port = 8797;
const origin = `http://127.0.0.1:${port}`;
const shots = path.join(root, '.wrangler', 'shots');
const state = path.join(root, '.wrangler', `browser-check-${Date.now()}`);
const chrome = process.env.CHROME_PATH ?? ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(file => fs.existsSync(file));
if (!chrome) throw new Error('Set CHROME_PATH to Chrome or Chromium.');
fs.rmSync(shots, { recursive: true, force: true });
fs.mkdirSync(shots, { recursive: true });
const only = process.argv.slice(2);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const server = spawn(process.execPath, [wrangler, 'dev', '--port', String(port), '--ip', '127.0.0.1', '--persist-to', state, '--show-interactive-dev-session=false',
    '--var', 'TESTER_MODE:1', '--var', `CREATE_PASSWORD_HASH:${crypto.createHash('sha256').update('tester').digest('hex')}`, '--var', 'OPENAI_API_KEY:', '--var', 'PINPLAY_API_URL:'],
    { cwd: root, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'ignore' });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hellochat-chrome-'));
const debugPort = 9337;
const browser = spawn(chrome, ['--headless=new', '--no-first-run', '--disable-default-apps', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--mute-audio', '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' });
const stop = code => { server.kill(); browser.kill(); setTimeout(() => { try { fs.rmSync(state, { recursive: true, force: true }); fs.rmSync(profile, { recursive: true, force: true }); } catch { /* held */ } process.exit(code); }, 500); };

class Tab {
    static async open(url, width = 1280, height = 800) {
        const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
        const tab = new Tab();
        tab.ws = new WebSocket(target.webSocketDebuggerUrl);
        tab.id = 0; tab.waiting = new Map(); tab.errors = [];
        await new Promise(resolve => { tab.ws.onopen = resolve; });
        tab.ws.onmessage = event => {
            const message = JSON.parse(event.data);
            if (message.id) { tab.waiting.get(message.id)?.(message); tab.waiting.delete(message.id); }
            if (message.method === 'Runtime.exceptionThrown') tab.errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
            if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') tab.errors.push(message.params.args.map(arg => arg.value ?? arg.description).join(' '));
        };
        await tab.cmd('Runtime.enable'); await tab.cmd('Page.enable');
        await tab.cmd('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
        await tab.cmd('Emulation.setFocusEmulationEnabled', { enabled: true });
        return tab;
    }
    cmd(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { const timer = setTimeout(() => { this.waiting.delete(id); reject(new Error(`Chrome timed out: ${method}`)); }, 20000); this.waiting.set(id, result => { clearTimeout(timer); resolve(result); }); this.ws.send(JSON.stringify({ id, method, params })); }); }
    async run(expression) {
        const result = await this.cmd('Runtime.evaluate', { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true });
        if (result.result?.exceptionDetails) throw new Error(result.result.exceptionDetails.exception?.description ?? 'page error');
        return result.result?.result?.value;
    }
    async until(expression, what, ms = 10000) {
        const end = Date.now() + ms;
        while (Date.now() < end) { if (await this.run(`return !!(${expression});`)) return; await sleep(150); }
        throw new Error(`Waited for ${what}. Page says: ${(await this.run('return document.body.innerText.slice(0, 400);'))?.replace(/\n+/g, ' | ')}`);
    }
    click(text) { return this.run(`const b = [...document.querySelectorAll('button')].find(b => !b.disabled && b.innerText.includes(${JSON.stringify(text)})); if (!b) return false; b.click(); return true;`); }
    async say(text) {
        await this.run(`const box = document.querySelector('.chat-box textarea'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(box, ${JSON.stringify(text)}); box.dispatchEvent(new Event('input', { bubbles: true }));`);
        await sleep(60);
        await this.run(`document.querySelector('.chat-send').click();`);
        await sleep(900);
    }
    async shot(name) {
        if (process.env.SKIP_SHOTS === '1') return;
        await sleep(350);
        const { result } = await this.cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        fs.writeFileSync(path.join(shots, `${name}.png`), Buffer.from(result.data, 'base64'));
    }
}

async function main() {
    for (let attempt = 0; ; attempt++) {
        try { if ((await fetch(`${origin}/api/health`)).ok) break; } catch { /* still starting */ }
        if (attempt > 120) throw new Error('The server did not start.');
        await sleep(500);
    }
    for (let attempt = 0; ; attempt++) {
        try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) break; } catch { /* still starting */ }
        if (attempt > 60) throw new Error('Chrome did not start.');
        await sleep(300);
    }
    const post = async (url, body, token) => (await fetch(origin + url, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { 'x-teacher-session': token } : {}) }, body: JSON.stringify(body) })).json();
    const { token } = await post('/api/teacher/login', { password: 'tester' });
    const teach = (url, body) => post(`/api/teacher/${url}`, body, token);

    const teacher = await Tab.open(`${origin}/teacher?autologin=tester`, 1440, 900);
    await teacher.until(`document.body.innerText.includes('Open class')`, 'the teacher page');
    await teacher.shot('01-teacher-closed');
    // Each class keeps its PIN and link; the teacher renames one in place.
    await teacher.run(`document.querySelector('.t-closed .t-class-name .link-btn').click();`);
    await teacher.until(`document.querySelector('.t-closed .t-class-rename input')`, 'the rename box');
    await teacher.run(`const box = document.querySelector('.t-closed .t-class-rename input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(box, '4ESOB'); box.dispatchEvent(new Event('input', { bubbles: true }));`);
    await teacher.run(`document.querySelector('.t-closed .t-class-rename .btn-primary').click();`);
    await teacher.until(`document.querySelector('.t-closed .t-class-name b')?.innerText === '4ESOB'`, 'the class renamed');
    await teacher.shot('01b-teacher-classes');
    const { pin } = await teach('class', { open: true });

    const names = ['Ana', 'Ben', 'Cleo', 'Dev'];
    const students = [];
    for (const name of names) students.push(await Tab.open(`${origin}/?tester=${name}&pin=${pin}`, name === 'Dev' ? 420 : 1280, name === 'Dev' ? 820 : 800));
    const [ana, ben, cleo, dev] = students;
    for (const student of students) await student.until(`document.body.innerText.includes('Choose a game')`, 'the lounge');
    await ana.shot('02-lounge');
    await dev.shot('02-lounge-phone');

    // Free play: Ana waits, Ben sees it and joins; the first time, the game explains itself.
    await ana.click('Would You Rather');
    await ben.until(`document.body.innerText.includes('is waiting')`, 'Ana waiting');
    await ben.shot('03-lounge-someone-waiting');
    await ben.click('Would You Rather');
    await ana.until(`document.body.innerText.includes('let’s play')`, 'the how-to card', 15000);
    await ana.shot('04-how-to-play');
    await ana.click('let’s play'); await ben.click('let’s play');
    await ana.shot('05-wyr-choose');
    await ana.run(`document.querySelector('.w-option').click();`);
    await ben.run(`document.querySelectorAll('.w-option')[1].click();`);
    await ana.until(`document.body.innerText.includes('WHY')`, 'the reason step');
    await ana.say('I chose this one becuase it is fun');
    await ana.shot('06-spelling-check');
    await ana.say('I chose this one because it is more fun');
    await ben.say('Really? I think the other one is better because it is fast');
    await ana.shot('07-wyr-talk');
    await teacher.until(`document.querySelector('.t-table')`, 'a table on the teacher page');
    await teacher.shot('08-teacher-free-play');

    // Leaving the page, as in Pixel Plaza. Headless tabs never really lose focus, so the page is told it did.
    await ana.run(`document.hasFocus = () => false; window.dispatchEvent(new Event('blur'));`);
    await ana.until(`document.querySelector('.away-card') && document.querySelector('.tab-badge')`, 'the "you left" card and badge');
    await ana.shot('07b-left-the-page');
    await teacher.until(`document.querySelector('.t-student.tab-away .t-tab-badge.now') && document.querySelector('.t-table-members .tab-away')`, 'Ana away on the teacher page');
    await teacher.shot('08b-teacher-student-away');
    await ana.run(`delete document.hasFocus; window.dispatchEvent(new Event('focus'));`);
    await ana.until(`!document.querySelector('.away-card') && document.body.innerText.includes('Your teacher can see when you leave')`, 'the card closing with a reminder');
    await sleep(1100);
    await ana.run(`Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange'));`);
    await teacher.until(`document.querySelector('.t-student.tab-away')`, 'Ana away again after switching tabs');
    await ana.run(`delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange'));`);
    await teacher.until(`!document.querySelector('.t-student.tab-away') && [...document.querySelectorAll('.t-tab-badge')].some(badge => badge.innerText.includes('2×'))`, 'two leaves counted');
    await ana.until(`document.querySelector('.tab-badge')?.innerText.includes('2×')`, 'her badge showing 2×');

    await teacher.run(`document.querySelector('.t-table').click();`);
    await teacher.until(`document.querySelector('.t-transcript .t-line')`, 'the transcript');
    await teacher.shot('09-teacher-table');
    await teacher.click('✕ Close');

    // The finer teacher controls, exercised through the rendered UI.
    await teacher.run(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));`);
    await teacher.until(`document.querySelector('[aria-label="Search commands"]')`, 'Ctrl+K commands');
    await teacher.click('Student: Ana');
    await teacher.until(`document.querySelector('[aria-label="Private message"]')`, 'student drawer');
    await teacher.run(`const box = document.querySelector('[aria-label="Private message"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(box, 'How are you getting on?'); box.dispatchEvent(new Event('input', { bubbles: true }));`);
    await sleep(100); await teacher.click('Send');
    await ana.click('Teacher chat');
    await ana.until(`document.body.innerText.includes('How are you getting on?')`, 'private teacher message');
    await ana.run(`const box = document.querySelector('[aria-label="Message to your teacher"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(box, 'I understand the task now'); box.dispatchEvent(new Event('input', { bubbles: true }));`);
    await sleep(100); await ana.click('Send privately');
    await teacher.until(`document.body.innerText.includes('I understand the task now')`, 'private student reply');
    await teacher.shot('09-student-drawer'); await ana.shot('09-private-chat');
    await ana.click('Close');
    await teacher.click('Edit name or character');
    await teacher.until(`document.querySelector('.avatar-editor')`, 'character editor');
    await teacher.shot('09-character-editor');
    await teacher.click('Cancel'); await teacher.run(`document.querySelector('.t-drawer header button').click();`);
    await teacher.run(`document.getElementById('lesson-words').open = true; const box = document.querySelector('[aria-label="Words or phrases to block"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(box, 'andrei'); box.dispatchEvent(new Event('input', { bubbles: true }));`);
    await sleep(100); await teacher.run(`document.querySelector('#lesson-words form button').click();`);
    await teacher.until(`document.getElementById('lesson-words').innerText.includes('Allow again')`, 'lesson word saved');
    await ana.say('fr33 4ndr3i');
    await ana.until(`document.body.innerText.includes('blocked those words')`, 'browser disguise detection');
    await teacher.run(`document.getElementById('message-history').open = true;`);
    await teacher.until(`document.getElementById('message-history').innerText.includes('fr33 4ndr3i')`, 'blocked draft in searchable history');
    await teacher.shot('09-lesson-controls');
    assert.equal(await teacher.run(`return document.documentElement.scrollWidth <= innerWidth;`), true, 'teacher controls fit the screen');
    await teacher.run(`document.getElementById('message-history').open = false; document.getElementById('lesson-words').open = false;`);
    console.log('  ✓ Commands, student drawer, character editor, private replies, lesson words and draft history');

    // Every game, as a class activity, so each board is seen with real players.
    const status = await (await fetch(`${origin}/api/teacher/status`, { headers: { 'x-teacher-session': token } })).json();
    for (const student of students) await student.run(`for (const id of ${JSON.stringify(status.games.map(game => game.id))}) localStorage.setItem('hellochat.how.' + id, '1');`);
    let index = 10;
    for (const game of status.games) {
        if (only.length && !only.includes(game.id)) continue;
        await teach('start', { game: game.id, level: 'A2', size: game.id === 'spy' ? 4 : 2, rounds: 2, minutes: 5, topic: 'food' });
        for (const student of students) await student.until(`document.querySelector('.table-game strong')?.innerText === ${JSON.stringify(game.title)} && !document.querySelector('.greeting')`, `${game.title} to start`, 12000);
        // A little play: everyone taps what can be tapped and writes two messages.
        for (let turn = 0; turn < 2; turn++) {
            for (const student of students) {
                await student.run(`const action = document.querySelector('.now-actions .btn-go'); if (action) action.click();`);
                await student.run(`const cell = document.querySelector('.w-option.can:not(.picked), .w-sentence.can'); if (cell) cell.click();`);
            }
            await ana.say(turn ? 'What do you think about pizza and pasta?' : 'I think it is a very big animal with four legs');
            await ben.say(turn ? 'I really like it because it is very good' : 'Is it something you can find in a kitchen?');
            await cleo.say(turn ? 'Yes, I do. What about you?' : 'One day a dragon went to school with a pizza');
            await dev.say(turn ? 'I agree with you because it is true' : 'Do you like playing football at the weekend?');
        }
        const name = `${String(index++).padStart(2, '0')}-${game.id}`;
        await ana.shot(name); await ben.shot(`${name}-b`);
        if (['trail', 'speedchat', 'spotdiff', 'quest'].includes(game.id)) await dev.shot(`${name}-phone`);
        if (game.id === 'speedchat') { await teacher.shot(`${name}-teacher`); }
        console.log(`  ✓ ${game.title}`);
    }
    await teach('end', {});
    const errors = [teacher, ...students].flatMap(tab => tab.errors).filter(error => !/favicon|ERR_|Failed to load resource/.test(error));
    if (errors.length) { console.log('\n  Page errors:\n   ' + [...new Set(errors)].slice(0, 12).join('\n   ')); }
    console.log(`\n  Pictures are in ${shots}\n`);
    return errors.length ? 1 : 0;
}

main().then(stop, error => { console.error(`\n  ✗ ${error.stack || error}\n`); stop(1); });
