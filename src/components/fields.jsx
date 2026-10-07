export function Field({ label, children, hint }) {
  return (
    <fieldset className="field">
      <legend>{label}</legend>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </fieldset>
  );
}

// Segmented radio buttons: options = [[value, label], ...]
export function Choice({ name, value, onChange, options }) {
  return (
    <div className="choice" role="radiogroup">
      {options.map(([val, label]) => (
        <label key={String(val)} className={value === val ? 'on' : ''}>
          <input type="radio" name={name} checked={value === val} onChange={() => onChange(val)} />
          {label}
        </label>
      ))}
    </div>
  );
}

export const YES_NO = [[true, 'Yes'], [false, 'No']];

export function PinInput({ value, onChange, label = 'PIN (4 digits)', autoComplete = 'current-password', free = false }) {
  // `free` allows admin passwords on the sign-in form
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="password" required autoComplete={autoComplete} value={value}
        {...(free ? { maxLength: 100 } : { inputMode: 'numeric', pattern: '\\d{4}', maxLength: 4 })}
        onChange={(e) => onChange(free ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 4))}
      />
    </label>
  );
}

export function Alert({ error, ok }) {
  if (error) return <p className="alert error" role="alert">{error}</p>;
  if (ok) return <p className="alert ok" role="status">{ok}</p>;
  return null;
}
