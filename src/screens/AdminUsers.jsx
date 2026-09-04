import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown } from '@untitledui/icons';
import { useNavigate } from 'react-router-dom';
import {
  FaBuilding,
  FaSearch,
  FaTimes,
  FaPlus,
} from 'react-icons/fa';
import { Button } from '../components/base/buttons/button';
import { Dropdown } from '../components/base/dropdown/dropdown';
import UnifiedSidebar from '../components/layout/UnifiedSidebar';
import TopNavbar from '../components/layout/TopNavbar';
import { useAuth } from '../contexts/AuthContext';
import { departmentAPI, stationAPI, usersAPI } from '../services/api';
import { optionsWithFallback } from '../utils/lookupOptions';

const EMPTY_FORM = {
  full_name: '',
  username: '',
  email: '',
  department: '',
  station: '',
  role: 'USER',
};

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionMessage, setActionMessage] = useState({ text: '', type: '' });

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState('create'); // 'create' | 'edit'
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [editingUser, setEditingUser] = useState(null);
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetForm, setResetForm] = useState({ newPassword: '', confirmPassword: '' });
  const [targetUser, setTargetUser] = useState(null);
  const [resetError, setResetError] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [departments, setDepartments] = useState([]);
  const [stations, setStations] = useState([]);

  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id ?? null;

  const loadUsers = useCallback(async () => {
    try {
      setLoadError('');
      const data = await usersAPI.listUsers();
      setUsers(data || []);
    } catch (error) {
      setLoadError(error?.response?.data?.detail || 'Unable to load users from server.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLookups = useCallback(async () => {
    try {
      const [departmentData, stationData] = await Promise.all([departmentAPI.list(), stationAPI.list()]);
      setDepartments(departmentData || []);
      setStations(stationData || []);
    } catch {
      // Falls back to empty option lists; the form still works with the
      // fallback-current-value option if the user already has one set.
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadLookups();
    window.addEventListener('asm-users-updated', loadUsers);
    return () => window.removeEventListener('asm-users-updated', loadUsers);
  }, [loadUsers, loadLookups]);

  const showActionFeedback = (text, type = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage({ text: '', type: '' }), 3000);
  };

  const filteredUsers = users.filter((user) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesTerm =
      !term ||
      (user.full_name || '').toLowerCase().includes(term) ||
      (user.username || '').toLowerCase().includes(term) ||
      (user.email || '').toLowerCase().includes(term) ||
      (user.department || '').toLowerCase().includes(term);

    const matchesRole = roleFilter === 'all' || (user.role || '').toLowerCase() === roleFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' ? user.is_active : !user.is_active);

    return matchesTerm && matchesRole && matchesStatus;
  });

  const openCreateModal = () => {
    setFormMode('create');
    setEditingUser(null);
    setFormState(EMPTY_FORM);
    setFormError('');
    setShowFormModal(true);
  };

  const openEditModal = (user) => {
    setFormMode('edit');
    setEditingUser(user);
    setFormState({
      ...EMPTY_FORM,
      full_name: user.full_name || '',
      username: user.username || '',
      email: user.email || '',
      department: user.department || '',
      station: user.station || '',
      role: user.role || 'USER',
    });
    setFormError('');
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingUser(null);
    setFormState(EMPTY_FORM);
    setFormError('');
  };

  const handleCreateUser = async () => {
    if (!formState.full_name || !formState.email || !formState.username) {
      setFormError('Full name, username, and email are required.');
      return;
    }

    setFormError('');
    setFormSubmitting(true);
    try {
      await usersAPI.createUser({
        email: formState.email.trim().toLowerCase(),
        username: formState.username.trim().toLowerCase(),
        role: (formState.role || 'USER').toUpperCase(),
        full_name: formState.full_name.trim(),
        department: formState.department || null,
        station: formState.station || null,
      });
      showActionFeedback('User created successfully. Login details were emailed to them.');
      closeFormModal();
      await loadUsers();
    } catch (error) {
      setFormError(error?.response?.data?.detail || 'Failed to create user.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    if (!formState.full_name || !formState.email || !formState.username) {
      setFormError('Full name, username, and email are required.');
      return;
    }

    setFormError('');
    setFormSubmitting(true);
    try {
      await usersAPI.updateUser(editingUser.id, {
        email: formState.email.trim().toLowerCase(),
        username: formState.username.trim().toLowerCase(),
        full_name: formState.full_name.trim(),
        department: formState.department || null,
        station: formState.station || null,
        role: (formState.role || 'USER').toUpperCase(),
      });
      showActionFeedback('User updated successfully.');
      closeFormModal();
      await loadUsers();
    } catch (error) {
      setFormError(error?.response?.data?.detail || 'Failed to update user.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleSubmitForm = () => {
    if (formMode === 'create') {
      handleCreateUser();
    } else {
      handleUpdateUser();
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      const nextIsActive = !user.is_active;
      await usersAPI.updateUserStatus(user.id, nextIsActive);
      showActionFeedback(`User ${nextIsActive ? 'activated' : 'deactivated'} successfully.`);
      await loadUsers();
    } catch (error) {
      showActionFeedback(error?.response?.data?.detail || 'Failed to update user status.', 'error');
    }
  };

  const openResetModal = (user) => {
    setTargetUser(user);
    setResetForm({ newPassword: '', confirmPassword: '' });
    setResetError('');
    setShowResetModal(true);
  };

  const closeResetModal = () => {
    setShowResetModal(false);
    setTargetUser(null);
    setResetError('');
  };

  const handleResetPassword = async () => {
    if (!targetUser) return;

    if (!resetForm.newPassword || resetForm.newPassword.length < 8) {
      setResetError('New password must be at least 8 characters.');
      return;
    }

    if (resetForm.newPassword !== resetForm.confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    setResetError('');
    setResetSubmitting(true);
    try {
      await usersAPI.resetUserPassword(targetUser.id, resetForm.newPassword);
      showActionFeedback('Password reset successfully.');
      closeResetModal();
    } catch (error) {
      setResetError(error?.response?.data?.detail || 'Failed to reset password.');
    } finally {
      setResetSubmitting(false);
    }
  };

  const openDeleteModal = (user) => {
    setDeleteTarget(user);
    setDeleteError('');
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteTarget(null);
    setDeleteError('');
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;

    setDeleteError('');
    setDeleteSubmitting(true);
    try {
      await usersAPI.deleteUser(deleteTarget.id);
      showActionFeedback('User deleted successfully.');
      closeDeleteModal();
      await loadUsers();
    } catch (error) {
      setDeleteError(error?.response?.data?.detail || 'Failed to delete user.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="simple-dashboard-root">
      <div className="simple-container">
        <UnifiedSidebar activePath="/admin/users" />

        <main className="simple-main">
          <TopNavbar title="User Management" />
          <div className="simple-dashboard-content">
            <div className="admin-users-main">
              <header className="admin-users-header">
                <h1>User Management</h1>
                <p>Create, update, and manage every account in the system.</p>
              </header>

              {actionMessage.text && (
                <div className={`admin-users-message ${actionMessage.type}`}>{actionMessage.text}</div>
              )}
              {loadError && <div className="admin-users-message error">{loadError}</div>}

              <div className="admin-users-toolbar">
                <div className="admin-users-search">
                  <span className="search-icon"><FaSearch /></span>
                  <input
                    type="text"
                    placeholder="Search by name, username, email, or department..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="it">IT</option>
                  <option value="voucher">Voucher</option>
                  <option value="user">User</option>
                </select>

                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>

                <button type="button" className="row-action-btn" onClick={() => navigate('/admin/departments-stations')}>
                  <FaBuilding /> Departments & Stations
                </button>

                <button type="button" className="admin-users-add-btn" onClick={openCreateModal}>
                  <FaPlus /> Add User
                </button>
              </div>

              <div className="admin-users-table-container">
                <table className="admin-users-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Department</th>
                      <th>Station</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <tr key={`skeleton-${index}`} className="skeleton-row">
                          {Array.from({ length: 8 }).map((__, cellIndex) => (
                            <td key={cellIndex}><span className="skeleton-cell" /></td>
                          ))}
                        </tr>
                      ))
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="admin-users-empty">No users found</td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id}>
                          <td>{user.full_name || '-'}</td>
                          <td>{user.username || '-'}</td>
                          <td>{user.email}</td>
                          <td>{user.department || '-'}</td>
                          <td>{user.station || '-'}</td>
                          <td>
                            <span className={`role-pill role-${(user.role || '').toLowerCase()}`}>
                              {user.role}
                            </span>
                          </td>
                          <td>
                            <span className={`status-pill ${user.is_active ? 'status-active' : 'status-inactive'}`}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="admin-users-actions">
                            <Dropdown.Root>
                              <Button
                                type="button"
                                size="sm"
                                color="secondary"
                                iconTrailing={ChevronDown}
                                className="group user-actions-button *:data-icon:size-4 *:data-icon:stroke-[2.25px]!"
                              >
                                Actions
                              </Button>
                              <Dropdown.Popover className="w-54">
                                <Dropdown.Menu>
                                  <Dropdown.Section>
                                    <Dropdown.Item onAction={() => openEditModal(user)}>Edit</Dropdown.Item>
                                    <Dropdown.Item onAction={() => openResetModal(user)}>Reset password</Dropdown.Item>
                                    <Dropdown.Item
                                      isDisabled={user.id === currentUserId}
                                      onAction={() => handleToggleStatus(user)}
                                    >
                                      {user.is_active ? 'Deactivate' : 'Activate'}
                                    </Dropdown.Item>
                                  </Dropdown.Section>
                                  <Dropdown.Separator />
                                  <Dropdown.Section>
                                    <Dropdown.Item
                                      className="user-action-delete"
                                      isDisabled={user.id === currentUserId}
                                      onAction={() => openDeleteModal(user)}
                                    >
                                      Delete
                                    </Dropdown.Item>
                                  </Dropdown.Section>
                                </Dropdown.Menu>
                              </Dropdown.Popover>
                            </Dropdown.Root>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {showFormModal && (
                <div className="modal-overlay">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h3>{formMode === 'create' ? 'Add New User' : `Edit ${editingUser?.full_name || editingUser?.email}`}</h3>
                      <button type="button" className="close-modal" onClick={closeFormModal} disabled={formSubmitting}><FaTimes /></button>
                    </div>

                    <div className="modal-body">
                      {formError && <div className="modal-error">{formError}</div>}

                      <div className="form-group">
                        <label>Full Name</label>
                        <input
                          type="text"
                          value={formState.full_name}
                          onChange={(e) => setFormState((prev) => ({ ...prev, full_name: e.target.value }))}
                          placeholder="Full name"
                        />
                      </div>

                      <div className="form-group">
                        <label>Username</label>
                        <input
                          type="text"
                          value={formState.username}
                          onChange={(e) => setFormState((prev) => ({ ...prev, username: e.target.value }))}
                          placeholder="e.g. jane.doe"
                        />
                      </div>

                      <div className="form-group">
                        <label>Email</label>
                        <input
                          type="email"
                          value={formState.email}
                          onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
                          placeholder="name@icttoolsasm.com"
                        />
                        <p className="field-hint">Must be a company email ending in @icttoolsasm.com</p>
                      </div>

                      <div className="form-row">
                        <div className="form-group half">
                          <label>Department</label>
                          <select
                            value={formState.department}
                            onChange={(e) => setFormState((prev) => ({ ...prev, department: e.target.value }))}
                          >
                            <option value="">Select department</option>
                            {optionsWithFallback(departments, formState.department).map((department) => (
                              <option key={department.id} value={department.name}>{department.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group half">
                          <label>Station</label>
                          <select
                            value={formState.station}
                            onChange={(e) => setFormState((prev) => ({ ...prev, station: e.target.value }))}
                          >
                            <option value="">Select station</option>
                            {optionsWithFallback(stations, formState.station).map((station) => (
                              <option key={station.id} value={station.name}>{station.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Role</label>
                        <select
                          value={formState.role}
                          onChange={(e) => setFormState((prev) => ({ ...prev, role: e.target.value }))}
                          disabled={formMode === 'edit' && editingUser?.id === currentUserId}
                        >
                          <option value="USER">User</option>
                          <option value="IT">IT</option>
                          <option value="ADMIN">Admin</option>
                          <option value="VOUCHER">Voucher</option>
                        </select>
                        {formMode === 'edit' && editingUser?.id === currentUserId && (
                          <p className="field-hint">You cannot change your own role.</p>
                        )}
                      </div>

                      {formMode === 'create' && (
                        <p className="field-hint">
                          A temporary password will be generated and emailed to this address. They can change it after logging in.
                        </p>
                      )}
                    </div>

                    <div className="modal-footer">
                      <button type="button" className="cancel-btn" onClick={closeFormModal} disabled={formSubmitting}>Cancel</button>
                      <button type="button" className="save-btn" onClick={handleSubmitForm} disabled={formSubmitting}>
                        {formSubmitting && <span className="btn-spinner" aria-hidden="true" />}
                        {formSubmitting ? 'Saving...' : formMode === 'create' ? 'Create User' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showResetModal && (
                <div className="modal-overlay">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h3>Reset Password</h3>
                      <button type="button" className="close-modal" onClick={closeResetModal} disabled={resetSubmitting}><FaTimes /></button>
                    </div>

                    <div className="modal-body">
                      {resetError && <div className="modal-error">{resetError}</div>}
                      <p className="modal-lead">
                        Reset password for <strong>{targetUser?.email}</strong>
                      </p>
                      <div className="form-group">
                        <label>New Password</label>
                        <input
                          type="password"
                          value={resetForm.newPassword}
                          onChange={(e) => setResetForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                          placeholder="Enter new password"
                        />
                      </div>
                      <div className="form-group">
                        <label>Confirm Password</label>
                        <input
                          type="password"
                          value={resetForm.confirmPassword}
                          onChange={(e) => setResetForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                          placeholder="Confirm password"
                        />
                      </div>
                    </div>

                    <div className="modal-footer">
                      <button type="button" className="cancel-btn" onClick={closeResetModal} disabled={resetSubmitting}>Cancel</button>
                      <button type="button" className="save-btn" onClick={handleResetPassword} disabled={resetSubmitting}>
                        {resetSubmitting && <span className="btn-spinner" aria-hidden="true" />}
                        {resetSubmitting ? 'Resetting...' : 'Reset Password'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showDeleteModal && (
                <div className="modal-overlay">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h3>Delete User</h3>
                      <button type="button" className="close-modal" onClick={closeDeleteModal} disabled={deleteSubmitting}><FaTimes /></button>
                    </div>

                    <div className="modal-body">
                      {deleteError && <div className="modal-error">{deleteError}</div>}
                      <p className="modal-lead">
                        Are you sure you want to permanently delete <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong>?
                      </p>
                      <p className="warning-text">
                        This cannot be undone. Users with existing ticket or document history cannot be deleted — deactivate them instead.
                      </p>
                    </div>

                    <div className="modal-footer">
                      <button type="button" className="cancel-btn" onClick={closeDeleteModal} disabled={deleteSubmitting}>Cancel</button>
                      <button type="button" className="delete-confirm-btn" onClick={handleDeleteUser} disabled={deleteSubmitting}>
                        {deleteSubmitting && <span className="btn-spinner" aria-hidden="true" />}
                        {deleteSubmitting ? 'Deleting...' : 'Delete User'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminUsers;
