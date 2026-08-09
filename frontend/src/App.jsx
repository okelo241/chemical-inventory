import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Landing from './Landing'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import './App.css'

/* ============================================================================
   CHEMICAL INVENTORY APPLICATION
   Full-featured modern inventory system
   Features included:
   - Authentication (Supabase)
   - Full CRUD for chemicals
   - SDS upload / download
   - Low stock + expiry notifications (browser + in-app)
   - Usage / Transaction logging
   - Export to CSV + professional PDF reports
   - Batch / Lot number + Supplier
   - Dashboard overview
   - Advanced filters (location + hazard)
   - Chemical Compatibility Checker
   - Bulk actions
   - Card + Table views
   - Dark / Light theme
   - Command palette
   - Keyboard shortcuts
============================================================================ */

/* ============================================================================
   CONSTANTS
============================================================================ */

// ====================== CHEMICAL CLASSES ======================
const CHEMICAL_CLASSES = [
  { id: 'acid', label: 'Acid (Strong/Weak)', color: '#ef4444' },
  { id: 'base', label: 'Base / Alkali', color: '#3b82f6' },
  { id: 'oxidizer', label: 'Oxidizer', color: '#eab308' },
  { id: 'flammable_solvent', label: 'Flammable Solvent', color: '#f97316' },
  { id: 'water_reactive', label: 'Water-Reactive', color: '#8b5cf6' },
  { id: 'toxic', label: 'Toxic / Poison', color: '#64748b' },
  { id: 'cyanide', label: 'Cyanide', color: '#1e293b' },
  { id: 'sulfide', label: 'Sulfide', color: '#78716c' },
  { id: 'peroxide_former', label: 'Peroxide Former', color: '#ec4899' },
  { id: 'explosive', label: 'Explosive / Sensitive', color: '#dc2626' },
  { id: 'halogen', label: 'Halogen', color: '#06b6d4' },
  { id: 'organic', label: 'Organic Material', color: '#22c55e' },
  { id: 'compressed_gas', label: 'Compressed Gas', color: '#6366f1' },
]

// ====================== EXPANDED GHS HAZARDS ======================
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
  // Extra useful ones
  { id: 'acute_toxicity', label: 'Acute Toxicity', emoji: '☠️', color: '#7f1d1d' },
  { id: 'aspiration', label: 'Aspiration Hazard', emoji: '🫁', color: '#be185d' },
  { id: 'carcinogen', label: 'Carcinogen', emoji: '☢️', color: '#9f1239' },
]

// ====================== CLASS COMPATIBILITY MATRIX ======================
const CLASS_COMPATIBILITY_RULES = [
  // High risk
  { a: 'acid', b: 'base', risk: 'High', reason: 'Acids and bases react violently and generate heat' },
  { a: 'acid', b: 'cyanide', risk: 'High', reason: 'Acids + cyanides release highly toxic hydrogen cyanide gas' },
  { a: 'acid', b: 'sulfide', risk: 'High', reason: 'Acids + sulfides release toxic hydrogen sulfide gas' },
  { a: 'acid', b: 'water_reactive', risk: 'High', reason: 'Many water-reactive chemicals react violently with acids' },
  { a: 'oxidizer', b: 'flammable_solvent', risk: 'High', reason: 'Oxidizers + flammable solvents can cause fire or explosion' },
  { a: 'oxidizer', b: 'organic', risk: 'High', reason: 'Oxidizers + organic materials are a serious fire/explosion risk' },
  { a: 'oxidizer', b: 'water_reactive', risk: 'High', reason: 'Dangerous combination – high reactivity' },
  { a: 'water_reactive', b: 'flammable_solvent', risk: 'High', reason: 'Water-reactive chemicals can ignite flammable solvents' },
  { a: 'peroxide_former', b: 'oxidizer', risk: 'High', reason: 'Peroxide formers become extremely dangerous with oxidizers' },
  { a: 'explosive', b: 'oxidizer', risk: 'High', reason: 'Oxidizers can sensitize or initiate explosives' },
  { a: 'halogen', b: 'flammable_solvent', risk: 'High', reason: 'Halogens react dangerously with many organic solvents' },

  // Medium risk
  { a: 'acid', b: 'flammable_solvent', risk: 'Medium', reason: 'Acids can damage containers and increase fire risk' },
  { a: 'base', b: 'flammable_solvent', risk: 'Medium', reason: 'Bases can degrade containers of flammable solvents' },
  { a: 'toxic', b: 'flammable_solvent', risk: 'Medium', reason: 'Fire involving toxics creates additional hazards' },
  { a: 'compressed_gas', b: 'flammable_solvent', risk: 'Medium', reason: 'Compressed gases near flammables increase risk' },
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
  batch_lot: '',
  supplier: '',
  chemical_classes: [],          // ← NEW
}

// Simple auto-classification based on name + GHS symbols
const autoClassifyChemical = (name = '', hazardSymbols = []) => {
  const classes = new Set()
  const lower = name.toLowerCase()

  // From name keywords
  if (lower.includes('acid') || lower.includes('hcl') || lower.includes('h2so4') || lower.includes('hno3')) {
    classes.add('acid')
  }
  if (lower.includes('hydroxide') || lower.includes('naoh') || lower.includes('koh') || lower.includes('ammonia')) {
    classes.add('base')
  }
  if (lower.includes('peroxide') || lower.includes('nitrate') || lower.includes('permanganate') || lower.includes('chromate')) {
    classes.add('oxidizer')
  }
  if (lower.includes('ether') || lower.includes('thf') || lower.includes('dioxane')) {
    classes.add('peroxide_former')
    classes.add('flammable_solvent')
  }
  if (lower.includes('sodium') || lower.includes('lithium') || lower.includes('potassium') && !lower.includes('hydroxide')) {
    classes.add('water_reactive')
  }
  if (lower.includes('cyanide')) classes.add('cyanide')
  if (lower.includes('sulfide')) classes.add('sulfide')
  if (lower.includes('chlorine') || lower.includes('bromine') || lower.includes('iodine')) {
    classes.add('halogen')
  }

  // From GHS symbols
  if (hazardSymbols.includes('flammable')) classes.add('flammable_solvent')
  if (hazardSymbols.includes('oxidizing')) classes.add('oxidizer')
  if (hazardSymbols.includes('corrosive')) {
    // could be acid or base – leave for manual
  }
  if (hazardSymbols.includes('explosive')) classes.add('explosive')
  if (hazardSymbols.includes('gas')) classes.add('compressed_gas')
  if (hazardSymbols.includes('toxic') || hazardSymbols.includes('acute_toxicity')) {
    classes.add('toxic')
  }

  return Array.from(classes)
}

