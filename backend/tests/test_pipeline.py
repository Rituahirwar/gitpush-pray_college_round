import pytest
from unittest.mock import patch
from backend.claims import extract_claims, find_span
from backend.retrieve import retrieve, extract_entities
from backend.validators import quote_check, number_check, run_validators
from backend.confidence import compute_confidence
from backend.reasoning import extract_reasoning_issues

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
    # High
    c1 = {"label": "supported", "checks": {"passes_agree": True, "quote_found": True, "numbers_match": True}}
    assert compute_confidence(c1) == "high"
    
    # Low (passes disagree)
    c2 = {"label": "supported", "checks": {"passes_agree": False, "quote_found": True, "numbers_match": True}}
    assert compute_confidence(c2) == "low"
    
    # Low (no quote)
    c3 = {"label": "unsupported", "checks": {"passes_agree": True, "quote_found": False, "numbers_match": True}}
    assert compute_confidence(c3) == "low"

    # Medium (ambiguous but agreed)
    c4 = {"label": "ambiguous", "checks": {"passes_agree": True, "quote_found": True, "numbers_match": True}}
    assert compute_confidence(c4) == "medium"

# --- Reasoning Tests ---
@patch('backend.reasoning.call_json')
def test_extract_reasoning_issues(mock_call):
    mock_call.return_value = [{"id": "i1", "type": "logic_gap", "text": "skip orientation", "explanation": "gap", "related_claims": []}]
    answer = "You can skip orientation."
    issues = extract_reasoning_issues(answer, [])
    assert len(issues) == 1
    assert issues[0]["span"] == {"start": 8, "end": 24}
