import pytest
import pymupdf
from backend.ingest import ingest

def test_invalid_bytes_raise_value_error():
    with pytest.raises(ValueError, match="Not a valid PDF"):
        ingest(b"this is not a pdf")

def create_pdf_with_text(pages_text):
    doc = pymupdf.Document()
    for text in pages_text:
        page = doc.new_page()
        page.insert_textbox(page.rect, text)
    return doc.tobytes()

def test_page_with_few_words_one_chunk():
    pdf_bytes = create_pdf_with_text(["hello world this is a test"])
    result = ingest(pdf_bytes)
    assert result["pages"] == 1
    assert len(result["chunks"]) == 1
    assert result["chunks"][0]["chunk_id"] == "p1c1"

def test_whitespace_only_page_gives_no_chunks():
    pdf_bytes = create_pdf_with_text(["   \n\t   ", "hello"])
    result = ingest(pdf_bytes)
    assert result["pages"] == 2
    assert len(result["chunks"]) == 1
    assert result["chunks"][0]["page"] == 2

def test_overlap_prevents_sentence_cut():
    words = [f"word{i}" for i in range(250)]
    text = " ".join(words)
    pdf_bytes = create_pdf_with_text([text])
    result = ingest(pdf_bytes)
    
    assert len(result["chunks"]) == 2
    chunk1_words = result["chunks"][0]["text"].split()
    chunk2_words = result["chunks"][1]["text"].split()
    
    # 200 words in chunk 1, chunk 2 should start at index 170.
    # Therefore, the first 30 words of chunk 2 should exactly match the last 30 words of chunk 1.
    assert chunk1_words[-30:] == chunk2_words[:30]

def test_chunk_size_and_page_numbers():
    words1 = " ".join([f"w{i}" for i in range(500)])
    words2 = "hello"
    pdf_bytes = create_pdf_with_text([words1, words2])
    result = ingest(pdf_bytes)
    
    assert result["pages"] == 2
    
    chunks_p1 = [c for c in result["chunks"] if c["page"] == 1]
    assert len(chunks_p1) == 3
    assert chunks_p1[0]["chunk_id"] == "p1c1"
    assert chunks_p1[1]["chunk_id"] == "p1c2"
    assert chunks_p1[2]["chunk_id"] == "p1c3"
    
    chunks_p2 = [c for c in result["chunks"] if c["page"] == 2]
    assert len(chunks_p2) == 1
    assert chunks_p2[0]["chunk_id"] == "p2c1"
