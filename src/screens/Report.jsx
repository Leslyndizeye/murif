import React, { useEffect, useMemo, useState } from 'react';
import {  
  BarChart3,
  Download,
  Filter,
  Calendar,
  CircleCheck,
  Clock,
  TriangleAlert
} from 'lucide-react';
import UnifiedSidebar from '../components/layout/UnifiedSidebar';
import TopNavbar from '../components/layout/TopNavbar';
import DropdownSelect from '../components/ui/dropdown-select';
import { reportAPI, voucherAPI } from '../services/api';

export default function ReportPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [overview, setOverview] = useState(null);
  const [tickets, setTickets] = useState([]);

  const getPeriodStart = (period) => {
    const now = new Date();
    const start = new Date(now);

    if (period === 'today') {
      start.setHours(0, 0, 0, 0);
      return start;
    }

    if (period === 'week') {
      start.setDate(now.getDate() - 7);
      return start;
    }

    if (period === 'month') {
      start.setMonth(now.getMonth() - 1);
      return start;
    }

    start.setFullYear(now.getFullYear() - 1);
    return start;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [overviewData, voucherData] = await Promise.all([
          reportAPI.getOverview(),
          voucherAPI.list(),
        ]);
        setOverview(overviewData);
        setTickets(voucherData || []);
      } catch {
        setOverview(null);
        setTickets([]);
      }
    };

    loadData();
  }, []);

  const filteredTickets = useMemo(() => {
    const periodStart = getPeriodStart(selectedPeriod);

    return (tickets || []).filter((ticket) => {
      const ticketDate = ticket.created_at ? new Date(ticket.created_at) : new Date();
      const withinPeriod = ticketDate >= periodStart;
      const categoryMatch = selectedCategory === 'all' ? true : ticket.status === selectedCategory;
      return withinPeriod && categoryMatch;
    });
  }, [tickets, selectedPeriod, selectedCategory]);

  const filteredOverview = useMemo(() => {
    const statusCount = {
      open: 0,
      assigned: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
    };

    filteredTickets.forEach((ticket) => {
      if (Object.prototype.hasOwnProperty.call(statusCount, ticket.status)) {
        statusCount[ticket.status] += 1;
      }
    });

    return {
      total: filteredTickets.length,
      ...statusCount,
    };
  }, [filteredTickets]);

  const stats = useMemo(() => {
    if (!overview && filteredTickets.length === 0) {
      return {
        totalTickets: 0,
        resolved: 0,
        pending: 0,
        avgResponseTime: 'N/A',
      };
    }

    return {
      totalTickets: filteredOverview.total,
      resolved: filteredOverview.resolved,
      pending: filteredOverview.open + filteredOverview.assigned + filteredOverview.in_progress,
      avgResponseTime: 'N/A',
    };
  }, [overview, filteredOverview, filteredTickets.length]);

  const ticketsByCategory = [
    { category: 'Open', count: filteredOverview.open || 0, percentage: filteredOverview.total ? Math.round(((filteredOverview.open || 0) / filteredOverview.total) * 100) : 0 },
    { category: 'Assigned', count: filteredOverview.assigned || 0, percentage: filteredOverview.total ? Math.round(((filteredOverview.assigned || 0) / filteredOverview.total) * 100) : 0 },
    { category: 'In Progress', count: filteredOverview.in_progress || 0, percentage: filteredOverview.total ? Math.round(((filteredOverview.in_progress || 0) / filteredOverview.total) * 100) : 0 },
    { category: 'Resolved', count: filteredOverview.resolved || 0, percentage: filteredOverview.total ? Math.round(((filteredOverview.resolved || 0) / filteredOverview.total) * 100) : 0 },
    { category: 'Closed', count: filteredOverview.closed || 0, percentage: filteredOverview.total ? Math.round(((filteredOverview.closed || 0) / filteredOverview.total) * 100) : 0 }
  ];

  const recentActivity = filteredTickets.slice(0, 5).map((ticket) => ({
    id: ticket.id,
    user: `User #${ticket.requester_id}`,
    issue: ticket.title,
    status: ticket.status,
    time: new Date(ticket.updated_at).toLocaleString(),
    priority: ticket.priority,
  }));

  const performanceData = useMemo(() => {
    const now = new Date();
    const months = [];

    for (let index = 5; index >= 0; index -= 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const label = monthDate.toLocaleString('default', { month: 'short' });
      const month = monthDate.getMonth();
      const year = monthDate.getFullYear();

      const count = filteredTickets.filter((ticket) => {
        const createdAt = new Date(ticket.created_at);
        return createdAt.getMonth() === month && createdAt.getFullYear() === year;
      }).length;

      months.push({ month: label, tickets: count });
    }

    return months;
  }, [filteredTickets]);

  const handleExport = () => {
    const headers = [
      'Ticket Number',
      'Title',
      'Priority',
      'Status',
      'Requester ID',
      'Assigned To ID',
      'Created At',
      'Updated At',
    ];

    const csvRows = filteredTickets.map((ticket) => [
      ticket.ticket_number,
      ticket.title,
      ticket.priority,
      ticket.status,
      ticket.requester_id,
      ticket.assigned_to_id || '',
      ticket.created_at,
      ticket.updated_at,
    ]);

    const lines = [headers, ...csvRows].map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`)
        .join(',')
    );

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `asm-report-${selectedPeriod}-${selectedCategory}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="report-container">
      <UnifiedSidebar activePath="/report" />

      {/* Main Content */}
      <main className="main-content">
        <TopNavbar title="Reports & Analytics" />

        <div className="content-wrapper">
          {/* Filter Bar */}
          <div className="filter-bar">
            <div className="filter-group">
              <Filter size={18} />
              <DropdownSelect
                className="filter-select"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                options={[
                  { value: 'today', label: 'Today' },
                  { value: 'week', label: 'This Week' },
                  { value: 'month', label: 'This Month' },
                  { value: 'year', label: 'This Year' },
                ]}
              />
            </div>
            
            <div className="filter-group">
              <Calendar size={18} />
              <DropdownSelect
                className="filter-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'open', label: 'Open' },
                  { value: 'assigned', label: 'Assigned' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'resolved', label: 'Resolved' },
                  { value: 'closed', label: 'Closed' },
                ]}
              />
            </div>

            <button className="export-btn" onClick={handleExport}>
              <Download size={18} />
              <span>Export Report</span>
            </button>
          </div>

          {/* Stats Cards */}

          <div className="stats-grid">
            <div className="stat-card stat-card-blue">
              <div className="stat-icon">
                <BarChart3 size={24} />
              </div>
              <div className="stat-content">
                <h3 className="stat-value">{stats.totalTickets}</h3>
                <p className="stat-label">Total Tickets</p>
                <div className="stat-trend stat-trend-up">
                  <span>Live</span>
                  <span>from backend</span>
                </div>
              </div>
            </div>

            <div className="stat-card stat-card-green">
              <div className="stat-icon">
                <CircleCheck size={24} />
              </div>
              <div className="stat-content">
                <h3 className="stat-value">{stats.resolved}</h3>
                <p className="stat-label">Resolved</p>
                <div className="stat-trend stat-trend-up">
                  <span>{stats.totalTickets > 0 ? Math.round((stats.resolved / stats.totalTickets) * 100) : 0}%</span>
                  <span>resolution rate</span>
                </div>
              </div>
            </div>

            <div className="stat-card stat-card-orange">
              <div className="stat-icon">
                <TriangleAlert size={24} />
              </div>
              <div className="stat-content">
                <h3 className="stat-value">{stats.pending}</h3>
                <p className="stat-label">Pending</p>
                <div className="stat-trend stat-trend-down">
                  <span>Live</span>
                  <span>pending count</span>
                </div>
              </div>
            </div>

            <div className="stat-card stat-card-purple">
              <div className="stat-icon">
                <Clock size={24} />
              </div>
              <div className="stat-content">
                <h3 className="stat-value">{stats.avgResponseTime}</h3>
                <p className="stat-label">Avg Response Time</p>
                <div className="stat-trend stat-trend-up">
                  <span>Not yet tracked</span>
                  <span>next iteration</span>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="charts-section">
            {/* Performance Chart */}
            <div className="chart-card chart-card-large">
              <div className="chart-header">
                <h2 className="chart-title">Ticket Volume Trend</h2>
                <p className="chart-subtitle">Monthly ticket statistics</p>
              </div>
            <div className="chart-content">
                  {performanceData.map((item, index) => (
                    <div key={index} className="bar-item">
                      <div 
                        className="bar" 
                        style={{ height: `${Math.max(8, (item.tickets / Math.max(1, stats.totalTickets || 1)) * 100)}%` }}
                        data-value={item.tickets}
                      >
                        <span className="bar-value">{item.tickets}</span>
                      </div>
                      <span className="bar-label">{item.month}</span>
                    </div>
                  ))}
              </div>
              
            </div>

            {/* Category Distribution */}
            <div className="chart-card">
              <div className="chart-header">
                <h2 className="chart-title">Issues by Category</h2>
                <p className="chart-subtitle">Distribution breakdown</p>
              </div>
              <div className="chart-content">
                <div className="category-list">
                  {ticketsByCategory.map((item, index) => (
                    <div key={index} className="category-item">
                      <div className="category-info">
                        <span className="category-name">{item.category}</span>
                        <span className="category-count">{item.count}</span>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity Table */}
          <div className="activity-section">
            <div className="activity-header">
              <h2 className="activity-title">Recent Support Activity</h2>
              <button className="view-all-btn">View All</button>
            </div>
            <div className="activity-table-wrapper">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Issue</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map((activity) => (
                    <tr key={activity.id}>
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar">{activity.user.charAt(0)}</div>
                          <span>{activity.user}</span>
                        </div>
                      </td>
                      <td>{activity.issue}</td>
                      <td>
                        <span className={`status-badge status-${activity.status}`}>
                          {activity.status}
                        </span>
                      </td>
                      <td>
                        <span className={`priority-badge priority-${activity.priority}`}>
                          {activity.priority}
                        </span>
                      </td>
                      <td className="time-cell">{activity.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="activity-section" style={{ marginTop: '20px' }}>
            <div className="activity-header">
              <h2 className="activity-title">IT Workload</h2>
            </div>
            <div className="activity-table-wrapper">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>IT Personnel</th>
                    <th>Active Tickets</th>
                  </tr>
                </thead>
                <tbody>
                  {(overview?.workload || []).map((person) => (
                    <tr key={person.user_id}>
                      <td>{person.email}</td>
                      <td>{person.active_tickets}</td>
                    </tr>
                  ))}
                  {(overview?.workload || []).length === 0 && (
                    <tr>
                      <td colSpan={2}>No IT workload data available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <footer className="footer">
          <p>©2026. MURI. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
