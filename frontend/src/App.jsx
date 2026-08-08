import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import './App.css'

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

  const [formData, setFormData] = useState({
    name: '',
    cas_number: '',
    quantity: '',
    unit: 'g',
    location: '',
    expiry_date: '',
    min_stock: '',
    hazard_notes: ''
  })

  const API_URL = import.meta.env.VITE_API_URL

  // ========== Auth ==========
  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoadingAuth(false)
    })

    // Listen for auth changes
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

  // ========== Helpers ==========
  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3500)
  }

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  // ========== API Calls ==========
  const fetchChemicals = async () => {
    try {
      setLoading(true)
      const token = await getAccessToken()
      const res = await fetch(`${API_URL}/chemicals`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      if (!res.ok) throw new Error('Failed to load chemicals')
      const data = await res.json()
      setChemicals(data)
    } catch (err) {
      console.error(err)
      showMessage('error', 'Could not load chemicals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchChemicals()
    }
  }, [session])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
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
      hazard_notes: ''
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
      hazard_notes: formData.hazard_notes || null
    }

    try {
      if (editingId) {
        const res = await fetch(`${API_URL}/chemicals/${editingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error()
        showMessage('success', 'Chemical updated successfully')
      } else {
        const res = await fetch(`${API_URL}/chemicals`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error()
        showMessage('success', 'Chemical added successfully')
      }
      resetForm()
      fetchChemicals()
    } catch (err) {
      showMessage('error', 'Something went wrong. Please try again.')
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
      hazard_notes: chem.hazard_notes || ''
    })
    setEditingId(chem.id)
    setShowForm(true)
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return
    const token = await getAccessToken()

    try {
      const res = await fetch(`${API_URL}/chemicals/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error()
      showMessage('success', `"${name}" deleted`)
      fetchChemicals()
    } catch (err) {
      showMessage('error', 'Failed to delete chemical')
    }
  }

  const handleSdsUpload = async (id, file) => {
    const token = await getAccessToken()
    const formDataUpload = new FormData()
    formDataUpload.append('file', file)

    try {
      const res = await fetch(`${API_URL}/chemicals/${id}/upload-sds`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formDataUpload
      })
      if (!res.ok) throw new Error()
      showMessage('success', 'SDS uploaded successfully')
      fetchChemicals()
    } catch (err) {
      showMessage('error', 'Failed to upload SDS')
    }
  }

  const handleDownloadSds = async (id) => {
    const token = await getAccessToken()
    try {
      const res = await fetch(`${API_URL}/chemicals/${id}/sds`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.url) {
        window.open(data.url, '_blank')
      } else {
        showMessage('error', 'Could not get SDS file')
      }
    } catch (err) {
      showMessage('error', 'Failed to download SDS')
    }
  }

  // ========== Filtering & Sorting ==========
  const isExpired = (chem) => chem.expiry_date && new Date(chem.expiry_date) < new Date()
  const isLow = (chem) => chem.quantity <= chem.min_stock
  const isExpiringSoon = (chem) => {
    if (!chem.expiry_date) return false
    const expiry = new Date(chem.expiry_date)
    const today = new Date()
    const diffDays = (expiry - today) / (1000 * 60 * 60 * 24)
    return diffDays > 0 && diffDays <= 30
  }

  let filteredChemicals = chemicals.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.cas_number && c.cas_number.includes(search))

    if (filter === 'low') return matchesSearch && isLow(c)
    if (filter === 'expired') return matchesSearch && isExpired(c)
    if (filter === 'soon') return matchesSearch && isExpiringSoon(c)
    return matchesSearch
  })

  filteredChemicals = [...filteredChemicals].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'quantity') return b.quantity - a.quantity
    if (sortBy === 'expiry') {
      if (!a.expiry_date) return 1
      if (!b.expiry_date) return -1
      return new Date(a.expiry_date) - new Date(b.expiry_date)
    }
    return 0
  })

  // ========== Render ==========
  if (loadingAuth) {
    return (
      <div className="loading" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (!session) {
    return <Login onLogin={(session) => setSession(session)} />
  }

  return (
    <div className="app">
      {message && (
        <div className={`toast ${message.type}`}>
          {message.text}
        </div>
      )}

      <header className="header">
        <div>
          <h1>Chemical Inventory</h1>
          <p>Track chemicals • Stock levels • SDS files</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: '#64748b' }}>
            {session.user.email}
          </span>
          <button className="btn btn-secondary" onClick={handleLogout}>
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

      <div className="toolbar">
        <div className="stats">
          <span className="stat-item">
            Total: <strong>{chemicals.length}</strong>
          </span>
          <span className="stat-item">
            Showing: <strong>{filteredChemicals.length}</strong>
          </span>
        </div>

        <input
          className="search"
          placeholder="Search by name or CAS..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="filters">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'low' ? 'active' : ''} onClick={() => setFilter('low')}>Low Stock</button>
          <button className={filter === 'soon' ? 'active' : ''} onClick={() => setFilter('soon')}>Expiring Soon</button>
          <button className={filter === 'expired' ? 'active' : ''} onClick={() => setFilter('expired')}>Expired</button>
        </div>

        <select
          className="sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
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
                <th>CAS</th>
                <th>Quantity</th>
                <th>Location</th>
                <th>Expiry</th>
                <th>Status</th>
                <th>SDS</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredChemicals.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty">
                    <div className="empty-state">
                      <p>No chemicals found</p>
                      <span>Try changing the search or filter, or add a new chemical.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredChemicals.map(chem => {
                  const expired = isExpired(chem)
                  const low = isLow(chem)
                  const soon = isExpiringSoon(chem)

                  return (
                    <tr
                      key={chem.id}
                      className={expired ? 'row-expired' : low ? 'row-low' : soon ? 'row-soon' : ''}
                    >
                      <td>
                        <strong>{chem.name}</strong>
                        {chem.hazard_notes && <div className="hazard">{chem.hazard_notes}</div>}
                      </td>
                      <td>{chem.cas_number || '—'}</td>
                      <td>{chem.quantity} {chem.unit}</td>
                      <td>{chem.location || '—'}</td>
                      <td>{chem.expiry_date || '—'}</td>
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
                        {chem.sds_filename ? (
                          <div className="sds-info">
                            <div className="sds-filename" title={chem.sds_filename}>
                              {chem.sds_filename.split('/').pop()}
                            </div>
                            <div className="sds-actions">
                              <button className="sds-link" onClick={() => handleDownloadSds(chem.id)}>
                                Download
                              </button>
                              <label className="upload-btn replace-btn">
                                Replace
                                <input
                                  type="file"
                                  accept=".pdf"
                                  hidden
                                  onChange={(e) => {
                                    if (e.target.files[0]) {
                                      handleSdsUpload(chem.id, e.target.files[0])
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        ) : (
                          <label className="upload-btn">
                            Upload SDS
                            <input
                              type="file"
                              accept=".pdf"
                              hidden
                              onChange={(e) => {
                                if (e.target.files[0]) {
                                  handleSdsUpload(chem.id, e.target.files[0])
                                }
                              }}
                            />
                          </label>
                        )}
                      </td>

                      <td className="actions">
                        <button className="btn-sm" onClick={() => handleEdit(chem)}>Edit</button>
                        <button className="btn-sm btn-danger" onClick={() => handleDelete(chem.id, chem.name)}>
                          Delete
                        </button>
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