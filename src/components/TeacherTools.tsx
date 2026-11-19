import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameInfo, GameSetting, HistoryPage, Level, PrivateLine, TeacherStatus, TeacherStudent } from '../../shared/protocol';
import AvatarEditor from './AvatarEditor';
import type { Api } from '../pages/Teacher';
import { joinLink } from '../studentAuth';
import { copyText } from '../utils/copy';

type Common = { api: Api; flash: (text: string) => void };
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';

export function History({ api, flash, studentKey = '' }: Common & { studentKey?: string }) {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<HistoryPage>({ lines: [], next: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const url = `history?key=${encodeURIComponent(studentKey)}&q=${encodeURIComponent(query)}`;
  const load = useCallback(async (before = 0) => {
    const request = ++generation.current; setBusy(true); setError('');
    try {
      const result = await api<HistoryPage>(`${url}&before=${before}`);
      if (request === generation.current) setData(old => ({ ...result, lines: before ? [...old.lines, ...result.lines] : result.lines }));
    } catch (cause) { if (request === generation.current) setError(errorText(cause)); }
    finally { if (request === generation.current) setBusy(false); }
  }, [api, url]);
  useEffect(() => { invalidate(); const timer = window.setTimeout(() => void load(), 250); return () => { window.clearTimeout(timer); invalidate(); }; }, [load, invalidate]);
  return <section className="t-history">
    <h3>{studentKey ? 'All conversations and attempts' : 'Search every message and attempt'}</h3>
    <div className="t-say"><input className="input-field" type="search" aria-label="Search message history" placeholder="Search words across lessons…" value={query} onChange={e => setQuery(e.target.value)} /><button className="btn" onClick={() => void load()} disabled={busy}>Refresh</button></div>
    <p className="muted">Newest first. Browser-stopped drafts are labelled; only submitted attempts are recorded.</p>
    {error && <p role="alert">{error}</p>}
    <div className="t-transcript">{data.lines.map(line => <div className={`t-line s-${line.status}`} key={line.id}>
      <time>{new Date(line.ts).toLocaleString()}</time><span><b>{line.name || 'Game'}</b> {line.text}<small> {line.status} · {line.table || 'lounge'}{line.note ? ` · ${line.note}` : ''}{line.flag ? ` · ${line.flag}` : ''}</small></span>
      {line.from !== 'sys' && line.from !== 'teacher' && line.status === 'ok' && <>
        <button title="Star message (+5 XP)" disabled={line.starred} onClick={() => void api('chat-star', { id: line.id }).then(() => load()).catch(cause => flash(errorText(cause)))}>{line.starred ? '★' : '☆'}</button>
        <button title="Remove message" onClick={() => void api('remove', { line: line.id }).then(() => load()).catch(cause => flash(errorText(cause)))}>🗑</button>
      </>}
    </div>)}</div>
    {!busy && !data.lines.length && <p className="muted">No matching attempts.</p>}
    {data.next !== null && <button className="btn" disabled={busy} onClick={() => void load(data.next!)}>{busy ? 'Loading…' : 'Load older messages'}</button>}
  </section>;
}

export function StudentDrawer({ student, api, flash, onClose }: Common & { student: TeacherStudent; onClose: () => void }) {
  const [name, setName] = useState(student.real);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [lines, setLines] = useState<PrivateLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = () => void api<{ lines: PrivateLine[] }>(`private?key=${encodeURIComponent(student.key)}`).then(result => { if (active) { setLines(result.lines); setError(''); } }).catch(cause => { if (active) setError(errorText(cause)); });
    load(); const timer = window.setInterval(load, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [api, student.key]);
  const act = (path: string, body: unknown) => api(path, body).catch(cause => flash(errorText(cause)));
  return <div className="overlay" onClick={onClose}><aside className="card t-drawer" role="dialog" aria-modal="true" aria-label={`${student.name}'s details`} onClick={e => e.stopPropagation()}>
    <header><h2>{student.name}</h2><button className="btn" onClick={onClose}>Close</button></header>
    <p>{student.real} · {student.messages} messages · {student.words} words · {student.xp} XP</p>
    {(student.away || student.tabSwitches > 0) && <p className="t-tab-line">
      {student.away && <span className="t-tab-badge now">⚠️ Left the page right now</span>}
      {student.tabSwitches > 0 && <span className="t-tab-badge">⚠️ Left the page {student.tabSwitches}×</span>}
    </p>}
    <p className="muted">Leaving the page counts when the student switches to another tab or app, or minimises the window. It does not show what they opened.</p>
    <div className="modal-actions"><button className="btn" onClick={() => void act('mute', { key: student.key, on: !student.muted })}>{student.muted ? 'Let them chat' : 'Pause their chat'}</button><button className="btn" onClick={() => void act('sound', { key: student.key, off: !student.soundOff })}>{student.soundOff ? 'Give sound back' : 'Turn sound off'}</button><button className="btn" onClick={() => setEditing(!editing)}>Edit name or character</button></div>
    {editing && <div><label>Name<input className="input-field" value={name} maxLength={60} onChange={e => setName(e.target.value)} /></label><AvatarEditor mode="teacher" initialConfig={student.look} busy={busy} onCancel={() => setEditing(false)} onSave={look => {
      setBusy(true); void api('student', { key: student.key, name, look }).then(() => setEditing(false)).catch(cause => flash(errorText(cause))).finally(() => setBusy(false));
    }} /></div>}
    <h3>Private teacher chat</h3>
    {error && <p role="alert">{error}</p>}
    <div className="t-private" role="log">{lines.map(line => <p key={line.id}><small>{new Date(line.ts).toLocaleTimeString()}</small> <b>{line.from === 'teacher' ? 'You' : student.name}:</b> {line.text}</p>)}{!lines.length && <p className="muted">No private messages yet.</p>}</div>
    <form className="t-say" onSubmit={e => { e.preventDefault(); if (!text.trim() || busy) return; setBusy(true); void api('say', { to: 'student', id: student.key, text }).then(() => setText('')).catch(cause => flash(errorText(cause))).finally(() => setBusy(false)); }}><input className="input-field" aria-label="Private message" maxLength={240} value={text} onChange={e => setText(e.target.value)} placeholder="Write privately to this student…" /><button className="btn btn-primary" disabled={busy || !text.trim()}>Send</button></form>
    <History api={api} flash={flash} studentKey={student.key} />
  </aside></div>;
}

// Every class with its name, its PIN and its link, which stay the same lesson after lesson.
export function ClassList({ status, api, flash }: Common & { status: TeacherStatus }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const base = status.laptop?.signInUrl ?? window.location.origin;
  const run = (work: () => Promise<unknown>) => { setBusy(true); return work().catch(cause => { flash(errorText(cause)); throw cause; }).finally(() => setBusy(false)); };
  const rename = (id: string) => void run(() => api('classroom-name', { id, name: draft })).then(() => setEditing(null), () => { /* shown */ });
  const open = (id: string) => void run(async () => { if (id !== status.activeClass) await api('classroom', { id }); await api('class', { open: true }); }).catch(() => { /* shown */ });
  const newPin = (id: string, className: string) => {
    if (window.confirm(`Make a new PIN for ${className}? The old PIN and link stop working, so you will need to share the new link.`))
      void run(() => api('classroom-pin', { id })).then(() => flash(`${className} has a new PIN. Copy its new link for your students.`), () => { /* shown */ });
  };
  const copy = (className: string, pin: string) => void copyText(joinLink(base, pin)).then(copied => { if (copied) flash(`${className}’s link copied. It stays the same every lesson.`); });
  return <div className="t-classes">
    {status.classes.map(item => {
      const active = item.id === status.activeClass;
      return <div key={item.id} className={`t-class${active && status.open ? ' open' : ''}`}>
        {editing === item.id
          ? <form className="t-class-rename" onSubmit={event => { event.preventDefault(); rename(item.id); }}>
            <input className="input-field" aria-label={`New name for ${item.name}`} value={draft} maxLength={60} autoFocus onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setEditing(null); }} />
            <button className="btn btn-sm btn-primary" disabled={busy || !draft.trim()}>Save</button>
            <button type="button" className="btn btn-sm" onClick={() => setEditing(null)}>Cancel</button>
          </form>
          : <span className="t-class-name"><b>{item.name}</b>{active && status.open && <span className="t-chip">open now</span>}
            <button type="button" className="link-btn" title={`Rename ${item.name}`} aria-label={`Rename ${item.name}`} onClick={() => { setEditing(item.id); setDraft(item.name); }}>✏️ Rename</button></span>}
        <span className="t-class-pin" title="This PIN stays the same every lesson">PIN <b>{item.pin}</b></span>
        <span className="t-class-actions">
          <button type="button" className="btn btn-sm" title={joinLink(base, item.pin)} onClick={() => copy(item.name, item.pin)}>🔗 Copy link</button>
          {!status.open && <button type="button" className="btn btn-sm btn-go" disabled={busy} onClick={() => open(item.id)}>▶ Open</button>}
          <button type="button" className="link-btn t-class-newpin" disabled={busy} onClick={() => newPin(item.id, item.name)}>New PIN</button>
        </span>
      </div>;
    })}
    <form className="t-say" onSubmit={e => { e.preventDefault(); void run(() => api('classroom', { name })).then(() => setName(''), () => { /* shown */ }); }}>
      <input className="input-field" aria-label="New class name" value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="A new class, e.g. 4ESOB" />
      <button className="btn" disabled={busy || status.open || !name.trim()} title={status.open ? 'Close the class first' : undefined}>Add class</button>
    </form>
  </div>;
}

