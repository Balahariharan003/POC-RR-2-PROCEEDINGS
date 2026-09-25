import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITY_KEY, setActivityActor, recordActivity, readActivities, mergeActivities } from './activityStore.js';
import { apiService } from './apiService.js';

beforeEach(() => {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  setActivityActor(null);
});

test('captures each actor without persisting credentials or arbitrary account fields', () => {
  setActivityActor({ id: 'admin', name: 'Admin', role: 'admin', password: 'secret' });
  recordActivity('Signed in', { password: 'secret' });
  setActivityActor({ id: 'officer', name: 'Officer', role: 'user' });
  recordActivity('Signed in');
  assert.deepEqual(readActivities().map(row => row.actorId), ['officer', 'admin']);
  assert.ok(!localStorage.getItem(ACTIVITY_KEY).includes('secret'));
  setActivityActor(null);
  recordActivity('Signed out');
  assert.equal(readActivities().length, 2);
});

test('merges older proceedings with activity newest first without duplicate proceeding snapshots', () => {
  const records = [{ id: 'old', timestamp: '2026-01-01', caseNumber: 'RR-1' }, { id: 'new', timestamp: '2026-01-02' }];
  const events = [{ id: 'edit', recordId: 'new', timestamp: '2026-01-04' }, { id: 'login', timestamp: '2026-01-03' }];
  assert.deepEqual(mergeActivities(events, records).map(row => row.id), ['edit', 'login', 'proceeding-old']);
  assert.deepEqual(mergeActivities([], []), []);
});

test('records meaningful proceeding updates once, preserving event history and current actor', async () => {
  localStorage.setItem('rr_audit_logs', '{}');
  setActivityActor({ id: 'officer', name: 'Officer', role: 'user' });
  await apiService.saveAuditLog({ id: 'rr1', caseNumber: 'RR-1', status: 'DRAFT' });
  await apiService.saveAuditLog({ id: 'rr1', status: 'DRAFT' });
  await apiService.saveAuditLog({ id: 'rr1', status: 'VERIFIED' });
  await apiService.saveAuditLog({ id: 'rr1', documentContent: 'private document' });
  assert.deepEqual(readActivities().map(row => row.action), ['Proceedings updated', 'Proceedings status updated', 'Proceedings created']);
  assert.ok(readActivities().every(row => row.actorId === 'officer' && row.reference === 'RR-1'));
  assert.ok(!localStorage.getItem(ACTIVITY_KEY).includes('private document'));
});

test('corrupt history is reported rather than silently overwritten', () => {
  localStorage.setItem(ACTIVITY_KEY, '{}');
  assert.throws(readActivities, /Unable to load/);
});
