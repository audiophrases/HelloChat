// The student's whole game: the lounge (choose a game, or wait for the teacher) and the table (a board, one line that
// says what to do now, and the chat).
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { GameInfo, Kind, LoungeInfo, Me, Style, TableInfo } from '../../shared/protocol';
import { BUBBLES, FLAIRS, FRAMES, NAME_COLOURS, REWARDS, levelOf, nextReward, titleFor, unlocked } from '../../shared/levels';
import { Room } from '../connection';
import type { RoomState } from '../connection';
import { GameAudio, unlockSound } from '../audio';
import type { SoundState } from '../audio';
import Board from '../components/Widgets';
import Chat from '../components/Chat';
import Face from '../components/Face';
import type { Entry } from '../App';
import './Play.css';

const KINDS: { kind: Kind; title: string; note: string }[] = [
  { kind: 'warmup', title: '⚡ Quick games', note: '3–5 minutes' },
  { kind: 'board', title: '🎲 Board games', note: '8–12 minutes' },
  { kind: 'quest', title: '🗺️ Quests', note: 'solve them together' },
];

function useNow(every = 500): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), every); return () => window.clearInterval(timer); }, [every]);
  return now;
}

const clock = (ms: number): string => { const seconds = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; };

function Timer({ ends, total }: { ends: number; total: number }) {
  const now = useNow(250);
  const left = Math.max(0, ends - now);
  const share = Math.min(1, left / Math.max(1, total));
  return <div className={`timer${left < 10_000 ? ' low' : ''}`} role="timer" aria-label={`${clock(left)} left`}>
    <div className="timer-bar"><i style={{ width: `${share * 100}%` }} /></div>
    <span>{clock(left)}</span>
  </div>;
}

// ---------- Levels and looks ----------

function LevelPill({ me, onOpen, gain }: { me: Me; onOpen: () => void; gain: RoomState['gain'] }) {
  const { level, into, need } = levelOf(me.xp);
  const fresh = gain && Date.now() - gain.at < 2500;
  return <button type="button" className="level" onClick={onOpen} title="Your level and looks">
    <span className="level-n">Lv {level}</span>
    <span className="level-bar"><i style={{ width: `${(into / need) * 100}%` }} /></span>
    <span className="level-xp">⭐ {me.xp}</span>
    {fresh && <span key={gain.at} className="level-gain">+{gain.amount} ⭐</span>}
  </button>;
}

function Looks({ me, room, onClose }: { me: Me; room: Room; onClose: () => void }) {
  const { level, into, need } = levelOf(me.xp);
  const next = nextReward(level);
  const set = (change: Partial<Style>) => room.style({ ...me.style, ...change });
  const locked = (id: Parameters<typeof unlocked>[0]) => !unlocked(id, level);
  return <div className="overlay" onClick={onClose}>
    <div className="card modal" onClick={event => event.stopPropagation()} role="dialog" aria-label="Your level">
      <h2>Level {level} · {titleFor(level)}</h2>
      <p className="muted">{need - into} more ⭐ for level {level + 1}{next ? `: you will unlock ${next.icon} ${next.name}` : ''}. Win stars by chatting in games!</p>
      {REWARDS.map(reward => <div key={reward.id} className={`looks-row${locked(reward.id) ? ' locked' : ''}`}>
        <strong>{reward.icon} {reward.name} {locked(reward.id) && <small>🔒 level {reward.level}</small>}</strong>
        <div className="looks-options">
          {reward.id === 'colour' && NAME_COLOURS.map((colour, index) => <button key={colour} type="button" disabled={locked('colour')} className={me.style.colour === index ? 'on' : ''} style={{ color: colour }} onClick={() => set({ colour: index })}>Aa</button>)}
          {reward.id === 'flair' && [null, ...FLAIRS].map(flair => <button key={flair ?? 'none'} type="button" disabled={locked('flair')} className={me.style.flair === flair ? 'on' : ''} onClick={() => set({ flair })}>{flair ?? '∅'}</button>)}
          {reward.id === 'bubble' && BUBBLES.map((colour, index) => <button key={colour} type="button" disabled={locked('bubble')} className={me.style.bubble === index ? 'on' : ''} onClick={() => set({ bubble: index })}><i style={{ background: colour }} /></button>)}
          {reward.id === 'frame' && FRAMES.map((colour, index) => <button key={colour} type="button" disabled={locked('frame')} className={me.style.frame === index ? 'on' : ''} onClick={() => set({ frame: index })}><i style={{ background: index ? colour : '#fff', border: index ? 'none' : '2px dashed #bbb' }} /></button>)}
          {reward.id === 'reactions' && <span className="muted">😮 🎉 🤔 👏 on your classmates’ messages</span>}
        </div>
      </div>)}
      <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
    </div>
  </div>;
}

