import { useState, useEffect } from 'react'
import './Benchmark.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function formatPercent(val) {
  if (val === undefined || val === null || isNaN(val)) return '—'
  return `${(Number(val) * 100).toFixed(1)}%`
}

function formatLatency(val) {
  if (val === undefined || val === null || isNaN(val)) return '—'
  return `${Number(val).toFixed(2)}s`
}

function formatInt(val) {
  if (val === undefined || val === null || isNaN(val)) return '—'
  return String(val)
}

export default function Benchmark() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [splitKey, setSplitKey] = useState('heldout') // 'heldout' | 'dev'

  useEffect(() => {
    let active = true

    const fetchBenchmark = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/benchmark`)
        if (res.ok) {
          const json = await res.json()
          if (json && Object.keys(json).length > 0) {
            if (active) {
              setData(json)
              setLoading(false)
            }
            return
          }
        }
      } catch {
        // Try static fallback
      }

      try {
        const res = await fetch('/benchmark-results.json')
        if (res.ok) {
          const json = await res.json()
          if (json && Object.keys(json).length > 0) {
            if (active) {
              setData(json)
              setLoading(false)
            }
            return
          }
        }
      } catch {
        // Fallback failed
      }

      if (active) {
        setData({})
        setLoading(false)
      }
    }

    fetchBenchmark()
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <main className="benchmark-page">
        <div className="benchmark-container">
          <p className="mono-label benchmark-loading">LOADING BENCHMARK DATA...</p>
        </div>
      </main>
    )
  }

  const isEmpty = !data || Object.keys(data).length === 0

  if (isEmpty) {
    return (
      <main className="benchmark-page">
        <div className="benchmark-container">
          <h1 className="benchmark-title font-serif">How accurate is it?</h1>
          <p className="benchmark-subtitle">Measured on claims labelled by hand.</p>
          <div className="benchmark-empty-box">
            <h2 className="benchmark-empty-title">No evaluation results yet.</h2>
            <p className="benchmark-empty-desc">
              Evaluation results on the benchmark dataset have not been recorded or the benchmark service is not initialized.
            </p>
          </div>
        </div>
      </main>
    )
  }

  // Support both shapes: data.splits?.heldout vs data.heldout
  const splits = data.splits || data
  const currentSplit = splits[splitKey] || null
  const testSetSize = currentSplit?.n_claims ?? currentSplit?.total_claims ?? null

  const accuracy = currentSplit?.accuracy
  const baseline = currentSplit?.baseline_always_supported ?? currentSplit?.always_supported_baseline
  const contradictionRecall = currentSplit?.contradiction_recall
  const falseAlarmRate = currentSplit?.false_alarm_rate
  const citationValidity = currentSplit?.citation_validity
  const retrievalHitRate = currentSplit?.retrieval_hit_rate
  const needsReviewRate = currentSplit?.needs_review_rate
  const avgLatency = currentSplit?.avg_seconds_per_claim

  const perLabel = currentSplit?.per_label || {}
  const labels = ['supported', 'contradicted', 'unsupported', 'ambiguous']

  // Confusion matrix support:
  // Shape A: { supported: { supported: 32, contradicted: 0, ... }, ... }
  // Shape B: { labels: ['supported', ...], matrix: [[...]] }
  const confusionData = currentSplit?.confusion_matrix || currentSplit?.confusion

  // Planted errors support:
  const plantedErrors = data.planted_errors || (data.part2_planted_test ? {
    total: data.part2_planted_test.total_planted,
    found: data.part2_planted_test.detected_count,
    correct_label: data.part2_planted_test.correct_label_count,
  } : null)

  const limitations = data.limitations || [
    'Benchmarked on single-document context passages.',
    'Ambiguous classification has low recall due to strict evidence threshold.',
    'Latency includes both extraction and skepticism passes.'
  ]

  return (
    <main className="benchmark-page">
      <div className="benchmark-container">
        <header className="benchmark-header">
          <div className="benchmark-header__left">
            <h1 className="benchmark-title font-serif">How accurate is it?</h1>
            <p className="benchmark-subtitle">Measured on claims labelled by hand.</p>
          </div>

          <div className="split-toggle-group">
            <button
              type="button"
              className={`split-toggle-btn ${splitKey === 'heldout' ? 'is-active' : ''}`}
              onClick={() => setSplitKey('heldout')}
            >
              held-out
            </button>
            <button
              type="button"
              className={`split-toggle-btn ${splitKey === 'dev' ? 'is-active' : ''}`}
              onClick={() => setSplitKey('dev')}
            >
              dev, used for tuning
            </button>
          </div>
        </header>

        {testSetSize !== null && (
          <div className="test-size-banner mono-label">
            SPLIT: {splitKey.toUpperCase()} &bull; TEST SET SIZE: {testSetSize} CLAIMS
          </div>
        )}

        {/* Core Metrics Table */}
        <section className="benchmark-section" aria-labelledby="core-metrics-heading">
          <h2 id="core-metrics-heading" className="section-title mono-label">
            CORE VERIFICATION METRICS
          </h2>
          <div className="table-wrapper">
            <table className="metric-table">
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col" className="text-right">Value</th>
                  <th scope="col">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="metric-name">Accuracy</td>
                  <td className="metric-val text-right font-mono">{formatPercent(accuracy)}</td>
                  <td className="metric-desc">Overall fraction of claims correctly classified across all verdicts.</td>
                </tr>
                <tr>
                  <td className="metric-name">Always-supported baseline</td>
                  <td className="metric-val text-right font-mono">{formatPercent(baseline)}</td>
                  <td className="metric-desc">Accuracy of a naive baseline predicting supported for every claim.</td>
                </tr>
                <tr>
                  <td className="metric-name">Contradiction recall</td>
                  <td className="metric-val text-right font-mono">{formatPercent(contradictionRecall)}</td>
                  <td className="metric-desc">Proportion of factual contradictions successfully flagged.</td>
                </tr>
                <tr>
                  <td className="metric-name">False-alarm rate</td>
                  <td className="metric-val text-right font-mono">{formatPercent(falseAlarmRate)}</td>
                  <td className="metric-desc">Rate at which factually accurate claims are wrongly flagged.</td>
                </tr>
                <tr>
                  <td className="metric-name">Citation validity</td>
                  <td className="metric-val text-right font-mono">{formatPercent(citationValidity)}</td>
                  <td className="metric-desc">Percentage of cited quotes verified verbatim in the source PDF.</td>
                </tr>
                <tr>
                  <td className="metric-name">Retrieval hit rate</td>
                  <td className="metric-val text-right font-mono">{formatPercent(retrievalHitRate)}</td>
                  <td className="metric-desc">Fraction of claims where relevant source passage was found in top-k chunks.</td>
                </tr>
                <tr>
                  <td className="metric-name">Needs-review rate</td>
                  <td className="metric-val text-right font-mono">{formatPercent(needsReviewRate)}</td>
                  <td className="metric-desc">Proportion of claims surfaced for human review due to verifier disagreement.</td>
                </tr>
                <tr>
                  <td className="metric-name">Average seconds per claim</td>
                  <td className="metric-val text-right font-mono">{formatLatency(avgLatency)}</td>
                  <td className="metric-desc">Mean end-to-end processing latency per claim.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Per-Label Precision & Recall */}
        <section className="benchmark-section" aria-labelledby="per-label-heading">
          <h2 id="per-label-heading" className="section-title mono-label">
            PER-LABEL PRECISION &amp; RECALL
          </h2>
          <div className="table-wrapper">
            <table className="metric-table">
              <thead>
                <tr>
                  <th scope="col">Verdict</th>
                  <th scope="col" className="text-right">Precision</th>
                  <th scope="col" className="text-right">Recall</th>
                  <th scope="col" className="text-right">F1 Score</th>
                  <th scope="col" className="text-right">Support</th>
                </tr>
              </thead>
              <tbody>
                {labels.map((lbl) => {
                  const stat = perLabel[lbl]
                  return (
                    <tr key={lbl}>
                      <td className="verdict-name">
                        <span className={`verdict-dot dot-${lbl}`} aria-hidden="true" />
                        <span className="mono-label">{lbl}</span>
                      </td>
                      <td className="metric-val text-right font-mono">{formatPercent(stat?.precision)}</td>
                      <td className="metric-val text-right font-mono">{formatPercent(stat?.recall)}</td>
                      <td className="metric-val text-right font-mono">{formatPercent(stat?.f1)}</td>
                      <td className="metric-val text-right font-mono">{formatInt(stat?.support)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Confusion Matrix */}
        {confusionData && (
          <section className="benchmark-section" aria-labelledby="confusion-heading">
            <h2 id="confusion-heading" className="section-title mono-label">
              CONFUSION MATRIX (GOLD ROW &times; PREDICTED COLUMN)
            </h2>
            <div className="table-wrapper">
              <table className="matrix-table font-mono">
                <thead>
                  <tr>
                    <th scope="col" className="matrix-label">Gold \ Predicted</th>
                    {labels.map((l) => (
                      <th key={l} scope="col" className="text-center">{l.slice(0, 4).toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {labels.map((gold) => (
                    <tr key={gold}>
                      <td className="matrix-row-label">{gold}</td>
                      {labels.map((pred) => {
                        let count = '—'
                        if (Array.isArray(confusionData.matrix) && Array.isArray(confusionData.labels)) {
                          const rIdx = confusionData.labels.indexOf(gold)
                          const cIdx = confusionData.labels.indexOf(pred)
                          if (rIdx !== -1 && cIdx !== -1) {
                            count = confusionData.matrix[rIdx]?.[cIdx] ?? '—'
                          }
                        } else if (confusionData[gold] && confusionData[gold][pred] !== undefined) {
                          count = confusionData[gold][pred]
                        }

                        const isDiagonal = gold === pred
                        const isNonZero = typeof count === 'number' && count > 0

                        return (
                          <td
                            key={pred}
                            className={`matrix-cell text-center ${isDiagonal && isNonZero ? 'is-diagonal' : ''} ${!isNonZero ? 'is-zero' : ''}`}
                          >
                            {count}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Planted Errors Line */}
        {plantedErrors && (
          <section className="benchmark-section planted-errors-card">
            <h2 className="section-title mono-label">PLANTED ERRORS TEST (STRESS INJECTION)</h2>
            <p className="planted-text">
              Injected factual errors detected:{' '}
              <span className="font-mono">{formatInt(plantedErrors.found)}</span> of{' '}
              <span className="font-mono">{formatInt(plantedErrors.total)}</span> planted claims ({formatPercent(plantedErrors.found / (plantedErrors.total || 1))}).{' '}
              {plantedErrors.correct_label !== undefined && (
                <>
                  Exact verdict match on <span className="font-mono">{formatInt(plantedErrors.correct_label)}</span> claims.
                </>
              )}
            </p>
          </section>
        )}

        {/* Limitations List */}
        {limitations && limitations.length > 0 && (
          <section className="benchmark-section limitations-section">
            <h2 className="section-title mono-label">BENCHMARK LIMITATIONS</h2>
            <ul className="limitations-list">
              {limitations.map((item, idx) => (
                <li key={idx} className="limitations-item">{item}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}
