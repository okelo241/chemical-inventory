import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import './App.css'

const HAZARD_OPTIONS = [
  { id: 'explosive', label: 'Explosive', emoji: '💥' },
  { id: 'flammable', label: 'Flammable', emoji: '🔥' },
  { id: 'oxidizing', label: 'Oxidizing', emoji: '⚗️' },
  { id: 'gas', label: 'Compressed Gas', emoji: '🧴' },
  { id: 'corrosive', label: 'Corrosive', emoji: '🧪' },
  { id: 'toxic', label: 'Toxic', emoji: '☠️' },
  { id: 'harmful', label: 'Harmful / Irritant', emoji: '⚠️' },
  { id: 'health', label: 'Health Hazard', emoji: '🫁' },
  { id: 'environmental', label: 'Environmental', emoji: '🌍' },
]

function App() {
  const [session, setSession] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

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

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light')

  // Auth
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
  }

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3500)
  }

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  // API
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
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

  // Filtering + Search (improved)
  const isExpired = (c) => c.expiry_date && new Date(c.expiry_date) < new Date()
  const isLow = (c) => c.quantity <= c.min_stock
  const isExpiringSoon = (c) => {
    if (!c.expiry_date) return false
    const diff = (new Date(c.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)
    return diff > 0 && diff <= 30
  }

  let filtered = chemicals.filter(c => {
    const q = search.toLowerCase()
    const matchesSearch =
      c.name.toLowerCase().includes(q) ||
      (c.cas_number && c.cas_number.toLowerCase().includes(q)) ||
      (c.molecular_formula && c.molecular_formula.toLowerCase().includes(q)) ||
      (c.hazard_notes && c.hazard_notes.toLowerCase().includes(q))

    if (filter === 'low') return matchesSearch && isLow(c)
    if (filter === 'expired') return matchesSearch && isExpired(c)
    if (filter === 'soon') return matchesSearch && isExpiringSoon(c)
    return matchesSearch
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

  if (loadingAuth) {
    return (
      <div className="loading" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (!session) {
    return <Login onLogin={setSession} />
  }

  return (
    <div className="app">
      {message && <div className={`toast ${message.type}`}>{message.text}</div>}

      <header className="header">
        <div>
          <h1>Chemical Inventory</h1>
          <p>Track chemicals • Stock levels • SDS files</p>
        </div>

        <div className="header-actions">
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {session.user.email}
          </span>
          <button className="btn btn-secondary" onClick={handleLogout}>Logout</button>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>
            + Add Chemical
          </button>
        </div>
      </header>

      <div className="toolbar">
        <div className="stats">
          <span className="stat-item">Total: <strong>{chemicals.length}</strong></span>
          <span className="stat-item">Showing: <strong>{filtered.length}</strong></span>
        </div>

        <input
          className="search"
          placeholder="Search name, CAS, formula, hazards..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="filters">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'low' ? 'active' : ''} onClick={() => setFilter('low')}>Low Stock</button>
          <button className={filter === 'soon' ? 'active' : ''} onClick={() => setFilter('soon')}>Expiring Soon</button>
          <button className={filter === 'expired' ? 'active' : ''} onClick={() => setFilter('expired')}>Expired</button>
        </div>

        <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="name">Sort by Name</option>
          <option value="quantity">Sort by Quantity</option>
          <option value="expiry">Sort by Expiry</option>
        </select>
      </div>

      {showForm && (
        <div className="card form-card">
          <h2>{editingId ? 'Edit Chemical' : 'Add New Chemical'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Name *</label>
                <input name="name" value={formData.name} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>CAS Number</label>
                <input name="cas_number" value={formData.cas_number} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Molecular Formula</label>
                <input name="molecular_formula" value={formData.molecular_formula} onChange={handleChange} placeholder="e.g. H2SO4" />
              </div>
              <div className="form-group">
                <label>Quantity</label>
                <input name="quantity" type="number" step="0.01" value={formData.quantity} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Unit</label>
                <select name="unit" value={formData.unit} onChange={handleChange}>
                  <option value="g">g</option>
                  <option value="mg">mg</option>
                  <option value="kg">kg</option>
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                </select>
              </div>
              <div className="form-group">
                <label>Location</label>
                <input name="location" value={formData.location} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Expiry Date</label>
                <input name="expiry_date" type="date" value={formData.expiry_date} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Min Stock Level</label>
                <input name="min_stock" type="number" step="0.01" value={formData.min_stock} onChange={handleChange} />
              </div>
              <div className="form-group full">
                <label>Hazard Notes</label>
                <input name="hazard_notes" value={formData.hazard_notes} onChange={handleChange} />
              </div>
            </div>

            {/* Hazard Symbols */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '10px', display: 'block' }}>
                Hazard Symbols
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {HAZARD_OPTIONS.map(h => (
                  <button
                    type="button"
                    key={h.id}
                    onClick={() => toggleHazard(h.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: formData.hazard_symbols?.includes(h.id) ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: formData.hazard_symbols?.includes(h.id) ? 'rgba(37,99,235,0.1)' : 'var(--card)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>{h.emoji}</span> {h.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Update Chemical' : 'Save Chemical'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading chemicals...</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Formula</th>
                <th>CAS</th>
                <th>Quantity</th>
                <th>Location</th>
                <th>Expiry</th>
                <th>Hazards</th>
                <th>Status</th>
                <th>SDS</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="10" className="empty">
                    <div className="empty-state">
                      <p>No chemicals found</p>
                      <span>Try changing the search or filter, or add a new chemical.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(chem => {
                  const expired = isExpired(chem)
                  const low = isLow(chem)
                  const soon = isExpiringSoon(chem)

                  return (
                    <tr key={chem.id} className={expired ? 'row-expired' : low ? 'row-low' : soon ? 'row-soon' : ''}>
                      <td>
                        <strong>{chem.name}</strong>
                        {chem.hazard_notes && <div className="hazard">{chem.hazard_notes}</div>}
                      </td>
                      <td>{chem.molecular_formula || '—'}</td>
                      <td>{chem.cas_number || '—'}</td>
                      <td>{chem.quantity} {chem.unit}</td>
                      <td>{chem.location || '—'}</td>
                      <td>{chem.expiry_date || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {(chem.hazard_symbols || []).map(id => {
                            const h = HAZARD_OPTIONS.find(x => x.id === id)
                            return h ? <span key={id} title={h.label}>{h.emoji}</span> : null
                          })}
                        </div>
                      </td>
                      <td>
                        {expired ? <span className="badge badge-red">Expired</span> :
                         low ? <span className="badge badge-orange">Low Stock</span> :
                         soon ? <span className="badge badge-yellow">Expiring Soon</span> :
                         <span className="badge badge-green">OK</span>}
                      </td>
                      <td className="sds-cell">
                        {chem.sds_filename ? (
                          <div className="sds-info">
                            <div className="sds-filename">{chem.sds_filename.split('/').pop()}</div>
                            <div className="sds-actions">
                              <button className="sds-link" onClick={() => handleDownloadSds(chem.id)}>Download</button>
                              <label className="upload-btn replace-btn">
                                Replace
                                <input type="file" accept=".pdf" hidden onChange={(e) => e.target.files[0] && handleSdsUpload(chem.id, e.target.files[0])} />
                              </label>
                            </div>
                          </div>
                        ) : (
                          <label className="upload-btn">
                            Upload SDS
                            <input type="file" accept=".pdf" hidden onChange={(e) => e.target.files[0] && handleSdsUpload(chem.id, e.target.files[0])} />
                          </label>
                        )}
                      </td>
                      <td className="actions">
                        <button className="btn-sm" onClick={() => handleEdit(chem)}>Edit</button>
                        <button className="btn-sm btn-danger" onClick={() => handleDelete(chem.id, chem.name)}>Delete</button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default App