function Help({ room, onClose }: { room: Room; onClose: () => void }) {
  const [note, setNote] = useState('');
  return <div className="overlay" onClick={onClose}>
    <div className="card modal" onClick={event => event.stopPropagation()} role="dialog" aria-label="Ask your teacher">
      <h2>🙋 Ask your teacher</h2>
      <p className="muted">Write what you need. You can write in any language here.</p>
      <textarea className="input-field" rows={3} maxLength={300} autoFocus value={note} onChange={event => setNote(event.target.value)} placeholder="I don’t understand…" />
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-go" onClick={() => { room.help(note); onClose(); }}>Call my teacher</button>
      </div>
    </div>
  </div>;
}

// ---------- The lounge ----------

function Lounge({ lounge, room, why }: { lounge: LoungeInfo; room: Room; why: string | null }) {
  if (!lounge.free) {
    return <main className="lounge lounge-wait">
      <div className="card waitcard">
        {lounge.session ? <>
          <span className="waitcard-icon bounce">{lounge.session.icon}</span>
          <h2>{lounge.session.title}</h2>
          <p>{lounge.session.note}</p>
        </> : <>
          <span className="waitcard-icon">☕</span>
          <h2>{why ?? 'You are in!'}</h2>
          <p>Wait for your teacher to start a game.</p>
        </>}
        <p className="muted">{lounge.online} student{lounge.online === 1 ? '' : 's'} here</p>
      </div>
    </main>;
  }
  const queued = lounge.queued ? lounge.games.find(game => game.id === lounge.queued) : null;
  return <main className="lounge">
    {why && <p className="lounge-why">{why}</p>}
    <div className="lounge-head">
      <h2>{queued ? `Waiting for players for ${queued.title}…` : 'Choose a game!'}</h2>
      <p className="muted">{queued ? 'Tell your classmates to choose it too. Tap the card again to stop waiting.' : `Tap a game. When a classmate taps the same game, you play together. ${lounge.online} here now.`}</p>
    </div>
    {KINDS.map(group => {
      const games = lounge.games.filter(game => game.kind === group.kind);
      if (!games.length) return null;
      return <section key={group.kind} className="lounge-group">
        <h3>{group.title} <small>{group.note}</small></h3>
        <div className="lounge-games">
          {games.map(game => <GameCard key={game.id} game={game} waiting={lounge.waiting[game.id] ?? []} mine={lounge.queued === game.id}
            onPick={() => { unlockSound(); room.queue(lounge.queued === game.id ? null : game.id); }} />)}
        </div>
      </section>;
    })}
  </main>;
}

function GameCard({ game, waiting, mine, onPick }: { game: GameInfo; waiting: string[]; mine: boolean; onPick: () => void }) {
  const others = waiting.length - (mine ? 1 : 0);
  return <button type="button" className={`gamecard${mine ? ' mine' : ''}${others > 0 ? ' hot' : ''}`} onClick={onPick}>
    <span className="gamecard-icon">{game.icon}</span>
    <span className="gamecard-body">
      <strong>{game.title}</strong>
      <span>{game.blurb}</span>
      <small>👥 {game.min === game.max ? game.min : `${game.min}–${game.max}`} players · ⏱ {game.minutes} min</small>
    </span>
    {mine ? <span className="gamecard-tag wait">⏳ Waiting… tap to cancel</span>
      : others > 0 ? <span className="gamecard-tag join">👋 {waiting.slice(0, 2).join(' and ')}{waiting.length > 2 ? ` +${waiting.length - 2}` : ''} {waiting.length > 1 ? 'are' : 'is'} waiting. Join!</span>
        : <span className="gamecard-tag">▶ Play</span>}
  </button>;
}

