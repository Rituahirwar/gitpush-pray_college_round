const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function getHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`)
    if (res.ok) {
      const data = await res.json()
      return data?.ok === true
    }
    return false
  } catch {
    return false
  }
}

export async function getDemo(id = 'fr-crce-v2') {
  // 1. Try backend endpoint
  try {
    const res = await fetch(`${API_BASE_URL}/api/demo/${id}`)
    if (res.ok) {
      return await res.json()
    }
  } catch {
    // Proceed to fallbacks
  }

  // 2. Try static public cache
  try {
    const res = await fetch('/fr-crce-final.json')
    if (res.ok) {
      return await res.json()
    }
  } catch {
    // Fallback 3
  }

  try {
    const res = await fetch('/mock-audit.json')
    if (res.ok) {
      return await res.json()
    }
  } catch {
    // None
  }

  throw new Error('Unable to load demo audit.')
}

export async function postAudit(file, answer, signal) {
  const formData = new FormData()
  formData.append('pdf', file)
  formData.append('answer', answer)

  const res = await fetch(`${API_BASE_URL}/api/audit`, {
    method: 'POST',
    body: formData,
    signal,
  })

  if (!res.ok) {
    let detail = ''
    try {
      const err = await res.json()
      detail = err?.detail || ''
    } catch {
      // Non-JSON error
    }

    if (res.status === 400) {
      throw new Error(detail || 'Invalid input or unreadable PDF document.')
    }
    if (res.status >= 500) {
      throw new Error(detail || 'The model is unavailable or out of quota. Try again later, or load the sample.')
    }
    throw new Error(detail || `Audit request failed with status ${res.status}`)
  }

  return await res.json()
}

export async function getBenchmark() {
  // 1. Try backend
  try {
    const res = await fetch(`${API_BASE_URL}/api/benchmark`)
    if (res.ok) {
      const json = await res.json()
      if (json && Object.keys(json).length > 0) {
        return json
      }
    }
  } catch {
    // Try static fallback
  }

  // 2. Static public fallback
  try {
    const res = await fetch('/benchmark-results.json')
    if (res.ok) {
      const json = await res.json()
      if (json && Object.keys(json).length > 0) {
        return json
      }
    }
  } catch {
    // Fallback failed
  }

  return {}
}
