import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { saveCurrentUser } from '../authSession.js'

export default function Signup() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')

  function handleChange(event) {
    const { name, value } = event.target
    setError('')
    setFormData((current) => ({ ...current, [name]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      setError('Password and confirm password must match.')
      return
    }

    const firstName = formData.firstName.trim()
    const lastName = formData.lastName.trim()

    saveCurrentUser({
      name: `${firstName} ${lastName}`.trim(),
    })
    navigate('/home')
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-intro">
          <p className="eyebrow">Start here</p>
          <h1>Sign Up</h1>
          <p>Create your account to begin building fullscreen marketing displays.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-row">
            <label>
              First Name
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
              Last Name
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
            Password
            <input
              name="password"
              type="password"
              placeholder="Create password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Confirm Password
            <input
              name="confirmPassword"
              type="password"
              placeholder="Confirm password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="primary-button auth-submit">
            Sign Up
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </section>
    </main>
  )
}
