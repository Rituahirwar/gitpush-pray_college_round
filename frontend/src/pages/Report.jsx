import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAudit } from '../context/AuditContext'
import './Report.css'

const VERDICT_META = {
  supported: { symbol: '✓', label: 'Supported' },
  contradicted: { symbol: '✕', label: 'Contradicted' },
  unsupported: { symbol: '∅', label: 'Unsupported' },
  ambiguous: { symbol: '≈', label: 'Ambiguous' }
}

export default function Report() {
  const navigate = useNavigate()
  const { result, loadSample } = useAudit()
  const [generatedTime] = useState(() => new Date().toLocaleString())

  if (!result) {
    return (
      <div className="report-empty-container">
        <h1 className="report-title font-serif">Audit report</h1>
        <p className="report-subtitle">No audit result loaded. Run a new audit or load a sample run to view the report.</p>
        <div className="empty-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/audit')}
          >
            Run an audit
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={async () => {
              await loadSample()
              navigate('/report')
            }}
          >
            Load sample
          </button>
        </div>
      </div>
    )
  }

  const { doc, overall, claims = [], issues = [] } = result
  const counts = overall?.counts || {}

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
    <div className="report-container">
      {/* Top Header */}
      <div className="report-header-row">
        <div className="report-header-left">
          <h1 className="report-title font-serif">Audit report</h1>
          <div className="report-meta font-mono">
            <span>DOCUMENT: {doc?.name || 'document.pdf'} ({doc?.pages || 0} pages)</span>
            <span className="meta-sep">&bull;</span>
            <span>GENERATED: {generatedTime}</span>
          </div>
        </div>

        <div className="report-header-actions no-print">
          <button
            type="button"
            className="btn-ghost font-mono"
            onClick={handleDownloadJson}
          >
            Download JSON
          </button>
          <button
            type="button"
            className="btn-primary font-mono btn-print"
            onClick={handlePrint}
          >
            Print
          </button>
        </div>
      </div>

      {/* Counts Row with symbols */}
      <div className="report-counts-bar font-mono">
        <div className="report-count-item">
          <span className="count-symbol">✓</span>
          <span className="count-val">{counts.supported || 0}</span>
          <span className="count-lbl">Supported</span>
        </div>
        <div className="report-count-item">
          <span className="count-symbol">✕</span>
          <span className="count-val">{counts.contradicted || 0}</span>
          <span className="count-lbl">Contradicted</span>
        </div>
        <div className="report-count-item">
          <span className="count-symbol">∅</span>
          <span className="count-val">{counts.unsupported || 0}</span>
          <span className="count-lbl">Unsupported</span>
        </div>
        <div className="report-count-item">
          <span className="count-symbol">≈</span>
          <span className="count-val">{counts.ambiguous || 0}</span>
          <span className="count-lbl">Ambiguous</span>
        </div>
        <div className="report-count-item">
          <span className="count-symbol">!</span>
          <span className="count-val">{overall?.needs_review || 0}</span>
          <span className="count-lbl">Needs review</span>
        </div>
        {issues.length > 0 && (
          <div className="report-count-item">
            <span className="count-symbol">⇄</span>
            <span className="count-val">{issues.length}</span>
            <span className="count-lbl">Issues</span>
          </div>
        )}
      </div>

      {/* Claims Table */}
      <div className="report-table-wrapper">
        <table className="report-table">
          <thead>
            <tr>
              <th className="mono-label cell-th-num">#</th>
              <th className="mono-label cell-th-claim">Claim</th>
              <th className="mono-label cell-th-verdict">Verdict</th>
              <th className="mono-label cell-th-conf">Confidence</th>
              <th className="mono-label cell-th-evidence">Evidence</th>
              <th className="mono-label cell-th-page">Page</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim, idx) => {
              const meta = VERDICT_META[claim.label] || VERDICT_META.unsupported
              const evidenceItem = claim.evidence?.[0]
              let quoteShort = evidenceItem?.quote || '—'
              if (quoteShort.length > 160) {
                quoteShort = quoteShort.slice(0, 157) + '...'
              }

              return (
                <tr key={claim.id || idx}>
                  <td className="font-mono cell-td-num">{idx + 1}</td>
                  <td className="cell-td-claim font-sans">
                    <span className="claim-text-body">{claim.text}</span>
                    {claim.explanation && (
                      <span className="claim-text-exp font-mono">{claim.explanation}</span>
                    )}
                  </td>
                  <td className="font-mono cell-td-verdict">
                    <span className="verdict-inline-badge">
                      <span className="verdict-sym">{meta.symbol}</span>
                      <span>{meta.label}</span>
                    </span>
                  </td>
                  <td className="font-mono cell-td-conf">
                    {claim.confidence?.toUpperCase() || '—'}
                  </td>
                  <td className="cell-td-evidence font-serif">
                    {evidenceItem ? `"${quoteShort}"` : '—'}
                  </td>
                  <td className="font-mono cell-td-page">
                    {evidenceItem?.page ? `p. ${evidenceItem.page}` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Issues Section */}
      {issues.length > 0 && (
        <div className="report-issues-section">
          <h2 className="issues-section-title font-serif">Reasoning issues</h2>
          <div className="report-issues-grid">
            {issues.map((issue) => (
              <div key={issue.id} className="report-issue-card">
                <span className="issue-chip font-mono">
                  {issue.type === 'logic_gap' ? 'LOGIC GAP' : 'UNSAFE ADVICE'}
                </span>
                <p className="issue-text font-serif">&ldquo;{issue.text}&rdquo;</p>
                <p className="issue-exp font-mono">{issue.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="report-footer mono-label">
        Checked only against the supplied document. Verdicts come from a model plus code checks and can be wrong. Review flagged items.
      </footer>
    </div>
  )
}
