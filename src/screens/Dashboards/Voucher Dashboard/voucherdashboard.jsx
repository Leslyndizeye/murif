import { useEffect, useMemo, useState } from 'react';
import { FaBoxOpen, FaCheckCircle, FaChartBar, FaExchangeAlt, FaFileContract } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { assetAPI, assetVoucherAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import UnifiedSidebar from '../../../components/layout/UnifiedSidebar';
import TopNavbar from '../../../components/layout/TopNavbar';

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

const VoucherDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [dataError, setDataError] = useState('');

  // Check authentication on component mount, matching the other dashboards.
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) return;

      try {
        setDataError('');

        const [assetData, voucherData] = await Promise.all([
          assetAPI.list(),
          assetVoucherAPI.list(),
        ]);

        setAssets(assetData || []);
        setVouchers(voucherData || []);
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
  }, [user]);

  const stats = useMemo(() => ({
    total: vouchers.length,
    currentlyIssued: vouchers.filter((v) => v.status === 'Issued').length,
    returned: vouchers.filter((v) => v.status === 'Returned').length,
    availableAssets: assets.filter((a) => a.status === 'Available').length,
  }), [vouchers, assets]);

  const recentActivity = useMemo(() => {
    return [...vouchers]
      .sort((a, b) => new Date(b.date_returned || b.date_issued) - new Date(a.date_returned || a.date_issued))
      .slice(0, 8)
      .map((v) => ({
        id: v.id,
        title:
          v.status === 'Returned'
            ? `${v.voucher_number} • ${v.asset_name} returned by ${v.issued_to}`
            : `${v.voucher_number} • ${v.asset_name} issued to ${v.issued_to}`,
        time: new Date(v.status === 'Returned' ? v.date_returned : v.date_issued).toLocaleString(),
        icon: v.status === 'Returned' ? <FaCheckCircle /> : <FaBoxOpen />,
      }));
  }, [vouchers]);

  if (!user) {
    return null;
  }

  return (
    <div className="simple-dashboard-root voucher-dashboard">
      <div className="simple-container">
        {/* Sidebar - shared across all pages */}
        <UnifiedSidebar activePath="/voucher-dashboard" />

        {/* Main Content */}
        <main className="simple-main">
          <TopNavbar title="Logistics" />
          <div className="simple-dashboard-content">
            {/* Welcome Section */}
            <section className="simple-welcome">
              <h1>Welcome back, {user.full_name || user.username || 'there'}!</h1>
              <div className="welcome-subtitle">
                <p>Logistics overview — track which ICT assets are issued and which are available.</p>
                {user.department && user.station && (
                  <div className="user-context">
                    <span className="context-badge">{user.department}</span>
                    <span className="context-badge">{user.station}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Dashboard Overview */}
            <section className="simple-stats-section">
              {dataError && (
                <div className="simple-data-error" style={{ marginBottom: '10px', color: '#b91c1c' }}>
                  {dataError}
                </div>
              )}
              <h2 className="simple-section-title">Dashboard Overview</h2>
              <div className="simple-stats-grid">
                <StatCard
                  value={stats.total}
                  label="Total Logistics Records"
                  onClick={() => navigate('/asset-issuance')}
                />
                <StatCard
                  value={stats.currentlyIssued}
                  label="Assets Currently Issued"
                  onClick={() => navigate('/asset-issuance')}
                />
                <StatCard
                  value={stats.returned}
                  label="Assets Returned"
                  onClick={() => navigate('/asset-issuance')}
                />
                <StatCard
                  value={stats.availableAssets}
                  label="Available Assets"
                  onClick={() => navigate('/data-assets')}
                />
              </div>
            </section>

            {/* Quick Actions */}
            <section className="simple-actions-section">
              <h2 className="simple-section-title">Quick Actions</h2>
              <div className="simple-actions-grid">
                <div
                  className="simple-action-card"
                  onClick={() => navigate('/asset-issuance')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="simple-action-icon">
                    <FaExchangeAlt />
                  </div>
                  <h3>Issue / Return Asset</h3>
                  <p>Record an asset issue or mark an issued asset as returned</p>
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
                  <p>Browse the full asset inventory and availability</p>
                </div>

                <div
                  className="simple-action-card"
                  onClick={() => navigate('/document')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="simple-action-icon">
                    <FaFileContract />
                  </div>
                  <h3>Documents</h3>
                  <p>Check linked receiving/return documents</p>
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
                  <p>System-wide analytics</p>
                </div>
              </div>
            </section>

            {/* Recent Issuance Activity */}
            <section className="simple-activity-section">
              <h2 className="simple-section-title">Recent Issuance Activity</h2>
              <div className="simple-activity-list">
                {recentActivity.length === 0 && <p>No logistics activity yet.</p>}
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

export default VoucherDashboard;
