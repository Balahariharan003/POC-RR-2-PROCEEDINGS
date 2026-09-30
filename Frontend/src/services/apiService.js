import { recordActivity } from './activityStore.js';
import { DEFAULT_ENTITIES, DEFAULT_VALIDATION } from "../data/schemas.js";

/**
 * Production API Service Client - Connects Frontend to FastAPI backend endpoints.
 * All auth via JWT Bearer tokens. No localStorage fallbacks. No hardcoded credentials.
 */

const API_BASE = "/api";
const API_V1 = "/api/v1";

// --- JWT Token Management ---
let _accessToken = null;

function getSessionStorage() {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
    if (typeof globalThis !== 'undefined' && globalThis.sessionStorage) return globalThis.sessionStorage;
    if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
  } catch {}
  return null;
}

function setToken(token) {
  _accessToken = token;
  const store = getSessionStorage();
  if (store) {
    if (token) store.setItem('rr_access_token', token);
    else store.removeItem('rr_access_token');
  }
}

function getToken() {
  if (_accessToken) return _accessToken;
  const store = getSessionStorage();
  if (store) {
    _accessToken = store.getItem('rr_access_token');
  }
  return _accessToken;
}

function clearToken() {
  _accessToken = null;
  const store = getSessionStorage();
  if (store) store.removeItem('rr_access_token');
}

function authHeaders() {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function authHeadersNoBody() {
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// --- Core Request Helpers ---

async function requestJson(path, payload, method = 'POST', useV1 = false) {
  const base = useV1 ? API_V1 : API_BASE;
  const res = await fetch(`${base}${path}`, {
    method,
    headers: authHeaders(),
    body: payload ? JSON.stringify(payload) : undefined
  });
  if (res.status === 401) {
    clearToken();
    throw new Error('Session expired. Please sign in again.');
  }
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Server request failed (${res.status}): ${errorText}`);
  }
  return res.json();
}

async function requestGet(path, useV1 = false) {
  const base = useV1 ? API_V1 : API_BASE;
  const res = await fetch(`${base}${path}`, {
    method: 'GET',
    headers: authHeadersNoBody()
  });
  if (res.status === 401) {
    clearToken();
    throw new Error('Session expired. Please sign in again.');
  }
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Server request failed (${res.status}): ${errorText}`);
  }
  return res.json();
}


