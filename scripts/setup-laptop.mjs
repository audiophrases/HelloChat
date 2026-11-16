// Run by classroom.bat on every start; it only does something when .dev.vars is
// incomplete. First run: asks for the teacher password and writes .dev.vars, so
// nobody has to make the hash by hand. Then, if there is no OpenAI key yet, it
// copies one from a sibling project (Pixel Plaza uses the same key) or asks for
// it once. The online values are Cloudflare secrets and cannot be read back,
// and .dev.vars is git-ignored, hence each computer is set up here.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const file = path.join(root, '.dev.vars');

// Typed characters show as *, as in a password box.
function askHidden(question) {
    return new Promise(resolve => {
        const stdin = process.stdin;
        process.stdout.write(question);
        stdin.setRawMode(true);
        stdin.setEncoding('utf8');
        stdin.resume();
        let value = '';
        const onData = chunk => {
            for (const character of chunk) {
                if (character === '\u0003') process.exit(1); // Ctrl+C
                if (character === '\r' || character === '\n') {
                    stdin.setRawMode(false);
                    stdin.pause();
                    stdin.off('data', onData);
                    process.stdout.write('\n');
                    return resolve(value);
                }
                if (character === '\b' || character === '\u007f') {
                    if (value) { value = value.slice(0, -1); process.stdout.write('\b \b'); }
                    continue;
                }
                value += character;
                process.stdout.write('*');
            }
        };
        stdin.on('data', onData);
    });
}

// The value of NAME= in a .dev.vars text; undefined when there is no such line.
function readVar(text, name) {
    const match = text.match(new RegExp(`^\\s*${name}\\s*=(.*)$`, 'm'));
    return match?.[1].trim().replace(/^(["'])(.*)\1$/, '$2');
}

// A key from another project's .dev.vars next to this folder, e.g. Pixel Plaza.
function siblingKey() {
    const parent = path.dirname(root);
    for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
        if (!entry.isDirectory() || path.join(parent, entry.name) === root) continue;
        try {
            const key = readVar(fs.readFileSync(path.join(parent, entry.name, '.dev.vars'), 'utf8'), 'OPENAI_API_KEY');
            if (key) return { key, from: entry.name };
        } catch { /* no .dev.vars there */ }
    }
    return null;
}

// True or false when OpenAI answered; null when it could not be reached.
async function keyWorks(key) {
    try {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000)
        });
        return response.status === 401 ? false : response.ok ? true : null;
    } catch { return null; }
}

if (!fs.existsSync(file)) {
    console.log('\nFirst time on this laptop. Enter the teacher password: the same one as');
    console.log('online (and PinPlay). It is saved only as a hash, in .dev.vars.\n');

    let password = '';
    for (;;) {
        password = (await askHidden('Teacher password: ')).trim();
        if (!password) { console.log('The password cannot be empty.'); continue; }
        if ((await askHidden('Type it again:    ')).trim() === password) break;
        console.log('The two did not match. Try again.\n');
    }

    // The same scheme as worker/rules.ts and PinPlay.
    const hash = crypto.createHash('sha256').update(password.normalize('NFC')).digest('hex');
    fs.writeFileSync(file, [
        '# Made by classroom.bat. Preserve this file: it may contain other secrets.',
        `CREATE_PASSWORD_HASH=${hash}`,
        'PINPLAY_API_URL=https://api.pinplay.win',
        ''
    ].join('\n'), { flag: 'wx' });
    console.log('\nSaved. Preserve .dev.vars when updating the password: it may contain other secrets.\n');
}

// AI checks. An OPENAI_API_KEY line that is present but empty means "asked, and
// the teacher chose to run without", so the question is not repeated.
const text = fs.readFileSync(file, 'utf8');
if (readVar(text, 'OPENAI_API_KEY') === undefined) {
    let key = '';
    const found = siblingKey();
    if (found && await keyWorks(found.key) !== false) {
        key = found.key;
        console.log(`AI checks: using the OpenAI key from ${found.from}.`);
    } else if (process.stdin.isTTY) {
        console.log('\nAI checks need an OpenAI key (it starts with sk-). Paste it and press Enter,');
        console.log('or just press Enter to run without AI checks. Right-click pastes.\n');
        for (;;) {
            key = (await askHidden('OpenAI key: ')).trim();
            if (!key) break;
            const works = await keyWorks(key);
            if (works !== false) {
                if (works === null) console.log('Could not reach OpenAI to check the key. Saved anyway.');
                break;
            }
            console.log('OpenAI did not accept that key. Try again, or press Enter to skip.\n');
        }
    }
    if (key || process.stdin.isTTY) {
        fs.appendFileSync(file, `${text.endsWith('\n') || !text ? '' : '\n'}OPENAI_API_KEY=${key}\n`);
        console.log(key ? 'AI checks are set up.\n'
            : 'Running without AI checks. To add a key later, fill in OPENAI_API_KEY= in .dev.vars.\n');
    }
}
