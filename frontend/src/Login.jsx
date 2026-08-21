import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import appLogo from './assets/logo.jpg'
import './App.css'

/* ============================================================
   Ultra-Modern Login Component – Chemical Inventory
   Features:
   - Personal / Organization workspace intent selector
   - Organization name on org signup AND org login
   - Invite link support (?token=...) forces organization join mode
   - Full Name + Email + Password + Confirm Password
   - 6-digit Email Confirmation Code (OTP) via Supabase Auth
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

  // Workspace intent (not a separate auth system)
  // 'personal' | 'organization'
  const [accountType, setAccountType] = useState('personal')

  // Invite token from URL (organization join link)
  const [inviteToken, setInviteToken] = useState('')

  // ============================================================
  // FORM FIELDS
  // ============================================================
  const [fullName, setFullName] = useState('')
  const [orgName, setOrgName] = useState('')
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
  // FOCUS STATES
  // ============================================================
  const [fullNameFocused, setFullNameFocused] = useState(false)
  const [orgNameFocused, setOrgNameFocused] = useState(false)
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
  const orgNameRef = useRef(null)
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

  // Detect invite link: ?token=...
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const token = (params.get('token') || '').trim()
      if (token) {
        setInviteToken(token)
        setAccountType('organization')
        setMessage(
          'You have been invited to an organization. Sign in or create an account to join.'
        )
        try {
          localStorage.setItem('pendingInviteToken', token)
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    setError(null)
    if (!inviteToken) setMessage(null)
    setFormTouched(false)
  }, [mode, inviteToken])

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
  // WORKSPACE INTENT (read by App.jsx after session)
  // ============================================================
  const persistWorkspaceIntent = (type, organizationName = '') => {
    const intent = {
      type, // 'personal' | 'organization'
      organizationName: organizationName || '',
      inviteToken: inviteToken || '',
      at: Date.now(),
    }
    try {
      localStorage.setItem('workspaceIntent', JSON.stringify(intent))
      localStorage.setItem('accountMode', type === 'organization' ? 'organization' : 'personal')
      if (inviteToken) {
        localStorage.setItem('pendingInviteToken', inviteToken)
      }
    } catch {
      // ignore storage errors
    }
  }

  // ============================================================
  // SUBMIT READINESS
  // ============================================================
  const canSubmitLogin =
    isEmailValid(email) &&
    isPasswordValid(password) &&
    (accountType === 'personal' || inviteToken || isNameValid(orgName)) &&
    !loading

  const canSubmitSignup =
    isNameValid(fullName) &&
    isEmailValid(email) &&
    isPasswordValid(password) &&
    doPasswordsMatch &&
    (accountType === 'personal' || isNameValid(orgName)) &&
    !loading

  const canSubmitOtp = isOtpValid && !loading
  const canSubmitForgot = isEmailValid(email) && !loading
  const canSubmitReset =
    isOtpValid && isPasswordValid(newPassword) && doNewPasswordsMatch && !loading

  // ============================================================
  // FIELD ERROR FLAGS
  // ============================================================
  const nameHasError =
    formTouched && mode === 'signup' && fullName.length > 0 && !isNameValid(fullName)

  const orgNameHasError =
    formTouched &&
    (mode === 'signup' || mode === 'login') &&
    accountType === 'organization' &&
    !inviteToken &&
    orgName.length > 0 &&
    !isNameValid(orgName)

  const emailHasError = formTouched && email.length > 0 && !isEmailValid(email)
  const passwordHasError = formTouched && password.length > 0 && !isPasswordValid(password)
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
    persistWorkspaceIntent(accountType, orgName.trim())

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
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
    const cleanEmail = email.trim().toLowerCase()
    const cleanOrg = orgName.trim()

    persistWorkspaceIntent(accountType, cleanOrg)

    const { data, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          account_type: accountType,
          pending_org_name: accountType === 'organization' ? cleanOrg : null,
        },
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    })

    if (authError) throw authError

    const identities = data?.user?.identities
    if (data?.user && Array.isArray(identities) && identities.length === 0) {
      throw new Error(
        'This email is already registered. Please sign in instead, or use Forgot password.'
      )
    }

    if (data?.session) {
      persistWorkspaceIntent(accountType, cleanOrg)
      onLogin(data.session)
      return
    }

    try {
      await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
      })
    } catch (resendErr) {
      console.warn('Signup resend hint:', resendErr?.message || resendErr)
    }

    setMode('confirm')
    setMessage(
      accountType === 'organization'
        ? 'A 6-digit confirmation code has been sent to your email. After you verify, you can finish setting up your organization workspace. Check spam if needed.'
        : 'A 6-digit confirmation code has been sent to your email. Please enter it below to activate your personal account. Check spam if needed.'
    )
    setPassword('')
    setConfirmPassword('')
    setOtpCode('')
    setResendCooldown(60)
  }

  const handleVerifyOtp = async () => {
    const cleanEmail = email.trim().toLowerCase()

    const { data, error: otpError } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: otpCode.trim(),
      type: 'signup',
    })

    if (otpError) throw otpError

    if (data?.session) {
      persistWorkspaceIntent(accountType, orgName.trim())
      onLogin(data.session)
    } else {
      setMessage('Email confirmed successfully! You can now sign in.')
      setMode('login')
      setOtpCode('')
      setFormTouched(false)
    }
  }

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    })

    if (resetError) throw resetError

    setMode('reset')
    setMessage(
      'A 6-digit recovery code has been sent to your email. Enter it below together with your new password.'
    )
    setResendCooldown(60)
  }

  const handleResetPassword = async () => {
    const cleanEmail = email.trim().toLowerCase()

    const { error: otpError } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: otpCode.trim(),
      type: 'recovery',
    })

    if (otpError) throw otpError

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
    if (!inviteToken) setMessage(null)

    const cleanEmail = email.trim().toLowerCase()

    try {
      if (mode === 'confirm') {
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email: cleanEmail,
        })
        if (resendError) throw resendError
        setMessage('A new confirmation code has been sent to your email. Check inbox and spam.')
      } else if (mode === 'reset' || mode === 'forgot') {
        const { error: resendError } = await supabase.auth.resetPasswordForEmail(cleanEmail)
        if (resendError) throw resendError
        setMessage('A new recovery code has been sent to your email. Check inbox and spam.')
      }

      setResendCooldown(60)
      setOtpCode('')
    } catch (err) {
      setError(err?.message || 'Failed to resend code. Please try again in a minute.')
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
    if (!inviteToken) setMessage(null)

    if (mode === 'login') {
      if (!canSubmitLogin) {
        if (accountType === 'organization' && !inviteToken && !isNameValid(orgName)) {
          setError('Please enter your organization name.')
        } else {
          setError('Please enter a valid email and a password of at least 6 characters.')
        }
        return
      }
    } else if (mode === 'signup') {
      if (!canSubmitSignup) {
        if (!isNameValid(fullName)) {
          setError('Please enter your full name (at least 2 characters).')
        } else if (accountType === 'organization' && !isNameValid(orgName)) {
          setError('Please enter an organization name (at least 2 characters).')
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
      if (mode === 'login') await handleLogin()
      else if (mode === 'signup') await handleSignUp()
      else if (mode === 'confirm') await handleVerifyOtp()
      else if (mode === 'forgot') await handleForgotPassword()
      else if (mode === 'reset') await handleResetPassword()
    } catch (err) {
      let errorMessage =
        err?.message || err?.error_description || 'Something went wrong. Please try again.'

      const lower = errorMessage.toLowerCase()
      if (lower.includes('email not confirmed')) {
        errorMessage =
          'Please confirm your email with the code we sent you before signing in.'
        setMode('confirm')
      } else if (
        lower.includes('token') ||
        lower.includes('otp') ||
        (lower.includes('invalid') && (mode === 'confirm' || mode === 'reset'))
      ) {
        errorMessage = 'Invalid or expired code. Please try again or request a new one.'
      } else if (
        lower.includes('already registered') ||
        lower.includes('already been registered') ||
        lower.includes('user already registered')
      ) {
        errorMessage = 'This email is already registered. Please sign in instead.'
      } else if (lower.includes('rate limit') || lower.includes('too many')) {
        errorMessage = 'Too many attempts. Please wait a minute before requesting another code.'
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
    if (!inviteToken) setMessage(null)
    setFormTouched(false)
  }

  const switchToSignup = () => {
    setMode('signup')
    setOtpCode('')
    setNewPassword('')
    setConfirmNewPassword('')
    setError(null)
    if (!inviteToken) setMessage(null)
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
        <header className="auth-header">
          <div className="auth-logo-wrap">
            <div className="auth-logo">
              <img src={appLogo} alt="Chemical Inventory" className="auth-logo-img" />
            </div>
            <div className="auth-logo-ring" aria-hidden="true" />
          </div>

          <h1 className="auth-title">Chemical Inventory</h1>
          <p className="auth-subtitle">
            {inviteToken && (mode === 'login' || mode === 'signup')
              ? 'Organization invitation — sign in or create an account to join'
              : null}
            {!inviteToken &&
              mode === 'login' &&
              (accountType === 'organization'
                ? 'Sign in to your organization workspace'
                : 'Sign in to your personal laboratory inventory')}
            {!inviteToken &&
              mode === 'signup' &&
              (accountType === 'organization'
                ? 'Create an account and set up your organization'
                : 'Create a personal account to get started')}
            {mode === 'confirm' && 'Enter the confirmation code sent to your email'}
            {mode === 'forgot' && 'Enter your email to receive a recovery code'}
            {mode === 'reset' && 'Enter the recovery code and your new password'}
          </p>
        </header>

        {(mode === 'login' || mode === 'signup') && !inviteToken && (
          <div
            className="auth-account-type"
            role="group"
            aria-label="Account type"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              marginBottom: 16,
              padding: 4,
              borderRadius: 14,
              background: 'var(--bg, rgba(15, 23, 42, 0.04))',
              border: '1px solid var(--border, #e2e8f0)',
            }}
          >
            <button
              type="button"
              onClick={() => setAccountType('personal')}
              aria-pressed={accountType === 'personal'}
              style={{
                border: 0,
                borderRadius: 12,
                padding: '12px 10px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                lineHeight: 1.3,
                background: accountType === 'personal' ? 'var(--panel, #ffffff)' : 'transparent',
                boxShadow:
                  accountType === 'personal' ? '0 1px 4px rgba(15, 23, 42, 0.08)' : 'none',
                color: 'var(--text, #0f172a)',
              }}
            >
              👤 Personal
            </button>
            <button
              type="button"
              onClick={() => setAccountType('organization')}
              aria-pressed={accountType === 'organization'}
              style={{
                border: 0,
                borderRadius: 12,
                padding: '12px 10px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                lineHeight: 1.3,
                background:
                  accountType === 'organization' ? 'var(--panel, #ffffff)' : 'transparent',
                boxShadow:
                  accountType === 'organization' ? '0 1px 4px rgba(15, 23, 42, 0.08)' : 'none',
                color: 'var(--text, #0f172a)',
              }}
            >
              🏢 Organization
            </button>
          </div>
        )}

        <form ref={formRef} className="auth-form" onSubmit={handleSubmit} noValidate>
          {(mode === 'confirm' || mode === 'reset') && (
            <>
              <div
                className={`auth-field ${
                  otpFocused || otpCode ? 'auth-field--active' : ''
                } ${otpHasError ? 'auth-field--error' : ''}`}
              >
                <label htmlFor="auth-otp" className="auth-label">
                  6-digit code
                </label>
                <div className="auth-input-wrap">
                  <input
                    ref={otpRef}
                    id="auth-otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onFocus={() => setOtpFocused(true)}
                    onBlur={() => setOtpFocused(false)}
                    required
                    disabled={loading}
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>
                {otpHasError && (
                  <p className="auth-field-hint auth-field-hint--error">
                    Please enter the 6-digit code
                  </p>
                )}
              </div>

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
                      <input
                        ref={newPasswordRef}
                        id="auth-new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        onFocus={() => setNewPasswordFocused(true)}
                        onBlur={() => setNewPasswordFocused(false)}
                        required
                        minLength={6}
                        disabled={loading}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        tabIndex={-1}
                      >
                        {showNewPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
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
                      <input
                        ref={confirmNewRef}
                        id="auth-confirm-new"
                        type={showNewPassword ? 'text' : 'password'}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        onFocus={() => setConfirmNewFocused(true)}
                        onBlur={() => setConfirmNewFocused(false)}
                        required
                        minLength={6}
                        disabled={loading}
                        autoComplete="new-password"
                      />
                    </div>
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
                <input
                  ref={emailRef}
                  id="auth-email-forgot"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  required
                  disabled={loading}
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>
          )}

          {(mode === 'login' || mode === 'signup') && (
            <>
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
                    <input
                      ref={fullNameRef}
                      id="auth-fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onFocus={() => setFullNameFocused(true)}
                      onBlur={() => setFullNameFocused(false)}
                      required
                      minLength={2}
                      disabled={loading}
                      autoComplete="name"
                    />
                  </div>
                  {nameHasError && (
                    <p className="auth-field-hint auth-field-hint--error">
                      Please enter your full name (minimum 2 characters)
                    </p>
                  )}
                </div>
              )}

              {/* Organization name on signup, and on login (unless invite token) */}
              {accountType === 'organization' &&
                (mode === 'signup' || (mode === 'login' && !inviteToken)) && (
                  <div
                    className={`auth-field ${
                      orgNameFocused || orgName ? 'auth-field--active' : ''
                    } ${orgNameHasError ? 'auth-field--error' : ''}`}
                  >
                    <label htmlFor="auth-orgName" className="auth-label">
                      Organization name
                    </label>
                    <div className="auth-input-wrap">
                      <input
                        ref={orgNameRef}
                        id="auth-orgName"
                        type="text"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        onFocus={() => setOrgNameFocused(true)}
                        onBlur={() => setOrgNameFocused(false)}
                        required
                        minLength={2}
                        disabled={loading}
                        autoComplete="organization"
                      />
                    </div>
                    {orgNameHasError ? (
                      <p className="auth-field-hint auth-field-hint--error">
                        Please enter an organization name (minimum 2 characters)
                      </p>
                    ) : (
                      <p className="auth-field-hint" style={{ marginTop: 6, opacity: 0.75 }}>
                        {mode === 'login'
                          ? 'Enter the organization name you belong to.'
                          : 'You will be the owner. Invite colleagues after you sign in.'}
                      </p>
                    )}
                  </div>
                )}

              <div
                className={`auth-field ${
                  emailFocused || email ? 'auth-field--active' : ''
                } ${emailHasError ? 'auth-field--error' : ''}`}
              >
                <label htmlFor="auth-email" className="auth-label">
                  Email address
                </label>
                <div className="auth-input-wrap">
                  <input
                    ref={emailRef}
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    required
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
                {emailHasError && (
                  <p className="auth-field-hint auth-field-hint--error">
                    Please enter a valid email address
                  </p>
                )}
              </div>

              <div
                className={`auth-field ${
                  passwordFocused || password ? 'auth-field--active' : ''
                } ${passwordHasError ? 'auth-field--error' : ''}`}
              >
                <label htmlFor="auth-password" className="auth-label">
                  Password
                </label>
                <div className="auth-input-wrap">
                  <input
                    ref={passwordRef}
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    required
                    minLength={6}
                    disabled={loading}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    tabIndex={-1}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {passwordHasError && (
                  <p className="auth-field-hint auth-field-hint--error">
                    Password must be at least 6 characters
                  </p>
                )}
              </div>

              {mode === 'login' && (
                <div className="auth-forgot-row">
                  <button type="button" className="auth-forgot-link" onClick={switchToForgot}>
                    Forgot password?
                  </button>
                </div>
              )}

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
                    <input
                      ref={confirmRef}
                      id="auth-confirm"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onFocus={() => setConfirmFocused(true)}
                      onBlur={() => setConfirmFocused(false)}
                      required
                      minLength={6}
                      disabled={loading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {confirmHasError && (
                    <p className="auth-field-hint auth-field-hint--error">
                      Passwords do not match
                    </p>
                  )}
                </div>
              )}
            </>
          )}

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
              <span>Please wait…</span>
            ) : mode === 'login' ? (
              <span>{inviteToken ? 'Join organization' : 'Sign In'}</span>
            ) : mode === 'signup' ? (
              <span>
                {inviteToken
                  ? 'Create account & join'
                  : accountType === 'organization'
                  ? 'Create organization account'
                  : 'Create personal account'}
              </span>
            ) : mode === 'confirm' ? (
              <span>Verify Code</span>
            ) : mode === 'forgot' ? (
              <span>Send Recovery Code</span>
            ) : (
              <span>Reset Password</span>
            )}
          </button>
        </form>

        <footer className="auth-footer">
          {mode === 'confirm' ? (
            <p>
              Wrong email?{' '}
              <button type="button" className="auth-footer-link" onClick={switchToSignup}>
                Go back
              </button>
            </p>
          ) : mode === 'forgot' ? (
            <p>
              Remember your password?{' '}
              <button type="button" className="auth-footer-link" onClick={switchToLogin}>
                Sign in
              </button>
            </p>
          ) : mode === 'reset' ? (
            <p>
              <button type="button" className="auth-footer-link" onClick={switchToLogin}>
                Back to Sign In
              </button>
            </p>
          ) : mode === 'login' ? (
            <p>
              Don&apos;t have an account?{' '}
              <button type="button" className="auth-footer-link" onClick={switchToSignup}>
                Create one
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button type="button" className="auth-footer-link" onClick={switchToLogin}>
                Sign in
              </button>
            </p>
          )}

          {mode === 'signup' && accountType === 'personal' && !inviteToken && (
            <p className="auth-footer-note">
              After creating an account you will receive a 6-digit confirmation code by email.
            </p>
          )}

          {mode === 'signup' && accountType === 'organization' && !inviteToken && (
            <p className="auth-footer-note">
              After the 6-digit code is verified, you can create your organization and invite members.
            </p>
          )}

          {inviteToken && (mode === 'login' || mode === 'signup') && (
            <p className="auth-footer-note">
              This invite link will attach your account to the organization after you sign in.
            </p>
          )}

          {mode === 'login' && !inviteToken && (
            <p className="auth-footer-note">
              {accountType === 'organization'
                ? 'Enter organization name + email/password to open that workspace.'
                : 'Secure access for laboratory chemical inventory management'}
            </p>
          )}
        </footer>
      </div>
    </div>
  )
}

export default Login