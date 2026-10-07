import { useState } from 'react';
import { api } from '../api.js';
import { useSession } from '../session.jsx';
import { Alert } from '../components/fields.jsx';
import { Link } from 'react-router-dom';
import RiderView from './RiderView.jsx';
import PassengerView from './PassengerView.jsx';

// Runs an API action, then refreshes state. Shared by rider/passenger screens.
export function useAction() {
  const { refresh } = useSession();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (path, body) => {
    setError(''); setBusy(true);
    try { await api(path, { method: 'POST', body }); await refresh(); return true; }
    catch (e) { setError(e.message); await refresh(); return false; }
    finally { setBusy(false); }
  };
  return { run, error, busy };
}

export default function Home() {
  const { data } = useSession();
  const { run, error, busy } = useAction();
  const { ride, joined, user } = data;

  if (!ride || (ride.status === 'ended' && !joined)) {
    return (
      <div className="card center">
        <h2>No ride right now</h2>
        <p className="muted">When an administrator creates a ride it will show up here automatically.</p>
      </div>
    );
  }

  return (
    <>
      <section className="card ride-banner">
        <div>
          <span className={`badge ${ride.status}`}>{ride.status === 'active' ? 'Ride active' : 'Ride ended'}</span>
          <h2>{ride.name}</h2>
          {ride.startsAt && <p className="muted">🕒 {ride.startsAt}</p>}
          {ride.description && <p>{ride.description}</p>}
        </div>
      </section>

      {ride.status === 'ended' ? (
        <div className="card center">
          <h2>🏁 This ride has ended</h2>
          <p className="muted">Thanks for riding! A new ride will appear here when it's created.</p>
        </div>
      ) : !joined ? (
        <div className="card center">
          <h3>{user.role === 'rider' ? 'Join the ride to start taking passengers' : 'Join the ride to get picked up'}</h3>
          <Alert error={error} />
          <button className="primary" disabled={busy} onClick={() => run('/ride/join')}>Join this ride</button>
          {user.role === 'rider' && !data.profile.takesPassengers && (
            <p className="muted small">You're set to not take passengers. Change that in <Link to="/settings">Settings</Link>.</p>
          )}
        </div>
      ) : user.role === 'rider' ? (
        <RiderView />
      ) : (
        <PassengerView />
      )}

      {joined && ride.status === 'active' && !data.pickup && (
        <p className="center"><button className="link danger" disabled={busy} onClick={() => run('/ride/leave')}>Leave this ride</button></p>
      )}
    </>
  );
}
