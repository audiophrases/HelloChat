// The teacher's page: open the class, start an activity for everyone with one click, and watch every table talk.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameInfo, Kind, Level, Line, StartOptions, TeacherStatus, TeacherTable } from '../../shared/protocol';
import { StudentDrawer, LessonControls, CommandPalette } from '../components/TeacherTools';
import Face from '../components/Face';
import { joinLink as makeJoinLink } from '../studentAuth';
import './Teacher.css';

// Copies text, also where the clipboard API is missing (a laptop page opened over plain http).
// When nothing works, the link is shown in a box to copy by hand.
async function copyText(text: string): Promise<boolean> {
  try { if (navigator.clipboard) { await navigator.clipboard.writeText(text); return true; } } catch { /* try the old way */ }
  const box = document.createElement('textarea');
  box.value = text; box.setAttribute('readonly', ''); box.style.position = 'fixed'; box.style.opacity = '0';
  document.body.appendChild(box); box.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { /* not allowed */ }
  box.remove();
  if (!copied) window.prompt('Copy this link for your students:', text);
  return copied;
}

const KEY = 'hellochat-teacher-session';
const readToken = (): string => { try { return sessionStorage.getItem(KEY) ?? ''; } catch { return ''; } };
const storeToken = (token: string): void => { try { if (token) sessionStorage.setItem(KEY, token); else sessionStorage.removeItem(KEY); } catch { /* works without storage */ } };

