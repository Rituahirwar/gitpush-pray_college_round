import json
import re
from rapidfuzz import fuzz
from backend.llm import call_json

def find_span(answer: str, quote: str) -> dict:
    if not quote:
        return None
    start = answer.find(quote)
    if start != -1:
        return {"start": start, "end": start + len(quote)}
    
    # Fuzzy fallback
    best_ratio = 0
    best_span = None
    window_sizes = [len(quote), len(quote) + 5, len(quote) - 5]
    for w in window_sizes:
        if w <= 0: continue
        for i in range(len(answer) - w + 1):
            candidate = answer[i:i+w]
            ratio = fuzz.ratio(quote.lower(), candidate.lower())
            if ratio >= 90 and ratio > best_ratio:
                best_ratio = ratio
                best_span = {"start": i, "end": i + w}
    return best_span

def extract_claims(answer: str) -> list:
    system_prompt = (
        "Split an AI-generated answer into atomic factual claims. One checkable fact per claim. "
        "Keep original wording. For each claim copy the exact words from the answer into the field quote. "
        "Do not add or infer anything. "
        "A conclusion (so, therefore, since X then Y) and a recommendation (you can, you should, you could) each contain a checkable assertion: extract that assertion as its own claim. "
        "Skip only pure opinion with no checkable content, and greetings. Each claim must be a full sentence that stands alone. "
        "Return JSON only: a list of objects with id and quote."
    )
    schema = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "quote": {"type": "string"}
            },
            "required": ["id", "quote"]
        }
    }
    
    raw_claims = call_json(system_prompt, answer, schema)
    claims = []
    for rc in raw_claims:
        quote = rc.get("quote", "")
        span = find_span(answer, quote)
        claims.append({
            "id": rc.get("id"),
            "text": quote,
            "span": span
        })
    return claims
