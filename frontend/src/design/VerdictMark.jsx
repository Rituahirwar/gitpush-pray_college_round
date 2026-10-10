import './VerdictMark.css'
import { VERDICT_CONFIG } from './verdictConfig'

export default function VerdictMark({
  verdict,
  mode = 'badge', // 'badge' | 'glyph' | 'inline'
  index, // Footnote number
  children,
  className = '',
  onClick,
  isSelected = false
}) {
  const config = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.unsupported

  if (mode === 'glyph') {
    return (
      <span
        className={`verdict-glyph verdict-glyph--${config.code} ${className}`}
        aria-label={config.label}
      >
        {config.glyph}
      </span>
    )
  }

  if (mode === 'inline') {
    return (
      <mark
        className={`verdict-inline ${config.markClass} ${isSelected ? 'verdict-inline--selected' : ''} ${className}`}
        onClick={onClick}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onClick()
          }
        }}
      >
        {config.code === 'unsafe_advice' && <span className="mark-bracket">[</span>}
        <span className="verdict-inline__text">{children}</span>
        {config.code === 'unsafe_advice' && <span className="mark-bracket">]</span>}
        {index !== undefined && (
          <sup className="verdict-footnote" aria-hidden="true">
            {index}
          </sup>
        )}
      </mark>
    )
  }

  // Default: badge mode with glyph + display label
  return (
    <span
      className={`verdict-badge verdict-badge--${config.code} ${className}`}
      role="status"
    >
      <span className="verdict-badge__glyph" aria-hidden="true">{config.glyph}</span>
      <span className="verdict-badge__label">{config.label}</span>
      {index !== undefined && <span className="verdict-badge__index">#{index}</span>}
    </span>
  )
}
