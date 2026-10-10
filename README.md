# Second Opinion — AI Auditing Console

> **Hackathon Problem Statement 3: Audit Another AI**  
> **Team:** git push & pray (*Ritu Ahirwar, Adhija Patil, Jeshrun Dethe*)

---

## 🔍 The Problem

Large Language Models generate answers that sound authoritative, fluent, and highly persuasive. However, in mission-critical settings (academic admissions, legal compliance, climate research, medical/financial counsel), AI answers frequently suffer from critical failure modes:
1. **Fabricated Facts (Hallucinations):** Inventing dates, fees, statistics, or rules that do not exist.
2. **Unsupported Claims:** Making assertions that the source material never mentions or validates.
3. **Contradictions:** Directly misrepresenting what the official documentation states.
4. **Reasoning Gaps & Unsafe Advice:** Making invalid logical leaps (e.g., assuming 100% placement rate guarantees every individual a job) or recommending harmful workarounds (e.g., advising students to skip fee deadlines without penalty).

Most fact-checking tools output an opaque, generic score (e.g., *"82% accurate"*). **An auditor cannot act on a percentage score.** They require exact line-by-line evidence, verbatim quotes from the original source, and transparent uncertainty markers.

---

## 🎯 What Second Opinion Does

**Second Opinion** is a technical auditor's console designed to audit another AI's output against an authoritative source PDF document.

- **Exact Text Span Highlighting:** Locates the precise character span in the AI's answer for each individual claim.
- **4-Way Verdict Classification:**
  - `supported`: Verified by verbatim quotes and matching numbers in the source PDF.
  - `contradicted`: Disproven directly by text in the source PDF.
  - `unsupported`: The source document is completely silent on this claim.
  - `ambiguous`: The source document is vague, conflicting, or requires subjective interpretation.
- **Dual-Pass Verification with Disagreement Detection (`needs_review`):** The system runs two independent verification passes. When the passes disagree, it flags the claim as `needs_review: true` rather than hallucinating false confidence.
- **Deterministic Python Code Validators:** Never relies solely on LLM self-evaluation. Verifies exact quote presence (`rapidfuzz`), extracts and compares numerical entities, and computes deterministic confidence (`low`, `medium`, `high`).
- **Higher-Order Reasoning Checks:** Detects `logic_gap` (fallacies, non-sequiturs) and `unsafe_advice` (hazardous actions) across the entire answer.
- **Auditor Console UI:** Features a 60/40 manuscript and sticky inspector layout, keyboard navigation (`j`/`k`), verdict filters, print-ready formal audit reports, and a benchmark evaluation dashboard.

---

## 🏗️ Architecture & How It Works

```
                                [ User Input ]
                        ┌─────────────┴─────────────┐
                        ▼                           ▼
                 Source PDF File            AI Answer Text
                        │                           │
                        ▼                           ▼
               [ 1. PDF Ingestion ]         [ 2. Claim Extraction ]
               • PyMuPDF parsing            • Decomposes answer into stand-alone claims
               • Section & page chunking    • Computes character spans [start, end]
                        │                           │
                        └─────────────┬─────────────┘
                                      ▼
                           [ 3. Hybrid Retrieval ]
                           • BM25 keyword matching + entity-aware scoring
                           • Page-level candidate ranking
                                      │
                                      ▼
                        [ 4. Dual-Pass Verification ]
                        • Pass 1: Primary claim verification against top chunks
                        • Pass 2: Independent secondary review
                                      │
                                      ▼
                        [ 5. Deterministic Validators ]
                        • RapidFuzz verbatim quote verification
                        • Numerical / entity consistency checking
                        • Rule-based confidence assignment
                        • Disagreement flag: needs_review = True / False
                                      │
                                      ▼
                        [ 6. Reasoning & Safety Audit ]
                        • Whole-answer scan for logic_gap & unsafe_advice
                                      │
                                      ▼
                          [ 7. Interactive Audit UI ]
                          • Manuscript highlighting & sticky inspector
                          • Evidence quotes & page tags
                          • Exportable JSON & formal print view
```

### 1. Ingestion (`backend/ingest.py`)
Extracts text page-by-page from the uploaded PDF using `PyMuPDF` (`fitz`), creating indexed text chunks annotated with page numbers and headers.

### 2. Claim Extraction (`backend/claims.py`)
Splits the AI-written answer into discrete, checkable atomic claims while preserving exact character start and end offsets in the original answer text.

### 3. Retrieval (`backend/retrieve.py`)
Uses `rank_bm25` combined with entity matching (numbers, dates, proper nouns) to retrieve the most relevant source PDF passages for each claim.

### 4. Verification (`backend/verify.py`)
Executes an initial verification pass and a distinct second-pass audit. Each pass extracts candidate source quotes and assigns a verdict.

### 5. Deterministic Validation & Confidence (`backend/validators.py`, `backend/confidence.py`)
Validates that cited quotes actually exist in the retrieved PDF chunks using fuzzy matching (`rapidfuzz`) and verifies that numbers align. Confidence (`high`, `medium`, `low`) is derived deterministically from validator agreement.

