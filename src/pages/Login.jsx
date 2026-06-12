import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginUser } from '../api.js'
import { saveCurrentUser } from '../authSession.js'
import AuthShowcase from '../components/AuthShowcase.jsx'

export default function Login() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [error, setError] = useState('')

  function handleChange(event) {
    const { name, value } = event.target
    setError('')
    setFormData((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    try {
      const data = await loginUser({
        email: formData.email,
        password: formData.password,
      })

      saveCurrentUser(data.user)
      navigate('/home')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <main className="auth-shell signup-shell">
      <section className="auth-layout signup-layout">
        <AuthShowcase />

        <div className="auth-panel signup-panel login-panel">
          <div className="auth-mobile-brand app-brand">
            <span className="brand-mark">M</span>
            <span>MarketFlow</span>
          </div>
          <div className="auth-intro">
            <p className="eyebrow">Welcome back</p>
            <h1>Sign in to your <span>workspace</span></h1>
            <p>Manage playlists and launch your next promotion.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              Email address
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Password
              <input
                name="password"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </label>

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="primary-button auth-submit">
              Sign in <span aria-hidden="true">→</span>
            </button>
          </form>

          <p className="auth-switch">
            New to MarketFlow? <Link to="/signup">Create an account</Link>
          </p>
        </div>
      </section>
    </main>
  )
}
