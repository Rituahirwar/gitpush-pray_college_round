# Second Opinion: frontend spec (single source of truth for the UI)

## 1. What the app does
The user uploads a source PDF and pastes an AI-written answer. The backend splits the answer into claims, checks each against the PDF, and returns exact text spans, verbatim quotes and page numbers. The UI shows the answer with each claim marked, and an inspector that proves every verdict with the quote. Verdicts: supported, contradicted, unsupported (source does not say), ambiguous (source is vague). Extra issues: logic_gap, unsafe_advice. It is a working tool, not a landing page.

## 2. Run and connect
- Backend (repo root): uvicorn backend.main:app --port 8000. Real audits need GEMINI_API_KEY in backend/.env. The demo endpoint needs no key.
- Frontend (in /frontend): React + Vite + react-router-dom, JavaScript, plain CSS with CSS variables. Dev server on http://localhost:5173. API base URL from VITE_API_URL, default http://localhost:8000. Commit frontend/.env.example. No UI kit, no pdf.js, no new dependencies without asking.

## 3. Backend API (fixed, never change)
- GET /api/health returns {ok: true}
- GET /api/demo/fr-crce-v2 returns an AuditResult (cached sample, no AI call)
- POST /api/audit, multipart fields: pdf (file) and answer (text). Returns an AuditResult. Takes 10 to 30 seconds. Errors return JSON {detail}: 400 for empty answer, not a PDF, or scanned PDF; 5xx for model or quota errors.
- GET /api/benchmark returns {} when there are no results yet, otherwise the shape in section 8.
AuditResult: { doc:{name,pages}, answer:string, overall:{counts:{supported,contradicted,unsupported,ambiguous}, needs_review:int, assessment:string}, claims:[Claim], issues:[Issue] }
Claim: { id, text, span:{start,end} or null, label, error_type (none|hallucinated_fact|unsupported_claim), confidence (low|medium|high), needs_review:bool, evidence:[{page,chunk_id,quote,verified:bool}], explanation, checks:{quote_found,numbers_match,passes_agree}, diagnosis (optional: verified|contradicted_by_source|source_vague|source_silent|evidence_not_verified) }
Issue: { id, type (logic_gap|unsafe_advice), span:{start,end}, text, explanation, related_claims:[ids] }

## 4. Routes and workflow
Routes: / redirects to /audit. /audit is New audit. /audit/result is the audit screen. /report. /benchmark. Any other path shows a quiet not-found page with a link to /audit.
Global state (React context, persisted in sessionStorage under so.result): result (AuditResult or null), source ('live' or 'sample'), pdfName.

Navbar (on every page): left, small logo mark (two thin overlapping circles) and the wordmark Second Opinion in the serif font, linking to /audit. Centre links: Audit, Report, Benchmark (the active one has a thin white underline; Audit stays active on both /audit and /audit/result). Right: a ghost button Load sample, and a status chip: green dot and 'Backend connected', or red dot and 'Backend offline'. The chip calls /api/health on load and every 15 seconds. 1px bottom border, no shadow. On mobile the links collapse into a menu icon.

New audit (/audit): title 'New audit' (serif) and subtitle 'Check an AI answer against a source document.' Two columns. Left: dashed-border drop zone, 'Drop source PDF here or click to choose'. Accept only .pdf, maximum 25 MB. After choosing, show a chip with file name and size and a remove x. Right: large text area labelled 'AI-generated answer' with a character count. Bottom: white filled button 'Run audit', disabled until both a PDF and non-empty text exist, and a ghost button 'Load sample'. Small grey note: 'Checks only against the document you provide.'
- Run audit: show the loading state, POST to /api/audit, on success store result with source 'live' and pdfName, then go to /audit/result.
- Load sample (here and in the navbar): GET /api/demo/fr-crce-v2, store result with source 'sample', go to /audit/result. Show a small 'Sample run' chip on the result screen.
- Loading state: dim the form and show a thin indeterminate progress line, the text 'Auditing claims. Usually 10 to 30 seconds.' and an elapsed-seconds counter. After 60 seconds add 'Still working. The model may be rate-limited.' A Cancel button aborts the request (AbortController). Do not fake progress stages.
- Errors, shown inline, inputs kept: backend unreachable gives 'Can't reach the backend at {URL}. Start it with: uvicorn backend.main:app --port 8000'. 400 shows the detail message. 5xx or quota text gives 'The model is unavailable or out of quota. Try again later, or load the sample.'

