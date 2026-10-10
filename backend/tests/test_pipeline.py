import pytest
from unittest.mock import patch
from backend.claims import extract_claims, find_span
from backend.retrieve import retrieve, extract_entities
from backend.validators import quote_check, number_check, run_validators
from backend.confidence import compute_confidence
from backend.reasoning import extract_reasoning_issues
from backend.verify import verify_claims, verify_second_pass

# --- Claims Tests ---
@patch('backend.claims.call_json')
def test_extract_claims(mock_call):
    mock_call.return_value = [{"id": "c1", "quote": "The sky is blue."}]
    answer = "Here is an answer. The sky is blue. It is clear."
    
    claims = extract_claims(answer)
    assert len(claims) == 1
    assert claims[0]["id"] == "c1"
    assert claims[0]["span"] == {"start": 19, "end": 35}

def test_find_span_fuzzy():
    answer = "The registration fee is Rs 8000 for all."
    quote = "The registration fee is Rs 8,000"
    span = find_span(answer, quote)
    assert span is not None
    assert answer[span["start"]:span["end"]].startswith("The registration")

# --- Retrieve Tests ---
def test_retrieve():
    chunks = [
        {"chunk_id": "c1", "text": "Something irrelevant."},
        {"chunk_id": "c2", "text": "Registration fee is 8000."},
        {"chunk_id": "c3", "text": "John Doe is here on January 10."},
    ]
    # BM25 test
    res = retrieve("What is the registration fee?", chunks, k=1)
    assert len(res) == 1
    assert res[0]["chunk_id"] == "c2"
    
    # Entity matching test
    res2 = retrieve("Who is John?", chunks, k=1)
    assert any(c["chunk_id"] == "c3" for c in res2)

def test_retrieve_default_k_and_capping():
    # 8 chunks without entity match
    chunks_8 = [{"chunk_id": f"c{i}", "text": f"alpha beta gamma {i}"} for i in range(8)]
    # Default k is 6
    res_8 = retrieve("alpha beta", chunks_8)
    assert len(res_8) == 6
    
    # Fewer than 6 chunks -> cap at len(chunks)
    chunks_3 = [{"chunk_id": f"c{i}", "text": f"alpha beta gamma {i}"} for i in range(3)]
    res_3 = retrieve("alpha beta", chunks_3)
    assert len(res_3) == 3
    
    # Number/name rule: chunk with capitalized name or number outside top-k is included
    chunks_with_entity = [{"chunk_id": f"c{i}", "text": f"item {i}"} for i in range(7)]
    chunks_with_entity.append({"chunk_id": "c_entity", "text": "Dr Smith arrived on October 15."})
    res_ent = retrieve("Did Dr Smith visit on October 15?", chunks_with_entity)
    assert any(c["chunk_id"] == "c_entity" for c in res_ent)

@patch('backend.verify.call_json')
def test_retrieve_zero_bm25_and_empty_doc_skips_llm(mock_call):
    # Chunks with text that has zero overlap with the query
    chunks = [{"chunk_id": f"c{i}", "text": f"apple orange banana {i}"} for i in range(8)]
    claim_text = "quantum physics algorithm"
    
    # retrieve() returns k chunks even when all BM25 scores are zero
    k = 4
    retrieved = retrieve(claim_text, chunks, k=k)
    assert len(retrieved) == k
    
    # Non-empty document chunks reach the LLM call even with zero BM25 scores
    mock_call.return_value = [{"id": "c1", "label": "unsupported", "error_type": "none", "quote": "", "chunk_id": "", "explanation": "none"}]
    claims_with_chunks = [{"id": "c1", "text": claim_text, "chunks": retrieved}]
    res = verify_claims(claims_with_chunks)
    assert mock_call.called
    assert len(res) == 1
    
    # Only an empty document (zero chunks) skips the LLM call
    mock_call.reset_mock()
    empty_retrieved = retrieve(claim_text, [])
    assert empty_retrieved == []
    empty_res = verify_claims([])
    assert empty_res == []
    mock_call.assert_not_called()

# --- Validators Tests ---
def test_quote_check():
    assert quote_check("Hello world", "Hello world this is a test") == True
    assert quote_check("Fee is 5000", "The fee is 5000.") == True # fuzzy
    assert quote_check("Completely fake quote", "Nothing here") == False

def test_number_check():
    assert number_check("The fee is 5000", "fee is 5000") == True
    assert number_check("The fee is 8000", "fee is 5000") == False
    assert number_check("Happens on May 10", "Takes place on May 10") == True

