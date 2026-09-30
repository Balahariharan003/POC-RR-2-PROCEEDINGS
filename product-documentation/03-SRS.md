# Software Requirements Specification (SRS)

> **Document ID**: RR-SRS-001  
> **Version**: 2.0  
> **Date**: 2026-09-28  
> **Product**: AI Administrative Co-Pilot — RR Assistant  
> **Standard**: IEEE 830-1998 / ISO/IEC/IEEE 29148:2018  
> **Status**: APPROVED  
> **Classification**: Internal — Confidential

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the complete functional and non-functional requirements for the **AI Administrative Co-Pilot — RR Assistant**, a web-based application that automates the generation of Tamil Nadu Revenue Recovery Proceedings from scanned court orders using OCR, AI-powered entity extraction, and template-based document generation.

### 1.2 Scope

The system covers:
- Document ingestion (PDF, DOCX, images)
- Optical Character Recognition (OCR) for mixed Tamil + English documents
- AI-powered structured entity extraction using a local Large Language Model
- Mathematical validation and jurisdiction routing
- Government-compliant proceedings document generation (.docx)
- Administrative functions (user management, template management, audit trail)
- District Revenue Officer portal dispatch recording

The system does NOT cover:
- Digital signature infrastructure
- Payment processing / online recovery
- Multi-state / cross-state federation
- Mobile native applications

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|---|---|
| **RR** | Revenue Recovery |
| **MCOP** | Motor Claims Original Petition |
| **MACT** | Motor Accident Claims Tribunal |
| **ROC** | Record of Correspondence (ந.க.) |
| **DRO** | District Revenue Officer |
| **LLM** | Large Language Model |
| **OCR** | Optical Character Recognition |
| **RBAC** | Role-Based Access Control |
| **ONNX** | Open Neural Network Exchange |
| **SRS** | Software Requirements Specification |
| **SHA-256** | Secure Hash Algorithm (256-bit) |

### 1.4 References

1. Tamil Nadu Revenue Recovery Act, 1864
2. Motor Vehicles Act, 1988 (Section 174)
3. Customs Act, 1962 (Section 142)
4. TN Real Estate (Regulation) Act, 2016
5. Revenue Standing Order No. 41 (RSO 41)
6. IEEE 830-1998 — Recommended Practice for SRS
7. OWASP Top 10 (2025)

### 1.5 Overview

The remainder of this document is organized as follows:
- §2: Overall Description
- §3: Specific Functional Requirements
- §4: External Interface Requirements
- §5: Non-Functional Requirements
- §6: Data Requirements
- §7: Traceability Matrix

---

## 2. Overall Description

### 2.1 Product Perspective

The RR Assistant is a **standalone web application** deployed within the Tamil Nadu District Collector's office IT infrastructure. It operates as a self-contained unit with:
- A **Python/FastAPI backend** providing REST APIs
- A **React/Vite frontend** providing the user interface
- A **PostgreSQL database** for persistent storage
- A **local Ollama LLM runtime** for on-premises AI inference
- Optional integration with **Datalab Chandra OCR v2** cloud API

