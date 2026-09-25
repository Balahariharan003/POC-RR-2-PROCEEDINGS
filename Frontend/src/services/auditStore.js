import { INITIAL_AUDIT_LOGS } from '../data/adminMockData.js';

const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const legacySamples = new Set(Object.values(INITIAL_AUDIT_LOGS).flat().map(canonical));

export function readSavedAuditLogs() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem('rr_audit_logs') || '{}');
  } catch {
    throw new Error('Unable to load saved audit records.');
  }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved) || Object.values(saved).some(rows => !Array.isArray(rows))) {
    throw new Error('Unable to load saved audit records.');
  }
  let removed = false;
  const cleaned = Object.fromEntries(Object.entries(saved).map(([month, rows]) => {
    const realRows = rows.filter(row => !legacySamples.has(canonical(row)));
    if (realRows.length !== rows.length) removed = true;
    return [month, realRows];
  }).filter(([, rows]) => rows.length));
  // Only byte-equivalent record contents qualify. Edited samples and real data stay.
  if (removed) localStorage.setItem('rr_audit_logs', JSON.stringify(cleaned));
  return cleaned;
}
