export const USER_KEY = 'rr_admin_users';
const KEYS = [USER_KEY, 'rr_audit_logs', 'rr_draft', 'rr_preferences'];
const validHistory = value => Array.isArray(value) && value.every(item => item && ['string', 'number'].includes(typeof item.id) && typeof item.prompt === 'string' && (item.timestamp === undefined || typeof item.timestamp === 'string'));
const validRecord = row => {
  if (!row || typeof row.id !== 'string' || typeof row.caseNumber !== 'string') return false;
  const strings = ['caseNumber', 'documentContent', 'timestamp', 'status', 'taluk', 'district', 'fileName', 'fileSize', 'defaulter', 'defaulterName', 'officerName', 'notes', 'dispatchReceipt'];
  if (strings.some(key => row[key] !== undefined && typeof row[key] !== 'string')) return false;
  if (row.amount !== undefined && !['string', 'number'].includes(typeof row.amount)) return false;
  if (['groundingScore', 'hallucinationScore'].some(key => row[key] !== undefined && (typeof row[key] !== 'number' || !Number.isFinite(row[key])))) return false;
  return row.promptHistory === undefined || validHistory(row.promptHistory);
};

export function readUsers() {
  const users = JSON.parse(localStorage.getItem(USER_KEY) || '[]');
  validateUsers(users);
  return users;
}

function validateUsers(users) {
  if (!Array.isArray(users)) throw new Error('Invalid user directory.');
  const emails = new Set();
  const ids = new Set();
  for (const user of users) {
    if (!user || typeof user.id !== 'string' || !user.id || ids.has(user.id) ||
      typeof user.name !== 'string' || !user.name.trim() ||
      typeof user.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) ||
      !['admin', 'user'].includes(user.role) || !['active', 'inactive'].includes(user.status) ||
      typeof user.taluk !== 'string' || emails.has(user.email.toLowerCase())) {
      throw new Error('Users must have unique IDs and emails, a name, role, status and taluk.');
    }
    ids.add(user.id);
    emails.add(user.email.toLowerCase());
  }
}

export function saveUsers(users) {
  validateUsers(users);
  localStorage.setItem(USER_KEY, JSON.stringify(users));
}

export function validateBackup(backup) {
  if (backup?.app !== 'rr-assistant' || backup.version !== 1 || !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) {
    throw new Error('Select a valid RR Assistant version 1 backup.');
  }
  if (Object.keys(backup.data).some(key => !KEYS.includes(key)) || !KEYS.every(key => Object.hasOwn(backup.data, key))) {
    throw new Error('Backup contains missing or unsupported data sections.');
  }
  for (const [key, value] of Object.entries(backup.data)) {
    if (value === null) continue;
    if (key === USER_KEY) validateUsers(value);
    else if (key === 'rr_audit_logs') {
      if (typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(rows => !Array.isArray(rows) || rows.some(row => !validRecord(row)))) {
        throw new Error('Invalid proceedings or audit records.');
      }
    } else if (key === 'rr_draft') {
      if (typeof value !== 'object' || typeof value.content !== 'string' || typeof value.fileName !== 'string' || (value.promptHistory !== undefined && !validHistory(value.promptHistory)) || (value.fileSize !== undefined && typeof value.fileSize !== 'string') || (value.sessionId != null && typeof value.sessionId !== 'string')) throw new Error('Invalid saved draft.');
    } else if (key === 'rr_preferences') {
      if (!['en', 'ta'].includes(value.language) || !['light', 'dark'].includes(value.theme)) throw new Error('Invalid preferences.');
    }
  }
  return backup;
}

export function createBackup() {
  return validateBackup({ app: 'rr-assistant', version: 1, createdAt: new Date().toISOString(), data: Object.fromEntries(KEYS.map(key => [key, JSON.parse(localStorage.getItem(key) || 'null')])) });
}

export function restoreBackup(backup) {
  validateBackup(backup);
  const previous = Object.fromEntries(KEYS.map(key => [key, localStorage.getItem(key)]));
  try {
    for (const key of KEYS) {
      if (backup.data[key] === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(backup.data[key]));
    }
  } catch (error) {
    for (const key of KEYS) {
      if (previous[key] === null) localStorage.removeItem(key);
      else localStorage.setItem(key, previous[key]);
    }
    throw error;
  }
}
