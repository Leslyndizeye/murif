import React, { useState, useEffect } from 'react';
import {
  FaLaptop,
  FaTicketAlt,
  FaRobot,
  FaFile,
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../../contexts/AuthContext';
import UnifiedSidebar from '../../../components/layout/UnifiedSidebar';
import TopNavbar from '../../../components/layout/TopNavbar';
import { voucherAPI } from '../../../services/api';

const PENDING_STATUSES = ['open', 'assigned', 'in_progress'];
const DONE_STATUSES = ['resolved', 'closed'];

const UserDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [myTickets, setMyTickets] = useState([]);
  const [ticketsError, setTicketsError] = useState('');

  // Check authentication on component mount
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      navigate('/login');
      return;
    }

    try {
      JSON.parse(storedUser);
    } catch {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    setTicketsError('');

    voucherAPI
      .list()
      .then((allTickets) => {
        if (!cancelled) {
          setMyTickets((allTickets || []).filter((ticket) => ticket.requester_id === user.id));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMyTickets([]);
          setTicketsError('Could not load your tickets. Try refreshing the page.');
        }
      })
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const stats = {
    totalAssets: 0,
    myTickets: myTickets.length,
    resolved: myTickets.filter((ticket) => DONE_STATUSES.includes(ticket.status)).length,
    pending: myTickets.filter((ticket) => PENDING_STATUSES.includes(ticket.status)).length,
  };

  const recentActivity = [...myTickets]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 5)
    .map((ticket) => ({
      id: ticket.id,
      title: `${ticket.ticket_number}: ${ticket.title}`,
      time: formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true }),
      icon: <FaTicketAlt />,
    }));

  if (!user) {
    return null;
  }

  return (
    <div className="simple-dashboard-root">
      <div className="simple-container">
        {/* Sidebar - shared across all pages */}
        <UnifiedSidebar activePath="/user-dashboard" />

        {/* Main Content */}
        <main className="simple-main">
          <TopNavbar title="Dashboard" />
          <div className="simple-dashboard-content">
          {/* Welcome Section */}
          <section className="simple-welcome">
            <h1>Welcome back, {user.email.split('@')[0]}!</h1>
            <div className="welcome-subtitle">
              <p>Here's your dashboard overview.</p>
            </div>
          </section>

          {/* Stats Section */}
          <section className="simple-stats-section">
            {ticketsError && <div style={{ marginBottom: '10px', color: '#b91c1c' }}>{ticketsError}</div>}
            <div className="simple-stats-grid">
              <div className="simple-stat-card">
                <div className="simple-stat-value">{stats.totalAssets}</div>
                <div className="simple-stat-label">My Assets</div>
              </div>
              <div className="simple-stat-card">
                <div className="simple-stat-value">{stats.myTickets}</div>
                <div className="simple-stat-label">My Tickets</div>
              </div>
              <div className="simple-stat-card">
                <div className="simple-stat-value">{stats.resolved}</div>
                <div className="simple-stat-label">Resolved</div>
              </div>
              <div className="simple-stat-card">
                <div className="simple-stat-value">{stats.pending}</div>
                <div className="simple-stat-label">Pending</div>
              </div>
            </div>
          </section>

          {/* Quick Actions */}
          <section className="simple-actions-section">
            <h2 className="simple-section-title">Quick Actions</h2>
            <div className="simple-actions-grid">
              <div
                className="simple-action-card"
                onClick={() => navigate('/report')}
                style={{ cursor: 'pointer' }}
              >
                <div className="simple-action-icon">
                  <FaLaptop />
                </div>
                <h3>Reports</h3>
                <p>View your reports and history</p>
              </div>

              <div
                className="simple-action-card"
                onClick={() => navigate('/voucher')}
                style={{ cursor: 'pointer' }}
              >
                <div className="simple-action-icon">
                  <FaTicketAlt />
                </div>
                <h3>Submit Request</h3>
                <p>Create a new support ticket</p>
              </div>

              <div
                className="simple-action-card"
                onClick={() => navigate('/voucher')}
                style={{ cursor: 'pointer' }}
              >
                <div className="simple-action-icon">
                  <FaTicketAlt />
                </div>
                <h3>My Tickets</h3>
                <p>Check your ticket status</p>
              </div>

              <div
                className="simple-action-card"
                onClick={() => navigate('/chatbot')}
                style={{ cursor: 'pointer' }}
              >
                <div className="simple-action-icon">
                  <FaRobot />
                </div>
                <h3>AI Chatbot</h3>
                <p>Get instant help from our AI</p>
              </div>

              <div
                className="simple-action-card"
                onClick={() => navigate('/document')}
                style={{ cursor: 'pointer' }}
              >
                <div className="simple-action-icon">
                  <FaFile />
                </div>
                <h3>Document</h3>
                <p>Sign and manage documents</p>
              </div>
            </div>
          </section>

          {/* Recent Activity */}
          <section className="simple-activity-section">
            <h2 className="simple-section-title">Recent Activity</h2>
            <div className="simple-activity-list">
              {recentActivity.length === 0 && <p>No recent ticket activity yet.</p>}
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


export default UserDashboard;
