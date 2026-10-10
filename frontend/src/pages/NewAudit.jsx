import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAudit } from '../context/AuditContext'
import './NewAudit.css'

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB

export default function NewAudit() {
  const navigate = useNavigate()
  const { setAuditResult, loadSample, apiBaseUrl } = useAudit()

  const [pdfFile, setPdfFile] = useState(null)
  const [pdfPageCount, setPdfPageCount] = useState(null)
  const [answerText, setAnswerText] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Loading state with elapsed time & AbortController
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

  const handleFileSelect = (file) => {
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
    setPdfPageCount(null)
    setErrorMessage('')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    handleFileSelect(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
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
      const formData = new FormData()
      formData.append('pdf', pdfFile)
      formData.append('answer', answerText)

      const response = await fetch(`${apiBaseUrl}/api/audit`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      })

      if (!response.ok) {
        let detail = ''
        try {
          const errJson = await response.json()
          detail = errJson?.detail || ''
        } catch {
          // Response was not JSON
        }

        if (response.status === 400) {
          throw new Error(detail || 'Bad request. Check that the PDF contains text and the answer is valid.')
        }

        if (response.status >= 500 || detail.toLowerCase().includes('quota') || detail.toLowerCase().includes('429')) {
          throw new Error('The model is unavailable or out of quota. Try again later, or load the sample.')
        }

        throw new Error(detail || `Audit failed with status ${response.status}.`)
      }

      const result = await response.json()
      setAuditResult(result, 'live', pdfFile.name)
      navigate('/audit/result')
    } catch (err) {
      if (err.name === 'AbortError') {
        setErrorMessage('Audit request was cancelled.')
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setErrorMessage(`Can't reach the backend at ${apiBaseUrl}. Start it with: uvicorn backend.main:app --port 8000`)
      } else {
        setErrorMessage(err.message || 'An error occurred during audit.')
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const handleLoadSample = async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      await loadSample()
      navigate('/audit/result')
    } catch (err) {
      setErrorMessage(err.message || 'Could not load the sample run.')
    } finally {
      setIsLoading(false)
    }
  }

  const canRunAudit = Boolean(pdfFile && answerText.trim() && !isLoading)

  return (
    <div className="new-audit-container">
      {/* Title & Subtitle */}
      <div className="new-audit-header">
        <h1 className="new-audit-title font-serif">New audit</h1>
        <p className="new-audit-subtitle">Check an AI answer against a source document.</p>
      </div>

      {/* Two-Column Form */}
      <form onSubmit={handleRunAudit} className={`audit-form ${isLoading ? 'is-loading' : ''}`}>
        <div className="audit-form-grid">
          {/* Left Column: Source Document */}
          <div className="audit-panel">
            <div className="panel-header">
              <span className="mono-label">SOURCE DOCUMENT</span>
            </div>

            <div className="panel-body">
              <div
                className={`pdf-dropzone ${isDragOver ? 'is-dragover' : ''} ${pdfFile ? 'has-file' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Drop source PDF here or click to choose"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,application/pdf"
                  className="hidden-file-input"
                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
                />

                <div className="dropzone-inner">
                  <div className="pdf-icon-box" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <span className="dropzone-text">Drop source PDF here or click to choose</span>
                  <span className="mono-label dropzone-hint">PDF up to 25 MB</span>
                </div>
              </div>

              {/* Chosen File Chip */}
              {pdfFile && (
                <div className="file-chip">
                  <span className="font-mono file-chip-name">
                    {pdfFile.name}{pdfPageCount ? `, ${pdfPageCount} pages` : ` (${(pdfFile.size / 1024).toFixed(0)} KB)`}
                  </span>
                  <button
                    type="button"
                    className="file-chip-remove"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPdfFile(null)
                    }}
                    aria-label="Remove chosen file"
                  >
                    &times;
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: AI-Generated Answer */}
          <div className="audit-panel">
            <div className="panel-header">
              <span className="mono-label">AI-GENERATED ANSWER</span>
            </div>

            <div className="panel-body">
              <textarea
                className="answer-textarea"
                value={answerText}
                onChange={(e) => {
                  setAnswerText(e.target.value)
                  setErrorMessage('')
                }}
                placeholder="Paste the AI-generated answer here to audit every claim against the source document..."
                rows={12}
                disabled={isLoading}
                aria-label="AI-generated answer"
              />

              <div className="textarea-footer">
                <span className="mono-label">{answerText.length} characters</span>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Overlay / Progress Line */}
        {isLoading && (
          <div className="loading-container" role="status" aria-live="polite">
            <div className="loading-progress-line" />
            <div className="loading-info-row">
              <span className="loading-message font-mono">
                Auditing claims. Usually 10 to 30 seconds. ({elapsedSeconds}s elapsed)
              </span>
              <button
                type="button"
                className="btn-ghost btn-cancel font-mono"
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
            {elapsedSeconds >= 60 && (
              <span className="loading-warning font-mono">
                Still working. The model may be rate-limited.
              </span>
            )}
          </div>
        )}

        {/* Inline Error Message */}
        {errorMessage && (
          <div className="error-box" role="alert">
            <span className="error-mark">&times;</span>
            <span className="error-message font-mono">{errorMessage}</span>
          </div>
        )}

        {/* Action Controls & Note */}
        <div className="audit-form-bottom">
          <div className="bottom-note mono-label">
            Checks only against the document you provide.
          </div>

          <div className="bottom-buttons">
            <button
              type="button"
              className="btn-ghost"
              onClick={handleLoadSample}
              disabled={isLoading}
            >
              Load sample
            </button>
            <button
              type="submit"
              className="btn-primary btn-run-audit"
              disabled={!canRunAudit}
            >
              Run audit
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
