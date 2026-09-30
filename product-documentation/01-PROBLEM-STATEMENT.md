# Problem Statement & Opportunity Analysis

> **Document ID**: RR-PS-001  
> **Version**: 1.0  
> **Date**: 2026-09-28  
> **Author**: Product & Engineering Team  
> **Classification**: Internal — Confidential  
> **Status**: APPROVED FOR DEVELOPMENT

---

## 1. Executive Summary

The Tamil Nadu District Collector's office is responsible for issuing **Revenue Recovery (RR) Proceedings** — official government orders that authorize the seizure and recovery of outstanding debts through the Revenue Recovery Act, 1864. Today, this process is **entirely manual**, involving handwritten drafts, physical templates, and error-prone human transcription. A single Section Officer may process 40–100 proceedings per month, each requiring extraction from court orders (MCOP tribunal decrees, Customs Act certificates, RERA orders), manual data entry of legal entities, amount calculations in Tamil, and formatting into a standardized Tamil-language government proceedings document (செயல்முறைகள்).

This document defines the problem, quantifies the impact, identifies stakeholders, and frames the opportunity for an **AI-powered Administrative Co-Pilot** that automates the end-to-end pipeline from scanned court order ingestion to dispatch-ready proceedings generation.

---

## 2. Domain Context

### 2.1 What is Revenue Recovery?

Under the **Tamil Nadu Revenue Recovery Act, 1864 (Section 5)**, when a court, tribunal, or statutory authority issues a decree/order directing a party to pay a sum, and the party defaults, the authority issues a **Revenue Recovery Certificate** to the District Collector. The Collector's office then issues a **Proceedings Order** (செயல்முறை ஆணை) directing the Tahsildar to recover the amount from the defaulter's movable and immovable property.

### 2.2 Types of Proceedings Handled

| Department Type | Governing Law | Typical Source |
|---|---|---|
| **MCOP** (Motor Claims) | Motor Vehicles Act, 1988 §174 + RR Act 1864 §5 | Motor Accident Claims Tribunal (MACT) |
| **CUSTOMS** | Customs Act, 1962 §142(1)(c)(i) + RR Act 1864 §5 | Commissioner of Customs, Chennai |
| **RERA** | TN Real Estate (Regulation) Act, 2016 | TN RERA Authority |
| **COURT WARRANT** | Various civil/criminal court execution orders | District/Sessions Courts |

### 2.3 Workflow Today (As-Is Process)

```
Court/Tribunal issues order
        │
        ▼
Certificate received at Collector's Office (physical / scanned PDF)
        │
        ▼
Section Officer (ஈ2 பிரிவு) manually reads the order
        │
        ▼
Extracts: Defaulter name, address, amounts, case numbers, legal sections
        │
        ▼
Manually types the proceedings in Tamil using MS Word / typewriter
        │
        ▼
Cross-checks amounts (principal + penalty + interest)
        │
        ▼
Routes to correct Taluk Tahsildar based on defaulter's address
        │
        ▼
Generates multiple copies (Tahsildar, RDO, court copy, defaulter copy)
        │
        ▼
Gets Collector's signature → Dispatches to DRO Portal / Physical dispatch
```

---

## 3. The Core Problem

### 3.1 Primary Problem Statement

> **Government Section Officers in the Tamil Nadu District Collector's office spend 45–90 minutes per proceeding manually extracting legal entities from scanned court orders, translating amounts into Tamil words, routing to the correct jurisdiction, and formatting standardized government orders — a process that is slow, error-prone, and cannot scale to meet the backlog of 500+ pending recovery certificates per district.**

### 3.2 Problem Decomposition

