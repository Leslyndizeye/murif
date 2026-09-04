import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import UnifiedSidebar from '../components/layout/UnifiedSidebar';
import TopNavbar from '../components/layout/TopNavbar';
import { departmentAPI, stationAPI, usersAPI } from '../services/api';
import { optionsWithFallback } from '../utils/lookupOptions';
import { Checkbox } from '../components/ui/checkbox';
import { Button } from '../components/ui/button';
import { Check } from 'lucide-react';

const Settings = () => {
  const location = useLocation();

  const [currentRole, setCurrentRole] = useState('');
  const [accountInfo, setAccountInfo] = useState({
    username: 'username',
    email: 'username@rab.gov.rw',
    firstName: '',
    lastName: '',
    grantUsername: '',
    station: '',
    department: '',
    role: 'USER',
  });
  const [passwordInfo, setPasswordInfo] = useState({
    password: '',
    confirmPassword: '',
  });
  const [devices, setDevices] = useState([
    { id: 1, name: 'Office Desktop', model: 'Dell OptiPlex 7070', serialNumber: 'SN789456123', rabTag: 'RAB-001' },
    { id: 2, name: 'Laptop', model: 'HP EliteBook 840 G7', serialNumber: 'SN321654987', rabTag: 'RAB-002' },
    { id: 3, name: 'Tablet', model: 'iPad Pro 12.9', serialNumber: 'SN987654321', rabTag: 'RAB-003' },
  ]);
  const [newDevice, setNewDevice] = useState({
    name: '',
    model: '',
    serialNumber: '',
    rabTag: '',
  });
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const [notificationPrefs, setNotificationPrefs] = useState({
    soundEnabled: true,
    toastEnabled: true,
  });
  const [quickAccessForm, setQuickAccessForm] = useState({
    email: '',
    username: '',
  });
  const [departments, setDepartments] = useState([]);
  const [stations, setStations] = useState([]);

  const isITSettingsPage = location.pathname.startsWith('/settings/it');

  useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const role = (storedUser?.role || '').toLowerCase();
      setCurrentRole(role);
      setAccountInfo((prev) => ({
        ...prev,
        username: storedUser?.username || prev.username,
        email: storedUser?.email || prev.email,
      }));
    } catch {
      setCurrentRole('');
    }

    const savedSound = localStorage.getItem('asm_alert_sound_enabled');
    const savedToast = localStorage.getItem('asm_alert_toast_enabled');
    setNotificationPrefs({
      soundEnabled: savedSound === null ? true : savedSound === 'true',
      toastEnabled: savedToast === null ? true : savedToast === 'true',
    });

    Promise.all([departmentAPI.list(), stationAPI.list()])
      .then(([departmentData, stationData]) => {
        setDepartments(departmentData || []);
        setStations(stationData || []);
      })
      .catch(() => {});
  }, []);

  const isITRole = useMemo(() => ['admin', 'manager', 'it'].includes(currentRole), [currentRole]);
  const canGrantAccess = isITRole;

  const clearStatusAfterDelay = () => {
    setTimeout(() => setStatusMessage({ text: '', type: '' }), 3000);
  };

  const handleSaveAccount = () => {
    setStatusMessage({ text: 'Account information updated successfully!', type: 'success' });
    clearStatusAfterDelay();
  };

  const handleSavePassword = () => {
    if (passwordInfo.password !== passwordInfo.confirmPassword) {
      setStatusMessage({ text: 'Passwords do not match.', type: 'error' });
    } else if (passwordInfo.password.length < 8) {
      setStatusMessage({ text: 'Password must be at least 8 characters.', type: 'error' });
    } else {
      setStatusMessage({ text: 'Password updated successfully!', type: 'success' });
      setPasswordInfo({ password: '', confirmPassword: '' });
    }
    clearStatusAfterDelay();
  };

  const handleAddDevice = () => {
    if (!newDevice.name || !newDevice.model) {
      setStatusMessage({ text: 'Please fill in Name and Model fields.', type: 'error' });
      return;
    }

    const deviceToAdd = { id: devices.length + 1, ...newDevice };
    setDevices([...devices, deviceToAdd]);
    setNewDevice({ name: '', model: '', serialNumber: '', rabTag: '' });
    setStatusMessage({ text: 'Device added successfully!', type: 'success' });
    clearStatusAfterDelay();
  };

  const handleSaveNotificationPrefs = () => {
    localStorage.setItem('asm_alert_sound_enabled', String(notificationPrefs.soundEnabled));
    localStorage.setItem('asm_alert_toast_enabled', String(notificationPrefs.toastEnabled));
    setStatusMessage({ text: 'Notification preferences saved.', type: 'success' });
    clearStatusAfterDelay();
  };

  const handleGrantAccess = async () => {
    if (!canGrantAccess) {
      setStatusMessage({ text: 'Only IT personnel can grant access.', type: 'error' });
      clearStatusAfterDelay();
      return;
    }

    const fullName = `${accountInfo.firstName || ''} ${accountInfo.lastName || ''}`.trim();
    if (!fullName || !accountInfo.email || !accountInfo.grantUsername) {
      setStatusMessage({ text: 'First name, last name, username, and email are required.', type: 'error' });
      clearStatusAfterDelay();
      return;
    }

    const usernameBase = `${accountInfo.firstName || ''}.${accountInfo.lastName || ''}`
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9.]/g, '');
    const generatedUsername = (accountInfo.grantUsername || usernameBase || accountInfo.email.split('@')[0])
      .toLowerCase()
      .trim();

    try {
      await usersAPI.createUser({
        email: accountInfo.email,
        role: (accountInfo.role || 'USER').toUpperCase(),
        username: generatedUsername,
        full_name: fullName,
        department: accountInfo.department || null,
        station: accountInfo.station || null,
      });

      setStatusMessage({ text: 'User access granted. Login details were emailed to them.', type: 'success' });
      window.dispatchEvent(new Event('asm-users-updated'));
      setAccountInfo((prev) => ({
        ...prev,
        firstName: '',
        lastName: '',
        grantUsername: '',
        station: '',
        department: '',
        role: 'USER',
      }));
    } catch (error) {
      setStatusMessage({ text: error?.response?.data?.detail || 'Failed to grant user access.', type: 'error' });
    }

    clearStatusAfterDelay();
  };

  const handleQuickGrantAccess = async () => {
    if (!canGrantAccess) {
      return;
    }

    const normalizedEmail = (quickAccessForm.email || '').trim().toLowerCase();
    const normalizedUsername = (quickAccessForm.username || '').trim().toLowerCase();
    if (!normalizedEmail || !normalizedUsername) {
      setStatusMessage({ text: 'Email and username are required.', type: 'error' });
      clearStatusAfterDelay();
      return;
    }

    try {
      await usersAPI.createUser({
        username: normalizedUsername,
        email: normalizedEmail,
        role: 'USER',
        full_name: normalizedUsername,
        department: null,
        station: null,
      });

      setQuickAccessForm({ email: '', username: '' });
      setStatusMessage({ text: 'User access granted. Login details were emailed to them.', type: 'success' });
      window.dispatchEvent(new Event('asm-users-updated'));
    } catch (error) {
      setStatusMessage({ text: error?.response?.data?.detail || 'Failed to grant user access.', type: 'error' });
    }

    clearStatusAfterDelay();
  };

  if (isITSettingsPage && !isITRole) {
    return <Navigate to="/settings" replace />;
  }

  return (
    <div className="setting-container">
      <UnifiedSidebar activePath={isITSettingsPage ? '/settings/it' : '/settings'} />

      <div className="setting-main">
        <TopNavbar title={isITRole ? 'IT Settings' : 'Settings'} />

        <div className="setting-header">
          <h1 className="setting-title">{isITRole ? 'IT Settings' : 'Settings'}</h1>
        </div>

        {statusMessage.text && <div className={`status-message ${statusMessage.type}`}>{statusMessage.text}</div>}

        <div className="setting-section">
          <h2 className="section-title">Account Information</h2>

          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-input"
              value={accountInfo.username}
              onChange={(e) => setAccountInfo({ ...accountInfo, username: e.target.value })}
            />
            <div className="user-email">Current username: {accountInfo.username}</div>
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={accountInfo.email}
              onChange={(e) => setAccountInfo({ ...accountInfo, email: e.target.value })}
            />
            <div className="user-email">Current email: {accountInfo.email}</div>
          </div>

          <button className="save-btn" onClick={handleSaveAccount} type="button">
            Save Changes
          </button>
        </div>

        <div className="setting-section">
          <h2 className="section-title">Password Information</h2>

          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Enter new password"
              value={passwordInfo.password}
              onChange={(e) => setPasswordInfo({ ...passwordInfo, password: e.target.value })}
            />
            <div className="password-hint">Password must be at least 8 characters</div>
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Confirm new password"
              value={passwordInfo.confirmPassword}
              onChange={(e) => setPasswordInfo({ ...passwordInfo, confirmPassword: e.target.value })}
            />
          </div>

          <button className="save-btn" onClick={handleSavePassword} type="button">
            Save Changes
          </button>
        </div>

        {canGrantAccess && (
          <div className="setting-section">
            <h2 className="section-title"> User Access Grant</h2>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={quickAccessForm.email}
                onChange={(e) => setQuickAccessForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="e.g. alice.n@rab.gov.rw"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-input"
                value={quickAccessForm.username}
                onChange={(e) => setQuickAccessForm((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="e.g. alice.n"
              />
            </div>

            <p className="field-hint">A temporary password will be generated and emailed to this address.</p>

            <button className="save-btn" onClick={handleQuickGrantAccess} type="button">
              Grant Access
            </button>
          </div>
        )}

        {isITSettingsPage && (
          <div className="setting-section">
            <h2 className="section-title">Member Access</h2>

            <div className="form-group">
              <label className="form-label">First Name</label>
              <input
                type="text"
                className="form-input"
                value={accountInfo.firstName}
                onChange={(e) => setAccountInfo({ ...accountInfo, firstName: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input
                type="text"
                className="form-input"
                value={accountInfo.lastName}
                onChange={(e) => setAccountInfo({ ...accountInfo, lastName: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={accountInfo.email}
                onChange={(e) => setAccountInfo({ ...accountInfo, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-input"
                value={accountInfo.grantUsername || ''}
                onChange={(e) => setAccountInfo({ ...accountInfo, grantUsername: e.target.value })}
                placeholder="e.g. jane.doe"
              />
            </div>

            <p className="field-hint">A temporary password will be generated and emailed to this address.</p>

            <div className="form-group">
              <label className="form-label">Station</label>
              <select
                className="form-input"
                value={accountInfo.station}
                onChange={(e) => setAccountInfo({ ...accountInfo, station: e.target.value })}
              >
                <option value="">Select station</option>
                {optionsWithFallback(stations, accountInfo.station).map((station) => (
                  <option key={station.id} value={station.name}>{station.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Department</label>
              <select
                className="form-input"
                value={accountInfo.department}
                onChange={(e) => setAccountInfo({ ...accountInfo, department: e.target.value })}
              >
                <option value="">Select department</option>
                {optionsWithFallback(departments, accountInfo.department).map((department) => (
                  <option key={department.id} value={department.name}>{department.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <select
                className="form-input"
                value={accountInfo.role}
                onChange={(e) => setAccountInfo({ ...accountInfo, role: e.target.value })}
              >
                <option value="USER">User</option>
                <option value="IT">IT</option>
              </select>
            </div>

            <button className="save-btn" onClick={handleGrantAccess} type="button">
              Access Granted
            </button>
          </div>
        )}

        <div className="setting-section">
          <h2 className="section-title">Assigned Devices</h2>

          <div className="add-device-form">
            <h3 className="add-device-title">Add New Device</h3>

            <div className="form-group">
              <label className="form-label">Device Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Office Desktop"
                value={newDevice.name}
                onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Device Model</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Dell OptiPlex 7070"
                value={newDevice.model}
                onChange={(e) => setNewDevice({ ...newDevice, model: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Serial Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., SN789456123"
                value={newDevice.serialNumber}
                onChange={(e) => setNewDevice({ ...newDevice, serialNumber: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">RAB Tag</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., RAB-001"
                value={newDevice.rabTag}
                onChange={(e) => setNewDevice({ ...newDevice, rabTag: e.target.value })}
              />
            </div>

            <button className="save-btn" onClick={handleAddDevice} type="button">
              Add Device
            </button>
          </div>

          <table className="assigned-devices-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Device Model</th>
                <th>Serial Number</th>
                <th>RAB Tag</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id}>
                  <td>{device.name}</td>
                  <td>{device.model}</td>
                  <td>{device.serialNumber}</td>
                  <td>{device.rabTag}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="setting-section">
          <h2 className="section-title">Notification Preferences</h2>

          <div className="form-group">
            <Checkbox
                label="Enable alert sound for new unread notifications"
                checked={notificationPrefs.soundEnabled}
                onChange={(e) => setNotificationPrefs({ ...notificationPrefs, soundEnabled: e.target.checked })}
              />
          </div>

          <div className="form-group">
            <Checkbox
                label="Enable toast popup for new unread notifications"
                checked={notificationPrefs.toastEnabled}
                onChange={(e) => setNotificationPrefs({ ...notificationPrefs, toastEnabled: e.target.checked })}
              />
          </div>

          <Button
            className="save-btn"
            color="primary"
            size="default"
            iconLeading={Check}
            onClick={handleSaveNotificationPrefs}
            type="button"
          >
            Save Notification Preferences
          </Button>
        </div>

        <div className="setting-section">
          <h2 className="section-title">Terms & Policies</h2>

          <div className="terms-policy-text">
            <h4>1. Scope of Use</h4>
            <p>
              MURI is for authorized operational use by approved User and IT Personnel accounts only. Access is role-
              based and must align with assigned responsibilities.
            </p>

            <h4>2. Account Responsibility</h4>
            <p>
              You are responsible for all activity performed under your account. Password sharing is prohibited.
              Report suspected unauthorized access immediately.
            </p>

            <h4>3. Data Handling and Compliance</h4>
            <p>
              Asset, ticket, and document records must be accurate, lawful, and policy-compliant. Sensitive
              information must not be disclosed to unauthorized parties.
            </p>

            <h4>4. IT Personnel Duties</h4>
            <p>
              IT Personnel must process assignments, update ticket status correctly, and manage records with
              professionalism and audit readiness.
            </p>

            <h4>5. User Duties</h4>
            <p>
              Users must provide complete issue descriptions, maintain truthful records, and avoid misuse of ticketing
              and request channels.
            </p>

            <h4>6. Enforcement</h4>
            <p>
              Violations may result in restricted access, account suspension, or disciplinary escalation according to
              institutional policy.
            </p>

            <p className="terms-policy-note">
              Official source document:
              {' '}
              <a
                href="https://docs.google.com/document/d/1KyaDIMSdX4WoLciCt6j1FGWyCbiT97gGavaaygbSNQo/edit?usp=sharing"
                target="_blank"
                rel="noreferrer"
              >
                Terms of Reference & Policies (Google Doc)
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
