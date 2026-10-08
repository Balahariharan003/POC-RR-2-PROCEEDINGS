import React, { useEffect, useState } from 'react';
import { Users, FileText, CheckCircle2, CircleX } from 'lucide-react';
import { ACTIVITY_EVENT } from '../../services/activityStore.js';
import { apiService } from '../../services/apiService.js';
import { isRRProceeding } from '../../services/auditStore.js';
import AdminDashboardContent from './AdminDashboardContent.jsx';
import UserManagement from './UserManagement.jsx';
import BackupPage from './BackupPage.jsx';
import TemplateManagement from './TemplateManagement.jsx';
import './AdminWorkspace.css';

export default function AdminWorkspace(props) {
  if (props.view === 'adminUsers') return <UserManagement currentUser={props.currentUser} onUserUpdated={props.onUserUpdated} />;
  if (props.view === 'adminBackup') return <BackupPage onRestored={props.onRestored} />;
  if (props.view === 'adminTemplates') return <TemplateManagement currentUser={props.currentUser} />;
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

  const isUserOnline = (user) => {
    if (!currentUser || !user) return false;
    return (
      (currentUser.id && user.id === currentUser.id) ||
      (currentUser.username && user.username && user.username.toLowerCase() === currentUser.username.toLowerCase()) ||
      (currentUser.email && user.email && user.email.toLowerCase() === currentUser.email.toLowerCase())
    );
  };

  const allRecords = [...new Map(Object.values(logs).flat().filter(row => row && typeof row.id === 'string').map(row => [row.id, row])).values()];
  const rrRecords = allRecords.filter(isRRProceeding);
  const onlineCount = users.filter(u => isUserOnline(u)).length || 1;

  const metrics = [
    {
      icon: Users,
      label: 'Active Officers',
      count: onlineCount,
      note: `${onlineCount} logged in now (${users.length} total officers)`,
      onClick: () => onNavigate && onNavigate('adminUsers'),
      clickable: true,
      title: 'Click to view and manage officers',
    },
    {
      icon: FileText,
      label: 'Total Orders',
      count: rrRecords.length,
      note: 'Saved proceedings sessions',
      onClick: () => onNavigate && onNavigate('audit'),
      clickable: true,
      title: 'Click to view audit ledger',
    },
    {
      icon: CheckCircle2,
      label: 'Success',
      count: rrRecords.filter((r) => ['VERIFIED', 'DISPATCHED_TO_DRO', 'DISPATCHED'].includes(r.status)).length,
      note: 'Recorded review and dispatch status',
      clickable: false,
    },
    {
      icon: CircleX,
      label: 'Pending Review',
      count: rrRecords.filter((r) => r.status === 'DRAFT' || !r.status).length,
      note: 'Awaiting officer verification',
      clickable: false,
    },
  ];

  return <section className="rr-admin rr-admin-dashboard">
    <header className="rr-admin-heading"><div><p className="rr-admin-eyebrow">OFFICE ASSISTANT · ADMINISTRATION</p><h1>Admin Dashboard</h1><p>Welcome, {currentUser.name || currentUser.full_name}. Manage your Proceeding workspace.</p></div></header>
    {error && <div className="rr-admin-alert" role="alert">{error}</div>}
    <>
      <div className="rr-admin-metrics">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <article
              className={`rr-admin-card ${m.clickable ? 'rr-clickable-metric-card' : ''}`}
              key={m.label}
              onClick={m.onClick}
              title={m.title}
              role={m.clickable ? 'button' : undefined}
              tabIndex={m.clickable ? 0 : undefined}
              onKeyDown={(e) => {
                if (m.clickable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  m.onClick?.();
                }
              }}
            >
              <div className="rr-admin-metric-label">
                <span>{m.label}</span>
                <Icon size={18} />
              </div>
              <strong className="rr-admin-number">{m.count}</strong>
              <p>{m.note}</p>
            </article>
          );
        })}
      </div>
      <AdminDashboardContent records={rrRecords} onNavigate={onNavigate} />
    </>
  </section>;
}