def test_run_validators():
    claim = {
        "text": "The fee is 8000",
        "label": "supported",
        "evidence": [{"quote": "The fee is 5000"}]
    }
    res = run_validators(claim, "The fee is 5000")
    assert res["checks"]["quote_found"] == True
    assert res["checks"]["numbers_match"] == False
    assert res["label"] == "ambiguous" # number mismatch downgrades supported to ambiguous

    claim2 = {
        "text": "fake",
        "label": "supported",
        "evidence": [{"quote": "fake quote"}]
    }
    res2 = run_validators(claim2, "nothing like it")
    assert res2["checks"]["quote_found"] == False
    assert res2["label"] == "unsupported"
    assert res2.get("diagnosis") == "evidence_not_verified"
    assert len(res2["evidence"]) == 0

# --- Confidence Tests ---
def test_compute_confidence():
    # clean supported -> high
    c1 = {"label": "supported", "checks": {"passes_agree": True, "quote_found": True, "numbers_match": True}}
    assert compute_confidence(c1) == "high"
    
    # passes disagree -> low
    c2 = {"label": "supported", "checks": {"passes_agree": False, "quote_found": True, "numbers_match": True}}
    assert compute_confidence(c2) == "low"
    
    # fake quote downgraded -> low
    c3 = {"label": "unsupported", "diagnosis": "evidence_not_verified", "checks": {"passes_agree": True, "quote_found": False, "numbers_match": True}}
    assert compute_confidence(c3) == "low"

    # unsupported with agreeing passes -> medium
    c4 = {"label": "unsupported", "checks": {"passes_agree": True, "quote_found": False, "numbers_match": True}}
    assert compute_confidence(c4) == "medium"

# --- Reasoning Tests ---
@patch('backend.reasoning.call_json')
def test_extract_reasoning_issues(mock_call):
    mock_call.return_value = [{"id": "i1", "type": "logic_gap", "text": "skip orientation", "explanation": "gap", "related_claims": []}]
    answer = "You can skip orientation."
    issues = extract_reasoning_issues(answer, [])
    assert len(issues) == 1
    assert issues[0]["span"] == {"start": 8, "end": 24}

# --- Verification & Review Consistency Tests ---
@patch('backend.verify.call_json')
def test_needs_review_equals_not_passes_agree(mock_call):
    claims_with_chunks = [
        {"id": "c1", "text": "Claim 1", "chunks": [{"chunk_id": "chk1", "text": "evidence 1"}]},
        {"id": "c2", "text": "Claim 2", "chunks": [{"chunk_id": "chk2", "text": "evidence 2"}]},
        {"id": "c3", "text": "Claim 3", "chunks": [{"chunk_id": "chk3", "text": "evidence 3"}]},
        {"id": "c4", "text": "Claim 4", "chunks": [{"chunk_id": "chk4", "text": "evidence 4"}]},
    ]
    
    first_pass_results = [
        {"id": "c1", "label": "supported", "checks": {"passes_agree": True}},      # Supported -> skipped by second pass
        {"id": "c2", "label": "contradicted", "checks": {"passes_agree": True}},   # Contradicted -> second pass agrees
        {"id": "c3", "label": "unsupported", "checks": {"passes_agree": True}},    # Unsupported -> second pass disagrees
        {"id": "c4", "label": "ambiguous", "checks": {"passes_agree": True}},      # Ambiguous -> second pass disagrees
    ]
    
    mock_call.return_value = [
        {"id": "c2", "label": "contradicted", "error_type": "none", "quote": "", "chunk_id": "", "explanation": ""}, # Agree
        {"id": "c3", "label": "supported", "error_type": "none", "quote": "", "chunk_id": "", "explanation": ""},    # Disagree
        {"id": "c4", "label": "contradicted", "error_type": "none", "quote": "", "chunk_id": "", "explanation": ""}, # Disagree
    ]
    
    final_results = verify_second_pass(claims_with_chunks, first_pass_results)
    
    assert len(final_results) == 4
    for claim in final_results:
        assert "needs_review" in claim
        assert "checks" in claim
        assert "passes_agree" in claim["checks"]
        assert claim["needs_review"] == (not claim["checks"]["passes_agree"]), (
            f"Claim {claim['id']} failed: needs_review={claim['needs_review']}, passes_agree={claim['checks']['passes_agree']}"
        )
        
    # Also assert when to_verify is empty (all claims supported)
    all_supported = [
        {"id": "c1", "label": "supported", "checks": {"passes_agree": True}},
    ]
    supp_results = verify_second_pass(claims_with_chunks, all_supported)
    for claim in supp_results:
        assert claim["needs_review"] == (not claim["checks"]["passes_agree"])
        assert claim["needs_review"] is False
        assert claim["checks"]["passes_agree"] is True