```
┌─────────────────────────────────────────────────────────────────┐
│                    SYSTEM CONTEXT DIAGRAM                        │
│                                                                  │
│   ┌──────────┐         ┌────────────────┐        ┌───────────┐  │
│   │ Browser  │◄──────►│  React/Vite    │        │ Chandra   │  │
│   │ (User)   │  HTTP  │  Frontend      │        │ OCR API   │  │
│   └──────────┘        └───────┬────────┘        └─────┬─────┘  │
│                               │                       │         │
│                               │ REST API              │ HTTP    │
│                               ▼                       ▼         │
│                    ┌──────────────────┐    ┌──────────────┐     │
│                    │  FastAPI Backend  │◄──►│  Ollama LLM  │     │
│                    │  (Python)         │    │  (Local)     │     │
│                    └────────┬─────────┘    └──────────────┘     │
│                             │                                    │
│                             │ SQL                                │
│                             ▼                                    │
│                    ┌──────────────────┐                          │
│                    │  PostgreSQL DB   │                          │
│                    └──────────────────┘                          │
│                                                                  │
│                    ┌──────────────────┐                          │
│                    │  File System     │                          │
│                    │  (uploads/       │                          │
│                    │   outputs/       │                          │
│                    │   templates/)    │                          │
│                    └──────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Product Functions (Summary)

| # | Function | Description |
|---|---|---|
| PF-1 | Document Processing Pipeline | 6-step automated pipeline from upload to DOCX generation |
| PF-2 | Entity Management | View, edit, validate extracted entities |
| PF-3 | Template Management | CRUD operations on proceedings templates |
| PF-4 | User Management | RBAC user account administration |
| PF-5 | Audit Trail | Immutable proceedings activity ledger |
| PF-6 | DRO Dispatch | Record proceedings dispatch to DRO portal |
| PF-7 | RAG Chat | Semantic Q&A over extracted document data |

### 2.3 User Classes and Characteristics

| User Class | Frequency | Tech Level | Access Level |
|---|---|---|---|
| Section Officer | Daily, 3-15 sessions | Basic | Document processing, entity editing, download, dispatch |
| District Collector | Weekly, review | Moderate | View audit logs, approve (offline) |
| System Administrator | Weekly, maintenance | Advanced | User CRUD, template CRUD, backup/restore, full system access |

### 2.4 Operating Environment

| Component | Requirement |
|---|---|
| **Server OS** | Ubuntu 20.04+ / Windows Server 2019+ |
| **Python** | 3.10+ |
| **Node.js** | 18+ |
| **PostgreSQL** | 14+ |
| **Ollama** | Latest stable |
| **Browser** | Chrome 100+, Firefox 100+, Edge 100+ |
| **RAM** | 8 GB minimum, 16 GB recommended |
| **Disk** | 20 GB minimum (OS + models + documents) |
| **Network** | Optional (Chandra OCR needs internet; system works offline with PaddleOCR) |

### 2.5 Design and Implementation Constraints

1. **C1**: All LLM inference must be local (Ollama). No cloud LLM APIs permitted for entity extraction.
2. **C2**: TAU-Marutham font must be the exclusive font in all generated documents.
3. **C3**: Documents must be generated as .docx (Microsoft Word format).
4. **C4**: PostgreSQL is the only permitted database.
5. **C5**: Frontend must work in government-standard browsers (Chrome, Firefox).
6. **C6**: System must be deployable without internet access (offline-first design).
7. **C7**: All dates must follow Indian format (DD.MM.YYYY).

### 2.6 Assumptions and Dependencies

| # | Assumption/Dependency |
|---|---|
| A1 | Court orders are received as PDF scans (300 DPI minimum recommended) |
| A2 | TAU-Marutham font is installed on the server system |
| A3 | Ollama is installed and the qwen2.5:3b-instruct model is pulled |
| A4 | PostgreSQL service is running and accessible |
| A5 | Section Officers have received basic computer training |
| A6 | PaddleOCR v4 ONNX models are pre-downloaded in the models directory |

---

## 3. Specific Functional Requirements

### 3.1 Document Ingestion Module

#### SRS-FR-001: File Upload

| Attribute | Value |
|---|---|
| **ID** | SRS-FR-001 |
| **Priority** | P0 (Must Have) |
| **Input** | File (multipart/form-data) |
| **Accepted Formats** | .pdf, .docx, .png, .jpg, .jpeg, .tiff |
| **Max Size** | 50 MB |
| **Processing** | Filename sanitized (spaces → underscores, special chars removed). Saved to `uploads/` directory. |
| **Output** | Saved file path; pipeline invocation |
| **Error** | HTTP 400 for unsupported format; HTTP 413 for oversized files |
| **Precondition** | User is authenticated |
| **Postcondition** | File saved, pipeline begins processing |

#### SRS-FR-002: Document-to-Image Rendering

| Attribute | Value |
|---|---|
| **ID** | SRS-FR-002 |
| **Input** | File path (PDF/DOCX/Image) |
| **Processing** | PDFs rendered to images at configured DPI (default: 150). DOCX converted via python-docx. Images passed through directly. |
| **Output** | List of page image data structures |
| **Error** | Graceful failure with error message if rendering fails |

#### SRS-FR-003: Direct PDF Text Extraction

| Attribute | Value |
|---|---|
| **ID** | SRS-FR-003 |
| **Input** | PDF file path |
| **Processing** | Extract embedded text layer (if present) using pdfplumber/pymupdf |
| **Output** | Raw text string |
| **Note** | Used as supplement to OCR for digital PDFs |

### 3.2 OCR Module

#### SRS-FR-010: Primary OCR (Chandra v2)

| Attribute | Value |
|---|---|
| **ID** | SRS-FR-010 |
| **API** | Datalab Chandra OCR v2 (`https://api.datalab.to/v1/ocr`) |
| **Mode** | "balance" (balanced accuracy/speed) |
| **Languages** | Tamil, English |
| **Authentication** | DATALAB_API_KEY environment variable |
| **Timeout** | 25 seconds |
| **Output** | Combined text + per-line bounding boxes + confidence scores |
| **Failure** | Falls through to SRS-FR-011 |

