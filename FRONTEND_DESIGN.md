# Frontend design brief: Second Opinion

Concept: an auditor's console. Blueprint line-art plus proofreader's marks. Dark, technical, precise. Reference image: design/reference.png (mood only; do NOT copy its text, its "Integrity Score" gauge, or its marketing nav). Quiet, typographic, precise. A working tool: it opens straight into the app. No marketing copy, no card grids, no gradients, no emoji, no shadows.

Palette (CSS variables only, black and grey):
--bg #0a0a0a; --surface #121212; --line #262626; --text #ebebeb; --muted #8c8c8c; --dim #5a5a5a; --accent #ebebeb (one token; identical to text for now so a single accent colour can be tried later by changing one line).

Type (two families only, self-hosted with @fontsource so the demo works offline):
- A grotesque for headline and body (e.g. Space Grotesk). Headline "AUDIT ANOTHER AI." in large uppercase; flat light grey (a subtle silver gradient on the headline only is allowed).
- A monospace (e.g. JetBrains Mono) for labels, numbers, claim index, buttons and verbatim quotes. Small caps-style uppercase labels, letter-spacing 0.08em.
Never Inter, Roboto, Arial or system fonts.

Visual language: 1px frames with small corner ticks, faint dot-grid background, numbered mono micro-labels ("01 / CLAIM LEVEL"), panel titles in small uppercase mono ("AUDITOR PANEL", "SOURCE"). No shadows, no emoji.

Nav: wordmark "Second Opinion" plus links Audit, Benchmark, Load sample. No Features/Security/Docs, no dead links.

Layout (desktop, three columns, thin 1px lines between them, no boxes):
1. Left, narrow: claim ledger. Each claim is a row: footnote number, verdict glyph, short text. Selected row is inverted (light text on dark becomes dark on light).
2. Center: the answer as a typeset manuscript, generous line height, about 62ch wide. Findings are marked inline with superscript footnote numbers matching the ledger.
3. Right: evidence slip for the selected claim, styled like an index card: verdict, error type, confidence, needs_review flag, explanation, then the verbatim quote with its page in mono ("p. 3"), and an "Evidence verified" mark.
Top strip: wordmark "Second Opinion", document name, and counts as large mono numerals (supported / contradicted / insufficient / ambiguous), plus needs-review count and the assessment sentence.
Mobile (390px): single column; the evidence slip becomes a bottom sheet; the ledger becomes a horizontal strip or collapsible list.

Upload screen = the hero:
- Left: large headline "AUDIT ANOTHER AI." and one line of copy.
- Right: framed PDF drop zone and answer box in framed panels, and an "Audit" button; "Load sample".
- Loading state: an indeterminate thin line with the stage names listed ("Extracting claims, Retrieving passages, Verifying, Checking consistency") - do not tick them off. Clear errors: no PDF, scanned PDF, empty answer, server error.

Verdict encoding (never colour alone; every verdict has glyph + text label + mark style):
- supported: glyph "✓", thin solid underline.
- contradicted: glyph "✕", inverted highlight (light background, dark text). The loudest mark.
- unsupported: show the label "Insufficient evidence" (code value stays "unsupported"); glyph "○", dashed underline.
- ambiguous: glyph "◐", wavy underline.
- logic_gap issue: double underline plus tag "LOGIC GAP".
- unsafe_advice issue: square brackets [ ] around the text plus tag "UNSAFE ADVICE".
- needs_review: a small "?" flag next to the footnote number.
- confidence: three-segment bar (low ▮▯▯, medium ▮▮▯, high ▮▮▮) plus the word.
Contrast must be at least 4.5:1 for text. Visible focus rings (1px outline, 2px offset).

VerdictBar: never show an overall score or percentage. Show "Claims by verdict": a stacked horizontal bar with greyscale hatch patterns per verdict, plus the counts, plus the needs-review count and the assessment sentence.

Evidence Trail: a vertical hairline linking five steps: Claim, Retrieved passage, Comparison, Verdict, Explanation. Each step is revealed in order.

Selected claim line (optional, last): draw one thin animated SVG line from the marked text to its quote in the evidence panel.

Motion (CSS only, no new libraries; respect prefers-reduced-motion):
1. Marks draw in one by one (underline stroke animation, 60ms stagger).
2. The evidence slip slides in from the right, 180ms.
3. Counts tick up from 0.

Data rules: follow backend/contract.md exactly. Tolerate: diagnosis missing, span null (show the claim in the ledger as "location not found", no inline mark), empty evidence, empty issues, related_claims empty.
Benchmark page: a plain mono table with test-set size and a limitations note; show raw counts ("5 of 6").
