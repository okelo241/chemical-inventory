import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Landing from './Landing'
import './App.css'

/* ─────────────────────────────────────────────────────────────
   Constants & Helpers
───────────────────────────────────────────────────────────── */

const HAZARD_OPTIONS = [
  { id: 'explosive', label: 'Explosive', emoji: '💥', color: '#ef4444' },
  { id: 'flammable', label: 'Flammable', emoji: '🔥', color: '#f97316' },
  { id: 'oxidizing', label: 'Oxidizing', emoji: '⚗️', color: '#eab308' },
  { id: 'gas', label: 'Compressed Gas', emoji: '🧴', color: '#3b82f6' },
  { id: 'corrosive', label: 'Corrosive', emoji: '🧪', color: '#a855f7' },
  { id: 'toxic', label: 'Toxic', emoji: '☠️', color: '#64748b' },
  { id: 'harmful', label: 'Harmful / Irritant', emoji: '⚠️', color: '#f59e0b' },
  { id: 'health', label: 'Health Hazard', emoji: '🫁', color: '#ec4899' },
  { id: 'environmental', label: 'Environmental', emoji: '🌍', color: '#22c55e' },
]

const UNITS = ['g', 'mg', 'kg', 'ml', 'L', 'µl', 'mol']
const SORT_OPTIONS = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'quantity', label: 'Quantity (High → Low)' },
  { value: 'quantity-asc', label: 'Quantity (Low → High)' },
  { value: 'expiry', label: 'Expiry (Soonest)' },
  { value: 'expiry-desc', label: 'Expiry (Latest)' },
  { value: 'location', label: 'Location' },
  { value: 'updated', label: 'Recently Updated' },
]

const FILTER_PRESETS = [
  { id: 'all', label: 'All Chemicals', icon: '📦' },
  { id: 'low', label: 'Low Stock', icon: '📉' },
  { id: 'soon', label: 'Expiring Soon', icon: '⏳' },
  { id: 'expired', label: 'Expired', icon: '🚫' },
  { id: 'no-sds', label: 'Missing SDS', icon: '📄' },
]

const EMPTY_FORM = {
  name: '',
  cas_number: '',
  quantity: '',
  unit: 'g',
  location: '',
  expiry_date: '',
  min_stock: '',
  hazard_notes: '',
  molecular_formula: '',
  hazard_symbols: [],
}

const daysUntil = (dateStr) => {
  if (!dateStr) return null
  const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)
  return Math.ceil(diff)
}

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const isExpired = (c) => c.expiry_date && daysUntil(c.expiry_date) < 0
const isLow = (c) => Number(c.quantity) <= Number(c.min_stock || 0)
const isExpiringSoon = (c) => {
  const d = daysUntil(c.expiry_date)
  return d !== null && d >= 0 && d <= 30
}

/* ─────────────────────────────────────────────────────────────
   Main App Component
───────────────────────────────────────────────────────────── */

