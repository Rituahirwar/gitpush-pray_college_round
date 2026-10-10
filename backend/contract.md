# API contract v1 (fixed - do not change without telling the team)
Endpoints: POST /api/audit (multipart: pdf file + answer text) returns AuditResult. GET /api/demo/{id} returns a cached AuditResult. GET /api/benchmark returns eval results. GET /api/health returns {ok: true}. CORS enabled for http://localhost:5173. No database; everything in memory.

AuditResult {
  doc: { name, pages }
  answer: string
  overall: { counts: { supported, contradicted, unsupported, ambiguous }, needs_review: int, assessment: string }
  claims: Claim[]
  issues: Issue[]
}
Claim {
  id, text
  span: { start, end }   // character positions in answer; null if not found
  label: supported | contradicted | unsupported | ambiguous
  error_type: none | hallucinated_fact | unsupported_claim
  confidence: low | medium | high   // computed from code checks, never a made-up percentage
  needs_review: bool
  evidence: [ { page, chunk_id, quote, verified: bool } ]
  explanation: string
  checks: { quote_found: bool, numbers_match: bool, passes_agree: bool }
  diagnosis?: verified | contradicted_by_source | source_silent | source_vague | evidence_not_verified   // OPTIONAL, frontend must tolerate it missing
}
Issue {
  id, type: logic_gap | unsafe_advice
  span: { start, end }, text, explanation
  related_claims: string[]
}
