// The table's chat. Everything a student does in a game they do here: the instruction above says what to write,
// the ideas under it start the sentence, and the box checks the English before it is sent.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Line, Member, TableInfo } from '../../shared/protocol';
import { blockedIn } from '../../shared/blockedWords';
import { BUBBLES, FRAMES, NAME_COLOURS, levelOf, reactionsFor } from '../../shared/levels';
import type { GrammarHint, Room } from '../connection';
import { loadChecker } from '../spellingData';
import type { Checker, Misspelling } from '../spelling';
import type { GameAudio, SoundState } from '../audio';
import Face from './Face';
import './Chat.css';

type Props = { room: Room; table: TableInfo; me: string; xp: number; names: string[]; typing: Record<string, number>; muted: boolean; audio: GameAudio | null; sound: SoundState | null };

// Words on the board are English for this game, whatever the dictionary says ("tuk-tuk", a made-up person's name).
function boardWords(table: TableInfo): string[] {
  const texts: string[] = [];
  for (const widget of table.view.board) {
    if (widget.w === 'card') texts.push(widget.title, widget.text ?? '', ...(widget.banned ?? []));
    if (widget.w === 'grid') for (const cell of widget.cells) texts.push(cell.label ?? '');
    if (widget.w === 'options') for (const option of widget.options) texts.push(option.label);
    if (widget.w === 'story') for (const die of widget.dice ?? []) texts.push(die.word);
    if (widget.w === 'items') for (const item of widget.items) texts.push(item.text);
  }
  return texts.join(' ').split(/[^\p{L}'’-]+/u).filter(word => word.length > 1);
}

function Marked({ line }: { line: Line }) {
  if (!line.marks?.length) return <>{line.text}</>;
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const [start, end] of line.marks) {
    if (start > at) parts.push(line.text.slice(at, start));
    parts.push(<u key={start} className="chat-slip" title="Check this word">{line.text.slice(start, end)}</u>);
    at = end;
  }
  parts.push(line.text.slice(at));
  return <>{parts}</>;
}

export default function Chat({ room, table, me, xp, names, typing, muted, audio, sound }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [wrong, setWrong] = useState<Misspelling[]>([]);
  const [hint, setHint] = useState<{ original: string; hint: Extract<GrammarHint, { ok: false }> } | null>(null);
  const [checker, setChecker] = useState<Checker | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [nudge, setNudge] = useState(false);
  const [, tick] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const declined = useRef(0);
  const members = useMemo(() => new Map(table.members.map(member => [member.key, member])), [table.members]);
  const view = table.view;
  const go = view.now.tone === 'go';

  useEffect(() => { void loadChecker().then(loaded => setChecker(() => loaded)).catch(() => { /* chat carries on without the check */ }); }, []);
  useEffect(() => { const box = list.current; if (box) box.scrollTop = box.scrollHeight; }, [table.lines.length, table.id]);
  useEffect(() => { input.current?.focus(); }, [table.id]);
  // "Someone is writing" fades by itself.
  useEffect(() => { const timer = window.setInterval(() => tick(count => count + 1), 1500); return () => window.clearInterval(timer); }, []);
  // It is your move and the box is empty: after a while the ideas wave at you.
  useEffect(() => {
    setNudge(false);
    if (!go || text || !view.starters?.length) return;
    const timer = window.setTimeout(() => setNudge(true), 15000);
    return () => window.clearTimeout(timer);
  }, [go, text, view.now.text, view.starters?.length]);

  const allowed = useMemo(() => [...names, ...table.members.map(member => member.name), ...boardWords(table)], [names, table]);
  const writers = table.members.filter(member => member.key !== me && Date.now() - (typing[member.key] ?? 0) < 4500);

  const put = (value: string) => {
    setText(value); setProblem(''); setWrong([]); setHint(null);
    window.requestAnimationFrame(() => {
      const box = input.current; if (!box) return;
      box.focus();
      const gap = value.indexOf('…');
      if (gap >= 0) box.setSelectionRange(gap, gap + 1); else box.setSelectionRange(value.length, value.length);
    });
  };
  const starter = (idea: string) => put(text && !text.includes('…') && idea.includes('…') && idea.endsWith('…') ? `${text.trim()} ${idea}` : idea.endsWith('…') || idea.endsWith(',') ? `${idea} `.replace('… ', '…') : idea);

  const deliver = async (value: string, extra?: { was?: string; better?: string }) => {
    setBusy(true);
    const result = await room.chat(value, extra);
    setBusy(false);
    if (result.ok) { setText(''); setProblem(''); setHint(null); setWrong([]); }
    else { setProblem(result.text); if (!result.keep) setText(''); }
    input.current?.focus();
  };

  const send = async () => {
    const value = text.trim();
    if (!value || busy || muted) return;
    setProblem(''); setHint(null);
    if (value.includes('…')) { room.attempt(value, 'Unfinished sentence starter'); setProblem('Finish the sentence: write your own words where you see “…”.'); return; }
    if (blockedIn(value, room.state.blocked, checker ? word => checker(word, allowed).length === 0 : undefined)) { room.attempt(value, 'Lesson blocked words'); setProblem('Your teacher has blocked those words for this lesson. Try another idea.'); return; }
    const misspelt = checker ? checker(value, allowed) : [];
    if (misspelt.length) { room.attempt(value, `English check: ${misspelt.map(word => word.word).join(', ')}`); setWrong(misspelt); return; }
    setWrong([]);
    // A grammar hint, when the class has them. It only ever advises.
    if (value.split(/\s+/).length >= 4 && declined.current < 3) {
      setBusy(true);
      const answer = await room.check(value);
      setBusy(false);
      if (!answer.ok && answer.corrected.trim().toLowerCase() !== value.toLowerCase()) { setHint({ original: value, hint: answer }); return; }
    } else if (declined.current >= 3) declined.current = 0;
    await deliver(value);
  };

  const fix = (word: string, replacement: string) => {
    const next = text.replace(new RegExp(`(?<![\\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'u'), replacement);
    setText(next);
    setWrong(wrong.filter(item => item.word !== word));
    input.current?.focus();
  };

  const reactions = reactionsFor(levelOf(xp).level);
  const example = table.game.example;

  return <section className="chat" aria-label="Table chat">
    <div className="chat-lines" ref={list} role="log" aria-live="polite">
      {table.lines.length === 0 && <div className="chat-example" aria-hidden="true">
        <span className="chat-example-tag">Example</span>
        {example.map((line, index) => <div key={index} className={`chat-row ${index % 2 ? 'theirs' : 'mine'}`}><div className="chat-bubble ghost">{line}</div></div>)}
        <p>Now you! Write to your table. 👇</p>
      </div>}
      {table.lines.map(line => {
        if (line.from === 'sys') return <div key={line.id} className={`chat-sys tone-${line.tone ?? 'info'}`}>{line.text}</div>;
        if (line.from === 'teacher') return <div key={line.id} className="chat-teacher"><b>👩‍🏫 Teacher</b> {line.text}</div>;
        const mine = line.from === me;
        const member: Member | undefined = members.get(line.from);
        const style = member?.style;
        const reacts = Object.entries(line.reacts ?? {}).filter(([, keys]) => keys.length);
        return <div key={line.id} className={`chat-row ${mine ? 'mine' : 'theirs'}`}>
          {!mine && <span className="framed" style={{ background: FRAMES[style?.frame ?? 0] }}><Face player={member?.look} name={line.name} /></span>}
          <div className="chat-msg">
            {!mine && <span className="chat-name" style={{ color: NAME_COLOURS[style?.colour ?? 0] }}>{style?.flair ? `${style.flair} ` : ''}{line.name}</span>}
            <button type="button" className={`chat-bubble${line.secret ? ' secret' : ''}${sound?.messageId === line.id ? ' speaking' : ''}`}
              style={mine && !line.secret ? { background: BUBBLES[style?.bubble ?? 0] } : undefined}
              onClick={() => setPicking(picking === line.id ? null : line.id)}>
              {line.secret && <span className="chat-secret-tag">🤫 secret</span>}<Marked line={line} />
            </button>
            {reacts.length > 0 && <div className="chat-reacts">{reacts.map(([emoji, keys]) => <span key={emoji} className={keys.includes(me) ? 'own' : ''}>{emoji}{keys.length > 1 ? ` ${keys.length}` : ''}</span>)}</div>}
            {picking === line.id && !line.secret && <div className="chat-pick">
              {!mine && reactions.map(emoji => <button key={emoji} type="button" onClick={() => { room.react(line.id, emoji); setPicking(null); }}>{emoji}</button>)}
              {audio && !sound?.muted && !sound?.locked && <button type="button" title="Listen" onClick={() => { audio.replay(line.id); setPicking(null); }}>🔊</button>}
            </div>}
          </div>
        </div>;
      })}
      {writers.length > 0 && <div className="chat-typing">{writers.map(member => member.name).join(' and ')} {writers.length > 1 ? 'are' : 'is'} writing<span className="dots"><i /><i /><i /></span></div>}
    </div>

    {view.starters && view.starters.length > 0 && !muted && <div className={`chat-starters${nudge ? ' nudge' : ''}`}>
      <span className="chat-starters-label">{nudge ? '💡 Tap an idea to start:' : '💡 Ideas:'}</span>
      {view.starters.map(idea => <button key={idea} type="button" onClick={() => starter(idea)}>{idea}</button>)}
    </div>}

    {wrong.length > 0 && <div className="chat-panel warn" role="alert">
      <strong>Check your English:</strong>
      {wrong.map(item => <div key={item.word} className="chat-wrong">
        <span className="diff-del">{item.word}</span>
        {item.banned ? <span>This word is not OK here.</span> : item.suggestions.length ? <>
          <span>→</span>{item.suggestions.map(suggestion => <button key={suggestion} type="button" className="btn btn-sm" onClick={() => fix(item.word, suggestion)}>{suggestion}</button>)}
        </> : <span>is not an English word. Try another word.</span>}
      </div>)}
    </div>}

    {hint && <div className="chat-panel hint" role="alert">
      <strong>💡 Try this:</strong> <span className="diff-ins">{hint.hint.corrected}</span>
      {hint.hint.why && <p className="muted">{hint.hint.why}</p>}
      <div className="chat-panel-actions">
        <button type="button" className="btn btn-go btn-sm" onClick={() => { declined.current = 0; void deliver(hint.hint.corrected, { was: hint.original }); }}>OK, send this</button>
        <button type="button" className="btn btn-sm" onClick={() => { declined.current += 1; void deliver(hint.original, { better: hint.hint.corrected }); }}>Send mine</button>
      </div>
    </div>}

    {problem && <div className="chat-panel warn" role="alert">{problem}</div>}

    <form className={`chat-box${go && !muted ? ' go' : ''}${view.chat.secret ? ' secret' : ''}`} onSubmit={event => { event.preventDefault(); void send(); }}>
      <textarea ref={input} rows={1} value={text} maxLength={240} disabled={muted} spellCheck={false} autoComplete="off" autoCorrect="off"
        placeholder={muted ? 'Your teacher paused your chat.' : view.chat.secret ? `🤫 ${view.chat.hint ?? 'Only you see this for now'}` : view.chat.hint ?? 'Write in English…'}
        onChange={event => { setText(event.target.value); setProblem(''); if (wrong.length) setWrong([]); if (hint) setHint(null); room.typing(); }}
        onPaste={event => event.preventDefault()} onDrop={event => event.preventDefault()}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} />
      <button type="submit" className="btn btn-primary chat-send" disabled={!text.trim() || busy || muted} aria-label="Send">{busy ? '…' : '➤'}</button>
    </form>
  </section>;
}