#### SRS-FR-011: Fallback OCR (PaddleOCR v4 ONNX)

| Attribute | Value |
|---|---|
| **ID** | SRS-FR-011 |
| **Engine** | RapidOCR with PP-OCRv4 ONNX models |
| **Models** | `ch_PP-OCRv4_det_infer.onnx`, `ta_PP-OCRv4_rec_infer.onnx` |
| **Dictionary** | `ta_dict.txt` |
| **Confidence** | Minimum 0.52 threshold |
| **Detection Side Limit** | 960 pixels |
| **Output** | Same structure as SRS-FR-010 |
| **Condition** | Invoked only when SRS-FR-010 fails or times out |

### 3.3 LLM Extraction Module

#### SRS-FR-020: Structured Entity Extraction

| Attribute | Value |
|---|---|
| **ID** | SRS-FR-020 |
| **Model** | Ollama qwen2.5:3b-instruct (local) |
| **Fallback** | qwen2.5:3b |
| **Input** | Raw OCR text |
| **Output** | `ExtractedLegalEntities` Pydantic model (25+ fields) |
| **Prompt** | System prompt with Tamil legal domain context + JSON output schema |
| **Temperature** | 0.1 |
| **Timeout** | 20 seconds |
| **Validation** | Strict Pydantic schema validation; reject malformed responses |
| **Retry** | Up to 2 retries with fallback model on failure |

#### SRS-FR-021: Department Classification

| Attribute | Value |
|---|---|
| **ID** | SRS-FR-021 |
| **Input** | Extracted legal acts, court name, case number |
| **Logic** | If primary_act contains "சுங்க" (Customs) → CUSTOMS; If court_name contains MCOP → MCOP; If RERA → RERA; else WARRANT |
| **Output** | `department_type` field in entities |

### 3.4 Validation Module

#### SRS-FR-030: Mathematical Validation

| Attribute | Value |
|---|---|
| **ID** | SRS-FR-030 |
| **Input** | FinancialDetails (principal, penalty, total) |
| **Validation** | Assert: total = principal + penalty (±0.01 tolerance) |
| **Auto-correct** | If total is 0 or missing, set to principal + penalty |
| **Output** | ValidationResult with math_valid flag and details |

#### SRS-FR-031: Interest Calculation

| Attribute | Value |
|---|---|
| **ID** | SRS-FR-031 |
| **Input** | Interest rate, start date, principal amount |
| **Calculation** | Simple interest: (Principal × Rate × Years) / 100 |
| **Output** | interest_accrued, total_recoverable_amount updated |

#### SRS-FR-032: Tamil Currency Words

| Attribute | Value |
|---|---|
| **ID** | SRS-FR-032 |
| **Input** | Numeric amount (float) |
| **Output** | Tamil word representation (e.g., 481459 → "நான்கு இலட்சத்து எண்பத்தொன்றாயிரத்து நானூற்று ஐம்பத்தொன்பது") |
| **Range** | 0 to 99,99,99,999 (up to ₹99 Crore) |

#### SRS-FR-033: Jurisdiction Routing

| Attribute | Value |
|---|---|
| **ID** | SRS-FR-033 |
| **Input** | Defaulter's address (village/area/taluk/district) |
| **Processing** | Lookup against taluk master data |
| **Output** | Assigned taluk, tahsildar_title, rdo_title |
| **Validation** | Warning if address doesn't match any known taluk |

#### SRS-FR-034: Grounding Score Calculation

