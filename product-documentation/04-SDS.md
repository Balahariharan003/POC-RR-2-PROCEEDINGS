# Software Design Specification (SDS)

> **Document ID**: RR-SDS-001  
> **Version**: 2.0  
> **Date**: 2026-09-28  
> **Product**: AI Administrative Co-Pilot — RR Assistant  
> **Standard**: IEEE 1016  
> **Status**: APPROVED  
> **Classification**: Internal — Confidential

---

## 1. Introduction

### 1.1 Purpose

This Software Design Specification (SDS) describes the software architecture, component design, data structures, algorithms, and interface specifications for the AI Administrative Co-Pilot — RR Assistant. It translates the requirements from the SRS (RR-SRS-001) into a detailed technical design that guides implementation.

### 1.2 Scope

This document covers:
- System architecture and technology stack
- Backend component design (Python/FastAPI)
- Frontend component design (React/Vite)
- Database design (PostgreSQL)
- AI/ML pipeline design (OCR + LLM)
- API specification
- Security design
- Deployment architecture

---

## 2. System Architecture

### 2.1 Architecture Style

The system follows a **Modular Monolith** architecture with clear module boundaries, deployed as a single backend process + static frontend bundle. This is appropriate for the single-district deployment model and avoids microservice complexity.

### 2.2 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RR ASSISTANT SYSTEM ARCHITECTURE                     │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────┐            │
│  │                     PRESENTATION LAYER                       │            │
│  │                                                              │            │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐   │            │
│  │  │  Login     │  │  RR Asst.  │  │  Admin Workspace     │   │            │
│  │  │  Page      │  │  View      │  │  (Users/Templates)   │   │            │
│  │  └────────────┘  └────────────┘  └──────────────────────┘   │            │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐   │            │
│  │  │  Upload    │  │  Document  │  │  Audit Log View      │   │            │
│  │  │  Landing   │  │  Workspace │  │                      │   │            │
│  │  └────────────┘  └────────────┘  └──────────────────────┘   │            │
│  │                                                              │            │
│  │  ┌─────────────────────────────────────────────────────┐    │            │
│  │  │              API Service Layer (apiService.js)       │    │            │
│  │  └─────────────────────────┬───────────────────────────┘    │            │
│  └────────────────────────────┼─────────────────────────────────┘            │
│                               │ REST API (HTTP/JSON)                         │
│  ┌────────────────────────────┼─────────────────────────────────┐            │
│  │                     APPLICATION LAYER                         │            │
│  │                                                               │            │
│  │  ┌────────────────────────────────────────────────────────┐  │            │
│  │  │                 FastAPI Application (api.py)            │  │            │
│  │  │                                                        │  │            │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │            │
│  │  │  │ Document │ │ Template │ │ User     │ │ Audit    │  │  │            │
│  │  │  │ Routes   │ │ Routes   │ │ Routes   │ │ Routes   │  │  │            │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │  │            │
│  │  └────────────────────────────────────────────────────────┘  │            │
│  │                                                               │            │
│  │  ┌────────────────────────────────────────────────────────┐  │            │
│  │  │              PIPELINE ORCHESTRATOR (pipeline.py)        │  │            │
│  │  │                                                        │  │            │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐              │  │            │
│  │  │  │ Step 1:  │ │ Step 2:  │ │ Step 3:  │              │  │            │
│  │  │  │ Ingest   │►│ OCR      │►│ LLM      │              │  │            │
│  │  │  └──────────┘ └──────────┘ └──────────┘              │  │            │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐              │  │            │
│  │  │  │ Step 4:  │ │ Step 5:  │ │ Step 6:  │              │  │            │
│  │  │  │ Validate │►│ Generate │►│ Audit    │              │  │            │
│  │  │  └──────────┘ └──────────┘ └──────────┘              │  │            │
│  │  └────────────────────────────────────────────────────────┘  │            │
│  └──────────────────────────────────────────────────────────────┘            │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────┐            │
│  │                      DATA LAYER                               │            │
│  │                                                               │            │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │            │
│  │  │  PostgreSQL  │  │  File System │  │  Ollama Runtime  │   │            │
│  │  │  (Users,     │  │  (uploads/,  │  │  (qwen2.5:3b-    │   │            │
│  │  │  Templates,  │  │   outputs/,  │  │   instruct)      │   │            │
│  │  │  Audit Logs) │  │   models/)   │  │                  │   │            │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │            │
│  └──────────────────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend** | React | 18.x | UI Component Framework |
| **Build Tool** | Vite | 5.x | Frontend build and dev server |
| **Styling** | CSS (Vanilla) | - | Custom design system |
| **Backend** | Python | 3.10+ | Server-side logic |
| **API Framework** | FastAPI | 0.100+ | REST API endpoints |
| **ASGI Server** | Uvicorn | 0.23+ | Production ASGI server |
| **Database** | PostgreSQL | 14+ | Persistent storage |
| **ORM** | Raw SQL (psycopg2) | - | Direct DB queries |
| **LLM Runtime** | Ollama | Latest | Local LLM inference |
| **LLM Model** | qwen2.5:3b-instruct | 3B params | Entity extraction |
| **OCR (Primary)** | Datalab Chandra v2 | API | Tamil+English OCR |
| **OCR (Fallback)** | RapidOCR + PP-OCRv4 | ONNX | Offline Tamil OCR |
| **Document Gen** | python-docx | 0.8+ | DOCX generation |
| **Data Validation** | Pydantic | 2.x | Schema validation |

