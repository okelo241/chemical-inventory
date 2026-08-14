/**
 * ============================================================================
 * CHEMICAL INVENTORY SYSTEM — App.jsx (EXPANDED EDITION)
 * ============================================================================
 *
 * This file is intentionally verbose and long for maintainability,
 * safety documentation, and lab compliance clarity.
 *
 * FEATURE SET (complete):
 * - Supabase authentication (session + logout)
 * - Full CRUD for chemicals
 * - SDS PDF upload / download
 * - Low stock + expiry notifications (in-app + browser)
 * - Usage / transaction logging
 * - CSV export + professional PDF reports (jsPDF + autotable)
 * - Dashboard with live stats
 * - Batch / lot + supplier tracking
 * - Advanced search, filters, sorting
 * - Card view + table view
 * - Dark / light theme
 * - Command palette + keyboard shortcuts
 * - Chemical class system (expanded Stanford/NIH-style groups)
 * - Class-based compatibility checker (classes + GHS + name heuristics)
 * - Expanded GHS pictograms (local assets)
 * - PubChem lookup (formula enrichment)
 * - Auto-classification of chemicals from name + hazards
 * - Barcode / QR generate, display, and camera scan
 * - Idle auto-logout
 * - Landing page preview without logging out
 *
 * SAFETY NOTE:
 * Compatibility rules are based on common university EHS storage-group
 * systems (Stanford/NIH ChemTracker-style segregation). They are a strong
 * decision-support layer, not a replacement for SDS Section 7/10 review.
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Landing from './Landing'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Html5Qrcode } from 'html5-qrcode'
import { QRCodeSVG } from 'qrcode.react'
import './App.css'

/* -------------------------------------------------------------------------- */
/* PICTOGRAM ASSETS                                                           */
/* -------------------------------------------------------------------------- */

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

/* ========================================================================== */
/* SECTION 1 — CHEMICAL CLASSES (EXPANDED)                                    */
/* ========================================================================== */
/**
 * These classes mirror common laboratory storage groups used by EHS programs:
 * organic/inorganic/oxidizing acids, organic/inorganic bases, oxidizers,
 * flammables, water-reactives, reducing agents, cyanides, sulfides, etc.
 *
 * Primary use: compatibility matrix evaluation by storage location.
 */
const CHEMICAL_CLASSES = [
  { id: 'organic_acid', label: 'Organic Acid', color: '#f97316', description: 'Acetic, formic, citric, and similar organic acids' },
  { id: 'inorganic_acid', label: 'Inorganic Acid (non-oxidizing)', color: '#ef4444', description: 'HCl, H3PO4, non-oxidizing mineral acids' },
  { id: 'oxidizing_acid', label: 'Oxidizing Acid', color: '#dc2626', description: 'Nitric, perchloric, chromic acids' },
  { id: 'organic_base', label: 'Organic Base / Amine', color: '#3b82f6', description: 'Amines, pyridine, ethanolamine, etc.' },
  { id: 'inorganic_base', label: 'Inorganic Base / Alkali', color: '#2563eb', description: 'NaOH, KOH, ammonium hydroxide' },
  { id: 'oxidizer', label: 'Oxidizer / Peroxide', color: '#eab308', description: 'H2O2, nitrates, hypochlorites, permanganates' },
  { id: 'flammable_solvent', label: 'Flammable / Combustible Solvent', color: '#f97316', description: 'Acetone, alcohols, ethers, hydrocarbons' },
  { id: 'water_reactive', label: 'Water-Reactive / Pyrophoric', color: '#8b5cf6', description: 'Alkali metals, hydrides, some chlorides' },
  { id: 'reducing_agent', label: 'Strong Reducing Agent', color: '#7c3aed', description: 'Hydrides, active metals, strong reductants' },
  { id: 'toxic', label: 'Toxic / Poison', color: '#64748b', description: 'Acute toxins and highly toxic reagents' },
  { id: 'cyanide', label: 'Cyanide', color: '#1e293b', description: 'Cyanide salts — release HCN with acids' },
  { id: 'sulfide', label: 'Sulfide', color: '#78716c', description: 'Sulfide salts — release H2S with acids' },
  { id: 'peroxide_former', label: 'Peroxide-Forming Solvent', color: '#ec4899', description: 'Ethers, THF, dioxane' },
  { id: 'organic_peroxide', label: 'Organic Peroxide', color: '#be185d', description: 'Benzoyl peroxide, MEKP, etc.' },
  { id: 'explosive', label: 'Explosive / Unstable', color: '#dc2626', description: 'Picric acid (dry), azides, tetrazoles' },
  { id: 'halogen', label: 'Halogen / Halogenating Agent', color: '#06b6d4', description: 'Cl2, Br2, NBS, related reagents' },
  { id: 'organic', label: 'Organic Material / Combustible', color: '#22c55e', description: 'General organic combustibles' },
  { id: 'compressed_gas', label: 'Compressed Gas', color: '#6366f1', description: 'Cylinders and lecture bottles' },
  { id: 'flammable_solid', label: 'Flammable Solid', color: '#ea580c', description: 'Combustible solids and powders' },
  { id: 'general', label: 'General / Non-reactive', color: '#94a3b8', description: 'Buffers, salts, low-reactivity stock' },
]

/* ========================================================================== */
/* SECTION 2 — GHS HAZARD OPTIONS                                             */
/* ========================================================================== */

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

/* ========================================================================== */
/* SECTION 3 — COMPATIBILITY RULES (EXPANDED)                                 */
/* ========================================================================== */
/**
 * Pairwise storage segregation rules.
 * Evaluated only for chemicals that share the same storage location string.
 * Risk levels: High (must segregate), Medium (prefer segregation / secondary containment).
 */
