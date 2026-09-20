import React, { useEffect, useState } from 'react';
import { Download, Upload, Users, FileText, CheckCircle2, Database, Plus, Pencil } from 'lucide-react';
import { createBackup, readUsers, saveUsers, restoreBackup, validateBackup } from '../../services/adminStore.js';
import './AdminWorkspace.css';

const emptyUser = { name: '', email: '', role: 'user', status: 'active', taluk: '' };

export default function AdminWorkspace({ view, currentUser, onNavigate, onRestored }) {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  function refresh() {
    setUsers(readUsers());
    const backup = createBackup();
    setLogs(backup.data.rr_audit_logs || {});
    setHasDraft(Boolean(backup.data.rr_draft));
  }
  useEffect(() => {
    try { refresh(); } catch (e) { setError(e.message); }
  }, [view]);

  const records = [...new Map(Object.values(logs).flat().map(row => [row.id, row])).values()];
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() - 6 + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { key, label: date.toLocaleDateString('en-IN', { weekday: 'short' }), count: records.filter(row => row.timestamp?.slice(0, 10) === key).length };
  });
  const maximum = Math.max(1, ...days.map(day => day.count));

  function saveUser(event) {
    event.preventDefault(); setError(''); setMessage('');
    try {
      const user = { ...editing, id: editing.id || crypto.randomUUID(), name: editing.name.trim(), email: editing.email.trim().toLowerCase(), taluk: editing.taluk.trim() };
      if (user.id && users.find(item => item.id === user.id)?.email === currentUser.email && (user.role !== 'admin' || user.status !== 'active' || user.email !== currentUser.email)) {
        throw new Error('Keep your current administrator account active with its existing email.');
      }
      const updated = editing.id ? users.map(item => item.id === user.id ? user : item) : [...users, user];
      if (users.some(item => item.role === 'admin' && item.status === 'active') && !updated.some(item => item.role === 'admin' && item.status === 'active')) throw new Error('Keep at least one active administrator.');
      saveUsers(updated); setUsers(updated); setEditing(null); setMessage('Officer directory saved.');
    } catch (e) { setError(e.message); }
  }

  function downloadBackup() {
    setError(''); setMessage('');
    try {
      const backup = createBackup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `rr-assistant-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Backup download started. Keep the JSON file for restoration.');
    } catch (e) { setError(e.message); }
  }

  async function inspectBackup(event) {
    const file = event.target.files[0]; event.target.value = ''; setPending(null); setError(''); setMessage('');
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Select a backup smaller than 20 MB.');
      const backup = validateBackup(JSON.parse(await file.text()));
      setPending({ ...backup, fileName: file.name });
    } catch (e) { setError(`Cannot restore this file: ${e.message}`); }
    finally { setBusy(false); }
  }

  function confirmRestore() {
    try {
      restoreBackup(pending); setPending(null); refresh(); onRestored();
      setMessage('Local data restored. Sign in again to start a fresh session.');
    } catch (e) { setError(`Restore failed: ${e.message}`); }
  }

  return <section className="rr-admin">
    <header className="rr-admin-heading"><div><p className="rr-admin-eyebrow">RR ASSISTANT · ADMINISTRATION</p><h1>{view === 'adminUsers' ? 'User Management' : view === 'adminBackup' ? 'Backup & Restore' : 'Admin Dashboard'}</h1><p>Welcome, {currentUser.name}. Manage your Revenue Recovery workspace.</p></div><span className="rr-admin-local"><Database size={14} /> Local workspace</span></header>
    <p className="rr-admin-scope">Browser-local administration. Officer records do not create server accounts or enforce sign-in permissions.</p>
    {error && <div className="rr-admin-alert" role="alert">{error}</div>}
    {message && <div className="rr-admin-notice" role="status">{message}</div>}

    {view === 'adminDashboard' && <>
      <div className="rr-admin-metrics">
        {[[Users, 'Active officers', users.filter(u => u.status === 'active').length, 'In the local officer directory'], [FileText, 'RR proceedings', records.length, 'Saved proceedings sessions'], [CheckCircle2, 'Verified / dispatched', records.filter(r => ['VERIFIED', 'DISPATCHED_TO_DRO', 'DISPATCHED'].includes(r.status)).length, 'Recorded review and dispatch status'], [Pencil, 'Drafts', records.filter(r => r.status === 'DRAFT').length, 'Awaiting officer verification']].map(([Icon, label, count, note]) => <article className="rr-admin-card" key={label}><div className="rr-admin-metric-label"><span>{label}</span><Icon size={18} /></div><strong className="rr-admin-number">{count}</strong><p>{note}</p></article>)}
      </div>
      <div className="rr-admin-columns">
        <article className="rr-admin-card"><h2>Proceedings Activity</h2><p>Saved RR sessions over the last 7 days</p><div className="rr-admin-chart" aria-label="Proceedings saved each day">{days.map(day => <div className="rr-admin-chart-day" key={day.key}><span>{day.count}</span><div className="rr-admin-chart-track"><div style={{ height: `${day.count / maximum * 100}%` }} /></div><span>{day.label}</span></div>)}</div>{!days.some(day => day.count) && <p>No dated proceedings saved in the last 7 days.</p>}</article>
        <div className="rr-admin-stack"><article className="rr-admin-card"><h2>Officer Administration</h2><p>Maintain officer names, roles, taluk assignments and active status for the RR workspace.</p><button className="btn btn-primary" onClick={() => onNavigate('adminUsers')}>Manage Users</button></article><article className="rr-admin-card"><h2>RR Proceedings Templates</h2><p>Generate proceedings from source orders using the existing department templates.</p><div className="rr-admin-tags"><span>MCOP</span><span>Customs</span><span>TNRERA</span><span>Court warrant</span></div><button className="btn btn-primary" onClick={() => onNavigate('rrAssistant')}>Open RR Assistant</button></article></div>
      </div>
      <article className="rr-admin-card"><div className="rr-admin-toolbar"><h2>Recent Proceedings</h2><button className="btn btn-ghost" onClick={() => onNavigate('audit')}>View Audit Logs</button></div>{records.length ? <div className="rr-admin-table-scroll"><table><thead><tr><th>Case / source</th><th>Taluk</th><th>Status</th><th>Saved</th></tr></thead><tbody>{records.slice().sort((a,b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0,5).map(row => <tr key={row.id}><td>{row.caseNumber || row.fileName}</td><td>{row.taluk || '—'}</td><td><span className="rr-admin-status">{row.status || 'DRAFT'}</span></td><td>{row.timestamp ? new Date(row.timestamp).toLocaleString('en-IN') : 'Date not recorded'}</td></tr>)}</tbody></table></div> : <p>No saved proceedings yet. Start by uploading a source order in RR Assistant.</p>}</article>
    </>}

    {view === 'adminUsers' && <>
      <div className="rr-admin-toolbar"><div className="rr-admin-filters"><input aria-label="Search officers" placeholder="Search name, email or taluk" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Filter by role" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}><option value="all">All roles</option><option value="admin">Administrators</option><option value="user">Officers</option></select></div><button className="btn btn-primary" onClick={() => { setEditing({ ...emptyUser }); setError(''); }}><Plus size={16} />Add Officer</button></div>
      {editing && <form className="rr-admin-card" onSubmit={saveUser}><h2>{editing.id ? 'Edit Officer' : 'Add Officer'}</h2><div className="rr-admin-form">{[['name','Full name'],['email','Email'],['taluk','Taluk / jurisdiction']].map(([key,label]) => <label key={key}>{label}<input required maxLength={160} type={key === 'email' ? 'email' : 'text'} value={editing[key]} onChange={e => setEditing({ ...editing, [key]: e.target.value })} /></label>)}<label>Role<select value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })}><option value="user">Officer</option><option value="admin">Administrator</option></select></label><label>Status<select value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div><div className="rr-admin-actions"><button className="btn btn-primary" type="submit">Save Officer</button><button className="btn btn-outline" type="button" onClick={() => setEditing(null)}>Cancel</button></div></form>}
      <article className="rr-admin-card rr-admin-table-scroll"><table><thead><tr><th>Officer</th><th>Taluk / jurisdiction</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{users.filter(user => (roleFilter === 'all' || roleFilter === user.role) && `${user.name} ${user.email} ${user.taluk}`.toLowerCase().includes(query.toLowerCase())).map(user => <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td>{user.taluk || '—'}</td><td>{user.role === 'admin' ? 'Administrator' : 'Officer'}</td><td><span className={`rr-admin-status ${user.status}`}>{user.status}</span></td><td><button className="btn btn-ghost" aria-label={`Edit ${user.name}`} onClick={() => { setEditing({ ...user }); setError(''); }}><Pencil size={14} />Edit</button></td></tr>)}</tbody></table>{!users.some(user => (roleFilter === 'all' || roleFilter === user.role) && `${user.name} ${user.email} ${user.taluk}`.toLowerCase().includes(query.toLowerCase())) && <p>No officers match this search.</p>}</article>
    </>}

    {view === 'adminBackup' && <>
      <div className="rr-admin-columns"><article className="rr-admin-card"><Download size={28} /><h2>Export Workspace Backup</h2><p>Download all saved local officer records, proceedings and audit history, the latest edited draft, and language/theme preferences.</p><ul><li>{users.length} officer records</li><li>{records.length} proceedings sessions</li><li>{hasDraft ? 'Latest edited draft included' : 'No saved draft'}</li></ul><button className="btn btn-primary" onClick={downloadBackup}><Download size={16} />Download Backup</button></article><article className="rr-admin-card"><Upload size={28} /><h2>Restore a Backup</h2><p>Select an RR Assistant JSON backup. Review its contents before replacing the local workspace data.</p><label className="rr-admin-file">Backup file<input type="file" accept=".json,application/json" disabled={busy} onChange={inspectBackup} /></label>{busy && <p role="status">Checking backup…</p>}</article></div>
      <article className="rr-admin-card"><h2>Backup Coverage</h2><p>This backup covers data saved in this browser. Original uploads, generated server files, backend templates, databases and real accounts are not included. Export PDF/DOCX documents separately.</p></article>
      {pending && <article className="rr-admin-card"><h2>Review Restore</h2><p>{pending.fileName}</p><p>{pending.data.rr_admin_users?.length || 0} officers · {Object.values(pending.data.rr_audit_logs || {}).flat().length} audit entries · {pending.data.rr_draft ? '1 saved draft' : 'No saved draft'}</p><p>Restoring replaces the saved local data and signs you out. Download a backup first if you need to keep the current data.</p><div className="rr-admin-actions"><button className="btn btn-primary" onClick={confirmRestore}>Replace Local Data & Sign Out</button><button className="btn btn-outline" onClick={() => setPending(null)}>Cancel</button></div></article>}
    </>}
  </section>;
}
