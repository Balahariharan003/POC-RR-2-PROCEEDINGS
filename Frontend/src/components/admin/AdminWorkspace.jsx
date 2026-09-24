import React, { useEffect, useState } from 'react';
import { Users, FileText, CheckCircle2, CircleX } from 'lucide-react';
import { readUsers } from '../../services/adminStore.js';
import AdminDashboardContent from './AdminDashboardContent.jsx';
import UserManagement from './UserManagement.jsx';
import BackupPage from './BackupPage.jsx';
import './AdminWorkspace.css';

export default function AdminWorkspace(props) {
  if (props.view === 'adminUsers') return <UserManagement currentUser={props.currentUser} onUserUpdated={props.onUserUpdated} />;
  if (props.view === 'adminBackup') return <BackupPage onRestored={props.onRestored} />;
  return <AdminWorkspaceContent {...props} />;
}

function AdminWorkspaceContent({ currentUser, onNavigate }) {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState({});
  const [error, setError] = useState('');
  useEffect(() => {
    try {
      setUsers(readUsers());
      // Dashboard reads must not depend on validating unrelated backup data.
      const saved = JSON.parse(localStorage.getItem('rr_audit_logs') || '{}');
      if (!saved || typeof saved !== 'object' || Array.isArray(saved) || Object.values(saved).some(rows => !Array.isArray(rows))) throw new Error('Invalid proceedings.');
      setLogs(saved);
    } catch { setError('Unable to load dashboard data. Please reload the page to try again.'); }
  }, []);
  const records = [...new Map(Object.values(logs).flat().filter(row => row && typeof row.id === 'string').map(row => [row.id, row])).values()];

  return <section className="rr-admin rr-admin-dashboard">
    <header className="rr-admin-heading"><div><p className="rr-admin-eyebrow">RR ASSISTANT · ADMINISTRATION</p><h1>Admin Dashboard</h1><p>Welcome, {currentUser.name}. Manage your Revenue Recovery workspace.</p></div></header>
    {error && <div className="rr-admin-alert" role="alert">{error}</div>}
    <>
      <div className="rr-admin-metrics">
        {[[Users, 'Active officers', users.filter(u => u.status === 'active').length, 'In the officer directory'], [FileText, 'Total Proceedings', records.length, 'Saved proceedings sessions'], [CheckCircle2, 'Success', records.filter(r => ['VERIFIED', 'DISPATCHED_TO_DRO', 'DISPATCHED'].includes(r.status)).length, 'Recorded review and dispatch status'], [CircleX, 'Failure', records.filter(r => r.status === 'DRAFT').length, 'Awaiting officer verification']].map(([Icon, label, count, note]) => <article className="rr-admin-card" key={label}><div className="rr-admin-metric-label"><span>{label}</span><Icon size={18} /></div><strong className="rr-admin-number">{count}</strong><p>{note}</p></article>)}
      </div>
      <AdminDashboardContent records={records} onNavigate={onNavigate} />
    </>

  </section>;
}