Audit screen (/audit/result): if there is no result in state, redirect to /audit.
- Summary bar under the navbar, one line of mono text: total claims, then a count per verdict with its symbol, then 'needs review N', then 'reasoning issues N'. A thin segmented bar under it shows the verdict proportions in greys. Clicking a verdict count filters to that verdict (others dimmed in the answer and hidden in the list); clicking again clears it. Buttons on the right: 'New audit' and 'View report'.
- Left pane (about 60%): the answer typeset as a document in the serif font, with every claim marked at claim.span using the verdict mark styles (section 5). Issues are marked with their own styles. Marks are buttons. Clicking a mark or a list item selects the claim. Keep both in sync and scroll the selected item into view.
- Right pane (about 40%, sticky): the evidence inspector for the selected claim, then the claim list. If nothing is selected, show a quiet prompt 'Select a marked claim to see the evidence.' and select the first flagged claim by default.
- Inspector contents, top to bottom: claim text; verdict symbol and label; confidence (3-segment meter and the word); a 'Needs review' flag when needs_review is true; the diagnosis line in plain words (verified: 'The source confirms this.' contradicted_by_source: 'The source says otherwise.' source_silent: 'The source does not mention this.' source_vague: 'The source is vague on this.' evidence_not_verified: 'The cited quote could not be verified.'); the Source excerpt; the explanation; check rows (Quote found, Numbers compared, Both passes agree) each with a check or a dash; then the Evidence Trail.
- Source excerpt: a paper-style box with a mono 'p. N' label and the verbatim quote. If evidence[].verified is true show the badge 'Quote verified in PDF', otherwise 'Quote could not be verified'. If evidence is empty show 'No passage cited. The document does not establish this claim.'
- Evidence Trail: four steps joined by a thin vertical line: Claim, Retrieved passage, Comparison, Verdict. In Comparison, when the claim and the quote contain different numbers, show them side by side (extract numeric tokens with a regex), otherwise show the two texts briefly.
- Below the claim list, a section 'Reasoning issues' lists each issue (logic_gap or unsafe_advice) with its text and explanation. Clicking one highlights it in the answer.
- Keyboard: j or Down for the next claim, k or Up for the previous, Escape clears the selection.
- Mobile (below 900px): one column. The summary becomes a horizontally scrolling row of chips. The inspector becomes a bottom sheet (fixed, maximum 70vh, close button, safe-area padding) that opens when a mark or list item is tapped.

Report (/report): title 'Audit report' (serif), document name and generated time, buttons 'Print' (window.print with a print stylesheet: white background, black text, navbar and buttons hidden) and 'Download JSON' (Blob of the current result). A counts row with symbols, then a table: #, Claim, Verdict (symbol and label), Confidence, Evidence (quote shortened to 160 characters), Page. Then the issues. Footer: 'Checked only against the supplied document. Verdicts come from a model plus code checks and can be wrong. Review flagged items.' With no result: empty state with 'Run an audit' and 'Load sample'.

Benchmark (/benchmark): title 'How accurate is it?' and subtitle 'Measured on claims labelled by hand.' Fetch /api/benchmark. If it is {} show 'No evaluation results yet.' with one explanatory line. Otherwise show the held-out split by default (a toggle switches to dev, labelled 'dev, used for tuning'), a metrics table (accuracy, always-supported baseline, contradiction recall, false-alarm rate, citation validity, retrieval hit rate, needs-review rate, average seconds per claim), a per-label precision and recall table, a confusion matrix in greys, the test-set size, the planted-errors line if present, and the limitations list. Every number comes from the API. Show a dash for any missing field. Never invent numbers.

