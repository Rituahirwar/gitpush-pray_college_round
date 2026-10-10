import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import './AuditWorkspace.css'

const verdicts = {
  supported: {
    label: 'Supported',
    icon: CheckCircle2,
    className: 'supported',
  },
  contradicted: {
    label: 'Contradicted',
    icon: XCircle,
    className: 'contradicted',
  },
  unsupported: {
    label: 'Unsupported',
    icon: CircleHelp,
    className: 'unsupported',
  },
  ambiguous: {
    label: 'Ambiguous',
    icon: AlertTriangle,
    className: 'ambiguous',
  },
}

function safeSpan(item, answer) {
  const span = item?.span
  if (
    !span ||
    !Number.isInteger(span.start) ||
    !Number.isInteger(span.end) ||
    span.start < 0 ||
    span.end <= span.start ||
    span.end > answer.length
  ) {
    return null
  }

  // Use the provided character positions only when they identify
  // the expected text exactly. Never highlight a different sentence.
  if (answer.slice(span.start, span.end) !== item.text) {
    return null
  }

  return span
}

function AnswerDocument({ data, selectedClaim, selectedIssue, onSelectClaim, onSelectIssue }) {
  const segments = useMemo(() => {
    const answer = data.answer || ''
    const ranges = [
      ...(data.claims || []).map((claim) => ({
        kind: 'claim',
        item: claim,
        span: safeSpan(claim, answer),
      })),
      ...(data.issues || []).map((issue) => ({
        kind: 'issue',
        item: issue,
        span: safeSpan(issue, answer),
      })),
    ]
      .filter((entry) => entry.span)
      .sort((a, b) => a.span.start - b.span.start || a.span.end - b.span.end)

    const output = []
    let cursor = 0

    for (const entry of ranges) {
      // Skip overlapping ranges rather than rendering duplicate text.
      if (entry.span.start < cursor) continue

      if (entry.span.start > cursor) {
        output.push({
          kind: 'plain',
          key: `plain-${cursor}`,
          text: answer.slice(cursor, entry.span.start),
        })
      }

      output.push({
        ...entry,
        key: `${entry.kind}-${entry.item.id}`,
        text: answer.slice(entry.span.start, entry.span.end),
      })
      cursor = entry.span.end
    }

    if (cursor < answer.length) {
      output.push({
        kind: 'plain',
        key: `plain-${cursor}`,
        text: answer.slice(cursor),
      })
    }

    return output
  }, [data])

  return (
    <div className="answer-document">
      {segments.map((segment) => {
        if (segment.kind === 'plain') {
          return <span key={segment.key}>{segment.text}</span>
        }

        if (segment.kind === 'issue') {
          const active = selectedIssue?.id === segment.item.id
          return (
            <button
              key={segment.key}
              type="button"
              className={`text-issue ${segment.item.type} ${active ? 'active' : ''}`}
              onClick={() => onSelectIssue(segment.item)}
              title={`Reasoning issue: ${segment.item.type.replace('_', ' ')}`}
            >
              {segment.text}
            </button>
          )
        }

        const active = selectedClaim?.id === segment.item.id
        const verdict = verdicts[segment.item.label] || verdicts.ambiguous

        return (
          <button
            key={segment.key}
            type="button"
            className={`text-claim ${verdict.className} ${active ? 'active' : ''}`}
            onClick={() => onSelectClaim(segment.item)}
            aria-pressed={active}
            title={`${verdict.label} claim — select to inspect evidence`}
          >
            {segment.text}
          </button>
        )
      })}
    </div>
  )
}

function VerdictBadge({ label }) {
  const verdict = verdicts[label] || verdicts.ambiguous
  const Icon = verdict.icon

  return (
    <span className={`verdict-badge ${verdict.className}`}>
      <Icon size={14} aria-hidden="true" />
      {verdict.label}
    </span>
  )
}

