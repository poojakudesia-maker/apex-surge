import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import EmailVerification from './pages/EmailVerification'
import Dashboard from './pages/Dashboard'
import Wizard from './pages/Wizard'
import Report from './pages/Report'
import { AuthProvider, useAuth } from './hooks/useAuth'

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth()

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify" element={<EmailVerification />} />

          {/* Protected routes */}
          <Route path="/app/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="/app/wizard" element={
            <ProtectedRoute>
              <Wizard />
            </ProtectedRoute>
          } />

          <Route path="/app/report/:projectId" element={
            <ProtectedRoute>
              <Report />
            </ProtectedRoute>
          } />

          {/* Redirect root to dashboard if logged in, login otherwise */}
          <Route path="/" element={<Navigate to="/app/dashboard" replace />} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}