const KINDS: { kind: Kind; title: string; note: string }[] = [
  { kind: 'warmup', title: '⚡ Warm-ups', note: 'A few minutes. Each round, everyone gets a new partner.' },
  { kind: 'board', title: '🎲 Board games', note: 'Ten minutes or more at one table. Tables that finish early get bonus quests.' },
  { kind: 'quest', title: '🗺️ Side quests', note: 'Tables pick quest cards: split clues, role-plays, riddles and 200 talk tasks.' },
];
const QUESTION_GAMES = ['speedchat', 'pingpong', 'hotpotato', 'trail'];
const clock = (ms: number): string => { const seconds = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; };
const ago = (ts: number, now: number): string => { if (!ts) return 'nothing yet'; const seconds = Math.max(0, Math.floor((now - ts) / 1000)); return seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)} min ago`; };

export type Api = <T = TeacherStatus>(path: string, body?: unknown) => Promise<T>;

function SignIn({ onToken }: { onToken: (token: string, notice: string) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = useCallback(async (value: string) => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/teacher/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: value }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not sign in.');
      onToken(result.token, result.notice || '');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not sign in.'); } finally { setBusy(false); }
  }, [onToken]);
  // tester.bat opens /teacher?autologin=tester on its throwaway server.
  useEffect(() => {
    const auto = new URLSearchParams(window.location.search).get('autologin');
    if (auto) { history.replaceState(null, '', window.location.pathname); void submit(auto); }
  }, [submit]);
  return <div className="t-signin">
    <form className="card" onSubmit={event => { event.preventDefault(); void submit(password); }}>
      <h1>💬 HelloChat</h1>
      <p className="muted">Teacher controls</p>
      <label className="input-label" htmlFor="password">Teacher password</label>
      <input id="password" className="input-field" type="password" autoFocus value={password} onChange={event => setPassword(event.target.value)} />
      {error && <p role="alert" className="t-error">{error}</p>}
      <button className="btn btn-primary btn-lg" type="submit" disabled={busy || !password}>Sign in</button>
      <a href="/">Student page</a>
    </form>
  </div>;
}

function Starter({ status, api, flash }: { status: TeacherStatus; api: Api; flash: (text: string) => void }) {
  const [kind, setKind] = useState<Kind>('warmup');
  const [picked, setPicked] = useState<string | null>(null);
  const [topic, setTopic] = useState('mix');
  const [size, setSize] = useState(0);
  const [rounds, setRounds] = useState(3);
  const [minutes, setMinutes] = useState(4);
  const [custom, setCustom] = useState(status.custom);
  const [editing, setEditing] = useState(false);
  const games = status.games.filter(game => game.kind === kind);
  const game = status.games.find(item => item.id === picked) ?? null;
  const online = status.students.filter(student => student.online).length;

  const choose = (item: GameInfo) => {
    setPicked(item.id);
    setSize(Math.min(item.max, Math.max(item.min, item.kind === 'warmup' ? 2 : 3)));
    setRounds(item.kind === 'warmup' ? 3 : 1);
    setMinutes(item.kind === 'warmup' ? item.minutes : item.kind === 'board' ? 12 : 10);
  };
  const start = async () => {
    if (!game) return;
    const options: StartOptions = { game: game.id, level: status.level, size, rounds, minutes, topic: QUESTION_GAMES.includes(game.id) ? topic : 'mix' };
    try { await api('start', options); setPicked(null); } catch (cause) { flash(cause instanceof Error ? cause.message : 'Could not start.'); }
  };

  return <section className="card t-starter">
    <h2>Start an activity for everyone</h2>
    <div className="t-tabs">{KINDS.map(group => <button key={group.kind} type="button" className={kind === group.kind ? 'on' : ''} onClick={() => { setKind(group.kind); setPicked(null); }}>{group.title}</button>)}</div>
    <p className="muted">{KINDS.find(group => group.kind === kind)!.note}</p>
    <div className="t-games">
      {games.map(item => <button key={item.id} type="button" className={`t-game${picked === item.id ? ' on' : ''}`} onClick={() => choose(item)}>
        <span className="t-game-icon">{item.icon}</span>
        <span><strong>{item.title}</strong><small>{item.blurb}</small><em>{item.min === item.max ? item.min : `${item.min}–${item.max}`} players · {item.levels.includes(status.level) ? status.level : `best at ${item.levels[0]}`}</em></span>
      </button>)}
    </div>
    {game && <div className="t-options">
      <h3>{game.icon} {game.title}</h3>
      <ol className="t-how">{game.how.map(step => <li key={step}>{step}</li>)}</ol>
      <div className="t-option-row">
        {QUESTION_GAMES.includes(game.id) && <label>Questions about
          <select value={topic} onChange={event => setTopic(event.target.value)}>{status.topics.map(item => <option key={item.id} value={item.id}>{item.emoji} {item.title}</option>)}</select>
        </label>}
        <label>Students per table
          <select value={size} onChange={event => setSize(Number(event.target.value))}>
            {Array.from({ length: game.max - game.min + 1 }, (_, index) => game.min + index).map(count => <option key={count} value={count}>{count}</option>)}
          </select>
        </label>
        <label>Rounds (new partners)
          <select value={rounds} onChange={event => setRounds(Number(event.target.value))}>{[1, 2, 3, 4, 5, 6].map(count => <option key={count} value={count}>{count}</option>)}</select>
        </label>
        <label>Minutes per round
          <select value={minutes} onChange={event => setMinutes(Number(event.target.value))}>
            {[0, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30].map(count => <option key={count} value={count}>{count === 0 ? 'No timer' : count}</option>)}
          </select>
        </label>
      </div>
      <button type="button" className="btn btn-go btn-lg" disabled={online < game.min} onClick={() => void start()}>
        ▶ Start {game.title} for {online} student{online === 1 ? '' : 's'}
      </button>
      {online < game.min && <p className="muted">This needs at least {game.min} students in the class.</p>}
      {rounds > 1 && minutes === 0 && <p className="muted">Without a timer, press “Next round” yourself to change partners.</p>}
    </div>}
    <details className="t-custom" open={editing} onToggle={event => setEditing((event.target as HTMLDetailsElement).open)}>
      <summary>📝 My own questions ({status.topics.find(item => item.id === 'custom') ? 'ready' : 'none yet'})</summary>
      <p className="muted">One question on each line. They appear as the topic “My questions” in Speed Chat, Ping-Pong, Hot Potato and Question Trail.</p>
      <textarea className="input-field" rows={6} value={custom} onChange={event => setCustom(event.target.value)} placeholder={'What did you do at the weekend?\nWhat is the best film you have seen?'} />
      <button type="button" className="btn btn-sm" onClick={() => void api('custom', { text: custom }).then(() => flash('Questions saved.'))}>Save questions</button>
    </details>
  </section>;
}

function TableDrawer({ table, api, onClose, flash }: { table: TeacherTable; api: Api; onClose: () => void; flash: (text: string) => void }) {
  const [lines, setLines] = useState<(Line & { status: string; note: string | null; flag: string | null; starred: boolean })[]>([]);
  const [text, setText] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    const load = () => api<{ lines: typeof lines }>(`transcript?id=${table.id}`).then(result => { if (active) setLines(result.lines); }).catch(() => { /* next poll */ });
    void load();
    const timer = window.setInterval(load, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [api, table.id]);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [lines.length]);
  const say = async () => { if (!text.trim()) return; try { await api('say', { to: 'table', id: table.id, text }); setText(''); } catch (cause) { flash(cause instanceof Error ? cause.message : 'Not sent.'); } };
  return <div className="overlay" onClick={onClose}>
    <aside className="card t-drawer" onClick={event => event.stopPropagation()}>
      <header>
        <h2>{table.icon} {table.title}</h2>
        <button type="button" className="btn btn-sm" onClick={onClose}>✕ Close</button>
      </header>
      <p className="muted">{table.members.map(member => `${member.name} (⭐${member.stars}, ${member.messages} msgs)`).join(' · ')}</p>
      <p><b>Now:</b> {table.status}</p>
      <div className="t-transcript" ref={box}>
        {lines.map(line => <div key={line.id} className={`t-line s-${line.status} ${line.from === 'sys' ? 'sys' : line.from === 'teacher' ? 'teacher' : ''}`}>
          <time>{new Date(line.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
          <span><b>{line.from === 'sys' ? '🎲' : line.name}</b> {line.text}
            {line.status === 'blocked' && <em> — blocked ({line.flag || 'word filter'})</em>}
            {line.status === 'game' && <em> — stopped by a game rule</em>}
            {line.status === 'secret' && <em> — hidden answer</em>}
            {line.status === 'removed' && <em> — removed</em>}
            {line.note && <small> {line.note}</small>}
          </span>
          {line.status === 'ok' && line.from !== 'sys' && line.from !== 'teacher' && <button type="button" title="Star message (+5 XP)" disabled={line.starred} onClick={() => void api('chat-star', { id: line.id }).catch(cause => flash(cause.message))}>{line.starred ? '★' : '☆'}</button>}
          {line.status === 'ok' && line.from !== 'sys' && line.from !== 'teacher' && <button type="button" title="Remove this message" onClick={() => void api('remove', { line: line.id }).catch(() => flash('Could not remove it.'))}>🗑</button>}
        </div>)}
        {!lines.length && <p className="muted">Nobody has written yet.</p>}
      </div>
      <form className="t-say" onSubmit={event => { event.preventDefault(); void say(); }}>
        <input className="input-field" value={text} maxLength={300} onChange={event => setText(event.target.value)} placeholder="Write to this table as the teacher…" />
        <button className="btn btn-primary" type="submit" disabled={!text.trim()}>Send</button>
      </form>
      <button type="button" className="btn btn-sm btn-danger" onClick={() => { void api('close-table', { id: table.id }); onClose(); }}>End this table’s game</button>
    </aside>
  </div>;
}

function Report({ api, onClose }: { api: Api; onClose: () => void }) {
  const [hide, setHide] = useState(true);
  const [data, setData] = useState<{ prompt: string; key: { code: string; real: string }[] } | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setData(null); void api<{ prompt: string; key: { code: string; real: string }[] }>(`report?names=${hide ? 'hide' : 'show'}`).then(setData).catch(() => setData({ prompt: 'Could not build the report.', key: [] })); }, [api, hide]);
  return <div className="overlay" onClick={onClose}>
    <div className="card modal t-report" onClick={event => event.stopPropagation()}>
      <h2>📋 Class report</h2>
      <p className="muted">Copy this and paste it into an AI chat your school allows (ChatGPT, Claude, Gemini…). It asks who did well, who needs help, and for the class’s common errors.</p>
      <label><input type="checkbox" checked={hide} onChange={event => setHide(event.target.checked)} /> Hide names (Student 1, Student 2…)</label>
      <textarea className="input-field" rows={12} readOnly value={data?.prompt ?? 'Building…'} />
      {data && data.key.length > 0 && <details><summary>Who is who (stays on this screen)</summary><ul>{data.key.map(entry => <li key={entry.code}><b>{entry.code}</b>: {entry.real}</li>)}</ul></details>}
      <div className="modal-actions">
        <button type="button" className="btn btn-primary" disabled={!data} onClick={() => { void navigator.clipboard?.writeText(data?.prompt ?? '').then(() => setCopied(true)); }}>{copied ? '✓ Copied' : 'Copy'}</button>
        <button type="button" className="btn" onClick={onClose}>Close</button>
      </div>
    </div>
  </div>;
}

export default function Teacher() {
  const [token, setToken] = useState(readToken);
  const [status, setStatus] = useState<TeacherStatus | null>(null);
  const [message, setMessage] = useState('');
  const [openTable, setOpenTable] = useState<string | null>(null);
  const [openStudent, setOpenStudent] = useState<string | null>(null);
  const [report, setReport] = useState(false);
  const [all, setAll] = useState('');
  const [now, setNow] = useState(Date.now());
  const seen = useRef(0);

  const flash = useCallback((text: string) => { setMessage(text); window.setTimeout(() => setMessage(current => (current === text ? '' : current)), 6000); }, []);
  const api: Api = useCallback(async (path: string, body?: unknown) => {
    const response = await fetch(`/api/teacher/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'x-teacher-session': token, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) { storeToken(''); setToken(''); }
    if (!response.ok) throw new Error(result.error || 'Something went wrong.');
    if (result && typeof result === 'object' && 'students' in result) { setStatus(result as TeacherStatus); if ((result as TeacherStatus).notice) flash((result as TeacherStatus).notice!); }
    return result;
  }, [token, flash]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const load = () => { if (active && document.visibilityState !== 'hidden') void api('status').catch(() => { /* next poll */ }); };
    load();
    const timer = window.setInterval(load, 2000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { active = false; window.clearInterval(timer); window.clearInterval(tick); };
  }, [token, api]);

  // A beep and the tab title when something new needs the teacher.
  const urgent = status?.alerts.filter(alert => alert.kind !== 'quiet').length ?? 0;
  useEffect(() => {
    document.title = urgent ? `(${urgent}) HelloChat · Teacher` : 'HelloChat · Teacher';
    if (urgent > seen.current) {
      try { const audio = new AudioContext(); const tone = audio.createOscillator(); const gain = audio.createGain(); tone.frequency.value = 880; gain.gain.value = .08; tone.connect(gain).connect(audio.destination); tone.start(); tone.stop(audio.currentTime + .18); } catch { /* no sound */ }
    }
    seen.current = urgent;
  }, [urgent]);

  const table = useMemo(() => status?.tables.find(item => item.id === openTable) ?? null, [status, openTable]);
  const student = useMemo(() => status?.students.find(item => item.key === openStudent) ?? null, [status, openStudent]);

  if (!token) return <SignIn onToken={(value, notice) => { storeToken(value); setToken(value); if (notice) flash(notice); }} />;
  if (!status) return <p style={{ padding: '2rem' }}>Loading…</p>;
  const online = status.students.filter(item => item.online);
  const joinLink = makeJoinLink(status.laptop?.signInUrl ?? window.location.origin, status.pin ?? '');
  const copyLink = () => void copyText(joinLink).then(copied => { if (copied) flash('Student link copied. Paste it wherever your students will see it.'); });
  const set = (name: 'free' | 'soundOff' | 'secretNames', on: boolean) => void api('setting', { name, on });

  return <div className="teacher">
    <header className="t-top">
      <strong className="t-logo">💬 HelloChat <small>Teacher</small></strong>
      {status.open ? <>
        <button type="button" className="t-pin" title="Click to copy the link for students" onClick={copyLink}>
          <small>Class PIN</small><b>{status.pin}</b>
        </button>
        <button type="button" className="btn btn-sm btn-primary" title={joinLink} onClick={copyLink}>🔗 Copy student link</button>
        <span className="t-count">👥 {online.length} here</span>
        <label className="t-toggle" title="When no activity is running, students choose their own games"><input type="checkbox" checked={status.free} onChange={event => set('free', event.target.checked)} /> Free play</label>
        <label className="t-toggle" title="Messages are read aloud in each student’s voice. Headphones recommended."><input type="checkbox" checked={!status.soundOff} onChange={event => set('soundOff', !event.target.checked)} /> Sound</label>
        <label className="t-toggle" title="Students get made-up names like Happy Plato"><input type="checkbox" checked={status.secretNames} onChange={event => set('secretNames', event.target.checked)} /> Secret names</label>
        <label className="t-toggle">Level <select value={status.level} onChange={event => void api('level', { level: event.target.value as Level })}><option>A1</option><option>A2</option><option>B1</option></select></label>
      </> : <span className="muted">The class is closed.</span>}
      <span className="t-space" />
      <CommandPalette status={status} api={api} flash={flash} onStudent={setOpenStudent} onTable={setOpenTable} onReport={() => setReport(true)} />
      {!status.ai && <span className="t-warn" title="Set OPENAI_API_KEY for AI moderation and grammar hints. The word filter still checks every message.">⚠ No AI checks</span>}
      {status.open && <button type="button" className="btn btn-sm" onClick={() => setReport(true)}>📋 Report</button>}
      <button type="button" className={`btn ${status.open ? 'btn-danger' : 'btn-go'}`} onClick={() => { if (!status.open || window.confirm('Close the class? Everyone is sent out.')) void api('class', { open: !status.open }); }}>{status.open ? 'Close class' : 'Open class'}</button>
      <button type="button" className="btn btn-sm" onClick={() => { storeToken(''); setToken(''); }}>Sign out</button>
    </header>
    {message && <div className="t-flash" role="status">{message}</div>}

    <LessonControls key={status.activeClass} status={status} api={api} flash={flash} />
    {!status.open ? <div className="t-closed card">
      <h1>Ready when you are</h1>
      <ol>
        <li>Press <b>Open class</b>. You get a PIN for this lesson.</li>
        <li>Students open this site, sign in and type the PIN.</li>
        <li>They can play straight away (free play), or you start an activity for everyone.</li>
      </ol>
      <button type="button" className="btn btn-go btn-lg" onClick={() => void api('class', { open: true })}>Open class</button>
    </div> : <div className="t-main">
      <div className="t-col">
        {status.session ? <section className="card t-session">
          <h2>{status.session.icon} {status.session.title} is running</h2>
          <p><b>Round {status.session.round} of {status.session.rounds}</b>{status.session.ends ? <> · <span className="t-clock">{clock(status.session.ends - now)}</span> left</> : ' · no timer'}</p>
          <div className="t-session-actions">
            {status.session.round < status.session.rounds && <button type="button" className="btn btn-primary" onClick={() => void api('next', {})}>🔄 Next round now</button>}
            {status.session.ends && <button type="button" className="btn" onClick={() => void api('more', { minutes: 1 })}>+1 minute</button>}
            <button type="button" className="btn btn-danger" onClick={() => void api('end', {})}>⏹ End activity</button>
          </div>
          {status.waiting.length > 0 && <p className="muted">Waiting for a partner: {status.waiting.join(', ')}</p>}
        </section> : <Starter status={status} api={api} flash={flash} />}
        <section className="card t-all">
          <h3>📢 Message for everyone</h3>
          <form className="t-say" onSubmit={event => { event.preventDefault(); if (all.trim()) void api('say', { to: 'all', text: all }).then(() => { setAll(''); flash('Sent to everyone.'); }); }}>
            <input className="input-field" value={all} maxLength={300} onChange={event => setAll(event.target.value)} placeholder="Two more minutes!" />
            <button className="btn btn-primary" type="submit" disabled={!all.trim()}>Send</button>
          </form>
        </section>
        {status.reports.length > 0 && <section className="card t-reports">
          <h3>✍️ Quest answers</h3>
          {status.reports.map(item => <div key={item.id} className="t-report-item">
            <div><b>{item.quest}</b> <small>{item.names.join(', ')}</small><p>{item.text}</p></div>
            <button type="button" className="btn btn-sm" disabled={item.starred} onClick={() => void api('star', { id: item.id })}>{item.starred ? '⭐ Starred' : '☆ Star (+3)'}</button>
          </div>)}
        </section>}
      </div>

      <div className="t-col t-wide">
        {status.alerts.length > 0 && <section className="card t-alerts">
          <h3>Needs you</h3>
          {status.alerts.map(alert => <div key={alert.id} className={`t-alert ${alert.kind}`}>
            <span>{alert.kind === 'help' ? '🙋' : alert.kind === 'incident' ? '🚨' : '😶'}</span>
            <button type="button" className="link-btn" onClick={() => setOpenStudent(alert.key)}>{alert.name}</button>
            <span className="t-alert-text">{alert.text}{alert.count && alert.count > 1 ? ` (×${alert.count})` : ''}</span>
            {alert.kind !== 'quiet' && <button type="button" className="btn btn-sm" onClick={() => void api('alert', { id: alert.id })}>✓ Done</button>}
          </div>)}
        </section>}
        <section className="t-tables">
          <h3>Tables <small>{status.tables.length ? 'click a table to read everything and write to it' : ''}</small></h3>
          {!status.tables.length && (online.length
            ? <p className="card t-empty">{status.free ? 'Nobody is playing yet. Students can choose a game, or you can start an activity for everyone.' : 'Free play is off: students wait for you to start an activity.'}</p>
            : <div className="card t-empty">
              <p>No students yet. Write the PIN on the board, or share this link: it opens the game with the PIN already filled in.</p>
              <div className="t-share">
                <input className="input-field" readOnly value={joinLink} aria-label="Link for students" onFocus={event => event.currentTarget.select()} />
                <button type="button" className="btn btn-primary" onClick={copyLink}>🔗 Copy</button>
              </div>
            </div>)}
          <div className="t-table-grid">
            {status.tables.map(item => <button key={item.id} type="button" className={`card t-table${item.over ? ' over' : ''}${now - item.lastTs > 90_000 && !item.over ? ' silent' : ''}`} onClick={() => setOpenTable(item.id)}>
              <header><span>{item.icon} {item.title}</span><small>{item.messages} msgs · {ago(item.lastTs, now)}</small></header>
              <div className="t-table-members">{item.members.map(member => <span key={member.key} className={member.here ? '' : 'away'}>{member.name} <small>⭐{member.stars} · {member.messages}</small></span>)}</div>
              <p className="t-table-status">{item.over ? 'Finished' : item.status}</p>
              <div className="t-table-last">{item.last.map((line, index) => <p key={index}><b>{line.from === 'sys' ? '🎲' : line.name}</b> {line.text}</p>)}</div>
            </button>)}
          </div>
        </section>
      </div>

      <aside className="t-col t-students card">
        <h3>Students <small>{online.length} of {status.students.length}</small></h3>
        {status.students.map(item => <button key={item.key} type="button" className={`t-student${item.online ? '' : ' away'}`} onClick={() => setOpenStudent(item.key)}>
          <Face player={item.look} name={item.name} />
          <span className="t-student-name">{item.name}{status.secretNames ? <small> {item.real}</small> : ''}{item.muted ? ' 🤐' : ''}{item.soundOff ? ' 🔇' : ''}</span>
          <span className="t-student-stats" title="Messages this lesson, and stars">{item.messages} 💬 · ⭐{item.stars} · ↗{item.tabSwitches}</span>
          {item.online && !item.table && <span className="t-chip">free</span>}
        </button>)}
        {!status.students.length && <p className="muted">Nobody has joined yet.</p>}
      </aside>
    </div>}

    {table && <TableDrawer table={table} api={api} flash={flash} onClose={() => setOpenTable(null)} />}
    {student && <StudentDrawer key={`${status.activeClass}:${student.key}`} student={student} api={api} flash={flash} onClose={() => setOpenStudent(null)} />}
    {report && <Report api={api} onClose={() => setReport(false)} />}
  </div>;
}
