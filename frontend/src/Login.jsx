import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import appLogo from './assets/logo.jpg'
import './App.css'

/* ============================================================
   Login – Personal vs Organization intent
   Auth is always one Supabase user.
   "Personal" / "Organization" only sets post-login workspace intent.
   ============================================================ */

function Login({ onLogin }) {
  const [mode, setMode] = useState('login')
  // NEW: which path the user is taking
  const [accountType, setAccountType] = useState('personal') // 'personal' | 'organization'

  const [fullName, setFullName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

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

  const [fullNameFocused, setFullNameFocused] = useState(false)
  const [orgNameFocused, setOrgNameFocused] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [confirmFocused, setConfirmFocused] = useState(false)
  const [otpFocused, setOtpFocused] = useState(false)
  const [newPasswordFocused, setNewPasswordFocused] = useState(false)
  const [confirmNewFocused, setConfirmNewFocused] = useState(false)

  const formRef = useRef(null)
  const fullNameRef = useRef(null)
  const orgNameRef = useRef(null)
  const emailRef = useRef(null)
  const passwordRef = useRef(null)
  const confirmRef = useRef(null)
  const otpRef = useRef(null)
  const newPasswordRef = useRef(null)
  const confirmNewRef = useRef(null)

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
    const interval = setInterval(() => setResendCooldown((p) => p - 1), 1000)
    return () => clearInterval(interval)
  }, [resendCooldown])

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

  const canSubmitLogin = isEmailValid(email) && isPasswordValid(password) && !loading

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

  const nameHasError =
    formTouched && mode === 'signup' && fullName.length > 0 && !isNameValid(fullName)
  const orgNameHasError =
    formTouched &&
    mode === 'signup' &&
    accountType === 'organization' &&
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

  /** Remember intent for App.jsx after session is established */
  const persistWorkspaceIntent = (type, organizationName = '') => {
    const intent = {
      type, // 'personal' | 'organization'
      organizationName: organizationName || '',
      at: Date.now(),
    }
    try {
      localStorage.setItem('workspaceIntent', JSON.stringify(intent))
    } catch {
      // ignore
    }
  }

  const handleLogin = async () => {
    persistWorkspaceIntent(accountType)

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
    persistWorkspaceIntent(accountType, orgName.trim())

    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          account_type: accountType,
          pending_org_name:
            accountType === 'organization' ? orgName.trim() : null,
        },
      },
    })

    if (authError) throw authError

    setMode('confirm')
    setMessage(
      accountType === 'organization'
        ? 'Check your email for a 6-digit code. After confirmation you can set up your organization workspace.'
        : 'A 6-digit confirmation code has been sent to your email. Enter it below to activate your personal account.'
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
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    if (resetError) throw resetError

    setMode('reset')
    setMessage(
      'A 6-digit recovery code has been sent to your email. Enter it below together with your new password.'
    )
    setResendCooldown(60)
  }

  const handleResetPassword = async () => {
    const { error: otpError } = await supabase.auth.verifyOtp({
      email: email.trim(),
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
      else if (accountType === 'organization' && !isNameValid(orgName))
        setError('Please enter an organization name (at least 2 characters).')
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
      else if (!isPasswordValid(newPassword))
        setError('New password must be at least 6 characters long.')
      else if (!doNewPasswordsMatch) setError('New passwords do not match.')
      else setError('Please fill in all fields correctly.')
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
      let errorMessage =
        err?.message || err?.error_description || 'Something went wrong. Please try again.'

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
            {mode === 'login' &&
              (accountType === 'organization'
                ? 'Sign in to your organization workspace'
                : 'Sign in to your personal laboratory inventory')}
            {mode === 'signup' &&
              (accountType === 'organization'
                ? 'Create an account and set up your organization'
                : 'Create a personal account to get started')}
            {mode === 'confirm' && 'Enter the confirmation code sent to your email'}
            {mode === 'forgot' && 'Enter your email to receive a recovery code'}
            {mode === 'reset' && 'Enter the recovery code and your new password'}
          </p>
        </header>

        {/* Account type: Personal vs Organization */}
        {(mode === 'login' || mode === 'signup') && (
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
              background: 'var(--bg, rgba(15,23,42,0.04))',
              border: '1px solid var(--border, #e2e8f0)',
            }}
          >
            <button
              type="button"
              onClick={() => setAccountType('personal')}
              className={accountType === 'personal' ? 'auth-tab--active' : ''}
              style={{
                border: 0,
                borderRadius: 12,
                padding: '12px 10px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                background:
                  accountType === 'personal' ? 'var(--panel, #fff)' : 'transparent',
                boxShadow:
                  accountType === 'personal' ? '0 1px 4px rgba(15,23,42,0.08)' : 'none',
                color: 'var(--text, #0f172a)',
              }}
            >
              👤 Personal
            </button>
            <button
              type="button"
              onClick={() => setAccountType('organization')}
              className={accountType === 'organization' ? 'auth-tab--active' : ''}
              style={{
                border: 0,
                borderRadius: 12,
                padding: '12px 10px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                background:
                  accountType === 'organization' ? 'var(--panel, #fff)' : 'transparent',
                boxShadow:
                  accountType === 'organization' ? '0 1px 4px rgba(15,23,42,0.08)' : 'none',
                color: 'var(--text, #0f172a)',
              }}
            >
              🏢 Organization
            </button>
          </div>
        )}

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

        <form ref={formRef} className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* ... keep your existing confirm / reset / forgot blocks unchanged ... */}
          {/* For brevity in this answer: paste your existing confirm/reset/forgot JSX here */}

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
                      placeholder=" "
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

              {/* Organization name – only for org signup */}
              {mode === 'signup' && accountType === 'organization' && (
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
                      placeholder=" "
                      required
                      minLength={2}
                      disabled={loading}
                      autoComplete="organization"
                    />
                  </div>
                  {orgNameHasError && (
                    <p className="auth-field-hint auth-field-hint--error">
                      Please enter an organization name (minimum 2 characters)
                    </p>
                  )}
                  <p className="auth-field-hint" style={{ marginTop: 6, opacity: 0.75 }}>
                    You will be the owner. Invite colleagues after you sign in.
                  </p>
                </div>
              )}

              {/* Email + password + confirm: keep your existing fields */}
              {/* ... paste the rest of your login/signup fields, alerts, submit button, footer ... */}
            </>
          )}
        </form>
      </div>
    </div>
  )
}

export default Login