# Product Requirements Document (PRD)

> **Document ID**: RR-PRD-001  
> **Version**: 2.0  
> **Date**: 2026-09-28  
> **Product Name**: AI Administrative Co-Pilot — RR Assistant  
> **Author**: Product & Engineering Team  
> **Status**: APPROVED FOR DEVELOPMENT  
> **Classification**: Internal — Confidential

---

## 1. Overview

### 1.1 Product Vision

**Empower every Section Officer in the Tamil Nadu Collector's office to generate legally compliant, audit-ready Revenue Recovery proceedings in under 3 minutes — from a scanned court order to a dispatch-ready .docx — with zero math errors and full traceability.**

### 1.2 Product Mission

Build an AI-powered document processing pipeline that automates the ingestion, extraction, validation, and generation of Revenue Recovery proceedings orders (செயல்முறை ஆணை) for the Tamil Nadu district revenue administration, ensuring data sovereignty, government font compliance, and complete audit accountability.

### 1.3 Target Release

| Milestone | Date | Scope |
|---|---|---|
| **Alpha (Internal)** | Q3 2026 | Core pipeline: OCR → Extraction → DOCX generation |
| **Beta (Pilot District)** | Q4 2026 | Full system: Admin panel, audit logs, proceedings dispatch |
| **GA (Statewide)** | Q1 2027 | Multi-district deployment, training, support |

---

## 2. User Personas

### Persona 1: Section Officer — "Ravi" (Primary User)

| Attribute | Detail |
|---|---|
| **Role** | Section Officer, ஈ2 பிரிவு (E2 Section) |
| **Age** | 35–55 |
| **Tech Literacy** | Basic (uses MS Word, email, can browse web) |
| **Daily Volume** | 3–5 proceedings per day (target: 10–15 with tool) |
| **Language** | Tamil (primary), English (secondary) |
| **Pain** | Repetitive manual typing, amount conversion errors, template confusion |
| **Goal** | Generate correct proceedings quickly so backlogs clear |

### Persona 2: District Collector — "Dr. Kandhasamy" (Decision Maker)

| Attribute | Detail |
|---|---|
| **Role** | District Collector & District Magistrate, IAS Officer |
| **Focus** | Final approval, zero-error tolerance, public accountability |
| **Need** | Dashboard visibility, trust in AI accuracy, audit compliance |

### Persona 3: System Administrator — "Priya" (Admin User)

| Attribute | Detail |
|---|---|
| **Role** | IT Administrator at Collector's office |
| **Focus** | User management, template management, system health |
| **Need** | Easy admin panel, backup/restore, user role management |

---

## 3. Feature Requirements

### 3.1 Feature Map (MoSCoW Prioritization)

#### MUST HAVE (P0) — Critical for Launch

| ID | Feature | Description | User Story |
|---|---|---|---|
| F1 | **Document Upload & Ingestion** | Accept PDF, DOCX, PNG, JPG, TIFF uploads. Render to processable images. | As a Section Officer, I want to upload a scanned court order so I can start processing it. |
| F2 | **Dual OCR Engine** | Primary: Datalab Chandra OCR v2 (balanced mode) for Tamil+English. Fallback: RapidOCR PP-OCRv4 ONNX (offline). | As a Section Officer, I want the system to read my scanned Tamil documents accurately even when the internet is down. |
| F3 | **AI Entity Extraction** | Ollama qwen2.5:3b-instruct extracts 25+ structured fields with Pydantic schema validation. | As a Section Officer, I want the system to automatically extract defaulter name, amounts, and case details from the court order. |
| F4 | **Math Validation Engine** | Auto-verify: Principal + Penalty + Interest = Total. Tamil currency word generation. | As a Section Officer, I want the system to verify all amounts are correct before generating the proceedings. |
| F5 | **Jurisdiction Routing** | Auto-route to correct Taluk/Tahsildar based on defaulter's address. | As a Section Officer, I want the system to identify the correct Tahsildar for the recovery order. |
| F6 | **DOCX Generation (TAU-Marutham)** | Generate proceedings as .docx with exclusive TAU-Marutham font for every element. | As a Section Officer, I want a properly formatted government proceedings document ready for the Collector's signature. |
| F7 | **Entity Edit Form** | Editable form showing all extracted entities with side-by-side OCR inspection. | As a Section Officer, I want to review and correct any extraction errors before generating the final document. |
| F8 | **Proceedings Preview** | Full document preview with the official Tamil proceedings layout. | As a Section Officer, I want to see exactly how the final proceedings will look before downloading. |
| F9 | **Download DOCX/PDF** | One-click download of the generated proceedings in DOCX and PDF formats. | As a Section Officer, I want to download the proceedings for printing and Collector's signature. |

