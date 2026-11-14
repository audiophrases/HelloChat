// One student's connection to the class. It keeps what the server last said (who I am, my table, the lounge), tells
// the page when that changes, and rejoins by itself after a dropped connection.
import type { ClientMessage, Line, LoungeInfo, Me, ServerMessage, Style, TableInfo } from '../shared/protocol';
import type { Look } from '../shared/protocol';
import { messageId } from './utils/messageId';

export type Notice = { id: string; level: 'info' | 'warning' | 'teacher'; text: string };
export type RoomState = {
  status: 'connecting' | 'online' | 'reconnecting' | 'stopped';
  stopped?: string;                 // why the page cannot continue: the class closed, another window opened
  me: Me | null;
  names: string[];
  hints: boolean;                   // grammar hints are on
  lounge: LoungeInfo | null;
  table: TableInfo | null;
  arrival: { id: string; why?: string } | null;  // a new table: shown once as a greeting
  leftWhy: string | null;           // why the last table ended
  typing: Record<string, number>;   // classmate -> when they last typed
  notices: Notice[];
  soundOff: boolean;
  muted: boolean;
  gain: { amount: number; at: number } | null;
};

export type GrammarHint = { ok: true } | { ok: false; corrected: string; why: string };
type Sent = { ok: true } | { ok: false; text: string; keep: boolean };

// As in PinPlay's live-socket.js: a connection can die without closing (a laptop lid, Wi-Fi roaming), and only a
// missing pong shows it. The room answers 'ping' without waking up.
const PING_EVERY_MS = 10000;
const PONG_WITHIN_MS = 5000;
const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];
const HINT_WAIT_MS = 3500;

class Refused extends Error {}

export class Room {
  state: RoomState = { status: 'connecting', me: null, names: [], hints: false, lounge: null, table: null, arrival: null, leftWhy: null, typing: {}, notices: [], soundOff: false, muted: false, gain: null };
  private pin: string;
  private token: string;
  private avatar: Look | null;
  private listeners = new Set<() => void>();
  private events = new Set<(message: ServerMessage) => void>();
  private ws: WebSocket | null = null;
  private opening = false;
  private done = false;
  private fails = 0;
  private pingTimer = 0;
  private pongTimer = 0;
  private retryTimer = 0;
  private pending = new Map<string, (result: Sent) => void>();
  private hints = new Map<string, (hint: GrammarHint) => void>();

  // A null avatar keeps the one saved on the server.
  constructor(pin: string, token: string, avatar: Look | null) {
    this.pin = pin; this.token = token; this.avatar = avatar;
    document.addEventListener('visibilitychange', this.wake);
    window.addEventListener('online', this.wake);
    void this.open();
  }

  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = (): RoomState => this.state;
  onEvent(listener: (message: ServerMessage) => void): () => void { this.events.add(listener); return () => { this.events.delete(listener); }; }

  private set(next: Partial<RoomState>): void {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }

  send(message: ClientMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try { this.ws.send(JSON.stringify(message)); return true; } catch { return false; }
  }

  // A chat message: resolves when the server took it or refused it.
  chat(text: string, hint?: { was?: string; better?: string }): Promise<Sent> {
    const cid = messageId();
    return new Promise(resolve => {
      const timer = window.setTimeout(() => { this.pending.delete(cid); resolve({ ok: false, text: 'No answer from the class. Try again.', keep: true }); }, 12000);
      this.pending.set(cid, result => { window.clearTimeout(timer); resolve(result); });
      if (!this.send({ t: 'chat', text, cid, ...hint })) { window.clearTimeout(timer); this.pending.delete(cid); resolve({ ok: false, text: 'You are offline. Wait a moment…', keep: true }); }
    });
  }

