# Revenue Recovery (RR) Proceedings Assistant — AI Administrative Co-Pilot

> **Automated Legal Order Analysis, Section 5 Revenue Recovery Proceedings & Official Memorandum Generation System for Tamil Nadu District Collectorates**

[![React 19](https://img.shields.io/badge/React-19.0.0-61dafb?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.4.3-646cff?logo=vite)](https://vitejs.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-3776ab?logo=python)](https://python.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2014%2B-336791?logo=postgresql)](https://www.postgresql.org/)
[![Chandra OCR](https://img.shields.io/badge/OCR-Datalab%20Chandra%20v2%20(Balance)-orange)](https://datalab.to/)
[![PaddleOCR](https://img.shields.io/badge/Fallback%20OCR-PP--OCRv4%20ONNX%20(Tamil)-ff69b4)](https://github.com/PaddlePaddle/PaddleOCR)
[![Ollama](https://img.shields.io/badge/LLM-Local%20Qwen%202.5%20(3B%20%2F%207B%20Instruct)-black?logo=ollama)](https://ollama.com/)

---

## 🏛️ Overview

**RR Proceedings Assistant** is an on-premise, production-grade AI Administrative Co-Pilot built for **Tamil Nadu District Collectorates** and Revenue Recovery (RR) departments.

The system ingests court decrees, customs recovery certificates, tribunal orders, and department demand notices, extracts all legal, financial, and jurisdictional entities with **zero hardcoding**, and synthesizes government-compliant Tamil proceedings strictly formatted in the **`TAU-Marutham`** Tamil font.

### Official Proceeding Types Generated:
1. **செயல்முறைகள் (Collector's Revenue Recovery Proceedings Order)** — Formal recovery mandate under Tamil Nadu Revenue Recovery Act, 1864 Section 5 & RSO 41 empowering the Taluk Tahsildar to recover dues from movable/immovable assets and bank accounts.
2. **குறிப்பாணை (Memorandum / Memo)** — Administrative directions to Sub-Collectors, DROs, and Tahsildars.
3. **அலுவலகக் குறிப்பு (Office Note File Submission)** — Internal Section Clerk / Superintendent note file submission for District Collector approval.

### Supported Department Statutory Frameworks:
- **Customs Act, 1962 (Section 142(1)(c)(ii))** — Export/Import duty arrears, IEC recovery & penalty demands.
- **Tamil Nadu Revenue Recovery Act, 1864 (Section 5 & RSO 41)** — General land revenue & statutory arrears.
- **Motor Vehicles Act, 1988 (Section 174)** — Motor Accidents Claims Tribunal (MCOP) compensation awards.
- **Commercial Taxes & GST (TNGST / CGST Acts)** — Tax recovery certificates and penalty arrears.
- **TNRERA Act, 2016 (Section 40(1))** — Real Estate Regulatory Authority recovery warrants.
- **Criminal Procedure / BNSS Recovery Warrants** — Judicial magistrate recovery execution.

---

## 🚀 Key Features

- **High-DPI Document Ingestion**: Ingests multi-page scanned PDF orders (300 DPI layout processing) and images (PNG, JPG, WEBP).
- **Hybrid OCR Engine**:
  - **Primary**: **Datalab Chandra OCR v2** in **Balanced Mode** (`mode="balance"`) for high-precision, layout-aware Tamil/English extraction.
  - **Offline Fallback**: Local **PaddleOCR PP-OCRv4 ONNX** model bound to the official Tamil character dictionary (`ta_dict.txt`).
- **Dynamic Local LLM Extraction (`qwen2.5:3b-instruct` / `qwen2.5:7b-instruct`)**:
  - Extracts legal parties, tribunal case numbers, principal amounts, penalty breakdowns, and jurisdiction details with strict Pydantic JSON validation.
  - **Zero Hardcoding**: All entities, amounts, and dates are dynamically extracted from input text.
  - **Arithmetic Consistency Validator**: Verifies `Principal + Penalty = Total Recoverable Amount`.
  - **Dynamic Tamil Currency Converter**: Automatically converts numerical monetary amounts to official Tamil words (e.g., `₹1,82,308/-` $\rightarrow$ `ரூபாய் ஒரு இலட்சத்து எண்பத்திரண்டு ஆயிரத்து முன்னூற்று எட்டு மட்டும்`).
- **Mandatory `TAU-Marutham` Typography in DOCX**:
  - Every generated Word `.docx` strictly uses `TAU-Marutham` across all XML run fonts (`w:ascii`, `w:hAnsi`, `w:cs`, `w:eastAsia`) and paragraph styles.
- **PostgreSQL Database Storage**:
  - All templates, user credentials/RBAC, and audit logs are dynamically stored in PostgreSQL (`rr_proceedings_db`).
- **Dynamic Template Management**:
  - Admin panel to Add, Edit, Delete, and live-preview Jinja2 proceedings templates.
- **Dynamic User Management & Role-Based Access Control (RBAC)**:
  - Administrator can manage all users, roles, and taluks; staff can edit their own profiles.
- **Conversational AI Prompt Modification**:
  - Section Officers can refine or alter proceedings via natural language prompts (e.g., *"Change taluk to Perundurai and recalculate total"*).

---

## 📂 Repository Structure

```
POC-RR-2-PROCEEDINGS/
├── Backend/
│   ├── api.py                    # FastAPI server exposing REST endpoints
│   ├── pipeline.py               # 5-step OCR -> LLM -> Validation -> DOCX pipeline
│   ├── db.py                     # PostgreSQL connection pool & schema migration
│   ├── templates_store.py        # Dynamic PostgreSQL template store & Jinja2 engine
│   ├── user_store.py             # Dynamic PostgreSQL user directory & RBAC
│   ├── audit_store.py            # Dynamic PostgreSQL audit ledger
│   ├── ingestion.py              # PDF rendering & image preprocessing
│   ├── ocr_engine.py             # Chandra OCR v2 Balance client + PP-OCRv4 fallback
│   ├── llm_extractor.py          # Ollama JSON extractor & dynamic regex fallback
│   ├── validation_engine.py      # Arithmetic verification & Tamil number-to-words
│   ├── doc_generator.py          # Word .docx generator enforcing TAU-Marutham font
│   ├── schemas.py                # Pydantic data models
│   ├── config.py                 # System paths, DB, OCR, and LLM configuration
│   ├── test_backend.py           # Backend integration & PostgreSQL test suite
│   ├── requirements.txt          # Python dependencies
│   ├── models/                   # Local PP-OCRv4 ONNX weights & ta_dict.txt
│   └── outputs/                  # Generated .docx proceeding documents
│
├── Frontend/
│   ├── package.json              # React 19, Vite, Lucide React, Canvas Confetti
│   ├── vite.config.js            # Vite configuration & proxy to backend
│   ├── index.html                # Entry HTML with typography & favicon
│   └── src/
│       ├── main.jsx              # React root entry point
│       ├── App.jsx               # Main state machine & view router
│       ├── index.css             # Design system & TAU-Marutham font declarations
│       ├── services/
│       │   └── apiService.js     # REST client for FastAPI & PostgreSQL
│       ├── components/
│       │   ├── admin/            # TemplateManagement, UserManagement, AdminWorkspace
│       │   ├── workspace/        # RRAssistantView, DocumentEditorPreview, FullDetailsForm
│       │   ├── upload/           # MobileQrModal, ProcessingOverlay, UploadLanding
│       │   ├── audit/            # AuditLogView
│       │   └── layout/           # AppHeader, Sidebar, Modals
│
├── Document/                     # Reference documents & sample court orders
├── .gitignore                    # Git ignore file
└── README.md                     # Project documentation
```

---

## ⚙️ System Requirements

| Component | Minimum | Recommended |
| :--- | :--- | :--- |
| **OS** | Windows 10/11, Ubuntu 20.04+, macOS 12+ | Windows 11 / Ubuntu 22.04 LTS |
| **Python** | Python 3.10 | Python 3.11 or 3.12 |
| **Node.js** | Node.js v18 LTS | Node.js v20+ LTS |
| **PostgreSQL** | PostgreSQL 14+ | PostgreSQL 16+ |
| **RAM** | 8 GB | 16 GB+ |
| **LLM Host** | Local [Ollama](https://ollama.com/) | Ollama running `qwen2.5:3b-instruct` |

---

## 🛠️ Step-by-Step Installation Guide

### Step 1: Clone the Repository

```bash
git clone https://github.com/Balahariharan003/POC-RR-2-PROCEEDINGS.git
cd POC-RR-2-PROCEEDINGS
```

---

### Step 2: Set Up PostgreSQL Database

Ensure PostgreSQL is installed and running on port `5432`.

#### Option A: Local PostgreSQL (Windows / Linux / macOS)
1. Open your terminal or `psql`:
   ```bash
   psql -U postgres
   ```
2. Create the database:
   ```sql
   CREATE DATABASE rr_proceedings_db;
   \q
   ```

#### Option B: Docker Quickstart
If you prefer running PostgreSQL in Docker:
```bash
docker run -d \
  --name rr-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=rr_proceedings_db \
  -p 5432:5432 \
  postgres:16-alpine
```

*(Note: The database tables and default seed templates/users are automatically created by `db.init_db()` upon starting the backend).*

---

### Step 3: Install & Start Ollama LLM

1. Download and install Ollama from [ollama.com](https://ollama.com/).
2. Pull the recommended high-accuracy instruction model:
   ```bash
   ollama pull qwen2.5:3b-instruct
   ```
   *(Or for higher GPU memory systems: `ollama pull qwen2.5:7b-instruct`)*
3. Verify Ollama is running:
   ```bash
   ollama list
   ```

---

### Step 4: Backend Setup

#### 1. Navigate to the Backend folder:
```bash
cd Backend
```

#### 2. Create and activate a Python Virtual Environment:
- **Windows (PowerShell)**:
  ```powershell
  python -m venv .venv
  .venv\Scripts\Activate.ps1
  ```
- **Windows (Command Prompt)**:
  ```cmd
  python -m venv .venv
  .venv\Scripts\activate.bat
  ```
- **Linux / macOS**:
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  ```

#### 3. Install Python Dependencies:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

#### 4. Configure Environment Variables (Optional):
The system runs out of the box with default settings. To customize, create a `.env` file in the `Backend/` directory:
```env
# PostgreSQL Settings
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rr_proceedings_db
DB_USER=postgres
DB_PASSWORD=postgres

# Ollama LLM Settings
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b-instruct

# OCR Settings
CHANDRA_OCR_URL=https://api.datalab.to/v1/chandra/ocr
CHANDRA_OCR_MODE=balance
DATALAB_API_KEY=your_optional_api_key_here
```

#### 5. Verify Backend & Database with the Test Suite:
```bash
python test_backend.py
```
*You should see `ALL TESTS PASSED SUCCESSFULLY!` verifying PostgreSQL connection, template store, user RBAC, and `TAU-Marutham` font generation.*

#### 6. Start the FastAPI Server:
```bash
python api.py
```
*Backend runs at `http://127.0.0.1:8000`. Interactive API Swagger documentation is available at `http://127.0.0.1:8000/docs`.*

---

### Step 5: Frontend Setup

Open a new terminal window:

#### 1. Navigate to the Frontend folder:
```bash
cd Frontend
```

#### 2. Install NPM packages:
```bash
npm install
```

#### 3. Start Vite Development Server:
```bash
npm run dev
```
*The web app will launch at `http://localhost:5173/`.*

#### 4. (Optional) Production Build:
```bash
npm run build
```
*Builds optimized production assets into `Frontend/dist`. When built, the FastAPI backend automatically serves these static files directly at `http://localhost:8000/`.*

---

## 💻 Default Login Credentials

The system comes pre-configured with default accounts in PostgreSQL:

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **District Collector / Admin** | `admin@tn.gov.in` | `admin123` | Full Access (Templates, User Management, All Taluks, System Backup) |
| **Superintendent (E2 Section)** | `officer@tn.gov.in` | `officer123` | Section Ingestion, Edit Proceedings, AI Re-generation, DRO Dispatch |
| **Tahsildar (Erode Taluk)** | `tahsildar.erode@tn.gov.in` | `tahsildar123` | Taluk RR Proceedings & Demand Execution |
| **Revenue Inspector (Kodumudi)** | `ri.kodumudi@tn.gov.in` | `ri123` | Demand Notice Tracking & Profile Management |

---

## 🔤 Font Installation (`TAU-Marutham`)

For the best viewing and editing experience in Microsoft Word and LibreOffice:
1. Ensure the Tamil font **`TAU-Marutham`** is installed on your operating system.
2. **Windows**: Double-click `TAU-Marutham.ttf` and click **Install**.
3. **Linux**: Copy the `.ttf` file to `~/.local/share/fonts/` and run `fc-cache -f -v`.
4. **macOS**: Double-click `TAU-Marutham.ttf` and click **Install Font** in Font Book.

*(Note: If `TAU-Marutham` is not locally installed on the client machine, standard Tamil Unicode fallbacks like `Noto Sans Tamil`, `Latha`, and `Vijaya` render automatically in the web preview).*

---

## 📡 Key REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Healthcheck for FastAPI, PostgreSQL, and Ollama |
| `POST` | `/api/process-document` | Upload & run 5-step OCR + LLM pipeline |
| `POST` | `/api/process-sample` | Run pipeline on built-in sample order |
| `POST` | `/api/modify-content` | AI prompt-based natural language modification |
| `POST` | `/api/export-docx` | Generate and export DOCX with strict `TAU-Marutham` font |
| `GET` | `/api/templates` | Fetch all dynamic templates from PostgreSQL |
| `POST` | `/api/templates` | Create new template (Admin) |
| `PUT` | `/api/templates/{id}` | Update existing template (Admin) |
| `DELETE` | `/api/templates/{id}` | Delete template (Admin) |
| `POST` | `/api/templates/{id}/render` | Dynamically render template with entity context |
| `GET` | `/api/users` | List users with role/status filters (PostgreSQL) |
| `POST` | `/api/users` | Create user (Admin) |
| `PUT` | `/api/users/{id}` | Update user profile (Admin or Self) |
| `GET` | `/api/audit-logs` | Retrieve monthly partitioned audit logs |
| `POST` | `/api/audit-logs` | Record audit session and DRO portal dispatch |

---

## 🧪 Testing & Verification

Run the comprehensive integration test suite anytime:

```bash
cd Backend
.venv\Scripts\python test_backend.py      # Windows
# or
.venv/bin/python test_backend.py          # Linux/macOS
```

### Verified Pipeline Stages:
- [x] PostgreSQL database initialization & table verification
- [x] Dynamic template CRUD & Jinja2 rendering
- [x] User management & RBAC security checks
- [x] Chandra OCR v2 Balance mode & PP-OCRv4 fallback
- [x] Zero-hardcode LLM extraction & arithmetic validation
- [x] DOCX XML font inspection confirming `TAU-Marutham` embedding
- [x] Audit log persistence and DRO dispatch

---

## 📄 Compliance & Data Privacy

Designed specifically for government administrative workflows adhering to the **Tamil Nadu Revenue Recovery Act, 1864** and **State Digital Data Governance Guidelines**. All OCR and LLM processing runs strictly on-premise without external data leakage.

---

## 🤝 Support & Contribution

For technical queries, bug reports, or feature enhancements, please open an issue in the repository or contact the E-Governance / Revenue Recovery Project Cell.
