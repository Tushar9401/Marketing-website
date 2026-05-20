import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { saveCurrentUser } from '../authSession.js'

export default function Login() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  function handleChange(event) {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const email = formData.email.trim()
    const fallbackName = email.split('@')[0] || 'User'

    saveCurrentUser({
      name: fallbackName,
      email,
    })
    navigate('/home')
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-intro">
          <p className="eyebrow">Welcome back</p>
          <h1>Login</h1>
          <p>Sign in to manage your marketing media playlist.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
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
              placeholder="Enter password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </label>

          <button type="submit" className="primary-button auth-submit">
            Login
          </button>
        </form>

        <p className="auth-switch">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </section>
    </main>
  )
}
