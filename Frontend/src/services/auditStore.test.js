import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readSavedAuditLogs } from './auditStore.js';
import { apiService } from './apiService.js';

let values;
beforeEach(() => {
  values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
});

test('fresh admin audit history is empty', async () => {
  assert.deepEqual(readSavedAuditLogs(), {});
  assert.deepEqual(await apiService.getAuditLogs(), {});
  await apiService.saveAuditLog({ id: 'real', caseNumber: 'REAL-1', status: 'DRAFT' });
  assert.deepEqual(Object.values(readSavedAuditLogs()).flat().map(row => row.id), ['real']);
});

test('preserves real records and accounts in audit storage', () => {
  const real = { id: 'real', caseNumber: 'REAL-1', timestamp: '2026-09-25' };
  localStorage.setItem('rr_admin_users', '[{"id":"real-admin"}]');
  localStorage.setItem('rr_audit_logs', JSON.stringify({ "September 2026": [real] }));
  assert.deepEqual(readSavedAuditLogs(), { "September 2026": [real] });
  assert.equal(localStorage.getItem('rr_admin_users'), '[{"id":"real-admin"}]');
});

test('malformed saved data reports an error', async () => {
  localStorage.setItem('rr_audit_logs', '{bad');
  await assert.rejects(apiService.getAuditLogs());
  assert.equal(localStorage.getItem('rr_audit_logs'), '{bad');
});
