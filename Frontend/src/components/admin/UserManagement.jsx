import { recordActivity } from '../../services/activityStore.js';
import React, { useEffect, useState } from 'react';
import { Plus, KeyRound, UsersRound, CheckCircle2, X } from 'lucide-react';
import { apiService } from '../../services/apiService.js';
import Modal from '../common/Modal.jsx';
import PasswordInput from '../common/PasswordInput.jsx';
import './UserManagement.css';

const detailsFor = user => ({
  id: user?.id,
  name: user?.full_name || user?.name || '',
  nameTamil: user?.nameTamil || '',
  identifier: user?.username || user?.email || '',
  email: user?.email || '',
  mobileNumber: String(user?.mobileNumber || user?.mobile_number || ''),
  section: user?.section || user?.jurisdiction_taluk || '',
  district: user?.jurisdiction_district || '',
  role: user?.role || 'user',
  is_active: user?.is_active !== false
});

export default function UserManagement({ currentUser, onUserUpdated }) {
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [original, setOriginal] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [changePassword, setChangePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');

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

  function openOfficer(user) {
    const details = detailsFor(user);
    setOriginal(details); setEditing({ ...details });
    setPassword(''); setConfirmation(''); setChangePassword(false); setFormError(''); setMessage('');
  }
  function closeOfficer() { if (!busy) setEditing(null); }

  const dirty = editing && (
    ['name', 'nameTamil', 'mobileNumber', 'section'].some(key => (editing[key] || '').trim() !== (original[key] || '').trim()) ||
    (editing.identifier || '').trim().toLowerCase() !== (original.identifier || '').trim().toLowerCase() ||
    (changePassword && Boolean(password))
  );

  const needsPassword = editing && (!editing.id || changePassword);

  async function saveOfficer(event) {
    event.preventDefault();
    if (busy || (editing.id && !dirty)) return;
    setFormError('');
    if (needsPassword && !password) { setFormError('Enter a new password.'); return; }
    if (needsPassword && password !== confirmation) { setFormError('Passwords do not match.'); return; }
    if (needsPassword && password.length < 8) { setFormError('Password must be at least 8 characters.'); return; }
    setBusy(true);
    try {
      let officer;
      if (editing.id) {
        // Update existing user
        const updateData = {
          full_name: editing.name.trim(),
          email: editing.identifier.includes('@') ? editing.identifier.trim() : editing.email,
          jurisdiction_taluk: editing.section.trim(),
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
          email: editing.identifier.includes('@') ? editing.identifier.trim() : `${editing.identifier.trim()}@erode.tn.gov.in`,
          password: password,
          full_name: editing.name.trim(),
          role: 'user',
          jurisdiction_district: editing.district || currentUser.district || 'Erode',
          jurisdiction_taluk: editing.section.trim(),
          is_active: true,
        };
        officer = await apiService.createUser(createData);
        recordActivity('Officer added', { reference: editing.name }, currentUser);
      }

      await loadUsers();
      setEditing(null);
      setMessage(editing.id ? 'Officer details updated.' : 'Officer added.');

      if (officer && (officer.id === currentUser.id)) {
        onUserUpdated?.({ ...currentUser, name: officer.full_name || officer.name, full_name: officer.full_name || officer.name });
      }
    } catch (e) {
      setFormError(e.message || 'Unable to save this officer. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const update = event => setEditing({ ...editing, [event.target.name]: event.target.value });
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

  return <section className="rr-admin rr-user-management">
    <header className="rr-admin-heading rr-officers-heading">
      <div><h1>User Management</h1><p>Manage officers, workspace privileges, and live session status.</p></div>
    </header>
    {loadError && <div className="rr-admin-alert" role="alert">{loadError}</div>}
    {message && <div className="rr-admin-notice rr-officer-notice"><CheckCircle2 size={19} aria-hidden="true" /><span role="status">{message}</span><button type="button" aria-label="Dismiss notification" title="Dismiss notification" onClick={() => setMessage('')}><X size={18} /></button></div>}
    <article className="rr-admin-card rr-officer-directory">
      <header className="rr-directory-heading">
        <div className="rr-directory-title"><span className="rr-directory-icon"><UsersRound size={22} aria-hidden="true" /></span><div><h2>Officer Directory</h2><p>Live session presence &amp; account configuration.</p></div></div>
        <button className="btn btn-primary rr-add-officer" disabled={Boolean(loadError)} onClick={() => openOfficer()}><Plus size={18} aria-hidden="true" />Add Officer</button>
      </header>
      <div className="rr-directory-table">
      <table aria-label="Officers">
        <thead>
          <tr>
            <th scope="col">Officer Name</th>
            <th scope="col">Email / Username</th>
            <th scope="col">Section / Taluk</th>
            <th scope="col">Session Presence</th>
            <th scope="col">Account Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => {
            const online = isUserOnline(user);
            return (
              <tr key={user.id} onClick={() => openOfficer(user)} style={{ cursor: 'pointer' }}>
                <td>
                  <button type="button" className="rr-officer-name" aria-haspopup="dialog" aria-label={`Edit ${user.full_name || user.name}`} onClick={event => { event.stopPropagation(); openOfficer(user); }}>
                    <strong>{user.full_name || user.name}</strong>
                    {online && <span style={{ marginLeft: '6px', fontSize: '0.72rem', color: '#10B981', fontWeight: 'bold' }}>(You)</span>}
                  </button>
                </td>
                <td><span className="rr-officer-section">{user.email || user.username}</span></td>
                <td><span className="rr-officer-section">{user.jurisdiction_taluk || user.section || 'General Administration'}</span></td>
                <td>
                  {online ? (
                    <span className="rr-admin-status active" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#059669', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10B981', boxShadow: '0 0 6px #10B981' }} />
                      Active (Logged In)
                    </span>
                  ) : (
                    <span className="rr-admin-status inactive" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(148, 163, 184, 0.12)', color: '#64748B', borderColor: 'rgba(148, 163, 184, 0.25)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#94A3B8' }} />
                      Offline
                    </span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={(e) => toggleAccountStatus(e, user)}
                    className={`btn ${user.is_active !== false ? 'btn-ghost' : 'btn-outline'}`}
                    style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem', height: 'auto', borderRadius: '4px' }}
                    title="Click to toggle account access"
                  >
                    {user.is_active !== false ? '✅ Active' : '⛔ Deactivated'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      {!loadError && !users.length && <div className="rr-officers-empty"><UsersRound size={28} aria-hidden="true" /><h3>No officers found</h3><p>Add an officer to configure access.</p></div>}
    </article>
    {editing && <Modal title={editing.id ? `Edit User: ${original.name}` : 'Add Official Account'} className="rr-officer-dialog" onClose={closeOfficer}>
      <form onSubmit={saveOfficer}>
        {formError && <div className="rr-admin-alert" role="alert">{formError}</div>}
        <fieldset disabled={busy} className="rr-officer-fields">
          <h3 className="rr-officer-full-name">Official Identity &amp; Contact</h3>
          <label className="rr-officer-full-name">Full Name (English)<input required name="name" autoComplete="name" placeholder="Enter full name" maxLength={160} value={editing.name} onChange={update} /></label>
          <label className="rr-officer-full-name">Full Name (Tamil - optional)<input name="nameTamil" lang="ta" maxLength={160} value={editing.nameTamil} onChange={update} /></label>
          <label>Mobile Number<input name="mobileNumber" type="tel" autoComplete="tel" placeholder="Enter mobile number" maxLength={24} value={editing.mobileNumber} onChange={update} /></label>
          <label>Official Email / Username<input required name="identifier" autoComplete="username" placeholder="officer@tn.gov.in" maxLength={160} value={editing.identifier} onChange={update} /></label>
          <label className="rr-officer-full-name">Department / Section<input required name="section" placeholder="Revenue Administration" maxLength={160} value={editing.section} onChange={update} /></label>
          {editing.id && <div className="rr-officer-security rr-officer-full-name"><div><h3>Account Security</h3><p>Reset or change this official's password.</p></div><button type="button" className="btn btn-outline" aria-expanded={changePassword} onClick={() => { setChangePassword(!changePassword); setPassword(''); setConfirmation(''); setFormError(''); }}><KeyRound size={16} />{changePassword ? 'Cancel Password Change' : 'Edit Password'}</button></div>}
          {needsPassword && <>
            {!editing.id && <h3 className="rr-officer-full-name">Initial Password</h3>}
            <PasswordInput label={editing.id ? 'New Password' : 'Password'} required name="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} />
            <PasswordInput label={editing.id ? 'Confirm New Password' : 'Confirm Password'} required name="confirmPassword" autoComplete="new-password" minLength={8} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} />
          </>}
        </fieldset>
        <div className="rr-modal-actions"><button type="button" className="btn btn-outline" disabled={busy} onClick={closeOfficer}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy || (Boolean(editing.id) && !dirty)}>{busy ? 'Saving...' : editing.id ? 'Save Profile' : 'Create Account'}</button>
        </div>
      </form>
    </Modal>}
  </section>;
}
