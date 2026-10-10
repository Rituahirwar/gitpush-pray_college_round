import './FlagReview.css'

export default function FlagReview({
  active = true,
  showLabel = false,
  className = ''
}) {
  if (!active) return null

  return (
    <span
      className={`flag-review ${className}`}
      title="Passes disagreed - review recommended"
      role="status"
      aria-label="Needs review flag"
    >
      <span className="flag-review__glyph" aria-hidden="true">?</span>
      {showLabel && <span className="flag-review__label">NEEDS REVIEW</span>}
    </span>
  )
}
