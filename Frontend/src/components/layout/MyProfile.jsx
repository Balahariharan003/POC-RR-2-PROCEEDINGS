import React, { useState } from 'react';
import { UserRound, Settings, LockKeyhole, Pencil, ShieldCheck, Mail, Phone, Building2, Briefcase, BadgeCheck } from 'lucide-react';
import { saveOfficerAccount, changeOwnPassword } from '../../services/accountStore.js';
import { recordActivity } from '../../services/activityStore.js';
import './MyProfile.css';

const profileFields = user => ({ id: user.id, name: user.name || '', nameTamil: user.nameTamil || '', designation: user.designation || '', identifier: user.username || user.email || '', mobileNumber: user.mobileNumber || '', section: user.section || user.taluk || '' });

export default function MyProfile({ currentUser, currentLanguage, setLanguage, onUserUpdated, onBack }) {
  const [details, setDetails] = useState(() => profileFields(currentUser));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const original = profileFields(currentUser);
  const dirty = ['name', 'nameTamil', 'identifier', 'mobileNumber', 'section', 'designation'].some(key => details[key].trim() !== original[key].trim());
  const update = event => { setDetails({ ...details, [event.target.name]: event.target.value }); setMessage(''); };
  async function saveProfile(event) {
    event.preventDefault();
    if (!dirty || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const user = await saveOfficerAccount(details);
      recordActivity('Profile updated', { reference: user.name }, currentUser);
      onUserUpdated(user); setDetails(profileFields(user)); setMessage('Profile details saved.'); setEditing(false);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function savePassword(event) {
    event.preventDefault();
    if (passwordBusy) return;
    setPasswordError(''); setPasswordMessage('');
    if (passwords.next !== passwords.confirm) { setPasswordError('Passwords do not match.'); return; }
    setPasswordBusy(true);
    try {
      await changeOwnPassword(currentUser, passwords.current, passwords.next);
      recordActivity('Password changed', {}, currentUser);
      setPasswords({ current: '', next: '', confirm: '' }); setPasswordMessage('Password updated.');
    } catch (e) { setPasswordError(e.message); }
    finally { setPasswordBusy(false); }
  }
  const fields = [
    ['name', 'Full Name (English) *', UserRound, true],
    ['nameTamil', 'Full Name (Tamil - optional)', UserRound, false],
    ['identifier', 'Official Email / Username *', Mail, true],
    ['mobileNumber', 'Official Mobile / Phone Number', Phone, true],
    ['section', 'Department / Unit', Building2, true],
    ['designation', 'Designation', Briefcase, false],
  ];
  return <section className="rr-admin rr-profile-page">
    <header className="rr-admin-heading rr-official-heading"><div><h1><UserRound size={22} />Official Profile</h1><p>Official credentials, contact information, and departmental assignment.</p></div>
      {!editing && <button type="button" className="btn btn-outline" onClick={() => { setEditing(true); setMessage(''); }}><Pencil size={16} />Edit User Data</button>}
    </header>
    {message && <p role="status" className="rr-admin-notice">{message}</p>}
    <article className="rr-admin-card rr-official-card">
      <header className="rr-official-card-header"><h2><UserRound size={18} />User Data</h2><span className="rr-profile-chip">{editing ? 'Editing user data' : 'Click Edit to modify'}</span></header>
      <form onSubmit={saveProfile}>
        {error && <p role="alert" className="rr-admin-alert">{error}</p>}
        <fieldset disabled={busy || passwordBusy} className="rr-official-fields">
          {fields.map(([name, label, Icon, required]) => <label key={name}>{label}<span className="rr-official-input"><Icon size={16} aria-hidden="true" /><input name={name} required={required} readOnly={!editing} value={details[name]} onChange={update} type={name === 'mobileNumber' ? 'tel' : 'text'} maxLength={name === 'mobileNumber' ? 24 : 160} placeholder={editing ? '' : 'Not provided'} lang={name === 'nameTamil' ? 'ta' : undefined} /></span></label>)}
        </fieldset>
        {editing && <div className="rr-profile-actions"><button type="button" className="btn btn-outline" disabled={busy} onClick={() => { setDetails(original); setError(''); setEditing(false); }}>Cancel</button><button className="btn btn-primary" disabled={!dirty || busy || passwordBusy}>{busy ? 'Saving...' : 'Save Profile'}</button></div>}
      </form>
    </article>
    <article className="rr-admin-card rr-official-card rr-system-assignment">
      <header className="rr-official-card-header"><h2><ShieldCheck size={18} />System &amp; Administrative Assignment</h2><span className="rr-profile-chip"><LockKeyhole size={12} />System Restricted</span></header>
      <div className="rr-official-fields">
        <label>Officer ID<span className="rr-official-input"><BadgeCheck size={16} /><input readOnly value={currentUser.officerId || currentUser.id || 'Not assigned'} /><LockKeyhole size={13} /></span></label>
        <label>Access Role<span className="rr-official-input"><ShieldCheck size={16} /><input readOnly value={currentUser.role === 'admin' ? 'Administrator' : 'Officer'} /><LockKeyhole size={13} /></span></label>
        <label className="rr-assigned-office">Assigned Department / Office<span className="rr-official-input"><Building2 size={16} /><input readOnly value={currentUser.office || currentUser.department || currentUser.section || currentUser.taluk || 'Not assigned'} /><LockKeyhole size={13} /></span></label>
      </div>
    </article>
    <details className="rr-profile-preferences"><summary><Settings size={16} />Settings &amp; Password</summary>
      <div className="rr-profile-settings">
        <article className="rr-admin-card"><h2 className="rr-profile-title"><Settings size={18} />Settings</h2>
          <label>Display Language<select value={currentLanguage} onChange={event => setLanguage(event.target.value)}><option value="en">English</option><option value="ta">Tamil</option></select></label>
          <p className="rr-profile-hint">Your language preference is saved automatically.</p>
        </article>
        <article className="rr-admin-card"><h2 className="rr-profile-title"><LockKeyhole size={18} />Change Password</h2>
          <form onSubmit={savePassword}>
            {passwordError && <p role="alert" className="rr-admin-alert">{passwordError}</p>}
            {passwordMessage && <p role="status" className="rr-admin-notice">{passwordMessage}</p>}
            <fieldset disabled={passwordBusy || busy} className="rr-profile-passwords">
              <label>Current Password<input required type="password" name="currentPassword" autoComplete="current-password" value={passwords.current} onChange={event => setPasswords({ ...passwords, current: event.target.value })} /></label>
              <label>New Password<input required type="password" name="newPassword" autoComplete="new-password" minLength={8} maxLength={128} value={passwords.next} onChange={event => setPasswords({ ...passwords, next: event.target.value })} /></label>
              <label>Confirm New Password<input required type="password" name="confirmPassword" autoComplete="new-password" minLength={8} maxLength={128} value={passwords.confirm} onChange={event => setPasswords({ ...passwords, confirm: event.target.value })} /></label>
            </fieldset>
            <p className="rr-profile-hint">Use 8 to 128 characters.</p>
            <div className="rr-profile-actions"><button className="btn btn-primary" disabled={passwordBusy || busy || !passwords.current || !passwords.next || !passwords.confirm}>{passwordBusy ? 'Updating...' : 'Update Password'}</button></div>
          </form>
        </article>
      </div>
    </details>
  </section>;
}
