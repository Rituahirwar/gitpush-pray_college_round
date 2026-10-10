import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAudit } from '../context/AuditContext'
import VerdictMark from '../components/VerdictMark'
import ConfidenceMeter from '../components/ConfidenceMeter'
import './AuditWorkspace.css'

const DIAGNOSIS_LABELS = {
  verified: 'The source confirms this.',
  contradicted_by_source: 'The source says otherwise.',
  source_silent: 'The source does not mention this.',
  source_vague: 'The source is vague on this.',
  evidence_not_verified: 'The cited quote could not be verified.',
}

const VERDICT_ORDER = ['supported', 'contradicted', 'unsupported', 'ambiguous']
const VERDICT_ICONS = {
  supported: '✓',
  contradicted: '✕',
  unsupported: '∅',
  ambiguous: '≈',
}

// Regex to extract numbers/currency tokens
function extractNumbers(text) {
  if (!text) return []
  const matches = text.match(/[₹$€£]?\s*[\d,.]+(?:\s*(?:k|m|b|crore|lakh))?/gi)
  return matches ? matches.map((m) => m.trim()) : []
}

export default function AuditWorkspace() {
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

  // Filtered claims
  const filteredClaims = useMemo(() => {
    if (!filterVerdict) return claims
    return claims.filter((c) => c.label === filterVerdict)
  }, [claims, filterVerdict])

  // Keyboard navigation: j/Down (next), k/Up (prev), Escape (clear)
  useEffect(() => {
    const handleKeyDown = (e) => {
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

  // Robust slice generator for the answer manuscript
  const markSlices = useMemo(() => {
    if (!result?.answer) return []
    const answer = result.answer

    // 1. Collect valid claim spans
    const resolvedSpans = []

    claims.forEach((c) => {
      let start = c.span?.start
      let end = c.span?.end
      let valid = false

      if (
        Number.isInteger(start) &&
        Number.isInteger(end) &&
        start >= 0 &&
        end <= answer.length &&
        end > start
      ) {
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
          item: c,
        })
      }
    })

    // 2. Collect issue spans
    issues.forEach((issue) => {
      let start = issue.span?.start
      let end = issue.span?.end
      let valid = false

      if (
        Number.isInteger(start) &&
        Number.isInteger(end) &&
        start >= 0 &&
        end <= answer.length &&
        end > start
      ) {
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
          item: issue,
        })
      }
    })

    // 3. Sort by start position, non-overlapping
    resolvedSpans.sort((a, b) => a.start - b.start)

    const nonOverlapping = []
    let cursor = 0

    resolvedSpans.forEach((span) => {
      if (span.start >= cursor) {
        nonOverlapping.push(span)
        cursor = span.end
      }
    })

    // 4. Build text fragments
    const fragments = []
    let lastIndex = 0

    nonOverlapping.forEach((span) => {
      if (span.start > lastIndex) {
        fragments.push({
          isMarked: false,
          text: answer.slice(lastIndex, span.start),
        })
      }

      fragments.push({
        isMarked: true,
        type: span.type,
        id: span.id,
        text: answer.slice(span.start, span.end),
        item: span.item,
      })

      lastIndex = span.end
    })

    if (lastIndex < answer.length) {
      fragments.push({
        isMarked: false,
        text: answer.slice(lastIndex),
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

  // Evidence extraction for selected claim
  const evidenceList = selectedClaim?.evidence || []
  const primaryEvidence = evidenceList[0] || null
  const quote = primaryEvidence?.quote || ''
  const pageNum = primaryEvidence?.page
  const isQuoteVerified = Boolean(primaryEvidence?.verified)

  // Compare numbers
  const claimNumbers = extractNumbers(selectedClaim?.text)
  const quoteNumbers = extractNumbers(quote)
  const numbersDiffer =
    claimNumbers.length > 0 &&
    quoteNumbers.length > 0 &&
    JSON.stringify(claimNumbers) !== JSON.stringify(quoteNumbers)

  const handleSelectClaim = (claimId) => {
    setSelectedClaimId(claimId)
    setSelectedIssueId(null)
    setMobileSheetOpen(true)

    // Scroll corresponding item in list into view
    const elem = claimRefs.current[claimId]
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  const handleSelectIssue = (issueId) => {
    setSelectedIssueId(issueId)
    setSelectedClaimId(null)
  }

  const toggleFilter = (verdict) => {
    setFilterVerdict((prev) => (prev === verdict ? null : verdict))
  }

  return (
    <div className="audit-workspace">
      {/* 1. Summary Bar */}
      <section className="summary-bar" aria-label="Audit summary counts and filters">
        <div className="summary-bar__inner">
          <div className="summary-stats-line font-mono">
            {source === 'sample' && (
              <span className="source-sample-chip">SAMPLE RUN</span>
            )}
            <span className="stat-total">{totalClaims} CLAIMS</span>
            <span className="stat-sep">&bull;</span>

            {VERDICT_ORDER.map((v) => {
              const count = counts[v] || 0
              const isFiltered = filterVerdict === v
              const icon = VERDICT_ICONS[v]

              return (
                <button
                  key={v}
                  type="button"
                  className={`stat-filter-btn ${isFiltered ? 'is-active' : ''}`}
                  onClick={() => toggleFilter(v)}
                  title={`Filter by ${v}`}
                >
                  <span className={`stat-icon icon-${v}`}>{icon}</span>
                  <span className="stat-label">{v.toUpperCase()}</span>
                  <span className="stat-count">{count}</span>
                </button>
              )
            })}

            <span className="stat-sep">&bull;</span>
            <span className="stat-flag">NEEDS REVIEW {needsReviewCount}</span>
            <span className="stat-sep">&bull;</span>
            <span className="stat-issues">REASONING ISSUES {issues.length}</span>
          </div>

          <div className="summary-actions">
            <button
              type="button"
              className="btn-ghost font-mono summary-btn"
              onClick={() => navigate('/audit')}
            >
              New audit
            </button>
            <button
              type="button"
              className="btn-primary font-mono summary-btn"
              onClick={() => navigate('/report')}
            >
              View report
            </button>
          </div>
        </div>

        {/* Thin segmented bar in greys */}
        <div className="segmented-bar" aria-hidden="true">
          <div className="seg-portion seg-supported" style={{ width: `${suppPct}%` }} />
          <div className="seg-portion seg-contradicted" style={{ width: `${contraPct}%` }} />
          <div className="seg-portion seg-unsupported" style={{ width: `${unsuppPct}%` }} />
          <div className="seg-portion seg-ambiguous" style={{ width: `${ambigPct}%` }} />
        </div>
      </section>

      {/* 2. Main Two-Column Content */}
      <div className="audit-layout">
        {/* Left Pane (60%): Typeset Answer Document */}
        <main className="answer-pane" ref={answerContainerRef}>
          <div className="document-header">
            <span className="mono-label">VERIFIED DOCUMENT &bull; AI ANSWER MANUSCRIPT</span>
            <h2 className="document-docname font-serif">{result?.doc?.name || 'document.pdf'}</h2>
          </div>

          <article className="document-content font-serif">
            {markSlices.map((fragment, idx) => {
              if (!fragment.isMarked) {
                return <span key={idx}>{fragment.text}</span>
              }

              if (fragment.type === 'issue') {
                const isSelected = selectedIssueId === fragment.id
                return (
                  <VerdictMark
                    key={idx}
                    mode="inline"
                    verdict={fragment.item.type}
                    isSelected={isSelected}
                    onClick={() => handleSelectIssue(fragment.id)}
                    ariaLabel={`Issue: ${fragment.item.type}`}
                  >
                    {fragment.text}
                  </VerdictMark>
                )
              }

              // Claim
              const isSelected = selectedClaimId === fragment.id
              const isDimmed = filterVerdict && fragment.item.label !== filterVerdict
              const claimIndex = claims.findIndex((c) => c.id === fragment.id) + 1

              return (
                <span
                  key={idx}
                  className={`claim-mark-wrapper ${isDimmed ? 'is-dimmed' : ''}`}
                >
                  <VerdictMark
                    mode="inline"
                    verdict={fragment.item.label}
                    index={claimIndex}
                    isSelected={isSelected}
                    isFlagged={Boolean(fragment.item.needs_review)}
                    onClick={() => handleSelectClaim(fragment.id)}
                    ariaLabel={`Claim ${claimIndex}, ${fragment.item.label}`}
                  >
                    {fragment.text}
                  </VerdictMark>
                </span>
              )
            })}
          </article>
        </main>

        {/* Right Pane (40%, sticky): Evidence Inspector & Claim List */}
        <aside className="inspector-pane">
          {/* Evidence Inspector Card */}
          <div className="inspector-card">
            <div className="inspector-header">
              <span className="mono-label">EVIDENCE INSPECTOR</span>
              {selectedClaim && (
                <div className="inspector-meta font-mono">
                  <span className="claim-id-tag">
                    CLAIM #{claims.findIndex((c) => c.id === selectedClaim.id) + 1}
                  </span>
                  <ConfidenceMeter level={selectedClaim.confidence} />
                </div>
              )}
            </div>

            {selectedClaim ? (
              <div className="inspector-body">
                {/* Claim Text */}
                <blockquote className="inspector-claim font-serif">
                  &ldquo;{selectedClaim.text}&rdquo;
                </blockquote>

                {/* Verdict Badge & Needs Review */}
                <div className="inspector-verdict-row">
                  <VerdictMark
                    mode="badge"
                    verdict={selectedClaim.label}
                    isFlagged={Boolean(selectedClaim.needs_review)}
                  />
                  {selectedClaim.needs_review && (
                    <span className="needs-review-chip font-mono">NEEDS HUMAN REVIEW</span>
                  )}
                </div>

                {/* Plain Words Diagnosis Line */}
                <p className="inspector-diagnosis">
                  {DIAGNOSIS_LABELS[selectedClaim.diagnosis] ||
                    (selectedClaim.label === 'contradicted'
                      ? 'The source says otherwise.'
                      : selectedClaim.label === 'supported'
                      ? 'The source confirms this.'
                      : selectedClaim.label === 'unsupported'
                      ? 'The source does not mention this.'
                      : 'The source is vague on this.')}
                </p>

                {/* Source Excerpt Paper-Box */}
                <div className="source-excerpt-box">
                  <div className="source-excerpt-header">
                    <span className="mono-label font-mono">
                      {pageNum !== undefined && pageNum !== null ? `p. ${pageNum}` : 'SOURCE'}
                    </span>
                    <span
                      className={`verification-badge font-mono ${
                        isQuoteVerified ? 'is-verified' : 'is-unverified'
                      }`}
                    >
                      {primaryEvidence
                        ? isQuoteVerified
                          ? 'Quote verified in PDF'
                          : 'Quote could not be verified'
                        : 'No passage cited'}
                    </span>
                  </div>

                  <div className="source-excerpt-text font-mono">
                    {quote ? (
                      <p>&ldquo;{quote}&rdquo;</p>
                    ) : (
                      <p className="no-quote-notice">
                        No passage cited. The document does not establish this claim.
                      </p>
                    )}
                  </div>
                </div>

                {/* Explanation */}
                {selectedClaim.explanation && (
                  <div className="inspector-explanation">
                    <span className="mono-label">EXPLANATION</span>
                    <p>{selectedClaim.explanation}</p>
                  </div>
                )}

                {/* Check Rows */}
                <div className="checks-group font-mono">
                  <div className="check-row">
                    <span className="check-label">Quote found in document</span>
                    <span className="check-status">
                      {selectedClaim.checks?.quote_found ? '✓' : '—'}
                    </span>
                  </div>
                  <div className="check-row">
                    <span className="check-label">Numbers compared</span>
                    <span className="check-status">
                      {selectedClaim.checks?.numbers_match !== undefined ? '✓' : '—'}
                    </span>
                  </div>
                  <div className="check-row">
                    <span className="check-label">Both verifier passes agree</span>
                    <span className="check-status">
                      {selectedClaim.checks?.passes_agree ? '✓' : '—'}
                    </span>
                  </div>
                </div>

                {/* Evidence Trail */}
                <div className="evidence-trail">
                  <span className="mono-label trail-title">EVIDENCE TRAIL</span>
                  <div className="trail-timeline">
                    {/* Step 1: Claim */}
                    <div className="trail-step">
                      <div className="trail-marker" />
                      <div className="trail-content">
                        <span className="trail-step-label font-mono">1. CLAIM EXTRACTED</span>
                        <p className="trail-step-detail">&ldquo;{selectedClaim.text}&rdquo;</p>
                      </div>
                    </div>

                    {/* Step 2: Retrieved Passage */}
                    <div className="trail-step">
                      <div className="trail-marker" />
                      <div className="trail-content">
                        <span className="trail-step-label font-mono">2. RETRIEVED PASSAGE</span>
                        <p className="trail-step-detail font-mono">
                          {quote ? quote.slice(0, 140) + '...' : 'No relevant passage found'}
                        </p>
                      </div>
                    </div>

                    {/* Step 3: Comparison */}
                    <div className="trail-step">
                      <div className="trail-marker" />
                      <div className="trail-content">
                        <span className="trail-step-label font-mono">3. COMPARISON</span>
                        {numbersDiffer ? (
                          <div className="numbers-diff-box font-mono">
                            <span className="claim-num">{claimNumbers.join(', ')}</span>
                            <span className="diff-x">✕</span>
                            <span className="quote-num">{quoteNumbers.join(', ')}</span>
                          </div>
                        ) : (
                          <p className="trail-step-detail">
                            Semantic skeptic verifier compared claim with cited passage.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Step 4: Verdict */}
                    <div className="trail-step">
                      <div className="trail-marker" />
                      <div className="trail-content">
                        <span className="trail-step-label font-mono">4. VERDICT ASSIGNED</span>
                        <p className="trail-step-detail font-mono">
                          {selectedClaim.label.toUpperCase()} (Confidence:{' '}
                          {selectedClaim.confidence})
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="inspector-empty">
                <p>Select a marked claim to see the evidence.</p>
              </div>
            )}
          </div>

          {/* Claim Ledger List */}
          <div className="claims-ledger">
            <div className="ledger-header">
              <span className="mono-label">CLAIM LEDGER ({filteredClaims.length})</span>
              <span className="keyboard-hint font-mono">j / k to navigate &bull; Esc to clear</span>
            </div>

            <ul className="ledger-list" role="list">
              {filteredClaims.map((claim) => {
                const isSelected = claim.id === selectedClaimId
                const originalIndex = claims.findIndex((c) => c.id === claim.id) + 1
                const hasLocation = Boolean(claim.span)

                return (
                  <li
                    key={claim.id}
                    ref={(el) => (claimRefs.current[claim.id] = el)}
                    className={`ledger-item ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelectClaim(claim.id)}
                    tabIndex={0}
                    role="button"
                    aria-pressed={isSelected}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleSelectClaim(claim.id)
                      }
                    }}
                  >
                    <div className="ledger-item__top">
                      <span className="font-mono ledger-item__num">#{originalIndex}</span>
                      <VerdictMark mode="badge" verdict={claim.label} />
                      {!hasLocation && (
                        <span className="font-mono location-missing-chip">
                          location not found in answer
                        </span>
                      )}
                    </div>
                    <p className="ledger-item__text">&ldquo;{claim.text}&rdquo;</p>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Reasoning Issues Section */}
          {issues.length > 0 && (
            <div className="reasoning-issues-section">
              <span className="mono-label section-title">REASONING ISSUES ({issues.length})</span>
              <div className="issues-list">
                {issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`issue-card ${selectedIssueId === issue.id ? 'is-selected' : ''}`}
                    onClick={() => handleSelectIssue(issue.id)}
                    tabIndex={0}
                    role="button"
                  >
                    <div className="issue-card__top">
                      <VerdictMark mode="badge" verdict={issue.type} />
                    </div>
                    <blockquote className="issue-card__text font-serif">
                      &ldquo;{issue.text}&rdquo;
                    </blockquote>
                    <p className="issue-card__explanation">{issue.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* 3. Mobile Bottom Sheet (<900px) */}
      <div className={`mobile-bottom-sheet ${mobileSheetOpen ? 'is-open' : ''}`}>
        <div className="sheet-backdrop" onClick={() => setMobileSheetOpen(false)} />
        <div className="sheet-panel">
          <div className="sheet-handle-bar">
            <span className="sheet-handle" />
            <button
              type="button"
              className="sheet-close-btn font-mono"
              onClick={() => setMobileSheetOpen(false)}
              aria-label="Close inspector"
            >
              ✕ CLOSE
            </button>
          </div>

          <div className="sheet-content">
            {selectedClaim ? (
              <div>
                <div className="sheet-top-meta">
                  <VerdictMark
                    mode="badge"
                    verdict={selectedClaim.label}
                    isFlagged={Boolean(selectedClaim.needs_review)}
                  />
                  <ConfidenceMeter level={selectedClaim.confidence} />
                </div>
                <blockquote className="sheet-claim font-serif">
                  &ldquo;{selectedClaim.text}&rdquo;
                </blockquote>
                <p className="inspector-diagnosis">
                  {DIAGNOSIS_LABELS[selectedClaim.diagnosis] || 'The source clarifies this claim.'}
                </p>
                <div className="source-excerpt-box">
                  <div className="source-excerpt-header">
                    <span className="mono-label font-mono">
                      {pageNum !== undefined && pageNum !== null ? `p. ${pageNum}` : 'SOURCE'}
                    </span>
                    <span
                      className={`verification-badge font-mono ${
                        isQuoteVerified ? 'is-verified' : 'is-unverified'
                      }`}
                    >
                      {isQuoteVerified ? 'Quote verified in PDF' : 'Quote unverified'}
                    </span>
                  </div>
                  <p className="font-mono source-excerpt-text">&ldquo;{quote}&rdquo;</p>
                </div>
                {selectedClaim.explanation && (
                  <p className="inspector-explanation-text">{selectedClaim.explanation}</p>
                )}
              </div>
            ) : (
              <p>Select a claim to inspect evidence.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
