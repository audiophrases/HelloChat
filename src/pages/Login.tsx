import { useEffect, useRef, useState } from 'react';
import AvatarEditor from '../components/AvatarEditor';
import type { AvatarConfig } from '../utils/AvatarRenderer';
import { renderAvatarSvg } from '../utils/AvatarRenderer';
import { renderGoogleButton } from '../googleIdentity';
import {
  clearStudentSession, exchangeGoogleCredential, fetchStudentConfig,
  fetchStudentProfile, handOffTo, joinPin, readStudentSession, saveStudentSession
} from '../studentAuth';
import type { StudentConfig, StudentSession } from '../studentAuth';
import { firstName } from '../../shared/names';
import { testerAvatar, testerPin } from '../tester';
import { unlockSound } from '../audio';
import type { Entry } from '../App';
import './Login.css';

export default function Login({ onEnter }: { onEnter: (entry: Entry) => void }) {
  const [step, setStep] = useState<'details' | 'avatar'>('details');
  const [pin, setPin] = useState(() => joinPin()); // filled in when the class opened a join link
  const [session, setSession] = useState<StudentSession | null>(() => {
    // "Not you?" on the teacher's laptop signs out here too.
    if (new URLSearchParams(window.location.search).has('signout')) {
      clearStudentSession();
      history.replaceState(null, '', window.location.pathname);
    }
    return readStudentSession();
  });
  const [config, setConfig] = useState<StudentConfig | null>(null);
  // Saved in the class: a returning student goes straight in looking the same.
  const [savedAvatar, setSavedAvatar] = useState<AvatarConfig | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const googleButton = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void fetchStudentConfig().then(value => { if (active) setConfig(value); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load sign-in settings.'); });
    const saved = readStudentSession();
    if (saved) {
      void fetchStudentProfile(saved.studentToken).then(({ student, avatar }) => {
        if (active) {
          const updated = { ...saved, student };
          saveStudentSession(updated);
          setSession(updated);
          setSavedAvatar(avatar);
        }
      }).catch(() => {
        if (active) { clearStudentSession(); setSession(null); }
      });
    }
    return () => { active = false; };
  }, []);

  // tester.bat: a tester tab goes straight into the class.
  useEffect(() => {
    const code = testerPin();
    if (code && session?.studentToken.startsWith('tester:')) {
      onEnter({ pin: code, token: session.studentToken, avatar: testerAvatar(session.student.displayName) });
    }
  }, [session, onEnter]);

  useEffect(() => {
    if (step !== 'details' || session || !config?.loginEnabled || !googleButton.current) return;
    let active = true;
    void renderGoogleButton(googleButton.current, config.googleClientId, credential => {
      if (!active) return;
      setBusy(true);
      setError('');
      void exchangeGoogleCredential(credential).then(({ avatar, ...value }) => {
        if (!active) return;
        saveStudentSession(value);
        // The class plays on the teacher's laptop: go straight there.
        if (config.laptopUrl) handOffTo(config.laptopUrl, value, joinPin());
        else { setSession(value); setSavedAvatar(avatar); }
      }).catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Google sign-in failed.');
      }).finally(() => { if (active) setBusy(false); });
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Google sign-in could not load.');
    });
    return () => { active = false; };
  }, [config, session, step]);

  // A null avatar keeps the saved one.
  const enter = (avatar: AvatarConfig | null) => {
    unlockSound();
    if (session) onEnter({ pin, token: session.studentToken, avatar });
  };
  const ready = !!session && /^\d{4,8}$/.test(pin);
  const laptopUrl = config?.laptopUrl;
  const signInUrl = config?.signInUrl;
  const signOut = () => {
    clearStudentSession(); setSession(null); setSavedAvatar(null); setStep('details');
    if (signInUrl) window.location.assign(new URL('/?signout', signInUrl));
  };

  return (
    <div className="login">
      <div className="login-bubbles" aria-hidden="true"><span>👋</span><span>💬</span><span>🎲</span><span>⭐</span><span>🗺️</span><span>😂</span></div>
      <main className={`login-main${step === 'avatar' ? ' login-wide' : ''}`}>
        <header className="login-brand">
          <h1><span className="login-logo">💬</span> HelloChat</h1>
          <p>Talk, play and learn English with your class</p>
        </header>
        <div className="card login-card">
          {step === 'details' ? (
            <form onSubmit={event => {
              event.preventDefault();
              unlockSound();
              if (laptopUrl) { if (session) handOffTo(laptopUrl, session, joinPin()); return; }
              if (!ready) return;
              if (savedAvatar) enter(null);
              else setStep('avatar');
            }}>
              <ol className="login-steps">
                <li className={session ? 'done' : 'now'}>
                  <span className="login-step-n">{session ? '✓' : '1'}</span>
                  <div>
                    {session ? <>
                      <strong>Hello, {firstName(session.student.displayName)}!</strong>
                      <button className="link-btn" type="button" onClick={signOut}>Not you?</button>
                    </> : signInUrl ? <>
                      <strong>Sign in</strong>
                      <p>Sign in with your school Google account on the class website. It brings you back here.</p>
                      <a className="btn btn-primary" href={signInUrl}>Sign in with Google</a>
                    </> : <>
                      <strong>Sign in with your school account</strong>
                      {!config ? <p>Checking sign-in…</p> : config.loginEnabled
                        ? <div ref={googleButton} className="login-google" /> : <p>Sign-in is not available. Ask your teacher.</p>}
                    </>}
                  </div>
                </li>
                {!laptopUrl && <li className={!session ? '' : ready ? 'done' : 'now'}>
                  <span className="login-step-n">{ready ? '✓' : '2'}</span>
                  <div>
                    <label htmlFor="pin"><strong>Type the class PIN</strong></label>
                    <input className="input-field login-pin" id="pin" inputMode="numeric" pattern="[0-9]{4,8}" placeholder="123456"
                      minLength={4} maxLength={8} autoComplete="off" required value={pin} disabled={!session}
                      onChange={event => setPin(event.target.value.replace(/\D/g, ''))} />
                    <p className="muted">Your teacher has the PIN.</p>
                  </div>
                </li>}
              </ol>
              {savedAvatar && session && <div className="login-me" dangerouslySetInnerHTML={{ __html: renderAvatarSvg(savedAvatar) }} />}
              {error && <p role="alert" className="login-error">{error}</p>}
              <button className="btn btn-go btn-lg login-go" type="submit" disabled={!session || busy || (!laptopUrl && !ready)}>
                {laptopUrl ? 'Go to class ▶' : savedAvatar ? 'Play ▶' : 'Next: make your character ▶'}
              </button>
              {savedAvatar && !laptopUrl && <button className="link-btn" type="button" disabled={!ready || busy}
                onClick={() => setStep('avatar')}>Change my character</button>}
            </form>
          ) : <AvatarEditor initialConfig={savedAvatar ?? undefined} onSave={enter} onCancel={() => setStep('details')} />}
          <p className="login-notice">Your teacher can read every message.</p>
        </div>
        <a className="login-teacher" href="/teacher">I am the teacher</a>
      </main>
    </div>
  );
}