export const apiService = {
  /**
   * Checks health and connectivity of FastAPI backend
   */
  async checkHealth() {
    try {
      const res = await fetch(`${API_V1}/health`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        return await res.json();
      }
      return { status: "offline", error: `HTTP ${res.status}` };
    } catch (err) {
      return { status: "offline", error: err.message };
    }
  },

  /**
   * Authenticates user against backend API and stores JWT token
   */
  async login(username, password, role) {
    const res = await fetch(`${API_V1}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username_or_email: username, password, role })
    });
    if (!res.ok) {
      let msg = "Invalid username or password";
      try {
        const errorData = await res.json();
        if (errorData.detail) msg = errorData.detail;
        else if (errorData.error) msg = errorData.error;
      } catch (e) {}
      throw new Error(msg);
    }
    const data = await res.json();
    // Store JWT token and user from backend response
    if (data.access_token) {
      setToken(data.access_token);
    }
    const store = getSessionStorage();
    if (data.user && store) {
      store.setItem('rr_user', JSON.stringify(data.user));
    }
    return data;
  },

  /**
   * Returns current signed in user from session
   */
  getCurrentUser() {
    try {
      const store = getSessionStorage();
      const saved = store ? store.getItem('rr_user') : null;
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  },

  /**
   * Logs out and clears JWT token
   */
  logout() {
    clearToken();
    const store = getSessionStorage();
    if (store) store.removeItem('rr_user');
  },

  /**
   * Returns whether a valid token exists
   */
  isAuthenticated() {
    return Boolean(getToken());
  },

  /**
   * Processes the built-in sample order via the backend engine
   */
  async loadSampleDocument() {
    const res = await fetch(`${API_BASE}/process-sample`, {
      method: "POST",
      headers: authHeadersNoBody(),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      throw new Error(`Server failed to process sample (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    return this._normalizePipelineResult(data, "sample_document.pdf");
  },

  /**
   * Uploads and processes a petition/recovery order document through the 5-step pipeline
   */
  async uploadDocument(file, templateCode = '') {
    const formData = new FormData();
    formData.append('file', file);
    if (templateCode) formData.append('template_code', templateCode);

    const headers = {};
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/process-document`, {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(90000)
    });
    if (!res.ok) {
      throw new Error(`Document processing failed (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    return this._normalizePipelineResult(data, file?.name || 'scanned_document.pdf');
  },

  /**
   * Re-generates proceedings DOCX when officer edits form fields
   */
  async regenerateDocument(entities) {
    const res = await fetch(`${API_BASE}/regenerate-document`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(entities),
    });

    if (!res.ok) {
      throw new Error(`Failed to regenerate proceedings: ${await res.text()}`);
    }

    return await res.json();
  },

  /**
   * Retrieves proceedings templates from PostgreSQL backend
   */
  async getTemplates() {
    try {
      const res = await fetch(`${API_V1}/templates`, {
        headers: authHeadersNoBody()
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : (data.templates || []);
      }
    } catch (err) {
      console.warn("Unable to fetch remote templates:", err);
    }
    return [];
  },

  /**
   * Re-generates proceedings DOCX when officer supplies natural language prompt
   */
  async regenerateWithPrompt(prompt, entities, subject) {
    return requestJson('/regenerate-with-prompt', { prompt, entities, subject });
  },

  /**
   * Modifies official document content based on Section Officer's natural language instruction
   */
  async modifyContent(content, instruction) {
    const res = await fetch(`${API_BASE}/modify-content`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ content, instruction }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.content || content;
    }
    throw new Error(`Content modification failed: ${await res.text()}`);
  },

  /**
   * Exports document content as official Word .docx with TAU-Marutham font
   */
  async exportDocx(content, filename = "Official_Proceedings.docx") {
    const res = await fetch(`${API_BASE}/export-docx`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ content, filename }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.download_url) {
        window.location.href = data.download_url;
        return;
      }
    }
    throw new Error(`DOCX export failed: ${await res.text()}`);
  },

  /**
   * Returns download URL for generated DOCX
   */
  getDownloadUrl(filename) {
    return `${API_BASE}/download/${filename}`;
  },

  /**
   * Returns download URL for layout-identical PDF
   */
  getPdfDownloadUrl(filename) {
    return `${API_BASE}/download-pdf/${filename}`;
  },

  /**
   * Records order submission to the Tamil Nadu DRO Grievance Portal
   */
  async dispatchToDRO(payload) {
    return requestJson('/dispatch-dro', payload);
  },

  /**
   * RAG Natural Language Legal Co-Pilot Query
   */
  async askRAGChat(query, context) {
    return requestJson('/chat', { query, context });
  },

  // ---- Users API (connected to backend /api/v1/users) ----

  /**
   * Fetches all users from backend database
   */
  async getUsers() {
    return requestGet('/users', true);
  },

  /**
   * Creates a new user via backend API
   */
  async createUser(userData) {
    return requestJson('/users', userData, 'POST', true);
  },

  /**
   * Updates a user via backend API
   */
  async updateUser(userId, userData) {
    return requestJson(`/users/${userId}`, userData, 'PUT', true);
  },

  /**
   * Deletes a user via backend API
   */
  async deleteUser(userId) {
    return requestJson(`/users/${userId}`, null, 'DELETE', true);
  },

  // ---- System Administration & Backup API (connected to backend /api/v1/system) ----

  /**
   * Creates a full PostgreSQL cryptographic database backup
   */
  async createDatabaseBackup() {
    return requestJson('/system/backup', {}, 'POST', true);
  },

  /**
   * Restores database tables from a verified backup payload
   */
  async restoreDatabaseBackup(payload) {
    return requestJson('/system/restore', payload, 'POST', true);
  },

  /**
   * Retrieves live consolidated system analytics & proceedings particulars
   */
  async getSystemAnalyticsReport() {
    return requestGet('/system/report', true);
  },

  /**
   * Exports official proceedings analytics report as DOCX
   */
  async exportSystemReportDocx(reportData) {
    const res = await fetch(`${API_V1}/system/report/export-docx`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(reportData || {}),
    });
    if (!res.ok) {
      throw new Error(`Report export failed (${res.status}): ${await res.text()}`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RR_Proceedings_Report_${new Date().toISOString().slice(0, 10)}.docx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    return true;
  },

  // ---- Templates API (connected to backend /api/v1/templates) ----

  /**
   * Fetches all document templates
   */
  async getTemplates() {
    return requestGet('/templates', true);
  },

  /**
   * Creates a new document template
   */
  async createTemplate(templateData) {
    return requestJson('/templates', templateData, 'POST', true);
  },

  /**
   * Updates an existing document template
   */
  async updateTemplate(code, templateData) {
    return requestJson(`/templates/${code}`, templateData, 'PUT', true);
  },

  /**
   * Deletes a template by code
   */
  async deleteTemplate(code) {
    return requestJson(`/templates/${code}`, null, 'DELETE', true);
  },


  // ---- Audit API (connected to backend /api/v1/audit) ----

  /**
   * Retrieves audit logs from PostgreSQL backend
   */
  async getAuditLogs() {
    try {
      const data = await requestGet('/audit/logs', true);
      if (Array.isArray(data)) {
        // Group by month-year for frontend display
        const grouped = {};
        for (const log of data) {
          const details = (log.details && typeof log.details === 'object') ? log.details : {};
          const normalizedLog = {
            id: String(log.id),
            action: log.action,
            signature: log.signature,
            timestamp: log.timestamp || details.timestamp || new Date().toISOString(),
            caseNumber: details.caseNumber || details.case_no || log.file_id || 'RR-PROC-2026',
            orderId: details.orderId || details.case_no || log.file_id || log.id,
            defaulter: details.defaulter || details.defaulterName || 'Defaulter',
            defaulterName: details.defaulterName || details.defaulter || 'Defaulter',
            amount: details.amount ?? details.total_amount ?? 0,
            taluk: details.taluk || 'Erode',
            district: details.district || 'Erode',
            status: details.status || (log.action === 'DISPATCHED_TO_DRO' ? 'DISPATCHED' : 'VERIFIED'),
            officerName: details.officerName || log.user_id || 'District Collector / DRO Erode',
            officerId: details.officerId || log.user_id || 'OFF-ADMIN-001',
            fileName: details.fileName || log.file_id || 'proceedings.pdf',
            documentContent: details.documentContent || '',
            promptHistory: details.promptHistory || [],
            ...details
          };
          const date = normalizedLog.timestamp ? new Date(normalizedLog.timestamp) : new Date();
          const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          if (!grouped[monthYear]) grouped[monthYear] = [];
          grouped[monthYear].push(normalizedLog);
        }
        return grouped;
      }
      if (data && data.logs) return data.logs;
      if (data && typeof data === 'object') return data;
      return {};
    } catch (e) {
      console.warn("Unable to load audit logs from backend:", e);
      return {};
    }
  },

  /**
   * Saves or updates an audit session in persistent storage
   */
  async saveAuditLog(entry) {
    if (!entry || !entry.id) return null;
    try {
      await requestJson('/audit/logs', entry, 'POST', true);

      const ref = entry.caseNumber || entry.id;
      recordActivity('Proceedings created', { recordId: entry.id, reference: ref, status: entry.status });

      globalThis.window?.dispatchEvent(new Event('rr-audit-logs-updated'));
      return await this.getAuditLogs();
    } catch (e) {
      console.warn("Failed to save audit log:", e);
      return null;
    }
  },

  /**
   * Formats full Tamil text preview sheet matching official government style
   */
  formatDocumentSheet(entities, customSubject) {
    if (!entities?.case_details?.case_number) return '';
    const d = entities?.defaulter || {};
    const f = entities?.financials || {};
    const j = entities?.jurisdiction || {};
    const c = entities?.case_details || {};
    const b = entities?.beneficiary || {};
    const acts = entities?.legal_acts || {};

    const dept = entities?.department_type || (
      (acts.primary_act && acts.primary_act.includes("சுங்க")) || (c.court_name && c.court_name.includes("சுங்க")) ? "CUSTOMS" : "MCOP"
    );

    const isCompany = entities?.entity_type === "COMPANY" || (!d.father_or_husband_name && (d.iec_number || (d.name && (d.name.includes("M/s") || d.name.includes("Ltd") || d.name.includes("Garments")))));

    const rawRoc = entities?.proceedings_roc_number || "";
    const cleanRoc = rawRoc.replace(/^(ந\.க\.|roc\.)\s*/i, '').trim() || "—";
    const docDate = entities?.proceedings_date || new Date().toLocaleDateString('en-GB');
    const district = j.district || "";
    const taluk = j.taluk || "";
    const collectorName = j.collector_name || "";

    const principal = Number(f.principal_amount || 0);
    const penalty = Number(f.penalty_amount || 0);
    const reportedTotal = Number(f.total_recoverable_amount || 0);
    const total = reportedTotal > 0 ? reportedTotal : principal + penalty;

    const formattedAmt = f.formatted_amount || `ரூ.${total.toLocaleString('en-IN')}/-`;
    const amtWords = f.amount_in_words_tamil || `ரூபாய் ${total.toLocaleString('en-IN')} மட்டும்`;

    const defaulterTitle = isCompany ? d.name : (d.name?.startsWith("திரு") ? d.name : `திரு.${d.name}`);
    const defaulterParentage = (!isCompany && d.father_or_husband_name) ? `, ${d.father_or_husband_name}` : "";

    const addrParts = [];
    if (d.door_no) addrParts.push(`கதவு எண்.${d.door_no}`);
    if (d.street_area) addrParts.push(d.street_area);
    if (d.village) addrParts.push(d.village);
    if (d.taluk) addrParts.push(`${d.taluk} வட்டம்`);
    if (d.district) addrParts.push(`${d.district} மாவட்டம்`);
    if (d.pincode) addrParts.push(`- ${d.pincode}`);
    const defaulterAddrStr = addrParts.join(", ") || (d.full_address || `${taluk}, ${district}`);

    // Dynamic multi-reference resolution
    let refItems = [];
    if (Array.isArray(entities?.references) && entities.references.length > 0) {
      refItems = entities.references;
    } else if (Array.isArray(entities?.reference_details?.references_list) && entities.reference_details.references_list.length > 0) {
      refItems = entities.reference_details.references_list;
    }

    if (dept === "CUSTOMS" || (acts.primary_act && acts.primary_act.includes("சுங்க"))) {
      const subject = customSubject || `வருவாய் வசூல் சட்டம் 1864 – சுங்கச் சட்டம் 1962 பிரிவு 142(1)(c)(i) – சென்னை சுங்கத்துறை ஏற்றுமதி ஆணையரகம் – நிலுவைத் தொகை வசூலிக்கக் கோருதல் – ஆணை பிறப்பிக்கப்படுகிறது.`;
      const fileNo = c.file_number || c.case_number || "";
      const certDate = c.certificate_date || c.court_order_date || "";
      const oioNo = c.order_in_original_no || c.ia_number || "";
      const orderDate = c.court_order_date || "";

      if (refItems.length === 0) {
        if (fileNo || certDate) {
          refItems.push(`உதவி ஆணையர் (ஏற்றுமதி), சுங்கத்துறை ஆணையரகம் (சென்னை IV), சென்னை அவர்களின் கடித ந.க.எண் ${fileNo}, நாள்: ${certDate}.`);
        }
        if (oioNo) {
          refItems.push(`Order in Original No: ${oioNo}, நாள்: ${orderDate}.`);
        }
        refItems.push(`தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 மற்றும் வருவாய் நிலை ஆணை எண் 41 (RSO 41).`);
      }

      const cleanedRefs = refItems
        .map(r => String(r).replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(Boolean)
        .map((r, i) => `${i + 1}. ${r}`);
      const parvaiBlock = cleanedRefs.length > 0
        ? `பார்வை:\n${cleanedRefs.map(r => `        ${r}`).join('\n')}`
        : `பார்வை: —`;

      return `${district} மாவட்ட ஆட்சித் தலைவர் மற்றும் மாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்
முன்னிலை: ${collectorName}

ந.க. ${cleanRoc}\t\t\t\t\t\tநாள்: ${docDate}

பொருள்: ${subject}

${parvaiBlock}

உத்தரவு:
   பார்வை 1-ல் காணும் சென்னை, சுங்கத்துறை ஆணையரகம் (சென்னை IV), உதவி ஆணையர் (ஏற்றுமதி) அவர்களின் கடிதத்தில், ${taluk} வட்டம், ${defaulterAddrStr} என்ற முகவரியில் இயங்கி வரும் ${defaulterTitle}${d.iec_number ? ` (IEC No: ${d.iec_number})` : ""} என்ற நிறுவனம் சுங்கச் சட்டம் 1962-ன்படி அரசுக்குச் செலுத்த வேண்டிய நிலுவைத் தொகை ${formattedAmt} (${amtWords})-யினை தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன்படி வசூலித்துத் தருமாறு கோரப்பட்டுள்ளது.

   எனவே, தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5 மற்றும் சுங்கச் சட்டம் 1962 பிரிவு 142(1)(c)(i)-ன் கீழ் வழங்கப்பட்டுள்ள அதிகாரத்தின்படி, மேற்படி நிறுவனத்திடமிருந்து அரசுக்குச் சேர வேண்டிய நிலுவைத் தொகையான ${formattedAmt} மற்றும் அதற்குரிய வட்டியினை உடனடியாக வசூலித்து "Commissioner of Customs, Export Commissionerate, Chennai IV" என்ற பெயரில் வங்கி வரைவோலையாக (Demand Draft - Head of Account: 037 - Customs) பெற்று இவ்வலுவலகத்திற்கு அனுப்பி வைக்குமாறு ${taluk} வட்டாட்சியர் அவர்களுக்கு உத்தரவிடப்படுகிறது.

இணைப்பு: கடித நகல்

\t\t\t\t\t\tமாவட்ட ஆட்சித் தலைவர்,
\t\t\t\t\t\t${district}.

பெறுநர்:
1. வருவாய் வட்டாட்சியர், ${taluk}.
2. வருவாய் கோட்டாட்சியர், ${taluk}.

நகல் :
1. உதவி ஆணையர் (ஏற்றுமதி), சுங்கத்துறை ஆணையரகம் (சென்னை IV), Custom House, No.60, இராஜாஜி சாலை, சென்னை – 600001.
2. ${defaulterTitle}${d.iec_number ? ` (IEC No: ${d.iec_number})` : ""}, ${defaulterAddrStr}.

--------------------------------------------------------------------------------
//அலுவலகக் குறிப்பு//

ந.க. ${cleanRoc}\t\t\t\t\t\tநாள்: ${docDate}

பொருள்: வருவாய் வசூல் சட்டம் 1864 – சுங்கச் சட்டம் 1962 பிரிவு 142(1)(c)(i) – சென்னை சுங்கத்துறை நிலுவைத் தொகை வசூலித்தல் – ஆணை பிறப்பித்தல் – சார்பு.

${parvaiBlock}

   பார்வையில் கண்டுள்ள கடிதத்தில், ${defaulterTitle} நிறுவனம் செலுத்த வேண்டிய சுங்கத் தீர்வை மற்றும் அபராதத் தொகை ${formattedAmt}-யினை வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூலிக்கக் கோரப்பட்டுள்ளது.

   இதன்மீது நடவடிக்கை மேற்கொள்ளும் வகையில், ${taluk} வட்டாட்சியருக்கு தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5 மற்றும் சுங்கச் சட்டம் 1962 பிரிவு 142(1)(c)(i)-ன் கீழ் ஆணை பிறப்பித்து செயல்முறைக் குறிப்பாணை தயார் செய்யப்பட்டு மாவட்ட ஆட்சித் தலைவர் அவர்களின் ஒப்புதலுக்குப் பணிந்தனுப்பப்படுகிறது.

ஒப்பம்/–
பிரிவு எழுத்தர் / கண்காணிப்பாளர்
ஈ2 பிரிவு, மாவட்ட ஆட்சியர் அலுவலகம், ${district}.`;
    }

    // GENERAL / MCOP PROCEEDINGS
    const subject = customSubject || `வருவாய் வசூல் சட்டம் 1864 பிரிவு 5 – மோட்டார் வாகன விபத்து இழப்பீட்டு தீர்ப்பாயம், ${district} – MCOP எண். ${c.case_number} – இழப்பீட்டுத் தொகை வசூலித்தல் – குறித்து.`;
    const courtName = c.court_name || "";
    const orderDate = c.court_order_date || "";
    const iaNo = c.ia_number || "";

    if (refItems.length === 0) {
      if (courtName || c.case_number) {
        refItems.push(`${district}, ${courtName} அவர்களின் ஆணை ${iaNo ? `${iaNo} in ` : ''}${c.case_number}, நாள்: ${orderDate}.`);
      }
      refItems.push(`வருவாய் நிலை ஆணை எண் 41 (RSO 41).`);
    }

    const cleanedRefs = refItems
      .map(r => String(r).replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(Boolean)
      .map((r, i) => `${i + 1}. ${r}`);
    const parvaiBlock = cleanedRefs.length > 0
      ? `பார்வை:\n${cleanedRefs.map(r => `        ${r}`).join('\n')}`
      : `பார்வை: —`;

    return `${district} மாவட்ட ஆட்சித் தலைவர் மற்றும் மாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்
முன்னிலை: ${collectorName}

ந.க. ${cleanRoc}\t\t\t\t\t\tநாள்: ${docDate}

பொருள்: ${subject}

${parvaiBlock}

உத்தரவு:
   பார்வை 1-ல் காணும் நீதிமன்ற ஆணையில், ${taluk} வட்டம், ${defaulterAddrStr} என்ற முகவரியில் வசிக்கும் ${defaulterTitle}${defaulterParentage} என்பவர் மோட்டார் வாகன விபத்து இழப்பீட்டுத் தொகையான ${formattedAmt} (${amtWords})-யினை வழங்கத் தவறியதால், மேற்படி தொகையினை தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன்படி வசூலிக்க உத்தரவிடப்பட்டுள்ளது.

   எனவே, தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வழங்கப்பட்டுள்ள அதிகாரத்தின்படி, எதிர்தரப்பினரின் அசையும் மற்றும் அசையா சொத்துக்களிலிருந்து மேற்படி இழப்பீட்டுத் தொகை ${formattedAmt} மற்றும் உரிய வட்டியினை உடனடியாக வசூலித்து இழப்பீட்டுத் தீர்ப்பாயத்தில் செலுத்துமாறு ${taluk} வட்டாட்சியர் அவர்களுக்கு உத்தரவிடப்படுகிறது.

இணைப்பு: நீதிமன்ற ஆணை நகல்

\t\t\t\t\t\tமாவட்ட ஆட்சித் தலைவர்,
\t\t\t\t\t\t${district}.

பெறுநர்:
1. வருவாய் வட்டாட்சியர், ${taluk}.
2. வருவாய் கோட்டாட்சியர், ${taluk}.

நகல் :
1. ${b.name || "மனுதாரர் / காப்பீட்டு நிறுவனம்"}, ${b.address || district}.
2. ${defaulterTitle}${defaulterParentage}, ${defaulterAddrStr}.

--------------------------------------------------------------------------------
//அலுவலகக் குறிப்பு//

ந.க. ${cleanRoc}\t\t\t\t\t\tநாள்: ${docDate}

பொருள்: வருவாய் வசூல் சட்டம் 1864 – இழப்பீட்டுத் தொகை வசூலித்தல் – ஆணை பிறப்பித்தல் – சார்பு.

${parvaiBlock}

   மேற்படி வழக்கில் தீர்ப்பளிக்கப்பட்ட இழப்பீட்டுத் தொகை ${formattedAmt}-யினை வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூலிக்குமாறு ${taluk} வட்டாட்சியருக்கு செயல்முறைக் குறிப்பாணை பிறப்பிக்க மாவட்ட ஆட்சித் தலைவர் அவர்களின் ஒப்புதலுக்குப் பணிந்தனுப்பப்படுகிறது.

ஒப்பம்/–
பிரிவு எழுத்தர் / கண்காணிப்பாளர்
ஈ2 பிரிவு, மாவட்ட ஆட்சியர் அலுவலகம், ${district}.`;
  },

  /**
   * Normalizes pipeline response from FastAPI backend
   */
  _normalizePipelineResult(data, filename) {
    const entities = data.entities || DEFAULT_ENTITIES;
    const validation = data.validation_insights || DEFAULT_VALIDATION;

    return {
      success: true,
      filename,
      fileType: filename.endsWith('.docx') ? 'docx' : 'pdf',
      entities,
      validation_insights: validation,
      bounding_boxes: data.bounding_boxes || [],
      rawOcrText: data.raw_ocr_text || "",
      generated_docx_filename: data.generated_docx_filename || `proceedings_${(entities?.case_details?.case_number || "Case").replace(/[^a-zA-Z0-9]/g, '_')}.docx`,
    };
  }
};