| Attribute | Value |
|---|---|
| **ID** | SRS-FR-034 |
| **Input** | Extracted entities + raw OCR text |
| **Calculation** | Percentage of entity values found verbatim in OCR text |
| **Output** | grounding_score (0.0–1.0) |
| **Threshold** | Warning if <0.80 |

#### SRS-FR-035: Hallucination Score Calculation

| Attribute | Value |
|---|---|
| **ID** | SRS-FR-035 |
| **Input** | Extracted entities + raw OCR text |
| **Calculation** | 1.0 - grounding_score |
| **Output** | hallucination_score (0.0–1.0) |
| **Threshold** | Blocking warning if >0.20 on DRO dispatch |

### 3.5 Document Generation Module

#### SRS-FR-040: Proceedings DOCX Generation

| Attribute | Value |
|---|---|
| **ID** | SRS-FR-040 |
| **Input** | Validated entities, validation result, template code |
| **Output** | .docx file in `outputs/` directory |
| **Font** | TAU-Marutham exclusively — all headings, paragraphs, tables, signature blocks |
| **Template Selection** | Based on `department_type` and `template_code` |
| **Sections** | District Collector header, ROC number + date, Subject, References, Order body, Enclosures, Collector signature, Primary recipients, Copy recipients, Office note |
| **SHA-256** | Computed after generation and returned |

#### SRS-FR-041: Content Modification via AI Prompt

| Attribute | Value |
|---|---|
| **ID** | SRS-FR-041 |
| **Input** | Current document content (text), natural language instruction |
| **Processing** | Ollama chat with administrative domain prompt; rule-based fallback |
| **Output** | Updated document text |
| **Examples** | "Change taluk to Perundurai", "Update amount to 5,00,000" |

#### SRS-FR-042: DOCX-to-PDF Conversion

| Attribute | Value |
|---|---|
| **ID** | SRS-FR-042 |
| **Input** | Generated .docx file path |
| **Processing** | Convert via LibreOffice headless or python-pptx |
| **Output** | Layout-identical .pdf file |

### 3.6 Template Management Module

#### SRS-FR-050: List Templates

| Attribute | Value |
|---|---|
| **Endpoint** | `GET /api/templates?department=&category=` |
| **Access** | All authenticated users |
| **Filters** | By department, by category |
| **Output** | Array of template objects (id, code, name, description, department, category, status) |

#### SRS-FR-051: Create Template

| Attribute | Value |
|---|---|
| **Endpoint** | `POST /api/templates` |
| **Access** | Admin only |
| **Input** | Template payload (code, name, description, department, category, body_template, subject_template) |
| **Output** | Created template object |

#### SRS-FR-052: Update Template

| Attribute | Value |
|---|---|
| **Endpoint** | `PUT /api/templates/{template_id}` |
| **Access** | Admin only |
| **Input** | Updated fields |
| **Output** | Updated template object |

#### SRS-FR-053: Delete Template

| Attribute | Value |
|---|---|
| **Endpoint** | `DELETE /api/templates/{template_id}` |
| **Access** | Admin only |
| **Processing** | Soft delete (deactivate) |
| **Output** | Success confirmation |

#### SRS-FR-054: Render Template Preview

| Attribute | Value |
|---|---|
| **Endpoint** | `POST /api/templates/{template_id}/render` |
| **Input** | Entities context |
| **Output** | Rendered template text |

### 3.7 User Management Module

#### SRS-FR-060: List Users

| Attribute | Value |
|---|---|
| **Endpoint** | `GET /api/users?query=&role=&status=` |
| **Access** | All authenticated users |
| **Filters** | Search query, role, status |
| **Output** | Array of user objects (sanitized — no passwords) |

#### SRS-FR-061: Create User

| Attribute | Value |
|---|---|
| **Endpoint** | `POST /api/users` |
| **Access** | Admin only |
| **Input** | name, email, role (admin/user), password |
| **Validation** | Email uniqueness, password strength |

#### SRS-FR-062: Update User

| Attribute | Value |
|---|---|
| **Endpoint** | `PUT /api/users/{user_id}` |
| **Access** | Admin: can edit any user, all fields. Regular user: can only edit own profile (name, contact). |
| **Authorization** | `x-user-role` and `x-user-id` headers |

#### SRS-FR-063: Delete User

