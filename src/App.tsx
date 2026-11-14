import { Suspense, lazy, useState } from 'react';
import Login from './pages/Login';
import Play from './pages/Play';
import type { Look } from '../shared/protocol';

// The teacher's page is only for the teacher, so students' laptops never load it.
const Teacher = lazy(() => import('./pages/Teacher'));

export type Entry = { pin: string; token: string; avatar: Look | null };

export default function App() {
  const [entry, setEntry] = useState<Entry | null>(null);
  if (window.location.pathname.replace(/\/$/, '') === '/teacher') {
    return <div className="app-container"><Suspense fallback={<p style={{ padding: '2rem' }}>Loading…</p>}><Teacher /></Suspense></div>;
  }
  return <div className="app-container">
    {entry ? <Play entry={entry} onExit={() => setEntry(null)} /> : <Login onEnter={setEntry} />}
  </div>;
}
