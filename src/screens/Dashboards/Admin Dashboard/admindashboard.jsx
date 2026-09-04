import { useCallback, useEffect, useRef, useState } from 'react';
import { FaUsers, FaTicketAlt, FaBoxOpen, FaChartBar, FaBell } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { disposalAPI, documentAPI, reportAPI, usersAPI, voucherAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import UnifiedSidebar from '../../../components/layout/UnifiedSidebar';
import TopNavbar from '../../../components/layout/TopNavbar';

const DOCUMENT_TYPES = {
  receiving: 'receiving',
};

const StatCard = ({ value, label, onClick }) => (
  <div
    className="simple-stat-card"
    style={onClick ? { cursor: 'pointer' } : undefined}
    onClick={onClick}
  >
    <div className="simple-stat-value">{value}</div>
    <div className="simple-stat-label">{label}</div>
  </div>
);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeTickets: 0,
    resolved: 0,
    pending: 0,
  });
  const [userRoster, setUserRoster] = useState({
    admins: 0,
    it: 0,
    users: 0,
    active: 0,
    inactive: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
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
  const [disposalCount, setDisposalCount] = useState(0);
  const [dataError, setDataError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const previousUnreadCountRef = useRef(null);

  // Check authentication on component mount, matching the other dashboards.
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      navigate('/login');
    }
  }, [navigate]);

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

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) return;

      try {
        setDataError('');

        const [overview, vouchers, users, documents, disposals] = await Promise.all([
          reportAPI.getOverview(),
          voucherAPI.list(),
          usersAPI.listUsers(),
          documentAPI.list(),
          disposalAPI.list(),
        ]);

        await reportAPI.checkSla();
        await loadNotifications();

        setStats((prev) => ({
          ...prev,
          totalUsers: (users || []).length,
          activeTickets: (overview.open || 0) + (overview.assigned || 0) + (overview.in_progress || 0),
          resolved: overview.resolved || 0,
          pending: overview.open || 0,
        }));
        setWorkloadBoard(overview.workload || []);

        const nextUserRoster = (users || []).reduce(
          (accumulator, person) => {
            const role = (person.role || '').toLowerCase();
            if (role === 'admin') accumulator.admins += 1;
            else if (role === 'it') accumulator.it += 1;
            else accumulator.users += 1;

            if (person.is_active) accumulator.active += 1;
            else accumulator.inactive += 1;

            return accumulator;
          },
          { admins: 0, it: 0, users: 0, active: 0, inactive: 0 }
        );
        setUserRoster(nextUserRoster);

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

        setDisposalCount((disposals || []).length);

        const recent = vouchers.slice(0, 8).map((item) => ({
          id: item.id,
          title: `${item.ticket_number} • ${item.title}`,
          time: new Date(item.updated_at).toLocaleString(),
          icon: <FaTicketAlt />,
        }));

        setRecentActivity(recent);
      } catch (error) {
        setDataError(error?.response?.data?.detail || 'Failed to load dashboard data');
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

  if (!user) {
    return null;
  }

  const notificationButton = (
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
  );

  return (
    <div className="simple-dashboard-root admin-dashboard">
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
        <UnifiedSidebar activePath="/admin-dashboard" />

        {/* Main Content */}
        <main className="simple-main">
          <TopNavbar title="Dashboard" rightExtra={notificationButton} />
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
                unreadNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${notification.is_read ? 'is-read' : 'is-unread'}`}
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
          <div className="simple-dashboard-content">
          {/* Welcome Section */}
          <section className="simple-welcome">
            <h1>Welcome back, {user.full_name || user.username || 'Admin'}!</h1>
            <div className="welcome-subtitle">
              <p>System owner overview — everything happening across MURI, in one place.</p>
              {user.department && user.station && (
                <div className="user-context">
                  <span className="context-badge">{user.department}</span>
                  <span className="context-badge">{user.station}</span>
                </div>
              )}
            </div>
          </section>

          {/* Stats Section */}
          <section className="simple-stats-section">
            {dataError && (
              <div className="simple-data-error" style={{ marginBottom: '10px', color: '#b91c1c' }}>
                {dataError}
              </div>
            )}
            <div className="simple-stats-grid">
              <StatCard value={stats.totalUsers} label="Total Users" onClick={() => navigate('/admin/users')} />
              <StatCard value={stats.activeTickets} label="Active Tickets" onClick={() => navigate('/voucher')} />
              <StatCard value={stats.resolved} label="Resolved" />
              <StatCard value={stats.pending} label="Pending" />
            </div>
          </section>

          {/* User Roster */}
          <section className="simple-stats-section">
            <h2 className="simple-section-title">User Roster</h2>
            <div className="simple-stats-grid">
              <StatCard value={userRoster.admins} label="Admins" />
              <StatCard value={userRoster.it} label="IT Personnel" />
              <StatCard value={userRoster.users} label="Users" />
              <StatCard value={userRoster.active} label="Active Accounts" />
              <StatCard value={userRoster.inactive} label="Inactive Accounts" />
            </div>
          </section>

          <section className="simple-stats-section">
            <h2 className="simple-section-title">Document & Disposal Workflow</h2>
            <div className="simple-stats-grid">
              <StatCard value={documentQueue.receiving} label="Receiving Documents" onClick={() => navigate('/document')} />
              <StatCard value={documentQueue.pendingSignatures} label="Pending User Signatures" onClick={() => navigate('/document')} />
              <StatCard value={documentQueue.signedReturned} label="Signed and Returned to IT" onClick={() => navigate('/document')} />
              <StatCard value={disposalCount} label="Disposal Requests" onClick={() => navigate('/disposal')} />
            </div>
          </section>

          {/* Quick Actions */}
          <section className="simple-actions-section">
            <h2 className="simple-section-title">Quick Actions</h2>
            <div className="simple-actions-grid">
              <div
                className="simple-action-card"
                onClick={() => navigate('/admin/users')}
                style={{ cursor: 'pointer' }}
              >
                <div className="simple-action-icon">
                  <FaUsers />
                </div>
                <h3>Manage Users</h3>
                <p>Create accounts, reset passwords, activate/deactivate</p>
              </div>

              <div
                className="simple-action-card"
                onClick={() => navigate('/data-assets')}
                style={{ cursor: 'pointer' }}
              >
                <div className="simple-action-icon">
                  <FaBoxOpen />
                </div>
                <h3>Assets</h3>
                <p>View and manage all tracked assets</p>
              </div>

              <div
                className="simple-action-card"
                onClick={() => navigate('/voucher')}
                style={{ cursor: 'pointer' }}
              >
                <div className="simple-action-icon">
                  <FaTicketAlt />
                </div>
                <h3>All Tickets</h3>
                <p>Review every ticket in the system</p>
              </div>

              <div
                className="simple-action-card"
                onClick={() => navigate('/report')}
                style={{ cursor: 'pointer' }}
              >
                <div className="simple-action-icon">
                  <FaChartBar />
                </div>
                <h3>Reports</h3>
                <p>System-wide analytics and SLA health</p>
              </div>
            </div>
          </section>

          <section className="simple-activity-section">
            <h2 className="simple-section-title">IT Workload Board</h2>
            {workloadBoard.length === 0 && <p>No active IT personnel detected.</p>}
            {workloadBoard.length > 0 && (
              <div style={{ display: 'grid', gap: '10px' }}>
                {workloadBoard.map((member) => (
                  <div
                    key={member.user_id}
                    className="simple-activity-item"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div>
                      <h4>{member.email}</h4>
                      <p className="simple-activity-time">IT Personnel #{member.user_id}</p>
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      {member.active_tickets} active tickets
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="simple-stats-grid" style={{ marginTop: '12px' }}>
              <StatCard value={queueSnapshot.open} label="Open Queue" />
              <StatCard value={queueSnapshot.assigned} label="Assigned Queue" />
              <StatCard value={queueSnapshot.in_progress} label="In Progress Queue" />
              <StatCard value={queueSnapshot.resolved} label="Resolved Queue" />
              <StatCard value={queueSnapshot.closed} label="Closed Queue" />
            </div>
          </section>

          {/* Recent Activity */}
          <section className="simple-activity-section">
            <h2 className="simple-section-title">Recent System Activity</h2>
            <div className="simple-activity-list">
              {recentActivity.length === 0 && <p>No ticket activity yet.</p>}
              {recentActivity.map((item) => (
                <div key={item.id} className="simple-activity-item">
                  <div className="simple-activity-text">
                    <div className="simple-activity-icon">{item.icon}</div>
                    <div>
                      <h4>{item.title}</h4>
                      <p className="simple-activity-time">{item.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <footer className="simple-footer">
            ©2026. MURI. All rights reserved.
          </footer>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