  // A grammar hint, or "fine" when none comes in time.
  check(text: string): Promise<GrammarHint> {
    if (!this.state.hints) return Promise.resolve({ ok: true });
    const id = messageId();
    return new Promise(resolve => {
      const timer = window.setTimeout(() => { this.hints.delete(id); resolve({ ok: true }); }, HINT_WAIT_MS);
      this.hints.set(id, hint => { window.clearTimeout(timer); resolve(hint); });
      if (!this.send({ t: 'check', id, text })) { window.clearTimeout(timer); this.hints.delete(id); resolve({ ok: true }); }
    });
  }

  act(act: string, data?: unknown): void { this.send({ t: 'act', act, data }); }
  queue(game: string | null): void { this.send({ t: 'queue', game }); }
  leave(): void { this.send({ t: 'leave' }); }
  again(): void { this.send({ t: 'again' }); }
  react(line: string, emoji: string): void { this.send({ t: 'react', line, emoji }); }
  help(note: string): void { this.send({ t: 'help', note }); }
  style(style: Style): void { this.send({ t: 'style', style }); }
  private lastTyping = 0;
  typing(): void { const now = Date.now(); if (now - this.lastTyping > 2000) { this.lastTyping = now; this.send({ t: 'typing' }); } }

  dismiss(id: string): void { this.set({ notices: this.state.notices.filter(notice => notice.id !== id) }); }
  greeted(): void { this.set({ arrival: null }); }

  stop(): void {
    this.done = true;
    document.removeEventListener('visibilitychange', this.wake);
    window.removeEventListener('online', this.wake);
    window.clearInterval(this.pingTimer); window.clearTimeout(this.pongTimer); window.clearTimeout(this.retryTimer);
    try { this.ws?.close(1000); } catch { /* already closed */ }
  }

  private wake = (): void => {
    if (this.done || document.visibilityState === 'hidden') return;
    if (!this.ws || this.ws.readyState > WebSocket.OPEN) { window.clearTimeout(this.retryTimer); void this.open(); }
    else this.ping();
  };

  private ping(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try { this.ws.send('ping'); } catch { return; }
    window.clearTimeout(this.pongTimer);
    this.pongTimer = window.setTimeout(() => { try { this.ws?.close(); } catch { /* gone */ } this.lost(); }, PONG_WITHIN_MS);
  }

  private lost(): void {
    if (this.done) return;
    window.clearInterval(this.pingTimer); window.clearTimeout(this.pongTimer);
    this.ws = null;
    this.set({ status: 'reconnecting' });
    window.clearTimeout(this.retryTimer);
    this.retryTimer = window.setTimeout(() => void this.open(), BACKOFF_MS[Math.min(this.fails, BACKOFF_MS.length - 1)]);
    this.fails += 1;
  }

  private end(reason: string): void {
    this.done = true;
    window.clearInterval(this.pingTimer); window.clearTimeout(this.pongTimer); window.clearTimeout(this.retryTimer);
    this.set({ status: 'stopped', stopped: reason });
  }

