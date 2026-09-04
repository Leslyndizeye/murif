import React, { useCallback, useEffect, useState } from 'react';
import { FaPlus, FaSearch, FaTrash } from 'react-icons/fa';
import UnifiedSidebar from '../components/layout/UnifiedSidebar';
import TopNavbar from '../components/layout/TopNavbar';
import { assetAPI, usersAPI } from '../services/api';
import { ButtonUtility } from '../components/ui/button-utility';
import { Eye, Pencil } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const DataAssets = () => {
  const { user: currentUser } = useAuth();
  const canManageUsers = ['admin', 'it'].includes((currentUser?.role || '').toLowerCase());

  const [activeTab, setActiveTab] = useState('data'); // 'data' or 'assets'
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [targetUser, setTargetUser] = useState(null);
  const [resetPasswordForm, setResetPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [users, setUsers] = useState([]);
  const [userLoadMessage, setUserLoadMessage] = useState('');
  const [userActionMessage, setUserActionMessage] = useState({ text: '', type: '' });

  const [assets, setAssets] = useState([]);

  // New item form state
  const [newUser, setNewUser] = useState({ name: '', email: '', department: '', role: 'User', status: 'Active' });
  const [newAsset, setNewAsset] = useState({ name: '', category: '', serial_number: '', status: 'Available' });

  const loadUsers = useCallback(async () => {
    try {
      setUserLoadMessage('');
      const backendUsers = await usersAPI.listUsers();
      // Reference roster of the staff assets/vouchers actually get issued
      // to (Asset Issuance's "issued to" is free text) — not a place to
      // manage IT/admin/voucher operator accounts, that's /admin/users.
      const mappedUsers = (backendUsers || [])
        .filter((user) => (user.role || '').toUpperCase() === 'USER')
        .map((user) => ({
          id: user.id,
          name: user.full_name || user.username || user.email,
          username: user.username || '-',
          email: user.email,
          department: user.department || '-',
          role: user.role || 'USER',
          status: user.is_active ? 'Active' : 'Inactive',
        }));
      setUsers(mappedUsers);
    } catch {
      setUserLoadMessage('Unable to load users from server.');
    }
  }, []);

  useEffect(() => {
    loadUsers();
    window.addEventListener('asm-users-updated', loadUsers);
    return () => window.removeEventListener('asm-users-updated', loadUsers);
  }, [loadUsers]);

  useEffect(() => {
    assetAPI.list().then(setAssets).catch(() => showActionFeedback('Unable to load assets from server.', 'error'));
  }, []);

  const showActionFeedback = (text, type = 'success') => {
    setUserActionMessage({ text, type });
    setTimeout(() => setUserActionMessage({ text: '', type: '' }), 3000);
  };

  const handleToggleUserStatus = async (user) => {
    try {
      const nextIsActive = user.status !== 'Active';
      await usersAPI.updateUserStatus(user.id, nextIsActive);
      await loadUsers();
      showActionFeedback(`User ${nextIsActive ? 'activated' : 'deactivated'} successfully.`);
    } catch (error) {
      showActionFeedback(error?.response?.data?.detail || 'Failed to update user status.', 'error');
    }
  };

  const openResetPasswordModal = (user) => {
    setTargetUser(user);
    setResetPasswordForm({ newPassword: '', confirmPassword: '' });
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setShowResetPasswordModal(true);
  };

  const handleResetPassword = async () => {
    if (!targetUser) {
      return;
    }

    if (!resetPasswordForm.newPassword || !resetPasswordForm.confirmPassword) {
      showActionFeedback('Please enter and confirm the new password.', 'error');
      return;
    }

    if (resetPasswordForm.newPassword.length < 8) {
      showActionFeedback('New password must be at least 8 characters.', 'error');
      return;
    }

    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
      showActionFeedback('Passwords do not match.', 'error');
      return;
    }

    try {
      await usersAPI.resetUserPassword(targetUser.id, resetPasswordForm.newPassword);
      setShowResetPasswordModal(false);
      setTargetUser(null);
      showActionFeedback('Password reset successfully.');
    } catch (error) {
      showActionFeedback(error?.response?.data?.detail || 'Failed to reset password.', 'error');
    }
  };


  const handleAddItem = async () => {
    if (activeTab === 'data') {
      const newId = users.length + 1;
      setUsers([...users, { id: newId, ...newUser }]);
      setNewUser({ name: '', email: '', department: '', role: 'User', status: 'Active' });
    } else {
      try {
        const createdAsset = await assetAPI.create(newAsset);
        setAssets((previous) => [createdAsset, ...previous]);
        setNewAsset({ name: '', category: '', serial_number: '', status: 'Available' });
      } catch (error) {
        showActionFeedback(error?.response?.data?.detail || 'Failed to create asset.', 'error');
        return;
      }
    }
    setShowAddModal(false);
  };

  const handleRemoveItems = () => {
    if (activeTab === 'data') {
      setUsers(users.filter(user => !selectedItems.includes(`user-${user.id}`)));
    } else {
      Promise.all(assets.filter(asset => selectedItems.includes(`asset-${asset.id}`)).map((asset) => assetAPI.remove(asset.id)))
        .then(() => setAssets(assets.filter(asset => !selectedItems.includes(`asset-${asset.id}`))))
        .catch(() => showActionFeedback('Failed to remove one or more assets.', 'error'));
    }
    setSelectedItems([]);
    setShowRemoveModal(false);
  };

  const toggleSelectItem = (type, id) => {
    const itemId = `${type}-${id}`;
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter(item => item !== itemId));
    } else {
      setSelectedItems([...selectedItems, itemId]);
    }
  };

  const selectAll = () => {
    if (activeTab === 'data') {
      setSelectedItems(users.map(u => `user-${u.id}`));
    } else {
      setSelectedItems(assets.map(a => `asset-${a.id}`));
    }
  };

  const deselectAll = () => {
    setSelectedItems([]);
  };

  // Filter data based on search
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAssets = assets.filter(asset => 
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.serial_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="data-assets-page">
      <UnifiedSidebar activePath="/data-assets" />

      {/* Main Content */}
      <div className="main-content">
        <TopNavbar title="Data & Assets" />
        {/* Header */}
        <header className="data-assets-header">
          <h1>Data & Assets</h1>
          <p>Manage your organizational data and IT devices</p>
        </header>

        {/* Tabs */}
        <div className="tabs">
          <button 
            className={`tab-btn ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            Data
          </button>
          <button 
            className={`tab-btn ${activeTab === 'assets' ? 'active' : ''}`}
            onClick={() => setActiveTab('assets')}
          >
            IT Devices
          </button>
        </div>

        {/* Search and Actions Bar */}
        <div className="actions-bar">
          <div className="search-box">
            <FaSearch className="search-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="action-buttons">
            {selectedItems.length > 0 && (
              <button className="action-btn deselect-btn" onClick={deselectAll}>
                Deselect ({selectedItems.length})
              </button>
            )}
            <button className="action-btn view-btn" onClick={selectAll}>
              Select All
            </button>
            <button className="action-btn add-btn" onClick={() => setShowAddModal(true)}>
              <FaPlus aria-hidden="true" /> Add New
            </button>
            <button 
              className="action-btn remove-btn" 
              onClick={() => setShowRemoveModal(true)}
              disabled={selectedItems.length === 0}
            >
              <FaTrash aria-hidden="true" /> Remove
            </button>
          </div>
        </div>

        {/* Data Tab Content */}
        {activeTab === 'data' && (
          <div className="data-section">
            {/* Users Section */}
            <div className="data-category">
              <h2 className="category-title">
                {/*<span className="category-icon">👥</span>*/}
                Users
              </h2>
              <p style={{ margin: '0 0 10px', color: '#64748b', fontSize: '13px' }}>
                Usernames are visible for account management. Passwords are securely stored and never displayed.
              </p>
              {userLoadMessage && (
                <p style={{ margin: '0 0 10px', color: '#b91c1c', fontSize: '13px' }}>{userLoadMessage}</p>
              )}
              {userActionMessage.text && (
                <p
                  style={{
                    margin: '0 0 10px',
                    color: userActionMessage.type === 'error' ? '#b91c1c' : '#065f46',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  {userActionMessage.text}
                </p>
              )}
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="checkbox-col">
                        <input 
                          type="checkbox" 
                          onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                          checked={selectedItems.length > 0 && 
                            users.every(u => selectedItems.includes(`user-${u.id}`))}
                        />
                      </th>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Department</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map(user => (
                        <tr key={`user-${user.id}`}>
                          <td>
                            <input 
                              type="checkbox"
                              checked={selectedItems.includes(`user-${user.id}`)}
                              onChange={() => toggleSelectItem('user', user.id)}
                            />
                          </td>
                          <td>{user.name}</td>
                          <td>{user.username || '-'}</td>
                          <td>{user.email}</td>
                          <td>{user.department}</td>
                          <td>
                            <span className={`role-badge role-${user.role.toLowerCase()}`}>
                              {user.role}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge status-${user.status.toLowerCase()}`}>
                              {user.status}
                            </span>
                          </td>
                          <td>
                            {canManageUsers ? (
                              <>
                                <button className="action-icon-btn action-reset" onClick={() => openResetPasswordModal(user)}>
                                  Reset PW
                                </button>
                                <button
                                  className={`action-icon-btn ${user.status === 'Active' ? 'action-deactivate' : 'action-activate'}`}
                                  onClick={() => handleToggleUserStatus(user)}
                                >
                                  {user.status === 'Active' ? 'Deactivate' : 'Activate'}
                                </button>
                              </>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="8" className="no-data">No users found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Assets Tab Content */}
        {activeTab === 'assets' && (
          <div className="assets-section">
            <div className="data-category">
              <h2 className="category-title">
                IT Devices
              </h2>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="checkbox-col">
                        <input 
                          type="checkbox" 
                          onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                        />
                      </th>
                      <th>Asset Name</th>
                      <th>Category</th>
                      <th>Serial Number</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.length > 0 ? (
                      filteredAssets.map(asset => (
                        <tr key={`asset-${asset.id}`}>
                          <td>
                            <input 
                              type="checkbox"
                              checked={selectedItems.includes(`asset-${asset.id}`)}
                              onChange={() => toggleSelectItem('asset', asset.id)}
                            />
                          </td>
                          <td>{asset.name}</td>
                          <td>{asset.category}</td>
                          <td>{asset.serial_number}</td>
                          <td>
                            <span className={`status-badge status-${asset.status.toLowerCase()}`}>
                              {asset.status}
                            </span>
                          </td>
                          <td>
                            <ButtonUtility icon={Pencil} tooltip="Edit asset" onClick={() => {}} />
                            <ButtonUtility icon={Eye} tooltip="View asset" onClick={() => {}} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="no-data">No assets found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Asset Summary Cards */}
            <div className="asset-summary">
              <div className="summary-card">
                <h4>Total Assets</h4>
                <p className="summary-number">{assets.length}</p>
              </div>
              <div className="summary-card">
                <h4>Total Value</h4>
                <p className="summary-number">-</p>
              </div>
              <div className="summary-card">
                <h4>Operational</h4>
                <p className="summary-number">
                  {assets.filter(a => a.status === 'Available' || a.status === 'Assigned').length}
                </p>
              </div>
              <div className="summary-card">
                <h4>Maintenance</h4>
                <p className="summary-number">
                  {assets.filter(a => a.status === 'Under Repair').length}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Add New {activeTab === 'data' ? 'User' : 'Asset'}</h3>
                <button className="close-modal" onClick={() => setShowAddModal(false)}>✕</button>
              </div>

              <div className="modal-body">
                {activeTab === 'data' ? (
                  <div className="add-form">
                    <h4>User Details</h4>
                    <div className="form-group">
                      <label>Full Name</label>
                      <input
                        type="text"
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        placeholder="Enter full name"
                      />
                    </div>
                    <div className="form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        placeholder="email@rab.gov.rw"
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group half">
                        <label>Department</label>
                        <input
                          type="text"
                          value={newUser.department}
                          onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                          placeholder="Department"
                        />
                      </div>
                      <div className="form-group half">
                        <label>Role</label>
                        <select
                          value={newUser.role}
                          onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                        >
                          <option value="User">User</option>
                          <option value="Manager">Manager</option>
                          <option value="Admin">Admin</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="add-form">
                    <div className="form-group">
                      <label>Asset Name</label>
                      <input
                        type="text"
                        value={newAsset.name}
                        onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                        placeholder="Enter asset name"
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group half">
                        <label>Category</label>
                        <input
                          type="text"
                          value={newAsset.category}
                          onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value })}
                          placeholder="e.g., Infrastructure"
                        />
                      </div>
                      <div className="form-group half">
                        <label>Serial Number</label>
                        <input
                          type="text"
                          value={newAsset.serial_number}
                          onChange={(e) => setNewAsset({ ...newAsset, serial_number: e.target.value })}
                          placeholder="Manufacturer serial number"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Status</label>
                      <select
                        value={newAsset.status}
                        onChange={(e) => setNewAsset({ ...newAsset, status: e.target.value })}
                      >
                        <option value="Available">Available</option>
                        <option value="Assigned">Assigned</option>
                        <option value="Under Repair">Under Repair</option>
                        <option value="Disposed">Disposed</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button className="cancel-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button className="save-btn" onClick={handleAddItem}>Add Item</button>
              </div>
            </div>
          </div>
        )}

        {/* Remove Confirmation Modal */}
        {showRemoveModal && (
          <div className="modal-overlay">
            <div className="modal-content remove-modal">
              <div className="modal-header">
                <h3>Confirm Removal</h3>
                <button className="close-modal" onClick={() => setShowRemoveModal(false)}>✕</button>
              </div>
              
              <div className="modal-body">
                <p>Are you sure you want to remove <strong>{selectedItems.length}</strong> selected item(s)?</p>
                <p className="warning-text">This action cannot be undone.</p>
              </div>

              <div className="modal-footer">
                <button className="cancel-btn" onClick={() => setShowRemoveModal(false)}>Cancel</button>
                <button className="remove-confirm-btn" onClick={handleRemoveItems}>
                  Remove {selectedItems.length} Items
                </button>
              </div>
            </div>
          </div>
        )}

        {showResetPasswordModal && (
          <div className="modal-overlay">
            <div className="modal-content remove-modal">
              <div className="modal-header">
                <h3>Reset User Password</h3>
                <button className="close-modal" onClick={() => setShowResetPasswordModal(false)}>✕</button>
              </div>

              <div className="modal-body">
                <p style={{ marginBottom: '12px' }}>
                  Reset password for <strong>{targetUser?.email}</strong>
                </p>

                <div className="form-group">
                  <label>New Password</label>
                  <div className="password-inline-group">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={resetPasswordForm.newPassword}
                      onChange={(e) => setResetPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Enter new password"
                    />
                    <button
                      className="action-icon-btn"
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                    >
                      {showNewPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Confirm Password</label>
                  <div className="password-inline-group">
                    <input
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      value={resetPasswordForm.confirmPassword}
                      onChange={(e) => setResetPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm password"
                    />
                    <button
                      className="action-icon-btn"
                      type="button"
                      onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                    >
                      {showConfirmNewPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="cancel-btn" onClick={() => setShowResetPasswordModal(false)}>Cancel</button>
                <button className="save-btn" onClick={handleResetPassword}>Reset Password</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataAssets;
