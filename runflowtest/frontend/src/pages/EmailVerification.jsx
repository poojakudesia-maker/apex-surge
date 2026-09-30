import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import '../styles/auth.css'

export default function EmailVerification() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { verifyEmail } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || ''

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await verifyEmail(email, code)
      navigate('/login', { state: { emailVerified: true } })
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Verify Email</h1>
        <p className="subtitle">Enter the 6-digit code sent to {email}</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Verification Code</label>
            <input
              type="text"
              maxLength="6"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              required
              placeholder="000000"
              className="code-input"
            />
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      </div>
    </div>
  )
}
