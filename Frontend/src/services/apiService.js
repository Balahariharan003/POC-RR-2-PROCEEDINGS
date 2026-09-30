import { readSavedAuditLogs } from './auditStore.js';
import { recordActivity } from './activityStore.js';
import { APP_CONFIG, APP_EVENTS, EMPTY_ENTITIES, EMPTY_VALIDATION, STORAGE_KEYS } from '../config/appConfig.js';

const API_BASE = APP_CONFIG.apiBaseUrl;
const authHeaders = () => {
  const token = globalThis.sessionStorage?.getItem(STORAGE_KEYS.authToken);
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function errorMessage(response, fallback) {
  const text = await response.text();
  try {
    const value = JSON.parse(text);
    return value.detail || value.error || fallback;
  } catch {
    return text || fallback;
  }
}

async function requestJson(path, payload, method = 'POST') {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: payload === undefined || payload === null ? undefined : JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await errorMessage(response, `Server request failed (${response.status})`));
  return response.json();
}

function assertExportSignature(bytes, format) {
  const signature = new Uint8Array(bytes.slice(0, 5));
  const valid = format === 'docx'
    ? signature[0] === 0x50 && signature[1] === 0x4b
    : String.fromCharCode(...signature) === '%PDF-';
  if (!valid) throw new Error(`The server returned an invalid ${format.toUpperCase()} file.`);
}

function triggerDownload(bytes, format, filename, contentType) {
  const blob = new Blob([bytes], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename.replace(/\.docx$/i, '')}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), APP_CONFIG.timeouts.downloadUrlRevokeMs);
}

export const apiService = {
  async getDocumentLayout(filename) {
    return requestJson(`/editor/${encodeURIComponent(filename)}`, null, 'GET');
  },

  async reviseDocument(layout, edits, instruction) {
    const result = await requestJson('/editor/revise', { filename: layout.filename, revision: layout.revision, edits, instruction });
    return result.edits;
  },

  async importWordDocument(file) {
    const body = new FormData();
    body.append('file', file);
    const response = await fetch(`${API_BASE}/editor/import`, { method: 'POST', headers: authHeaders(), body });
    if (!response.ok) throw new Error(await errorMessage(response, 'Unable to open Word document.'));
    return response.json();
  },

  async downloadEditedDocument(layout, edits, format) {
    if (!['docx', 'pdf'].includes(format)) throw new Error('Unsupported export format.');
    const response = await fetch(`${API_BASE}/editor/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ filename: layout.filename, revision: layout.revision, edits, format }),
    });
    if (!response.ok) throw new Error(await errorMessage(response, 'Export failed.'));
    const bytes = await response.arrayBuffer();
    assertExportSignature(bytes, format);
    triggerDownload(bytes, format, layout.filename, response.headers.get('content-type') || undefined);
  },

  async checkHealth() {
    try {
      const response = await fetch(`${API_BASE}/v1/health`, { headers: authHeaders(), signal: AbortSignal.timeout(APP_CONFIG.timeouts.healthMs) });
      return response.ok ? response.json() : { status: 'offline', error: `HTTP ${response.status}` };
    } catch (error) {
      return { status: 'offline', error: error.message };
    }
  },

  async login(username, password, role) {
    const response = await fetch(`${API_BASE}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username_or_email: username, password, role }),
    });
    if (!response.ok) throw new Error(await errorMessage(response, 'Invalid username or password'));
    const result = await response.json();
    if (!result.access_token || !result.user) throw new Error('The server returned an incomplete login response.');
    globalThis.sessionStorage?.setItem(STORAGE_KEYS.authToken, result.access_token);
    return result;
  },

  async logout() {
    try {
      await fetch(`${API_BASE}/v1/auth/logout`, { method: 'POST', headers: authHeaders() });
    } catch {
      // Local sign-out still completes when the server is unavailable.
    } finally {
      globalThis.sessionStorage?.removeItem(STORAGE_KEYS.authToken);
    }
  },

  async uploadDocument(file, templateCode = '') {
    const body = new FormData();
    body.append('file', file);
    if (templateCode) body.append('template_code', templateCode);
    const response = await fetch(`${API_BASE}/process-document`, {
      method: 'POST', headers: authHeaders(), body,
      signal: AbortSignal.timeout(APP_CONFIG.timeouts.documentProcessingMs),
    });
    if (!response.ok) throw new Error(await errorMessage(response, `Document processing failed (${response.status})`));
    return this.normalizePipelineResult(await response.json(), file?.name || 'document');
  },

  async getTemplates() {
    try {
      const response = await fetch(`${API_BASE}/v1/templates/`, { headers: authHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : data.templates || [];
    } catch (error) {
      console.warn('Unable to fetch templates:', error);
      return [];
    }
  },

  async getAuditLogs() {
    return readSavedAuditLogs();
  },

  async saveAuditLog(entry) {
    if (!entry?.id) return null;
    try {
      const current = (await this.getAuditLogs()) || {};
      const monthYear = new Intl.DateTimeFormat(APP_CONFIG.locale, { month: 'long', year: 'numeric' }).format(new Date());
      const existingMonth = Object.keys(current).find((month) => Array.isArray(current[month]) && current[month].some((item) => item?.id === entry.id));
      const month = existingMonth || monthYear;
      const monthList = Array.isArray(current[month]) ? current[month] : [];
      const existing = monthList.find((item) => item?.id === entry.id);
      const savedEntry = { ...existing, ...entry, timestamp: existing?.timestamp || entry.timestamp || new Date().toISOString() };
      const updated = { ...current, [month]: [savedEntry, ...monthList.filter((item) => item?.id !== entry.id)] };
      localStorage.setItem(STORAGE_KEYS.auditLogs, JSON.stringify(updated));

      const reference = savedEntry.caseNumber || savedEntry.id;
      if (!existing) recordActivity('Proceedings created', { recordId: savedEntry.id, reference, status: savedEntry.status });
      else if (entry.status && entry.status !== existing.status) recordActivity('Proceedings status updated', { recordId: savedEntry.id, reference, status: savedEntry.status });
      else if (entry.documentContent !== undefined && entry.documentContent !== existing.documentContent) recordActivity('Proceedings updated', { recordId: savedEntry.id, reference, status: savedEntry.status });
      globalThis.window?.dispatchEvent(new Event(APP_EVENTS.auditLogsUpdated));
      return updated;
    } catch (error) {
      console.warn('Failed to save audit log:', error);
      return null;
    }
  },

  normalizePipelineResult(data, filename) {
    const entities = data.entities || EMPTY_ENTITIES;
    return {
      success: true,
      filename,
      fileType: filename.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf',
      entities,
      validation_insights: data.validation_insights || EMPTY_VALIDATION,
      bounding_boxes: data.bounding_boxes || [],
      rawOcrText: data.raw_ocr_text || '',
      generated_docx_filename: data.generated_docx_filename || '',
    };
  },
};
