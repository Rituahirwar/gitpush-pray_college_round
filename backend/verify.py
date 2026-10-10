import json
from backend.llm import call_json

def get_verify_schema():
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "label": {"type": "string", "enum": ["supported", "contradicted", "unsupported", "ambiguous"]},
                "error_type": {"type": "string", "enum": ["none", "hallucinated_fact", "unsupported_claim"]},
                "quote": {"type": "string"},
                "chunk_id": {"type": "string"},
                "explanation": {"type": "string"}
            },
            "required": ["id", "label", "error_type", "quote", "chunk_id", "explanation"]
        }
    }

def build_prompt_claims(claims_with_chunks):
    prompt = ""
    for c in claims_with_chunks:
        prompt += f"CLAIM ID: {c['id']}\nCLAIM TEXT: {c['text']}\nEVIDENCE CHUNKS:\n"
        for chunk in c.get('chunks', []):
            prompt += f"- [{chunk['chunk_id']}] {chunk['text']}\n"
        prompt += "\n"
    return prompt

def verify_claims(claims_with_chunks: list) -> list:
    if not claims_with_chunks:
        return []
    system_prompt = (
        "You are an auditor. Judge each CLAIM using ONLY the EVIDENCE CHUNKS given for it. Never use outside knowledge. "
        "Labels: supported = a chunk states or directly implies the claim. "
        "contradicted = a chunk states something incompatible. "
        "unsupported = the chunks do not establish it either way. "
        "ambiguous = the chunks are vague, conflicting, or need interpretation. "
        "For supported and contradicted you MUST copy one verbatim quote (max 40 words) and its chunk_id. "
        "If unsure, choose ambiguous or unsupported, never supported. "
        "error_type: hallucinated_fact for wrong or invented specifics (numbers, dates, names, citations); "
        "unsupported_claim for general statements the source does not back; otherwise none. "
        "Return JSON only, one object per claim: id, label, error_type, quote, chunk_id, explanation."
    )
    user_content = build_prompt_claims(claims_with_chunks)
    
    results = call_json(system_prompt, user_content, get_verify_schema())
    return results

def verify_second_pass(claims_with_chunks: list, first_pass_results: list) -> list:
    to_verify = []
    for fp in first_pass_results:
        if fp.get("label") != "supported":
            claim = next((c for c in claims_with_chunks if c["id"] == fp["id"]), None)
            if claim:
                to_verify.append(claim)
    
    if not to_verify:
        for fp in first_pass_results:
            fp["needs_review"] = False
            if "checks" not in fp:
                fp["checks"] = {}
            fp["checks"]["passes_agree"] = True
        return first_pass_results
        
    system_prompt = (
        "You are an auditor. Judge each CLAIM using ONLY the EVIDENCE CHUNKS given for it. Never use outside knowledge. "
        "First try to find a reason the obvious verdict could be wrong (a different date, a condition, an exception), then decide. "
        "Labels: supported, contradicted, unsupported, ambiguous. "
        "For supported and contradicted you MUST copy one verbatim quote (max 40 words) and its chunk_id. "
        "error_type: none, hallucinated_fact, unsupported_claim. "
        "Return JSON only, one object per claim: id, label, error_type, quote, chunk_id, explanation."
    )
    user_content = build_prompt_claims(to_verify)
    sp_results = call_json(system_prompt, user_content, get_verify_schema())
    sp_dict = {r["id"]: r for r in sp_results}
    
    final_results = []
    for fp in first_pass_results:
        cid = fp["id"]
        if "checks" not in fp:
            fp["checks"] = {}
        if cid in sp_dict:
            sp = sp_dict[cid]
            agrees = (fp["label"] == sp["label"])
            fp["needs_review"] = not agrees
            fp["checks"]["passes_agree"] = agrees
        else:
            fp["needs_review"] = False
            fp["checks"]["passes_agree"] = True
        final_results.append(fp)
        
    return final_results
