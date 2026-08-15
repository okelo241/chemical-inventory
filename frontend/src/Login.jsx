import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import './App.css'

/* ============================================================
   Ultra-Modern Login Component – Chemical Inventory
   Features:
   - Full Name + Email + Password + Confirm Password
   - 6-digit Email Confirmation Code (OTP)
   - Forgot Password / Reset Password flow
   - Advanced validation & accessibility
   - Glassmorphism + matching landing page aesthetic
   ============================================================ */

function Login({ onLogin }) {
  // Modes: 'login' | 'signup' | 'confirm' | 'forgot' | 'reset'
  const [mode, setMode] = useState('login')

  // Form fields
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  // UI state
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [formTouched, setFormTouched] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [cardVisible, setCardVisible] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Focus states
  const [fullNameFocused, setFullNameFocused] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [confirmFocused, setConfirmFocused] = useState(false)
  const [otpFocused, setOtpFocused] = useState(false)
  const [newPasswordFocused, setNewPasswordFocused] = useState(false)
  const [confirmNewFocused, setConfirmNewFocused] = useState(false)

  // Refs
  const formRef = useRef(null)

  useEffect(() => {
    setMounted(true)
    const timer = setTimeout(() => setCardVisible(true), 70)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    setError(null)
    setMessage(null)
    setFormTouched(false)
  }, [mode])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [resendCooldown])

  // Validation helpers
  const isEmailValid = useCallback((value) => {
    if (!value || typeof value !== 'string') return false
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  }, [])

  const isPasswordValid = useCallback((value) => {
    return typeof value === 'string' && value.length >= 6
  }, [])

  const isNameValid = useCallback((value) => {
    return typeof value === 'string' && value.trim().length >= 2
  }, [])

  const doPasswordsMatch = password === confirmPassword && confirmPassword.length > 0
  const doNewPasswordsMatch = newPassword === confirmNewPassword && confirmNewPassword.length > 0
  const isOtpValid = otpCode.trim().length === 6 && /^\d{6}$/.test(otpCode.trim())

  // Submit readiness
  const canSubmitLogin = isEmailValid(email) && isPasswordValid(password) && !loading
  const canSubmitSignup =
    isNameValid(fullName) &&
    isEmailValid(email) &&
    isPasswordValid(password) &&
    doPasswordsMatch &&
    !loading
  const canSubmitOtp = isOtpValid && !loading
  const canSubmitForgot = isEmailValid(email) && !loading
  const canSubmitReset =
    isOtpValid &&
    isPasswordValid(newPassword) &&
    doNewPasswordsMatch &&
    !loading

  // Field error flags
  const nameHasError = formTouched && mode === 'signup' && fullName.length > 0 && !isNameValid(fullName)
  const emailHasError = formTouched && email.length > 0 && !isEmailValid(email)
  const passwordHasError = formTouched && password.length > 0 && !isPasswordValid(password)
  const confirmHasError = formTouched && mode === 'signup' && confirmPassword.length > 0 && !doPasswordsMatch
  const otpHasError = formTouched && (mode === 'confirm' || mode === 'reset') && otpCode.length > 0 && !isOtpValid
  const newPasswordHasError = formTouched && mode === 'reset' && newPassword.length > 0 && !isPasswordValid(newPassword)
  const confirmNewHasError = formTouched && mode === 'reset' && confirmNewPassword.length > 0 && !doNewPasswordsMatch

  // Auth handlers
  const handleLogin = async () => {
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (authError) throw authError
    if (data?.session) {
      onLogin(data.session)
    } else {
      throw new Error('Unable to establish session. Please try again.')
    }
  }

  const handleSignUp = async () => {
    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
      },
    })
    if (authError) throw authError

    setMode('confirm')
    setMessage('A 6-digit confirmation code has been sent to your email. Please enter it below to activate your account.')
    setPassword('')
    setConfirmPassword('')
    setResendCooldown(60)
  }

  const handleVerifyOtp = async () => {
    const { data, error: otpError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otpCode.trim(),
      type: 'signup',
    })
    if (otpError) throw otpError

    if (data?.session) {
      onLogin(data.session)
    } else {
      setMessage('Email confirmed successfully! You can now sign in.')
      setMode('login')
      setOtpCode('')
      setFormTouched(false)
    }
  }

  const handleForgotPassword = async () => {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    if (resetError) throw resetError

    setMode('reset')
    setMessage('A 6-digit recovery code has been sent to your email. Enter it below together with your new password.')
    setResendCooldown(60)
  }

  const handleResetPassword = async () => {
    // First verify the recovery OTP
    const { data, error: otpError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otpCode.trim(),
      type: 'recovery',
    })
    if (otpError) throw otpError

    // Then update the password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })
    if (updateError) throw updateError

    setMessage('Password updated successfully! You can now sign in with your new password.')
    setMode('login')
    setOtpCode('')
    setNewPassword('')
    setConfirmNewPassword('')
    setPassword('')
    setFormTouched(false)
  }

  const handleResendCode = async () => {
    if (resendCooldown > 0 || loading) return
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === 'confirm') {
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email: email.trim(),
        })
        if (resendError) throw resendError
        setMessage('A new confirmation code has been sent to your email.')
      } else if (mode === 'reset' || mode === 'forgot') {
        const { error: resendError } = await supabase.auth.resetPasswordForEmail(email.trim())
        if (resendError) throw resendError
        setMessage('A new recovery code has been sent to your email.')
      }
      setResendCooldown(60)
      setOtpCode('')
    } catch (err) {
      setError(err?.message || 'Failed to resend code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormTouched(true)
    setError(null)
    setMessage(null)

    if (mode === 'login' && !canSubmitLogin) {
      setError('Please enter a valid email and a password of at least 6 characters.')
      return
    }
    if (mode === 'signup' && !canSubmitSignup) {
      if (!isNameValid(fullName)) setError('Please enter your full name (at least 2 characters).')
      else if (!isEmailValid(email)) setError('Please enter a valid email address.')
      else if (!isPasswordValid(password)) setError('Password must be at least 6 characters long.')
      else if (!doPasswordsMatch) setError('Passwords do not match.')
      else setError('Please fill in all fields correctly.')
      return
    }
    if (mode === 'confirm' && !canSubmitOtp) {
      setError('Please enter the 6-digit confirmation code.')
      return
    }
    if (mode === 'forgot' && !canSubmitForgot) {
      setError('Please enter a valid email address.')
      return
    }
    if (mode === 'reset' && !canSubmitReset) {
      if (!isOtpValid) setError('Please enter the 6-digit recovery code.')
      else if (!isPasswordValid(newPassword)) setError('New password must be at least 6 characters.')
      else if (!doNewPasswordsMatch) setError('New passwords do not match.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') await handleLogin()
      else if (mode === 'signup') await handleSignUp()
      else if (mode === 'confirm') await handleVerifyOtp()
      else if (mode === 'forgot') await handleForgotPassword()
      else if (mode === 'reset') await handleResetPassword()
    } catch (err) {
      let errorMessage = err?.message || err?.error_description || 'Something went wrong. Please try again.'

      if (errorMessage.toLowerCase().includes('email not confirmed')) {
        errorMessage = 'Please confirm your email with the code we sent you before signing in.'
      } else if (
        errorMessage.toLowerCase().includes('token') ||
        errorMessage.toLowerCase().includes('otp') ||
        errorMessage.toLowerCase().includes('invalid')
      ) {
        errorMessage = 'Invalid or expired code. Please try again or request a new one.'
      } else if (errorMessage.toLowerCase().includes('already registered')) {
        errorMessage = 'This email is already registered. Please sign in instead.'
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const switchToLogin = () => {
    setMode('login')
    setOtpCode('')
    setNewPassword('')
    setConfirmNewPassword('')
    setError(null)
    setMessage(null)
    setFormTouched(false)
  }

  const switchToSignup = () => {
    setMode('signup')
    setOtpCode('')
    setError(null)
    setMessage(null)
    setFormTouched(false)
  }

  const switchToForgot = () => {
    setMode('forgot')
    setPassword('')
    setError(null)
    setMessage(null)
    setFormTouched(false)
  }

  // Subtitle text
  const getSubtitle = () => {
    if (mode === 'login') return 'Sign in to manage your laboratory inventory'
    if (mode === 'signup') return 'Create an account to get started'
    if (mode === 'confirm') return 'Enter the confirmation code sent to your email'
    if (mode === 'forgot') return 'Enter your email to receive a recovery code'
    if (mode === 'reset') return 'Enter the recovery code and your new password'
    return ''
  }

  return (
    <div className={`auth-root ${mounted ? 'auth-root--mounted' : ''}`}>
      <div className="auth-bg" aria-hidden="true" />
      <div className="auth-bg-gradient" aria-hidden="true" />
      <div className="auth-bg-grid" aria-hidden="true" />
      <div className="auth-glow auth-glow--1" aria-hidden="true" />
      <div className="auth-glow auth-glow--2" aria-hidden="true" />
      <div className="auth-glow auth-glow--3" aria-hidden="true" />

      <div className="auth-corner auth-corner--tl" aria-hidden="true" />
      <div className="auth-corner auth-corner--tr" aria-hidden="true" />
      <div className="auth-corner auth-corner--bl" aria-hidden="true" />
      <div className="auth-corner auth-corner--br" aria-hidden="true" />

      <div className={`auth-card ${cardVisible ? 'auth-card--visible' : ''}`} role="main">
        {/* Header */}
        <header className="auth-header">
          <div className="auth-logo-wrap">
            <div className="auth-logo">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3h6v2H9z" />
                <path d="M10 5v3.15a2 2 0 0 1-.4 1.2L6.2 15.4A3.4 3.4 0 0 0 9.1 21h5.8a3.4 3.4 0 0 0 2.9-5.6l-3.4-6.05a2 2 0 0 1-.4-1.2V5" />
                <circle cx="12" cy="17" r="1.15" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div className="auth-logo-ring" aria-hidden="true" />
          </div>
          <h1 className="auth-title">Chemical Inventory</h1>
          <p className="auth-subtitle">{getSubtitle()}</p>
        </header>

        {/* Tabs (only for login / signup) */}
        {(mode === 'login' || mode === 'signup') && (
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={`auth-tab ${mode === 'login' ? 'auth-tab--active' : ''}`}
              onClick={switchToLogin}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={`auth-tab ${mode === 'signup' ? 'auth-tab--active' : ''}`}
              onClick={switchToSignup}
            >
              Create Account
            </button>
            <div
              className="auth-tab-indicator"
              style={{ transform: mode === 'login' ? 'translateX(0%)' : 'translateX(100%)' }}
              aria-hidden="true"
            />
          </div>
        )}

        <form ref={formRef} className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* ========== CONFIRM / RESET OTP ========== */}
          {(mode === 'confirm' || mode === 'reset') && (
            <>
              <div className="auth-confirm-info">
                <p className="auth-confirm-label">
                  {mode === 'confirm' ? 'We sent a 6-digit code to' : 'We sent a recovery code to'}
                </p>
                <p className="auth-confirm-email">{email}</p>
              </div>

              <div className={`auth-field ${otpFocused || otpCode ? 'auth-field--active' : ''} ${otpHasError ? 'auth-field--error' : ''}`}>
                <label htmlFor="auth-otp" className="auth-label">
                  {mode === 'confirm' ? 'Confirmation Code' : 'Recovery Code'}
                </label>
                <div className="auth-input-wrap auth-input-wrap--otp">
                  <input
                    id="auth-otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onFocus={() => setOtpFocused(true)}
                    onBlur={() => setOtpFocused(false)}
                    placeholder="000000"
                    className="otp-input"
                    disabled={loading}
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>
                {otpHasError && (
                  <p className="auth-field-hint auth-field-hint--error">Please enter a valid 6-digit code</p>
                )}
              </div>

              {mode === 'reset' && (
                <>
                  {/* New Password */}
                  <div className={`auth-field ${newPasswordFocused || newPassword ? 'auth-field--active' : ''} ${newPasswordHasError ? 'auth-field--error' : ''}`}>
                    <label htmlFor="auth-new-password" className="auth-label">New Password</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="5" y="11" width="14" height="10" rx="2" />
                          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                        </svg>
                      </span>
                      <input
                        id="auth-new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        onFocus={() => setNewPasswordFocused(true)}
                        onBlur={() => setNewPasswordFocused(false)}
                        placeholder=" "
                        required
                        minLength={6}
                        disabled={loading}
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        onClick={() => setShowNewPassword((p) => !p)}
                        tabIndex={-1}
                      >
                        {showNewPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {newPasswordHasError && (
                      <p className="auth-field-hint auth-field-hint--error">Password must be at least 6 characters</p>
                    )}
                  </div>

                  {/* Confirm New Password */}
                  <div className={`auth-field ${confirmNewFocused || confirmNewPassword ? 'auth-field--active' : ''} ${confirmNewHasError ? 'auth-field--error' : ''}`}>
                    <label htmlFor="auth-confirm-new" className="auth-label">Confirm New Password</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="5" y="11" width="14" height="10" rx="2" />
                          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                        </svg>
                      </span>
                      <input
                        id="auth-confirm-new"
                        type={showNewPassword ? 'text' : 'password'}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        onFocus={() => setConfirmNewFocused(true)}
                        onBlur={() => setConfirmNewFocused(false)}
                        placeholder=" "
                        required
                        minLength={6}
                        disabled={loading}
                      />
                    </div>
                    {confirmNewHasError && (
                      <p className="auth-field-hint auth-field-hint--error">Passwords do not match</p>
                    )}
                  </div>
                </>
              )}

              <div className="auth-resend">
                <button
                  type="button"
                  className="auth-resend-btn"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || loading}
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>
            </>
          )}

          {/* ========== FORGOT PASSWORD (email only) ========== */}
          {mode === 'forgot' && (
            <div className={`auth-field ${emailFocused || email ? 'auth-field--active' : ''} ${emailHasError ? 'auth-field--error' : ''}`}>
              <label htmlFor="auth-email-forgot" className="auth-label">Email address</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" />
                  </svg>
                </span>
                <input
                  id="auth-email-forgot"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  placeholder=" "
                  required
                  disabled={loading}
                  autoComplete="email"
                  autoFocus
                />
              </div>
              {emailHasError && (
                <p className="auth-field-hint auth-field-hint--error">Please enter a valid email address</p>
              )}
            </div>
          )}

          {/* ========== LOGIN / SIGNUP FIELDS ========== */}
          {(mode === 'login' || mode === 'signup') && (
            <>
              {mode === 'signup' && (
                <div className={`auth-field ${fullNameFocused || fullName ? 'auth-field--active' : ''} ${nameHasError ? 'auth-field--error' : ''}`}>
                  <label htmlFor="auth-fullName" className="auth-label">Full Name</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                    <input
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
                    />
                  </div>
                  {nameHasError && (
                    <p className="auth-field-hint auth-field-hint--error">Please enter your full name (minimum 2 characters)</p>
                  )}
                </div>
              )}

              <div className={`auth-field ${emailFocused || email ? 'auth-field--active' : ''} ${emailHasError ? 'auth-field--error' : ''}`}>
                <label htmlFor="auth-email" className="auth-label">Email address</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="M3 7l9 6 9-6" />
                    </svg>
                  </span>
                  <input
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
                  />
                </div>
                {emailHasError && (
                  <p className="auth-field-hint auth-field-hint--error">Please enter a valid email address</p>
                )}
              </div>

              <div className={`auth-field ${passwordFocused || password ? 'auth-field--active' : ''} ${passwordHasError ? 'auth-field--error' : ''}`}>
                <label htmlFor="auth-password" className="auth-label">Password</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  </span>
                  <input
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
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword((p) => !p)}
                    tabIndex={-1}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {passwordHasError && (
                  <p className="auth-field-hint auth-field-hint--error">Password must be at least 6 characters</p>
                )}
              </div>

              {/* Forgot password link – only on login */}
              {mode === 'login' && (
                <div className="auth-forgot-row">
                  <button type="button" className="auth-forgot-link" onClick={switchToForgot}>
                    Forgot password?
                  </button>
                </div>
              )}

              {mode === 'signup' && (
                <div className={`auth-field ${confirmFocused || confirmPassword ? 'auth-field--active' : ''} ${confirmHasError ? 'auth-field--error' : ''}`}>
                  <label htmlFor="auth-confirm" className="auth-label">Confirm Password</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="5" y="11" width="14" height="10" rx="2" />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </svg>
                    </span>
                    <input
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
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowConfirmPassword((p) => !p)}
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {confirmHasError && (
                    <p className="auth-field-hint auth-field-hint--error">Passwords do not match</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Feedback */}
          {error && (
            <div className="auth-alert auth-alert--error" role="alert">
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="auth-alert auth-alert--success" role="status">
              <span>{message}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className={`auth-submit ${loading ? 'auth-submit--loading' : ''}`}
            disabled={
              loading ||
              (mode === 'login' && !canSubmitLogin) ||
              (mode === 'signup' && !canSubmitSignup) ||
              (mode === 'confirm' && !canSubmitOtp) ||
              (mode === 'forgot' && !canSubmitForgot) ||
              (mode === 'reset' && !canSubmitReset)
            }
          >
            {loading ? (
              <>
                <span className="auth-spinner" aria-hidden="true" />
                <span>Please wait…</span>
              </>
            ) : mode === 'login' ? (
              <span>Sign In</span>
            ) : mode === 'signup' ? (
              <span>Create Account</span>
            ) : mode === 'confirm' ? (
              <span>Verify Code</span>
            ) : mode === 'forgot' ? (
              <span>Send Recovery Code</span>
            ) : (
              <span>Reset Password</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <footer className="auth-footer">
          {mode === 'confirm' && (
            <p>
              Wrong email?{' '}
              <button type="button" className="auth-footer-link" onClick={switchToSignup}>
                Go back
              </button>
            </p>
          )}
          {mode === 'forgot' && (
            <p>
              Remember your password?{' '}
              <button type="button" className="auth-footer-link" onClick={switchToLogin}>
                Sign in
              </button>
            </p>
          )}
          {mode === 'reset' && (
            <p>
              <button type="button" className="auth-footer-link" onClick={switchToLogin}>
                Back to Sign In
              </button>
            </p>
          )}
          {mode === 'login' && (
            <p>
              Don&apos;t have an account?{' '}
              <button type="button" className="auth-footer-link" onClick={switchToSignup}>
                Create one
              </button>
            </p>
          )}
          {mode === 'signup' && (
            <p>
              Already have an account?{' '}
              <button type="button" className="auth-footer-link" onClick={switchToLogin}>
                Sign in
              </button>
            </p>
          )}
        </footer>
      </div>
    </div>
  )
}

export default Login