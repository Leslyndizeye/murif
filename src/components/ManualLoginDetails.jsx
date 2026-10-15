import React, { useState } from 'react';

// Credentials stay in component memory and are discarded when dismissed.
const ManualLoginDetails = ({ details, onClose }) => {
  const [copyMessage, setCopyMessage] = useState('');
  if (!details?.temporary_password) return null;
  const loginUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/login`;
  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(`Your MURI account\nSign in: ${loginUrl}\nEmail: ${details.email}\nUsername: ${details.username || details.email}\nTemporary password: ${details.temporary_password}\nPlease change your password when you first sign in.`);
      setCopyMessage('Login details copied. Paste them into your email to the user.');
    } catch {
      setCopyMessage('Copy is unavailable. Select and copy the details below.');
    }
  };
  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.45)' }}>
      <section role="dialog" aria-modal="true" aria-labelledby="manual-login-title" style={{ background: 'white', padding: 28, borderRadius: 16, maxWidth: 540, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 id="manual-login-title">Account created — send login details</h2>
        <p>Copy these details and email them to the user yourself. No automatic email was sent.</p>
        <p>The temporary password is shown only here. After closing, it cannot be viewed again. The user must change it at first sign-in.</p>
        <dl><dt>Sign-in link</dt><dd>{loginUrl}</dd><dt>Email</dt><dd>{details.email}</dd><dt>Username</dt><dd>{details.username || details.email}</dd></dl>
        <div className="form-group">
          <label htmlFor="manual-temporary-password">Temporary password</label>
          <input id="manual-temporary-password" type="text" value={details.temporary_password} readOnly autoComplete="off" spellCheck={false} />
        </div>
        {copyMessage && <p role="status">{copyMessage}</p>}
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button type="button" className="save-btn" onClick={copyDetails}>Copy login details</button>
          <button type="button" className="cancel-btn" onClick={onClose}>Done</button>
        </div>
      </section>
    </div>
  );
};

export default ManualLoginDetails;
