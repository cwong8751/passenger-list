import { useEffect, useState } from 'react';
import { useSession } from '../session.jsx';
import { Alert } from '../components/fields.jsx';
import { RiderDetails } from '../components/details.jsx';
import { useAction } from './Home.jsx';

export default function PassengerView() {
  const { data } = useSession();
  const { run, error, busy } = useAction();
  const [code, setCode] = useState('');
  const { pickup, ridersAvailable } = data;
  useEffect(() => { setCode(''); }, [pickup?.id]);

  if (!pickup) {
    return (
      <section className="card center">
        <div className="pulse" aria-hidden="true" />
        <h2>Waiting for a rider…</h2>
        <p className="muted">
          {ridersAvailable} rider{ridersAvailable === 1 ? ' is' : 's are'} available. This screen updates automatically when someone picks you up.
        </p>
      </section>
    );
  }

  return (
    <section className="card pickup">
      <h2>🏍 {pickup.rider.username} is picking you up!</h2>
      <h3>Your rider's motorcycle</h3>
      <RiderDetails r={pickup.rider} />
      {pickup.verified ? (
        <p className="alert ok">✓ Pickup confirmed. Enjoy the ride!</p>
      ) : (
        <form onSubmit={async (e) => { e.preventDefault(); await run('/passenger/verify', { code }); }}>
          <label className="field">
            <span>Enter the 4 digit pickup code from your rider</span>
            <input
              className="code-input" inputMode="numeric" pattern="\d{4}" maxLength={4} required autoComplete="one-time-code"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </label>
          <Alert error={error} />
          <button className="primary" disabled={busy || code.length !== 4}>Confirm pickup</button>
        </form>
      )}
      <button className="danger" disabled={busy} onClick={() => confirm('Quit this ride with this rider?') && run('/passenger/quit')}>
        Quit this ride
      </button>
    </section>
  );
}
