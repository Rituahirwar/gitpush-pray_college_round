import './VerdictMark.css'

export const VERDICT_CONFIG = {
  supported: {
    symbol: '✓',
    label: 'Supported',
    code: 'supported',
    dotColor: 'var(--dot-supported)',
    className: 'mark-supported',
  },
  contradicted: {
    symbol: '✕',
    label: 'Contradicted',
    code: 'contradicted',
    dotColor: 'var(--dot-contradicted)',
    className: 'mark-contradicted',
  },
  unsupported: {
    symbol: '∅',
    label: 'Unsupported',
    code: 'unsupported',
    dotColor: 'var(--dot-unsupported)',
    className: 'mark-unsupported',
  },
  ambiguous: {
    symbol: '≈',
    label: 'Ambiguous',
    code: 'ambiguous',
    dotColor: 'var(--dot-ambiguous)',
    className: 'mark-ambiguous',
  },
  logic_gap: {
    symbol: '⚡',
    label: 'Logic Gap',
    code: 'logic_gap',
    tag: 'LOGIC GAP',
    className: 'mark-logic-gap',
  },
  unsafe_advice: {
    symbol: '▲',
    label: 'Unsafe Advice',
    code: 'unsafe_advice',
    tag: 'UNSAFE',
    className: 'mark-unsafe',
  },
}

export default function VerdictMark({
  verdict = 'supported',
  mode = 'inline', // 'inline' | 'badge' | 'glyph'
  index,
  children,
  onClick,
  isSelected = false,
  isFlagged = false, // needs_review
  ariaLabel,
  className = '',
}) {
  const meta = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.supported

  if (mode === 'glyph') {
    return (
      <span
        className={`verdict-glyph verdict-glyph--${meta.code} ${className}`}
        aria-hidden="true"
      >
        {meta.symbol}
      </span>
    )
  }

  if (mode === 'badge') {
    return (
      <span className={`verdict-badge verdict-badge--${meta.code} ${className}`} role="status">
        <span
          className="verdict-dot"
          style={{ backgroundColor: meta.dotColor || 'var(--text-dim)' }}
          aria-hidden="true"
        />
        <span className="verdict-symbol font-mono" aria-hidden="true">{meta.symbol}</span>
        <span className="verdict-label font-mono">{meta.label}</span>
        {isFlagged && <span className="review-flag font-mono">REVIEW</span>}
      </span>
    )
  }

  // mode === 'inline' (mark button)
  return (
    <button
      type="button"
      className={`verdict-mark-btn ${meta.className} ${isSelected ? 'is-selected' : ''} ${className}`}
      onClick={onClick}
      aria-label={ariaLabel || `Claim ${index ? index + ', ' : ''}${meta.label}`}
      aria-pressed={isSelected}
    >
      <span className="mark-text">{children}</span>
      {meta.tag && <span className="mark-tag font-mono">{meta.tag}</span>}
      {isFlagged && <span className="review-flag font-mono">REVIEW</span>}
      {index !== undefined && <sup className="mark-index font-mono">{index}</sup>}
    </button>
  )
}