#### SHOULD HAVE (P1) — Important, Not Blocking Launch

| ID | Feature | Description |
|---|---|---|
| F10 | **Department Classification** | Auto-detect department type (MCOP / Customs / RERA / Court Warrant) from document content. |
| F11 | **Template Management** | Admin can add, edit, delete, and preview proceedings templates per department. |
| F12 | **User Management & RBAC** | Admin manages user accounts. Admin edits all; users edit self only. |
| F13 | **Audit Trail (PostgreSQL)** | Immutable ledger recording every proceeding: who, when, what data, SHA-256 hash. |
| F14 | **Proceedings Dispatch Recording** | One-click dispatch recording and receipt generation for issued orders. |
| F15 | **Grounding & Hallucination Score** | Display AI confidence scores — grounding (how much came from the document) and hallucination (how much was fabricated). |
| F16 | **AI Prompt Re-generation** | Section Officer gives natural language instructions (e.g., "Change taluk to Perundurai") and AI updates the document. |

#### COULD HAVE (P2) — Nice to Have

| ID | Feature | Description |
|---|---|---|
| F17 | **RAG Chat Assistant** | Semantic Q&A over the extracted document ("Who is the defaulter?", "What is the recovery amount?"). |
| F18 | **Mobile QR Scan** | Generate QR code for mobile petition capture. |
| F19 | **Bounding Box Visualization** | Show OCR bounding boxes on the original document for verification. |
| F20 | **Multi-language UI** | Tamil and English UI toggle. |
| F21 | **Dark/Light Theme** | UI theme preferences. |
| F22 | **Activity Feed** | Sidebar showing recent proceedings activity. |

#### WON'T HAVE (Out of Scope for v2.0)

| ID | Feature | Reason |
|---|---|---|
| X1 | **Digital Signature Integration** | Requires government PKI infrastructure, separate initiative |
| X2 | **SMS/Email Notification to Defaulter** | Legal compliance review required |
| X3 | **Multi-District Federation** | Phase 3 — requires state-level infrastructure |
| X4 | **Mobile Native App** | Web-first approach sufficient for office use |

---

## 4. Functional Requirements

### 4.1 Document Processing Pipeline

