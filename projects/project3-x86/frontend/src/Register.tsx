import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './App.css'

export default function Register() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    const asuEmail = /^[^@\s]+@asu\.edu$/i
    if (!asuEmail.test(username)) {
      setError('Username must be an @asu.edu email.')
      return
    }

    if (!password) {
      setError('Password is required.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setError('')
    setSuccess('')

    try {
      setIsSubmitting(true)

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          role: 'student',
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        setError(payload?.error ?? 'Registration failed.')
        return
      }

      setSuccess('Account created successfully. Redirecting to login...')
      window.setTimeout(() => {
        navigate('/login')
      }, 800)
    } catch {
      setError('Could not reach the auth service. Try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand">ASU</div>
        <div className="title">Online Assembly x86 Emulator</div>
      </header>

      <main
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 'calc(100vh - 60px)',
          padding: '2rem',
        }}
      >
        <div
          style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            width: '100%',
            maxWidth: '400px',
          }}
        >
          <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Register</h2>

          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="username" style={{ fontWeight: 600 }}>Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="password" style={{ fontWeight: 600 }}>Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="confirmPassword" style={{ fontWeight: 600 }}>Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={{
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '1rem',
                }}
              />
            </div>

            {error && <div style={{ color: '#ff0000' }}>{error}</div>}
            {success && <div style={{ color: '#147a32' }}>{success}</div>}

            <button
              type="submit"
              className="primary"
              disabled={isSubmitting}
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                fontSize: '1rem',
                fontWeight: 600,
              }}
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#ff0000', fontWeight: 600 }}>
              Login
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
