import React from 'react';
import { FileText } from 'lucide-react';

const categories = [
  { name: 'MCOP', color: 'var(--deep-navy)', pattern: /\bm\.?c\.?o\.?p\b/i },
  { name: 'TNRERA', color: 'var(--slate)', pattern: /\b(?:tn\s*)?rera\b/i },
  { name: 'Customs', color: 'var(--muted-blue-grey)', pattern: /\bcustoms\b/i },
  { name: 'Court Warrant', color: 'var(--tan-warm)', pattern: /\bwarrant\b/i },
  { name: 'Employee Compensation', color: 'var(--sand-soft)', pattern: /\b(?:employees?|workmens?|workers?)[\s’']*compensation\b|\be\.?c\b/i },
  { name: 'Others', color: 'var(--bg-tertiary)' },
];

function proceedingType(record) {
  // Older saved sessions have no type field. Use identifiable source names,
  // leaving ambiguous records in Others instead of guessing from document prose.
  const explicitType = record.department_type || record.templateType || record.type;
  const source = String(explicitType || `${record.caseNumber || ''} ${record.fileName || ''}`).replace(/[_-]/g, ' ');
  return categories.find(category => category.pattern?.test(source))?.name || 'Others';
}

function proceedingStatus(status) {
  if (!status) return 'Draft';
  if (['DISPATCHED', 'DISPATCHED_TO_DRO'].includes(status)) return 'Dispatched';
  if (['FLAGGED', 'FLAGGED_FOR_REVIEW'].includes(status)) return 'Flagged';
  return status.toLowerCase().replace(/_/g, ' ').replace(/^./, char => char.toUpperCase());
}

function savedTime(record) {
  const time = Date.parse(record.timestamp);
  return Number.isFinite(time) ? time : 0;
}

export default function AdminDashboardContent({ records, onNavigate }) {
  const recentRecords = records.slice().sort((a, b) => savedTime(b) - savedTime(a)).slice(0, 5);
  const counts = new Map(categories.map(category => [category.name, 0]));
  records.forEach(record => {
    const type = proceedingType(record);
    counts.set(type, counts.get(type) + 1);
  });
  let offset = 0;
  const segments = categories.map(category => {
    const count = counts.get(category.name);
    const start = offset;
    offset += records.length ? count / records.length * 100 : 0;
    return { ...category, count, start, length: offset - start };
  });

  return <>
    <article className="rr-admin-card rr-admin-recent" aria-labelledby="rr-recent-title">
      <div className="rr-admin-toolbar">
        <h2 id="rr-recent-title">Recent RR Proceedings</h2>
        <button className="btn btn-ghost" onClick={() => onNavigate('audit')}>View All</button>
      </div>
      {recentRecords.length ? <div className="rr-admin-table-scroll">
        <table>
          <thead><tr>{['RR No.', 'Type', 'Party / Organisation', 'Officer', 'Status', 'Date'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{recentRecords.map(record => <tr key={record.id}>
            <td>{record.rrNumber || record.proceedings_roc_number || record.caseNumber || record.fileName || record.id}</td>
            <td>{proceedingType(record)}</td>
            <td>{record.defaulter || record.defaulterName || 'Not recorded'}</td>
            <td>{record.officerName || 'Not recorded'}</td>
            <td><span className="rr-admin-status">{proceedingStatus(record.status)}</span></td>
            <td>{Number.isFinite(Date.parse(record.timestamp)) ? new Date(record.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not recorded'}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="rr-admin-empty">No saved RR proceedings yet.</p>}
    </article>

    <div className="rr-admin-columns rr-admin-dashboard-bottom">
      <article className="rr-admin-card" aria-labelledby="rr-overview-title">
        <h2 id="rr-overview-title">Proceedings Overview</h2>
        <p>Distribution of RR proceedings by type</p>
        <div className="rr-admin-distribution">
          <div className="rr-admin-donut" style={{ background: records.length
            ? `conic-gradient(${segments.filter(segment => segment.count).map(segment => `${segment.color} ${segment.start}% ${segment.start + segment.length}%`).join(', ')})`
            : 'var(--border-subtle)' }}>
            <div className="rr-admin-donut-total"><strong>{records.length}</strong><span>Total proceedings</span></div>
          </div>
          <ul className="rr-admin-legend" aria-label="Proceedings by type">
            {segments.map(segment => <li key={segment.name}>
              <span className="rr-admin-swatch" style={{ background: segment.color }} aria-hidden="true" />
              <span>{segment.name}</span><strong>{segment.count}</strong>
            </li>)}
          </ul>
        </div>
        {!records.length && <p className="rr-admin-overview-empty">No proceedings to display yet.</p>}
      </article>

      <article className="rr-admin-card rr-admin-templates" aria-labelledby="rr-templates-title">
        <h2 id="rr-templates-title">Proceedings Templates</h2>
        <p>Templates available for generating Revenue Recovery proceedings</p>
        <ul className="rr-admin-template-list">
          {categories.slice(0, 4).map(category => <li key={category.name}><FileText size={16} aria-hidden="true" /><span>{category.name}</span></li>)}
          <li><FileText size={16} aria-hidden="true" /><span>Employee Compensation</span><small>Not available</small></li>
          <li><FileText size={16} aria-hidden="true" /><span>Other supported RR templates</span><small>None available</small></li>
        </ul>
        <button className="btn btn-primary" onClick={() => onNavigate('rrAssistant')}>Manage Templates</button>
      </article>
    </div>
  </>;
}