```
┌────────────────────────────────────────────────────────────────────────┐
│                    DOCUMENT PROCESSING PIPELINE                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [UPLOAD]  →  [INGEST]  →  [OCR]  →  [EXTRACT]  →  [VALIDATE]  →     │
│                                                                        │
│  →  [GENERATE DOCX]  →  [AUDIT LOG]  →  [DISPATCH]                    │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  Step 1: Document Ingestion & Image Rendering                          │
│  Step 2: OCR Text Extraction (Chandra v2 / PP-OCRv4 ONNX)             │
│  Step 3: LLM Structured Entity Extraction (qwen2.5:3b-instruct)       │
│  Step 4: Validation, Math Check, Jurisdiction Routing                  │
│  Step 5: DOCX Proceedings Generation (TAU-Marutham font)               │
│  Step 6: PostgreSQL Audit Ledger Recording                             │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 FR-001: Document Upload

| Attribute | Specification |
|---|---|
| **Supported Formats** | PDF, DOCX, PNG, JPG, JPEG, TIFF |
| **Max File Size** | 50 MB |
| **Upload Method** | Drag-and-drop or file picker |
| **Processing Feedback** | Real-time step-by-step overlay showing pipeline progress |
| **Error Handling** | Clear error messages for unsupported formats, size limits |

### 4.3 FR-002: OCR Engine

| Attribute | Specification |
|---|---|
| **Primary Engine** | Datalab Chandra OCR v2 (balanced mode) — cloud API |
| **Fallback Engine** | RapidOCR PP-OCRv4 ONNX — fully offline, local inference |
| **Languages** | Tamil (ta), English (en) |
| **Output** | Combined text + per-line bounding boxes with confidence scores |
| **Confidence Threshold** | 0.52 minimum |
| **Timeout** | 25 seconds (Chandra), then fallback to local |

### 4.4 FR-003: LLM Entity Extraction

| Attribute | Specification |
|---|---|
| **Model** | Ollama qwen2.5:3b-instruct (local inference) |
| **Fallback Model** | qwen2.5:3b |
| **Output Schema** | Pydantic `ExtractedLegalEntities` with 25+ fields |
| **Validation** | Strict Pydantic schema enforcement — no unstructured output |
| **Extracted Fields** | See §4.8 Entity Schema below |
| **Temperature** | 0.1 (deterministic extraction) |
| **Timeout** | 20 seconds |

### 4.5 FR-004: Validation & Insight Engine

| Check | Description | Action on Failure |
|---|---|---|
| **Math Validation** | Principal + Penalty = Total (with tolerance) | Auto-correct and warn |
| **Interest Calculation** | Apply statutory interest if applicable | Calculate and add to total |
| **Tamil Amount Words** | Convert numeric amount to Tamil word representation | Auto-generate |
| **Jurisdiction Routing** | Map defaulter address → correct Taluk → Tahsildar | Auto-assign and verify |
| **Grounding Score** | Percentage of entities grounded in OCR text | Display score (0.0–1.0) |
| **Hallucination Score** | Percentage of entities not found in source | Display score, warn if >0.20 |

### 4.6 FR-005: Document Generation

| Attribute | Specification |
|---|---|
| **Output Format** | Microsoft Word .docx |
| **Font** | TAU-Marutham exclusively (headings, paragraphs, tables, signatures) |
| **Templates** | Department-specific: MCOP, Customs, RERA, Court Warrant |
| **Sections** | Header, ROC Number, Subject, References, Order, Enclosures, Signature, Recipients, Office Note |
| **SHA-256 Hash** | Computed and stored for every generated document |
| **PDF Export** | DOCX → PDF conversion available |

### 4.7 FR-006: Audit Trail

| Attribute | Specification |
|---|---|
| **Storage** | PostgreSQL database |
| **Recorded Fields** | Case number, ROC number, defaulter name, amount, taluk, district, officer, status, template code, file info, SHA-256 hash, grounding/hallucination scores, full entities JSON |
| **Immutability** | Entries are append-only; status updates create new audit entries |
| **Grouping** | By month/year |
| **Statuses** | DRAFT → VERIFIED → DISPATCHED |

### 4.8 Entity Schema (Core Data Model)

```
ExtractedLegalEntities
├── department_type         (MCOP | CUSTOMS | RERA | WARRANT)
├── entity_type            (INDIVIDUAL | COMPANY)
├── proceedings_roc_number  (ந.க.xxxx/yyyy/ஈ2)
├── proceedings_date
├── case_details
│   ├── court_name
│   ├── case_number
│   ├── court_order_date
│   ├── ia_number
│   ├── file_number
│   └── order_in_original_no
├── defaulter (PartyDetails)
│   ├── name
│   ├── father_or_husband_name
│   ├── iec_number (for Customs)
│   ├── door_no, street_area, village
│   ├── taluk, district, pincode
│   └── full_address
├── beneficiary (BeneficiaryDetails)
│   ├── name
│   ├── address
│   └── head_of_account
├── financials (FinancialDetails)
│   ├── principal_amount
│   ├── penalty_amount
│   ├── total_recoverable_amount
│   ├── formatted_amount
│   ├── amount_in_words_tamil
│   ├── interest_rate
│   └── interest_applicable
├── legal_acts (LegalActs)
│   ├── primary_act
│   ├── primary_act_section
│   ├── recovery_act
│   └── standing_order
├── jurisdiction (JurisdictionDetails)
│   ├── district
│   ├── taluk
│   ├── tahsildar_title
│   ├── collector_name
│   └── collector_designation
├── enclosures[]
└── copy_recipients[]
    ├── designation_or_name
    └── address_or_department
