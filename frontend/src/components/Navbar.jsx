import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAudit } from '../context/AuditContext'
import './Navbar.css'

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { backendConnected, loadSample } = useAudit()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loadingSample, setLoadingSample] = useState(false)

  // Audit stays active on both /audit and /audit/result
  const isAuditActive = location.pathname.startsWith('/audit')
  const isReportActive = location.pathname.startsWith('/report')
  const isBenchmarkActive = location.pathname.startsWith('/benchmark')

  const handleLoadSampleClick = async () => {
    setLoadingSample(true)
    try {
      await loadSample()
      navigate('/audit/result')
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingSample(false)
    }
  }

  return (
    <header className="navbar">
      <div className="navbar__left">
        <Link to="/audit" className="navbar__brand">
          <span className="navbar__logo-glyph" aria-hidden="true">
            <svg width="24" height="15" viewBox="0 0 24 16" fill="none">
              <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="16" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </span>
          <span className="navbar__wordmark font-serif">Second Opinion</span>
          <span className="navbar__version-chip mono-chip">AUDITOR v1.0</span>
        </Link>
      </div>

      <nav className={`navbar__centre ${mobileMenuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
        <Link
          to="/audit"
          className={`nav-link ${isAuditActive ? 'is-active' : ''}`}
          onClick={() => setMobileMenuOpen(false)}
        >
          Audit
        </Link>
        <Link
          to="/report"
          className={`nav-link ${isReportActive ? 'is-active' : ''}`}
          onClick={() => setMobileMenuOpen(false)}
        >
          Report
        </Link>
        <Link
          to="/benchmark"
          className={`nav-link ${isBenchmarkActive ? 'is-active' : ''}`}
          onClick={() => setMobileMenuOpen(false)}
        >
          Benchmark
        </Link>
      </nav>

      <div className="navbar__right">
        <button
          type="button"
          className="btn-ghost btn-load-sample"
          onClick={handleLoadSampleClick}
          disabled={loadingSample}
        >
          {loadingSample ? 'Loading...' : 'Load sample'}
        </button>

        <div
          className={`status-chip mono-chip ${backendConnected ? 'is-online' : 'is-offline'}`}
          title={backendConnected ? 'Backend running on port 8000' : 'Backend offline or unreachable'}
        >
          <span className="status-dot" aria-hidden="true" />
          <span>{backendConnected ? 'BACKEND CONNECTED' : 'BACKEND OFFLINE'}</span>
        </div>

        <button
          type="button"
          className="navbar__mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </header>
  )
}