  private async open(): Promise<void> {
    if (this.opening || this.done) return;
    this.opening = true;
    try {
      const response = await fetch('/api/room/join', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-student-token': this.token },
        body: JSON.stringify({ pin: this.pin, avatar: this.avatar }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Trouble on the way (a busy server, a sign-in service asleep) is tried again; a refusal is final.
        if (response.status >= 500 || response.status === 429) throw new Error(result.error);
        throw new Refused(result.error || 'You cannot join right now.');
      }
      this.avatar = null; // saved now: a reconnection keeps it
      const url = new URL('/api/room/ws', window.location.href);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.searchParams.set('ticket', result.ticket);
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => {
        this.fails = 0;
        window.clearInterval(this.pingTimer);
        this.pingTimer = window.setInterval(() => this.ping(), PING_EVERY_MS);
      };
      ws.onmessage = event => {
        if (ws !== this.ws) return;
        if (event.data === 'pong') { window.clearTimeout(this.pongTimer); return; }
        try { this.receive(JSON.parse(event.data as string) as ServerMessage); } catch { /* not ours */ }
      };
      ws.onclose = event => {
        if (ws !== this.ws || this.done) return;
        if (event.code === 4009) this.end('You opened HelloChat in another window. Play there!');
        else if (event.code === 4002) this.end('Your teacher closed the class. See you next time! 👋');
        else if (event.code === 4001) { this.ws = null; void this.open(); }
        else this.lost();
      };
      ws.onerror = () => { /* onclose follows */ };
    } catch (error) {
      if (error instanceof Refused) this.end(error.message);
      else this.lost();
    } finally { this.opening = false; }
  }

  private notice(level: Notice['level'], text: string): void {
    const notice = { id: messageId(), level, text };
    this.set({ notices: [...this.state.notices.slice(-3), notice] });
    if (level !== 'teacher') window.setTimeout(() => this.dismiss(notice.id), 7000);
  }

  private withTable(id: string, change: (table: TableInfo) => TableInfo): void {
    const table = this.state.table;
    if (table && table.id === id) this.set({ table: change(table) });
  }
  private addLine(id: string, line: Line): void {
    this.withTable(id, table => (table.lines.some(old => old.id === line.id) ? table : { ...table, lines: [...table.lines.slice(-150), line] }));
  }

  private receive(message: ServerMessage): void {
    switch (message.t) {
      case 'welcome': this.set({ status: 'online', me: message.me, names: message.names, soundOff: message.soundOff, muted: message.muted, hints: message.hints }); break;
      case 'me': this.set({ me: message.me }); break;
      case 'names': this.set({ names: message.names }); break;
      case 'lounge': this.set({ lounge: message.lounge }); break;
      case 'table': {
        const before = this.state.table;
        if (!message.table) this.set({ table: null, leftWhy: message.why ?? null, typing: {} });
        else this.set({ table: message.table, lounge: null, typing: {}, leftWhy: null,
          arrival: before?.id === message.table.id && before.game.id === message.table.game.id ? this.state.arrival : { id: message.table.id, why: message.why ?? this.state.leftWhy ?? undefined } });
        break;
      }
      case 'view': this.withTable(message.id, table => ({ ...table, view: message.view })); break;
      case 'members': this.withTable(message.id, table => ({ ...table, members: message.members })); break;
      case 'line': {
        this.addLine(message.id, message.line);
        const typing = { ...this.state.typing }; delete typing[message.line.from];
        this.set({ typing });
        break;
      }
      case 'retract': this.withTable(message.id, table => ({ ...table, lines: table.lines.filter(line => line.id !== message.line) })); break;
      case 'react': this.withTable(message.id, table => ({ ...table, lines: table.lines.map(line => (line.id === message.line ? { ...line, reacts: message.reacts } : line)) })); break;
      case 'typing': if (this.state.table?.id === message.id) this.set({ typing: { ...this.state.typing, [message.key]: Date.now() } }); break;
      case 'sent': {
        if (message.line && this.state.table) this.addLine(this.state.table.id, message.line);
        this.pending.get(message.cid)?.({ ok: true }); this.pending.delete(message.cid);
        break;
      }
      case 'refused': this.pending.get(message.cid)?.({ ok: false, text: message.text, keep: message.keep }); this.pending.delete(message.cid); break;
      case 'checked': this.hints.get(message.id)?.(message.ok || !message.corrected ? { ok: true } : { ok: false, corrected: message.corrected, why: message.why ?? '' }); this.hints.delete(message.id); break;
      case 'notice': this.notice(message.level, message.text); break;
      case 'xp': if (this.state.me) this.set({ me: { ...this.state.me, xp: message.xp }, gain: message.gained ? { amount: message.gained, at: Date.now() } : this.state.gain }); break;
      case 'sound': this.set({ soundOff: message.off }); break;
      case 'muted': this.set({ muted: message.muted }); this.notice(message.muted ? 'warning' : 'info', message.muted ? 'Your teacher paused your chat.' : 'You can chat again.'); break;
      case 'bye': this.end(message.why === 'replaced' ? 'You opened HelloChat in another window. Play there!' : 'Your teacher closed the class. See you next time! 👋'); break;
      case 'fx': break;
    }
    for (const listener of this.events) listener(message);
  }
}
