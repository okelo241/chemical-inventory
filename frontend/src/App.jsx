/*
 * Lab Chemical Inventory — App.jsx
 * Achievable MVP (PRD-aligned, production-oriented)
 *
 * Inventory & containers
 *  - CRUD chemicals, locations (building > room > cabinet > shelf)
 *  - Unique barcode / QR per bottle, print labels, camera scan
 *  - Quantity / usage logging, mass-balance style history
 *  - CSV import/export, archive, My Collection (private)
 *
 * Hazard & safety
 *  - PubChem lookup (name/CAS → formula & enrichment)
 *  - Chemical classes + GHS-oriented compatibility matrix
 *  - Storage incompatibility warnings by co-location
 *  - Expiry, low-stock, and peroxide-former alerts
 *  - SDS file link / review reminders
 *
 * Access & audit
 *  - Personal + organization workspaces
 *  - Roles: owner / admin / member (RBAC-lite)
 *  - Invites with temp password + join token
 *  - Client audit log (+ optional server audit later)
 *
 * Account UX
 *  - Profile (name, avatar, theme, notification prefs)
 *  - Default workspace, linked orgs, sign out all devices
 *  - Dark / light theme (synced across Landing / Login / App)
 *
 * Not claimed here: full 21 CFR Part 11, RFID fleet, global SDS marketplace
 */


import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Landing from './Landing'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Html5Qrcode } from 'html5-qrcode'
import { QRCodeSVG } from 'qrcode.react'
import appLogo from './assets/logo.jpg'
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
  { id: 'harmful', label: 'Harmful / Irritant', emoji: '⚠️', color: '#f59e0b', icon: pictogramHarmful },
  { id: 'environmental', label: 'Environmental', emoji: '🌍', color: '#22c55e', icon: pictogramEnvironmental },
  { id: 'acute_toxicity', label: 'Acute Toxicity', emoji: '☠️', color: '#7f1d1d', icon: pictogramToxic },
  { id: 'carcinogen', label: 'Carcinogen', emoji: '☢️', color: '#9f1239', icon: pictogramHealth },
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
  // Hierarchical location parts (joined into `location` on save)
  loc_building: '',
  loc_room: '',
  loc_cabinet: '',
  loc_shelf: '',
  expiry_date: '',
  min_stock: '',
  hazard_notes: '',
  molecular_formula: '',
  hazard_symbols: [],
  batch_lot: '',
  supplier: '',
  chemical_classes: [],
  barcode: '',
  // Phase A extras (stored in location string / meta when API lacks columns)
  sds_url: '',
  pubchem_url: '',
  pubchem_cid: '',
  molecular_weight: '',
  sds_reviewed_at: '',
  sds_review_months: '12',
  container_code: '',
  parent_cas_key: '',
  lab_unit: '',
  archived: false,
}

/** Idle timeout: 30 minutes of no user activity → automatic logout */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000

/** How many days before expiry counts as “expiring soon” */
const EXPIRY_SOON_DAYS = 30

/** SDS review default interval (months) */
const SDS_REVIEW_DEFAULT_MONTHS = 12

/** Max notifications kept in memory */
const MAX_NOTIFICATIONS = 60

/** Max audit events kept client-side (append-only ring) */
const MAX_AUDIT_EVENTS = 500

const AUDIT_STORAGE_KEY = 'chem_audit_log_v1'
const CHEM_META_STORAGE_KEY = 'chem_meta_v1'
const WASTE_STORAGE_KEY = 'chem_waste_log_v1'
const LAB_UNITS_STORAGE_KEY = 'chem_lab_units_v1'

/* ========================================================================== */
/* PHASE A HELPERS — locations, audit, SDS review, labels, duplicates         */
/* ========================================================================== */

const joinLocationPath = ({ loc_building, loc_room, loc_cabinet, loc_shelf, location }) => {
  const parts = [loc_building, loc_room, loc_cabinet, loc_shelf]
    .map((p) => (p || '').trim())
    .filter(Boolean)
  if (parts.length) return parts.join(' / ')
  return (location || '').trim()
}

const splitLocationPath = (location) => {
  const raw = (location || '').trim()
  if (!raw) {
    return { loc_building: '', loc_room: '', loc_cabinet: '', loc_shelf: '', location: '' }
  }
  const parts = raw.split(/\s*\/\s*/).map((p) => p.trim()).filter(Boolean)
  return {
    loc_building: parts[0] || '',
    loc_room: parts[1] || '',
    loc_cabinet: parts[2] || '',
    loc_shelf: parts[3] || '',
    location: raw,
  }
}

const loadJsonStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

const saveJsonStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota / private mode
  }
}

const appendAuditEvent = (event) => {
  const list = loadJsonStorage(AUDIT_STORAGE_KEY, [])
  const row = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...event,
  }
  list.unshift(row)
  saveJsonStorage(AUDIT_STORAGE_KEY, list.slice(0, MAX_AUDIT_EVENTS))
  return row
}

const getChemMeta = (chemicalId) => {
  const all = loadJsonStorage(CHEM_META_STORAGE_KEY, {})
  return all[String(chemicalId)] || {}
}

const setChemMeta = (chemicalId, patch) => {
  const all = loadJsonStorage(CHEM_META_STORAGE_KEY, {})
  const key = String(chemicalId)
  all[key] = { ...(all[key] || {}), ...patch, updated_at: new Date().toISOString() }
  saveJsonStorage(CHEM_META_STORAGE_KEY, all)
  return all[key]
}

const sdsReviewDueDate = (reviewedAt, months = SDS_REVIEW_DEFAULT_MONTHS) => {
  if (!reviewedAt) return null
  try {
    const d = new Date(reviewedAt)
    if (Number.isNaN(d.getTime())) return null
    d.setMonth(d.getMonth() + Number(months || SDS_REVIEW_DEFAULT_MONTHS))
    return d.toISOString().slice(0, 10)
  } catch {
    return null
  }
}

const isSdsReviewOverdue = (chemical) => {
  const meta = getChemMeta(chemical?.id)
  const reviewed = chemical?.sds_reviewed_at || meta.sds_reviewed_at
  if (!chemical?.sds_filename && !reviewed) return true
  if (!reviewed) return Boolean(chemical?.sds_filename)
  const months =
    chemical?.sds_review_months || meta.sds_review_months || SDS_REVIEW_DEFAULT_MONTHS
  const due = sdsReviewDueDate(reviewed, months)
  if (!due) return false
  return daysUntil(due) !== null && daysUntil(due) < 0
}

const findDuplicateChemicals = (list, { cas_number, location, excludeId }) => {
  const cas = (cas_number || '').trim().toLowerCase()
  const loc = normalizeLocation(location)
  if (!cas && !loc) return []
  return (list || []).filter((c) => {
    if (excludeId && c.id === excludeId) return false
    if (c.archived || getChemMeta(c.id).archived) return false
    const sameCas = cas && (c.cas_number || '').trim().toLowerCase() === cas
    const sameLoc = loc && normalizeLocation(c.location) === loc
    return Boolean(sameCas && sameLoc)
  })
}

