import { Link } from 'react-router-dom'
import './NotFound.css'

export default function NotFound() {
  return (
    <main className="notfound-page">
      <div className="notfound-card">
        <span className="mono-label">404 &bull; PAGE NOT FOUND</span>
        <h1 className="notfound-title font-serif">Quiet blank</h1>
        <p className="notfound-desc">
          The requested audit record or page does not exist in this console.
        </p>
        <Link to="/audit" className="btn-primary notfound-btn">
          Return to New Audit
        </Link>
      </div>
    </main>
  )
}
