import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useSession } from '../session.jsx';
import { Alert } from '../components/fields.jsx';

function useLoad(path) {
  const { tick } = useSession();
  const [data, setData] = useState(null);
  const load = useCallback(() => api(path).then(setData).catch(() => {}), [path]);
  useEffect(() => { load(); }, [load, tick]);
  return [data, load];
}

export default function Admin() {
  const [tab, setTab] = useState('dashboard');
  const tabs = [['dashboard', 'Metrics'], ['rides', 'Rides'], ['users', 'Users'], ['admins', 'Admins']];
  return (
    <>
      <div className="tabs scroll">
        {tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'dashboard' && <Metrics />}
      {tab === 'rides' && <Rides />}
      {tab === 'users' && <Users />}
      {tab === 'admins' && <Admins />}
    </>
  );
}

const Stat = ({ label, value }) => (
  <div className="stat"><strong>{value ?? '–'}</strong><span>{label}</span></div>
);

function Bars({ data = {}, order }) {
  const keys = order || Object.keys(data);
  const max = Math.max(1, ...keys.map((k) => data[k] || 0));
  if (!keys.length) return <p className="muted">No data yet</p>;
  return (
    <div className="bars">
      {keys.map((k) => (
        <div key={k} className="bar">
          <span className="bar-label">{k}</span>
          <span className="bar-track"><span style={{ width: `${((data[k] || 0) / max) * 100}%` }} /></span>
          <span className="bar-n">{data[k] || 0}</span>
        </div>
      ))}
    </div>
  );
}

function Metrics() {
  const [m] = useLoad('/admin/metrics');
  if (!m) return <p className="muted">Loading…</p>;
  const { rides, passengers, riders } = m;
  return (
    <>
      <h2>Ride metrics</h2>
      <p className="muted">{rides.active ? <>Current ride: <strong>{rides.active.name}</strong></> : 'No active ride'}</p>
      <div className="stats">
        <Stat label="Rides total" value={rides.total} />
        <Stat label="Rides ended" value={rides.ended} />
        <Stat label="Riders joined" value={rides.ridersJoined} />
        <Stat label="Riders available" value={rides.ridersVisible} />
        <Stat label="Passengers joined" value={rides.passengersJoined} />
        <Stat label="Passengers waiting" value={rides.passengersWaiting} />
        <Stat label="Active pickups" value={rides.activePickups} />
        <Stat label="Pickups total" value={rides.totalPickups} />
        <Stat label="Confirmed w/ code" value={rides.verifiedPickups} />
        <Stat label="Dropped by rider" value={rides.droppedPickups} />
        <Stat label="Quit by passenger" value={rides.quitPickups} />
      </div>
      <h2>Passenger metrics</h2>
      <div className="stats">
        <Stat label="Passengers registered" value={passengers.total} />
        <Stat label="First-timers" value={passengers.firstTimers} />
        <Stat label="Avg. experience (1-5)" value={passengers.avgExperience} />
      </div>
      <div className="grid">
        <div className="card"><h3>Helmet sizes</h3><Bars data={passengers.helmetSizes} order={['s', 'm', 'l', 'xl', 'idk']} /></div>
        <div className="card"><h3>Experience level</h3><Bars data={passengers.experience} order={['1', '2', '3', '4', '5']} /></div>
      </div>
      <h2>Rider metrics</h2>
      <div className="stats">
        <Stat label="Riders registered" value={riders.total} />
        <Stat label="Taking passengers" value={riders.takingPassengers} />
        <Stat label="Have spare helmet" value={riders.spareHelmet} />
      </div>
      <div className="card"><h3>Motorcycle types</h3><Bars data={riders.bikeTypes} /></div>
    </>
  );
}