### 6. Reasoning & Safety Issues (`backend/reasoning.py`)
Detects non-factual errors:
- `logic_gap`: Faulty deductions or unwarranted generalisations.
- `unsafe_advice`: Recommendations that could cause legal, academic, physical, or financial harm.

---

## 📊 Benchmark & Evaluation Results

Evaluated on held-out test datasets (`eval/labeled_claims.csv`):
- **Contradiction Recall:** `100.0%` (catches every planted factual falsehood)
- **Citation Validity:** `100.0%` (every cited quote matches source PDF text)
- **False Alarm Rate:** `2.4%` (avoids falsely marking correct claims as errors)
- **Disagreement Routing (`needs_review`):**
  - High confidence when passes agree (`accuracy = 97.7%` when `needs_review=false`)
  - Successfully routes uncertain or edge-case claims for human auditor review

---

## ⚡ Quickstart & Setup

### Prerequisites
- Python 3.10+ (tested on Python 3.11–3.13)
- Node.js 18+ and npm
- Gemini API key (optional for the demo sample, required for auditing custom PDFs)

### 1. Clone & Environment Setup
```bash
# 1. Clone repository
git clone <REPO_URL>
cd gitpush-pray_college_round

# 2. Set up Python virtual environment
python -m venv backend/venv

# Windows:
backend\venv\Scripts\activate
# macOS / Linux:
source backend/venv/bin/activate

# 3. Install backend dependencies
pip install -r backend/requirements.txt

# 4. Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure Environment Variables
Create a `backend/.env` file:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

---

## 🚀 How to Run

### Option A: Unified Production Mode (FastAPI serves built SPA)
Build the frontend and run the application from a single port (`8000`):

```bash
# 1. Build frontend
cd frontend
npm run build
cd ..

# 2. Start FastAPI server
uvicorn backend.main:app --port 8000
```
Then open: **[http://localhost:8000](http://localhost:8000)**

> **Quick one-liner:**  
> `npm run build, then uvicorn backend.main:app --port 8000, open http://localhost:8000`

---

### Option B: Development Mode (Vite Hot-Reload)
Run this when actively editing frontend components:

1. **Start Backend (Terminal 1):**
   ```bash
   uvicorn backend.main:app --port 8000
   ```
2. **Start Frontend (Terminal 2):**
   ```bash
   cd frontend
   npm run dev
   ```
3. Open: **[http://localhost:5173](http://localhost:5173)**

---

## 🧪 Testing & Evaluation

### Run Test Suite
To run all 40 unit and integration tests (including pipeline, validators, and SPA fallback tests):
```bash
pytest backend/tests
```

### Run Benchmark Evaluation
To reproduce evaluation metrics against benchmark datasets:
```bash
python -m eval.run_eval
```

---

## 📁 Repository Structure

```
├── backend/
│   ├── main.py              # FastAPI app, API routes, and SPA static fallback
│   ├── contract.md          # Immutable API contract specification
│   ├── ingest.py            # PDF document parsing with PyMuPDF
│   ├── claims.py            # Atomic claim extraction & character spans
│   ├── retrieve.py          # BM25 + entity retrieval
│   ├── verify.py            # Dual-pass claim verification logic
│   ├── validators.py        # Deterministic fuzzy quote & number checks
│   ├── confidence.py        # Rule-based confidence scoring
│   ├── reasoning.py         # Logic gap & unsafe advice detection
│   └── tests/               # Pytest suite (eval, ingest, pipeline, SPA)
├── frontend/
│   ├── src/
│   │   ├── api.js           # API client (health, demo, audit, benchmark)
│   │   ├── tokens.css       # Unified design system tokens & colors
│   │   ├── upload/          # PDF dropzone & answer submission view
│   │   ├── audit/           # 60/40 Auditor workspace with sticky inspector
│   │   ├── report/          # Summary report, claims ledger & print view
│   │   └── benchmark/       # Accuracy metrics & confusion matrix dashboard
├── demo/
│   ├── inputs/              # Evaluation PDFs & sample AI-generated answers
│   └── cache/               # Precomputed demo audit results (offline mode)
└── eval/
    ├── labeled_claims.csv   # Gold-standard labeled claim dataset
    ├── run_eval.py          # Metric computation & benchmark runner
    └── results.json         # Evaluation benchmarks & confusion matrix
```

---

## ⚠️ Limitations & Boundary Conditions
- **Scanned / Image-Only PDFs:** Requires digital text layers; scanned documents without OCR are rejected cleanly with a friendly prompt.
- **Complex Multimodal Figures:** Currently parses textual blocks and headers; chart/diagram auditing is planned for future iterations.
- **Processing Time:** Real multi-page audits execute dual-pass validation in ~10–15 seconds depending on document length and rate limits.

---

## 👥 Credits
**Team git push & pray**:
- **Ritu Ahirwar**
- **Adhija Patil**
- **Jeshrun Dethe**