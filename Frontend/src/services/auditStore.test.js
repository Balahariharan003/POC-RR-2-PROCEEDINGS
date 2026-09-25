import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_AUDIT_LOGS } from '../data/adminMockData.js';
import { readSavedAuditLogs } from './auditStore.js';
import { apiService } from './apiService.js';

let values;
beforeEach(() => {
  values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
});
test('fresh admin audit history is empty, including service fallback', async () => {
  assert.deepEqual(readSavedAuditLogs(), {});
  assert.deepEqual(await apiService.getAuditLogs(), {});
  await apiService.saveAuditLog({ id: 'real', caseNumber: 'REAL-1', status: 'DRAFT' });
  assert.deepEqual(Object.values(readSavedAuditLogs()).flat().map(row => row.id), ['real']);
});
test('removes only unchanged demo copies and preserves edited records, real records and accounts', () => {
  const samples = Object.values(INITIAL_AUDIT_LOGS).flat();
  const changed = { ...samples[0], documentContent: 'Real officer edits' };
  const real = { id: 'real', caseNumber: 'REAL-1', timestamp: '2026-09-25' };
  localStorage.setItem('rr_admin_users', '[{"id":"real-admin"}]');
  localStorage.setItem('rr_audit_logs', JSON.stringify({ mixed: [...samples, changed, real] }));
  assert.deepEqual(readSavedAuditLogs(), { mixed: [changed, real] });
  assert.deepEqual(JSON.parse(localStorage.getItem('rr_audit_logs')), { mixed: [changed, real] });
  assert.equal(localStorage.getItem('rr_admin_users'), '[{"id":"real-admin"}]');
});
test('malformed saved data reports an error and is not replaced with demo data', async () => {
  localStorage.setItem('rr_audit_logs', '{bad');
  await assert.rejects(apiService.getAuditLogs());
  assert.equal(localStorage.getItem('rr_audit_logs'), '{bad');
});
