import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Landing from './Landing'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Html5Qrcode } from 'html5-qrcode'
import { QRCodeSVG } from 'qrcode.react'
import './App.css'

/* ============================================================================
   CHEMICAL INVENTORY SYSTEM
   --------------------------------------------------------------------------
   Full-featured laboratory chemical inventory application
   
   Core Features:
   - Supabase Authentication
   - Full CRUD operations for chemicals
   - SDS file upload and download
   - Low stock and expiry notifications (in-app + browser)
   - Usage / Transaction logging
   - CSV and professional PDF export
   - Dashboard overview
   - Batch / Lot number + Supplier tracking
   - Advanced filtering and sorting
   - Card view + Table view
   - Dark / Light theme
   - Command palette + keyboard shortcuts
   - Chemical Classes system
   - Class-based Compatibility Checker
   - Expanded GHS hazard symbols
   - PubChem lookup (auto-fill formula + suggested classes)
   - Auto-classification of chemicals
   
   This file is intentionally written in a verbose, well-commented style
   for maintainability and clarity.
============================================================================ */

/* ============================================================================
   SECTION 1: CONSTANTS
============================================================================ */
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
/**
 * Chemical Classes used for compatibility checking.
 * These are the primary way we determine if two chemicals
 * should not be stored together.
 */
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

/**
 * Expanded GHS Hazard Symbols.
 * These are used both for display and as a secondary signal
 * for auto-classification.
 */
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

/**
 * Primary compatibility rules based on Chemical Classes.
 * This is the main safety engine of the application.
 */
const CLASS_COMPATIBILITY_RULES = [
  // High risk combinations
  {
    a: 'acid',
    b: 'base',
    risk: 'High',
    reason: 'Acids and bases react violently and can generate significant heat and splashing.',
  },
  {
    a: 'acid',
    b: 'cyanide',
    risk: 'High',
    reason: 'Acids + cyanides release highly toxic hydrogen cyanide (HCN) gas.',
  },
  {
    a: 'acid',
    b: 'sulfide',
    risk: 'High',
    reason: 'Acids + sulfides release toxic hydrogen sulfide (H₂S) gas.',
  },
  {
    a: 'acid',
    b: 'water_reactive',
    risk: 'High',
    reason: 'Many water-reactive chemicals react violently when mixed with acids.',
  },
  {
    a: 'oxidizer',
    b: 'flammable_solvent',
    risk: 'High',
    reason: 'Oxidizers mixed with flammable solvents can cause fire or explosion.',
  },
  {
    a: 'oxidizer',
    b: 'organic',
    risk: 'High',
    reason: 'Oxidizers + organic materials are a serious fire and explosion hazard.',
  },
  {
    a: 'oxidizer',
    b: 'water_reactive',
    risk: 'High',
    reason: 'This combination is highly reactive and dangerous.',
  },
  {
    a: 'water_reactive',
    b: 'flammable_solvent',
    risk: 'High',
    reason: 'Water-reactive chemicals can ignite flammable solvents.',
  },
  {
    a: 'peroxide_former',
    b: 'oxidizer',
    risk: 'High',
    reason: 'Peroxide formers become extremely dangerous in the presence of oxidizers.',
  },
  {
    a: 'explosive',
    b: 'oxidizer',
    risk: 'High',
    reason: 'Oxidizers can sensitize or initiate explosive materials.',
  },
  {
    a: 'halogen',
    b: 'flammable_solvent',
    risk: 'High',
    reason: 'Halogens react dangerously with many organic solvents.',
  },

  // Medium risk combinations
  {
    a: 'acid',
    b: 'flammable_solvent',
    risk: 'Medium',
    reason: 'Acids can damage containers and increase secondary fire hazards.',
  },
  {
    a: 'base',
    b: 'flammable_solvent',
    risk: 'Medium',
    reason: 'Bases can degrade containers holding flammable solvents.',
  },
  {
    a: 'toxic',
    b: 'flammable_solvent',
    risk: 'Medium',
    reason: 'A fire involving toxic materials creates additional serious hazards.',
  },
  {
    a: 'compressed_gas',
    b: 'flammable_solvent',
    risk: 'Medium',
    reason: 'Compressed gases stored near flammables increase overall risk.',
  },
]

/**
 * Available units for quantity tracking.
 */
const UNITS = ['g', 'mg', 'kg', 'ml', 'L', 'µl', 'mol', 'units']