{/* Chemical Classes */}
<div className="hazard-selector">
  <label>Chemical Classes (for compatibility checking)</label>
  <div className="hazard-grid">
    {CHEMICAL_CLASSES.map((cls) => {
      const active = formData.chemical_classes?.includes(cls.id)
      return (
        <button
          type="button"
          key={cls.id}
          className={`hazard-chip ${active ? 'active' : ''}`}
          onClick={() => {
            setFormData(prev => {
              const current = prev.chemical_classes || []
              if (current.includes(cls.id)) {
                return { ...prev, chemical_classes: current.filter(c => c !== cls.id) }
              }
              return { ...prev, chemical_classes: [...current, cls.id] }
            })
          }}
          style={{
            borderColor: active ? cls.color : undefined,
            background: active ? `${cls.color}22` : undefined,
          }}
        >
          {cls.label}
        </button>
      )
    })}
  </div>
</div>

// Auto-classify when name or hazard symbols change
useEffect(() => {
  if (!showForm) return

  const suggested = autoClassifyChemical(formData.name, formData.hazard_symbols)
  if (suggested.length > 0) {
    setFormData(prev => {
      // Only add missing ones, don’t remove user choices
      const current = new Set(prev.chemical_classes || [])
      suggested.forEach(c => current.add(c))
      return { ...prev, chemical_classes: Array.from(current) }
    })
  }
}, [formData.name, formData.hazard_symbols, showForm])

const lookupPubChem = async (casOrName) => {
  if (!casOrName || casOrName.length < 3) return null

  try {
    // First try to get CID
    const searchUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(casOrName)}/cids/JSON`
    const searchRes = await fetch(searchUrl)
    if (!searchRes.ok) return null

    const searchData = await searchRes.json()
    const cid = searchData?.IdentifierList?.CID?.[0]
    if (!cid) return null

    // Get properties
    const propUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,IUPACName/JSON`
    const propRes = await fetch(propUrl)
    if (!propRes.ok) return null

    const propData = await propRes.json()
    const props = propData?.PropertyTable?.Properties?.[0]

    return {
      molecular_formula: props?.MolecularFormula || null,
      iupac_name: props?.IUPACName || null,
    }
  } catch (err) {
    console.warn('PubChem lookup failed', err)
    return null
  }
}