const CLASS_COMPATIBILITY_RULES = [
  // --- Acids + bases ---
  { a: 'organic_acid', b: 'organic_base', risk: 'High', reason: 'Acids and bases react exothermically; boiling, splashing, and container rupture are possible.' },
  { a: 'organic_acid', b: 'inorganic_base', risk: 'High', reason: 'Acids and bases react violently with heat and corrosive splash risk.' },
  { a: 'inorganic_acid', b: 'organic_base', risk: 'High', reason: 'Strong neutralization reaction with heat and corrosive splash risk.' },
  { a: 'inorganic_acid', b: 'inorganic_base', risk: 'High', reason: 'Acids and bases must be segregated; violent neutralization is possible.' },
  { a: 'oxidizing_acid', b: 'organic_base', risk: 'High', reason: 'Oxidizing acids + bases can react violently and form hazardous products.' },
  { a: 'oxidizing_acid', b: 'inorganic_base', risk: 'High', reason: 'Oxidizing acids + bases can generate heat, gases, and shock-sensitive salts (e.g. with ammonia).' },

  // --- Acids + cyanides / sulfides ---
  { a: 'organic_acid', b: 'cyanide', risk: 'High', reason: 'Acids + cyanides release highly toxic hydrogen cyanide (HCN) gas.' },
  { a: 'inorganic_acid', b: 'cyanide', risk: 'High', reason: 'Acids + cyanides release highly toxic hydrogen cyanide (HCN) gas.' },
  { a: 'oxidizing_acid', b: 'cyanide', risk: 'High', reason: 'Acids + cyanides release highly toxic hydrogen cyanide (HCN) gas.' },
  { a: 'organic_acid', b: 'sulfide', risk: 'High', reason: 'Acids + sulfides release toxic hydrogen sulfide (H₂S) gas.' },
  { a: 'inorganic_acid', b: 'sulfide', risk: 'High', reason: 'Acids + sulfides release toxic hydrogen sulfide (H₂S) gas.' },
  { a: 'oxidizing_acid', b: 'sulfide', risk: 'High', reason: 'Acids + sulfides release toxic hydrogen sulfide (H₂S) gas.' },

  // --- Oxidizing acids + organics / flammables ---
  { a: 'oxidizing_acid', b: 'flammable_solvent', risk: 'High', reason: 'Oxidizing acids (nitric, perchloric) with flammable solvents can cause fire or explosion.' },
  { a: 'oxidizing_acid', b: 'organic', risk: 'High', reason: 'Oxidizing acids react aggressively with organic materials; fire/explosion risk.' },
  { a: 'oxidizing_acid', b: 'organic_acid', risk: 'High', reason: 'Oxidizing acids (nitric/perchloric) react dangerously with organic acids (e.g. acetic).' },
  { a: 'oxidizing_acid', b: 'peroxide_former', risk: 'High', reason: 'Oxidizing acids with peroxide-forming solvents are highly hazardous.' },
  { a: 'oxidizing_acid', b: 'flammable_solid', risk: 'High', reason: 'Oxidizing acids + flammable solids can ignite or explode.' },

  // --- General oxidizers + fuels ---
  { a: 'oxidizer', b: 'flammable_solvent', risk: 'High', reason: 'Oxidizers + flammable solvents can cause fire or explosion without external ignition (classic H₂O₂ + acetone style hazard).' },
  { a: 'oxidizer', b: 'organic', risk: 'High', reason: 'Oxidizers + organic/combustible materials are a serious fire and explosion hazard.' },
  { a: 'oxidizer', b: 'flammable_solid', risk: 'High', reason: 'Oxidizers + flammable solids can ignite or explode on contact.' },
  { a: 'oxidizer', b: 'reducing_agent', risk: 'High', reason: 'Oxidizers + strong reducing agents can react violently (fire/explosion).' },
  { a: 'oxidizer', b: 'water_reactive', risk: 'High', reason: 'Oxidizers mixed with water-reactive materials are highly dangerous.' },
  { a: 'oxidizer', b: 'peroxide_former', risk: 'High', reason: 'Oxidizers can sensitize peroxide-forming solvents.' },
  { a: 'oxidizer', b: 'organic_peroxide', risk: 'High', reason: 'Oxidizers + organic peroxides are an extreme fire/explosion hazard.' },
  { a: 'oxidizer', b: 'organic_acid', risk: 'High', reason: 'Oxidizers + organic acids can react vigorously.' },
  { a: 'oxidizer', b: 'inorganic_acid', risk: 'Medium', reason: 'Some oxidizers (e.g. hypochlorite/bleach) + acids release toxic chlorine gas; segregate.' },

  // --- Water-reactive ---
  { a: 'water_reactive', b: 'organic_acid', risk: 'High', reason: 'Water-reactive chemicals can react violently with acids (often aqueous).' },
  { a: 'water_reactive', b: 'inorganic_acid', risk: 'High', reason: 'Water-reactive chemicals react violently with acids / moisture.' },
  { a: 'water_reactive', b: 'oxidizing_acid', risk: 'High', reason: 'Water-reactive + oxidizing acids is extremely hazardous.' },
  { a: 'water_reactive', b: 'flammable_solvent', risk: 'High', reason: 'Water-reactive materials can ignite flammable solvents or generate flammable gases.' },
  { a: 'water_reactive', b: 'inorganic_base', risk: 'Medium', reason: 'Many water-reactives also react with aqueous bases; segregate when possible.' },

  // --- Reducing agents ---
  { a: 'reducing_agent', b: 'organic_acid', risk: 'High', reason: 'Strong reducing agents + acids can generate heat and flammable gases.' },
  { a: 'reducing_agent', b: 'inorganic_acid', risk: 'High', reason: 'Strong reducing agents + acids can generate heat and flammable gases (e.g. H₂).' },
  { a: 'reducing_agent', b: 'oxidizing_acid', risk: 'High', reason: 'Reducing agents + oxidizing acids can react violently.' },
  { a: 'reducing_agent', b: 'flammable_solvent', risk: 'Medium', reason: 'Some reducing agents increase fire risk when stored with flammables.' },

  // --- Explosives / organic peroxides ---
  { a: 'explosive', b: 'oxidizer', risk: 'High', reason: 'Oxidizers can sensitize or initiate explosive materials.' },
  { a: 'explosive', b: 'oxidizing_acid', risk: 'High', reason: 'Oxidizing acids + explosives is extremely dangerous.' },
  { a: 'explosive', b: 'flammable_solvent', risk: 'High', reason: 'Explosives should not be stored with flammable solvents.' },
  { a: 'organic_peroxide', b: 'flammable_solvent', risk: 'High', reason: 'Organic peroxides are incompatible with most organics and flammables.' },
  { a: 'organic_peroxide', b: 'organic', risk: 'High', reason: 'Organic peroxides must be isolated from other organics.' },
  { a: 'organic_peroxide', b: 'organic_acid', risk: 'High', reason: 'Organic peroxides + acids can be highly reactive.' },
  { a: 'organic_peroxide', b: 'inorganic_acid', risk: 'High', reason: 'Organic peroxides + acids can be highly reactive.' },
  { a: 'organic_peroxide', b: 'inorganic_base', risk: 'High', reason: 'Organic peroxides are often incompatible with bases.' },
  { a: 'organic_peroxide', b: 'organic_base', risk: 'High', reason: 'Organic peroxides are often incompatible with bases.' },

  // --- Halogens ---
  { a: 'halogen', b: 'flammable_solvent', risk: 'High', reason: 'Halogens react dangerously with many organic solvents.' },
  { a: 'halogen', b: 'organic', risk: 'High', reason: 'Halogens can react violently with organic materials.' },
  { a: 'halogen', b: 'reducing_agent', risk: 'High', reason: 'Halogens + reducing agents can react vigorously.' },
  { a: 'halogen', b: 'water_reactive', risk: 'High', reason: 'Halogens + water-reactive metals/compounds are hazardous.' },
  { a: 'halogen', b: 'organic_base', risk: 'High', reason: 'Halogens can react violently with amines and organic bases.' },

  // --- Medium risk / preferred segregation ---
  { a: 'organic_acid', b: 'flammable_solvent', risk: 'Medium', reason: 'Organic acids near flammables need secondary containment; some organic acids are themselves flammable.' },
  { a: 'inorganic_acid', b: 'flammable_solvent', risk: 'Medium', reason: 'Mineral acids can damage containers and increase secondary hazards near flammables.' },
  { a: 'inorganic_base', b: 'flammable_solvent', risk: 'Medium', reason: 'Bases can degrade containers holding flammable solvents.' },
  { a: 'organic_base', b: 'flammable_solvent', risk: 'Medium', reason: 'Organic bases may be flammable; still segregate from oxidizers and acids.' },
  { a: 'toxic', b: 'flammable_solvent', risk: 'Medium', reason: 'Fire involving toxic materials creates additional serious exposure hazards.' },
  { a: 'compressed_gas', b: 'flammable_solvent', risk: 'Medium', reason: 'Compressed gases near flammables increase overall fire/explosion risk.' },
  { a: 'oxidizing_acid', b: 'inorganic_acid', risk: 'Medium', reason: 'Oxidizing acids (nitric, perchloric) should be segregated from other acids in secondary containment.' },
  { a: 'organic_acid', b: 'inorganic_acid', risk: 'Medium', reason: 'Organic and inorganic acids are often segregated to reduce reactivity.' },
  { a: 'cyanide', b: 'oxidizer', risk: 'Medium', reason: 'Cyanides + strong oxidizers can form hazardous products; segregate.' },
  { a: 'sulfide', b: 'oxidizer', risk: 'Medium', reason: 'Sulfides + oxidizers can react; keep separated.' },
  { a: 'peroxide_former', b: 'organic_acid', risk: 'Medium', reason: 'Peroxide formers should be kept away from acids when possible.' },
  { a: 'flammable_solid', b: 'oxidizing_acid', risk: 'High', reason: 'Flammable solids + oxidizing acids present ignition/explosion risk.' },
  { a: 'compressed_gas', b: 'oxidizer', risk: 'Medium', reason: 'Oxidizing gases and other oxidizers increase risk near fuel gases; segregate cylinders appropriately.' },
]