// ---------- The table ----------

const seenKey = (game: string) => `hellochat.how.${game}`;
const hasSeen = (game: string): boolean => { try { return localStorage.getItem(seenKey(game)) === '1'; } catch { return false; } };

// A new table: who you are with, and (the first time for a game) how to play in three steps.
function Greeting({ table, me, why, onDone, force }: { table: TableInfo; me: string; why?: string; onDone: () => void; force: boolean }) {
  const first = force || !hasSeen(table.game.id);
  const mates = table.members.filter(member => member.key !== me);
  useEffect(() => {
    if (first) return;
    const timer = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(timer);
  }, [first, onDone]);
  const done = () => { try { localStorage.setItem(seenKey(table.game.id), '1'); } catch { /* storage disabled */ } onDone(); };
  return <div className="overlay greeting" onClick={first ? undefined : onDone}>
    <div className="card modal greeting-card" role="dialog" aria-label={table.game.title}>
      {why && !force && <p className="greeting-why">{why}</p>}
      <span className="greeting-icon">{table.game.icon}</span>
      <h2>{table.game.title}</h2>
      {!force && <div className="greeting-mates">
        <span>You play with</span>
        {mates.map(member => <span key={member.key} className="greeting-mate"><span className="face-lg"><Face player={member.look} name={member.name} /></span><b>{member.name}</b></span>)}
      </div>}
      {first && <>
        <ol className="how">{table.game.how.map((step, index) => <li key={index}><b>{index + 1}</b><span>{step}</span></li>)}</ol>
        <button type="button" className="btn btn-go btn-lg" autoFocus onClick={done}>OK, let’s play! ▶</button>
      </>}
    </div>
  </div>;
}

