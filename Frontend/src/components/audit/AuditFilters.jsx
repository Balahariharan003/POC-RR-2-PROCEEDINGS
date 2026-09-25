import React, { useState, useEffect, useRef } from 'react';
import { Search, Calendar, RotateCcw, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { dateRangeError, emptyAuditFilters, parseFilterDate, periodRange } from './auditFilters.js';
import './AuditFilters.css';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const pad = num => String(num).padStart(2, '0');

function DateField({ label, placeholder, value, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const parsedIso = parseFilterDate(value);

  const initialDate = parsedIso ? new Date(`${parsedIso}T00:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  useEffect(() => {
    if (parsedIso) {
      const [y, m] = parsedIso.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [parsedIso]);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const selectDay = (day) => {
    const formatted = `${pad(day)}-${pad(viewMonth + 1)}-${viewYear}`;
    onChange(formatted);
    setOpen(false);
  };

  const selectedDay = parsedIso && Number(parsedIso.split('-')[0]) === viewYear && Number(parsedIso.split('-')[1]) === viewMonth + 1
    ? Number(parsedIso.split('-')[2])
    : null;

  return (
    <div className={`rr-audit-date-picker ${open ? 'is-open' : ''}`} ref={containerRef}>
      <div className={`rr-audit-date-box ${open ? 'active' : ''}`} onClick={() => setOpen(true)}>
        <input
          type="text"
          inputMode="numeric"
          aria-label={`${label} Date`}
          placeholder={placeholder}
          maxLength={10}
          value={value}
          onFocus={() => setOpen(true)}
          onChange={event => onChange(event.target.value)}
        />
        <button
          type="button"
          className="rr-audit-calendar-btn"
          aria-label={`Choose ${label.toLowerCase()} date`}
          aria-expanded={open}
          onClick={(event) => {
            event.stopPropagation();
            setOpen(prev => !prev);
          }}
        >
          <Calendar size={16} aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div className="rr-audit-calendar-popover" role="dialog" aria-label={`${label} date calendar`}>
          <div className="rr-audit-calendar-header">
            <button type="button" className="rr-audit-cal-nav" aria-label="Previous month" onClick={prevMonth}>
              <ChevronLeft size={16} />
            </button>
            <span className="rr-audit-cal-title">{monthLabel}</span>
            <button type="button" className="rr-audit-cal-nav" aria-label="Next month" onClick={nextMonth}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="rr-audit-calendar-weekdays">
            {WEEKDAYS.map(day => <span key={day}>{day}</span>)}
          </div>

          <div className="rr-audit-calendar-grid">
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <span key={`empty-${idx}`} className="rr-audit-cal-empty" />
            ))}
            {Array.from({ length: daysInMonth }, (_, idx) => idx + 1).map(day => (
              <button
                key={day}
                type="button"
                className={`rr-audit-cal-day ${selectedDay === day ? 'selected' : ''}`}
                onClick={() => selectDay(day)}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuditFilters({ filters, onChange, officers }) {
  const update = fields => onChange({ ...filters, ...fields });
  const error = dateRangeError(filters);
  return <div className="rr-audit-filters" role="search" aria-label="Filter audit logs">
    <div className="rr-audit-filter-row">
      <div className="rr-audit-search"><Search size={16} aria-hidden="true" /><input aria-label="Search order or defaulter" placeholder="Search order / defaulter..." value={filters.search} onChange={event => update({ search: event.target.value })} />{filters.search && <button type="button" aria-label="Clear search" onClick={() => update({ search: '' })}><X size={14} /></button>}</div>
      <select aria-label="Officer ID" value={filters.officer} onChange={event => update({ officer: event.target.value })}><option value="">All Officers</option>{officers.map(id => <option key={id} value={id}>{id}</option>)}</select>
      <div className="rr-audit-date-range" role="group" aria-label="Date range" aria-describedby={error ? 'rr-audit-date-error' : undefined}>
        <DateField label="From" placeholder="From" value={filters.from} onChange={from => update({ from, period: (from || filters.to) ? 'custom' : '' })} />
        <DateField label="To" placeholder="to" value={filters.to} onChange={to => update({ to, period: (filters.from || to) ? 'custom' : '' })} />
      </div>
      <select aria-label="Period" value={filters.period} onChange={event => { const period = event.target.value; update({ period, ...(period === '' ? { from: '', to: '' } : period !== 'custom' ? periodRange(period) : {}) }); }}>
        <option value="">All Periods</option><option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="custom">Custom</option>
      </select>
      <button type="button" className="rr-audit-reset" onClick={() => onChange(emptyAuditFilters())}><RotateCcw size={15} aria-hidden="true" />Reset</button>
    </div>
    {error && <p id="rr-audit-date-error" role="alert">{error}</p>}
  </div>;
}
