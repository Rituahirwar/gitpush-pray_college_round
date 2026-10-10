import './VerdictBar.css'
import CountUp from './CountUp'

export default function VerdictBar({
  counts = { supported: 0, contradicted: 0, unsupported: 0, ambiguous: 0 },
  needsReview = 0,
  assessment = '',
  className = ''
}) {
  const supported = Number(counts?.supported) || 0
  const contradicted = Number(counts?.contradicted) || 0
  const unsupported = Number(counts?.unsupported) || 0
  const ambiguous = Number(counts?.ambiguous) || 0

  const total = supported + contradicted + unsupported + ambiguous

  const supportedPct = total > 0 ? (supported / total) * 100 : 0
  const contradictedPct = total > 0 ? (contradicted / total) * 100 : 0
  const unsupportedPct = total > 0 ? (unsupported / total) * 100 : 0
  const ambiguousPct = total > 0 ? (ambiguous / total) * 100 : 0

  const items = [
    { key: 'supported', label: 'Supported', glyph: '✓', count: supported, pct: supportedPct, hatchClass: 'hatch-supported' },
    { key: 'contradicted', label: 'Contradicted', glyph: '✕', count: contradicted, pct: contradictedPct, hatchClass: 'hatch-contradicted' },
    { key: 'unsupported', label: 'Insufficient evidence', glyph: '○', count: unsupported, pct: unsupportedPct, hatchClass: 'hatch-insufficient' },
    { key: 'ambiguous', label: 'Ambiguous', glyph: '◐', count: ambiguous, pct: ambiguousPct, hatchClass: 'hatch-ambiguous' }
  ]

  return (
    <div className={`verdict-bar-container ${className}`}>
      <div className="verdict-bar-header">
        <span className="mono-label">CLAIMS BY VERDICT ({total} TOTAL)</span>
        {needsReview > 0 && (
          <span className="verdict-bar-needs-review mono-label">
            <span className="review-badge-tick">?</span>
            <span>{needsReview} NEEDS REVIEW</span>
          </span>
        )}
      </div>

      {/* Stacked horizontal bar with greyscale hatch patterns */}
      <div
        className="verdict-stacked-bar"
        role="progressbar"
        aria-valuenow={total}
        aria-valuemin="0"
        aria-valuemax={total}
        aria-label="Stacked claims by verdict"
      >
        {total === 0 ? (
          <div className="verdict-bar-segment hatch-empty" style={{ width: '100%' }} />
        ) : (
          items.map(
            (item) =>
              item.pct > 0 && (
                <div
                  key={item.key}
                  className={`verdict-bar-segment ${item.hatchClass}`}
                  style={{ width: `${item.pct}%` }}
                  title={`${item.label}: ${item.count} (${Math.round(item.pct)}%)`}
                />
              )
          )
        )}
      </div>

      {/* Text legend with verdict names, glyphs, hatch swatches and counts */}
      <div className="verdict-legend">
        {items.map((item) => (
          <div key={item.key} className="verdict-legend-item">
            <span className={`verdict-legend-swatch ${item.hatchClass}`} aria-hidden="true" />
            <span className="verdict-legend-glyph" aria-hidden="true">{item.glyph}</span>
            <span className="verdict-legend-label">{item.label}:</span>
            <strong className="verdict-legend-count mono-number">
              <CountUp value={item.count} />
            </strong>
          </div>
        ))}
      </div>

      {assessment && (
        <div className="verdict-bar-assessment">
          <p className="assessment-text">{assessment}</p>
        </div>
      )}
    </div>
  )
}
