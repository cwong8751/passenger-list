import { useState } from 'react';
import { api } from '../api.js';
import { useSession } from '../session.jsx';
import { Alert } from '../components/fields.jsx';
import ProfileForm from '../components/ProfileForm.jsx';

export default function Settings() {
  const { data, refresh } = useSession();
  const [saved, setSaved] = useState('');
  const save = async (profile) => {
    setSaved('');
    await api('/profile', { method: 'PUT', body: profile });
    await refresh();
    setSaved('Settings saved');
  };
  return (
    <div className="narrow">
      <h1>Settings</h1>
      <div className="card">
        <ProfileForm role={data.user.role} initial={{ ...data.profile }} submitLabel="Save settings" onSubmit={save} />
        <Alert ok={saved} />
        <p className="muted small">Forgot your PIN? Ask an administrator to reset it.</p>
      </div>
    </div>
  );
}
