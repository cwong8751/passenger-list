import { useState } from 'react';
import { Alert, Choice, Field, YES_NO } from './fields.jsx';

export const BIKE_TYPES = ['cruiser', 'sport', 'adventure', 'touring', 'naked', 'dual-sport', 'standard', 'scooter', 'other'];
export const HELMETS = [['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL'], ['idk', "I don't know"]];

const EMPTY = {
  rider: { make: '', model: '', displacement: '', bikeType: 'sport', spareHelmet: false, takesPassengers: true },
  passenger: { helmetSize: 'idk', firstTime: true, experience: 1 },
};

// Used both on registration and on the settings page.
export default function ProfileForm({ role, initial, submitLabel, onSubmit, children }) {
  const [p, setP] = useState(initial || EMPTY[role]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setP((x) => ({ ...x, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try { await onSubmit(p); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit}>
      {children}
      {role === 'rider' ? (
        <>
          <div className="row">
            <label className="field"><span>Motorcycle make</span>
              <input required maxLength={40} placeholder="Honda" value={p.make} onChange={(e) => set('make')(e.target.value)} /></label>
            <label className="field"><span>Motorcycle model</span>
              <input required maxLength={40} placeholder="CB500X" value={p.model} onChange={(e) => set('model')(e.target.value)} /></label>
          </div>
          <div className="row">
            <label className="field"><span>Displacement (cc)</span>
              <input required type="number" min="1" max="3000" inputMode="numeric" placeholder="500" value={p.displacement} onChange={(e) => set('displacement')(e.target.value)} /></label>
            <label className="field"><span>Motorcycle type</span>
              <select value={p.bikeType} onChange={(e) => set('bikeType')(e.target.value)}>
                {BIKE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select></label>
          </div>
          <Field label="Have a spare helmet?"><Choice name="spare" value={p.spareHelmet} onChange={set('spareHelmet')} options={YES_NO} /></Field>
          <Field label="Willing to take passengers?"><Choice name="takes" value={p.takesPassengers} onChange={set('takesPassengers')} options={YES_NO} /></Field>
        </>
      ) : (
        <>
          <Field label="Helmet size"><Choice name="helmet" value={p.helmetSize} onChange={set('helmetSize')} options={HELMETS} /></Field>
          <Field label="First time on a motorcycle?"><Choice name="first" value={p.firstTime} onChange={set('firstTime')} options={YES_NO} /></Field>
          <Field label="Experience with motorcycles" hint="1 = none, 5 = very experienced">
            <Choice name="exp" value={p.experience} onChange={set('experience')} options={[1, 2, 3, 4, 5].map((n) => [n, String(n)])} />
          </Field>
        </>
      )}
      <Alert error={error} />
      <button className="primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
    </form>
  );
}