/**
 * Sorting options available in the toolbar.
 */
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

/**
 * Quick filter presets shown as pills.
 */
const FILTER_PRESETS = [
  { id: 'all', label: 'All Chemicals', icon: '📦' },
  { id: 'low', label: 'Low Stock', icon: '📉' },
  { id: 'soon', label: 'Expiring Soon', icon: '⏳' },
  { id: 'expired', label: 'Expired', icon: '🚫' },
  { id: 'no-sds', label: 'Missing SDS', icon: '📄' },
]

/**
 * Empty form state used when adding a new chemical
 * or after resetting the form.
 */
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

/* ============================================================================
   SECTION 2: PURE HELPER FUNCTIONS
============================================================================ */

/**
 * Calculates how many days remain until a given date.
 * Returns negative numbers for dates in the past.
 */
const daysUntil = (dateStr) => {
  if (!dateStr) return null
  try {
    const now = new Date()
    const target = new Date(dateStr)
    const diffMs = target.getTime() - now.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    return Math.ceil(diffDays)
  } catch (err) {
    console.warn('daysUntil error:', err)
    return null
  }
}

/**
 * Formats a date string into a human-readable short format.
 */
const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch (err) {
    return dateStr
  }
}

/**
 * Formats a date-time string for transaction history.
 */
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
  } catch (err) {
    return dateStr
  }
}

/**
 * Returns true if the chemical is past its expiry date.
 */
const isExpired = (chemical) => {
  if (!chemical || !chemical.expiry_date) return false
  const days = daysUntil(chemical.expiry_date)
  return days !== null && days < 0
}

/**
 * Returns true if current quantity is at or below minimum stock level.
 */
const isLow = (chemical) => {
  if (!chemical) return false
  const quantity = Number(chemical.quantity) || 0
  const minStock = Number(chemical.min_stock) || 0
  return quantity <= minStock
}

/**
 * Returns true if the chemical expires within the next 30 days.
 */
const isExpiringSoon = (chemical) => {
  if (!chemical || !chemical.expiry_date) return false
  const days = daysUntil(chemical.expiry_date)
  return days !== null && days >= 0 && days <= 30
}

/**
 * Returns a human-readable status string for a chemical.
 */
const getStatus = (chemical) => {
  if (isExpired(chemical)) return 'Expired'
  if (isLow(chemical)) return 'Low Stock'
  if (isExpiringSoon(chemical)) return 'Expiring Soon'
  return 'OK'
}

/**
 * Returns the CSS class used for status badges.
 */
  const getStatusBadgeClass = (chemical) => {
    if (isExpired(chemical)) return 'badge badge-red'
    if (isLow(chemical)) return 'badge badge-orange'
    if (isExpiringSoon(chemical)) return 'badge badge-yellow'
    return 'badge badge-green'
  }


/* ============================================================================
   SECTION 3: AUTO-CLASSIFICATION ENGINE
============================================================================ */

/**
 * Attempts to automatically suggest chemical classes based on
 * the chemical name and currently selected GHS hazard symbols.
 *
 * This is a heuristic system. It is helpful but not perfect.
 * The user can always override the suggestions manually.
 */
const autoClassifyChemical = (name = '', hazardSymbols = []) => {
  const classes = new Set()
  const lowerName = (name || '').toLowerCase().trim()

  // -------- Name-based rules --------
  if (/(acid|hcl|h2so4|hno3|acetic|formic|phosphoric|hydrochloric|sulfuric|nitric)/.test(lowerName)) {
    classes.add('acid')
  }

  if (/(hydroxide|naoh|koh|ammonia|amine|sodium hydroxide|potassium hydroxide)/.test(lowerName)) {
    classes.add('base')
  }

  if (/(peroxide|nitrate|permanganate|chromate|dichromate|hypochlorite|hydrogen peroxide)/.test(lowerName)) {
    classes.add('oxidizer')
  }

  if (/(ether|thf|dioxane|tetrahydrofuran|diethyl ether)/.test(lowerName)) {
    classes.add('peroxide_former')
    classes.add('flammable_solvent')
  }

  if (/(acetone|ethanol|methanol|isopropanol|hexane|toluene|xylene|benzene|ether|ipa)/.test(lowerName)) {
    classes.add('flammable_solvent')
  }

  if (/(sodium metal|lithium|potassium metal|calcium carbide|acid anhydride)/.test(lowerName)) {
    classes.add('water_reactive')
  }

  if (/cyanide/.test(lowerName)) {
    classes.add('cyanide')
  }

  if (/sulfide/.test(lowerName)) {
    classes.add('sulfide')
  }

  if (/(chlorine|bromine|iodine|fluorine)/.test(lowerName)) {
    classes.add('halogen')
  }

  if (/(picric|trinitro|azide)/.test(lowerName)) {
    classes.add('explosive')
  }

  // -------- GHS symbol based rules --------
  if (Array.isArray(hazardSymbols)) {
    if (hazardSymbols.includes('flammable')) {
      classes.add('flammable_solvent')
    }
    if (hazardSymbols.includes('oxidizing')) {
      classes.add('oxidizer')
    }
    if (hazardSymbols.includes('explosive')) {
      classes.add('explosive')
    }
    if (hazardSymbols.includes('gas')) {
      classes.add('compressed_gas')
    }
    if (hazardSymbols.includes('toxic') || hazardSymbols.includes('acute_toxicity')) {
      classes.add('toxic')
    }
  }

  return Array.from(classes)
}

