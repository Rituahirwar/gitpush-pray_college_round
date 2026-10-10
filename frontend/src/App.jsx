import { useEffect, useState } from 'react'
import AuditWorkspace from './audit/AuditWorkspace'
import DesignShowcase from './design/DesignShowcase'
import './design/tokens.css'

export default function App() {
  const [isDesignPage, setIsDesignPage] = useState(
    typeof window !== 'undefined' && window.location.hash === '#design'
  )

  useEffect(() => {
    const handleHashChange = () => {
      setIsDesignPage(window.location.hash === '#design')
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  if (isDesignPage) {
    return <DesignShowcase />
  }

  return <AuditWorkspace />
}