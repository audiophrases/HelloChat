// The class, live. One Durable Object holds everyone who is connected, the tables they sit at, the game each table
// plays and all saved progress (SQLite). A student is always in one of three places: at a table, waiting for a
// partner, or in the lounge choosing a game.
import { DurableObject } from 'cloudflare:workers';
import type { Env } from './index.ts';
import type { PinPlayStudent } from './pinplay.ts';
import { MIN_WORDS, checkGrammar } from './grammar.ts';
import { moderate, type Moderation } from './moderation.ts';
import { CHAT_MAX, chatProblem, defaultAvatar, sanitizeAvatar, secretsMatch, seatStudents, tableSizes } from './rules.ts';
import { GAMES, gameById, info } from './games/index.ts';
import type { Ctx, Game, Opts, Out } from './games/types.ts';
import { TOPICS } from './content/questions.ts';
import { harmFrom, localHarm, type Harm } from '../shared/safety.ts';
import { cleanName, shownNames } from '../shared/names.ts';
import { NAME_ADJECTIVES, NAME_PEOPLE } from '../shared/randomNames.ts';
import { isEnglishVoice, normalizeVoice, voiceFor } from '../shared/voices.ts';
import { checkStyle, levelOf, reactionsFor, readStyle, titleFor, unlockedBetween } from '../shared/levels.ts';
import { wordDiff } from '../shared/diff.ts';
import { tidy } from '../shared/tidy.ts';
import type {
    ClientMessage, Level, Line, Look, LoungeInfo, Me, Member, ServerMessage, StartOptions, Style, TableInfo, TeacherAlert, TeacherReport,
    TeacherStatus, TeacherStudent, TeacherTable,
} from '../shared/protocol.ts';

const TICKET_MS = 60_000;
const TEACHER_SESSION_MS = 12 * 60 * 60 * 1000;
const CHAT_GAP_MS = 700;
const CHECK_GAP_MS = 800;        // grammar hints cost money: no more than one a student can read
const GRACE_MS = 45_000;         // a closed lid or a Wi-Fi drop keeps a student's seat this long
const QUEUE_WAIT_MS = 6000;      // free play: once enough players wait, a little longer for one more
const AFTER_GAME_MS = 9000;      // class activity: a table that finished its board game moves on to quests
const IDLE_TABLE_MS = 180_000;   // free play: a finished table nobody leaves is cleared
const XP_CAP = 40;               // stars one table can turn into experience
const HISTORY = 80;
const CLOSE_JOIN_AGAIN = 4001;
const CLOSE_CLASS_CLOSED = 4002;
const CLOSE_REPLACED = 4009;

type Seat = { key: string; left?: boolean };

type Table = {
    id: string; game: string; members: string[]; state: any; opts: Opts;
    free: boolean; session: string | null; round: number;
    started: number; paid: Record<string, number>; again: string[];
    nextAt: number | null;        // when a finished table moves on (or is cleared)
    count: Record<string, number>; total: number; lastTs: number; last: Record<string, number>;
};

type Session = {
    id: string; game: string; options: StartOptions; round: number; rounds: number; ends: number | null; started: number;
    met: Record<string, string[]>;
};

export type TeacherAction =
    | { kind: 'status' }
    | { kind: 'open'; open: boolean }
    | { kind: 'start'; options: StartOptions }
    | { kind: 'next' } | { kind: 'end' } | { kind: 'more'; minutes: number }
    | { kind: 'setting'; name: 'free' | 'soundOff' | 'secretNames'; on: boolean }
    | { kind: 'level'; level: Level }
    | { kind: 'custom'; text: string }
    | { kind: 'mute'; key: string; on: boolean } | { kind: 'sound'; key: string; off: boolean }
    | { kind: 'remove'; line: string }
    | { kind: 'say'; to: 'all' | 'table' | 'student'; id?: string; text: string }
    | { kind: 'closeTable'; id: string }
    | { kind: 'alert'; id: string }
    | { kind: 'star'; id: string };

type Failure = { error: string; status: number };

