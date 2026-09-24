import { readUsers, saveUsers, USER_KEY } from './adminStore.js';

export const INITIAL_ADMIN_LOGIN = 'mtdev8386@gmail.com';
export const CREDENTIAL_KEY = 'rr_account_credentials';
const ITERATIONS = 600000;
const identifierOf = user => (user.username || user.email || '').trim().toLowerCase();

function readCredentials() {
  const credentials = JSON.parse(localStorage.getItem(CREDENTIAL_KEY) || '{}');
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) throw new Error('Unable to load account credentials.');
  return credentials;
}

const hex = bytes => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, key, 256);
  return hex(new Uint8Array(bits));
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128 || !password.trim()) throw new Error('Use a password with 8 to 128 characters.');
}

async function makeCredential(password) {
  validatePassword(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { algorithm: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: hex(salt), hash: await passwordHash(password, salt) };
}

function commitAccounts(users, credentials) {
  const previousUsers = localStorage.getItem(USER_KEY);
  const previousCredentials = localStorage.getItem(CREDENTIAL_KEY);
  try {
    saveUsers(users);
    localStorage.setItem(CREDENTIAL_KEY, JSON.stringify(credentials));
  } catch (error) {
    if (previousUsers === null) localStorage.removeItem(USER_KEY); else localStorage.setItem(USER_KEY, previousUsers);
    if (previousCredentials === null) localStorage.removeItem(CREDENTIAL_KEY); else localStorage.setItem(CREDENTIAL_KEY, previousCredentials);
    throw error;
  }
}

export function canInitializeAdministrator() {
  const credentials = readCredentials();
  const users = readUsers();
  const admin = users.find(user => identifierOf(user) === INITIAL_ADMIN_LOGIN);
  return (!admin || (admin.role === 'admin' && admin.status === 'active')) && !users.some(user => user.role === 'admin' && Object.hasOwn(credentials, user.id));
}

export async function initializeAdministrator(password) {
  if (!canInitializeAdministrator()) throw new Error('Administrator access has already been configured.');
  const credential = await makeCredential(password);
  if (!canInitializeAdministrator()) throw new Error('Administrator access has already been configured.');
  const users = readUsers();
  const existing = users.find(user => identifierOf(user) === INITIAL_ADMIN_LOGIN);
  const admin = existing || { id: crypto.randomUUID(), name: 'District Collector', username: INITIAL_ADMIN_LOGIN, email: INITIAL_ADMIN_LOGIN, mobileNumber: '', section: 'Administration', taluk: '', role: 'admin', status: 'active' };
  commitAccounts(existing ? users : [...users, admin], { ...readCredentials(), [admin.id]: credential });
  return admin;
}

export async function authenticate(identifier, password, role) {
  const normalized = identifier.trim().toLowerCase();
  const user = readUsers().find(item => identifierOf(item) === normalized || (item.email && item.email.toLowerCase() === normalized));
  if (!user || user.status !== 'active' || user.role !== role) return null;
  const credential = readCredentials()[user.id];
  if (!credential || credential.algorithm !== 'PBKDF2-SHA256' || credential.iterations !== ITERATIONS || !/^[a-f0-9]{32}$/.test(credential.salt) || !/^[a-f0-9]{64}$/.test(credential.hash)) return null;
  const salt = Uint8Array.from(credential.salt.match(/../g), byte => parseInt(byte, 16));
  const hash = await passwordHash(password, salt);
  let difference = 0;
  for (let index = 0; index < hash.length; index++) difference |= hash.charCodeAt(index) ^ credential.hash.charCodeAt(index);
  return difference === 0 ? user : null;
}

export async function saveOfficerAccount(fields, password = '') {
  const identifier = fields.identifier.trim().toLowerCase();
  if (!fields.name.trim() || !fields.section.trim()) throw new Error('Enter the officer name and section.');
  if (!identifier || /\s/.test(identifier) || (identifier.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier))) throw new Error('Enter a valid username or email.');
  if (!/^\+?[\d ()-]+$/.test(fields.mobileNumber) || !/^\d{7,15}$/.test(fields.mobileNumber.replace(/\D/g, ''))) throw new Error('Enter a valid mobile number.');
  if (!fields.id && !password) throw new Error('Enter a password for the new officer.');
  const credential = password ? await makeCredential(password) : null;
  const users = readUsers();
  const original = fields.id ? users.find(user => user.id === fields.id) : null;
  if (fields.id && !original) throw new Error('This officer is no longer in the directory. Reload the page.');
  if (users.some(user => user.id !== fields.id && (identifierOf(user) === identifier || user.email?.toLowerCase() === identifier))) throw new Error('This username or email is already in use.');
  const user = { ...original, id: original?.id || crypto.randomUUID(), name: fields.name.trim(), nameTamil: (fields.nameTamil ?? original?.nameTamil ?? '').trim(), designation: (fields.designation ?? original?.designation ?? '').trim(), username: identifier, email: identifier.includes('@') ? identifier : '', mobileNumber: fields.mobileNumber.trim(), section: fields.section.trim(), taluk: original?.taluk || '', role: original?.role || 'user', status: original?.status || 'active' };
  const updated = original ? users.map(item => item.id === user.id ? user : item) : [...users, user];
  if (credential) commitAccounts(updated, { ...readCredentials(), [user.id]: credential });
  else saveUsers(updated);
  return user;
}

export async function changeOwnPassword(user, currentPassword, newPassword) {
  const account = readUsers().find(item => item.id === user.id);
  if (!account || !await authenticate(account.username || account.email, currentPassword, account.role)) {
    throw new Error('Current password is incorrect.');
  }
  const credential = await makeCredential(newPassword);
  localStorage.setItem(CREDENTIAL_KEY, JSON.stringify({ ...readCredentials(), [account.id]: credential }));
}
