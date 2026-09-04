import { useEffect, useMemo, useState } from 'react';
import { FaBoxOpen, FaCheckCircle, FaDownload, FaEye, FaSearch, FaTimes, FaUndo } from 'react-icons/fa';
import UnifiedSidebar from '../components/layout/UnifiedSidebar';
import TopNavbar from '../components/layout/TopNavbar';
import { useAuth } from '../contexts/AuthContext';
import { assetAPI, assetVoucherAPI } from '../services/api';

/**
 * Voucher management: issue ICT assets to staff, track returns, and keep a
 * searchable history. Backed by the real /assets and /asset-vouchers API.
 */
const AssetIssuance = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ asset_id: '', issued_to: '', issued_by: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailsVoucher, setDetailsVoucher] = useState(null);

  const selectedAsset = form.asset_id ? assets.find((a) => a.id === Number(form.asset_id)) : null;

  const loadData = () => {
    setLoading(true);
    Promise.all([assetAPI.list(), assetVoucherAPI.list()])
      .then(([assetData, voucherData]) => {
        setAssets(assetData || []);
        setVouchers(voucherData || []);
        setLoadError('');
      })
      .catch(() => setLoadError('Failed to load vouchers.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (showForm) {
      setForm((prev) => ({ ...prev, issued_by: prev.issued_by || user?.full_name || user?.username || '' }));
    }
  }, [showForm, user]);

  const filteredVouchers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return vouchers.filter((v) => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (!term) return true;
      return (
        String(v.voucher_number || '').toLowerCase().includes(term) ||
        String(v.asset_name || '').toLowerCase().includes(term) ||
        String(v.serial_number || '').toLowerCase().includes(term) ||
        String(v.issued_to || '').toLowerCase().includes(term)
      );
    });
  }, [vouchers, searchTerm, statusFilter]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.asset_id || !form.issued_to || !form.issued_by) {
      setFormError('Asset, Issued To, and Issued By are required.');
      return;
    }

    setSubmitting(true);
    assetVoucherAPI
      .create({ asset_id: Number(form.asset_id), issued_to: form.issued_to, issued_by: form.issued_by })
      .then((createdVoucher) => {
        setVouchers((prev) => [createdVoucher, ...prev]);
        setAssets((prev) =>
          prev.map((asset) => (asset.id === createdVoucher.asset_id ? { ...asset, status: 'Assigned' } : asset))
        );
        setForm({ asset_id: '', issued_to: '', issued_by: '' });
        setShowForm(false);
      })
      .catch((error) => setFormError(error?.response?.data?.detail || 'Failed to issue asset.'))
      .finally(() => setSubmitting(false));
  };

  const markReturned = (id) => {
    assetVoucherAPI.returnAsset(id).then((returnedVoucher) => {
      setVouchers((prev) => prev.map((v) => (v.id === id ? returnedVoucher : v)));
      setAssets((prev) =>
        prev.map((asset) => (asset.id === returnedVoucher.asset_id ? { ...asset, status: 'Available' } : asset))
      );
      setDetailsVoucher((prev) => (prev && prev.id === id ? returnedVoucher : prev));
    });
  };

  const handleExport = () => {
    const header = ['Voucher ID', 'Asset', 'Category', 'Serial Number', 'Issued To', 'Issued By', 'Date Issued', 'Status'];
    const rows = filteredVouchers.map((v) => [
      v.voucher_number,
      v.asset_name,
      v.asset_category,
      v.serial_number,
      v.issued_to,
      v.issued_by,
      v.date_issued,
      v.status,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vouchers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="asset-issuance-page">
      <UnifiedSidebar activePath="/asset-issuance" />

      <main className="main-content">
        <TopNavbar title="Logistics" />

        <div className="issuance-content">
          <div className="issuance-header">
            <div>
              <h1>Logistics</h1>
              <p>Record which ICT asset was issued to a staff member, and track returns.</p>
            </div>
            <div className="issuance-header-actions">
              <button type="button" onClick={handleExport} className="issuance-secondary-btn">
                <FaDownload size={12} />
                Export
              </button>
              <button type="button" onClick={() => setShowForm((prev) => !prev)} className="issuance-primary-btn">
                <FaBoxOpen />
                Issue Asset
              </button>
            </div>
          </div>

          {loadError && <div className="issuance-inline-error">{loadError}</div>}

          {showForm && (
            <form onSubmit={handleSubmit} className="issuance-form">
              {formError && <div className="issuance-inline-error issuance-form-error">{formError}</div>}

              <div className="issuance-field">
                <label>Asset</label>
                <select value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })}>
                  <option value="">Select an available asset</option>
                  {assets
                    .filter((asset) => asset.status === 'Available')
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.serial_number})
                      </option>
                    ))}
                </select>
              </div>

              <div className="issuance-field">
                <label>Asset Category</label>
                <input type="text" value={selectedAsset?.category || ''} disabled placeholder="Auto-filled from asset" />
              </div>

              <div className="issuance-field">
                <label>Serial Number</label>
                <input type="text" value={selectedAsset?.serial_number || ''} disabled placeholder="Auto-filled from asset" />
              </div>

              <div className="issuance-field">
                <label>Issued To</label>
                <input
                  type="text"
                  value={form.issued_to}
                  onChange={(e) => setForm({ ...form, issued_to: e.target.value })}
                  placeholder="Staff name"
                />
              </div>

              <div className="issuance-field">
                <label>Issued By</label>
                <input
                  type="text"
                  value={form.issued_by}
                  onChange={(e) => setForm({ ...form, issued_by: e.target.value })}
                  placeholder="Administrator name"
                />
              </div>

              <div className="issuance-field">
                <label>Date Issued</label>
                <input type="text" value={new Date().toLocaleDateString()} disabled />
              </div>

              <div className="issuance-field">
                <label>Status</label>
                <input type="text" value="Issued" disabled />
              </div>

              <div className="issuance-form-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormError('');
                  }}
                  className="issuance-secondary-btn"
                >
                  Cancel
                </button>
                <button type="submit" className="issuance-primary-btn" disabled={submitting}>
                  {submitting ? 'Issuing...' : 'Confirm Issuance'}
                </button>
              </div>
            </form>
          )}

          <div className="issuance-toolbar">
            <div className="issuance-search">
              <FaSearch aria-hidden="true" />
              <input
                type="text"
                placeholder="Search by voucher ID, asset name, serial number, or staff member..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="issuance-filter-select"
            >
              <option value="all">All Statuses</option>
              <option value="Issued">Issued</option>
              <option value="Returned">Returned</option>
            </select>
          </div>

          <div className="issuance-table-card">
            <table className="issuance-table">
              <thead>
                <tr>
                  <th>Voucher ID</th>
                  <th>Asset</th>
                  <th>Category</th>
                  <th>Serial Number</th>
                  <th>Issued To</th>
                  <th>Issued By</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="issuance-table-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="issuance-empty">
                      Loading vouchers...
                    </td>
                  </tr>
                )}
                {!loading &&
                  filteredVouchers.map((v) => (
                    <tr key={v.id} className="issuance-row" onClick={() => setDetailsVoucher(v)}>
                      <td className="issuance-asset-name">{v.voucher_number}</td>
                      <td>{v.asset_name}</td>
                      <td>{v.asset_category}</td>
                      <td>{v.serial_number}</td>
                      <td>{v.issued_to}</td>
                      <td>{v.issued_by}</td>
                      <td>{new Date(v.date_issued).toLocaleDateString()}</td>
                      <td>
                        <span
                          className={`issuance-status ${
                            v.status === 'Issued' ? 'issuance-status-issued' : 'issuance-status-returned'
                          }`}
                        >
                          {v.status === 'Issued' ? <FaBoxOpen size={10} /> : <FaCheckCircle size={10} />}
                          {v.status}
                        </span>
                      </td>
                      <td className="issuance-table-action" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => setDetailsVoucher(v)} className="issuance-view-btn">
                          <FaEye size={10} />
                          View
                        </button>
                        {v.status === 'Issued' && (
                          <button type="button" onClick={() => markReturned(v.id)} className="issuance-return-btn">
                            <FaUndo size={10} />
                            Mark Returned
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                {!loading && filteredVouchers.length === 0 && (
                  <tr>
                    <td colSpan={9} className="issuance-empty">
                      No vouchers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {detailsVoucher && (
        <div className="modal-overlay" onClick={() => setDetailsVoucher(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Voucher {detailsVoucher.voucher_number}</h3>
              <button type="button" className="close-modal" onClick={() => setDetailsVoucher(null)}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="issuance-details-grid">
                <div>
                  <span>Voucher ID</span>
                  <strong>{detailsVoucher.voucher_number}</strong>
                </div>
                <div>
                  <span>Asset Name</span>
                  <strong>{detailsVoucher.asset_name}</strong>
                </div>
                <div>
                  <span>Asset Category</span>
                  <strong>{detailsVoucher.asset_category}</strong>
                </div>
                <div>
                  <span>Serial Number</span>
                  <strong>{detailsVoucher.serial_number}</strong>
                </div>
                <div>
                  <span>Issued To</span>
                  <strong>{detailsVoucher.issued_to}</strong>
                </div>
                <div>
                  <span>Issued By</span>
                  <strong>{detailsVoucher.issued_by}</strong>
                </div>
                <div>
                  <span>Date Issued</span>
                  <strong>{new Date(detailsVoucher.date_issued).toLocaleString()}</strong>
                </div>
                <div>
                  <span>Current Status</span>
                  <strong>{detailsVoucher.status}</strong>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {detailsVoucher.status === 'Issued' && (
                <button type="button" className="save-btn" onClick={() => markReturned(detailsVoucher.id)}>
                  Mark Returned
                </button>
              )}
              <button type="button" className="cancel-btn" onClick={() => setDetailsVoucher(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetIssuance;
