import React, { useEffect, useState } from 'react';
import { ACTIVITY_EVENT, readActivities, mergeActivities } from '../../services/activityStore.js';

const statusLabel = value => ({ DISPATCHED_TO_DRO: 'Dispatched', FLAGGED_FOR_REVIEW: 'Flagged' }[value] || value.toLowerCase().replace(/_/g, ' ').replace(/^./, char => char.toUpperCase()));

function activityLabel(action) {
  if (action === 'Signed in') return ['LOGIN', 'login'];
  if (action === 'Signed out') return ['LOGOUT', 'logout'];
  if (/created|generated/i.test(action) && /proceeding/i.test(action)) return ['GENERATE', 'document'];
  if (/proceeding|draft/i.test(action)) return ['PROCEEDINGS', 'document'];
  if (/backup/i.test(action)) return ['BACKUP', 'neutral'];
  if (/password/i.test(action)) return ['SECURITY', 'neutral'];
  if (/Officer added/.test(action)) return ['CREATE', 'login'];
  return ['UPDATE', 'neutral'];
}
function activityDescription(row) {
  const name = row.actorName || 'Unknown user';
  if (row.action === 'Signed in') return `${name} logged in.`;
  if (row.action === 'Signed out') return `${name} logged out.`;
  const reference = row.reference && Number.isFinite(Date.parse(row.reference)) && /^\d{4}-\d{2}-\d{2}T/.test(row.reference)
    ? new Date(row.reference).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : row.reference;
  return `${name}: ${row.action}${reference ? ` (${reference})` : ''}${row.status ? ` ? ${statusLabel(row.status)}` : ''}.`;
}

export default function AdminDashboardContent({ records }) {
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    const refresh = () => {
      try { setActivities(readActivities()); setError(''); }
      catch { setError('Unable to load activity history. Please reload to try again.'); }
    };
    refresh();
    window.addEventListener(ACTIVITY_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(ACTIVITY_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, []);
  const history = mergeActivities(activities.filter(item => item.action !== 'Language changed'), records);
  const visible = showAll ? history : history.slice(0, 5);
  return <article className="rr-admin-card rr-admin-recent rr-admin-activity" aria-labelledby="rr-recent-title">
    <div className="rr-admin-toolbar">
      <h2 id="rr-recent-title">Recent Activity</h2>
      {history.length > 5 && <button className="btn btn-ghost rr-activity-view-all" aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>{showAll ? 'Show Recent' : 'View All'}</button>}
    </div>
    {error && <p role="alert">{error}</p>}
    {visible.length ? <ul className="rr-activity-list" aria-label="Recent activity">
      {visible.map(row => {
        const [label, tone] = activityLabel(row.action);
        return <li key={row.id}>
          <span className={`rr-activity-badge ${tone}`}>{label}</span>
          <span className="rr-activity-description">{activityDescription(row)}</span>
          {Number.isFinite(Date.parse(row.timestamp)) ? <time dateTime={row.timestamp}>{new Date(row.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time> : <span>Not recorded</span>}
        </li>;
      })}
    </ul> : !error && <p className="rr-admin-empty">No activity recorded yet.</p>}
  </article>;
}
