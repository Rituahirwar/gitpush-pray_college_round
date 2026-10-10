import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  FileText,
  GitBranch,
  Info,
  Layers3,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import './App.css'

const answerText = `Urban tree planting can help cities reduce the effects of heat and improve the quality of public spaces.

Urban trees can lower nearby surface temperatures by providing shade and cooling through evapotranspiration. Planting trees in every vacant urban plot always improves biodiversity.

Vacant lots in Mumbai cover 18% of the city's land area. Planting should prioritize native species and account for underground utilities.`

// Temporary UI fixture only. Replace with the team's agreed audit JSON
// when it is supplied. These example quotations are not real source evidence.
const demoClaims = [
  {
    id: 'CL-001',
    text: 'Urban trees can lower nearby surface temperatures by providing shade and cooling through evapotranspiration.',
    label: 'supported',
    error_type: 'none',
    confidence: 'High',
    needs_review: false,
    explanation:
      'The example passage describes shade and evapotranspiration as mechanisms that can reduce local heat. It supports the central idea of this claim.',
    evidence: [
      {
        page: 4,
        chunk_id: 'demo-chunk-04',
        quote:
          'Urban trees provide shade and can cool their surroundings through evapotranspiration.',
        verified: false,
      },
    ],
    checks: ['Claim meaning matches passage', 'Mechanism identified'],
  },
  {
    id: 'CL-002',
    text: 'Planting trees in every vacant urban plot always improves biodiversity.',
    label: 'contradicted',
    error_type: 'overgeneralization',
    confidence: 'Medium',
    needs_review: true,
    explanation:
      'The example passage indicates that planting decisions depend on local ecology and site conditions. The absolute wording “every” and “always” is stronger than the available evidence.',
    evidence: [
      {
        page: 7,
        chunk_id: 'demo-chunk-07',
        quote:
          'Planting choices should account for existing habitat, local species and site conditions.',
        verified: false,
      },
    ],
    checks: ['Absolute wording detected', 'Contextual qualification required'],
  },
  {
    id: 'CL-003',
    text: "Vacant lots in Mumbai cover 18% of the city's land area.",
    label: 'unsupported',
    error_type: 'unsupported_statistic',
    confidence: 'High',
    needs_review: true,
    explanation:
      'The example evidence does not establish this city-wide percentage. The figure should not be treated as factual without a traceable source and a defined measurement method.',
    evidence: [],
    checks: ['Exact figure not established', 'Source required'],
  },
  {
    id: 'CL-004',
    text: 'Planting should prioritize native species and account for underground utilities.',
    label: 'ambiguous',
    error_type: 'insufficient_context',
    confidence: 'Low',
    needs_review: true,
    explanation:
      'The recommendation combines ecological suitability with infrastructure constraints. The example passages do not establish whether both conditions apply to the specific sites being discussed.',
    evidence: [
      {
        page: 9,
        chunk_id: 'demo-chunk-09',
        quote:
          'Site assessment should consider planting suitability and existing infrastructure.',
        verified: false,
      },
    ],
    checks: ['Recommendation needs site context', 'Specific constraints not established'],
  },
]

const verdictMeta = {
  supported: { label: 'Supported', icon: CheckCircle2 },
  contradicted: { label: 'Contradicted', icon: AlertTriangle },
  unsupported: { label: 'Unsupported', icon: CircleHelp },
  ambiguous: { label: 'Ambiguous', icon: Info },
}

function getClaims() {
  return demoClaims.map((claim) => ({
    ...claim,
    start: answerText.indexOf(claim.text),
    end: answerText.indexOf(claim.text) + claim.text.length,
  }))
}

function VerdictTag({ verdict }) {
  const meta = verdictMeta[verdict] ?? verdictMeta.ambiguous
  const Icon = meta.icon

  return (
    <span className={`verdict-tag verdict-${verdict}`}>
      <Icon size={13} strokeWidth={2} />
      {meta.label}
    </span>
  )
}