/* ========================================================================== */
/* SECTION 4 — UI CONSTANTS                                                   */
/* ========================================================================== */

const UNITS = ['g', 'mg', 'kg', 'ml', 'L', 'µl', 'mol', 'units', 'bottle', 'vial']

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

/** Idle timeout: 30 minutes of no user activity → automatic logout */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000

/** How many days before expiry counts as “expiring soon” */
const EXPIRY_SOON_DAYS = 30

/** Max notifications kept in memory */
const MAX_NOTIFICATIONS = 60

/* ========================================================================== */
/* SECTION 5 — PURE HELPERS                                                   */
/* ========================================================================== */

/**
 * Days until a date string. Negative if already past.
 */
const daysUntil = (dateStr) => {
  if (!dateStr) return null
  try {
    const now = new Date()
    const target = new Date(dateStr)
    if (Number.isNaN(target.getTime())) return null
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  } catch (err) {
    console.warn('daysUntil error:', err)
    return null
  }
}

/**
 * Human-readable short date.
 */
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

/**
 * Human-readable date-time for history rows.
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
  } catch {
    return dateStr
  }
}

const isExpired = (chemical) => {
  if (!chemical || !chemical.expiry_date) return false
  const d = daysUntil(chemical.expiry_date)
  return d !== null && d < 0
}

const isLow = (chemical) => {
  if (!chemical) return false
  const quantity = Number(chemical.quantity) || 0
  const minStock = Number(chemical.min_stock) || 0
  return quantity <= minStock
}

const isExpiringSoon = (chemical) => {
  if (!chemical || !chemical.expiry_date) return false
  const d = daysUntil(chemical.expiry_date)
  return d !== null && d >= 0 && d <= EXPIRY_SOON_DAYS
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

/**
 * Renders a local GHS pictogram image when available, otherwise emoji fallback.
 */
const HazardIcon = ({ hazard, size = 24 }) => {
  if (!hazard) return null
  if (!hazard.icon) {
    return <span title={hazard.label}>{hazard.emoji || '⚠️'}</span>
  }
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

/**
 * Generate a unique barcode value for a chemical bottle label.
 */
const generateBarcodeValue = () => {
  const timePart = Date.now().toString(36).toUpperCase()
  const randPart = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `CHEM-${timePart}-${randPart}`
}

/**
 * Normalize location strings for grouping (trim + lower-case).
 */
const normalizeLocation = (location) => (location || 'Unassigned').trim().toLowerCase()

/**
 * Safe array helper.
 */
const asArray = (value) => (Array.isArray(value) ? value : [])

/* ========================================================================== */
/* SECTION 6 — AUTO-CLASSIFICATION ENGINE (EXPANDED)                          */
/* ========================================================================== */
/**
 * Heuristic classification from chemical name + optional GHS symbols.
 * Used when:
 *  - user types a name in the form
 *  - compatibility checker falls back for chemicals missing saved classes
 *
 * This is intentionally conservative and additive (never removes user choices).
 */
const autoClassifyChemical = (name = '', hazardSymbols = []) => {
  const classes = new Set()
  const lower = (name || '').toLowerCase().trim()

  // Oxidizing acids first (more specific)
  if (/(nitric acid|perchloric|chromic acid|periodic acid)/.test(lower)) {
    classes.add('oxidizing_acid')
  } else if (/(acetic|formic|citric|maleic|propionic|benzoic|lactic|trichloroacetic)/.test(lower)) {
    classes.add('organic_acid')
  } else if (/(hydrochloric|\bhcl\b|sulfuric|\bh2so4\b|phosphoric|hydrofluoric|\bhf\b|hydrobromic)/.test(lower)) {
    classes.add('inorganic_acid')
  } else if (/\bacid\b/.test(lower)) {
    classes.add('inorganic_acid')
  }

  // Bases
  if (/(amine|aniline|pyridine|imidazole|triethylamine|diethylamine|ethanolamine|triethanolamine)/.test(lower)) {
    classes.add('organic_base')
  }
  if (/(hydroxide|\bnaoh\b|\bkoh\b|ammonia|ammonium hydroxide|sodium hydroxide|potassium hydroxide)/.test(lower)) {
    classes.add('inorganic_base')
  }

  // Oxidizers / peroxides (includes H2O2)
  if (/(peroxide|hydrogen peroxide|\bh2o2\b|hypochlorite|bleach|permanganate|nitrate|persulfate|chromate|dichromate|perchlorate|chlorate)/.test(lower)) {
    classes.add('oxidizer')
  }

  // Flammable solvents (includes acetone)
  if (/(acetone|ethanol|methanol|isopropanol|\bipa\b|hexane|heptane|toluene|xylene|benzene|ether|thf|dioxane|acetonitrile|ethyl acetate|chloroform|dichloromethane|\bdcm\b|petroleum ether)/.test(lower)) {
    classes.add('flammable_solvent')
  }

  // Peroxide-forming solvents
  if (/(diethyl ether|isopropyl ether|tetrahydrofuran|\bthf\b|dioxane|1,4-dioxane)/.test(lower)) {
    classes.add('peroxide_former')
    classes.add('flammable_solvent')
  }

  // Water-reactive / reducing
  if (/(sodium metal|potassium metal|lithium metal|calcium carbide|sodium hydride|lithium aluminum hydride|\blah\b|sodium borohydride|potassium hydride)/.test(lower)) {
    classes.add('water_reactive')
    classes.add('reducing_agent')
  }

  if (/cyanide/.test(lower)) classes.add('cyanide')
  if (/sulfide/.test(lower)) classes.add('sulfide')

  if (/(chlorine|bromine|iodine|fluorine|n-chlorosuccinimide|\bnbs\b|n-bromosuccinimide)/.test(lower)) {
    classes.add('halogen')
  }

  if (/(picric|trinitro|azide|tetrazole|fulminate)/.test(lower)) {
    classes.add('explosive')
  }

  if (/(benzoyl peroxide|mekp|methyl ethyl ketone peroxide|cumene hydroperoxide)/.test(lower)) {
    classes.add('organic_peroxide')
  }

  // GHS symbol driven additions
  if (Array.isArray(hazardSymbols)) {
    if (hazardSymbols.includes('flammable')) classes.add('flammable_solvent')
    if (hazardSymbols.includes('oxidizing')) classes.add('oxidizer')
    if (hazardSymbols.includes('explosive')) classes.add('explosive')
    if (hazardSymbols.includes('gas')) classes.add('compressed_gas')
    if (hazardSymbols.includes('toxic') || hazardSymbols.includes('acute_toxicity')) classes.add('toxic')
  }

  return Array.from(classes)
}

/**
 * Resolve effective classes for a chemical for compatibility checking.
 * Priority: saved classes ∪ GHS-derived ∪ name-derived.
 */
const resolveEffectiveClasses = (chemical) => {
  const classes = new Set(asArray(chemical?.chemical_classes))
  const hazards = asArray(chemical?.hazard_symbols)

  if (hazards.includes('oxidizing')) classes.add('oxidizer')
  if (hazards.includes('flammable')) classes.add('flammable_solvent')
  if (hazards.includes('explosive')) classes.add('explosive')
  if (hazards.includes('gas')) classes.add('compressed_gas')
  if (hazards.includes('toxic') || hazards.includes('acute_toxicity')) classes.add('toxic')

  autoClassifyChemical(chemical?.name || '', hazards).forEach((cls) => classes.add(cls))
  return Array.from(classes)
}

/* ========================================================================== */
/* SECTION 7 — PUBCHEM LOOKUP                                                 */
/* ========================================================================== */

const lookupPubChem = async (query) => {
  if (!query || typeof query !== 'string' || query.trim().length < 2) return null
  const cleaned = query.trim()
  try {
    const searchUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(cleaned)}/cids/JSON`
    const searchResponse = await fetch(searchUrl)
    if (!searchResponse.ok) return null
    const searchData = await searchResponse.json()
    const cid = searchData?.IdentifierList?.CID?.[0]
    if (!cid) return null

    const propUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,IUPACName,Title/JSON`
    const propResponse = await fetch(propUrl)
    if (!propResponse.ok) return null
    const propData = await propResponse.json()
    const properties = propData?.PropertyTable?.Properties?.[0]
    if (!properties) return null

    return {
      molecular_formula: properties.MolecularFormula || null,
      iupac_name: properties.IUPACName || properties.Title || null,
      cid,
    }
  } catch (error) {
    console.warn('PubChem lookup failed:', error)
    return null
  }
}

