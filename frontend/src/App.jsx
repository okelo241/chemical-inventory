import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Landing from './Landing'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Html5Qrcode } from 'html5-qrcode'
import { QRCodeSVG } from 'qrcode.react'
import './App.css'

import pictogramExplosive from './assets/Pictograms/exploding_bomb.gif'
import pictogramFlammable from './assets/Pictograms/flame.gif'
import pictogramOxidizing from './assets/Pictograms/flame_over_circle.gif'
import pictogramGas from './assets/Pictograms/gas_cylinder.gif'
import pictogramCorrosive from './assets/Pictograms/corrosion.gif'
import pictogramToxic from './assets/Pictograms/skull_and_crossbones.gif'
import pictogramHarmful from './assets/Pictograms/exclamation_mark.gif'
import pictogramHealth from './assets/Pictograms/health_hazard.gif'
import pictogramEnvironmental from './assets/Pictograms/GHS-pictogram-pollu.svg.webp'
import pictogramBiohazard from './assets/Pictograms/biohazardous_infectious_materials.gif'

/* ====================== CONSTANTS ====================== */

const CHEMICAL_CLASSES = [
  { id: 'acid', label: 'Acid (Strong / Weak)', color: '#ef4444' },
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

const HAZARD_OPTIONS = [
  { id: 'explosive', label: 'Explosive', emoji: '💥', color: '#ef4444', icon: pictogramExplosive },
  { id: 'flammable', label: 'Flammable', emoji: '🔥', color: '#f97316', icon: pictogramFlammable },
  { id: 'oxidizing', label: 'Oxidizing', emoji: '⚗️', color: '#eab308', icon: pictogramOxidizing },
  { id: 'gas', label: 'Compressed Gas', emoji: '🧴', color: '#3b82f6', icon: pictogramGas },
  { id: 'corrosive', label: 'Corrosive', emoji: '🧪', color: '#a855f7', icon: pictogramCorrosive },
  { id: 'toxic', label: 'Toxic', emoji: '☠️', color: '#64748b', icon: pictogramToxic },
  { id: 'harmful', label: 'Harmful / Irritant', emoji: '⚠️', color: '#f59e0b', icon: pictogramHarmful },
  { id: 'health', label: 'Health Hazard', emoji: '🫁', color: '#ec4899', icon: pictogramHealth },
  { id: 'environmental', label: 'Environmental', emoji: '🌍', color: '#22c55e', icon: pictogramEnvironmental },
  { id: 'acute_toxicity', label: 'Acute Toxicity', emoji: '☠️', color: '#7f1d1d', icon: pictogramToxic },
  { id: 'carcinogen', label: 'Carcinogen', emoji: '☢️', color: '#9f1239', icon: pictogramHealth },
  { id: 'aspiration', label: 'Aspiration Hazard', emoji: '🫁', color: '#be185d', icon: pictogramHealth },
  { id: 'biohazard', label: 'Biohazard', emoji: '☣️', color: '#166534', icon: pictogramBiohazard },
]

const CLASS_COMPATIBILITY_RULES = [
  { a: 'acid', b: 'base', risk: 'High', reason: 'Acids and bases react violently and can generate significant heat and splashing.' },
  { a: 'acid', b: 'cyanide', risk: 'High', reason: 'Acids + cyanides release highly toxic hydrogen cyanide (HCN) gas.' },
  { a: 'acid', b: 'sulfide', risk: 'High', reason: 'Acids + sulfides release toxic hydrogen sulfide (H₂S) gas.' },
  { a: 'acid', b: 'water_reactive', risk: 'High', reason: 'Many water-reactive chemicals react violently when mixed with acids.' },
  { a: 'oxidizer', b: 'flammable_solvent', risk: 'High', reason: 'Oxidizers mixed with flammable solvents can cause fire or explosion.' },
  { a: 'oxidizer', b: 'organic', risk: 'High', reason: 'Oxidizers + organic materials are a serious fire and explosion hazard.' },
  { a: 'oxidizer', b: 'water_reactive', risk: 'High', reason: 'This combination is highly reactive and dangerous.' },
  { a: 'water_reactive', b: 'flammable_solvent', risk: 'High', reason: 'Water-reactive chemicals can ignite flammable solvents.' },
  { a: 'peroxide_former', b: 'oxidizer', risk: 'High', reason: 'Peroxide formers become extremely dangerous in the presence of oxidizers.' },
  { a: 'explosive', b: 'oxidizer', risk: 'High', reason: 'Oxidizers can sensitize or initiate explosive materials.' },
  { a: 'halogen', b: 'flammable_solvent', risk: 'High', reason: 'Halogens react dangerously with many organic solvents.' },
  { a: 'acid', b: 'flammable_solvent', risk: 'Medium', reason: 'Acids can damage containers and increase secondary fire hazards.' },
  { a: 'base', b: 'flammable_solvent', risk: 'Medium', reason: 'Bases can degrade containers holding flammable solvents.' },
  { a: 'toxic', b: 'flammable_solvent', risk: 'Medium', reason: 'A fire involving toxic materials creates additional serious hazards.' },
  { a: 'compressed_gas', b: 'flammable_solvent', risk: 'Medium', reason: 'Compressed gases stored near flammables increase overall risk.' },
]

const UNITS = ['g', 'mg', 'kg', 'ml', 'L', 'µl', 'mol', 'units']

const SORT_OPTIONS = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'quantity', label: 'Quantity (High → Low)' },
  { value: 'quantity-asc', label: 'Quantity (Low → High)' },
  { value: 'expiry', label: 'Expiry (Soonest first)' },
  { value: 'expiry-desc', label: 'Expiry (Latest first)' },
  { value: 'location', label: 'Location' },
  { value: 'supplier', label: 'Supplier' },
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
  batch_lot: '',
  supplier: '',
  chemical_classes: [],
  barcode: '',
}

const IDLE_TIMEOUT_MS = 30 * 60 * 1000

/* ====================== PURE HELPERS ====================== */