## 5. Visual design
Ultra-minimal, editorial, black and grey. No gradients, glows, shadows, illustrations, hero banners or card mosaics. Thin 1px borders. Generous whitespace.
CSS variables: --bg #0B0B0C, --panel #161618, --panel-2 #1D1D20, --line #2A2A2E, --text #D6D6D8, --text-dim #8A8A8F, --text-bright #F2F2F3. Muted dots only: --dot-supported #6FA88B, --dot-contradicted #C46B6B, --dot-unsupported #C9A55C, --dot-ambiguous #7C93B0. Radius 2px (999px only for chips).
Fonts (Google Fonts link in index.html, display=swap, with fallbacks): Newsreader (serif: wordmark, page titles, and the typeset answer text), JetBrains Mono (quotes, page numbers, labels, counts; labels uppercase, letter-spacing 0.08em), Hanken Grotesk (UI text). Sizes: page title 40/44, section heading 22, body 15/24, answer text 19/34, mono 12 to 13.
Verdict marks (symbol, label and mark style, so colour is never the only signal; the tiny coloured dot sits beside the label only):
- supported: symbol check mark, soft light-grey fill behind the words
- contradicted: symbol cross, inverted block (near-white background, black text)
- unsupported: symbol empty set, dashed underline
- ambiguous: symbol approx sign, wavy underline
- logic_gap: double underline and a small mono tag LOGIC GAP
- unsafe_advice: dotted outline box and a small mono tag UNSAFE
- needs_review: small mono flag REVIEW
Selected mark: 1px white outline with a 2px offset. Visible focus rings everywhere. Text contrast at least 4.5:1.
Motion (3 purposeful ones, all disabled under prefers-reduced-motion): (1) on result load the marks fade in one by one, staggered about 60ms, total under 1.2s; (2) the inspector content slides 8px and cross-fades when the selection changes; (3) the summary counts count up over 600ms and the segmented bar grows from zero.
Stretch (skip if it costs more than one iteration): a thin hairline connector from the selected mark to the inspector.

## 6. Robustness rules
- Spans: Python offsets can differ from JavaScript offsets for unusual characters. For each claim check answer.slice(start, end) against claim.text (ignoring surrounding whitespace). If it does not match, fall back to answer.indexOf(claim.text). If still not found, show no mark and mark the list item 'location not found in answer'. Never crash.
- Overlapping spans: sort by start and render non-overlapping segments, keeping the earlier one; the other still appears in the list.
- Tolerate missing optional fields (diagnosis, evidence empty, span null).
- Marks are real buttons with aria-labels like 'Claim 3, contradicted'. Keyboard works everywhere.
- Never render text taken from design images. All text comes from the API or this spec.

## 7. Definition of done
Every flow in section 4 works against the real backend: sample loads with no key; a real audit with the demo PDF and answer works; backend offline, empty answer, scanned PDF and cancel all show friendly states; filter, keyboard, mobile sheet, report print and JSON download, and the benchmark empty state all work; no console errors.

## 8. Benchmark results shape (eval/results.json, served by GET /api/benchmark)
{ generated_at, model, splits: { heldout: Split, dev: Split }, planted_errors: { found, total, correct_label }, limitations: [strings] }
Split: { n_claims, accuracy, baseline_always_supported, per_label: { supported|contradicted|unsupported|ambiguous: { precision, recall, support } }, contradiction_recall, false_alarm_rate, citation_validity, retrieval_hit_rate, needs_review_rate, avg_seconds_per_claim, confusion: { labels:[four labels], matrix:[[ints]] } }
All rates are numbers from 0 to 1.
