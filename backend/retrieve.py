import re
from rank_bm25 import BM25Okapi

def extract_entities(text: str) -> set:
    numbers = set(re.findall(r'\b\d+(?:[,.]\d+)?\b', text))
    dates = set(re.findall(r'\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b', text, re.IGNORECASE))
    caps = set(re.findall(r'\b[A-Z][a-z]+\b', text))
    return numbers.union(dates).union(caps)

def retrieve(claim_text: str, chunks: list, k: int = 4) -> list:
    if not chunks:
        return []
    
    tokenized_corpus = [chunk["text"].lower().split() for chunk in chunks]
    bm25 = BM25Okapi(tokenized_corpus)
    tokenized_query = claim_text.lower().split()
    
    scores = bm25.get_scores(tokenized_query)
    top_n = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:k]
    top_chunks = [chunks[i] for i in top_n]
    
    # Also include chunks with exact entity matches if not already in top_chunks
    entities = extract_entities(claim_text)
    for chunk in chunks:
        if chunk not in top_chunks:
            chunk_text = chunk["text"]
            for ent in entities:
                if ent in chunk_text:
                    top_chunks.append(chunk)
                    break
                    
    return top_chunks

def check_gold_chunk(results: list, gold_chunk_id: str) -> bool:
    return any(c["chunk_id"] == gold_chunk_id for c in results)