// ---------- Game times and rules ----------

const UNIT: Record<GameSetting['unit'], string> = { s: 'seconds', min: 'minutes', n: '' };
const usualFor = (setting: GameSetting, level: Level): number => (level === 'A1' && setting.a1 !== undefined ? setting.a1 : setting.def);
const changedSettings = (game: GameInfo): number => (game.settings ?? []).filter(setting => setting.value !== undefined).length;
const sorted = (values: Record<string, string>): string => JSON.stringify(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)));

// One game's times and numbers. A field the teacher has not changed shows the usual value and follows it.
export function GameSettingsForm({ game, level, api, flash }: Common & { game: GameInfo; level: Level }) {
  const settings = game.settings ?? [];
  const saved = Object.fromEntries(settings.filter(setting => setting.value !== undefined).map(setting => [setting.key, String(setting.value)]));
  const [draft, setDraft] = useState<Record<string, string>>(saved);
  const [busy, setBusy] = useState(false);
  const dirty = sorted(draft) !== sorted(saved);
  const save = async (next: Record<string, number>) => {
    setBusy(true);
    try {
      await api('game-settings', { game: game.id, values: next });
      setDraft(Object.fromEntries(Object.entries(next).map(([key, value]) => [key, String(value)])));
      flash(Object.keys(next).length ? `${game.title}: saved. Free play and class activities use it from the next turn.` : `${game.title}: back to the usual times and rules.`);
    } catch (cause) { flash(errorText(cause)); } finally { setBusy(false); }
  };
  const submit = () => {
    const next: Record<string, number> = {};
    for (const setting of settings) {
      const text = draft[setting.key];
      if (text === undefined || text.trim() === '' || !Number.isFinite(Number(text))) continue;
      next[setting.key] = Math.min(setting.max, Math.max(setting.min, Math.round(Number(text))));
    }
    void save(next);
  };
  return <form className="t-game-settings" onSubmit={event => { event.preventDefault(); submit(); }}>
    {settings.map(setting => {
      const usual = usualFor(setting, level);
      const changed = draft[setting.key] !== undefined;
      const id = `gs-${game.id}-${setting.key}`;
      return <div key={setting.key} className={`t-setting${changed ? ' changed' : ''}`}>
        <label htmlFor={id}>{setting.label}</label>
        <span className="t-setting-input">
          <input id={id} className="input-field" type="number" inputMode="numeric" min={setting.min} max={setting.max} step={1}
            value={draft[setting.key] ?? String(usual)} onChange={event => { const text = event.target.value; setDraft(current => ({ ...current, [setting.key]: text })); }} />
          <small>{UNIT[setting.unit]}</small>
        </span>
        <span className="t-setting-usual">
          {changed ? <button type="button" className="link-btn" title={`Back to the usual ${usual}`} onClick={() => setDraft(current => { const rest = { ...current }; delete rest[setting.key]; return rest; })}>↺ usual: {usual}</button>
            : <small className="muted">usual{setting.a1 !== undefined ? ` (A1: ${setting.a1}, others: ${setting.def})` : ''}</small>}
        </span>
      </div>;
    })}
    <div className="t-setting-actions">
      <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !dirty}>Save {game.title}</button>
      {changedSettings(game) > 0 && <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void save({})}>↺ All back to usual</button>}
      <small className="muted">For free play and class activities, in every class. Games already running change from the next turn.</small>
    </div>
  </form>;
}

