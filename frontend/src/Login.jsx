import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import './App.css'

/* ============================================================
   Ultra-Modern Login Component
   Chemical Inventory Application
   Full Name + Email + Password + Confirm Password
   Email Confirmation Flow + Advanced Validation
   Glassmorphism + Matching Landing Page Aesthetic
   ============================================================ */

function Login({ onLogin }) {
  // ============================================================
  // STATE MANAGEMENT
  // ============================================================
  const [isLogin, setIsLogin] = useState(true)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [formTouched, setFormTouched] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [cardVisible, setCardVisible] = useState(false)

  // Focus tracking for active field styles
  const [fullNameFocused, setFullNameFocused] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [confirmFocused, setConfirmFocused] = useState(false)

  // Refs
  const formRef = useRef(null)
  const fullNameRef = useRef(null)
  const emailRef = useRef(null)
  const passwordRef = useRef(null)
  const confirmRef = useRef(null)

  // ============================================================
  // EFFECTS
  // ============================================================
  useEffect(() => {
    setMounted(true)
    const timer = setTimeout(() => {
      setCardVisible(true)
    }, 80)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Reset feedback when switching modes
    setError(null)
    setMessage(null)
    setFormTouched(false)
  }, [isLogin])

  // ============================================================
  // VALIDATION HELPERS
  // ============================================================
  const isEmailValid = useCallback((value) => {
    if (!value) return false
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  }, [])

  const isPasswordValid = useCallback((value) => {
    return value.length >= 6
  }, [])

  const isNameValid = useCallback((value) => {
    return value.trim().length >= 2
  }, [])

  const doPasswordsMatch = password === confirmPassword && confirmPassword.length > 0

  // Submit readiness
  const canSubmitLogin =
    isEmailValid(email) &&
    isPasswordValid(password) &&
    !loading

  const canSubmitSignup =
    isNameValid(fullName) &&
    isEmailValid(email) &&
    isPasswordValid(password) &&
    doPasswordsMatch &&
    !loading

  // Field-level error flags
  const nameHasError = formTouched && !isLogin && fullName.length > 0 && !isNameValid(fullName)
  const emailHasError = formTouched && email.length > 0 && !isEmailValid(email)
  const passwordHasError = formTouched && password.length > 0 && !isPasswordValid(password)
  const confirmHasError = formTouched && !isLogin && confirmPassword.length > 0 && !doPasswordsMatch

  // ============================================================
  // SUBMIT HANDLER
  // ============================================================
  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormTouched(true)
    setError(null)
    setMessage(null)

    // Client-side validation gate
    if (isLogin) {
      if (!canSubmitLogin) {
        setError('Please enter a valid email and a password of at least 6 characters.')
        return
      }
    } else {
      if (!canSubmitSignup) {
        if (!isNameValid(fullName)) {
          setError('Please enter your full name (at least 2 characters).')
        } else if (!isEmailValid(email)) {
          setError('Please enter a valid email address.')
        } else if (!isPasswordValid(password)) {
          setError('Password must be at least 6 characters long.')
        } else if (!doPasswordsMatch) {
          setError('Passwords do not match.')
        } else {
          setError('Please fill in all fields correctly.')
        }
        return
      }
    }

    setLoading(true)

    try {
      if (isLogin) {
        // -------------------- LOGIN --------------------
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (authError) {
          throw authError
        }

        if (data?.session) {
          onLogin(data.session)
        } else {
          setError('Unable to create session. Please try again.')
        }
      } else {
        // -------------------- SIGN UP --------------------
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
            emailRedirectTo: window.location.origin,
          },
        })

        if (authError) {
          throw authError
        }

        // Supabase returns a user object even when email confirmation is required.
        // Session will be null until the user clicks the confirmation link.
        if (data?.user && !data.session) {
          setMessage(
            'Account created successfully! Please check your email and click the confirmation link before signing in.'
          )

          // Clear sensitive fields and switch to login after a short delay
          setTimeout(() => {
            setIsLogin(true)
            setPassword('')
            setConfirmPassword('')
            setFullName('')
            setFormTouched(false)
          }, 4800)
        } else if (data?.session) {
          // Email confirmation is disabled in the Supabase project settings
          onLogin(data.session)
        } else {
          setError('Unexpected response from authentication service.')
        }
      }
    } catch (err) {
      const errorMessage =
        err?.message ||
        err?.error_description ||
        'Something went wrong. Please try again.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================
  // MODE SWITCH HELPER
  // ============================================================
  const switchMode = (toLogin) => {
    setIsLogin(toLogin)
    setError(null)
    setMessage(null)
    setFormTouched(false)
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className={`auth-root ${mounted ? 'auth-root--mounted' : ''}`}>
      {/* ========================================================
          BACKGROUND LAYERS
          ======================================================== */}
      <div className="auth-bg" aria-hidden="true" />
      <div className="auth-bg-gradient" aria-hidden="true" />
      <div className="auth-bg-grid" aria-hidden="true" />
      <div className="auth-glow auth-glow--1" aria-hidden="true" />
      <div className="auth-glow auth-glow--2" aria-hidden="true" />
      <div className="auth-glow auth-glow--3" aria-hidden="true" />

      {/* Decorative corner accents */}
      <div className="auth-corner auth-corner--tl" aria-hidden="true" />
      <div className="auth-corner auth-corner--tr" aria-hidden="true" />
      <div className="auth-corner auth-corner--bl" aria-hidden="true" />
      <div className="auth-corner auth-corner--br" aria-hidden="true" />

      {/* ========================================================
          MAIN CARD
          ======================================================== */}
      <div
        className={`auth-card ${cardVisible ? 'auth-card--visible' : ''}`}
        role="main"
      >
        {/* -------------------- Header -------------------- */}
        <header className="auth-header">
          <div className="auth-logo-wrap">
            <div className="auth-logo">
              <svg
                width="28"
                height="28"
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
                <circle cx="12" cy="17" r="1.15" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div className="auth-logo-ring" aria-hidden="true" />
          </div>

          <h1 className="auth-title">Chemical Inventory</h1>
          <p className="auth-subtitle">
            {isLogin
              ? 'Sign in to manage your laboratory inventory'
              : 'Create an account to get started'}
          </p>
        </header>

        {/* -------------------- Mode Tabs -------------------- */}
        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
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
            style={{
              transform: isLogin ? 'translateX(0%)' : 'translateX(100%)',
            }}
            aria-hidden="true"
          />
        </div>

        {/* -------------------- Form -------------------- */}
        <form
          ref={formRef}
          className="auth-form"
          onSubmit={handleSubmit}
          noValidate
        >
          {/* Full Name - Sign up only */}
          {!isLogin && (
            <div
              className={`auth-field ${
                fullNameFocused || fullName ? 'auth-field--active' : ''
              } ${nameHasError ? 'auth-field--error' : ''}`}
            >
              <label htmlFor="auth-fullName" className="auth-label">
                Full Name
              </label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  ref={fullNameRef}
                  id="auth-fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onFocus={() => setFullNameFocused(true)}
                  onBlur={() => setFullNameFocused(false)}
                  placeholder=" "
                  required
                  minLength={2}
                  disabled={loading}
                  autoComplete="name"
                  aria-invalid={nameHasError}
                  aria-describedby={nameHasError ? 'name-error' : undefined}
                />
              </div>
              {nameHasError && (
                <p id="name-error" className="auth-field-hint auth-field-hint--error">
                  Please enter your full name (minimum 2 characters)
                </p>
              )}
            </div>
          )}

          {/* Email */}
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
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
              </span>
              <input
                ref={emailRef}
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                placeholder=" "
                required
                disabled={loading}
                autoComplete="email"
                aria-invalid={emailHasError}
                aria-describedby={emailHasError ? 'email-error' : undefined}
              />
            </div>
            {emailHasError && (
              <p id="email-error" className="auth-field-hint auth-field-hint--error">
                Please enter a valid email address
              </p>
            )}
          </div>

          {/* Password */}
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
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </span>
              <input
                ref={passwordRef}
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder=" "
                required
                minLength={6}
                disabled={loading}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                aria-invalid={passwordHasError}
                aria-describedby={passwordHasError ? 'password-error' : undefined}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
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

          {/* Confirm Password - Sign up only */}
          {!isLogin && (
            <div
              className={`auth-field ${
                confirmFocused || confirmPassword ? 'auth-field--active' : ''
              } ${confirmHasError ? 'auth-field--error' : ''}`}
            >
              <label htmlFor="auth-confirm" className="auth-label">
                Confirm Password
              </label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                </span>
                <input
                  ref={confirmRef}
                  id="auth-confirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={() => setConfirmFocused(true)}
                  onBlur={() => setConfirmFocused(false)}
                  placeholder=" "
                  required
                  minLength={6}
                  disabled={loading}
                  autoComplete="new-password"
                  aria-invalid={confirmHasError}
                  aria-describedby={confirmHasError ? 'confirm-error' : undefined}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
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
              {confirmHasError && (
                <p id="confirm-error" className="auth-field-hint auth-field-hint--error">
                  Passwords do not match
                </p>
              )}
            </div>
          )}

          {/* Global feedback messages */}
          {error && (
            <div className="auth-alert auth-alert--error" role="alert">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="auth-alert auth-alert--success" role="status">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{message}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className={`auth-submit ${loading ? 'auth-submit--loading' : ''}`}
            disabled={loading || (isLogin ? !canSubmitLogin : !canSubmitSignup)}
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

        {/* -------------------- Footer -------------------- */}
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

          {!isLogin && (
            <p className="auth-footer-note">
              After creating an account you will receive a confirmation email.
              You must click the link in that email before you can sign in.
            </p>
          )}

          {isLogin && (
            <p className="auth-footer-note">
              Secure access for laboratory chemical inventory management
            </p>
          )}
        </footer>
      </div>
    </div>
  )
}

export default Login