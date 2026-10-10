import os
import sys
import json
import csv
import time
import argparse
from pathlib import Path
from collections import defaultdict, Counter
from rapidfuzz import fuzz

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.ingest import ingest
from backend.retrieve import retrieve
from backend.verify import verify_claims, verify_second_pass
from backend.validators import run_validators
from backend.confidence import compute_confidence
from backend.claims import extract_claims

LABELS = ["supported", "contradicted", "unsupported", "ambiguous"]

def compute_metrics(evaluated_claims: list[dict], elapsed_seconds: float) -> dict:
    total = len(evaluated_claims)
    if total == 0:
        return {}

    correct = sum(1 for c in evaluated_claims if c["predicted_label"] == c["gold_label"])
    accuracy = correct / total

    gold_supported_count = sum(1 for c in evaluated_claims if c["gold_label"] == "supported")
    always_supported_baseline = gold_supported_count / total

    conf_mat = {g: {p: 0 for p in LABELS} for g in LABELS}
    for c in evaluated_claims:
        g = c["gold_label"]
        p = c["predicted_label"]
        if g in conf_mat and p in conf_mat[g]:
            conf_mat[g][p] += 1

    per_label = {}
    for lbl in LABELS:
        tp = conf_mat[lbl][lbl]
        fp = sum(conf_mat[other][lbl] for other in LABELS if other != lbl)
        fn = sum(conf_mat[lbl][other] for other in LABELS if other != lbl)

        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0

        per_label[lbl] = {
            "precision": round(prec, 4),
            "precision_raw": f"{tp} of {tp + fp}",
            "precision_k": tp,
            "precision_n": tp + fp,
            "recall": round(rec, 4),
            "recall_raw": f"{tp} of {tp + fn}",
            "recall_k": tp,
            "recall_n": tp + fn,
            "f1": round(f1, 4),
            "support": sum(conf_mat[lbl].values()),
            "n": sum(conf_mat[lbl].values())
        }

    contra_tp = conf_mat["contradicted"]["contradicted"]
    contra_total = sum(conf_mat["contradicted"].values())
    contradiction_recall = per_label["contradicted"]["recall"]

    false_alarms = sum(
        1 for c in evaluated_claims
        if c["gold_label"] == "supported" and c["predicted_label"] in ["contradicted", "unsupported"]
    )
    false_alarm_rate = (false_alarms / gold_supported_count) if gold_supported_count > 0 else 0.0

    total_quotes = 0
    verified_quotes = 0
    for c in evaluated_claims:
        for ev in c.get("evidence", []):
            total_quotes += 1
            if ev.get("verified") is True:
                verified_quotes += 1
    citation_validity = (verified_quotes / total_quotes) if total_quotes > 0 else 1.0

    claims_with_pages = 0
    hits = 0
    for c in evaluated_claims:
        gold_pages = set(c.get("gold_page") or [])
        if gold_pages:
            claims_with_pages += 1
            retrieved_pages = set(chunk.get("page") for chunk in c.get("retrieved_chunks", []))
            if any(p in retrieved_pages for p in gold_pages):
                hits += 1
    retrieval_hit_rate = (hits / claims_with_pages) if claims_with_pages > 0 else 1.0

    nr_true = [c for c in evaluated_claims if c.get("needs_review") is True]
    nr_false = [c for c in evaluated_claims if c.get("needs_review") is False]

    needs_review_rate = len(nr_true) / total if total > 0 else 0.0
    nr_true_correct = sum(1 for c in nr_true if c["predicted_label"] == c["gold_label"])
    nr_false_correct = sum(1 for c in nr_false if c["predicted_label"] == c["gold_label"])
    acc_nr_true = (nr_true_correct / len(nr_true)) if nr_true else 0.0
    acc_nr_false = (nr_false_correct / len(nr_false)) if nr_false else 0.0

    counts = {
        "gold": dict(Counter(c["gold_label"] for c in evaluated_claims)),
        "predicted": dict(Counter(c["predicted_label"] for c in evaluated_claims))
    }

    avg_sec = elapsed_seconds / total if total > 0 else 0.0

    return {
        "n": total,
        "total_claims": total,
        "accuracy": round(accuracy, 4),
        "accuracy_raw": f"{correct} of {total}",
        "accuracy_k": correct,
        "accuracy_n": total,

        "always_supported_baseline": round(always_supported_baseline, 4),
        "always_supported_baseline_raw": f"{gold_supported_count} of {total}",
        "always_supported_baseline_k": gold_supported_count,
        "always_supported_baseline_n": total,

        "contradiction_recall": round(contradiction_recall, 4),
        "contradiction_recall_raw": f"{contra_tp} of {contra_total}",
        "contradiction_recall_k": contra_tp,
        "contradiction_recall_n": contra_total,

        "false_alarm_rate": round(false_alarm_rate, 4),
        "false_alarm_rate_raw": f"{false_alarms} of {gold_supported_count}",
        "false_alarm_rate_k": false_alarms,
        "false_alarm_rate_n": gold_supported_count,

        "citation_validity": round(citation_validity, 4),
        "citation_validity_raw": f"{verified_quotes} of {total_quotes}",
        "citation_validity_k": verified_quotes,
        "citation_validity_n": total_quotes,

        "retrieval_hit_rate": round(retrieval_hit_rate, 4),
        "retrieval_hit_rate_raw": f"{hits} of {claims_with_pages}",
        "retrieval_hit_rate_k": hits,
        "retrieval_hit_rate_n": claims_with_pages,

        "needs_review_rate": round(needs_review_rate, 4),
        "needs_review_rate_raw": f"{len(nr_true)} of {total}",
        "needs_review_rate_k": len(nr_true),
        "needs_review_rate_n": total,

        "accuracy_needs_review_true": round(acc_nr_true, 4),
        "accuracy_needs_review_true_raw": f"{nr_true_correct} of {len(nr_true)}",
        "accuracy_needs_review_true_k": nr_true_correct,
        "accuracy_needs_review_true_n": len(nr_true),

        "accuracy_needs_review_false": round(acc_nr_false, 4),
        "accuracy_needs_review_false_raw": f"{nr_false_correct} of {len(nr_false)}",
        "accuracy_needs_review_false_k": nr_false_correct,
        "accuracy_needs_review_false_n": len(nr_false),

        "avg_seconds_per_claim": round(avg_sec, 4),
        "per_label": per_label,
        "counts": counts,
        "confusion_matrix": conf_mat
    }

