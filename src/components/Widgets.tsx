// The pieces every game's board is drawn with. The server says which pieces and what is on them; a tap sends the
// piece's action back. Nothing here knows the rules of any game.
import { useEffect, useState } from 'react';
import type { Cell, Member, Widget } from '../../shared/protocol';
import { renderAvatarSvg } from '../utils/AvatarRenderer';
import Face from './Face';
import './Widgets.css';

type Props = { members: Member[]; me: string; act: (act: string, data?: unknown) => void };
const find = (members: Member[], key: string) => members.find(member => member.key === key);

function Faces({ keys, members, size = 'sm' }: { keys: string[]; members: Member[]; size?: 'sm' | 'md' }) {
  if (!keys.length) return null;
  return <span className={`w-faces ${size === 'sm' ? 'face-sm' : ''}`}>
    {keys.map(key => { const member = find(members, key); return <span key={key} title={member?.name}><Face player={member?.look} name={member?.name} /></span>; })}
  </span>;
}

const portraits = new Map<string, string>();
function Portrait({ cell }: { cell: Cell }) {
  const key = JSON.stringify(cell.look);
  let url = portraits.get(key);
  if (!url) {
    const svg = renderAvatarSvg(cell.look);
    if (svg) { url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; portraits.set(key, url); }
  }
  return url ? <img className="w-portrait" src={url} alt="" /> : <span className="w-emoji">🙂</span>;
}

function Grid({ widget, members, act }: { widget: Extract<Widget, { w: 'grid' }> } & Props) {
  const [asking, setAsking] = useState<string | null>(null);
  const tap = (cell: Cell) => {
    if (!widget.act || cell.off) return;
    if (widget.cross) setAsking(asking === cell.id ? null : cell.id);
    else act(widget.act, { id: cell.id });
  };
  return <section className="w w-grid-wrap">
    {widget.label && <h3 className="w-label">{widget.label}</h3>}
    <div className={`w-grid${widget.coords ? ' coords' : ''}`} style={{ gridTemplateColumns: `repeat(${widget.cols}, minmax(0, 1fr))` }}>
      {widget.cells.map(cell => {
        const owner = cell.owner ? find(members, cell.owner) : null;
        const can = !!widget.act && !cell.off;
        return <div key={cell.id} className="w-cell-slot">
          <button type="button" className={`w-cell tap state-${cell.state ?? 'free'}${can ? ' can' : ''}${cell.look ? ' person' : ''}`} disabled={!can} onClick={() => tap(cell)}>
            {cell.sub && <span className="w-coord">{cell.sub}</span>}
            {cell.look ? <Portrait cell={cell} /> : cell.emoji ? <span className="w-emoji">{cell.emoji}</span> : null}
            {cell.label && <span className="w-cell-label">{cell.label}</span>}
            {owner && <span className="w-owner"><Face player={owner.look} name={owner.name} /></span>}
            {cell.state === 'out' && <span className="w-cross" aria-hidden="true">✕</span>}
            {cell.state === 'found' && <span className="w-tick" aria-hidden="true">✓</span>}
          </button>
          {asking === cell.id && <div className="w-ask" role="dialog">
            <button type="button" className="btn btn-go btn-sm" onClick={() => { act(widget.act!, { id: cell.id }); setAsking(null); }}>✓ This is my answer!</button>
            <button type="button" className="btn btn-sm" onClick={() => { act('cross', { id: cell.id }); setAsking(null); }}>{cell.state === 'out' ? '↩ Put it back' : '✕ Not this one'}</button>
          </div>}
        </div>;
      })}
    </div>
  </section>;
}

