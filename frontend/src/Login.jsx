import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import appLogo from './assets/logo.jpg '
import './App.css'

/* ============================================================
   Ultra-Modern Login Component – Chemical Inventory
   Features:
   - Full Name + Email + Password + Confirm Password
   - 6-digit Email Confirmation Code (OTP)
   - Forgot Password / Reset Password flow
   - Advanced validation & accessibility
   - Glassmorphism + matching landing page aesthetic
   - Loading states, error handling, success messaging
   - Smooth animations and micro-interactions
   ============================================================ */

function Login({ onLogin }) {
  // ============================================================
  // MODE MANAGEMENT
  // 'login' | 'signup' | 'confirm' | 'forgot' | 'reset'
  // ============================================================
  const [mode, setMode] = useState('login')

  // ============================================================
  // FORM FIELDS
  // ============================================================
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  // ============================================================
  // UI STATE
  // ============================================================
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

  // ============================================================
  // FOCUS STATES (for active field styling)
  // ============================================================
  const [fullNameFocused, setFullNameFocused] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [confirmFocused, setConfirmFocused] = useState(false)
  const [otpFocused, setOtpFocused] = useState(false)
  const [newPasswordFocused, setNewPasswordFocused] = useState(false)
  const [confirmNewFocused, setConfirmNewFocused] = useState(false)

  // ============================================================
  // REFS
  // ============================================================
  const formRef = useRef(null)
  const fullNameRef = useRef(null)
  const emailRef = useRef(null)
  const passwordRef = useRef(null)
  const confirmRef = useRef(null)
  const otpRef = useRef(null)
  const newPasswordRef = useRef(null)
  const confirmNewRef = useRef(null)

  // ============================================================
  // EFFECTS
  // ============================================================
  useEffect(() => {
    setMounted(true)
    const timer = setTimeout(() => {
      setCardVisible(true)
    }, 70)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Clear feedback messages when mode changes
    setError(null)
    setMessage(null)
    setFormTouched(false)
  }, [mode])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [resendCooldown])

  // ============================================================
  // VALIDATION HELPERS
  // ============================================================
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

  // ============================================================
  // SUBMIT READINESS
  // ============================================================
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

  const canSubmitOtp =
    isOtpValid &&
    !loading

  const canSubmitForgot =
    isEmailValid(email) &&
    !loading

  const canSubmitReset =
    isOtpValid &&
    isPasswordValid(newPassword) &&
    doNewPasswordsMatch &&
    !loading

  // ============================================================
  // FIELD ERROR FLAGS
  // ============================================================
  const nameHasError =
    formTouched && mode === 'signup' && fullName.length > 0 && !isNameValid(fullName)

  const emailHasError =
    formTouched && email.length > 0 && !isEmailValid(email)

  const passwordHasError =
    formTouched && password.length > 0 && !isPasswordValid(password)

  const confirmHasError =
    formTouched && mode === 'signup' && confirmPassword.length > 0 && !doPasswordsMatch

  const otpHasError =
    formTouched && (mode === 'confirm' || mode === 'reset') && otpCode.length > 0 && !isOtpValid

  const newPasswordHasError =
    formTouched && mode === 'reset' && newPassword.length > 0 && !isPasswordValid(newPassword)

  const confirmNewHasError =
    formTouched && mode === 'reset' && confirmNewPassword.length > 0 && !doNewPasswordsMatch

  // ============================================================
  // AUTH HANDLERS
  // ============================================================
  const handleLogin = async () => {
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
      throw new Error('Unable to establish session. Please try again.')
    }
  }

  const handleSignUp = async () => {
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    })

    if (authError) {
      throw authError
    }

    // Move user to the confirmation code step
    setMode('confirm')
    setMessage(
      'A 6-digit confirmation code has been sent to your email. Please enter it below to activate your account.'
    )
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

    if (otpError) {
      throw otpError
    }

    if (data?.session) {
      // User is automatically signed in after successful verification
      onLogin(data.session)
    } else {
      setMessage('Email confirmed successfully! You can now sign in.')
      setMode('login')
      setOtpCode('')
      setFormTouched(false)
    }
  }

  // ---------- FORGOT PASSWORD HANDLERS ----------
  const handleForgotPassword = async () => {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })

    if (resetError) {
      throw resetError
    }

    setMode('reset')
    setMessage(
      'A 6-digit recovery code has been sent to your email. Enter it below together with your new password.'
    )
    setResendCooldown(60)
  }

  const handleResetPassword = async () => {
    // Verify the recovery OTP first
    const { data, error: otpError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otpCode.trim(),
      type: 'recovery',
    })

    if (otpError) {
      throw otpError
    }

    // Update the password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      throw updateError
    }

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

        if (resendError) {
          throw resendError
        }

        setMessage('A new confirmation code has been sent to your email.')
      } else if (mode === 'reset' || mode === 'forgot') {
        const { error: resendError } = await supabase.auth.resetPasswordForEmail(email.trim())

        if (resendError) {
          throw resendError
        }

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

  // ============================================================
  // MAIN SUBMIT HANDLER
  // ============================================================
  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormTouched(true)
    setError(null)
    setMessage(null)

    if (mode === 'login') {
      if (!canSubmitLogin) {
        setError('Please enter a valid email and a password of at least 6 characters.')
        return
      }
    } else if (mode === 'signup') {
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
    } else if (mode === 'confirm') {
      if (!canSubmitOtp) {
        setError('Please enter the 6-digit confirmation code.')
        return
      }
    } else if (mode === 'forgot') {
      if (!canSubmitForgot) {
        setError('Please enter a valid email address.')
        return
      }
    } else if (mode === 'reset') {
      if (!canSubmitReset) {
        if (!isOtpValid) {
          setError('Please enter the 6-digit recovery code.')
        } else if (!isPasswordValid(newPassword)) {
          setError('New password must be at least 6 characters long.')
        } else if (!doNewPasswordsMatch) {
          setError('New passwords do not match.')
        } else {
          setError('Please fill in all fields correctly.')
        }
        return
      }
    }

    setLoading(true)

    try {
      if (mode === 'login') {
        await handleLogin()
      } else if (mode === 'signup') {
        await handleSignUp()
      } else if (mode === 'confirm') {
        await handleVerifyOtp()
      } else if (mode === 'forgot') {
        await handleForgotPassword()
      } else if (mode === 'reset') {
        await handleResetPassword()
      }
    } catch (err) {
      let errorMessage =
        err?.message ||
        err?.error_description ||
        'Something went wrong. Please try again.'

      // Friendlier messages
      if (errorMessage.toLowerCase().includes('email not confirmed')) {
        errorMessage =
          'Please confirm your email with the code we sent you before signing in.'
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

  // ============================================================
  // MODE SWITCH HELPERS
  // ============================================================
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
    setNewPassword('')
    setConfirmNewPassword('')
    setError(null)
    setMessage(null)
    setFormTouched(false)
  }

  const switchToForgot = () => {
    setMode('forgot')
    setPassword('')
    setConfirmPassword('')
    setOtpCode('')
    setNewPassword('')
    setConfirmNewPassword('')
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

      {/* Decorative corners */}
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
              <img src={appLogo} alt="Chemical Inventory" className="auth-logo-img" />
            </div>
            <div className="auth-logo-ring" aria-hidden="true" />
          </div>

          <h1 className="auth-title">Chemical Inventory</h1>
          <p className="auth-subtitle">
            {mode === 'login' && 'Sign in to manage your laboratory inventory'}
            {mode === 'signup' && 'Create an account to get started'}
            {mode === 'confirm' && 'Enter the confirmation code sent to your email'}
            {mode === 'forgot' && 'Enter your email to receive a recovery code'}
            {mode === 'reset' && 'Enter the recovery code and your new password'}
          </p>
        </header>

        {/* -------------------- Mode Tabs -------------------- */}
        {(mode === 'login' || mode === 'signup') && (
          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
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
              style={{
                transform: mode === 'login' ? 'translateX(0%)' : 'translateX(100%)',
              }}
              aria-hidden="true"
            />
          </div>
        )}

        {/* -------------------- Form -------------------- */}
        <form
          ref={formRef}
          className="auth-form"
          onSubmit={handleSubmit}
          noValidate
        >
          {/* ==================================================
              CONFIRMATION / RECOVERY CODE STEP
              ================================================== */}
          {(mode === 'confirm' || mode === 'reset') && (
            <>
              <div className="auth-confirm-info">
                <p className="auth-confirm-label">
                  {mode === 'confirm'
                    ? 'We sent a 6-digit code to'
                    : 'We sent a recovery code to'}
                </p>
                <p className="auth-confirm-email">{email}</p>
              </div>

              <div
                className={`auth-field ${
                  otpFocused || otpCode ? 'auth-field--active' : ''
                } ${otpHasError ? 'auth-field--error' : ''}`}
              >
                <label htmlFor="auth-otp" className="auth-label">
                  {mode === 'confirm' ? 'Confirmation Code' : 'Recovery Code'}
                </label>
                <div className="auth-input-wrap auth-input-wrap--otp">
                  <input
                    ref={otpRef}
                    id="auth-otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setOtpCode(value)
                    }}
                    onFocus={() => setOtpFocused(true)}
                    onBlur={() => setOtpFocused(false)}
                    placeholder="000000"
                    className="otp-input"
                    disabled={loading}
                    autoComplete="one-time-code"
                    aria-invalid={otpHasError}
                    aria-describedby={otpHasError ? 'otp-error' : undefined}
                    autoFocus
                  />
                </div>
                {otpHasError && (
                  <p id="otp-error" className="auth-field-hint auth-field-hint--error">
                    Please enter a valid 6-digit code
                  </p>
                )}
              </div>

              {/* New Password fields – only in reset mode */}
              {mode === 'reset' && (
                <>
                  <div
                    className={`auth-field ${
                      newPasswordFocused || newPassword ? 'auth-field--active' : ''
                    } ${newPasswordHasError ? 'auth-field--error' : ''}`}
                  >
                    <label htmlFor="auth-new-password" className="auth-label">
                      New Password
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
                        ref={newPasswordRef}
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
                        autoComplete="new-password"
                        aria-invalid={newPasswordHasError}
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        tabIndex={-1}
                        aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                      >
                        {showNewPassword ? (
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
                    {newPasswordHasError && (
                      <p className="auth-field-hint auth-field-hint--error">
                        Password must be at least 6 characters
                      </p>
                    )}
                  </div>

                  <div
                    className={`auth-field ${
                      confirmNewFocused || confirmNewPassword ? 'auth-field--active' : ''
                    } ${confirmNewHasError ? 'auth-field--error' : ''}`}
                  >
                    <label htmlFor="auth-confirm-new" className="auth-label">
                      Confirm New Password
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
                        ref={confirmNewRef}
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
                        autoComplete="new-password"
                        aria-invalid={confirmNewHasError}
                      />
                    </div>
                    {confirmNewHasError && (
                      <p className="auth-field-hint auth-field-hint--error">
                        Passwords do not match
                      </p>
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
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : mode === 'confirm'
                    ? 'Resend confirmation code'
                    : 'Resend recovery code'}
                </button>
              </div>
            </>
          )}

          {/* ==================================================
              FORGOT PASSWORD (email only)
              ================================================== */}
          {mode === 'forgot' && (
            <div
              className={`auth-field ${
                emailFocused || email ? 'auth-field--active' : ''
              } ${emailHasError ? 'auth-field--error' : ''}`}
            >
              <label htmlFor="auth-email-forgot" className="auth-label">
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
                  aria-invalid={emailHasError}
                  autoFocus
                />
              </div>
              {emailHasError && (
                <p className="auth-field-hint auth-field-hint--error">
                  Please enter a valid email address
                </p>
              )}
            </div>
          )}

          {/* ==================================================
              LOGIN / SIGNUP FIELDS
              ================================================== */}
          {(mode === 'login' || mode === 'signup') && (
            <>
              {/* Full Name - Sign up only */}
              {mode === 'signup' && (
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
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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

              {/* Forgot password link – only on login */}
              {mode === 'login' && (
                <div className="auth-forgot-row">
                  <button
                    type="button"
                    className="auth-forgot-link"
                    onClick={switchToForgot}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Confirm Password - Sign up only */}
              {mode === 'signup' && (
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
            </>
          )}

          {/* ==================================================
              GLOBAL FEEDBACK MESSAGES
              ================================================== */}
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

          {/* ==================================================
              SUBMIT BUTTON
              ================================================== */}
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

        {/* -------------------- Footer -------------------- */}
        <footer className="auth-footer">
          {mode === 'confirm' ? (
            <p>
              Wrong email?{' '}
              <button
                type="button"
                className="auth-footer-link"
                onClick={switchToSignup}
              >
                Go back
              </button>
            </p>
          ) : mode === 'forgot' ? (
            <p>
              Remember your password?{' '}
              <button
                type="button"
                className="auth-footer-link"
                onClick={switchToLogin}
              >
                Sign in
              </button>
            </p>
          ) : mode === 'reset' ? (
            <p>
              <button
                type="button"
                className="auth-footer-link"
                onClick={switchToLogin}
              >
                Back to Sign In
              </button>
            </p>
          ) : mode === 'login' ? (
            <p>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                className="auth-footer-link"
                onClick={switchToSignup}
              >
                Create one
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                className="auth-footer-link"
                onClick={switchToLogin}
              >
                Sign in
              </button>
            </p>
          )}

          {mode === 'signup' && (
            <p className="auth-footer-note">
              After creating an account you will receive a 6-digit confirmation code by email.
              You must enter that code before you can sign in.
            </p>
          )}

          {mode === 'login' && (
            <p className="auth-footer-note">
              Secure access for laboratory chemical inventory management
            </p>
          )}

          {mode === 'confirm' && (
            <p className="auth-footer-note">
              The code expires after a short time. You can request a new one if needed.
            </p>
          )}

          {mode === 'forgot' && (
            <p className="auth-footer-note">
              We will send a 6-digit recovery code to your email so you can set a new password.
            </p>
          )}

          {mode === 'reset' && (
            <p className="auth-footer-note">
              Enter the recovery code from your email and choose a new password.
            </p>
          )}
        </footer>
      </div>
    </div>
  )
}

export default Login