function App() {
  // ── Auth & Session ──────────────────────────────────────
  const [session, setSession] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [showLogin, setShowLogin] = useState(false)

  // ── Data ────────────────────────────────────────────────
  const [chemicals, setChemicals] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // ── UI State ────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode') || 'table')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [message, setMessage] = useState(null)
  const [commandOpen, setCommandOpen] = useState(false)
  const [hazardLegendOpen, setHazardLegendOpen] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)

  // ── Notifications ───────────────────────────────────────
  const [notifications, setNotifications] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => localStorage.getItem('notificationsEnabled') !== 'false'
  )

  // ── Usage / Transaction Log ─────────────────────────────
  const [showUsageModal, setShowUsageModal] = useState(false)
  const [usageChem, setUsageChem] = useState(null)
  const [usageForm, setUsageForm] = useState({
    type: 'take',
    quantity: '',
    notes: '',
  })
  const [showHistory, setShowHistory] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('all')
  const [historySearch, setHistorySearch] = useState('')
  const [loggingUsage, setLoggingUsage] = useState(false)

  // ── Theme ───────────────────────────────────────────────
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  // ── Form ────────────────────────────────────────────────
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})

  // ── Refs ────────────────────────────────────────────────
  const searchRef = useRef(null)
  const formRef = useRef(null)
  const toastTimeout = useRef(null)
  const notifRef = useRef(null)

  const API_URL = import.meta.env.VITE_API_URL

  /* ─────────────────────────────────────────────────────────
     Theme
  ───────────────────────────────────────────────────────── */

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode)
  }, [viewMode])

  /* ─────────────────────────────────────────────────────────
     Auth
  ───────────────────────────────────────────────────────── */

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoadingAuth(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setChemicals([])
    setTransactions([])
    setSelectedIds(new Set())
    setShowLogin(false)
    setShowForm(false)
    setNotifications([])
  }

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token
  }, [])

  /* ─────────────────────────────────────────────────────────
     Toasts
  ───────────────────────────────────────────────────────── */

  const showMessage = useCallback((type, text) => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current)
    setMessage({ type, text, id: Date.now() })
    toastTimeout.current = setTimeout(() => setMessage(null), 3800)
  }, [])

  /* ─────────────────────────────────────────────────────────
     Notifications
  ───────────────────────────────────────────────────────── */

  const createNotification = (type, title, message, chemId = null) => {
    const id = `${type}-${chemId || Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    return {
      id,
      type,
      title,
      message,
      chemId,
      createdAt: new Date().toISOString(),
      read: false,
    }
  }

  const checkAndNotify = useCallback(
    (chems) => {
      if (!notificationsEnabled || !chems?.length) return

      const newNotifs = []

      chems.forEach((c) => {
        if (isExpired(c)) {
          newNotifs.push(
            createNotification(
              'expired',
              'Chemical Expired',
              `"${c.name}" expired on ${formatDate(c.expiry_date)}`,
              c.id
            )
          )
        } else if (isExpiringSoon(c)) {
          const days = daysUntil(c.expiry_date)
          newNotifs.push(
            createNotification(
              'soon',
              'Expiring Soon',
              `"${c.name}" expires in ${days} day${days !== 1 ? 's' : ''}`,
              c.id
            )
          )
        }

        if (isLow(c)) {
          newNotifs.push(
            createNotification(
              'low',
              'Low Stock',
              `"${c.name}" is low (${c.quantity} ${c.unit} left)`,
              c.id
            )
          )
        }
      })

      setNotifications((prev) => {
        const existingKeys = new Set(prev.map((n) => `${n.type}-${n.chemId}`))
        const uniqueNew = newNotifs.filter((n) => !existingKeys.has(`${n.type}-${n.chemId}`))

        if (uniqueNew.length === 0) return prev

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          uniqueNew.forEach((n) => {
            try {
              new Notification(n.title, {
                body: n.message,
                tag: n.id,
              })
            } catch (e) {}
          })
        }

        return [...uniqueNew, ...prev].slice(0, 50)
      })
    },
    [notificationsEnabled]
  )

  useEffect(() => {
    if (chemicals.length > 0) checkAndNotify(chemicals)
  }, [chemicals, checkAndNotify])

  useEffect(() => {
    const interval = setInterval(() => {
      if (chemicals.length > 0) checkAndNotify(chemicals)
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [chemicals, checkAndNotify])

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      showMessage('error', 'This browser does not support notifications')
      return
    }
    const permission = await Notification.requestPermission()
    setNotifPermission(permission)
    if (permission === 'granted') {
      showMessage('success', 'Browser notifications enabled')
      setNotificationsEnabled(true)
      localStorage.setItem('notificationsEnabled', 'true')
      checkAndNotify(chemicals)
    } else {
      showMessage('error', 'Notification permission denied')
    }
  }

  const toggleNotifications = () => {
    const next = !notificationsEnabled
    setNotificationsEnabled(next)
    localStorage.setItem('notificationsEnabled', String(next))
    if (next && notifPermission !== 'granted') {
      requestNotificationPermission()
    }
  }

  const markAsRead = (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const clearNotifications = () => setNotifications([])

  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notifOpen])

  /* ─────────────────────────────────────────────────────────
     API Layer
  ───────────────────────────────────────────────────────── */

  const fetchChemicals = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true)
        else setRefreshing(true)

        const token = await getAccessToken()
        const res = await fetch(`${API_URL}/chemicals`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setChemicals(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error(err)
        showMessage('error', 'Could not load chemicals. Check your connection.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [API_URL, getAccessToken, showMessage]
  )

  const fetchTransactions = useCallback(async () => {
    try {
      const token = await getAccessToken()
      const res = await fetch(`${API_URL}/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setTransactions(Array.isArray(data) ? data : [])
    } catch (err) {
      // Backend may not have this endpoint yet – fail silently
      console.warn('Could not load transactions')
    }
  }, [API_URL, getAccessToken])

  useEffect(() => {
    if (session) {
      fetchChemicals()
      fetchTransactions()
    }
  }, [session, fetchChemicals, fetchTransactions])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errors = {}
    if (!formData.name.trim()) errors.name = 'Name is required'
    if (formData.quantity !== '' && isNaN(Number(formData.quantity))) {
      errors.quantity = 'Must be a number'
    }
    if (formData.min_stock !== '' && isNaN(Number(formData.min_stock))) {
      errors.min_stock = 'Must be a number'
    }
    setFormErrors(errors)
    if (Object.keys(errors).length) return

    setSubmitting(true)
    const token = await getAccessToken()

    const payload = {
      name: formData.name.trim(),
      cas_number: formData.cas_number.trim() || null,
      quantity: parseFloat(formData.quantity) || 0,
      unit: formData.unit,
      location: formData.location.trim() || null,
      expiry_date: formData.expiry_date || null,
      min_stock: parseFloat(formData.min_stock) || 0,
      hazard_notes: formData.hazard_notes.trim() || null,
      molecular_formula: formData.molecular_formula.trim() || null,
      hazard_symbols: formData.hazard_symbols.length ? formData.hazard_symbols : null,
    }

    try {
      const url = editingId ? `${API_URL}/chemicals/${editingId}` : `${API_URL}/chemicals`
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error()
      showMessage('success', editingId ? 'Chemical updated successfully' : 'Chemical added')
      resetForm()
      fetchChemicals(true)
    } catch (err) {
      showMessage('error', 'Something went wrong while saving')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}" permanently?`)) return
    const token = await getAccessToken()
    try {
      const res = await fetch(`${API_URL}/chemicals/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      showMessage('success', `"${name}" deleted`)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      fetchChemicals(true)
    } catch (err) {
      showMessage('error', 'Failed to delete')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Delete ${selectedIds.size} selected chemical(s)?`)) return

    const token = await getAccessToken()
    let success = 0
    for (const id of selectedIds) {
      try {
        const res = await fetch(`${API_URL}/chemicals/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) success++
      } catch (_) {}
    }
    showMessage('success', `Deleted ${success} chemical(s)`)
    setSelectedIds(new Set())
    setBulkMode(false)
    fetchChemicals(true)
  }

  const handleSdsUpload = async (id, file) => {
    if (!file || file.type !== 'application/pdf') {
      showMessage('error', 'Only PDF files are allowed')
      return
    }

    setUploadProgress((p) => ({ ...p, [id]: 10 }))
    const token = await getAccessToken()
    const fd = new FormData()
    fd.append('file', file)

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((p) => {
          const current = p[id] || 10
          if (current >= 90) {
            clearInterval(progressInterval)
            return p
          }
          return { ...p, [id]: current + 15 }
        })
      }, 200)

      const res = await fetch(`${API_URL}/chemicals/${id}/upload-sds`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })

      clearInterval(progressInterval)
      setUploadProgress((p) => ({ ...p, [id]: 100 }))

      if (!res.ok) throw new Error()
      showMessage('success', 'SDS uploaded successfully')
      setTimeout(() => {
        setUploadProgress((p) => {
          const next = { ...p }
          delete next[id]
          return next
        })
      }, 600)
      fetchChemicals(true)
    } catch (err) {
      setUploadProgress((p) => {
        const next = { ...p }
        delete next[id]
        return next
      })
      showMessage('error', 'SDS upload failed')
    }
  }

  const handleDownloadSds = async (id) => {
    const token = await getAccessToken()
    try {
      const res = await fetch(`${API_URL}/chemicals/${id}/sds`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.url) window.open(data.url, '_blank')
      else showMessage('error', 'SDS file not found')
    } catch (err) {
      showMessage('error', 'Download failed')
    }
  }

  /* ─────────────────────────────────────────────────────────
     Usage / Transaction Log
  ───────────────────────────────────────────────────────── */

  const openUsageModal = (chem) => {
    setUsageChem(chem)
    setUsageForm({ type: 'take', quantity: '', notes: '' })
    setShowUsageModal(true)
  }

  const handleLogUsage = async (e) => {
    e.preventDefault()
    if (!usageChem) return

    const qty = parseFloat(usageForm.quantity)
    if (!qty || qty <= 0) {
      showMessage('error', 'Please enter a valid quantity')
      return
    }

    setLoggingUsage(true)
    const token = await getAccessToken()

    let quantityChange = 0
    if (usageForm.type === 'take') quantityChange = -qty
    else if (usageForm.type === 'return') quantityChange = qty
    else if (usageForm.type === 'adjust') quantityChange = qty - Number(usageChem.quantity)

    const newQuantity = Math.max(0, Number(usageChem.quantity) + quantityChange)

    try {
      // 1. Update chemical quantity
      const updateRes = await fetch(`${API_URL}/chemicals/${usageChem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...usageChem,
          quantity: newQuantity,
        }),
      })
      if (!updateRes.ok) throw new Error('Failed to update quantity')

      // 2. Create transaction record
      const txPayload = {
        chemical_id: usageChem.id,
        chemical_name: usageChem.name,
        type: usageForm.type,
        quantity_change: quantityChange,
        quantity_before: Number(usageChem.quantity),
        quantity_after: newQuantity,
        unit: usageChem.unit,
        notes: usageForm.notes.trim() || null,
        user_email: session.user.email,
      }

      try {
        await fetch(`${API_URL}/transactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(txPayload),
        })
      } catch (_) {
        // If backend doesn't support transactions yet, still continue
      }

      // Optimistic local update
      setTransactions((prev) => [
        {
          id: `local-${Date.now()}`,
          ...txPayload,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ])

      showMessage(
        'success',
        usageForm.type === 'take'
          ? `Took ${qty} ${usageChem.unit} of ${usageChem.name}`
          : usageForm.type === 'return'
          ? `Returned ${qty} ${usageChem.unit} of ${usageChem.name}`
          : `Adjusted ${usageChem.name} to ${newQuantity} ${usageChem.unit}`
      )

      setShowUsageModal(false)
      setUsageChem(null)
      fetchChemicals(true)
      fetchTransactions()
    } catch (err) {
      showMessage('error', 'Failed to log usage')
    } finally {
      setLoggingUsage(false)
    }
  }

  const filteredTransactions = useMemo(() => {
    let list = [...transactions]

    if (historyFilter !== 'all') {
      list = list.filter((t) => t.type === historyFilter)
    }

    if (historySearch.trim()) {
      const q = historySearch.toLowerCase()
      list = list.filter(
        (t) =>
          t.chemical_name?.toLowerCase().includes(q) ||
          t.user_email?.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q)
      )
    }

    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [transactions, historyFilter, historySearch])

  /* ─────────────────────────────────────────────────────────
     Form Helpers
  ───────────────────────────────────────────────────────── */

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const toggleHazard = (id) => {
    setFormData((prev) => {
      const current = prev.hazard_symbols || []
      if (current.includes(id)) {
        return { ...prev, hazard_symbols: current.filter((h) => h !== id) }
      }
      return { ...prev, hazard_symbols: [...current, id] }
    })
  }

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM })
    setFormErrors({})
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (chem) => {
    setFormData({
      name: chem.name || '',
      cas_number: chem.cas_number || '',
      quantity: chem.quantity ?? '',
      unit: chem.unit || 'g',
      location: chem.location || '',
      expiry_date: chem.expiry_date || '',
      min_stock: chem.min_stock ?? '',
      hazard_notes: chem.hazard_notes || '',
      molecular_formula: chem.molecular_formula || '',
      hazard_symbols: chem.hazard_symbols || [],
    })
    setEditingId(chem.id)
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  /* ─────────────────────────────────────────────────────────
     Selection & Bulk
  ───────────────────────────────────────────────────────── */

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)))
    }
  }

  /* ─────────────────────────────────────────────────────────
     Filtering & Sorting
  ───────────────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()

    let result = chemicals.filter((c) => {
      const matchesSearch =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.cas_number?.toLowerCase().includes(q) ||
        c.molecular_formula?.toLowerCase().includes(q) ||
        c.hazard_notes?.toLowerCase().includes(q) ||
        c.location?.toLowerCase().includes(q)

      if (!matchesSearch) return false

      if (filter === 'low') return isLow(c)
      if (filter === 'expired') return isExpired(c)
      if (filter === 'soon') return isExpiringSoon(c)
      if (filter === 'no-sds') return !c.sds_filename
      return true
    })

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '')
        case 'name-desc':
          return (b.name || '').localeCompare(a.name || '')
        case 'quantity':
          return (b.quantity || 0) - (a.quantity || 0)
        case 'quantity-asc':
          return (a.quantity || 0) - (b.quantity || 0)
        case 'expiry':
          if (!a.expiry_date) return 1
          if (!b.expiry_date) return -1
          return new Date(a.expiry_date) - new Date(b.expiry_date)
        case 'expiry-desc':
          if (!a.expiry_date) return 1
          if (!b.expiry_date) return -1
          return new Date(b.expiry_date) - new Date(a.expiry_date)
        case 'location':
          return (a.location || '').localeCompare(b.location || '')
        case 'updated':
          return new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
        default:
          return 0
      }
    })

    return result
  }, [chemicals, search, filter, sortBy])

  /* ─────────────────────────────────────────────────────────
     Stats
  ───────────────────────────────────────────────────────── */

  const stats = useMemo(() => {
    const total = chemicals.length
    const low = chemicals.filter(isLow).length
    const expired = chemicals.filter(isExpired).length
    const soon = chemicals.filter(isExpiringSoon).length
    const missingSds = chemicals.filter((c) => !c.sds_filename).length
    return { total, low, expired, soon, missingSds }
  }, [chemicals])

  /* ─────────────────────────────────────────────────────────
     Keyboard Shortcuts
  ───────────────────────────────────────────────────────── */

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen((v) => !v)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && session) {
        e.preventDefault()
        resetForm()
        setShowForm(true)
      }
      if (e.key === 'Escape') {
        setCommandOpen(false)
        setHazardLegendOpen(false)
        setNotifOpen(false)
        setShowUsageModal(false)
        setShowHistory(false)
        if (showForm) resetForm()
      }
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [session, showForm])

  /* ─────────────────────────────────────────────────────────
     Render Guards
  ───────────────────────────────────────────────────────── */

  if (loadingAuth) {
    return (
      <div className="loading-screen">
        <div className="spinner-lg" />
        <p>Loading Chemical Inventory…</p>
      </div>
    )
  }

  if (!session) {
    if (!showLogin) return <Landing onGetStarted={() => setShowLogin(true)} />
    return <Login onLogin={setSession} />
  }

  /* ─────────────────────────────────────────────────────────
     Main Render
  ───────────────────────────────────────────────────────── */

  return (
    <div className="app">
      {/* Toast */}
      {message && (
        <div className={`toast toast-${message.type}`} key={message.id}>
          <span className="toast-icon">{message.type === 'success' ? '✓' : '✕'}</span>
          <span>{message.text}</span>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <div className="logo">⚗️</div>
          <div>
            <h1>Chemical Inventory</h1>
            <p className="subtitle">Stock • Hazards • SDS • Compliance</p>
          </div>
        </div>

        <div className="header-actions">
          {/* Notification Bell */}
          <div className="notif-wrapper" ref={notifRef}>
            <button
              className="icon-btn notif-btn"
              onClick={() => setNotifOpen((v) => !v)}
              title="Notifications"
            >
              🔔
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </button>

            {notifOpen && (
              <div className="notif-dropdown">
                <div className="notif-header">
                  <strong>Notifications</strong>
                  <div className="notif-actions">
                    <button onClick={markAllRead}>Mark all read</button>
                    <button onClick={clearNotifications}>Clear</button>
                  </div>
                </div>

                <div className="notif-list">
                  {notifications.length === 0 ? (
                    <div className="notif-empty">No notifications</div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`notif-item ${n.read ? 'read' : ''} type-${n.type}`}
                        onClick={() => markAsRead(n.id)}
                      >
                        <div className="notif-title">
                          {n.type === 'low' && '📉 '}
                          {n.type === 'soon' && '⏳ '}
                          {n.type === 'expired' && '🚫 '}
                          {n.title}
                        </div>
                        <div className="notif-message">{n.message}</div>
                        <div className="notif-time">
                          {new Date(n.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="notif-footer">
                  <label className="notif-toggle">
                    <input
                      type="checkbox"
                      checked={notificationsEnabled}
                      onChange={toggleNotifications}
                    />
                    Enable notifications
                  </label>
                  {notifPermission !== 'granted' && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={requestNotificationPermission}
                    >
                      Allow browser notifications
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            className="icon-btn"
            onClick={() => setShowHistory(true)}
            title="Usage History"
          >
            📋
          </button>

          <button
            className="icon-btn"
            onClick={() => setCommandOpen(true)}
            title="Command palette (⌘K)"
          >
            ⌘K
          </button>
          <button className="icon-btn theme-toggle" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <div className="user-chip">
            <span className="user-email">{session.user.email}</span>
          </div>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Logout
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
          >
            + Add Chemical
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className={`stat-card ${stats.low ? 'warning' : ''}`}>
          <span className="stat-value">{stats.low}</span>
          <span className="stat-label">Low Stock</span>
        </div>
        <div className={`stat-card ${stats.soon ? 'caution' : ''}`}>
          <span className="stat-value">{stats.soon}</span>
          <span className="stat-label">Expiring Soon</span>
        </div>
        <div className={`stat-card ${stats.expired ? 'danger' : ''}`}>
          <span className="stat-value">{stats.expired}</span>
          <span className="stat-label">Expired</span>
        </div>
        <div className={`stat-card ${stats.missingSds ? 'muted' : ''}`}>
          <span className="stat-value">{stats.missingSds}</span>
          <span className="stat-label">Missing SDS</span>
        </div>
        {refreshing && <div className="refresh-indicator">Refreshing…</div>}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrapper">
          <span className="search-icon">🔍</span>
          <input
            ref={searchRef}
            className="search-input"
            placeholder="Search name, CAS, formula, location, hazards…  (press / )"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="clear-btn" onClick={() => setSearch('')}>
              ✕
            </button>
          )}
        </div>

        <div className="filter-pills">
          {FILTER_PRESETS.map((p) => (
            <button
              key={p.id}
              className={`pill ${filter === p.id ? 'active' : ''}`}
              onClick={() => setFilter(p.id)}
            >
              <span>{p.icon}</span> {p.label}
            </button>
          ))}
        </div>

        <div className="toolbar-right">
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <div className="view-toggle">
            <button
              className={viewMode === 'table' ? 'active' : ''}
              onClick={() => setViewMode('table')}
              title="Table view"
            >
              ☰
            </button>
            <button
              className={viewMode === 'cards' ? 'active' : ''}
              onClick={() => setViewMode('cards')}
              title="Card view"
            >
              ▦
            </button>
          </div>

          <button
            className={`btn btn-ghost ${bulkMode ? 'active' : ''}`}
            onClick={() => {
              setBulkMode((v) => !v)
              if (bulkMode) setSelectedIds(new Set())
            }}
          >
            {bulkMode ? 'Cancel Select' : 'Select'}
          </button>

          <button
            className="icon-btn"
            onClick={() => setHazardLegendOpen(true)}
            title="Hazard legend"
          >
            ℹ️
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="bulk-bar">
          <span>{selectedIds.size} selected</span>
          <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>
            Delete Selected
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>
            Clear
          </button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="form-overlay" onClick={(e) => e.target === e.currentTarget && resetForm()}>
          <div className="form-panel" ref={formRef}>
            <div className="form-header">
              <h2>{editingId ? 'Edit Chemical' : 'Add New Chemical'}</h2>
              <button className="icon-btn" onClick={resetForm}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-grid">
                <div className={`form-group ${formErrors.name ? 'error' : ''}`}>
                  <label>Name *</label>
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Sulfuric Acid"
                    autoFocus
                  />
                  {formErrors.name && <span className="error-text">{formErrors.name}</span>}
                </div>

                <div className="form-group">
                  <label>CAS Number</label>
                  <input
                    name="cas_number"
                    value={formData.cas_number}
                    onChange={handleChange}
                    placeholder="e.g. 7664-93-9"
                  />
                </div>

                <div className="form-group">
                  <label>Molecular Formula</label>
                  <input
                    name="molecular_formula"
                    value={formData.molecular_formula}
                    onChange={handleChange}
                    placeholder="e.g. H₂SO₄"
                  />
                </div>

                <div className={`form-group ${formErrors.quantity ? 'error' : ''}`}>
                  <label>Quantity</label>
                  <input
                    name="quantity"
                    type="number"
                    step="any"
                    value={formData.quantity}
                    onChange={handleChange}
                  />
                  {formErrors.quantity && <span className="error-text">{formErrors.quantity}</span>}
                </div>

                <div className="form-group">
                  <label>Unit</label>
                  <select name="unit" value={formData.unit} onChange={handleChange}>
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Location</label>
                  <input
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="e.g. Cabinet A / Shelf 3"
                  />
                </div>

                <div className="form-group">
                  <label>Expiry Date</label>
                  <input
                    name="expiry_date"
                    type="date"
                    value={formData.expiry_date}
                    onChange={handleChange}
                  />
                </div>

                <div className={`form-group ${formErrors.min_stock ? 'error' : ''}`}>
                  <label>Min Stock Level</label>
                  <input
                    name="min_stock"
                    type="number"
                    step="any"
                    value={formData.min_stock}
                    onChange={handleChange}
                  />
                  {formErrors.min_stock && (
                    <span className="error-text">{formErrors.min_stock}</span>
                  )}
                </div>

                <div className="form-group full">
                  <label>Hazard Notes</label>
                  <input
                    name="hazard_notes"
                    value={formData.hazard_notes}
                    onChange={handleChange}
                    placeholder="Extra safety notes…"
                  />
                </div>
              </div>

              <div className="hazard-selector">
                <label>Hazard Symbols</label>
                <div className="hazard-grid">
                  {HAZARD_OPTIONS.map((h) => {
                    const active = formData.hazard_symbols?.includes(h.id)
                    return (
                      <button
                        type="button"
                        key={h.id}
                        className={`hazard-chip ${active ? 'active' : ''}`}
                        onClick={() => toggleHazard(h.id)}
                        style={{
                          borderColor: active ? h.color : undefined,
                          background: active ? `${h.color}22` : undefined,
                        }}
                      >
                        <span className="hazard-emoji">{h.emoji}</span>
                        <span>{h.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : editingId ? 'Update Chemical' : 'Save Chemical'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Usage Modal */}
      {showUsageModal && usageChem && (
        <div
          className="form-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowUsageModal(false)}
        >
          <div className="form-panel" style={{ maxWidth: 480 }}>
            <div className="form-header">
              <h2>Log Usage</h2>
              <button className="icon-btn" onClick={() => setShowUsageModal(false)}>
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--bg)', borderRadius: 10 }}>
              <strong>{usageChem.name}</strong>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Current stock: {usageChem.quantity} {usageChem.unit}
              </div>
            </div>

            <form onSubmit={handleLogUsage}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Action</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['take', 'return', 'adjust'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`btn ${usageForm.type === t ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setUsageForm((f) => ({ ...f, type: t }))}
                      style={{ flex: 1, textTransform: 'capitalize' }}
                    >
                      {t === 'take' ? '➖ Take' : t === 'return' ? '➕ Return' : '✏️ Adjust'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>
                  {usageForm.type === 'adjust' ? 'New Quantity' : 'Quantity'} ({usageChem.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={usageForm.quantity}
                  onChange={(e) => setUsageForm((f) => ({ ...f, quantity: e.target.value }))}
                  placeholder={usageForm.type === 'adjust' ? 'Enter new total' : 'Amount'}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label>Notes (optional)</label>
                <input
                  value={usageForm.notes}
                  onChange={(e) => setUsageForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Used for experiment X"
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowUsageModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loggingUsage}>
                  {loggingUsage ? 'Saving…' : 'Log Usage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction History Drawer */}
      {showHistory && (
        <div className="form-overlay" onClick={(e) => e.target === e.currentTarget && setShowHistory(false)}>
          <div className="history-panel">
            <div className="form-header">
              <h2>Usage History</h2>
              <button className="icon-btn" onClick={() => setShowHistory(false)}>
                ✕
              </button>
            </div>

            <div className="history-filters">
              <input
                className="search-input"
                placeholder="Search chemical, user, notes…"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
              <div className="filter-pills">
                {['all', 'take', 'return', 'adjust'].map((f) => (
                  <button
                    key={f}
                    className={`pill ${historyFilter === f ? 'active' : ''}`}
                    onClick={() => setHistoryFilter(f)}
                  >
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="history-list">
              {filteredTransactions.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 20px' }}>
                  <p>No transactions found</p>
                </div>
              ) : (
                filteredTransactions.map((t) => (
                  <div key={t.id} className={`history-item type-${t.type}`}>
                    <div className="history-main">
                      <div className="history-title">
                        <span className={`history-type type-${t.type}`}>
                          {t.type === 'take' ? '➖ Take' : t.type === 'return' ? '➕ Return' : '✏️ Adjust'}
                        </span>
                        <strong>{t.chemical_name}</strong>
                      </div>
                      <div className="history-meta">
                        <span>
                          {t.quantity_change > 0 ? '+' : ''}
                          {t.quantity_change} {t.unit}
                        </span>
                        <span>
                          {t.quantity_before} → {t.quantity_after} {t.unit}
                        </span>
                      </div>
                      {t.notes && <div className="history-notes">{t.notes}</div>}
                    </div>
                    <div className="history-side">
                      <div className="history-user">{t.user_email}</div>
                      <div className="history-time">{formatDateTime(t.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="content">
        {loading ? (
          <div className="skeleton-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton-card" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧪</div>
            <h3>No chemicals found</h3>
            <p>
              {search || filter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Get started by adding your first chemical.'}
            </p>
            {!search && filter === 'all' && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  resetForm()
                  setShowForm(true)
                }}
              >
                + Add Chemical
              </button>
            )}
          </div>
        ) : viewMode === 'cards' ? (
          <div className="cards-grid">
            {filtered.map((chem) => {
              const expired = isExpired(chem)
              const low = isLow(chem)
              const soon = isExpiringSoon(chem)
              const days = daysUntil(chem.expiry_date)
              const stockPct =
                chem.min_stock > 0
                  ? Math.min(100, Math.round((chem.quantity / (chem.min_stock * 2)) * 100))
                  : 100

              return (
                <article
                  key={chem.id}
                  className={`chem-card ${expired ? 'expired' : low ? 'low' : soon ? 'soon' : ''}`}
                >
                  {bulkMode && (
                    <label className="card-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(chem.id)}
                        onChange={() => toggleSelect(chem.id)}
                      />
                    </label>
                  )}

                  <div className="card-header">
                    <h3>{chem.name}</h3>
                    <div className="card-badges">
                      {expired && <span className="badge badge-red">Expired</span>}
                      {!expired && low && <span className="badge badge-orange">Low Stock</span>}
                      {!expired && !low && soon && (
                        <span className="badge badge-yellow">Expiring Soon</span>
                      )}
                      {!expired && !low && !soon && <span className="badge badge-green">OK</span>}
                    </div>
                  </div>

                  <div className="card-meta">
                    {chem.molecular_formula && (
                      <span className="meta-item formula">{chem.molecular_formula}</span>
                    )}
                    {chem.cas_number && <span className="meta-item">CAS {chem.cas_number}</span>}
                  </div>

                  <div className="card-qty">
                    <span className="qty-value">
                      {chem.quantity} {chem.unit}
                    </span>
                    {chem.min_stock > 0 && (
                      <div className="stock-bar">
                        <div
                          className="stock-fill"
                          style={{
                            width: `${stockPct}%`,
                            background: low ? 'var(--danger)' : 'var(--success)',
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="card-details">
                    <div>
                      <span className="detail-label">Location</span>
                      <span>{chem.location || '—'}</span>
                    </div>
                    <div>
                      <span className="detail-label">Expiry</span>
                      <span>
                        {formatDate(chem.expiry_date)}
                        {days !== null && (
                          <span className="days-left">
                            {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {(chem.hazard_symbols?.length > 0 || chem.hazard_notes) && (
                    <div className="card-hazards">
                      {(chem.hazard_symbols || []).map((id) => {
                        const h = HAZARD_OPTIONS.find((x) => x.id === id)
                        return h ? (
                          <span key={id} title={h.label} className="hazard-emoji">
                            {h.emoji}
                          </span>
                        ) : null
                      })}
                      {chem.hazard_notes && (
                        <span className="hazard-note">{chem.hazard_notes}</span>
                      )}
                    </div>
                  )}

                  <div className="card-sds">
                    {uploadProgress[chem.id] !== undefined ? (
                      <div className="upload-progress">
                        <div
                          className="upload-bar"
                          style={{ width: `${uploadProgress[chem.id]}%` }}
                        />
                        <span>Uploading… {uploadProgress[chem.id]}%</span>
                      </div>
                    ) : chem.sds_filename ? (
                      <div className="sds-row">
                        <button className="link-btn" onClick={() => handleDownloadSds(chem.id)}>
                          📄 {chem.sds_filename.split('/').pop()}
                        </button>
                        <label className="replace-label">
                          Replace
                          <input
                            type="file"
                            accept=".pdf"
                            hidden
                            onChange={(e) =>
                              e.target.files[0] && handleSdsUpload(chem.id, e.target.files[0])
                            }
                          />
                        </label>
                      </div>
                    ) : (
                      <label className="upload-label">
                        + Upload SDS
                        <input
                          type="file"
                          accept=".pdf"
                          hidden
                          onChange={(e) =>
                            e.target.files[0] && handleSdsUpload(chem.id, e.target.files[0])
                          }
                        />
                      </label>
                    )}
                  </div>

                  <div className="card-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => openUsageModal(chem)}>
                      Log Usage
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => handleEdit(chem)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(chem.id, chem.name)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="chem-table">
              <thead>
                <tr>
                  {bulkMode && (
                    <th className="col-check">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  <th>Name</th>
                  <th>Formula</th>
                  <th>CAS</th>
                  <th>Qty</th>
                  <th>Location</th>
                  <th>Expiry</th>
                  <th>Hazards</th>
                  <th>Status</th>
                  <th>SDS</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((chem) => {
                  const expired = isExpired(chem)
                  const low = isLow(chem)
                  const soon = isExpiringSoon(chem)
                  const days = daysUntil(chem.expiry_date)

                  return (
                    <tr
                      key={chem.id}
                      className={
                        expired ? 'row-expired' : low ? 'row-low' : soon ? 'row-soon' : ''
                      }
                    >
                      {bulkMode && (
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(chem.id)}
                            onChange={() => toggleSelect(chem.id)}
                          />
                        </td>
                      )}
                      <td>
                        <strong>{chem.name}</strong>
                        {chem.hazard_notes && (
                          <div className="hazard-sub">{chem.hazard_notes}</div>
                        )}
                      </td>
                      <td className="mono">{chem.molecular_formula || '—'}</td>
                      <td className="mono">{chem.cas_number || '—'}</td>
                      <td>
                        {chem.quantity} {chem.unit}
                      </td>
                      <td>{chem.location || '—'}</td>
                      <td>
                        {formatDate(chem.expiry_date)}
                        {days !== null && (
                          <div className="days-sub">
                            {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="hazard-icons">
                          {(chem.hazard_symbols || []).map((id) => {
                            const h = HAZARD_OPTIONS.find((x) => x.id === id)
                            return h ? (
                              <span key={id} title={h.label}>
                                {h.emoji}
                              </span>
                            ) : null
                          })}
                        </div>
                      </td>
                      <td>
                        {expired ? (
                          <span className="badge badge-red">Expired</span>
                        ) : low ? (
                          <span className="badge badge-orange">Low Stock</span>
                        ) : soon ? (
                          <span className="badge badge-yellow">Expiring Soon</span>
                        ) : (
                          <span className="badge badge-green">OK</span>
                        )}
                      </td>
                      <td className="sds-cell">
                        {uploadProgress[chem.id] !== undefined ? (
                          <div className="mini-progress">
                            <div style={{ width: `${uploadProgress[chem.id]}%` }} />
                          </div>
                        ) : chem.sds_filename ? (
                          <div className="sds-actions">
                            <button
                              className="link-btn"
                              onClick={() => handleDownloadSds(chem.id)}
                            >
                              Download
                            </button>
                            <label className="link-btn">
                              Replace
                              <input
                                type="file"
                                accept=".pdf"
                                hidden
                                onChange={(e) =>
                                  e.target.files[0] &&
                                  handleSdsUpload(chem.id, e.target.files[0])
                                }
                              />
                            </label>
                          </div>
                        ) : (
                          <label className="link-btn">
                            Upload
                            <input
                              type="file"
                              accept=".pdf"
                              hidden
                              onChange={(e) =>
                                e.target.files[0] && handleSdsUpload(chem.id, e.target.files[0])
                              }
                            />
                          </label>
                        )}
                      </td>
                      <td className="actions">
                        <button className="btn-sm" onClick={() => openUsageModal(chem)}>
                          Log
                        </button>
                        <button className="btn-sm" onClick={() => handleEdit(chem)}>
                          Edit
                        </button>
                        <button
                          className="btn-sm btn-danger"
                          onClick={() => handleDelete(chem.id, chem.name)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Command Palette */}
      {commandOpen && (
        <div className="command-overlay" onClick={() => setCommandOpen(false)}>
          <div className="command-palette" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              placeholder="Type a command or search…"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setCommandOpen(false)
              }}
            />
            <div className="command-list">
              <button
                onClick={() => {
                  resetForm()
                  setShowForm(true)
                  setCommandOpen(false)
                }}
              >
                <span>➕</span> Add new chemical
              </button>
              <button
                onClick={() => {
                  setShowHistory(true)
                  setCommandOpen(false)
                }}
              >
                <span>📋</span> Usage History
              </button>
              <button
                onClick={() => {
                  setFilter('low')
                  setCommandOpen(false)
                }}
              >
                <span>📉</span> Show low stock
              </button>
              <button
                onClick={() => {
                  setFilter('expired')
                  setCommandOpen(false)
                }}
              >
                <span>🚫</span> Show expired
              </button>
              <button
                onClick={() => {
                  setFilter('soon')
                  setCommandOpen(false)
                }}
              >
                <span>⏳</span> Show expiring soon
              </button>
              <button
                onClick={() => {
                  toggleTheme()
                  setCommandOpen(false)
                }}
              >
                <span>{theme === 'dark' ? '☀️' : '🌙'}</span> Toggle theme
              </button>
              <button
                onClick={() => {
                  fetchChemicals()
                  setCommandOpen(false)
                }}
              >
                <span>🔄</span> Refresh data
              </button>
              <button
                onClick={() => {
                  setHazardLegendOpen(true)
                  setCommandOpen(false)
                }}
              >
                <span>ℹ️</span> Hazard legend
              </button>
            </div>
            <div className="command-hint">
              <kbd>⌘</kbd>
              <kbd>K</kbd> to toggle • <kbd>Esc</kbd> to close
            </div>
          </div>
        </div>
      )}

      {/* Hazard Legend Modal */}
      {hazardLegendOpen && (
        <div className="modal-overlay" onClick={() => setHazardLegendOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>GHS Hazard Symbols</h3>
              <button className="icon-btn" onClick={() => setHazardLegendOpen(false)}>
                ✕
              </button>
            </div>
            <div className="legend-grid">
              {HAZARD_OPTIONS.map((h) => (
                <div key={h.id} className="legend-item">
                  <span className="legend-emoji" style={{ background: `${h.color}22` }}>
                    {h.emoji}
                  </span>
                  <div>
                    <strong>{h.label}</strong>
                    <p className="legend-id">{h.id}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <span>
          Showing <strong>{filtered.length}</strong> of <strong>{chemicals.length}</strong>{' '}
          chemicals
        </span>
        <span className="footer-hint">
          <kbd>/</kbd> search • <kbd>⌘K</kbd> commands • <kbd>⌘N</kbd> new
        </span>
      </footer>
    </div>
  )
}

export default App