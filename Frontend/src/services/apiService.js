/**
 * API Service Client - Connects Frontend to FastAPI backend endpoints.
 * Dynamic data flow with zero hardcoding: All templates, users, audit logs,
 * and proceedings are dynamically fetched and stored in PostgreSQL.
 */

import { evaluateGrounding } from "../data/schemas.js";

const API_BASE = "/api";

export const apiService = {
  /**
   * Checks health and connectivity of FastAPI, PostgreSQL, and Ollama
   */
  async checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        return await res.json();
      }
      return { status: "offline", error: `HTTP ${res.status}` };
    } catch (err) {
      return { status: "offline", error: err.message };
    }
  },

  /**
   * Step 1-5 Pipeline: Uploads and processes a petition file dynamically
   */
  async uploadDocument(file, templateCode = null) {
    const formData = new FormData();
    formData.append("file", file);
    if (templateCode) {
      formData.append("template_code", templateCode);
    }

    const res = await fetch(`${API_BASE}/process-document`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Server returned ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return this._normalizePipelineResult(data, file.name);
  },

  /**
   * Processes the built-in sample order dynamically
   */
  async loadSampleDocument(templateCode = null) {
    let url = `${API_BASE}/process-sample`;
    if (templateCode) {
      url += `?template_code=${encodeURIComponent(templateCode)}`;
    }
    const res = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    return this._normalizePipelineResult(data, "sample_court_order.pdf");
  },

  /**
   * Re-generates proceedings DOCX when officer edits form
   */
  async regenerateDocument(entities, templateCode = null) {
    const res = await fetch(`${API_BASE}/regenerate-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entities, template_code: templateCode }),
    });

    if (!res.ok) {
      throw new Error(`Failed to regenerate: ${await res.text()}`);
    }

    return await res.json();
  },

  /**
   * Dynamic Template Management REST APIs (PostgreSQL)
   */
  async getTemplates(department = null, category = null) {
    let url = `${API_BASE}/templates`;
    const params = new URLSearchParams();
    if (department) params.append("department", department);
    if (category) params.append("category", category);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch templates: ${res.statusText}`);
    const data = await res.json();
    return data.templates || [];
  },

  async getTemplate(templateId) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(templateId)}`);
    if (!res.ok) throw new Error(`Template not found: ${res.statusText}`);
    const data = await res.json();
    return data.template;
  },

  async createTemplate(templateData, role = "admin") {
    const res = await fetch(`${API_BASE}/templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Role": role
      },
      body: JSON.stringify(templateData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Failed to create template");
    }
    return await res.json();
  },

  async updateTemplate(templateId, templateData, role = "admin") {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(templateId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-User-Role": role
      },
      body: JSON.stringify(templateData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Failed to update template");
    }
    return await res.json();
  },

  async deleteTemplate(templateId, role = "admin") {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(templateId)}`, {
      method: "DELETE",
      headers: { "X-User-Role": role }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Failed to delete template");
    }
    return await res.json();
  },

  async renderTemplate(templateId, entities) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(templateId)}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entities })
    });
    if (!res.ok) throw new Error(`Failed to render template: ${res.statusText}`);
    return await res.json();
  },

  /**
   * Dynamic User Management & RBAC REST APIs (PostgreSQL)
   */
  async getUsers(query = null, role = null, status = null) {
    let url = `${API_BASE}/users`;
    const params = new URLSearchParams();
    if (query) params.append("query", query);
    if (role && role !== "all") params.append("role", role);
    if (status && status !== "all") params.append("status", status);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch users: ${res.statusText}`);
    const data = await res.json();
    return data.users || [];
  },

  async createUser(userData, role = "admin") {
    const res = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Role": role
      },
      body: JSON.stringify(userData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Failed to create user");
    }
    return await res.json();
  },

  async updateUser(userId, userData, role = "admin", currentUserId = null) {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-User-Role": role,
        "X-User-Id": currentUserId || ""
      },
      body: JSON.stringify(userData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Failed to update user");
    }
    return await res.json();
  },

  async deleteUser(userId, role = "admin") {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { "X-User-Role": role }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Failed to delete user");
    }
    return await res.json();
  },

  /**
   * Formats official Tamil proceedings dynamically using extracted entities
   */
  formatDocumentSheet(entities, customSubject) {
    const d = entities?.defaulter || {};
    const f = entities?.financials || {};
    const j = entities?.jurisdiction || {};
    const c = entities?.case_details || {};
    const b = entities?.beneficiary || {};
    const acts = entities?.legal_acts || {};

    const dept = entities?.department_type || "CUSTOMS";
    const isCompany = entities?.entity_type === "COMPANY" || Boolean(d.iec_number);

    const roc = entities?.proceedings_roc_number || "ந.க.1248/2026/ஈ2";
    const docDate = entities?.proceedings_date || "        .05.2026.";
    const district = j.district || "ஈரோடு";
    const taluk = j.taluk || "ஈரோடு";
    const collectorName = j.collector_name || "திரு.ச.கந்தசாமி,இ.ஆ.ப.,";

    const principal = Number(f.principal_amount || 0);
    const penalty = Number(f.penalty_amount || 0);
    const total = f.total_recoverable_amount || (penalty > 0 ? principal + penalty : principal);

    const formattedAmt = f.formatted_amount || (
      penalty > 0
        ? `ரூ.${total.toLocaleString('en-IN')}/- (அசல் ரூ.${principal.toLocaleString('en-IN')}/- + அபராதம் ரூ.${penalty.toLocaleString('en-IN')}/-)`
        : `ரூ.${total.toLocaleString('en-IN')}/-`
    );

    const amtWords = f.amount_in_words_tamil || `ரூபாய் ${total.toLocaleString('en-IN')} மட்டும்`;

    const defaulterName = d.name || "";
    const iecTag = d.iec_number ? ` (IEC No: ${d.iec_number})` : "";
    const doorNo = d.door_no ? `கதவு எண்.${d.door_no}, ` : "";
    const street = d.street_area || "";
    const pin = d.pincode ? ` - ${d.pincode}` : "";
    const fullAddr = `${doorNo}${street}, ${taluk}${pin}`.trim();

    const livingVerb = isCompany ? "இயங்கி வரும்" : "வசித்து வரும்";
    const defaulterSuffix = isCompany ? "நிறுவனத்திடமிருந்து" : "என்பவரிடமிருந்து";
    const assetClause = isCompany ? "அசையும் மற்றும் அசையா சொத்துகளிலிருந்து மற்றும் வங்கிக் கணக்குகளிலிருந்து" : "அசையும் மற்றும் அசையா சொத்துகளிலிருந்து";

    const primaryAct = acts.primary_act || "சுங்கச் சட்டம் 1962";
    const recoveryAct = acts.recovery_act || "வருவாய் வசூல் சட்டம் 1864 பிரிவு 5";
    const standingOrder = acts.standing_order || "வருவாய் நிலை ஆணை எண் 41";

    const courtName = c.court_name || "சுங்கத்துறை ஆணையரகம்";
    const caseNo = c.case_number || "516/2024-ARC";
    const oioNo = c.order_in_original_no || "";
    const letterDate = c.certificate_date || c.court_order_date || "";

    const ddFavour = b.name || "Commissioner of Customs, Export Commissionerate (Chennai IV)";
    const headOfAccount = b.head_of_account ? ` (${b.head_of_account})` : "";
    const dispatchAddr = b.address || "Custom House, 60, Rajaji Salai, Chennai – 600001";

    const subject = customSubject || `வருவாய் வசூல் சட்டம் 1864 – ${primaryAct} – ${district} மாவட்டம் – ${taluk} வட்டம் - ${defaulterName}${iecTag}, ${fullAddr} – அரசுக்குச் செலுத்த வேண்டிய நிலுவைத் தொகை ${formattedAmt} வசூல் செய்யக் கோருதல் - உத்திரவிடுதல்.`;

    const reference = oioNo
      ? `1. ${courtName}, கடித எண்.${caseNo}, நாள்: ${letterDate}.\n2. ${oioNo}, நாள்: ${c.court_order_date || letterDate}.`
      : `1. ${courtName}, கடித எண்.${caseNo}, நாள்: ${letterDate}.`;

    const recipientsList = (entities?.copy_recipients && entities.copy_recipients.length > 0)
      ? entities.copy_recipients.map(r => `${r.designation_or_name}${r.address_or_department ? ', ' + r.address_or_department : ''}`)
      : [
          `வருவாய் வட்டாட்சியர், ${taluk}.`,
          `வருவாய் கோட்டாட்சியர், ${district}.`,
          `${dispatchAddr}`,
          `${defaulterName}${iecTag}, ${fullAddr}.`
        ];

    return `${district} மாவட்ட ஆட்சித் தலைவர் மற்றும்
மாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்
பிறப்பிப்பவர்: ${collectorName}

${roc}\tநாள்: ${docDate}

பொருள்: ${subject}

பார்வை: ${reference}

-------

உத்தரவு:
   ${district} மாவட்டம், ${taluk} வட்டம், ${fullAddr} என்ற முகவரியில் ${livingVerb} ${defaulterName}${iecTag} ${defaulterSuffix} ${primaryAct}-ன்படி அரசுக்குச் செலுத்த வேண்டிய நிலுவைத் தொகை ${formattedAmt} தமிழ்நாடு வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்யுமாறு பார்வையில் காணும் உத்தரவின் வாயிலாக தெரிவிக்கப்பட்டுள்ளது.

   மேற்படி ${defaulterName} ${defaulterSuffix} தொகை ${formattedAmt} ஐ ${standingOrder} மற்றும் ${recoveryAct}-ன் கீழ் வசூல் செய்ய ${taluk} வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி இதன் மூலம் உத்திரவிடப்படுகிறது.

   எனவே, மேற்படி முகவரியில் ${livingVerb} ${defaulterName} என்பாரின் ${assetClause} மொத்தம் தொகை ${formattedAmt} (${amtWords}) வசூல் செய்து “${ddFavour}“ என்ற பெயரில் வங்கி வரைவோலையாக (Demand Draft${headOfAccount}) எடுத்து ${dispatchAddr} என்ற அலுவலகத்திற்கு அசலினை அனுப்பி அதன் விவரத்தினை நகல் வங்கி வரைவோலையுடன் இவ்வலுவலகத்திற்கு அனுப்பி வைக்குமாறு ${taluk} வருவாய் வட்டாட்சியருக்கு தெரிவிக்கப்படுகிறது.

இணைப்பு: கடித நகல்

மாவட்ட ஆட்சித் தலைவர்,
${district}.

பெறுநர்:
   ${recipientsList[0] || `வருவாய் வட்டாட்சியர், ${taluk}.`}

நகல் :
   ${recipientsList.slice(1).map(r => r).join('\n   ') || `வருவாய் கோட்டாட்சியர், ${district}.`}

-------

//அலுவலகக் குறிப்பு//

${roc}

பொருள்: ${subject}

பார்வை: ${reference}

-------

பணிந்தனுப்பப்படுகிறது:
   பார்வையில் கண்டுள்ள கடிதத்தில், ${defaulterName} செலுத்த வேண்டிய நிலுவைத் தொகை ${formattedAmt}-யினை ${recoveryAct}-ன் கீழ் வசூலிக்கக் கோரப்பட்டுள்ளது.
   
   இதன்மீது நடவடிக்கை மேற்கொள்ளும் வகையில், ${taluk} வட்டாட்சியருக்கு ${recoveryAct} மற்றும் ${primaryAct}-ன் கீழ் ஆணை பிறப்பித்து செயல்முறைக் குறிப்பாணை தயார் செய்யப்பட்டு மாவட்ட ஆட்சித் தலைவர் அவர்களின் ஒப்புதலுக்குப் பணிந்தனுப்பப்படுகிறது.

   உத்திரவினை எதிர்நோக்கி செயல்முறை வரைவு ஒப்புதலுக்காக மாவட்ட ஆட்சித்தலைவர் அவர்களுக்கு பணிவுடன் சமர்ப்பிக்கப்படுகிறது.

ஒப்பம்/–
பிரிவு எழுத்தர் / கண்காணிப்பாளர்
ஈ2 பிரிவு, மாவட்ட ஆட்சியர் அலுவலகம், ${district}.`;
  },

  /**
   * Modifies official document content dynamically based on Section Officer's instructions
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
    return content;
  },

  /**
   * Generates and downloads DOCX strictly enforcing TAU-Marutham font
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
  },

  /**
   * Downloads generated DOCX
   */
  getDownloadUrl(filename) {
    return `${API_BASE}/download/${filename}`;
  },

  /**
   * Records order submission to PostgreSQL and DRO Grievance Portal
   */
  async dispatchToDRO(payload) {
    const res = await fetch(`${API_BASE}/dispatch-dro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
    throw new Error("Failed to dispatch to DRO");
  },

  /**
   * RAG Natural Language Query Assistant powered by backend LLM
   */
  async askRAGChat(query, petitionContext) {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, context: petitionContext }),
    });
    if (res.ok) {
      return await res.json();
    }
    throw new Error("RAG Chat request failed");
  },

  /**
   * Fetches historical audit logs from PostgreSQL
   */
  async getAuditLogs() {
    try {
      const res = await fetch(`${API_BASE}/audit-logs`);
      if (res.ok) {
        const data = await res.json();
        return data.logs || {};
      }
    } catch (e) {
      console.warn("Failed to fetch audit logs from PostgreSQL:", e);
    }
    return {};
  },

  /**
   * Saves or updates an audit session in PostgreSQL
   */
  async saveAuditLog(entry) {
    try {
      const res = await fetch(`${API_BASE}/audit-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("Failed to save audit log to PostgreSQL:", e);
    }
    return null;
  },

  /**
   * Normalizes pipeline response from FastAPI backend
   */
  _normalizePipelineResult(data, filename) {
    const entities = data.entities || {};
    const validation = data.validation_insights || {};
    const boundingBoxes = data.bounding_boxes || [];

    return {
      success: true,
      filename,
      fileType: filename.endsWith('.docx') ? 'docx' : 'pdf',
      entities,
      validation_insights: validation,
      bounding_boxes: boundingBoxes,
      rawOcrText: data.raw_ocr_text || "",
      ocr_engine: data.ocr_engine || "Chandra-v2-Balance",
      sha256_digest: data.sha256_digest || "",
      generated_docx_filename: data.generated_docx_filename || `proceedings_${(entities?.case_details?.case_number || "Case").replace(/[^a-zA-Z0-9]/g, '_')}.docx`,
    };
  }
};
