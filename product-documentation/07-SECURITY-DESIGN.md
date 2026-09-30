# Security Design Document

> **Document ID**: RR-SEC-001  
> **Version**: 2.0  
> **Date**: 2026-09-28  
> **Standard**: OWASP Top 10 (2025), NIST 800-53  
> **Status**: APPROVED  
> **Classification**: Internal — Confidential

---

## 1. Security Overview

The RR Assistant processes **Personally Identifiable Information (PII)** including:
- Defaulter names, addresses, and financial obligations
- Government officer identities
- Court case numbers and legal references
- Recovery amounts and financial details

The system operates within a **government office intranet** environment and must maintain **data sovereignty** — no PII may leave the premises.

---

## 2. Threat Model

### 2.1 STRIDE Analysis

| Threat | Category | Assets at Risk | Likelihood | Impact | Risk Level |
|---|---|---|---|---|---|
| **S**: Impersonation of Admin user | Spoofing | User accounts, templates | Medium | High | **HIGH** |
| **T**: Modification of generated proceedings | Tampering | DOCX files, audit trail | Low | Critical | **HIGH** |
| **R**: Officer denies generating a proceeding | Repudiation | Audit trail | Medium | High | **HIGH** |
| **I**: PII exposure in API responses | Info Disclosure | Defaulter PII, case data | Medium | High | **HIGH** |
| **D**: System unavailable during processing | Denial of Service | Application availability | Low | Medium | **MEDIUM** |
| **E**: Unauthorized template modification | Elevation of Privilege | Template content | Medium | High | **HIGH** |

### 2.2 Attack Surface Map

```
                    ┌─────────────────────────────────┐
                    │         ATTACK SURFACE           │
                    ├─────────────────────────────────┤
                    │                                  │
External Facing     │  ┌──────────────────────────┐   │
                    │  │ HTTP API (Port 8000)      │   │
                    │  │ • File upload endpoint     │   │
                    │  │ • REST API endpoints       │   │
                    │  │ • Static file serving      │   │
                    │  └──────────────────────────┘   │
                    │                                  │
Internal            │  ┌──────────────────────────┐   │
                    │  │ PostgreSQL (Port 5432)    │   │
                    │  │ Ollama API (Port 11434)   │   │
                    │  │ File System (uploads/)    │   │
                    │  └──────────────────────────┘   │
                    │                                  │
Supply Chain        │  ┌──────────────────────────┐   │
                    │  │ Python packages (pip)     │   │
                    │  │ npm packages              │   │
                    │  │ LLM model weights         │   │
                    │  │ OCR ONNX models           │   │
                    │  └──────────────────────────┘   │
                    └─────────────────────────────────┘
```

---

## 3. Security Controls

### 3.1 Authentication

| Control | Current State | Recommendation |
|---|---|---|
| **Login** | Username/password via frontend LoginPage | ✅ Adequate for internal use |
| **Password Storage** | bcrypt hashing | ✅ Industry standard |
| **Session Management** | Client-side state (React useState) | ⚠️ Upgrade to server-side sessions or JWT |
| **Token Type** | None (header-based role passing) | ⚠️ Implement JWT with expiry |
| **Multi-Factor** | Not implemented | 📋 Recommended for admin accounts in Phase 3 |

**Current Implementation**:
```
Client → Login Form → Backend validates credentials → 
Client stores user object in React state → 
Sends x-user-role header with each request
```

**Recommended Upgrade Path**:
```
Client → Login → Backend issues JWT (15 min expiry) → 
Client stores JWT in httpOnly cookie → 
Backend validates JWT signature on each request
```

### 3.2 Authorization (RBAC)

| Role | Permissions |
|---|---|
| **admin** | Full CRUD on users, templates, audit logs. All document operations. System configuration. |
| **user** | Document processing (upload, view, edit, download). View audit logs. Edit own profile only. View templates. |

**Implementation**: Header-based role checking at endpoint level:

```python
@app.post("/api/templates")
async def create_template(payload, x_user_role: str = Header("admin")):
    if x_user_role != "admin":
        raise HTTPException(403, "Admin permissions required")
```

**Risk**: Headers can be spoofed on the network. Mitigated by:
- Internal network deployment (not public internet)
- Network-level access controls at the office firewall

### 3.3 Input Validation

#### 3.3.1 File Upload Security

