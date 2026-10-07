import { useState } from 'react';
import { api } from '../api.js';
import { useSession } from '../session.jsx';
import { Alert, Choice, PinInput } from '../components/fields.jsx';
import ProfileForm from '../components/ProfileForm.jsx';

export default function AuthPage() {
  const { refresh } = useSession();
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('passenger');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const login = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await api('/auth/login', { method: 'POST', body: { username, pin } });
      await refresh();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  const register = async (profile) => {
    await api('/auth/register', { method: 'POST', body: { username, pin, role, profile } });
    await refresh();
  };

  const credentials = (
    <>
      <label className="field"><span>Username</span>
        <input required minLength={3} maxLength={24} autoComplete="username" autoCapitalize="none"
          value={username} onChange={(e) => setUsername(e.target.value)} /></label>
      <PinInput free={mode === 'login'} label={mode === 'login' ? 'PIN or admin password' : 'PIN (4 digits)'} value={pin} onChange={setPin} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
    </>
  );

  return (
    <main className="container narrow">
      <h1 className="brand-lg">🏍 Passenger List</h1>
      <div className="card">
        <div className="tabs">
          <button className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setError(''); }}>Sign in</button>
          <button className={mode === 'register' ? 'on' : ''} onClick={() => { setMode('register'); setError(''); }}>Create account</button>
        </div>
        {mode === 'login' ? (
          <form onSubmit={login}>
            {credentials}
            <Alert error={error} />
            <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
        ) : (
          <>
            <fieldset className="field">
              <legend>I am a…</legend>
              <Choice name="role" value={role} onChange={setRole} options={[['passenger', 'Passenger'], ['rider', 'Rider']]} />
            </fieldset>
            <ProfileForm key={role} role={role} submitLabel="Create account" onSubmit={register}>
              {credentials}
            </ProfileForm>
          </>
        )}
      </div>
    </main>
  );
}