function TableView({ table, state, room, audio, sound }: { table: TableInfo; state: RoomState; room: Room; audio: GameAudio | null; sound: SoundState | null }) {
  const me = state.me!;
  const view = table.view;
  const [how, setHow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const act = (name: string, data?: unknown) => { unlockSound(); room.act(name, data); };
  const greeting = state.arrival?.id === table.id;
  const sessionEnds = table.session?.ends ?? null;
  const members = useMemo(() => new Map(table.members.map(member => [member.key, member])), [table.members]);

  return <main className="table">
    <header className="table-head">
      <div className="table-game">
        <span className="table-icon">{table.game.icon}</span>
        <div>
          <strong>{table.game.title}</strong>
          <small>
            {table.session && table.session.rounds > 1 ? `Round ${table.session.round} of ${table.session.rounds}` : view.round ? `${view.round.n} of ${view.round.of}` : ''}
          </small>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => setHow(true)} title="How to play">❓<span className="hide-small"> How to play</span></button>
      </div>
      <div className="seats">
        {view.seats.map(seat => {
          const member = members.get(seat.key);
          return <div key={seat.key} className={`seat${seat.turn ? ' turn' : ''}${member && !member.here ? ' away' : ''}`}>
            <span className="framed" style={{ background: FRAMES[member?.style.frame ?? 0] }}><Face player={member?.look} name={member?.name} /></span>
            <span className="seat-name">{seat.key === me.key ? 'You' : member?.name}{member && !member.here ? ' 💤' : ''}</span>
            <span className="seat-stars">⭐ {seat.stars}</span>
            {seat.tag && <span className="seat-tag">{seat.tag}</span>}
          </div>;
        })}
      </div>
      <div className="table-right">
        {sessionEnds && <div className="round-clock" title="Time left in this round">⏳ <RoundClock ends={sessionEnds} /></div>}
        {(table.free || view.over) && <button type="button" className="btn btn-sm" onClick={() => (view.over ? room.leave() : setLeaving(true))}>🚪 Leave</button>}
      </div>
    </header>

    <div className={`now tone-${view.now.tone}`} role="status" aria-live="assertive">
      <span className="now-badge">{view.now.tone === 'go' ? 'YOUR MOVE' : view.now.tone === 'wait' ? 'WAIT' : 'FINISHED'}</span>
      <div className="now-text">
        <strong key={view.now.text}>{view.now.text}</strong>
        {view.now.sub && <span>{view.now.sub}</span>}
      </div>
      {view.timer && <Timer ends={view.timer.ends} total={view.timer.total} />}
      {view.actions && view.actions.length > 0 && <div className="now-actions">
        {view.actions.map(action => <button key={action.label} type="button" className={`btn btn-lg ${action.ghost ? '' : 'btn-go'}`} onClick={() => act(action.act, action.data)}>{action.label}</button>)}
      </div>}
    </div>

    <div className="table-body">
      <div className="table-board">
        {view.over && <section className="card over">
          <span className="over-icon">🏆</span>
          <h2>{view.over.title}</h2>
          <ul>{view.over.lines.map(line => <li key={line}>{line}</li>)}</ul>
          {table.free ? <div className="over-actions">
            <button type="button" className="btn btn-go btn-lg" onClick={() => room.again()}>🔁 Play again</button>
            <button type="button" className="btn btn-lg" onClick={() => room.leave()}>🏠 Other games</button>
          </div> : <p className="muted">Great work! Something new is coming…</p>}
        </section>}
        <Board widgets={view.board} members={table.members} me={me.key} act={act} />
      </div>
      <div className="table-chat">
        <Chat room={room} table={table} me={me.key} xp={me.xp} names={state.names} typing={state.typing} muted={state.muted} audio={audio} sound={sound} />
      </div>
    </div>

    {(greeting || how) && <Greeting table={table} me={me.key} why={state.arrival?.why} force={how && !greeting} onDone={() => { setHow(false); room.greeted(); }} />}
    {leaving && <div className="overlay" onClick={() => setLeaving(false)}>
      <div className="card modal" onClick={event => event.stopPropagation()} role="dialog">
        <h2>Leave this table?</h2>
        <p className="muted">Your classmates will have to stop playing too.</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-go" onClick={() => setLeaving(false)}>Stay and play</button>
          <button type="button" className="btn btn-danger" onClick={() => { setLeaving(false); room.leave(); }}>Leave</button>
        </div>
      </div>
    </div>}
  </main>;
}

function RoundClock({ ends }: { ends: number }) { const now = useNow(); return <b>{clock(ends - now)}</b>; }

// ---------- The page ----------

export default function Play({ entry, onExit }: { entry: Entry; onExit: () => void }) {
  // The connection lives as long as this page does, and is closed with it.
  const [room, setRoom] = useState<Room | null>(null);
  useEffect(() => {
    const next = new Room(entry.pin, entry.token, entry.avatar);
    setRoom(next);
    return () => next.stop();
  }, [entry]);
  return room ? <Playing room={room} entry={entry} onExit={onExit} /> : null;
}