| # | Sub-Problem | Severity | Frequency |
|---|---|---|---|
| P1 | **OCR Failure on Scanned Orders**: Court orders arrive as scanned PDFs/images in mixed Tamil + English. Existing OCR tools fail on degraded scans. | Critical | Every document |
| P2 | **Manual Entity Extraction**: Officer must read and mentally parse 5–15 page legal documents to extract ~25 structured fields (names, amounts, dates, case numbers). | Critical | Every document |
| P3 | **Tamil Amount Conversion**: Converting financial amounts like ₹4,81,459 to Tamil words (நான்கு இலட்சத்து எண்பத்தொன்றாயிரத்து நானூற்று ஐம்பத்தொன்பது) is error-prone and time-consuming. | High | Every document |
| P4 | **Jurisdiction Routing Errors**: Wrong Taluk assignment leads to rejected proceedings. Officers must know the Taluk mapping for every village/area. | High | ~15% of documents |
| P5 | **Math Validation Failures**: Principal + Penalty + Interest calculations are often incorrect in manual proceedings, causing legal challenges. | High | ~20% of documents |
| P6 | **Template Variability**: Each department type (MCOP, Customs, RERA, Court Warrant) requires a different template format with different legal citations. | Medium | Every document |
| P7 | **No Audit Trail**: No digital record of when a proceeding was generated, by whom, with what data, or its SHA-256 integrity hash. | Medium | Always |
| P8 | **Typography Requirements**: Government mandates use of TAU-Marutham font exclusively for official Tamil proceedings — generic tools don't support this. | Medium | Every document |

### 3.3 Impact Quantification

| Metric | Current State | Target State | Improvement |
|---|---|---|---|
| Time per proceeding | 45–90 min | 3–5 min | **~18x faster** |
| Error rate (wrong entities) | ~25% require corrections | <3% with AI + validation | **8x reduction** |
| Jurisdiction routing errors | ~15% | <1% (automated lookup) | **15x reduction** |
| Math calculation errors | ~20% | 0% (automated) | **Eliminated** |
| Monthly throughput per officer | 40–60 proceedings | 200–400 proceedings | **5–7x increase** |
| Pending backlog per district | 500+ certificates | Near-zero (continuous) | **Cleared in weeks** |
| Audit trail coverage | 0% (no digital records) | 100% (PostgreSQL ledger) | **Full coverage** |

---

## 4. Stakeholder Analysis

### 4.1 Primary Users

| Stakeholder | Role | Pain Point | Need |
|---|---|---|---|
| **Section Officer (ஈ2 பிரிவு)** | Drafts proceedings, first reviewer | Manual typing, template lookup, amount conversion | Fast, accurate draft generation with AI |
| **District Collector** | Final signatory authority | Reviewing error-laden drafts, delayed dispatch | Verified, high-quality proceedings ready for signature |
| **Tahsildar (வட்டாட்சியர்)** | Executes recovery in the field | Receives incorrect proceedings, wrong jurisdiction | Accurate jurisdiction routing, clear defaulter info |

### 4.2 Secondary Users

| Stakeholder | Role | Interest |
|---|---|---|
| **Revenue Divisional Officer (RDO)** | Supervisory oversight | Progress tracking, audit visibility |
| **Court / Tribunal** | Issues the original order | Timely execution of decrees |
| **Defaulter / Respondent** | Subject of recovery | Fair, accurate representation of owed amounts |
| **Admin / IT Department** | System administration | User management, template management, system health |

### 4.3 RACI Matrix

| Activity | Section Officer | Collector | Admin | System |
|---|---|---|---|---|
| Upload court order document | **R** | I | C | A |
| OCR & entity extraction | I | I | C | **R,A** |
| Review & edit extracted data | **R** | C | I | A |
| Generate proceedings document | **R** | I | I | **A** |
| Approve & sign | I | **R,A** | I | I |
| Dispatch to DRO portal | **R** | A | I | I |
| Manage templates & users | I | A | **R** | I |

---

## 5. Competitive & Alternative Analysis

| Alternative | Limitation |
|---|---|
| **Manual Process (Status Quo)** | Slow, error-prone, no audit trail, doesn't scale |
| **Generic OCR Tools (Adobe Scan, Google Lens)** | Cannot handle mixed Tamil+English, no entity extraction |
| **ChatGPT / Gemini (general LLMs)** | Hallucinate legal amounts, no Tamil font compliance, no government template structure |
| **e-District Portal** | Requires manual data entry, no intelligent extraction |
| **Custom Software Vendor** | Expensive (₹50L+), 12-18 month delivery, rigid customization |

