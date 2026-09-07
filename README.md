# GDP Assistant — AI Administrative Co-Pilot (Revenue Recovery & Smart Petition OCR)

> **Automated Legal Order Analysis, Section 5 Revenue Recovery Proceedings & Press Release Generation System for Tamil Nadu District Collectorates**

[![React 19](https://img.shields.io/badge/React-19.0.0-61dafb?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2.0-646cff?logo=vite)](https://vitejs.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-3776ab?logo=python)](https://python.org/)
[![PaddleOCR](https://img.shields.io/badge/OCR-PaddleOCR%20PP--OCRv4%20Multilingual%20ONNX-ff69b4)](https://github.com/PaddlePaddle/PaddleOCR)
[![Ollama](https://img.shields.io/badge/LLM-Local%20Qwen%202.5%20(7B--Instruct)-black?logo=ollama)](https://ollama.com/)

---

## 🏛️ Overview

**GDP Assistant** is an on-premise, enterprise-grade AI Administrative Co-Pilot engineered for **Tamil Nadu District Collectorates** and Revenue Recovery (RR) departments.

The system automates the manual lifecycle of processing court decrees and requisition notices into legally compliant District Collector Proceedings (`செயல்முறைகள்`) and Office Notes (`//அலுவலகக் குறிப்பு//`) under:
- **Tamil Nadu Revenue Recovery Act, 1864 (Section 5)**
- **Motor Vehicles Act, 1988 (Section 174 - MCOP Claims)**
- **Customs Act, 1962 (Section 142(1)(c)(i) - Export/Import Dues & IEC Recovery)**
- **Tamil Nadu Real Estate Regulatory Authority (TNRERA) Act, 2016 (Section 40(1))**
- **Code of Criminal Procedure (CrPC / BNSS Recovery Warrants)**
- **Revenue Standing Order No. 41 (RSO 41)**

---

## 🚀 Key Features

- **Multi-Format Ingestion**: Supports high-DPI scanned **PDF** (rendered at 300 DPI) and **DOCX** legal orders.
- **Bilingual Spatial OCR (Tamil + English)**:
  - Powered by **PaddleOCR PP-OCRv4 ONNX** (`ch_PP-OCRv4_det_infer.onnx` + `ta_PP-OCRv4_rec_infer.onnx`).
  - Utilizes the official multilingual Tamil character dictionary (`ta_dict.txt`, 128 Unicode tokens).
  - High-precision confidence filtering (`OCR_CONFIDENCE_THRESHOLD = 0.52`) and spatial text bounding boxes.
- **Local Ollama LLM Extraction (`qwen2.5:7b-instruct`)**:
  - Extracts legal parties, tribunal case numbers, award principals, penalty breakdowns, interest rates, and routing details.
  - Zero cloud reliance: 100% on-premise, air-gapped data security for judicial and confidential government records.
  - Automated fallback pattern extraction for seamless offline resiliency.
- **Official Tamil Nadu Government Proceeding (`செயல்முறைகள்`) Formatting**:
  - **Heading Block**: Title and prefix (`"முன்னிலை: திரு.ச.கந்தசாமி,இ.ஆ.ப.,"`) are centered and bold with automatic artifact/bracket sanitization.
  - **Tracking Meta-Data Row**: 100% borderless 2-column Word table spanning full text margins (Left: `ந.க. 9667/2026/ஈ2`, Right: `நாள்:      .05.2026.`).
  - **Functional Sections**: `பொருள்:`, `பார்வை:`, and `உத்தரவு:` with bold styling and structured vertical spacing (>= 12pt).
  - **Single & Multi-Defaulter Grammar Engine**: Context-aware Tamil verbs (`வசித்து வரும்` vs `இயங்கி வரும்`), entity suffixes (`என்பவரிடமிருந்து` vs `ஆகியோரிடமிருந்து`), asset clauses, and split amount calculations.
  - **Part 1 & Part 2 Structure**: Official Collector Proceedings Order + Signatory + Dispatch List (`பெறுநர் / நகல்`) followed by Office Notes (`//அலுவலகக் குறிப்பு//`) Section Submission.
- **4 Department-Specific Templates**:
  1. `template_customs.docx`: Customs Act duty & penalty recovery with IEC and Head of Account (037 - Customs).
  2. `template_tnrera.docx`: Real Estate regulatory penalty orders.
  3. `template_mcop.docx`: Motor Accidents Claims Tribunal recovery with statutory interest calculations.
  4. `template_warrant.docx`: Criminal Court recovery warrants.
- **Interactive Document Editor & Live Preview**:
  - Inline editing of legal entities before final order generation.
  - **AI Prompt-Based Revision**: Natural language modification (e.g., *"Change taluk to Perundurai and award amount to Rs. 5,00,000"*) to instantly re-generate the proceeding.
- **Governance, Verification & Audit Trail**:
  - Rule-based mathematical validation (Principal + Penalty = Total).
  - Fact-grounding & hallucination risk scoring.
  - Full-page immutable ledger partitioned by month recording SHA-256 digests and officer dispatch actions.
- **DRO Portal Dispatch**: Single-click transmission to the District Revenue Officer (DRO) grievance queue.

---

## 📂 Repository Structure

```
AIAC - RR/
├── Backend/
│   ├── api.py                    # FastAPI server exposing REST APIs & serving frontend
│   ├── pipeline.py               # 5-step unified processing pipeline orchestrator
│   ├── ingestion.py              # 300 DPI PDF rendering & image pre-processing
│   ├── ocr_engine.py             # RapidOCR PP-OCRv4 ONNX engine (Tamil ta_dict + English)
│   ├── llm_extractor.py          # Local Ollama qwen2.5:7b Pydantic structured entity extraction
│   ├── validation_engine.py      # Math calculation, jurisdiction routing & Tamil currency conversion
│   ├── doc_generator.py          # Grammar normalizer & docxtpl proceedings generation
│   ├── template_builder.py       # Programmatic Word .docx template builder for all 4 departments
│   ├── schemas.py                # Pydantic schemas (CaseDetails, Defaulter, Financials, etc.)
│   ├── config.py                 # System paths, DPI, OCR model paths, and LLM configurations
│   ├── cli.py                    # Command-line interface for headless batch processing
│   ├── requirements.txt          # Python dependencies
│   ├── models/                   # PP-OCRv4 detection/recognition ONNX models & ta_dict.txt
│   ├── templates/                # Word proceedings template files (.docx)
│   ├── sample_data/              # Built-in MCOP and Customs sample order generator
│   ├── uploads/                  # Temporary document intake directory
│   └── outputs/                  # Generated proceedings DOCX files
│
├── Frontend/
│   ├── package.json              # React 19, Vite, Lucide React, Canvas Confetti
│   ├── vite.config.js            # Dev server & proxy configuration to localhost:8000
│   ├── index.html                # High-DPI typography with Noto Sans Tamil & Outfit fonts
│   └── src/
│       ├── main.jsx              # React root entry point
│       ├── App.jsx               # Top-level state machine & view router
│       ├── index.css             # Glassmorphic global design system & tokens
│       ├── services/
│       │   └── apiService.js     # REST client connecting to FastAPI with offline fallbacks
│       ├── data/
│       │   ├── schemas.js        # Master legal entity schemas & grounding formulas
│       │   └── mockData.js       # OCR bounding boxes, monthly audit logs & RAG Q&A
│       └── components/
│           ├── layout/           # AppHeader, Sidebar, Breadcrumbs, Modals
│           ├── upload/           # UploadLanding (PDF/DOCX), ProcessingOverlay
│           ├── workspace/        # DocumentEditorPreview, DocumentViewer, FullDetailsForm, SummaryChatView
│           └── audit/            # AuditLogView (Monthly partitioned audit trail)
│
├── .gitignore                    # Git ignore configuration (models, virtualenvs, outputs)
└── README.md                     # Project documentation
```

---

## ⚙️ Prerequisites & Installation

### 1. Prerequisites
- **Node.js**: v18+ (Tested on Node v20/v24)
- **Python**: 3.10+
- **Ollama**: Installed with `ollama pull qwen2.5:7b-instruct` (or `qwen2.5:7b`)

### 2. Backend Setup

```bash
# Navigate to Backend
cd Backend

# Create and activate virtual environment
python -m venv .venv

# On Windows (PowerShell):
.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# (Optional) Rebuild the official Word .docx templates
python template_builder.py

# Start the FastAPI Server
python api.py
```
*The FastAPI backend will start at `http://127.0.0.1:8000`.*

### 3. Frontend Setup

```bash
# Navigate to Frontend
cd Frontend

# Install npm packages
npm install

# Run Vite development server
npm run dev
```
*The frontend development server will launch at `http://localhost:5173/`.*

To create a production bundle:
```bash
npm run build
```
*(When built, the production bundle in `Frontend/dist` is automatically served statically by FastAPI at `http://localhost:8000/`.)*

---




## 📄 License & Compliance

Designed for government administration workflows adhering to the **Tamil Nadu Revenue Recovery Act 1864** and **State Digital Data Protection Guidelines**. All machine learning models execute strictly locally on-premise without external telemetry.
