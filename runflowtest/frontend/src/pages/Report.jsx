import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '../styles/report.css'

export default function Report() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [downloading, setDownloading] = useState(false)

  function handleDownload(format) {
    setDownloading(true)
    // TODO: Call API to generate and download report
    setTimeout(() => setDownloading(false), 2000)
  }

  return (
    <div className="report">
      <header className="report-header">
        <button onClick={() => navigate('/app/dashboard')} className="btn-back">← Dashboard</button>
        <h1>Simulation Report</h1>
      </header>

      <main className="report-content">
        <section className="report-metrics">
          <div className="metric">
            <h3>Completion Rate</h3>
            <p className="large-number">100%</p>
            <span>3 of 3 runs completed</span>
          </div>
          <div className="metric">
            <h3>Worst Step</h3>
            <p className="large-number">Payment</p>
            <span>Peak cognitive load: 9/10</span>
          </div>
          <div className="metric">
            <h3>Issues Found</h3>
            <p className="large-number">2</p>
            <span>1 critical issue</span>
          </div>
        </section>

        <section className="report-findings">
          <h2>Key Findings</h2>
          <div className="finding">
            <h4>Card requested during "free" consult</h4>
            <p>Persona didn't understand why payment was needed and lost trust. Recommended: Add explanation or let consultations skip payment step.</p>
            <span className="severity critical">Critical</span>
          </div>
        </section>

        <section className="report-protocol">
          <h2>Test Protocol</h2>
          <p>Use this for real user testing:</p>
          <div className="protocol-content">
            <h4>Task 1</h4>
            <p>"You want to see a doctor this week. Book an appointment on your phone."</p>
            <p><strong>Success:</strong> Reaches confirmation | <strong>Limit:</strong> 5 min</p>
          </div>
        </section>

        <div className="download-section">
          <h3>Download Report</h3>
          <div className="download-buttons">
            <button onClick={() => handleDownload('json')} disabled={downloading} className="btn-secondary">
              {downloading ? 'Preparing...' : '📥 JSON'}
            </button>
            <button onClick={() => handleDownload('pdf')} disabled={downloading} className="btn-secondary">
              {downloading ? 'Preparing...' : '📥 PDF'}
            </button>
          </div>
        </div>

        <button onClick={() => navigate('/app/wizard')} className="btn-primary">
          Start Another Test
        </button>
      </main>
    </div>
  )
}