// ---------- Allowed words ----------

// Names, titles and places the English check stops: the teacher sees which ones came up and lets them through.
function AllowedWords({ status, api, flash }: Common & { status: TeacherStatus }) {
  const [text, setText] = useState('');
  const allow = (words: string[]) => api('allow-words', { words })
    .then(() => flash(words.length === 1 ? `“${words[0]}” is allowed now, for every student.` : `${words.length} words are allowed now, for every student.`))
    .catch(cause => flash(errorText(cause)));
  return <>
    <p className="muted">The chat stops words that are not English. Names of films, games, singers, footballers and places are often stopped too: allow the ones you want. Slurs and insults can never be allowed, and every message is still checked for safety.</p>
    <h4 className="t-allow-title">Stopped this lesson</h4>
    {status.stopped.length ? <ul className="t-stopped">
      {status.stopped.map(item => <li key={item.word}>
        <span><b>{item.word}</b> <small>×{item.count} · {item.names.join(', ')}</small><br /><small className="muted">“{item.example}”</small></span>
        <button type="button" className="btn btn-sm" onClick={() => void allow([item.word])}>✓ Allow</button>
      </li>)}
    </ul> : <p className="muted">Nothing stopped yet this lesson.</p>}
    <form className="t-say" onSubmit={event => { event.preventDefault(); const words = text.split(/[\n,]+/).map(word => word.trim()).filter(Boolean); if (words.length) void allow(words).then(() => setText('')); }}>
      <input className="input-field" value={text} maxLength={600} aria-label="Names or words to allow" placeholder="Allow a name or word: Encanto, Valls, Bad Bunny…" onChange={event => setText(event.target.value)} />
      <button className="btn" disabled={!text.trim()}>Allow</button>
    </form>
    {status.allowed.length > 0 && <>
      <h4 className="t-allow-title">Allowed ({status.allowed.length})</h4>
      <div className="t-allowed">{status.allowed.map(word => <span key={word} className="t-chip">{word}
        <button type="button" title={`Stop allowing “${word}”`} aria-label={`Stop allowing ${word}`} onClick={() => void api('unallow-word', { word }).catch(cause => flash(errorText(cause)))}>✕</button></span>)}</div>
    </>}
  </>;
}

