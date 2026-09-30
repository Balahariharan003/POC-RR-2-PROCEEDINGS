import { readSavedAuditLogs } from './auditStore.js';
import { recordActivity } from './activityStore.js';
import { APP_CONFIG, APP_EVENTS, EMPTY_ENTITIES, EMPTY_VALIDATION, STORAGE_KEYS } from '../config/appConfig.js';

const API_BASE = APP_CONFIG.apiBaseUrl || '/api';
const API_V1 = `${API_BASE}/v1`;

const authHeaders = (customHeaders = {}) => {
  const token =
    globalThis.sessionStorage?.getItem(STORAGE_KEYS?.authToken || 'rr_access_token') ||
    globalThis.localStorage?.getItem('rr_access_token');
  const headers = { ...customHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

async function errorMessage(response, fallback) {
  try {
    const text = await response.text();
    try {
      const value = JSON.parse(text);
      return value.detail || value.error || fallback;
    } catch {
      return text || fallback;
    }
  } catch {
    return fallback;
  }
}

async function requestJson(path, payload, method = 'POST') {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : '/' + path}`;
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: payload === undefined || payload === null ? undefined : JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await errorMessage(response, `Server request failed (${response.status})`));
  return response.json();
}

function assertExportSignature(bytes, format) {
  const signature = new Uint8Array(bytes.slice(0, 5));
  const valid =
    format === 'docx'
      ? signature[0] === 0x50 && signature[1] === 0x4b
      : String.fromCharCode(...signature) === '%PDF-';
  if (!valid) throw new Error(`The server returned an invalid ${format.toUpperCase()} file.`);
}

function triggerDownload(bytes, format, filename, contentType) {
  const blob = new Blob([bytes], { type: contentType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename.replace(/\.[^/.]+$/, '')}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), APP_CONFIG.timeouts?.downloadUrlRevokeMs || 60000);
}

export const apiService = {
  // --- Token Management ---
  setToken(token) {
    if (token) {
      globalThis.sessionStorage?.setItem(STORAGE_KEYS?.authToken || 'rr_access_token', token);
    } else {
      globalThis.sessionStorage?.removeItem(STORAGE_KEYS?.authToken || 'rr_access_token');
    }
  },

  getToken() {
    return (
      globalThis.sessionStorage?.getItem(STORAGE_KEYS?.authToken || 'rr_access_token') ||
      globalThis.localStorage?.getItem('rr_access_token')
    );
  },

  // --- Health & Readiness ---
  async checkHealth() {
    try {
      const response = await fetch(`${API_V1}/health`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(APP_CONFIG.timeouts?.healthMs || 10000),
      });
      return response.ok ? response.json() : { status: 'offline', error: `HTTP ${response.status}` };
    } catch (error) {
      return { status: 'offline', error: error.message };
    }
  },

  // --- Authentication ---
  async login(username, password, role) {
    const response = await fetch(`${API_V1}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username_or_email: username, password, role }),
    });
    if (!response.ok) throw new Error(await errorMessage(response, 'Invalid username or password'));
    const result = await response.json();
    if (!result.access_token || !result.user) throw new Error('The server returned an incomplete login response.');
    this.setToken(result.access_token);
    return result;
  },

  async logout() {
    try {
      await fetch(`${API_V1}/auth/logout`, { method: 'POST', headers: authHeaders() });
    } catch {
      // Local sign-out still completes when the server is unavailable
    } finally {
      this.setToken(null);
    }
  },

  // --- Users API ---
  async getUsers() {
    try {
      const response = await fetch(`${API_V1}/users/`, { headers: authHeaders() });
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.warn('Unable to fetch users from backend:', error);
      return [];
    }
  },

  async createUser(userData) {
    return requestJson(`${API_V1}/users/`, userData, 'POST');
  },

  async updateUser(userId, userData) {
    return requestJson(`${API_V1}/users/${userId}`, userData, 'PUT');
  },

  async deleteUser(userId) {
    return requestJson(`${API_V1}/users/${userId}`, null, 'DELETE');
  },

  // --- Document Templates API ---
  async getTemplates() {
    try {
      const response = await fetch(`${API_V1}/templates/`, { headers: authHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : data.templates || [];
    } catch (error) {
      console.warn('Unable to fetch templates:', error);
      return [];
    }
  },

  async createTemplate(templateData) {
    return requestJson(`${API_V1}/templates/`, templateData, 'POST');
  },

  async updateTemplate(code, templateData) {
    return requestJson(`${API_V1}/templates/${encodeURIComponent(code)}`, templateData, 'PUT');
  },

  async deleteTemplate(code) {
    return requestJson(`${API_V1}/templates/${encodeURIComponent(code)}`, null, 'DELETE');
  },

  // --- Document Upload & Processing Pipeline ---
  async uploadDocument(file, templateCode = '') {
    const body = new FormData();
    body.append('file', file);
    if (templateCode) body.append('template_code', templateCode);
    const response = await fetch(`${API_BASE}/process-document`, {
      method: 'POST',
      headers: authHeaders(),
      body,
      signal: AbortSignal.timeout(APP_CONFIG.timeouts?.documentProcessingMs || 120000),
    });
    if (!response.ok) throw new Error(await errorMessage(response, `Document processing failed (${response.status})`));
    return this.normalizePipelineResult(await response.json(), file?.name || 'document');
  },

  async processDocumentV1(file, departmentType = 'CUSTOMS', templateCode = null) {
    const body = new FormData();
    body.append('file', file);
    body.append('department_type', departmentType);
    if (templateCode) body.append('template_code', templateCode);
    const response = await fetch(`${API_V1}/pipeline/process`, {
      method: 'POST',
      headers: authHeaders(),
      body,
    });
    if (!response.ok) throw new Error(await errorMessage(response, `Processing failed (${response.status})`));
    return await response.json();
  },

  async recalculateFinance(data) {
    return requestJson(`${API_V1}/pipeline/recalculate`, data, 'POST');
  },

  async queryLegalChat(query, caseContext = null) {
    return requestJson(`${API_V1}/pipeline/chat`, { query, case_context: caseContext }, 'POST');
  },

  async downloadGeneratedDocument(filename, format = 'docx') {
    const response = await fetch(`${API_V1}/pipeline/download/${encodeURIComponent(filename)}?format=${format}`, {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error(await errorMessage(response, 'Download failed.'));
    const bytes = await response.arrayBuffer();
    triggerDownload(bytes, format, filename, response.headers.get('content-type') || undefined);
  },

  // --- Template Document Editor APIs ---
  async getDocumentLayout(filename) {
    return requestJson(`/editor/${encodeURIComponent(filename)}`, null, 'GET');
  },

  async reviseDocument(layout, edits, instruction) {
    const result = await requestJson('/editor/revise', {
      filename: layout.filename,
      revision: layout.revision,
      edits,
      instruction,
    });
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

  // --- System Backup, Restore & Analytics Reports ---
  async createDatabaseBackup() {
    return requestJson(`${API_V1}/system/backup`, null, 'POST');
  },

  async restoreDatabaseBackup(backupData) {
    return requestJson(`${API_V1}/system/restore`, backupData, 'POST');
  },

  async getSystemAnalyticsReport() {
    return requestJson(`${API_V1}/system/report`, null, 'GET');
  },

  async exportSystemReportDocx(reportData = null) {
    const response = await fetch(`${API_V1}/system/report/export-docx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(reportData || {}),
    });
    if (!response.ok) throw new Error(await errorMessage(response, 'Report DOCX export failed'));
    const bytes = await response.arrayBuffer();
    triggerDownload(bytes, 'docx', `TN_RR_Proceedings_Report_${new Date().toISOString().slice(0, 10)}`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  },

  // --- Audit Logs ---
  async getAuditLogs() {
    return readSavedAuditLogs();
  },

  async fetchBackendAuditLogs(limit = 100, verifyChain = true) {
    try {
      const response = await fetch(`${API_V1}/audit/?limit=${limit}&verify_chain=${verifyChain}`, {
        headers: authHeaders(),
      });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : data.logs || [];
    } catch (error) {
      console.warn('Backend audit logs fetch failed:', error);
      return [];
    }
  },

  async verifyAuditEntry(logId) {
    return requestJson(`${API_V1}/audit/verify/${logId}`, null, 'POST');
  },

  async saveAuditLog(entry) {
    if (!entry?.id) return null;
    try {
      const current = (await this.getAuditLogs()) || {};
      const monthYear = new Intl.DateTimeFormat(APP_CONFIG.locale || 'en-US', {
        month: 'long',
        year: 'numeric',
      }).format(new Date());
      const existingMonth = Object.keys(current).find(
        (month) => Array.isArray(current[month]) && current[month].some((item) => item?.id === entry.id)
      );
      const month = existingMonth || monthYear;
      const monthList = Array.isArray(current[month]) ? current[month] : [];
      const existing = monthList.find((item) => item?.id === entry.id);
      const savedEntry = {
        ...existing,
        ...entry,
        timestamp: existing?.timestamp || entry.timestamp || new Date().toISOString(),
      };
      const updated = { ...current, [month]: [savedEntry, ...monthList.filter((item) => item?.id !== entry.id)] };
      localStorage.setItem(STORAGE_KEYS.auditLogs, JSON.stringify(updated));

      const reference = savedEntry.caseNumber || savedEntry.id;
      if (!existing) {
        recordActivity('Proceedings created', { recordId: savedEntry.id, reference, status: savedEntry.status });
      } else if (entry.status && entry.status !== existing.status) {
        recordActivity('Proceedings status updated', { recordId: savedEntry.id, reference, status: savedEntry.status });
      } else if (entry.documentContent !== undefined && entry.documentContent !== existing.documentContent) {
        recordActivity('Proceedings updated', { recordId: savedEntry.id, reference, status: savedEntry.status });
      }
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
