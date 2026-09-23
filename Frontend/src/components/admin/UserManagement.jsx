import React, { useEffect, useRef, useState } from 'react';
import { Plus, X, Trash2, Edit2 } from 'lucide-react';
import { apiService } from '../../services/apiService.js';
import './UserManagement.css';

const emptyOfficer = { name: '', email: '', mobileNumber: '', taluk: '', department: 'Revenue Recovery', role: 'user', status: 'active' };

function OfficerDialog({ officer, setOfficer, jurisdictions, error, onSave, onClose, isAdmin = true }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      dialog.querySelector('[name="name"]')?.focus();
    }
    return () => {
      if (dialog && dialog.open) {
        dialog.close();
      }
    };
  }, []);

  const update = event => setOfficer({ ...officer, [event.target.name]: event.target.value });

  return (
    <dialog ref={dialogRef} className="rr-admin-card rr-officer-dialog" aria-labelledby="rr-officer-title">
      <div className="rr-admin-toolbar">
        <h2 id="rr-officer-title">{officer.id ? 'Edit Officer Profile' : 'Add Officer Account'}</h2>
        <button type="button" className="btn btn-ghost" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
      </div>
      <form onSubmit={onSave}>
        {error && <div className="rr-admin-alert" role="alert">{error}</div>}
        <div className="rr-admin-form">
          <label className="rr-officer-full-name">Full Name
            <input required name="name" autoComplete="name" maxLength={160} value={officer.name || ''} onChange={update} />
          </label>
          <label>Email Address
            <input required name="email" type="email" autoComplete="email" maxLength={160} value={officer.email || ''} onChange={update} disabled={Boolean(officer.id) && !isAdmin} />
          </label>
          <label>Mobile Number
            <input name="mobileNumber" type="tel" autoComplete="tel" maxLength={24} value={officer.mobileNumber || ''} onChange={update} />
          </label>
          <label>Taluk / Jurisdiction
            <input required name="taluk" list="rr-officer-jurisdictions" maxLength={160} value={officer.taluk || ''} onChange={update} />
            <datalist id="rr-officer-jurisdictions">
              {['ஈரோடு', 'பெருந்துறை', 'பவானி', 'அந்தியூர்', 'கொடுமுடி', 'மொடக்குறிச்சி', 'கோபிசெட்டிபாளையம்', 'சத்தியமங்கலம்', 'தாளவாடி'].map(taluk => (
                <option key={taluk} value={taluk} />
              ))}
            </datalist>
          </label>
          <label>Department / Cell
            <input name="department" maxLength={160} value={officer.department || 'Revenue Recovery'} onChange={update} />
          </label>
          {isAdmin && (
            <>
              <label>Role
                <select name="role" value={officer.role || 'user'} onChange={update}>
                  <option value="user">Officer (வட்டாட்சியர் / எழுத்தர்)</option>
                  <option value="admin">Administrator (நிர்வாகி)</option>
                </select>
              </label>
              <label>Account Status
                <select name="status" value={officer.status || 'active'} onChange={update}>
                  <option value="active">Active (செயலில்)</option>
                  <option value="inactive">Inactive (முடக்கப்பட்டது)</option>
                </select>
              </label>
            </>
          )}
        </div>
        <div className="rr-admin-actions rr-officer-actions" style={{ marginTop: '1.5rem' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{officer.id ? 'Save Changes' : 'Create Officer'}</button>
        </div>
      </form>
    </dialog>
  );
}

export default function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const isAdmin = currentUser?.role === 'admin';

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiService.getUsers(query, roleFilter, statusFilter);
      setUsers(data);
    } catch (err) {
      setLoadError('Unable to load officers from PostgreSQL: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [query, roleFilter, statusFilter]);

  const openOfficer = (user = null) => {
    if (user) {
      setEditing({
        id: user.id,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobile_number || user.mobileNumber || '',
        taluk: user.taluk || '',
        department: user.department || 'Revenue Recovery',
        role: user.role,
        status: user.status
      });
    } else {
      setEditing({ ...emptyOfficer });
    }
    setFormError('');
    setMessage('');
  };

  const saveOfficer = async (event) => {
    event.preventDefault();
    setFormError('');

    try {
      if (editing.id) {
        await apiService.updateUser(editing.id, editing, currentUser?.role || 'user', currentUser?.id);
        setMessage('Officer details updated successfully in PostgreSQL.');
      } else {
        await apiService.createUser(editing, currentUser?.role || 'admin');
        setMessage('New officer created successfully in PostgreSQL.');
      }
      setEditing(null);
      loadUsers();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const deleteOfficer = async (user, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete officer "${user.name}"?`)) return;
    try {
      await apiService.deleteUser(user.id, currentUser?.role || 'admin');
      setMessage('Officer account deleted.');
      loadUsers();
    } catch (err) {
      setFormError(err.message);
    }
  };

  return (
    <section className="rr-admin rr-user-management">
      <header className="rr-admin-heading">
        <div>
          <h1>User & Officer Management</h1>
          <p>Manage revenue officers, taluk jurisdictions, and role-based permissions stored in PostgreSQL.</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => openOfficer()}>
            <Plus size={16} /> Add Officer
          </button>
        )}
      </header>

      {loadError && <div className="rr-admin-alert" role="alert">{loadError}</div>}
      {message && <div className="rr-admin-notice" role="status">{message}</div>}

      <div className="rr-admin-filters">
        <input
          placeholder="Search officers by name, email, or taluk..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="all">All Roles</option>
          <option value="admin">Administrators</option>
          <option value="user">Officers</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <article className="rr-admin-card rr-admin-table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Officer</th>
              <th scope="col">Taluk / Jurisdiction</th>
              <th scope="col">Department</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              {isAdmin && <th scope="col" style={{ textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr
                key={user.id}
                tabIndex={0}
                onClick={() => openOfficer(user)}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  <strong>{user.name}</strong>
                  <small style={{ display: 'block', color: '#94a3b8' }}>{user.email} {user.mobile_number ? `· ${user.mobile_number}` : ''}</small>
                </td>
                <td>{user.taluk || '—'}</td>
                <td>{user.department || 'Revenue Recovery'}</td>
                <td>
                  <span className={`rr-badge ${user.role === 'admin' ? 'badge-dept' : 'badge-cat'}`}>
                    {user.role === 'admin' ? 'Administrator' : 'Officer'}
                  </span>
                </td>
                <td>
                  <span className={`rr-admin-status ${user.status}`}>
                    {user.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {isAdmin && (
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '0.25rem 0.5rem', marginRight: '0.25rem' }}
                      onClick={(e) => { e.stopPropagation(); openOfficer(user); }}
                    >
                      <Edit2 size={14} />
                    </button>
                    {user.role !== 'admin' && (
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '0.25rem 0.5rem', color: '#f87171' }}
                        onClick={(e) => deleteOfficer(user, e)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !users.length && <p style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>No officers found.</p>}
      </article>

      {editing && (
        <OfficerDialog
          officer={editing}
          setOfficer={setEditing}
          error={formError}
          onSave={saveOfficer}
          onClose={() => setEditing(null)}
          isAdmin={isAdmin}
        />
      )}
    </section>
  );
}
