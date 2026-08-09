import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import './App.css'

/* ============================================================
   Ultra-Modern Chemical Inventory Login
   Full-featured · Glassmorphism · Micro-interactions · A11y
   ============================================================ */

function Login({ onLogin }) {
  // -------------------- State --------------------
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [formTouched, setFormTouched] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [cardVisible, setCardVisible] = useState(false)

  const emailRef = useRef(null)
  const passwordRef = useRef(null)
  const formRef = useRef(null)

  // -------------------- Effects --------------------
  useEffect(() => {
    setMounted(true)
    const timer = setTimeout(() => setCardVisible(true), 80)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Clear messages when switching modes
    setError(null)
    setMessage(null)
  }, [isLogin])

  // -------------------- Helpers --------------------
  const isEmailValid = useCallback((value) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  }, [])

  const isPasswordValid = useCallback((value) => {
    return value.length >= 6
  }, [])

  const canSubmit =
    isEmailValid(email) &&
    isPasswordValid(password) &&
    !loading

  const emailHasError = formTouched && email.length > 0 && !isEmailValid(email)
  const passwordHasError = formTouched && password.length > 0 && !isPasswordValid(password)

  // -------------------- Submit Handler --------------------
  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormTouched(true)

    if (!canSubmit) {
      setError('Please enter a valid email and a password of at least 6 characters.')
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (isLogin) {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (authError) throw authError
        onLogin(data.session)
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })
        if (authError) throw authError
        setMessage('Account created successfully. You can now sign in.')
        setIsLogin(true)
        setPassword('')
      }
    } catch (err) {
      const msg = err?.message || 'Something went wrong. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // -------------------- Mode Switch --------------------
  const switchMode = (toLogin) => {
    setIsLogin(toLogin)
    setError(null)
    setMessage(null)
    setFormTouched(false)
  }

  // -------------------- Render --------------------
  return (
    <div className={`auth-root ${mounted ? 'auth-root--mounted' : ''}`}>
      {/* Background layers */}
      <div className="auth-bg" aria-hidden="true" />
      <div className="auth-bg-overlay" aria-hidden="true" />
      <div className="auth-bg-grid" aria-hidden="true" />
      <div className="auth-bg-glow auth-bg-glow--1" aria-hidden="true" />
      <div className="auth-bg-glow auth-bg-glow--2" aria-hidden="true" />

      {/* Main card */}
      <div
        className={`auth-card ${cardVisible ? 'auth-card--visible' : ''}`}
        role="main"
      >
        {/* Brand header */}
        <header className="auth-header">
          <div className="auth-logo-wrap">
            <div className="auth-logo">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 3h6v2H9z" />
                <path d="M10 5v3.15a2 2 0 0 1-.4 1.2L6.2 15.4A3.4 3.4 0 0 0 9.1 21h5.8a3.4 3.4 0 0 0 2.9-5.6l-3.4-6.05a2 2 0 0 1-.4-1.2V5" />
                <circle cx="12" cy="17" r="1.1" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div className="auth-logo-ring" />
          </div>

          <h1 className="auth-title">Chemical Inventory</h1>
          <p className="auth-subtitle">
            {isLogin
              ? 'Sign in to manage your laboratory inventory'
              : 'Create an account to get started'}
          </p>
        </header>

        {/* Mode tabs */}
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={isLogin}
            className={`auth-tab ${isLogin ? 'auth-tab--active' : ''}`}
            onClick={() => switchMode(true)}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isLogin}
            className={`auth-tab ${!isLogin ? 'auth-tab--active' : ''}`}
            onClick={() => switchMode(false)}
          >
            Create Account
          </button>
          <div
            className="auth-tab-indicator"
            style={{ transform: isLogin ? 'translateX(0%)' : 'translateX(100%)' }}
          />
        </div>

        {/* Form */}
        <form
          ref={formRef}
          className="auth-form"
          onSubmit={handleSubmit}
          noValidate
        >
          {/* Email field */}
          <div
            className={`auth-field ${
              emailFocused || email ? 'auth-field--active' : ''
            } ${emailHasError ? 'auth-field--error' : ''}`}
          >
            <label htmlFor="auth-email" className="auth-label">
              Email address
            </label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
              </span>
              <input
                ref={emailRef}
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                placeholder=" "
                required
                disabled={loading}
                aria-invalid={emailHasError}
                aria-describedby={emailHasError ? 'email-error' : undefined}
              />
            </div>
            {emailHasError && (
              <p id="email-error" className="auth-field-hint auth-field-hint--error">
                Enter a valid email address
              </p>
            )}
          </div>

          {/* Password field */}
          <div
            className={`auth-field ${
              passwordFocused || password ? 'auth-field--active' : ''
            } ${passwordHasError ? 'auth-field--error' : ''}`}
          >
            <label htmlFor="auth-password" className="auth-label">
              Password
            </label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </span>
              <input
                ref={passwordRef}
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder=" "
                required
                minLength={6}
                disabled={loading}
                aria-invalid={passwordHasError}
                aria-describedby={passwordHasError ? 'password-error' : undefined}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {passwordHasError && (
              <p id="password-error" className="auth-field-hint auth-field-hint--error">
                Password must be at least 6 characters
              </p>
            )}
          </div>

          {/* Options row */}
          <div className="auth-options">
            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
              />
              <span className="auth-checkbox-box" />
              <span className="auth-checkbox-label">Remember me</span>
            </label>

            {isLogin && (
              <button
                type="button"
                className="auth-forgot"
                onClick={() => {
                  // Placeholder – wire to your forgot-password flow
                  setMessage('Password reset link would be sent here.')
                }}
              >
                Forgot password?
              </button>
            )}
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="auth-alert auth-alert--error" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="auth-alert auth-alert--success" role="status">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{message}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className={`auth-submit ${loading ? 'auth-submit--loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="auth-spinner" aria-hidden="true" />
                <span>Please wait…</span>
              </>
            ) : (
              <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <footer className="auth-footer">
          <p>
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              className="auth-footer-link"
              onClick={() => switchMode(!isLogin)}
            >
              {isLogin ? 'Create one' : 'Sign in'}
            </button>
          </p>
          <p className="auth-footer-note">
            Secure access for laboratory chemical inventory management
          </p>
        </footer>
      </div>

      {/* Decorative corner marks */}
      <div className="auth-corner auth-corner--tl" aria-hidden="true" />
      <div className="auth-corner auth-corner--tr" aria-hidden="true" />
      <div className="auth-corner auth-corner--bl" aria-hidden="true" />
      <div className="auth-corner auth-corner--br" aria-hidden="true" />
    </div>
  )
}

export default Login