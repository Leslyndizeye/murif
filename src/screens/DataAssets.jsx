import React, { useCallback, useEffect, useState } from 'react';
import { FaPlus, FaSearch, FaTrash } from 'react-icons/fa';
import UnifiedSidebar from '../components/layout/UnifiedSidebar';
import TopNavbar from '../components/layout/TopNavbar';
import { assetAPI, usersAPI } from '../services/api';
import { ButtonUtility } from '../components/ui/button-utility';
import { Eye, Pencil } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getApiErrorMessage } from '../utils/apiError';
import ManualLoginDetails from '../components/ManualLoginDetails';

const EMPTY_ASSET = { name: '', category: '', serial_number: '', status: 'Available' };
const EMPTY_USER = { name: '', username: '', email: '', department: '' };

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
  const [loginDetails, setLoginDetails] = useState(null);
  const [userLoadMessage, setUserLoadMessage] = useState('');
  const [userActionMessage, setUserActionMessage] = useState({ text: '', type: '' });

  const [assets, setAssets] = useState([]);
  const [editingAsset, setEditingAsset] = useState(null);
  const [viewingAsset, setViewingAsset] = useState(null);
  const [assetFormError, setAssetFormError] = useState('');
  const [savingAsset, setSavingAsset] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [userFormError, setUserFormError] = useState('');
  const [removingItems, setRemovingItems] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const savingItem = savingAsset || savingUser;

  // New item form state
  const [newUser, setNewUser] = useState(EMPTY_USER);
  const [newAsset, setNewAsset] = useState(EMPTY_ASSET);

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
      return true;
    } catch {
      setUserLoadMessage('Unable to load users from server.');
      return false;
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
      showActionFeedback(getApiErrorMessage(error, 'Failed to update user status.'), 'error');
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
      showActionFeedback(getApiErrorMessage(error, 'Failed to reset password.'), 'error');
    }
  };


  const openAddModal = () => {
    if (activeTab === 'data' && !canManageUsers) return;
    setEditingAsset(null);
    setNewAsset(EMPTY_ASSET);
    setAssetFormError('');
    setUserFormError('');
    setShowAddModal(true);
  };

  const openEditAsset = (asset) => {
    setEditingAsset(asset);
    setNewAsset({ name: asset.name, category: asset.category, serial_number: asset.serial_number, status: asset.status });
    setAssetFormError('');
    setShowAddModal(true);
  };

  const closeItemModal = () => {
    if (savingItem) return;
    setShowAddModal(false);
    setEditingAsset(null);
    setAssetFormError('');
  };

  const handleSaveItem = async (event) => {
    event?.preventDefault();
    if (savingItem) return;
    if (activeTab === 'data') {
      if (!canManageUsers) return;
      const payload = {
        full_name: newUser.name.trim(),
        username: newUser.username.trim() || null,
        email: newUser.email.trim().toLowerCase(),
        department: newUser.department.trim() || null,
        role: 'USER',
      };
      if (!payload.full_name || !payload.email) {
        setUserFormError('Full name and organization email are required.');
        return;
      }
      setSavingUser(true);
      setUserFormError('');
      try {
        const response = await usersAPI.createUser(payload);
        const refreshed = await loadUsers();
        setLoginDetails(response?.temporary_password ? response : null);
        setNewUser(EMPTY_USER);
        if (refreshed) {
          showActionFeedback(response?.message || 'User created successfully.');
        } else {
          setUserActionMessage({ text: 'User was created, but the list could not be refreshed. Reload the page to see the saved account.', type: 'error' });
        }
      } catch (error) {
        setUserFormError(getApiErrorMessage(error, 'Failed to create user.'));
        return;
      } finally {
        setSavingUser(false);
      }
    } else {
      const payload = {
        name: newAsset.name.trim(),
        category: newAsset.category.trim(),
        serial_number: newAsset.serial_number.trim(),
      };
      if (!payload.name || !payload.category || !payload.serial_number) {
        setAssetFormError('Asset name, category, and serial number are required.');
        return;
      }
      if (assets.some((asset) => asset.id !== editingAsset?.id && asset.serial_number === payload.serial_number)) {
        setAssetFormError('An asset with this serial number already exists.');
        return;
      }
      setSavingAsset(true);
      setAssetFormError('');
      try {
        const savedAsset = editingAsset
          ? await assetAPI.update(editingAsset.id, { ...payload, status: newAsset.status })
          : await assetAPI.create(payload);
        setAssets((previous) => editingAsset
          ? previous.map((asset) => asset.id === savedAsset.id ? savedAsset : asset)
          : [savedAsset, ...previous]);
        setNewAsset(EMPTY_ASSET);
        setEditingAsset(null);
        showActionFeedback(editingAsset ? 'IT device updated successfully.' : 'IT device added successfully.');
      } catch (error) {
        setAssetFormError(getApiErrorMessage(error, editingAsset ? 'Failed to update IT device.' : 'Failed to create asset.'));
        return;
      } finally {
        setSavingAsset(false);
      }
    }
    setShowAddModal(false);
  };

  const handleRemoveItems = async () => {
    if (removingItems) return;
    if (activeTab === 'data' && !canManageUsers) return;
    setRemovingItems(true);
    setRemoveError('');
    const items = activeTab === 'data'
      ? users.filter((user) => selectedItems.includes(`user-${user.id}`))
      : assets.filter((asset) => selectedItems.includes(`asset-${asset.id}`));
    const results = await Promise.allSettled(items.map((item) => activeTab === 'data'
      ? usersAPI.deleteUser(item.id)
      : assetAPI.remove(item.id)));
    const removedIds = items.filter((_, index) => results[index].status === 'fulfilled').map((item) => item.id);
    const type = activeTab === 'data' ? 'user' : 'asset';
    if (activeTab === 'data') {
      setUsers((previous) => previous.filter((user) => !removedIds.includes(user.id)));
    } else {
      setAssets((previous) => previous.filter((asset) => !removedIds.includes(asset.id)));
    }
    setSelectedItems((previous) => previous.filter((key) => !removedIds.some((id) => key === `${type}-${id}`)));
    setRemovingItems(false);
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) {
      setRemoveError(getApiErrorMessage(failure.reason, 'Failed to remove one or more items.'));
    } else {
      setShowRemoveModal(false);
      showActionFeedback('Selected items removed successfully.');
    }
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
      {loginDetails && <ManualLoginDetails details={loginDetails} onClose={() => setLoginDetails(null)} />}

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
            onClick={() => { setActiveTab('data'); setSelectedItems([]); }}
          >
            Data
          </button>
          <button 
            className={`tab-btn ${activeTab === 'assets' ? 'active' : ''}`}
            onClick={() => { setActiveTab('assets'); setSelectedItems([]); }}
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
            {(activeTab === 'assets' || canManageUsers) && <>
            <button className="action-btn add-btn" onClick={openAddModal}>
              <FaPlus aria-hidden="true" /> Add New
            </button>
            <button 
              className="action-btn remove-btn" 
              onClick={() => { setRemoveError(''); setShowRemoveModal(true); }}
              disabled={selectedItems.length === 0}
            >
              <FaTrash aria-hidden="true" /> Remove
            </button>
            </>}
          </div>
        </div>

        {userActionMessage.text && <p className={`status-message ${userActionMessage.type}`} role={userActionMessage.type === 'error' ? 'alert' : 'status'}>{userActionMessage.text}</p>}

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
                              aria-label={`Select ${user.name}`}
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
                            <ButtonUtility icon={Pencil} tooltip={`Edit ${asset.name}`} onClick={() => openEditAsset(asset)} />
                            <ButtonUtility icon={Eye} tooltip={`View ${asset.name}`} onClick={() => setViewingAsset(asset)} />
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
                <h4>Disposed</h4>
                <p className="summary-number">
                  {assets.filter(a => a.status === 'Disposed').length}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div className="modal-overlay">
            <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="item-modal-title">
              <div className="modal-header">
                <h3 id="item-modal-title">{editingAsset ? 'Edit IT Device' : `Add New ${activeTab === 'data' ? 'User' : 'Asset'}`}</h3>
                <button className="close-modal" aria-label="Close item form" onClick={closeItemModal} disabled={savingItem}>✕</button>
              </div>

              <div className="modal-body">
                {activeTab === 'data' ? (
                  <form className="add-form" id="user-editor-form" onSubmit={handleSaveItem}>
                    <h4>User Details</h4>
                    {userFormError && <p className="status-message error" role="alert">{userFormError}</p>}
                    <p className="field-hint">Use an @icttoolsasm.com organization email. After saving, copy the temporary login details and email them to the user yourself.</p>
                    <div className="form-group">
                      <label htmlFor="user-full-name">Full Name</label>
                      <input
                        id="user-full-name"
                        type="text"
                        required
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        placeholder="Enter full name"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="user-username">Username (optional)</label>
                      <input
                        id="user-username"
                        type="text"
                        value={newUser.username}
                        onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="user-email">Email</label>
                      <input
                        id="user-email"
                        type="email"
                        required
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        placeholder="name@icttoolsasm.com"
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group half">
                        <label htmlFor="user-department">Department</label>
                        <input
                          id="user-department"
                          type="text"
                          value={newUser.department}
                          onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                          placeholder="Department"
                        />
                      </div>
                      <div className="form-group half">
                        <label htmlFor="user-role">Role</label>
                        <input id="user-role" value="User" readOnly />
                      </div>
                    </div>
                  </form>
                ) : (
                  <form className="add-form" id="asset-editor-form" onSubmit={handleSaveItem}>
                    {assetFormError && <p className="status-message error" role="alert">{assetFormError}</p>}
                    <div className="form-group">
                      <label htmlFor="asset-name">Asset Name</label>
                      <input
                        id="asset-name"
                        type="text"
                        required
                        maxLength={200}
                        value={newAsset.name}
                        onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                        placeholder="Enter asset name"
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group half">
                        <label htmlFor="asset-category">Category</label>
                        <input
                          id="asset-category"
                          type="text"
                          required
                          maxLength={100}
                          value={newAsset.category}
                          onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value })}
                          placeholder="e.g., Infrastructure"
                        />
                      </div>
                      <div className="form-group half">
                        <label htmlFor="asset-serial-number">Serial Number</label>
                        <input
                          id="asset-serial-number"
                          type="text"
                          required
                          maxLength={100}
                          value={newAsset.serial_number}
                          onChange={(e) => setNewAsset({ ...newAsset, serial_number: e.target.value })}
                          placeholder="Manufacturer serial number"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="asset-status">Status</label>
                      <select
                        id="asset-status"
                        disabled={!editingAsset}
                        value={newAsset.status}
                        onChange={(e) => setNewAsset({ ...newAsset, status: e.target.value })}
                      >
                        <option value="Available">Available</option>
                        <option value="Assigned">Assigned</option>
                        <option value="Disposed">Disposed</option>
                      </select>
                      {!editingAsset && <p className="field-hint">New devices start as Available. Use Logistics to record an asset issue.</p>}
                    </div>
                  </form>
                )}
              </div>

              <div className="modal-footer">
                <button className="cancel-btn" onClick={closeItemModal} disabled={savingItem}>Cancel</button>
                <button className="save-btn" type="submit" form={activeTab === 'assets' ? 'asset-editor-form' : 'user-editor-form'} disabled={savingItem}>{savingItem ? 'Saving...' : editingAsset ? 'Save Changes' : 'Add Item'}</button>
              </div>
            </div>
          </div>
        )}

        {viewingAsset && (
          <div className="modal-overlay">
            <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="asset-details-title">
              <div className="modal-header"><h3 id="asset-details-title">IT Device Details</h3><button className="close-modal" aria-label="Close device details" onClick={() => setViewingAsset(null)}>✕</button></div>
              <div className="modal-body">
                <dl>
                  <dt>Asset Name</dt><dd>{viewingAsset.name}</dd>
                  <dt>Category</dt><dd>{viewingAsset.category}</dd>
                  <dt>Serial Number</dt><dd>{viewingAsset.serial_number}</dd>
                  <dt>Status</dt><dd>{viewingAsset.status}</dd>
                </dl>
              </div>
              <div className="modal-footer"><button className="cancel-btn" onClick={() => setViewingAsset(null)}>Close</button></div>
            </div>
          </div>
        )}

        {/* Remove Confirmation Modal */}
        {showRemoveModal && (
          <div className="modal-overlay">
            <div className="modal-content remove-modal" role="dialog" aria-modal="true" aria-labelledby="remove-items-title">
              <div className="modal-header">
                <h3 id="remove-items-title">Confirm Removal</h3>
                <button className="close-modal" onClick={() => setShowRemoveModal(false)} disabled={removingItems}>✕</button>
              </div>
              
              <div className="modal-body">
                <p>Are you sure you want to remove <strong>{selectedItems.length}</strong> selected item(s)?</p>
                <p className="warning-text">This action cannot be undone.</p>
                {removeError && <p className="status-message error" role="alert">{removeError}</p>}
              </div>

              <div className="modal-footer">
                <button className="cancel-btn" onClick={() => setShowRemoveModal(false)} disabled={removingItems}>Cancel</button>
                <button className="remove-confirm-btn" onClick={handleRemoveItems} disabled={removingItems}>
                  {removingItems ? 'Removing...' : `Remove ${selectedItems.length} Items`}
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