function GameSettings({ status, api, flash }: Common & { status: TeacherStatus }) {
  const [picked, setPicked] = useState(status.games[0]?.id ?? '');
  const game = status.games.find(item => item.id === picked) ?? status.games[0];
  const groups: [string, string][] = [['warmup', 'Warm-ups'], ['board', 'Board games'], ['quest', 'Side quests']];
  if (!game) return null;
  return <>
    <p className="muted">How long students have for each step, and how many words, turns or rounds each game asks for.</p>
    <label className="t-setting-game">Game{' '}
      <select value={game.id} onChange={event => setPicked(event.target.value)}>
        {groups.map(([kind, title]) => <optgroup key={kind} label={title}>
          {status.games.filter(item => item.kind === kind).map(item => <option key={item.id} value={item.id}>{item.icon} {item.title}{changedSettings(item) ? ' (changed)' : ''}</option>)}
        </optgroup>)}
      </select>
    </label>
    <GameSettingsForm key={game.id} game={game} level={status.level} api={api} flash={flash} />
  </>;
}

export function LessonControls({ status, api, flash }: Common & { status: TeacherStatus }) {
  const [words, setWords] = useState('');
  const [phrase, setPhrase] = useState('');
  const [plays, setPlays] = useState<{ id: string; ts: number; text: string; key: string; name: string }[]>([]);
  const [error, setError] = useState('');
  const [heardOpen, setHeardOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const act = (path: string, body: unknown) => api(path, body).catch(cause => flash(errorText(cause)));
  useEffect(() => {
    if (!heardOpen) return;
    let active = true;
    const load = () => void api<{ plays: typeof plays }>(`heard?q=${encodeURIComponent(phrase)}`).then(result => { if (active) { setPlays(result.plays); setError(''); } }).catch(cause => { if (active) setError(errorText(cause)); });
    const delay = window.setTimeout(load, 250); const timer = window.setInterval(load, 3000);
    return () => { active = false; window.clearTimeout(delay); window.clearInterval(timer); };
  }, [api, phrase, heardOpen]);
  return <section className="card t-tools">
    <details id="lesson-words"><summary>Blocked words for this lesson ({status.blocked.words.length})</summary>
      <p className="muted">Stops disguised spellings too and takes matching chat messages down. Resets when a new lesson opens.</p>
      <form className="t-say" onSubmit={e => { e.preventDefault(); void api('words', { words: words.split('\n').map(word => word.trim()).filter(Boolean) }).then(() => setWords('')).catch(cause => flash(errorText(cause))); }}><textarea className="input-field" aria-label="Words or phrases to block" placeholder="One word or phrase per line" value={words} maxLength={3000} onChange={e => setWords(e.target.value)} /><button className="btn" disabled={!status.open || !words.trim()}>Block</button></form>
      {status.blocked.words.map(term => <p key={term.key}><b>{term.words}</b> · {term.stopped} stopped · {term.removed} removed <button className="btn btn-sm" onClick={() => void act('unblock', { key: term.key })}>Allow again</button>{term.by.length > 0 && <small> {term.by.map(person => `${person.name}: ${person.count}`).join(', ')}</small>}</p>)}
      {status.blocked.before.length > 0 && <button className="btn" disabled={!status.open} onClick={() => void act('words', { words: status.blocked.before })}>Block last lesson’s words again: {status.blocked.before.join(', ')}</button>}
    </details>
    {status.blocked.repeats.map(repeat => <div className="t-repeat" key={repeat.key}><p><b>{repeat.students.length} students are repeating “{repeat.words}”.</b> Block it for this lesson?</p><p className="muted">{repeat.examples.join(' · ')}</p><button className="btn" disabled={!status.open} onClick={() => void act('words', { words: [repeat.words] })}>Block phrase</button> <button className="btn" onClick={() => void act('allow-repeat', repeat)}>Leave it alone</button></div>)}
    <details id="heard-something" onToggle={e => setHeardOpen(e.currentTarget.open)}><summary>Heard something?</summary><p className="muted">Playback reported by students’ devices in the last 15 minutes.</p><input className="input-field" type="search" value={phrase} aria-label="Find a phrase read aloud" placeholder="Type the phrase you heard…" onChange={e => setPhrase(e.target.value)} />{error && <p role="alert">{error}</p>}<div className="t-private">{plays.map(play => <p key={play.id}><q>{play.text}</q> — {play.name} · {new Date(play.ts).toLocaleTimeString()} <button className="btn btn-sm" onClick={() => void act('sound', { key: play.key, off: true })}>Silence device</button></p>)}{!plays.length && <p>No matching playback.</p>}</div></details>
    <details id="message-history" onToggle={e => setHistoryOpen(e.currentTarget.open)}><summary>Search message history</summary>{historyOpen && <History api={api} flash={flash} />}</details>
    <details id="allowed-words"><summary>Allowed names and words ({status.allowed.length}){status.stopped.length ? ` · ${status.stopped.length} stopped this lesson` : ''}</summary><AllowedWords status={status} api={api} flash={flash} /></details>
    <details id="game-settings"><summary>⏱ Game times and rules{status.games.some(game => changedSettings(game) > 0) ? ` (${status.games.filter(game => changedSettings(game) > 0).length} changed)` : ''}</summary><GameSettings status={status} api={api} flash={flash} /></details>
    <details id="saved-classes"><summary>Classes: {status.classes.find(item => item.id === status.activeClass)?.name}</summary><p className="muted">Each class keeps its PIN and link for good. Progress and history are saved when you switch; close the class first.</p><ClassList status={status} api={api} flash={flash} /></details>
  </section>;
}

export function CommandPalette({ status, api, flash, onStudent, onTable, onReport }: Common & { status: TeacherStatus; onStudent: (key: string) => void; onTable: (id: string) => void; onReport: () => void }) {
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(''); const [index, setIndex] = useState(0);
  const opener = useRef<HTMLElement | null>(null);
  const close = () => { setOpen(false); opener.current?.focus(); };
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); opener.current = document.activeElement as HTMLElement; setOpen(value => !value); setQuery(''); setIndex(0); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  const section = (id: string) => { const element = document.getElementById(id) as HTMLDetailsElement | null; if (element) { element.open = true; element.scrollIntoView({ behavior: 'smooth' }); element.querySelector<HTMLElement>('input,textarea,button')?.focus(); } };
  const commands = [
    { label: status.open ? 'Close class' : 'Open class', run: () => void api('class', { open: !status.open }).catch(cause => flash(errorText(cause))) },
    { label: status.soundOff ? 'Give everyone sound' : 'Turn everyone’s sound off', run: () => void api('setting', { name: 'soundOff', on: !status.soundOff }).catch(cause => flash(errorText(cause))) },
    { label: 'Class report', run: onReport },
    ...[['lesson-words', 'Blocked words'], ['heard-something', 'Heard something?'], ['message-history', 'Search messages'], ['saved-classes', 'Classes: rename, links, PINs']].map(([id, label]) => ({ label, run: () => section(id) })),
    ...status.students.map(student => ({ label: `Student: ${student.name} (${student.real})`, run: () => onStudent(student.key) })),
    ...status.tables.map(table => ({ label: `Table: ${table.title} — ${table.members.map(member => member.name).join(', ')}`, run: () => onTable(table.id) }))
  ].filter(command => command.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const execute = (position: number) => { const command = commands[position]; if (command) { close(); command.run(); } };
  return <><button className="btn btn-sm" onClick={e => { opener.current = e.currentTarget; setOpen(true); setQuery(''); setIndex(0); }}>Commands <kbd>Ctrl K</kbd></button>{open && <div className="overlay" onClick={close}><div className="card modal" role="dialog" aria-modal="true" aria-label="Commands" onClick={e => e.stopPropagation()} onKeyDown={e => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(value => Math.min(value + 1, commands.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(value => Math.max(0, value - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); execute(index); }
  }}><input className="input-field" autoFocus aria-label="Search commands" value={query} onChange={e => { setQuery(e.target.value); setIndex(0); }} placeholder="Find a student, table, or control…" /><div className="t-command-list">{commands.map((command, position) => <button className={`btn ${index === position ? 'btn-primary' : ''}`} key={command.label} onClick={() => execute(position)}>{command.label}</button>)}</div>{!commands.length && <p>No matching commands.</p>}<button className="btn" onClick={close}>Close</button></div></div>}</>;
}
