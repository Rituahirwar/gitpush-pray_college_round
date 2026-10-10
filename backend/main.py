import json
import os
import sys
from pathlib import Path

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.ingest import ingest
from backend.claims import extract_claims
from backend.retrieve import retrieve
from backend.verify import verify_claims, verify_second_pass
from backend.validators import run_validators
from backend.confidence import compute_confidence
from backend.reasoning import extract_reasoning_issues

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"ok": True}

ROOT_DIR = Path(__file__).resolve().parent.parent

@app.get("/api/demo/{id}")
def get_demo(id: str):
    for base in [ROOT_DIR, Path(".")]:
        cache_path = base / f"demo/cache/{id}.json"
        if cache_path.exists():
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)
    raise HTTPException(status_code=404, detail="Demo not found")

@app.get("/api/benchmark")
def get_benchmark():
    for base in [ROOT_DIR, Path(".")]:
        eval_path = base / "eval/results.json"
        if eval_path.exists():
            with open(eval_path, "r", encoding="utf-8") as f:
                return json.load(f)
    return {}

@app.post("/api/audit")
async def audit(pdf: UploadFile = File(...), answer: str = Form(...)):
    if not answer.strip():
        raise HTTPException(status_code=400, detail="Answer text cannot be empty.")
    if not pdf.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF.")
    
    pdf_bytes = await pdf.read()
    try:
        ingest_result = ingest(pdf_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    if not ingest_result["chunks"]:
        raise HTTPException(status_code=400, detail="No extractable text found in PDF.")
        
    doc_info = {"name": pdf.filename, "pages": ingest_result["pages"]}
    
    claims = extract_claims(answer)
    
    claims_with_chunks = []
    for c in claims:
        top_chunks = retrieve(c["text"], ingest_result["chunks"])
        c_copy = c.copy()
        c_copy["chunks"] = top_chunks
        claims_with_chunks.append(c_copy)
        
    first_pass = verify_claims(claims_with_chunks)
    
    validated_claims = []
    for c_info in claims_with_chunks:
        cid = c_info["id"]
        fp = next((f for f in first_pass if f["id"] == cid), None)
        if not fp:
            continue
            
        claim_dict = {
            "id": fp["id"],
            "text": c_info["text"],
            "span": c_info["span"],
            "label": fp["label"],
            "error_type": fp["error_type"],
            "confidence": "low",
            "needs_review": False,
            "evidence": [],
            "explanation": fp["explanation"]
        }
        
        if fp.get("chunk_id") and fp.get("quote"):
            chunk = next((ch for ch in c_info["chunks"] if ch["chunk_id"] == fp["chunk_id"]), None)
            if chunk:
                claim_dict["evidence"].append({
                    "page": chunk["page"],
                    "chunk_id": chunk["chunk_id"],
                    "quote": fp["quote"],
                    "verified": True
                })
                claim_dict = run_validators(claim_dict, chunk["text"])
            else:
                claim_dict = run_validators(claim_dict, "")
        else:
            claim_dict = run_validators(claim_dict, "")
            
        validated_claims.append(claim_dict)
        
    final_claims = verify_second_pass(claims_with_chunks, validated_claims)
    
    for c in final_claims:
        c["confidence"] = compute_confidence(c)
        
    issues = extract_reasoning_issues(answer, final_claims)
    
    counts = {"supported": 0, "contradicted": 0, "unsupported": 0, "ambiguous": 0}
    needs_review = 0
    for c in final_claims:
        counts[c["label"]] = counts.get(c["label"], 0) + 1
        if c.get("needs_review"):
            needs_review += 1
            
    total = len(final_claims)
    assessment = f"{total} claims checked: {counts['supported']} supported, {counts['contradicted']} contradicted, {counts['unsupported']} unsupported, {counts['ambiguous']} ambiguous. {needs_review} needs review. {len(issues)} reasoning issue(s) found."
    
    overall = {
        "counts": counts,
        "needs_review": needs_review,
        "assessment": assessment
    }
    
    return {
        "doc": doc_info,
        "answer": answer,
        "overall": overall,
        "claims": final_claims,
        "issues": issues
    }

frontend_dist = ROOT_DIR / "frontend" / "dist"
if frontend_dist.exists():
    assets_dir = frontend_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(frontend_dist / "index.html")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = frontend_dist / full_path
        if full_path and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")

