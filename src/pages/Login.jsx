import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginUser } from '../api.js'
import { saveCurrentUser } from '../authSession.js'

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

          {error && <p className="auth-error">{error}</p>}

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
