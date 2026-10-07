import { Link } from 'react-router-dom';
import { useSession } from '../session.jsx';
import { Alert } from '../components/fields.jsx';
import { PassengerDetails } from '../components/details.jsx';
import { useAction } from './Home.jsx';

export default function RiderView() {
  const { data } = useSession();
  const { run, error, busy } = useAction();
  const { pickup, passengers = [], visible, profile } = data;

  if (pickup) {
    return (
      <section className="card pickup">
        <h2>Your passenger</h2>
        <p className="muted">Give your passenger this code when you meet.</p>
        <div className="code" aria-label="Pickup code">{pickup.code}</div>
        <p className="center">
          <span className={`badge ${pickup.verified ? 'active' : 'pending'}`}>
            {pickup.verified ? '✓ Code entered — passenger confirmed' : 'Waiting for passenger to enter code'}
          </span>
        </p>
        <h3>{pickup.passenger.username}</h3>
        <PassengerDetails p={pickup.passenger} />
        <Alert error={error} />
        <button className="danger" disabled={busy} onClick={() => confirm('Drop this passenger and pick up someone else?') && run('/rider/drop')}>
          Drop passenger &amp; pick up a new one
        </button>
      </section>
    );
  }

  return (
    <>
      <section className="card">
        <label className="toggle">
          <input
            type="checkbox" checked={visible} disabled={busy || (!visible && !profile.takesPassengers)}
            onChange={(e) => run('/rider/visibility', { visible: e.target.checked })}
          />
          <span>
            <strong>{visible ? 'You are available for pickups' : 'You are hidden'}</strong>
            <small className="muted">Turn this on when you're ready to take a passenger.</small>
          </span>
        </label>
        {!profile.takesPassengers && (
          <p className="muted small">You're set to not take passengers. Change that in <Link to="/settings">Settings</Link>.</p>
        )}
        <Alert error={error} />
      </section>

      <h2>Passengers waiting ({passengers.length})</h2>
      {passengers.length === 0 && <div className="card center muted">No passengers waiting yet. This list updates live.</div>}
      <div className="grid">
        {passengers.map((p) => (
          <article key={p.id} className="card">
            <h3>{p.username}</h3>
            <PassengerDetails p={p} />
            <button
              className="primary" disabled={busy || !visible}
              title={visible ? '' : 'Make yourself available first'}
              onClick={() => run('/rider/pickup', { passengerId: p.id })}
            >
              Pick up
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
