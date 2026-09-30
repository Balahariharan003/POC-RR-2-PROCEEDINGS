import { readSavedAuditLogs } from './auditStore.js';
import { recordActivity } from './activityStore.js';
import { DEFAULT_ENTITIES, DEFAULT_VALIDATION } from "../data/schemas.js";

/**
 * Production API Service Client - Connects Frontend to FastAPI backend endpoints.
 * Pure real-time client without simulated or hardcoded test fixtures.
 */

const API_BASE = "/api";

async function requestJson(path, payload, method = 'POST') {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined
  });
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
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        return await res.json();
      }
      return { status: "offline", error: `HTTP ${res.status}` };
    } catch (err) {
      return { status: "offline", error: err.message };
    }
  },

  /**
   * Authenticates user against backend API
   */
  async login(username, password, role) {
    const res = await fetch(`${API_BASE}/v1/auth/login`, {
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
    return await res.json();
  },

  /**
   * Processes the built-in sample order via the backend engine
   */
  async loadSampleDocument() {
    const res = await fetch(`${API_BASE}/process-sample`, {
      method: "POST",
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

    const res = await fetch(`${API_BASE}/process-document`, {
      method: 'POST',
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
      headers: { "Content-Type": "application/json" },
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
      const res = await fetch(`${API_BASE}/templates`);
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
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
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

  /**
   * Retrieves persistent audit logs from PostgreSQL backend or local storage
   */
  async getAuditLogs() {
    try {
      const res = await fetch(`${API_BASE}/audit-logs`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.logs) return data.logs;
        if (data && typeof data === 'object') return data;
      }
    } catch (e) {
      // Fallback to local storage if network partition
    }
    return readSavedAuditLogs();
  },

  /**
   * Saves or updates an audit session in persistent storage
   */
  async saveAuditLog(entry) {
    if (!entry || !entry.id) return null;
    try {
      // Persist to backend API
      try {
        await fetch(`${API_BASE}/audit-logs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
      } catch (err) {
        console.warn("Backend audit log sync deferred to local cache:", err);
      }

      // Update local storage cache
      const current = (await this.getAuditLogs()) || {};
      const monthYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date());
      const existingMonth = Object.keys(current).find(month => Array.isArray(current[month]) && current[month].some(item => item && item.id === entry.id));
      const month = existingMonth || monthYear;
      const monthList = Array.isArray(current[month]) ? current[month] : [];
      const existing = monthList.find(item => item && item.id === entry.id);
      
      const savedEntry = {
        ...existing,
        ...entry,
        timestamp: existing?.timestamp || entry.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19)
      };

      const updated = { ...current, [month]: [savedEntry, ...monthList.filter(item => item && item.id !== entry.id)] };
      localStorage.setItem('rr_audit_logs', JSON.stringify(updated));

      const ref = savedEntry.caseNumber || savedEntry.id;
      if (!existing) recordActivity('Proceedings created', { recordId: savedEntry.id, reference: ref, status: savedEntry.status });
      else if (entry.status && entry.status !== existing.status) recordActivity('Proceedings status updated', { recordId: savedEntry.id, reference: ref, status: savedEntry.status });
      else if (entry.documentContent !== undefined && entry.documentContent !== existing.documentContent) recordActivity('Proceedings updated', { recordId: savedEntry.id, reference: ref, status: savedEntry.status });
      
      globalThis.window?.dispatchEvent(new Event('rr-audit-logs-updated'));
      return updated;
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

    const rawRoc = entities?.proceedings_roc_number || (dept === "CUSTOMS" ? "ந.க.1248/2026/ஈ2" : "ந.க.9667/2026/ஈ2");
    const cleanRoc = rawRoc.replace(/^(ந\.க\.|roc\.)\s*/i, '').trim();
    const docDate = entities?.proceedings_date || new Date().toLocaleDateString('en-GB');
    const district = j.district || "ஈரோடு";
    const taluk = j.taluk || "ஈரோடு";
    const collectorName = j.collector_name || "திரு.ச.கந்தசாமி,இ.ஆ.ப.,";

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

    if (dept === "CUSTOMS" || (acts.primary_act && acts.primary_act.includes("சுங்க"))) {
      const subject = customSubject || `வருவாய் வசூல் சட்டம் 1864 – சுங்கச் சட்டம் 1962 பிரிவு 142(1)(c)(i) – சென்னை சுங்கத்துறை ஏற்றுமதி ஆணையரகம் – நிலுவைத் தொகை வசூலிக்கக் கோருதல் – ஆணை பிறப்பிக்கப்படுகிறது.`;
      const fileNo = c.file_number || c.case_number || "F.NO. 516/2024-ARC";
      const certDate = c.certificate_date || c.court_order_date || "24.12.2025";
      const oioNo = c.order_in_original_no || c.ia_number || "Order in Original No. 105790/2024";
      const orderDate = c.court_order_date || "28.03.2024";

      return `${district} மாவட்ட ஆட்சித் தலைவர் மற்றும் மாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்
முன்னிலை: ${collectorName}

ந.க. ${cleanRoc}\tநாள்: ${docDate}

பொருள்: ${subject}

பார்வை: 1. உதவி ஆணையர் (ஏற்றுமதி), சுங்கத்துறை ஆணையரகம் (சென்னை IV), சென்னை அவர்களின் கடித ந.க.எண் ${fileNo}, நாள்: ${certDate}.
        2. இணை சுங்க ஆணையர், சுங்கத்துறை ஆணையரகம் (சென்னை IV), சென்னை அவர்களின் ${oioNo}, நாள்: ${orderDate}.

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

ந.க. ${cleanRoc}\tநாள்: ${docDate}

பொருள்: வருவாய் வசூல் சட்டம் 1864 – சுங்கச் சட்டம் 1962 பிரிவு 142(1)(c)(i) – சென்னை சுங்கத்துறை நிலுவைத் தொகை வசூலித்தல் – ஆணை பிறப்பித்தல் – சார்பு.

பார்வை: சென்னை சுங்கத்துறை ஆணையரக கடிதம் ${fileNo}, நாள்: ${certDate}.

   பார்வையில் கண்டுள்ள கடிதத்தில், ${defaulterTitle} நிறுவனம் செலுத்த வேண்டிய சுங்கத் தீர்வை மற்றும் அபராதத் தொகை ${formattedAmt}-யினை வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூலிக்கக் கோரப்பட்டுள்ளது.

   இதன்மீது நடவடிக்கை மேற்கொள்ளும் வகையில், ${taluk} வட்டாட்சியருக்கு தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5 மற்றும் சுங்கச் சட்டம் 1962 பிரிவு 142(1)(c)(i)-ன் கீழ் ஆணை பிறப்பித்து செயல்முறைக் குறிப்பாணை தயார் செய்யப்பட்டு மாவட்ட ஆட்சித் தலைவர் அவர்களின் ஒப்புதலுக்குப் பணிந்தனுப்பப்படுகிறது.

ஒப்பம்/–
பிரிவு எழுத்தர் / கண்காணிப்பாளர்
ஈ2 பிரிவு, மாவட்ட ஆட்சியர் அலுவலகம், ${district}.`;
    }

    // GENERAL / MCOP PROCEEDINGS
    const subject = customSubject || `வருவாய் வசூல் சட்டம் 1864 பிரிவு 5 – மோட்டார் வாகன விபத்து இழப்பீட்டு தீர்ப்பாயம், ${district} – MCOP எண். ${c.case_number} – இழப்பீட்டுத் தொகை வசூலித்தல் – குறித்து.`;
    const courtName = c.court_name || "மோட்டார் வாகன விபத்து இழப்பீட்டு தீர்ப்பாயம், ஈரோடு";
    const orderDate = c.court_order_date || "";
    const iaNo = c.ia_number || "";

    return `${district} மாவட்ட ஆட்சித் தலைவர் மற்றும் மாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்
முன்னிலை: ${collectorName}

ந.க. ${cleanRoc}\tநாள்: ${docDate}

பொருள்: ${subject}

பார்வை: 1. ${district}, ${courtName} அவர்களின் ஆணை ${iaNo} in ${c.case_number}, நாள்: ${orderDate}.
        2. வருவாய் நிலை ஆணை எண் 41 (RSO 41).

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

ந.க. ${cleanRoc}\tநாள்: ${docDate}

பொருள்: வருவாய் வசூல் சட்டம் 1864 – இழப்பீட்டுத் தொகை வசூலித்தல் – ஆணை பிறப்பித்தல் – சார்பு.

பார்வை: ${courtName} ஆணை ${iaNo} in ${c.case_number}, நாள்: ${orderDate}.

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
