import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAudit } from '../context/AuditContext'
import './AuditResult.css'

const DIAGNOSIS_LABELS = {
  verified: 'The source confirms this.',
  contradicted_by_source: 'The source says otherwise.',
  source_silent: 'The source does not mention this.',
  source_vague: 'The source is vague on this.',
  evidence_not_verified: 'The cited quote could not be verified.'
}

const VERDICT_META = {
  supported: { symbol: '✓', label: 'Supported', dotColor: 'var(--dot-supported)' },
  contradicted: { symbol: '✕', label: 'Contradicted', dotColor: 'var(--dot-contradicted)' },
  unsupported: { symbol: '∅', label: 'Unsupported', dotColor: 'var(--dot-unsupported)' },
  ambiguous: { symbol: '≈', label: 'Ambiguous', dotColor: 'var(--dot-ambiguous)' }
}

// Regex to extract numbers/currency tokens
function extractNumbers(text) {
  if (!text) return []
  const matches = text.match(/[₹$€£]?\s*[\d,.]+(?:\s*(?:k|m|b|crore|lakh))?/gi)
  return matches ? matches.map((m) => m.trim()) : []
}

export default function AuditResult() {
  const navigate = useNavigate()
  const { result, source } = useAudit()

  const claims = useMemo(() => result?.claims || [], [result?.claims])
  const issues = useMemo(() => result?.issues || [], [result?.issues])
  const counts = result?.overall?.counts || { supported: 0, contradicted: 0, unsupported: 0, ambiguous: 0 }
  const needsReviewCount = result?.overall?.needs_review || 0
  const totalClaims = claims.length

  const [selectedClaimId, setSelectedClaimId] = useState(() => {
    if (!result?.claims?.length) return null
    const firstFlagged = result.claims.find(
      (c) => c.label === 'contradicted' || c.needs_review || c.label === 'unsupported'
    )
    return firstFlagged ? firstFlagged.id : result.claims[0].id
  })

  const [selectedIssueId, setSelectedIssueId] = useState(null)
  const [filterVerdict, setFilterVerdict] = useState(null)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)

  const answerContainerRef = useRef(null)
  const claimRefs = useRef({})

  // Redirect to /audit if no result in state
  useEffect(() => {
    if (!result) {
      navigate('/audit')
    }
  }, [result, navigate])

  const selectedClaim = useMemo(() => {
    return claims.find((c) => c.id === selectedClaimId) || null
  }, [claims, selectedClaimId])

  const _selectedIssue = useMemo(() => {
    return issues.find((i) => i.id === selectedIssueId) || null
  }, [issues, selectedIssueId])

  // Filtered claims
  const filteredClaims = useMemo(() => {
    if (!filterVerdict) return claims
    return claims.filter((c) => c.label === filterVerdict)
  }, [claims, filterVerdict])

  // Keyboard navigation: j/Down (next), k/Up (prev), Escape (clear)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return

      if (e.key === 'Escape') {
        setSelectedClaimId(null)
        setSelectedIssueId(null)
        setMobileSheetOpen(false)
        return
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        const currentIndex = filteredClaims.findIndex((c) => c.id === selectedClaimId)
        const nextIndex = currentIndex < filteredClaims.length - 1 ? currentIndex + 1 : 0
        if (filteredClaims[nextIndex]) {
          setSelectedClaimId(filteredClaims[nextIndex].id)
          setSelectedIssueId(null)
        }
      }

      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        const currentIndex = filteredClaims.findIndex((c) => c.id === selectedClaimId)
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredClaims.length - 1
        if (filteredClaims[prevIndex]) {
          setSelectedClaimId(filteredClaims[prevIndex].id)
          setSelectedIssueId(null)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredClaims, selectedClaimId])

  // Build segmented mark slices for typeset answer (Section 6 Robustness Rules)
  const markSlices = useMemo(() => {
    if (!result?.answer) return []
    const answer = result.answer

    // Collect valid claim spans
    const resolvedSpans = []

    claims.forEach((c) => {
      let start = c.span?.start
      let end = c.span?.end
      let valid = false

      if (Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= answer.length && end > start) {
        const slice = answer.slice(start, end).trim()
        const expected = (c.text || '').trim()
        if (slice === expected || slice.length >= expected.length * 0.8) {
          valid = true
        }
      }

      // Fallback: indexOf
      if (!valid && c.text) {
        const found = answer.indexOf(c.text.trim())
        if (found !== -1) {
          start = found
          end = found + c.text.trim().length
          valid = true
        }
      }

      if (valid) {
        resolvedSpans.push({
          type: 'claim',
          id: c.id,
          start,
          end,
          item: c
        })
      }
    })

    // Collect issue spans
    issues.forEach((issue) => {
      let start = issue.span?.start
      let end = issue.span?.end
      let valid = false

      if (Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= answer.length && end > start) {
        valid = true
      } else if (issue.text) {
        const found = answer.indexOf(issue.text.trim())
        if (found !== -1) {
          start = found
          end = found + issue.text.trim().length
          valid = true
        }
      }

      if (valid) {
        resolvedSpans.push({
          type: 'issue',
          id: issue.id,
          start,
          end,
          item: issue
        })
      }
    })

    // Sort by start position, non-overlapping
    resolvedSpans.sort((a, b) => a.start - b.start)

    const nonOverlapping = []
    let cursor = 0

    resolvedSpans.forEach((span) => {
      if (span.start >= cursor) {
        nonOverlapping.push(span)
        cursor = span.end
      }
    })

    // Build text fragments
    const fragments = []
    let lastIndex = 0

    nonOverlapping.forEach((span) => {
      if (span.start > lastIndex) {
        fragments.push({
          isMarked: false,
          text: answer.slice(lastIndex, span.start)
        })
      }

      fragments.push({
        isMarked: true,
        type: span.type,
        id: span.id,
        text: answer.slice(span.start, span.end),
        item: span.item
      })

      lastIndex = span.end
    })

    if (lastIndex < answer.length) {
      fragments.push({
        isMarked: false,
        text: answer.slice(lastIndex)
      })
    }

    return fragments
  }, [result?.answer, claims, issues])

  if (!result) return null

  // Proportion percentages for segmented bar
  const total = totalClaims || 1
  const suppPct = ((counts.supported || 0) / total) * 100
  const contraPct = ((counts.contradicted || 0) / total) * 100
  const unsuppPct = ((counts.unsupported || 0) / total) * 100
  const ambigPct = ((counts.ambiguous || 0) / total) * 100

  // Evidence comparison data
  const claimNumbers = extractNumbers(selectedClaim?.text)
  const quoteNumbers = extractNumbers(selectedClaim?.evidence?.[0]?.quote)
  const hasNumberMismatch =
    claimNumbers.length > 0 &&
    quoteNumbers.length > 0 &&
    claimNumbers[0] !== quoteNumbers[0]

  return (
    <div className="audit-result-view">
      {/* 1. Summary Bar Under Navbar */}
      <div className="summary-bar">
        <div className="summary-bar__top">
          <div className="summary-bar__metrics font-mono">
            <span className="metric-total">{totalClaims} CLAIMS</span>
            <span className="metric-sep">&bull;</span>

            {/* Verdict Filter Buttons */}
            <button
              type="button"
              className={`metric-filter-btn ${filterVerdict === 'supported' ? 'is-active' : ''}`}
              onClick={() => setFilterVerdict(filterVerdict === 'supported' ? null : 'supported')}
            >
              <span className="verdict-dot" style={{ background: 'var(--dot-supported)' }} />
              [✓] {counts.supported || 0} SUPPORTED
            </button>
            <span className="metric-sep">&bull;</span>

            <button
              type="button"
              className={`metric-filter-btn ${filterVerdict === 'contradicted' ? 'is-active' : ''}`}
              onClick={() => setFilterVerdict(filterVerdict === 'contradicted' ? null : 'contradicted')}
            >
              <span className="verdict-dot" style={{ background: 'var(--dot-contradicted)' }} />
              [✕] {counts.contradicted || 0} CONTRADICTED
            </button>
            <span className="metric-sep">&bull;</span>

            <button
              type="button"
              className={`metric-filter-btn ${filterVerdict === 'unsupported' ? 'is-active' : ''}`}
              onClick={() => setFilterVerdict(filterVerdict === 'unsupported' ? null : 'unsupported')}
            >
              <span className="verdict-dot" style={{ background: 'var(--dot-unsupported)' }} />
              [∅] {counts.unsupported || 0} UNSUPPORTED
            </button>
            <span className="metric-sep">&bull;</span>

            <button
              type="button"
              className={`metric-filter-btn ${filterVerdict === 'ambiguous' ? 'is-active' : ''}`}
              onClick={() => setFilterVerdict(filterVerdict === 'ambiguous' ? null : 'ambiguous')}
            >
              <span className="verdict-dot" style={{ background: 'var(--dot-ambiguous)' }} />
              [≈] {counts.ambiguous || 0} AMBIGUOUS
            </button>
            <span className="metric-sep">&bull;</span>

            <span className="metric-flag">[!] {needsReviewCount} NEEDS REVIEW</span>
            <span className="metric-sep">&bull;</span>
            <span className="metric-issues">⇄ {issues.length} REASONING ISSUES</span>
          </div>

          <div className="summary-bar__actions">
            {source === 'sample' && <span className="sample-run-chip mono-chip">Sample run</span>}
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => navigate('/audit')}
            >
              New audit
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => navigate('/report')}
            >
              View report
            </button>
          </div>
        </div>

        {/* Thin Segmented Proportions Bar */}
        <div className="summary-segmented-bar" aria-hidden="true">
          <div className="segment-supported" style={{ width: `${suppPct}%` }} title={`Supported: ${counts.supported}`} />
          <div className="segment-contradicted" style={{ width: `${contraPct}%` }} title={`Contradicted: ${counts.contradicted}`} />
          <div className="segment-unsupported" style={{ width: `${unsuppPct}%` }} title={`Unsupported: ${counts.unsupported}`} />
          <div className="segment-ambiguous" style={{ width: `${ambigPct}%` }} title={`Ambiguous: ${counts.ambiguous}`} />
        </div>
      </div>

      {/* 2. Workspace Two-Pane Grid */}
      <div className="workspace-grid">
        {/* Left Pane (60%): Typeset Manuscript */}
        <div className="workspace-left-pane">
          <div className="pane-header">
            <span className="mono-label">AI-GENERATED ANSWER</span>
            <span className="mono-label">P. 01 OF 01</span>
          </div>

          <div className="manuscript-body" ref={answerContainerRef}>
            <p className="manuscript-paragraph font-serif">
              {markSlices.map((slice, i) => {
                if (!slice.isMarked) {
                  return <span key={i}>{slice.text}</span>
                }

                if (slice.type === 'claim') {
                  const claim = slice.item
                  const isSelected = selectedClaimId === claim.id
                  const isDimmed = filterVerdict && filterVerdict !== claim.label
                  const claimIndex = claims.findIndex((c) => c.id === claim.id) + 1
                  const claimIdxStr = String(claimIndex).padStart(2, '0')
                  const meta = VERDICT_META[claim.label] || VERDICT_META.unsupported

                  let markClass = `claim-mark mark-${claim.label}`
                  if (isSelected) markClass += ' is-selected'
                  if (isDimmed) markClass += ' is-dimmed'

                  return (
                    <button
                      key={claim.id || i}
                      type="button"
                      className={markClass}
                      onClick={() => {
                        setSelectedClaimId(claim.id)
                        setSelectedIssueId(null)
                        setMobileSheetOpen(true)
                      }}
                      ref={(el) => {
                        claimRefs.current[claim.id] = el
                      }}
                      aria-label={`Claim ${claimIndex}, ${claim.label}`}
                    >
                      <span className="mark-text">{slice.text}</span>
                      <sup className="mark-superscript font-mono" aria-hidden="true">
                        {claimIdxStr} {meta.symbol}
                        {claim.needs_review && ' ⚠'}
                      </sup>
                    </button>
                  )
                }

                if (slice.type === 'issue') {
                  const issue = slice.item
                  const isSelected = selectedIssueId === issue.id
                  let markClass = `issue-mark mark-${issue.type}`
                  if (isSelected) markClass += ' is-selected'

                  return (
                    <button
                      key={issue.id || i}
                      type="button"
                      className={markClass}
                      onClick={() => {
                        setSelectedIssueId(issue.id)
                        setSelectedClaimId(issue.related_claims?.[0] || null)
                        setMobileSheetOpen(true)
                      }}
                      aria-label={`Issue, ${issue.type}`}
                    >
                      <span className="mark-text">{slice.text}</span>
                      <sup className="mark-superscript font-mono" aria-hidden="true">
                        {issue.type === 'logic_gap' ? 'LOGIC GAP' : 'UNSAFE'}
                      </sup>
                    </button>
                  )
                }

                return <span key={i}>{slice.text}</span>
              })}
            </p>
          </div>
        </div>

        {/* Right Pane (40%, Sticky): Evidence Inspector & Claim List */}
        <div className={`workspace-right-pane ${mobileSheetOpen ? 'is-mobile-open' : ''}`}>
          {/* Mobile Sheet Close Bar */}
          <div className="mobile-sheet-bar">
            <span className="mono-label">EVIDENCE INSPECTOR</span>
            <button
              type="button"
              className="btn-sheet-close font-mono"
              onClick={() => setMobileSheetOpen(false)}
            >
              ✕ CLOSE
            </button>
          </div>

          {/* Top Box: Evidence Inspector */}
          <div className="inspector-box">
            <div className="pane-header">
              <span className="mono-label">EVIDENCE INSPECTOR</span>
              {selectedClaim && (
                <span className="mono-label">
                  CASE REF: {selectedClaim.evidence?.[0]?.chunk_id?.toUpperCase() || 'SRC'} / #{String(claims.findIndex((c) => c.id === selectedClaim.id) + 1).padStart(2, '0')}
                </span>
              )}
            </div>

            {selectedClaim ? (
              <div className="inspector-content">
                {/* Claim Statement */}
                <h3 className="inspector-claim-title font-sans">
                  {selectedClaim.text}
                </h3>

                {/* Verdict Symbol, Label, Confidence & Flag */}
                <div className="inspector-verdict-row">
                  <div className="verdict-tag font-mono">
                    <span className="verdict-symbol" style={{ color: VERDICT_META[selectedClaim.label]?.dotColor }}>
                      {VERDICT_META[selectedClaim.label]?.symbol}
                    </span>
                    <span className="verdict-name">{VERDICT_META[selectedClaim.label]?.label?.toUpperCase()}</span>
                  </div>

                  <div className="confidence-meter font-mono">
                    <span className="mono-label">CONFIDENCE:</span>
                    <span className="confidence-word">{selectedClaim.confidence?.toUpperCase()}</span>
                    <span className="confidence-pips" aria-hidden="true">
                      <span className={`pip ${selectedClaim.confidence ? 'is-filled' : ''}`} />
                      <span className={`pip ${selectedClaim.confidence === 'medium' || selectedClaim.confidence === 'high' ? 'is-filled' : ''}`} />
                      <span className={`pip ${selectedClaim.confidence === 'high' ? 'is-filled' : ''}`} />
                    </span>
                  </div>

                  {selectedClaim.needs_review && (
                    <span className="needs-review-chip mono-chip">
                      REVIEW
                    </span>
                  )}
                </div>

                {/* Diagnosis in plain words */}
                {selectedClaim.diagnosis && (
                  <div className="inspector-diagnosis mono-label">
                    &bull; {DIAGNOSIS_LABELS[selectedClaim.diagnosis] || selectedClaim.diagnosis}
                  </div>
                )}

                {/* Source Excerpt */}
                <div className="source-excerpt-card">
                  <div className="source-excerpt-top font-mono">
                    {selectedClaim.evidence?.[0] ? (
                      <>
                        <span className="excerpt-page">p. {String(selectedClaim.evidence[0].page).padStart(2, '0')}</span>
                        {selectedClaim.evidence[0].verified ? (
                          <span className="badge-verified mono-chip">Quote verified in PDF</span>
                        ) : (
                          <span className="badge-unverified mono-chip">Quote could not be verified</span>
                        )}
                      </>
                    ) : (
                      <span className="badge-unverified mono-chip">No passage cited</span>
                    )}
                  </div>

                  {selectedClaim.evidence?.[0] ? (
                    <p className="source-excerpt-quote font-serif">
                      &ldquo;{selectedClaim.evidence[0].quote}&rdquo;
                    </p>
                  ) : (
                    <p className="source-excerpt-quote font-serif empty-excerpt">
                      No passage cited. The document does not establish this claim.
                    </p>
                  )}
                </div>

                {/* Explanation */}
                {selectedClaim.explanation && (
                  <p className="inspector-explanation font-sans">
                    {selectedClaim.explanation}
                  </p>
                )}

                {/* Code Checks Rows */}
                <div className="check-rows-grid font-mono">
                  <div className="check-row">
                    <span className="check-glyph">{selectedClaim.checks?.quote_found ? '✓' : '—'}</span>
                    <span className="check-name">Quote found</span>
                  </div>
                  <div className="check-row">
                    <span className="check-glyph">{selectedClaim.checks?.numbers_match !== false ? '✓' : '✕'}</span>
                    <span className="check-name">Numbers compared</span>
                  </div>
                  <div className="check-row">
                    <span className="check-glyph">{selectedClaim.checks?.passes_agree ? '✓' : '—'}</span>
                    <span className="check-name">Both passes agree</span>
                  </div>
                </div>

                {/* Evidence Trail (4 Steps linked by vertical hairline) */}
                <div className="evidence-trail">
                  <div className="trail-title mono-label">Evidence Trail</div>

                  <div className="trail-steps">
                    {/* Step 1: Claim */}
                    <div className="trail-step">
                      <div className="step-bullet" />
                      <div className="step-content">
                        <span className="step-label mono-label">01 / CLAIM</span>
                        <div className="step-text font-mono">{selectedClaim.text}</div>
                      </div>
                    </div>

                    {/* Step 2: Retrieved Passage */}
                    <div className="trail-step">
                      <div className="step-bullet" />
                      <div className="step-content">
                        <span className="step-label mono-label">
                          02 / RETRIEVED PASSAGE {selectedClaim.evidence?.[0]?.chunk_id ? `· ${selectedClaim.evidence[0].chunk_id}` : ''}
                        </span>
                        <div className="step-text font-serif">
                          {selectedClaim.evidence?.[0] ? (
                            <>&ldquo;{selectedClaim.evidence[0].quote}&rdquo; <span className="font-mono">p. {selectedClaim.evidence[0].page}</span></>
                          ) : (
                            'No matching passage retrieved from PDF.'
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Comparison */}
                    <div className="trail-step">
                      <div className="step-bullet" />
                      <div className="step-content">
                        <span className="step-label mono-label">03 / COMPARISON</span>
                        {hasNumberMismatch ? (
                          <div className="comparison-tokens font-mono">
                            <span className="token-claim">CLAIM VALUE: {claimNumbers[0]}</span>
                            <span className="token-cross">✕</span>
                            <span className="token-source">SOURCE VALUE: {quoteNumbers[0]}</span>
                          </div>
                        ) : (
                          <div className="step-text font-mono">
                            {selectedClaim.label === 'supported' ? 'Claim assertions directly corroborated by cited source.' : 'Claim assertion conflicts or lacks basis in source material.'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step 4: Verdict */}
                    <div className="trail-step">
                      <div className="step-bullet" />
                      <div className="step-content">
                        <span className="step-label mono-label">04 / VERDICT</span>
                        <div className="trail-verdict font-mono">
                          <span className="verdict-symbol" style={{ color: VERDICT_META[selectedClaim.label]?.dotColor }}>
                            {VERDICT_META[selectedClaim.label]?.symbol}
                          </span>
                          <span>{VERDICT_META[selectedClaim.label]?.label?.toUpperCase()}</span>
                          <span className="confidence-tag">· CONFIDENCE: {selectedClaim.confidence?.toUpperCase()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="inspector-empty font-mono">
                Select a marked claim to see the evidence.
              </div>
            )}
          </div>

          {/* Bottom Box: All Claims List */}
          <div className="claims-list-box">
            <div className="pane-header">
              <span className="mono-label">ALL CLAIMS ({claims.length})</span>
            </div>

            <div className="claims-chips-wrap">
              {claims.map((claim, idx) => {
                const isSelected = selectedClaimId === claim.id
                const idxStr = String(idx + 1).padStart(2, '0')
                const meta = VERDICT_META[claim.label] || VERDICT_META.unsupported

                return (
                  <button
                    key={claim.id}
                    type="button"
                    className={`claim-list-chip font-mono ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSelectedClaimId(claim.id)
                      setSelectedIssueId(null)
                    }}
                  >
                    <span className="chip-idx">{idxStr}</span>
                    <span className="chip-glyph" style={{ color: meta.dotColor }}>{meta.symbol}</span>
                    <span className="chip-text">{claim.text}</span>
                    {isSelected && <span className="chip-selected-tag">[SELECTED]</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Reasoning Issues Box */}
          {issues.length > 0 && (
            <div className="issues-box">
              <div className="pane-header">
                <span className="mono-label">REASONING ISSUES ({issues.length})</span>
              </div>

              <div className="issues-list">
                {issues.map((issue) => {
                  const isSelected = selectedIssueId === issue.id

                  return (
                    <div
                      key={issue.id}
                      className={`issue-card ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => {
                        setSelectedIssueId(issue.id)
                        if (issue.related_claims?.[0]) {
                          setSelectedClaimId(issue.related_claims[0])
                        }
                      }}
                    >
                      <div className="issue-card-top font-mono">
                        <span className="issue-type-tag mono-chip">
                          {issue.type === 'logic_gap' ? 'LOGIC GAP' : 'UNSAFE ADVICE'}
                        </span>
                      </div>
                      <p className="issue-card-text font-sans">&ldquo;{issue.text}&rdquo;</p>
                      <p className="issue-card-explanation font-mono">{issue.explanation}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