def print_metrics_table(split_name: str, metrics: dict):
    print(f"\n{'='*25} {split_name.upper()} EVALUATION RESULTS {'='*25}")
    print(f"Total claims evaluated:     {metrics['total_claims']}")
    print(f"Verdict Accuracy:           {metrics['accuracy']*100:.1f}%")
    print(f"Always-Supported Baseline:  {metrics['always_supported_baseline']*100:.1f}%")
    print(f"Contradiction Recall:       {metrics['contradiction_recall']*100:.1f}%")
    print(f"False-Alarm Rate:           {metrics['false_alarm_rate']*100:.1f}%")
    print(f"Citation Validity:          {metrics['citation_validity']*100:.1f}%")
    print(f"Retrieval Hit Rate:         {metrics['retrieval_hit_rate']*100:.1f}%")
    print(f"needs_review Rate:          {metrics['needs_review_rate']*100:.1f}%")
    print(f"  Accuracy when Review=True:  {metrics['accuracy_needs_review_true']*100:.1f}%")
    print(f"  Accuracy when Review=False: {metrics['accuracy_needs_review_false']*100:.1f}%")
    print(f"Avg Time per Claim:         {metrics['avg_seconds_per_claim']:.2f}s")

    print("\n--- Per-Label Performance ---")
    print(f"{'Label':<15} | {'Precision':<10} | {'Recall':<10} | {'F1':<10} | {'Support':<8}")
    print("-" * 62)
    for lbl in LABELS:
        stat = metrics["per_label"][lbl]
        print(f"{lbl:<15} | {stat['precision']*100:>8.1f}% | {stat['recall']*100:>8.1f}% | {stat['f1']*100:>8.1f}% | {stat['support']:>8}")

    print("\n--- Confusion Matrix (Rows=Gold, Cols=Predicted) ---")
    header = f"{'Gold \\ Pred':<15} | " + " | ".join(f"{lbl[:10]:<10}" for lbl in LABELS)
    print(header)
    print("-" * len(header))
    for g in LABELS:
        row_str = f"{g:<15} | " + " | ".join(f"{metrics['confusion_matrix'][g][p]:>10}" for p in LABELS)
        print(row_str)
    print("=" * 72)