/* ============================================================================
   SECTION 4: PUBCHEM LOOKUP
============================================================================ */

/**
 * Looks up a chemical on PubChem using either a name or CAS number.
 * Returns basic information such as molecular formula and preferred name.
 *
 * Note: The free PubChem API does not always return reliable GHS data,
 * so we mainly use it for formula and name enrichment.
 */
const lookupPubChem = async (query) => {
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return null
  }

  const cleanedQuery = query.trim()

  try {
    // Step 1: Resolve the query to a PubChem CID
    const searchUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(cleanedQuery)}/cids/JSON`
    const searchResponse = await fetch(searchUrl)

    if (!searchResponse.ok) {
      return null
    }

    const searchData = await searchResponse.json()
    const cid = searchData?.IdentifierList?.CID?.[0]

    if (!cid) {
      return null
    }

    // Step 2: Fetch useful properties for that CID
    const propUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,IUPACName,Title/JSON`
    const propResponse = await fetch(propUrl)

    if (!propResponse.ok) {
      return null
    }

    const propData = await propResponse.json()
    const properties = propData?.PropertyTable?.Properties?.[0]

    if (!properties) {
      return null
    }

    return {
      molecular_formula: properties.MolecularFormula || null,
      iupac_name: properties.IUPACName || properties.Title || null,
      cid: cid,
    }
  } catch (error) {
    console.warn('PubChem lookup failed:', error)
    return null
  }
}

/* ============================================================================
   SECTION 5: CSV & PDF EXPORT HELPERS
============================================================================ */

/**
 * Generic CSV download helper.
 * Adds a UTF-8 BOM so Microsoft Excel opens the file correctly.
 */
const downloadCSV = (filename, rows) => {
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    console.warn('downloadCSV called with no data')
    return
  }

  const headers = Object.keys(rows[0])

  const escapeCell = (value) => {
    const stringValue = value === null || value === undefined ? '' : String(value)
    const escaped = stringValue.replace(/"/g, '""')
    return `"${escaped}"`
  }

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(',')),
  ]

  const csvContent = lines.join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Exports the current list of chemicals to CSV.
 */
const exportChemicalsCSV = (list, filename = 'chemicals.csv') => {
  const rows = list.map((chemical) => ({
    Name: chemical.name || '',
    'Molecular Formula': chemical.molecular_formula || '',
    'CAS Number': chemical.cas_number || '',
    Quantity: chemical.quantity ?? '',
    Unit: chemical.unit || '',
    Location: chemical.location || '',
    'Batch / Lot': chemical.batch_lot || '',
    Supplier: chemical.supplier || '',
    'Expiry Date': chemical.expiry_date || '',
    'Min Stock': chemical.min_stock ?? '',
    'Chemical Classes': Array.isArray(chemical.chemical_classes)
      ? chemical.chemical_classes.join(', ')
      : '',
    'Hazard Symbols': Array.isArray(chemical.hazard_symbols)
      ? chemical.hazard_symbols.join(', ')
      : '',
    'Hazard Notes': chemical.hazard_notes || '',
    Status: getStatus(chemical),
  }))

  downloadCSV(filename, rows)
}

/**
 * Exports the transaction / usage history to CSV.
 */