/* ========================================================================== */
/* SECTION 8 — CSV / PDF EXPORT                                               */
/* ========================================================================== */

const downloadCSV = (filename, rows) => {
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    console.warn('downloadCSV called with no data')
    return
  }
  const headers = Object.keys(rows[0])
  const escapeCell = (value) => {
    const stringValue = value === null || value === undefined ? '' : String(value)
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(',')),
  ]
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
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
    Barcode: chemical.barcode || '',
    'Expiry Date': chemical.expiry_date || '',
    'Min Stock': chemical.min_stock ?? '',
    'Chemical Classes': asArray(chemical.chemical_classes).join(', '),
    'Hazard Symbols': asArray(chemical.hazard_symbols).join(', '),
    'Hazard Notes': chemical.hazard_notes || '',
    Status: getStatus(chemical),
  }))
  downloadCSV(filename, rows)
}

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
  downloadCSV(`usage-history-${new Date().toISOString().slice(0, 10)}.csv`, rows)
}

const generatePDFReport = (chemicalsList, title = 'Chemical Inventory Report') => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

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
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
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

  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
    doc.text('Confidential – Laboratory Use Only', 14, pageHeight - 8)
  }

  doc.save(`chemical-inventory-${new Date().toISOString().slice(0, 10)}.pdf`)
}

/* ========================================================================== */
/* SECTION 9 — COMPATIBILITY ENGINE                                           */
/* ========================================================================== */

/**
 * Build a list of storage conflicts for chemicals that share a location.
 * Uses resolveEffectiveClasses so missing saved classes still work via name/GHS.
 */
