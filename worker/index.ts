import { ChatRoom, type TeacherAction } from './room.ts';
import { PinPlayAuthError, resolveStudent, studentConfig, studentLogin, testerMode } from './pinplay.ts';
import { laptopOrigin, sanitizeAvatar, secretsMatch, teacherPasswordMatches } from './rules.ts';
import { isEnglishVoice } from '../shared/voices.ts';
import { synthesize, VOICE_SAMPLE } from './speech.ts';
import { gameById } from './games/index.ts';
import type { Level, StartOptions } from '../shared/protocol.ts';

export { ChatRoom };

export interface Env {
    ROOM: DurableObjectNamespace<ChatRoom>;
    PINPLAY_AUTH?: Fetcher;
    // Local development and tests only; production uses PINPLAY_AUTH.
    PINPLAY_API_URL?: string;
    // Same value as PinPlay's, so the teacher has one password.
    CREATE_PASSWORD_HASH?: string;
    AUTH_RL?: RateLimit;
    // Optional: with a key, every message is also checked by OpenAI's moderation, and students get grammar hints.
    OPENAI_API_KEY?: string;
    OPENAI_BASE_URL?: string; // tests only
    OPENAI_GRAMMAR_MODEL?: string;
    OPENAI_GRAMMAR_GATE?: string;
    OPENAI_PARTICIPATION?: string;
    // Set only on the teacher's laptop (npm run classroom): its address on the school network, and the online
    // HelloChat where students sign in.
    LAN_URL?: string;
    CLOUD_URL?: string;
    // Set only by tester.bat on a local server: lets "tester:Name" tokens sign in without Google.
    TESTER_MODE?: string;
    // Optional override for PinPlay's Render speech bridge.
    EDGE_TTS_URL?: string;
    EDGE_TTS_SECRET?: string;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// One room for the class: every student's saved progress lives in it.
const room = (env: Env) => env.ROOM.getByName('class');

async function spend(env: Env, key: string, slots: number): Promise<boolean> {
    if (!env.AUTH_RL) return true;
    try {
        const results = await Promise.all(Array.from({ length: slots }, () => env.AUTH_RL!.limit({ key })));
        return results.every(result => result.success);
    } catch {
        return true; // a limiter outage must not lock the class out
    }
}

// Every check costs one slot of the 50-a-minute budget and a wrong guess four more, so guessing tops out at about
// 10 tries a minute. The teacher's polling uses a session token instead and never spends any.
async function guarded(env: Env, key: string, check: () => boolean | Promise<boolean>): Promise<'ok' | 'wrong' | 'limited'> {
    if (!(await spend(env, key, 1))) return 'limited';
    if (await check()) return 'ok';
    await spend(env, key, 4);
    return 'wrong';
}

async function checkTeacherPassword(request: Request, env: Env, password: unknown): Promise<Response | null> {
    if (!env.CREATE_PASSWORD_HASH) return json({ error: 'The teacher password has not been set up.' }, 503);
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    const result = await guarded(env, `teacher:${ip}`, () => teacherPasswordMatches(password, env.CREATE_PASSWORD_HASH));
    if (result === 'limited') return json({ error: 'Too many tries. Wait a minute, then try again.' }, 429);
    if (result === 'wrong') return json({ error: 'Wrong password.' }, 401);
    return null;
}

const onLaptop = (env: Env) => !!(env.LAN_URL && env.CLOUD_URL);

// On the laptop: tell the online HelloChat to send signed-in students here, or with a null url to stop. The password
// links it; the lease it returns renews it. Returns what the teacher should know, or ''.
async function linkOnline(env: Env, body: { password?: unknown; url: string | null }): Promise<string> {
    if (!onLaptop(env)) return '';
    const lease = body.password === undefined ? await room(env).setting('cloud_lease') : null;
    if (body.password === undefined && !lease) return 'Sign out and in again so students are sent to this laptop.';
    try {
        const response = await fetch(new URL('/api/laptop', env.CLOUD_URL), {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify(lease ? { lease, url: body.url } : body), signal: AbortSignal.timeout(8000)
        });
        const result: any = await response.json().catch(() => ({}));
        if (!response.ok) return `Students are not being sent to this laptop: ${result.error || 'the online HelloChat refused.'}`;
        if (typeof result.lease === 'string') await room(env).saveSetting('cloud_lease', result.lease);
        return '';
    } catch {
        return 'Students are not being sent to this laptop: the online HelloChat is unreachable. Check the internet connection.';
    }
}

const LEVELS: Level[] = ['A1', 'A2', 'B1'];

function teacherAction(path: string, method: string, body: any): TeacherAction | null {
    if (path === '/api/teacher/status' && method === 'GET') return { kind: 'status' };
    if (method !== 'POST') return null;
    const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;
    switch (path) {
        case '/api/teacher/words': return Array.isArray(body?.words) && body.words.length <= 50 && body.words.every((word: unknown) => text(word, 60)) ? { kind: 'words', words: body.words } : null;
        case '/api/teacher/unblock': return text(body?.key, 100) ? { kind: 'unblock', key: body.key } : null;
        case '/api/teacher/allow-repeat': return text(body?.key, 200) && text(body?.words, 60) ? { kind: 'allowRepeat', key: body.key, words: body.words } : null;
        case '/api/teacher/chat-star': return text(body?.id, 64) ? { kind: 'chatStar', id: body.id } : null;
        case '/api/teacher/student': {
            const look = sanitizeAvatar(body?.look);
            return text(body?.key, 128) && text(body?.name, 60) && look ? { kind: 'student', key: body.key, name: body.name, look } : null;
        }
        case '/api/teacher/classroom': return body?.name !== undefined
            ? text(body.name, 60) ? { kind: 'classroom', id: crypto.randomUUID(), name: body.name } : null
            : text(body?.id, 64) ? { kind: 'classroom', id: body.id } : null;
        case '/api/teacher/classroom-name': return text(body?.id, 64) && text(body?.name, 60) ? { kind: 'renameClass', id: body.id, name: body.name } : null;
        case '/api/teacher/classroom-pin': return text(body?.id, 64) ? { kind: 'newPin', id: body.id } : null;
        case '/api/teacher/class': return typeof body?.open === 'boolean' ? { kind: 'open', open: body.open } : null;
        case '/api/teacher/start': {
            if (!text(body?.game, 40) || !gameById(body.game)) return null;
            const options: StartOptions = {
                game: body.game, level: LEVELS.includes(body.level) ? body.level : 'A2',
                size: Number.isInteger(body.size) ? Math.min(4, Math.max(2, body.size)) : 0,
                rounds: Number.isInteger(body.rounds) ? body.rounds : 1, minutes: Number.isInteger(body.minutes) ? body.minutes : 0,
                topic: text(body.topic, 20) ? body.topic : 'mix',
            };
            return { kind: 'start', options };
        }
        case '/api/teacher/next': return { kind: 'next' };
        case '/api/teacher/end': return { kind: 'end' };
        case '/api/teacher/more': return { kind: 'more', minutes: Number.isInteger(body?.minutes) ? body.minutes : 1 };
        case '/api/teacher/setting': return ['free', 'soundOff', 'secretNames'].includes(body?.name) && typeof body?.on === 'boolean' ? { kind: 'setting', name: body.name, on: body.on } : null;
        case '/api/teacher/level': return LEVELS.includes(body?.level) ? { kind: 'level', level: body.level } : null;
        case '/api/teacher/custom': return text(body?.text, 12_000) ? { kind: 'custom', text: body.text } : null;
        case '/api/teacher/allow-words': return Array.isArray(body?.words) && body.words.length <= 50 && body.words.every((word: unknown) => text(word, 60)) ? { kind: 'allowWords', words: body.words } : null;
        case '/api/teacher/unallow-word': return text(body?.word, 60) ? { kind: 'unallowWord', word: body.word } : null;
        case '/api/teacher/game-settings': {
            const game = text(body?.game, 40) ? gameById(body.game) : undefined;
            const values = body?.values;
            if (!game || !values || typeof values !== 'object' || Array.isArray(values)) return null;
            const clean: Record<string, number> = {};
            for (const setting of game.settings) {
                const value = values[setting.key];
                if (typeof value === 'number' && Number.isFinite(value)) clean[setting.key] = Math.min(setting.max, Math.max(setting.min, Math.round(value)));
            }
            return { kind: 'gameSettings', game: game.id, values: clean };
        }
        case '/api/teacher/mute': return text(body?.key, 128) && typeof body?.on === 'boolean' ? { kind: 'mute', key: body.key, on: body.on } : null;
        case '/api/teacher/sound': return text(body?.key, 128) && typeof body?.off === 'boolean' ? { kind: 'sound', key: body.key, off: body.off } : null;
        case '/api/teacher/remove': return text(body?.line, 64) ? { kind: 'remove', line: body.line } : null;
        case '/api/teacher/say': return ['all', 'table', 'student'].includes(body?.to) && text(body?.text, 300) && (body.id === undefined || text(body.id, 128))
            ? { kind: 'say', to: body.to, text: body.text, ...(body.id ? { id: body.id } : {}) } : null;
        case '/api/teacher/close-table': return text(body?.id, 64) ? { kind: 'closeTable', id: body.id } : null;
        case '/api/teacher/alert': return text(body?.id, 200) ? { kind: 'alert', id: body.id } : null;
        case '/api/teacher/star': return text(body?.id, 64) ? { kind: 'star', id: body.id } : null;
        default: return null;
    }
}

async function handle(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const get = request.method === 'GET';
    const post = request.method === 'POST';

    let body: any = {};
    if (post) {
        // Bound what is read before parsing it, even without Content-Length.
        const reader = request.body?.getReader();
        if (!reader) return json({ error: 'Expected JSON.' }, 400);
        let size = 0; const chunks: Uint8Array[] = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 16_384) { await reader.cancel(); return json({ error: 'Request is too large.' }, 413); }
            chunks.push(value);
        }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        try { body = size ? JSON.parse(new TextDecoder().decode(bytes)) : {}; } catch { return json({ error: 'Invalid JSON.' }, 400); }
    }

    if (path === '/api/health') return json({ ok: true });

    if (path === '/api/student/config' && get) {
        // Google sign-in needs HTTPS, which the laptop does not have: students sign in online and are sent back here.
        if (testerMode(env)) return json({ loginEnabled: false, googleClientId: '', allowedDomains: [] });
        if (onLaptop(env)) return json({ loginEnabled: false, googleClientId: '', allowedDomains: [], signInUrl: env.CLOUD_URL });
        return json({ ...(await studentConfig(env)), laptopUrl: await room(env).laptopUrl() });
    }
    if (path === '/api/student/login' && post) {
        const session = await studentLogin(env, body?.googleIdToken);
        const student = await resolveStudent(env, session.studentToken);
        return json({ ...session, student, avatar: await room(env).savedAvatar(student.studentKey) });
    }
    if (path === '/api/student/me' && get) {
        const student = await resolveStudent(env, request.headers.get('x-student-token'));
        return json({ student, avatar: await room(env).savedAvatar(student.studentKey) });
    }

    if ((path === '/api/room/speech' || path === '/api/room/voice-preview') && post) {
        const student = await resolveStudent(env, request.headers.get('x-student-token'));
        const preview = path === '/api/room/voice-preview';
        if (preview ? !isEnglishVoice(body?.voice) : typeof body?.id !== 'string' || !body.id || body.id.length > 100) {
            return json({ error: 'Choose a valid voice or chat message.' }, 400);
        }
        const stub = room(env);
        if (await stub.soundOff(student.studentKey)) return json({ error: 'Your teacher turned your sound off.' }, 403);
        const message = preview ? { text: VOICE_SAMPLE, voice: body.voice as string } : await stub.speechMessage(student.studentKey, body.id);
        if (!message) return json({ error: 'That message is not available.' }, 404);
        if (!(await stub.spendSpeech(student.studentKey, preview))) return json({ error: 'Wait a moment before playing more sounds.' }, 429);
        const audio = await synthesize(env, message, request.signal);
        if (!audio) return json({ error: 'Speech is temporarily unavailable. You can keep reading.' }, 503);
        // The teacher may have removed the message or turned sound off while it was being made.
        const current = preview ? message : await stub.speechMessage(student.studentKey, body.id);
        if (!current || current.text !== message.text) {
            await audio.body?.cancel();
            return json({ error: 'That message is no longer available.' }, 404);
        }
        return audio;
    }

    if (path === '/api/room/join' && post) {
        const student = await resolveStudent(env, request.headers.get('x-student-token'));
        const classPin = await room(env).classPin();
        if (!classPin) return json({ error: 'Your teacher has not opened the class yet.' }, 403);
        const pin = await guarded(env, `pin:${student.studentKey}`, () => secretsMatch(body?.pin, classPin));
        if (pin === 'limited') return json({ error: 'Too many tries. Wait a minute, then try again.' }, 429);
        if (pin === 'wrong') {
            // Already counted as a wrong try, so this cannot be used to look PINs up.
            const other = typeof body?.pin === 'string' && /^\d{6}$/.test(body.pin) ? await room(env).classNameFor(body.pin) : null;
            return json({ error: other ? `That is the PIN for ${other}, which is not open right now.` : 'Check the class PIN.' }, 403);
        }
        const avatar = body?.avatar == null ? null : sanitizeAvatar(body.avatar);
        if (body?.avatar != null && !avatar) return json({ error: 'That character is not available.' }, 400);
        const result = await room(env).issueTicket(student, avatar);
        return 'error' in result ? json({ error: result.error }, 403) : json(result);
    }
    if (path === '/api/room/ws') {
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'Expected a WebSocket.' }, 426);
        return room(env).fetch(request);
    }

    if (path === '/api/teacher/login' && post) {
        const refused = await checkTeacherPassword(request, env, body?.password);
        if (refused) return refused;
        const token = await room(env).startTeacherSession();
        const notice = await linkOnline(env, { password: body.password, url: env.LAN_URL ?? null });
        return json({ token, notice });
    }
    const teacherToken = request.headers.get('x-teacher-session') || '';
    if (path === '/api/teacher/history' && get) {
        const result = await room(env).history(teacherToken, url.searchParams.get('key') || '', url.searchParams.get('q') || '', Number(url.searchParams.get('before')) || 0);
        return 'error' in result ? json({ error: result.error }, result.status) : json(result);
    }
    if (path === '/api/teacher/private' && get) {
        const result = await room(env).privateHistory(teacherToken, url.searchParams.get('key') || '');
        return 'error' in result ? json({ error: result.error }, result.status) : json(result);
    }
    if (path === '/api/teacher/heard' && get) {
        const result = await room(env).heard(teacherToken, url.searchParams.get('q') || '');
        return 'error' in result ? json({ error: result.error }, result.status) : json(result);
    }
    if (path === '/api/teacher/transcript' && get) {
        const result = await room(env).transcript(teacherToken, url.searchParams.get('id') || '');
        return 'error' in result ? json({ error: result.error }, result.status) : json(result);
    }
    if (path === '/api/teacher/report' && get) {
        const result = await room(env).report(teacherToken, url.searchParams.get('names') !== 'show');
        return 'error' in result ? json({ error: result.error }, result.status) : json(result);
    }
    if (path.startsWith('/api/teacher/')) {
        const action = teacherAction(path, request.method, body);
        if (!action) return json({ error: 'That request is not valid.' }, 400);
        const result = await room(env).teacher(teacherToken, action);
        if ('error' in result) return json({ error: result.error }, result.status);
        // Opening the class on the laptop sends students to it; closing it stops.
        const notice = action.kind === 'open' ? await linkOnline(env, { url: action.open ? env.LAN_URL ?? null : null }) : '';
        return json({ ...result, laptop: onLaptop(env) ? { url: env.LAN_URL, signInUrl: env.CLOUD_URL } : null, notice });
    }

    // Online: the teacher's laptop says where the class is playing.
    if (path === '/api/laptop' && post) {
        const target = body?.url === null ? null : laptopOrigin(body?.url);
        if (body?.url !== null && !target) return json({ error: 'That laptop address is not valid.' }, 400);
        if (typeof body?.lease === 'string') {
            return await room(env).updateLaptop(body.lease, target) ? json({ ok: true })
                : json({ error: 'the link expired. Sign out and in again on the laptop.' }, 401);
        }
        if (!target) return json({ error: 'That laptop address is not valid.' }, 400);
        const refused = await checkTeacherPassword(request, env, body?.password);
        if (refused) return refused;
        return json({ lease: await room(env).linkLaptop(target) });
    }

    return json({ error: 'Not found.' }, 404);
}

// Only /api/* reaches the Worker; the built app is served as static assets.
export default {
    async fetch(request, env): Promise<Response> {
        try {
            return await handle(request, env);
        } catch (error) {
            if (error instanceof PinPlayAuthError) return json({ error: error.message }, error.status);
            console.error(error);
            return json({ error: 'Something went wrong. Please try again.' }, 500);
        }
    }
} satisfies ExportedHandler<Env>;
