import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { authenticate, canInitializeAdministrator, initializeAdministrator, saveOfficerAccount, changeOwnPassword, INITIAL_ADMIN_LOGIN, CREDENTIAL_KEY } from './accountStore.js';
import { readUsers, saveUsers, createBackup } from './adminStore.js';
import { TEMPORARY_LOGIN } from './temporaryLogin.js';

let values;
beforeEach(() => {
  values = new Map();
  if (!globalThis.crypto) globalThis.crypto = webcrypto;
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
});
const fields = { name: 'Test Officer', identifier: 'officer.test', mobileNumber: '9876543210', section: 'Revenue' };

test('temporary login requires correct credentials and preserves existing accounts and changed passwords', async () => {
  const existing = await initializeAdministrator('Existing-admin-123');
  assert.equal(await authenticate(TEMPORARY_LOGIN.email, 'incorrect', 'admin'), null);
  assert.equal(await authenticate(TEMPORARY_LOGIN.email, TEMPORARY_LOGIN.password, 'user'), null);
  assert.equal(readUsers().length, 1);
  const temporary = await authenticate(TEMPORARY_LOGIN.email, TEMPORARY_LOGIN.password, 'admin');
  assert.equal(temporary.role, 'admin');
  assert.equal(readUsers().length, 2);
  assert.equal((await authenticate(INITIAL_ADMIN_LOGIN, 'Existing-admin-123', 'admin')).id, existing.id);
  await changeOwnPassword(temporary, TEMPORARY_LOGIN.password, 'Changed-admin-456');
  assert.equal(await authenticate(TEMPORARY_LOGIN.email, TEMPORARY_LOGIN.password, 'admin'), null);
  assert.equal((await authenticate(TEMPORARY_LOGIN.email, 'Changed-admin-456', 'admin')).id, temporary.id);
  assert.equal(readUsers().length, 2);
});

test('initializes only the designated admin and verifies credentials and selected role', async () => {
  const admin = await initializeAdministrator('Admin-test-123');
  assert.equal(admin.email, INITIAL_ADMIN_LOGIN);
  assert.equal(canInitializeAdministrator(), false);
  await assert.rejects(initializeAdministrator('Different-123'), /already/);
  assert.equal((await authenticate(INITIAL_ADMIN_LOGIN.toUpperCase(), 'Admin-test-123', 'admin')).id, admin.id);
  assert.equal(await authenticate(INITIAL_ADMIN_LOGIN, 'wrong-password', 'admin'), null);
  assert.equal(await authenticate(INITIAL_ADMIN_LOGIN, 'Admin-test-123', 'user'), null);
  assert.equal(await authenticate('unknown', 'Admin-test-123', 'admin'), null);
});

test('initial password preserves the existing administrator identity and details', async () => {
  saveUsers([{ id: 'existing', name: 'Existing Admin', email: INITIAL_ADMIN_LOGIN, role: 'admin', status: 'active', taluk: 'District administration' }]);
  const admin = await initializeAdministrator('Admin-test-123');
  assert.equal(admin.id, 'existing');
  assert.equal(admin.name, 'Existing Admin');
  assert.equal(readUsers().length, 1);
});

test('officer creation stores salted hashes separately and backups exclude credentials', async () => {
  const user = await saveOfficerAccount(fields, 'Officer-test-123');
  const other = await saveOfficerAccount({ ...fields, identifier: 'other@example.com' }, 'Officer-test-123');
  assert.equal((await authenticate('OFFICER.TEST', 'Officer-test-123', 'user')).id, user.id);
  assert.equal((await authenticate('other@example.com', 'Officer-test-123', 'user')).id, other.id);
  const credentials = JSON.parse(localStorage.getItem(CREDENTIAL_KEY));
  assert.notEqual(credentials[user.id].salt, credentials[other.id].salt);
  assert.notEqual(credentials[user.id].hash, credentials[other.id].hash);
  const backup = JSON.stringify(createBackup());
  assert.equal(backup.includes(credentials[user.id].hash), false);
  assert.equal(backup.includes('Officer-test-123'), false);
  assert.equal([...values.values()].some(value => value.includes('Officer-test-123')), false);
  await assert.rejects(saveOfficerAccount({ ...fields, identifier: 'OFFICER.TEST' }, 'Officer-test-123'), /already in use/);
});

