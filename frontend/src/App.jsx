import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuditProvider } from './context/AuditContext'
import Navbar from './components/Navbar'
import UploadHero from './upload/UploadHero'
import AuditWorkspace from './audit/AuditWorkspace'
import Report from './pages/Report'
import Benchmark from './pages/Benchmark'
import NotFound from './pages/NotFound'
import DesignShowcase from './design/DesignShowcase'

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

  return (
    <AuditProvider>
      <BrowserRouter>
        <div className="app-root">
          <Navbar />
          <Routes>
            <Route path="/" element={<Navigate to="/audit" replace />} />
            <Route path="/audit" element={<UploadHero />} />
            <Route path="/audit/result" element={<AuditWorkspace />} />
            <Route path="/report" element={<Report />} />
            <Route path="/benchmark" element={<Benchmark />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuditProvider>
  )
}