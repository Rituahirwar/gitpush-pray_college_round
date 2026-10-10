import pytest
import json
from unittest.mock import patch
from eval.run_eval import compute_metrics, evaluate_claims_batch

def test_compute_metrics():
    # 4 claims: 2 supported, 1 contradicted, 1 unsupported
    evaluated = [
        {
            "id": "c1",
            "gold_label": "supported",
            "predicted_label": "supported",
            "gold_page": [1],
            "retrieved_chunks": [{"page": 1}],
            "evidence": [{"verified": True}],
            "needs_review": False
        },
        {
            "id": "c2",
            "gold_label": "supported",
            "predicted_label": "contradicted", # false alarm!
            "gold_page": [1, 2],
            "retrieved_chunks": [{"page": 3}], # missed gold page!
            "evidence": [{"verified": True}],
            "needs_review": False
        },
        {
            "id": "c3",
            "gold_label": "contradicted",
            "predicted_label": "contradicted",
            "gold_page": [2],
            "retrieved_chunks": [{"page": 2}],
            "evidence": [{"verified": False}], # quote not verified
            "needs_review": True
        },
        {
            "id": "c4",
            "gold_label": "unsupported",
            "predicted_label": "unsupported",
            "gold_page": [], # unsupported, no page
            "retrieved_chunks": [{"page": 1}],
            "evidence": [],
            "needs_review": False
        }
    ]

    metrics = compute_metrics(evaluated, elapsed_seconds=2.0)

    # Accuracy and raw counts
    assert metrics["accuracy"] == 0.75
    assert metrics["accuracy_raw"] == "3 of 4"
    assert metrics["n"] == 4
    assert metrics["accuracy_k"] == 3
    assert metrics["accuracy_n"] == 4

    # Gold supported: 2 / 4 -> 50%
    assert metrics["always_supported_baseline"] == 0.50
    assert metrics["always_supported_baseline_raw"] == "2 of 4"

    # Contradiction recall: 1 gold contradicted, predicted correctly -> 1.0
    assert metrics["contradiction_recall"] == 1.0
    assert metrics["contradiction_recall_raw"] == "1 of 1"

    # False alarm: 2 gold supported, 1 predicted contradicted -> 1/2 = 0.5
    assert metrics["false_alarm_rate"] == 0.5
    assert metrics["false_alarm_rate_raw"] == "1 of 2"

    # Citation validity: 3 quotes total (c1, c2, c3), 2 verified -> 2/3 = 0.6667
    assert metrics["citation_validity"] == 0.6667
    assert metrics["citation_validity_raw"] == "2 of 3"

    # Retrieval hit rate: 3 claims have gold_page (c1, c2, c3). c1 hits, c2 misses, c3 hits -> 2/3 = 0.6667
    assert metrics["retrieval_hit_rate"] == 0.6667
    assert metrics["retrieval_hit_rate_raw"] == "2 of 3"

    # needs_review: 1/4 = 0.25
    assert metrics["needs_review_rate"] == 0.25
    assert metrics["needs_review_rate_raw"] == "1 of 4"
    # Accuracy when needs_review is True: c3 is correct -> 1.0
    assert metrics["accuracy_needs_review_true"] == 1.0
    assert metrics["accuracy_needs_review_true_raw"] == "1 of 1"
    # Accuracy when needs_review is False: c1, c4 correct, c2 wrong -> 2/3 = 0.6667
    assert metrics["accuracy_needs_review_false"] == 0.6667
    assert metrics["accuracy_needs_review_false_raw"] == "2 of 3"

    # Confusion matrix
    assert metrics["confusion_matrix"]["supported"]["supported"] == 1
    assert metrics["confusion_matrix"]["supported"]["contradicted"] == 1
    assert metrics["confusion_matrix"]["contradicted"]["contradicted"] == 1
    assert metrics["confusion_matrix"]["unsupported"]["unsupported"] == 1

def test_evaluate_claims_batch_mocked():
    batch = [
        {"id": "b1", "claim": "Test claim", "gold_label": "supported", "doc_file": "doc.pdf"}
    ]
    doc_chunks = [
        {"chunk_id": "chk1", "text": "This is evidence for test claim", "page": 1}
    ]

    with patch("eval.run_eval.retrieve") as mock_ret, \
         patch("eval.run_eval.verify_claims") as mock_vc, \
         patch("eval.run_eval.verify_second_pass") as mock_sp:
        
        mock_ret.return_value = doc_chunks
        mock_vc.return_value = [
            {"id": "b1", "label": "supported", "error_type": "none", "quote": "test claim", "chunk_id": "chk1", "explanation": "ok"}
        ]
        mock_sp.return_value = [
            {"id": "b1", "label": "supported", "error_type": "none", "quote": "test claim", "chunk_id": "chk1", "explanation": "ok", "needs_review": False, "evidence": [{"verified": True}], "checks": {"quote_found": True, "numbers_match": True, "passes_agree": True}}
        ]

        evaluated = evaluate_claims_batch(batch, doc_chunks)
        assert len(evaluated) == 1
        assert evaluated[0]["predicted_label"] == "supported"
        assert evaluated[0]["confidence"] == "high"

def test_benchmark_endpoint_serves_results(tmp_path):
    from fastapi.testclient import TestClient
    from backend.main import app

    client = TestClient(app)
    results_content = {"headline": "heldout", "heldout": {"accuracy": 0.88}}

    # Write temporary eval/results.json
    eval_dir = tmp_path / "eval"
    eval_dir.mkdir(parents=True, exist_ok=True)
    results_file = eval_dir / "results.json"
    results_file.write_text(json.dumps(results_content), encoding="utf-8")

    with patch("backend.main.ROOT_DIR", tmp_path):
        resp = client.get("/api/benchmark")
        assert resp.status_code == 200
        assert resp.json() == results_content

def test_run_eval_csv_exclude_filtering(tmp_path):
    import csv

    csv_file = tmp_path / "claims.csv"
    with open(csv_file, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "doc", "doc_file", "answer_id", "claim", "gold_label", "gold_page", "split", "notes"])
        writer.writerow(["C1", "Report 1", "dummy.pdf", "a1", "Claim 1", "supported", "[1]", "dev", "excludes the late fee"])
        writer.writerow(["C2", "Report 1", "dummy.pdf", "a1", "Claim 2", "supported", "[1]", "dev", "EXCLUDE: disputed label"])

    rows = []
    excluded_ids = []
    with open(csv_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            notes = (r.get("notes") or "").strip()
            if notes.startswith("EXCLUDE:"):
                excluded_ids.append(r.get("id", ""))
                continue
            rows.append(r)

    assert excluded_ids == ["C2"]
    assert len(rows) == 1
    assert rows[0]["id"] == "C1"
