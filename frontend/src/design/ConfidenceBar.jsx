import './ConfidenceBar.css'

export default function ConfidenceBar({ level = 'medium', className = '' }) {
  const normalizedLevel = String(level).toLowerCase()
  
  let filledCount = 2
  let displayWord = 'MEDIUM'

  if (normalizedLevel === 'low') {
    filledCount = 1
    displayWord = 'LOW'
  } else if (normalizedLevel === 'high') {
    filledCount = 3
    displayWord = 'HIGH'
  }

  return (
    <div
      className={`confidence-bar ${className}`}
      role="meter"
      aria-valuenow={filledCount}
      aria-valuemin="1"
      aria-valuemax="3"
      aria-label={`Confidence level: ${displayWord}`}
    >
      <div className="confidence-bar__segments" aria-hidden="true">
        <span className={`confidence-bar__segment ${filledCount >= 1 ? 'is-filled' : ''}`} />
        <span className={`confidence-bar__segment ${filledCount >= 2 ? 'is-filled' : ''}`} />
        <span className={`confidence-bar__segment ${filledCount >= 3 ? 'is-filled' : ''}`} />
      </div>
      <span className="mono-label confidence-bar__label">{displayWord}</span>
    </div>
  )
}