| Attribute | Value |
|---|---|
| **Endpoint** | `DELETE /api/users/{user_id}` |
| **Access** | Admin only |

### 3.8 Audit Trail Module

#### SRS-FR-070: Get Audit Logs

| Attribute | Value |
|---|---|
| **Endpoint** | `GET /api/audit-logs` |
| **Output** | All audit entries grouped by month |
| **Fields per entry** | id, caseNumber, rocNumber, defaulterName, amount, taluk, district, officerName, status, templateCode, fileName, fileSize, sha256Digest, groundingScore, hallucinationScore, timestamp, entities (full JSON) |

#### SRS-FR-071: Save Audit Entry

| Attribute | Value |
|---|---|
| **Endpoint** | `POST /api/audit-logs` |
| **Processing** | Upsert: updates if exists, creates if new |
| **Timestamp** | Auto-generated server-side |

#### SRS-FR-072: DRO Dispatch Recording

| Attribute | Value |
|---|---|
| **Endpoint** | `POST /api/dispatch-dro` |
| **Input** | Audit entry with entities data |
| **Processing** | Generates DRO receipt ID; sets status to DISPATCHED_TO_DRO; persists to PostgreSQL |
| **Output** | Receipt ID, success confirmation |
| **Precondition** | Hallucination check (<0.20 recommended; warns if exceeded) |

### 3.9 Chat Module

#### SRS-FR-080: RAG Semantic Chat

| Attribute | Value |
|---|---|
| **Endpoint** | `POST /api/chat` |
| **Input** | query (text), context (extracted entities + OCR text) |
| **Processing** | Pattern-match query against entity fields; construct grounded response |
| **Output** | answer (text), citations (array of bounding box references) |
| **Precondition** | A document has been processed (case_number must exist in context) |

---

## 4. External Interface Requirements

### 4.1 User Interfaces

| Screen | Description |
|---|---|
| **Login Page** | Email/password authentication with role display |
| **RR Assistant View** | Chat-style landing page for starting new proceedings |
| **Upload Landing** | Drag-and-drop file upload with sample document option |
| **Processing Overlay** | Full-screen overlay showing 6-step pipeline progress |
| **Document Editor** | Split view: editable Tamil proceedings text (left) + AI prompt input (right) |
| **Inspection View** | Three-column: OCR bounding boxes (left), entity form (center), RAG chat (right) |
| **Audit Log View** | Tabular list of all proceedings grouped by month |
| **Admin Dashboard** | User management, template management, system overview |
| **Profile Page** | View/edit own profile details |

### 4.2 Software Interfaces

| Interface | Protocol | Description |
|---|---|---|
| **Datalab Chandra OCR v2** | HTTPS REST | OCR API for Tamil+English text extraction |
| **Ollama API** | HTTP (localhost:11434) | Local LLM inference for entity extraction |
| **PostgreSQL** | TCP/IP (port 5432) | Persistent storage for all application data |
| **File System** | Local I/O | uploads/, outputs/, templates/, models/ directories |

### 4.3 Communication Interfaces

| Interface | Protocol | Port |
|---|---|---|
| Frontend → Backend | HTTP/REST | 8000 (configurable) |
| Backend → PostgreSQL | PostgreSQL wire protocol | 5432 |
| Backend → Ollama | HTTP | 11434 |
| Backend → Chandra OCR | HTTPS | 443 |

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements

| ID | Requirement | Metric | Target |
|---|---|---|---|
| NFR-P01 | Pipeline end-to-end latency | Time from upload to DOCX ready | < 60 seconds (5-page PDF) |
| NFR-P02 | OCR processing time | Per page | < 25 seconds |
| NFR-P03 | LLM extraction time | Total | < 20 seconds |
| NFR-P04 | Document generation time | DOCX creation | < 5 seconds |
| NFR-P05 | API response time (non-pipeline) | p95 latency | < 500 ms |
| NFR-P06 | Concurrent users | Simultaneous active sessions | 10 |
| NFR-P07 | Database query time | p95 latency | < 100 ms |

### 5.2 Security Requirements