---

## 3. Backend Component Design

### 3.1 Module Dependency Graph

```
api.py (FastAPI Application)
├── config.py (Configuration)
├── db.py (Database Connection & Schema)
├── pipeline.py (Pipeline Orchestrator)
│   ├── ingestion.py (Document Ingestion)
│   ├── ocr_engine.py (OCR Extraction)
│   ├── llm_extractor.py (LLM Entity Extraction)
│   ├── validation_engine.py (Validation & Insights)
│   └── doc_generator.py (DOCX Generation)
├── schemas.py (Pydantic Data Models)
├── templates_store.py (Template CRUD)
├── user_store.py (User CRUD)
├── audit_store.py (Audit Log Operations)
└── template_builder.py (Template Rendering)
```

### 3.2 Component Details

#### 3.2.1 `config.py` — Configuration Module

**Responsibility**: Centralized configuration management via environment variables.

**Design Decisions**:
- Environment variables with sensible defaults for dev
- Dual `.env` file loading: `Backend/.env` (local override) + project root `.env`
- All paths computed relative to `BASE_DIR`
- Required directories auto-created on import

**Key Configuration Groups**:

| Group | Variables | Default |
|---|---|---|
| **Paths** | UPLOAD_DIR, OUTPUT_DIR, TEMPLATE_DIR, MODELS_DIR | `Backend/{dir}/` |
| **OCR** | CHANDRA_OCR_URL, CHANDRA_OCR_MODE, DATALAB_API_KEY | balance mode |
| **LLM** | OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_FALLBACK_MODEL | localhost:11434, qwen2.5:3b-instruct |
| **Typography** | PRIMARY_FONT_TAMIL, FALLBACK_FONT_TAMIL, LATIN_FONT | TAU-Marutham |
| **Database** | PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE | localhost:5432, rr_proceedings_db |
| **Server** | HOST, PORT | 127.0.0.1:8000 |

#### 3.2.2 `pipeline.py` — Pipeline Orchestrator

**Responsibility**: Coordinates the 6-step document processing pipeline.

**Class**: `RevenueRecoveryPipeline`

