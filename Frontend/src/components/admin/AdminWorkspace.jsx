import React, { useEffect, useState } from 'react';
import { Users, FileText, CheckCircle2, CircleX } from 'lucide-react';
import { ACTIVITY_EVENT } from '../../services/activityStore.js';
import { apiService } from '../../services/apiService.js';
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

  const refresh = async () => {
    try {
      const [fetchedUsers, fetchedLogs] = await Promise.all([
        apiService.getUsers().catch(() => []),
        apiService.getAuditLogs().catch(() => ({}))
      ]);
      setUsers(Array.isArray(fetchedUsers) ? fetchedUsers : []);
      setLogs(fetchedLogs || {});
      setError('');
    } catch {
      setError('Unable to load dashboard data. Please reload the page to try again.');
    }
  };

  useEffect(() => {
    refresh();
    const onActivity = () => refresh();
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener(ACTIVITY_EVENT, onActivity);
    window.addEventListener('rr-audit-logs-updated', onActivity);
    window.addEventListener('focus', onActivity);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener(ACTIVITY_EVENT, onActivity);
      window.removeEventListener('rr-audit-logs-updated', onActivity);
      window.removeEventListener('focus', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const records = [...new Map(Object.values(logs).flat().filter(row => row && typeof row.id === 'string').map(row => [row.id, row])).values()];
  const activeOfficers = users.filter(u => u.role !== 'admin' && (u.is_active === true || u.status === 'active'));

  return <section className="rr-admin rr-admin-dashboard">
    <header className="rr-admin-heading"><div><p className="rr-admin-eyebrow">RR ASSISTANT · ADMINISTRATION</p><h1>Admin Dashboard</h1><p>Welcome, {currentUser.name || currentUser.full_name}. Manage your Revenue Recovery workspace.</p></div></header>
    {error && <div className="rr-admin-alert" role="alert">{error}</div>}
    <>
      <div className="rr-admin-metrics">
        {[[Users, 'Active officers', activeOfficers.length, 'In the officer directory'], [FileText, 'Total Orders', records.length, 'Saved proceedings sessions'], [CheckCircle2, 'Success', records.filter(r => ['VERIFIED', 'DISPATCHED_TO_DRO', 'DISPATCHED'].includes(r.status)).length, 'Recorded review and dispatch status'], [CircleX, 'Failure', records.filter(r => r.status === 'DRAFT').length, 'Awaiting officer verification']].map(([Icon, label, count, note]) => <article className="rr-admin-card" key={label}><div className="rr-admin-metric-label"><span>{label}</span><Icon size={18} /></div><strong className="rr-admin-number">{count}</strong><p>{note}</p></article>)}
      </div>
      <AdminDashboardContent records={records} onNavigate={onNavigate} />
    </>

  </section>;
}
