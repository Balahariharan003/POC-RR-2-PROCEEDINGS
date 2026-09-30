/**
 * Audit Store - Manages local and synchronized audit ledger records.
 * Clean, production storage reader without simulated fixtures.
 */

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
  return saved;
}
