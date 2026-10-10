import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAudit } from '../context/AuditContext'
import VerdictMark from '../components/VerdictMark'
import './ReportView.css'

function shortenQuote(quote, maxLen = 160) {
  if (!quote) return '—'
  const trimmed = quote.trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen).trim()}...`
}

export default function ReportView() {
  const navigate = useNavigate()
  const { result, loadSample } = useAudit()
  const [generatedTime] = useState(() => new Date().toLocaleString())

  // Empty state when no result in state
  if (!result) {
    return (
      <main className="report-empty-page">
        <div className="report-empty-box">
          <span className="mono-label">REPORT CONSOLE</span>
          <h1 className="report-empty-title font-serif">Audit report</h1>
          <p className="report-empty-desc">
            No audit result loaded. Run a new audit or load a sample run to generate and print the report.
          </p>
          <div className="empty-actions-row">
            <button
              type="button"
              className="btn-primary font-sans"
              onClick={() => navigate('/audit')}
            >
              Run an audit
            </button>
            <button
              type="button"
              className="btn-ghost font-sans"
              onClick={async () => {
                await loadSample()
                navigate('/report')
              }}
            >
              Load sample
            </button>
          </div>
        </div>
      </main>
    )
  }

  const { doc, overall, claims = [], issues = [] } = result
  const counts = overall?.counts || { supported: 0, contradicted: 0, unsupported: 0, ambiguous: 0 }
  const needsReviewCount = overall?.needs_review || 0

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadJson = () => {
    const jsonStr = JSON.stringify(result, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit-report-${doc?.name || 'document'}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <main className="report-page">
      <div className="report-container">
        {/* Header Row */}
        <header className="report-header">
          <div className="report-header__left">
            <h1 className="report-title font-serif">Audit report</h1>
            <div className="report-meta font-mono">
              <span className="meta-doc">
                DOCUMENT: {doc?.name || 'document.pdf'} ({doc?.pages || 0} pages)
              </span>
              <span className="meta-sep">&bull;</span>
              <span className="meta-time">GENERATED: {generatedTime}</span>
            </div>
          </div>

          <div className="report-header__actions no-print">
            <button
              type="button"
              className="btn-ghost font-mono btn-action"
              onClick={handleDownloadJson}
            >
              Download JSON
            </button>
            <button
              type="button"
              className="btn-primary font-mono btn-action btn-print"
              onClick={handlePrint}
            >
              Print
            </button>
          </div>
        </header>

        {/* Counts Row with Symbols */}
        <section className="report-counts-bar font-mono" aria-label="Audit summary counts">
          <div className="counts-item">
            <span className="count-symbol font-mono">✓</span>
            <span className="count-label">SUPPORTED</span>
            <span className="count-value">{counts.supported || 0}</span>
          </div>
          <div className="counts-item">
            <span className="count-symbol font-mono">✕</span>
            <span className="count-label">CONTRADICTED</span>
            <span className="count-value">{counts.contradicted || 0}</span>
          </div>
          <div className="counts-item">
            <span className="count-symbol font-mono">∅</span>
            <span className="count-label">UNSUPPORTED</span>
            <span className="count-value">{counts.unsupported || 0}</span>
          </div>
          <div className="counts-item">
            <span className="count-symbol font-mono">≈</span>
            <span className="count-label">AMBIGUOUS</span>
            <span className="count-value">{counts.ambiguous || 0}</span>
          </div>
          <div className="counts-item counts-flag">
            <span className="count-label">NEEDS REVIEW</span>
            <span className="count-value">{needsReviewCount}</span>
          </div>
        </section>

        {/* Claims Table */}
        <section className="report-table-section">
          <div className="table-wrapper">
            <table className="report-table">
              <thead>
                <tr>
                  <th scope="col" className="col-num font-mono">#</th>
                  <th scope="col" className="col-claim">Claim</th>
                  <th scope="col" className="col-verdict font-mono">Verdict</th>
                  <th scope="col" className="col-conf font-mono">Confidence</th>
                  <th scope="col" className="col-evidence">Evidence (Cited Quote)</th>
                  <th scope="col" className="col-page font-mono">Page</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim, idx) => {
                  const primaryEvidence = claim.evidence?.[0] || null
                  const shortened = shortenQuote(primaryEvidence?.quote)
                  const pageDisplay =
                    primaryEvidence?.page !== undefined && primaryEvidence?.page !== null
                      ? `p. ${primaryEvidence.page}`
                      : '—'

                  return (
                    <tr key={claim.id || idx}>
                      <td className="col-num font-mono">{idx + 1}</td>
                      <td className="col-claim">
                        <span className="claim-text font-serif">&ldquo;{claim.text}&rdquo;</span>
                        {claim.explanation && (
                          <span className="claim-explanation">{claim.explanation}</span>
                        )}
                      </td>
                      <td className="col-verdict">
                        <VerdictMark
                          mode="badge"
                          verdict={claim.label}
                          isFlagged={Boolean(claim.needs_review)}
                        />
                      </td>
                      <td className="col-conf font-mono">
                        <span className="conf-badge">{claim.confidence?.toUpperCase() || '—'}</span>
                      </td>
                      <td className="col-evidence font-mono">
                        <span className="quote-text">{shortened}</span>
                      </td>
                      <td className="col-page font-mono">{pageDisplay}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Reasoning Issues Section */}
        {issues.length > 0 && (
          <section className="report-issues-section">
            <h2 className="issues-title mono-label">REASONING &amp; ADVICE ISSUES ({issues.length})</h2>
            <div className="issues-grid">
              {issues.map((issue) => (
                <div key={issue.id} className="report-issue-card">
                  <div className="issue-card-top">
                    <VerdictMark mode="badge" verdict={issue.type} />
                  </div>
                  <blockquote className="issue-card-quote font-serif">
                    &ldquo;{issue.text}&rdquo;
                  </blockquote>
                  <p className="issue-card-exp">{issue.explanation}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer Note */}
        <footer className="report-footer">
          <p className="footer-note font-mono">
            Checked only against the supplied document. Verdicts come from a model plus code checks and can be wrong. Review flagged items.
          </p>
        </footer>
      </div>
    </main>
  )
}
