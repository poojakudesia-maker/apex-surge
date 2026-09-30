import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import '../styles/dashboard.css'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>RunFlowTest</h1>
        <div className="user-menu">
          <span>{user?.email}</span>
          <button onClick={handleLogout} className="btn-logout">Log Out</button>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="hero">
          <h2>Welcome to RunFlowTest</h2>
          <p>Test user flows with synthetic personas before running real usability tests</p>
        </div>

        <div className="cta-section">
          <button onClick={() => navigate('/app/wizard')} className="btn-primary btn-large">
            Start New Test
          </button>
        </div>

        <section className="info-grid">
          <div className="info-card">
            <h3>🎭 Synthetic Personas</h3>
            <p>Test with pre-built or custom user personas</p>
          </div>
          <div className="info-card">
            <h3>🔄 Run Simulations</h3>
            <p>Simulate how different users navigate your flows</p>
          </div>
          <div className="info-card">
            <h3>📊 Get Insights</h3>
            <p>Identify friction points and mental model mismatches</p>
          </div>
          <div className="info-card">
            <h3>⬇️ Download Reports</h3>
            <p>Export findings and test protocols for real user testing</p>
          </div>
        </section>

        <section className="disclaimer">
          <p>✓ Your data will be securely deleted after 20 hours</p>
          <p>✓ No data is stored permanently on our servers</p>
          <p>✓ Email verification ensures account security</p>
        </section>
      </main>
    </div>
  )
}