```python
# Current controls in api.py
ext = os.path.splitext(clean_name)[1].lower()
if ext not in [".pdf", ".docx", ".png", ".jpg", ".jpeg", ".tiff"]:
    raise HTTPException(400, "Unsupported file format")

clean_name = os.path.basename(file.filename).replace(" ", "_")
saved_file_path = UPLOAD_DIR / f"upload_{clean_name}"
```

| Control | Status | Detail |
|---|---|---|
| File extension whitelist | ✅ | Only PDF, DOCX, PNG, JPG, JPEG, TIFF |
| Filename sanitization | ✅ | `os.path.basename()` + space removal |
| Path traversal prevention | ✅ | `os.path.basename()` strips directory paths |
| File size limit | ⚠️ | Should enforce at FastAPI/Uvicorn level |
| MIME type validation | 📋 | Recommended: validate magic bytes match extension |
| Virus scanning | 📋 | Recommended for production: ClamAV integration |

#### 3.3.2 API Input Validation

| Control | Status | Detail |
|---|---|---|
| Pydantic schema validation | ✅ | All entity data validated via Pydantic models |
| SQL parameterized queries | ✅ | `execute_query(sql, params)` — no string concatenation |
| JSON payload size limit | ⚠️ | Should configure in FastAPI/Uvicorn |
| Content-Type enforcement | ✅ | FastAPI enforces Content-Type for JSON endpoints |

### 3.4 Data Protection

#### 3.4.1 Data at Rest

| Data | Protection | Status |
|---|---|---|
| Database (PostgreSQL) | OS-level disk encryption (BitLocker/LUKS) | 📋 Recommended |
| Generated DOCX files | File system permissions (root:root 640) | ⚠️ Should tighten |
| Uploaded files | File system permissions | ⚠️ Should tighten |
| LLM model weights | Read-only access | ✅ |
| `.env` files | File system permissions (600) | ⚠️ Must enforce |

#### 3.4.2 Data in Transit

| Channel | Protection | Status |
|---|---|---|
| Browser → Backend | HTTP (internal network) | ⚠️ Should use HTTPS even internally |
| Backend → PostgreSQL | TCP (localhost or internal) | ✅ Adequate for localhost |
| Backend → Ollama | HTTP (localhost) | ✅ Adequate for localhost |
| Backend → Chandra OCR | HTTPS | ✅ TLS encrypted |

#### 3.4.3 Data Sovereignty

| Principle | Implementation |
|---|---|
| **LLM Inference** | 100% local (Ollama). Zero data to cloud LLM APIs. |
| **OCR Fallback** | PaddleOCR v4 ONNX runs fully offline. |
| **OCR Primary** | Chandra OCR v2 is optional and can be disabled. |
| **Database** | PostgreSQL on-premises only. |
| **File Storage** | Local file system only. |

### 3.5 Document Integrity

```python
# SHA-256 hash computed for every generated document
hasher = hashlib.sha256()
with open(output_doc_path, "rb") as f:
    hasher.update(f.read())
doc_hash = hasher.hexdigest()

# Stored in audit entry
audit_entry["sha256Digest"] = f"sha256:{doc_hash}"
```

**Purpose**: Detect any post-generation tampering of proceedings documents. If the SHA-256 hash of a file doesn't match the recorded hash, the document has been modified.

### 3.6 Audit & Logging

| Aspect | Implementation |
|---|---|
| **Application Logging** | Python `logging` at INFO level; structured format |
| **Audit Trail** | PostgreSQL `audit_entries` table — append-only design |
| **Activity Recording** | Frontend `activityStore.js` records user actions |
| **Timestamping** | Server-side `NOW()` for all audit entries |
| **Entity Snapshot** | Full JSONB snapshot of entities at generation time |

---

## 4. OWASP Top 10 (2025) Compliance