const daysUntil = (dateStr) => {
  if (!dateStr) return null
  try {
    return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
  } catch {
    return null
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

const isExpired = (c) => c?.expiry_date && daysUntil(c.expiry_date) < 0
const isLow = (c) => Number(c?.quantity || 0) <= Number(c?.min_stock || 0)
const isExpiringSoon = (c) => {
  const d = daysUntil(c?.expiry_date)
  return d !== null && d >= 0 && d <= 30
}
const getStatus = (c) => (isExpired(c) ? 'Expired' : isLow(c) ? 'Low Stock' : isExpiringSoon(c) ? 'Expiring Soon' : 'OK')
const getStatusBadgeClass = (c) =>
  isExpired(c) ? 'badge badge-red' : isLow(c) ? 'badge badge-orange' : isExpiringSoon(c) ? 'badge badge-yellow' : 'badge badge-green'

const HazardIcon = ({ hazard, size = 24 }) => {
  if (!hazard?.icon) return <span>{hazard?.emoji || '⚠️'}</span>
  return (
    <img
      src={hazard.icon}
      alt={hazard.label}
      title={hazard.label}
      style={{ width: size, height: size, objectFit: 'contain', verticalAlign: 'middle' }}
    />
  )
}

const autoClassifyChemical = (name = '', hazardSymbols = []) => {
  const classes = new Set()
  const lower = (name || '').toLowerCase().trim()
  if (/(acid|hcl|h2so4|hno3|acetic|formic|phosphoric|hydrochloric|sulfuric|nitric)/.test(lower)) classes.add('acid')
  if (/(hydroxide|naoh|koh|ammonia|amine)/.test(lower)) classes.add('base')
  if (/(peroxide|nitrate|permanganate|chromate|dichromate|hypochlorite)/.test(lower)) classes.add('oxidizer')
  if (/(ether|thf|dioxane|tetrahydrofuran)/.test(lower)) {
    classes.add('peroxide_former')
    classes.add('flammable_solvent')
  }
  if (/(acetone|ethanol|methanol|isopropanol|hexane|toluene|xylene|benzene)/.test(lower)) classes.add('flammable_solvent')
  if (/(sodium metal|lithium|potassium metal|calcium carbide)/.test(lower)) classes.add('water_reactive')
  if (/cyanide/.test(lower)) classes.add('cyanide')
  if (/sulfide/.test(lower)) classes.add('sulfide')
  if (/(chlorine|bromine|iodine|fluorine)/.test(lower)) classes.add('halogen')
  if (/(picric|trinitro|azide)/.test(lower)) classes.add('explosive')
  if (Array.isArray(hazardSymbols)) {
    if (hazardSymbols.includes('flammable')) classes.add('flammable_solvent')
    if (hazardSymbols.includes('oxidizing')) classes.add('oxidizer')
    if (hazardSymbols.includes('explosive')) classes.add('explosive')
    if (hazardSymbols.includes('gas')) classes.add('compressed_gas')
    if (hazardSymbols.includes('toxic') || hazardSymbols.includes('acute_toxicity')) classes.add('toxic')
  }
  return Array.from(classes)
}

const lookupPubChem = async (query) => {
  if (!query || query.trim().length < 2) return null
  try {
    const searchRes = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query.trim())}/cids/JSON`
    )
    if (!searchRes.ok) return null
    const searchData = await searchRes.json()
    const cid = searchData?.IdentifierList?.CID?.[0]
    if (!cid) return null
    const propRes = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,IUPACName,Title/JSON`
    )
    if (!propRes.ok) return null
    const propData = await propRes.json()
    const p = propData?.PropertyTable?.Properties?.[0]
    if (!p) return null
    return { molecular_formula: p.MolecularFormula || null, iupac_name: p.IUPACName || p.Title || null, cid }
  } catch {
    return null
  }
}

