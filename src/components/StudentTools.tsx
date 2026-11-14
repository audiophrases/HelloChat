import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Room } from '../connection';

export function StudentHelp({ room, onClose }: { room: Room; onClose: () => void }) {
  const state = useSyncExternalStore(room.subscribe, room.snapshot);
  const [note, setNote] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => room.onEvent(event => { if (event.t === 'languageHint') setWaiting(false); }), [room]);
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => { setWaiting(false); setError('The hint is taking too long. Try again or call your teacher.'); }, 15000);
    return () => window.clearTimeout(timer);
  }, [waiting]);
  return <div className="overlay" onClick={onClose}><div className="card modal" role="dialog" aria-modal="true" aria-label="I need help" onClick={e => e.stopPropagation()}>
    <h2>🙋 I need help</h2><p className="muted">Write what you need. You can ask your teacher in any language.</p>
    <textarea className="input-field" rows={3} maxLength={240} autoFocus value={note} onChange={e => setNote(e.target.value)} placeholder="I don’t understand…" />
    {state.languageHint && <p role="status">💡 {state.languageHint}</p>}{error && <p role="alert">{error}</p>}
    {state.hints && <><p className="muted">One free AI language hint per lesson: a phrase to help you start.</p><button className="btn" disabled={waiting || state.hintUsed || !note.trim() || state.status !== 'online'} onClick={() => { setError(''); if (room.askHint(note)) setWaiting(true); else setError('You are offline. Please wait.'); }}>{waiting ? 'Thinking…' : state.hintUsed ? 'Free hint used' : '💡 Give me a language hint'}</button></>}
    <div className="modal-actions"><button className="btn" onClick={onClose}>Close</button><button className="btn btn-go" disabled={state.status !== 'online'} onClick={() => { room.help(note); onClose(); }}>Call my teacher</button></div>
  </div></div>;
}

export function PrivateChat({ room, onClose }: { room: Room; onClose: () => void }) {
  const state = useSyncExternalStore(room.subscribe, room.snapshot);
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <div className="overlay" onClick={onClose}><div className="card modal" role="dialog" aria-modal="true" aria-label="Private teacher chat" onClick={e => e.stopPropagation()}>
    <h2>👩‍🏫 Teacher chat</h2><p className="muted">Only you and your teacher can read this conversation.</p>
    <div className="t-private" role="log" aria-live="polite">{state.privateLines.map(line => <p key={line.id}><b>{line.from === 'teacher' ? 'Teacher' : 'You'}:</b> {line.text}</p>)}{!state.privateLines.length && <p>No private messages yet.</p>}</div>
    <form onSubmit={e => { e.preventDefault(); if (!text.trim() || busy) return; setBusy(true); setError(''); void room.chat(text, undefined, true).then(result => { if (result.ok) setText(''); else setError(result.text); }).finally(() => setBusy(false)); }}>
      <textarea className="input-field" aria-label="Message to your teacher" rows={3} value={text} maxLength={240} onChange={e => setText(e.target.value)} disabled={state.muted} autoFocus />
      {state.muted && <p>Your chat is paused. You can still call your teacher from Help.</p>}{error && <p role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Close</button><button className="btn btn-primary" disabled={busy || !text.trim() || state.muted || state.status !== 'online'}>Send privately</button></div>
    </form>
  </div></div>;
}