### Why AI Co-Pilot Wins

- **Domain-specialized OCR** (Chandra OCR v2 + PaddleOCR v4 for Tamil)
- **Local LLM** (Ollama qwen2.5:3b-instruct — no data leaves the premises)
- **Pydantic-validated entity extraction** (zero hallucination tolerance)
- **Government-mandated font compliance** (TAU-Marutham only)
- **Complete audit trail** with SHA-256 document integrity
- **Cost**: ₹0 per document (local inference, no API costs)

---

## 6. Opportunity Sizing

### 6.1 Tamil Nadu Scale

| Dimension | Number |
|---|---|
| Total Districts in Tamil Nadu | 38 |
| Avg. pending RR certificates per district | 500–1,500 |
| Total pending RR certificates statewide | ~30,000–57,000 |
| New certificates received monthly (statewide) | ~3,000–5,000 |
| Section Officers (ஈ2 பிரிவு) statewide | ~150 |
| Avg. time saved per proceeding | 40–80 minutes |

### 6.2 Business Value (per district per year)

| Value Driver | Calculation |
|---|---|
| Officer time saved | 80 proceedings/month × 50 min saved × 12 months = **800 hours/year** |
| Recovery acceleration | Faster proceedings = faster collection = **₹2–5 Cr additional recovery/year** |
| Error reduction | 20% fewer legal challenges = **₹20–50 L saved in re-work and litigation** |

---

## 7. Hypothesis & Success Criteria

### Product Hypothesis

> **We believe that** building an AI-powered administrative co-pilot that automates OCR → Entity Extraction → Validation → Document Generation  
> **For** Section Officers in the Tamil Nadu District Collector's office  
> **Will** reduce proceedings generation time by 90% and errors by 95%  
> **We'll know we're right when** a single officer can process 200+ proceedings per month with <3% requiring manual corrections.

### North Star Metric

**Proceedings processed per officer per month** (target: 200+, from current baseline of 50)

### Key Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| End-to-end pipeline time | <3 minutes per document | System timing metrics |
| Entity extraction accuracy | >95% (grounding score >0.95) | Validation engine score |
| Hallucination score | <0.05 | LLM validation engine |
| Zero math errors | 100% automated validation | Validation engine |
| Jurisdiction routing accuracy | >99% | Lookup + validation |
| Officer satisfaction (NPS) | >70 | Quarterly survey |
| System uptime | >99.5% | Monitoring |

---

## 8. Constraints & Assumptions

### Constraints

1. **Data Sovereignty**: All data must remain on-premises. No cloud LLM APIs.
2. **Font Compliance**: TAU-Marutham font is mandated for all Tamil government documents.
3. **Bilingual Support**: System must handle mixed Tamil + English court orders.
4. **Offline Capability**: Must function without internet (local Ollama, local OCR fallback).
5. **Government IT Infrastructure**: Must run on standard government hardware (no GPU requirement for inference).

### Assumptions

1. Court orders arrive as PDF scans or digital PDFs.
2. Ollama qwen2.5:3b-instruct provides sufficient extraction accuracy for legal entities.
3. Section Officers have basic computer literacy (can upload files, edit forms).
4. PostgreSQL is available for deployment in the district IT infrastructure.

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OCR fails on heavily degraded scans | Medium | High | Dual OCR engine (Chandra v2 + PaddleOCR v4 ONNX fallback) |
| LLM hallucinates financial amounts | Medium | Critical | Pydantic schema validation + math verification engine |
| Officer distrust of AI-generated content | Medium | Medium | Always-editable drafts, side-by-side OCR inspection, grounding scores |
| Government policy change on template format | Low | Medium | Admin template management (create/edit/delete templates) |
| Data loss / integrity compromise | Low | Critical | SHA-256 hash per document, PostgreSQL audit ledger, immutable audit trail |

---

*This problem statement forms the foundation for the Product Requirements Document (PRD), Software Requirements Specification (SRS), and Software Design Specification (SDS) that follow.*