def evaluate_claims_batch(batch: list[dict], doc_chunks: list[dict]) -> list[dict]:
    # 1. Retrieve chunks (k=6) for each claim in batch
    claims_with_chunks = []
    for c in batch:
        ret_chunks = retrieve(c["claim"], doc_chunks, k=6)[:6]
        c_copy = dict(c)
        c_copy["text"] = c["claim"]
        c_copy["chunks"] = ret_chunks
        claims_with_chunks.append(c_copy)

    # 2. First-pass verification
    first_pass_results = verify_claims(claims_with_chunks)
    fp_map = {fp["id"]: fp for fp in first_pass_results}

    # 3. Apply validators to first pass
    validated_claims = []
    for c_info in claims_with_chunks:
        cid = c_info["id"]
        fp = fp_map.get(cid, {
            "id": cid,
            "label": "unsupported",
            "error_type": "none",
            "quote": "",
            "chunk_id": "",
            "explanation": "No response returned"
        })

        claim_dict = {
            "id": fp["id"],
            "text": c_info["text"],
            "label": fp.get("label", "unsupported"),
            "error_type": fp.get("error_type", "none"),
            "confidence": "low",
            "needs_review": False,
            "evidence": [],
            "explanation": fp.get("explanation", "")
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

    # 4. Skeptic second pass for claims not clearly supported
    final_claims = verify_second_pass(claims_with_chunks, validated_claims)

    # 5. Compute confidence
    evaluated = []
    for c_info, c_final in zip(claims_with_chunks, final_claims):
        c_final["confidence"] = compute_confidence(c_final)
        
        evaluated.append({
            "id": c_info["id"],
            "doc_file": c_info["doc_file"],
            "claim": c_info["claim"],
            "gold_label": c_info["gold_label"],
            "gold_page": c_info.get("gold_page", []),
            "split": c_info.get("split", "dev"),
            "predicted_label": c_final["label"],
            "error_type": c_final["error_type"],
            "confidence": c_final["confidence"],
            "needs_review": c_final["needs_review"],
            "evidence": c_final["evidence"],
            "checks": c_final.get("checks", {}),
            "explanation": c_final.get("explanation", ""),
            "retrieved_chunks": c_info["chunks"]
        })

    return evaluated

def run_part1(claims_csv_path: str = "eval/labeled_claims.csv", batch_size: int = 8) -> tuple[list[dict], list[dict], dict]:
    # Read claims
    rows = []
    excluded_ids = []
    with open(claims_csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            notes = (r.get("notes") or "").strip()
            if notes.startswith("EXCLUDE:"):
                excluded_ids.append(r.get("id", ""))
                continue
            pages = json.loads(r["gold_page"]) if r["gold_page"].startswith("[") else [int(p) for p in r["gold_page"].split(",") if p.strip()]
            r["gold_page"] = pages
            rows.append(r)

    if excluded_ids:
        print(f"Excluded {len(excluded_ids)} claim(s) starting with 'EXCLUDE:': {', '.join(excluded_ids)}")
    else:
        print("Excluded 0 claim(s)")

    # Ingest documents once per doc_file
    doc_files = sorted(set(r["doc_file"] for r in rows))
    doc_cache = {}
    print("\nIngesting source documents...")
    for df in doc_files:
        df_path = Path(df)
        if not df_path.exists():
            raise FileNotFoundError(f"Source document not found: {df}")
        t0 = time.time()
        with open(df_path, "rb") as f:
            pdf_bytes = f.read()
        ingest_res = ingest(pdf_bytes)
        doc_cache[df] = ingest_res
        print(f"  Ingested {df} ({ingest_res['pages']} pages, {len(ingest_res['chunks'])} chunks) in {time.time()-t0:.2f}s")

    # Evaluate by document in batches of batch_size
    dev_results = []
    heldout_results = []

    dev_time = 0.0
    heldout_time = 0.0

    for split in ["dev", "heldout"]:
        split_claims = [r for r in rows if r["split"] == split]
        print(f"\nEvaluating {len(split_claims)} claims for split: '{split}' (batches of {batch_size})...")
        
        # Process per doc_file
        split_evaluated = []
        t0 = time.time()
        
        for df in doc_files:
            claims_for_doc = [c for c in split_claims if c["doc_file"] == df]
            if not claims_for_doc:
                continue
            doc_chunks = doc_cache[df]["chunks"]

            for i in range(0, len(claims_for_doc), batch_size):
                batch = claims_for_doc[i:i + batch_size]
                b_ids = [c['id'] for c in batch]
                print(f"  [{df.split('/')[-1][:20]}] Processing batch {i//batch_size + 1}/{(len(claims_for_doc)-1)//batch_size + 1} ({len(batch)} claims: {b_ids[0]}..{b_ids[-1]})...")
                batch_eval = evaluate_claims_batch(batch, doc_chunks)
                split_evaluated.extend(batch_eval)

        elapsed = time.time() - t0
        if split == "dev":
            dev_results = split_evaluated
            dev_time = elapsed
        else:
            heldout_results = split_evaluated
            heldout_time = elapsed

    dev_metrics = compute_metrics(dev_results, dev_time)
    heldout_metrics = compute_metrics(heldout_results, heldout_time)

    return dev_results, heldout_results, {"dev": dev_metrics, "heldout": heldout_metrics, "doc_cache": doc_cache}

def run_part2(doc_cache: dict, report_txt_path: str = "eval/raw/climate-school-report.txt", planted_ids: list = None) -> dict:
    if planted_ids is None:
        planted_ids = [f"R2-C0{i}" for i in range(55, 62)]

    wmo_file = "demo/inputs/large/wmo-state-of-global-climate-2025.pdf"
    if wmo_file not in doc_cache:
        with open(wmo_file, "rb") as f:
            doc_cache[wmo_file] = ingest(f.read())
    wmo_chunks = doc_cache[wmo_file]["chunks"]

    with open(report_txt_path, "r", encoding="utf-8") as f:
        text = f.read()

    # Split text by paragraph to avoid truncation
    paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 30]
    print(f"\n--- Part 2: Planted Error Test on School Report ---")
    print(f"Extracting claims across {len(paragraphs)} paragraphs...")

    all_extracted = []
    claim_counter = 1
    for p_idx, para in enumerate(paragraphs):
        try:
            raw_claims = extract_claims(para)
            for rc in raw_claims:
                rc["id"] = f"sc_{claim_counter}"
                claim_counter += 1
                all_extracted.append(rc)
        except Exception as e:
            if "daily quota" in str(e).lower():
                raise
            print(f"  Warning: extraction failed on para {p_idx+1}: {e}")

    print(f"Extracted {len(all_extracted)} total claims from School Report. Running audit pipeline against WMO PDF...")

    # Attach chunks and verify in batches of 8
    claims_with_chunks = []
    for c in all_extracted:
        ret = retrieve(c["text"], wmo_chunks, k=6)[:6]
        c_copy = dict(c)
        c_copy["chunks"] = ret
        claims_with_chunks.append(c_copy)

    audited_claims = []
    batch_size = 8
    for i in range(0, len(claims_with_chunks), batch_size):
        batch = claims_with_chunks[i:i + batch_size]
        fp = verify_claims(batch)
        fp_map = {f["id"]: f for f in fp}
        val = []
        for c in batch:
            res = fp_map.get(c["id"], {"id": c["id"], "label": "unsupported", "error_type": "none", "quote": ""})
            cd = {
                "id": c["id"],
                "text": c["text"],
                "label": res.get("label", "unsupported"),
                "error_type": res.get("error_type", "none"),
                "evidence": [],
                "explanation": res.get("explanation", "")
            }
            if res.get("chunk_id") and res.get("quote"):
                ch = next((x for x in c["chunks"] if x["chunk_id"] == res["chunk_id"]), None)
                if ch:
                    cd["evidence"].append({"page": ch["page"], "chunk_id": ch["chunk_id"], "quote": res["quote"], "verified": True})
                    cd = run_validators(cd, ch["text"])
                else:
                    cd = run_validators(cd, "")
            else:
                cd = run_validators(cd, "")
            val.append(cd)

        final_batch = verify_second_pass(batch, val)
        for fb in final_batch:
            fb["confidence"] = compute_confidence(fb)
            audited_claims.append(fb)

    # Match against the 7 planted claims
    planted_definitions = {
        "R2-C055": {"gold_label": "contradicted", "text": "CO2 in 2024 was 6.2 ppm more than in 2023"},
        "R2-C056": {"gold_label": "contradicted", "text": "six of the ten most negative annual mass balances since 1950 have occurred since 2016"},
        "R2-C057": {"gold_label": "contradicted", "text": "Texas floods on 4-5 July caused 235 deaths"},
        "R2-C058": {"gold_label": "unsupported", "text": "Greenland ice sheet lost about 270 billion tonnes of ice in 2025"},
        "R2-C059": {"gold_label": "unsupported", "text": "Pakistan monsoon flooding destroyed about 2 million homes"},
        "R2-C060": {"gold_label": "ambiguous", "text": "2025 was cooler than 2024 because a strong El Nino gave way to weak La Nina"},
        "R2-C061": {"gold_label": "ambiguous", "text": "Hurricane Melissa had winds of 298 km/h, the most intense landfall on record"}
    }

    match_report = []
    found_count = 0
    correct_label_count = 0

    print(f"\n--- Planted Claims Match Results ---")
    print(f"{'Planted ID':<10} | {'Gold':<12} | {'Found?':<8} | {'Best Sim':<8} | {'Predicted':<12} | {'Correct Label?'}")
    print("-" * 75)

    for pid in planted_ids:
        pdef = planted_definitions.get(pid, {"gold_label": "unknown", "text": ""})
        target_text = pdef["text"]
        gold_lbl = pdef["gold_label"]

        best_score = 0.0
        best_match = None
        for ac in audited_claims:
            score = max(
                fuzz.partial_ratio(target_text.lower(), ac["text"].lower()),
                fuzz.token_set_ratio(target_text.lower(), ac["text"].lower())
            ) / 100.0
            if score > best_score:
                best_score = score
                best_match = ac

        matched = (best_score >= 0.80) and (best_match is not None)
        pred_lbl = best_match["label"] if matched else "N/A"
        is_correct = (pred_lbl == gold_lbl) if matched else False

        if matched:
            found_count += 1
        if is_correct:
            correct_label_count += 1

        match_report.append({
            "id": pid,
            "gold_label": gold_lbl,
            "target_claim": target_text,
            "matched": matched,
            "similarity": round(best_score, 3),
            "matched_text": best_match["text"] if matched else "",
            "predicted_label": pred_lbl,
            "correct_label": is_correct
        })

        print(f"{pid:<10} | {gold_lbl:<12} | {str(matched):<8} | {best_score:>7.2f}  | {pred_lbl:<12} | {str(is_correct)}")

    return {
        "planted_claims": match_report,
        "total_planted": len(planted_ids),
        "detected_count": found_count,
        "correct_label_count": correct_label_count
    }

def main():
    parser = argparse.ArgumentParser(description="Second Opinion Evaluation Runner")
    parser.add_argument("--claims", default="eval/labeled_claims.csv", help="Path to labeled claims CSV")
    parser.add_argument("--skip-part2", action="store_true", help="Skip part 2 planted error end-to-end test")
    parser.add_argument("--output", default="eval/results.json", help="Path to output results JSON")
    args = parser.parse_args()

    try:
        # Part 1: Claim-level evaluation
        dev_res, heldout_res, metrics_pack = run_part1(claims_csv_path=args.claims)
        dev_metrics = metrics_pack["dev"]
        heldout_metrics = metrics_pack["heldout"]

        print_metrics_table("DEV", dev_metrics)
        print_metrics_table("HELDOUT", heldout_metrics)

        # Part 2: Planted-error test
        part2_res = {}
        if not args.skip_part2:
            part2_res = run_part2(doc_cache=metrics_pack["doc_cache"])

        # Write eval/results.json
        final_results = {
            "headline": "heldout",
            "heldout": heldout_metrics,
            "dev": dev_metrics,
            "part2_planted_test": part2_res
        }

        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(final_results, f, indent=2)
        print(f"\nSuccessfully wrote benchmark results to {out_path}")

    except RuntimeError as e:
        if "daily quota" in str(e).lower() or "quota exhausted" in str(e).lower():
            print(f"\n[CRITICAL ERROR] Daily quota exhausted: {e}", file=sys.stderr)
            print("Evaluation halted immediately to preserve quota. Exiting without retrying.", file=sys.stderr)
            sys.exit(1)
        else:
            raise

if __name__ == "__main__":
    main()