const exportTransactionsCSV = (list) => {
  const rows = list.map((transaction) => ({
    'Date & Time': formatDateTime(transaction.created_at),
    Chemical: transaction.chemical_name || '',
    Action: transaction.type || '',
    'Quantity Change': transaction.quantity_change ?? '',
    Unit: transaction.unit || '',
    'Quantity Before': transaction.quantity_before ?? '',
    'Quantity After': transaction.quantity_after ?? '',
    User: transaction.user_email || '',
    Notes: transaction.notes || '',
  }))

  const filename = `usage-history-${new Date().toISOString().slice(0, 10)}.csv`
  downloadCSV(filename, rows)
}

/**
 * Generates a professional landscape PDF report using jsPDF + autoTable.
 */
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

  // Summary statistics box
  const lowCount = chemicalsList.filter(isLow).length
  const expiredCount = chemicalsList.filter(isExpired).length
  const soonCount = chemicalsList.filter(isExpiringSoon).length

  doc.setFillColor(241, 245, 249)
  doc.roundedRect(14, 34, pageWidth - 28, 16, 3, 3, 'F')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`Total: ${chemicalsList.length}`, 20, 44)

  doc.setTextColor(217, 119, 6)
  doc.text(`Low Stock: ${lowCount}`, 60, 44)

  doc.setTextColor(202, 138, 4)
  doc.text(`Expiring Soon: ${soonCount}`, 110, 44)

  doc.setTextColor(220, 38, 38)
  doc.text(`Expired: ${expiredCount}`, 165, 44)

  // Table data
  const tableBody = chemicalsList.map((chemical) => [
    chemical.name || '',
    chemical.molecular_formula || '—',
    chemical.cas_number || '—',
    `${chemical.quantity ?? 0} ${chemical.unit || ''}`,
    chemical.location || '—',
    chemical.batch_lot || '—',
    chemical.supplier || '—',
    formatDate(chemical.expiry_date),
    getStatus(chemical),
  ])

  autoTable(doc, {
    startY: 56,
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
   SECTION 6: MAIN APP COMPONENT - START
============================================================================ */

function App() {
  /* ---------- Authentication & Session State ---------- */
  const [session, setSession] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [showLogin, setShowLogin] = useState(false)

  /* ---------- Core Data State ---------- */
  const [chemicals, setChemicals] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  /* ---------- UI Control State ---------- */
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('viewMode') || 'table'
  })
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
  const [showLanding, setShowLanding] = useState(false)
  const [locationFilter, setLocationFilter] = useState('')
  const [hazardFilter, setHazardFilter] = useState('')
  // Auto-logout after 30 minutes of inactivity (change as needed)
  const IDLE_TIMEOUT_MS = 30 * 60 * 1000   // 30 minutes
  const idleTimerRef = useRef(null)

  /* ---------- Notification State ---------- */
  const [notifications, setNotifications] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('notificationsEnabled') !== 'false'
  })

  /* ---------- Usage / Transaction Log State ---------- */
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

  /* ---------- Theme State ---------- */
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) return savedTheme
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
  const [lookingUp, setLookingUp] = useState(false)

  /* ---------- Refs ---------- */
  const searchRef = useRef(null)
  const formRef = useRef(null)
  const toastTimeout = useRef(null)
  const notifRef = useRef(null)
  const exportRef = useRef(null)

  const API_URL = import.meta.env.VITE_API_URL

  // Barcode / QR state
  const [showScanner, setShowScanner] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [showQrModal, setShowQrModal] = useState(null) // holds the chemical object
  const html5QrCodeRef = useRef(null)

  /* ============================================================================
     THEME MANAGEMENT
  ============================================================================ */

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((previous) => (previous === 'light' ? 'dark' : 'light'))
  }, [])

  // Auto-logout on inactivity
  useEffect(() => {
    if (!session) return

    const resetTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }
      idleTimerRef.current = setTimeout(() => {
        // Time's up → log out
        handleLogout()
        showMessage('error', 'You were logged out due to inactivity')
      }, IDLE_TIMEOUT_MS)
    }

    // Events that count as “activity”
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']

    events.forEach((event) => {
      window.addEventListener(event, resetTimer)
    })

    // Start the timer
    resetTimer()

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer)
      })
    }
  }, [session])   // re-run when session changes

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode)
  }, [viewMode])

  /* ============================================================================
     AUTHENTICATION
  ============================================================================ */

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) {
        setSession(session)
        setLoadingAuth(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setSession(session)
      }
    })

    return () => {
      isMounted = false
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
    } catch (error) {
      console.error('Logout error:', error)
      showMessage('error', 'Failed to log out properly')
    }
  }

  const getAccessToken = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      return session?.access_token || null
    } catch (error) {
      console.error('Error retrieving access token:', error)
      return null
    }
  }, [])

  /* ============================================================================
     TOAST / MESSAGE SYSTEM
  ============================================================================ */

  const showMessage = useCallback((type, text) => {
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current)
    }
    setMessage({
      type,
      text,
      id: Date.now(),
    })
    toastTimeout.current = setTimeout(() => {
      setMessage(null)
    }, 4200)
  }, [])

  /* ============================================================================
     NOTIFICATION SYSTEM
  ============================================================================ */

  const createNotification = (type, title, messageText, chemId = null) => {
    const uniqueId = `${type}-${chemId || Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    return {
      id: uniqueId,
      type,
      title,
      message: messageText,
      chemId,
      createdAt: new Date().toISOString(),
      read: false,
    }
  }

  const checkAndNotify = useCallback(
    (chemicalList) => {
      if (!notificationsEnabled || !Array.isArray(chemicalList) || chemicalList.length === 0) {
        return
      }

      const newlyCreatedNotifications = []

      chemicalList.forEach((chemical) => {
        if (isExpired(chemical)) {
          newlyCreatedNotifications.push(
            createNotification(
              'expired',
              'Chemical Expired',
              `"${chemical.name}" expired on ${formatDate(chemical.expiry_date)}`,
              chemical.id
            )
          )
        } else if (isExpiringSoon(chemical)) {
          const remainingDays = daysUntil(chemical.expiry_date)
          newlyCreatedNotifications.push(
            createNotification(
              'soon',
              'Expiring Soon',
              `"${chemical.name}" expires in ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`,
              chemical.id
            )
          )
        }

        if (isLow(chemical)) {
          newlyCreatedNotifications.push(
            createNotification(
              'low',
              'Low Stock Alert',
              `"${chemical.name}" is running low (${chemical.quantity} ${chemical.unit} remaining)`,
              chemical.id
            )
          )
        }
      })

      setNotifications((previousNotifications) => {
        const existingKeys = new Set(
          previousNotifications.map((n) => `${n.type}-${n.chemId}`)
        )

        const uniqueNewNotifications = newlyCreatedNotifications.filter(
          (n) => !existingKeys.has(`${n.type}-${n.chemId}`)
        )

        if (uniqueNewNotifications.length === 0) {
          return previousNotifications
        }

        // Attempt to show browser notifications
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          uniqueNewNotifications.forEach((notification) => {
            try {
              new Notification(notification.title, {
                body: notification.message,
                tag: notification.id,
                requireInteraction: false,
              })
            } catch (err) {
              // Some browsers may block this silently
            }
          })
        }

        return [...uniqueNewNotifications, ...previousNotifications].slice(0, 60)
      })
    },
    [notificationsEnabled]
  )

  // Run notification check whenever the chemicals list changes
  useEffect(() => {
    if (chemicals.length > 0) {
      checkAndNotify(chemicals)
    }
  }, [chemicals, checkAndNotify])

  // Also re-check every 5 minutes
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
    } catch (error) {
      showMessage('error', 'Could not request notification permission')
    }
  }

  const toggleNotifications = () => {
    const nextValue = !notificationsEnabled
    setNotificationsEnabled(nextValue)
    localStorage.setItem('notificationsEnabled', String(nextValue))

    if (nextValue && notifPermission !== 'granted') {
      requestNotificationPermission()
    }
  }

  const markAsRead = (notificationId) => {
    setNotifications((previous) =>
      previous.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    )
  }

  const markAllRead = () => {
    setNotifications((previous) => previous.map((n) => ({ ...n, read: true })))
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  /* ============================================================================
     API LAYER - FETCHING DATA
  ============================================================================ */

  const fetchChemicals = useCallback(
    async (silent = false) => {
      try {
        if (!silent) {
          setLoading(true)
        } else {
          setRefreshing(true)
        }

        const token = await getAccessToken()
        if (!token) {
          throw new Error('No access token available')
        }

        const response = await fetch(`${API_URL}/chemicals`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`)
        }

        const data = await response.json()
        setChemicals(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error('Failed to fetch chemicals:', error)
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

      if (!response.ok) {
        throw new Error('Failed to load transactions')
      }

      const data = await response.json()
      setTransactions(Array.isArray(data) ? data : [])
    } catch (error) {
      // Backend may not have the transactions endpoint yet – fail silently
      console.warn('Could not load transactions:', error.message)
    }
  }, [API_URL, getAccessToken])

  // Load data when user session becomes available
  useEffect(() => {
    if (session) {
      fetchChemicals()
      fetchTransactions()
    }
  }, [session, fetchChemicals, fetchTransactions])

    /* ============================================================================
     CHEMICAL CRUD OPERATIONS
  ============================================================================ */

  const handleSubmit = async (event) => {
    event.preventDefault()

    const errors = {}

    if (!formData.name || !formData.name.trim()) {
      errors.name = 'Name is required'
    }

    if (formData.quantity !== '' && isNaN(Number(formData.quantity))) {
      errors.quantity = 'Quantity must be a valid number'
    }

    if (formData.min_stock !== '' && isNaN(Number(formData.min_stock))) {
      errors.min_stock = 'Minimum stock must be a valid number'
    }

    setFormErrors(errors)

    if (Object.keys(errors).length > 0) {
      return
    }

    setSubmitting(true)

    try {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

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
        chemical_classes: formData.chemical_classes.length > 0 ? formData.chemical_classes : null,
        barcode: formData.barcode.trim() || null,
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
        throw new Error('Failed to save chemical')
      }

      showMessage('success', editingId ? 'Chemical updated successfully' : 'Chemical added successfully')
      resetForm()
      fetchChemicals(true)
    } catch (error) {
      console.error('Save error:', error)
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

      if (!response.ok) {
        throw new Error('Delete failed')
      }

      showMessage('success', `"${name}" has been deleted`)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      fetchChemicals(true)
    } catch (error) {
      showMessage('error', 'Failed to delete the chemical')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return

    const confirmed = window.confirm(
      `You are about to delete ${selectedIds.size} chemical(s). This action cannot be undone. Continue?`
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
        // continue with remaining items
      }
    }

    showMessage('success', `Successfully deleted ${successCount} chemical(s)`)
    setSelectedIds(new Set())
    setBulkMode(false)
    fetchChemicals(true)
  }

  /* ============================================================================
     SDS FILE HANDLING
  ============================================================================ */

  const handleSdsUpload = async (id, file) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      showMessage('error', 'Only PDF files are accepted for SDS documents')
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

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      showMessage('success', 'SDS file uploaded successfully')

      setTimeout(() => {
        setUploadProgress((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      }, 700)

      fetchChemicals(true)
    } catch (error) {
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
    } catch (error) {
      showMessage('error', 'Could not download SDS file')
    }
  }

  /* ============================================================================
     USAGE / TRANSACTION LOG
  ============================================================================ */

  const openUsageModal = (chemical) => {
    setUsageChem(chemical)
    setUsageForm({
      type: 'take',
      quantity: '',
      notes: '',
    })
    setShowUsageModal(true)
  }

  const handleLogUsage = async (event) => {
    event.preventDefault()
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

      // Update chemical quantity
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

      const successMessage =
        usageForm.type === 'take'
          ? `Took ${qty} ${usageChem.unit} of ${usageChem.name}`
          : usageForm.type === 'return'
          ? `Returned ${qty} ${usageChem.unit} of ${usageChem.name}`
          : `Adjusted ${usageChem.name} to ${newQuantity} ${usageChem.unit}`

      showMessage('success', successMessage)
      setShowUsageModal(false)
      setUsageChem(null)
      fetchChemicals(true)
      fetchTransactions()
    } catch (error) {
      console.error(error)
      showMessage('error', 'Failed to log usage')
    } finally {
      setLoggingUsage(false)
    }
  }

  /* ============================================================================
     EXPORT HANDLERS
  ============================================================================ */

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

  /* ============================================================================
     FORM HELPERS
  ============================================================================ */

  const handleChange = (event) => {
    const { name, value } = event.target
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

  const toggleClass = (id) => {
    setFormData((prev) => {
      const current = prev.chemical_classes || []
      if (current.includes(id)) {
        return {
          ...prev,
          chemical_classes: current.filter((c) => c !== id),
        }
      }
      return {
        ...prev,
        chemical_classes: [...current, id],
      }
    })
  }

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM })
    setFormErrors({})
    setEditingId(null)
    setShowForm(false)
  }
  const HazardIcon = ({ hazard, size = 24 }) => {
    if (!hazard?.icon) return <span>{hazard?.emoji || '⚠️'}</span>
    return (
      <img
        src={hazard.icon}
        alt={hazard.label}
        title={hazard.label}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          verticalAlign: 'middle',
        }}
      />
    )
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
      chemical_classes: Array.isArray(chem.chemical_classes) ? chem.chemical_classes : [],
      barcode: chem.barcode || '',
    })
    setEditingId(chem.id)
    setShowForm(true)

    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 80)
  }

  // Auto-classify when name or hazard symbols change
  useEffect(() => {
    if (!showForm) return

    const suggested = autoClassifyChemical(formData.name, formData.hazard_symbols)
    if (suggested.length > 0) {
      setFormData((prev) => {
        const current = new Set(prev.chemical_classes || [])
        suggested.forEach((c) => current.add(c))
        return {
          ...prev,
          chemical_classes: Array.from(current),
        }
      })
    }
  }, [formData.name, formData.hazard_symbols, showForm])

  // PubChem Lookup handler
  const handlePubChemLookup = async () => {
    const query = formData.cas_number.trim() || formData.name.trim()
    if (!query) {
      showMessage('error', 'Enter a chemical name or CAS number first')
      return
    }

    setLookingUp(true)
    try {
      const result = await lookupPubChem(query)
      if (!result) {
        showMessage('error', 'No results found on PubChem')
        return
      }

      setFormData((prev) => ({
        ...prev,
        molecular_formula: result.molecular_formula || prev.molecular_formula,
        name: prev.name || result.iupac_name || prev.name,
      }))

      // Re-run classification with enriched data
      const suggested = autoClassifyChemical(
        result.iupac_name || formData.name,
        formData.hazard_symbols
      )

      if (suggested.length > 0) {
        setFormData((prev) => {
          const current = new Set(prev.chemical_classes || [])
          suggested.forEach((c) => current.add(c))
          return {
            ...prev,
            chemical_classes: Array.from(current),
          }
        })
      }

      showMessage('success', 'Data loaded from PubChem')
    } catch (error) {
      showMessage('error', 'PubChem lookup failed')
    } finally {
      setLookingUp(false)
    }
  }
  // ... all your useState, useRef, etc. ...

  const showMessage = useCallback((type, text) => {
    // ... existing code ...
  }, [])

  // ========== BARCODE / QR HELPERS (must be inside App) ==========
  const generateBarcodeValue = () => {
    return `CHEM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  }

  const handleGenerateBarcode = () => {
    if (!formData.barcode) {
      setFormData((prev) => ({
        ...prev,
        barcode: generateBarcodeValue(),
      }))
      showMessage('success', 'Barcode generated')
    } else {
      showMessage('error', 'Barcode already exists. Clear it first to generate a new one.')
    }
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
            html5QrCode
              .stop()
              .then(() => {
                html5QrCodeRef.current = null
              })
              .catch(() => {})

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
      } catch (err) {
        showMessage('error', 'Camera access denied or not available')
        setShowScanner(false)
      }
    }, 300)
  }

  const stopScanner = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current
        .stop()
        .then(() => {
          html5QrCodeRef.current = null
        })
        .catch(() => {})
    }
    setShowScanner(false)
    setScanResult(null)
  }
  // ========== END BARCODE / QR ==========


  /* ============================================================================
     SELECTION & BULK ACTIONS
  ============================================================================ */

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

  /* ============================================================================
     DERIVED DATA – FILTERING, SORTING, STATS, COMPATIBILITY
  ============================================================================ */

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

      if (filter === 'low') return isLow(c)
      if (filter === 'expired') return isExpired(c)
      if (filter === 'soon') return isExpiringSoon(c)
      if (filter === 'no-sds') return !c.sds_filename

      if (locationFilter && c.location !== locationFilter) return false

      if (hazardFilter) {
        const symbols = c.hazard_symbols || []
        if (!symbols.includes(hazardFilter)) return false
      }

      return true
    })

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

  // Class-based Compatibility Checker (primary safety engine)
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

          CLASS_COMPATIBILITY_RULES.forEach((rule) => {
            const hasConflict =
              (classesA.includes(rule.a) && classesB.includes(rule.b)) ||
              (classesA.includes(rule.b) && classesB.includes(rule.a))

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
     KEYBOARD SHORTCUTS
  ============================================================================ */

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

  /* ============================================================================
     RENDER GUARDS
  ============================================================================ */

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
  // View Landing page while still logged in
  if (session && showLanding) {
    return <Landing onGetStarted={() => setShowLanding(false)} />
  }

  /* ============================================================================
     MAIN RENDER
  ============================================================================ */

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
          <button
            className="btn btn-ghost"
            onClick={() => {setShowLanding(true); setShowForm(false)}}
            title="view landing page"
          >
            Landing
          </button>

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
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="e.g. Sulfuric Acid"
                          autoFocus
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={handlePubChemLookup}
                          disabled={lookingUp}
                          title="Lookup on PubChem"
                        >
                          {lookingUp ? '…' : 'Lookup'}
                        </button>
                      </div>
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
                    <div className="form-group">
                      <label>Barcode / QR Value</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          name="barcode"
                          value={formData.barcode || ''}
                          onChange={handleChange}
                          placeholder="Scan or generate"
                          style={{ flex: 1 }}
                        />
                        <button type="button" className="btn btn-sm btn-ghost" onClick={handleGenerateBarcode}>
                          generate
                        </button>
                      </div>
                    </div>
                  </div>
                    

                  {/* GHS Hazard Symbols */}
                  <div className="hazard-selector">
                    <label>GHS Hazard Symbols</label>
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
                            <HazardIcon hazard={h} size={22} />
                            <span>{h.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Chemical Classes */}
                  <div className="hazard-selector">
                    <label>Chemical Classes (used for compatibility checking)</label>
                    <div className="hazard-grid">
                      {CHEMICAL_CLASSES.map((cls) => {
                        const isActive = formData.chemical_classes?.includes(cls.id)
                        return (
                          <button
                            type="button"
                            key={cls.id}
                            className={`hazard-chip ${isActive ? 'active' : ''}`}
                            onClick={() => toggleClass(cls.id)}
                            style={{
                              borderColor: isActive ? cls.color : undefined,
                              background: isActive ? `${cls.color}22` : undefined,
                            }}
                          >
                            {cls.label}
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

          {/* SCANNER MODAL */}
          {showScanner && (
            <div className="modal-overlay" onClick={stopScanner}>
              <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Scan Barcode / QR Code</h3>
                  <button className="icon-btn" onClick={stopScanner}>✕</button>
                </div>
                <div id="qr-reader" style={{ width: '100%' }}></div>
                {scanResult && (
                  <p style={{ marginTop: 12, textAlign: 'center' }}>
                    Scanned: <strong>{scanResult}</strong>
                  </p>
                )}
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
                  Point your camera at a barcode or QR code to scan. The value will be automatically filled in the form.
                </p>
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
                        {chem.barcode && <span className="meta-item">Barcode: {chem.barcode}</span>}
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
                              <span key={id} title={h.label} style={{ display: 'inline-flex', marginRight: 4 }}>
                                <HazardIcon hazard={h} size={22} />
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
                        {chem.barcode && (
                          <button className="btn btn-sm btn-ghost" onClick={() => setShowQrModal(chem)}>
                            QR
                          </button>
                        )}
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
                                  <span key={id} title={h.label} style={{ display: 'inline-flex', marginRight: 3 }}>
                                    <HazardIcon hazard={h} size={20} />
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
                                      e.target.files?.[0] && handleSdsUpload(chem.id, e.target.files[0])
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
                            {chem.barcode && (
                              <button className="btn-sm" onClick={() => setShowQrModal(chem)}>
                                QR
                              </button>
                            )}
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
                No compatibility issues were detected based on the current chemical classes and storage
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
      {/* QR CODE DISPLAY MODAL */}
      {showQrModal && (
        <div className="modal-overlay" onClick={() => setShowQrModal(null)}>
          <div className="modal" style={{ maxWidth: 320, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{showQrModal.name}</h3>
              <button className="icon-btn" onClick={() => setShowQrModal(null)}>✕</button>
            </div>
            {showQrModal.barcode ? (
              <>
                <QRCodeSVG value={showQrModal.barcode} size={200} />
                <p style={{ marginTop: 12, fontFamily: 'monospace', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                   {showQrModal.barcode}
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 8 }}>
                  Print this and stick it on the bottle.
                </p>
              </>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 8 }}>
                No barcode/QR value available for this chemical.
              </p>
            )}
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