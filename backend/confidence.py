def compute_confidence(claim_dict: dict) -> str:
    checks = claim_dict.get("checks", {})
    passes_agree = checks.get("passes_agree", True)
    quote_found = checks.get("quote_found", False)
    numbers_match = checks.get("numbers_match", True)
    label = claim_dict.get("label")
    diagnosis = claim_dict.get("diagnosis")
    
    if not passes_agree:
        return "low"
        
    if diagnosis == "evidence_not_verified":
        return "low"
        
    if label in ["unsupported", "ambiguous"]:
        return "medium"

    if label == "contradicted":
        # For contradicted claims, ignore numbers_match because a number mismatch
        # is the very evidence for the contradiction.
        if quote_found:
            return "high"
        return "medium"
        
    # For supported claims, require both quote_found and numbers_match
    if quote_found and numbers_match:
        return "high"
        
    return "medium"
