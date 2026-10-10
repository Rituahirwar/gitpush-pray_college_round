# Second Opinion
Team: git push & pray (Ritu Ahirwar, Adhija Patil, Jeshrun Dethe)

Build an AI auditing platform that checks an AI-generated answer against a provided source PDF, finds hallucinated facts, unsupported claims, logical inconsistencies and unsafe recommendations, highlights the exact wrong text, and justifies each finding with verifiable evidence. It must separate real errors from correct or ambiguous claims and communicate uncertainty clearly.

## Setup

1. Create and activate a virtual environment, then install dependencies:
```bash
python -m venv backend/venv
# Windows:
backend\venv\Scripts\activate
# Linux/macOS:
source backend/venv/bin/activate
pip install -r backend/requirements.txt
```

2. Configure environment variables in `backend/.env`:
```bash
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash-lite
```

3. Start the backend server from the repository root:
```bash
uvicorn backend.main:app --port 8000
```

### Evaluation Datasets
The evaluation framework uses:
- Fr. CRCE admissions document: `demo/inputs/fr-crce-info.pdf` (committed in repository)
- WMO State of the Global Climate 2025: download the official PDF from [wmo.int](https://wmo.int) and place it at `demo/inputs/large/wmo-state-of-global-climate-2025.pdf` (gitignored).

## How it works
*(TBD)*

## Limitations
*(TBD)*

## Credits
*(TBD)*