import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FaLaptop,
  FaTicketAlt,
  FaBell,
  FaFileContract,
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { assetAPI, documentAPI, reportAPI, usersAPI, voucherAPI } from '../../../services/api';
import { getApiErrorMessage } from '../../../utils/apiError';
import UnifiedSidebar from '../../../components/layout/UnifiedSidebar';
import TopNavbar from '../../../components/layout/TopNavbar';

const DOCUMENT_TYPES = {
  receiving: 'receiving',
};

const ITDashboard = () => {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({
    totalAssets: 0,
    activeTickets: 0,
    resolved: 0,
    pending: 0,
  });
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [peopleError, setPeopleError] = useState('');
  const [workloadBoard, setWorkloadBoard] = useState([]);
  const [queueSnapshot, setQueueSnapshot] = useState({
    open: 0,
    assigned: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
  });
  const [documentQueue, setDocumentQueue] = useState({
    receiving: 0,
    pendingSignatures: 0,
    signedReturned: 0,
  });
  const [dataError, setDataError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const previousUnreadCountRef = useRef(null);

  const playAlertSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.05;

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.18);
    } catch {
      // Ignore sound errors on restricted autoplay contexts
    }
  }, []);

  const maybeNotifyUnreadIncrease = useCallback((latestNotifications) => {
    const unreadCount = (latestNotifications || []).filter((item) => !item.is_read).length;
    const previousUnreadCount = previousUnreadCountRef.current;
    previousUnreadCountRef.current = unreadCount;

    if (previousUnreadCount === null || unreadCount <= previousUnreadCount) {
      return;
    }

    const soundEnabled = localStorage.getItem('asm_alert_sound_enabled');
    const toastEnabled = localStorage.getItem('asm_alert_toast_enabled');
    const shouldPlaySound = soundEnabled === null ? true : soundEnabled === 'true';
    const shouldShowToast = toastEnabled === null ? true : toastEnabled === 'true';

    if (shouldPlaySound) {
      playAlertSound();
    }

    if (shouldShowToast) {
      const newAlerts = unreadCount - previousUnreadCount;
      setToastMessage(`${newAlerts} new notification${newAlerts > 1 ? 's' : ''} received`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  }, [playAlertSound]);

  const loadNotifications = useCallback(async () => {
    const latestNotifications = await reportAPI.getNotifications({
      limit: 30,
      target_email: user?.email || undefined,
    });
    setNotifications(latestNotifications || []);
    maybeNotifyUnreadIncrease(latestNotifications || []);
  }, [maybeNotifyUnreadIncrease, user?.email]);

  // Read the session already checked by ProtectedRoute.
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');

    // If nothing stored, send back to login
    if (!token || !storedUser) {
      navigate('/login');
      return;
    }

    try {
      setUser(JSON.parse(storedUser));
    } catch {
      navigate('/login');
      return;
    }
  }, [navigate]);

  const loadPeople = useCallback(async () => {
    if (!user) return;
    setPeopleLoading(true);
    try {
      const data = await usersAPI.listUsers();
      setPeople(data || []);
      setPeopleError('');
    } catch (error) {
      setPeopleError(getApiErrorMessage(error, 'Unable to load the employee directory.'));
    } finally {
      setPeopleLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadPeople();
    const intervalId = setInterval(loadPeople, 30000);
    window.addEventListener('asm-users-updated', loadPeople);
    window.addEventListener('focus', loadPeople);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('asm-users-updated', loadPeople);
      window.removeEventListener('focus', loadPeople);
    };
  }, [user, loadPeople]);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) return;

      try {
        setDataError('');

        const [overview, vouchers, documents, assets] = await Promise.all([
          reportAPI.getOverview(),
          voucherAPI.list(),
          documentAPI.list(),
          assetAPI.list(),
        ]);

        setStats((prev) => ({
          ...prev,
          totalAssets: (assets || []).length,
          activeTickets: (overview.open || 0) + (overview.assigned || 0) + (overview.in_progress || 0),
          resolved: overview.resolved || 0,
          pending: overview.open || 0,
        }));
        setWorkloadBoard(overview.workload || []);

        const nextQueueSnapshot = (vouchers || []).reduce(
          (accumulator, ticket) => {
            const key = ticket.status;
            if (Object.prototype.hasOwnProperty.call(accumulator, key)) {
              accumulator[key] += 1;
            }
            return accumulator;
          },
          {
            open: 0,
            assigned: 0,
            in_progress: 0,
            resolved: 0,
            closed: 0,
          }
        );
        setQueueSnapshot(nextQueueSnapshot);

        const receivingDocuments = (documents || []).filter(
          (doc) => (doc.document_type || '') === DOCUMENT_TYPES.receiving
        );
        const pendingSignatures = receivingDocuments.filter(
          (doc) => (doc.signature_status || 'not_required') === 'pending_user_signature'
        );
        const signedReturned = receivingDocuments.filter(
          (doc) =>
            (doc.signature_status || 'not_required') === 'signed' ||
            (doc.status || '') === 'returned_to_it'
        );
        setDocumentQueue({
          receiving: receivingDocuments.length,
          pendingSignatures: pendingSignatures.length,
          signedReturned: signedReturned.length,
        });

        // Notification failures must not prevent the inventory and queue from updating.
        await reportAPI.checkSla();
        await loadNotifications();
      } catch (error) {
        setDataError(getApiErrorMessage(error, 'Failed to load dashboard data'));
      }
    };

    loadDashboardData();

    const intervalId = setInterval(() => {
      loadDashboardData();
    }, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [user, loadNotifications]);

  const handleMarkNotificationRead = async (notificationId) => {
    try {
      await reportAPI.markNotificationRead(notificationId);
      setNotifications((prev) => prev.filter((item) => item.id !== notificationId));
    } catch {
      setDataError('Failed to mark notification as read');
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await reportAPI.markAllNotificationsRead({ targetEmail: user?.email || null });
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    } catch {
      setDataError('Failed to mark all notifications as read');
    }
  };

  const extractTicketNumber = (message = '') => {
    const match = String(message).match(/TKT-[A-Za-z0-9-]+/);
    return match ? match[0] : '';
  };

  const formatNotificationMessage = (notification) => {
    const ticketNumber = extractTicketNumber(notification?.message) || `ticket #${notification?.voucher_id}`;

    if (notification?.category === 'sla_breached') {
      return `You have ${ticketNumber} that needs immediate fixing because SLA is breached.`;
    }

    if (notification?.category === 'sla_at_risk') {
      return `You have ${ticketNumber} to work on now to prevent an SLA breach.`;
    }

    return `You have ${ticketNumber} that requires your attention.`;
  };

  const handleViewNotification = (notification) => {
    const query = new URLSearchParams();
    if (notification?.voucher_id) {
      query.set('voucher_id', String(notification.voucher_id));
    }

    const ticketNumber = extractTicketNumber(notification?.message);
    if (ticketNumber) {
      query.set('ticket', ticketNumber);
    }

    const queryString = query.toString();
    navigate(`/voucher${queryString ? `?${queryString}` : ''}`);
  };

  const unreadNotifications = notifications.filter((item) => !item.is_read);
  const activePeople = people.filter((person) => person.is_active);
  const inactivePeopleCount = people.length - activePeople.length;
  const activeITCount = activePeople.filter((person) => (person.role || '').toLowerCase() === 'it').length;
  const totalActiveTickets = workloadBoard.reduce((total, item) => total + item.active_tickets, 0);

  // If user is not authenticated (should have redirected already)
  if (!user) {
    return null;
  }

  const notificationButton = (
    <div className="simple-notification-wrapper">
      <button
        className="simple-icon-btn"
        aria-label="Toggle notifications"
        onClick={() => setShowNotifications((prev) => !prev)}
        type="button"
      >
        <FaBell aria-hidden="true" />
        {unreadNotifications.length > 0 && (
          <span className="notification-badge">{unreadNotifications.length}</span>
        )}
      </button>

      {showNotifications && (
        <div className="simple-notification-panel simple-notification-panel-visible">
          <div className="simple-notification-header">
            <h4>Notifications</h4>
            {unreadNotifications.length > 0 && (
              <button
                type="button"
                className="mark-all-btn"
                onClick={handleMarkAllNotificationsRead}
              >
                Mark all as read
              </button>
            )}
          </div>
          {unreadNotifications.length > 0 ? (
            unreadNotifications.map((notification, index) => (
              <div
                key={notification.id}
                className={`notification-item ${notification.is_read ? 'is-read' : 'is-unread'}`}
                style={{ animationDelay: `${Math.min(index, 6) * 0.05}s` }}
              >
                <div className="notification-text">{formatNotificationMessage(notification)}</div>
                <div className="notification-actions-row">
                  <button
                    type="button"
                    className="view-ticket-btn"
                    onClick={() => handleViewNotification(notification)}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className="mark-single-btn"
                    onClick={() => handleMarkNotificationRead(notification.id)}
                  >
                    Mark as read
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="notifications-empty">No new notifications</p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="simple-dashboard-root">
      {showToast && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: 2000,
            background: '#111827',
            color: '#ffffff',
            padding: '10px 14px',
            borderRadius: '10px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
            fontSize: '14px',
          }}
        >
          {toastMessage}
        </div>
      )}

      <div className="simple-container">
        {/* Sidebar - shared across all pages */}
        <UnifiedSidebar activePath="/it-dashboard" />

        {/* Main Content */}
        <main className="simple-main">
          <TopNavbar title="Dashboard" rightExtra={notificationButton} />
          <div className="simple-dashboard-content">
          <div className="it-glass-shell">
            <header className="it-glass-hero">
              <div>
                <span className="it-eyebrow">Operations workspace</span>
                <h1>Welcome back, {user.full_name || user.username || 'User'}.</h1>
                <p>Monitor support flow, team capacity, and documents from one quiet workspace.</p>
              </div>
              <div className="it-hero-context">
                <span className="it-live-dot" /> Cooking
                {user.department && <strong>{user.department}</strong>}
              </div>
            </header>

            {dataError && <div className="it-glass-error">{dataError}</div>}

            <section className="it-metric-grid" aria-label="IT metrics">
              <button type="button" className="it-glass-card it-metric-card it-metric-feature" onClick={() => navigate('/data-assets')}>
                <span className="it-card-kicker">Inventory</span>
                <strong>{stats.totalAssets}</strong>
                <span>Total assets</span>
                <FaLaptop aria-hidden="true" />
              </button>
              <button type="button" className="it-glass-card it-metric-card" onClick={() => navigate('/voucher')}>
                <span className="it-card-kicker">Queue today</span>
                <strong>{stats.activeTickets}</strong>
                <span>Active tickets</span>
                <FaTicketAlt aria-hidden="true" />
              </button>
              <button type="button" className="it-glass-card it-metric-card" onClick={() => navigate('/document')}>
                <span className="it-card-kicker">Documents</span>
                <strong>{documentQueue.pendingSignatures}</strong>
                <span>Awaiting signatures</span>
                <FaFileContract aria-hidden="true" />
              </button>
            </section>

            <div className="it-glass-content-grid">
              <main className="it-glass-main-column">
                <section className="it-glass-card it-chart-card">
                  <div className="it-panel-heading"><div><span className="it-card-kicker">Ticket flow</span><h2>Queue overview</h2></div><span className="it-panel-total">{queueSnapshot.open + queueSnapshot.assigned + queueSnapshot.in_progress} active</span></div>
                  <div className="it-bar-chart" aria-label="Ticket queue overview">
                    {[['Open', queueSnapshot.open], ['Assigned', queueSnapshot.assigned], ['In progress', queueSnapshot.in_progress], ['Resolved', queueSnapshot.resolved], ['Closed', queueSnapshot.closed]].map(([label, value]) => {
                      const maxQueue = Math.max(queueSnapshot.open, queueSnapshot.assigned, queueSnapshot.in_progress, queueSnapshot.resolved, queueSnapshot.closed, 1);
                      return <div className="it-bar-item" key={label}><div className="it-bar-label"><span>{label}</span><strong>{value}</strong></div><div className="it-bar-track"><span style={{ width: `${Math.max((value / maxQueue) * 100, value ? 8 : 0)}%` }} /></div></div>;
                    })}
                  </div>
                </section>

                <section className="it-glass-card it-team-card">
                  <div className="it-panel-heading"><div><span className="it-card-kicker">Team capacity</span><h2>IT workload</h2></div><button type="button" onClick={() => navigate('/report')}>View report</button></div>
                  <div className="it-team-list">
                    {workloadBoard.length === 0 && <p className="it-empty-state">No active IT personnel detected.</p>}
                    {workloadBoard.map((member, index) => {
                      const person = people.find((item) => item.id === member.user_id);
                      const name = person?.full_name || person?.username || member.email;
                      return <div className="it-team-row" key={member.user_id}><span className="it-avatar">{(name || 'IT').slice(0, 2).toUpperCase()}</span><div className="it-team-person"><strong>{name}</strong><span>{member.email}</span></div><div className="it-team-load"><span>{member.active_tickets} active</span><div><i style={{ width: `${totalActiveTickets ? (member.active_tickets / totalActiveTickets) * 100 : 0}%` }} /></div></div><span className="it-rank">{String(index + 1).padStart(2, '0')}</span></div>;
                    })}
                  </div>
                </section>

                <section className="it-glass-card it-employee-table-card">
                  <div className="it-panel-heading"><div><span className="it-card-kicker">People</span><h2>Employee directory</h2></div><button type="button" onClick={loadPeople} disabled={peopleLoading}>{peopleLoading ? 'Refreshing...' : 'Refresh people'}</button></div>
                  {peopleError && <p className="it-glass-error" role="alert">{peopleError}</p>}
                  <div className="it-employee-table-wrap">
                    <table className="it-employee-table" aria-label="Employee directory" aria-busy={peopleLoading}>
                      <thead><tr><th>Employee</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
                      <tbody>{people.map((person) => {
                        const name = person.full_name || person.username || person.email;
                        return <tr key={person.id}>
                          <td><span className="it-table-avatar">{(name || 'U').slice(0, 2).toUpperCase()}</span><strong>{name}</strong></td>
                          <td>{person.email}</td><td>{person.role || 'USER'}</td>
                          <td><span className={`it-state-pill${person.is_active ? '' : ' it-state-pill-inactive'}`}>{person.is_active ? 'Active' : 'Inactive'}</span></td>
                        </tr>;
                      })}</tbody>
                    </table>
                    {peopleLoading && people.length === 0 && <p className="it-empty-state" role="status">Loading people...</p>}
                    {!peopleLoading && !peopleError && people.length === 0 && <p className="it-empty-state">No employee accounts yet. Grant access in Settings to add a person.</p>}
                  </div>
                </section>
              </main>

              <aside className="it-glass-right-rail">
                <section className="it-glass-card it-meeting-card"><div className="it-panel-heading"><div><span className="it-card-kicker">Next up</span><h2>Upcoming work</h2></div><FaBell aria-hidden="true" /></div><div className="it-meeting-time">{documentQueue.pendingSignatures > 0 ? 'Action needed' : 'All clear'}</div><p>{documentQueue.pendingSignatures > 0 ? `${documentQueue.pendingSignatures} document${documentQueue.pendingSignatures === 1 ? '' : 's'} waiting for a user signature.` : 'No pending document signatures right now.'}</p><button type="button" onClick={() => navigate('/document')}>Open document queue <span>→</span></button></section>
                <section className="it-glass-card it-format-card" aria-label="Account overview">
                  <div className="it-panel-heading"><div><span className="it-card-kicker">People</span><h2>Account overview</h2></div></div>
                  {peopleError ? <p className="it-empty-state">Account counts are unavailable.</p> : <>
                    <div className="it-format-stack"><div><span>Total accounts</span><strong>{peopleLoading ? '…' : people.length}</strong></div><div><span>Active accounts</span><strong>{peopleLoading ? '…' : activePeople.length}</strong></div><div><span>Active IT staff</span><strong>{peopleLoading ? '…' : activeITCount}</strong></div></div>
                    <div className="it-format-bar"><span style={{ width: `${people.length ? (activePeople.length / people.length) * 100 : 0}%` }} /><span style={{ width: `${people.length ? (inactivePeopleCount / people.length) * 100 : 0}%` }} /></div>
                    <div className="it-format-legend"><span>Active</span><span>Inactive</span></div>
                  </>}
                </section>
                <section className="it-glass-card it-doc-card"><span className="it-card-kicker">Document flow</span><h2>{documentQueue.receiving}</h2><p>receiving documents in the workflow</p><div className="it-doc-stats"><span><strong>{documentQueue.signedReturned}</strong> returned</span><span><strong>{documentQueue.pendingSignatures}</strong> pending</span></div></section>
              </aside>
            </div>
          </div>

          <footer className="simple-footer">
            ©2026. MURI. All rights reserved.
          </footer>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ITDashboard;