```python
class RevenueRecoveryPipeline:
    """Orchestrates the end-to-end document processing pipeline."""
    
    def __init__(self):
        self.ingestion_engine: DocumentIngestionEngine
        self.ocr_engine: OCRExtractionEngine
        self.llm_extractor: LLMExtractor
        self.validation_engine: ValidationInsightEngine
        self.doc_generator: DocumentGenerator
    
    def process_document(
        self,
        file_path: Path,
        custom_output_name: Optional[str] = None,
        template_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Pipeline Steps:
        1. Ingest document → page images
        2. OCR extraction → raw text + bounding boxes
        3. LLM extraction → structured entities
        4. Validation → math check, jurisdiction, interest
        5. DOCX generation → TAU-Marutham proceedings
        6. Audit recording → PostgreSQL ledger
        
        Returns: Complete pipeline result with timing metrics
        """
```

**Pipeline Flow (Sequence)**:

```
process_document(file_path)
│
├── Step 1: ingestion_engine.ingest_document(file_path)
│   └── Returns: List[PageData] (images)
│
├── Step 2a: ingestion_engine.extract_direct_pdf_text(file_path)
│   └── Returns: str (embedded text)
│
├── Step 2b: ocr_engine.extract_all_pages(pages_data)
│   └── Returns: {combined_text, pages: [{lines: [{text, bbox, confidence}]}]}
│   └── Falls back to direct text if OCR yields nothing
│
├── Step 3: llm_extractor.extract_entities(raw_text)
│   └── Returns: ExtractedLegalEntities (Pydantic model)
│
├── Step 4: validation_engine.validate_and_enrich(entities)
│   └── Returns: (validated_entities, ValidationResult)
│   └── Auto-corrects math, adds Tamil words, routes jurisdiction
│
├── Step 5: doc_generator.generate_proceedings(entities, validation, template_code)
│   └── Returns: Path to generated .docx
│   └── Computes SHA-256 hash
│
├── Step 6: audit_store.save_audit_entry(audit_entry)
│   └── Persists to PostgreSQL
│
└── Returns: {success, entities, validation_insights, generated_docx_path, 
              bounding_boxes, timing_metrics, sha256_digest}
```

**Timing Instrumentation**: Each step is individually timed and reported in `timing_metrics`.

#### 3.2.3 `ingestion.py` — Document Ingestion Engine

**Responsibility**: Convert uploaded files to processable page images.

**Key Methods**:
- `ingest_document(file_path)` → Convert PDF pages to images at configurable DPI
- `extract_direct_pdf_text(file_path)` → Extract embedded text layer from digital PDFs

**Design**: Uses `pdf2image` (poppler) for PDF→image conversion. Images passed directly.

#### 3.2.4 `ocr_engine.py` — OCR Extraction Engine

**Responsibility**: Extract text with spatial information from page images.

**Design Pattern**: **Strategy Pattern** with automatic failover.

```
┌─────────────────────────────────────────────────┐
│              OCRExtractionEngine                 │
│                                                  │
│  extract_all_pages(pages_data)                   │
│  │                                               │
│  ├── Try: Chandra OCR v2 (cloud API)             │
│  │   └── POST /v1/ocr with image                 │
│  │   └── Timeout: 25s                            │
│  │                                               │
│  └── Catch: PaddleOCR v4 ONNX (local)           │
│      └── RapidOCR with PP-OCRv4 models           │
│      └── Tamil detection + recognition           │
│                                                  │
│  Output: {combined_text, pages, ocr_engine}      │
└─────────────────────────────────────────────────┘
```

#### 3.2.5 `llm_extractor.py` — LLM Entity Extraction

**Responsibility**: Extract structured legal entities from raw OCR text using a local LLM.

**Design**:
- System prompt provides Tamil legal domain context
- JSON output schema derived from Pydantic model
- Temperature 0.1 for deterministic extraction
- Strict Pydantic validation on LLM response
- Up to 2 retries with fallback model

**Prompt Engineering Strategy**:
```
System: "You are a Tamil Nadu Government legal document extraction expert.
Extract the following structured fields from the court order text.
Output strictly valid JSON matching the provided schema.
Do NOT invent or hallucinate information not present in the text."

User: "{raw_ocr_text}"

Expected Output: ExtractedLegalEntities JSON
```