test('editing preserves role and status; password changes replace only the chosen credential', async () => {
  const user = await saveOfficerAccount(fields, 'Officer-test-123');
  const originalCredential = localStorage.getItem(CREDENTIAL_KEY);
  const updated = await saveOfficerAccount({ ...fields, id: user.id, name: 'Updated', identifier: 'updated' });
  assert.equal(localStorage.getItem(CREDENTIAL_KEY), originalCredential);
  assert.equal((await authenticate('updated', 'Officer-test-123', 'user')).id, updated.id);
  await saveOfficerAccount({ ...fields, id: user.id }, 'Changed-test-456');
  assert.equal(await authenticate(fields.identifier, 'Officer-test-123', 'user'), null);
  assert.equal((await authenticate(fields.identifier, 'Changed-test-456', 'user')).id, user.id);
  saveUsers([{ ...readUsers()[0], status: 'inactive' }]);
  await saveOfficerAccount({ ...fields, id: user.id, name: 'Still inactive' });
  assert.equal(readUsers()[0].status, 'inactive');
  assert.equal(await authenticate(fields.identifier, 'Changed-test-456', 'user'), null);
});

test('rejects invalid fields and rolls back both records when credentials cannot be saved', async () => {
  await assert.rejects(saveOfficerAccount(fields, 'short'), /8 to 128/);
  await assert.rejects(saveOfficerAccount({ ...fields, mobileNumber: 'bad' }, 'Officer-test-123'), /mobile/);
  await assert.rejects(saveOfficerAccount({ ...fields, identifier: 'bad username' }, 'Officer-test-123'), /username/);
  const before = [...values.entries()];
  const setItem = localStorage.setItem;
  localStorage.setItem = (key, value) => {
    if (key === CREDENTIAL_KEY) throw new Error('Quota exceeded');
    setItem(key, value);
  };
  await assert.rejects(saveOfficerAccount(fields, 'Officer-test-123'), /Quota/);
  assert.deepEqual([...values.entries()], before);
});


test('self-service password changes verify current password and preserve account details', async () => {
  const admin = await initializeAdministrator('Original-test-123');
  const before = readUsers();
  await assert.rejects(changeOwnPassword(admin, 'incorrect-password', 'Changed-test-456'), /Current password/);
  assert.ok(await authenticate(INITIAL_ADMIN_LOGIN, 'Original-test-123', 'admin'));
  await assert.rejects(changeOwnPassword(admin, 'Original-test-123', 'short'), /8 to 128/);
  await changeOwnPassword(admin, 'Original-test-123', 'Changed-test-456');
  assert.equal(await authenticate(INITIAL_ADMIN_LOGIN, 'Original-test-123', 'admin'), null);
  assert.ok(await authenticate(INITIAL_ADMIN_LOGIN, 'Changed-test-456', 'admin'));
  assert.deepEqual(readUsers(), before);
});


test('Tamil names and designations persist through edits and backups without changing access', async () => {
  const user = await saveOfficerAccount({ ...fields, nameTamil: '\u0bae\u0bc1\u0b95\u0bc7\u0bb7\u0bcd', designation: 'Revenue Officer' }, 'Officer-test-123');
  const updated = await saveOfficerAccount({ ...fields, id: user.id, name: 'Updated Officer' });
  assert.equal(updated.nameTamil, user.nameTamil);
  assert.equal(updated.designation, 'Revenue Officer');
  assert.equal(updated.role, 'user');
  assert.equal(updated.status, 'active');
  assert.equal(createBackup().data.rr_admin_users[0].nameTamil, user.nameTamil);
});
