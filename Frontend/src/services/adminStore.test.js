import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, readUsers, saveUsers, restoreBackup, validateBackup } from './adminStore.js';
import { apiService } from './apiService.js';

let values;
beforeEach(() => {
  values = new Map();
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
});
const officer = { id: 'one', name: 'Test Officer', email: 'officer@example.com', role: 'user', status: 'active', taluk: 'Erode' };

test('directory validates duplicates and persists edits', () => {
  saveUsers([officer]);
  assert.deepEqual(readUsers(), [officer]);
  assert.throws(() => saveUsers([officer, { ...officer, id: 'two', email: 'OFFICER@example.com' }]), /unique/);
  saveUsers([{ ...officer, status: 'inactive' }]);
  assert.equal(readUsers()[0].status, 'inactive');
});

test('backup round trip includes drafts, users, preferences and audit records only', () => {
  saveUsers([officer]);
  localStorage.setItem('rr_draft', JSON.stringify({ content: 'Proceedings draft', fileName: 'order.pdf', promptHistory: [{ id: 1, prompt: 'Change taluk' }] }));
  localStorage.setItem('rr_audit_logs', JSON.stringify({ 'September 2026': [{ id: 'case-one', caseNumber: 'MCOP-1', documentContent: 'Draft' }] }));
  localStorage.setItem('rr_preferences', JSON.stringify({ language: 'ta', theme: 'light' }));
  localStorage.setItem('unrelated', 'keep');
  const backup = createBackup();
  saveUsers([]);
  restoreBackup(JSON.parse(JSON.stringify(backup)));
  assert.deepEqual(createBackup().data, backup.data);
  assert.equal(localStorage.getItem('unrelated'), 'keep');
  assert.equal(Object.keys(backup.data).length, 4);
});

test('invalid restore leaves all data unchanged', () => {
  saveUsers([officer]);
  const original = createBackup();
  for (const invalid of [{ ...original, version: 99 }, { ...original, data: {} }, { ...original, data: { ...original.data, secret: 'no' } }, { ...original, data: { ...original.data, rr_draft: { content: 'x', fileName: 'x', promptHistory: {} } } }]) {
    assert.throws(() => restoreBackup(invalid));
    assert.deepEqual(createBackup().data, original.data);
  }
  assert.throws(() => validateBackup({ ...original, data: { ...original.data, rr_audit_logs: [] } }));
});

test('storage write failure rolls back restore', () => {
  saveUsers([officer]);
  localStorage.setItem('rr_audit_logs', '{}');
  const original = createBackup();
  const backup = { ...original, data: { ...original.data, rr_admin_users: [], rr_audit_logs: { 'September 2026': [] } } };
  const setItem = localStorage.setItem;
  let fail = true;
  localStorage.setItem = (key, value) => {
    if (key === 'rr_audit_logs' && fail) { fail = false; throw new Error('Quota exceeded'); }
    setItem(key, value);
  };
  assert.throws(() => restoreBackup(backup), /Quota/);
  assert.deepEqual(createBackup().data, original.data);
});

test('audit corrections update one session and preserve metadata', async () => {
  localStorage.setItem('rr_audit_logs', '{}');
  await apiService.saveAuditLog({ id: 'case-one', caseNumber: 'MCOP-1', taluk: 'Erode', status: 'DRAFT' });
  const before = Object.values(await apiService.getAuditLogs()).flat()[0];
  await apiService.saveAuditLog({ id: 'case-one', documentContent: 'Updated content', status: 'VERIFIED' });
  const records = Object.values(await apiService.getAuditLogs()).flat();
  assert.equal(records.length, 1);
  assert.equal(records[0].timestamp, before.timestamp);
  assert.equal(records[0].taluk, 'Erode');
  assert.equal(records[0].status, 'VERIFIED');
  assert.doesNotThrow(() => createBackup());
});
