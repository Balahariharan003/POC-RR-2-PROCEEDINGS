import React, { useEffect, useState } from 'react';
import { Download, Upload, Users, FileText, CheckCircle2, Database, Pencil } from 'lucide-react';
import { createBackup, readUsers, restoreBackup, validateBackup } from '../../services/adminStore.js';
import AdminDashboardContent from './AdminDashboardContent.jsx';
import UserManagement from './UserManagement.jsx';
import './AdminWorkspace.css';

import TemplateManagement from './TemplateManagement.jsx';

export default function AdminWorkspace(props) {
  if (props.view === 'adminTemplates') {
    return <TemplateManagement currentUser={props.currentUser} />;
  }
  if (props.view === 'adminUsers') {
    return <UserManagement currentUser={props.currentUser} />;
  }
  return <AdminWorkspaceContent {...props} />;
}

function AdminWorkspaceContent({ view, currentUser, onNavigate, onRestored }) {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  async function refresh() {
    try {
      const [dbUsers, dbLogs] = await Promise.all([
        apiService.getUsers(),
        apiService.getAuditLogs()
      ]);
      setUsers(dbUsers || []);
      setLogs(dbLogs || {});
      const draft = JSON.parse(localStorage.getItem('rr_draft') || 'null');
      setHasDraft(Boolean(draft && draft.content));
    } catch (e) {
      console.warn("Failed to fetch admin stats from PostgreSQL:", e);
    }
  }

  useEffect(() => {
    refresh();
  }, [view]);

  const records = [...new Map(Object.values(logs).flat().map(row => [row.id, row])).values()];

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
    <header className="rr-admin-heading"><div><p className="rr-admin-eyebrow">RR ASSISTANT · ADMINISTRATION</p><h1>{view === 'adminUsers' ? 'User Management' : view === 'adminBackup' ? 'Backup & Restore' : 'Admin Dashboard'}</h1><p>Welcome, {currentUser.name}. Manage your Revenue Recovery workspace.</p></div>{view !== 'adminDashboard' && <span className="rr-admin-local"><Database size={14} /> Local workspace</span>}</header>
    {view !== 'adminDashboard' && <p className="rr-admin-scope">Browser-local administration. Officer records do not create server accounts or enforce sign-in permissions.</p>}
    {error && <div className="rr-admin-alert" role="alert">{error}</div>}
    {message && <div className="rr-admin-notice" role="status">{message}</div>}

    {view === 'adminDashboard' && <>
      <div className="rr-admin-metrics">
        {[[Users, 'Active officers', users.filter(u => u.status === 'active').length, 'In the officer directory'], [FileText, 'RR proceedings', records.length, 'Saved proceedings sessions'], [CheckCircle2, 'Verified / dispatched', records.filter(r => ['VERIFIED', 'DISPATCHED_TO_DRO', 'DISPATCHED'].includes(r.status)).length, 'Recorded review and dispatch status'], [Pencil, 'Drafts', records.filter(r => r.status === 'DRAFT').length, 'Awaiting officer verification']].map(([Icon, label, count, note]) => <article className="rr-admin-card" key={label}><div className="rr-admin-metric-label"><span>{label}</span><Icon size={18} /></div><strong className="rr-admin-number">{count}</strong><p>{note}</p></article>)}
      </div>
      <AdminDashboardContent records={records} onNavigate={onNavigate} />
    </>}

    {view === 'adminBackup' && <>
      <div className="rr-admin-columns"><article className="rr-admin-card"><Download size={28} /><h2>Export Workspace Backup</h2><p>Download all saved local officer records, proceedings and audit history, the latest edited draft, and language/theme preferences.</p><ul><li>{users.length} officer records</li><li>{records.length} proceedings sessions</li><li>{hasDraft ? 'Latest edited draft included' : 'No saved draft'}</li></ul><button className="btn btn-primary" onClick={downloadBackup}><Download size={16} />Download Backup</button></article><article className="rr-admin-card"><Upload size={28} /><h2>Restore a Backup</h2><p>Select an RR Assistant JSON backup. Review its contents before replacing the local workspace data.</p><label className="rr-admin-file">Backup file<input type="file" accept=".json,application/json" disabled={busy} onChange={inspectBackup} /></label>{busy && <p role="status">Checking backup…</p>}</article></div>
      <article className="rr-admin-card"><h2>Backup Coverage</h2><p>This backup covers data saved in this browser. Original uploads, generated server files, backend templates, databases and real accounts are not included. Export PDF/DOCX documents separately.</p></article>
      {pending && <article className="rr-admin-card"><h2>Review Restore</h2><p>{pending.fileName}</p><p>{pending.data.rr_admin_users?.length || 0} officers · {Object.values(pending.data.rr_audit_logs || {}).flat().length} audit entries · {pending.data.rr_draft ? '1 saved draft' : 'No saved draft'}</p><p>Restoring replaces the saved local data and signs you out. Download a backup first if you need to keep the current data.</p><div className="rr-admin-actions"><button className="btn btn-primary" onClick={confirmRestore}>Replace Local Data & Sign Out</button><button className="btn btn-outline" onClick={() => setPending(null)}>Cancel</button></div></article>}
    </>}
  </section>;
}
