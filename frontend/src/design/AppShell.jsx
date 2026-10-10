import './AppShell.css'

export default function AppShell({
  docName,
  counts,
  needsReview,
  activeTab = 'audit',
  onSelectTab,
  onLoadSample,
  children
}) {
  return (
    <div className="app-shell dot-grid-bg">
      {/* Top Console Strip */}
      <header className="app-shell__header">
        <div className="app-shell__brand">
          <div className="app-shell__logo" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M3.6 9h16.8M3.6 15h16.8" />
              <ellipse cx="12" cy="12" rx="4" ry="9" />
            </svg>
          </div>
          <span className="app-shell__title">SECOND OPINION</span>
          <span className="app-shell__badge mono-label">AI AUDIT PLATFORM</span>
        </div>

        {/* Console Navigation */}
        <nav className="app-shell__nav" aria-label="Main Navigation">
          <button
            type="button"
            className={`app-shell__nav-btn ${activeTab === 'audit' ? 'is-active' : ''}`}
            onClick={() => onSelectTab?.('audit')}
          >
            AUDIT
          </button>
          <button
            type="button"
            className={`app-shell__nav-btn ${activeTab === 'benchmark' ? 'is-active' : ''}`}
            onClick={() => onSelectTab?.('benchmark')}
          >
            BENCHMARK
          </button>
          {onLoadSample && (
            <button
              type="button"
              className="app-shell__nav-btn app-shell__nav-btn--action"
              onClick={onLoadSample}
            >
              LOAD SAMPLE
            </button>
          )}
          <a
            href="#design"
            className={`app-shell__nav-btn app-shell__nav-btn--link ${activeTab === 'design' ? 'is-active' : ''}`}
          >
            #DESIGN
          </a>
        </nav>
      </header>

      {/* Sub-header Context Strip (if doc or counts available) */}
      {(docName || counts) && (
        <aside className="app-shell__context-strip" aria-label="Document Metadata">
          {docName && (
            <div className="context-strip__doc">
              <span className="mono-label">DOCUMENT:</span>
              <span className="context-strip__doc-name mono-number">{docName}</span>
            </div>
          )}
          {counts && (
            <div className="context-strip__stats mono-number">
              <span className="stat-item"><span className="stat-glyph">✓</span> {counts.supported ?? 0}</span>
              <span className="stat-separator">/</span>
              <span className="stat-item"><span className="stat-glyph">✕</span> {counts.contradicted ?? 0}</span>
              <span className="stat-separator">/</span>
              <span className="stat-item"><span className="stat-glyph">○</span> {counts.unsupported ?? 0}</span>
              <span className="stat-separator">/</span>
              <span className="stat-item"><span className="stat-glyph">◐</span> {counts.ambiguous ?? 0}</span>
              {needsReview > 0 && (
                <>
                  <span className="stat-separator">|</span>
                  <span className="stat-item stat-item--flag">? {needsReview} REVIEW</span>
                </>
              )}
            </div>
          )}
        </aside>
      )}

      {/* Main Content Area */}
      <main className="app-shell__main">
        {children}
      </main>
    </div>
  )
}