// The path, drawn as a snake: left to right, then right to left, so the next square is always beside the last.
function Path({ widget, members }: { widget: Extract<Widget, { w: 'path' }> } & Props) {
  const cols = 6;
  const rows = Math.ceil(widget.squares.length / cols);
  const [rolling, setRolling] = useState(false);
  useEffect(() => {
    if (widget.die === null) return;
    setRolling(true);
    const timer = window.setTimeout(() => setRolling(false), 600);
    return () => window.clearTimeout(timer);
  }, [widget.die, widget.tokens.map(token => token.at).join()]);
  return <section className="w w-path-wrap">
    <div className="w-path" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, auto)` }}>
      {widget.squares.map((square, index) => {
        const row = Math.floor(index / cols);
        const col = row % 2 === 0 ? index % cols : cols - 1 - (index % cols);
        const here = widget.tokens.filter(token => token.at === index);
        return <div key={index} className={`w-square kind-${square.kind}${here.length ? ' has' : ''}`} style={{ gridRow: row + 1, gridColumn: col + 1 }}>
          <span className="w-square-n">{index === 0 ? 'Start' : index === widget.squares.length - 1 ? 'End' : index}</span>
          <span className="w-square-emoji">{square.emoji}</span>
          <Faces keys={here.map(token => token.key)} members={members} size="md" />
        </div>;
      })}
    </div>
    <div className={`w-die${rolling ? ' rolling' : ''}`} aria-label={widget.die ? `The die shows ${widget.die}` : 'The die'}>{widget.die ? ['⚀', '⚁', '⚂'][widget.die - 1] : '🎲'}</div>
  </section>;
}

function Rally({ widget, members, me }: { widget: Extract<Widget, { w: 'rally' }> } & Props) {
  return <section className="w w-rally">
    <div className="w-rally-court">
      {widget.order.map(key => {
        const member = find(members, key);
        return <div key={key} className={`w-rally-player${widget.holder === key ? ' holder' : ''}`}>
          <span className="face-lg"><Face player={member?.look} name={member?.name} /></span>
          <span className="w-rally-name">{key === me ? 'You' : member?.name}</span>
          {widget.holder === key && <span className="w-ball" aria-label="has the ball">🏓</span>}
        </div>;
      })}
    </div>
    <div className="w-rally-score"><strong>{widget.hits}</strong><span>of {widget.goal} hits</span>{widget.best > 0 && <small>Best: {widget.best}</small>}</div>
    <div className="w-dots">{Array.from({ length: widget.goal }, (_, index) => <i key={index} className={index < widget.hits ? 'on' : ''} />)}</div>
  </section>;
}

function Answer({ widget, act }: { widget: Extract<Widget, { w: 'answer' }> } & Props) {
  const [text, setText] = useState('');
  const send = () => { if (text.trim().length >= widget.min) { act(widget.act, { text: text.trim() }); setText(''); } };
  return <section className="w w-answer">
    <label className="w-label" htmlFor="team-answer">✍️ {widget.label}</label>
    <div className="w-answer-row">
      <textarea id="team-answer" className="input-field" rows={2} maxLength={widget.max} placeholder={widget.placeholder} value={text}
        onChange={event => setText(event.target.value)} onPaste={event => event.preventDefault()}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} />
      <button type="button" className="btn btn-go" disabled={text.trim().length < widget.min} onClick={send}>Send answer</button>
    </div>
    {widget.hint && <p className="muted">{widget.hint}</p>}
  </section>;
}

export default function Board({ widgets, members, me, act }: { widgets: Widget[] } & Props) {
  const props = { members, me, act };
  return <div className="board">
    {widgets.map((widget, index) => {
      switch (widget.w) {
        case 'card': return <section key={index} className={`w w-card tone-${widget.tone ?? 'plain'}`}>
          {widget.label && <span className="w-card-label">{widget.label}</span>}
          <div className="w-card-main">
            {widget.emoji && <span className="w-card-emoji">{widget.emoji}</span>}
            <div><h2 className="w-card-title">{widget.title}</h2>{widget.text && <p className="w-card-text">{widget.text}</p>}</div>
          </div>
          {widget.banned && <div className="w-banned"><span>Don’t say:</span>{widget.banned.map(word => <b key={word}>🚫 {word}</b>)}</div>}
        </section>;
        case 'options': return <section key={index} className="w w-options-wrap">
          {widget.label && <h3 className="w-label">{widget.label}</h3>}
          <div className="w-options" style={{ gridTemplateColumns: `repeat(${Math.min(widget.cols ?? 2, widget.options.length)}, minmax(0, 1fr))` }}>
            {widget.options.map(option => {
              const face = option.face ? find(members, option.face) : null;
              return <button key={option.id} type="button" disabled={widget.off || option.off}
                className={`w-option tap${option.picked ? ' picked' : ''}${option.state ? ` ${option.state}` : ''}${widget.off ? '' : ' can'}`}
                onClick={() => act(widget.act, { id: option.id })}>
                {face && <span className="face-lg"><Face player={face.look} name={face.name} /></span>}
                {option.emoji && <span className="w-emoji">{option.emoji}</span>}
                <span className="w-option-label">{option.label}</span>
                {option.sub && <small>{option.sub}</small>}
                {option.by && <Faces keys={option.by} members={members} size="md" />}
              </button>;
            })}
          </div>
        </section>;
        case 'grid': return <Grid key={index} widget={widget} {...props} />;
        case 'path': return <Path key={index} widget={widget} {...props} />;
        case 'rally': return <Rally key={index} widget={widget} {...props} />;
        case 'story': return <section key={index} className="w w-story">
          {widget.dice && <div className="w-dice">{widget.dice.map((die, at) => <span key={at} className={`w-story-die ${die.state}`}><i>{die.emoji}</i><b>{die.word}</b></span>)}</div>}
          {widget.label && widget.lines.length > 0 && <h3 className="w-label">{widget.label}</h3>}
          {widget.lines.length > 0 && <ol className="w-lines">{widget.lines.map((line, at) => {
            const by = line.by ? find(members, line.by) : null;
            return <li key={at}>{by && <span className="face-sm"><Face player={by.look} name={by.name} /></span>}<span>{line.text}</span></li>;
          })}</ol>}
        </section>;
        case 'items': return <section key={index} className="w w-items">
          <div className="w-dots big">{Array.from({ length: widget.goal }, (_, at) => <i key={at} className={at < widget.items.filter(item => !item.ask).length ? 'on' : ''} />)}</div>
          <div className="w-chips">
            {widget.items.length === 0 && <span className="muted">Nothing yet. Write the first one!</span>}
            {widget.items.map(item => <span key={item.id} className={`w-chip${item.ask ? ' ask' : ''}`}>
              {item.ask ? '🤔' : '✅'} {item.text}
              {item.ask && item.by !== me && widget.act && <button type="button" className="tap" onClick={() => act(widget.act!, { id: item.id })}>👍 Yes, it counts</button>}
              {item.ask && item.by === me && <small>a classmate must say 👍</small>}
            </span>)}
          </div>
        </section>;
        case 'meter': return <div key={index} className="w w-meter">
          <span>{widget.label}</span>
          {widget.max <= 12 ? <span className="w-meter-icons">{Array.from({ length: widget.max }, (_, at) => <i key={at} className={at < widget.value ? 'on' : ''}>{widget.icon}</i>)}</span>
            : <strong>{widget.icon} {widget.value}</strong>}
        </div>;
        case 'bomb': return <section key={index} className={`w w-bomb${widget.boom ? ' boom' : ''}`}>
          {members.map(member => <div key={member.key} className={`w-bomb-player${widget.holder === member.key ? ' holder' : ''}`}>
            <span className="w-potato" aria-hidden="true">{widget.holder === member.key ? (widget.boom ? '💥' : '🥔') : ''}</span>
            <span className="face-lg"><Face player={member.look} name={member.name} /></span>
            <span>{member.key === me ? 'You' : member.name}</span>
            <span className="w-lives">{'❤️'.repeat(Math.max(0, widget.lives[member.key] ?? 0))}{'🤍'.repeat(Math.max(0, (widget.max ?? 3) - (widget.lives[member.key] ?? 0)))}</span>
          </div>)}
        </section>;
        case 'answer': return <Answer key={index} widget={widget} {...props} />;
        case 'sentences': return <section key={index} className="w w-sentences">
          {widget.label && <h3 className="w-label">{widget.label}</h3>}
          {widget.items.map((item, at) => <button key={item.id} type="button" disabled={widget.off || !widget.act}
            className={`w-sentence tap${item.state ? ` ${item.state}` : ''}${!widget.off && widget.act ? ' can' : ''}`} onClick={() => widget.act && act(widget.act, { id: item.id })}>
            <b>{at + 1}</b><span>{item.text}</span>
            {item.state === 'lie' && <em>🤥 LIE</em>}{item.state === 'true' && <em>✅ true</em>}
            {item.by && <Faces keys={item.by} members={members} />}
          </button>)}
        </section>;
      }
    })}
  </div>;
}