#### 3.2.6 `validation_engine.py` — Validation & Insight Engine

**Responsibility**: Post-extraction validation, enrichment, and quality scoring.

**Class**: `ValidationInsightEngine`

**Validations Performed**:

| # | Validation | Logic |
|---|---|---|
| V1 | Math Check | total == principal + penalty (±0.01) |
| V2 | Auto-correct Total | If total=0, set total = principal + penalty |
| V3 | Interest Calculation | Simple interest if rate and start_date present |
| V4 | Tamil Amount Words | Numeric → Tamil word conversion |
| V5 | Jurisdiction Routing | Address → Taluk → Tahsildar mapping |
| V6 | Grounding Score | Entity values found in OCR text / total values |
| V7 | Hallucination Score | 1.0 - grounding_score |
| V8 | Department Type | Classify from legal acts / court name |

#### 3.2.7 `doc_generator.py` — Document Generator

**Responsibility**: Generate government-compliant DOCX proceedings.

**Design Decisions**:
- **TAU-Marutham font exclusively** — applied to every `Run` object
- Template selection based on `department_type`
- Section structure follows official TN government proceedings format
- `generate_docx_from_content()` — exports any text to DOCX
- `convert_docx_to_pdf()` — DOCX → PDF via LibreOffice headless

**Document Structure**:
```
╔══════════════════════════════════════════════════════════════╗
║  DISTRICT COLLECTOR & DISTRICT MAGISTRATE PROCEEDINGS       ║
║  (மாவட்ட ஆட்சித் தலைவர் செயல்முறைகள்)                      ║
╠══════════════════════════════════════════════════════════════╣
║  முன்னிலை: [Collector Name, IAS]                            ║
║                                                              ║
║  ந.க. [ROC Number]          நாள்: [Date]                    ║
║                                                              ║
║  பொருள்: [Subject — legal citation and recovery request]     ║
║                                                              ║
║  பார்வை: 1. [Reference 1 — court/authority]                  ║
║          2. [Reference 2 — standing order]                    ║
║                                                              ║
║  உத்தரவு: [Order body — recovery directive]                  ║
║                                                              ║
║  இணைப்பு: [Enclosures list]                                  ║
║                                                              ║
║                          மாவட்ட ஆட்சித் தலைவர்,               ║
║                          [District Name].                     ║
║                                                              ║
║  பெறுநர்: [Primary recipients — Tahsildar, RDO]              ║
║  நகல்: [Copy to — beneficiary, defaulter, court]             ║
║                                                              ║
║  ═══════════════════════════════════════════════════════      ║
║  //அலுவலகக் குறிப்பு// (Office Note)                        ║
║  [Internal section officer note for Collector's approval]     ║
║  ஒப்பம்/– பிரிவு எழுத்தர் / கண்காணிப்பாளர்                  ║
╚══════════════════════════════════════════════════════════════╝
```

#### 3.2.8 Data Store Modules

| Module | Storage | Operations |
|---|---|---|
| `templates_store.py` | PostgreSQL | list, get, create, update, delete, render |
| `user_store.py` | PostgreSQL | list, get, create, update, delete (with RBAC) |
| `audit_store.py` | PostgreSQL | get_all, save (upsert), grouped by month |
| `db.py` | PostgreSQL | Connection pool, schema creation, `execute_query()` helper |

---

## 4. Frontend Component Design

### 4.1 Component Hierarchy