const buildCompatibilityIssues = (chemicalList) => {
  const issues = []
  const byLocation = {}

  asArray(chemicalList).forEach((chem) => {
    const loc = normalizeLocation(chem.location)
    if (!byLocation[loc]) byLocation[loc] = []
    byLocation[loc].push(chem)
  })

  Object.entries(byLocation).forEach(([, chems]) => {
    for (let i = 0; i < chems.length; i++) {
      for (let j = i + 1; j < chems.length; j++) {
        const chemA = chems[i]
        const chemB = chems[j]
        const classesA = resolveEffectiveClasses(chemA)
        const classesB = resolveEffectiveClasses(chemB)

        CLASS_COMPATIBILITY_RULES.forEach((rule) => {
          const matchForward = classesA.includes(rule.a) && classesB.includes(rule.b)
          const matchReverse = classesA.includes(rule.b) && classesB.includes(rule.a)
          if (matchForward || matchReverse) {
            issues.push({
              location: chemA.location || 'Unassigned',
              chemA: chemA.name,
              chemB: chemB.name,
              risk: rule.risk,
              reason: rule.reason,
              classA: rule.a,
              classB: rule.b,
            })
          }
        })
      }
    }
  })

  // Deduplicate identical reports
  const seen = new Set()
  return issues.filter((issue) => {
    const key = `${issue.location}|${issue.chemA}|${issue.chemB}|${issue.reason}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/* ========================================================================== */
/* SECTION 10 — MAIN APP COMPONENT START                                      */
/* ========================================================================== */

function App() {
  /* ---------- Authentication ---------- */
  const [session, setSession] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [showLogin, setShowLogin] = useState(false)
  const [showLanding, setShowLanding] = useState(false)

  /* ---------- Core data ---------- */
  const [chemicals, setChemicals] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  /* ---------- UI controls ---------- */
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

  /* ---------- Notifications ---------- */
  const [notifications, setNotifications] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => localStorage.getItem('notificationsEnabled') !== 'false'
  )

  /* ---------- Usage log ---------- */
  const [showUsageModal, setShowUsageModal] = useState(false)
  const [usageChem, setUsageChem] = useState(null)
  const [usageForm, setUsageForm] = useState({ type: 'take', quantity: '', notes: '' })
  const [showHistory, setShowHistory] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('all')
  const [historySearch, setHistorySearch] = useState('')
  const [loggingUsage, setLoggingUsage] = useState(false)

  /* ---------- Theme ---------- */
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) return savedTheme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
  })

  /* ---------- Form ---------- */
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [lookingUp, setLookingUp] = useState(false)

  /* ---------- Barcode / QR ---------- */
  const [showScanner, setShowScanner] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [showQrModal, setShowQrModal] = useState(null)

  /* ---------- Refs ---------- */
  const searchRef = useRef(null)
  const formRef = useRef(null)
  const toastTimeout = useRef(null)
  const notifRef = useRef(null)
  const exportRef = useRef(null)
  const html5QrCodeRef = useRef(null)
  const idleTimerRef = useRef(null)

  const API_URL = import.meta.env.VITE_API_URL

  /* ======================================================================== */
  /* THEME                                                                    */
  /* ======================================================================== */

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((previous) => (previous === 'light' ? 'dark' : 'light'))
  }, [])

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode)
  }, [viewMode])

  /* ======================================================================== */
  /* AUTH                                                                     */
  /* ======================================================================== */

  useEffect(() => {
    let isMounted = true
    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      if (isMounted) {
        setSession(nextSession)
        setLoadingAuth(false)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) setSession(nextSession)
    })
    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const showMessage = useCallback((type, text) => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current)
    setMessage({ type, text, id: Date.now() })
    toastTimeout.current = setTimeout(() => setMessage(null), 4500)
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
    } catch (error) {
      console.error('Logout error:', error)
      showMessage('error', 'Failed to log out properly')
    }
  }

  const getAccessToken = useCallback(async () => {
    try {
      const { data: { session: current } } = await supabase.auth.getSession()
      return current?.access_token || null
    } catch (error) {
      console.error('Error retrieving access token:', error)
      return null
    }
  }, [])

  /* ======================================================================== */
  /* IDLE AUTO-LOGOUT                                                         */
  /* ======================================================================== */

  useEffect(() => {
    if (!session) return undefined

    const resetTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => {
        handleLogout()
        showMessage('error', 'You were logged out due to inactivity')
      }, IDLE_TIMEOUT_MS)
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach((eventName) => window.addEventListener(eventName, resetTimer))
    resetTimer()

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer))
    }
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ======================================================================== */
  /* BARCODE / QR HANDLERS (MUST stay inside App)                             */
  /* ======================================================================== */

  const handleGenerateBarcode = () => {
    setFormData((prev) => ({
      ...prev,
      barcode: generateBarcodeValue(),
    }))
    showMessage('success', 'Barcode generated — remember to Save the chemical')
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
            html5QrCode.stop().then(() => {
              html5QrCodeRef.current = null
            }).catch(() => {})

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
        console.warn('Scanner error:', err)
        showMessage('error', 'Camera access denied or not available')
        setShowScanner(false)
      }
    }, 300)
  }

  const stopScanner = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().then(() => {
        html5QrCodeRef.current = null
      }).catch(() => {})
    }
    setShowScanner(false)
    setScanResult(null)
  }

  /* ======================================================================== */
  /* NOTIFICATIONS                                                             */
  /* ======================================================================== */

  const createNotification = (type, title, messageText, chemId = null) => ({
    id: `${type}-${chemId || Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    title,
    message: messageText,
    chemId,
    createdAt: new Date().toISOString(),
    read: false,
  })

  const checkAndNotify = useCallback((chemicalList) => {
    if (!notificationsEnabled || !Array.isArray(chemicalList) || chemicalList.length === 0) return

    const newlyCreated = []
    chemicalList.forEach((chemical) => {
      if (isExpired(chemical)) {
        newlyCreated.push(
          createNotification(
            'expired',
            'Chemical Expired',
            `"${chemical.name}" expired on ${formatDate(chemical.expiry_date)}`,
            chemical.id
          )
        )
      } else if (isExpiringSoon(chemical)) {
        const remainingDays = daysUntil(chemical.expiry_date)
        newlyCreated.push(
          createNotification(
            'soon',
            'Expiring Soon',
            `"${chemical.name}" expires in ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`,
            chemical.id
          )
        )
      }
      if (isLow(chemical)) {
        newlyCreated.push(
          createNotification(
            'low',
            'Low Stock Alert',
            `"${chemical.name}" is running low (${chemical.quantity} ${chemical.unit} remaining)`,
            chemical.id
          )
        )
      }
    })

    setNotifications((previous) => {
      const existingKeys = new Set(previous.map((n) => `${n.type}-${n.chemId}`))
      const uniqueNew = newlyCreated.filter((n) => !existingKeys.has(`${n.type}-${n.chemId}`))
      if (uniqueNew.length === 0) return previous

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        uniqueNew.forEach((notification) => {
          try {
            new Notification(notification.title, {
              body: notification.message,
              tag: notification.id,
            })
          } catch {
            // ignore browser notification failures
          }
        })
      }

      return [...uniqueNew, ...previous].slice(0, MAX_NOTIFICATIONS)
    })
  }, [notificationsEnabled])

  useEffect(() => {
    if (chemicals.length > 0) checkAndNotify(chemicals)
  }, [chemicals, checkAndNotify])

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (chemicals.length > 0) checkAndNotify(chemicals)
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
    } catch {
      showMessage('error', 'Could not request notification permission')
    }
  }

  const toggleNotifications = () => {
    const nextValue = !notificationsEnabled
    setNotificationsEnabled(nextValue)
    localStorage.setItem('notificationsEnabled', String(nextValue))
    if (nextValue && notifPermission !== 'granted') requestNotificationPermission()
  }

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  )

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) setNotifOpen(false)
      if (exportRef.current && !exportRef.current.contains(event.target)) setExportOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /* ======================================================================== */
  /* API LAYER                                                                */
  /* ======================================================================== */

  const fetchChemicals = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      const token = await getAccessToken()
      if (!token) throw new Error('No access token available')
      const response = await fetch(`${API_URL}/chemicals`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error(`HTTP error ${response.status}`)
      const data = await response.json()
      setChemicals(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch chemicals:', error)
      showMessage('error', 'Could not load chemicals. Please check your connection.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [API_URL, getAccessToken, showMessage])

  const fetchTransactions = useCallback(async () => {
    try {
      const token = await getAccessToken()
      if (!token) return
      const response = await fetch(`${API_URL}/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Failed to load transactions')
      const data = await response.json()
      setTransactions(Array.isArray(data) ? data : [])
    } catch (error) {
      // Backend may not expose transactions yet — non-fatal
      console.warn('Could not load transactions:', error.message)
    }
  }, [API_URL, getAccessToken])

  useEffect(() => {
    if (session) {
      fetchChemicals()
      fetchTransactions()
    }
  }, [session, fetchChemicals, fetchTransactions])

  /* ======================================================================== */
  /* DERIVED COMPATIBILITY (must be early enough for effects)                 */
  /* ======================================================================== */

  const compatibilityIssues = useMemo(
    () => buildCompatibilityIssues(chemicals),
    [chemicals]
  )

  useEffect(() => {
    if (!compatibilityIssues.length) return
    const highCount = compatibilityIssues.filter((issue) => issue.risk === 'High').length
    if (highCount > 0) {
      showMessage(
        'error',
        `${highCount} high-risk storage conflict(s) detected. Open Compatibility Checker (⚠️).`
      )
    }
  }, [compatibilityIssues.length]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ======================================================================== */
  /* CRUD — CREATE / UPDATE                                                   */
  /* ======================================================================== */

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errors = {}
    if (!formData.name?.trim()) errors.name = 'Name is required'
    if (formData.quantity !== '' && Number.isNaN(Number(formData.quantity))) {
      errors.quantity = 'Must be a valid number'
    }
    if (formData.min_stock !== '' && Number.isNaN(Number(formData.min_stock))) {
      errors.min_stock = 'Must be a valid number'
    }
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('No access token')

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
      const method = editingId ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error(`Save failed with status ${response.status}`)
      showMessage('success', editingId ? 'Chemical updated successfully' : 'Chemical added successfully')
      resetForm()
      fetchChemicals(true)
    } catch (error) {
      console.error('Save chemical error:', error)
      showMessage('error', 'Failed to save chemical. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  /* ======================================================================== */
  /* CRUD — DELETE                                                            */
  /* ======================================================================== */

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}" permanently? This cannot be undone.`)) return
    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_URL}/chemicals/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Delete failed')
      showMessage('success', `"${name}" has been deleted`)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      fetchChemicals(true)
    } catch (error) {
      console.error('Delete error:', error)
      showMessage('error', 'Failed to delete chemical')
    }
  }

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return
    if (!window.confirm(`Delete ${selectedIds.size} selected chemical(s)? This cannot be undone.`)) return
    const token = await getAccessToken()
    let successCount = 0
    for (const id of selectedIds) {
      try {
        const response = await fetch(`${API_URL}/chemicals/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.ok) successCount += 1
      } catch {
        // continue deleting remaining items
      }
    }
    showMessage('success', `Deleted ${successCount} chemical(s)`)
    setSelectedIds(new Set())
    setBulkMode(false)
    fetchChemicals(true)
  }

  /* ======================================================================== */
  /* SDS UPLOAD / DOWNLOAD                                                    */
  /* ======================================================================== */

  const handleSdsUpload = async (chemicalId, file) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      showMessage('error', 'Only PDF files are allowed for SDS uploads')
      return
    }
    setUploadProgress((prev) => ({ ...prev, [chemicalId]: 10 }))
    const token = await getAccessToken()
    const formPayload = new FormData()
    formPayload.append('file', file)
    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const current = prev[chemicalId] || 10
          if (current >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return { ...prev, [chemicalId]: current + 15 }
        })
      }, 200)

      const response = await fetch(`${API_URL}/chemicals/${chemicalId}/upload-sds`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formPayload,
      })
      clearInterval(progressInterval)
      setUploadProgress((prev) => ({ ...prev, [chemicalId]: 100 }))
      if (!response.ok) throw new Error('Upload failed')
      showMessage('success', 'SDS file uploaded successfully')
      setTimeout(() => {
        setUploadProgress((prev) => {
          const next = { ...prev }
          delete next[chemicalId]
          return next
        })
      }, 600)
      fetchChemicals(true)
    } catch (error) {
      console.error('SDS upload error:', error)
      setUploadProgress((prev) => {
        const next = { ...prev }
        delete next[chemicalId]
        return next
      })
      showMessage('error', 'SDS upload failed')
    }
  }

  const handleDownloadSds = async (chemicalId) => {
    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_URL}/chemicals/${chemicalId}/sds`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (data?.url) {
        window.open(data.url, '_blank')
      } else {
        showMessage('error', 'SDS file not found')
      }
    } catch (error) {
      console.error('SDS download error:', error)
      showMessage('error', 'Failed to download SDS')
    }
  }

  /* ======================================================================== */
  /* USAGE / TRANSACTION LOG                                                  */
  /* ======================================================================== */

  const openUsageModal = (chemical) => {
    setUsageChem(chemical)
    setUsageForm({ type: 'take', quantity: '', notes: '' })
    setShowUsageModal(true)
  }

  const handleLogUsage = async (e) => {
    e.preventDefault()
    if (!usageChem) return
    const qty = parseFloat(usageForm.quantity)
    if (!qty || qty <= 0) {
      showMessage('error', 'Enter a valid positive quantity')
      return
    }

    setLoggingUsage(true)
    try {
      const token = await getAccessToken()
      let change = 0
      if (usageForm.type === 'take') change = -qty
      else if (usageForm.type === 'return') change = qty
      else change = qty - Number(usageChem.quantity)

      const newQuantity = Math.max(0, Number(usageChem.quantity) + change)
      const updateResponse = await fetch(`${API_URL}/chemicals/${usageChem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...usageChem, quantity: newQuantity }),
      })
      if (!updateResponse.ok) throw new Error('Quantity update failed')

      const transactionPayload = {
        chemical_id: usageChem.id,
        chemical_name: usageChem.name,
        type: usageForm.type,
        quantity_change: change,
        quantity_before: Number(usageChem.quantity),
        quantity_after: newQuantity,
        unit: usageChem.unit,
        notes: usageForm.notes.trim() || null,
        user_email: session?.user?.email,
      }

      try {
        await fetch(`${API_URL}/transactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(transactionPayload),
        })
      } catch {
        // Transactions endpoint may be missing — still keep local history
      }

      setTransactions((prev) => [
        {
          id: `local-${Date.now()}`,
          ...transactionPayload,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ])

      const successText =
        usageForm.type === 'take'
          ? `Took ${qty} ${usageChem.unit} of ${usageChem.name}`
          : usageForm.type === 'return'
            ? `Returned ${qty} ${usageChem.unit} of ${usageChem.name}`
            : `Adjusted ${usageChem.name} to ${newQuantity} ${usageChem.unit}`
      showMessage('success', successText)
      setShowUsageModal(false)
      setUsageChem(null)
      fetchChemicals(true)
      fetchTransactions()
    } catch (error) {
      console.error('Log usage error:', error)
      showMessage('error', 'Failed to log usage')
    } finally {
      setLoggingUsage(false)
    }
  }

  /* ======================================================================== */
  /* EXPORT HELPERS                                                           */
  /* ======================================================================== */

  const handleExportCurrent = () => {
    exportChemicalsCSV(filtered, `chemicals-filtered-${new Date().toISOString().slice(0, 10)}.csv`)
    setExportOpen(false)
    showMessage('success', `Exported ${filtered.length} chemicals (CSV)`)
  }

  const handleExportAll = () => {
    exportChemicalsCSV(chemicals, `chemicals-all-${new Date().toISOString().slice(0, 10)}.csv`)
    setExportOpen(false)
    showMessage('success', `Exported ${chemicals.length} chemicals (CSV)`)
  }

  const handleExportTransactions = () => {
    exportTransactionsCSV(transactions)
    setExportOpen(false)
    showMessage('success', `Exported ${transactions.length} transactions (CSV)`)
  }

  const handleExportPDF = () => {
    generatePDFReport(filtered.length ? filtered : chemicals, 'Current Inventory View')
    setExportOpen(false)
    showMessage('success', 'PDF report generated')
  }

  const handleExportPDFAll = () => {
    generatePDFReport(chemicals, 'Full Chemical Inventory')
    setExportOpen(false)
    showMessage('success', 'Full PDF report generated')
  }

  /* ======================================================================== */
  /* FORM HELPERS                                                             */
  /* ======================================================================== */

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

  const toggleHazard = (hazardId) => {
    setFormData((prev) => {
      const current = prev.hazard_symbols || []
      return current.includes(hazardId)
        ? { ...prev, hazard_symbols: current.filter((id) => id !== hazardId) }
        : { ...prev, hazard_symbols: [...current, hazardId] }
    })
  }

  const toggleClass = (classId) => {
    setFormData((prev) => {
      const current = prev.chemical_classes || []
      return current.includes(classId)
        ? { ...prev, chemical_classes: current.filter((id) => id !== classId) }
        : { ...prev, chemical_classes: [...current, classId] }
    })
  }

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM })
    setFormErrors({})
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (chemical) => {
    setFormData({
      name: chemical.name || '',
      cas_number: chemical.cas_number || '',
      quantity: chemical.quantity ?? '',
      unit: chemical.unit || 'g',
      location: chemical.location || '',
      expiry_date: chemical.expiry_date || '',
      min_stock: chemical.min_stock ?? '',
      hazard_notes: chemical.hazard_notes || '',
      molecular_formula: chemical.molecular_formula || '',
      hazard_symbols: chemical.hazard_symbols || [],
      batch_lot: chemical.batch_lot || '',
      supplier: chemical.supplier || '',
      chemical_classes: chemical.chemical_classes || [],
      barcode: chemical.barcode || '',
    })
    setEditingId(chemical.id)
    setShowForm(true)
  }

  /* Auto-suggest classes when name or GHS symbols change while form is open */
  useEffect(() => {
    if (!showForm) return
    const suggested = autoClassifyChemical(formData.name, formData.hazard_symbols)
    if (!suggested.length) return
    setFormData((prev) => {
      const merged = new Set(prev.chemical_classes || [])
      suggested.forEach((cls) => merged.add(cls))
      return { ...prev, chemical_classes: Array.from(merged) }
    })
  }, [formData.name, formData.hazard_symbols, showForm])

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
      showMessage('success', 'Data loaded from PubChem')
    } catch (error) {
      console.error('PubChem error:', error)
      showMessage('error', 'PubChem lookup failed')
    } finally {
      setLookingUp(false)
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map((c) => c.id)))
  }

  /* ======================================================================== */
  /* DERIVED DATA                                                             */
  /* ======================================================================== */

  const locations = useMemo(() => {
    const set = new Set()
    chemicals.forEach((c) => {
      if (c.location) set.add(c.location.trim())
    })
    return Array.from(set).sort()
  }, [chemicals])

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim()
    let result = chemicals.filter((chemical) => {
      const matchesSearch =
        !query ||
        chemical.name?.toLowerCase().includes(query) ||
        chemical.cas_number?.toLowerCase().includes(query) ||
        chemical.molecular_formula?.toLowerCase().includes(query) ||
        chemical.location?.toLowerCase().includes(query) ||
        chemical.batch_lot?.toLowerCase().includes(query) ||
        chemical.supplier?.toLowerCase().includes(query) ||
        chemical.barcode?.toLowerCase().includes(query) ||
        chemical.hazard_notes?.toLowerCase().includes(query)

      if (!matchesSearch) return false
      if (filter === 'low') return isLow(chemical)
      if (filter === 'expired') return isExpired(chemical)
      if (filter === 'soon') return isExpiringSoon(chemical)
      if (filter === 'no-sds') return !chemical.sds_filename
      if (locationFilter && chemical.location !== locationFilter) return false
      if (hazardFilter && !(chemical.hazard_symbols || []).includes(hazardFilter)) return false
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

  /* ======================================================================== */
  /* KEYBOARD SHORTCUTS                                                       */
  /* ======================================================================== */

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen((open) => !open)
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
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      ) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [session, showForm])

  /* ======================================================================== */
  /* AUTH / LOADING GUARDS                                                    */
  /* ======================================================================== */

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

  /* ======================================================================== */
  /* RENDER                                                                   */
  /* ======================================================================== */

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
            <p className="subtitle">Stock • Hazards • SDS • Compatibility</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="notif-wrapper" ref={notifRef}>
            <button
              className="icon-btn notif-btn"
              onClick={() => setNotifOpen((v) => !v)}
              title="Notifications"
            >
              🔔
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </button>
          </div>

          <button className="icon-btn" onClick={() => setShowHistory(true)} title="Usage History">
            📋
          </button>
          <button className="icon-btn" onClick={() => setCompatOpen(true)} title="Compatibility Checker">
            ⚠️
            {compatibilityIssues.length > 0 && (
              <span className="notif-badge">{compatibilityIssues.length}</span>
            )}
          </button>
          <button className="icon-btn" onClick={startScanner} title="Scan Barcode / QR">
            📷
          </button>
          <button className="icon-btn" onClick={() => setCommandOpen(true)} title="Command palette">
            ⌘K
          </button>
          <button className="icon-btn theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <div className="user-chip">
            <span className="user-email">{session.user?.email}</span>
          </div>
          <button className="btn btn-ghost" onClick={() => setShowLanding(true)}>
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

      {/* View switcher */}
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

      {/* ===================== DASHBOARD ===================== */}
      {mainView === 'dashboard' ? (
        <div className="dashboard">
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
            <div className={`stat-card ${compatibilityIssues.length ? 'danger' : ''}`}>
              <span className="stat-value">{compatibilityIssues.length}</span>
              <span className="stat-label">Compat. Issues</span>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="dash-card">
              <h3>Recent Activity</h3>
              <div className="dash-list">
                {transactions.length === 0 ? (
                  <p className="text-muted">No activity yet</p>
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
                  <p className="text-muted">No issues detected</p>
                ) : (
                  compatibilityIssues.slice(0, 10).map((issue, index) => (
                    <div key={index} className="dash-item">
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
        <>
          {/* Stats */}
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
                placeholder="Search name, CAS, formula, barcode, location…"
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
            >
              <option value="">All Hazards</option>
              {HAZARD_OPTIONS.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.label}
                </option>
              ))}
            </select>

            <div className="toolbar-right">
              <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
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
                >
                  ☰
                </button>
                <button
                  className={viewMode === 'cards' ? 'active' : ''}
                  onClick={() => setViewMode('cards')}
                >
                  ▦
                </button>
              </div>

              <div className="export-wrapper" ref={exportRef}>
                <button className="btn btn-ghost" onClick={() => setExportOpen((v) => !v)}>
                  ⬇ Export
                </button>
                {exportOpen && (
                  <div className="export-dropdown">
                    <button type="button" onClick={handleExportCurrent}>
                      Export Current (CSV)
                    </button>
                    <button type="button" onClick={handleExportAll}>
                      Export All (CSV)
                    </button>
                    <button type="button" onClick={handleExportTransactions}>
                      Export Usage (CSV)
                    </button>
                    <div className="export-divider" />
                    <button type="button" onClick={handleExportPDF}>
                      PDF (Current)
                    </button>
                    <button type="button" onClick={handleExportPDFAll}>
                      PDF (All)
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
              <button className="icon-btn" onClick={() => setHazardLegendOpen(true)}>
                ℹ️
              </button>
            </div>
          </div>

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

          {/* ===================== ADD / EDIT FORM ===================== */}
          {showForm && (
            <div className="form-overlay" onClick={(e) => e.target === e.currentTarget && resetForm()}>
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
                          placeholder="e.g. Hydrogen peroxide"
                          autoFocus
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={handlePubChemLookup}
                          disabled={lookingUp}
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
                        placeholder="e.g. 7722-84-1"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="molecular_formula">Molecular Formula</label>
                      <input
                        id="molecular_formula"
                        name="molecular_formula"
                        value={formData.molecular_formula}
                        onChange={handleChange}
                        placeholder="e.g. H₂O₂"
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
                      {formErrors.quantity && <span className="error-text">{formErrors.quantity}</span>}
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
                        placeholder="e.g. Cabinet A"
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
                      <label htmlFor="min_stock">Min Stock</label>
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
                      <label htmlFor="batch_lot">Batch / Lot</label>
                      <input
                        id="batch_lot"
                        name="batch_lot"
                        value={formData.batch_lot}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="supplier">Supplier</label>
                      <input
                        id="supplier"
                        name="supplier"
                        value={formData.supplier}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="barcode">Barcode / QR Value</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          id="barcode"
                          name="barcode"
                          value={formData.barcode}
                          onChange={handleChange}
                          placeholder="Scan or generate"
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={handleGenerateBarcode}
                        >
                          Generate
                        </button>
                      </div>
                    </div>

                    <div className="form-group full">
                      <label htmlFor="hazard_notes">Hazard Notes</label>
                      <input
                        id="hazard_notes"
                        name="hazard_notes"
                        value={formData.hazard_notes}
                        onChange={handleChange}
                        placeholder="Optional free-text notes"
                      />
                    </div>
                  </div>

                  {formData.barcode && (
                    <div style={{ marginBottom: 20, textAlign: 'center' }}>
                      <QRCodeSVG value={formData.barcode} size={120} />
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>
                        {formData.barcode}
                      </div>
                    </div>
                  )}

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

                  <div className="hazard-selector">
                    <label>Chemical Classes (used by Compatibility Checker)</label>
                    <div className="hazard-grid">
                      {CHEMICAL_CLASSES.map((cls) => {
                        const isActive = formData.chemical_classes?.includes(cls.id)
                        return (
                          <button
                            type="button"
                            key={cls.id}
                            className={`hazard-chip ${isActive ? 'active' : ''}`}
                            onClick={() => toggleClass(cls.id)}
                            title={cls.description}
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

          {/* ===================== USAGE MODAL ===================== */}
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
                      {usageForm.type === 'adjust' ? 'New Total Quantity' : 'Quantity'} (
                      {usageChem.unit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={usageForm.quantity}
                      onChange={(e) => setUsageForm((f) => ({ ...f, quantity: e.target.value }))}
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

          {/* ===================== MAIN CONTENT ===================== */}
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
                      ? Math.min(
                          100,
                          Math.round((Number(chem.quantity) / (Number(chem.min_stock) * 2)) * 100)
                        )
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
                              <span
                                key={id}
                                title={h.label}
                                style={{ display: 'inline-flex', marginRight: 4 }}
                              >
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
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => setShowQrModal(chem)}
                          >
                            QR
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => openUsageModal(chem)}
                        >
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
                          <td>{chem.batch_lot || '—'}</td>
                          <td>{chem.supplier || '—'}</td>
                          <td className="mono">{chem.barcode || '—'}</td>
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
                                  <span
                                    key={id}
                                    title={h.label}
                                    style={{ display: 'inline-flex', marginRight: 3 }}
                                  >
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
                                    e.target.files?.[0] &&
                                    handleSdsUpload(chem.id, e.target.files[0])
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

      {/* ===================== SCANNER MODAL ===================== */}
      {showScanner && (
        <div className="modal-overlay" onClick={stopScanner}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Scan Barcode / QR</h3>
              <button className="icon-btn" onClick={stopScanner}>
                ✕
              </button>
            </div>
            <div id="qr-reader" style={{ width: '100%' }} />
            {scanResult && (
              <p style={{ marginTop: 12, textAlign: 'center' }}>
                Scanned: <strong>{scanResult}</strong>
              </p>
            )}
            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
                marginTop: 12,
                textAlign: 'center',
              }}
            >
              Point your camera at a barcode or QR code on a bottle.
            </p>
          </div>
        </div>
      )}

      {/* ===================== QR DISPLAY MODAL ===================== */}
      {showQrModal && (
        <div className="modal-overlay" onClick={() => setShowQrModal(null)}>
          <div
            className="modal"
            style={{ maxWidth: 320, textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{showQrModal.name}</h3>
              <button className="icon-btn" onClick={() => setShowQrModal(null)}>
                ✕
              </button>
            </div>
            {showQrModal.barcode ? (
              <>
                <QRCodeSVG value={showQrModal.barcode} size={200} />
                <p
                  style={{
                    marginTop: 12,
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    wordBreak: 'break-all',
                  }}
                >
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

      {/* ===================== USAGE HISTORY ===================== */}
      {showHistory && (
        <div
          className="form-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowHistory(false)}
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

      {/* ===================== COMPATIBILITY MODAL ===================== */}
      {compatOpen && (
        <div className="modal-overlay" onClick={() => setCompatOpen(false)}>
          <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chemical Compatibility Checker</h3>
              <button className="icon-btn" onClick={() => setCompatOpen(false)}>
                ✕
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Checks chemicals that share the same location using chemical classes, GHS symbols, and
              name-based auto-classification. Always confirm with SDS Section 7/10.
            </p>
            {compatibilityIssues.length === 0 ? (
              <p style={{ padding: '24px 0', color: 'var(--text-muted)' }}>
                No compatibility issues were detected for the current inventory.
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
      
      {/* ===================== NOTIFICATIONS ===================== */}

      {notifOpen && (
        <div className="notif-modal-overlay" onClick={() => setNotifOpen(false)}>
          <div className="notif-modal" onClick={(e) => e.stopPropagation()}>
            <div className="notif-modal-header">
              <h3>Notifications</h3>
              <div className="notif-modal-actions">
                <button
                  type="button"
                  onClick={() =>
                    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
                  }
               >
                  Mark all read
                </button>
                <button type="button" onClick={() => setNotifications([])}>
                  Clear
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setNotifOpen(false)}
                  aria-label="Close"
                >
                  ✕
                </button>
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
                    onClick={() =>
                      setNotifications((prev) =>
                        prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
                      )
                    }
                  >
                    <div className="notif-title">{n.title}</div>
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
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={requestNotificationPermission}
                >
                  Allow browser notifications
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== COMMAND PALETTE ===================== */}
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
                  startScanner()
                  setCommandOpen(false)
                }}
              >
                <span>📷</span> Scan barcode / QR
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

      {/* ===================== HAZARD LEGEND ===================== */}
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

      {/* Footer */}
      <footer className="app-footer">
        <span>
          Showing <strong>{filtered.length}</strong> of <strong>{chemicals.length}</strong> chemicals
          {compatibilityIssues.length > 0 && (
            <>
              {' '}
              • <strong style={{ color: 'var(--danger)' }}>{compatibilityIssues.length}</strong>{' '}
              compatibility issue(s)
            </>
          )}
        </span>
        <span className="footer-hint">
          <kbd>/</kbd> search • <kbd>⌘K</kbd> commands • <kbd>⌘N</kbd> new chemical
        </span>
      </footer>
    </div>
  )
}

export default App