function Playing({ room, entry, onExit }: { room: Room; entry: Entry; onExit: () => void }) {
  const state = useSyncExternalStore(room.subscribe, room.snapshot);
  const [looks, setLooks] = useState(false);
  const [help, setHelp] = useState(false);
  const [burst, setBurst] = useState<{ id: number; kind: string } | null>(null);

  // Sound: classmates' messages read aloud in their voice, and a chime for stars and turns.
  const key = state.me?.key;
  const audio = useMemo(() => (key ? new GameAudio(entry.token, key) : null), [entry.token, key]);
  const [sound, setSound] = useState<SoundState | null>(null);
  useEffect(() => { if (!audio) return; const off = audio.subscribe(setSound); return () => { off(); audio.dispose(); }; }, [audio]);
  useEffect(() => { audio?.setLocked(state.soundOff); }, [audio, state.soundOff]);
  useEffect(() => room.onEvent(message => {
    if (message.t === 'line' && message.line.voice && message.line.from !== key) audio?.receive(message.line.id);
    if (message.t === 'table') for (const line of message.table?.lines ?? []) audio?.receive(line.id, true);
    if (message.t === 'retract') audio?.retract(message.line);
    if (message.t === 'fx') {
      if (message.kind === 'good' || message.kind === 'win') audio?.goal();
      if (message.kind === 'turn' || message.kind === 'star') audio?.ping();
      setBurst({ id: Date.now(), kind: message.kind });
    }
  }), [room, audio, key]);
  useEffect(() => { if (!burst) return; const timer = window.setTimeout(() => setBurst(null), 1400); return () => window.clearTimeout(timer); }, [burst]);
  useEffect(() => {
    const unlock = () => unlockSound();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  if (state.status === 'stopped') {
    return <div className="lounge lounge-wait"><div className="card waitcard">
      <span className="waitcard-icon">👋</span>
      <h2>{state.stopped}</h2>
      <button type="button" className="btn btn-primary btn-lg" onClick={onExit}>Back to the start</button>
    </div></div>;
  }
  if (!state.me) return <div className="lounge lounge-wait"><div className="card waitcard"><span className="waitcard-icon bounce">💬</span><h2>Joining your class…</h2></div></div>;
  const me = state.me;
  const burstIcon = burst ? { good: '✅', bad: '❌', win: '🏆', boom: '💥', star: '⭐', turn: '👉' }[burst.kind] : null;

  return <div className="play">
    <header className="topbar">
      <span className="topbar-logo">💬 HelloChat</span>
      <span className="topbar-me">
        <span className="framed" style={{ background: FRAMES[me.style.frame] }}><Face player={me.look} name={me.name} /></span>
        <b style={{ color: NAME_COLOURS[me.style.colour] }}>{me.style.flair ? `${me.style.flair} ` : ''}{me.name}</b>
      </span>
      <LevelPill me={me} gain={state.gain} onOpen={() => setLooks(true)} />
      <span className="topbar-space" />
      {audio && <button type="button" className="btn btn-sm" disabled={state.soundOff} title={state.soundOff ? 'Your teacher turned the sound off' : 'Sound'}
        onClick={() => (sound?.needsInteraction ? unlockSound() : audio.setMuted(!sound?.muted))}>{state.soundOff ? '🔒' : sound?.muted ? '🔇' : '🔊'}<span className="hide-small"> {state.soundOff || sound?.muted ? 'Sound off' : sound?.needsInteraction ? 'Tap for sound' : 'Sound on'}</span></button>}
      <button type="button" className="btn btn-sm" onClick={() => setHelp(true)}>🙋<span className="hide-small"> Help</span></button>
    </header>
    {state.status === 'reconnecting' && <div className="offline" role="alert">📡 Connecting again… your game is safe.</div>}

    {state.table ? <TableView table={state.table} state={state} room={room} audio={audio} sound={sound} />
      : state.lounge ? <Lounge lounge={state.lounge} room={room} why={state.leftWhy} />
        : <div className="lounge lounge-wait"><div className="card waitcard"><span className="waitcard-icon bounce">💬</span><h2>One moment…</h2></div></div>}

    <div className="notices" aria-live="polite">
      {state.notices.map(notice => <div key={notice.id} className={`notice ${notice.level}`}>
        <span>{notice.level === 'teacher' ? '👩‍🏫 ' : ''}{notice.text}</span>
        <button type="button" onClick={() => room.dismiss(notice.id)} aria-label="Close">✕</button>
      </div>)}
    </div>
    {burst && burstIcon && <div key={burst.id} className={`burst ${burst.kind}`} aria-hidden="true">{burstIcon}</div>}
    {looks && <Looks me={me} room={room} onClose={() => setLooks(false)} />}
    {help && <Help room={room} onClose={() => setHelp(false)} />}
  </div>;
}