```

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Metric | Requirement |
|---|---|
| End-to-end pipeline time | < 60 seconds for a 5-page PDF |
| OCR processing | < 25 seconds per page |
| LLM extraction | < 20 seconds total |
| API response time (non-pipeline) | < 500ms (p95) |
| Concurrent users | 10 simultaneous users per instance |
| Document generation | < 5 seconds |

### 5.2 Security

| Requirement | Detail |
|---|---|
| **Data Sovereignty** | All processing local. No data transmitted to external cloud APIs (except optional Chandra OCR). |
| **Authentication** | Role-based login (Admin / User). Header-based RBAC. |
| **Authorization** | Admin: full access. User: self-profile edit only, read audit logs, process documents. |
| **Data at Rest** | PostgreSQL with standard OS-level encryption. |
| **Audit Immutability** | SHA-256 document hashes stored with every audit entry. |
| **Input Sanitization** | File name sanitization, file type whitelist, no path traversal. |
| **CORS** | Configured for deployment origin only (restrict `*` in production). |

### 5.3 Reliability

| Requirement | Detail |
|---|---|
| **OCR Resilience** | Dual engine failover: Chandra v2 → PaddleOCR v4 ONNX |
| **LLM Resilience** | Fallback model: qwen2.5:3b if primary fails |
| **Database** | PostgreSQL with connection pooling |
| **Error Handling** | Graceful degradation with user-friendly error messages |
| **Data Integrity** | SHA-256 per document, Pydantic validation |

### 5.4 Usability

| Requirement | Detail |
|---|---|
| **Language** | Bilingual UI (Tamil / English) |
| **Accessibility** | WCAG 2.1 AA compliance target |
| **Responsive** | Desktop-first with mobile support for QR capture |
| **Onboarding** | < 30 min training for new Section Officers |
| **Error Recovery** | Always-editable forms, undo, re-generation capability |

### 5.5 Scalability

| Requirement | Detail |
|---|---|
| **Single District** | 1 instance per district, 10 concurrent users |
| **Multi-District** | Independent instances, shared template library |
| **Storage** | ~50 MB/month per district (audit logs + generated documents) |

---

## 6. User Journeys

### 6.1 Primary Journey: Process a New Court Order

```
Section Officer logs in
    │
    ├── Sees RR Assistant (chat-style landing page)
    │
    ├── Clicks "New Proceedings" or "Upload"
    │
    ├── Uploads scanned court order PDF
    │   └── Processing overlay shows 6-step pipeline progress
    │
    ├── Arrives at Workspace (Document Editor mode)
    │   ├── Left: Formatted Tamil proceedings (editable)
    │   ├── Right: AI prompt input for corrections
    │   └── Status bar: Case number, grounding score
    │
    ├── Reviews the generated proceedings
    │   ├── If correct → Downloads DOCX → Gets Collector's signature
    │   ├── If errors → Switches to "Inspection" mode
    │   │   ├── Left: Original OCR with bounding boxes
    │   │   ├── Center: Editable entity form
    │   │   └── Right: RAG chat for questions
    │   └── Makes corrections → Clicks "Regenerate"
    │
    ├── Clicks "Record Dispatch"
    │   ├── System checks hallucination score (<0.20)
    │   ├── Records audit entry with SHA-256
    │   └── Shows dispatch receipt modal
    │
    └── Proceeding appears in Audit Log sidebar
```

### 6.2 Admin Journey: Manage Templates

```
Admin logs in → Sees Admin Dashboard
    │
    ├── Navigate to "Templates" tab
    │   ├── View all active templates by department/category
    │   ├── Click "Add New Template" → Fill form → Save
    │   ├── Click template row → Edit fields → Save
    │   └── Click delete → Confirm → Soft delete
    │
    ├── Navigate to "Users" tab
    │   ├── View all users with role/status filters
    │   ├── Create new user (name, email, role)
    │   └── Edit/delete users
    │
    └── Navigate to "Backup & Restore"
        └── System maintenance operations
