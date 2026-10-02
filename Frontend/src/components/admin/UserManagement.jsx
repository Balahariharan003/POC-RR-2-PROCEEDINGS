import { recordActivity } from '../../services/activityStore.js';
import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  KeyRound,
  UsersRound,
  CheckCircle2,
  X,
  Search,
  Shield,
  UserCheck,
  MapPin,
  Mail,
  Edit2,
  Activity,
  Building,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { apiService } from '../../services/apiService.js';
import Modal from '../common/Modal.jsx';
import PasswordInput from '../common/PasswordInput.jsx';
import './UserManagement.css';

const detailsFor = (user) => ({
  id: user?.id,
  name: user?.full_name || user?.name || '',
  nameTamil: user?.nameTamil || '',
  identifier: user?.username || user?.email || '',
  email: user?.email || '',
  mobileNumber: String(user?.mobileNumber || user?.mobile_number || ''),
  section: user?.section || user?.jurisdiction_taluk || 'Erode',
  district: user?.jurisdiction_district || 'Erode',
  role: user?.role || 'user',
  is_active: user?.is_active !== false,
});

export default function UserManagement({ currentUser, onUserUpdated }) {
  const isUserAdmin = Boolean(
    currentUser?.role === 'admin' ||
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'COLLECTOR'
  );

  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [original, setOriginal] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [changePassword, setChangePassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE' | 'ONLINE'

  const loadUsers = async () => {
    try {
      const data = await apiService.getUsers();
      setUsers(Array.isArray(data) ? data : []);
      setLoadError('');
    } catch (e) {
      setLoadError('Unable to load officers. Please reload this page to try again.');
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  function openOfficer(user = null) {
    const details = detailsFor(user);
    setOriginal(details);
    setEditing({ ...details });
    setPassword('');
    setConfirmation('');
    setChangePassword(false);
    setShowDeleteConfirm(false);
    setFormError('');
    setMessage('');
  }

  function closeOfficer() {
    if (!busy) {
      setEditing(null);
      setShowDeleteConfirm(false);
    }
  }

  const dirty =
    editing &&
    (['name', 'nameTamil', 'mobileNumber', 'section'].some(
      (key) => (editing[key] || '').trim() !== (original[key] || '').trim()
    ) ||
      (editing.identifier || '').trim().toLowerCase() !== (original.identifier || '').trim().toLowerCase() ||
      (editing.role || '').trim() !== (original.role || '').trim() ||
      (changePassword && Boolean(password)));

  const needsPassword = editing && (!editing.id || changePassword);

  async function saveOfficer(event) {
    event.preventDefault();
    if (busy || (editing.id && !dirty)) return;
    setFormError('');
    if (needsPassword && !password) {
      setFormError('Enter a new password.');
      return;
    }
    if (needsPassword && password !== confirmation) {
      setFormError('Passwords do not match.');
      return;
    }
    if (needsPassword && password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      let officer;
      if (editing.id) {
        // Update existing user
        const updateData = {
          full_name: editing.name.trim(),
          email: editing.identifier.includes('@') ? editing.identifier.trim() : editing.email,
          jurisdiction_taluk: editing.section.trim(),
          role: editing.role,
        };
        if (needsPassword && password) {
          updateData.password = password;
        }
        officer = await apiService.updateUser(editing.id, updateData);
        recordActivity('Officer details updated', { reference: editing.name }, currentUser);
        if (needsPassword) recordActivity('Officer password changed', { reference: editing.name }, currentUser);
      } else {
        // Create new user
        const createData = {
          username: editing.identifier.trim(),
          email: editing.identifier.includes('@')
            ? editing.identifier.trim()
            : `${editing.identifier.trim()}@erode.tn.gov.in`,
          password: password,
          full_name: editing.name.trim(),
          role: editing.role || 'user',
          jurisdiction_district: editing.district || currentUser?.district || 'Erode',
          jurisdiction_taluk: editing.section.trim() || 'Erode',
          is_active: true,
        };
        officer = await apiService.createUser(createData);
        recordActivity('Officer added', { reference: editing.name }, currentUser);
      }

      await loadUsers();
      setEditing(null);
      setMessage(editing.id ? 'Officer details updated successfully.' : 'Officer account created successfully.');

      if (officer && officer.id === currentUser?.id) {
        onUserUpdated?.({ ...currentUser, name: officer.full_name || officer.name, full_name: officer.full_name || officer.name });
      }
    } catch (e) {
      setFormError(e.message || 'Unable to save this officer. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const handleDeleteOfficer = async () => {
    if (!editing?.id || !isUserAdmin) return;
    setBusy(true);
    setFormError('');
    try {
      await apiService.deleteUser(editing.id);
      recordActivity('Officer account deleted', { reference: editing.name || editing.identifier }, currentUser);
      await loadUsers();
      setShowDeleteConfirm(false);
      setEditing(null);
      setMessage(`Officer account for "${editing.name || editing.identifier}" was deleted permanently.`);
    } catch (err) {
      setFormError(err.message || 'Failed to delete officer account.');
      setShowDeleteConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  const update = (event) => setEditing({ ...editing, [event.target.name]: event.target.value });

  const isUserOnline = (user) => {
    if (!currentUser) return false;
    return (
      (currentUser.id && user.id === currentUser.id) ||
      (currentUser.username && user.username && user.username.toLowerCase() === currentUser.username.toLowerCase()) ||
      (currentUser.email && user.email && user.email.toLowerCase() === currentUser.email.toLowerCase())
    );
  };

  const toggleAccountStatus = async (event, user) => {
    event.stopPropagation();
    try {
      const newStatus = !user.is_active;
      await apiService.updateUser(user.id, { is_active: newStatus });
      recordActivity(`Officer ${newStatus ? 'activated' : 'deactivated'}`, { reference: user.full_name || user.username }, currentUser);
      await loadUsers();
      setMessage(`Account for ${user.full_name || user.username} is now ${newStatus ? 'Active' : 'Deactivated'}.`);
    } catch (err) {
      setLoadError('Failed to change user status: ' + err.message);
    }
  };

  // KPI Calculations
  const kpis = useMemo(() => {
    const total = users.length;
    const onlineCount = users.filter((u) => isUserOnline(u)).length;
    const activeCount = users.filter((u) => u.is_active !== false).length;
    const taluks = new Set(users.map((u) => u.jurisdiction_taluk || u.section || 'Erode')).size;
    return { total, onlineCount, activeCount, taluks };
  }, [users, currentUser]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        (u.full_name || u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.jurisdiction_taluk || u.section || '').toLowerCase().includes(q);

      if (!matchesQuery) return false;

      if (statusFilter === 'ACTIVE') return u.is_active !== false;
      if (statusFilter === 'INACTIVE') return u.is_active === false;
      if (statusFilter === 'ONLINE') return isUserOnline(u);
      return true;
    });
  }, [users, searchQuery, statusFilter, currentUser]);

  const getInitials = (name) => {
    if (!name) return 'RO';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <section className="rr-user-management" aria-label="User and Officer Account Administration">
      {/* Page Header */}
      <header className="rr-user-header">
        <div>
          <span className="rr-admin-badge" style={{ backgroundColor: 'rgba(16, 44, 87, 0.08)', color: '#102C57' }}>
            Administration · Access &amp; Workspace Security
          </span>
          <h1>User Management</h1>
          <p>Manage Revenue Officers, workspace privileges, and live session status across taluks.</p>
        </div>
        <button
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          disabled={Boolean(loadError)}
          onClick={() => openOfficer()}
        >
          <Plus size={18} aria-hidden="true" />
          <span>Add Officer</span>
        </button>
      </header>

      {/* Notifications */}
      {loadError && (
        <div className="rr-admin-alert" role="alert" style={{ border: '1px solid #FECACA' }}>
          {loadError}
        </div>
      )}
      {message && (
        <div
          className="rr-admin-notice"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: '8px',
            color: '#065F46',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="#059669" />
            <span>{message}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setMessage('')}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#065F46' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Top Metric KPI Cards */}
      <div className="rr-user-kpis">
        <div className="rr-user-kpi-card">
          <div className="rr-user-kpi-icon" style={{ backgroundColor: 'rgba(16, 44, 87, 0.08)', color: '#102C57' }}>
            <UsersRound size={22} />
          </div>
          <div className="rr-user-kpi-info">
            <dt>Total Officers</dt>
            <dd>{kpis.total}</dd>
          </div>
        </div>

        <div className="rr-user-kpi-card">
          <div className="rr-user-kpi-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#059669' }}>
            <Activity size={22} />
          </div>
          <div className="rr-user-kpi-info">
            <dt>Online Now</dt>
            <dd style={{ color: '#059669' }}>{kpis.onlineCount}</dd>
          </div>
        </div>

        <div className="rr-user-kpi-card">
          <div className="rr-user-kpi-icon" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563EB' }}>
            <UserCheck size={22} />
          </div>
          <div className="rr-user-kpi-info">
            <dt>Active Accounts</dt>
            <dd>{kpis.activeCount}</dd>
          </div>
        </div>

        <div className="rr-user-kpi-card">
          <div className="rr-user-kpi-icon" style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)', color: '#D97706' }}>
            <Building size={22} />
          </div>
          <div className="rr-user-kpi-info">
            <dt>Taluks Managed</dt>
            <dd>{kpis.taluks}</dd>
          </div>
        </div>
      </div>

      {/* Main Officer Directory Card */}
      <article className="rr-directory-card">
        {/* Toolbar: Search and Filter Chips */}
        <div className="rr-directory-toolbar">
          <div className="rr-directory-search-box">
            <Search size={16} color="#94A3B8" />
            <input
              type="text"
              placeholder="Search officer by name, email, taluk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="rr-filter-chips">
            <button
              type="button"
              className={`rr-filter-chip ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              All ({users.length})
            </button>
            <button
              type="button"
              className={`rr-filter-chip ${statusFilter === 'ONLINE' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ONLINE')}
            >
              Online ({kpis.onlineCount})
            </button>
            <button
              type="button"
              className={`rr-filter-chip ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ACTIVE')}
            >
              Active ({kpis.activeCount})
            </button>
            <button
              type="button"
              className={`rr-filter-chip ${statusFilter === 'INACTIVE' ? 'active' : ''}`}
              onClick={() => setStatusFilter('INACTIVE')}
            >
              Deactivated ({kpis.total - kpis.activeCount})
            </button>
          </div>
        </div>

        {/* Directory Table */}
        <div className="rr-directory-table-container">
          <table className="rr-user-table" aria-label="Officers Directory">
            <thead>
              <tr>
                <th scope="col" style={{ width: '28%' }}>Officer &amp; Designation</th>
                <th scope="col" style={{ width: '26%' }}>Official Email</th>
                <th scope="col" style={{ width: '18%' }}>Jurisdiction Taluk</th>
                <th scope="col" style={{ width: '14%' }}>Session Presence</th>
                <th scope="col" style={{ width: '14%', textAlign: 'right' }}>Account Status &amp; Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const online = isUserOnline(user);
                  const isAdmin = (user.role || '').toLowerCase() === 'admin' || (user.role || '').toLowerCase() === 'super_admin';
                  const displayName = user.full_name || user.name || user.username;
                  const designation = isAdmin ? 'Collectorate Administrator' : 'Revenue Recovery Officer';

                  return (
                    <tr key={user.id}>
                      {/* Officer Profile */}
                      <td>
                        <div className="rr-officer-profile-cell">
                          <div
                            className="rr-officer-avatar"
                            style={{ backgroundColor: isAdmin ? '#102C57' : '#047857' }}
                          >
                            {getInitials(displayName)}
                          </div>
                          <div className="rr-officer-info">
                            <span className="rr-officer-title">
                              {displayName}
                              {online && (
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    color: '#059669',
                                    backgroundColor: '#DCFCE7',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                  }}
                                >
                                  You
                                </span>
                              )}
                            </span>
                            <span className="rr-officer-role-tag">
                              {isAdmin && <Shield size={12} style={{ display: 'inline', marginRight: 3, verticalAlign: -1 }} />}
                              {designation}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                          <Mail size={14} color="#64748B" />
                          <span style={{ fontSize: '0.85rem' }}>{user.email || user.username}</span>
                        </div>
                      </td>

                      {/* Taluk */}
                      <td>
                        <span className="rr-taluk-badge">
                          <MapPin size={13} color="#102C57" />
                          {user.jurisdiction_taluk || user.section || 'Erode'}
                        </span>
                      </td>

                      {/* Live Session Presence */}
                      <td>
                        {online ? (
                          <span className="rr-session-pill online">
                            <span className="rr-pulse-dot" />
                            Active (Logged In)
                          </span>
                        ) : (
                          <span className="rr-session-pill offline">
                            <span className="rr-gray-dot" />
                            Offline
                          </span>
                        )}
                      </td>

                      {/* Status Toggle & Edit Action */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={(e) => toggleAccountStatus(e, user)}
                            className={`rr-status-toggle-btn ${user.is_active !== false ? 'active' : 'inactive'}`}
                            title="Click to toggle account access"
                          >
                            {user.is_active !== false ? 'Active' : 'Deactivated'}
                          </button>
                          <button
                            type="button"
                            className="rr-action-edit-btn"
                            onClick={() => openOfficer(user)}
                            title="Edit Officer Profile"
                          >
                            <Edit2 size={13} />
                            <span>Edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748B' }}>
                    <UsersRound size={32} style={{ margin: '0 auto 8px auto', display: 'block', color: '#94A3B8' }} />
                    <strong style={{ display: 'block', fontSize: '1rem', color: '#102C57' }}>No officers found</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.825rem' }}>
                      {searchQuery ? 'Try adjusting your search criteria or filter.' : 'Click "Add Officer" to configure new user accounts.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {/* Edit / Add Officer Modal */}
      {editing && (
        <Modal
          title={editing.id ? `Edit Officer: ${original?.name || original?.identifier}` : 'Add Official Account'}
          onClose={closeOfficer}
          maxWidth="640px"
        >
          <form onSubmit={saveOfficer} style={{ padding: '0.5rem 0' }}>
            {formError && (
              <div className="rr-admin-alert" role="alert" style={{ marginBottom: '1rem' }}>
                {formError}
              </div>
            )}
            <fieldset disabled={busy} className="rr-officer-fields">
              <label className="rr-officer-full-name">
                Full Name (English)
                <input
                  required
                  name="name"
                  autoComplete="name"
                  placeholder="e.g. S. Ramanathan"
                  maxLength={160}
                  value={editing.name}
                  onChange={update}
                />
              </label>

              <label className="rr-officer-full-name">
                Full Name (Tamil - optional)
                <input
                  name="nameTamil"
                  lang="ta"
                  placeholder="எ.கா. சு. ராமநாதன்"
                  maxLength={160}
                  value={editing.nameTamil}
                  onChange={update}
                />
              </label>

              <label>
                Official Username / Email
                <input
                  required
                  name="identifier"
                  autoComplete="username"
                  placeholder="officer@erode.tn.gov.in"
                  maxLength={160}
                  value={editing.identifier}
                  onChange={update}
                />
              </label>

              <label>
                Role &amp; Privilege
                <select name="role" value={editing.role} onChange={update}>
                  <option value="user">Revenue Recovery Officer (User)</option>
                  <option value="admin">District Administrator (Admin)</option>
                </select>
              </label>

              <label className="rr-officer-full-name">
                Jurisdiction Taluk
                <input
                  required
                  name="section"
                  placeholder="e.g. Erode, Bhavani, Gobichettipalayam, Perundurai"
                  maxLength={160}
                  value={editing.section}
                  onChange={update}
                />
              </label>

              {editing.id && (
                <div className="rr-officer-security">
                  <div>
                    <h4>Account Security</h4>
                    <p>Reset or update this official's access password.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setChangePassword(!changePassword);
                      setPassword('');
                      setConfirmation('');
                      setFormError('');
                    }}
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    <KeyRound size={15} />
                    {changePassword ? 'Cancel Password Reset' : 'Reset Password'}
                  </button>
                </div>
              )}

              {needsPassword && (
                <>
                  <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                    <PasswordInput
                      label={editing.id ? 'New Password' : 'Password'}
                      required
                      name="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <PasswordInput
                      label={editing.id ? 'Confirm New Password' : 'Confirm Password'}
                      required
                      name="confirmPassword"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                    />
                  </div>
                </>
              )}

              {/* Admin-Only Delete Officer Option */}
              {editing.id && isUserAdmin && editing.id !== currentUser?.id && (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '8px',
                    marginTop: '0.5rem',
                  }}
                >
                  <div>
                    <h4 style={{ margin: '0 0 2px 0', color: '#991B1B', fontSize: '0.875rem', fontWeight: 700 }}>
                      Delete Officer Account
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#B91C1C' }}>
                      Permanently delete this account from the database and revoke all access.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="btn"
                    style={{
                      backgroundColor: '#DC2626',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.8rem',
                      padding: '6px 14px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={14} />
                    <span>Delete User</span>
                  </button>
                </div>
              )}
            </fieldset>

            <div
              className="rr-modal-actions"
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                marginTop: '1.5rem',
                paddingTop: '1rem',
                borderTop: '1px solid #EADBC8',
              }}
            >
              <button type="button" className="btn btn-outline" disabled={busy} onClick={closeOfficer}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || (Boolean(editing.id) && !dirty)}
              >
                {busy ? 'Saving...' : editing.id ? 'Save Profile' : 'Create Officer Account'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete User Confirmation Modal */}
      {showDeleteConfirm && (
        <Modal title="Confirm Account Deletion" onClose={() => setShowDeleteConfirm(false)} maxWidth="480px">
          <div style={{ padding: '0.5rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem', color: '#DC2626' }}>
              <AlertTriangle size={24} />
              <strong style={{ fontSize: '1rem' }}>Permanent Action</strong>
            </div>
            <p style={{ color: '#102C57', fontSize: '0.9rem', margin: '0 0 0.75rem 0', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete the officer account for <strong>{editing?.name || editing?.identifier}</strong>?
            </p>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0 }}>
              All privileges for this official account will be revoked immediately and removed from the database directory.
            </p>
            <div
              className="rr-modal-actions"
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                marginTop: '1.5rem',
                paddingTop: '1rem',
                borderTop: '1px solid #EADBC8',
              }}
            >
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{ backgroundColor: '#DC2626', color: '#ffffff', border: 'none' }}
                disabled={busy}
                onClick={handleDeleteOfficer}
              >
                {busy ? 'Deleting...' : 'Confirm & Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