```
App.jsx (Root State Machine)
├── LoginPage
├── AppHeader
│   ├── Language Toggle (EN/TA)
│   ├── Theme Toggle (Dark/Light)
│   └── Backend Status Indicator
├── Sidebar
│   ├── Navigation Links
│   └── Recent Cases Quick Access
├── RRAssistantView (Chat-style Landing)
├── UploadLanding
│   ├── DropZone
│   └── Sample Document Link
├── ProcessingOverlay (6-step Progress)
├── Document Workspace
│   ├── Editor Mode (DocumentEditorPreview)
│   │   ├── Tamil Proceedings Text Editor
│   │   └── AI Prompt Input Panel
│   └── Inspection Mode
│       ├── DocumentViewer (OCR + Bounding Boxes)
│       ├── FullDetailsForm (Entity Editor)
│       └── SummaryChatView (RAG Chat)
├── AuditLogView
├── AdminWorkspace
│   ├── Admin Dashboard
│   ├── Admin Users Panel
│   ├── Admin Templates Panel
│   └── Backup & Restore
├── OfficialProfile
├── Modals
│   ├── ProceedingsPreviewModal
│   ├── DispatchReceiptModal
│   └── MobileQrModal
└── MobileCapturePage (/capture/:sessionId)
```

### 4.2 State Management

The application uses **React `useState` hooks** at the root `App.jsx` level (lifting state up pattern). No external state management library is needed given the application's scope.

**Key State Variables**:

| State | Type | Purpose |
|---|---|---|
| `currentUser` | Object \| null | Authentication state. null = show login. |
| `activeView` | string | Current view routing (rrAssistant \| workspace \| audit \| admin*) |
| `workspaceMode` | string | Workspace sub-view (editor \| inspection) |
| `currentEntities` | Object | Extracted entities from pipeline |
| `validationInsights` | Object | Grounding/hallucination scores, math check results |
| `documentContent` | string | Formatted Tamil proceedings text (editable) |
| `rawOcrText` | string | Raw OCR extracted text |
| `boundingBoxes` | Array | OCR bounding box coordinates |
| `isProcessing` | boolean | Pipeline processing state |
| `auditLogs` | Object | Cached audit log entries grouped by month |

### 4.3 Data Flow

```
User uploads file
    │
    ▼
apiService.uploadDocument(file)
    │  POST /api/process-document (FormData)
    ▼
Pipeline result received
    │
    ▼
applyPipelineResult(result)
    ├── setCurrentEntities(result.entities)
    ├── setValidationInsights(result.validation_insights)
    ├── setBoundingBoxes(result.bounding_boxes)
    ├── setDocumentContent(formatDocumentSheet(entities))
    └── setActiveView('workspace')
```

### 4.4 API Service Layer (`apiService.js`)

**Design Pattern**: **Service Object Pattern** with **offline fallback**.

Every API method follows this pattern:
```
async method(args) {
    try {
        const response = await fetch(API_BASE + endpoint, ...);
        if (response.ok) return processedResult;
    } catch (error) {
        // Graceful offline fallback
    }
    return simulatedResult; // Never leaves user stuck
}
```

**Key Methods**:

| Method | Endpoint | Purpose |
|---|---|---|
| `checkHealth()` | GET /api/health | System status check |
| `uploadDocument(file)` | POST /api/process-document | Full pipeline execution |
| `regenerateDocument(entities)` | POST /api/regenerate-document | Re-gen from edited entities |
| `regenerateWithPrompt(prompt, entities)` | POST /api/regenerate-with-prompt | AI instruction-based edit |
| `modifyContent(content, instruction)` | POST /api/modify-content | NL instruction on doc text |
| `exportDocx(content, filename)` | POST /api/export-docx | Export current editor content |
| `dispatchOrder(payload)` | POST /api/dispatch | Proceedings dispatch recording |
| `askRAGChat(query, context)` | POST /api/chat | Semantic Q&A |
| `getTemplates()` | GET /api/templates | List all templates |
| `getAuditLogs()` | Local + API | Get proceedings history |
| `formatDocumentSheet(entities)` | Client-side | Format entities → Tamil text |

---

## 5. Database Design

### 5.1 Entity-Relationship Diagram

