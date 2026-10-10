import pymupdf

def ingest(pdf_bytes: bytes) -> dict:
    try:
        doc = pymupdf.Document(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise ValueError("Not a valid PDF") from e

    pages_count = len(doc)
    chunks = []

    for page_num in range(pages_count):
        page = doc[page_num]
        text = page.get_text("text")
        if not text:
            continue
            
        words = text.split()
        if not words:
            continue
            
        chunk_size = 200
        overlap = 30
        
        current_chunk_idx = 1
        i = 0
        while i < len(words):
            end = min(i + chunk_size, len(words))
            chunk_words = words[i:end]
            chunk_text = " ".join(chunk_words)
            
            chunks.append({
                "chunk_id": f"p{page_num + 1}c{current_chunk_idx}",
                "page": page_num + 1,
                "text": chunk_text
            })
            
            current_chunk_idx += 1
            if end == len(words):
                break
                
            i += (chunk_size - overlap)

    return {
        "pages": pages_count,
        "chunks": chunks
    }