| ID | Requirement | Detail |
|---|---|---|
| NFR-S01 | Data Sovereignty | All PII and document data stays on-premises |
| NFR-S02 | Authentication | Role-based login (username/password) |
| NFR-S03 | Authorization | RBAC: Admin (full access), User (limited access) |
| NFR-S04 | Input Validation | File type whitelist, filename sanitization, size limits |
| NFR-S05 | SQL Injection Prevention | Parameterized queries only |
| NFR-S06 | Path Traversal Prevention | `os.path.basename()` on all file operations |
| NFR-S07 | CORS | Restrict to deployment origin in production |
| NFR-S08 | Document Integrity | SHA-256 hash per generated document |
| NFR-S09 | Audit Immutability | Append-only audit entries |
| NFR-S10 | Sensitive Data | Passwords hashed; no plaintext storage |

### 5.3 Reliability Requirements

| ID | Requirement | Detail |
|---|---|---|
| NFR-R01 | OCR Resilience | Automatic failover: Chandra v2 → PaddleOCR v4 ONNX |
| NFR-R02 | LLM Resilience | Automatic fallback: qwen2.5:3b-instruct → qwen2.5:3b |
| NFR-R03 | Database Connection | Connection pooling with auto-reconnect |
| NFR-R04 | Error Handling | No uncaught exceptions; all errors return JSON with descriptive messages |
| NFR-R05 | System Uptime | Target: 99.5% during office hours (9 AM – 6 PM IST) |

### 5.4 Maintainability Requirements

| ID | Requirement | Detail |
|---|---|---|
| NFR-M01 | Modularity | Pipeline steps are independent, swappable modules |
| NFR-M02 | Configuration | All settings via environment variables / .env file |
| NFR-M03 | Logging | Structured logging at INFO level minimum |
| NFR-M04 | Code Quality | Type hints (Python), JSDoc (JavaScript) |
| NFR-M05 | Testing | Unit tests for pipeline, validation engine, and API endpoints |

### 5.5 Portability Requirements

| ID | Requirement | Detail |
|---|---|---|
| NFR-PT01 | OS Independence | Runs on Linux (Ubuntu 20.04+) and Windows Server 2019+ |
| NFR-PT02 | Browser Independence | Chrome, Firefox, Edge (latest 2 major versions) |
| NFR-PT03 | Database | PostgreSQL 14+ |

---

## 6. Data Requirements

### 6.1 Data Flow Diagram

```
                    ┌──────────────┐
                    │  Court Order  │
                    │  (PDF/Image)  │
                    └──────┬───────┘
                           │ Upload
                           ▼
                    ┌──────────────┐      ┌──────────────┐
                    │  Ingestion   │─────►│   OCR        │
                    │  Engine      │      │   Engine     │
                    └──────────────┘      └──────┬───────┘
                                                  │ Raw Text + Boxes
                                                  ▼
                    ┌──────────────┐      ┌──────────────┐
                    │  Validated   │◄─────│   LLM        │
                    │  Entities    │      │   Extractor  │
                    └──────┬───────┘      └──────────────┘
                           │
                    ┌──────┴───────┐
                    │  Validation  │
                    │  Engine      │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  DOCX    │ │  Audit   │ │  API     │
        │  File    │ │  Log     │ │  Response│
        └──────────┘ └──────────┘ └──────────┘
```

### 6.2 Data Dictionary

#### 6.2.1 Core Entities

| Entity | Cardinality | Storage | Description |
|---|---|---|---|
| **User** | 1..* | PostgreSQL | System user accounts |
| **Template** | 1..* | PostgreSQL | Proceedings document templates |
| **AuditEntry** | 0..* | PostgreSQL | Immutable proceedings activity log |
| **UploadedFile** | 0..* | File System | Uploaded court order documents |
| **GeneratedDocument** | 0..* | File System | Generated .docx proceedings |
| **ExtractedEntities** | 1 per processing | In-memory / JSON | Structured entities from LLM |

#### 6.2.2 User Table Schema

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique user identifier |
| name | VARCHAR(255) | NOT NULL | Full name |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Login email |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| role | VARCHAR(20) | NOT NULL, DEFAULT 'user' | 'admin' or 'user' |
| status | VARCHAR(20) | DEFAULT 'active' | 'active' or 'inactive' |
| designation | VARCHAR(255) | | Official designation |
| department | VARCHAR(255) | | Department name |
| phone | VARCHAR(20) | | Contact phone |
| created_at | TIMESTAMP | DEFAULT NOW() | Account creation timestamp |
| updated_at | TIMESTAMP | | Last modification timestamp |