export class ChatRoom extends DurableObject<Env> {
    private sql: SqlStorage;
    private tables = new Map<string, Table>();
    private seatOf = new Map<string, string>();        // student -> table
    private queue: Record<string, string[]> = {};      // free play: game -> students waiting
    private queueAt: Record<string, number> = {};      // when a game's queue had enough players
    private session: Session | null = null;
    private gone: Record<string, number> = {};         // student -> when their connection dropped
    private lastChat = new Map<string, number>();
    private lastCheck = new Map<string, number>();
    private moderations = new Map<string, { verdict: Moderation; at: number }>();
    private shown: Map<string, string> | null = null;  // student -> the name the class sees

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.sql = ctx.storage.sql;
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS students (
                student_key TEXT PRIMARY KEY, full_name TEXT NOT NULL, class_name TEXT NOT NULL DEFAULT '', avatar TEXT,
                xp INTEGER NOT NULL DEFAULT 0, style TEXT, alias TEXT, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS tickets (ticket TEXT PRIMARY KEY, student_key TEXT NOT NULL, expires INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS teacher_sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS tables (id TEXT PRIMARY KEY, lesson INTEGER NOT NULL, data TEXT NOT NULL, ended INTEGER);
            CREATE TABLE IF NOT EXISTS chat (
                id TEXT PRIMARY KEY, ts INTEGER NOT NULL, lesson INTEGER NOT NULL, table_id TEXT NOT NULL, game TEXT NOT NULL,
                student_key TEXT NOT NULL, sender TEXT NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL,
                target TEXT, tone TEXT, flag TEXT, note TEXT, voice TEXT, marks TEXT, reacts TEXT);
            CREATE INDEX IF NOT EXISTS chat_table ON chat (table_id, ts);
            CREATE INDEX IF NOT EXISTS chat_lesson ON chat (lesson, ts);
            CREATE TABLE IF NOT EXISTS chat_audience (chat_id TEXT NOT NULL, student_key TEXT NOT NULL, PRIMARY KEY (chat_id, student_key));
            CREATE TABLE IF NOT EXISTS mutes (student_key TEXT PRIMARY KEY);
            CREATE TABLE IF NOT EXISTS sound_off (student_key TEXT PRIMARY KEY);
            CREATE TABLE IF NOT EXISTS speech_budgets (student_key TEXT NOT NULL, kind TEXT NOT NULL, window INTEGER NOT NULL, used INTEGER NOT NULL, PRIMARY KEY (student_key, kind));
            CREATE TABLE IF NOT EXISTS stats (
                lesson INTEGER NOT NULL, student_key TEXT NOT NULL, messages INTEGER NOT NULL DEFAULT 0, words INTEGER NOT NULL DEFAULT 0,
                stars INTEGER NOT NULL DEFAULT 0, blocked INTEGER NOT NULL DEFAULT 0, last_ts INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (lesson, student_key));
            CREATE TABLE IF NOT EXISTS alerts (
                id TEXT PRIMARY KEY, ts INTEGER NOT NULL, lesson INTEGER NOT NULL, kind TEXT NOT NULL, student_key TEXT NOT NULL,
                text TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'open');
            CREATE TABLE IF NOT EXISTS reports (
                id TEXT PRIMARY KEY, ts INTEGER NOT NULL, lesson INTEGER NOT NULL, table_id TEXT NOT NULL, quest TEXT NOT NULL, title TEXT NOT NULL,
                members TEXT NOT NULL, text TEXT NOT NULL, starred INTEGER NOT NULL DEFAULT 0);
        `);
        // The room answers 'ping' without waking up, so a page can tell a dead connection from a quiet one.
        ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
        // Whatever was in memory before the room slept comes back from storage.
        for (const row of this.sql.exec<{ data: string }>('SELECT data FROM tables WHERE ended IS NULL').toArray()) {
            const table = JSON.parse(row.data) as Table;
            if (!gameById(table.game)) continue;
            this.tables.set(table.id, table);
            for (const key of table.members) this.seatOf.set(key, table.id);
        }
        this.session = this.json<Session | null>('session', null);
        this.queue = this.json<Record<string, string[]>>('queue', {});
        this.queueAt = this.json<Record<string, number>>('queue_at', {});
        this.gone = this.json<Record<string, number>>('gone', {});
    }

    // ---------- Settings ----------

    setting(key: string): string | null {
        return this.sql.exec<{ value: string }>('SELECT value FROM settings WHERE key = ?', key).toArray()[0]?.value ?? null;
    }
    saveSetting(key: string, value: string): void {
        this.sql.exec('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', key, value);
    }
    private json<T>(key: string, fallback: T): T {
        try { const raw = this.setting(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
    }
    private isOpen(): boolean { return this.setting('open') === '1'; }
    private lesson(): number { return Number(this.setting('lesson') ?? 0); }
    private freePlay(): boolean { return this.setting('free') !== '0'; }
    private level(): Level { const level = this.setting('level'); return level === 'A1' || level === 'B1' ? level : 'A2'; }
    private custom(): string[] {
        return (this.setting('custom') ?? '').split('\n').map(line => line.trim()).filter(line => line.length >= 5 && line.length <= 200 && !chatProblem(line)).slice(0, 60);
    }
    private saveMemory(): void {
        this.saveSetting('session', JSON.stringify(this.session));
        this.saveSetting('queue', JSON.stringify(this.queue));
        this.saveSetting('queue_at', JSON.stringify(this.queueAt));
        this.saveSetting('gone', JSON.stringify(this.gone));
    }

    // ---------- What the HTTP routes ask ----------

    classPin(): string | null { return this.isOpen() ? this.setting('pin') : null; }

    savedAvatar(studentKey: string): Look | null {
        const row = this.sql.exec<{ avatar: string | null }>('SELECT avatar FROM students WHERE student_key = ?', studentKey).toArray()[0];
        return row?.avatar ? sanitizeAvatar(JSON.parse(row.avatar)) : null;
    }

    // A verified student gets a one-use ticket for the socket, which cannot carry headers. A null avatar keeps the saved one.
    issueTicket(student: PinPlayStudent, avatar: Look | null): { ticket: string } | { error: string } {
        if (!this.isOpen()) return { error: 'Your teacher has not opened the class yet.' };
        const now = Date.now();
        const ticket = crypto.randomUUID();
        this.sql.exec(`INSERT INTO students (student_key, full_name, class_name, avatar, first_seen, last_seen) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (student_key) DO UPDATE SET full_name = excluded.full_name, class_name = excluded.class_name,
                avatar = COALESCE(excluded.avatar, students.avatar), last_seen = excluded.last_seen`,
            student.studentKey, cleanName(student.displayName) || 'Student', student.className, avatar ? JSON.stringify(avatar) : null, now, now);
        this.sql.exec('DELETE FROM tickets WHERE expires < ?', now);
        this.sql.exec('INSERT INTO tickets (ticket, student_key, expires) VALUES (?, ?, ?)', ticket, student.studentKey, now + TICKET_MS);
        this.shown = null;
        return { ticket };
    }

    startTeacherSession(): string {
        const now = Date.now();
        const token = crypto.randomUUID() + crypto.randomUUID();
        this.sql.exec('DELETE FROM teacher_sessions WHERE expires < ?', now);
        this.sql.exec('INSERT INTO teacher_sessions (token, expires) VALUES (?, ?)', token, now + TEACHER_SESSION_MS);
        return token;
    }
    private teacherSignedIn(token: string): boolean {
        return !!token && this.sql.exec('SELECT 1 FROM teacher_sessions WHERE token = ? AND expires > ?', token, Date.now()).toArray().length > 0;
    }

    // Online: where the teacher's laptop runs the class, so students are sent there after signing in.
    private laptop(): { url: string | null; lease: string; expires: number } | null {
        const laptop = this.json<{ url: string | null; lease: string; expires: number } | null>('laptop', null);
        return laptop && laptop.expires > Date.now() ? laptop : null;
    }
    linkLaptop(url: string): string {
        const lease = crypto.randomUUID() + crypto.randomUUID();
        this.saveSetting('laptop', JSON.stringify({ url, lease, expires: Date.now() + TEACHER_SESSION_MS }));
        return lease;
    }
    updateLaptop(lease: string, url: string | null): boolean {
        const laptop = this.laptop();
        if (!laptop || !secretsMatch(lease, laptop.lease)) return false;
        this.saveSetting('laptop', JSON.stringify({ ...laptop, url, expires: Date.now() + TEACHER_SESSION_MS }));
        return true;
    }
    laptopUrl(): string | null { return this.laptop()?.url ?? null; }

    // Audio may only reproduce a message this student actually received.
    speechMessage(studentKey: string, id: string): { text: string; voice: string } | null {
        if (!this.isOpen() || this.soundOff(studentKey)) return null;
        const row = this.sql.exec<{ text: string; voice: string | null }>(`SELECT c.text, c.voice FROM chat c JOIN chat_audience a ON a.chat_id = c.id
            WHERE c.id = ? AND c.status = 'ok' AND a.student_key = ?`, id, studentKey).toArray()[0];
        return row ? { text: row.text, voice: normalizeVoice(row.voice) } : null;
    }
    soundOff(studentKey: string): boolean {
        return this.setting('sound_all_off') === '1' || this.sql.exec('SELECT 1 FROM sound_off WHERE student_key = ?', studentKey).toArray().length > 0;
    }
    // An independent budget: listening must never consume sign-in or PIN attempts.
    spendSpeech(studentKey: string, preview: boolean): boolean {
        const kind = preview ? 'preview' : 'message'; const window = Math.floor(Date.now() / 60_000);
        this.sql.exec(`INSERT INTO speech_budgets (student_key, kind, window, used) VALUES (?, ?, ?, 1)
            ON CONFLICT(student_key, kind) DO UPDATE SET used = CASE WHEN window = excluded.window THEN used + 1 ELSE 1 END, window = excluded.window`, studentKey, kind, window);
        const used = this.sql.exec<{ used: number }>('SELECT used FROM speech_budgets WHERE student_key = ? AND kind = ?', studentKey, kind).one().used;
        return used <= (preview ? 12 : 90);
    }

    // ---------- People ----------

    private sockets(key?: string): WebSocket[] {
        return this.ctx.getWebSockets(key).filter(ws => !(ws.deserializeAttachment() as Seat | null)?.left);
    }
    private online(key: string): boolean { return this.sockets(key).length > 0; }
    private present(): string[] {
        return [...new Set(this.sockets().map(ws => (ws.deserializeAttachment() as Seat | null)?.key).filter((key): key is string => !!key))];
    }

    // The names the class sees: first names, with the start of a surname when two students share one; or made-up
    // names when the teacher turned secret names on.
    private names(): Map<string, string> {
        if (this.shown) return this.shown;
        const rows = this.sql.exec<{ student_key: string; full_name: string; alias: string | null }>(
            'SELECT student_key, full_name, alias FROM students WHERE last_seen >= ? ORDER BY first_seen', this.lesson()).toArray();
        if (this.setting('secret_names') === '1') {
            const taken = new Set(rows.map(row => row.alias).filter(Boolean));
            this.shown = new Map(rows.map(row => {
                let alias = row.alias;
                for (let attempt = 0; !alias && attempt < 200; attempt++) {
                    const candidate = `${NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)]} ${NAME_PEOPLE[Math.floor(Math.random() * NAME_PEOPLE.length)]}`;
                    if (!taken.has(candidate) && candidate.length <= 20) { alias = candidate; taken.add(candidate); this.sql.exec('UPDATE students SET alias = ? WHERE student_key = ?', alias, row.student_key); }
                }
                return [row.student_key, alias ?? 'Student'];
            }));
        } else this.shown = shownNames(rows.map(row => ({ key: row.student_key, full: row.full_name })));
        return this.shown;
    }
    private nameOf(key: string): string { return this.names().get(key) ?? 'Student'; }

    private person(key: string): { look: Look; style: Style; xp: number; real: string } {
        const row = this.sql.exec<{ avatar: string | null; style: string | null; xp: number; full_name: string }>(
            'SELECT avatar, style, xp, full_name FROM students WHERE student_key = ?', key).toArray()[0];
        const look = (row?.avatar && sanitizeAvatar(JSON.parse(row.avatar))) || defaultAvatar();
        // Never chosen a voice: one of their own, not the same default as everyone else.
        if (!isEnglishVoice(look.voice)) look.voice = voiceFor(key);
        return { look, style: readStyle(row?.style ?? null, levelOf(row?.xp ?? 0).level), xp: row?.xp ?? 0, real: row?.full_name ?? 'Student' };
    }
    private me(key: string): Me { const person = this.person(key); return { key, name: this.nameOf(key), look: person.look, style: person.style, xp: person.xp }; }
    private member(key: string): Member { const person = this.person(key); return { key, name: this.nameOf(key), look: person.look, style: person.style, here: this.online(key) }; }

    private send(key: string, message: ServerMessage): void {
        const text = JSON.stringify(message);
        for (const ws of this.sockets(key)) { try { ws.send(text); } catch { /* reconnect brings it back */ } }
    }
    private toAll(message: ServerMessage): void {
        const text = JSON.stringify(message);
        for (const ws of this.sockets()) { try { ws.send(text); } catch { /* reconnect brings it back */ } }
    }
    private toTable(table: Table, message: ServerMessage, except?: string): void {
        for (const key of table.members) if (key !== except) this.send(key, message);
    }

    private bump(key: string, field: 'messages' | 'words' | 'stars' | 'blocked', amount: number, now = Date.now()): void {
        this.sql.exec(`INSERT INTO stats (lesson, student_key, ${field}, last_ts) VALUES (?, ?, ?, ?)
            ON CONFLICT (lesson, student_key) DO UPDATE SET ${field} = ${field} + excluded.${field}${field === 'messages' ? ', last_ts = excluded.last_ts' : ''}`,
            this.lesson(), key, amount, field === 'messages' ? now : 0);
    }

    private award(key: string, amount: number, reason: string): void {
        if (amount <= 0) return;
        const before = this.person(key).xp;
        this.sql.exec('UPDATE students SET xp = xp + ? WHERE student_key = ?', amount, key);
        this.bump(key, 'stars', amount);
        const from = levelOf(before).level; const to = levelOf(before + amount).level;
        this.send(key, { t: 'xp', xp: before + amount, gained: amount, reason });
        if (to > from) {
            const opened = unlockedBetween(from, to);
            this.send(key, { t: 'notice', level: 'info', text: `🎉 Level ${to}! You are now a ${titleFor(to)}.${opened.length ? ` New: ${opened.join(', ')}.` : ''}` });
        }
    }

    // ---------- Tables ----------

    private ctxOf(table: Table): Ctx {
        return { now: Date.now(), rnd: Math.random, players: table.members.map(key => ({ key, name: this.nameOf(key) })), opts: table.opts };
    }
    private gameOf(table: Table): Game { return gameById(table.game)!; }
    private tableOf(key: string): Table | null { return this.tables.get(this.seatOf.get(key) ?? '') ?? null; }

    private saveTable(table: Table): void {
        this.sql.exec('INSERT INTO tables (id, lesson, data, ended) VALUES (?, ?, ?, NULL) ON CONFLICT (id) DO UPDATE SET data = excluded.data',
            table.id, this.lesson(), JSON.stringify(table));
    }

    private optsFor(game: Game, options: Partial<StartOptions>, endless: boolean): Opts {
        const wanted = options.level ?? this.level();
        const level = game.levels.includes(wanted) ? wanted : game.levels[0];
        const custom = this.custom();
        const topic = options.topic === 'custom' && !custom.length ? 'mix' : options.topic ?? 'mix';
        return { level, topic, custom, endless };
    }

    private openTable(game: Game, members: string[], opts: Opts, free: boolean): Table {
        const now = Date.now();
        const table: Table = {
            id: crypto.randomUUID().slice(0, 8), game: game.id, members: [...members], state: null, opts, free,
            session: free ? null : this.session?.id ?? null, round: this.session?.round ?? 1,
            started: now, paid: {}, again: [], nextAt: null, count: {}, total: 0, lastTs: now, last: {},
        };
        table.state = game.create(this.ctxOf(table));
        this.tables.set(table.id, table);
        for (const key of members) {
            this.seatOf.set(key, table.id);
            for (const waiting of Object.values(this.queue)) { const at = waiting.indexOf(key); if (at >= 0) waiting.splice(at, 1); }
        }
        if (this.session && !free) {
            for (const a of members) for (const b of members) if (a !== b) (this.session.met[a] ??= []).push(b);
        }
        this.saveTable(table);
        for (const key of members) this.sendTable(key, table);
        return table;
    }

    private lines(table: Table, key: string): Line[] {
        const rows = this.sql.exec<{ id: string; ts: number; student_key: string; sender: string; text: string; status: string; target: string | null; tone: string | null; voice: string | null; marks: string | null; reacts: string | null }>(
            `SELECT id, ts, student_key, sender, text, status, target, tone, voice, marks, reacts FROM chat
             WHERE table_id = ? AND status IN ('ok', 'secret') AND (target IS NULL OR target = ?) AND (status = 'ok' OR student_key = ?)
             ORDER BY ts DESC, rowid DESC LIMIT ?`, table.id, key, key, HISTORY).toArray().reverse();
        return rows.map(row => ({
            id: row.id, ts: row.ts, from: row.student_key, name: row.student_key === 'sys' ? '' : row.student_key === 'teacher' ? 'Teacher' : this.nameOf(row.student_key), text: row.text,
            ...(row.tone ? { tone: row.tone as Line['tone'] } : {}), ...(row.status === 'secret' ? { secret: true } : {}),
            ...(row.marks ? { marks: JSON.parse(row.marks) } : {}), ...(row.voice ? { voice: row.voice } : {}), ...(row.reacts ? { reacts: JSON.parse(row.reacts) } : {}),
        }));
    }

    private tableInfo(table: Table, key: string): TableInfo {
        const game = this.gameOf(table);
        return {
            id: table.id, game: info(game), members: table.members.map(member => this.member(member)), lines: this.lines(table, key),
            view: game.view(table.state, this.ctxOf(table), key), free: table.free,
            session: this.session && table.session === this.session.id ? { round: this.session.round, rounds: this.session.rounds, ends: this.session.ends } : null,
        };
    }
    private sendTable(key: string, table: Table, why?: string): void { this.send(key, { t: 'table', table: this.tableInfo(table, key), ...(why ? { why } : {}) }); }

    private sendViews(table: Table): void {
        const game = this.gameOf(table);
        const ctx = this.ctxOf(table);
        for (const key of table.members) this.send(key, { t: 'view', id: table.id, view: game.view(table.state, ctx, key) });
    }
    private sendMembers(table: Table): void {
        this.toTable(table, { t: 'members', id: table.id, members: table.members.map(member => this.member(member)) });
    }

    // A line in the game's own voice (or the teacher's), to the table or to one member.
    private narrate(table: Table, text: string, from: 'sys' | 'teacher' = 'sys', to?: string, tone?: Line['tone']): void {
        const line: Line = { id: crypto.randomUUID(), ts: Date.now(), from, name: from === 'teacher' ? 'Teacher' : '', text, ...(tone ? { tone } : {}) };
        this.sql.exec('INSERT INTO chat (id, ts, lesson, table_id, game, student_key, sender, text, status, target, tone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            line.id, line.ts, this.lesson(), table.id, table.game, from, from === 'teacher' ? 'Teacher' : 'Game', text, 'ok', to ?? null, tone ?? null);
        if (to) this.send(to, { t: 'line', id: table.id, line });
        else this.toTable(table, { t: 'line', id: table.id, line });
    }

    // What a game said and did, sent on; then the table is saved, redrawn, paid and its clock set.
    private apply(table: Table, out: Out): void {
        for (const say of out.say ?? []) this.narrate(table, say.text, 'sys', say.to, say.tone);
        for (const fx of out.fx ?? []) {
            if (fx.to) this.send(fx.to, { t: 'fx', kind: fx.kind }); else this.toTable(table, { t: 'fx', kind: fx.kind });
        }
        if (out.report) {
            this.sql.exec('INSERT INTO reports (id, ts, lesson, table_id, quest, title, members, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                crypto.randomUUID(), Date.now(), this.lesson(), table.id, out.report.quest, out.report.title, JSON.stringify(table.members), out.report.text);
        }
        this.settle(table);
    }

    private settle(table: Table): void {
        const stars: Record<string, number> = table.state.stars ?? {};
        for (const key of table.members) {
            const due = Math.min(XP_CAP, stars[key] ?? 0) - (table.paid[key] ?? 0);
            if (due > 0) { table.paid[key] = (table.paid[key] ?? 0) + due; this.award(key, due, this.gameOf(table).title); }
        }
        if (table.state.over && table.nextAt === null) table.nextAt = Date.now() + (table.free ? IDLE_TABLE_MS : AFTER_GAME_MS);
        this.saveTable(table);
        this.sendViews(table);
        this.schedule();
    }

    // The table is over: everyone leaves it and is found somewhere else to be.
    private closeTable(table: Table, why?: string, replace = true): void {
        this.tables.delete(table.id);
        this.sql.exec('UPDATE tables SET ended = ?, data = ? WHERE id = ?', Date.now(), JSON.stringify(table), table.id);
        const members = [...table.members];
        for (const key of members) if (this.seatOf.get(key) === table.id) this.seatOf.delete(key);
        for (const key of members) this.send(key, { t: 'table', table: null, ...(why ? { why } : {}) });
        if (replace) for (const key of members) if (this.online(key)) this.place(key);
    }

    private removeMember(table: Table, key: string, why?: string): void {
        if (!table.members.includes(key)) return;
        table.members = table.members.filter(member => member !== key);
        table.again = table.again.filter(member => member !== key);
        this.seatOf.delete(key);
        this.send(key, { t: 'table', table: null, ...(why ? { why } : {}) });
        const game = this.gameOf(table);
        if (table.members.length < game.min || table.state.over && !table.members.length) {
            // Too few to play on: the others are found a new table (a class activity) or go back to choosing (free play).
            const rest = [...table.members];
            const wasFree = table.free;
            this.closeTable(table, rest.length ? `${this.nameOf(key)} left the table.` : undefined, false);
            for (const member of rest) {
                if (wasFree && !this.session && !table.state.over) { (this.queue[table.game] ??= []).push(member); }
                if (this.online(member)) this.place(member);
            }
            if (wasFree) this.matchQueue(table.game);
            return;
        }
        this.narrate(table, `${this.nameOf(key)} left the table.`);
        this.apply(table, game.leave(table.state, this.ctxOf(table), key));
        this.sendMembers(table);
    }

    // ---------- Where a student goes ----------

    private place(key: string): void {
        const table = this.tableOf(key);
        if (table) { this.sendTable(key, table); this.sendMembers(table); return; }
        if (this.session) this.seatInSession(key);
        if (!this.tableOf(key)) this.sendLounge(key);
    }

    private loungeFor(key: string): LoungeInfo {
        const waiting: Record<string, string[]> = {};
        for (const [game, keys] of Object.entries(this.queue)) if (keys.length) waiting[game] = keys.map(member => this.nameOf(member));
        const session = this.session ? gameById(this.session.game) : null;
        return {
            open: this.isOpen(), free: this.freePlay() && !this.session,
            games: this.freePlay() && !this.session ? GAMES.map(info) : [],
            waiting, queued: Object.entries(this.queue).find(([, keys]) => keys.includes(key))?.[0] ?? null,
            session: session ? { title: session.title, icon: session.icon, note: 'Finding you a partner…' } : null,
            online: this.present().length,
        };
    }
    private sendLounge(key: string): void { this.send(key, { t: 'lounge', lounge: this.loungeFor(key) }); }
    private refreshLounges(): void { for (const key of this.present()) if (!this.tableOf(key)) this.sendLounge(key); }

    // ---------- Free play ----------

    private enqueue(key: string, gameId: string | null): void {
        for (const waiting of Object.values(this.queue)) { const at = waiting.indexOf(key); if (at >= 0) waiting.splice(at, 1); }
        const game = gameId ? gameById(gameId) : null;
        if (game && this.freePlay() && !this.session && !this.tableOf(key)) {
            (this.queue[game.id] ??= []).push(key);
            this.matchQueue(game.id);
        }
        this.saveMemory();
        this.refreshLounges();
        this.schedule();
    }

    // Enough players waiting for a game: the table starts at once when it is full, or after a short wait for one more.
    private matchQueue(gameId: string): void {
        const game = gameById(gameId);
        const waiting = (this.queue[gameId] ?? []).filter(key => this.online(key) && !this.tableOf(key));
        this.queue[gameId] = waiting;
        if (!game || waiting.length < game.min) { delete this.queueAt[gameId]; return; }
        const now = Date.now();
        this.queueAt[gameId] ??= now;
        if (waiting.length < game.ideal && now - this.queueAt[gameId] < QUEUE_WAIT_MS) return;
        const members = waiting.slice(0, Math.max(game.ideal, game.min));
        this.queue[gameId] = waiting.slice(members.length);
        delete this.queueAt[gameId];
        this.openTable(game, members, this.optsFor(game, {}, false), true);
        if (this.queue[gameId].length >= game.min) this.matchQueue(gameId);
    }

    // ---------- A class activity ----------

    private startSession(options: StartOptions): string | null {
        const game = gameById(options.game);
        if (!game) return 'Choose an activity.';
        if (!this.isOpen()) return 'Open the class first.';
        for (const table of [...this.tables.values()]) this.closeTable(table, 'Your teacher started a new activity!', false);
        this.queue = {}; this.queueAt = {};
        const rounds = Math.min(Math.max(1, Math.floor(options.rounds) || 1), 8);
        const minutes = Math.min(Math.max(0, Math.floor(options.minutes) || 0), 60);
        const now = Date.now();
        this.session = { id: crypto.randomUUID().slice(0, 8), game: game.id, options: { ...options, rounds, minutes }, round: 1, rounds, ends: minutes ? now + minutes * 60_000 : null, started: now, met: {} };
        this.formRound();
        return null;
    }

    private formRound(): void {
        const session = this.session; const game = session && gameById(session.game);
        if (!session || !game) return;
        const waiting = this.present().filter(key => !this.tableOf(key));
        const sizes = tableSizes(waiting.length, session.options.size || game.ideal, game.min, Math.max(game.max, game.min));
        const opts = this.optsFor(game, session.options, true);
        for (const members of seatStudents(waiting, sizes, session.met)) this.openTable(game, members, opts, false);
        this.saveMemory();
        this.refreshLounges();
        this.schedule();
    }

    // A student with no table while a class activity runs: with others who wait, or at the smallest table with room.
    private seatInSession(key: string): void {
        const session = this.session; const game = session && gameById(session.game);
        if (!session || !game) return;
        const waiting = this.present().filter(member => !this.tableOf(member));
        if (!waiting.includes(key)) waiting.push(key);
        if (waiting.length >= game.min) { this.openTable(game, waiting.slice(0, game.max), this.optsFor(game, session.options, true), false); this.saveMemory(); this.schedule(); return; }
        const room = [...this.tables.values()].filter(table => table.session === session.id && table.members.length < Math.max(gameById(table.game)!.max, 3))
            .sort((a, b) => a.members.length - b.members.length)[0];
        if (!room) return;
        room.members.push(key);
        this.seatOf.set(key, room.id);
        for (const member of room.members) if (member !== key) { (session.met[member] ??= []).push(key); (session.met[key] ??= []).push(member); }
        const out = this.gameOf(room).join(room.state, this.ctxOf(room), key);
        this.narrate(room, `${this.nameOf(key)} joined the table. Say hello!`);
        this.sendTable(key, room);
        this.sendMembers(room);
        this.apply(room, out);
        this.saveMemory();
    }

    private nextRound(): void {
        const session = this.session;
        if (!session) return;
        if (session.round >= session.rounds) { this.endSession('The activity is over. Great work! 🎉'); return; }
        for (const table of [...this.tables.values()]) if (table.session === session.id) this.closeTable(table, 'New round: new partners! 🔄', false);
        session.round += 1;
        session.ends = session.options.minutes ? Date.now() + session.options.minutes * 60_000 : null;
        this.formRound();
    }

    private endSession(why: string): void {
        const session = this.session;
        if (!session) return;
        this.session = null;
        for (const table of [...this.tables.values()]) if (table.session === session.id) this.closeTable(table, why, false);
        this.saveMemory();
        this.refreshLounges();
        this.schedule();
    }

    // ---------- The clock ----------

    private schedule(): void {
        const times: number[] = [];
        for (const table of this.tables.values()) {
            if (!table.state.over && typeof table.state.due === 'number') times.push(table.state.due);
            if (table.nextAt !== null) times.push(table.nextAt);
        }
        if (this.session?.ends) times.push(this.session.ends);
        for (const at of Object.values(this.queueAt)) times.push(at + QUEUE_WAIT_MS);
        for (const at of Object.values(this.gone)) times.push(at + GRACE_MS);
        if (times.length) void this.ctx.storage.setAlarm(Math.max(Date.now() + 50, Math.min(...times)));
        else void this.ctx.storage.deleteAlarm();
    }

    async alarm(): Promise<void> {
        const now = Date.now();
        // Students whose connection has been gone too long give up their seat.
        for (const [key, at] of Object.entries(this.gone)) {
            if (now - at < GRACE_MS) continue;
            delete this.gone[key];
            if (this.online(key)) continue;
            for (const waiting of Object.values(this.queue)) { const index = waiting.indexOf(key); if (index >= 0) waiting.splice(index, 1); }
            const table = this.tableOf(key);
            if (table) this.removeMember(table, key);
        }
        if (this.session?.ends && now >= this.session.ends) this.nextRound();
        for (const table of [...this.tables.values()]) {
            if (!this.tables.has(table.id)) continue;
            if (table.nextAt !== null && now >= table.nextAt) {
                table.nextAt = null;
                if (table.free || !this.session) { this.closeTable(table); continue; }
                // A class activity: the table finished early and plays quests until the round ends.
                const quests = gameById('quest')!;
                table.game = quests.id; table.opts = this.optsFor(quests, this.session.options, true); table.paid = {};
                table.state = quests.create(this.ctxOf(table));
                this.narrate(table, 'You finished early! Here are some bonus quests. 🗺️');
                this.saveTable(table);
                for (const key of table.members) this.sendTable(key, table);
                continue;
            }
            if (!table.state.over && typeof table.state.due === 'number' && now >= table.state.due) {
                const due = table.state.due;
                const out = this.gameOf(table).tick(table.state, this.ctxOf(table));
                if (table.state.due === due) table.state.due = null; // a game that did not move its clock on must not spin
                this.apply(table, out);
            }
        }
        for (const game of Object.keys(this.queueAt)) this.matchQueue(game);
        this.saveMemory();
        this.refreshLounges();
        this.schedule();
    }

    // ---------- The socket ----------

    async fetch(request: Request): Promise<Response> {
        const { 0: client, 1: server } = new WebSocketPair();
        const ticket = new URL(request.url).searchParams.get('ticket') || '';
        const row = this.sql.exec<{ student_key: string }>('DELETE FROM tickets WHERE ticket = ? AND expires >= ? RETURNING student_key', ticket, Date.now()).toArray()[0];
        if (!row || !this.isOpen()) {
            server.accept();
            server.close(CLOSE_JOIN_AGAIN, 'Join again.');
            return new Response(null, { status: 101, webSocket: client });
        }
        const key = row.student_key;
        // One seat per student: a newer window takes over.
        for (const old of this.sockets(key)) {
            old.serializeAttachment({ key, left: true } satisfies Seat);
            try { old.close(CLOSE_REPLACED, 'Opened in another window.'); } catch { /* already closing */ }
        }
        this.ctx.acceptWebSocket(server, [key]);
        server.serializeAttachment({ key } satisfies Seat);
        delete this.gone[key];
        this.sql.exec('UPDATE students SET last_seen = ? WHERE student_key = ?', Date.now(), key);
        const before = this.shown;
        this.shown = null;
        const names = this.names();
        this.send(key, { t: 'welcome', me: this.me(key), names: this.wordList(), soundOff: this.soundOff(key), muted: this.muted(key) });
        // A namesake arrived, so someone's shown name changed: everyone's tables are redrawn with the new names.
        if (before && [...before].some(([student, name]) => names.get(student) !== name)) this.renameEveryone();
        else this.toAll({ t: 'names', names: this.wordList() });
        this.place(key);
        this.refreshLounges();
        this.saveMemory();
        this.schedule();
        return new Response(null, { status: 101, webSocket: client });
    }

    // Words the English check takes besides the dictionary's: everyone's names, and the made-up people of Guess Who?
    private wordList(): string[] {
        return [...new Set([...this.names().values()].flatMap(name => name.split(' ')).concat(['HelloChat']))];
    }
    private renameEveryone(): void {
        this.toAll({ t: 'names', names: this.wordList() });
        for (const key of this.present()) this.send(key, { t: 'me', me: this.me(key) });
        for (const table of this.tables.values()) for (const key of table.members) this.sendTable(key, table);
    }
    private muted(key: string): boolean { return this.sql.exec('SELECT 1 FROM mutes WHERE student_key = ?', key).toArray().length > 0; }

    async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
        if (typeof message !== 'string' || message.length > 4096) return;
        const seat = ws.deserializeAttachment() as Seat | null;
        if (!seat || seat.left || !this.isOpen()) return;
        let data: ClientMessage;
        try { data = JSON.parse(message) as ClientMessage; } catch { return; }
        const key = seat.key;
        switch (data?.t) {
            case 'chat': await this.chat(key, data); break;
            case 'check': await this.grammar(key, data.id, data.text); break;
            case 'act': this.act(key, data.act, data.data); break;
            case 'typing': { const table = this.tableOf(key); if (table) this.toTable(table, { t: 'typing', id: table.id, key }, key); break; }
            case 'queue': this.enqueue(key, typeof data.game === 'string' ? data.game : null); break;
            case 'leave': { const table = this.tableOf(key); if (table && (table.free || table.state.over)) { this.removeMember(table, key); this.sendLounge(key); this.refreshLounges(); } break; }
            case 'again': this.again(key); break;
            case 'react': this.react(key, data.line, data.emoji); break;
            case 'help': this.help(key, data.note); break;
            case 'style': {
                const style = checkStyle(data.style, levelOf(this.person(key).xp).level);
                if (!style) return;
                this.sql.exec('UPDATE students SET style = ? WHERE student_key = ?', JSON.stringify(style), key);
                this.send(key, { t: 'me', me: this.me(key) });
                const table = this.tableOf(key);
                if (table) this.sendMembers(table);
                break;
            }
        }
    }

    async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
        this.dropped(ws);
        try { ws.close(code === 1005 || code === 1006 ? 1000 : code, reason); } catch { /* reserved code, or already closed */ }
    }
    async webSocketError(ws: WebSocket): Promise<void> { this.dropped(ws); }

    private dropped(ws: WebSocket): void {
        const seat = ws.deserializeAttachment() as Seat | null;
        if (!seat || seat.left) return;
        ws.serializeAttachment({ key: seat.key, left: true } satisfies Seat);
        if (this.online(seat.key)) return; // another window is still open
        this.gone[seat.key] = Date.now();
        const table = this.tableOf(seat.key);
        if (table) this.sendMembers(table);
        this.saveMemory();
        this.refreshLounges();
        this.schedule();
    }

    // ---------- What students do ----------

    private act(key: string, act: unknown, data: unknown): void {
        const table = this.tableOf(key);
        if (!table || typeof act !== 'string' || act.length > 20) return;
        const text = (data as { text?: unknown } | null)?.text;
        if (typeof text === 'string' && (text.length > 400 || chatProblem(text.slice(0, CHAT_MAX)))) {
            this.send(key, { t: 'notice', level: 'warning', text: 'That answer cannot be sent. Please rewrite it.' });
            return;
        }
        this.apply(table, this.gameOf(table).act(table.state, this.ctxOf(table), key, act, data));
    }

    // Free play, after a game: everyone still at the table who wants another one gets it.
    private again(key: string): void {
        const table = this.tableOf(key);
        if (!table || !table.free || !table.state.over) return;
        if (!table.again.includes(key)) table.again.push(key);
        const game = this.gameOf(table);
        if (table.members.every(member => table.again.includes(member)) && table.members.length >= game.min) {
            table.again = []; table.paid = {}; table.nextAt = null;
            table.state = game.create(this.ctxOf(table));
            this.narrate(table, 'A new game! 🎉');
            this.saveTable(table);
            for (const member of table.members) this.sendTable(member, table);
            this.schedule();
            return;
        }
        this.narrate(table, `${this.nameOf(key)} wants to play again!`);
        this.saveTable(table);
    }

    private react(key: string, lineId: unknown, emoji: unknown): void {
        const table = this.tableOf(key);
        if (!table || typeof lineId !== 'string' || typeof emoji !== 'string' || !reactionsFor(levelOf(this.person(key).xp).level).includes(emoji)) return;
        const row = this.sql.exec<{ reacts: string | null; student_key: string }>("SELECT reacts, student_key FROM chat WHERE id = ? AND table_id = ? AND status = 'ok' AND target IS NULL", lineId, table.id).toArray()[0];
        if (!row || row.student_key === 'sys') return;
        const reacts = (row.reacts ? JSON.parse(row.reacts) : {}) as Record<string, string[]>;
        const had = (reacts[emoji] ?? []).includes(key);
        for (const name of Object.keys(reacts)) { reacts[name] = reacts[name].filter(member => member !== key); if (!reacts[name].length) delete reacts[name]; }
        if (!had) (reacts[emoji] ??= []).push(key);
        this.sql.exec('UPDATE chat SET reacts = ? WHERE id = ?', JSON.stringify(reacts), lineId);
        this.toTable(table, { t: 'react', id: table.id, line: lineId, reacts });
    }

    private help(key: string, note: unknown): void {
        const text = typeof note === 'string' ? tidy(note).trim().slice(0, 300) : '';
        const open = this.sql.exec<{ id: string }>("SELECT id FROM alerts WHERE kind = 'help' AND student_key = ? AND status = 'open' AND lesson = ?", key, this.lesson()).toArray()[0];
        if (open) this.sql.exec('UPDATE alerts SET text = ?, ts = ?, count = count + 1 WHERE id = ?', text || 'Asked for help', Date.now(), open.id);
        else this.sql.exec("INSERT INTO alerts (id, ts, lesson, kind, student_key, text) VALUES (?, ?, ?, 'help', ?, ?)", crypto.randomUUID(), Date.now(), this.lesson(), key, text || 'Asked for help');
        this.send(key, { t: 'notice', level: 'info', text: '🙋 Your teacher knows you need help.' });
    }

    private incident(key: string, harm: Harm, text: string): void {
        const kind = `incident:${harm}`;
        const open = this.sql.exec<{ id: string }>("SELECT id FROM alerts WHERE kind = ? AND student_key = ? AND status = 'open' AND lesson = ?", kind, key, this.lesson()).toArray()[0];
        if (open) this.sql.exec('UPDATE alerts SET text = ?, ts = ?, count = count + 1 WHERE id = ?', text.slice(0, 240), Date.now(), open.id);
        else this.sql.exec('INSERT INTO alerts (id, ts, lesson, kind, student_key, text) VALUES (?, ?, ?, ?, ?, ?)', crypto.randomUUID(), Date.now(), this.lesson(), kind, key, text.slice(0, 240));
    }

    private async moderated(text: string): Promise<Moderation> {
        const key = text.trim();
        const known = this.moderations.get(key);
        if (known && Date.now() - known.at < 120_000) return known.verdict;
        const verdict = await moderate(key, this.env);
        if (verdict.result === 'clean' || verdict.result === 'flagged') {
            this.moderations.set(key, { verdict, at: Date.now() });
            if (this.moderations.size > 300) this.moderations.delete(this.moderations.keys().next().value!);
        }
        return verdict;
    }

    // A grammar hint on a message before it is sent. It only ever advises: any doubt means "fine".
    private async grammar(key: string, id: unknown, text: unknown): Promise<void> {
        const now = Date.now();
        let answer: Awaited<ReturnType<typeof checkGrammar>> = { ok: true };
        if (typeof text === 'string' && now - (this.lastCheck.get(key) ?? 0) >= CHECK_GAP_MS && this.env.OPENAI_API_KEY
            && !chatProblem(text) && text.trim().split(/\s+/).length >= MIN_WORDS) {
            this.lastCheck.set(key, now);
            // Never a hint for something harmful: the AI would rewrite it into better English.
            const verdict = await this.moderated(text);
            if (verdict.result === 'clean') answer = await checkGrammar(text, this.env);
        }
        this.send(key, { t: 'checked', id: typeof id === 'string' ? id.slice(0, 64) : '', ...answer });
    }

    private async chat(key: string, data: Extract<ClientMessage, { t: 'chat' }>): Promise<void> {
        const cid = typeof data.cid === 'string' ? data.cid.slice(0, 64) : '';
        const refuse = (text: string, keep = true) => this.send(key, { t: 'refused', cid, text, keep });
        const table = this.tableOf(key);
        if (!table) return refuse('You are not at a table yet.');
        if (this.muted(key)) return refuse('Your teacher paused your chat.');
        const value = typeof data.text === 'string' ? tidy(data.text).trim() : '';
        const now = Date.now();
        if (now - (this.lastChat.get(key) ?? 0) < CHAT_GAP_MS) return refuse('Wait a moment…');
        this.lastChat.set(key, now);

        let problem = chatProblem(value);
        let harm: Harm | null = localHarm(value);
        let flag: string | null = null;
        // On the teacher's laptop every word must be English, whatever the page did.
        if (!problem && this.env.LAN_URL) {
            const { notEnglish } = await import('./english.ts');
            const words = notEnglish(value, this.wordList());
            if (words.length) return refuse(`Use English words only: ${words.map(item => item.word).join(', ')}.`);
        }
        if (!problem) {
            const verdict = await this.moderated(value);
            if (verdict.result === 'flagged') { problem = 'That message cannot be sent. Please rewrite it.'; flag = verdict.categories.join(', '); harm = harmFrom(verdict.categories); }
            else if (verdict.result === 'unchecked') flag = 'moderation unavailable';
        }
        // The class may have closed, or the table ended, while the message was checked.
        if (!this.isOpen() || this.tableOf(key) !== table || this.muted(key)) return refuse('Chat is unavailable right now.');
        const id = crypto.randomUUID();
        const voice = normalizeVoice(this.person(key).look.voice);
        const store = (status: string, note: string | null, marks: string | null = null) => this.sql.exec(
            'INSERT INTO chat (id, ts, lesson, table_id, game, student_key, sender, text, status, flag, note, voice, marks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            id, now, this.lesson(), table.id, table.game, key, this.nameOf(key), value.slice(0, CHAT_MAX), status, flag, note, voice, marks);
        if (problem) {
            store('blocked', problem);
            this.bump(key, 'blocked', 1);
            if (harm) this.incident(key, harm, value);
            return refuse(problem);
        }
        const game = this.gameOf(table);
        const verdict = game.chat(table.state, this.ctxOf(table), key, value);
        if (verdict.block) {
            store('game', verdict.block);
            return refuse(verdict.block);
        }
        // Sent as written although a better version was offered: mark the words that differ, for everyone who reads it.
        const better = typeof data.better === 'string' ? data.better.slice(0, CHAT_MAX) : null;
        const slips = better ? wordDiff(value, better).original : [];
        const note = typeof data.was === 'string' ? `Used the suggestion. They wrote: "${data.was.slice(0, CHAT_MAX)}"` : better ? `Kept their own words. Suggested: "${better}"` : null;
        store(verdict.secret ? 'secret' : 'ok', note, slips.length ? JSON.stringify(slips) : null);
        const line: Line = { id, ts: now, from: key, name: this.nameOf(key), text: value, voice, ...(slips.length ? { marks: slips } : {}), ...(verdict.secret ? { secret: true } : {}) };
        const audience = verdict.secret ? [key] : table.members;
        for (const member of audience) {
            this.sql.exec('INSERT OR IGNORE INTO chat_audience (chat_id, student_key) VALUES (?, ?)', id, member);
            if (member !== key) this.send(member, { t: 'line', id: table.id, line });
        }
        this.send(key, { t: 'sent', cid, line });
        table.count[key] = (table.count[key] ?? 0) + 1; table.total += 1; table.lastTs = now; table.last[key] = now;
        this.bump(key, 'messages', 1, now);
        this.bump(key, 'words', value.split(/\s+/).filter(Boolean).length);
        this.apply(table, verdict);
    }

    // ---------- The teacher ----------

    async teacher(token: string, action: TeacherAction): Promise<TeacherStatus | Failure> {
        if (!this.teacherSignedIn(token)) return { error: 'Please sign in again.', status: 401 };
        const fail = (error: string): Failure => ({ error, status: 400 });
        switch (action.kind) {
            case 'status': break;
            case 'open': this.setOpen(action.open); break;
            case 'start': { const problem = this.startSession(action.options); if (problem) return fail(problem); break; }
            case 'next': if (!this.session) return fail('No activity is running.'); this.nextRound(); break;
            case 'end': if (!this.session) return fail('No activity is running.'); this.endSession('Your teacher ended the activity. Great work! 🎉'); break;
            case 'more':
                if (!this.session?.ends) return fail('This activity has no timer.');
                this.session.ends += Math.min(10, Math.max(1, action.minutes)) * 60_000;
                for (const table of this.tables.values()) if (table.session === this.session.id) for (const key of table.members) this.sendTable(key, table);
                this.saveMemory(); this.schedule();
                break;
            case 'setting':
                if (action.name === 'free') {
                    this.saveSetting('free', action.on ? '1' : '0');
                    if (!action.on) { this.queue = {}; this.queueAt = {}; this.saveMemory(); }
                    this.refreshLounges();
                } else if (action.name === 'soundOff') {
                    this.saveSetting('sound_all_off', action.on ? '1' : '0');
                    for (const key of this.present()) this.send(key, { t: 'sound', off: this.soundOff(key) });
                } else {
                    this.saveSetting('secret_names', action.on ? '1' : '0');
                    this.shown = null;
                    this.renameEveryone();
                }
                break;
            case 'level': this.saveSetting('level', action.level); break;
            case 'custom': this.saveSetting('custom', action.text.slice(0, 12_000)); break;
            case 'mute':
                if (action.on) this.sql.exec('INSERT OR IGNORE INTO mutes (student_key) VALUES (?)', action.key); else this.sql.exec('DELETE FROM mutes WHERE student_key = ?', action.key);
                this.send(action.key, { t: 'muted', muted: action.on });
                break;
            case 'sound':
                if (action.off) this.sql.exec('INSERT OR IGNORE INTO sound_off (student_key) VALUES (?)', action.key); else this.sql.exec('DELETE FROM sound_off WHERE student_key = ?', action.key);
                this.send(action.key, { t: 'sound', off: this.soundOff(action.key) });
                break;
            case 'remove': {
                const row = this.sql.exec<{ table_id: string; student_key: string }>("SELECT table_id, student_key FROM chat WHERE id = ? AND status = 'ok'", action.line).toArray()[0];
                if (!row) return fail('That message is not there any more.');
                this.sql.exec("UPDATE chat SET status = 'removed' WHERE id = ?", action.line);
                const table = this.tables.get(row.table_id);
                if (table) this.toTable(table, { t: 'retract', id: table.id, line: action.line });
                this.send(row.student_key, { t: 'notice', level: 'warning', text: 'Your teacher removed one of your messages.' });
                break;
            }
            case 'say': {
                const text = tidy(action.text).trim().slice(0, 300);
                if (!text) return fail('Write a message.');
                if (action.to === 'all') { this.toAll({ t: 'notice', level: 'teacher', text }); for (const table of this.tables.values()) this.narrate(table, text, 'teacher'); }
                else if (action.to === 'table') { const table = this.tables.get(action.id ?? ''); if (!table) return fail('That table is closed.'); this.narrate(table, text, 'teacher'); }
                else if (action.id) { this.send(action.id, { t: 'notice', level: 'teacher', text }); const table = this.tableOf(action.id); if (table) this.narrate(table, text, 'teacher', action.id); }
                break;
            }
            case 'closeTable': { const table = this.tables.get(action.id); if (table) this.closeTable(table, 'Your teacher closed this table.'); this.refreshLounges(); break; }
            case 'alert': this.sql.exec("UPDATE alerts SET status = 'done' WHERE id = ?", action.id); break;
            case 'star': {
                const report = this.sql.exec<{ members: string; starred: number; title: string }>('SELECT members, starred, title FROM reports WHERE id = ?', action.id).toArray()[0];
                if (!report) return fail('That answer is not there any more.');
                if (!report.starred) {
                    this.sql.exec('UPDATE reports SET starred = 1 WHERE id = ?', action.id);
                    for (const key of JSON.parse(report.members) as string[]) { this.award(key, 3, 'Teacher’s star'); this.send(key, { t: 'notice', level: 'teacher', text: `⭐ Your teacher loved your answer to “${report.title}”! +3` }); }
                }
                break;
            }
        }
        return this.status();
    }

    private setOpen(open: boolean): void {
        if (open === this.isOpen()) return;
        for (const table of [...this.tables.values()]) this.closeTable(table, undefined, false);
        this.session = null; this.queue = {}; this.queueAt = {}; this.gone = {};
        if (!open) {
            this.saveSetting('open', '0');
            for (const ws of this.ctx.getWebSockets()) { try { ws.close(CLOSE_CLASS_CLOSED, 'The class is closed.'); } catch { /* already closing */ } }
        } else {
            // A new lesson: a new PIN, and yesterday's quiet students are not today's.
            const digits = crypto.getRandomValues(new Uint32Array(1))[0] % 900_000 + 100_000;
            this.saveSetting('pin', String(digits));
            this.saveSetting('lesson', String(Date.now()));
            this.saveSetting('open', '1');
            this.shown = null;
        }
        this.saveMemory();
        this.schedule();
    }

    private status(): TeacherStatus {
        const lesson = this.lesson();
        const now = Date.now();
        const names = this.names();
        const stats = new Map(this.sql.exec<{ student_key: string; messages: number; words: number; stars: number; blocked: number; last_ts: number }>(
            'SELECT student_key, messages, words, stars, blocked, last_ts FROM stats WHERE lesson = ?', lesson).toArray().map(row => [row.student_key, row]));
        const mutes = new Set(this.sql.exec<{ student_key: string }>('SELECT student_key FROM mutes').toArray().map(row => row.student_key));
        const silenced = new Set(this.sql.exec<{ student_key: string }>('SELECT student_key FROM sound_off').toArray().map(row => row.student_key));
        const students: TeacherStudent[] = [...names].map(([key, name]) => {
            const person = this.person(key); const stat = stats.get(key);
            return { key, name, real: person.real, look: person.look, online: this.online(key), table: this.seatOf.get(key) ?? null,
                messages: stat?.messages ?? 0, words: stat?.words ?? 0, stars: stat?.stars ?? 0, xp: person.xp, muted: mutes.has(key), soundOff: silenced.has(key),
                lastTs: stat?.last_ts ?? 0, blocked: stat?.blocked ?? 0 };
        }).sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
        const tables: TeacherTable[] = [...this.tables.values()].sort((a, b) => a.started - b.started).map(table => {
            const game = this.gameOf(table);
            const last = this.sql.exec<{ student_key: string; text: string }>("SELECT student_key, text FROM chat WHERE table_id = ? AND status = 'ok' AND target IS NULL ORDER BY ts DESC, rowid DESC LIMIT 3", table.id).toArray().reverse();
            return {
                id: table.id, game: game.id, icon: game.icon, title: game.title, kind: game.kind,
                members: table.members.map(key => ({ key, name: names.get(key) ?? 'Student', here: this.online(key), stars: table.state.stars?.[key] ?? 0, messages: table.count[key] ?? 0 })),
                status: game.status(table.state, this.ctxOf(table)), messages: table.total, lastTs: table.lastTs, over: !!table.state.over,
                last: last.map(row => ({ from: row.student_key, name: row.student_key === 'sys' ? '' : row.student_key === 'teacher' ? 'Teacher' : names.get(row.student_key) ?? 'Student', text: row.text })),
            };
        });
        const alerts: TeacherAlert[] = this.sql.exec<{ id: string; ts: number; kind: string; student_key: string; text: string; count: number }>(
            "SELECT id, ts, kind, student_key, text, count FROM alerts WHERE lesson = ? AND status = 'open' ORDER BY ts DESC LIMIT 30", lesson).toArray()
            .map(row => ({ id: row.id, kind: row.kind === 'help' ? 'help' as const : 'incident' as const, key: row.student_key, name: names.get(row.student_key) ?? 'Student',
                text: row.kind === 'help' ? row.text : `${row.kind.slice('incident:'.length)}: ${row.text}`, ts: row.ts, count: row.count }));
        // Someone at a table where the others are talking, who has written nothing for two minutes.
        for (const table of this.tables.values()) {
            if (table.state.over || now - table.started < 120_000 || now - table.lastTs > 90_000) continue;
            for (const key of table.members) {
                if (this.online(key) && now - (table.last[key] ?? table.started) > 120_000) {
                    alerts.push({ id: `quiet:${table.id}:${key}`, kind: 'quiet', key, name: names.get(key) ?? 'Student', text: `Quiet for ${Math.floor((now - (table.last[key] ?? table.started)) / 60_000)} min while the table talks`, ts: table.last[key] ?? table.started });
                }
            }
        }
        const reports: TeacherReport[] = this.sql.exec<{ id: string; ts: number; title: string; members: string; text: string; starred: number; table_id: string }>(
            'SELECT id, ts, title, members, text, starred, table_id FROM reports WHERE lesson = ? ORDER BY ts DESC LIMIT 40', lesson).toArray()
            .map(row => ({ id: row.id, ts: row.ts, quest: row.title, names: (JSON.parse(row.members) as string[]).map(key => names.get(key) ?? 'Student'), text: row.text, starred: !!row.starred, table: row.table_id }));
        const game = this.session ? gameById(this.session.game) : null;
        return {
            open: this.isOpen(), pin: this.classPin(), free: this.freePlay(), soundOff: this.setting('sound_all_off') === '1', secretNames: this.setting('secret_names') === '1',
            level: this.level(), ai: !!this.env.OPENAI_API_KEY, games: GAMES.map(info),
            topics: [{ id: 'mix', title: 'A mix of topics', emoji: '🎲' }, ...TOPICS.map(topic => ({ id: topic.id, title: topic.title, emoji: topic.emoji })), ...(this.custom().length ? [{ id: 'custom', title: `My questions (${this.custom().length})`, emoji: '📝' }] : [])],
            session: this.session && game ? { id: this.session.id, game: game.id, title: game.title, icon: game.icon, round: this.session.round, rounds: this.session.rounds, ends: this.session.ends, started: this.session.started } : null,
            students, tables, alerts, reports,
            waiting: this.present().filter(key => !this.tableOf(key)).map(key => names.get(key) ?? 'Student'),
            custom: this.setting('custom') ?? '',
        };
    }

    // Everything one table said, for the teacher.
    transcript(token: string, id: string): { lines: (Line & { status: string; note: string | null; flag: string | null })[] } | Failure {
        if (!this.teacherSignedIn(token)) return { error: 'Please sign in again.', status: 401 };
        const names = this.names();
        const rows = this.sql.exec<{ id: string; ts: number; student_key: string; text: string; status: string; target: string | null; tone: string | null; note: string | null; flag: string | null; marks: string | null }>(
            'SELECT id, ts, student_key, text, status, target, tone, note, flag, marks FROM chat WHERE table_id = ? ORDER BY ts, rowid LIMIT 500', id).toArray();
        return { lines: rows.map(row => ({
            id: row.id, ts: row.ts, from: row.student_key, text: row.target ? `(only to ${names.get(row.target) ?? 'one student'}) ${row.text}` : row.text,
            name: row.student_key === 'sys' ? '' : row.student_key === 'teacher' ? 'Teacher' : names.get(row.student_key) ?? 'Student',
            status: row.status, note: row.note, flag: row.flag, ...(row.tone ? { tone: row.tone as Line['tone'] } : {}), ...(row.marks ? { marks: JSON.parse(row.marks) } : {}),
        })) };
    }

    // A prompt the teacher copies into an AI chat to get a report on the lesson: what every student wrote, table by table.
    report(token: string, hideNames: boolean): { prompt: string; key: { code: string; real: string }[] } | Failure {
        if (!this.teacherSignedIn(token)) return { error: 'Please sign in again.', status: 401 };
        const lesson = this.lesson();
        const names = this.names();
        const students = [...names.keys()];
        const code = new Map(students.map((key, index) => [key, hideNames ? `Student ${index + 1}` : names.get(key)!]));
        const hide = (text: string) => !hideNames ? text : students.reduce((result, key) => {
            const name = names.get(key)!;
            return name.length > 1 ? result.replace(new RegExp(`(?<![\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu'), code.get(key)!) : result;
        }, text);
        const rows = this.sql.exec<{ ts: number; table_id: string; game: string; student_key: string; text: string; status: string; note: string | null }>(
            "SELECT ts, table_id, game, student_key, text, status, note FROM chat WHERE lesson = ? AND student_key NOT IN ('sys', 'teacher') ORDER BY table_id, ts LIMIT 4000", lesson).toArray();
        const time = (ts: number) => new Date(ts).toISOString().slice(11, 16);
        const tables = new Map<string, string[]>();
        for (const row of rows) {
            const list = tables.get(row.table_id) ?? []; tables.set(row.table_id, list);
            if (!list.length) list.push(`\n## A table playing ${gameById(row.game)?.title ?? row.game}`);
            const status = row.status === 'ok' ? '' : row.status === 'secret' ? ' [hidden answer]' : row.status === 'blocked' ? ' [BLOCKED by the safety filter]' : row.status === 'game' ? ' [stopped by a game rule]' : row.status === 'removed' ? ' [removed by the teacher]' : '';
            list.push(`${time(row.ts)} ${code.get(row.student_key) ?? 'Student'}: ${JSON.stringify(hide(row.text))}${status}${row.note ? ` (${hide(row.note)})` : ''}`);
        }
        const stats = this.sql.exec<{ student_key: string; messages: number; words: number; stars: number }>('SELECT student_key, messages, words, stars FROM stats WHERE lesson = ?', lesson).toArray();
        const totals = students.map(key => { const stat = stats.find(row => row.student_key === key); return `- ${code.get(key)}: ${stat?.messages ?? 0} messages, ${stat?.words ?? 0} words, ${stat?.stars ?? 0} stars`; });
        const prompt = [
            `You are helping an English teacher review a lesson. The class is at CEFR level ${this.level()}. Students played chat games in small groups (2 to 4 students per table) in HelloChat, a classroom chat game where every task is done by writing to classmates in English.`,
            'Below is everything each table wrote, in order. Please write a short report for the teacher:',
            '1. Who communicated well (quote one good message each).',
            '2. Who needs help, and with what (quote the evidence).',
            '3. Who wrote very little.',
            '4. The five most common language errors in the class, each with a correct model sentence and a two-minute practice idea.',
            '5. Anything unkind or off-task the teacher should know about.',
            'Be specific and brief. Use the names exactly as they appear below.',
            '\n# Totals', ...totals, '\n# What was written', ...[...tables.values()].flat(),
        ].join('\n');
        return { prompt, key: hideNames ? students.map(key => ({ code: code.get(key)!, real: `${this.person(key).real} (${names.get(key)})` })) : [] };
    }
}
