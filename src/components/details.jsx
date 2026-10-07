const yn = (b) => (b ? 'Yes' : 'No');

export function PassengerDetails({ p }) {
  return (
    <dl className="details">
      <dt>Helmet size</dt><dd>{p.helmetSize === 'idk' ? "Doesn't know" : p.helmetSize.toUpperCase()}</dd>
      <dt>First time on a bike</dt><dd>{yn(p.firstTime)}</dd>
      <dt>Experience</dt><dd>{'●'.repeat(p.experience)}{'○'.repeat(5 - p.experience)} ({p.experience}/5)</dd>
    </dl>
  );
}

export function RiderDetails({ r }) {
  return (
    <dl className="details">
      <dt>Motorcycle</dt><dd>{r.make} {r.model}</dd>
      <dt>Displacement</dt><dd>{r.displacement} cc</dd>
      <dt>Type</dt><dd style={{ textTransform: 'capitalize' }}>{r.bikeType}</dd>
      <dt>Spare helmet</dt><dd>{yn(r.spareHelmet)}</dd>
    </dl>
  );
}