const downloadCSV = (filename, rows) => {
  if (!rows?.length) return
  const headers = Object.keys(rows[0])
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const exportChemicalsCSV = (list, filename = 'chemicals.csv') => {
  downloadCSV(
    filename,
    list.map((c) => ({
      Name: c.name || '',
      'Molecular Formula': c.molecular_formula || '',
      'CAS Number': c.cas_number || '',
      Quantity: c.quantity ?? '',
      Unit: c.unit || '',
      Location: c.location || '',
      'Batch / Lot': c.batch_lot || '',
      Supplier: c.supplier || '',
      Barcode: c.barcode || '',
      'Expiry Date': c.expiry_date || '',
      'Min Stock': c.min_stock ?? '',
      'Chemical Classes': (c.chemical_classes || []).join(', '),
      'Hazard Symbols': (c.hazard_symbols || []).join(', '),
      Status: getStatus(c),
    }))
  )
}

const exportTransactionsCSV = (list) => {
  downloadCSV(
    `usage-history-${new Date().toISOString().slice(0, 10)}.csv`,
    list.map((t) => ({
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
  )
}

const generatePDFReport = (list, title = 'Chemical Inventory Report') => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, pw, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Chemical Inventory System', 14, 12)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(title, 14, 20)
  doc.text(`Generated: ${new Date().toLocaleString()}`, pw - 14, 12, { align: 'right' })
  doc.text(`Total: ${list.length}`, pw - 14, 20, { align: 'right' })
  const low = list.filter(isLow).length
  const expired = list.filter(isExpired).length
  const soon = list.filter(isExpiringSoon).length
  doc.setFillColor(241, 245, 249)
  doc.roundedRect(14, 34, pw - 28, 16, 3, 3, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`Total: ${list.length}`, 20, 44)
  doc.setTextColor(217, 119, 6)
  doc.text(`Low: ${low}`, 60, 44)
  doc.setTextColor(202, 138, 4)
  doc.text(`Soon: ${soon}`, 110, 44)
  doc.setTextColor(220, 38, 38)
  doc.text(`Expired: ${expired}`, 160, 44)
  autoTable(doc, {
    startY: 56,
    head: [['Name', 'Formula', 'CAS', 'Qty', 'Location', 'Batch/Lot', 'Supplier', 'Expiry', 'Status']],
    body: list.map((c) => [
      c.name || '',
      c.molecular_formula || '—',
      c.cas_number || '—',
      `${c.quantity ?? 0} ${c.unit || ''}`,
      c.location || '—',
      c.batch_lot || '—',
      c.supplier || '—',
      formatDate(c.expiry_date),
      getStatus(c),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7 },
    margin: { left: 14, right: 14 },
  })
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`Page ${i} of ${pages}`, pw / 2, ph - 8, { align: 'center' })
  }
  doc.save(`chemical-inventory-${new Date().toISOString().slice(0, 10)}.pdf`)
}

/* ====================== APP ====================== */

function App() {
  const [session, setSession] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [showLogin, setShowLogin] = useState(false)
  const [showLanding, setShowLanding] = useState(false)

  const [chemicals, setChemicals] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode') || 'table')
  const [mainView, setMainView] = useState('inventory')
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

  const [notifications, setNotifications] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => localStorage.getItem('notificationsEnabled') !== 'false'
  )

  const [showUsageModal, setShowUsageModal] = useState(false)
  const [usageChem, setUsageChem] = useState(null)
  const [usageForm, setUsageForm] = useState({ type: 'take', quantity: '', notes: '' })
  const [showHistory, setShowHistory] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('all')
  const [historySearch, setHistorySearch] = useState('')
  const [loggingUsage, setLoggingUsage] = useState(false)

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [lookingUp, setLookingUp] = useState(false)

  const [showScanner, setShowScanner] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [showQrModal, setShowQrModal] = useState(null)

  const searchRef = useRef(null)
  const formRef = useRef(null)
  const toastTimeout = useRef(null)
  const notifRef = useRef(null)
  const exportRef = useRef(null)
  const html5QrCodeRef = useRef(null)
  const idleTimerRef = useRef(null)

  const API_URL = import.meta.env.VITE_API_URL

  /* Theme */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])
  const toggleTheme = useCallback(() => setTheme((p) => (p === 'light' ? 'dark' : 'light')), [])
  useEffect(() => localStorage.setItem('viewMode', viewMode), [viewMode])

  /* Auth */
  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (mounted) {
        setSession(s)
        setLoadingAuth(false)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (mounted) setSession(s)
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const showMessage = useCallback((type, text) => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current)
    setMessage({ type, text, id: Date.now() })
    toastTimeout.current = setTimeout(() => setMessage(null), 4000)
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
      setShowLanding(false)
      setNotifications([])
      setMainView('inventory')
    } catch {
      showMessage('error', 'Failed to log out')
    }
  }

  const getAccessToken = useCallback(async () => {
    const { data: { session: s } } = await supabase.auth.getSession()
    return s?.access_token || null
  }, [])

  /* Idle logout */
  useEffect(() => {
    if (!session) return
    const reset = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => {
        handleLogout()
        showMessage('error', 'You were logged out due to inactivity')
      }, IDLE_TIMEOUT_MS)
    }
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach((e) => window.addEventListener(e, reset))
    reset()
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ========== BARCODE / QR (inside App) ========== */
  const generateBarcodeValue = () =>
    `CHEM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  const handleGenerateBarcode = () => {
    setFormData((prev) => ({
      ...prev,
      barcode: generateBarcodeValue(),
    }))
    showMessage('success', 'Barcode generated')
  }

  const startScanner = async () => {
    setShowScanner(true)
    setScanResult(null)
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode('qr-reader')
        html5QrCodeRef.current = html5QrCode
        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            setScanResult(decodedText)
            html5QrCode.stop().then(() => { html5QrCodeRef.current = null }).catch(() => {})
            const match = chemicals.find((c) => c.barcode === decodedText)
            if (match) {
              setSearch(match.name)
              setFilter('all')
              setMainView('inventory')
              showMessage('success', `Found: ${match.name}`)
              setShowScanner(false)
            } else {
              showMessage('error', `No chemical found with code: ${decodedText}`)
            }
          },
          () => {}
        )
      } catch {
        showMessage('error', 'Camera access denied or not available')
        setShowScanner(false)
      }
    }, 300)
  }

  const stopScanner = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().then(() => { html5QrCodeRef.current = null }).catch(() => {})
    }
    setShowScanner(false)
    setScanResult(null)
  }

  /* Notifications */
  const createNotification = (type, title, messageText, chemId = null) => ({
    id: `${type}-${chemId || Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type, title, message: messageText, chemId, createdAt: new Date().toISOString(), read: false,
  })

  const checkAndNotify = useCallback((list) => {
    if (!notificationsEnabled || !list?.length) return
    const next = []
    list.forEach((c) => {
      if (isExpired(c)) next.push(createNotification('expired', 'Chemical Expired', `"${c.name}" expired on ${formatDate(c.expiry_date)}`, c.id))
      else if (isExpiringSoon(c)) {
        const d = daysUntil(c.expiry_date)
        next.push(createNotification('soon', 'Expiring Soon', `"${c.name}" expires in ${d} day${d !== 1 ? 's' : ''}`, c.id))
      }
      if (isLow(c)) next.push(createNotification('low', 'Low Stock', `"${c.name}" is low (${c.quantity} ${c.unit})`, c.id))
    })
    setNotifications((prev) => {
      const keys = new Set(prev.map((n) => `${n.type}-${n.chemId}`))
      const unique = next.filter((n) => !keys.has(`${n.type}-${n.chemId}`))
      if (!unique.length) return prev
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        unique.forEach((n) => { try { new Notification(n.title, { body: n.message, tag: n.id }) } catch {} })
      }
      return [...unique, ...prev].slice(0, 50)
    })
  }, [notificationsEnabled])

  useEffect(() => { if (chemicals.length) checkAndNotify(chemicals) }, [chemicals, checkAndNotify])

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return showMessage('error', 'Notifications not supported')
    const perm = await Notification.requestPermission()
    setNotifPermission(perm)
    if (perm === 'granted') {
      showMessage('success', 'Notifications enabled')
      setNotificationsEnabled(true)
      localStorage.setItem('notificationsEnabled', 'true')
      checkAndNotify(chemicals)
    }
  }

  const toggleNotifications = () => {
    const next = !notificationsEnabled
    setNotificationsEnabled(next)
    localStorage.setItem('notificationsEnabled', String(next))
    if (next && notifPermission !== 'granted') requestNotificationPermission()
  }

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* API */
  const fetchChemicals = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      const token = await getAccessToken()
      if (!token) throw new Error('No token')
      const res = await fetch(`${API_URL}/chemicals`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setChemicals(Array.isArray(data) ? data : [])
    } catch {
      showMessage('error', 'Could not load chemicals')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [API_URL, getAccessToken, showMessage])

  const fetchTransactions = useCallback(async () => {
    try {
      const token = await getAccessToken()
      if (!token) return
      const res = await fetch(`${API_URL}/transactions`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to load transactions')
      const data = await res.json()
      setTransactions(Array.isArray(data) ? data : [])
    } catch (err) {
      console.warn('Could not load transactions:', err.message)
    }
  }, [API_URL, getAccessToken])

  useEffect(() => {
    if (session) {
      fetchChemicals()
      fetchTransactions()
    }
  }, [session, fetchChemicals, fetchTransactions])

  /* CRUD */
  const handleSubmit = async (e) => {
    e.preventDefault()
    const errors = {}
    if (!formData.name?.trim()) errors.name = 'Name is required'
    if (formData.quantity !== '' && isNaN(Number(formData.quantity))) errors.quantity = 'Must be a number'
    if (formData.min_stock !== '' && isNaN(Number(formData.min_stock))) errors.min_stock = 'Must be a number'
    setFormErrors(errors)
    if (Object.keys(errors).length) return

    setSubmitting(true)
    try {
      const token = await getAccessToken()
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
        hazard_symbols: formData.hazard_symbols?.length ? formData.hazard_symbols : null,
        batch_lot: formData.batch_lot.trim() || null,
        supplier: formData.supplier.trim() || null,
        chemical_classes: formData.chemical_classes?.length ? formData.chemical_classes : null,
        barcode: formData.barcode.trim() || null,
      }
      const url = editingId ? `${API_URL}/chemicals/${editingId}` : `${API_URL}/chemicals`
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Save failed')
      showMessage('success', editingId ? 'Chemical updated' : 'Chemical added')
      resetForm()
      fetchChemicals(true)
    } catch {
      showMessage('error', 'Failed to save chemical')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}" permanently?`)) return
    try {
      const token = await getAccessToken()
      const res = await fetch(`${API_URL}/chemicals/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      showMessage('success', `"${name}" deleted`)
      setSelectedIds((p) => { const n = new Set(p); n.delete(id); return n })
      fetchChemicals(true)
    } catch {
      showMessage('error', 'Failed to delete')
    }
  }

  const handleBulkDelete = async () => {
    if (!selectedIds.size || !window.confirm(`Delete ${selectedIds.size} chemical(s)?`)) return
    const token = await getAccessToken()
    let ok = 0
    for (const id of selectedIds) {
      try {
        const res = await fetch(`${API_URL}/chemicals/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) ok++
      } catch {}
    }
    showMessage('success', `Deleted ${ok} chemical(s)`)
    setSelectedIds(new Set())
    setBulkMode(false)
    fetchChemicals(true)
  }

  /* SDS */
  const handleSdsUpload = async (id, file) => {
    if (!file || file.type !== 'application/pdf') return showMessage('error', 'Only PDF allowed')
    setUploadProgress((p) => ({ ...p, [id]: 10 }))
    const token = await getAccessToken()
    const fd = new FormData()
    fd.append('file', file)
    try {
      const interval = setInterval(() => {
        setUploadProgress((p) => {
          const cur = p[id] || 10
          if (cur >= 90) { clearInterval(interval); return p }
          return { ...p, [id]: cur + 15 }
        })
      }, 200)
      const res = await fetch(`${API_URL}/chemicals/${id}/upload-sds`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      clearInterval(interval)
      setUploadProgress((p) => ({ ...p, [id]: 100 }))
      if (!res.ok) throw new Error()
      showMessage('success', 'SDS uploaded')
      setTimeout(() => setUploadProgress((p) => { const n = { ...p }; delete n[id]; return n }), 600)
      fetchChemicals(true)
    } catch {
      setUploadProgress((p) => { const n = { ...p }; delete n[id]; return n })
      showMessage('error', 'Upload failed')
    }
  }

  const handleDownloadSds = async (id) => {
    try {
      const token = await getAccessToken()
      const res = await fetch(`${API_URL}/chemicals/${id}/sds`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data?.url) window.open(data.url, '_blank')
      else showMessage('error', 'File not found')
    } catch {
      showMessage('error', 'Download failed')
    }
  }

  /* Usage */
  const openUsageModal = (chem) => {
    setUsageChem(chem)
    setUsageForm({ type: 'take', quantity: '', notes: '' })
    setShowUsageModal(true)
  }

  const handleLogUsage = async (e) => {
    e.preventDefault()
    if (!usageChem) return
    const qty = parseFloat(usageForm.quantity)
    if (!qty || qty <= 0) return showMessage('error', 'Enter a valid quantity')
    setLoggingUsage(true)
    try {
      const token = await getAccessToken()
      let change = 0
      if (usageForm.type === 'take') change = -qty
      else if (usageForm.type === 'return') change = qty
      else change = qty - Number(usageChem.quantity)
      const newQty = Math.max(0, Number(usageChem.quantity) + change)
      const updateRes = await fetch(`${API_URL}/chemicals/${usageChem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...usageChem, quantity: newQty }),
      })
      if (!updateRes.ok) throw new Error()
      const tx = {
        chemical_id: usageChem.id,
        chemical_name: usageChem.name,
        type: usageForm.type,
        quantity_change: change,
        quantity_before: Number(usageChem.quantity),
        quantity_after: newQty,
        unit: usageChem.unit,
        notes: usageForm.notes.trim() || null,
        user_email: session?.user?.email,
      }
      try {
        await fetch(`${API_URL}/transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(tx),
        })
      } catch {}
      setTransactions((p) => [{ id: `local-${Date.now()}`, ...tx, created_at: new Date().toISOString() }, ...p])
      showMessage('success', usageForm.type === 'take' ? `Took ${qty} ${usageChem.unit}` : usageForm.type === 'return' ? `Returned ${qty}` : `Adjusted to ${newQty}`)
      setShowUsageModal(false)
      setUsageChem(null)
      fetchChemicals(true)
      fetchTransactions()
    } catch {
      showMessage('error', 'Failed to log usage')
    } finally {
      setLoggingUsage(false)
    }
  }

  /* Export */
  const handleExportCurrent = () => {
    exportChemicalsCSV(filtered, `chemicals-filtered-${new Date().toISOString().slice(0, 10)}.csv`)
    setExportOpen(false)
    showMessage('success', `Exported ${filtered.length} chemicals`)
  }
  const handleExportAll = () => {
    exportChemicalsCSV(chemicals, `chemicals-all-${new Date().toISOString().slice(0, 10)}.csv`)
    setExportOpen(false)
    showMessage('success', `Exported ${chemicals.length} chemicals`)
  }
  const handleExportTransactions = () => {
    exportTransactionsCSV(transactions)
    setExportOpen(false)
    showMessage('success', `Exported ${transactions.length} transactions`)
  }
  const handleExportPDF = () => {
    generatePDFReport(filtered.length ? filtered : chemicals, 'Current View')
    setExportOpen(false)
    showMessage('success', 'PDF generated')
  }
  const handleExportPDFAll = () => {
    generatePDFReport(chemicals, 'Full Inventory')
    setExportOpen(false)
    showMessage('success', 'Full PDF generated')
  }

  /* Form helpers */
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((p) => ({ ...p, [name]: value }))
    if (formErrors[name]) setFormErrors((p) => { const n = { ...p }; delete n[name]; return n })
  }

  const toggleHazard = (id) => {
    setFormData((p) => {
      const cur = p.hazard_symbols || []
      return cur.includes(id)
        ? { ...p, hazard_symbols: cur.filter((h) => h !== id) }
        : { ...p, hazard_symbols: [...cur, id] }
    })
  }

  const toggleClass = (id) => {
    setFormData((p) => {
      const cur = p.chemical_classes || []
      return cur.includes(id)
        ? { ...p, chemical_classes: cur.filter((c) => c !== id) }
        : { ...p, chemical_classes: [...cur, id] }
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
      batch_lot: chem.batch_lot || '',
      supplier: chem.supplier || '',
      chemical_classes: chem.chemical_classes || [],
      barcode: chem.barcode || '',
    })
    setEditingId(chem.id)
    setShowForm(true)
  }

  useEffect(() => {
    if (!showForm) return
    const suggested = autoClassifyChemical(formData.name, formData.hazard_symbols)
    if (suggested.length) {
      setFormData((p) => {
        const current = new Set(p.chemical_classes || [])
        suggested.forEach((c) => current.add(c))
        return { ...p, chemical_classes: Array.from(current) }
      })
    }
  }, [formData.name, formData.hazard_symbols, showForm])

  const handlePubChemLookup = async () => {
    const query = formData.cas_number.trim() || formData.name.trim()
    if (!query) return showMessage('error', 'Enter a name or CAS first')
    setLookingUp(true)
    try {
      const result = await lookupPubChem(query)
      if (!result) return showMessage('error', 'No results found on PubChem')
      setFormData((p) => ({
        ...p,
        molecular_formula: result.molecular_formula || p.molecular_formula,
        name: p.name || result.iupac_name || p.name,
      }))
      showMessage('success', 'Data loaded from PubChem')
    } catch {
      showMessage('error', 'PubChem lookup failed')
    } finally {
      setLookingUp(false)
    }
  }

  const toggleSelect = (id) => setSelectedIds((p) => {
    const n = new Set(p)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })
  const toggleSelectAll = () => {
    selectedIds.size === filtered.length
      ? setSelectedIds(new Set())
      : setSelectedIds(new Set(filtered.map((c) => c.id)))
  }

  /* Derived */
  const locations = useMemo(() => {
    const s = new Set()
    chemicals.forEach((c) => c.location && s.add(c.location.trim()))
    return Array.from(s).sort()
  }, [chemicals])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let result = chemicals.filter((c) => {
      const match =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.cas_number?.toLowerCase().includes(q) ||
        c.molecular_formula?.toLowerCase().includes(q) ||
        c.location?.toLowerCase().includes(q) ||
        c.batch_lot?.toLowerCase().includes(q) ||
        c.supplier?.toLowerCase().includes(q) ||
        c.barcode?.toLowerCase().includes(q) ||
        c.hazard_notes?.toLowerCase().includes(q)
      if (!match) return false
      if (filter === 'low') return isLow(c)
      if (filter === 'expired') return isExpired(c)
      if (filter === 'soon') return isExpiringSoon(c)
      if (filter === 'no-sds') return !c.sds_filename
      if (locationFilter && c.location !== locationFilter) return false
      if (hazardFilter && !(c.hazard_symbols || []).includes(hazardFilter)) return false
      return true
    })
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name': return (a.name || '').localeCompare(b.name || '')
        case 'name-desc': return (b.name || '').localeCompare(a.name || '')
        case 'quantity': return (b.quantity || 0) - (a.quantity || 0)
        case 'quantity-asc': return (a.quantity || 0) - (b.quantity || 0)
        case 'expiry':
          if (!a.expiry_date) return 1
          if (!b.expiry_date) return -1
          return new Date(a.expiry_date) - new Date(b.expiry_date)
        case 'expiry-desc':
          if (!a.expiry_date) return 1
          if (!b.expiry_date) return -1
          return new Date(b.expiry_date) - new Date(a.expiry_date)
        case 'location': return (a.location || '').localeCompare(b.location || '')
        case 'supplier': return (a.supplier || '').localeCompare(b.supplier || '')
        case 'updated': return new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
        default: return 0
      }
    })
    return result
  }, [chemicals, search, filter, sortBy, locationFilter, hazardFilter])

  const filteredTransactions = useMemo(() => {
    let list = [...transactions]
    if (historyFilter !== 'all') list = list.filter((t) => t.type === historyFilter)
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

  const stats = useMemo(
    () => ({
      total: chemicals.length,
      low: chemicals.filter(isLow).length,
      expired: chemicals.filter(isExpired).length,
      soon: chemicals.filter(isExpiringSoon).length,
      missingSds: chemicals.filter((c) => !c.sds_filename).length,
    }),
    [chemicals]
  )

  const compatibilityIssues = useMemo(() => {
    const issues = []
    const byLocation = {}
    chemicals.forEach((c) => {
      const loc = (c.location || 'Unassigned').trim()
      if (!byLocation[loc]) byLocation[loc] = []
      byLocation[loc].push(c)
    })
    Object.entries(byLocation).forEach(([location, chems]) => {
      for (let i = 0; i < chems.length; i++) {
        for (let j = i + 1; j < chems.length; j++) {
          const a = chems[i]
          const b = chems[j]
          const classesA = a.chemical_classes || []
          const classesB = b.chemical_classes || []
          CLASS_COMPATIBILITY_RULES.forEach((rule) => {
            const match =
              (classesA.includes(rule.a) && classesB.includes(rule.b)) ||
              (classesA.includes(rule.b) && classesB.includes(rule.a))
            if (match) {
              issues.push({ location, chemA: a.name, chemB: b.name, risk: rule.risk, reason: rule.reason })
            }
          })
        }
      }
    })
    const seen = new Set()
    return issues.filter((iss) => {
      const key = `${iss.location}-${iss.chemA}-${iss.chemB}-${iss.reason}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [chemicals])

  /* Keyboard */
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
        setExportOpen(false)
        setShowUsageModal(false)
        setShowHistory(false)
        setCompatOpen(false)
        setShowScanner(false)
        setShowQrModal(null)
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

  /* Guards */
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

  if (showLanding) {
    return <Landing onGetStarted={() => setShowLanding(false)} />
  }

  /* Render */
  return (
    <div className="app">
      {message && (
        <div className={`toast toast-${message.type}`} key={message.id}>
          <span className="toast-icon">{message.type === 'success' ? '✓' : '✕'}</span>
          <span>{message.text}</span>
        </div>
      )}

      <header className="header">
        <div className="header-brand">
          <div className="logo">⚗️</div>
          <div>
            <h1>Chemical Inventory</h1>
            <p className="subtitle">Stock • Hazards • SDS • Compliance</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="notif-wrapper" ref={notifRef}>
            <button className="icon-btn notif-btn" onClick={() => setNotifOpen((v) => !v)} title="Notifications">
              🔔
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </button>
            {notifOpen && (
              <div className="notif-dropdown">
                <div className="notif-header">
                  <strong>Notifications</strong>
                  <div className="notif-actions">
                    <button type="button" onClick={() => setNotifications((p) => p.map((n) => ({ ...n, read: true })))}>Mark all read</button>
                    <button type="button" onClick={() => setNotifications([])}>Clear</button>
                  </div>
                </div>
                <div className="notif-list">
                  {notifications.length === 0 ? (
                    <div className="notif-empty">No notifications</div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={`notif-item ${n.read ? 'read' : ''} type-${n.type}`} onClick={() => setNotifications((p) => p.map((x) => (x.id === n.id ? { ...x, read: true } : x)))}>
                        <div className="notif-title">{n.title}</div>
                        <div className="notif-message">{n.message}</div>
                        <div className="notif-time">{new Date(n.createdAt).toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>
                <div className="notif-footer">
                  <label className="notif-toggle">
                    <input type="checkbox" checked={notificationsEnabled} onChange={toggleNotifications} />
                    Enable notifications
                  </label>
                  {notifPermission !== 'granted' && (
                    <button className="btn btn-sm btn-primary" onClick={requestNotificationPermission}>Allow browser notifications</button>
                  )}
                </div>
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={() => setShowHistory(true)} title="Usage History">📋</button>
          <button className="icon-btn" onClick={() => setCompatOpen(true)} title="Compatibility">
            ⚠️
            {compatibilityIssues.length > 0 && <span className="notif-badge">{compatibilityIssues.length}</span>}
          </button>
          <button className="icon-btn" onClick={startScanner} title="Scan Barcode / QR">📷</button>
          <button className="icon-btn" onClick={() => setCommandOpen(true)} title="Commands">⌘K</button>
          <button className="icon-btn theme-toggle" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
          <div className="user-chip"><span className="user-email">{session.user?.email}</span></div>
          <button className="btn btn-ghost" onClick={() => setShowLanding(true)}>Landing</button>
          <button className="btn btn-ghost" onClick={handleLogout}>Logout</button>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>+ Add Chemical</button>
        </div>
      </header>

      <div className="view-switcher">
        <button className={mainView === 'inventory' ? 'active' : ''} onClick={() => setMainView('inventory')}>📦 Inventory</button>
        <button className={mainView === 'dashboard' ? 'active' : ''} onClick={() => setMainView('dashboard')}>📊 Dashboard</button>
      </div>

      {mainView === 'dashboard' ? (
        <div className="dashboard">
          <div className="stats-bar">
            <div className="stat-card"><span className="stat-value">{stats.total}</span><span className="stat-label">Total</span></div>
            <div className={`stat-card ${stats.low ? 'warning' : ''}`}><span className="stat-value">{stats.low}</span><span className="stat-label">Low Stock</span></div>
            <div className={`stat-card ${stats.soon ? 'caution' : ''}`}><span className="stat-value">{stats.soon}</span><span className="stat-label">Expiring Soon</span></div>
            <div className={`stat-card ${stats.expired ? 'danger' : ''}`}><span className="stat-value">{stats.expired}</span><span className="stat-label">Expired</span></div>
            <div className={`stat-card ${stats.missingSds ? 'muted' : ''}`}><span className="stat-value">{stats.missingSds}</span><span className="stat-label">Missing SDS</span></div>
            <div className={`stat-card ${compatibilityIssues.length ? 'danger' : ''}`}><span className="stat-value">{compatibilityIssues.length}</span><span className="stat-label">Compat. Issues</span></div>
          </div>
          <div className="dashboard-grid">
            <div className="dash-card">
              <h3>Recent Activity</h3>
              <div className="dash-list">
                {transactions.length === 0 ? (
                  <p className="text-muted">No activity yet</p>
                ) : (
                  transactions.slice(0, 8).map((t) => (
                    <div key={t.id} className="dash-item">
                      <span className={`history-type type-${t.type}`}>{t.type === 'take' ? '➖' : t.type === 'return' ? '➕' : '✏️'}</span>
                      <div>
                        <strong>{t.chemical_name}</strong>
                        <div className="text-muted" style={{ fontSize: '0.8rem' }}>{t.user_email} • {formatDateTime(t.created_at)}</div>
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
                  <p className="text-muted">No issues detected</p>
                ) : (
                  compatibilityIssues.slice(0, 6).map((iss, i) => (
                    <div key={i} className="dash-item">
                      <span style={{ color: iss.risk === 'High' ? 'var(--danger)' : 'var(--warning)', fontWeight: 600, fontSize: '0.8rem' }}>{iss.risk}</span>
                      <div>
                        <strong>{iss.chemA} + {iss.chemB}</strong>
                        <div className="text-muted" style={{ fontSize: '0.8rem' }}>{iss.location} • {iss.reason}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="stats-bar">
            <div className="stat-card"><span className="stat-value">{stats.total}</span><span className="stat-label">Total</span></div>
            <div className={`stat-card ${stats.low ? 'warning' : ''}`}><span className="stat-value">{stats.low}</span><span className="stat-label">Low Stock</span></div>
            <div className={`stat-card ${stats.soon ? 'caution' : ''}`}><span className="stat-value">{stats.soon}</span><span className="stat-label">Expiring Soon</span></div>
            <div className={`stat-card ${stats.expired ? 'danger' : ''}`}><span className="stat-value">{stats.expired}</span><span className="stat-label">Expired</span></div>
            <div className={`stat-card ${stats.missingSds ? 'muted' : ''}`}><span className="stat-value">{stats.missingSds}</span><span className="stat-label">Missing SDS</span></div>
            {refreshing && <div className="refresh-indicator">Refreshing…</div>}
          </div>

          <div className="toolbar">
            <div className="search-wrapper">
              <span className="search-icon">🔍</span>
              <input ref={searchRef} className="search-input" placeholder="Search name, CAS, formula, barcode…" value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && <button className="clear-btn" onClick={() => setSearch('')}>✕</button>}
            </div>
            <div className="filter-pills">
              {FILTER_PRESETS.map((p) => (
                <button key={p.id} className={`pill ${filter === p.id ? 'active' : ''}`} onClick={() => setFilter(p.id)}>
                  <span>{p.icon}</span> {p.label}
                </button>
              ))}
            </div>
            <select className="sort-select" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
              <option value="">All Locations</option>
              {locations.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select className="sort-select" value={hazardFilter} onChange={(e) => setHazardFilter(e.target.value)}>
              <option value="">All Hazards</option>
              {HAZARD_OPTIONS.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
            </select>
            <div className="toolbar-right">
              <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div className="view-toggle">
                <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>☰</button>
                <button className={viewMode === 'cards' ? 'active' : ''} onClick={() => setViewMode('cards')}>▦</button>
              </div>
              <div className="export-wrapper" ref={exportRef}>
                <button className="btn btn-ghost" onClick={() => setExportOpen((v) => !v)}>⬇ Export</button>
                {exportOpen && (
                  <div className="export-dropdown">
                    <button type="button" onClick={handleExportCurrent}>Export Current (CSV)</button>
                    <button type="button" onClick={handleExportAll}>Export All (CSV)</button>
                    <button type="button" onClick={handleExportTransactions}>Export Usage (CSV)</button>
                    <div className="export-divider" />
                    <button type="button" onClick={handleExportPDF}>PDF (Current)</button>
                    <button type="button" onClick={handleExportPDFAll}>PDF (All)</button>
                  </div>
                )}
              </div>
              <button className={`btn btn-ghost ${bulkMode ? 'active' : ''}`} onClick={() => { setBulkMode((v) => !v); if (bulkMode) setSelectedIds(new Set()) }}>
                {bulkMode ? 'Cancel Select' : 'Select'}
              </button>
              <button className="icon-btn" onClick={() => setHazardLegendOpen(true)}>ℹ️</button>
            </div>
          </div>

          {bulkMode && selectedIds.size > 0 && (
            <div className="bulk-bar">
              <span>{selectedIds.size} selected</span>
              <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>Delete Selected</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>Clear</button>
            </div>
          )}

          {showForm && (
            <div className="form-overlay" onClick={(e) => e.target === e.currentTarget && resetForm()}>
              <div className="form-panel" ref={formRef}>
                <div className="form-header">
                  <h2>{editingId ? 'Edit Chemical' : 'Add New Chemical'}</h2>
                  <button className="icon-btn" onClick={resetForm}>✕</button>
                </div>
                <form onSubmit={handleSubmit} noValidate>
                  <div className="form-grid">
                    <div className={`form-group ${formErrors.name ? 'error' : ''}`}>
                      <label>Name *</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Sulfuric Acid" autoFocus style={{ flex: 1 }} />
                        <button type="button" className="btn btn-sm btn-primary" onClick={handlePubChemLookup} disabled={lookingUp}>
                          {lookingUp ? '…' : 'Lookup'}
                        </button>
                      </div>
                      {formErrors.name && <span className="error-text">{formErrors.name}</span>}
                    </div>
                    <div className="form-group">
                      <label>CAS Number</label>
                      <input name="cas_number" value={formData.cas_number} onChange={handleChange} placeholder="e.g. 7664-93-9" />
                    </div>
                    <div className="form-group">
                      <label>Molecular Formula</label>
                      <input name="molecular_formula" value={formData.molecular_formula} onChange={handleChange} placeholder="e.g. H₂SO₄" />
                    </div>
                    <div className={`form-group ${formErrors.quantity ? 'error' : ''}`}>
                      <label>Quantity</label>
                      <input name="quantity" type="number" step="any" value={formData.quantity} onChange={handleChange} />
                      {formErrors.quantity && <span className="error-text">{formErrors.quantity}</span>}
                    </div>
                    <div className="form-group">
                      <label>Unit</label>
                      <select name="unit" value={formData.unit} onChange={handleChange}>
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Location</label>
                      <input name="location" value={formData.location} onChange={handleChange} placeholder="e.g. Cabinet A" />
                    </div>
                    <div className="form-group">
                      <label>Expiry Date</label>
                      <input name="expiry_date" type="date" value={formData.expiry_date} onChange={handleChange} />
                    </div>
                    <div className={`form-group ${formErrors.min_stock ? 'error' : ''}`}>
                      <label>Min Stock</label>
                      <input name="min_stock" type="number" step="any" value={formData.min_stock} onChange={handleChange} />
                      {formErrors.min_stock && <span className="error-text">{formErrors.min_stock}</span>}
                    </div>
                    <div className="form-group">
                      <label>Batch / Lot</label>
                      <input name="batch_lot" value={formData.batch_lot} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                      <label>Supplier</label>
                      <input name="supplier" value={formData.supplier} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                      <label>Barcode / QR Value</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          name="barcode"
                          value={formData.barcode}
                          onChange={handleChange}
                          placeholder="Scan or generate"
                          style={{ flex: 1 }}
                        />
                        <button type="button" className="btn btn-sm btn-ghost" onClick={handleGenerateBarcode}>
                          Generate
                        </button>
                      </div>
                    </div>
                    <div className="form-group full">
                      <label>Hazard Notes</label>
                      <input name="hazard_notes" value={formData.hazard_notes} onChange={handleChange} />
                    </div>
                  </div>

                  {formData.barcode && (
                    <div style={{ marginBottom: 20, textAlign: 'center' }}>
                      <QRCodeSVG value={formData.barcode} size={120} />
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>{formData.barcode}</div>
                    </div>
                  )}

                  <div className="hazard-selector">
                    <label>GHS Hazard Symbols</label>
                    <div className="hazard-grid">
                      {HAZARD_OPTIONS.map((h) => {
                        const active = formData.hazard_symbols?.includes(h.id)
                        return (
                          <button
                            type="button"
                            key={h.id}
                            className={`hazard-chip ${active ? 'active' : ''}`}
                            onClick={() => toggleHazard(h.id)}
                            style={{ borderColor: active ? h.color : undefined, background: active ? `${h.color}22` : undefined }}
                          >
                            <HazardIcon hazard={h} size={22} />
                            <span>{h.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="hazard-selector">
                    <label>Chemical Classes</label>
                    <div className="hazard-grid">
                      {CHEMICAL_CLASSES.map((cls) => {
                        const active = formData.chemical_classes?.includes(cls.id)
                        return (
                          <button
                            type="button"
                            key={cls.id}
                            className={`hazard-chip ${active ? 'active' : ''}`}
                            onClick={() => toggleClass(cls.id)}
                            style={{ borderColor: active ? cls.color : undefined, background: active ? `${cls.color}22` : undefined }}
                          >
                            {cls.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn btn-ghost" onClick={resetForm}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      {submitting ? 'Saving…' : editingId ? 'Update Chemical' : 'Save Chemical'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showUsageModal && usageChem && (
            <div className="form-overlay" onClick={(e) => e.target === e.currentTarget && setShowUsageModal(false)}>
              <div className="form-panel" style={{ maxWidth: 480 }}>
                <div className="form-header">
                  <h2>Log Usage</h2>
                  <button className="icon-btn" onClick={() => setShowUsageModal(false)}>✕</button>
                </div>
                <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--bg)', borderRadius: 10 }}>
                  <strong>{usageChem.name}</strong>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Current: {usageChem.quantity} {usageChem.unit}
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
                    <label>{usageForm.type === 'adjust' ? 'New Quantity' : 'Quantity'} ({usageChem.unit})</label>
                    <input type="number" step="any" min="0" value={usageForm.quantity} onChange={(e) => setUsageForm((f) => ({ ...f, quantity: e.target.value }))} required autoFocus />
                  </div>
                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label>Notes</label>
                    <input value={usageForm.notes} onChange={(e) => setUsageForm((f) => ({ ...f, notes: e.target.value }))} />
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => setShowUsageModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={loggingUsage}>{loggingUsage ? 'Saving…' : 'Log Usage'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <main className="content">
            {loading ? (
              <div className="skeleton-grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton-card" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🧪</div>
                <h3>No chemicals found</h3>
                <p>{search || filter !== 'all' ? 'Try adjusting search or filters.' : 'Add your first chemical.'}</p>
                {!search && filter === 'all' && (
                  <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>+ Add Chemical</button>
                )}
              </div>
            ) : viewMode === 'cards' ? (
              <div className="cards-grid">
                {filtered.map((chem) => {
                  const expired = isExpired(chem)
                  const low = isLow(chem)
                  const soon = isExpiringSoon(chem)
                  const days = daysUntil(chem.expiry_date)
                  const stockPct = chem.min_stock > 0 ? Math.min(100, Math.round((Number(chem.quantity) / (Number(chem.min_stock) * 2)) * 100)) : 100
                  return (
                    <article key={chem.id} className={`chem-card ${expired ? 'expired' : low ? 'low' : soon ? 'soon' : ''}`}>
                      {bulkMode && (
                        <label className="card-checkbox">
                          <input type="checkbox" checked={selectedIds.has(chem.id)} onChange={() => toggleSelect(chem.id)} />
                        </label>
                      )}
                      <div className="card-header">
                        <h3>{chem.name}</h3>
                        <span className={getStatusBadgeClass(chem)}>{getStatus(chem)}</span>
                      </div>
                      <div className="card-meta">
                        {chem.molecular_formula && <span className="meta-item formula">{chem.molecular_formula}</span>}
                        {chem.cas_number && <span className="meta-item">CAS {chem.cas_number}</span>}
                        {chem.batch_lot && <span className="meta-item">Lot: {chem.batch_lot}</span>}
                        {chem.barcode && <span className="meta-item">Barcode: {chem.barcode}</span>}
                      </div>
                      <div className="card-qty">
                        <span className="qty-value">{chem.quantity} {chem.unit}</span>
                        {chem.min_stock > 0 && (
                          <div className="stock-bar">
                            <div className="stock-fill" style={{ width: `${stockPct}%`, background: low ? 'var(--danger)' : 'var(--success)' }} />
                          </div>
                        )}
                      </div>
                      <div className="card-details">
                        <div><span className="detail-label">Location</span><span>{chem.location || '—'}</span></div>
                        <div>
                          <span className="detail-label">Expiry</span>
                          <span>
                            {formatDate(chem.expiry_date)}
                            {days !== null && <span className="days-left">{days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}</span>}
                          </span>
                        </div>
                        {chem.supplier && <div><span className="detail-label">Supplier</span><span>{chem.supplier}</span></div>}
                      </div>
                      {(chem.hazard_symbols?.length > 0 || chem.hazard_notes) && (
                        <div className="card-hazards">
                          {(chem.hazard_symbols || []).map((id) => {
                            const h = HAZARD_OPTIONS.find((x) => x.id === id)
                            return h ? (
                              <span key={id} title={h.label} style={{ display: 'inline-flex', marginRight: 4 }}>
                                <HazardIcon hazard={h} size={22} />
                              </span>
                            ) : null
                          })}
                          {chem.hazard_notes && <span className="hazard-note">{chem.hazard_notes}</span>}
                        </div>
                      )}
                      <div className="card-sds">
                        {uploadProgress[chem.id] !== undefined ? (
                          <div className="upload-progress">
                            <div className="upload-bar" style={{ width: `${uploadProgress[chem.id]}%` }} />
                            <span>Uploading… {uploadProgress[chem.id]}%</span>
                          </div>
                        ) : chem.sds_filename ? (
                          <div className="sds-row">
                            <button className="link-btn" onClick={() => handleDownloadSds(chem.id)}>📄 {chem.sds_filename.split('/').pop()}</button>
                            <label className="replace-label">
                              Replace
                              <input type="file" accept=".pdf" hidden onChange={(e) => e.target.files?.[0] && handleSdsUpload(chem.id, e.target.files[0])} />
                            </label>
                          </div>
                        ) : (
                          <label className="upload-label">
                            + Upload SDS
                            <input type="file" accept=".pdf" hidden onChange={(e) => e.target.files?.[0] && handleSdsUpload(chem.id, e.target.files[0])} />
                          </label>
                        )}
                      </div>
                      <div className="card-actions">
                        {chem.barcode && (
                          <button className="btn btn-sm btn-ghost" onClick={() => setShowQrModal(chem)}>QR</button>
                        )}
                        <button className="btn btn-sm btn-ghost" onClick={() => openUsageModal(chem)}>Log Usage</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => handleEdit(chem)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(chem.id, chem.name)}>Delete</button>
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
                          <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} />
                        </th>
                      )}
                      <th>Name</th>
                      <th>Formula</th>
                      <th>CAS</th>
                      <th>Qty</th>
                      <th>Location</th>
                      <th>Batch/Lot</th>
                      <th>Supplier</th>
                      <th>Barcode</th>
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
                        <tr key={chem.id} className={expired ? 'row-expired' : low ? 'row-low' : soon ? 'row-soon' : ''}>
                          {bulkMode && (
                            <td>
                              <input type="checkbox" checked={selectedIds.has(chem.id)} onChange={() => toggleSelect(chem.id)} />
                            </td>
                          )}
                          <td>
                            <strong>{chem.name}</strong>
                            {chem.hazard_notes && <div className="hazard-sub">{chem.hazard_notes}</div>}
                          </td>
                          <td className="mono">{chem.molecular_formula || '—'}</td>
                          <td className="mono">{chem.cas_number || '—'}</td>
                          <td>{chem.quantity} {chem.unit}</td>
                          <td>{chem.location || '—'}</td>
                          <td>{chem.batch_lot || '—'}</td>
                          <td>{chem.supplier || '—'}</td>
                          <td className="mono">{chem.barcode || '—'}</td>
                          <td>
                            {formatDate(chem.expiry_date)}
                            {days !== null && <div className="days-sub">{days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}</div>}
                          </td>
                          <td>
                            <div className="hazard-icons">
                              {(chem.hazard_symbols || []).map((id) => {
                                const h = HAZARD_OPTIONS.find((x) => x.id === id)
                                return h ? (
                                  <span key={id} title={h.label} style={{ display: 'inline-flex', marginRight: 3 }}>
                                    <HazardIcon hazard={h} size={20} />
                                  </span>
                                ) : null
                              })}
                            </div>
                          </td>
                          <td><span className={getStatusBadgeClass(chem)}>{getStatus(chem)}</span></td>
                          <td className="sds-cell">
                            {uploadProgress[chem.id] !== undefined ? (
                              <div className="mini-progress"><div style={{ width: `${uploadProgress[chem.id]}%` }} /></div>
                            ) : chem.sds_filename ? (
                              <div className="sds-actions">
                                <button className="link-btn" onClick={() => handleDownloadSds(chem.id)}>Download</button>
                                <label className="link-btn">
                                  Replace
                                  <input type="file" accept=".pdf" hidden onChange={(e) => e.target.files?.[0] && handleSdsUpload(chem.id, e.target.files[0])} />
                                </label>
                              </div>
                            ) : (
                              <label className="link-btn">
                                Upload
                                <input type="file" accept=".pdf" hidden onChange={(e) => e.target.files?.[0] && handleSdsUpload(chem.id, e.target.files[0])} />
                              </label>
                            )}
                          </td>
                          <td className="actions">
                            {chem.barcode && (
                              <button className="btn-sm" onClick={() => setShowQrModal(chem)}>QR</button>
                            )}
                            <button className="btn-sm" onClick={() => openUsageModal(chem)}>Log</button>
                            <button className="btn-sm" onClick={() => handleEdit(chem)}>Edit</button>
                            <button className="btn-sm btn-danger" onClick={() => handleDelete(chem.id, chem.name)}>Delete</button>
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

      {showScanner && (
        <div className="modal-overlay" onClick={stopScanner}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Scan Barcode / QR</h3>
              <button className="icon-btn" onClick={stopScanner}>✕</button>
            </div>
            <div id="qr-reader" style={{ width: '100%' }} />
            {scanResult && <p style={{ marginTop: 12, textAlign: 'center' }}>Scanned: <strong>{scanResult}</strong></p>}
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
              Point your camera at a barcode or QR code
            </p>
          </div>
        </div>
      )}

      {showQrModal && (
        <div className="modal-overlay" onClick={() => setShowQrModal(null)}>
          <div className="modal" style={{ maxWidth: 320, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{showQrModal.name}</h3>
              <button className="icon-btn" onClick={() => setShowQrModal(null)}>✕</button>
            </div>
            {showQrModal.barcode ? (
              <>
                <QRCodeSVG value={showQrModal.barcode} size={200} />
                <p style={{ marginTop: 12, fontFamily: 'monospace', fontSize: '0.9rem', wordBreak: 'break-all' }}>{showQrModal.barcode}</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 8 }}>Print this and stick it on the bottle.</p>
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No barcode available</p>
            )}
          </div>
        </div>
      )}

      {showHistory && (
        <div className="form-overlay" onClick={(e) => e.target === e.currentTarget && setShowHistory(false)}>
          <div className="history-panel">
            <div className="form-header">
              <h2>Usage History</h2>
              <button className="icon-btn" onClick={() => setShowHistory(false)}>✕</button>
            </div>
            <div className="history-filters">
              <input className="search-input" placeholder="Search…" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} />
              <div className="filter-pills">
                {['all', 'take', 'return', 'adjust'].map((f) => (
                  <button key={f} className={`pill ${historyFilter === f ? 'active' : ''}`} onClick={() => setHistoryFilter(f)}>
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="history-list">
              {filteredTransactions.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 20px' }}><p>No transactions found</p></div>
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
                        <span>{t.quantity_change > 0 ? '+' : ''}{t.quantity_change} {t.unit}</span>
                        <span>{t.quantity_before} → {t.quantity_after} {t.unit}</span>
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

      {compatOpen && (
        <div className="modal-overlay" onClick={() => setCompatOpen(false)}>
          <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chemical Compatibility Checker</h3>
              <button className="icon-btn" onClick={() => setCompatOpen(false)}>✕</button>
            </div>
            {compatibilityIssues.length === 0 ? (
              <p style={{ padding: '24px 0', color: 'var(--text-muted)' }}>No compatibility issues detected.</p>
            ) : (
              <div className="compat-list">
                {compatibilityIssues.map((iss, i) => (
                  <div key={i} className={`compat-item risk-${iss.risk.toLowerCase()}`}>
                    <div className="compat-risk">{iss.risk} Risk</div>
                    <div>
                      <strong>{iss.chemA} + {iss.chemB}</strong>
                      <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>Location: {iss.location}</div>
                      <div style={{ fontSize: '0.9rem', marginTop: 6 }}>{iss.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {commandOpen && (
        <div className="command-overlay" onClick={() => setCommandOpen(false)}>
          <div className="command-palette" onClick={(e) => e.stopPropagation()}>
            <input autoFocus placeholder="Type a command…" onKeyDown={(e) => e.key === 'Escape' && setCommandOpen(false)} />
            <div className="command-list">
              <button onClick={() => { resetForm(); setShowForm(true); setCommandOpen(false) }}><span>➕</span> Add chemical</button>
              <button onClick={() => { startScanner(); setCommandOpen(false) }}><span>📷</span> Scan barcode</button>
              <button onClick={() => { setMainView('dashboard'); setCommandOpen(false) }}><span>📊</span> Dashboard</button>
              <button onClick={() => { setShowHistory(true); setCommandOpen(false) }}><span>📋</span> Usage history</button>
              <button onClick={() => { setCompatOpen(true); setCommandOpen(false) }}><span>⚠️</span> Compatibility</button>
              <button onClick={() => { setFilter('low'); setCommandOpen(false) }}><span>📉</span> Low stock</button>
              <button onClick={() => { handleExportPDF(); setCommandOpen(false) }}><span>📄</span> PDF report</button>
              <button onClick={() => { toggleTheme(); setCommandOpen(false) }}><span>{theme === 'dark' ? '☀️' : '🌙'}</span> Theme</button>
              <button onClick={() => { fetchChemicals(); setCommandOpen(false) }}><span>🔄</span> Refresh</button>
            </div>
            <div className="command-hint"><kbd>⌘</kbd><kbd>K</kbd> • <kbd>Esc</kbd></div>
          </div>
        </div>
      )}

      {hazardLegendOpen && (
        <div className="modal-overlay" onClick={() => setHazardLegendOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>GHS Hazard Symbols</h3>
              <button className="icon-btn" onClick={() => setHazardLegendOpen(false)}>✕</button>
            </div>
            <div className="legend-grid">
              {HAZARD_OPTIONS.map((h) => (
                <div key={h.id} className="legend-item">
                  <span className="legend-emoji" style={{ background: `${h.color}22` }}>
                    <HazardIcon hazard={h} size={28} />
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

      <footer className="app-footer">
        <span>Showing <strong>{filtered.length}</strong> of <strong>{chemicals.length}</strong> chemicals</span>
        <span className="footer-hint"><kbd>/</kbd> search • <kbd>⌘K</kbd> commands • <kbd>⌘N</kbd> new</span>
      </footer>
    </div>
  )
}

export default App