function Rides() {
  const [d, load] = useLoad('/admin/rides');
  const [form, setForm] = useState({ name: '', startsAt: '', description: '' });
  const [error, setError] = useState('');
  const create = async (e) => {
    e.preventDefault(); setError('');
    try { await api('/admin/rides', { method: 'POST', body: form }); setForm({ name: '', startsAt: '', description: '' }); load(); }
    catch (err) { setError(err.message); }
  };
  const end = async (id) => {
    if (!confirm('End this ride? Every rider and passenger screen will show that it ended.')) return;
    try { await api(`/admin/rides/${id}/end`, { method: 'POST' }); load(); } catch (err) { setError(err.message); }
  };
  const hasActive = d?.rides.some((r) => r.status === 'active');
  return (
    <>
      <h2>Create a ride</h2>
      <form className="card" onSubmit={create}>
        <label className="field"><span>Ride name</span>
          <input required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="field"><span>When / where (optional)</span>
          <input maxLength={40} placeholder="Sat 9am, Main St lot" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></label>
        <label className="field"><span>Description (optional)</span>
          <textarea maxLength={500} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <Alert error={error} />
        <button className="primary" disabled={hasActive}>{hasActive ? 'End the active ride first' : 'Create ride'}</button>
      </form>
      <h2>Rides</h2>
      <div className="grid">
        {d?.rides.map((r) => (
          <article key={r.id} className="card">
            <span className={`badge ${r.status}`}>{r.status}</span>
            <h3>{r.name}</h3>
            <p className="muted small">{r.riders} riders · {r.passengers} passengers · {r.pickups} pickups</p>
            {r.status === 'active' && <button className="danger" onClick={() => end(r.id)}>End ride</button>}
          </article>
        ))}
      </div>
      {d && !d.rides.length && <p className="muted">No rides yet.</p>}
    </>
  );
}

function Users() {
  const { data } = useSession();
  const [d, load] = useLoad('/admin/users');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [resetting, setResetting] = useState(null);
  const [secret, setSecret] = useState('');

  const remove = async (u) => {
    if (!confirm(`Permanently remove ${u.username}?`)) return;
    setError(''); setOk('');
    try { await api(`/admin/users/${u.id}`, { method: 'DELETE' }); load(); } catch (e) { setError(e.message); }
  };
  const reset = async (e, u) => {
    e.preventDefault(); setError(''); setOk('');
    try {
      await api(`/admin/users/${u.id}/reset`, { method: 'POST', body: { secret } });
      setOk(`${u.username}'s ${u.role === 'admin' ? 'password' : 'PIN'} was reset`); setResetting(null); setSecret('');
    } catch (err) { setError(err.message); }
  };

  return (
    <>
      <h2>Users</h2>
      <Alert error={error} ok={ok} />
      <div className="card list">
        {d?.users.map((u) => (
          <div key={u.id} className="list-row">
            <div><strong>{u.username}</strong> <span className={`badge ${u.role}`}>{u.role}</span></div>
            {resetting === u.id ? (
              <form className="inline" onSubmit={(e) => reset(e, u)}>
                <input
                  autoFocus required placeholder={u.role === 'admin' ? 'New password (8+)' : 'New 4-digit PIN'}
                  inputMode={u.role === 'admin' ? 'text' : 'numeric'} maxLength={100}
                  value={secret} onChange={(e) => setSecret(e.target.value)}
                />
                <button className="primary">Save</button>
                <button type="button" onClick={() => { setResetting(null); setSecret(''); }}>Cancel</button>
              </form>
            ) : (
              <div className="inline">
                <button onClick={() => { setResetting(u.id); setSecret(''); }}>Reset {u.role === 'admin' ? 'password' : 'PIN'}</button>
                {u.id !== data.user.id && <button className="danger" onClick={() => remove(u)}>Remove</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function Admins() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setError(''); setOk('');
    try { await api('/admin/admins', { method: 'POST', body: form }); setOk(`Administrator ${form.username} created`); setForm({ username: '', password: '' }); }
    catch (err) { setError(err.message); }
  };
  return (
    <>
      <h2>Create administrator</h2>
      <form className="card narrow" onSubmit={submit}>
        <label className="field"><span>Username</span>
          <input required minLength={3} maxLength={24} autoCapitalize="none" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
        <label className="field"><span>Password (8+ characters)</span>
          <input required type="password" minLength={8} maxLength={100} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        <Alert error={error} ok={ok} />
        <button className="primary">Create administrator</button>
      </form>
    </>
  );
}
