export const emptyAuditFilters = () => ({ search: '', officer: '', from: '', to: '', period: '' });
const pad = number => String(number).padStart(2, '0');
const localDay = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const displayDate = iso => iso ? iso.split('-').reverse().join('-') : '';

export function parseFilterDate(value) {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(value)) return null;
  const [day, month, year] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return year >= 1000 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? localDay(date) : null;
}

export function dateRangeError({ from, to }) {
  if ((from && !parseFilterDate(from)) || (to && !parseFilterDate(to))) return 'Enter valid dates in dd-mm-yyyy format.';
  if (from && to && parseFilterDate(from) > parseFilterDate(to)) return 'From Date must be on or before To Date.';
  return '';
}

export function periodRange(period, now = new Date()) {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from);
  if (period === 'week') {
    from.setDate(from.getDate() - (from.getDay() + 6) % 7);
    to.setTime(from.getTime()); to.setDate(from.getDate() + 6);
  } else if (period === 'month') {
    from.setDate(1); to.setMonth(to.getMonth() + 1, 0);
  }
  return { from: displayDate(localDay(from)), to: displayDate(localDay(to)) };
}

export const officerId = entry => String(entry.officerId ?? entry.officer_id ?? '').trim();
export function availableOfficerIds(records) {
  return [...new Set(records.map(officerId).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function matchesAuditFilters(entry, filters) {
  if (dateRangeError(filters)) return false;
  const query = filters.search.trim().toLocaleLowerCase();
  const searchable = [entry.id, entry.orderId, entry.order_id, entry.caseId, entry.case_id, entry.caseNumber, entry.rrNumber, entry.proceedings_roc_number, entry.defaulter, entry.defaulterName];
  if (query && !searchable.some(value => typeof value === 'string' && value.toLocaleLowerCase().includes(query))) return false;
  if (filters.officer && officerId(entry) !== filters.officer) return false;
  if (!filters.from && !filters.to) return true;
  if (typeof entry.timestamp !== 'string') return false;
  // Legacy dates have no timezone; ISO timestamps are compared in local calendar time.
  const timestamp = entry.timestamp.replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T');
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(timestamp) ? `${timestamp}T00:00:00` : timestamp);
  if (!Number.isFinite(parsed.getTime())) return false;
  const day = localDay(parsed);
  return (!filters.from || day >= parseFilterDate(filters.from)) && (!filters.to || day <= parseFilterDate(filters.to));
}