| # | OWASP Category | Status | Controls |
|---|---|---|---|
| A01 | Broken Access Control | ⚠️ | RBAC implemented but header-based (spoofable). Upgrade to JWT. |
| A02 | Cryptographic Failures | ✅ | bcrypt passwords, SHA-256 document hashes |
| A03 | Injection | ✅ | Parameterized SQL, Pydantic validation, file extension whitelist |
| A04 | Insecure Design | ✅ | Defense-in-depth: dual OCR, Pydantic validation, math verification |
| A05 | Security Misconfiguration | ⚠️ | CORS `allow_origins=["*"]` must be restricted in production |
| A06 | Vulnerable Components | ⚠️ | Regular dependency auditing recommended (`pip audit`, `npm audit`) |
| A07 | Auth Failures | ⚠️ | No session timeout, no brute-force protection. Add rate limiting. |
| A08 | Software Integrity | ✅ | SHA-256 per document, Pydantic schema enforcement |
| A09 | Logging Failures | ✅ | Application logging + PostgreSQL audit trail |
| A10 | SSRF | ✅ | Only connects to configured Chandra OCR URL and Ollama localhost |

---

## 5. LLM-Specific Security

### 5.1 Prompt Injection Mitigation

| Threat | Vector | Mitigation |
|---|---|---|
| **Indirect Prompt Injection** | Malicious text embedded in scanned court order tricks LLM into producing wrong entities | Pydantic schema validation rejects any output that doesn't match expected structure |
| **Direct Prompt Injection** | User crafts prompt in AI modification feature to bypass intended behavior | System prompt is hardcoded; user prompt is clearly delimited; output validated |
| **Data Extraction** | LLM instructed to leak system prompt or prior context | Temperature 0.1 reduces creative output; output must match strict JSON schema |

### 5.2 LLM Output Validation Chain

```
LLM Response (raw JSON)
    │
    ├── Parse as JSON → Fails? → Retry with fallback model
    │
    ├── Validate against Pydantic schema → Fails? → Retry
    │
    ├── Math validation → Auto-correct if needed
    │
    ├── Grounding score check → Warn if <0.80
    │
    └── Hallucination check → Block DRO dispatch if >0.20
```

---

## 6. Security Recommendations (Priority Order)

### Immediate (Before Pilot)

| # | Recommendation | Priority | Effort |
|---|---|---|---|
| SEC-1 | Restrict CORS `allow_origins` to deployment domain | Critical | 1 hour |
| SEC-2 | Implement file size limit (50 MB) at Uvicorn level | High | 1 hour |
| SEC-3 | Tighten file system permissions on uploads/outputs | High | 2 hours |
| SEC-4 | Add `.env` to `.gitignore` and verify no secrets in version control | Critical | 30 min |
| SEC-5 | Add rate limiting on login endpoint | High | 4 hours |

### Short-term (Before Statewide)

| # | Recommendation | Priority | Effort |
|---|---|---|---|
| SEC-6 | Replace header-based RBAC with JWT tokens | High | 2 days |
| SEC-7 | Add HTTPS (TLS) even for internal deployment | High | 1 day |
| SEC-8 | Implement MIME type validation for uploads | Medium | 4 hours |
| SEC-9 | Add session timeout (30 min idle, 8 hour absolute) | Medium | 1 day |
| SEC-10 | Run `pip audit` and `npm audit` quarterly | Medium | Ongoing |

### Long-term (Phase 3+)

| # | Recommendation | Priority | Effort |
|---|---|---|---|
| SEC-11 | Multi-Factor Authentication for admin accounts | Medium | 3 days |
| SEC-12 | Database encryption at rest (PostgreSQL TDE) | Medium | 2 days |
| SEC-13 | ClamAV integration for uploaded file scanning | Low | 2 days |
| SEC-14 | Penetration testing by third-party security firm | High | External |
| SEC-15 | SOC 2 Type I compliance audit | Medium | External |

---

## 7. Incident Response

### 7.1 Security Incident Categories

| Category | Example | Response |
|---|---|---|
| **P1 — Critical** | Data breach, unauthorized access to PII | Immediate: isolate system, notify DPO, investigate |
| **P2 — High** | Unauthorized template modification | Same day: revoke access, audit changes, restore |
| **P3 — Medium** | Failed brute-force attempt | Monitor, block IP if persistent |
| **P4 — Low** | Vulnerability in dependency | Schedule patch within 7 days |

### 7.2 Contact Chain

```
Security Incident Detected
    │
    ├── IT Administrator (first responder)
    │   └── Isolate system if P1/P2
    │
    ├── District IT Officer
    │   └── Coordinate with state IT cell
    │
    └── District Collector (if PII breach)
        └── Notify State Data Protection Officer
```

---

*Security controls are reviewed quarterly. Vulnerability assessments are conducted before each major release.*