const printChemicalLabel = (chemical) => {
  if (!chemical) return
  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  const hazards = asArray(chemical.hazard_symbols).join(', ')
  const barcode = chemical.barcode || chemical.container_code || `CHEM-${chemical.id}`
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Label — ${esc(chemical.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 20px;
      color: #0f172a;
      background: #f8fafc;
    }
    .card {
      border: 2px solid #0f172a;
      border-radius: 12px;
      padding: 16px 18px;
      max-width: 360px;
      margin: 0 auto;
      background: #fff;
    }
    h1 { font-size: 18px; margin: 0 0 10px; line-height: 1.25; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    .row { margin: 6px 0; font-size: 13px; }
    .label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    .haz {
      margin-top: 12px;
      padding: 8px 10px;
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 8px;
      font-size: 12px;
    }
    .actions { text-align: center; margin-top: 16px; }
    button {
      font: inherit;
      padding: 10px 18px;
      border-radius: 10px;
      border: 0;
      background: #2563eb;
      color: #fff;
      font-weight: 600;
      cursor: pointer;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .actions { display: none; }
      .card { border-radius: 0; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="label">Chemical label</div>
    <h1>${esc(chemical.name)}</h1>
    <div class="row mono"><span class="label">CAS</span><br/>${esc(chemical.cas_number || '—')}</div>
    ${
      chemical.molecular_formula
        ? `<div class="row"><span class="label">Formula</span><br/>${esc(chemical.molecular_formula)}</div>`
        : ''
    }
    <div class="row"><span class="label">Quantity</span><br/>${esc(chemical.quantity ?? '—')} ${esc(chemical.unit || '')}</div>
    <div class="row"><span class="label">Location</span><br/>${esc(chemical.location || '—')}</div>
    ${
      chemical.expiry_date
        ? `<div class="row"><span class="label">Expiry</span><br/>${esc(chemical.expiry_date)}</div>`
        : ''
    }
    <div class="row mono"><span class="label">Container ID</span><br/>${esc(barcode)}</div>
    ${hazards ? `<div class="haz"><strong>Hazards:</strong> ${esc(hazards)}</div>` : ''}
  </div>
  <div class="actions">
    <button type="button" onclick="window.print()">Print label</button>
  </div>
</body>
</html>`

  // Blob URL avoids blank about:blank when noopener blocks document.write
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank', 'noopener,noreferrer,width=440,height=640')
  if (!w) {
    URL.revokeObjectURL(url)
    // Popup blocked — open in same tab as last resort
    const fallback = window.open()
    if (fallback) {
      fallback.document.open()
      fallback.document.write(html)
      fallback.document.close()
    } else {
      alert('Please allow pop-ups to print chemical labels.')
    }
    return
  }
  // Revoke after the new tab has loaded
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

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

/**
 * Lookup a compound on PubChem by name or CAS number.
 * Returns { molecular_formula, iupac_name, cid } or null.
 * Prefers CAS-style queries when the string looks like a CAS RN.
 */
const lookupPubChem = async (query) => {
  if (!query || typeof query !== 'string' || query.trim().length < 2) return null
  const cleaned = query.trim()

  // Detect simple CAS pattern (e.g. 7722-84-1)
  const looksLikeCas = /^\d{2,7}-\d{2}-\d$/.test(cleaned)

  const tryFetchCid = async (path) => {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/${path}/cids/JSON`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    return data?.IdentifierList?.CID?.[0] || null
  }

  try {
    let cid = null

    if (looksLikeCas) {
      // Prefer name endpoint first (PubChem accepts CAS there), then xref/RN
      cid = await tryFetchCid(`compound/name/${encodeURIComponent(cleaned)}`)
      if (!cid) {
        cid = await tryFetchCid(`compound/xref/RN/${encodeURIComponent(cleaned)}`)
      }
    } else {
      cid = await tryFetchCid(`compound/name/${encodeURIComponent(cleaned)}`)
    }

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

/**
 * Parse a chemicals CSV (header row required).
 * Accepts headers matching exportChemicalsCSV or simple aliases.
 */
const parseChemicalsCSV = (text) => {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
  if (lines.length < 2) return []

  const parseRow = (line) => {
    const cells = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"'
          i++
        } else if (ch === '"') {
          inQuotes = false
        } else {
          cur += ch
        }
      } else if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        cells.push(cur.trim())
        cur = ''
      } else {
        cur += ch
      }
    }
    cells.push(cur.trim())
    return cells
  }

  const headers = parseRow(lines[0]).map((h) => h.toLowerCase())
  const idx = (names) => {
    for (const n of names) {
      const i = headers.indexOf(n.toLowerCase())
      if (i >= 0) return i
    }
    return -1
  }

  const iName = idx(['name', 'chemical', 'chemical name'])
  const iCas = idx(['cas number', 'cas', 'cas_number'])
  const iQty = idx(['quantity', 'qty', 'amount'])
  const iUnit = idx(['unit'])
  const iLoc = idx(['location', 'storage'])
  const iBatch = idx(['batch / lot', 'batch', 'lot', 'batch_lot'])
  const iSupplier = idx(['supplier'])
  const iBarcode = idx(['barcode'])
  const iExpiry = idx(['expiry date', 'expiry', 'expiry_date'])
  const iMin = idx(['min stock', 'min_stock', 'minimum'])
  const iFormula = idx(['molecular formula', 'formula', 'molecular_formula'])
  const iNotes = idx(['hazard notes', 'notes', 'hazard_notes'])
  const iHazards = idx(['hazard symbols', 'hazards', 'hazard_symbols'])
  const iClasses = idx(['chemical classes', 'classes', 'chemical_classes'])

  if (iName < 0) return []

  const rows = []
  for (let r = 1; r < lines.length; r++) {
    const cells = parseRow(lines[r])
    const name = (cells[iName] || '').trim()
    if (!name) continue
    const splitList = (v) =>
      (v || '')
        .split(/[;,|]/)
        .map((s) => s.trim())
        .filter(Boolean)

    rows.push({
      name,
      cas_number: iCas >= 0 ? cells[iCas] || null : null,
      quantity: iQty >= 0 ? Number(cells[iQty]) || 0 : 0,
      unit: iUnit >= 0 && cells[iUnit] ? cells[iUnit] : 'g',
      location: iLoc >= 0 ? cells[iLoc] || null : null,
      batch_lot: iBatch >= 0 ? cells[iBatch] || null : null,
      supplier: iSupplier >= 0 ? cells[iSupplier] || null : null,
      barcode: iBarcode >= 0 ? cells[iBarcode] || null : null,
      expiry_date: iExpiry >= 0 && cells[iExpiry] ? cells[iExpiry] : null,
      min_stock: iMin >= 0 ? Number(cells[iMin]) || 0 : 0,
      molecular_formula: iFormula >= 0 ? cells[iFormula] || null : null,
      hazard_notes: iNotes >= 0 ? cells[iNotes] || null : null,
      hazard_symbols: iHazards >= 0 ? splitList(cells[iHazards]) : [],
      chemical_classes: iClasses >= 0 ? splitList(cells[iClasses]) : [],
    })
  }
  return rows
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
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
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

  /* ---------- Organizations / Workspace ---------- */
  // Locked from Login intent: 'personal' | 'organization'
  // Personal session hides org UI; organization session hides personal option.
  const [accountMode, setAccountMode] = useState(() => {
    try {
      const saved = localStorage.getItem('accountMode')
      if (saved === 'organization' || saved === 'personal') return saved
      const intent = JSON.parse(localStorage.getItem('workspaceIntent') || 'null')
      if (intent?.type === 'organization') return 'organization'
      if (intent?.type === 'personal') return 'personal'
    } catch {
      // ignore
    }
    return 'personal'
  })
  const [organizations, setOrganizations] = useState([])
  const [workspaceMode, setWorkspaceMode] = useState('personal') // 'personal' | 'organization'
  const [activeOrgId, setActiveOrgId] = useState(null)
  const [activeOrgName, setActiveOrgName] = useState('')
  const [activeOrgRole, setActiveOrgRole] = useState(null)
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [orgLoading, setOrgLoading] = useState(false)
  const [workspace, setWorkspace] = useState(() => {
    try {
      const saved = localStorage.getItem('workspace')
      return saved
        ? JSON.parse(saved)
        : { mode: 'personal', organization_id: null }
    } catch {
      return { mode: 'personal', organization_id: null }
    }
  })
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteFullName, setInviteFullName] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [orgInvites, setOrgInvites] = useState([])
  const [orgMembers, setOrgMembers] = useState([])
  const [lastInviteLink, setLastInviteLink] = useState('')
  const [lastInviteEmail, setLastInviteEmail] = useState('')
  const [lastInvitePassword, setLastInvitePassword] = useState('')

  /* Phase A / competitive feature panels */
  const [showAuditLog, setShowAuditLog] = useState(false)
  const [auditEvents, setAuditEvents] = useState(() => loadJsonStorage(AUDIT_STORAGE_KEY, []))
  const [showSdsReport, setShowSdsReport] = useState(false)
  const [showWasteModal, setShowWasteModal] = useState(false)
  const [wasteLog, setWasteLog] = useState(() => loadJsonStorage(WASTE_STORAGE_KEY, []))
  const [wasteForm, setWasteForm] = useState({ chemical_id: '', quantity: '', unit: 'g', reason: '', notes: '' })
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileAvatar, setProfileAvatar] = useState('')
  const [profileNewPassword, setProfileNewPassword] = useState('')
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState(null)
  const [profilePrefs, setProfilePrefs] = useState({
    notifications_enabled: true,
    notify_expiry: true,
    notify_low_stock: true,
    notify_usage: true,
    theme: 'light',
    default_workspace: 'last', // 'personal' | 'last' | org id
  })
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState('')
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [labUnits, setLabUnits] = useState(() => loadJsonStorage(LAB_UNITS_STORAGE_KEY, []))
  const [activeLabUnit, setActiveLabUnit] = useState(() => localStorage.getItem('activeLabUnit') || '')
  const [scanActionMode, setScanActionMode] = useState('find') // find | take | return
  const [autoEnrichBusy, setAutoEnrichBusy] = useState(false)

  /* ---------- Refs ---------- */
  const searchRef = useRef(null)
  const formRef = useRef(null)
  const toastTimeout = useRef(null)
  const notifRef = useRef(null)
  const exportRef = useRef(null)
  const html5QrCodeRef = useRef(null)
  const idleTimerRef = useRef(null)
  const headerMenuRef = useRef(null)
  const pubChemAbortRef = useRef(0) // increments to cancel stale auto-lookups

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

  // Sync theme across tabs / Landing / Login
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'theme' && (e.newValue === 'dark' || e.newValue === 'light')) {
        setTheme(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Apply theme / notification prefs stored on the user account
  useEffect(() => {
    if (!session?.user) return
    const meta = session.user.user_metadata || {}
    if (typeof applyUserPreferences === 'function') {
      applyUserPreferences(meta)
    } else {
      if (meta.theme === 'dark' || meta.theme === 'light') setTheme(meta.theme)
      if (meta.notifications_enabled !== undefined) {
        setNotificationsEnabled(Boolean(meta.notifications_enabled))
      }
    }
  }, [session?.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode)
  }, [viewMode])

  /* ======================================================================== */
  /* AUTH                                                                     */
  /* ======================================================================== */

  // Invite links: always land on Login (org-branded), not inventory.
  // If someone is already signed in, sign them out so the invitee can sign in.
  useEffect(() => {
    let cancelled = false
    try {
      const params = new URLSearchParams(window.location.search)
      const inviteTok = params.get('token') || params.get('invite')
      if (!inviteTok) return undefined

      setShowLogin(true)
      try {
        localStorage.setItem('pendingInviteToken', inviteTok)
        const orgName = params.get('orgName') || params.get('org_name') || ''
        const org = params.get('org') || params.get('slug') || ''
        if (orgName || org) {
          localStorage.setItem(
            'workspaceIntent',
            JSON.stringify({
              type: 'organization',
              organizationName: orgName || org,
              organizationSlug: org,
              inviteToken: inviteTok,
              at: Date.now(),
            })
          )
        }
      } catch {
        /* ignore */
      }

      ;(async () => {
        try {
          const { data } = await supabase.auth.getSession()
          if (cancelled) return
          if (data?.session) {
            await supabase.auth.signOut()
            if (!cancelled) setSession(null)
          }
        } catch (e) {
          console.warn('Invite link sign-out:', e)
        }
      })()
    } catch {
      // ignore
    }
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    // Password-reset links include type=recovery (hash or query)
    let isRecoveryLink = false
    try {
      const hash = window.location.hash || ''
      const search = window.location.search || ''
      isRecoveryLink =
        hash.includes('type=recovery') ||
        search.includes('type=recovery') ||
        sessionStorage.getItem('authRecovery') === '1'
    } catch { /* ignore */ }

    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      if (!isMounted) return
      if (isRecoveryLink && nextSession) {
        try {
          sessionStorage.setItem('authRecovery', '1')
        } catch { /* ignore */ }
        setSession(null)
        setShowLogin(true)
        setLoadingAuth(false)
        return
      }
      setSession(nextSession)
      setLoadingAuth(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return
      // Supabase recovery link establishes a session — do NOT open inventory yet
      if (event === 'PASSWORD_RECOVERY') {
        try {
          sessionStorage.setItem('authRecovery', '1')
        } catch { /* ignore */ }
        setSession(null) // keep user on Login until password is updated
        setShowLogin(true)
        return
      }
      setSession(nextSession)
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



  const openProfileModal = () => {
    const meta = session?.user?.user_metadata || {}
    setProfileName(
      meta.full_name || meta.name || session?.user?.email?.split('@')[0] || ''
    )
    setProfileAvatar(meta.avatar_url || meta.picture || '')
    setProfileNewPassword('')
    setProfileConfirmPassword('')
    setProfileMsg(null)
    setProfilePrefs({
      notifications_enabled:
        meta.notifications_enabled !== undefined
          ? Boolean(meta.notifications_enabled)
          : localStorage.getItem('notificationsEnabled') !== 'false',
      notify_expiry: meta.notify_expiry !== false,
      notify_low_stock: meta.notify_low_stock !== false,
      notify_usage: meta.notify_usage !== false,
      theme: meta.theme === 'dark' || meta.theme === 'light' ? meta.theme : theme,
      default_workspace:
        meta.default_workspace ||
        localStorage.getItem('defaultWorkspace') ||
        'last',
    })
    setShowProfileModal(true)
    fetchOrganizations()
  }

  const resizeImageFile = (file, maxSize = 128) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
          canvas.width = Math.max(1, Math.round(img.width * scale))
          canvas.height = Math.max(1, Math.round(img.height * scale))
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.85))
        }
        img.onerror = () => reject(new Error('Could not read image'))
        img.src = reader.result
      }
      reader.onerror = () => reject(new Error('Could not read file'))
      reader.readAsDataURL(file)
    })

  const handleProfileAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setProfileMsg({ type: 'error', text: 'Please choose an image file' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileMsg({ type: 'error', text: 'Image must be under 5 MB' })
      return
    }
    try {
      const dataUrl = await resizeImageFile(file, 128)
      setProfileAvatar(dataUrl)
      setProfileMsg({ type: 'success', text: 'Photo ready — click Save profile' })
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Could not process image' })
    }
  }

  const applyUserPreferences = (meta = {}) => {
    if (meta.theme === 'dark' || meta.theme === 'light') {
      setTheme(meta.theme)
      try {
        localStorage.setItem('theme', meta.theme)
      } catch { /* ignore */ }
    }
    if (meta.notifications_enabled !== undefined) {
      const on = Boolean(meta.notifications_enabled)
      setNotificationsEnabled(on)
      try {
        localStorage.setItem('notificationsEnabled', String(on))
      } catch { /* ignore */ }
    }
    if (meta.default_workspace) {
      try {
        localStorage.setItem('defaultWorkspace', String(meta.default_workspace))
      } catch { /* ignore */ }
    }
  }

  const handleSaveProfile = async (e) => {
    e?.preventDefault?.()
    if (!session?.user) return
    setProfileSaving(true)
    setProfileMsg(null)
    try {
      const name = profileName.trim()
      if (name && name.length < 2) {
        throw new Error('Name must be at least 2 characters')
      }
      const prefs = { ...profilePrefs }
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: name || undefined,
          name: name || undefined,
          avatar_url: profileAvatar || undefined,
          theme: prefs.theme,
          notifications_enabled: prefs.notifications_enabled,
          notify_expiry: prefs.notify_expiry,
          notify_low_stock: prefs.notify_low_stock,
          notify_usage: prefs.notify_usage,
          default_workspace: prefs.default_workspace,
        },
      })
      if (error) throw error

      applyUserPreferences({
        theme: prefs.theme,
        notifications_enabled: prefs.notifications_enabled,
        default_workspace: prefs.default_workspace,
      })

      if (data?.user) {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                user: {
                  ...prev.user,
                  ...data.user,
                  user_metadata: {
                    ...(prev.user?.user_metadata || {}),
                    ...(data.user.user_metadata || {}),
                  },
                },
              }
            : prev
        )
      }
      setProfileMsg({ type: 'success', text: 'Profile & preferences saved' })
      showMessage('success', 'Profile updated')
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Could not update profile' })
    } finally {
      setProfileSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e?.preventDefault?.()
    if (!session?.user) return
    if (!profileNewPassword || profileNewPassword.length < 6) {
      setProfileMsg({ type: 'error', text: 'New password must be at least 6 characters' })
      return
    }
    if (profileNewPassword !== profileConfirmPassword) {
      setProfileMsg({ type: 'error', text: 'Passwords do not match' })
      return
    }
    setProfileSaving(true)
    setProfileMsg(null)
    try {
      const { error } = await supabase.auth.updateUser({
        password: profileNewPassword,
      })
      if (error) throw error
      setProfileNewPassword('')
      setProfileConfirmPassword('')
      setProfileMsg({
        type: 'success',
        text: 'Password changed. Use the new password next time you sign in.',
      })
      showMessage('success', 'Password changed successfully')
    } catch (err) {
      setProfileMsg({
        type: 'error',
        text:
          err.message ||
          'Could not change password. If you signed in with a temporary invite password, try again or use Forgot password on the login screen.',
      })
    } finally {
      setProfileSaving(false)
    }
  }

  const handleSignOutAllDevices = async () => {
    if (
      !window.confirm(
        'Sign out of this browser and all other devices? You will need to sign in again everywhere.'
      )
    ) {
      return
    }
    setProfileSaving(true)
    setProfileMsg(null)
    try {
      // Global scope invalidates refresh tokens on other devices (Supabase Auth)
      const { error } = await supabase.auth.signOut({ scope: 'global' })
      if (error) throw error
      setShowProfileModal(false)
      setSession(null)
      setChemicals([])
      setTransactions([])
      setOrganizations([])
      setActiveOrgId(null)
      showMessage('success', 'Signed out of all devices')
    } catch (err) {
      // Fallback: local sign-out if global is not supported
      try {
        await supabase.auth.signOut()
        setSession(null)
        setShowProfileModal(false)
        showMessage('success', 'Signed out on this device')
      } catch (e2) {
        setProfileMsg({
          type: 'error',
          text: err.message || e2.message || 'Could not sign out',
        })
      }
    } finally {
      setProfileSaving(false)
    }
  }

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
      setOrganizations([])
      setActiveOrgId(null)
      setActiveOrgName('')
      setActiveOrgRole(null)
      setAccountMode('personal')
      try {
        localStorage.removeItem('accountMode')
        localStorage.removeItem('workspaceIntent')
        localStorage.removeItem('workspace')
        localStorage.removeItem('pendingInviteToken')
      } catch {
        // ignore
      }
    } catch (error) {
      console.error('Logout error:', error)
      showMessage('error', 'Failed to log out properly')
    }
  }

  const getAccessToken = useCallback(async (opts = {}) => {
    const forceRefresh = Boolean(opts.forceRefresh)
    const tokenExpiresSoon = (accessToken, skewSec = 120) => {
      if (!accessToken) return true
      try {
        const part = accessToken.split('.')[1]
        if (!part) return true
        const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
        const payload = JSON.parse(atob(b64))
        if (!payload.exp) return true
        return payload.exp * 1000 < Date.now() + skewSec * 1000
      } catch {
        return true
      }
    }

    try {
      const { data: { session: current } } = await supabase.auth.getSession()
      let sess = current
      if (
        forceRefresh ||
        !sess?.access_token ||
        tokenExpiresSoon(sess.access_token)
      ) {
        const { data, error } = await supabase.auth.refreshSession()
        if (!error && data?.session) {
          sess = data.session
          // Keep React session state in sync when we refreshed
          if (data.session) setSession(data.session)
        } else if (error) {
          console.warn('refreshSession:', error.message || error)
        }
      }
      return sess?.access_token || null
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


  // Org members land on Collection (not full admin inventory workflows)
  useEffect(() => {
    const role = String(activeOrgRole || '').toLowerCase()
    if (
      workspaceMode === 'organization' &&
      role !== 'admin' &&
      role !== 'owner'
    ) {
      setMainView((v) => (v === 'dashboard' ? 'collection' : v))
    }
  }, [workspaceMode, activeOrgRole])

  // Accept organization invite from URL token OR pendingInviteToken (from Login)
  useEffect(() => {
    if (!session) return

    const params = new URLSearchParams(window.location.search)
    const urlToken = (params.get('token') || '').trim()
    let storedToken = ''
    try {
      storedToken = (localStorage.getItem('pendingInviteToken') || '').trim()
    } catch {
      storedToken = ''
    }

    const token = urlToken || storedToken
    if (!token) return

    let cancelled = false

    ;(async () => {
      try {
        const access = await getAccessToken()
        if (!access || cancelled) return

        const res = await fetch(`${API_URL}/invites/accept`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${access}`,
          },
          body: JSON.stringify({ token }),
        })

        if (!res.ok) {
          const text = await res.text().catch(() => '')
          console.warn('Accept invite failed', res.status, text)
          return
        }

        const org = await res.json()
        if (cancelled) return

        try {
          localStorage.removeItem('pendingInviteToken')
        } catch {
          // ignore
        }

        await fetchOrganizations()
        switchWorkspace({
          mode: 'organization',
          organization_id: org.id || org.organization_id,
          name: org.name,
          role: org.role,
        })
        setAccountMode('organization')
        localStorage.setItem('accountMode', 'organization')
        showMessage('success', `Joined ${org.name || 'organization'}`)
        window.history.replaceState({}, '', window.location.pathname)
      } catch (err) {
        console.warn('Accept invite failed', err)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  // NOTE: Do NOT call fetchChemicals / fetchOrganizations here in dependency
  // arrays before those functions are declared (TDZ → "Cannot access before
  // initialization" in production). Data loading runs in the API-layer effects below.

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

  const checkAndNotify = useCallback(
    (chemicalList) => {
      if (!notificationsEnabled || !Array.isArray(chemicalList) || chemicalList.length === 0) {
        return
      }

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

        // Peroxide-forming solvents / organic peroxides — test/date awareness
        const classes = getEffectiveClasses(chemical)
        const isPeroxideFormer =
          classes.includes('peroxide_former') || classes.includes('organic_peroxide')
        if (isPeroxideFormer && !chemical.archived) {
          const opened = chemical.date_opened || chemical.opened_at || null
          const expiry = chemical.expiry_date
          let msg =
            `"${chemical.name}" is a peroxide-forming / peroxide class chemical. ` +
            'Confirm testing schedule and isolation from oxidizers/acids.'
          if (expiry) {
            const d = daysUntil(expiry)
            if (d !== null && d <= 90) {
              msg =
                `"${chemical.name}" (peroxide-related) expires/test window in ${d} day(s). ` +
                'Follow your lab peroxide-testing SOP.'
            }
          } else if (opened) {
            msg =
              `"${chemical.name}" was opened (${opened}). ` +
              'Peroxide formers need periodic testing after opening.'
          }
          newlyCreated.push(
            createNotification(
              'peroxide',
              'Peroxide vigilance',
              msg,
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
              // ignore
            }
          })
        }

        return [...uniqueNew, ...previous].slice(0, MAX_NOTIFICATIONS)
      })
    },
    [notificationsEnabled]
  )

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
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showMessage('error', 'This browser does not support notifications')
      return
    }

    if (!window.isSecureContext) {
      showMessage(
        'error',
        'Browser notifications require HTTPS or localhost. Open the app via https:// or http://localhost'
      )
      return
    }

    try {
      if (Notification.permission === 'granted') {
        setNotifPermission('granted')
        setNotificationsEnabled(true)
        localStorage.setItem('notificationsEnabled', 'true')
        showMessage('success', 'Browser notifications are already enabled')
        checkAndNotify(chemicals)
        return
      }

      if (Notification.permission === 'denied') {
        setNotifPermission('denied')
        showMessage(
          'error',
          'Notifications are blocked. Use the lock icon in the address bar → Notifications → Allow, then reload.'
        )
        return
      }

      const permission = await Notification.requestPermission()
      setNotifPermission(permission)

      if (permission === 'granted') {
        setNotificationsEnabled(true)
        localStorage.setItem('notificationsEnabled', 'true')
        showMessage('success', 'Browser notifications enabled')
        checkAndNotify(chemicals)
        try {
          new Notification('Chemical Inventory', {
            body: 'Notifications are working.',
            tag: 'chem-inv-test',
          })
        } catch {
          // ignore
        }
      } else {
        showMessage('error', 'Notification permission was not granted')
      }
    } catch (err) {
      console.error(err)
      showMessage('error', 'Could not request notification permission')
    }
  }

  const toggleNotifications = () => {
    const nextValue = !notificationsEnabled
    setNotificationsEnabled(nextValue)
    localStorage.setItem('notificationsEnabled', String(nextValue))

    if (nextValue) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        checkAndNotify(chemicals)
      } else if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        requestNotificationPermission()
      } else if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        showMessage(
          'error',
          'In-app alerts are on, but browser popups are blocked. Allow notifications in site settings to get desktop alerts.'
        )
      }
    } else {
      showMessage('success', 'Notifications disabled')
    }
  }

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const clearAllNotifications = () => {
    setNotifications([])
  }

  const markNotificationRead = (id) => {
    setNotifications((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x)))
  }

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  )

  /* ======================================================================== */
  /* API LAYER                                                                */
  /* ======================================================================== */

  const fetchChemicals = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      const token = await getAccessToken()
      if (!token) throw new Error('No access token available')
      const params = new URLSearchParams()
      if (activeOrgId) params.set('organization_id', activeOrgId)
      if (showArchived) params.set('include_archived', 'true')
      const qs = params.toString()
      const chemicalsUrl = `${API_URL}/chemicals${qs ? `?${qs}` : ''}`
      const response = await fetch(chemicalsUrl, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.status === 401) {
        console.warn('chemicals 401 — session invalid')
        return
      }
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
  }, [API_URL, getAccessToken, showMessage, activeOrgId, showArchived])

  const fetchOrgMembers = useCallback(async (organizationId) => {
    if (!organizationId) {
      setOrgMembers([])
      return
    }
    try {
      const token = await getAccessToken()
      const res = await fetch(`${API_URL}/organizations/${organizationId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        console.warn('fetchOrgMembers status', res.status)
        return
      }
      const data = await res.json()
      // Support array or { members: [...] } / { data: [...] }
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.members)
          ? data.members
          : Array.isArray(data?.data)
            ? data.data
            : []
      setOrgMembers(list)
    } catch (err) {
      console.warn('fetchOrgMembers error:', err)
    }
  }, [API_URL, getAccessToken])

  const fetchOrgInvites = useCallback(async (organizationId) => {
    if (!organizationId) {
      setOrgInvites([])
      return
    }
    try {
      const token = await getAccessToken()
      const res = await fetch(`${API_URL}/organizations/${organizationId}/invites`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        console.warn('fetchOrgInvites status', res.status)
        return
      }
      const data = await res.json()
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.invites)
          ? data.invites
          : Array.isArray(data?.data)
            ? data.data
            : []
      setOrgInvites(list)
    } catch (err) {
      console.warn('fetchOrgInvites error:', err)
    }
  }, [API_URL, getAccessToken])

  const fetchAuditEvents = useCallback(async () => {
    try {
      const token = await getAccessToken()
      if (!token) return
      const params = new URLSearchParams()
      if (activeOrgId) params.set('organization_id', activeOrgId)
      params.set('limit', '200')
      const res = await fetch(`${API_URL}/audit?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('audit fetch failed')
      const data = await res.json()
      const rows = (Array.isArray(data) ? data : []).map((ev) => ({
        ...ev,
        at: ev.at || ev.created_at,
      }))
      setAuditEvents(rows)
    } catch (e) {
      console.warn('GET /audit failed, using local log', e)
      setAuditEvents(loadJsonStorage(AUDIT_STORAGE_KEY, []))
    }
  }, [API_URL, getAccessToken, activeOrgId])

  const fetchWasteLog = useCallback(async () => {
    try {
      const token = await getAccessToken()
      if (!token) return
      const params = new URLSearchParams()
      if (activeOrgId) params.set('organization_id', activeOrgId)
      const res = await fetch(`${API_URL}/waste?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('waste fetch failed')
      const data = await res.json()
      setWasteLog(Array.isArray(data) ? data : [])
    } catch (e) {
      console.warn('GET /waste failed, using local', e)
      setWasteLog(loadJsonStorage(WASTE_STORAGE_KEY, []))
    }
  }, [API_URL, getAccessToken, activeOrgId])

  const pushAudit = useCallback((action, detail = {}) => {
    const row = appendAuditEvent({
      action,
      user_id: session?.user?.id || null,
      user_email: session?.user?.email || null,
      organization_id: activeOrgId || null,
      workspace: workspaceMode,
      ...detail,
    })
    setAuditEvents((prev) => [row, ...prev].slice(0, MAX_AUDIT_EVENTS))
    return row
  }, [session, activeOrgId, workspaceMode])

  const copyInviteLink = async (inviteToken, orgMeta = {}) => {
    if (!inviteToken) {
      showMessage('error', 'No invite token available')
      return
    }
    const params = new URLSearchParams()
    params.set('token', inviteToken)
    const name = orgMeta.name || activeOrgName || ''
    const slug = orgMeta.slug || orgMeta.id || activeOrgId || ''
    if (name) params.set('orgName', name)
    if (slug) params.set('org', String(slug))
    const link = `${window.location.origin}/?${params.toString()}`
    setLastInviteLink(link)
    try {
      await navigator.clipboard.writeText(link)
      showMessage('success', 'Invite link copied — send it to the member')
    } catch {
      showMessage('success', `Invite link: ${link}`)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteAccountConfirm !== 'DELETE') {
      showMessage('error', 'Type DELETE to confirm account deletion')
      return
    }
    setDeleteAccountLoading(true)
    try {
      const token = await getAccessToken()
      let permanentlyDeleted = false
      // Prefer backend endpoint if present (must call auth.admin.deleteUser server-side)
      if (API_URL && token) {
        try {
          const res = await fetch(`${API_URL}/account`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            permanentlyDeleted = true
          } else if (res.status !== 404) {
            const err = await res.json().catch(() => ({}))
            console.warn('DELETE /account:', err)
          }
        } catch (e) {
          console.warn('Account API not available:', e)
        }
      }
      pushAudit('account_delete_requested', { email: session?.user?.email })
      // Clear local app data for this browser
      try {
        localStorage.removeItem(AUDIT_STORAGE_KEY)
        localStorage.removeItem(CHEM_META_STORAGE_KEY)
        localStorage.removeItem(WASTE_STORAGE_KEY)
        localStorage.removeItem('workspaceIntent')
        localStorage.removeItem('accountMode')
        localStorage.removeItem('workspace')
        localStorage.removeItem('pendingInviteToken')
      } catch {
        /* ignore */
      }
      await supabase.auth.signOut()
      setSession(null)
      setShowDeleteAccount(false)
      showMessage(
        'success',
        permanentlyDeleted
          ? 'Account permanently deleted. You can no longer sign in with this email.'
          : 'Signed out and local data cleared. Permanent deletion requires a server DELETE /account that calls auth.admin.deleteUser — until then you can still sign in with the same credentials.'
      )
    } catch (err) {
      showMessage('error', err.message || 'Could not complete account deletion flow')
    } finally {
      setDeleteAccountLoading(false)
    }
  }

  const handleArchiveChemical = async (chemical) => {
    if (!chemical?.id) return
    try {
      const token = await getAccessToken()
      const res = await fetch(`${API_URL}/chemicals/${chemical.id}/archive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Archive failed')
      const updated = await res.json().catch(() => null)
      if (updated?.id) {
        setChemicals((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))
      } else {
        fetchChemicals(true)
      }
      showMessage('success', `"${chemical.name}" archived (history kept)`)
    } catch (e) {
      console.warn(e)
      setChemMeta(chemical.id, { archived: true })
      setChemicals((prev) => [...prev])
      showMessage('error', 'Archived locally — server archive failed')
    }
  }

  const handleUnarchiveChemical = async (chemical) => {
    if (!chemical?.id) return
    try {
      const token = await getAccessToken()
      const res = await fetch(`${API_URL}/chemicals/${chemical.id}/unarchive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Unarchive failed')
      const updated = await res.json().catch(() => null)
      if (updated?.id) {
        setChemicals((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))
      } else {
        fetchChemicals(true)
      }
      showMessage('success', `"${chemical.name}" restored`)
    } catch (e) {
      setChemMeta(chemical.id, { archived: false })
      setChemicals((prev) => [...prev])
      showMessage('error', 'Restored locally — server unarchive failed')
    }
  }

  const handleMarkSdsReviewed = async (chemical) => {
    if (!chemical?.id) return
    try {
      const token = await getAccessToken()
      const res = await fetch(
        `${API_URL}/chemicals/${chemical.id}/sds-reviewed?months=${SDS_REVIEW_DEFAULT_MONTHS}`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error('SDS review failed')
      const updated = await res.json().catch(() => null)
      if (updated?.id) {
        setChemicals((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))
      } else {
        fetchChemicals(true)
      }
      showMessage('success', `SDS marked reviewed for ${chemical.name}`)
    } catch (e) {
      const today = new Date().toISOString().slice(0, 10)
      setChemMeta(chemical.id, {
        sds_reviewed_at: today,
        sds_review_months: SDS_REVIEW_DEFAULT_MONTHS,
      })
      setChemicals((prev) => [...prev])
      showMessage('error', 'Saved SDS review locally — server call failed')
    }
  }

  const handleLogWaste = async () => {
    const chem = chemicals.find((c) => String(c.id) === String(wasteForm.chemical_id))
    if (!chem) {
      showMessage('error', 'Select a chemical')
      return
    }
    const qty = parseFloat(wasteForm.quantity)
    if (!(qty > 0)) {
      showMessage('error', 'Enter a waste quantity')
      return
    }
    try {
      const token = await getAccessToken()
      const res = await fetch(`${API_URL}/waste`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chemical_id: chem.id,
          chemical_name: chem.name,
          quantity: qty,
          unit: wasteForm.unit || chem.unit || 'g',
          reason: wasteForm.reason || 'disposal',
          notes: wasteForm.notes || '',
          organization_id: activeOrgId || null,
        }),
      })
      if (!res.ok) throw new Error('waste post failed')
      await fetchWasteLog()
      setShowWasteModal(false)
      setWasteForm({ chemical_id: '', quantity: '', unit: 'g', reason: '', notes: '' })
      showMessage('success', 'Waste/disposal entry recorded')
    } catch (e) {
      const entry = {
        id: `waste-${Date.now()}`,
        at: new Date().toISOString(),
        chemical_id: chem.id,
        chemical_name: chem.name,
        quantity: qty,
        unit: wasteForm.unit || chem.unit || 'g',
        reason: wasteForm.reason || 'disposal',
        notes: wasteForm.notes || '',
        user_email: session?.user?.email || '',
        organization_id: activeOrgId || null,
      }
      const next = [entry, ...wasteLog].slice(0, 300)
      setWasteLog(next)
      saveJsonStorage(WASTE_STORAGE_KEY, next)
      setShowWasteModal(false)
      setWasteForm({ chemical_id: '', quantity: '', unit: 'g', reason: '', notes: '' })
      showMessage('error', 'Saved waste locally — server call failed')
    }
  }

  const handleInviteMember = async () => {
    if (!activeOrgId) {
      showMessage('error', 'Select an organization first')
      return
    }
    const email = inviteEmail.trim().toLowerCase()
    const name = inviteFullName.trim()
    if (!name || name.length < 2) {
      showMessage('error', 'Enter the invitee full name')
      return
    }
    if (!email || !email.includes('@')) {
      showMessage('error', 'Enter a valid email')
      return
    }

    setInviteLoading(true)
    try {
      const token = await getAccessToken()
      const res = await fetch(`${API_URL}/organizations/${activeOrgId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          role: inviteRole || 'member',
          full_name: inviteFullName.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const detail = err.detail
        throw new Error(
          typeof detail === 'string'
            ? detail
            : Array.isArray(detail)
              ? detail.map((d) => d.msg || JSON.stringify(d)).join('; ')
              : 'Invite failed'
        )
      }
      const invite = await res.json()
      const inviteToken = invite.token
      const inviteLink = invite.invite_link
      pushAudit('invite_create', {
        email,
        role: inviteRole || 'member',
        invite_id: invite.id,
      })
      if (inviteToken) {
        await copyInviteLink(inviteToken, {
          name: activeOrgName,
          slug: activeOrgId,
          id: activeOrgId,
        })
      } else if (inviteLink) {
        setLastInviteLink(inviteLink)
        try {
          await navigator.clipboard?.writeText(inviteLink)
        } catch { /* ignore */ }
      }

      setLastInviteEmail(email)
      setLastInvitePassword(
        invite.email_sent ? '' : (invite.temp_password_dev || '')
      )

      if (invite.email_sent) {
        showMessage(
          'success',
          `Invite emailed to ${email} with sign-in details. Link also copied.`
        )
      } else if (inviteToken || inviteLink) {
        showMessage(
          'success',
          `Invite created for ${email}. Share the link and password shown below.` +
            (invite.email_error
              ? ` (Email: ${String(invite.email_error).slice(0, 80)})`
              : '')
        )
      } else {
        showMessage(
          'success',
          `Invite created for ${email}. Open pending invites to copy the link.`
        )
      }
      setInviteEmail('')
      setInviteFullName('')
      setInviteRole('member')
      await fetchOrgInvites(activeOrgId)
    } catch (err) {
      showMessage('error', err.message || 'Could not create invite')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleRevokeInvite = async (inviteId) => {
    if (!activeOrgId) return
    try {
      const token = await getAccessToken()
      const res = await fetch(
        `${API_URL}/organizations/${activeOrgId}/invites/${inviteId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      if (!res.ok) throw new Error('Could not revoke invite')
      showMessage('success', 'Invite revoked')
      await fetchOrgInvites(activeOrgId)
    } catch (err) {
      showMessage('error', err.message || 'Could not revoke invite')
    }
  }

  const handleRemoveMember = async (memberUserId, memberLabel) => {
    if (!activeOrgId || !memberUserId) return
    if (!canInviteMembers) {
      showMessage('error', 'Only owners and admins can remove members')
      return
    }
    const who = memberLabel || memberUserId
    if (
      !window.confirm(
        `Remove ${who} from this organization? They will lose access to the shared inventory.`
      )
    ) {
      return
    }
    try {
      const token = await getAccessToken()
      const res = await fetch(
        `${API_URL}/organizations/${activeOrgId}/members/${encodeURIComponent(memberUserId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      if (!res.ok) {
        let detail = 'Could not remove member'
        try {
          const body = await res.json()
          if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
        } catch { /* ignore */ }
        throw new Error(detail)
      }
      showMessage('success', `Removed ${who} from the organization`)
      await fetchOrgMembers(activeOrgId)
    } catch (err) {
      showMessage('error', err.message || 'Could not remove member')
    }
  }

  const handleAcceptInvite = async (tokenValue) => {
    const clean = (tokenValue || '').trim()
    if (!clean) {
      showMessage('error', 'Invite token is required')
      return
    }
    try {
      const token = await getAccessToken()
      const res = await fetch(`${API_URL}/invites/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token: clean }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Could not accept invite')
      }
      const org = await res.json()
      showMessage('success', `Joined ${org.name}`)
      await fetchOrganizations?.()
      if (org?.id) {
        setActiveOrgId?.(org.id)
        setActiveOrgName?.(org.name)
        setWorkspaceMode?.('organization')
      }
    } catch (err) {
      showMessage('error', err.message || 'Could not accept invite')
    }
  }

  /**
   * Single source of truth for workspace switching.
   * Keeps personal accounts working and syncs org state used by API calls.
   */
  const switchWorkspace = (next) => {
    const normalized = next || { mode: 'personal', organization_id: null }
    setWorkspace(normalized)
    localStorage.setItem('workspace', JSON.stringify(normalized))

    if (normalized.mode === 'organization' && normalized.organization_id) {
      setWorkspaceMode('organization')
      setActiveOrgId(normalized.organization_id)
      const match = organizations.find(
        (o) => String(o.id) === String(normalized.organization_id)
      )
      setActiveOrgName(match?.name || normalized.name || '')
      setActiveOrgRole(match?.role || normalized.role || null)
    } else {
      setWorkspaceMode('personal')
      setActiveOrgId(null)
      setActiveOrgName('')
      setActiveOrgRole(null)
    }
  }

  // Load members & invites when in an organization workspace
  useEffect(() => {
    if (!session || workspaceMode !== 'organization' || !activeOrgId) {
      setOrgMembers([])
      setOrgInvites([])
      return
    }
    fetchOrgMembers(activeOrgId)
    fetchOrgInvites(activeOrgId)
  }, [session, workspaceMode, activeOrgId, fetchOrgMembers, fetchOrgInvites])

  const switchToPersonal = () => {

    switchWorkspace({ mode: 'personal', organization_id: null })
  }

  const switchToOrganization = (org) => {
    if (!org?.id) return
    switchWorkspace({
      mode: 'organization',
      organization_id: org.id,
      name: org.name,
      role: org.role || null,
    })
  }

  const handleCreateOrganization = async () => {
    const name = newOrgName.trim()
    if (name.length < 2) {
      showMessage?.('error', 'Organization name must be at least 2 characters')
      return
    }
    setOrgLoading(true)
    try {
      // Force a fresh access token — stale JWT causes "Invalid or expired token"
      const token = await getAccessToken({ forceRefresh: true })
      if (!token) {
        throw new Error('Not signed in. Please sign out and sign in again, then retry.')
      }
      if (!API_URL) {
        throw new Error('API URL is not configured (VITE_API_URL).')
      }
      const res = await fetch(`${API_URL}/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        let detail = `Failed to create organization (${res.status})`
        try {
          const errBody = await res.json()
          if (errBody?.detail) {
            detail =
              typeof errBody.detail === 'string'
                ? errBody.detail
                : JSON.stringify(errBody.detail)
          }
        } catch {
          /* ignore parse errors */
        }
        throw new Error(detail)
      }
      const org = await res.json()
      const refreshed = await fetchOrganizations()
      const list = Array.isArray(refreshed) ? refreshed : []
      const matched =
        list.find((o) => String(o.id) === String(org.id)) || org
      switchToOrganization(matched)
      setAccountMode('organization')
      try {
        localStorage.setItem('accountMode', 'organization')
      } catch {
        /* ignore */
      }
      setShowCreateOrg(false)
      setNewOrgName('')
      showMessage?.('success', `Organization “${org.name || name}” created`)
    } catch (err) {
      console.error('Create organization error:', err)
      showMessage?.('error', err.message || 'Could not create organization')
    } finally {
      setOrgLoading(false)
    }
  }

  const fetchOrganizations = useCallback(async () => {
    try {
      const token = await getAccessToken()
      if (!token) return
      const res = await fetch(`${API_URL}/organizations`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        console.warn('organizations 401 — session invalid')
        return
      }
      if (!res.ok) return
      const data = await res.json()
      setOrganizations(Array.isArray(data) ? data : [])
      return Array.isArray(data) ? data : []
    } catch (err) {
      console.warn('Could not load organizations', err)
      return []
    }
  }, [API_URL, getAccessToken])


  // After orgs load, open default organization workspace if preferred
  useEffect(() => {
    if (!session?.user?.id) return
    const meta = session.user.user_metadata || {}
    const def =
      meta.default_workspace || localStorage.getItem('defaultWorkspace') || 'last'
    if (def === 'personal' || def === 'last' || !def) return
    if (workspaceMode === 'organization' && String(activeOrgId) === String(def)) return
    const match = (organizations || []).find((o) => String(o.id) === String(def))
    if (match) switchToOrganization(match)
  }, [session?.user?.id, organizations]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTransactions = useCallback(async () => {
    try {
      const token = await getAccessToken()
      if (!token) return
      const params = new URLSearchParams()
      if (workspaceMode === 'organization' && activeOrgId) {
        params.set('organization_id', activeOrgId)
      }
      const qs = params.toString()
      const response = await fetch(`${API_URL}/transactions${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.status === 401) {
        console.warn('transactions 401 — session invalid')
        return
      }
      if (!response.ok) {
        console.warn('Could not load transactions:', response.status)
        return
      }
      const data = await response.json()
      const list = Array.isArray(data) ? data : []
      setTransactions(list)

      // Admins/owners: notify about other members' usage
      if (
        workspaceMode === 'organization' &&
        activeOrgId &&
        (activeOrgRole === 'owner' || activeOrgRole === 'admin')
      ) {
        const myId = session?.user?.id
        const seenKey = `usageNotifSeen:${activeOrgId}`
        let seen = {}
        try {
          seen = JSON.parse(localStorage.getItem(seenKey) || '{}') || {}
        } catch {
          seen = {}
        }
        const fresh = []
        for (const t of list) {
          if (!t?.id) continue
          if (myId && String(t.user_id) === String(myId)) continue
          if (seen[String(t.id)]) continue
          const who = t.user_email || 'A member'
          const absQty = Math.abs(Number(t.quantity_change) || 0)
          const verb =
            t.type === 'take' ? 'took' : t.type === 'return' ? 'returned' : 'adjusted'
          const depleted =
            t.type === 'take' &&
            t.quantity_after !== undefined &&
            t.quantity_after !== null &&
            Number(t.quantity_after) <= 0
          fresh.push({
            id: `tx-${t.id}`,
            type: depleted ? 'stock' : 'usage',
            title: depleted ? 'Stock depleted' : 'Usage logged',
            message: depleted
              ? `${who} used the last of ${t.chemical_name} (${absQty} ${t.unit || ''})`.trim()
              : `${who} ${verb} ${absQty} ${t.unit || ''} of ${t.chemical_name}`.trim(),
            at: t.created_at || new Date().toISOString(),
            createdAt: Date.now(),
            read: false,
          })
          seen[String(t.id)] = true
        }
        if (fresh.length) {
          try {
            localStorage.setItem(seenKey, JSON.stringify(seen))
          } catch { /* ignore */ }
          setNotifications((prev) => [...fresh, ...(prev || [])].slice(0, 100))
        }
      }
    } catch (error) {
      console.warn('Could not load transactions:', error.message)
    }
  }, [
    API_URL,
    getAccessToken,
    workspaceMode,
    activeOrgId,
    activeOrgRole,
    session?.user?.id,
  ])

  // Org-wide usage history + admin notifications (must be after fetchTransactions)
  useEffect(() => {
    if (!session || workspaceMode !== 'organization' || !activeOrgId) return
    fetchTransactions()
  }, [session, workspaceMode, activeOrgId, fetchTransactions])


  useEffect(() => {
    if (session) {
      fetchChemicals()
      fetchTransactions()
      fetchOrganizations()
    }
  }, [session, fetchChemicals, fetchTransactions, fetchOrganizations]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Apply Login Personal / Organization intent once per session.
     First Organization signup auto-creates the org (admin = first login). */
  useEffect(() => {
    if (!session) return

    ;(async () => {
      try {
        let intent = null
        try {
          const raw = localStorage.getItem('workspaceIntent')
          if (raw) intent = JSON.parse(raw)
        } catch {
          intent = null
        }

        const meta = session.user?.user_metadata || {}
        const type =
          intent?.type ||
          meta.account_type ||
          accountMode ||
          'personal'
        const orgName = (
          intent?.organizationName ||
          meta.pending_org_name ||
          ''
        ).trim()

        if (intent) {
          try {
            localStorage.removeItem('workspaceIntent')
          } catch {
            // ignore
          }
        }

        if (type !== 'organization') {
          setAccountMode('personal')
          localStorage.setItem('accountMode', 'personal')
          switchWorkspace({ mode: 'personal', organization_id: null })
          return
        }

        setAccountMode('organization')
        localStorage.setItem('accountMode', 'organization')

        // Invite token has priority (handled by the other effect)
        let pendingToken = ''
        try {
          pendingToken = (localStorage.getItem('pendingInviteToken') || '').trim()
        } catch {
          pendingToken = ''
        }
        if (pendingToken || intent?.inviteToken) {
          // invite effect will switch workspace after accept
          return
        }

        const orgs = (await fetchOrganizations()) || organizations || []
        const list = Array.isArray(orgs) ? orgs : []

        // Match by organization name/slug from Login (org login mode)
        if (orgName) {
          const needle = orgName.toLowerCase()
          const match = list.find((o) => {
            const n = String(o.name || '').toLowerCase()
            const slug = String(o.slug || '').toLowerCase()
            return n === needle || slug === needle || n.includes(needle)
          })
          if (match) {
            switchWorkspace({
              mode: 'organization',
              organization_id: match.id,
              name: match.name,
              role: match.role,
            })
            return
          }
        }

        // If user already belongs to orgs, open first
        if (list.length > 0) {
          switchToOrganization(list[0])
          return
        }

        // No memberships yet — create org if Login provided a name, else open create modal
        if (!orgName || orgName.length < 2) {
          setNewOrgName(orgName || '')
          setShowCreateOrg(true)
          return
        }

        const token = await getAccessToken({ forceRefresh: true })
        if (!token) {
          setNewOrgName(orgName)
          setShowCreateOrg(true)
          showMessage('error', 'Session expired. Please sign in again to create your organization.')
          return
        }

        const createRes = await fetch(`${API_URL}/organizations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: orgName }),
        })

        if (!createRes.ok) {
          let detail = `Could not create organization automatically (${createRes.status})`
          try {
            const errBody = await createRes.json()
            if (errBody?.detail) {
              detail =
                typeof errBody.detail === 'string'
                  ? errBody.detail
                  : JSON.stringify(errBody.detail)
            }
          } catch {
            /* ignore */
          }
          console.warn('Auto-create org failed:', detail)
          setNewOrgName(orgName)
          setShowCreateOrg(true)
          showMessage('error', detail)
          return
        }

        const org = await createRes.json()
        setOrganizations((prev) => {
          const exists = (prev || []).some((o) => String(o.id) === String(org.id))
          return exists ? prev : [org, ...(prev || [])]
        })
        switchToOrganization(org)
        setShowCreateOrg(false)
        showMessage('success', `Organization “${org.name || orgName}” is ready`)
      } catch (err) {
        console.warn('Org setup failed', err)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

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

      const locationJoined = joinLocationPath(formData)
      const barcode =
        formData.barcode.trim() || (!editingId ? generateBarcodeValue() : null)

      // Duplicate detection (same CAS + location)
      const dups = findDuplicateChemicals(chemicals, {
        cas_number: formData.cas_number,
        location: locationJoined,
        excludeId: editingId,
      })
      if (dups.length > 0) {
        const ok = window.confirm(
          `Possible duplicate: ${dups.length} chemical(s) already have CAS "${formData.cas_number.trim()}" at "${locationJoined || 'Unassigned'}".\n\nContinue saving as a new container/bottle?`
        )
        if (!ok) {
          setSubmitting(false)
          return
        }
      }

      const payload = {
        name: formData.name.trim(),
        cas_number: formData.cas_number.trim() || null,
        quantity: parseFloat(formData.quantity) || 0,
        unit: formData.unit || 'g',
        location: locationJoined || null,
        expiry_date: formData.expiry_date || null,
        min_stock: parseFloat(formData.min_stock) || 0,
        hazard_notes: formData.hazard_notes.trim() || null,
        molecular_formula: formData.molecular_formula.trim() || null,
        hazard_symbols: formData.hazard_symbols?.length ? formData.hazard_symbols : null,
        batch_lot: formData.batch_lot.trim() || null,
        supplier: formData.supplier.trim() || null,
        chemical_classes: formData.chemical_classes?.length
          ? formData.chemical_classes
          : null,
        barcode: barcode || null,
        organization_id: workspaceMode === 'organization' ? activeOrgId : null,
      }

      const url = editingId
        ? `${API_URL}/chemicals/${editingId}`
        : `${API_URL}/chemicals`
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
      let saved = null
      try {
        saved = await response.json()
      } catch {
        saved = null
      }
      const savedId = saved?.id || editingId
      if (savedId) {
        setChemMeta(savedId, {
          sds_reviewed_at: formData.sds_reviewed_at || undefined,
          sds_review_months: Number(formData.sds_review_months) || SDS_REVIEW_DEFAULT_MONTHS,
          container_code: formData.container_code || undefined,
          lab_unit: formData.lab_unit || activeLabUnit || undefined,
          location_path: locationJoined || undefined,
        })
      }
      pushAudit(editingId ? 'chemical_update' : 'chemical_create', {
        chemical_id: savedId,
        chemical_name: payload.name,
        location: locationJoined,
      })
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
    const choice = window.confirm(
      `Delete "${name}"?\n\nOK = permanent delete\nCancel = stay\n\nTip: use Archive to keep history.`
    )
    if (!choice) return
    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_URL}/chemicals/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Delete failed')
      pushAudit('chemical_delete', { chemical_id: id, chemical_name: name })
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
        organization_id:
          workspaceMode === 'organization' && activeOrgId ? activeOrgId : null,
      }

      try {
        const txRes = await fetch(`${API_URL}/transactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(transactionPayload),
        })
        if (!txRes.ok) {
          console.warn('POST /transactions failed', txRes.status)
        }
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

      // Org usage: audit + in-app notification (admins reviewing the org see these)
      if (workspaceMode === 'organization' && activeOrgId) {
        const who = session?.user?.email || 'A member'
        pushAudit('usage_log', {
          chemical_id: usageChem.id,
          chemical_name: usageChem.name,
          type: usageForm.type,
          quantity: qty,
          unit: usageChem.unit,
          organization_id: activeOrgId,
        })
        setNotifications((prev) =>
          [
            {
              id: `usage-${Date.now()}`,
              type: 'usage',
              title: 'Usage logged',
              message: `${who} ${usageForm.type === 'take' ? 'took' : usageForm.type === 'return' ? 'returned' : 'adjusted'} ${qty} ${usageChem.unit} of ${usageChem.name}`,
              createdAt: Date.now(),
              read: false,
            },
            ...prev,
          ].slice(0, MAX_NOTIFICATIONS)
        )
      }

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

  const csvImportRef = useRef(null)

  const handleImportCSV = async (file) => {
    if (!file) return
    try {
      const text = await file.text()
      const rows = parseChemicalsCSV(text)
      if (!rows.length) {
        showMessage('error', 'No valid chemical rows found. Need a Name column.')
        return
      }
      const token = await getAccessToken()
      if (!token) throw new Error('Not signed in')

      let ok = 0
      let fail = 0
      for (const row of rows) {
        try {
          const body = {
            ...row,
            organization_id: activeOrgId || null,
          }
          const res = await fetch(`${API_URL}/chemicals`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          })
          if (res.ok) ok += 1
          else fail += 1
        } catch {
          fail += 1
        }
      }
      await fetchChemicals(true)
      showMessage(
        fail ? 'error' : 'success',
        `CSV import finished: ${ok} added${fail ? `, ${fail} failed` : ''}`
      )
    } catch (err) {
      console.error('CSV import error:', err)
      showMessage('error', err.message || 'CSV import failed')
    } finally {
      if (csvImportRef.current) csvImportRef.current.value = ''
    }
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

  const inviteToOrg = async (email, role = 'member') => {
    if (!activeOrgId) {
      showMessage('error', 'Switch to an organization workspace first')
      return
    }
    const r = String(activeOrgRole || '').toLowerCase()
    if (r !== 'admin' && r !== 'owner') {
      showMessage('error', 'Only organization admins can invite members')
      return
    }
    try {
      const token = await getAccessToken()
      const res = await fetch(
        `${API_URL}/organizations/${activeOrgId}/invites`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
        }
      )
      if (!res.ok) {
        showMessage('error', 'Invite failed')
        return
      }
      const invite = await res.json()
      showMessage('success', `Invite created for ${email}`)
      if (invite.token) {
        const link = `${window.location.origin}/?token=${invite.token}`
        console.log('Invite link:', link)
        window.prompt('Copy invite link', link)
      }
    } catch (err) {
      showMessage('error', 'Invite failed')
    }
  }

  const handleEdit = (chemical) => {
    const path = splitLocationPath(chemical.location)
    const meta = getChemMeta(chemical.id)
    setFormData({
      ...EMPTY_FORM,
      name: chemical.name || '',
      cas_number: chemical.cas_number || '',
      quantity: chemical.quantity ?? '',
      unit: chemical.unit || 'g',
      location: chemical.location || '',
      loc_building: path.loc_building,
      loc_room: path.loc_room,
      loc_cabinet: path.loc_cabinet,
      loc_shelf: path.loc_shelf,
      expiry_date: chemical.expiry_date || '',
      min_stock: chemical.min_stock ?? '',
      hazard_notes: chemical.hazard_notes || '',
      molecular_formula: chemical.molecular_formula || '',
      hazard_symbols: chemical.hazard_symbols || [],
      batch_lot: chemical.batch_lot || '',
      supplier: chemical.supplier || '',
      chemical_classes: chemical.chemical_classes || [],
      barcode: chemical.barcode || '',
      sds_reviewed_at: meta.sds_reviewed_at || '',
      sds_review_months: String(meta.sds_review_months || SDS_REVIEW_DEFAULT_MONTHS),
      container_code: meta.container_code || '',
      lab_unit: meta.lab_unit || activeLabUnit || '',
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

  /**
   * PubChem auto-enrichment (debounced).
   * When the form is open and the user types a name or CAS number,
   * automatically fill molecular formula (and name if still empty)
   * after a short pause. Never overwrites fields the user already filled.
   */
  useEffect(() => {
    if (!showForm) return

    const name = (formData.name || '').trim()
    const cas = (formData.cas_number || '').trim()
    const query = cas || name

    // Skip if nothing useful to look up, or formula already present
    if (!query || query.length < 3) return
    if ((formData.molecular_formula || '').trim()) return

    const requestId = ++pubChemAbortRef.current
    const timer = setTimeout(async () => {
      // Another keystroke may have cancelled this request
      if (requestId !== pubChemAbortRef.current) return

      setLookingUp(true)
      try {
        const result = await lookupPubChem(query)
        // Stale response — user kept typing
        if (requestId !== pubChemAbortRef.current) return
        if (!result) return

        setFormData((prev) => applyPubChemToForm(prev, result, { force: false }))
        // Soft toast once per successful enrich when CAS or formula was filled
        if (result.cas_number || result.molecular_formula) {
          /* avoid noisy toasts on every keystroke — only when CAS newly available */
        }
      } catch (err) {
        console.warn('PubChem auto-enrich failed:', err)
      } finally {
        if (requestId === pubChemAbortRef.current) {
          setLookingUp(false)
        }
      }
    }, 700) // debounce 700 ms after last keystroke

    return () => {
      clearTimeout(timer)
      // Invalidate in-flight request when deps change
      pubChemAbortRef.current += 1
    }
  }, [formData.name, formData.cas_number, formData.molecular_formula, showForm])

  /** Manual PubChem lookup (button). Overwrites formula; fills name only if empty. */
  const handlePubChemLookup = async () => {
    const query = (formData.cas_number || '').trim() || (formData.name || '').trim()
    if (!query) {
      showMessage('error', 'Enter a chemical name or CAS number first')
      return
    }
    // Cancel any pending auto-lookup
    pubChemAbortRef.current += 1
    setLookingUp(true)
    try {
      const result = await lookupPubChem(query)
      if (!result) {
        showMessage('error', 'No results found on PubChem')
        return
      }
      setFormData((prev) => applyPubChemToForm(prev, result, { force: true }))
      const bits = []
      if (result.cas_number) bits.push(`CAS ${result.cas_number}`)
      if (result.molecular_formula) bits.push(result.molecular_formula)
      if (result.sds_url) bits.push('safety link')
      showMessage(
        'success',
        bits.length
          ? `Auto-filled from PubChem: ${bits.join(' · ')}`
          : 'Data loaded from PubChem'
      )
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
  const toggleCollection = async (chem) => {
    const nextValue = !chem.in_collection
    const userId = session?.user?.id
    const isOrg = workspaceMode === 'organization' && activeOrgId

    // Private per-user collection in org mode (never write shared in_collection)
    if (isOrg && userId) {
      const key = `myCollection:${userId}:${activeOrgId}`
      let ids = []
      try {
        ids = JSON.parse(localStorage.getItem(key) || '[]') || []
      } catch {
        ids = []
      }
      const idStr = String(chem.id)
      if (nextValue) {
        if (!ids.map(String).includes(idStr)) ids.push(chem.id)
      } else {
        ids = ids.filter((x) => String(x) !== idStr)
      }
      try {
        localStorage.setItem(key, JSON.stringify(ids))
      } catch {
        /* ignore */
      }
      setChemicals((prev) =>
        prev.map((c) =>
          c.id === chem.id ? { ...c, in_collection: nextValue } : c
        )
      )
      showMessage(
        'success',
        nextValue
          ? `Added “${chem.name}” to your private collection`
          : `Removed “${chem.name}” from your private collection`
      )
      return
    }

    // Personal workspace: persist on chemical row
    setChemicals((prev) =>
      prev.map((c) =>
        c.id === chem.id ? { ...c, in_collection: nextValue } : c
      )
    )

    try {
      const token = await getAccessToken()
      if (!token) throw new Error('No token')

      // Prefer private UserCollection API when available
      let res = await fetch(`${API_URL}/collections/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ chemical_id: chem.id }),
      })
      if (!res.ok) {
        res = await fetch(`${API_URL}/chemicals/${chem.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ in_collection: nextValue }),
        })
      }

      if (!res.ok) throw new Error('Update failed')

      showMessage(
        'success',
        nextValue
          ? `Added “${chem.name}” to Collection`
          : `Removed “${chem.name}” from Collection`
      )
      fetchChemicals(true)
    } catch (err) {
      setChemicals((prev) =>
        prev.map((c) =>
          c.id === chem.id ? { ...c, in_collection: !nextValue } : c
        )
      )
      showMessage('error', 'Could not update collection')
    }
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
      const archived = Boolean(chemical.archived || getChemMeta(chemical.id).archived)
      if (!showArchived && archived) return false
      if (showArchived && !archived) return false

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
      if (activeLabUnit) {
        const meta = getChemMeta(chemical.id)
        if (meta.lab_unit && meta.lab_unit !== activeLabUnit) return false
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
  }, [chemicals, search, filter, sortBy, locationFilter, hazardFilter, showArchived, activeLabUnit])


  // Private collection flags for org workspace (local, per user — not shared)
  useEffect(() => {
    if (!session?.user?.id) return
    if (workspaceMode !== 'organization' || !activeOrgId) return
    const key = `myCollection:${session.user.id}:${activeOrgId}`
    let ids = []
    try {
      ids = JSON.parse(localStorage.getItem(key) || '[]') || []
    } catch {
      ids = []
    }
    const setIds = new Set(ids.map(String))
    setChemicals((prev) => {
      if (!prev?.length) return prev
      let changed = false
      const next = prev.map((c) => {
        const flag = setIds.has(String(c.id))
        if (Boolean(c.in_collection) !== flag) {
          changed = true
          return { ...c, in_collection: flag }
        }
        return c
      })
      return changed ? next : prev
    })
  }, [session?.user?.id, workspaceMode, activeOrgId, chemicals.length])

  const displayedChemicals = useMemo(() => {
    if (mainView === 'collection') {
      return chemicals.filter((c) => !!c.in_collection)
    }
    return filtered
  }, [mainView, chemicals, filtered])

  const collectionCount = useMemo(
    () => chemicals.filter((c) => !!c.in_collection).length,
    [chemicals]
  )

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

  const stats = useMemo(() => {
    const total = chemicals.length
    const missingSds = chemicals.filter((c) => !c.sds_filename).length
    const withSds = total - missingSds
    const sdsPercent = total === 0 ? 100 : Math.round((withSds / total) * 100)
    return {
      total,
      low: chemicals.filter(isLow).length,
      expired: chemicals.filter(isExpired).length,
      soon: chemicals.filter(isExpiringSoon).length,
      missingSds,
      withSds,
      sdsPercent,
    }
  }, [chemicals])


  /* Close header ⋯ menu when clicking outside */
  useEffect(() => {
    if (!headerMenuOpen) return undefined
    const onPointerDown = (e) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
        setHeaderMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [headerMenuOpen])

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
        const role = String(activeOrgRole || '').toLowerCase()
        if (
          workspaceMode === 'organization' &&
          role !== 'admin' &&
          role !== 'owner'
        )
          return
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
        setHeaderMenuOpen(false)
        setShowInviteModal(false)
        setShowCreateOrg(false)
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

  /* Role helpers — org members are restricted; admins/owners have full control.
     Personal workspace → full access. Org member → collection + usage only. */
  const isOrgWorkspace =
    workspaceMode === 'organization' && Boolean(activeOrgId)
  const roleLower = String(activeOrgRole || '').toLowerCase()
  // Anyone in an org who is not admin/owner is treated as a restricted member
  const isOrgMemberOnly =
    isOrgWorkspace && roleLower !== 'admin' && roleLower !== 'owner'
  const canManageOrg = isOrgWorkspace
    ? roleLower === 'admin' || roleLower === 'owner'
    : true
  const canAddChemicals = !isOrgMemberOnly
  const canEditChemicals = !isOrgMemberOnly
  const canDeleteChemicals = !isOrgMemberOnly
  const canInviteMembers = canManageOrg
  const canCreateOrganization = !isOrgMemberOnly
  const canSeeDeleteAccount = !isOrgMemberOnly
  const canSeeAdminTools = canManageOrg

  if (!session) {
    const params =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : null
    const inviteToken =
      params?.get('token') || params?.get('invite') || null
    const inviteOrgName =
      params?.get('orgName') || params?.get('org_name') || null
    const inviteOrgSlug =
      params?.get('org') || params?.get('slug') || null

    // Invite links skip Landing and open org-branded Login immediately
    if (!showLogin && !inviteToken) {
      return <Landing onGetStarted={() => setShowLogin(true)} />
    }

    return (
      <Login
        onLogin={(sess) => {
          try {
            sessionStorage.removeItem('authRecovery')
          } catch { /* ignore */ }
          setSession(sess)
        }}
        inviteToken={inviteToken}
        inviteOrgName={inviteOrgName}
        inviteOrgSlug={inviteOrgSlug}
        forceReset={(() => {
          try {
            return sessionStorage.getItem('authRecovery') === '1'
          } catch {
            return false
          }
        })()}
      />
    )
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
      <header className="app-header" style={{ position: 'relative', zIndex: 4000 }}>
        <div className="brand">
          <div className="brand-logo">
            <img src={appLogo} alt="Chemical Inventory" className="app-logo-img" />
          </div>
          <div className="brand-text">
            <h1>Chemical Inventory</h1>
            <span>Stock · Hazards · SDS · Compatibility</span>
          </div>
        </div>

        {/* Primary tools — keep critical actions visible */}
        <div className="header-tools">
          <div className="tool-group">
            <div className="notif-wrapper" ref={notifRef}>
              <button
                className="tool-btn"
                onClick={() => setNotifOpen((v) => !v)}
                title="Notifications"
              >
                🔔
                {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
              </button>
            </div>

            <button
              className="tool-btn"
              onClick={() => setCompatOpen(true)}
              title="Compatibility Checker"
            >
              ⚠️
              {compatibilityIssues.length > 0 && (
                <span className="badge">{compatibilityIssues.length}</span>
              )}
            </button>

            {/* Overflow menu (⋯) — high z-index so it sits above search/toolbar */}
            <div
              className="header-menu-wrapper"
              ref={headerMenuRef}
              style={{ position: 'relative', zIndex: 5000 }}
            >
              <button
                className={`tool-btn ${headerMenuOpen ? 'active' : ''}`}
                onClick={() => setHeaderMenuOpen((v) => !v)}
                title="More actions"
                aria-haspopup="menu"
                aria-expanded={headerMenuOpen}
              >
                ⋯
              </button>
              {headerMenuOpen && (
                <div
                  className="header-menu-dropdown"
                  role="menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    minWidth: 240,
                    background: 'var(--panel, var(--bg-elevated, #ffffff))',
                    color: 'var(--text, #0f172a)',
                    border: '1px solid var(--border, #e2e8f0)',
                    borderRadius: 12,
                    boxShadow: '0 12px 40px rgba(15, 23, 42, 0.2)',
                    padding: 6,
                    zIndex: 6000,
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="header-menu-item"
                    style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'center', padding: '10px 12px', border: 0, background: 'transparent', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => {
                      setShowHistory(true)
                      setHeaderMenuOpen(false)
                    }}
                  >
                    <span>📋</span> Usage History
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="header-menu-item"
                    style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'center', padding: '10px 12px', border: 0, background: 'transparent', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => {
                      startScanner()
                      setHeaderMenuOpen(false)
                    }}
                  >
                    <span>📷</span> Scan Barcode / QR
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="header-menu-item"
                    style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'center', padding: '10px 12px', border: 0, background: 'transparent', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => {
                      setCommandOpen(true)
                      setHeaderMenuOpen(false)
                    }}
                  >
                    <span>⌘K</span> Command palette
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="header-menu-item"
                    style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'center', padding: '10px 12px', border: 0, background: 'transparent', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => {
                      setHazardLegendOpen(true)
                      setHeaderMenuOpen(false)
                    }}
                  >
                    <span>ℹ️</span> Hazard legend
                  </button>
                  {accountMode === 'organization' && (canCreateOrganization || canInviteMembers) && (
                    <>
                      <div style={{ height: 1, background: 'var(--border)', margin: '4px 6px' }} />
                      {canCreateOrganization && (
                        <button
                          type="button"
                          role="menuitem"
                          className="header-menu-item"
                          style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'center', padding: '10px 12px', border: 0, background: 'transparent', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                          onClick={() => {
                            setShowCreateOrg(true)
                            setHeaderMenuOpen(false)
                          }}
                        >
                          <span>🏢</span> Create organization
                        </button>
                      )}
                      {activeOrgId && canInviteMembers && (
                        <button
                          type="button"
                          role="menuitem"
                          className="header-menu-item"
                          style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'center', padding: '10px 12px', border: 0, background: 'transparent', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                          onClick={() => {
                            fetchOrgMembers(activeOrgId)
                            fetchOrgInvites(activeOrgId)
                            setShowInviteModal(true)
                            setHeaderMenuOpen(false)
                          }}
                        >
                          <span>✉️</span> Invite members
                        </button>
                      )}
                    </>
                  )}
                  <div style={{ height: 1, background: 'var(--border)', margin: '4px 6px' }} />
                  <button
                    type="button"
                    role="menuitem"
                    className="header-menu-item"
                    style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'center', padding: '10px 12px', border: 0, background: 'transparent', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => {
                      setShowAuditLog(true)
                      setHeaderMenuOpen(false)
                      fetchAuditEvents()
                    }}
                  >
                    <span>📜</span> Audit log
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="header-menu-item"
                    style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'center', padding: '10px 12px', border: 0, background: 'transparent', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => {
                      setHeaderMenuOpen(false)
                      openProfileModal()
                    }}
                  >
                    <span>👤</span> Profile &amp; password
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="header-menu-item"
                    style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'center', padding: '10px 12px', border: 0, background: 'transparent', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => {
                      setShowSdsReport(true)
                      setHeaderMenuOpen(false)
                    }}
                  >
                    <span>📄</span> SDS review report
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="header-menu-item"
                    style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'center', padding: '10px 12px', border: 0, background: 'transparent', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => {
                      setShowWasteModal(true)
                      setHeaderMenuOpen(false)
                      fetchWasteLog()
                    }}
                  >
                    <span>🗑️</span> Log waste / disposal
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="header-menu-item"
                    style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'center', padding: '10px 12px', border: 0, background: 'transparent', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => {
                      setShowArchived((v) => !v)
                      setHeaderMenuOpen(false)
                    }}
                  >
                    <span>📦</span> {showArchived ? 'Show active inventory' : 'Show archived'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="header-menu-item"
                    style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'center', padding: '10px 12px', border: 0, background: 'transparent', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => {
                      setShowLanding(true)
                      setHeaderMenuOpen(false)
                    }}
                  >
                    <span>ℹ️</span> About
                  </button>
                  <div style={{ height: 1, background: 'var(--border)', margin: '4px 6px' }} />
                  {canSeeDeleteAccount && (
                  <button
                    type="button"
                    role="menuitem"
                    className="header-menu-item"
                    style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'center', padding: '10px 12px', border: 0, background: 'transparent', borderRadius: 8, cursor: 'pointer', textAlign: 'left', color: 'var(--danger, #dc2626)' }}
                    onClick={() => {
                      setDeleteAccountConfirm('')
                      setShowDeleteAccount(true)
                      setHeaderMenuOpen(false)
                    }}
                  >
                    <span>⚠️</span> Delete account…
                  </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="header-end">
          {/* Locked by Login intent: personal hides org UI; org hides personal option */}
          <div className="workspace-switcher" style={{ display: 'flex', alignItems: 'center' }}>
            {accountMode === 'personal' ? (
              <div
                title="Personal workspace"
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: '1px solid var(--border, #e2e8f0)',
                  background: 'var(--panel, #fff)',
                  color: 'var(--text, #0f172a)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  minHeight: 36,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                👤 Personal
              </div>
            ) : (
              <select
                value={
                  workspace?.mode === 'organization' && workspace?.organization_id
                    ? `org-${workspace.organization_id}`
                    : organizations[0]
                      ? `org-${organizations[0].id}`
                      : ''
                }
                onChange={(e) => {
                  const v = e.target.value
                  if (!v) return
                  const id = v.replace('org-', '')
                  const org = organizations.find((o) => String(o.id) === String(id))
                  switchWorkspace({
                    mode: 'organization',
                    organization_id: org?.id ?? id,
                    name: org?.name,
                    role: org?.role,
                  })
                }}
                title="Organization workspace"
                style={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  padding: '8px 32px 8px 12px',
                  borderRadius: 999,
                  border: '1px solid var(--border, #e2e8f0)',
                  background:
                    'var(--panel, #fff) url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath fill=\'%2364748b\' d=\'M1 1l5 5 5-5\'/%3E%3C/svg%3E") no-repeat right 12px center',
                  color: 'var(--text, #0f172a)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  lineHeight: 1.2,
                  cursor: 'pointer',
                  maxWidth: 220,
                  minHeight: 36,
                }}
              >
                {organizations.length === 0 && (
                  <option value="">🏢 No organization yet</option>
                )}
                {organizations.map((org) => (
                  <option key={org.id} value={`org-${org.id}`}>
                    🏢 {org.name}
                    {org.role ? ` (${org.role})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button className="tool-btn theme-btn" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          <button
            type="button"
            className="user-pill"
            onClick={openProfileModal}
            title="Open profile"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              border: '1px solid var(--border, #e2e8f0)',
              background: 'var(--panel, #fff)',
              borderRadius: 999,
              padding: '4px 10px 4px 4px',
              maxWidth: 220,
            }}
          >
            {(session.user?.user_metadata?.avatar_url ||
              session.user?.user_metadata?.picture) ? (
              <img
                src={
                  session.user.user_metadata.avatar_url ||
                  session.user.user_metadata.picture
                }
                alt=""
                width={28}
                height={28}
                style={{ borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {(
                  session.user?.user_metadata?.full_name ||
                  session.user?.user_metadata?.name ||
                  session.user?.email ||
                  '?'
                )
                  .toString()
                  .charAt(0)
                  .toUpperCase()}
              </span>
            )}
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              {session.user?.user_metadata?.full_name ||
                session.user?.user_metadata?.name ||
                session.user?.email}
            </span>
          </button>

          <button className="ghost-btn" onClick={handleLogout}>
            Logout
          </button>

          {canAddChemicals && (
          <button
            className="primary-btn"
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
          >
            + Add Chemical
          </button>
        )}
        </div>
      </header>

      {/* View switcher */}
      <div className="view-tabs">
        <button
          className={mainView === 'inventory' ? 'tab active' : 'tab'}
          onClick={() => setMainView('inventory')}
        >
          📦 Inventory
        </button>
        <button
          className={mainView === 'dashboard' ? 'tab active' : 'tab'}
          onClick={() => setMainView('dashboard')}
          title="My Collection – chemicals currently in use"
        >
          📊 Dashboard
        </button>
          <button
            className={mainView === 'collection' ? 'tab active' : 'tab'}
            onClick={() => setMainView('collection')}
            title="My Collection – chemicals currently in use"
          >
            <span className="collection-icon">🧪</span>
            <span>My Collection</span>
            {collectionCount > 0 && (
              <span className="collection-count">{collectionCount}</span>
            )}
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
            <div
              className={`stat-card ${stats.sdsPercent < 80 ? 'caution' : ''}`}
              title={`${stats.withSds} of ${stats.total} have SDS`}
            >
              <span className="stat-value">{stats.sdsPercent}%</span>
              <span className="stat-label">SDS Complete</span>
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
            <div
              className={`stat-card ${stats.sdsPercent < 80 ? 'caution' : ''}`}
              title={`${stats.withSds} of ${stats.total} have SDS`}
            >
              <span className="stat-value">{stats.sdsPercent}%</span>
              <span className="stat-label">SDS Complete</span>
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
                    <div className="export-divider" />
                    <button
                      type="button"
                      onClick={() => {
                        setExportOpen(false)
                        csvImportRef.current?.click()
                      }}
                    >
                      Import CSV…
                    </button>
                  </div>
                )}
                <input
                  ref={csvImportRef}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleImportCSV(f)
                  }}
                />
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
                    {/* Row 1: Name + Lookup (full width) */}
                    <div className={`form-group form-group-name ${formErrors.name ? 'error' : ''}`}>
                      <label htmlFor="name">Name *</label>
                      <div className="name-row">
                        <input
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="e.g. Hydrogen peroxide"
                          autoFocus
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-primary lookup-btn"
                          onClick={handlePubChemLookup}
                          disabled={
                            lookingUp ||
                            (!formData.name.trim() && !formData.cas_number.trim())
                          }
                          title="Auto-fill CAS, formula, hazards & safety link from PubChem"
                        >
                          {lookingUp ? 'Looking up…' : 'Auto-fill'}
                        </button>
                      </div>
                      <p className="field-hint" style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Type a name or CAS — CAS, formula, classes, and a PubChem safety link fill in automatically.
                        Use <strong>Auto-fill</strong> to refresh all fields from PubChem.
                      </p>
                      {formErrors.name && <span className="error-text">{formErrors.name}</span>}
                    </div>
                    {/* Row 2: CAS + Formula */}
                    <div className="form-group">
                      <label htmlFor="cas_number">
                        CAS Number{' '}
                        {lookingUp ? (
                          <span style={{ color: 'var(--primary)', fontWeight: 500 }}>(looking up…)</span>
                        ) : formData.cas_number ? (
                          <span style={{ color: 'var(--success)', fontWeight: 500 }}>✓</span>
                        ) : null}
                      </label>
                      <input
                        id="cas_number"
                        name="cas_number"
                        value={formData.cas_number}
                        onChange={handleChange}
                        placeholder="Auto from name, or type CAS"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="molecular_formula">
                        Molecular Formula{' '}
                        {formData.molecular_formula ? (
                          <span style={{ color: 'var(--success)', fontWeight: 500 }}>✓</span>
                        ) : null}
                      </label>
                      <input
                        id="molecular_formula"
                        name="molecular_formula"
                        value={formData.molecular_formula}
                        onChange={handleChange}
                        placeholder="Auto from PubChem"
                      />
                    </div>

                    {(formData.sds_url || formData.pubchem_url) && (
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label>Online safety / SDS reference</label>
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 8,
                            alignItems: 'center',
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            background: 'var(--bg)',
                            fontSize: '0.85rem',
                          }}
                        >
                          <span style={{ color: 'var(--text-muted)' }}>
                            PubChem safety section (not a manufacturer SDS PDF):
                          </span>
                          <a
                            href={formData.sds_url || formData.pubchem_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontWeight: 600, color: 'var(--primary)' }}
                          >
                            Open safety data ↗
                          </a>
                          {formData.cas_number && (
                            <a
                              href={`https://www.sigmaaldrich.com/US/en/search/${encodeURIComponent(formData.cas_number)}?focus=products&page=1&perpage=30&sort=relevance&term=${encodeURIComponent(formData.cas_number)}&type=cas_number`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontWeight: 600, color: 'var(--primary)' }}
                            >
                              Search supplier SDS ↗
                            </a>
                          )}
                        </div>
                      </div>
                    )}

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

                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Location (hierarchy)</label>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                          gap: 8,
                        }}
                      >
                        <input
                          name="loc_building"
                          value={formData.loc_building || ''}
                          onChange={handleChange}
                          placeholder="Building"
                          aria-label="Building"
                        />
                        <input
                          name="loc_room"
                          value={formData.loc_room || ''}
                          onChange={handleChange}
                          placeholder="Room / lab"
                          aria-label="Room"
                        />
                        <input
                          name="loc_cabinet"
                          value={formData.loc_cabinet || ''}
                          onChange={handleChange}
                          placeholder="Cabinet"
                          aria-label="Cabinet"
                        />
                        <input
                          name="loc_shelf"
                          value={formData.loc_shelf || ''}
                          onChange={handleChange}
                          placeholder="Shelf / box"
                          aria-label="Shelf"
                        />
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>
                        Saved as:{' '}
                        <strong>
                          {joinLocationPath(formData) || formData.location || '—'}
                        </strong>
                        {autoEnrichBusy ? ' · enriching…' : ''}
                      </p>
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

                    <div className="form-group form-group-barcode">
                      <label htmlFor="barcode">Barcode / QR Value</label>
                      <div className="barcode-row">
                        <input
                          id="barcode"
                          name="barcode"
                          value={formData.barcode}
                          onChange={handleChange}
                          placeholder="Scan or generate"
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

          {showCreateOrg && canCreateOrganization && (
            <div className="modal-overlay" onClick={() => setShowCreateOrg(false)}>
              <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Create Organization</h3>
                  <button className="icon-btn" onClick={() => setShowCreateOrg(false)}>
                    ✕
                  </button>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                  Shared lab inventory for your team. Each member still keeps a personal collection.
                </p>
                <input
                  className="search-input"
                  placeholder="Organization name (e.g. Organic Lab)"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  autoFocus
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                  <button className="btn btn-ghost" onClick={() => setShowCreateOrg(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleCreateOrganization}
                    disabled={orgLoading}
                  >
                    {orgLoading ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showInviteModal && canInviteMembers && (
            <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
              <div
                className="modal"
                style={{
                  maxWidth: 520,
                  width: 'min(520px, calc(100vw - 24px))',
                  maxHeight: 'min(90vh, 720px)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  padding: 0,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="modal-header"
                  style={{
                    flexShrink: 0,
                    padding: '16px 18px 12px',
                    borderBottom: '1px solid var(--border)',
                    position: 'sticky',
                    top: 0,
                    background: 'var(--panel, #fff)',
                    zIndex: 2,
                  }}
                >
                  <h3>Invite Members</h3>
                  <button className="icon-btn" onClick={() => setShowInviteModal(false)}>
                    ✕
                  </button>
                </div>

                <div
                  className="modal-body invite-modal-scroll"
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    WebkitOverflowScrolling: 'touch',
                    padding: '14px 18px 20px',
                    overscrollBehavior: 'contain',
                  }}
                >
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                  Organization: <strong>{activeOrgName || 'Current org'}</strong>
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                  Invites create a secure token. Copy the link and send it to the member (email
                  delivery is optional and requires a mail provider). They sign in and the app
                  accepts <code>?token=...</code> automatically.
                </p>

                <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                  <input
                    className="search-input"
                    placeholder="Full name (required)"
                    value={inviteFullName}
                    onChange={(e) => setInviteFullName(e.target.value)}
                    autoComplete="name"
                  />
                  <input
                    className="search-input"
                    placeholder="Email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    autoComplete="email"
                  />
                  <select
                    className="search-input"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    className="btn btn-primary"
                    onClick={handleInviteMember}
                    disabled={inviteLoading}
                  >
                    {inviteLoading ? 'Creating…' : 'Create invite & copy link'}
                  </button>
                  {lastInviteLink && (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: '0.8rem',
                        wordBreak: 'break-all',
                        background: 'var(--panel, #f8fafc)',
                      }}
                    >
                      <div style={{ marginBottom: 8 }}>
                        <strong>Share with invitee</strong>
                        {lastInviteEmail ? (
                          <div style={{ marginTop: 4 }}>
                            Email: <code>{lastInviteEmail}</code>
                          </div>
                        ) : null}
                      </div>
                      <div>
                        <strong>Link:</strong> {lastInviteLink}
                      </div>
                      {lastInvitePassword ? (
                        <div
                          style={{
                            marginTop: 10,
                            padding: 10,
                            borderRadius: 8,
                            background: '#fef3c7',
                            border: '1px solid #f59e0b',
                            wordBreak: 'break-all',
                          }}
                        >
                          <strong>Temporary password</strong> (email did not send —
                          share privately):
                          <div
                            style={{
                              fontFamily: 'ui-monospace, monospace',
                              fontSize: '1rem',
                              fontWeight: 700,
                              marginTop: 6,
                              letterSpacing: '0.04em',
                            }}
                          >
                            {lastInvitePassword}
                          </div>
                          <button
                            type="button"
                            className="btn-sm"
                            style={{ marginTop: 8 }}
                            onClick={() => {
                              navigator.clipboard?.writeText(lastInvitePassword)
                              showMessage('success', 'Password copied')
                            }}
                          >
                            Copy password
                          </button>
                        </div>
                      ) : (
                        <p style={{ marginTop: 8, opacity: 0.75 }}>
                          Sign-in details were included in the invite email.
                        </p>
                      )}
                      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn-sm"
                          onClick={() => {
                            navigator.clipboard?.writeText(lastInviteLink)
                            showMessage('success', 'Link copied again')
                          }}
                        >
                          Copy link
                        </button>
                        {lastInvitePassword ? (
                          <button
                            type="button"
                            className="btn-sm"
                            onClick={() => {
                              const msg = [
                                lastInviteEmail && `Email: ${lastInviteEmail}`,
                                `Link: ${lastInviteLink}`,
                                `Temporary password: ${lastInvitePassword}`,
                              ]
                                .filter(Boolean)
                                .join('\n')
                              navigator.clipboard?.writeText(msg)
                              showMessage('success', 'All invite details copied')
                            }}
                          >
                            Copy all details
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>

                <h4 style={{ margin: '8px 0' }}>Pending invites</h4>
                {orgInvites.filter((i) => i.status === 'pending').length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No pending invites</p>
                ) : (
                  <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                    {orgInvites
                      .filter((i) => i.status === 'pending')
                      .map((invite) => (
                        <div
                          key={invite.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 8,
                            alignItems: 'center',
                            padding: '8px 10px',
                            border: '1px solid var(--border)',
                            borderRadius: 10,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{invite.email}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              Role: {invite.role}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            {invite.token && (
                              <button
                                className="btn-sm"
                                type="button"
                                onClick={() =>
                                  copyInviteLink(invite.token, {
                                    name: activeOrgName,
                                    slug: activeOrgId,
                                    id: activeOrgId,
                                  })
                                }
                              >
                                Copy link
                              </button>
                            )}
                            <button
                              className="btn-sm btn-danger"
                              type="button"
                              onClick={() => handleRevokeInvite(invite.id)}
                            >
                              Revoke
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                <h4 style={{ margin: '8px 0' }}>Members</h4>
                {orgMembers.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No members found</p>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {orgMembers.map((m) => {
                      const name = m.full_name || m.name || ''
                      const email = m.email || m.user_email || ''
                      const primary = name || email || 'Member'
                      const secondary = name && email ? email : ''
                      const uid = m.user_id || m.id
                      const isSelf =
                        uid &&
                        session?.user?.id &&
                        String(uid) === String(session.user.id)
                      return (
                        <div
                          key={uid || primary}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 10px',
                            border: '1px solid var(--border)',
                            borderRadius: 10,
                            gap: 8,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{primary}</div>
                            {secondary ? (
                              <div
                                style={{
                                  fontSize: '0.8rem',
                                  color: 'var(--text-muted)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {secondary}
                              </div>
                            ) : null}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              flexShrink: 0,
                            }}
                          >
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {m.role || 'member'}
                            </span>
                            {canInviteMembers && !isSelf && uid ? (
                              <button
                                type="button"
                                className="btn-sm btn-danger"
                                title="Remove from organization"
                                onClick={() => handleRemoveMember(uid, primary)}
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 14,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <h4 style={{ margin: '0 0 8px' }}>Accept invite token</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                    For testing: paste an invite token here while logged in as the invited user.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="search-input"
                      placeholder="Paste invite token"
                      id="accept-invite-token"
                    />
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        const el = document.getElementById('accept-invite-token')
                        handleAcceptInvite(el?.value || '')
                      }}
                    >
                      Accept
                    </button>
                  </div>
                </div>
                </div>
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
            ) : displayedChemicals.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🧪</div>
                <h3>
                  {mainView === 'collection'
                    ? 'Collection is empty'
                    : 'No chemicals found'}
                </h3>
                <p>
                  {mainView === 'collection'
                    ? 'Add chemicals with “Add to Collection” from Inventory.'
                    : search || filter !== 'all' || locationFilter || hazardFilter
                      ? 'Try adjusting your search or filters.'
                      : 'Get started by adding your first chemical.'}
                </p>
                {canAddChemicals &&
                  mainView !== 'collection' &&
                  !search &&
                  filter === 'all' &&
                  !locationFilter &&
                  !hazardFilter && (
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
                {displayedChemicals.map((chem) => {
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
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => setShowQrModal(chem)}
                          >
                            QR
                          </button>
                        )}
                        <button
                          type="button" 
                          className="btn btn-sm btn-ghost"
                          onClick={() => openUsageModal(chem)}
                        >
                          Log Usage
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => toggleCollection(chem)}
                        >
                          {chem.in_collection ? 'Remove' : 'Collect'}
                        </button>
                        {canEditChemicals && (
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => handleEdit(chem)}
                          >
                            Edit
                          </button>
                        )}
                        {canDeleteChemicals && (
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(chem.id, chem.name)}
                          >
                            Delete
                          </button>
                        )}
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
                            checked={selectedIds.size === displayedChemicals.length && displayedChemicals.length > 0}
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
                    {displayedChemicals.map((chem) => {
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
                            {canEditChemicals && (
                              <button className="btn-sm" onClick={() => handleEdit(chem)}>
                                Edit
                              </button>
                            )}
                            <button className="btn-sm" type="button" onClick={() => printChemicalLabel(chem)}>
                              Label
                            </button>
                            {canEditChemicals && (
                              showArchived || getChemMeta(chem.id).archived ? (
                                <button
                                  className="btn-sm"
                                  type="button"
                                  onClick={() => handleUnarchiveChemical(chem)}
                                >
                                  Restore
                                </button>
                              ) : (
                                <button
                                  className="btn-sm"
                                  type="button"
                                  onClick={() => handleArchiveChemical(chem)}
                                >
                                  Archive
                                </button>
                              )
                            )}
                            {chem.sds_filename && (
                              <button
                                className="btn-sm"
                                type="button"
                                onClick={() => handleMarkSdsReviewed(chem)}
                              >
                                SDS✓
                              </button>
                            )}
                            <button
                              className="btn-sm"
                              onClick={() => toggleCollection(chem)}
                            >
                              {chem.in_collection ? 'Remove' : 'Collect'}
                            </button>
                            {canDeleteChemicals && (
                              <button
                                className="btn-sm btn-danger"
                                onClick={() => handleDelete(chem.id, chem.name)}
                              >
                                Delete
                              </button>
                            )}
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
              {typeof Notification !== 'undefined' && notifPermission === 'granted' && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  Browser notifications are enabled. You will receive alerts for low stock and
                  expired chemicals.
                </p>
              )}
              {typeof Notification !== 'undefined' && notifPermission !== 'granted' && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={requestNotificationPermission}
                >
                  Allow browser notifications
                </button>
              )}
              {typeof Notification !== 'undefined' && notifPermission === 'denied' && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  Browser notifications are blocked. Please enable them in your browser settings.
                </p>
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
              {canAddChemicals && (
                <button
                  onClick={() => {
                    resetForm()
                    setShowForm(true)
                    setCommandOpen(false)
                  }}
                >
                  <span>➕</span> Add new chemical
                </button>
              )}
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

      {/* ===================== AUDIT LOG ===================== */}
      {showAuditLog && (
        <div className="modal-overlay" onClick={() => setShowAuditLog(false)}>
          <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Audit log (append-only)</h3>
              <button className="icon-btn" onClick={() => setShowAuditLog(false)}>✕</button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              Organization-wide audit trail (server). Falls back to this browser if the API is unavailable.
            </p>
            <div style={{ maxHeight: 420, overflow: 'auto', display: 'grid', gap: 8 }}>
              {auditEvents.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No events yet</p>
              ) : (
                auditEvents.map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      fontSize: '0.85rem',
                    }}
                  >
                    <strong>{ev.action}</strong>
                    <div style={{ color: 'var(--text-muted)' }}>
                      {formatDateTime(ev.at)} · {ev.user_email || ev.user_id || '—'}
                    </div>
                    {ev.chemical_name && <div>{ev.chemical_name}</div>}
                    {ev.email && <div>Invitee: {ev.email}</div>}
                    {ev.location && <div>Location: {ev.location}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== SDS REVIEW REPORT ===================== */}
      {showSdsReport && (
        <div className="modal-overlay" onClick={() => setShowSdsReport(false)}>
          <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>SDS missing / outdated report</h3>
              <button className="icon-btn" onClick={() => setShowSdsReport(false)}>✕</button>
            </div>
            <div style={{ maxHeight: 420, overflow: 'auto', display: 'grid', gap: 8 }}>
              {chemicals.filter((c) => isSdsReviewOverdue(c) || !c.sds_filename).length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>All SDS files look current.</p>
              ) : (
                chemicals
                  .filter((c) => isSdsReviewOverdue(c) || !c.sds_filename)
                  .map((c) => {
                    const meta = getChemMeta(c.id)
                    return (
                      <div
                        key={c.id}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          padding: '10px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 8,
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <strong>{c.name}</strong>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {!c.sds_filename
                              ? 'Missing SDS file'
                              : `Last reviewed: ${c.sds_reviewed_at || meta.sds_reviewed_at || 'never'}`}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {c.sds_filename && (
                            <button className="btn-sm" type="button" onClick={() => handleMarkSdsReviewed(c)}>
                              Mark reviewed
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== WASTE / DISPOSAL ===================== */}
      {showWasteModal && (
        <div className="modal-overlay" onClick={() => setShowWasteModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Log waste / disposal</h3>
              <button className="icon-btn" onClick={() => setShowWasteModal(false)}>✕</button>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <select
                className="search-input"
                value={wasteForm.chemical_id}
                onChange={(e) => setWasteForm((p) => ({ ...p, chemical_id: e.target.value }))}
              >
                <option value="">Select chemical…</option>
                {chemicals.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="search-input"
                  type="number"
                  step="any"
                  placeholder="Quantity"
                  value={wasteForm.quantity}
                  onChange={(e) => setWasteForm((p) => ({ ...p, quantity: e.target.value }))}
                />
                <select
                  className="search-input"
                  value={wasteForm.unit}
                  onChange={(e) => setWasteForm((p) => ({ ...p, unit: e.target.value }))}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <input
                className="search-input"
                placeholder="Reason (e.g. expired, spill, lab clean-out)"
                value={wasteForm.reason}
                onChange={(e) => setWasteForm((p) => ({ ...p, reason: e.target.value }))}
              />
              <input
                className="search-input"
                placeholder="Notes"
                value={wasteForm.notes}
                onChange={(e) => setWasteForm((p) => ({ ...p, notes: e.target.value }))}
              />
              <button className="btn btn-primary" type="button" onClick={handleLogWaste}>
                Record disposal
              </button>
              {wasteLog.length > 0 && (
                <div style={{ maxHeight: 160, overflow: 'auto', fontSize: '0.8rem' }}>
                  {wasteLog.slice(0, 8).map((w) => (
                    <div key={w.id} style={{ marginBottom: 6 }}>
                      {formatDateTime(w.at)} — {w.chemical_name}: {w.quantity} {w.unit} ({w.reason})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== DELETE ACCOUNT ===================== */}
      
      {showProfileModal && (
        <div
          className="modal-overlay"
          onClick={() => !profileSaving && setShowProfileModal(false)}
        >
          <div
            className="modal-card profile-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header profile-modal-header">
              <h3 style={{ margin: 0 }}>Your profile</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowProfileModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body profile-modal-body">
              <div className="profile-avatar-row">
                {profileAvatar ? (
                  <img
                    src={profileAvatar}
                    alt=""
                    className="profile-avatar"
                  />
                ) : (
                  <span className="profile-avatar-fallback">
                    {(profileName || session?.user?.email || '?')
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                )}
                <div className="profile-avatar-actions">
                  <label className="profile-upload-btn">
                    Upload photo
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleProfileAvatarChange}
                    />
                  </label>
                  <p className="profile-avatar-hint">
                    Square image works best. Saved with your account.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile}>
                <label className="profile-field">
                  <span>Display name</span>
                  <input
                    className="search-input"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Your name"
                    disabled={profileSaving}
                  />
                </label>
                <label className="profile-field">
                  <span>Email</span>
                  <input
                    className="search-input"
                    value={session?.user?.email || ''}
                    disabled
                    readOnly
                  />
                </label>

                <h4 style={{ margin: '8px 0 0', fontSize: 14 }}>Theme</h4>
                <div style={{ display: 'flex', gap: 8 }} className="profile-theme-toggle">
                  {['light', 'dark'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`btn ${profilePrefs.theme === t ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => {
                        setProfilePrefs((p) => ({ ...p, theme: t }))
                        setTheme(t)
                        try {
                          localStorage.setItem('theme', t)
                        } catch { /* ignore */ }
                      }}
                      disabled={profileSaving}
                    >
                      {t === 'light' ? '☀️ Light' : '🌙 Dark'}
                    </button>
                  ))}
                </div>
                <p className="profile-section-note">
                  Applied immediately. Click Save to sync theme to your account.
                </p>

                <h4 style={{ margin: '8px 0 0', fontSize: 14 }}>Default workspace</h4>
                {isOrgMemberOnly ? (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                    Your workspace is managed by your organization admin
                    {activeOrgName ? (
                      <>
                        {' '}
                        (<strong>{activeOrgName}</strong>
                        {activeOrgRole ? ` · ${activeOrgRole}` : ''})
                      </>
                    ) : null}
                    . Contact an owner to change organization access.
                  </p>
                ) : (
                  <select
                    className="search-input"
                    value={profilePrefs.default_workspace}
                    onChange={(e) =>
                      setProfilePrefs((p) => ({
                        ...p,
                        default_workspace: e.target.value,
                      }))
                    }
                    disabled={profileSaving}
                  >
                    <option value="last">Remember last used</option>
                    <option value="personal">Always Personal</option>
                    {(organizations || []).map((o) => (
                      <option key={o.id} value={o.id}>
                        Org: {o.name} ({o.role || 'member'})
                      </option>
                    ))}
                  </select>
                )}

                <h4 style={{ margin: '8px 0 0', fontSize: 14 }}>Notifications</h4>
                <label className="profile-check">
                  <input
                    type="checkbox"
                    checked={profilePrefs.notifications_enabled}
                    onChange={(e) =>
                      setProfilePrefs((p) => ({
                        ...p,
                        notifications_enabled: e.target.checked,
                      }))
                    }
                    disabled={profileSaving}
                  />
                  Enable in-app notifications
                </label>
                <label className="profile-check" style={{ opacity: profilePrefs.notifications_enabled ? 1 : 0.5 }}>
                  <input
                    type="checkbox"
                    checked={profilePrefs.notify_expiry}
                    onChange={(e) =>
                      setProfilePrefs((p) => ({
                        ...p,
                        notify_expiry: e.target.checked,
                      }))
                    }
                    disabled={profileSaving || !profilePrefs.notifications_enabled}
                  />
                  Expiry warnings
                </label>
                <label className="profile-check" style={{ opacity: profilePrefs.notifications_enabled ? 1 : 0.5 }}>
                  <input
                    type="checkbox"
                    checked={profilePrefs.notify_low_stock}
                    onChange={(e) =>
                      setProfilePrefs((p) => ({
                        ...p,
                        notify_low_stock: e.target.checked,
                      }))
                    }
                    disabled={profileSaving || !profilePrefs.notifications_enabled}
                  />
                  Low stock alerts
                </label>
                <label className="profile-check" style={{ opacity: profilePrefs.notifications_enabled ? 1 : 0.5 }}>
                  <input
                    type="checkbox"
                    checked={profilePrefs.notify_usage}
                    onChange={(e) =>
                      setProfilePrefs((p) => ({
                        ...p,
                        notify_usage: e.target.checked,
                      }))
                    }
                    disabled={profileSaving || !profilePrefs.notifications_enabled}
                  />
                  Member usage (admins)
                </label>

                <h4 style={{ margin: '8px 0 0', fontSize: 14 }}>Linked organizations</h4>
                {(organizations || []).length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                    No organizations yet. Create one or accept an invite.
                  </p>
                ) : (
                  <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 13 }}>
                    {(organizations || []).map((o) => (
                      <li key={o.id} style={{ marginBottom: 6 }}>
                        <strong>{o.name}</strong>
                        {' · '}
                        <span style={{ textTransform: 'capitalize' }}>
                          {o.role || 'member'}
                        </span>
                        {String(activeOrgId) === String(o.id) ? ' · current' : ''}
                        {' '}
                        <button
                          type="button"
                          className="btn-sm"
                          style={{ marginLeft: 6 }}
                          onClick={() => {
                            switchToOrganization(o)
                            setProfileMsg({
                              type: 'success',
                              text: `Switched to ${o.name}`,
                            })
                          }}
                        >
                          Open
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={profileSaving}
                >
                  {profileSaving ? 'Saving…' : 'Save profile & preferences'}
                </button>
              </form>

              <hr style={{ margin: '18px 0', border: 0, borderTop: '1px solid var(--border)' }} />

              <h4 style={{ margin: '0 0 10px' }}>Change password</h4>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0 }}>
                Use this after signing in with a temporary invite password.
              </p>
              <form onSubmit={handleChangePassword} style={{ display: 'grid', gap: 10 }}>
                <input
                  className="search-input"
                  type="password"
                  placeholder="New password (min 6 characters)"
                  value={profileNewPassword}
                  onChange={(e) => setProfileNewPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={profileSaving}
                  minLength={6}
                />
                <input
                  className="search-input"
                  type="password"
                  placeholder="Confirm new password"
                  value={profileConfirmPassword}
                  onChange={(e) => setProfileConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={profileSaving}
                  minLength={6}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={profileSaving}
                >
                  Update password
                </button>
              </form>

              <hr style={{ margin: '18px 0', border: 0, borderTop: '1px solid var(--border)' }} />

              <h4 style={{ margin: '0 0 8px' }}>Sessions</h4>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0 }}>
                Sign out of this browser and revoke sessions on other devices.
              </p>
              <button
                type="button"
                className="profile-danger-btn"
                disabled={profileSaving}
                onClick={handleSignOutAllDevices}
              >
                Sign out all devices
              </button>

              {profileMsg && (
                <p className={`profile-msg ${profileMsg.type === 'error' ? 'error' : 'success'}`}>
                  {profileMsg.text}
                </p>
              )}
            </div>
          </div>
        </div>
      )}


      {showDeleteAccount && canSeeDeleteAccount && (
        <div className="modal-overlay" onClick={() => setShowDeleteAccount(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete account</h3>
              <button className="icon-btn" onClick={() => setShowDeleteAccount(false)}>✕</button>
            </div>
            <p style={{ fontSize: '0.9rem', marginBottom: 12 }}>
              This signs you out and clears local data. Permanent removal from Supabase Auth requires
              a server <code>DELETE /account</code> endpoint or manual admin delete.
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              Type <strong>DELETE</strong> to confirm.
            </p>
            <input
              className="search-input"
              value={deleteAccountConfirm}
              onChange={(e) => setDeleteAccountConfirm(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
            <button
              className="btn btn-danger"
              style={{ marginTop: 12 }}
              type="button"
              disabled={deleteAccountLoading}
              onClick={handleDeleteAccount}
            >
              {deleteAccountLoading ? 'Working…' : 'Delete my account'}
            </button>
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
