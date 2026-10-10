import { useState } from 'react'
import AppShell from './AppShell'
import Frame from './Frame'
import VerdictMark from './VerdictMark'
import VerdictBar from './VerdictBar'
import ConfidenceBar from './ConfidenceBar'
import FlagReview from './FlagReview'
import CountUp from './CountUp'
import './DesignShowcase.css'

export default function DesignShowcase() {
  const [selectedClaimId, setSelectedClaimId] = useState('c1')

  const sampleCounts = {
    supported: 2,
    contradicted: 5,
    unsupported: 2,
    ambiguous: 1
  }

  const sampleAssessment =
    '10 claims checked: 2 supported, 5 contradicted, 2 insufficient evidence, 1 ambiguous. 1 needs review. 2 reasoning issue(s) found.'

  return (
    <AppShell
      docName="fr-crce-info.pdf"
      counts={sampleCounts}
      needsReview={1}
      activeTab="design"
    >
      <div className="design-showcase">
        {/* Banner */}
        <div className="design-showcase__hero">
          <div className="hero-text-block">
            <span className="mono-label">DESIGN FOUNDATION SYSTEM &bull; SPECIFICATION 01</span>
            <h1 className="hero-title">AUDIT ANOTHER AI.</h1>
            <p className="hero-description">
              Technical proofreader console aesthetic. Blueprint line-art, 1px precision frames, self-hosted Space Grotesk and JetBrains Mono typography, multi-dimensional verdict encoding.
            </p>
          </div>
          <div className="hero-meta">
            <div className="meta-row">
              <span className="mono-label">PALETTE:</span>
              <span className="mono-number">Black &amp; Grey (Single Token Accent)</span>
            </div>
            <div className="meta-row">
              <span className="mono-label">CONTRAST:</span>
              <span className="mono-number">&gt;= 4.5:1 WCAG AA Compliant</span>
            </div>
            <div className="meta-row">
              <span className="mono-label">TYPE:</span>
              <span className="mono-number">Space Grotesk + JetBrains Mono</span>
            </div>
          </div>
        </div>

        {/* Section 1: VerdictBar (Stacked Hatches & Counts) */}
        <section className="showcase-section">
          <Frame microLabel="01 / SUMMARY OVERVIEW" title="CLAIMS BY VERDICT (VERDICTBAR)">
            <VerdictBar
              counts={sampleCounts}
              needsReview={1}
              assessment={sampleAssessment}
            />
          </Frame>
        </section>

        {/* Section 2: Verdict Marks Matrix */}
        <section className="showcase-section">
          <Frame microLabel="02 / VERDICT ENCODING MATRIX" title="GLYPH + TEXT + SHAPE ENCODING (NO COLOR ALONE)">
            <div className="verdict-matrix-grid">
              {/* Supported */}
              <div className="matrix-card">
                <div className="matrix-card__top">
                  <VerdictMark verdict="supported" mode="badge" index={1} />
                  <span className="mono-label">THIN SOLID UNDERLINE</span>
                </div>
                <div className="matrix-card__preview">
                  <VerdictMark verdict="supported" mode="inline" index={1}>
                    Fr. Conceicao Rodrigues College of Engineering is an autonomous college.
                  </VerdictMark>
                </div>
              </div>

              {/* Contradicted */}
              <div className="matrix-card">
                <div className="matrix-card__top">
                  <VerdictMark verdict="contradicted" mode="badge" index={2} />
                  <span className="mono-label">INVERTED HIGHLIGHT</span>
                </div>
                <div className="matrix-card__preview">
                  <VerdictMark verdict="contradicted" mode="inline" index={2}>
                    It was established in 1990.
                  </VerdictMark>
                </div>
              </div>

              {/* Unsupported / Insufficient Evidence */}
              <div className="matrix-card">
                <div className="matrix-card__top">
                  <VerdictMark verdict="unsupported" mode="badge" index={7} />
                  <span className="mono-label">DASHED UNDERLINE</span>
                </div>
                <div className="matrix-card__preview">
                  <VerdictMark verdict="unsupported" mode="inline" index={7}>
                    The college is one of the best engineering institutes in India.
                  </VerdictMark>
                </div>
              </div>

              {/* Ambiguous */}
              <div className="matrix-card">
                <div className="matrix-card__top">
                  <VerdictMark verdict="ambiguous" mode="badge" index={6} />
                  <span className="mono-label">WAVY UNDERLINE</span>
                </div>
                <div className="matrix-card__preview">
                  <VerdictMark verdict="ambiguous" mode="inline" index={6}>
                    OBC students pay ₹28,043 at reporting.
                  </VerdictMark>
                </div>
              </div>

              {/* Logic Gap */}
              <div className="matrix-card">
                <div className="matrix-card__top">
                  <VerdictMark verdict="logic_gap" mode="badge" />
                  <span className="mono-label">DOUBLE UNDERLINE + ISSUE</span>
                </div>
                <div className="matrix-card__preview">
                  <VerdictMark verdict="logic_gap" mode="inline">
                    every single student who joins is guaranteed a job
                  </VerdictMark>
                </div>
              </div>

              {/* Unsafe Advice */}
              <div className="matrix-card">
                <div className="matrix-card__top">
                  <VerdictMark verdict="unsafe_advice" mode="badge" />
                  <span className="mono-label">BRACKETS [ ] + ISSUE</span>
                </div>
                <div className="matrix-card__preview">
                  <VerdictMark verdict="unsafe_advice" mode="inline">
                    you can skip paying the fee instalment and pay later without penalty
                  </VerdictMark>
                </div>
              </div>
            </div>
          </Frame>
        </section>

        {/* Section 3: Technical Components Grid */}
        <section className="showcase-section">
          <div className="components-columns">
            {/* Confidence Levels */}
            <Frame microLabel="03 / CONFIDENCE TIERS" title="3-SEGMENT CODE CHECK BARS">
              <div className="showcase-stack">
                <div className="showcase-row">
                  <span className="mono-label">HIGH (3 SEGMENTS):</span>
                  <ConfidenceBar level="high" />
                </div>
                <div className="showcase-row">
                  <span className="mono-label">MEDIUM (2 SEGMENTS):</span>
                  <ConfidenceBar level="medium" />
                </div>
                <div className="showcase-row">
                  <span className="mono-label">LOW (1 SEGMENT):</span>
                  <ConfidenceBar level="low" />
                </div>
              </div>
            </Frame>

            {/* Flags & Numerals */}
            <Frame microLabel="04 / INDICATORS &amp; NUMERALS" title="FLAGS &amp; COUNTUP">
              <div className="showcase-stack">
                <div className="showcase-row">
                  <span className="mono-label">FLAG REVIEW BADGE:</span>
                  <FlagReview active={true} showLabel={true} />
                </div>
                <div className="showcase-row">
                  <span className="mono-label">ANIMATED COUNTER:</span>
                  <span className="mono-title" style={{ fontSize: '1.25rem' }}>
                    <CountUp value={10} prefix="CLAIMS: " />
                  </span>
                </div>
                <div className="showcase-row">
                  <span className="mono-label">PASS DISAGREEMENT:</span>
                  <span className="mono-number" style={{ color: 'var(--text)' }}>
                    Pass 1 (unsupported) != Skeptic (contradicted) &rarr; Flagged
                  </span>
                </div>
              </div>
            </Frame>
          </div>
        </section>

        {/* Section 4: Interactive Manuscript Preview */}
        <section className="showcase-section">
          <Frame microLabel="05 / MANUSCRIPT INTEGRATION" title="TYPESET MARKUP PREVIEW">
            <div className="manuscript-sample">
              <p className="manuscript-text">
                <VerdictMark
                  verdict="supported"
                  mode="inline"
                  index={1}
                  isSelected={selectedClaimId === 'c1'}
                  onClick={() => setSelectedClaimId('c1')}
                >
                  Fr. Conceicao Rodrigues College of Engineering is an autonomous college affiliated to the University of Mumbai.
                </VerdictMark>{' '}
                <VerdictMark
                  verdict="contradicted"
                  mode="inline"
                  index={2}
                  isSelected={selectedClaimId === 'c2'}
                  onClick={() => setSelectedClaimId('c2')}
                >
                  It was established in 1990.
                </VerdictMark>{' '}
                <VerdictMark
                  verdict="contradicted"
                  mode="inline"
                  index={3}
                  isSelected={selectedClaimId === 'c3'}
                  onClick={() => setSelectedClaimId('c3')}
                >
                  The college holds an NAAC &apos;A+&apos; grade.
                </VerdictMark>{' '}
                <VerdictMark
                  verdict="unsupported"
                  mode="inline"
                  index={7}
                  isSelected={selectedClaimId === 'c7'}
                  onClick={() => setSelectedClaimId('c7')}
                >
                  The college is one of the best engineering institutes in India.
                </VerdictMark>{' '}
                <VerdictMark
                  verdict="logic_gap"
                  mode="inline"
                  isSelected={selectedClaimId === 'lg1'}
                  onClick={() => setSelectedClaimId('lg1')}
                >
                  Since almost all eligible students are placed, every single student who joins is guaranteed a job.
                </VerdictMark>
              </p>
              <div className="manuscript-hint mono-label">
                &bull; Click any marked sentence to test interactive selection ring. Current Selection: Claim {selectedClaimId.toUpperCase()}
              </div>
            </div>
          </Frame>
        </section>

        {/* Section 5: Responsive Width Indicators */}
        <section className="showcase-section">
          <Frame microLabel="06 / RESPONSIVE TARGETS" title="VIEWPORT COMPLIANCE CHECK">
            <div className="viewport-check-grid">
              <div className="viewport-card">
                <span className="mono-title">1280px Desktop</span>
                <p className="mono-label" style={{ color: 'var(--text)', marginTop: '0.35rem' }}>
                  Full 3-column architecture (Claim Ledger, 62ch Typeset Manuscript, Evidence Slip Index Card).
                </p>
              </div>
              <div className="viewport-card">
                <span className="mono-title">390px Mobile</span>
                <p className="mono-label" style={{ color: 'var(--text)', marginTop: '0.35rem' }}>
                  Single column cascade. Evidence slip collapses into accessible bottom sheet; horizontal ledger ribbon.
                </p>
              </div>
            </div>
          </Frame>
        </section>
      </div>
    </AppShell>
  )
}
