import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAudit } from '../context/AuditContext'
import { postAudit, getDemo } from '../api'
import './UploadHero.css'

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadHero() {
  const navigate = useNavigate()
  const { setAuditResult } = useAudit()

  const [pdfFile, setPdfFile] = useState(null)
  const [answerText, setAnswerText] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Loading state with elapsed timer and AbortController
  const [isLoading, setIsLoading] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const abortControllerRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!isLoading) return
    const interval = setInterval(() => {
      setElapsedSeconds((sec) => sec + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [isLoading])

  const validateAndSetFile = (file) => {
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Selected file must be a PDF document (.pdf).')
      setPdfFile(null)
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage('File size exceeds the 25 MB limit.')
      setPdfFile(null)
      return
    }

    setPdfFile(file)
    setErrorMessage('')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    validateAndSetFile(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleRemoveFile = () => {
    setPdfFile(null)
    setErrorMessage('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRunAudit = async (e) => {
    e.preventDefault()
    if (!pdfFile || !answerText.trim() || isLoading) return

    setElapsedSeconds(0)
    setIsLoading(true)
    setErrorMessage('')

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const data = await postAudit(pdfFile, answerText, controller.signal)
      setAuditResult(data, 'live', pdfFile.name)
      navigate('/audit/result')
    } catch (err) {
      if (err.name === 'AbortError') {
        setErrorMessage('Audit request was cancelled.')
      } else {
        const msg = err.message || ''
        if (
          msg.includes('Failed to fetch') ||
          msg.includes('NetworkError') ||
          msg.includes('connection')
        ) {
          setErrorMessage(
            `Can't reach the backend at ${API_BASE_URL}. Start it with: uvicorn backend.main:app --port 8000`
          )
        } else if (
          msg.toLowerCase().includes('quota') ||
          msg.toLowerCase().includes('rate limit') ||
          msg.toLowerCase().includes('model is unavailable')
        ) {
          setErrorMessage(
            'The model is unavailable or out of quota. Try again later, or load the sample.'
          )
        } else {
          setErrorMessage(msg || 'An unexpected error occurred during the audit.')
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setIsLoading(false)
  }

  const handleLoadSample = async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      const sample = await getDemo('fr-crce-v2')
      setAuditResult(sample, 'sample', sample?.doc?.name || 'fr-crce-info.pdf')
      navigate('/audit/result')
    } catch {
      setErrorMessage(
        `Can't reach the backend at ${API_BASE_URL}. Start it with: uvicorn backend.main:app --port 8000`
      )
    } finally {
      setIsLoading(false)
    }
  }

  const canRun = Boolean(pdfFile && answerText.trim() && !isLoading)

  return (
    <main className="upload-page">
      <div className="upload-container">
        {/* Header */}
        <header className="upload-header">
          <h1 className="upload-title font-serif">New audit</h1>
          <p className="upload-subtitle">Check an AI answer against a source document.</p>
        </header>

        {/* Loading Progress State */}
        {isLoading && (
          <div className="loading-banner" role="status" aria-live="polite">
            <div className="indeterminate-line" />
            <div className="loading-content">
              <div className="loading-text-group font-mono">
                <span className="loading-primary-text">
                  Auditing claims. Usually 10 to 30 seconds.
                </span>
                <span className="loading-timer">({elapsedSeconds}s elapsed)</span>
                {elapsedSeconds >= 60 && (
                  <span className="loading-rate-limit-text">
                    Still working. The model may be rate-limited.
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn-cancel font-mono"
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Inline Error Notice */}
        {errorMessage && (
          <div className="error-banner font-mono" role="alert">
            <span className="error-icon" aria-hidden="true">✕</span>
            <span className="error-text">{errorMessage}</span>
          </div>
        )}

        {/* Form Body (dimmed during active loading) */}
        <form
          onSubmit={handleRunAudit}
          className={`upload-form ${isLoading ? 'is-loading' : ''}`}
        >
          <div className="upload-grid">
            {/* Left Column: PDF Drop Zone */}
            <div className="upload-col left-col">
              <label className="col-label mono-label" htmlFor="pdf-input">
                SOURCE DOCUMENT (PDF)
              </label>

              {!pdfFile ? (
                <div
                  className={`dropzone ${isDragOver ? 'is-drag-over' : ''}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                  aria-label="Drop source PDF here or click to choose"
                >
                  <input
                    ref={fileInputRef}
                    id="pdf-input"
                    type="file"
                    accept=".pdf,application/pdf"
                    className="visually-hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      validateAndSetFile(file)
                    }}
                  />
                  <div className="dropzone-content">
                    <span className="dropzone-icon font-mono" aria-hidden="true">⇪</span>
                    <p className="dropzone-text">Drop source PDF here or click to choose</p>
                    <span className="dropzone-hint font-mono">PDF ONLY &bull; UP TO 25 MB</span>
                  </div>
                </div>
              ) : (
                <div className="file-chip-card">
                  <div className="file-chip-info">
                    <span className="file-badge font-mono">PDF</span>
                    <div className="file-details">
                      <span className="file-name" title={pdfFile.name}>
                        {pdfFile.name}
                      </span>
                      <span className="file-size font-mono">
                        {formatFileSize(pdfFile.size)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="file-remove-btn"
                    onClick={handleRemoveFile}
                    aria-label={`Remove file ${pdfFile.name}`}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: AI-Generated Answer */}
            <div className="upload-col right-col">
              <div className="col-label-row">
                <label className="col-label mono-label" htmlFor="answer-textarea">
                  AI-GENERATED ANSWER
                </label>
                <span className="char-counter font-mono">
                  {answerText.length} chars
                </span>
              </div>

              <textarea
                id="answer-textarea"
                className="answer-textarea font-serif"
                placeholder="Paste the text generated by the AI here to cross-check every claim against the source PDF..."
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                disabled={isLoading}
                rows={12}
              />
            </div>
          </div>

          {/* Bottom Actions Bar */}
          <div className="upload-actions-bar">
            <div className="action-buttons">
              <button
                type="submit"
                className="btn-primary btn-run-audit font-sans"
                disabled={!canRun}
              >
                Run audit
              </button>
              <button
                type="button"
                className="btn-ghost btn-sample font-sans"
                onClick={handleLoadSample}
                disabled={isLoading}
              >
                Load sample
              </button>
            </div>
            <p className="document-guarantee-note font-mono">
              Checks only against the document you provide.
            </p>
          </div>
        </form>
      </div>
    </main>
  )
}