```
┌──────────────────┐         ┌──────────────────┐
│      users       │         │    templates     │
├──────────────────┤         ├──────────────────┤
│ PK id (UUID)     │         │ PK id (UUID)     │
│    name          │         │    template_code │
│    email (UNIQ)  │         │    name          │
│    password_hash │         │    description   │
│    role          │         │    department    │
│    status        │         │    category      │
│    designation   │         │    body_template │
│    department    │         │    subject_tmpl  │
│    phone         │         │    is_active     │
│    created_at    │         │    created_at    │
│    updated_at    │         │    updated_at    │
└──────────────────┘         └──────────────────┘

┌──────────────────────────────────────────────────┐
│                  audit_entries                     │
├──────────────────────────────────────────────────┤
│ PK id (VARCHAR)                                   │
│    case_number                                    │
│    roc_number                                     │
│    defaulter_name                                 │
│    amount                                         │
│    taluk                                          │
│    district                                       │
│    officer_name                                   │
│    status (DRAFT | VERIFIED | DISPATCHED)         │
│    template_code → FK templates.template_code     │
│    file_name                                      │
│    file_size                                      │
│    sha256_digest                                  │
│    grounding_score                                │
│    hallucination_score                            │
│    dispatch_receipt                               │
│    entities_json (JSONB)                          │
│    created_at                                     │
│    updated_at                                     │
└──────────────────────────────────────────────────┘

┌──────────────────┐
│   app_settings   │
├──────────────────┤
│ PK key (VARCHAR) │
│    value (TEXT)   │
│    updated_at    │
└──────────────────┘
```

### 5.2 Index Strategy

| Table | Index | Columns | Purpose |
|---|---|---|---|
| users | idx_users_email | email | Login lookup |
| users | idx_users_role | role | Filter by role |
| templates | idx_templates_code | template_code | Lookup by code |
| templates | idx_templates_dept | department | Filter by department |
| audit_entries | idx_audit_case | case_number | Case lookup |
| audit_entries | idx_audit_status | status | Filter by status |
| audit_entries | idx_audit_created | created_at DESC | Recent-first listing |
| audit_entries | idx_audit_district | district | District filter |

### 5.3 Connection Management

```python
# db.py - Connection Pool Design
import psycopg2
from psycopg2 import pool

connection_pool = pool.ThreadedConnectionPool(
    minconn=2,
    maxconn=10,
    host=PG_HOST,
    port=PG_PORT,
    user=PG_USER,
    password=PG_PASSWORD,
    database=PG_DATABASE
)

def execute_query(sql, params=None, fetch_one=False, fetch_all=False):
    """Thread-safe query execution with connection pooling."""
    conn = connection_pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(sql, params)
            if fetch_one: return dict(cursor.fetchone())
            if fetch_all: return [dict(row) for row in cursor.fetchall()]
            conn.commit()
    finally:
        connection_pool.putconn(conn)
```

---

## 6. API Specification

### 6.1 API Endpoint Summary

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | None | System health check |
| POST | `/api/process-document` | User | Full pipeline processing |
| POST | `/api/regenerate-document` | User | Re-generate from edited entities |
| POST | `/api/modify-content` | User | NL instruction-based edit |
| POST | `/api/export-docx` | User | Export editor content to DOCX |
| GET | `/api/download/{filename}` | User | Download generated DOCX |
| GET | `/api/download-pdf/{filename}` | User | Convert and download as PDF |
| GET | `/api/templates` | User | List templates |
| GET | `/api/templates/{id}` | User | Get template detail |
| POST | `/api/templates` | Admin | Create template |
| PUT | `/api/templates/{id}` | Admin | Update template |
| DELETE | `/api/templates/{id}` | Admin | Delete template |
| POST | `/api/templates/{id}/render` | User | Render template preview |
| GET | `/api/users` | User | List users |
| POST | `/api/users` | Admin | Create user |
| PUT | `/api/users/{id}` | User* | Update user (*RBAC restricted) |
| DELETE | `/api/users/{id}` | Admin | Delete user |
| GET | `/api/audit-logs` | User | Get all audit logs |
| POST | `/api/audit-logs` | User | Save audit entry |
| POST | `/api/dispatch` | User | Proceedings dispatch recording |
| POST | `/api/chat` | User | RAG semantic chat |

