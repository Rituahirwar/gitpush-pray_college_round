import './ConfidenceMeter.css'

export default function ConfidenceMeter({ level = 'medium', className = '' }) {
  const norm = String(level || 'medium').toLowerCase()

  let filledCount = 2
  let word = 'MEDIUM'

  if (norm === 'low') {
    filledCount = 1
    word = 'LOW'
  } else if (norm === 'high') {
    filledCount = 3
    word = 'HIGH'
  }

  return (
    <div
      className={`confidence-meter ${className}`}
      role="meter"
      aria-valuenow={filledCount}
      aria-valuemin="1"
      aria-valuemax="3"
      aria-label={`Confidence level: ${word}`}
    >
      <div className="confidence-meter__segments" aria-hidden="true">
        <span className={`confidence-meter__seg ${filledCount >= 1 ? 'is-filled' : ''}`} />
        <span className={`confidence-meter__seg ${filledCount >= 2 ? 'is-filled' : ''}`} />
        <span className={`confidence-meter__seg ${filledCount >= 3 ? 'is-filled' : ''}`} />
      </div>
      <span className="confidence-meter__word font-mono">{word}</span>
    </div>
  )
}