#### 6.2.3 Template Table Schema

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique template identifier |
| template_code | VARCHAR(100) | UNIQUE, NOT NULL | Machine-readable code |
| name | VARCHAR(255) | NOT NULL | Human-readable name |
| description | TEXT | | Template description |
| department | VARCHAR(100) | NOT NULL | MCOP, CUSTOMS, RERA, WARRANT |
| category | VARCHAR(100) | | Sub-category |
| body_template | TEXT | NOT NULL | Jinja2/mustache template body |
| subject_template | TEXT | | Subject line template |
| is_active | BOOLEAN | DEFAULT TRUE | Soft delete flag |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | | Last modification timestamp |

#### 6.2.4 Audit Entry Table Schema

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | VARCHAR(100) | PK | Unique audit entry ID |
| case_number | VARCHAR(255) | NOT NULL | Case/petition number |
| roc_number | VARCHAR(255) | | ROC proceedings number |
| defaulter_name | VARCHAR(500) | | Defaulter name |
| amount | VARCHAR(100) | | Formatted recovery amount |
| taluk | VARCHAR(100) | | Target taluk |
| district | VARCHAR(100) | | District name |
| officer_name | VARCHAR(255) | | Processing officer name |
| status | VARCHAR(50) | NOT NULL | DRAFT / VERIFIED / DISPATCHED |
| template_code | VARCHAR(100) | | Template used |
| file_name | VARCHAR(255) | | Uploaded file name |
| file_size | VARCHAR(50) | | File size |
| sha256_digest | VARCHAR(100) | | SHA-256 hash of generated doc |
| grounding_score | FLOAT | | AI grounding score (0.0–1.0) |
| hallucination_score | FLOAT | | AI hallucination score (0.0–1.0) |
| dispatch_receipt | VARCHAR(100) | | DRO dispatch receipt ID |
| entities_json | JSONB | | Full extracted entities snapshot |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | | Last update timestamp |

### 6.3 Data Retention

| Data Type | Retention Period | Storage |
|---|---|---|
| Audit Entries | Permanent (legal requirement) | PostgreSQL |
| Generated Documents | 7 years (per government archival policy) | File System |
| Uploaded Source Files | 90 days (configurable) | File System |
| User Accounts | Active until deleted | PostgreSQL |
| Templates | Permanent (soft delete) | PostgreSQL |

---

## 7. Traceability Matrix

| SRS Requirement | PRD Feature | Test Case |
|---|---|---|
| SRS-FR-001 (File Upload) | F1 | TC-001: Upload valid PDF |
| SRS-FR-002 (Doc Rendering) | F1 | TC-002: Render multi-page PDF |
| SRS-FR-010 (Chandra OCR) | F2 | TC-010: OCR Tamil+English PDF |
| SRS-FR-011 (PaddleOCR Fallback) | F2 | TC-011: OCR without internet |
| SRS-FR-020 (Entity Extraction) | F3 | TC-020: Extract MCOP entities |
| SRS-FR-021 (Dept Classification) | F10 | TC-021: Classify Customs doc |
| SRS-FR-030 (Math Validation) | F4 | TC-030: Verify amount totals |
| SRS-FR-032 (Tamil Words) | F4 | TC-032: Amount to Tamil words |
| SRS-FR-033 (Jurisdiction) | F5 | TC-033: Route to correct taluk |
| SRS-FR-034 (Grounding Score) | F15 | TC-034: Compute grounding |
| SRS-FR-040 (DOCX Generation) | F6 | TC-040: Generate MCOP proceedings |
| SRS-FR-041 (AI Prompt Modify) | F16 | TC-041: Change taluk via prompt |
| SRS-FR-050..053 (Templates) | F11 | TC-050: Template CRUD |
| SRS-FR-060..063 (Users) | F12 | TC-060: User CRUD |
| SRS-FR-070..072 (Audit) | F13, F14 | TC-070: Audit log recording |
| SRS-FR-080 (RAG Chat) | F17 | TC-080: Chat query |

---

*This SRS is version-controlled and maintained alongside the codebase. Any changes require review by the Product Owner and Technical Lead.*
