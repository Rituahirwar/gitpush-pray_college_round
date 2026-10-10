import { useEffect, useState } from 'react'

export default function CountUp({
  value = 0,
  duration = 600,
  className = '',
  prefix = '',
  suffix = ''
}) {
  const target = Number(value) || 0
  const isReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

  const [displayValue, setDisplayValue] = useState(() => (isReducedMotion ? target : 0))

  useEffect(() => {
    if (isReducedMotion) {
      return
    }

    const startValue = 0
    const endValue = target
    if (endValue === 0) {
      return
    }

    let startTime = null
    let animationFrameId = null

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      const current = Math.floor(startValue + (endValue - startValue) * easedProgress)
      setDisplayValue(current)

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step)
      } else {
        setDisplayValue(endValue)
      }
    }

    animationFrameId = requestAnimationFrame(step)

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }
  }, [target, duration, isReducedMotion])

  const shown = isReducedMotion ? target : displayValue

  return (
    <span className={`count-up ${className}`}>
      {prefix}{shown}{suffix}
    </span>
  )
}
