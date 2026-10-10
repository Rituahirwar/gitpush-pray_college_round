import csv
import json
import random
from pathlib import Path
from collections import defaultdict, Counter

def normalize_label(label: str) -> str:
    lbl = (label or "").strip().lower()
    if lbl == "insufficient":
        lbl = "unsupported"
    allowed = {"supported", "contradicted", "unsupported", "ambiguous"}
    if lbl not in allowed:
        raise ValueError(f"Invalid gold_label '{label}'. Must be one of {allowed}")
    return lbl

def parse_gold_page(raw_page: str, label: str) -> list[int]:
    raw = (raw_page or "").strip()
    if not raw:
        if label == "unsupported":
            return []
        raise ValueError(f"Blank gold_page is only allowed for 'unsupported' claims, but label is '{label}'")
    pages = []
    for part in raw.split(","):
        part = part.strip()
        if part:
            try:
                pages.append(int(part))
            except ValueError:
                raise ValueError(f"Invalid page number '{part}' in '{raw_page}'")
    return pages

def map_doc(doc_name: str) -> tuple[str, str]:
    doc_str = (doc_name or "").strip()
    if doc_str.startswith("Report 1"):
        return "demo/inputs/fr-crce-info.pdf", "r1-gold"
    elif doc_str.startswith("Report 2"):
        return "demo/inputs/large/wmo-state-of-global-climate-2025.pdf", "r2-gold"
    else:
        raise ValueError(f"Unknown document name '{doc_name}'. Expected to start with 'Report 1' or 'Report 2'")

def load_and_deduplicate(tsv_paths: list[str]) -> list[dict]:
    seen_exact = set()
    rows_by_id = {}
    ordered_rows = []

    excluded_ids = []
    for path in tsv_paths:
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                cid = row["id"].strip()
                doc = row["doc"].strip()
                claim = row["claim"].strip()
                g_label = row["gold_label"].strip()
                g_page = row["gold_page"].strip()
                notes = (row.get("notes") or "").strip()
                if notes.startswith("EXCLUDE:"):
                    excluded_ids.append(cid)
                    continue

                key = (cid, doc, claim, g_label, g_page, notes)
                if key in seen_exact:
                    continue
                seen_exact.add(key)

                if cid in rows_by_id:
                    existing = rows_by_id[cid]
                    raise ValueError(
                        f"Duplicate claim ID '{cid}' with conflicting content:\n"
                        f"  Existing: {existing}\n"
                        f"  New:      {row}"
                    )
                
                norm_lbl = normalize_label(g_label)
                pages = parse_gold_page(g_page, norm_lbl)
                doc_file, answer_id = map_doc(doc)

                item = {
                    "id": cid,
                    "doc": doc,
                    "doc_file": doc_file,
                    "answer_id": answer_id,
                    "claim": claim,
                    "gold_label": norm_lbl,
                    "gold_page": pages,
                    "notes": notes
                }
                rows_by_id[cid] = item
                ordered_rows.append(item)

    if excluded_ids:
        print(f"Excluded {len(excluded_ids)} claim(s) starting with 'EXCLUDE:': {', '.join(excluded_ids)}")
    else:
        print("Excluded 0 claim(s)")

    return ordered_rows

def assign_splits(rows: list[dict], seed: int = 42) -> list[dict]:
    rng = random.Random(seed)
    
    # Group by (doc_file, gold_label)
    groups = defaultdict(list)
    for r in rows:
        key = (r["doc_file"], r["gold_label"])
        groups[key].append(r)
        
    for key, group in sorted(groups.items()):
        # Sort deterministically by id before sampling
        group.sort(key=lambda x: x["id"])
        n = len(group)
        if n <= 1:
            n_dev = 1
        elif n == 2:
            n_dev = 1
        elif n == 3:
            n_dev = 2
        else:
            n_dev = max(2, round(n * 0.35))
            
        dev_indices = set(rng.sample(range(n), n_dev))
        for i, item in enumerate(group):
            item["split"] = "dev" if i in dev_indices else "heldout"
            
    return rows

def process_claims(
    tsv_paths: list[str] = ["eval/raw/r1_claims.tsv", "eval/raw/r2_claims.tsv"],
    out_csv: str = "eval/labeled_claims.csv",
    seed: int = 42
) -> list[dict]:
    rows = load_and_deduplicate(tsv_paths)
    rows = assign_splits(rows, seed=seed)

    # Sort final rows deterministically by answer_id, id
    rows.sort(key=lambda x: (x["answer_id"], x["id"]))

    fieldnames = ["id", "doc", "doc_file", "answer_id", "claim", "gold_label", "gold_page", "split", "notes"]
    
    Path(out_csv).parent.mkdir(parents=True, exist_ok=True)
    with open(out_csv, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            out_row = dict(r)
            out_row["gold_page"] = json.dumps(r["gold_page"])
            writer.writerow(out_row)

    print_summary(rows, out_csv)
    return rows

def print_summary(rows: list[dict], out_csv: str):
    print(f"\nWrote {len(rows)} claims to {out_csv}\n")
    
    # Table counts per doc x label x split
    counts = defaultdict(lambda: Counter())
    total_labels = Counter()

    for r in rows:
        doc_short = "Report 1 (Fr. CRCE)" if "Report 1" in r["doc"] else "Report 2 (WMO Climate)"
        lbl = r["gold_label"]
        split = r["split"]
        counts[(doc_short, lbl)][split] += 1
        total_labels[lbl] += 1

    header = f"{'Document':<25} | {'Gold Label':<14} | {'Dev':<6} | {'Heldout':<8} | {'Total':<6}"
    print(header)
    print("-" * len(header))

    current_doc = None
    for (doc, lbl) in sorted(counts.keys()):
        c = counts[(doc, lbl)]
        dev_c = c["dev"]
        held_c = c["heldout"]
        tot = dev_c + held_c
        doc_disp = doc if doc != current_doc else ""
        current_doc = doc
        print(f"{doc_disp:<25} | {lbl:<14} | {dev_c:<6} | {held_c:<8} | {tot:<6}")

    total_claims = len(rows)
    supp_claims = total_labels["supported"]
    supp_pct = (supp_claims / total_claims * 100) if total_claims > 0 else 0
    print("-" * len(header))
    print(f"Total claims: {total_claims}")
    print(f"Share of 'supported' claims: {supp_claims}/{total_claims} ({supp_pct:.1f}%)\n")

if __name__ == "__main__":
    process_claims()
