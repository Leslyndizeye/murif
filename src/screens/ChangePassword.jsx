import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dashboardPathForRole } from '../utils/roles';
import { getApiErrorMessage } from '../utils/apiError';

const ChangePassword = () => {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  if (!user?.must_change_password) return <Navigate to={dashboardPathForRole(user?.role)} replace />;

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (newPassword.length < 8) { setError('Use at least 8 characters for your new password.'); return; }
    if (newPassword !== confirmation) { setError('New passwords do not match.'); return; }
    if (currentPassword === newPassword) { setError('Choose a password different from your temporary password.'); return; }
    setSaving(true);
    setError('');
    try {
      const response = await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      navigate(dashboardPathForRole(response.user.role), { replace: true });
    } catch (failure) {
      setError(getApiErrorMessage(failure, 'Unable to change your password. Please try again.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <main style={{ minHeight: '100vh', background: '#f5f7fa', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section style={{ width: '100%', maxWidth: 480, background: 'white', borderRadius: 16, padding: 32 }}>
        <h1>Choose your own password</h1>
        <p>You signed in with a temporary password. Set a new password before continuing to MURI.</p>
        <p>{user.email}</p>
        <form onSubmit={submit}>
          {error && <p role="alert" className="status-message error">{error}</p>}
          <div className="form-group"><label htmlFor="current-password">Temporary password</label><input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} disabled={saving} /></div>
          <div className="form-group"><label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={newPassword} onChange={event => setNewPassword(event.target.value)} disabled={saving} /></div>
          <div className="form-group"><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={saving} /></div>
          <button type="submit" className="save-btn" disabled={saving}>{saving ? 'Saving...' : 'Save password and continue'}</button>
          <button type="button" className="cancel-btn" onClick={logout} disabled={saving}>Sign out</button>
        </form>
      </section>
    </main>
  );
};

export default ChangePassword;
