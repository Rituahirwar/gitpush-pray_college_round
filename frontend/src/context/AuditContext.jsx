import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const AuditContext = createContext(null)

export function AuditProvider({ children }) {
  const [result, setResult] = useState(() => {
    try {
      const saved = sessionStorage.getItem('so.result')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [source, setSource] = useState(() => {
    try {
      return sessionStorage.getItem('so.source') || 'sample'
    } catch {
      return 'sample'
    }
  })

  const [pdfName, setPdfName] = useState(() => {
    try {
      return sessionStorage.getItem('so.pdfName') || ''
    } catch {
      return ''
    }
  })

  const [backendConnected, setBackendConnected] = useState(false)

  // Persist state to sessionStorage
  useEffect(() => {
    try {
      if (result) {
        sessionStorage.setItem('so.result', JSON.stringify(result))
        sessionStorage.setItem('so.source', source)
        sessionStorage.setItem('so.pdfName', pdfName)
      } else {
        sessionStorage.removeItem('so.result')
        sessionStorage.removeItem('so.source')
        sessionStorage.removeItem('so.pdfName')
      }
    } catch {
      // Ignore sessionStorage errors
    }
  }, [result, source, pdfName])

  // Poll /api/health every 15 seconds
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`, { method: 'GET' })
      if (res.ok) {
        const data = await res.json()
        setBackendConnected(Boolean(data?.ok))
        return
      }
    } catch {
      // Offline
    }
    setBackendConnected(false)
  }, [])

  useEffect(() => {
    checkHealth()
    const timer = setInterval(checkHealth, 15000)
    return () => clearInterval(timer)
  }, [checkHealth])

  const setAuditResult = useCallback((auditData, auditSource = 'live', name = '') => {
    setResult(auditData)
    setSource(auditSource)
    setPdfName(name || auditData?.doc?.name || 'document.pdf')
  }, [])

  // Load sample function (GET /api/demo/fr-crce-v2 with static fallbacks)
  const loadSample = useCallback(async () => {
    let auditData = null
    try {
      const res = await fetch(`${API_BASE_URL}/api/demo/fr-crce-v2`)
      if (res.ok) {
        auditData = await res.json()
      }
    } catch {
      // Proceed to fallbacks
    }

    if (!auditData) {
      try {
        const res = await fetch('/fr-crce-final.json')
        if (res.ok) auditData = await res.json()
      } catch {
        // Next fallback
      }
    }

    if (!auditData) {
      try {
        const res = await fetch('/mock-audit.json')
        if (res.ok) auditData = await res.json()
      } catch {
        // None
      }
    }

    if (auditData) {
      setAuditResult(auditData, 'sample', auditData?.doc?.name || 'fr-crce-info.pdf')
      return auditData
    }
    throw new Error('Could not load sample audit.')
  }, [setAuditResult])

  const clearAudit = useCallback(() => {
    setResult(null)
    setPdfName('')
    setSource('live')
  }, [])

  const value = {
    result,
    source,
    pdfName,
    backendConnected,
    apiBaseUrl: API_BASE_URL,
    setAuditResult,
    loadSample,
    clearAudit,
    checkHealth
  }

  return (
    <AuditContext.Provider value={value}>
      {children}
    </AuditContext.Provider>
  )
}

export function useAudit() {
  const context = useContext(AuditContext)
  if (!context) {
    throw new Error('useAudit must be used within an AuditProvider')
  }
  return context
}