const compatibilityIssues = useMemo(() => {
  const issues = []
  const byLocation = {}

  chemicals.forEach((c) => {
    const loc = (c.location || 'Unassigned').trim()
    if (!byLocation[loc]) byLocation[loc] = []
    byLocation[loc].push(c)
  })

  Object.entries(byLocation).forEach(([location, chemsInLoc]) => {
    for (let i = 0; i < chemsInLoc.length; i++) {
      for (let j = i + 1; j < chemsInLoc.length; j++) {
        const chemA = chemsInLoc[i]
        const chemB = chemsInLoc[j]

        const classesA = chemA.chemical_classes || []
        const classesB = chemB.chemical_classes || []
        const symbolsA = chemA.hazard_symbols || []
        const symbolsB = chemB.hazard_symbols || []

        // 1. Primary check: Chemical Classes
        CLASS_COMPATIBILITY_RULES.forEach((rule) => {
          const match =
            (classesA.includes(rule.a) && classesB.includes(rule.b)) ||
            (classesA.includes(rule.b) && classesB.includes(rule.a))

          if (match) {
            issues.push({
              location,
              chemA: chemA.name,
              chemB: chemB.name,
              risk: rule.risk,
              reason: rule.reason,
              source: 'class',
            })
          }
        })

        // 2. Secondary check: GHS symbols (fallback)
        // (you can keep the old GHS rules here if you want)
      }
    }
  })

  // Remove duplicates
  const unique = []
  const seen = new Set()
  issues.forEach((issue) => {
    const key = `${issue.location}-${issue.chemA}-${issue.chemB}-${issue.reason}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(issue)
    }
  })

  return unique
}, [chemicals])

/* ============================================================================
   HELPER FUNCTIONS
============================================================================ */

const daysUntil = (dateStr) => {
  if (!dateStr) return null
  const now = new Date()
  const target = new Date(dateStr)
  const diffMs = target - now
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return Math.ceil(diffDays)
}

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

const isExpired = (chemical) => {
  if (!chemical || !chemical.expiry_date) return false
  return daysUntil(chemical.expiry_date) < 0
}

const isLow = (chemical) => {
  if (!chemical) return false
  const qty = Number(chemical.quantity) || 0
  const min = Number(chemical.min_stock) || 0
  return qty <= min
}

const isExpiringSoon = (chemical) => {
  if (!chemical || !chemical.expiry_date) return false
  const days = daysUntil(chemical.expiry_date)
  return days !== null && days >= 0 && days <= 30
}

const getStatus = (chemical) => {
  if (isExpired(chemical)) return 'Expired'
  if (isLow(chemical)) return 'Low Stock'
  if (isExpiringSoon(chemical)) return 'Expiring Soon'
  return 'OK'
}

const getStatusBadgeClass = (chemical) => {
  if (isExpired(chemical)) return 'badge badge-red'
  if (isLow(chemical)) return 'badge badge-orange'
  if (isExpiringSoon(chemical)) return 'badge badge-yellow'
  return 'badge badge-green'
}

/* ============================================================================
   CSV EXPORT HELPERS
============================================================================ */

const downloadCSV = (filename, rows) => {
  if (!rows || rows.length === 0) {
    console.warn('No data to export')
    return
  }

  const headers = Object.keys(rows[0])
  const escapeCell = (value) => {
    const str = value === null || value === undefined ? '' : String(value)
    const escaped = str.replace(/"/g, '""')
    return `"${escaped}"`
  }

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(',')),
  ]

  const csvContent = lines.join('\n')
  // UTF-8 BOM so Microsoft Excel opens the file correctly
  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const exportChemicalsCSV = (list, filename = 'chemicals.csv') => {
  const rows = list.map((c) => ({
    Name: c.name || '',
    'Molecular Formula': c.molecular_formula || '',
    'CAS Number': c.cas_number || '',
    Quantity: c.quantity ?? '',
    Unit: c.unit || '',
    Location: c.location || '',
    'Expiry Date': c.expiry_date || '',
    'Min Stock': c.min_stock ?? '',
    'Batch / Lot': c.batch_lot || '',
    Supplier: c.supplier || '',
    'Hazard Notes': c.hazard_notes || '',
    'Hazard Symbols': Array.isArray(c.hazard_symbols) ? c.hazard_symbols.join(', ') : '',
    'SDS Filename': c.sds_filename ? c.sds_filename.split('/').pop() : '',
    Status: getStatus(c),
  }))

  downloadCSV(filename, rows)
}

const exportTransactionsCSV = (list) => {
  const rows = list.map((t) => ({
    'Date & Time': formatDateTime(t.created_at),
    Chemical: t.chemical_name || '',
    Action: t.type || '',
    'Quantity Change': t.quantity_change ?? '',
    Unit: t.unit || '',
    'Quantity Before': t.quantity_before ?? '',
    'Quantity After': t.quantity_after ?? '',
    User: t.user_email || '',
    Notes: t.notes || '',
  }))

  downloadCSV(`usage-history-${new Date().toISOString().slice(0, 10)}.csv`, rows)
}

/* ============================================================================
   PDF REPORT GENERATOR (jsPDF + autoTable)
============================================================================ */

const generatePDFReport = (chemicalsList, title = 'Chemical Inventory Report') => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Header bar
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, pageWidth, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Chemical Inventory System', 14, 12)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(title, 14, 20)

  doc.setFontSize(9)
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 12, { align: 'right' })
  doc.text(`Total chemicals: ${chemicalsList.length}`, pageWidth - 14, 20, { align: 'right' })

  // Summary statistics
  const lowCount = chemicalsList.filter(isLow).length
  const expiredCount = chemicalsList.filter(isExpired).length
  const soonCount = chemicalsList.filter(isExpiringSoon).length

  doc.setFillColor(241, 245, 249)
  doc.roundedRect(14, 34, pageWidth - 28, 18, 3, 3, 'F')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`Total: ${chemicalsList.length}`, 22, 45)

  doc.setTextColor(217, 119, 6)
  doc.text(`Low Stock: ${lowCount}`, 60, 45)

  doc.setTextColor(202, 138, 4)
  doc.text(`Expiring Soon: ${soonCount}`, 110, 45)

  doc.setTextColor(220, 38, 38)
  doc.text(`Expired: ${expiredCount}`, 170, 45)

  // Table data
  const tableBody = chemicalsList.map((c) => [
    c.name || '',
    c.molecular_formula || '—',
    c.cas_number || '—',
    `${c.quantity ?? 0} ${c.unit || ''}`,
    c.location || '—',
    c.batch_lot || '—',
    c.supplier || '—',
    formatDate(c.expiry_date),
    getStatus(c),
  ])

  autoTable(doc, {
    startY: 58,
    head: [['Name', 'Formula', 'CAS', 'Quantity', 'Location', 'Batch/Lot', 'Supplier', 'Expiry', 'Status']],
    body: tableBody,
    theme: 'striped',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 8) {
        const status = data.cell.raw
        if (status === 'Expired') {
          data.cell.styles.textColor = [220, 38, 38]
          data.cell.styles.fontStyle = 'bold'
        } else if (status === 'Low Stock') {
          data.cell.styles.textColor = [217, 119, 6]
          data.cell.styles.fontStyle = 'bold'
        } else if (status === 'Expiring Soon') {
          data.cell.styles.textColor = [202, 138, 4]
        } else {
          data.cell.styles.textColor = [22, 163, 74]
        }
      }
    },
  })

  // Footer on every page
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
    doc.text('Confidential – Laboratory Use Only', 14, pageHeight - 8)
  }

  const fileName = `chemical-inventory-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(fileName)
}

/* ============================================================================
   MAIN APP COMPONENT
============================================================================ */

function App() {
  /* ---------- Auth & Session ---------- */
  const [session, setSession] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [showLogin, setShowLogin] = useState(false)

  /* ---------- Core Data ---------- */
  const [chemicals, setChemicals] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  /* ---------- UI State ---------- */
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode') || 'table')
  const [mainView, setMainView] = useState('inventory') // 'inventory' | 'dashboard'
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [message, setMessage] = useState(null)
  const [commandOpen, setCommandOpen] = useState(false)
  const [hazardLegendOpen, setHazardLegendOpen] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [compatOpen, setCompatOpen] = useState(false)
  const [locationFilter, setLocationFilter] = useState('')
  const [hazardFilter, setHazardFilter] = useState('')

  /* ---------- Notifications ---------- */
  const [notifications, setNotifications] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => localStorage.getItem('notificationsEnabled') !== 'false'
  )

  /* ---------- Usage / Transaction Log ---------- */
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

  /* ---------- Theme ---------- */
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return 'light'
  })

  /* ---------- Form State ---------- */
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})

  /* ---------- Refs ---------- */
  const searchRef = useRef(null)
  const formRef = useRef(null)
  const toastTimeout = useRef(null)
  const notifRef = useRef(null)
  const exportRef = useRef(null)

  const API_URL = import.meta.env.VITE_API_URL

  /* ========================================================================
     THEME MANAGEMENT
  ======================================================================== */

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }, [])

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode)
  }, [viewMode])

  /* ========================================================================
     AUTHENTICATION
  ======================================================================== */

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setSession(session)
        setLoadingAuth(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      setSession(null)
      setChemicals([])
      setTransactions([])
      setSelectedIds(new Set())
      setShowLogin(false)
      setShowForm(false)
      setNotifications([])
      setMainView('inventory')
    } catch (err) {
      console.error('Logout error:', err)
      showMessage('error', 'Failed to log out')
    }
  }

  const getAccessToken = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      return session?.access_token || null
    } catch (err) {
      console.error('Error getting access token:', err)
      return null
    }
  }, [])

  /* ========================================================================
     TOAST MESSAGES
  ======================================================================== */

  const showMessage = useCallback((type, text) => {
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current)
    }
    setMessage({ type, text, id: Date.now() })
    toastTimeout.current = setTimeout(() => {
      setMessage(null)
    }, 4000)
  }, [])

  /* ========================================================================
     NOTIFICATION SYSTEM
  ======================================================================== */

  const createNotification = (type, title, messageText, chemId = null) => {
    const id = `${type}-${chemId || Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    return {
      id,
      type,
      title,
      message: messageText,
      chemId,
      createdAt: new Date().toISOString(),
      read: false,
    }
  }

  const checkAndNotify = useCallback(
    (chems) => {
      if (!notificationsEnabled || !Array.isArray(chems) || chems.length === 0) return

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
              'Low Stock Alert',
              `"${c.name}" is running low (${c.quantity} ${c.unit} remaining)`,
              c.id
            )
          )
        }
      })

      setNotifications((prev) => {
        const existingKeys = new Set(prev.map((n) => `${n.type}-${n.chemId}`))
        const uniqueNew = newNotifs.filter((n) => !existingKeys.has(`${n.type}-${n.chemId}`))

        if (uniqueNew.length === 0) return prev

        // Browser notifications
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          uniqueNew.forEach((n) => {
            try {
              new Notification(n.title, {
                body: n.message,
                tag: n.id,
                requireInteraction: false,
              })
            } catch (err) {
              // Some browsers may block this
            }
          })
        }

        return [...uniqueNew, ...prev].slice(0, 60)
      })
    },
    [notificationsEnabled]
  )

  useEffect(() => {
    if (chemicals.length > 0) {
      checkAndNotify(chemicals)
    }
  }, [chemicals, checkAndNotify])

  // Periodic re-check every 5 minutes
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (chemicals.length > 0) {
        checkAndNotify(chemicals)
      }
    }, 5 * 60 * 1000)

    return () => clearInterval(intervalId)
  }, [chemicals, checkAndNotify])

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      showMessage('error', 'This browser does not support notifications')
      return
    }

    try {
      const permission = await Notification.requestPermission()
      setNotifPermission(permission)

      if (permission === 'granted') {
        showMessage('success', 'Browser notifications have been enabled')
        setNotificationsEnabled(true)
        localStorage.setItem('notificationsEnabled', 'true')
        checkAndNotify(chemicals)
      } else {
        showMessage('error', 'Notification permission was denied')
      }
    } catch (err) {
      showMessage('error', 'Could not request notification permission')
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
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const clearNotifications = () => {
    setNotifications([])
  }

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length
  }, [notifications])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false)
      }
      if (exportRef.current && !exportRef.current.contains(event.target)) {
        setExportOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /* ========================================================================
     API LAYER
  ======================================================================== */

  const fetchChemicals = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true)
        else setRefreshing(true)

        const token = await getAccessToken()
        if (!token) throw new Error('No access token')

        const response = await fetch(`${API_URL}/chemicals`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        setChemicals(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Failed to fetch chemicals:', err)
        showMessage('error', 'Could not load chemicals. Please check your connection.')
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
      if (!token) return

      const response = await fetch(`${API_URL}/transactions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to load transactions')

      const data = await response.json()
      setTransactions(Array.isArray(data) ? data : [])
    } catch (err) {
      // Backend may not have the endpoint yet – fail silently
      console.warn('Could not load transactions:', err.message)
    }
  }, [API_URL, getAccessToken])

  useEffect(() => {
    if (session) {
      fetchChemicals()
      fetchTransactions()
    }
  }, [session, fetchChemicals, fetchTransactions])

  /* ========================================================================
     CHEMICAL CRUD
  ======================================================================== */

  const handleSubmit = async (e) => {
    e.preventDefault()

    const errors = {}
    if (!formData.name || !formData.name.trim()) {
      errors.name = 'Name is required'
    }
    if (formData.quantity !== '' && isNaN(Number(formData.quantity))) {
      errors.quantity = 'Quantity must be a valid number'
    }
    if (formData.min_stock !== '' && isNaN(Number(formData.min_stock))) {
      errors.min_stock = 'Min stock must be a valid number'
    }

    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)

    try {
      const token = await getAccessToken()
      if (!token) throw new Error('Not authenticated')

      const payload = {
        name: formData.name.trim(),
        cas_number: formData.cas_number.trim() || null,
        quantity: parseFloat(formData.quantity) || 0,
        unit: formData.unit || 'g',
        location: formData.location.trim() || null,
        expiry_date: formData.expiry_date || null,
        min_stock: parseFloat(formData.min_stock) || 0,
        hazard_notes: formData.hazard_notes.trim() || null,
        molecular_formula: formData.molecular_formula.trim() || null,
        hazard_symbols: formData.hazard_symbols.length > 0 ? formData.hazard_symbols : null,
        batch_lot: formData.batch_lot.trim() || null,
        supplier: formData.supplier.trim() || null,
      }

      const url = editingId ? `${API_URL}/chemicals/${editingId}` : `${API_URL}/chemicals`
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Save failed')
      }

      showMessage('success', editingId ? 'Chemical updated successfully' : 'Chemical added successfully')
      resetForm()
      fetchChemicals(true)
    } catch (err) {
      console.error(err)
      showMessage('error', 'Something went wrong while saving the chemical')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id, name) => {
    const confirmed = window.confirm(`Are you sure you want to permanently delete "${name}"?`)
    if (!confirmed) return

    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_URL}/chemicals/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Delete failed')

      showMessage('success', `"${name}" has been deleted`)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      fetchChemicals(true)
    } catch (err) {
      showMessage('error', 'Failed to delete the chemical')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return

    const confirmed = window.confirm(
      `You are about to delete ${selectedIds.size} chemical(s). This cannot be undone. Continue?`
    )
    if (!confirmed) return

    const token = await getAccessToken()
    let successCount = 0

    for (const id of selectedIds) {
      try {
        const response = await fetch(`${API_URL}/chemicals/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.ok) successCount++
      } catch (_) {
        // continue
      }
    }

    showMessage('success', `Successfully deleted ${successCount} chemical(s)`)
    setSelectedIds(new Set())
    setBulkMode(false)
    fetchChemicals(true)
  }

  /* ========================================================================
     SDS HANDLING
  ======================================================================== */

  const handleSdsUpload = async (id, file) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      showMessage('error', 'Only PDF files are accepted for SDS')
      return
    }

    setUploadProgress((prev) => ({ ...prev, [id]: 8 }))

    const token = await getAccessToken()
    const formDataUpload = new FormData()
    formDataUpload.append('file', file)

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const current = prev[id] || 8
          if (current >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return { ...prev, [id]: current + 12 }
        })
      }, 180)

      const response = await fetch(`${API_URL}/chemicals/${id}/upload-sds`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataUpload,
      })

      clearInterval(progressInterval)
      setUploadProgress((prev) => ({ ...prev, [id]: 100 }))

      if (!response.ok) throw new Error('Upload failed')

      showMessage('success', 'SDS file uploaded successfully')

      setTimeout(() => {
        setUploadProgress((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      }, 700)

      fetchChemicals(true)
    } catch (err) {
      setUploadProgress((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      showMessage('error', 'Failed to upload SDS file')
    }
  }

  const handleDownloadSds = async (id) => {
    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_URL}/chemicals/${id}/sds`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()
      if (data && data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      } else {
        showMessage('error', 'SDS file not found')
      }
    } catch (err) {
      showMessage('error', 'Could not download SDS file')
    }
  }

  /* ========================================================================
     USAGE / TRANSACTION LOG
  ======================================================================== */

  const openUsageModal = (chemical) => {
    setUsageChem(chemical)
    setUsageForm({
      type: 'take',
      quantity: '',
      notes: '',
    })
    setShowUsageModal(true)
  }

  const handleLogUsage = async (e) => {
    e.preventDefault()
    if (!usageChem) return

    const qty = parseFloat(usageForm.quantity)
    if (!qty || qty <= 0) {
      showMessage('error', 'Please enter a valid positive quantity')
      return
    }

    setLoggingUsage(true)

    try {
      const token = await getAccessToken()

      let quantityChange = 0
      if (usageForm.type === 'take') {
        quantityChange = -qty
      } else if (usageForm.type === 'return') {
        quantityChange = qty
      } else if (usageForm.type === 'adjust') {
        quantityChange = qty - Number(usageChem.quantity)
      }

      const newQuantity = Math.max(0, Number(usageChem.quantity) + quantityChange)

      // Update the chemical quantity first
      const updateResponse = await fetch(`${API_URL}/chemicals/${usageChem.id}`, {
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

      if (!updateResponse.ok) {
        throw new Error('Failed to update quantity')
      }

      // Record the transaction
      const txPayload = {
        chemical_id: usageChem.id,
        chemical_name: usageChem.name,
        type: usageForm.type,
        quantity_change: quantityChange,
        quantity_before: Number(usageChem.quantity),
        quantity_after: newQuantity,
        unit: usageChem.unit,
        notes: usageForm.notes.trim() || null,
        user_email: session?.user?.email || 'unknown',
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
        // Backend endpoint may not exist yet
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

      const successMsg =
        usageForm.type === 'take'
          ? `Took ${qty} ${usageChem.unit} of ${usageChem.name}`
          : usageForm.type === 'return'
          ? `Returned ${qty} ${usageChem.unit} of ${usageChem.name}`
          : `Adjusted ${usageChem.name} to ${newQuantity} ${usageChem.unit}`

      showMessage('success', successMsg)
      setShowUsageModal(false)
      setUsageChem(null)
      fetchChemicals(true)
      fetchTransactions()
    } catch (err) {
      console.error(err)
      showMessage('error', 'Failed to log usage')
    } finally {
      setLoggingUsage(false)
    }
  }

  /* ========================================================================
     EXPORT HANDLERS
  ======================================================================== */

  const handleExportCurrent = () => {
    const list = filtered.length > 0 ? filtered : chemicals
    exportChemicalsCSV(list, `chemicals-filtered-${new Date().toISOString().slice(0, 10)}.csv`)
    setExportOpen(false)
    showMessage('success', `Exported ${list.length} chemical(s) to CSV`)
  }

  const handleExportAll = () => {
    exportChemicalsCSV(chemicals, `chemicals-all-${new Date().toISOString().slice(0, 10)}.csv`)
    setExportOpen(false)
    showMessage('success', `Exported all ${chemicals.length} chemicals to CSV`)
  }

  const handleExportTransactions = () => {
    exportTransactionsCSV(transactions)
    setExportOpen(false)
    showMessage('success', `Exported ${transactions.length} transaction(s)`)
  }

  const handleExportPDF = () => {
    const list = filtered.length > 0 ? filtered : chemicals
    generatePDFReport(list, 'Current Filtered View')
    setExportOpen(false)
    showMessage('success', 'PDF report generated successfully')
  }

  const handleExportPDFAll = () => {
    generatePDFReport(chemicals, 'Full Chemical Inventory Report')
    setExportOpen(false)
    showMessage('success', 'Full PDF report generated successfully')
  }

  /* ========================================================================
     FORM HELPERS
  ======================================================================== */

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

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
        return {
          ...prev,
          hazard_symbols: current.filter((h) => h !== id),
        }
      }
      return {
        ...prev,
        hazard_symbols: [...current, id],
      }
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
      hazard_symbols: Array.isArray(chem.hazard_symbols) ? chem.hazard_symbols : [],
      batch_lot: chem.batch_lot || '',
      supplier: chem.supplier || '',
    })
    setEditingId(chem.id)
    setShowForm(true)

    // Smooth scroll to form if needed
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 80)
  }

  /* ========================================================================
     SELECTION & BULK ACTIONS
  ======================================================================== */

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)))
    }
  }

  /* ========================================================================
     DERIVED DATA – FILTERING, SORTING, STATS, COMPATIBILITY
  ======================================================================== */

  const locations = useMemo(() => {
    const set = new Set()
    chemicals.forEach((c) => {
      if (c.location && c.location.trim()) {
        set.add(c.location.trim())
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [chemicals])

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim()

    let result = chemicals.filter((c) => {
      // Text search
      const matchesSearch =
        !query ||
        (c.name && c.name.toLowerCase().includes(query)) ||
        (c.cas_number && c.cas_number.toLowerCase().includes(query)) ||
        (c.molecular_formula && c.molecular_formula.toLowerCase().includes(query)) ||
        (c.hazard_notes && c.hazard_notes.toLowerCase().includes(query)) ||
        (c.location && c.location.toLowerCase().includes(query)) ||
        (c.batch_lot && c.batch_lot.toLowerCase().includes(query)) ||
        (c.supplier && c.supplier.toLowerCase().includes(query))

      if (!matchesSearch) return false

      // Preset filters
      if (filter === 'low') return isLow(c)
      if (filter === 'expired') return isExpired(c)
      if (filter === 'soon') return isExpiringSoon(c)
      if (filter === 'no-sds') return !c.sds_filename

      // Location filter
      if (locationFilter && c.location !== locationFilter) return false

      // Hazard filter
      if (hazardFilter) {
        const symbols = c.hazard_symbols || []
        if (!symbols.includes(hazardFilter)) return false
      }

      return true
    })

    // Sorting
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '')
        case 'name-desc':
          return (b.name || '').localeCompare(a.name || '')
        case 'quantity':
          return (Number(b.quantity) || 0) - (Number(a.quantity) || 0)
        case 'quantity-asc':
          return (Number(a.quantity) || 0) - (Number(b.quantity) || 0)
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
        case 'supplier':
          return (a.supplier || '').localeCompare(b.supplier || '')
        case 'updated':
          return new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
        default:
          return 0
      }
    })

    return result
  }, [chemicals, search, filter, sortBy, locationFilter, hazardFilter])

  const filteredTransactions = useMemo(() => {
    let list = [...transactions]

    if (historyFilter !== 'all') {
      list = list.filter((t) => t.type === historyFilter)
    }

    if (historySearch.trim()) {
      const q = historySearch.toLowerCase()
      list = list.filter(
        (t) =>
          (t.chemical_name && t.chemical_name.toLowerCase().includes(q)) ||
          (t.user_email && t.user_email.toLowerCase().includes(q)) ||
          (t.notes && t.notes.toLowerCase().includes(q))
      )
    }

    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [transactions, historyFilter, historySearch])

  const stats = useMemo(() => {
    return {
      total: chemicals.length,
      low: chemicals.filter(isLow).length,
      expired: chemicals.filter(isExpired).length,
      soon: chemicals.filter(isExpiringSoon).length,
      missingSds: chemicals.filter((c) => !c.sds_filename).length,
    }
  }, [chemicals])

  const compatibilityIssues = useMemo(() => {
    const issues = []
    const byLocation = {}

    chemicals.forEach((c) => {
      const loc = (c.location || 'Unassigned').trim()
      if (!byLocation[loc]) byLocation[loc] = []
      byLocation[loc].push(c)
    })

    Object.entries(byLocation).forEach(([location, chemsInLoc]) => {
      for (let i = 0; i < chemsInLoc.length; i++) {
        for (let j = i + 1; j < chemsInLoc.length; j++) {
          const chemA = chemsInLoc[i]
          const chemB = chemsInLoc[j]
          const symbolsA = chemA.hazard_symbols || []
          const symbolsB = chemB.hazard_symbols || []

          COMPATIBILITY_RULES.forEach((rule) => {
            const hasConflict =
              (symbolsA.includes(rule.a) && symbolsB.includes(rule.b)) ||
              (symbolsA.includes(rule.b) && symbolsB.includes(rule.a))

            if (hasConflict) {
              issues.push({
                location,
                chemA: chemA.name,
                chemB: chemB.name,
                risk: rule.risk,
                reason: rule.reason,
              })
            }
          })
        }
      }
    })

    return issues
  }, [chemicals])

  /* ========================================================================
     KEYBOARD SHORTCUTS
  ======================================================================== */

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl + K → Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen((prev) => !prev)
      }

      // Cmd/Ctrl + N → New chemical
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && session) {
        e.preventDefault()
        resetForm()
        setShowForm(true)
      }

      // Escape → Close everything
      if (e.key === 'Escape') {
        setCommandOpen(false)
        setHazardLegendOpen(false)
        setNotifOpen(false)
        setExportOpen(false)
        setShowUsageModal(false)
        setShowHistory(false)
        setCompatOpen(false)
        if (showForm) resetForm()
      }

      // / → Focus search
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      ) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [session, showForm])

  /* ========================================================================
     RENDER GUARDS
  ======================================================================== */

  if (loadingAuth) {
    return (
      <div className="loading-screen">
        <div className="spinner-lg" />
        <p>Loading Chemical Inventory…</p>
      </div>
    )
  }

  if (!session) {
    if (!showLogin) {
      return <Landing onGetStarted={() => setShowLogin(true)} />
    }
    return <Login onLogin={setSession} />
  }

  /* ========================================================================
     MAIN RENDER
  ======================================================================== */

  return (
    <div className="app">
      {/* Toast Notification */}
      {message && (
        <div className={`toast toast-${message.type}`} key={message.id} role="alert">
          <span className="toast-icon">{message.type === 'success' ? '✓' : '✕'}</span>
          <span>{message.text}</span>
        </div>
      )}

      {/* ========== HEADER ========== */}
      <header className="header">
        <div className="header-brand">
          <div className="logo" aria-hidden="true">⚗️</div>
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
              aria-label="Notifications"
            >
              🔔
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </button>

            {notifOpen && (
              <div className="notif-dropdown" role="dialog">
                <div className="notif-header">
                  <strong>Notifications</strong>
                  <div className="notif-actions">
                    <button type="button" onClick={markAllRead}>Mark all read</button>
                    <button type="button" onClick={clearNotifications}>Clear</button>
                  </div>
                </div>

                <div className="notif-list">
                  {notifications.length === 0 ? (
                    <div className="notif-empty">No notifications at the moment</div>
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
            aria-label="Usage History"
          >
            📋
          </button>

          <button
            className="icon-btn"
            onClick={() => setCompatOpen(true)}
            title="Compatibility Checker"
            aria-label="Compatibility Checker"
          >
            ⚠️
            {compatibilityIssues.length > 0 && (
              <span className="notif-badge">{compatibilityIssues.length}</span>
            )}
          </button>

          <button
            className="icon-btn"
            onClick={() => setCommandOpen(true)}
            title="Command palette (⌘K)"
          >
            ⌘K
          </button>

          <button
            className="icon-btn theme-toggle"
            onClick={toggleTheme}
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          <div className="user-chip">
            <span className="user-email">{session.user?.email}</span>
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

      {/* ========== VIEW SWITCHER ========== */}
      <div className="view-switcher">
        <button
          className={mainView === 'inventory' ? 'active' : ''}
          onClick={() => setMainView('inventory')}
        >
          📦 Inventory
        </button>
        <button
          className={mainView === 'dashboard' ? 'active' : ''}
          onClick={() => setMainView('dashboard')}
        >
          📊 Dashboard
        </button>
      </div>

      {/* ========== DASHBOARD VIEW ========== */}
      {mainView === 'dashboard' ? (
        <div className="dashboard">
          <div className="stats-bar">
            <div className="stat-card">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">Total Chemicals</span>
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
            <div className={`stat-card ${compatibilityIssues.length > 0 ? 'danger' : ''}`}>
              <span className="stat-value">{compatibilityIssues.length}</span>
              <span className="stat-label">Compat. Issues</span>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="dash-card">
              <h3>Recent Activity</h3>
              <div className="dash-list">
                {transactions.length === 0 ? (
                  <p className="text-muted">No activity recorded yet</p>
                ) : (
                  transactions.slice(0, 10).map((t) => (
                    <div key={t.id} className="dash-item">
                      <span className={`history-type type-${t.type}`}>
                        {t.type === 'take' ? '➖' : t.type === 'return' ? '➕' : '✏️'}
                      </span>
                      <div>
                        <strong>{t.chemical_name}</strong>
                        <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                          {t.user_email} • {formatDateTime(t.created_at)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="dash-card">
              <h3>Compatibility Warnings</h3>
              <div className="dash-list">
                {compatibilityIssues.length === 0 ? (
                  <p className="text-muted">No compatibility issues detected</p>
                ) : (
                  compatibilityIssues.slice(0, 8).map((issue, idx) => (
                    <div key={idx} className="dash-item">
                      <span
                        style={{
                          color: issue.risk === 'High' ? 'var(--danger)' : 'var(--warning)',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                        }}
                      >
                        {issue.risk}
                      </span>
                      <div>
                        <strong>
                          {issue.chemA} + {issue.chemB}
                        </strong>
                        <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                          {issue.location} • {issue.reason}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========== INVENTORY VIEW ========== */
        <>
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
                placeholder="Search name, CAS, formula, batch, supplier, location…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search chemicals"
              />
              {search && (
                <button className="clear-btn" onClick={() => setSearch('')} aria-label="Clear search">
                  ✕
                </button>
              )}
            </div>

            <div className="filter-pills">
              {FILTER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={`pill ${filter === preset.id ? 'active' : ''}`}
                  onClick={() => setFilter(preset.id)}
                >
                  <span>{preset.icon}</span> {preset.label}
                </button>
              ))}
            </div>

            <select
              className="sort-select"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              aria-label="Filter by location"
            >
              <option value="">All Locations</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>

            <select
              className="sort-select"
              value={hazardFilter}
              onChange={(e) => setHazardFilter(e.target.value)}
              aria-label="Filter by hazard"
            >
              <option value="">All Hazards</option>
              {HAZARD_OPTIONS.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.emoji} {h.label}
                </option>
              ))}
            </select>

            <div className="toolbar-right">
              <select
                className="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort by"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
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

              {/* Export Dropdown */}
              <div className="export-wrapper" ref={exportRef}>
                <button className="btn btn-ghost" onClick={() => setExportOpen((v) => !v)}>
                  ⬇ Export
                </button>
                {exportOpen && (
                  <div className="export-dropdown">
                    <button type="button" onClick={handleExportCurrent}>
                      Export Current View (CSV)
                    </button>
                    <button type="button" onClick={handleExportAll}>
                      Export All Chemicals (CSV)
                    </button>
                    <button type="button" onClick={handleExportTransactions}>
                      Export Usage History (CSV)
                    </button>
                    <div className="export-divider" />
                    <button type="button" onClick={handleExportPDF}>
                      PDF Report (Current View)
                    </button>
                    <button type="button" onClick={handleExportPDFAll}>
                      PDF Report (All Chemicals)
                    </button>
                  </div>
                )}
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
                Clear Selection
              </button>
            </div>
          )}

          {/* ========== ADD / EDIT FORM ========== */}
          {showForm && (
            <div
              className="form-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget) resetForm()
              }}
            >
              <div className="form-panel" ref={formRef}>
                <div className="form-header">
                  <h2>{editingId ? 'Edit Chemical' : 'Add New Chemical'}</h2>
                  <button className="icon-btn" onClick={resetForm} aria-label="Close form">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                  <div className="form-grid">
                    <div className={`form-group ${formErrors.name ? 'error' : ''}`}>
                      <label htmlFor="name">Name *</label>
                      <input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="e.g. Sulfuric Acid"
                        autoFocus
                      />
                      {formErrors.name && <span className="error-text">{formErrors.name}</span>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="cas_number">CAS Number</label>
                      <input
                        id="cas_number"
                        name="cas_number"
                        value={formData.cas_number}
                        onChange={handleChange}
                        placeholder="e.g. 7664-93-9"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="molecular_formula">Molecular Formula</label>
                      <input
                        id="molecular_formula"
                        name="molecular_formula"
                        value={formData.molecular_formula}
                        onChange={handleChange}
                        placeholder="e.g. H₂SO₄"
                      />
                    </div>

                    <div className={`form-group ${formErrors.quantity ? 'error' : ''}`}>
                      <label htmlFor="quantity">Quantity</label>
                      <input
                        id="quantity"
                        name="quantity"
                        type="number"
                        step="any"
                        value={formData.quantity}
                        onChange={handleChange}
                      />
                      {formErrors.quantity && (
                        <span className="error-text">{formErrors.quantity}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor="unit">Unit</label>
                      <select id="unit" name="unit" value={formData.unit} onChange={handleChange}>
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="location">Location</label>
                      <input
                        id="location"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        placeholder="e.g. Cabinet A / Shelf 3"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="expiry_date">Expiry Date</label>
                      <input
                        id="expiry_date"
                        name="expiry_date"
                        type="date"
                        value={formData.expiry_date}
                        onChange={handleChange}
                      />
                    </div>

                    <div className={`form-group ${formErrors.min_stock ? 'error' : ''}`}>
                      <label htmlFor="min_stock">Min Stock Level</label>
                      <input
                        id="min_stock"
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

                    <div className="form-group">
                      <label htmlFor="batch_lot">Batch / Lot Number</label>
                      <input
                        id="batch_lot"
                        name="batch_lot"
                        value={formData.batch_lot}
                        onChange={handleChange}
                        placeholder="e.g. LOT-2024-0847"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="supplier">Supplier</label>
                      <input
                        id="supplier"
                        name="supplier"
                        value={formData.supplier}
                        onChange={handleChange}
                        placeholder="e.g. Sigma-Aldrich"
                      />
                    </div>

                    <div className="form-group full">
                      <label htmlFor="hazard_notes">Hazard Notes</label>
                      <input
                        id="hazard_notes"
                        name="hazard_notes"
                        value={formData.hazard_notes}
                        onChange={handleChange}
                        placeholder="Additional safety or handling notes…"
                      />
                    </div>
                  </div>

                  <div className="hazard-selector">
                    <label>Hazard Symbols (GHS)</label>
                    <div className="hazard-grid">
                      {HAZARD_OPTIONS.map((h) => {
                        const isActive = formData.hazard_symbols?.includes(h.id)
                        return (
                          <button
                            type="button"
                            key={h.id}
                            className={`hazard-chip ${isActive ? 'active' : ''}`}
                            onClick={() => toggleHazard(h.id)}
                            style={{
                              borderColor: isActive ? h.color : undefined,
                              background: isActive ? `${h.color}22` : undefined,
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

          {/* ========== USAGE MODAL ========== */}
          {showUsageModal && usageChem && (
            <div
              className="form-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowUsageModal(false)
              }}
            >
              <div className="form-panel" style={{ maxWidth: 480 }}>
                <div className="form-header">
                  <h2>Log Usage</h2>
                  <button className="icon-btn" onClick={() => setShowUsageModal(false)}>
                    ✕
                  </button>
                </div>

                <div
                  style={{
                    marginBottom: 20,
                    padding: '12px 16px',
                    background: 'var(--bg)',
                    borderRadius: 10,
                  }}
                >
                  <strong>{usageChem.name}</strong>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Current stock: {usageChem.quantity} {usageChem.unit}
                  </div>
                </div>

                <form onSubmit={handleLogUsage}>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label>Action</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['take', 'return', 'adjust'].map((actionType) => (
                        <button
                          key={actionType}
                          type="button"
                          className={`btn ${usageForm.type === actionType ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setUsageForm((f) => ({ ...f, type: actionType }))}
                          style={{ flex: 1, textTransform: 'capitalize' }}
                        >
                          {actionType === 'take' && '➖ Take'}
                          {actionType === 'return' && '➕ Return'}
                          {actionType === 'adjust' && '✏️ Adjust'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label>
                      {usageForm.type === 'adjust' ? 'New Total Quantity' : 'Quantity'} ({usageChem.unit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={usageForm.quantity}
                      onChange={(e) => setUsageForm((f) => ({ ...f, quantity: e.target.value }))}
                      placeholder={usageForm.type === 'adjust' ? 'Enter new total quantity' : 'Amount'}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label>Notes (optional)</label>
                    <input
                      value={usageForm.notes}
                      onChange={(e) => setUsageForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="e.g. Used for Experiment #42"
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

          {/* ========== MAIN CONTENT ========== */}
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
                  {search || filter !== 'all' || locationFilter || hazardFilter
                    ? 'Try adjusting your search or filters.'
                    : 'Get started by adding your first chemical.'}
                </p>
                {!search && filter === 'all' && !locationFilter && !hazardFilter && (
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
              /* ---- CARD VIEW ---- */
              <div className="cards-grid">
                {filtered.map((chem) => {
                  const expired = isExpired(chem)
                  const low = isLow(chem)
                  const soon = isExpiringSoon(chem)
                  const days = daysUntil(chem.expiry_date)
                  const stockPct =
                    chem.min_stock > 0
                      ? Math.min(100, Math.round((Number(chem.quantity) / (Number(chem.min_stock) * 2)) * 100))
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
                          <span className={getStatusBadgeClass(chem)}>{getStatus(chem)}</span>
                        </div>
                      </div>

                      <div className="card-meta">
                        {chem.molecular_formula && (
                          <span className="meta-item formula">{chem.molecular_formula}</span>
                        )}
                        {chem.cas_number && <span className="meta-item">CAS {chem.cas_number}</span>}
                        {chem.batch_lot && <span className="meta-item">Lot: {chem.batch_lot}</span>}
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
                        {chem.supplier && (
                          <div>
                            <span className="detail-label">Supplier</span>
                            <span>{chem.supplier}</span>
                          </div>
                        )}
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
                                  e.target.files?.[0] && handleSdsUpload(chem.id, e.target.files[0])
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
                                e.target.files?.[0] && handleSdsUpload(chem.id, e.target.files[0])
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
              /* ---- TABLE VIEW ---- */
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
                            aria-label="Select all"
                          />
                        </th>
                      )}
                      <th>Name</th>
                      <th>Formula</th>
                      <th>CAS</th>
                      <th>Qty</th>
                      <th>Location</th>
                      <th>Batch/Lot</th>
                      <th>Supplier</th>
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
                          className={expired ? 'row-expired' : low ? 'row-low' : soon ? 'row-soon' : ''}
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
                          <td>{chem.batch_lot || '—'}</td>
                          <td>{chem.supplier || '—'}</td>
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
                            <span className={getStatusBadgeClass(chem)}>{getStatus(chem)}</span>
                          </td>
                          <td className="sds-cell">
                            {uploadProgress[chem.id] !== undefined ? (
                              <div className="mini-progress">
                                <div style={{ width: `${uploadProgress[chem.id]}%` }} />
                              </div>
                            ) : chem.sds_filename ? (
                              <div className="sds-actions">
                                <button className="link-btn" onClick={() => handleDownloadSds(chem.id)}>
                                  Download
                                </button>
                                <label className="link-btn">
                                  Replace
                                  <input
                                    type="file"
                                    accept=".pdf"
                                    hidden
                                    onChange={(e) =>
                                      e.target.files?.[0] &&
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
                                    e.target.files?.[0] && handleSdsUpload(chem.id, e.target.files[0])
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
        </>
      )}

      {/* ========== USAGE HISTORY DRAWER ========== */}
      {showHistory && (
        <div
          className="form-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHistory(false)
          }}
        >
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
                placeholder="Search by chemical, user or notes…"
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
                          {t.type === 'take' && '➖ Take'}
                          {t.type === 'return' && '➕ Return'}
                          {t.type === 'adjust' && '✏️ Adjust'}
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

      {/* ========== COMPATIBILITY CHECKER MODAL ========== */}
      {compatOpen && (
        <div className="modal-overlay" onClick={() => setCompatOpen(false)}>
          <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chemical Compatibility Checker</h3>
              <button className="icon-btn" onClick={() => setCompatOpen(false)}>
                ✕
              </button>
            </div>

            {compatibilityIssues.length === 0 ? (
              <p style={{ padding: '24px 0', color: 'var(--text-muted)' }}>
                No compatibility issues were detected based on the current hazard symbols and storage
                locations.
              </p>
            ) : (
              <div className="compat-list">
                {compatibilityIssues.map((issue, index) => (
                  <div key={index} className={`compat-item risk-${issue.risk.toLowerCase()}`}>
                    <div className="compat-risk">{issue.risk} Risk</div>
                    <div>
                      <strong>
                        {issue.chemA} + {issue.chemB}
                      </strong>
                      <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
                        Location: {issue.location}
                      </div>
                      <div style={{ fontSize: '0.9rem', marginTop: 6 }}>{issue.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== COMMAND PALETTE ========== */}
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
                  setMainView('dashboard')
                  setCommandOpen(false)
                }}
              >
                <span>📊</span> Go to Dashboard
              </button>
              <button
                onClick={() => {
                  setMainView('inventory')
                  setCommandOpen(false)
                }}
              >
                <span>📦</span> Go to Inventory
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
                  setCompatOpen(true)
                  setCommandOpen(false)
                }}
              >
                <span>⚠️</span> Compatibility Checker
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
                  handleExportPDF()
                  setCommandOpen(false)
                }}
              >
                <span>📄</span> Generate PDF Report
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

      {/* ========== HAZARD LEGEND MODAL ========== */}
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

      {/* ========== FOOTER ========== */}
      <footer className="app-footer">
        <span>
          Showing <strong>{filtered.length}</strong> of <strong>{chemicals.length}</strong> chemicals
        </span>
        <span className="footer-hint">
          <kbd>/</kbd> search • <kbd>⌘K</kbd> commands • <kbd>⌘N</kbd> new chemical
        </span>
      </footer>
    </div>
  )
}

export default App