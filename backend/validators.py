import re
from rapidfuzz import fuzz

def normalize_text(text: str) -> str:
    if not text:
        return ""
    return " ".join(text.lower().split())

def quote_check(claim_quote: str, chunk_text: str) -> bool:
    if not claim_quote or not chunk_text:
        return False
    norm_quote = normalize_text(claim_quote)
    norm_chunk = normalize_text(chunk_text)
    
    if norm_quote in norm_chunk:
        return True
        
    ratio = fuzz.partial_ratio(norm_quote, norm_chunk)
    return ratio >= 90

def extract_numbers_dates(text: str) -> set:
    if not text:
        return set()
    numbers = set(re.findall(r'\b\d+(?:[,.]\d+)?\b', text))
    return numbers

def number_check(claim_text: str, quote_text: str) -> bool:
    claim_nums = extract_numbers_dates(claim_text)
    if not claim_nums:
        return True # No numbers to match
        
    quote_nums = extract_numbers_dates(quote_text)
    # If any number in claim is missing from quote, return False
    for num in claim_nums:
        if num not in quote_nums:
            return False
    return True

def run_validators(claim_dict: dict, chunk_text: str = ""):
    quote = ""
    if claim_dict.get("evidence"):
        quote = claim_dict["evidence"][0].get("quote", "")
        
    q_found = quote_check(quote, chunk_text)
    n_match = number_check(claim_dict.get("text", ""), quote)
    
    claim_dict["checks"] = {
        "quote_found": q_found,
        "numbers_match": n_match,
        "passes_agree": claim_dict.get("checks", {}).get("passes_agree", True)
    }
    
    if not q_found and claim_dict.get("evidence"):
        claim_dict["evidence"][0]["verified"] = False
        if claim_dict.get("label") in ["supported", "contradicted"]:
            claim_dict["label"] = "unsupported"
            claim_dict["diagnosis"] = "evidence_not_verified"
        claim_dict["evidence"] = [] # remove evidence if quote fails
            
    if claim_dict.get("label") == "supported" and not n_match:
        claim_dict["label"] = "ambiguous"
        
    return claim_dict
