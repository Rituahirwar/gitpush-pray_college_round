def compute_confidence(claim_dict: dict) -> str:
    checks = claim_dict.get("checks", {})
    passes_agree = checks.get("passes_agree", True)
    quote_found = checks.get("quote_found", False)
    numbers_match = checks.get("numbers_match", True)
    label = claim_dict.get("label")
    
    if not passes_agree or not quote_found:
        return "low"
        
    if label in ["unsupported", "ambiguous"]:
        return "medium"
        
    if passes_agree and quote_found and numbers_match:
        return "high"
        
    return "medium"
