import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signupUser } from '../api.js'
import { saveCurrentUser } from '../authSession.js'
import AuthShowcase from '../components/AuthShowcase.jsx'

export default function Signup() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')

  function handleChange(event) {
    const { name, value } = event.target
    setError('')
    setFormData((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      setError('Password and confirm password must match.')
      return
    }

    try {
      const data = await signupUser({
        firstName: formData.firstName,
        lastName: formData.lastName,
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

        <div className="auth-panel signup-panel">
          <div className="auth-mobile-brand app-brand">
            <span className="brand-mark">M</span>
            <span>MarketFlow</span>
          </div>
          <div className="auth-intro">
            <p className="eyebrow">Start building today</p>
            <h1>Create your <span>workspace</span></h1>
            <p>Set up your MarketFlow account and launch your first campaign.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-row">
              <label>
                First name
                <input
                  name="firstName"
                  type="text"
                  placeholder="First name"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Last name
                <input
                  name="lastName"
                  type="text"
                  placeholder="Last name"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
              </label>
            </div>

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
                placeholder="Create a password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Confirm password
              <input
                name="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </label>

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="primary-button auth-submit">
              Create my account <span aria-hidden="true">→</span>
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  )
}
