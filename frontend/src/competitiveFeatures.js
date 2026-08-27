/**
 * Competitive feature helpers — ChemSnap parse, Avery labels, reorder, thresholds
 * Used by App.jsx (no React dependency here)
 */

/** CAS RN pattern */
export const CAS_REGEX = /\b(\d{2,7}-\d{2}-\d)\b/g

/** Common GHS signal words */
export const SIGNAL_WORDS = ['Danger', 'Warning']

/**
 * Parse free text (OCR paste or label notes) into chemical draft fields
 */
export function parseLabelText(text) {
  const raw = String(text || '').replace(/\r/g, '\n')
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const casMatches = [...raw.matchAll(CAS_REGEX)].map((m) => m[1])
  const cas_number = casMatches[0] || ''

  // Prefer a line that looks like a chemical name (not all caps ORG, not CAS)
  let name = ''
  for (const line of lines) {
    if (/^\d{2,7}-\d{2}-\d$/.test(line)) continue
    if (/^(CAS|LOT|BATCH|MFG|EXP|NET|QTY|UN\s?\d)/i.test(line)) continue
    if (line.length < 3 || line.length > 80) continue
    name = line
    break
  }
  if (!name && lines[0]) name = lines[0]

  let supplier = ''
  for (const line of lines) {
    if (/(sigma|aldrich|merck|fisher|vwr|thermo|tci|alfa|acros|honeywell|baker)/i.test(line)) {
      supplier = line.replace(/^(manufacturer|supplier|mfr)[:\s]*/i, '').trim()
      break
    }
  }

  let batch_lot = ''
  const lot = raw.match(/\b(?:LOT|BATCH|Lot|Batch)[:\s#-]*([A-Za-z0-9\-./]+)/)
  if (lot) batch_lot = lot[1]

  let signal_word = ''
  for (const sw of SIGNAL_WORDS) {
    if (new RegExp(`\\b${sw}\\b`, 'i').test(raw)) {
      signal_word = sw
      break
    }
  }

  // Rough quantity e.g. 500 mL, 1 L, 100 g
  let quantity = ''
  let unit = 'g'
  const qty = raw.match(/\b(\d+(?:[.,]\d+)?)\s*(mL|ml|L|l|g|kg|mg)\b/)
  if (qty) {
    quantity = qty[1].replace(',', '.')
    const u = qty[2].toLowerCase()
    unit = u === 'l' ? 'L' : u === 'ml' ? 'mL' : u
  }

  return {
    name: name || '',
    cas_number,
    supplier,
    batch_lot,
    signal_word,
    quantity,
    unit,
    hazard_notes: signal_word ? `Label signal word: ${signal_word}` : '',
    raw_excerpt: lines.slice(0, 12).join(' · '),
  }
}

/**
 * Check storage conflicts for placing `incoming` classes into a location key
 * against chemicals already at that location.
 */
export function conflictsAtLocation({
  chemicals,
  locationKey,
  incomingClasses,
  getClasses,
  rules,
  excludeId,
}) {
  const loc = String(locationKey || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
  if (!loc || loc === '—' || loc === '-') return []

  const others = (chemicals || []).filter((c) => {
    if (excludeId != null && String(c.id) === String(excludeId)) return false
    if (c.archived) return false
    const cl = String(c.location || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
    // same cabinet/shelf path or shared prefix (building/room/cabinet)
    if (!cl) return false
    return cl === loc || cl.startsWith(loc + ' /') || loc.startsWith(cl + ' /') || cl.includes(loc) || loc.includes(cl)
  })

  const issues = []
  const inc = new Set((incomingClasses || []).map((x) => String(x).toLowerCase()))
  for (const other of others) {
    const oc = new Set((getClasses(other) || []).map((x) => String(x).toLowerCase()))
    for (const rule of rules || []) {
      const a = String(rule.a || rule.classA || '').toLowerCase()
      const b = String(rule.b || rule.classB || '').toLowerCase()
      if (!a || !b) continue
      if ((inc.has(a) && oc.has(b)) || (inc.has(b) && oc.has(a))) {
        issues.push({
          risk: rule.risk || rule.severity || 'High',
          reason: rule.reason || rule.message || `${a} vs ${b}`,
          otherName: other.name,
          otherId: other.id,
          location: other.location,
        })
      }
    }
  }
  return issues
}

/** Avery 5160-ish: 3 columns × 10 rows on Letter */
export function buildAvery5160Html(items) {
  const cells = (items || []).slice(0, 30).map((it) => {
    const name = escapeHtml(it.name || 'Chemical')
    const cas = escapeHtml(it.cas_number || '')
    const code = escapeHtml(it.barcode || it.container_code || String(it.id || ''))
    const loc = escapeHtml(it.location || '')
    return `<div class="label">
      <div class="label-name">${name}</div>
      <div class="label-meta">${cas ? 'CAS ' + cas : ''}</div>
      <div class="label-code">${code}</div>
      <div class="label-loc">${loc}</div>
    </div>`
  })
  while (cells.length < 30) cells.push('<div class="label label-empty"></div>')

  return `<!DOCTYPE html><html><head><title>Avery 5160 Labels</title>
<style>
  @page { size: letter; margin: 0.5in 0.19in; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, sans-serif; }
  .sheet {
    display: grid;
    grid-template-columns: repeat(3, 2.25in);
    grid-template-rows: repeat(10, 1in);
    gap: 0 0.14in;
    width: 8.5in;
  }
  .label {
    width: 2.25in;
    height: 1in;
    padding: 0.08in 0.1in;
    overflow: hidden;
    border: 0.5pt dashed #cbd5e1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .label-empty { border-color: transparent; }
  .label-name { font-size: 9pt; font-weight: 700; line-height: 1.15; }
  .label-meta, .label-loc { font-size: 7pt; color: #475569; }
  .label-code { font-size: 8pt; font-family: ui-monospace, monospace; margin-top: 2px; }
  @media print {
    .label { border-color: transparent; }
    .no-print { display: none; }
  }
</style></head><body>
  <p class="no-print" style="padding:12px;font-size:13px">
    Designed for <strong>Avery 5160</strong> (3×10). Use Print → Letter → 100% scale → no fit-to-page.
    <button onclick="window.print()">Print</button>
  </p>
  <div class="sheet">${cells.join('')}</div>
</body></html>`
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Build reorder lines for chemicals at or below min_stock
 */
export function buildReorderLines(chemicals, { onlyBelow = true } = {}) {
  const lines = []
  for (const c of chemicals || []) {
    if (c.archived) continue
    const min = Number(c.min_stock) || 0
    if (onlyBelow && min <= 0) continue
    const qty = Number(c.quantity) || 0
    if (onlyBelow && qty > min) continue
    const need = Math.max(min * 2 - qty, min || 1)
    lines.push({
      id: c.id,
      name: c.name,
      cas_number: c.cas_number || '',
      quantity_on_hand: qty,
      unit: c.unit || '',
      min_stock: min,
      suggested_order: Math.round(need * 100) / 100,
      supplier: c.supplier || '',
      location: c.location || '',
    })
  }
  return lines.sort((a, b) => a.name.localeCompare(b.name))
}

export function reorderRequestHtml(lines, { labName = 'Laboratory', requester = '' } = {}) {
  const rows = lines
    .map(
      (l) =>
        `<tr>
      <td>${escapeHtml(l.name)}</td>
      <td>${escapeHtml(l.cas_number)}</td>
      <td>${l.quantity_on_hand} ${escapeHtml(l.unit)}</td>
      <td>${l.min_stock}</td>
      <td><strong>${l.suggested_order} ${escapeHtml(l.unit)}</strong></td>
      <td>${escapeHtml(l.supplier)}</td>
    </tr>`
    )
    .join('')
  return `<!DOCTYPE html><html><head><title>Procurement request</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; color: #0f172a; }
  h1 { font-size: 1.25rem; }
  table { border-collapse: collapse; width: 100%; margin-top: 16px; font-size: 0.9rem; }
  th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
  th { background: #f1f5f9; }
  .meta { color: #64748b; font-size: 0.85rem; }
</style></head><body>
  <h1>Chemical procurement request</h1>
  <p class="meta">${escapeHtml(labName)} · ${new Date().toLocaleString()}${requester ? ' · ' + escapeHtml(requester) : ''}</p>
  <p>Please process the following vendor-agnostic order lines (lab chooses supplier).</p>
  <table>
    <thead><tr>
      <th>Chemical</th><th>CAS</th><th>On hand</th><th>Min</th><th>Suggested order</th><th>Preferred supplier</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="6">No lines</td></tr>'}</tbody>
  </table>
  <p class="meta" style="margin-top:24px">Generated by Lab Chemical Inventory — not tied to a single marketplace.</p>
  <script>window.onload=()=>window.print()</script>
</body></html>`
}

/** Flammable-ish class tokens for room volume rollup */
export const FLAMMABLE_CLASS_HINTS = [
  'flammable',
  'flammable liquid',
  'flammable solid',
  'organic solvent',
  'solvent',
]

/**
 * Sum quantities by location for classes matching hints (naive unit-agnostic total)
 */
export function roomHazardTotals(chemicals, getClasses, hints = FLAMMABLE_CLASS_HINTS) {
  const byRoom = {}
  for (const c of chemicals || []) {
    if (c.archived) continue
    const classes = (getClasses(c) || []).map((x) => String(x).toLowerCase())
    const hit = hints.some((h) => classes.some((cl) => cl.includes(h)))
    if (!hit) continue
    const loc = String(c.location || 'Unassigned')
    const room = loc.split('/').slice(0, 2).join('/').trim() || loc
    if (!byRoom[room]) byRoom[room] = { room, total: 0, unit: c.unit || '', items: [] }
    byRoom[room].total += Number(c.quantity) || 0
    byRoom[room].items.push({ name: c.name, qty: c.quantity, unit: c.unit })
  }
  return Object.values(byRoom).sort((a, b) => b.total - a.total)
}


/**
 * Emergency binder HTML — one page per room group for responders
 */
export function buildEmergencyBinderHtml(chemicals, { title = 'Emergency chemical list' } = {}) {
  const active = (chemicals || []).filter((c) => !c.archived)
  const byRoom = {}
  for (const c of active) {
    const loc = String(c.location || 'Unassigned')
    const room = loc.split('/').slice(0, 2).join(' / ').trim() || loc
    if (!byRoom[room]) byRoom[room] = []
    byRoom[room].push(c)
  }
  const rooms = Object.keys(byRoom).sort()
  const sections = rooms
    .map((room) => {
      const rows = byRoom[room]
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
        .map((c) => {
          const hazards = Array.isArray(c.hazard_symbols)
            ? c.hazard_symbols.join(', ')
            : c.hazard_notes || ''
          return `<tr>
            <td>${esc(c.name)}</td>
            <td>${esc(c.cas_number || '')}</td>
            <td>${esc(String(c.quantity ?? ''))} ${esc(c.unit || '')}</td>
            <td>${esc(c.location || '')}</td>
            <td>${esc(hazards)}</td>
            <td>${c.sds_url || c.sds_filename ? 'Yes' : 'No'}</td>
          </tr>`
        })
        .join('')
      return `<h2>${esc(room)}</h2>
        <table><thead><tr>
          <th>Name</th><th>CAS</th><th>Qty</th><th>Location</th><th>Hazards</th><th>SDS</th>
        </tr></thead><tbody>${rows}</tbody></table>`
    })
    .join('')
  return `<!DOCTYPE html><html><head><title>${esc(title)}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a;font-size:11pt}
  h1{font-size:1.35rem;margin:0 0 6px}
  h2{font-size:1.05rem;margin:22px 0 8px;border-bottom:2px solid #1e4fd6;padding-bottom:4px}
  .meta{color:#64748b;font-size:0.85rem;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;margin-bottom:8px}
  th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#f1f5f9}
  @media print{body{padding:12px} .no-print{display:none}}
</style></head><body>
  <h1>${esc(title)}</h1>
  <p class="meta">Generated ${new Date().toLocaleString()} · For emergency response — verify with current SDS and institutional plan.</p>
  <p class="no-print"><button onclick="window.print()">Print / Save PDF</button></p>
  ${sections || '<p>No active chemicals.</p>'}
</body></html>`
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Demo lab chemicals for empty workspaces */
export function getDemoChemicals() {
  const day = new Date().toISOString().slice(0, 10)
  return [
    {
      name: 'Acetone',
      cas_number: '67-64-1',
      quantity: 2.5,
      unit: 'L',
      location: 'Main / Lab A / Flammables / Shelf 1',
      chemical_classes: ['Flammable liquid', 'Organic solvent'],
      hazard_symbols: ['flame'],
      min_stock: 1,
      supplier: 'Demo Supplier',
      barcode: 'DEMO-ACETONE-001',
      sds_url: 'https://pubchem.ncbi.nlm.nih.gov/compound/180',
      date_received: day,
      lifecycle_status: 'in_stock',
      provisional: false,
    },
    {
      name: 'Sodium chloride',
      cas_number: '7647-14-5',
      quantity: 500,
      unit: 'g',
      location: 'Main / Lab A / General / Shelf 2',
      chemical_classes: ['Aqueous solution'],
      min_stock: 100,
      supplier: 'Demo Supplier',
      barcode: 'DEMO-NACL-001',
      sds_url: 'https://pubchem.ncbi.nlm.nih.gov/compound/5234',
      date_received: day,
      lifecycle_status: 'in_stock',
    },
    {
      name: 'Hydrogen peroxide 30%',
      cas_number: '7722-84-1',
      quantity: 500,
      unit: 'mL',
      location: 'Main / Lab A / Oxidizers / Cabinet 1',
      chemical_classes: ['Oxidizer'],
      hazard_symbols: ['flame_over_circle'],
      min_stock: 100,
      barcode: 'DEMO-H2O2-001',
      sds_url: 'https://pubchem.ncbi.nlm.nih.gov/compound/784',
      date_received: day,
      lifecycle_status: 'in_stock',
    },
  ]
}

/** Offline usage queue helpers */
export const OFFLINE_USAGE_KEY = 'lci_offline_usage_queue_v1'

export function loadOfflineUsageQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_USAGE_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function saveOfflineUsageQueue(arr) {
  try {
    localStorage.setItem(OFFLINE_USAGE_KEY, JSON.stringify((arr || []).slice(0, 100)))
  } catch {
    /* ignore */
  }
}

export function enqueueOfflineUsage(entry) {
  const q = loadOfflineUsageQueue()
  q.unshift({ ...entry, queued_at: new Date().toISOString(), id: `off-${Date.now()}` })
  saveOfflineUsageQueue(q)
  return q
}

/** Simple GHS label HTML for public tool / print */
export function buildGhsLabelHtml({ name, cas, signal, pictograms = [] }) {
  const pics = (pictograms || [])
    .map((p) => `<span class="picto">${esc(p)}</span>`)
    .join(' ')
  return `<!DOCTYPE html><html><head><title>GHS label</title>
<style>
  body{font-family:system-ui,sans-serif;padding:24px}
  .label{width:4in;border:2px solid #0f172a;padding:12px;border-radius:4px}
  .name{font-size:14pt;font-weight:700}
  .cas{font-size:10pt;color:#334155;margin-top:4px}
  .signal{display:inline-block;margin-top:8px;padding:2px 8px;background:#0f172a;color:#fff;font-weight:700;font-size:10pt}
  .pics{margin-top:10px;font-size:12pt}
  .note{margin-top:10px;font-size:8pt;color:#64748b}
</style></head><body>
  <div class="label">
    <div class="name">${esc(name || 'Chemical')}</div>
    <div class="cas">CAS ${esc(cas || '—')}</div>
    ${signal ? `<div class="signal">${esc(signal)}</div>` : ''}
    <div class="pics">${pics || '—'}</div>
    <div class="note">Educational GHS-style label · Confirm against manufacturer SDS</div>
  </div>
  <p><button onclick="window.print()">Print</button></p>
</body></html>`
}


/** Queue a scan-based usage action for later sync (includes quantity update) */
export function enqueueOfflineScanLog({
  chemical,
  type = 'take',
  quantity = 1,
  user_email = null,
  organization_id = null,
}) {
  const amount = Number(quantity) || 1
  const before = Number(chemical?.quantity || 0)
  const change = type === 'return' ? amount : -amount
  const after = Math.max(0, before + change)
  const entry = {
    kind: 'scan_usage',
    payload: {
      chemical_id: chemical.id,
      chemical_name: chemical.name,
      type,
      quantity_change: change,
      quantity_before: before,
      quantity_after: after,
      unit: chemical.unit,
      notes: 'Offline scan log',
      user_email,
      organization_id,
      // enough to PATCH quantity when back online
      _chemical_snapshot: {
        id: chemical.id,
        quantity: after,
      },
    },
  }
  return enqueueOfflineUsage(entry)
} 