function App() {
  const claims = useMemo(() => getClaims(), [])
  const [selectedId, setSelectedId] = useState('CL-001')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [reviewed, setReviewed] = useState([])
  const [showClaims, setShowClaims] = useState(true)
  const [mobileEvidence, setMobileEvidence] = useState(false)

  const selectedClaim = claims.find((claim) => claim.id === selectedId) ?? claims[0]

  const filteredClaims = claims.filter((claim) => {
    const matchesFilter = filter === 'all' || claim.label === filter
    const matchesSearch = `${claim.text} ${claim.id} ${claim.error_type}`
      .toLowerCase()
      .includes(search.toLowerCase())

    return matchesFilter && matchesSearch
  })

  const counts = {
    total: claims.length,
    supported: claims.filter((claim) => claim.label === 'supported').length,
    contradicted: claims.filter((claim) => claim.label === 'contradicted').length,
    unsupported: claims.filter((claim) => claim.label === 'unsupported').length,
    ambiguous: claims.filter((claim) => claim.label === 'ambiguous').length,
    review: claims.filter((claim) => claim.needs_review).length,
  }

  function renderHighlightedAnswer() {
    const sorted = [...claims]
      .filter((claim) => claim.start >= 0)
      .sort((a, b) => a.start - b.start)

    const pieces = []
    let cursor = 0

    sorted.forEach((claim) => {
      if (claim.start < cursor) return

      if (claim.start > cursor) {
        pieces.push(
          <span key={`text-${cursor}`}>
            {answerText.slice(cursor, claim.start)}
          </span>,
        )
      }

      pieces.push(
        <button
          type="button"
          key={claim.id}
          className={`claim-highlight highlight-${claim.label} ${
            selectedId === claim.id ? 'is-selected' : ''
          }`}
          onClick={() => {
            setSelectedId(claim.id)
            setMobileEvidence(true)
          }}
          aria-label={`Select ${claim.id}: ${verdictMeta[claim.label].label}`}
          title={`${claim.id} · ${verdictMeta[claim.label].label}`}
        >
          {claim.text}
          <span className="highlight-index">{claim.id.slice(-1)}</span>
        </button>,
      )

      cursor = claim.end
    })

    if (cursor < answerText.length) {
      pieces.push(<span key="text-end">{answerText.slice(cursor)}</span>)
    }

    return pieces
  }

  function toggleReviewed(id) {
    setReviewed((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    )
  }

  return (
    <main className="app-shell">
      <aside className="rail" aria-label="Main navigation">
        <a className="brand-mark" href="#workspace" aria-label="Second Opinion home">
          <ShieldCheck size={24} />
        </a>

        <div className="rail-divider" />

        <button className="rail-button active" aria-label="Audit workspace" title="Audit workspace">
          <Layers3 size={20} />
        </button>
        <button className="rail-button" aria-label="Documents" title="Documents">
          <BookOpen size={20} />
        </button>
        <button className="rail-button" aria-label="Audit activity" title="Audit activity">
          <Activity size={20} />
        </button>

        <div className="rail-bottom">
          <span className="avatar" title="Audit workspace">A</span>
        </div>
      </aside>

      <section className="workspace" id="workspace">
        <header className="topbar">
          <div className="brand-lockup">
            <span className="brand-name">second opinion</span>
            <span className="brand-divider">/</span>
            <span className="workspace-label">Evidence workspace</span>
          </div>

          <div className="topbar-right">
            <span className="demo-pill">
              <span className="demo-dot" />
              Demo data
            </span>
            <span className="topbar-separator" />
            <span className="saved-label">
              <Check size={14} />
              Local preview
            </span>
          </div>
        </header>

        <div className="document-bar">
          <div className="document-identity">
            <div className="document-icon">
              <FileText size={19} />
            </div>
            <div className="document-titles">
              <div className="eyebrow">AUDIT / DOCUMENT 001</div>
              <h1>Urban tree planting &amp; heat reduction</h1>
            </div>
          </div>

          <button
            type="button"
            className="secondary-button document-action"
            onClick={() => setShowClaims((value) => !value)}
          >
            <Menu size={16} />
            {showClaims ? 'Hide claim list' : 'Show claim list'}
          </button>
        </div>

        <div className="workspace-content">
          <section className="audit-main">
            <div className="page-heading">
              <div>
                <div className="eyebrow">VERIFICATION REPORT</div>
                <h2>Answer audit</h2>
                <p className="subheading">
                  Inspect each claim against the supplied source evidence.
                </p>
              </div>
              <div className="audit-status">
                <span className="status-dot" />
                Preview mode
              </div>
            </div>

            <section className="metrics-grid" aria-label="Audit summary">
              <div className="metric-card metric-total">
                <span className="metric-label">Claims identified</span>
                <strong>{counts.total.toString().padStart(2, '0')}</strong>
                <span className="metric-foot">In this answer</span>
              </div>
              <div className="metric-card metric-supported">
                <span className="metric-label">Supported</span>
                <strong>{counts.supported.toString().padStart(2, '0')}</strong>
                <span className="metric-foot">Evidence aligns</span>
              </div>
              <div className="metric-card metric-contradicted">
                <span className="metric-label">Contradicted</span>
                <strong>{counts.contradicted.toString().padStart(2, '0')}</strong>
                <span className="metric-foot">Conflicting evidence</span>
              </div>
              <div className="metric-card metric-unsupported">
                <span className="metric-label">Unsupported</span>
                <strong>{counts.unsupported.toString().padStart(2, '0')}</strong>
                <span className="metric-foot">Not established</span>
              </div>
              <div className="metric-card metric-ambiguous">
                <span className="metric-label">Ambiguous</span>
                <strong>{counts.ambiguous.toString().padStart(2, '0')}</strong>
                <span className="metric-foot">Needs context</span>
              </div>
            </section>

            <div className="analysis-layout">
              {showClaims && (
                <aside className="claims-sidebar">
                  <div className="section-heading">
                    <div>
                      <h3>Claim register</h3>
                      <span className="muted-caption">{filteredClaims.length} of {claims.length} claims</span>
                    </div>
                    <ClipboardCheck size={18} className="heading-icon" />
                  </div>

                  <label className="search-box">
                    <Search size={16} />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Find a claim..."
                      aria-label="Search claims"
                    />
                    {search && (
                      <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
                        <X size={14} />
                      </button>
                    )}
                  </label>

                  <label className="filter-select">
                    <span className="sr-only">Filter by verdict</span>
                    <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                      <option value="all">All verdicts</option>
                      <option value="supported">Supported</option>
                      <option value="contradicted">Contradicted</option>
                      <option value="unsupported">Unsupported</option>
                      <option value="ambiguous">Ambiguous</option>
                    </select>
                    <ChevronDown size={15} />
                  </label>

                  <div className="claim-list">
                    {filteredClaims.map((claim) => (
                      <button
                        type="button"
                        key={claim.id}
                        className={`claim-list-item ${selectedId === claim.id ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedId(claim.id)
                          setMobileEvidence(true)
                        }}
                      >
                        <div className="claim-item-top">
                          <span className="claim-id">{claim.id}</span>
                          <span className={`claim-state-dot state-${claim.label}`} />
                        </div>
                        <p>{claim.text}</p>
                        <div className="claim-item-bottom">
                          <VerdictTag verdict={claim.label} />
                          {claim.needs_review && <span className="review-mini">Review</span>}
                        </div>
                      </button>
                    ))}
                    {filteredClaims.length === 0 && (
                      <div className="empty-state">
                        <Search size={20} />
                        <p>No claims match this search.</p>
                        <button type="button" onClick={() => { setSearch(''); setFilter('all') }}>
                          Clear filters
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="register-footer">
                    <span className="footer-dot" />
                    <span>{counts.review} claims flagged for review</span>
                  </div>
                </aside>
              )}

              <section className="answer-column">
                <div className="panel-header">
                  <div>
                    <div className="panel-kicker"><FileText size={14} /> AI-GENERATED RESPONSE</div>
                    <h3>Answer under review</h3>
                  </div>
                  <span className="source-count">{claims.length} claims</span>
                </div>

                <div className="highlight-legend">
                  <span><i className="legend-dot legend-supported" /> Supported</span>
                  <span><i className="legend-dot legend-contradicted" /> Contradicted</span>
                  <span><i className="legend-dot legend-unsupported" /> Unsupported</span>
                  <span><i className="legend-dot legend-ambiguous" /> Ambiguous</span>
                </div>

                <article className="answer-paper">
                  <div className="paper-meta">
                    <span><Sparkles size={14} /> Generated answer</span>
                    <span>Illustrative sample</span>
                  </div>
                  <div className="answer-copy">{renderHighlightedAnswer()}</div>
                  <div className="paper-footer">
                    <Info size={14} />
                    Select any highlighted claim to inspect its evidence.
                  </div>
                </article>

                <section className="method-note">
                  <div className="method-icon"><GitBranch size={17} /></div>
                  <div>
                    <h4>How to read this audit</h4>
                    <p>
                      A verdict describes how a claim relates to the available source.
                      Unsupported means the source does not establish the claim—it does
                      not automatically mean the claim is false.
                    </p>
                  </div>
                </section>
              </section>
            </div>
          </section>

          <aside className={`evidence-panel ${mobileEvidence ? 'mobile-open' : ''}`}>
            <div className="evidence-panel-header">
              <div>
                <div className="eyebrow">CLAIM INSPECTOR</div>
                <h2>Evidence review</h2>
              </div>
              <button
                type="button"
                className="icon-button close-evidence"
                aria-label="Close evidence panel"
                onClick={() => setMobileEvidence(false)}
              >
                <X size={19} />
              </button>
            </div>

            <div className="selected-claim-id">
              <span>{selectedClaim.id}</span>
              <span className="selected-confidence"><span className="confidence-dot" /> {selectedClaim.confidence} confidence</span>
            </div>

            <div className="selected-claim-text">{selectedClaim.text}</div>

            <div className="verdict-block">
              <span className="field-label">VERDICT</span>
              <VerdictTag verdict={selectedClaim.label} />
              <p>{selectedClaim.explanation}</p>
            </div>

            <div className="inspector-section">
              <div className="inspector-section-title">
                <h3>Source evidence</h3>
                <span className="evidence-count">{selectedClaim.evidence.length} passages</span>
              </div>

              {selectedClaim.evidence.length > 0 ? (
                selectedClaim.evidence.map((item, index) => (
                  <article className="evidence-card" key={`${item.chunk_id}-${index}`}>
                    <div className="evidence-card-top">
                      <span className="page-label"><FileText size={13} /> Page {item.page}</span>
                      {item.verified ? (
                        <span className="verified-label"><ShieldCheck size={13} /> Evidence verified</span>
                      ) : (
                        <span className="unverified-label"><Clock3 size={13} /> Not verified</span>
                      )}
                    </div>
                    <blockquote>“{item.quote}”</blockquote>
                    <div className="evidence-card-footer">
                      <span>{item.chunk_id}</span>
                      <span>Passage {index + 1}</span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="no-evidence">
                  <div className="no-evidence-icon"><Search size={19} /></div>
                  <h4>No supporting passage found</h4>
                  <p>
                    The current audit data contains no evidence quotation for this claim.
                    Do not treat it as verified.
                  </p>
                </div>
              )}
            </div>

            <div className="inspector-section">
              <div className="inspector-section-title">
                <h3>Audit checks</h3>
                <span className="evidence-count">{selectedClaim.checks.length}</span>
              </div>
              <div className="checks-list">
                {selectedClaim.checks.map((check) => (
                  <div className="check-row" key={check}>
                    <span className="check-icon"><Check size={13} /></span>
                    <span>{check}</span>
                  </div>
                ))}
              </div>
              <div className="error-type">
                <span className="field-label">ERROR TYPE</span>
                <code>{selectedClaim.error_type}</code>
              </div>
            </div>

            <div className="inspector-section trail-section">
              <div className="inspector-section-title">
                <h3>Evidence trail</h3>
                <GitBranch size={16} className="heading-icon" />
              </div>
              <ol className="evidence-trail">
                <li className="trail-complete">
                  <span className="trail-marker"><Check size={12} /></span>
                  <div><strong>Claim identified</strong><span>Extracted from AI answer</span></div>
                </li>
                <li className={selectedClaim.evidence.length ? 'trail-complete' : 'trail-pending'}>
                  <span className="trail-marker">{selectedClaim.evidence.length ? <Check size={12} /> : '2'}</span>
                  <div><strong>Passage retrieved</strong><span>{selectedClaim.evidence.length ? `${selectedClaim.evidence.length} passage(s) in demo fixture` : 'No passage supplied'}</span></div>
                </li>
                <li className="trail-complete">
                  <span className="trail-marker"><Check size={12} /></span>
                  <div><strong>Claim compared</strong><span>Illustrative audit result</span></div>
                </li>
                <li className="trail-verdict">
                  <span className="trail-marker"><Check size={12} /></span>
                  <div><strong>Verdict assigned</strong><span>{verdictMeta[selectedClaim.label].label}</span></div>
                </li>
                <li className="trail-pending">
                  <span className="trail-marker">5</span>
                  <div><strong>Human review</strong><span>{reviewed.includes(selectedClaim.id) ? 'Marked reviewed in this session' : 'Awaiting your review'}</span></div>
                </li>
              </ol>
            </div>

            <div className="review-action">
              <button
                type="button"
                className={`review-button ${reviewed.includes(selectedClaim.id) ? 'review-complete' : ''}`}
                onClick={() => toggleReviewed(selectedClaim.id)}
              >
                {reviewed.includes(selectedClaim.id) ? <CheckCircle2 size={17} /> : <ClipboardCheck size={17} />}
                {reviewed.includes(selectedClaim.id) ? 'Marked as reviewed' : 'Mark claim as reviewed'}
                <ArrowRight size={15} />
              </button>
              <p>Review status is local to this browser session.</p>
            </div>

            <div className="demo-disclaimer">
              <Info size={14} />
              <span>Demo fixture only. Evidence, verdicts and page references are illustrative, not verified research findings.</span>
            </div>
          </aside>
        </div>

        <footer className="app-footer">
          <span>SECOND OPINION <span className="footer-slash">/</span> CLAIM-LEVEL VERIFICATION</span>
          <span>Preview build <span className="footer-slash">·</span> Not connected to backend</span>
        </footer>
      </section>
    </main>
  )
}

export default App