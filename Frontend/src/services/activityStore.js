export const ACTIVITY_KEY = 'rr_activity_history';
export const ACTIVITY_EVENT = 'rr-activity-updated';
let actor = null;

export function setActivityActor(user) {
  actor = user ? { id: user.id, name: user.name, role: user.role } : null;
}

export function readActivities() {
  const rows = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]');
  if (!Array.isArray(rows) || rows.some(row => !row?.id || typeof row.action !== 'string' || !Number.isFinite(Date.parse(row.timestamp)))) {
    throw new Error('Unable to load activity history.');
  }
  return rows;
}

// Store only display metadata, never account fields, passwords or document content.
export function recordActivity(action, { reference = '', recordId = '', status = '' } = {}, user = actor) {
  if (!user) return;
  try {
    const entry = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), actorId: user.id,
      actorName: user.name, role: user.role, action, reference, recordId, status };
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify([entry, ...readActivities()]));
    globalThis.window?.dispatchEvent(new Event(ACTIVITY_EVENT));
    return entry;
  } catch (error) {
    console.warn('Unable to save activity history:', error);
    return null;
  }
}

export function mergeActivities(activities, records) {
  const tracked = new Set(activities.filter(row => row.recordId).map(row => row.recordId));
  const legacy = records.filter(row => !tracked.has(row.id)).map(row => ({
    id: `proceeding-${row.id}`, recordId: row.id, timestamp: row.timestamp,
    actorName: row.officerName || 'Not recorded', role: '', action: 'Proceedings recorded',
    reference: row.rrNumber || row.proceedings_roc_number || row.caseNumber || row.fileName || row.id,
    status: row.status || 'DRAFT',
  }));
  return [...activities, ...legacy].sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));
}
