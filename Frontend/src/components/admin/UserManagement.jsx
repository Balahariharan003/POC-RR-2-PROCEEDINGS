import React, { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { readUsers, saveUsers } from '../../services/adminStore.js';
import './UserManagement.css';

const emptyOfficer = { name: '', email: '', mobileNumber: '', taluk: '', role: 'user' };

function OfficerDialog({ officer, setOfficer, jurisdictions, error, onSave, onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    dialog.showModal();
    dialog.querySelector('[name="name"]').focus();
    return () => {
      dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  function containFocus(event) {
    if (event.key !== 'Tab') return;
    const controls = dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled])');
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  const update = event => setOfficer({ ...officer, [event.target.name]: event.target.value });
  return <dialog ref={dialogRef} className="rr-admin-card rr-officer-dialog" aria-labelledby="rr-officer-title"
    onKeyDown={containFocus} onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="rr-admin-toolbar">
      <h2 id="rr-officer-title">{officer.id ? 'Officer Details' : 'Add Officer'}</h2>
      <button type="button" className="btn btn-ghost" aria-label="Close officer dialog" onClick={onClose}><X size={18} aria-hidden="true" /></button>
    </div>
    <form onSubmit={onSave}>
      {error && <div className="rr-admin-alert" role="alert">{error}</div>}
      <div className="rr-admin-form">
        <label className="rr-officer-full-name">Full Name
          <input required name="name" autoComplete="name" maxLength={160} value={officer.name} onChange={update} />
        </label>
        <label>Email
          <input required name="email" type="email" autoComplete="email" maxLength={160} value={officer.email} onChange={update} />
        </label>
        <label>Mobile Number
          <input name="mobileNumber" type="tel" autoComplete="tel" maxLength={24} value={officer.mobileNumber} onChange={update} />
        </label>
        <label>Taluk / Jurisdiction
          <input required name="taluk" list="rr-officer-jurisdictions" maxLength={160} value={officer.taluk} onChange={update} />
          <datalist id="rr-officer-jurisdictions">{jurisdictions.map(taluk => <option key={taluk} value={taluk} />)}</datalist>
        </label>
        <label>Role
          <select name="role" value={officer.role} onChange={update}><option value="user">Officer</option><option value="admin">Administrator</option></select>
        </label>
      </div>
      <div className="rr-admin-actions rr-officer-actions">
        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">{officer.id ? 'Save Changes' : 'Add Officer'}</button>
      </div>
    </form>
  </dialog>;
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

  useEffect(() => {
    // Officer administration must not depend on the validity of audit or draft data.
    try { setUsers(readUsers()); }
    catch { setLoadError('Unable to load officers. Please reload this page to try again.'); }
  }, []);

  function openOfficer(user) {
    setEditing(user ? { id: user.id, name: user.name, email: user.email, mobileNumber: user.mobileNumber || '', taluk: user.taluk, role: user.role } : { ...emptyOfficer });
    setFormError('');
    setMessage('');
  }

  function saveOfficer(event) {
    event.preventDefault();
    setFormError('');
    let currentUsers;
    try { currentUsers = readUsers(); }
    catch { setFormError('Unable to load officers. Close this popup and reload the page to try again.'); return; }

    const original = currentUsers.find(user => user.id === editing.id);
    if (editing.id && !original) { setFormError('This officer is no longer in the directory. Reload the page to see the latest officers.'); return; }
    const officer = {
      ...original,
      id: original?.id || crypto.randomUUID(),
      name: editing.name.trim(),
      email: editing.email.trim().toLowerCase(),
      mobileNumber: editing.mobileNumber.trim(),
      taluk: editing.taluk.trim(),
      role: editing.role,
      status: original?.status || 'active',
    };
    if (!officer.name || !officer.taluk) { setFormError('Enter the officer’s full name and taluk / jurisdiction.'); return; }
    if (officer.mobileNumber && (!/^\+?[\d ()-]+$/.test(officer.mobileNumber) || !/^\d{7,15}$/.test(officer.mobileNumber.replace(/\D/g, '')))) {
      setFormError('Enter a valid mobile number, including the country code if needed.'); return;
    }
    if (currentUsers.some(user => user.id !== officer.id && user.email.toLowerCase() === officer.email)) {
      setFormError('An officer with this email address already exists.'); return;
    }
    if (original?.email.toLowerCase() === currentUser.email.toLowerCase() && (officer.role !== 'admin' || officer.email !== currentUser.email.toLowerCase())) {
      setFormError('Keep your current administrator role and email address.'); return;
    }
    const updated = original ? currentUsers.map(user => user.id === officer.id ? officer : user) : [...currentUsers, officer];
    if (currentUsers.some(user => user.role === 'admin' && user.status === 'active') && !updated.some(user => user.role === 'admin' && user.status === 'active')) {
      setFormError('Keep at least one active administrator.'); return;
    }
    try { saveUsers(updated); }
    catch { setFormError('Unable to save this officer. Please try again.'); return; }
    setUsers(updated);
    setEditing(null);
    setMessage(original ? 'Officer details updated.' : 'Officer added.');
  }

  const visibleUsers = users.filter(user =>
    (roleFilter === 'all' || roleFilter === user.role) &&
    (statusFilter === 'all' || statusFilter === user.status) &&
    `${user.name} ${user.email} ${user.taluk}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  return <section className="rr-admin rr-user-management">
    <header className="rr-admin-heading">
      <div><h1>User Management</h1><p>Manage officers and their RR workspace access.</p></div>
      <button className="btn btn-primary" disabled={Boolean(loadError)} onClick={() => openOfficer()}><Plus size={16} aria-hidden="true" />Add Officer</button>
    </header>
    {loadError && <div className="rr-admin-alert" role="alert">{loadError}</div>}
    {message && <div className="rr-admin-notice" role="status">{message}</div>}
    <div className="rr-admin-filters">
      <input aria-label="Search officers" placeholder="Search officers..." value={query} onChange={event => setQuery(event.target.value)} />
      <select aria-label="Filter by role" value={roleFilter} onChange={event => setRoleFilter(event.target.value)}>
        <option value="all">All roles</option><option value="admin">Administrators</option><option value="user">Officers</option>
      </select>
      <select aria-label="Filter by status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
        <option value="all">All status</option><option value="active">Active</option><option value="inactive">Inactive</option>
      </select>
    </div>
    <article className="rr-admin-card rr-admin-table-scroll">
      <table aria-label="Officers">
        <thead><tr>{['Officer', 'Taluk / Jurisdiction', 'Role', 'Status'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{visibleUsers.map(user => <tr key={user.id} tabIndex={0} aria-haspopup="dialog"
          onClick={() => openOfficer(user)} onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openOfficer(user); }
          }}>
          <td><strong>{user.name}</strong><small>{user.email}</small></td>
          <td>{user.taluk || '—'}</td>
          <td>{user.role === 'admin' ? 'Administrator' : 'Officer'}</td>
          <td><span className={`rr-admin-status ${user.status}`}>{user.status === 'active' ? 'Active' : 'Inactive'}</span></td>
        </tr>)}</tbody>
      </table>
      {!loadError && !visibleUsers.length && <p>{users.length ? 'No officers match these filters.' : 'No officers added yet.'}</p>}
    </article>
    {editing && <OfficerDialog officer={editing} setOfficer={setEditing} jurisdictions={[...new Set(users.map(user => user.taluk).filter(Boolean))]}
      error={formError} onSave={saveOfficer} onClose={() => setEditing(null)} />}
  </section>;
}
