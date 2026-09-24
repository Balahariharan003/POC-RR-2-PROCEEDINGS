import React from 'react';
import { Search, Calendar, RotateCcw, X } from 'lucide-react';
import { dateRangeError, displayDate, emptyAuditFilters, parseFilterDate, periodRange } from './auditFilters.js';
import './AuditFilters.css';

function DateField({ label, value, onChange }) {
  return <label className="rr-audit-date-field"><span>{label}</span>
    <input type="text" inputMode="numeric" aria-label={`${label} Date`} placeholder="dd-mm-yyyy" maxLength={10} value={value} onChange={event => onChange(event.target.value)} />
    <span className="rr-audit-calendar"><Calendar size={15} aria-hidden="true" /><input type="date" aria-label={`Choose ${label.toLowerCase()} date`} value={parseFilterDate(value) || ''} onChange={event => onChange(displayDate(event.target.value))} /></span>
  </label>;
}

export default function AuditFilters({ filters, onChange, officers }) {
  const update = fields => onChange({ ...filters, ...fields });
  const error = dateRangeError(filters);
  return <div className="rr-audit-filters" role="search" aria-label="Filter audit logs">
    <div className="rr-audit-filter-row">
      <div className="rr-audit-search"><Search size={16} aria-hidden="true" /><input aria-label="Search order or defaulter" placeholder="Search order / defaulter..." value={filters.search} onChange={event => update({ search: event.target.value })} />{filters.search && <button type="button" aria-label="Clear search" onClick={() => update({ search: '' })}><X size={14} /></button>}</div>
      <select aria-label="Officer ID" value={filters.officer} onChange={event => update({ officer: event.target.value })}><option value="">All Officers</option>{officers.map(id => <option key={id} value={id}>{id}</option>)}</select>
      <div className="rr-audit-date-range" role="group" aria-label="Date range" aria-describedby={error ? 'rr-audit-date-error' : undefined}>
        <DateField label="From" value={filters.from} onChange={from => update({ from, period: 'custom' })} /><span aria-hidden="true">—</span><DateField label="To" value={filters.to} onChange={to => update({ to, period: 'custom' })} />
      </div>
      <select aria-label="Period" value={filters.period} onChange={event => { const period = event.target.value; update({ period, ...(period && period !== 'custom' ? periodRange(period) : {}) }); }}>
        <option value="" disabled>Period</option><option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option>
      </select>
      <button type="button" className="rr-audit-reset" onClick={() => onChange(emptyAuditFilters())}><RotateCcw size={15} aria-hidden="true" />Reset</button>
    </div>
    {error && <p id="rr-audit-date-error" role="alert">{error}</p>}
  </div>;
}
