import pytest
from eval.prepare_labeled_claims import (
    normalize_label,
    parse_gold_page,
    map_doc,
    load_and_deduplicate,
    assign_splits
)

def test_label_mapping():
    assert normalize_label("insufficient") == "unsupported"
    assert normalize_label("INSUFFICIENT") == "unsupported"
    assert normalize_label("supported") == "supported"
    assert normalize_label("Supported ") == "supported"
    assert normalize_label("contradicted") == "contradicted"
    assert normalize_label("ambiguous") == "ambiguous"

    with pytest.raises(ValueError, match="Invalid gold_label 'bogus'"):
        normalize_label("bogus")

def test_page_parsing():
    assert parse_gold_page("4, 20", "supported") == [4, 20]
    assert parse_gold_page(" 27 ", "contradicted") == [27]
    assert parse_gold_page("5, 10, 12, 21", "supported") == [5, 10, 12, 21]
    
    # Blank allowed only for unsupported
    assert parse_gold_page("", "unsupported") == []
    assert parse_gold_page("   ", "unsupported") == []

    with pytest.raises(ValueError, match="Blank gold_page is only allowed for 'unsupported'"):
        parse_gold_page("", "supported")

    with pytest.raises(ValueError, match="Blank gold_page is only allowed for 'unsupported'"):
        parse_gold_page("", "contradicted")

    with pytest.raises(ValueError, match="Invalid page number"):
        parse_gold_page("4, abc", "supported")

def test_doc_mapping():
    f1, a1 = map_doc("Report 1 – Fr. CRCE admissions & fee document")
    assert f1 == "demo/inputs/fr-crce-info.pdf"
    assert a1 == "r1-gold"

    f2, a2 = map_doc("Report 2 – WMO State of the Global Climate 2025")
    assert f2 == "demo/inputs/large/wmo-state-of-global-climate-2025.pdf"
    assert a2 == "r2-gold"

    with pytest.raises(ValueError, match="Unknown document name"):
        map_doc("Random Doc")

def test_duplicate_dropping_and_conflict_detection(tmp_path):
    tsv1 = tmp_path / "t1.tsv"
    tsv1.write_text(
        "id\tdoc\tclaim\tgold_label\tgold_page\tnotes\n"
        "C1\tReport 1 doc\tClaim text\tsupported\t1\tNotes\n"
        "C1\tReport 1 doc\tClaim text\tsupported\t1\tNotes\n" # Exact duplicate
        "C2\tReport 1 doc\tClaim 2 text\tinsufficient\t\tNotes\n",
        encoding="utf-8"
    )

    rows = load_and_deduplicate([str(tsv1)])
    assert len(rows) == 2
    assert rows[0]["id"] == "C1"
    assert rows[1]["id"] == "C2"
    assert rows[1]["gold_label"] == "unsupported"

    # Conflicting duplicate
    tsv_conflict = tmp_path / "conflict.tsv"
    tsv_conflict.write_text(
        "id\tdoc\tclaim\tgold_label\tgold_page\tnotes\n"
        "C1\tReport 1 doc\tDifferent text\tcontradicted\t2\tOther\n",
        encoding="utf-8"
    )

    with pytest.raises(ValueError, match="Duplicate claim ID 'C1' with conflicting content"):
        load_and_deduplicate([str(tsv1), str(tsv_conflict)])

def test_split_reproducibility():
    dummy_rows = [
        {"id": f"R1-C{i:03d}", "doc_file": "doc1.pdf", "gold_label": "supported"}
        for i in range(1, 11)
    ] + [
        {"id": f"R1-C{i:03d}", "doc_file": "doc1.pdf", "gold_label": "contradicted"}
        for i in range(11, 18)
    ]

    splits1 = [r["split"] for r in assign_splits([dict(r) for r in dummy_rows], seed=42)]
    splits2 = [r["split"] for r in assign_splits([dict(r) for r in dummy_rows], seed=42)]
    assert splits1 == splits2

    splits_diff = [r["split"] for r in assign_splits([dict(r) for r in dummy_rows], seed=999)]
    assert splits1 != splits_diff

def test_exclude_filtering(tmp_path):
    tsv = tmp_path / "t.tsv"
    tsv.write_text(
        "id\tdoc\tclaim\tgold_label\tgold_page\tnotes\n"
        "C1\tReport 1 doc\tClaim text\tsupported\t1\tNormal note\n"
        "C2\tReport 1 doc\tDisputed claim\tcontradicted\t1\tEXCLUDE: disputed label\n"
        "C3\tReport 1 doc\tFee claim\tsupported\t1\texcludes the late fee\n",
        encoding="utf-8"
    )
    rows = load_and_deduplicate([str(tsv)])
    assert len(rows) == 2
    row_ids = [r["id"] for r in rows]
    assert "C1" in row_ids
    assert "C3" in row_ids
    assert "C2" not in row_ids