function EvidencePanel({ claim, issue, onClearIssue }) {
  if (issue) {
    return (
      <aside className="inspector">
        <div className="inspector-heading">
          <div>
            <span className="eyebrow">REASONING INSPECTION</span>
            <h2>Issue details</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClearIssue}
            aria-label="Return to claim evidence"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <span className={`issue-type ${issue.type}`}>
          <AlertTriangle size={15} />
          {issue.type.replace('_', ' ')}
        </span>

        <h3 className="inspected-claim">{issue.text}</h3>
        <p className="explanation">{issue.explanation}</p>

        <div className="trail">
          <span className="eyebrow">ISSUE SUMMARY</span>
          <div className="trail-step">
            <span className="trail-dot issue-dot" />
            <div>
              <strong>Reasoning concern detected</strong>
              <p>This passage needs reasoning review; it is not automatically a factual verdict.</p>
            </div>
          </div>
          {issue.related_claims?.length > 0 && (
            <div className="related-claims">
              <span className="eyebrow">RELATED CLAIM IDS</span>
              <p>{issue.related_claims.join(', ')}</p>
            </div>
          )}
        </div>
      </aside>
    )
  }

  if (!claim) {
    return (
      <aside className="inspector empty-inspector">
        <BookOpen size={28} />
        <h2>Select a claim</h2>
        <p>Choose a highlighted sentence or a claim in the list to inspect its evidence and reasoning.</p>
      </aside>
    )
  }

  const evidence = Array.isArray(claim.evidence) ? claim.evidence : []

  return (
    <aside className="inspector">
      <div className="inspector-heading">
        <div>
          <span className="eyebrow">CLAIM INSPECTOR</span>
          <h2>Evidence review</h2>
        </div>
        <span className="claim-id">{claim.id}</span>
      </div>

      <VerdictBadge label={claim.label} />
      <h3 className="inspected-claim">{claim.text}</h3>

      <div className="metadata-grid">
        <div className="metadata-item">
          <span>Confidence</span>
          <strong className="capitalize">{claim.confidence || 'Not provided'}</strong>
        </div>
        <div className="metadata-item">
          <span>Review status</span>
          <strong>{claim.needs_review ? 'Needs review' : 'No review flagged'}</strong>
        </div>
        <div className="metadata-item">
          <span>Error type</span>
          <strong>{(claim.error_type || 'none').replaceAll('_', ' ')}</strong>
        </div>
        {claim.diagnosis && (
          <div className="metadata-item">
            <span>Diagnosis</span>
            <strong>{claim.diagnosis.replaceAll('_', ' ')}</strong>
          </div>
        )}
      </div>

      <section className="inspector-section">
        <span className="eyebrow">EXPLANATION</span>
        <p className="explanation">{claim.explanation || 'No explanation was supplied.'}</p>
      </section>

      <section className="inspector-section">
        <div className="section-title">
          <span className="eyebrow">SOURCE EVIDENCE</span>
          <span className="count-pill">{evidence.length}</span>
        </div>

        {evidence.length === 0 ? (
          <div className="no-evidence">
            <CircleHelp size={18} />
            <div>
              <strong>No evidence passage returned</strong>
              <p>The source does not establish this claim in the current audit result.</p>
            </div>
          </div>
        ) : (
          evidence.map((item, index) => (
            <article className="evidence-card" key={`${item.chunk_id || 'evidence'}-${index}`}>
              <div className="evidence-meta">
                <span><FileText size={14} /> Page {item.page ?? 'Unknown'}</span>
                {item.chunk_id && <span>{item.chunk_id}</span>}
              </div>
              <blockquote>{item.quote || 'No quotation supplied.'}</blockquote>
              {item.verified === true ? (
                <span className="verified-indicator">
                  <ShieldCheck size={14} /> Evidence verified
                </span>
              ) : (
                <span className="unverified-indicator">
                  <AlertTriangle size={14} /> Evidence not verified
                </span>
              )}
            </article>
          ))
        )}
      </section>

      {claim.checks && (
        <section className="inspector-section">
          <span className="eyebrow">VALIDATION CHECKS</span>
          <div className="checks-list">
            {[
              ['Quote found', claim.checks.quote_found],
              ['Numbers match', claim.checks.numbers_match],
              ['Audit passes agree', claim.checks.passes_agree],
            ].map(([label, passed]) => (
              <div className="check-row" key={label}>
                <span>{label}</span>
                <strong className={passed ? 'check-pass' : 'check-fail'}>
                  {passed ? 'Pass' : 'Not passed'}
                </strong>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="trail">
        <span className="eyebrow">EVIDENCE TRAIL</span>
        {[
          ['01', 'Claim identified', 'The answer sentence was selected for review.'],
          ['02', 'Passage retrieved', evidence.length ? `${evidence.length} passage(s) returned from the source.` : 'No evidence passage was returned.'],
          ['03', 'Checks evaluated', 'Review the validation checks above.'],
          ['04', 'Verdict assigned', `The current label is ${claim.label || 'not specified'}.`],
          ['05', 'Explanation provided', 'The explanation records why this verdict was assigned.'],
        ].map(([number, title, detail]) => (
          <div className="trail-step" key={number}>
            <span className="trail-number">{number}</span>
            <div>
              <strong>{title}</strong>
              <p>{detail}</p>
            </div>
          </div>
        ))}
      </section>
    </aside>
  )
}

export default function AuditWorkspace() {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [selectedClaimId, setSelectedClaimId] = useState(null)
  const [selectedIssueId, setSelectedIssueId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  // Stores references to claim buttons so keyboard navigation can focus them.
const claimRowRefs = useRef({})

  useEffect(() => {
    let cancelled = false

    fetch('http://localhost:8000/api/demo/fr-crce-v2')
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load mock audit (${response.status}).`)
        return response.json()
      })
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setSelectedClaimId(result.claims?.[0]?.id ?? null)
        }
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message || 'Could not load the mock audit.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const selectedClaim = data?.claims?.find((claim) => claim.id === selectedClaimId) || null
  const selectedIssue = data?.issues?.find((issue) => issue.id === selectedIssueId) || null

  const filteredClaims = useMemo(() => {
    if (!data) return []

    return (data.claims || []).filter((claim) => {
      const matchesFilter = filter === 'all' || claim.label === filter
      const matchesSearch = `${claim.text} ${claim.id} ${claim.explanation}`
        .toLowerCase()
        .includes(search.toLowerCase())
      return matchesFilter && matchesSearch
    })
  }, [data, filter, search])

  // Keyboard navigation: ↑ / ↓ moves between visible claims,
// Enter selects a claim, and Escape closes the current issue.
useEffect(() => {
  function handleKeyboardNavigation(event) {
    const target = event.target

    // Never intercept keys while the user is typing or using a form control.
    if (
      target instanceof HTMLElement &&
      (
        target.isContentEditable ||
        target.matches('input, textarea, select')
      )
    ) {
      return
    }

    // Let unrelated buttons keep their normal keyboard behavior.
    if (
      target instanceof HTMLElement &&
      target.closest('button') &&
      !target.closest('.claim-row, .text-claim, .text-issue')
    ) {
      if (event.key !== 'Escape') return
    }

    if (event.key === 'Escape') {
      if (selectedIssueId) {
        event.preventDefault()
        setSelectedIssueId(null)
      }
      return
    }

    if (!filteredClaims.length) return

    const currentIndex = filteredClaims.findIndex(
      (claim) => claim.id === selectedClaimId
    )

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()

      const startingIndex = currentIndex >= 0 ? currentIndex : 0
      const direction = event.key === 'ArrowDown' ? 1 : -1

      // Wrap around at the beginning/end of the visible claim list.
      const nextIndex =
        (startingIndex + direction + filteredClaims.length) %
        filteredClaims.length

      const nextClaim = filteredClaims[nextIndex]

      setSelectedClaimId(nextClaim.id)
      setSelectedIssueId(null)

      // Move actual keyboard focus to the selected claim row.
      requestAnimationFrame(() => {
        claimRowRefs.current[nextClaim.id]?.focus()
        claimRowRefs.current[nextClaim.id]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      })

      return
    }

    if (event.key === 'Enter') {
      const focusedClaimRow = target.closest?.('.claim-row')

      if (focusedClaimRow) {
        event.preventDefault()
        const claim = filteredClaims.find(
          (item) => item.id === focusedClaimRow.dataset.claimId
        )
        if (claim) selectClaim(claim)
      }
    }
  }

  window.addEventListener('keydown', handleKeyboardNavigation)

  return () => {
    window.removeEventListener('keydown', handleKeyboardNavigation)
  }
}, [filteredClaims, selectedClaimId, selectedIssueId])

  function selectClaim(claim) {
    setSelectedClaimId(claim.id)
    setSelectedIssueId(null)
  }

  function selectIssue(issue) {
    setSelectedIssueId(issue.id)
  }

  if (loadError) {
    return (
      <main className="audit-app">
        <div className="load-error">
          <AlertTriangle size={28} />
          <h1>Could not load the audit fixture</h1>
          <p>{loadError}</p>
          <p>Confirm that the backend is running at http://localhost:8000 and reload the page.</p>
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="audit-app">
        <div className="loading-state">
          <Activity size={24} />
          <p>Loading audit workspace…</p>
        </div>
      </main>
    )
  }

  const counts = data.overall?.counts || {}

  return (
    <main className="audit-app">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Second Opinion home">
          <span className="brand-mark"><ShieldCheck size={21} /></span>
          <span>second<span className="brand-light">opinion</span></span>
        </a>
        <div className="topbar-right">
          <span className="environment-label"><span /> DEMO WORKSPACE</span>
          <span className="topbar-divider" />
          <span className="topbar-caption">SOURCE AUDIT / V1</span>
        </div>
      </header>

      <section className="workspace-heading">
        <div>
          <span className="eyebrow">DOCUMENT INTELLIGENCE / AUDIT REPORT</span>
          <h1>Evidence <span>workbench.</span></h1>
          <p>Trace every claim back to the source. Review the evidence, not just the answer.</p>
        </div>
        <div className="document-chip">
          <FileText size={20} />
          <div>
            <strong>{data.doc?.name || 'Uploaded document'}</strong>
            <span>{data.doc?.pages ?? '—'} pages · Demo audit</span>
          </div>
        </div>
      </section>

      <section className="summary-strip" aria-label="Audit summary">
        {Object.entries(verdicts).map(([key, verdict]) => {
          const Icon = verdict.icon
          return (
            <button
              type="button"
              className={`summary-metric ${verdict.className} ${filter === key ? 'metric-active' : ''}`}
              key={key}
              onClick={() => setFilter(filter === key ? 'all' : key)}
              aria-pressed={filter === key}
            >
              <span className="metric-icon"><Icon size={17} /></span>
              <span className="metric-copy">
                <strong>{counts[key] ?? 0}</strong>
                <span>{verdict.label}</span>
              </span>
            </button>
          )
        })}
        <div className="summary-review">
          <Clock3 size={18} />
          <div>
            <strong>{data.overall?.needs_review ?? 0}</strong>
            <span>Needs review</span>
          </div>
        </div>
      </section>

      <div className="assessment-banner">
        <Activity size={17} />
        <p>{data.overall?.assessment || 'Review the claims and evidence below.'}</p>
      </div>

      <section className="workbench-grid">
        <div className="answer-column">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">01 / GENERATED RESPONSE</span>
              <h2>Answer under review</h2>
            </div>
            <span className="count-pill">{data.claims?.length || 0} claims</span>
          </div>

          <div className="answer-paper">
            <div className="paper-meta">
              <span><FileText size={14} /> SOURCE-COMPARED ANSWER</span>
              <span>Interactive text</span>
            </div>
            <AnswerDocument
              data={data}
              selectedClaim={selectedClaim}
              selectedIssue={selectedIssue}
              onSelectClaim={selectClaim}
              onSelectIssue={selectIssue}
            />
            <div className="paper-legend">
              {Object.entries(verdicts).map(([key, verdict]) => (
                <span key={key}>
                  <i className={verdict.className} /> {verdict.label}
                </span>
              ))}
              <span><i className="logic_gap" /> Reasoning issue</span>
            </div>
          </div>

          <section className="claims-section">
            <div className="panel-heading claims-heading">
              <div>
                <span className="eyebrow">02 / CLAIM REGISTER</span>
                <h2>Findings</h2>
              </div>
              <span className="count-pill">{filteredClaims.length} shown</span>
            </div>

            <label className="search-field">
              <span className="sr-only">Search claims</span>
              <Activity size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search claims or explanations…"
              />
            </label>

            <p className="keyboard-hint">
              Keyboard: <kbd>↑</kbd> <kbd>↓</kbd> navigate claims
              <span>·</span>
              <kbd>Enter</kbd> inspect
              <span>·</span>
              <kbd>Esc</kbd> close issue
            </p>

            <div className="claim-list">
              {filteredClaims.map((claim, index) => {
                const active = selectedClaimId === claim.id && !selectedIssueId
                return (
                  <button
                    type="button"
                    className={`claim-row ${active ? 'selected' : ''}`}
                    key={claim.id}
                    data-claim-id={claim.id}
                    ref={(element) => {
                    claimRowRefs.current[claim.id] = element
                    }}
                    onClick={() => selectClaim(claim)}
                    aria-pressed={active}
                  >
                    <span className="claim-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="claim-row-copy">
                      <span className="claim-row-text">{claim.text}</span>
                      <span className="claim-row-meta">
                        <VerdictBadge label={claim.label} />
                        {claim.needs_review && <span className="review-flag">Needs review</span>}
                      </span>
                    </span>
                    <ChevronRight size={17} className="claim-chevron" />
                  </button>
                )
              })}
              {filteredClaims.length === 0 && (
                <p className="no-results">No claims match this filter.</p>
              )}
            </div>
            {filter !== 'all' && (
              <button type="button" className="clear-filter" onClick={() => setFilter('all')}>
                Clear verdict filter
              </button>
            )}
          </section>

          {(data.issues || []).length > 0 && (
            <section className="issues-section">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">03 / REASONING & SAFETY</span>
                  <h2>Issues to inspect</h2>
                </div>
                <span className="count-pill">{data.issues.length}</span>
              </div>
              {data.issues.map((issue) => (
                <button
                  type="button"
                  className={`issue-row ${selectedIssueId === issue.id ? 'selected' : ''}`}
                  key={issue.id}
                  onClick={() => selectIssue(issue)}
                >
                  <AlertTriangle size={18} />
                  <span>
                    <strong>{issue.type.replace('_', ' ')}</strong>
                    <span>{issue.text}</span>
                  </span>
                  <ChevronRight size={17} />
                </button>
              ))}
            </section>
          )}
        </div>

        <EvidencePanel
          claim={selectedClaim}
          issue={selectedIssue}
          onClearIssue={() => setSelectedIssueId(null)}
        />
      </section>

      <footer className="audit-footer">
        <span><ShieldCheck size={15} /> Evidence-led review</span>
        <span>Verdicts reflect the provided source, not universal truth.</span>
      </footer>
    </main>
  )
}