### 6.2 Key API Request/Response Examples

#### POST /api/process-document

**Request**: `multipart/form-data`
```
file: <binary PDF/image>
template_code: "mcop_form5" (optional)
```

**Response** (200):
```json
{
  "success": true,
  "input_file": "uploads/upload_court_order.pdf",
  "pages_processed": 3,
  "raw_ocr_text": "...(extracted text)...",
  "bounding_boxes": [
    {"id": "box-p1-0", "page": 1, "label": "MCOP No. 109/2022", "confidence": 0.97, "box": [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]}
  ],
  "ocr_engine": "Chandra-v2-Balance",
  "entities": { /* ExtractedLegalEntities */ },
  "validation_insights": {
    "math_valid": true,
    "grounding_score": 0.95,
    "hallucination_score": 0.05,
    "tamil_amount_words": "நான்கு இலட்சத்து..."
  },
  "generated_docx_path": "outputs/proceedings_MCOP_109_2022.docx",
  "generated_docx_filename": "proceedings_MCOP_109_2022.docx",
  "sha256_digest": "sha256:a1b2c3...",
  "timing_metrics": {
    "step1_ingestion_sec": 0.45,
    "step2_ocr_sec": 12.3,
    "step3_llm_extraction_sec": 8.7,
    "step4_validation_sec": 0.1,
    "step5_docx_generation_sec": 1.2,
    "total_pipeline_sec": 22.8
  }
}
```

---

## 7. Security Design

### 7.1 Authentication & Authorization

```
┌──────────────────────────────────────────────────────┐
│                SECURITY ARCHITECTURE                  │
│                                                       │
│  ┌─────────────┐       ┌─────────────────────────┐   │
│  │   Browser    │──────►│  FastAPI Application    │   │
│  │  (Client)    │       │                         │   │
│  │              │       │  ┌───────────────────┐  │   │
│  │  x-user-role │──────►│  │ RBAC Middleware   │  │   │
│  │  x-user-id   │       │  │                   │  │   │
│  │              │       │  │ admin → Full CRUD  │  │   │
│  │              │       │  │ user  → Self edit  │  │   │
│  │              │       │  │        + Read      │  │   │
│  │              │       │  │        + Process   │  │   │
│  └─────────────┘       │  └───────────────────┘  │   │
│                         └─────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### 7.2 Security Controls

| Control | Implementation | OWASP Reference |
|---|---|---|
| **Input Validation** | File type whitelist, Pydantic schemas | A03:2021 Injection |
| **Path Traversal Prevention** | `os.path.basename()` on all file paths | A01:2021 Broken Access |
| **SQL Injection Prevention** | Parameterized queries in `execute_query()` | A03:2021 Injection |
| **CORS Configuration** | Configurable origins (restrict `*` in production) | A05:2021 Misconfiguration |
| **File Upload Security** | Extension whitelist, filename sanitization, size limits | A08:2021 Software Integrity |
| **RBAC** | Header-based role checking per endpoint | A01:2021 Broken Access |
| **Document Integrity** | SHA-256 per generated document | A08:2021 Software Integrity |
| **Data Sovereignty** | Local LLM (Ollama), local OCR fallback | Regulatory compliance |
| **Audit Trail** | Immutable PostgreSQL audit entries | A09:2021 Logging Failures |

### 7.3 Threat Model Summary

| Threat | Category | Mitigation |
|---|---|---|
| Malicious file upload | Injection | File type whitelist + extension check |
| Path traversal via filename | Broken Access | `os.path.basename()` |
| LLM prompt injection via OCR text | Injection | Pydantic schema validation on output |
| Unauthorized template modification | Broken Access | Admin-only RBAC check |
| Data exfiltration via CORS | Misconfiguration | Restrict origins in production |
| Audit log tampering | Integrity | Append-only design, SHA-256 hashes |

---

## 8. Deployment Architecture

### 8.1 Single-District Deployment

```
┌──────────────────────────────────────────────────────────────┐
│                  COLLECTOR'S OFFICE SERVER                    │
│                                                               │
│  ┌──────────────────┐    ┌──────────────────────────────┐    │
│  │  Uvicorn/FastAPI  │    │  PostgreSQL 14+              │    │
│  │  Port: 8000       │───►│  Port: 5432                  │    │
│  └──────────────────┘    │  DB: rr_proceedings_db        │    │
│         │                └──────────────────────────────┘    │
│         │                                                    │
│  ┌──────────────────┐    ┌──────────────────────────────┐    │
│  │  Ollama Runtime   │    │  Static Files (React dist)   │    │
│  │  Port: 11434      │    │  Served by FastAPI            │    │
│  │  Model: qwen2.5   │    └──────────────────────────────┘    │
│  └──────────────────┘                                        │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  File System                                          │    │
│  │  ├── uploads/    (uploaded court orders)               │    │
│  │  ├── outputs/    (generated .docx/.pdf)                │    │
│  │  ├── templates/  (DOCX template files)                 │    │
│  │  └── models/     (PP-OCRv4 ONNX models)               │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 Process Startup

