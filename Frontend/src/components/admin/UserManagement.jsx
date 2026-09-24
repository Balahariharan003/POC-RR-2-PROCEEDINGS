import { recordActivity } from '../../services/activityStore.js';
import React, { useEffect, useState } from 'react';
import { Plus, KeyRound, UsersRound, CheckCircle2, X } from 'lucide-react';
import { readUsers } from '../../services/adminStore.js';
import { saveOfficerAccount } from '../../services/accountStore.js';
import Modal from '../common/Modal.jsx';
import PasswordInput from '../common/PasswordInput.jsx';
import './UserManagement.css';

const detailsFor = user => ({ id: user?.id, name: user?.name || '', nameTamil: user?.nameTamil || '', identifier: user?.username || user?.email || '', mobileNumber: String(user?.mobileNumber || ''), section: user?.section || user?.taluk || '' });

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
  useEffect(() => {
    try { setUsers(readUsers()); }
    catch { setLoadError('Unable to load officers. Please reload this page to try again.'); }
  }, []);

  function openOfficer(user) {
    const details = detailsFor(user);
    setOriginal(details); setEditing({ ...details });
    setPassword(''); setConfirmation(''); setChangePassword(false); setFormError(''); setMessage('');
  }
  function closeOfficer() { if (!busy) setEditing(null); }
  const dirty = editing && (['name', 'nameTamil', 'mobileNumber', 'section'].some(key => editing[key].trim() !== original[key].trim()) || editing.identifier.trim().toLowerCase() !== original.identifier.trim().toLowerCase() || (changePassword && Boolean(password)));
  const needsPassword = editing && (!editing.id || changePassword);
  async function saveOfficer(event) {
    event.preventDefault();
    if (busy || (editing.id && !dirty)) return;
    setFormError('');
    if (needsPassword && !password) { setFormError('Enter a new password.'); return; }
    if (needsPassword && password !== confirmation) { setFormError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const officer = await saveOfficerAccount(editing, needsPassword ? password : '');
      recordActivity(editing.id ? 'Officer details updated' : 'Officer added', { reference: officer.name }, currentUser);
      if (editing.id && needsPassword) recordActivity('Officer password changed', { reference: officer.name }, currentUser);
      setUsers(readUsers()); setEditing(null);
      setMessage(editing.id ? 'Officer details updated.' : 'Officer added.');
      if (officer.id === currentUser.id || (original.identifier.toLowerCase() === (currentUser.username || currentUser.email).toLowerCase())) onUserUpdated?.(officer);
    } catch (e) { setFormError(e.message || 'Unable to save this officer. Please try again.'); }
    finally { setBusy(false); }
  }
  const update = event => setEditing({ ...editing, [event.target.name]: event.target.value });

  return <section className="rr-admin rr-user-management">
    <header className="rr-admin-heading rr-officers-heading">
      <div><h1>User Management</h1><p>Manage officers and their RR workspace access.</p></div>
    </header>
    {loadError && <div className="rr-admin-alert" role="alert">{loadError}</div>}
    {message && <div className="rr-admin-notice rr-officer-notice"><CheckCircle2 size={19} aria-hidden="true" /><span role="status">{message}</span><button type="button" aria-label="Dismiss notification" title="Dismiss notification" onClick={() => setMessage('')}><X size={18} /></button></div>}
    <article className="rr-admin-card rr-officer-directory">
      <header className="rr-directory-heading">
        <div className="rr-directory-title"><span className="rr-directory-icon"><UsersRound size={22} aria-hidden="true" /></span><div><h2>Officer Directory</h2><p>Select an officer to view or edit their details.</p></div></div>
        <button className="btn btn-primary rr-add-officer" disabled={Boolean(loadError)} onClick={() => openOfficer()}><Plus size={18} aria-hidden="true" />Add Officer</button>
      </header>
      <div className="rr-directory-table">
      <table aria-label="Officers">
        <thead><tr>{['Officer Name', 'Section', 'Status'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{users.map(user => <tr key={user.id} onClick={() => openOfficer(user)}>
          <td><button type="button" className="rr-officer-name" aria-haspopup="dialog" aria-label={`Edit ${user.name}`} onClick={event => { event.stopPropagation(); openOfficer(user); }}><strong>{user.name}</strong></button></td><td><span className="rr-officer-section">{user.section || user.taluk || 'Not provided'}</span></td>
          <td><span className={`rr-admin-status ${user.status}`}>{user.status === 'active' ? 'Active' : 'Inactive'}</span></td>
        </tr>)}</tbody>
      </table>
      </div>
      {!loadError && !users.length && <div className="rr-officers-empty"><UsersRound size={28} aria-hidden="true" /><h3>No officers yet</h3><p>Add an officer to get started.</p></div>}
    </article>
    {editing && <Modal title={editing.id ? `Edit User: ${original.name}` : 'Add Official Account'} className="rr-officer-dialog" onClose={closeOfficer}>
      <form onSubmit={saveOfficer}>
        {formError && <div className="rr-admin-alert" role="alert">{formError}</div>}
        <fieldset disabled={busy} className="rr-officer-fields">
          <h3 className="rr-officer-full-name">Official Identity &amp; Contact</h3>
          <label className="rr-officer-full-name">Full Name (English)<input required name="name" autoComplete="name" placeholder="e.g. S. Ramanathan" maxLength={160} value={editing.name} onChange={update} /></label>
          <label className="rr-officer-full-name">Full Name (Tamil - optional)<input name="nameTamil" lang="ta" maxLength={160} value={editing.nameTamil} onChange={update} /></label>
          <label>Mobile Number<input required name="mobileNumber" type="tel" autoComplete="tel" placeholder="9842011001" maxLength={24} value={editing.mobileNumber} onChange={update} /></label>
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