```

---

## 7. Acceptance Criteria

### AC-001: Document Upload

- [ ] System accepts PDF, DOCX, PNG, JPG, JPEG, TIFF files ≤50MB
- [ ] Rejects unsupported formats with clear error message
- [ ] Shows processing overlay with step-by-step progress
- [ ] File name is sanitized (spaces replaced, special chars removed)

### AC-002: OCR Extraction

- [ ] Successfully extracts text from scanned Tamil+English PDFs
- [ ] Falls back to PaddleOCR v4 ONNX when Chandra API is unreachable
- [ ] Provides per-line bounding boxes with confidence scores
- [ ] Extracts text from multi-page documents (tested up to 15 pages)

### AC-003: Entity Extraction

- [ ] Extracts all 25+ schema fields from a standard MCOP order
- [ ] Extracts all fields from a Customs Act certificate
- [ ] Pydantic validation ensures no malformed output
- [ ] Grounding score >0.90 for well-scanned documents

### AC-004: Validation

- [ ] Math check: Principal + Penalty = Total (auto-corrects if wrong)
- [ ] Tamil amount words are correct for amounts up to ₹10,00,00,000
- [ ] Correct Taluk routing for all 16 taluks in Erode district
- [ ] Hallucination score warns if >0.20

### AC-005: Document Generation

- [ ] Generated DOCX uses TAU-Marutham font exclusively
- [ ] Contains all required sections: header, ROC, subject, references, order, enclosures, signature, recipients, office note
- [ ] DOCX is valid and opens in Microsoft Word, LibreOffice, WPS Office
- [ ] PDF export produces layout-identical output

### AC-006: Audit Trail

- [ ] Every proceeding is logged in PostgreSQL with all metadata
- [ ] SHA-256 hash is computed and stored for every generated document
- [ ] Audit entries are grouped by month
- [ ] Status transitions are tracked (DRAFT → VERIFIED → DISPATCHED)

---

## 8. Out of Scope

1. Digital signature integration (eSign / DSC)
2. SMS/Email notifications to defaulters
3. Multi-district federation / central dashboard
4. Mobile native application
5. Integration with TNSWAN / NIC network services
6. Legacy data migration from physical registers
7. Payment gateway for online recovery

---

## 9. Dependencies

| Dependency | Type | Risk Level |
|---|---|---|
| **Ollama** (local LLM runtime) | Runtime | Low (self-hosted) |
| **PostgreSQL 14+** | Database | Low (standard gov IT) |
| **Datalab Chandra OCR v2 API** | External API (optional) | Medium (has offline fallback) |
| **TAU-Marutham Font** | Typography | Low (freely available) |
| **python-docx** | Library | Low (stable, MIT licensed) |
| **FastAPI + Uvicorn** | Framework | Low (mature ecosystem) |
| **React + Vite** | Frontend | Low (mature ecosystem) |

---

## 10. Release Plan

| Phase | Scope | Duration | Success Criteria |
|---|---|---|---|
| **Phase 1: Core Pipeline** | F1–F9 (Upload → DOCX) | 6 weeks | 10 proceedings processed end-to-end |
| **Phase 2: Admin & Audit** | F10–F16 (Templates, Users, Audit, Dispatch) | 4 weeks | Admin panel operational, audit trail complete |
| **Phase 3: Intelligence** | F17–F22 (RAG Chat, Mobile, Themes) | 4 weeks | Chat assistant functional, mobile QR working |
| **Phase 4: Pilot** | Erode District pilot with 5 officers | 4 weeks | 200 proceedings/month achieved |
| **Phase 5: Statewide** | Multi-district deployment | 8 weeks | 10+ districts operational |

---

## 11. Appendices

### Appendix A: Glossary

| Term | Definition |
|---|---|
| **RR** | Revenue Recovery |
| **MCOP** | Motor Claims Original Petition |
| **ROC Number** | Record of Correspondence number (ந.க. — நகல் குறிப்பு) |
| **DRO** | District Revenue Officer |
| **Tahsildar** | Revenue officer administering a Taluk (வட்டாட்சியர்) |
| **RDO** | Revenue Divisional Officer (கோட்டாட்சியர்) |
| **Proceedings** | Official government order (செயல்முறை ஆணை / செயல்முறைக் குறிப்பாணை) |
| **TAU-Marutham** | Government-mandated Tamil font for official documents |
| **Chandra OCR** | Datalab's OCR API optimized for Indic scripts |
| **Pydantic** | Python data validation library ensuring schema compliance |

### Appendix B: RICE Score

| Feature | Reach | Impact | Confidence | Effort | RICE Score |
|---|---|---|---|---|---|
| F1: Document Upload | 150 | 3x | 100% | 1 mo | 450 |
| F3: AI Entity Extraction | 150 | 3x | 80% | 2 mo | 180 |
| F6: DOCX Generation | 150 | 3x | 100% | 2 mo | 225 |
| F4: Math Validation | 150 | 2x | 100% | 0.5 mo | 600 |
| F13: Audit Trail | 150 | 2x | 100% | 1 mo | 300 |
| F16: AI Prompt Regen | 100 | 2x | 80% | 1.5 mo | 107 |

---

*This PRD is a living document. Version history is maintained in git.*
