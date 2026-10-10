import json
from backend.llm import call_json
from backend.claims import find_span

def extract_reasoning_issues(answer: str, verified_findings: list) -> list:
    system_prompt = (
        "Given the ANSWER and the VERIFIED FINDINGS, list (a) logic_gap: conclusions or therefore/so/this means "
        "statements that do not follow from the supported findings, and (b) unsafe_advice: recommendations to take "
        "a medical, financial, legal or safety action that the source does not support. "
        "Copy the exact words from the answer for each. Return JSON only. Return an empty list if none."
    )
    
    schema = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "type": {"type": "string", "enum": ["logic_gap", "unsafe_advice"]},
                "text": {"type": "string"},
                "explanation": {"type": "string"},
                "related_claims": {
                    "type": "array",
                    "items": {"type": "string"}
                }
            },
            "required": ["id", "type", "text", "explanation", "related_claims"]
        }
    }
    
    user_content = f"ANSWER:\n{answer}\n\nVERIFIED FINDINGS:\n{json.dumps(verified_findings)}"
    
    raw_issues = call_json(system_prompt, user_content, schema)
    issues = []
    for ri in raw_issues:
        quote = ri.get("text", "")
        span = find_span(answer, quote)
        ri["span"] = span
        issues.append(ri)
    return issues
