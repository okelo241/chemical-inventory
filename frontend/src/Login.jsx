import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import appLogo from './assets/logo.jpg'
import './App.css'

/* ============================================================
   Ultra-Modern Login Component – Chemical Inventory
   Features:
   - Personal / Organization workspace intent selector
   - Full Name + Email + Password + Confirm Password
   - Organization name (org signup only)
   - Organization name/slug on login (target a specific org)
   - Invite-aware: lock to org + branded UI when ?token= / invite props
   - 6-digit Email Confirmation Code (OTP) via Supabase Auth
   - Forgot Password / Reset Password flow
   - Advanced validation & accessibility
   - Glassmorphism + matching landing page aesthetic
   ============================================================ */

function Login({
  onLogin,
  // Optional invite props (preferred). Falls back to URL search params.
  inviteToken: inviteTokenProp = null,
  inviteOrgName: inviteOrgNameProp = null,
  inviteOrgSlug: inviteOrgSlugProp = null,
  // When true, user arrived via Supabase password-recovery link
  forceReset = false,
}) {
  // ============================================================
  // INVITE / URL DETECTION
  // ============================================================
  const urlParams =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : null

  const inviteToken =
    inviteTokenProp ||
    urlParams?.get('token') ||
    urlParams?.get('invite') ||
    null

  const inviteOrgName =
    inviteOrgNameProp ||
    urlParams?.get('orgName') ||
    urlParams?.get('org_name') ||
    null

  const inviteOrgSlug =
    inviteOrgSlugProp ||
    urlParams?.get('org') ||
    urlParams?.get('slug') ||
    null

  const isInviteFlow = Boolean(inviteToken)

  // Recovery link: ?type=recovery or hash type=recovery or sessionStorage flag
  const isRecoveryLink = (() => {
    if (forceReset) return true
    try {
      if (typeof window === 'undefined') return false
      const search = window.location.search || ''
      const hash = window.location.hash || ''
      if (search.includes('type=recovery') || hash.includes('type=recovery')) {
        return true
      }
      return sessionStorage.getItem('authRecovery') === '1'
    } catch {
      return false
    }
  })()

  // ============================================================
  // MODE MANAGEMENT
  // 'login' | 'signup' | 'confirm' | 'forgot' | 'reset'
  // ============================================================
  
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved === 'dark' || saved === 'light') return saved
    } catch { /* ignore */ }
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('theme', theme)
    } catch { /* ignore */ }
  }, [theme])

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'theme' && (e.newValue === 'dark' || e.newValue === 'light')) {
        setTheme(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))

  const [mode, setMode] = useState(isRecoveryLink ? 'reset' : 'login')

  // Workspace intent: 'personal' | 'organization'
  // Locked to organization when arriving via invite link.
  const [accountType, setAccountType] = useState(
    isInviteFlow ? 'organization' : 'personal'
  )

  // ============================================================
  // FORM FIELDS
  // ============================================================
  const [fullName, setFullName] = useState('')
  const [orgName, setOrgName] = useState(
    inviteOrgName || inviteOrgSlug || ''
  )
  // Used on Organization *login* to target a specific org by name/slug
  const [loginOrgIdentifier, setLoginOrgIdentifier] = useState(
    inviteOrgName || inviteOrgSlug || ''
  )
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
  const [loginOrgFocused, setLoginOrgFocused] = useState(false)
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
  const loginOrgRef = useRef(null)
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
    const timer = setTimeout(() => setCardVisible(true), 70)
    return () => clearTimeout(timer)
  }, [])

  // Password-reset email link → stay on reset form (do not enter inventory)
  useEffect(() => {
    if (!isRecoveryLink) return
    setMode('reset')
    setMessage(
      'You opened a password reset link. Choose a new password below to finish. You will then sign in with the new password.'
    )
    try {
      sessionStorage.setItem('authRecovery', '1')
    } catch {
      /* ignore */
    }
  }, [isRecoveryLink])

  // Supabase recovery session event
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        try {
          sessionStorage.setItem('authRecovery', '1')
        } catch {
          /* ignore */
        }
        setMode('reset')
        setMessage(
          'Recovery session active. Enter and confirm your new password below.'
        )
      }
    })
    return () => {
      try {
        sub?.subscription?.unsubscribe?.()
      } catch {
        /* ignore */
      }
    }
  }, [])

  // Keep account type locked to organization for invite links
  useEffect(() => {
    if (isInviteFlow) {
      setAccountType('organization')
      if (inviteOrgName || inviteOrgSlug) {
        setOrgName(inviteOrgName || inviteOrgSlug)
        setLoginOrgIdentifier(inviteOrgName || inviteOrgSlug)
      }
    }
  }, [isInviteFlow, inviteOrgName, inviteOrgSlug])

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

  // ============================================================
  // VALIDATION HELPERS
  // ============================================================
  const isEmailValid = useCallback((value) => {
    if (!value || typeof value !== 'string') return false
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  }, [])

  const isPasswordValid = useCallback((value) => {
    if (typeof value !== 'string' || value.length < 8) return false
    // Require letter + number for stronger accounts / invite resets
    if (!/[A-Za-z]/.test(value)) return false
    if (!/[0-9]/.test(value)) return false
    return true
  }, [])

  const passwordStrengthHint =
    'At least 8 characters, including a letter and a number'

  const isNameValid = useCallback((value) => {
    return typeof value === 'string' && value.trim().length >= 2
  }, [])

  const doPasswordsMatch =
    password === confirmPassword && confirmPassword.length > 0
  const doNewPasswordsMatch =
    newPassword === confirmNewPassword && confirmNewPassword.length > 0
  const isOtpValid =
    otpCode.trim().length === 6 && /^\d{6}$/.test(otpCode.trim())

  // ============================================================
  // WORKSPACE INTENT (read by App.jsx after session)
  // ============================================================
  const persistWorkspaceIntent = (
    type,
    organizationName = '',
    extra = {}
  ) => {
    const intent = {
      type, // 'personal' | 'organization'
      organizationName: organizationName || '',
      organizationSlug: extra.organizationSlug || '',
      inviteToken: extra.inviteToken || inviteToken || null,
      at: Date.now(),
    }
    try {
      localStorage.setItem('workspaceIntent', JSON.stringify(intent))
      localStorage.setItem(
        'accountMode',
        type === 'organization' ? 'organization' : 'personal'
      )
      if (intent.inviteToken) {
        localStorage.setItem('pendingInviteToken', intent.inviteToken)
      }
    } catch {
      // ignore storage errors
    }
  }

  // ============================================================
  // SUBMIT READINESS
  // ============================================================
  const canSubmitLogin =
    isEmailValid(email) && isPasswordValid(password) && !loading

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
    (isRecoveryLink || isOtpValid) &&
    isPasswordValid(newPassword) &&
    doNewPasswordsMatch &&
    !loading

  // ============================================================
  // FIELD ERROR FLAGS
  // ============================================================
  const nameHasError =
    formTouched &&
    mode === 'signup' &&
    fullName.length > 0 &&
    !isNameValid(fullName)

  const orgNameHasError =
    formTouched &&
    mode === 'signup' &&
    accountType === 'organization' &&
    orgName.length > 0 &&
    !isNameValid(orgName)

  const emailHasError =
    formTouched && email.length > 0 && !isEmailValid(email)

  const passwordHasError =
    formTouched && password.length > 0 && !isPasswordValid(password)

  const confirmHasError =
    formTouched &&
    mode === 'signup' &&
    confirmPassword.length > 0 &&
    !doPasswordsMatch

  const otpHasError =
    formTouched &&
    (mode === 'confirm' || mode === 'reset') &&
    otpCode.length > 0 &&
    !isOtpValid

  const newPasswordHasError =
    formTouched &&
    mode === 'reset' &&
    newPassword.length > 0 &&
    !isPasswordValid(newPassword)

  const confirmNewHasError =
    formTouched &&
    mode === 'reset' &&
    confirmNewPassword.length > 0 &&
    !doNewPasswordsMatch

  // ============================================================
  // DISPLAY HELPERS (org-branded copy)
  // ============================================================
  const displayOrgName =
    inviteOrgName ||
    loginOrgIdentifier.trim() ||
    orgName.trim() ||
    'your organization'

  // ============================================================
  // AUTH HANDLERS
  // ============================================================
  const handleLogin = async () => {
    const orgId =
      accountType === 'organization'
        ? loginOrgIdentifier.trim() || orgName.trim()
        : ''

    persistWorkspaceIntent(accountType, orgId, {
      organizationSlug: inviteOrgSlug || orgId,
      inviteToken,
    })

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

    persistWorkspaceIntent(accountType, cleanOrg, {
      organizationSlug: inviteOrgSlug || cleanOrg,
      inviteToken,
    })

    const { data, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          account_type: accountType,
          pending_org_name:
            accountType === 'organization' ? cleanOrg : null,
          invite_token: inviteToken || null,
        },
        emailRedirectTo:
          typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    })

    if (authError) throw authError

    const identities = data?.user?.identities
    if (
      data?.user &&
      Array.isArray(identities) &&
      identities.length === 0
    ) {
      throw new Error(
        'This email is already registered. Please sign in instead, or use Forgot password.'
      )
    }

    if (data?.session) {
      persistWorkspaceIntent(accountType, cleanOrg, {
        organizationSlug: inviteOrgSlug || cleanOrg,
        inviteToken,
      })
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
      isInviteFlow
        ? `A 6-digit confirmation code has been sent to your email. After you verify, you will join ${displayOrgName}. Check spam if you do not see it within a minute.`
        : accountType === 'organization'
        ? 'A 6-digit confirmation code has been sent to your email (from Supabase). After you verify, you can finish setting up your organization workspace. Check spam if you do not see it within a minute.'
        : 'A 6-digit confirmation code has been sent to your email (from Supabase). Please enter it below to activate your personal account. Check spam if you do not see it within a minute.'
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
      const orgId =
        accountType === 'organization'
          ? orgName.trim() || loginOrgIdentifier.trim()
          : ''
      persistWorkspaceIntent(accountType, orgId, {
        organizationSlug: inviteOrgSlug || orgId,
        inviteToken,
      })
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
    const origin =
      typeof window !== 'undefined' ? window.location.origin : ''
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      cleanEmail,
      {
        // App + Login detect type=recovery and show the reset-password screen
        redirectTo: origin ? `${origin}/?type=recovery` : undefined,
      }
    )

    if (resetError) throw resetError

    setMode('reset')
    setMessage(
      'Check your email for a reset link (or a 6-digit recovery code). Open the link to set a new password, or enter the code below.'
    )
    setResendCooldown(60)
  }

  const handleResetPassword = async () => {
    // Email recovery link already created a recovery session — only set password.
    // Otherwise verify the 6-digit OTP first.
    if (!isRecoveryLink) {
      const cleanEmail = email.trim().toLowerCase()
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: otpCode.trim(),
        type: 'recovery',
      })
      if (otpError) throw otpError
    } else {
      let {
        data: { session: recSession },
      } = await supabase.auth.getSession()
      if (!recSession) {
        // Try to recover session from URL hash (Supabase recovery links)
        try {
          const hash = typeof window !== 'undefined' ? window.location.hash || '' : ''
          if (hash.includes('access_token')) {
            const params = new URLSearchParams(hash.replace(/^#/, ''))
            const access_token = params.get('access_token')
            const refresh_token = params.get('refresh_token')
            if (access_token && refresh_token) {
              const { data: setData, error: setErr } =
                await supabase.auth.setSession({ access_token, refresh_token })
              if (!setErr) recSession = setData?.session
            }
          }
        } catch {
          /* ignore */
        }
      }
      if (!recSession) {
        throw new Error(
          'Reset link expired or already used. Sign in with your temporary password, open Profile, and set a new password there — or request a new reset email.'
        )
      }
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })
    if (updateError) throw updateError

    try {
      sessionStorage.removeItem('authRecovery')
    } catch {
      /* ignore */
    }

    setMessage(
      'Password updated successfully. Sign in with your new password.'
    )
    setMode('login')
    setOtpCode('')
    setNewPassword('')
    setConfirmNewPassword('')
    setPassword('')
    setFormTouched(false)

    try {
      sessionStorage.removeItem('authRecovery')
      const url = new URL(window.location.href)
      url.searchParams.delete('type')
      window.history.replaceState({}, document.title, url.pathname + url.search)
    } catch {
      /* ignore */
    }

    // End recovery session so the user signs in cleanly
    try {
      await supabase.auth.signOut()
    } catch {
      /* ignore */
    }
  }

  const handleResendCode = async () => {
    if (resendCooldown > 0 || loading) return

    setLoading(true)
    setError(null)
    setMessage(null)

    const cleanEmail = email.trim().toLowerCase()

    try {
      if (mode === 'confirm') {
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email: cleanEmail,
        })
        if (resendError) throw resendError
        setMessage(
          'A new confirmation code has been sent to your email. Check inbox and spam.'
        )
      } else if (mode === 'reset' || mode === 'forgot') {
        const { error: resendError } =
          await supabase.auth.resetPasswordForEmail(cleanEmail)
        if (resendError) throw resendError
        setMessage(
          'A new recovery code has been sent to your email. Check inbox and spam.'
        )
      }

      setResendCooldown(60)
      setOtpCode('')
    } catch (err) {
      setError(
        err?.message || 'Failed to resend code. Please try again in a minute.'
      )
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
        setError(
          'Please enter a valid email and a password of at least 6 characters.'
        )
        return
      }
    } else if (mode === 'signup') {
      if (!canSubmitSignup) {
        if (!isNameValid(fullName)) {
          setError('Please enter your full name (at least 2 characters).')
        } else if (accountType === 'organization' && !isNameValid(orgName)) {
          setError(
            'Please enter an organization name (at least 2 characters).'
          )
        } else if (!isEmailValid(email)) {
          setError('Please enter a valid email address.')
        } else if (!isPasswordValid(password)) {
          setError('Use 8+ characters with a letter and a number long.')
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
        if (!isRecoveryLink && !isOtpValid) {
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
        err?.message ||
        err?.error_description ||
        'Something went wrong. Please try again.'

      const lower = errorMessage.toLowerCase()
      if (lower.includes('email not confirmed')) {
        errorMessage =
          'Please confirm your email with the code we sent you before signing in.'
        setMode('confirm')
      } else if (
        lower.includes('token') ||
        lower.includes('otp') ||
        (lower.includes('invalid') &&
          (mode === 'confirm' || mode === 'reset'))
      ) {
        errorMessage =
          'Invalid or expired code. Please try again or request a new one.'
      } else if (
        lower.includes('already registered') ||
        lower.includes('already been registered') ||
        lower.includes('user already registered')
      ) {
        errorMessage =
          'This email is already registered. Please sign in instead.'
      } else if (lower.includes('rate limit') || lower.includes('too many')) {
        errorMessage =
          'Too many attempts. Please wait a minute before requesting another code.'
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

      <div
        className={`auth-card ${cardVisible ? 'auth-card--visible' : ''}`}
        role="main"
      >
        <header className="auth-header">
          <div className="auth-logo-wrap">
            <div className="auth-logo">
              <img
                src={appLogo}
                alt="Chemical Inventory"
                className="auth-logo-img"
              />
            </div>
            <div className="auth-logo-ring" aria-hidden="true" />
          </div>

          <h1 className="auth-title">
            {isInviteFlow ? displayOrgName : 'Chemical Inventory'}
          </h1>
          <p className="auth-subtitle">
            {isInviteFlow && mode === 'login' && (
              <>You&apos;ve been invited to join <strong>{displayOrgName}</strong>. Sign in to accept.</>
            )}
            {isInviteFlow && mode === 'signup' && (
              <>Create an account to join <strong>{displayOrgName}</strong></>
            )}
            {!isInviteFlow && mode === 'login' &&
              (accountType === 'organization'
                ? 'Sign in to your organization workspace'
                : 'Sign in to your personal laboratory inventory')}
            {!isInviteFlow && mode === 'signup' &&
              (accountType === 'organization'
                ? 'Create an account and set up your organization'
                : 'Create a personal account to get started')}
            {mode === 'confirm' &&
              'Enter the confirmation code sent to your email'}
            {mode === 'forgot' &&
              'Enter your email to receive a recovery code'}
            {mode === 'reset' &&
              (isRecoveryLink
                ? 'Choose a new password for your account'
                : 'Enter the recovery code and your new password')}
          </p>
        </header>

        {/* Account type selector – hidden when arriving via invite */}
        {(mode === 'login' || mode === 'signup') && !isInviteFlow && (
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
                background:
                  accountType === 'personal'
                    ? 'var(--panel, #ffffff)'
                    : 'transparent',
                boxShadow:
                  accountType === 'personal'
                    ? '0 1px 4px rgba(15, 23, 42, 0.08)'
                    : 'none',
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
                  accountType === 'organization'
                    ? 'var(--panel, #ffffff)'
                    : 'transparent',
                boxShadow:
                  accountType === 'organization'
                    ? '0 1px 4px rgba(15, 23, 42, 0.08)'
                    : 'none',
                color: 'var(--text, #0f172a)',
              }}
            >
              🏢 Organization
            </button>
          </div>
        )}

        {/* Org-branded invite panel — locked workspace */}
        {isInviteFlow && (mode === 'login' || mode === 'signup') && (
          <div className="auth-invite-panel" role="status">
            <div className="auth-invite-avatar" aria-hidden="true">
              {(displayOrgName || 'Org')
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase())
                .join('') || 'ORG'}
            </div>
            <div className="auth-invite-copy">
              <p className="auth-invite-kicker">Organization invite</p>
              <p className="auth-invite-name">{displayOrgName}</p>
              <p className="auth-invite-hint">
                {mode === 'login'
                  ? 'Sign in with the email that received the invite. Use the temporary password from the invite email, then change it under Profile.'
                  : 'Create your account with the invited email to join this organization workspace.'}
              </p>
            </div>
          </div>
        )}

        {mode === 'reset' && (
          <div className="auth-invite-panel auth-invite-panel--reset" role="status">
            <div className="auth-invite-avatar auth-invite-avatar--reset" aria-hidden="true">
              🔑
            </div>
            <div className="auth-invite-copy">
              <p className="auth-invite-kicker">Password reset</p>
              <p className="auth-invite-name">Set a new password</p>
              <p className="auth-invite-hint">
                {isRecoveryLink
                  ? 'This page stays on reset until you finish — you will not be taken into the inventory until you sign in again.'
                  : 'Enter the code from your email and choose a new password. Prefer opening the link in the email when possible.'}
              </p>
            </div>
          </div>
        )}

        {(mode === 'login' || mode === 'signup') && (
          <div
            className="auth-tabs"
            role="tablist"
            aria-label="Authentication mode"
          >
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
              {isInviteFlow ? 'Create account & join' : 'Create Account'}
            </button>
            <div
              className="auth-tab-indicator"
              style={{
                transform:
                  mode === 'login' ? 'translateX(0%)' : 'translateX(100%)',
              }}
              aria-hidden="true"
            />
          </div>
        )}

        <form
          ref={formRef}
          className="auth-form"
          onSubmit={handleSubmit}
          noValidate
        >
          {/* Confirm / Reset OTP block */}
          {(mode === 'confirm' || (mode === 'reset' && !isRecoveryLink)) && (
            <>
              <div className="auth-confirm-info">
                <p className="auth-confirm-label">
                  {mode === 'confirm'
                    ? 'We sent a 6-digit code to'
                    : 'We sent a recovery code to'}
                </p>
                <p className="auth-confirm-email">
                  {email.trim().toLowerCase()}
                </p>
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
                      const value = e.target.value
                        .replace(/\D/g, '')
                        .slice(0, 6)
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
                  <p
                    id="otp-error"
                    className="auth-field-hint auth-field-hint--error"
                  >
                    Please enter a valid 6-digit code
                  </p>
                )}
              </div>

              {mode === 'reset' && (
                <>
                  {/* New password + confirm – same as before */}
                  <div
                    className={`auth-field ${
                      newPasswordFocused || newPassword
                        ? 'auth-field--active'
                        : ''
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
                        minLength={8}
                        disabled={loading}
                        autoComplete="new-password"
                        aria-invalid={newPasswordHasError}
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        onClick={() =>
                          setShowNewPassword((prev) => !prev)
                        }
                        tabIndex={-1}
                        aria-label={
                          showNewPassword ? 'Hide password' : 'Show password'
                        }
                      >
                        {/* eye icons omitted for brevity – keep your existing SVGs */}
                        {showNewPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {newPasswordHasError && (
                      <p className="auth-field-hint auth-field-hint--error">
                        Use 8+ characters with a letter and a number
                      </p>
                    )}
                  </div>

                  <div
                    className={`auth-field ${
                      confirmNewFocused || confirmNewPassword
                        ? 'auth-field--active'
                        : ''
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
                        onChange={(e) =>
                          setConfirmNewPassword(e.target.value)
                        }
                        onFocus={() => setConfirmNewFocused(true)}
                        onBlur={() => setConfirmNewFocused(false)}
                        placeholder=" "
                        required
                        minLength={8}
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

          {/* Recovery link path: only new password (session already verified) */}
          {mode === 'reset' && isRecoveryLink && (
            <>
              <div
                className={`auth-field ${
                  newPasswordFocused || newPassword ? 'auth-field--active' : ''
                } ${newPasswordHasError ? 'auth-field--error' : ''}`}
              >
                <label htmlFor="auth-new-password-recovery" className="auth-label">
                  New Password
                </label>
                <div className="auth-input-wrap">
                  <input
                    ref={newPasswordRef}
                    id="auth-new-password-recovery"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onFocus={() => setNewPasswordFocused(true)}
                    onBlur={() => setNewPasswordFocused(false)}
                    placeholder=" "
                    required
                    minLength={8}
                    disabled={loading}
                    autoComplete="new-password"
                    autoFocus
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
                  <p className="auth-field-hint auth-field-hint--error">
                    Use 8+ characters with a letter and a number
                  </p>
                )}
              </div>
              <div
                className={`auth-field ${
                  confirmNewFocused || confirmNewPassword
                    ? 'auth-field--active'
                    : ''
                } ${confirmNewHasError ? 'auth-field--error' : ''}`}
              >
                <label htmlFor="auth-confirm-new-recovery" className="auth-label">
                  Confirm New Password
                </label>
                <div className="auth-input-wrap">
                  <input
                    ref={confirmNewRef}
                    id="auth-confirm-new-recovery"
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    onFocus={() => setConfirmNewFocused(true)}
                    onBlur={() => setConfirmNewFocused(false)}
                    placeholder=" "
                    required
                    minLength={8}
                    disabled={loading}
                    autoComplete="new-password"
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
                  {/* mail icon */}
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

          {(mode === 'login' || mode === 'signup') && (
            <>
              {/* Full name – signup only */}
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
                      {/* user icon */}
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
                    />
                  </div>
                  {nameHasError && (
                    <p className="auth-field-hint auth-field-hint--error">
                      Please enter your full name (minimum 2 characters)
                    </p>
                  )}
                </div>
              )}

              {/* Organization name – signup (create org) or locked invite */}
              {mode === 'signup' &&
                accountType === 'organization' &&
                !isInviteFlow && (
                  <div
                    className={`auth-field ${
                      orgNameFocused || orgName ? 'auth-field--active' : ''
                    } ${orgNameHasError ? 'auth-field--error' : ''}`}
                  >
                    <label htmlFor="auth-orgName" className="auth-label">
                      Organization name
                    </label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon" aria-hidden="true">
                        {/* building icon */}
                      </span>
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
                        aria-invalid={orgNameHasError}
                      />
                    </div>
                    {orgNameHasError ? (
                      <p className="auth-field-hint auth-field-hint--error">
                        Please enter an organization name (minimum 2
                        characters)
                      </p>
                    ) : (
                      <p
                        className="auth-field-hint"
                        style={{ marginTop: 6, opacity: 0.75 }}
                      >
                        You will be the owner. Invite colleagues after you
                        sign in.
                      </p>
                    )}
                  </div>
                )}

              {/* Organization name/slug – LOGIN only (target existing org) */}
              {mode === 'login' &&
                accountType === 'organization' &&
                !isInviteFlow && (
                  <div
                    className={`auth-field ${
                      loginOrgFocused || loginOrgIdentifier
                        ? 'auth-field--active'
                        : ''
                    }`}
                  >
                    <label htmlFor="auth-login-org" className="auth-label">
                      Organization name or slug
                    </label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon" aria-hidden="true">
                        {/* building icon */}
                      </span>
                      <input
                        ref={loginOrgRef}
                        id="auth-login-org"
                        type="text"
                        value={loginOrgIdentifier}
                        onChange={(e) =>
                          setLoginOrgIdentifier(e.target.value)
                        }
                        onFocus={() => setLoginOrgFocused(true)}
                        onBlur={() => setLoginOrgFocused(false)}
                        placeholder=" "
                        disabled={loading}
                        autoComplete="organization"
                      />
                    </div>
                    <p
                      className="auth-field-hint"
                      style={{ marginTop: 6, opacity: 0.75 }}
                    >
                      Optional. Enter the organization you want to open after
                      sign-in.
                    </p>
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
                    {/* mail icon */}
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
                  />
                </div>
                {emailHasError && (
                  <p className="auth-field-hint auth-field-hint--error">
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
                    {/* lock icon */}
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
                    minLength={8}
                    disabled={loading}
                    autoComplete={
                      mode === 'login' ? 'current-password' : 'new-password'
                    }
                    aria-invalid={passwordHasError}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    tabIndex={-1}
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {passwordHasError && (
                  <p className="auth-field-hint auth-field-hint--error">
                    Use 8+ characters with a letter and a number
                  </p>
                )}
              </div>

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

              {/* Confirm password – signup */}
              {mode === 'signup' && (
                <div
                  className={`auth-field ${
                    confirmFocused || confirmPassword
                      ? 'auth-field--active'
                      : ''
                  } ${confirmHasError ? 'auth-field--error' : ''}`}
                >
                  <label htmlFor="auth-confirm" className="auth-label">
                    Confirm Password
                  </label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon" aria-hidden="true">
                      {/* lock icon */}
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
                      minLength={8}
                      disabled={loading}
                      autoComplete="new-password"
                      aria-invalid={confirmHasError}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() =>
                        setShowConfirmPassword((prev) => !prev)
                      }
                      tabIndex={-1}
                      aria-label={
                        showConfirmPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
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
              <>
                <span className="auth-spinner" aria-hidden="true" />
                <span>Please wait…</span>
              </>
            ) : mode === 'login' ? (
              <span>
                {isInviteFlow
                  ? `Sign in & join ${displayOrgName}`
                  : 'Sign In'}
              </span>
            ) : mode === 'signup' ? (
              <span>
                {isInviteFlow
                  ? `Create account & join ${displayOrgName}`
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
                {isInviteFlow ? 'Create one & join' : 'Create one'}
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

          {isInviteFlow && (mode === 'login' || mode === 'signup') && (
            <p className="auth-footer-note">
              After you sign in or create an account, you will be added to{' '}
              <strong>{displayOrgName}</strong> automatically.
            </p>
          )}

          {!isInviteFlow && mode === 'login' && accountType === 'organization' && (
            <p className="auth-footer-note">
              Enter the organization name/slug to open that workspace after
              sign-in. Personal and Organization share the same login.
            </p>
          )}

          {!isInviteFlow && mode === 'signup' && accountType === 'personal' && (
            <p className="auth-footer-note">
              After creating an account you will receive a 6-digit confirmation
              code by email (sent by Supabase Auth).
            </p>
          )}

          {!isInviteFlow &&
            mode === 'signup' &&
            accountType === 'organization' && (
              <p className="auth-footer-note">
                Organization signup uses the same email confirmation as
                personal accounts. After the code is verified you can create
                your organization and invite members.
              </p>
            )}
        </footer>
      </div>
    </div>
  )
}

export default Login