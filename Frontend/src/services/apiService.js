import { readSavedAuditLogs } from './auditStore.js';
import { recordActivity } from './activityStore.js';
/**
 * API Service Client - Connects Frontend to FastAPI backend endpoints.
 * Uses server responses; unavailable operations report errors.
 */

import { DEFAULT_ENTITIES, DEFAULT_VALIDATION } from "../data/schemas.js";

const API_BASE = "/api";
async function requestJson(path, payload) {
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`Request failed: ${await res.text()}`);
  return res.json();
}

export const apiService = {
  /**
   * Checks health and connectivity of FastAPI and Ollama
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
   * Step 1-5 Pipeline: Uploads and processes a petition file
   */
  async uploadDocument(file) {
    const formData = new FormData(); formData.append('file', file);
    const res = await fetch(`${API_BASE}/process-document`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Document processing failed: ${await res.text()}`);
    return this._normalizePipelineResult(await res.json(), file.name);
  },



  async regenerateDocument(entities) {
    return requestJson('/regenerate-document', entities);
  },

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

    const isCompany = entities?.entity_type === "COMPANY" || (!d.father_or_husband_name && (d.iec_number || (d.name && (d.name.includes("M/s") || d.name.includes("Ltd") || d.name.includes("Garments") || d.name.includes("Housing")))));

    const rawRoc = entities?.proceedings_roc_number || "";
    const cleanRoc = rawRoc.replace(/^(ந\.க\.|roc\.)\s*/i, '').trim();
    const docDate = entities?.proceedings_date || "";
    const district = j.district || "";
    const taluk = j.taluk || "";
    const collectorName = j.collector_name || "";

    const principal = Number(f.principal_amount || 0);
    const penalty = Number(f.penalty_amount || 0);
    const total = penalty > 0 ? principal + penalty : principal;

    const formattedAmt = f.formatted_amount || (
      penalty > 0
        ? `ரூ.${total.toLocaleString('en-IN')}/- (அசல் ரூ.${principal.toLocaleString('en-IN')}/- + அபராதம் ரூ.${penalty.toLocaleString('en-IN')}/-)`
        : `ரூ.${total.toLocaleString('en-IN')}/-`
    );

    const amtWords = f.amount_in_words_tamil || "";

    const defaulterTitle = isCompany ? d.name : (d.name?.startsWith("திரு") ? d.name : `திரு.${d.name}`);
    const defaulterParentage = (!isCompany && d.father_or_husband_name) ? `, ${d.father_or_husband_name}` : "";

    // Assemble address lines
    const addrParts = [];
    if (d.door_no) addrParts.push(`கதவு எண்.${d.door_no}`);
    if (d.street_area) addrParts.push(d.street_area);
    if (d.village) addrParts.push(d.village);
    if (d.taluk) addrParts.push(`${d.taluk} வட்டம்`);
    if (d.district) addrParts.push(`${d.district} மாவட்டம்`);
    if (d.pincode) addrParts.push(`- ${d.pincode}`);
    const defaulterAddrStr = addrParts.join(", ") || (d.full_address || `${taluk}, ${district}`);

    if (dept === "CUSTOMS" || (acts.primary_act && acts.primary_act.includes("சுங்க")) || (acts.primary_act_section && acts.primary_act_section.includes("142"))) {
      // CUSTOMS PROCEEDINGS TEMPLATE
      const subject = customSubject || `வருவாய் வசூல் சட்டம் 1864 – சுங்கச் சட்டம் 1962 பிரிவு 142(1)(c)(i) – சென்னை சுங்கத்துறை ஏற்றுமதி ஆணையரகம் – நிலுவைத் தொகை வசூலிக்கக் கோருதல் – ஆணை பிறப்பிக்கப்படுகிறது.`;
      const fileNo = c.file_number || "";
      const certDate = c.certificate_date || "";
      const oioNo = c.order_in_original_no || "";
      const orderDate = c.court_order_date || "";

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

    // MCOP PROCEEDINGS TEMPLATE
    const subject = customSubject || `வருவாய் வசூல் சட்டம் 1864 பிரிவு 5 – மோட்டார் வாகன விபத்து இழப்பீட்டு தீர்ப்பாயம், ${district} – MCOP எண். ${c.case_number || ""} – இழப்பீட்டுத் தொகை வசூலித்தல் – குறித்து.`;
    const courtName = c.court_name || "";
    const orderDate = c.court_order_date || "";
    const iaNo = c.ia_number || "";

    return `${district} மாவட்ட ஆட்சித் தலைவர் மற்றும் மாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்
முன்னிலை: ${collectorName}

ந.க. ${cleanRoc}\tநாள்: ${docDate}

பொருள்: ${subject}

பார்வை: 1. ${district}, ${courtName} அவர்களின் ஆணை ${iaNo} in ${c.case_number || ""}, நாள்: ${orderDate}.
        2. வருவாய் நிலை ஆணை எண் 41 (RSO 41).

உத்தரவு:
   பார்வை 1-ல் காணும் நீதிமன்ற ஆணையில், ${taluk} வட்டம், ${defaulterAddrStr} என்ற முகவரியில் வசிக்கும் ${defaulterTitle}${defaulterParentage} என்பவர் மோட்டார் வாகன விபத்து இழப்பீட்டுத் தொகையான ${formattedAmt} (${amtWords})-யினை வழங்கத் தவறியதால், மேற்படி தொகையினை தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன்படி வசூலிக்க உத்தரவிடப்பட்டுள்ளது.

   எனவே, தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5 மற்றும் மோட்டார் வாகனச் சட்டம் 1988 பிரிவு 174-ன் கீழ் வழங்கப்பட்டுள்ள அதிகாரத்தின்படி, எதிர்தரப்பினரின் அசையும் மற்றும் அசையா சொத்துக்களிலிருந்து மேற்படி இழப்பீட்டுத் தொகை ${formattedAmt} மற்றும் உரிய வட்டியினை உடனடியாக வசூலித்து இழப்பீட்டுத் தீர்ப்பாயத்தில் செலுத்துமாறு ${taluk} வட்டாட்சியர் அவர்களுக்கு உத்தரவிடப்படுகிறது.

இணைப்பு: நீதிமன்ற ஆணை நகல்

\t\t\t\t\t\tமாவட்ட ஆட்சித் தலைவர்,
\t\t\t\t\t\t${district}.

பெறுநர்:
1. வருவாய் வட்டாட்சியர், ${taluk}.
2. வருவாய் கோட்டாட்சியர், ${taluk}.

நகல் :
1. ${b.name || ""}, ${b.address || district}.
2. ${defaulterTitle}${defaulterParentage}, ${defaulterAddrStr}.

--------------------------------------------------------------------------------
//அலுவலகக் குறிப்பு//

ந.க. ${cleanRoc}\tநாள்: ${docDate}

பொருள்: வருவாய் வசூல் சட்டம் 1864 – மோட்டார் வாகன விபத்து இழப்பீட்டுத் தொகை வசூலித்தல் – ஆணை பிறப்பித்தல் – சார்பு.

பார்வை: ${courtName} ஆணை ${iaNo} in ${c.case_number || ""}, நாள்: ${orderDate}.

   மேற்படி வழக்கில் தீர்ப்பளிக்கப்பட்ட இழப்பீட்டுத் தொகை ${formattedAmt}-யினை வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூலிக்குமாறு ${taluk} வட்டாட்சியருக்கு செயல்முறைக் குறிப்பாணை பிறப்பிக்க மாவட்ட ஆட்சித் தலைவர் அவர்களின் ஒப்புதலுக்குப் பணிந்தனுப்பப்படுகிறது.

ஒப்பம்/–
பிரிவு எழுத்தர் / கண்காணிப்பாளர்
ஈ2 பிரிவு, மாவட்ட ஆட்சியர் அலுவலகம், ${district}.`;
  },

  /**
   * Re-generates proceedings DOCX when officer gives custom prompt instructions
   */
  async regenerateWithPrompt(prompt, entities, subject) {
    return requestJson('/regenerate-with-prompt', { prompt, entities, subject });
  },

  async modifyContent(content, instruction) {
    const data = await requestJson('/modify-content', { content, instruction });
    if (typeof data.content !== 'string') throw new Error('No revised content returned.');
    return data.content;
  },

  async exportDocx(content, filename = "Official_Proceedings.docx") {
    try {
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
    } catch (e) {
      // fallback
    }

    // Fallback: download as text document
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".docx") ? filename.replace(".docx", ".txt") : filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Downloads generated DOCX
   */
  getDownloadUrl(filename) {
    return `${API_BASE}/download/${filename}`;
  },

  /**
   * Records order submission to the Tamil Nadu DRO Grievance Portal
   */
  async dispatchToDRO(payload) { return requestJson('/dispatch-dro', payload); },

  async askRAGChat(query, context) { return requestJson('/chat', { query, context }); },

  async getAuditLogs() {
    return readSavedAuditLogs();
  },

  /**
   * Saves or updates an audit session in persistent storage
   */
  async saveAuditLog(entry) {
    try {
      const current = await this.getAuditLogs();
      const monthYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date());
      const existingMonth = Object.keys(current).find(month => current[month].some(item => item.id === entry.id));
      const month = existingMonth || monthYear;
      const existing = current[month]?.find(item => item.id === entry.id);
      const savedEntry = { ...existing, ...entry, timestamp: existing?.timestamp || entry.timestamp || new Date().toISOString() };
      const updated = { ...current, [month]: [savedEntry, ...(current[month] || []).filter(item => item.id !== entry.id)] };

      localStorage.setItem('rr_audit_logs', JSON.stringify(updated));
      if (!existing || Object.keys(entry).some(key => key !== 'timestamp' && JSON.stringify(entry[key]) !== JSON.stringify(existing[key]))) {
        recordActivity(!existing ? 'Proceedings created' : existing.status !== savedEntry.status ? 'Proceedings status updated' : 'Proceedings updated', {
          recordId: savedEntry.id, reference: savedEntry.caseNumber || savedEntry.fileName || savedEntry.id, status: savedEntry.status || 'DRAFT',
        });
      }
      globalThis.window?.dispatchEvent(new Event('rr-audit-logs-updated'));
      return updated;
    } catch (e) {
      throw new Error(e?.message && !e.message.startsWith('Unable to load') ? `Unable to save audit record. ${e.message}` : 'Unable to save audit record.');
    }
  },

  /**
   * Normalizes pipeline response from FastAPI backend
   */
  _normalizePipelineResult(data, filename) {
    const entities = data.entities || DEFAULT_ENTITIES;
    const validation = data.validation_insights || DEFAULT_VALIDATION;
    const boundingBoxes = data.bounding_boxes && data.bounding_boxes.length > 0 ? data.bounding_boxes : [];

    return {
      success: true,
      filename,
      fileType: filename.endsWith('.docx') ? 'docx' : 'pdf',
      entities,
      validation_insights: validation,
      bounding_boxes: boundingBoxes,
      rawOcrText: data.raw_ocr_text || "",
      generated_docx_filename: data.generated_docx_filename || '',
    };
  },

};