```bash
# 1. Start PostgreSQL
systemctl start postgresql

# 2. Start Ollama
ollama serve &

# 3. Pull required model
ollama pull qwen2.5:3b-instruct

# 4. Start Backend
cd Backend && uvicorn api:app --host 0.0.0.0 --port 8000

# 5. Frontend is served as static files by FastAPI from Frontend/dist/
```

---

## 9. Algorithm Details

### 9.1 Tamil Amount-to-Words Algorithm

```
Input: 481459 (float)
Output: "நான்கு இலட்சத்து எண்பத்தொன்றாயிரத்து நானூற்று ஐம்பத்தொன்பது"

Algorithm:
1. Split into Indian number groups: [4, 81, 4, 59]
   (4 lakh, 81 thousand, 4 hundred, 59)
2. Convert each group to Tamil words using lookup tables
3. Append place value suffixes (இலட்சத்து, ஆயிரத்து, நூற்று)
4. Concatenate with sandhi rules
```

### 9.2 Jurisdiction Routing Algorithm

```
Input: defaulter.village = "கொடுமுடி", defaulter.taluk = "", defaulter.district = "ஈரோடு"

Algorithm:
1. Check if taluk is explicitly provided → use directly
2. If not, lookup village/area against taluk master data
3. Match against known taluks in the district
4. Assign: jurisdiction.taluk, jurisdiction.tahsildar_title, jurisdiction.rdo_title
5. If no match found → default to district headquarters taluk + generate warning
```

### 9.3 Grounding Score Algorithm

```
Input: entities (extracted), ocr_text (raw)

Algorithm:
1. Collect all non-empty string values from entities
2. For each value:
   a. Normalize whitespace
   b. Check if value appears in ocr_text (fuzzy match, threshold 0.85)
   c. If found: grounded += 1
   d. Else: hallucinated += 1
3. grounding_score = grounded / (grounded + hallucinated)
4. hallucination_score = 1.0 - grounding_score
```

---

## 10. Error Handling Strategy

### 10.1 Error Categories

| Category | HTTP Code | Handling |
|---|---|---|
| **Validation Error** | 400 | Pydantic validation failed, bad input |
| **Not Found** | 404 | Template, user, or file not found |
| **Authorization** | 403 | Insufficient role permissions |
| **Server Error** | 500 | Unexpected failure |
| **OCR Failure** | N/A | Silent fallback to secondary engine |
| **LLM Failure** | N/A | Retry with fallback model, then error |

### 10.2 Frontend Resilience

Every `apiService` method includes a `catch` block with offline simulation, ensuring the UI never shows a broken state. The system gracefully degrades from full-backend mode to client-side simulation mode.

---

*This SDS is maintained alongside the codebase. Architecture decisions are documented and reviewed before implementation changes.*
