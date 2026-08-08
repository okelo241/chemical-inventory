import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Landing from './Landing'
import './App.css'

const HAZARD_OPTIONS = [
  { id: 'explosive', label: 'Explosive', emoji: '💥' },
  { id: 'flammable', label: 'Flammable', emoji: '🔥' },
  { id: 'oxidizing', label: 'Oxidizing', emoji: '⚗️' },
  { id: 'gas', label: 'Compressed Gas', emoji: '🧴' },
  { id: 'corrosive', label: 'Corrosive', emoji: '🧪' },
  { id: 'toxic', label: 'Toxic', emoji: '☠️' },
  { id: 'harmful', label: 'Harmful', emoji: '⚠️' },
  { id: 'health', label: 'Health Hazard', emoji: '🫁' },
  { id: 'environmental', label: 'Environmental', emoji: '🌍' },
]

function App() {
  const [session, setSession] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [showLogin, setShowLogin] = useState(false)

  const [chemicals, setChemicals] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')

  const [formData, setFormData] = useState({
    name: '',
    cas_number: '',
    quantity: '',
    unit: 'g',
    location: '',
    expiry_date: '',
    min_stock: '',
    hazard_notes: '',
    molecular_formula: '',
    hazard_symbols: []
  })

  const API_URL = import.meta.env.VITE_API_URL

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoadingAuth(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setChemicals([])
    setShowLogin(false)
  }

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3500)
  }

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  const fetchChemicals = async () => {
    try {
      setLoading(true)
      const token = await getAccessToken()
      const res = await fetch(`${API_URL}/chemicals`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setChemicals(data)
    } catch (err) {
      showMessage('error', 'Could not load chemicals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) fetchChemicals()
  }, [session])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const toggleHazard = (id) => {
    setFormData(prev => {
      const current = prev.hazard_symbols || []
      if (current.includes(id)) {
        return { ...prev, hazard_symbols: current.filter(h => h !== id) }
      }
      return { ...prev, hazard_symbols: [...current, id] }
    })
  }

  const resetForm = () => {
    setFormData({
      name: '', cas_number: '', quantity: '', unit: 'g', location: '',
      expiry_date: '', min_stock: '', hazard_notes: '', molecular_formula: '', hazard_symbols: []
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const token = await getAccessToken()
    const payload = {
      name: formData.name,
      cas_number: formData.cas_number || null,
      quantity: parseFloat(formData.quantity) || 0,
      unit: formData.unit,
      location: formData.location || null,
      expiry_date: formData.expiry_date || null,
      min_stock: parseFloat(formData.min_stock) || 0,
      hazard_notes: formData.hazard_notes || null,
      molecular_formula: formData.molecular_formula || null,
      hazard_symbols: formData.hazard_symbols.length > 0 ? formData.hazard_symbols : null
    }

    try {
      const url = editingId ? `${API_URL}/chemicals/${editingId}` : `${API_URL}/chemicals`
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error()
      showMessage('success', editingId ? 'Chemical updated' : 'Chemical added')
      resetForm()
      fetchChemicals()
    } catch (err) {
      showMessage('error', 'Something went wrong')
    }
  }

  const handleEdit = (chem) => {
    setFormData({
      name: chem.name || '',
      cas_number: chem.cas_number || '',
      quantity: chem.quantity || '',
      unit: chem.unit || 'g',
      location: chem.location || '',
      expiry_date: chem.expiry_date || '',
      min_stock: chem.min_stock || '',
      hazard_notes: chem.hazard_notes || '',
      molecular_formula: chem.molecular_formula || '',
      hazard_symbols: chem.hazard_symbols || []
    })
    setEditingId(chem.id)
    setShowForm(true)
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return
    const token = await getAccessToken()
    try {
      await fetch(`${API_URL}/chemicals/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      showMessage('success', `"${name}" deleted`)
      fetchChemicals()
    } catch (err) {
      showMessage('error', 'Failed to delete')
    }
  }

  const handleSdsUpload = async (id, file) => {
    const token = await getAccessToken()
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch(`${API_URL}/chemicals/${id}/upload-sds`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      })
      if (!res.ok) throw new Error()
      showMessage('success', 'SDS uploaded')
      fetchChemicals()
    } catch (err) {
      showMessage('error', 'Upload failed')
    }
  }

  const handleDownloadSds = async (id) => {
    const token = await getAccessToken()
    try {
      const res = await fetch(`${API_URL}/chemicals/${id}/sds`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.url) window.open(data.url, '_blank')
      else showMessage('error', 'File not found')
    } catch (err) {
      showMessage('error', 'Download failed')
    }
  }

  const isExpired = (c) => c.expiry_date && new Date(c.expiry_date) < new Date()
  const isLow = (c) => c.quantity <= c.min_stock
  const isExpiringSoon = (c) => {
    if (!c.expiry_date) return false
    const diff = (new Date(c.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)
    return diff > 0 && diff <= 30
  }

  let filtered = chemicals.filter(c => {
    const q = search.toLowerCase()
    const matches =
      c.name.toLowerCase().includes(q) ||
      (c.cas_number && c.cas_number.toLowerCase().includes(q)) ||
      (c.molecular_formula && c.molecular_formula.toLowerCase().includes(q)) ||
      (c.hazard_notes && c.hazard_notes.toLowerCase().includes(q))

    if (filter === 'low') return matches && isLow(c)
    if (filter === 'expired') return matches && isExpired(c)
    if (filter === 'soon') return matches && isExpiringSoon(c)
    return matches
  })

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'quantity') return b.quantity - a.quantity
    if (sortBy === 'expiry') {
      if (!a.expiry_date) return 1
      if (!b.expiry_date) return -1
      return new Date(a.expiry_date) - new Date(b.expiry_date)
    }
    return 0
  })

  // ========== RENDER ==========
  if (loadingAuth) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (!session) {
    if (!showLogin) return <Landing onGetStarted={() => setShowLogin(true)} />
    return <Login onLogin={setSession} />
  }

  return (
    <div className="dashboard">
      {message && <div className={`toast ${message.type}`}>{message.text}</div>}

      {/* Top Bar */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="logo">🧪</div>
          <div>
            <h1>Chemical Inventory</h1>
            <p>{session.user.email}</p>
          </div>
        </div>

        <div className="topbar-right">
          <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="btn-outline" onClick={handleLogout}>Logout</button>
          <button className="btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>
            + Add Chemical
          </button>
        </div>
      </header>

      {/* Stats Row */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Total Chemicals</span>
          <span className="stat-value">{chemicals.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Showing</span>
          <span className="stat-value">{filtered.length}</span>
        </div>
        <div className="stat-card warning">
          <span className="stat-label">Low Stock</span>
          <span className="stat-value">{chemicals.filter(isLow).length}</span>
        </div>
        <div className="stat-card danger">
          <span className="stat-label">Expired</span>
          <span className="stat-value">{chemicals.filter(isExpired).length}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="controls">
        <input
          className="search-input"
          placeholder="Search by name, CAS, formula or hazard..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="filter-group">
          {['all', 'low', 'soon', 'expired'].map(f => (
            <button
              key={f}
              className={filter === f ? 'filter-btn active' : 'filter-btn'}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'low' ? 'Low Stock' : f === 'soon' ? 'Expiring Soon' : 'Expired'}
            </button>
          ))}
        </div>

        <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="name">Sort by Name</option>
          <option value="quantity">Sort by Quantity</option>
          <option value="expiry">Sort by Expiry</option>
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <div className="form-panel">
          <div className="form-header">
            <h2>{editingId ? 'Edit Chemical' : 'Add New Chemical'}</h2>
            <button className="close-btn" onClick={resetForm}>✕</button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label>Name *</label>
                <input name="name" value={formData.name} onChange={handleChange} required />
              </div>
              <div className="field">
                <label>CAS Number</label>
                <input name="cas_number" value={formData.cas_number} onChange={handleChange} />
              </div>
              <div className="field">
                <label>Molecular Formula</label>
                <input name="molecular_formula" value={formData.molecular_formula} onChange={handleChange} placeholder="e.g. H₂SO₄" />
              </div>
              <div className="field">
                <label>Quantity</label>
                <input name="quantity" type="number" step="0.01" value={formData.quantity} onChange={handleChange} />
              </div>
              <div className="field">
                <label>Unit</label>
                <select name="unit" value={formData.unit} onChange={handleChange}>
                  <option value="g">g</option>
                  <option value="mg">mg</option>
                  <option value="kg">kg</option>
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                </select>
              </div>
              <div className="field">
                <label>Location</label>
                <input name="location" value={formData.location} onChange={handleChange} />
              </div>
              <div className="field">
                <label>Expiry Date</label>
                <input name="expiry_date" type="date" value={formData.expiry_date} onChange={handleChange} />
              </div>
              <div className="field">
                <label>Min Stock</label>
                <input name="min_stock" type="number" step="0.01" value={formData.min_stock} onChange={handleChange} />
              </div>
              <div className="field full">
                <label>Hazard Notes</label>
                <input name="hazard_notes" value={formData.hazard_notes} onChange={handleChange} />
              </div>
            </div>

            <div className="hazards-section">
              <label>Hazard Symbols</label>
              <div className="hazard-pills">
                {HAZARD_OPTIONS.map(h => (
                  <button
                    type="button"
                    key={h.id}
                    className={formData.hazard_symbols?.includes(h.id) ? 'pill active' : 'pill'}
                    onClick={() => toggleHazard(h.id)}
                  >
                    {h.emoji} {h.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-outline" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn-primary">
                {editingId ? 'Update Chemical' : 'Save Chemical'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Chemicals List */}
      <div className="chemicals-panel">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading chemicals...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧪</div>
            <h3>No chemicals found</h3>
            <p>Try adjusting your search or filters, or add a new chemical.</p>
            <button className="btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>
              + Add Chemical
            </button>
          </div>
        ) : (
          <div className="chemicals-grid">
            {filtered.map(chem => {
              const expired = isExpired(chem)
              const low = isLow(chem)
              const soon = isExpiringSoon(chem)
              let status = 'ok'
              let statusLabel = 'OK'
              if (expired) { status = 'expired'; statusLabel = 'Expired' }
              else if (low) { status = 'low'; statusLabel = 'Low Stock' }
              else if (soon) { status = 'soon'; statusLabel = 'Expiring Soon' }

              return (
                <div key={chem.id} className={`chem-card status-${status}`}>
                  <div className="chem-card-header">
                    <div>
                      <h3>{chem.name}</h3>
                      {chem.molecular_formula && <span className="formula">{chem.molecular_formula}</span>}
                    </div>
                    <span className={`status-badge ${status}`}>{statusLabel}</span>
                  </div>

                  <div className="chem-meta">
                    <div><span>CAS</span><strong>{chem.cas_number || '—'}</strong></div>
                    <div><span>Qty</span><strong>{chem.quantity} {chem.unit}</strong></div>
                    <div><span>Location</span><strong>{chem.location || '—'}</strong></div>
                    <div><span>Expiry</span><strong>{chem.expiry_date || '—'}</strong></div>
                  </div>

                  {chem.hazard_symbols?.length > 0 && (
                    <div className="chem-hazards">
                      {chem.hazard_symbols.map(id => {
                        const h = HAZARD_OPTIONS.find(x => x.id === id)
                        return h ? <span key={id} title={h.label}>{h.emoji}</span> : null
                      })}
                    </div>
                  )}

                  {chem.hazard_notes && <p className="chem-notes">{chem.hazard_notes}</p>}

                  <div className="chem-actions">
                    <div className="sds-area">
                      {chem.sds_filename ? (
                        <>
                          <button className="link-btn" onClick={() => handleDownloadSds(chem.id)}>Download SDS</button>
                          <label className="link-btn">
                            Replace
                            <input type="file" accept=".pdf" hidden onChange={(e) => e.target.files[0] && handleSdsUpload(chem.id, e.target.files[0])} />
                          </label>
                        </>
                      ) : (
                        <label className="link-btn">
                          Upload SDS
                          <input type="file" accept=".pdf" hidden onChange={(e) => e.target.files[0] && handleSdsUpload(chem.id, e.target.files[0])} />
                        </label>
                      )}
                    </div>
                    <div className="action-btns">
                      <button className="icon-action" onClick={() => handleEdit(chem)}>Edit</button>
                      <button className="icon-action danger" onClick={() => handleDelete(chem.id, chem.name)}>Delete</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default App