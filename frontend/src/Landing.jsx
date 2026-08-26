import { useState, useEffect } from 'react'
import appLogo from './assets/logo.jpg'
import './App.css'

// Import pictograms – adjust paths if your folder structure is different
import ghs01 from './assets/Pictograms/exploding_bomb.gif'
import ghs02 from './assets/Pictograms/flame.gif'
import ghs03 from './assets/Pictograms/flame_over_circle.gif'
import ghs04 from './assets/Pictograms/gas_cylinder.gif'
import ghs05 from './assets/Pictograms/corrosion.gif'
import ghs06 from './assets/Pictograms/skull_and_crossbones.gif'
import ghs07 from './assets/Pictograms/exclamation_mark.gif'
import ghs08 from './assets/Pictograms/health_hazard.gif'
import ghs09 from './assets/Pictograms/GHS-pictogram-pollu.svg.webp'
import biohazard from './assets/Pictograms/biohazardous_infectious_materials.gif'


const FREE_COMPAT_RULES = [
  { a: 'Flammable liquid', b: 'Oxidizer', risk: 'High', reason: 'Fire / runaway oxidation risk — store apart' },
  { a: 'Flammable liquid', b: 'Mineral acid', risk: 'High', reason: 'Acids can generate heat/hydrogen with some organics' },
  { a: 'Oxidizer', b: 'Organic peroxide', risk: 'High', reason: 'Severe fire/explosion risk' },
  { a: 'Mineral acid', b: 'Cyanide', risk: 'High', reason: 'Toxic gas evolution possible' },
  { a: 'Mineral acid', b: 'Base', risk: 'Medium', reason: 'Exothermic neutralization — segregate concentrates' },
  { a: 'Water-reactive', b: 'Aqueous solution', risk: 'High', reason: 'Violent reaction with water/moisture' },
  { a: 'Flammable liquid', b: 'Pyrophoric', risk: 'High', reason: 'Extreme ignition risk' },
]

const FREE_CLASSES = [
  'Flammable liquid',
  'Oxidizer',
  'Mineral acid',
  'Base',
  'Organic peroxide',
  'Water-reactive',
  'Cyanide',
  'Aqueous solution',
  'Pyrophoric',
  'Toxic',
]


function FreeGhsLabelTool() {
  const [name, setName] = useState('Acetone')
  const [cas, setCas] = useState('67-64-1')
  const [signal, setSignal] = useState('Danger')
  const printLabel = () => {
    const html = `<!DOCTYPE html><html><head><title>GHS label</title>
<style>
body{font-family:system-ui,sans-serif;padding:24px}
.label{width:4in;border:2px solid #0f172a;padding:14px;border-radius:4px}
.name{font-size:16pt;font-weight:700}
.cas{font-size:11pt;color:#334155;margin-top:6px}
.signal{display:inline-block;margin-top:10px;padding:3px 10px;background:#0f172a;color:#fff;font-weight:700}
.note{margin-top:12px;font-size:8pt;color:#64748b}
</style></head><body>
<div class="label">
  <div class="name">${(name || 'Chemical').replace(/</g,'')}</div>
  <div class="cas">CAS ${(cas || '—').replace(/</g,'')}</div>
  <div class="signal">${(signal || '').replace(/</g,'')}</div>
  <div class="note">Educational secondary label · Verify against manufacturer SDS</div>
</div>
<p><button onclick="window.print()">Print</button></p>
</body></html>`
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
    }
  }
  return (
    <div className="free-tool-card">
      <div className="free-tool-grid">
        <label className="free-tool-field">
          <span>Chemical name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="free-tool-field">
          <span>CAS number</span>
          <input value={cas} onChange={(e) => setCas(e.target.value)} />
        </label>
      </div>
      <label className="free-tool-field" style={{ textAlign: 'left', marginBottom: 12 }}>
        <span>Signal word</span>
        <select value={signal} onChange={(e) => setSignal(e.target.value)}>
          <option>Danger</option>
          <option>Warning</option>
          <option value="">(none)</option>
        </select>
      </label>
      <button type="button" className="btn btn-primary" onClick={printLabel}>
        Print GHS-style label
      </button>
    </div>
  )
}

function FreeCompatTool({ onGetStarted }) {
  const [classA, setClassA] = useState('Flammable liquid')
  const [classB, setClassB] = useState('Oxidizer')
  const result = (() => {
    if (!classA || !classB || classA === classB) {
      return { risk: 'None', reason: 'Select two different classes to check.' }
    }
    for (const r of FREE_COMPAT_RULES) {
      if (
        (r.a === classA && r.b === classB) ||
        (r.a === classB && r.b === classA)
      ) {
        return r
      }
    }
    return {
      risk: 'Low / unknown',
      reason:
        'No high-priority rule in this simplified public checker. Still verify SDS Sections 7 & 10 and local EHS rules.',
    }
  })()

  const riskClass =
    result.risk === 'High' ? 'high' : result.risk === 'Medium' ? 'medium' : 'ok'

  return (
    <div className="free-tool-card">
      <div className="free-tool-grid">
        <label className="free-tool-field">
          <span>Class A</span>
          <select value={classA} onChange={(e) => setClassA(e.target.value)}>
            {FREE_CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="free-tool-field">
          <span>Class B</span>
          <select value={classB} onChange={(e) => setClassB(e.target.value)}>
            {FREE_CLASSES.map((c) => (
              <option key={`b-${c}`} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <div className={`free-tool-result free-tool-result--${riskClass}`}>
        <strong>{result.risk}</strong>
        <p>{result.reason}</p>
      </div>
      <p className="free-tool-footnote">
        Full inventory software (free) tracks every bottle, blocks high-risk co-storage, and logs usage for your lab.
      </p>
      <button type="button" className="btn btn-primary" onClick={() => onGetStarted?.('personal')}>
        Open free inventory →
      </button>
    </div>
  )
}

function Landing({ onGetStarted }) {
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved === 'dark' || saved === 'light') return saved
    } catch { /* ignore */ }
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('theme', theme)
    } catch { /* ignore */ }
  }, [theme])

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'theme' && (e.newValue === 'dark' || e.newValue === 'light')) {
        setTheme(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 500)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startWith = (intent = 'personal') => {
    try {
      localStorage.setItem(
        'workspaceIntent',
        JSON.stringify({
          type: intent === 'organization' ? 'organization' : 'personal',
          organizationName: '',
          organizationSlug: '',
          inviteToken: null,
          at: new Date().toISOString(),
        })
      )
      localStorage.setItem(
        'workspace',
        JSON.stringify(
          intent === 'organization'
            ? { mode: 'organization', organization_id: null }
            : { mode: 'personal', organization_id: null }
        )
      )
    } catch {
      /* ignore */
    }
    onGetStarted?.(intent)
  }

  return (
    <div className="landing">
      {/* ===================== NAVBAR ===================== */}
      <style>{`
        .landing-nav {
          position: sticky;
          top: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px 20px;
          flex-wrap: nowrap;
          padding: 12px 20px;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
          box-sizing: border-box;
          width: 100%;
        }
        .landing-nav .nav-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
          min-width: 0;
          text-decoration: none;
          color: #0f172a;
          font-weight: 700;
          font-size: 1.05rem;
          letter-spacing: -0.02em;
          z-index: 2;
        }
        .landing-nav .nav-brand .app-logo-img {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          object-fit: cover;
          flex-shrink: 0;
        }
        .landing-nav .nav-brand span {
          white-space: nowrap;
        }
        .landing-nav .nav-links {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 4px 14px;
          flex: 1 1 auto;
          min-width: 0;
          margin: 0;
          padding: 0 8px;
        }
        .landing-nav .nav-links a {
          color: #475569;
          text-decoration: none;
          font-size: 0.875rem;
          font-weight: 500;
          white-space: nowrap;
          padding: 6px 4px;
          border-radius: 6px;
        }
        .landing-nav .nav-links a:hover {
          color: #0f172a;
        }
        .landing-nav .nav-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          z-index: 2;
        }
        .landing-nav .nav-actions .btn {
          white-space: nowrap;
        }
        @media (max-width: 1100px) {
          .landing-nav {
            flex-wrap: wrap;
            row-gap: 10px;
          }
          .landing-nav .nav-links {
            order: 3;
            flex: 1 1 100%;
            justify-content: flex-start;
            padding: 4px 0 0;
            border-top: 1px solid rgba(15, 23, 42, 0.06);
            padding-top: 10px;
          }
        }
        @media (max-width: 640px) {
          .landing-nav .nav-links {
            gap: 2px 10px;
          }
          .landing-nav .nav-links a {
            font-size: 0.8rem;
          }
          .landing-nav .nav-brand span {
            font-size: 0.95rem;
          }
        }
      `}</style>
      <nav className="landing-nav" aria-label="Main">
        <div className="nav-brand">
          <img src={appLogo} alt="" className="app-logo-img" />
          <span>Chemical Inventory</span>
        </div>
        <div className="nav-links">
          <a href="#product">Product</a>
          <a href="#compat-tool">Free checker</a>
          <a href="#ghs-label-tool">GHS label</a>
          <a href="#features">Features</a>
          <a href="#storage-guide">Storage Guide</a>
          <a href="#safety-measures">Safety Measures</a>
          <a href="#ghs">GHS &amp; Hazards</a>
          <a href="#emergency">Emergency</a>
          <a href="#why">Why It Matters</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="nav-actions">
          <button
            type="button"
            className="btn btn-ghost theme-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle color theme"
            style={{ minWidth: 40, padding: '8px 10px' }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onGetStarted}>
            Log in
          </button>
          <button type="button" className="btn btn-primary" onClick={onGetStarted}>
            Get Started Free
          </button>
        </div>
      </nav>

      {/* ===================== HERO ===================== */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-content">
          <div className="hero-badge">Built for real laboratories · Chemists · Safety officers</div>
          <h1>
            Lab Chemical Inventory Software
            <br />
            <span className="gradient-text">Track stock, SDS, and hazards safely</span>
          </h1>
          <p className="hero-subtitle">
            Modern chemical inventory software that tracks every bottle, links SDS documents, flags
            incompatible storage, monitors expiry dates, and helps your lab stay aligned with GHS,
            OSHA laboratory practices, and good chemical hygiene.
          </p>
          <div className="hero-actions hero-actions--dual">
            <button
              type="button"
              className="btn btn-primary btn-xl"
              onClick={() => startWith('personal')}
            >
              Start personal inventory →
            </button>
            <button
              type="button"
              className="btn btn-outline btn-xl"
              onClick={() => startWith('organization')}
            >
              Set up a lab / organization
            </button>
          </div>
          <p className="hero-note">
            100% free right now · Individuals & lab teams · No credit card
          </p>
          <div className="hero-cta-pills">
            <button
              type="button"
              className="hero-pill"
              onClick={() =>
                document.getElementById('product')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              See product →
            </button>
            <button
              type="button"
              className="hero-pill hero-pill--ghost"
              onClick={() =>
                document.getElementById('safety-measures')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              Safety guidance
            </button>
          </div>
        </div>
      </section>

      {/* ===================== PRODUCT PREVIEW ===================== */}
      <section id="product" className="product-section">
        <div className="section-inner">
          <div className="section-header" style={{ textAlign: 'center' }}>
            <h2>See the product</h2>
            <p className="section-lead">
              Inventory, compliance, and org workspaces — designed for daily lab use, not spreadsheets.
            </p>
          </div>

          <div className="product-shots">
            <article className="product-shot">
              <div className="product-shot-frame">
                <img
                  className="product-shot-img"
                  src="/screenshots/inventory.png"
                  alt="Chemical inventory table with search, SDS, and actions"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const fb = e.currentTarget.nextElementSibling
                    if (fb) fb.hidden = false
                  }}
                />
                <div className="mock-window" hidden>
                  <div className="mock-titlebar">
                    <span /><span /><span />
                    <em>Inventory</em>
                  </div>
                  <div className="mock-body">
                    <div className="mock-stats">
                      <i /><i /><i /><i />
                    </div>
                    <div className="mock-toolbar" />
                    <div className="mock-table">
                      <div className="mock-row mock-row--head" />
                      <div className="mock-row" />
                      <div className="mock-row" />
                      <div className="mock-row" />
                    </div>
                  </div>
                </div>
              </div>
              <h3>Inventory table</h3>
              <p>Search, filter by hazard or SDS gaps, log usage, and keep actions in a clean row menu.</p>
            </article>

            <article className="product-shot">
              <div className="product-shot-frame">
                <img
                  className="product-shot-img"
                  src="/screenshots/compliance.png"
                  alt="Compliance workspace with SDS and peroxide watchlists"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const fb = e.currentTarget.nextElementSibling
                    if (fb) fb.hidden = false
                  }}
                />
                <div className="mock-window mock-window--compliance" hidden>
                  <div className="mock-titlebar">
                    <span /><span /><span />
                    <em>Compliance</em>
                  </div>
                  <div className="mock-body">
                    <div className="mock-chips">
                      <i className="on" /><i /><i />
                    </div>
                    <div className="mock-card" />
                    <div className="mock-card mock-card--sm" />
                  </div>
                </div>
              </div>
              <h3>Compliance workspace</h3>
              <p>Missing SDS, peroxide watch, CAS rollups, and exports for emergency readiness.</p>
            </article>

            <article className="product-shot">
              <div className="product-shot-frame">
                <img
                  className="product-shot-img"
                  src="/screenshots/organization.png"
                  alt="Organization workspace with members and invites"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const fb = e.currentTarget.nextElementSibling
                    if (fb) fb.hidden = false
                  }}
                />
                <div className="mock-window mock-window--org" hidden>
                  <div className="mock-titlebar">
                    <span /><span /><span />
                    <em>Organization</em>
                  </div>
                  <div className="mock-body">
                    <div className="mock-org-banner" />
                    <div className="mock-members">
                      <i /><i /><i />
                    </div>
                    <div className="mock-invite" />
                  </div>
                </div>
              </div>
              <h3>Lab / organization</h3>
              <p>Invite members, roles, shared inventory — personal collections stay private.</p>
            </article>
          </div>

          <div className="product-cta-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => startWith('personal')}
            >
              Continue as individual
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => startWith('organization')}
            >
              Continue as lab team
            </button>
          </div>
        </div>
      </section>


      {/* ===================== FREE COMPATIBILITY TOOL ===================== */}
      <section id="compat-tool" className="free-tool-section">
        <div className="section-inner">
          <div className="section-header" style={{ textAlign: 'center' }}>
            <p className="free-tool-badge">Free public tool · No account required</p>
            <h2>Chemical storage compatibility check</h2>
            <p className="section-lead">
              Pick two hazard classes. Get an instant advisory on whether they should share a cabinet.
              Educational guidance — always confirm with SDS and your Chemical Hygiene Plan.
            </p>
          </div>
          <FreeCompatTool onGetStarted={onGetStarted} />
        </div>
      </section>

      
      <section id="ghs-label-tool" className="free-tool-section">
        <div className="section-inner">
          <div className="section-header" style={{ textAlign: 'center' }}>
            <p className="free-tool-badge">Free public tool · No account required</p>
            <h2>GHS-style label helper</h2>
            <p className="section-lead">
              Enter a name and CAS to print a simple educational secondary label.
              Always match the manufacturer label and SDS for workplace use.
            </p>
          </div>
          <FreeGhsLabelTool />
        </div>
      </section>
{/* ===================== TRUST BAR ===================== */}
      <section className="trust-bar">
        <div className="trust-item">🔒 Private accounts</div>
        <div className="trust-item">📄 SDS linked to every record</div>
        <div className="trust-item">⚠️ GHS pictogram support</div>
        <div className="trust-item">🔔 Expiry & low-stock alerts</div>
        <div className="trust-item">🧪 Built for real labs</div>
      </section>

      {/* ===================== PROBLEM ===================== */}
      <section className="problem-section">
        <div className="section-inner">
          <h2>Why chemical management fails in most labs</h2>
          <p className="section-lead">
            Spreadsheets and paper lists cannot prevent the most common (and dangerous) mistakes.
          </p>
          <div className="problem-grid">
            <div className="problem-card">
              <div className="problem-icon">📄</div>
              <h3>Lost or outdated SDS</h3>
              <p>
                Safety Data Sheets live in email, shared drives, or binders. When you need them
                during an incident or inspection, they are often missing or obsolete.
              </p>
            </div>
            <div className="problem-card">
              <div className="problem-icon">⏰</div>
              <h3>Expired & degraded reagents</h3>
              <p>
                Without reliable expiry tracking, labs use compromised chemicals, waste money on
                replacements, and risk experimental failure or safety issues.
              </p>
            </div>
            <div className="problem-card">
              <div className="problem-icon">💥</div>
              <h3>Incompatible storage</h3>
              <p>
                Acids next to bases, oxidizers next to organics, or water-reactives near aqueous
                solutions create real fire, explosion, and toxic-gas risks.
              </p>
            </div>
            <div className="problem-card">
              <div className="problem-icon">🔍</div>
              <h3>No clear location map</h3>
              <p>
                Nobody knows which cabinet, shelf, or secondary container holds a specific bottle —
                especially during emergencies or audits.
              </p>
            </div>
            <div className="problem-card">
              <div className="problem-icon">📊</div>
              <h3>Impossible audits</h3>
              <p>
                Inspectors and safety officers need current inventories, hazard summaries, and proof
                of proper segregation. Spreadsheets rarely deliver this cleanly.
              </p>
            </div>
            <div className="problem-card">
              <div className="problem-icon">💰</div>
              <h3>Duplicate purchases & waste</h3>
              <p>
                Without visibility of existing stock, labs reorder chemicals they already own and
                discard large volumes of unused material.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <section className="how-section">
        <div className="section-inner">
          <h2>How it works</h2>
          <p className="section-lead">From empty lab to organized, searchable inventory in minutes</p>
          <div className="how-grid">
            <div className="how-step">
              <div className="how-number">1</div>
              <h3>Create your account</h3>
              <p>Sign up in seconds. Your inventory is private and only visible to you.</p>
            </div>
            <div className="how-step">
              <div className="how-number">2</div>
              <h3>Add your chemicals</h3>
              <p>Record name, CAS, formula, quantity, location, expiry, and GHS pictograms.</p>
            </div>
            <div className="how-step">
              <div className="how-number">3</div>
              <h3>Upload SDS files</h3>
              <p>Attach Safety Data Sheets so the correct document is always one click away.</p>
            </div>
            <div className="how-step">
              <div className="how-number">4</div>
              <h3>Stay in control</h3>
              <p>Search, filter, get expiry alerts, and keep a clear record for audits.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== FEATURES ===================== */}
      <section id="features" className="features-section">
        <div className="section-inner">
          <h2>Everything a modern lab needs</h2>
          <p className="section-lead">Designed around real chemical hygiene and inventory workflows</p>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📦</div>
              <h3>Container-level inventory</h3>
              <p>
                Track every bottle or drum by name, CAS number, formula, quantity, concentration,
                location, owner, lot, and status (in stock / reserved / expired / disposed).
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📄</div>
              <h3>SDS linked to every record</h3>
              <p>
                Upload or link Safety Data Sheets so the correct document is one click away from the
                chemical record — critical for inspections and emergencies.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚠️</div>
              <h3>GHS hazard & pictogram support</h3>
              <p>
                Mark chemicals with the correct GHS pictograms and hazard classes so visual
                identification of risks is immediate.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔔</div>
              <h3>Expiry & low-stock alerts</h3>
              <p>
                Automatic warnings when reagents approach expiry or fall below minimum stock levels
                — reduce waste and avoid last-minute shortages.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🗂️</div>
              <h3>Storage location hierarchy</h3>
              <p>
                Model your real lab: building → room → cabinet → shelf → secondary container. Know
                exactly where every item sits.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Private by design</h3>
              <p>
                Each account only sees its own inventory. Role-based access keeps data secure while
                allowing controlled sharing inside a group or institution.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔎</div>
              <h3>Powerful search</h3>
              <p>
                Find chemicals by name, synonym, CAS, formula, hazard notes, location, or custom tags
                in seconds.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📋</div>
              <h3>Audit-ready records</h3>
              <p>
                Maintain clear history of additions, movements, and disposals to support laboratory
                inspections and Chemical Hygiene Plan requirements.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== EXHAUSTIVE SAFETY MEASURES ===================== */}
      <section id="safety-measures" className="storage-section">
        <div className="section-inner">
          <div className="section-header">
            <h2>Exhaustive chemical safety measures</h2>
            <p className="section-lead">
              Practical controls used across university EHS programs, OSHA laboratory guidance, GHS
              hazard communication, and NFPA-aligned storage practice. Always verify with the current
              SDS (especially Sections 2, 4, 5, 6, 7, 8, 10, and 13) and your institutional Chemical
              Hygiene Plan.
            </p>
          </div>

          {/* Hierarchy of controls */}
          <div className="guide-block">
            <h3>Hierarchy of controls (apply in this order)</h3>
            <div className="principle-grid">
              <div className="principle-card">
                <strong>1. Elimination / substitution</strong>
                <p>
                  Remove the hazard when possible. Prefer less toxic solvents (e.g., safer alternatives
                  to benzene or chloroform where scientifically acceptable), smaller quantities, and
                  lower-concentration stock solutions.
                </p>
              </div>
              <div className="principle-card">
                <strong>2. Engineering controls</strong>
                <p>
                  Fume hoods, local exhaust, glove boxes, safety showers, eyewash stations, flammable
                  cabinets, secondary containment, interlocked equipment, and proper ventilation are
                  the primary physical barriers between people and chemicals.
                </p>
              </div>
              <div className="principle-card">
                <strong>3. Administrative controls</strong>
                <p>
                  SOPs, training, inventory systems, restricted access, buddy systems for high-risk
                  work, signage, work permits, and scheduled inspections reduce risk through process
                  and behavior.
                </p>
              </div>
              <div className="principle-card">
                <strong>4. Personal protective equipment (PPE)</strong>
                <p>
                  PPE is the last line of defense — not a substitute for engineering controls. Select
                  PPE from the SDS and task risk assessment; inspect before every use.
                </p>
              </div>
            </div>
          </div>

          {/* PPE */}
          <div className="guide-block">
            <h3>Personal protective equipment (PPE)</h3>
            <div className="principle-grid">
              <div className="principle-card">
                <strong>Eye & face protection</strong>
                <p>
                  Safety glasses with side shields for general lab work; chemical splash goggles when
                  pouring or heating liquids; face shields over goggles for large volumes, pressure
                  work, or highly corrosive materials. Contact lenses are discouraged where splash risk
                  is high.
                </p>
              </div>
              <div className="principle-card">
                <strong>Hand protection</strong>
                <p>
                  Match glove material to the chemical (nitrile, neoprene, butyl, PVA, etc.). No single
                  glove resists everything. Change gloves immediately after contamination; never reuse
                  disposable gloves. Check breakthrough times for aggressive solvents.
                </p>
              </div>
              <div className="principle-card">
                <strong>Body protection</strong>
                <p>
                  Buttoned lab coat (prefer flame-resistant for pyrophoric / large flammable work),
                  closed-toe shoes, long pants. Remove lab coats before leaving the lab. Aprons for
                  concentrated corrosives or large liquid transfers.
                </p>
              </div>
              <div className="principle-card">
                <strong>Respiratory protection</strong>
                <p>
                  Use only when engineering controls cannot keep exposures below limits. Requires
                  medical clearance, fit testing, and training. Cartridge type must match the chemical
                  family; replace on schedule.
                </p>
              </div>
            </div>
          </div>

          {/* Fume hoods */}
          <div className="guide-block">
            <h3>Fume hoods & ventilation</h3>
            <ul className="tips-list">
              <li>Work at least 15 cm (6 in) behind the sash plane; keep the sash as low as practical.</li>
              <li>Do not store chemicals permanently in the hood — it reduces airflow and increases fire load.</li>
              <li>Keep rear baffles and slots unobstructed; elevate large equipment on blocks if needed.</li>
              <li>Verify hood certification (face velocity typically ~0.4–0.6 m/s / 80–120 fpm for many general hoods — follow local standard).</li>
              <li>Never use a hood for waste accumulation or as a substitute for a flammable cabinet.</li>
              <li>For perchloric acid digestions, use a dedicated wash-down hood designed for that purpose.</li>
            </ul>
          </div>

          {/* Labeling */}
          <div className="guide-block">
            <h3>Labeling & hazard communication</h3>
            <ul className="tips-list">
              <li>Original manufacturer labels must remain legible; do not deface required GHS elements.</li>
              <li>
                Secondary containers need product identifier and hazard information (words, pictures,
                symbols, or a combination) consistent with workplace labeling rules.
              </li>
              <li>Date peroxide-formers on receipt and on first opening; record test or disposal dates.</li>
              <li>Label waste containers with contents, hazards, and accumulation start date.</li>
              <li>Keep SDS accessible for every hazardous chemical in the workplace (electronic systems are acceptable if reliable during emergencies).</li>
            </ul>
          </div>

          {/* Peroxides */}
          <div className="guide-block">
            <h3>Peroxide-forming chemicals</h3>
            <p className="block-intro">
              Ethers, THF, dioxane, secondary alcohols, and some unsaturated compounds can form explosive
              peroxides on aging, especially when opened and exposed to air/light.
            </p>
            <ul className="tips-list">
              <li>Buy the smallest practical size; prefer inhibitors when available.</li>
              <li>Store in airtight containers, away from light and heat; do not refrigerate in ways that allow moisture condensation into the bottle.</li>
              <li>Test on a documented schedule; dispose if visual crystals form or tests exceed limits — never distill to dryness.</li>
              <li>Do not open containers of unknown age that may contain crystalline peroxides — contact EHS.</li>
            </ul>
          </div>

          {/* Compressed gases */}
          <div className="guide-block">
            <h3>Compressed & liquefied gases</h3>
            <ul className="tips-list">
              <li>Secure cylinders upright with chains or straps at all times; caps on when not in use.</li>
              <li>Transport with carts designed for cylinders; never roll or drag by the valve.</li>
              <li>Separate fuel gases from oxidizing gases (commonly ≥6 m / 20 ft or a fire-rated barrier).</li>
              <li>Use compatible regulators only; never adapt fittings. Crack valves slowly.</li>
              <li>Toxic and pyrophoric gases require specialized cabinets, monitoring, and training.</li>
              <li>Empty and full cylinders should be marked and, where required, segregated.</li>
            </ul>
          </div>

          {/* Cryogens */}
          <div className="guide-block">
            <h3>Cryogens (LN₂, dry ice, etc.)</h3>
            <ul className="tips-list">
              <li>Use only approved containers (Dewars); never seal cryogens in closed bottles.</li>
              <li>Face shield + cryo gloves for transfers; loose clothing can trap liquid against skin.</li>
              <li>Ensure room oxygen monitoring where large volumes of inert cryogen can displace air.</li>
              <li>Never dispose of cryogens in sinks or closed trash; allow controlled evaporation in a safe area.</li>
            </ul>
          </div>

          {/* Waste */}
          <div className="guide-block">
            <h3>Chemical waste & disposal</h3>
            <ul className="tips-list">
              <li>Segregate waste streams (halogenated vs non-halogenated solvents, acids, bases, oxidizers, heavy metals, etc.).</li>
              <li>Never pour hazardous chemicals down the drain unless explicitly allowed by local rules and the SDS.</li>
              <li>Keep waste containers closed except when adding waste; secondary containment under liquid waste.</li>
              <li>Do not overfill; leave headspace. Incompatible wastes must never share a container.</li>
              <li>Follow institutional pickup schedules; label with constituents and approximate percentages.</li>
            </ul>
          </div>

          {/* Training & CHP */}
          <div className="guide-block">
            <h3>Training, Chemical Hygiene Plan & access</h3>
            <ul className="tips-list">
              <li>Lab workers need hazard communication training before unsupervised work with hazardous chemicals.</li>
              <li>High-hazard procedures (pyrophorics, HF, large-scale reactions, pressure work) need documented SOPs and often additional approval.</li>
              <li>Restrict access to toxic gas rooms, radiation areas, and select-agent spaces to authorized people.</li>
              <li>Maintain an up-to-date inventory as part of the Chemical Hygiene Plan and emergency planning.</li>
            </ul>
          </div>

          {/* Housekeeping */}
          <div className="guide-block tips-block">
            <h3>Housekeeping & daily discipline</h3>
            <ul className="tips-list">
              <li>Return chemicals to designated storage immediately after use.</li>
              <li>Keep bench tops clear of excess containers and clutter that blocks egress or hood airflow.</li>
              <li>Clean spills promptly using the correct kit; report larger incidents per SOP.</li>
              <li>No food, drink, cosmetics, or food storage in chemical areas or chemical refrigerators.</li>
              <li>Wash hands after removing gloves and before leaving the lab.</li>
              <li>Inspect cabinets for leaks, corrosion, illegible labels, and expired stock on a schedule.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ===================== CHEMICAL STORAGE GUIDE ===================== */}
      <section id="storage-guide" className="storage-section">
        <div className="section-inner">
          <div className="section-header">
            <h2>Chemical Storage Guide</h2>
            <p className="section-lead">
              Core principles used by university EHS departments and laboratory safety programs. Always
              verify with the specific Safety Data Sheet (Sections 7 &amp; 10) for any chemical.
            </p>
          </div>

          <div className="guide-block">
            <h3>Fundamental rules</h3>
            <div className="principle-grid">
              <div className="principle-card">
                <strong>1. Segregate by hazard class — never alphabetically</strong>
                <p>
                  Alphabetical storage routinely places incompatible materials next to each other (e.g.,
                  acetic acid beside acetone beside acetonitrile). First group by primary hazard, then
                  alphabetize within the compatible group.
                </p>
              </div>
              <div className="principle-card">
                <strong>2. Prioritize the most severe hazard</strong>
                <p>
                  When a chemical has multiple hazards, store it according to the highest-risk property
                  (typically: pyrophoric / water-reactive → flammable → oxidizer → corrosive → toxic).
                </p>
              </div>
              <div className="principle-card">
                <strong>3. Use secondary containment</strong>
                <p>
                  Liquids should sit in trays or bins capable of holding at least 110% of the largest
                  container. This contains spills and prevents mixing of incompatibles that share a
                  cabinet.
                </p>
              </div>
              <div className="principle-card">
                <strong>4. Keep flammables in approved cabinets</strong>
                <p>
                  Flammable and combustible liquids belong in NFPA 30-compliant flammable storage
                  cabinets, away from oxidizers, heat sources, and ignition sources.
                </p>
              </div>
              <div className="principle-card">
                <strong>5. Never store chemicals in fume hoods long-term</strong>
                <p>
                  Hoods are for active work. Permanent storage reduces airflow performance and increases
                  fire load.
                </p>
              </div>
              <div className="principle-card">
                <strong>6. Store liquids below eye level</strong>
                <p>Minimize the chance of facial exposure if a container is dropped or breaks.</p>
              </div>
            </div>
          </div>

          <div className="guide-block">
            <h3>Common laboratory storage groups</h3>
            <p className="block-intro">
              Many institutions use a set of compatible storage groups. Below is a practical synthesis of
              the most widely used schemes.
            </p>

            <div className="storage-groups">
              <div className="storage-group flammables">
                <div className="group-header">
                  <span className="group-badge">Flammables &amp; Combustibles</span>
                  <span className="group-tag">Highest priority for fire risk</span>
                </div>
                <p className="group-examples">
                  Acetone, ethanol, methanol, diethyl ether, hexane, toluene, THF, acetonitrile, many
                  organic solvents
                </p>
                <p className="group-store">
                  <strong>Store in:</strong> Approved flammable cabinet. Keep cool, away from ignition
                  sources.
                </p>
                <p className="group-away">
                  <strong>Keep away from:</strong> Oxidizers, oxidizing acids (nitric, perchloric),
                  reactive metals, heat.
                </p>
              </div>

              <div className="storage-group oxidizers">
                <div className="group-header">
                  <span className="group-badge">Oxidizers &amp; Peroxides</span>
                </div>
                <p className="group-examples">
                  Hydrogen peroxide, nitric acid, perchloric acid, sodium hypochlorite, potassium
                  permanganate, ammonium nitrate, chromates
                </p>
                <p className="group-store">
                  <strong>Store in:</strong> Dedicated area or oxidizer cabinet, cool and dry.
                </p>
                <p className="group-away">
                  <strong>Keep away from:</strong> All flammables, combustibles, organic materials,
                  reducing agents, and most acids (especially organic acids).
                </p>
              </div>

              <div className="storage-group acids">
                <div className="group-header">
                  <span className="group-badge">Inorganic Acids (non-oxidizing)</span>
                </div>
                <p className="group-examples">Hydrochloric acid, sulfuric acid, phosphoric acid</p>
                <p className="group-store">
                  <strong>Store in:</strong> Corrosive / acid cabinet with secondary containment. Prefer
                  non-metal shelving.
                </p>
                <p className="group-away">
                  <strong>Keep away from:</strong> Bases, cyanides, sulfides, active metals, flammables,
                  oxidizers.
                </p>
              </div>

              <div className="storage-group acids-ox">
                <div className="group-header">
                  <span className="group-badge">Oxidizing Acids</span>
                </div>
                <p className="group-examples">Nitric acid, perchloric acid, chromic acid</p>
                <p className="group-store">
                  <strong>Store in:</strong> Separate secondary containment, ideally isolated from other
                  acids.
                </p>
                <p className="group-away">
                  <strong>Keep away from:</strong> Organic acids, flammables, organics, bases, reducing
                  agents. Nitric + organics is a classic lab fire/explosion scenario.
                </p>
              </div>

              <div className="storage-group organic-acids">
                <div className="group-header">
                  <span className="group-badge">Organic Acids</span>
                </div>
                <p className="group-examples">
                  Acetic acid (glacial), formic acid, propionic acid, trifluoroacetic acid
                </p>
                <p className="group-store">
                  <strong>Store in:</strong> Acid cabinet or flammable cabinet (many are combustible)
                  with secondary containment.
                </p>
                <p className="group-away">
                  <strong>Keep away from:</strong> Oxidizing acids, strong oxidizers, bases, cyanides.
                </p>
              </div>

              <div className="storage-group bases">
                <div className="group-header">
                  <span className="group-badge">Bases (Inorganic &amp; Organic)</span>
                </div>
                <p className="group-examples">
                  Sodium hydroxide, potassium hydroxide, ammonium hydroxide, amines, ethanolamine
                </p>
                <p className="group-store">
                  <strong>Store in:</strong> Separate corrosive cabinet or clearly separated section from
                  acids.
                </p>
                <p className="group-away">
                  <strong>Keep away from:</strong> All acids, some metals, oxidizers.
                </p>
              </div>

              <div className="storage-group water-reactive">
                <div className="group-header">
                  <span className="group-badge">Water-Reactive &amp; Pyrophoric</span>
                </div>
                <p className="group-examples">
                  Sodium metal, lithium aluminum hydride, alkyl lithiums, calcium carbide, phosphorus
                  pentoxide, many metal hydrides
                </p>
                <p className="group-store">
                  <strong>Store in:</strong> Dry, cool location; often under inert atmosphere or in
                  desiccated cabinets. Specialized handling required.
                </p>
                <p className="group-away">
                  <strong>Keep away from:</strong> Water, aqueous solutions, humid air, oxidizers, and
                  virtually all other chemical classes.
                </p>
              </div>

              <div className="storage-group toxics">
                <div className="group-header">
                  <span className="group-badge">Highly Toxic / Poisons</span>
                </div>
                <p className="group-examples">
                  Cyanide salts, sulfide salts, mercury compounds, osmium tetroxide, many heavy-metal
                  salts
                </p>
                <p className="group-store">
                  <strong>Store in:</strong> Secure, limited-access location; often locked.
                </p>
                <p className="group-away">
                  <strong>Especially critical:</strong> Cyanides and sulfides must never contact acids
                  (release of HCN or H₂S).
                </p>
              </div>

              <div className="storage-group gases">
                <div className="group-header">
                  <span className="group-badge">Compressed Gases</span>
                </div>
                <p className="group-examples">
                  Fuel gases (hydrogen, acetylene, propane), oxidizing gases (oxygen, chlorine), inert
                  gases, toxic gases
                </p>
                <p className="group-store">
                  <strong>Store:</strong> Upright, secured with chains or straps, in well-ventilated
                  areas. Caps on when not in use.
                </p>
                <p className="group-away">
                  <strong>Keep:</strong> Oxidizing gases at least 20 ft from fuel gases (or separated by
                  a fire-rated barrier).
                </p>
              </div>
            </div>
          </div>

          <div className="guide-block incompatible-block">
            <h3>Never store these combinations together</h3>
            <p className="block-intro">
              These pairings are responsible for a large fraction of laboratory chemical incidents.
            </p>

            <div className="incompatible-table">
              <div className="incomp-row header">
                <div>Chemical A</div>
                <div></div>
                <div>Chemical B</div>
                <div>What can happen</div>
              </div>
              <div className="incomp-row">
                <div className="chem">Acids</div>
                <div className="vs">×</div>
                <div className="chem">Bases</div>
                <div className="reason">Violent neutralization, heat, splattering, possible container rupture</div>
              </div>
              <div className="incomp-row">
                <div className="chem">Acids</div>
                <div className="vs">×</div>
                <div className="chem">Cyanides or Sulfides</div>
                <div className="reason">Release of highly toxic HCN or H₂S gas</div>
              </div>
              <div className="incomp-row">
                <div className="chem">Oxidizers</div>
                <div className="vs">×</div>
                <div className="chem">Flammables / Organics</div>
                <div className="reason">Fire or explosion — oxidizer supplies oxygen to the fuel</div>
              </div>
              <div className="incomp-row">
                <div className="chem">Oxidizing acids (HNO₃, HClO₄)</div>
                <div className="vs">×</div>
                <div className="chem">Organic materials / solvents</div>
                <div className="reason">Rapid oxidation, fire, possible detonation</div>
              </div>
              <div className="incomp-row">
                <div className="chem">Water-reactive / Pyrophoric</div>
                <div className="vs">×</div>
                <div className="chem">Water or aqueous solutions</div>
                <div className="reason">Violent reaction, flammable gas release, fire</div>
              </div>
              <div className="incomp-row">
                <div className="chem">Chlorine / Hypochlorite (bleach)</div>
                <div className="vs">×</div>
                <div className="chem">Ammonia or Acids</div>
                <div className="reason">Toxic chloramine gases or chlorine gas</div>
              </div>
              <div className="incomp-row">
                <div className="chem">Peroxides / Organic peroxides</div>
                <div className="vs">×</div>
                <div className="chem">Metals, organics, heat, friction</div>
                <div className="reason">Explosion hazard — many form unstable crystals on aging</div>
              </div>
              <div className="incomp-row">
                <div className="chem">Flammable gases</div>
                <div className="vs">×</div>
                <div className="chem">Oxidizing gases</div>
                <div className="reason">Fire / explosion risk — maintain 20 ft separation or barrier</div>
              </div>
            </div>
          </div>

          <div className="guide-block tips-block">
            <h3>Practical laboratory tips</h3>
            <ul className="tips-list">
              <li>
                Date peroxide-forming solvents (ethers, THF, etc.) on receipt and on opening. Test or
                dispose before they become dangerous.
              </li>
              <li>
                Keep only the minimum quantity needed in the active lab area. Bulk storage belongs in
                dedicated chemical storage rooms when possible.
              </li>
              <li>Label every secondary container and every storage location with the hazard class present.</li>
              <li>Return chemicals to their designated storage location immediately after use.</li>
              <li>Inspect cabinets regularly for leaking containers, corrosion, and outdated labels.</li>
              <li>Never store food, beverages, or personal items in chemical refrigerators or freezers.</li>
              <li>
                When in doubt, consult the SDS (Section 7 Handling &amp; Storage and Section 10 Stability
                &amp; Reactivity) and your institutional Chemical Hygiene Officer.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ===================== EMERGENCY RESPONSE ===================== */}
      <section id="emergency" className="why-section">
        <div className="section-inner">
          <h2>Emergency readiness</h2>
          <p className="section-lead">
            Know locations of exits, eyewash, safety shower, spill kits, fire extinguishers, and SDS
            before you start work. Seconds matter.
          </p>
          <div className="why-grid">
            <div className="why-card">
              <h3>Spills</h3>
              <p>
                Alert others, control ignition sources if safe, and use the correct spill kit for the
                chemical class. Evacuate for large, toxic, or unknown spills. Never neutralize unknown
                mixtures without guidance.
              </p>
            </div>
            <div className="why-card">
              <h3>Skin / eye exposure</h3>
              <p>
                Flush with water at eyewash or safety shower for a full 15 minutes while removing
                contaminated clothing. Seek medical care and bring the SDS.
              </p>
            </div>
            <div className="why-card">
              <h3>Fire</h3>
              <p>
                Only fight very small fires if trained and safe; otherwise activate alarm, evacuate, and
                close doors. Know which extinguisher type matches the hazard (do not use water on many
                metal or oil fires).
              </p>
            </div>
            <div className="why-card">
              <h3>Exposure / inhalation</h3>
              <p>
                Move to fresh air, call emergency services for serious symptoms, and provide SDS to
                responders. Report all significant exposures per institutional policy.
              </p>
            </div>
            <div className="why-card">
              <h3>Inventory in emergencies</h3>
              <p>
                A current digital inventory with locations and hazards helps responders know what is in
                the room — one of the strongest operational reasons to maintain accurate records.
              </p>
            </div>
            <div className="why-card">
              <h3>After-action</h3>
              <p>
                Document incidents, restock kits, repair equipment, and update SOPs so the same failure
                mode is less likely next time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== GHS + BIOHAZARD SECTION ===================== */}
      <section id="ghs" className="ghs-section">
        <div className="section-inner">
          <div className="section-header">
            <h2>GHS Hazard Pictograms &amp; Biohazard</h2>
            <p className="section-lead">
              The Globally Harmonized System (GHS) uses nine standardized pictograms to communicate
              chemical hazards worldwide. A single substance may carry multiple pictograms. Your
              inventory should make these symbols immediately visible. We also include the widely
              recognized biohazard symbol used for biological risks in laboratories.
            </p>
          </div>

          <div className="ghs-intro-block">
            <h3>Why pictograms matter in chemical inventory</h3>
            <p>
              GHS pictograms appear on manufacturer labels and Safety Data Sheets. When you record a
              chemical in your inventory, associating the correct pictograms helps everyone in the lab
              instantly recognize the primary hazards — whether they are looking at a screen, a printed
              list, or a secondary container label you generate. This supports both daily safety and
              formal compliance with Hazard Communication requirements.
            </p>
          </div>

          <div className="ghs-grid-large">
            <div className="ghs-card-large">
              <div className="ghs-img-wrap">
                <img
                  src={ghs01}
                  alt="GHS01 Exploding Bomb – Explosive"
                  className="ghs-pictogram-img"
                />
              </div>
              <div className="ghs-code">GHS01</div>
              <h4>Exploding Bomb</h4>
              <p className="ghs-title">Explosive / Self-Reactive / Organic Peroxide</p>
              <ul className="ghs-details">
                <li>Unstable explosives</li>
                <li>Explosives (Divisions 1.1, 1.2, 1.3, 1.4)</li>
                <li>Self-reactive substances and mixtures (Types A, B)</li>
                <li>Organic peroxides (Types A, B)</li>
              </ul>
              <p className="ghs-note">
                Store away from heat, shock, friction and all other chemicals. Specialized magazines or
                cabinets required.
              </p>
            </div>

            <div className="ghs-card-large">
              <div className="ghs-img-wrap">
                <img src={ghs02} alt="GHS02 Flame – Flammable" className="ghs-pictogram-img" />
              </div>
              <div className="ghs-code">GHS02</div>
              <h4>Flame</h4>
              <p className="ghs-title">Flammable / Pyrophoric / Self-Heating / Emits Flammable Gas</p>
              <ul className="ghs-details">
                <li>Flammable gases, aerosols, liquids, solids</li>
                <li>Pyrophoric liquids and solids</li>
                <li>Self-heating substances</li>
                <li>Substances which in contact with water emit flammable gases</li>
                <li>Self-reactive substances and organic peroxides (less severe types)</li>
              </ul>
              <p className="ghs-note">
                Store in approved flammable cabinets. Keep away from oxidizers and ignition sources.
              </p>
            </div>

            <div className="ghs-card-large">
              <div className="ghs-img-wrap">
                <img
                  src={ghs03}
                  alt="GHS03 Flame over Circle – Oxidizer"
                  className="ghs-pictogram-img"
                />
              </div>
              <div className="ghs-code">GHS03</div>
              <h4>Flame over Circle</h4>
              <p className="ghs-title">Oxidizing</p>
              <ul className="ghs-details">
                <li>Oxidizing gases</li>
                <li>Oxidizing liquids</li>
                <li>Oxidizing solids</li>
              </ul>
              <p className="ghs-note">
                These materials can cause or intensify fire. Keep completely separated from flammables
                and combustibles.
              </p>
            </div>

            <div className="ghs-card-large">
              <div className="ghs-img-wrap">
                <img
                  src={ghs04}
                  alt="GHS04 Gas Cylinder – Gas under pressure"
                  className="ghs-pictogram-img"
                />
              </div>
              <div className="ghs-code">GHS04</div>
              <h4>Gas Cylinder</h4>
              <p className="ghs-title">Gases under Pressure</p>
              <ul className="ghs-details">
                <li>Compressed gases</li>
                <li>Liquefied gases</li>
                <li>Refrigerated liquefied gases</li>
                <li>Dissolved gases</li>
              </ul>
              <p className="ghs-note">
                Secure cylinders upright. Protect from heat. Separate fuel gases from oxidizing gases.
              </p>
            </div>

            <div className="ghs-card-large">
              <div className="ghs-img-wrap">
                <img src={ghs05} alt="GHS05 Corrosion" className="ghs-pictogram-img" />
              </div>
              <div className="ghs-code">GHS05</div>
              <h4>Corrosion</h4>
              <p className="ghs-title">Skin Corrosion / Eye Damage / Corrosive to Metals</p>
              <ul className="ghs-details">
                <li>Skin corrosion / burns</li>
                <li>Serious eye damage</li>
                <li>Corrosive to metals</li>
              </ul>
              <p className="ghs-note">
                Use secondary containment. Separate acids from bases. Prefer non-metal shelving for
                strong acids.
              </p>
            </div>

            <div className="ghs-card-large">
              <div className="ghs-img-wrap">
                <img
                  src={ghs06}
                  alt="GHS06 Skull and Crossbones – Toxic"
                  className="ghs-pictogram-img"
                />
              </div>
              <div className="ghs-code">GHS06</div>
              <h4>Skull and Crossbones</h4>
              <p className="ghs-title">Acute Toxicity (Fatal or Toxic)</p>
              <ul className="ghs-details">
                <li>Acute toxicity – Oral (Categories 1, 2, 3)</li>
                <li>Acute toxicity – Dermal (Categories 1, 2, 3)</li>
                <li>Acute toxicity – Inhalation (Categories 1, 2, 3)</li>
              </ul>
              <p className="ghs-note">
                Highly toxic materials. Restrict access. Never store cyanides or sulfides near acids.
              </p>
            </div>

            <div className="ghs-card-large">
              <div className="ghs-img-wrap">
                <img
                  src={ghs07}
                  alt="GHS07 Exclamation Mark – Harmful / Irritant"
                  className="ghs-pictogram-img"
                />
              </div>
              <div className="ghs-code">GHS07</div>
              <h4>Exclamation Mark</h4>
              <p className="ghs-title">Harmful / Irritant / Sensitizer</p>
              <ul className="ghs-details">
                <li>Acute toxicity (Category 4)</li>
                <li>Skin irritation / eye irritation</li>
                <li>Skin sensitization</li>
                <li>Specific target organ toxicity – single exposure (Category 3)</li>
                <li>Respiratory tract irritation, narcotic effects</li>
              </ul>
              <p className="ghs-note">
                Common on many laboratory reagents. Still requires proper PPE and good ventilation.
              </p>
            </div>

            <div className="ghs-card-large">
              <div className="ghs-img-wrap">
                <img src={ghs08} alt="GHS08 Health Hazard" className="ghs-pictogram-img" />
              </div>
              <div className="ghs-code">GHS08</div>
              <h4>Health Hazard</h4>
              <p className="ghs-title">Carcinogen / Mutagen / Reproductive Toxicity / STOT / Aspiration</p>
              <ul className="ghs-details">
                <li>Respiratory sensitization</li>
                <li>Germ cell mutagenicity</li>
                <li>Carcinogenicity</li>
                <li>Reproductive toxicity</li>
                <li>Specific target organ toxicity (single or repeated exposure)</li>
                <li>Aspiration hazard</li>
              </ul>
              <p className="ghs-note">
                Long-term or serious health effects. Minimize exposure and track usage carefully.
              </p>
            </div>

            <div className="ghs-card-large">
              <div className="ghs-img-wrap">
                <img
                  src={ghs09}
                  alt="GHS09 Environment – Aquatic Toxicity"
                  className="ghs-pictogram-img"
                />
              </div>
              <div className="ghs-code">GHS09</div>
              <h4>Environment</h4>
              <p className="ghs-title">Hazardous to the Aquatic Environment</p>
              <ul className="ghs-details">
                <li>Acute aquatic toxicity</li>
                <li>Chronic aquatic toxicity</li>
              </ul>
              <p className="ghs-note">
                Prevent release to drains and the environment. Follow local waste disposal rules
                strictly.
              </p>
            </div>

            <div className="ghs-card-large biohazard-card">
              <div className="ghs-img-wrap">
                <img src={biohazard} alt="Biohazard symbol" className="ghs-pictogram-img" />
              </div>
              <div className="ghs-code">BIOHAZARD</div>
              <h4>Biohazard</h4>
              <p className="ghs-title">Biological Hazard</p>
              <ul className="ghs-details">
                <li>Infectious agents</li>
                <li>Blood and body fluids</li>
                <li>Pathogenic microorganisms</li>
                <li>Genetically modified organisms (where applicable)</li>
                <li>Clinical and diagnostic specimens</li>
              </ul>
              <p className="ghs-note">
                Not part of the official GHS chemical system, but essential in any laboratory that
                handles biological materials. Use alongside chemical pictograms when both chemical and
                biological risks are present.
              </p>
            </div>
          </div>

          <div className="ghs-extra-info">
            <div className="ghs-info-card">
              <h3>How GHS works with your inventory</h3>
              <p>
                When you add a chemical, you can record the GHS pictograms that appear on its original
                label or SDS. This information then travels with the chemical record — appearing in
                search results, location lists, printed labels, and emergency reports.
              </p>
            </div>
            <div className="ghs-info-card">
              <h3>Multiple pictograms on one chemical</h3>
              <p>
                Many laboratory reagents carry more than one pictogram. For example, methanol typically
                shows Flame + Skull and Crossbones + Health Hazard. Your system should allow multiple
                selections so the full hazard profile is visible at a glance.
              </p>
            </div>
            <div className="ghs-info-card">
              <h3>Pictograms vs. storage groups</h3>
              <p>
                GHS pictograms communicate hazard type. Storage groups (flammables, oxidizers, acids,
                bases, etc.) tell you <em>where</em> and <em>with what</em> a chemical may be stored.
                Both are needed.
              </p>
            </div>
            <div className="ghs-info-card">
              <h3>Secondary container labeling</h3>
              <p>
                When you pour a chemical into a smaller bottle or wash bottle, hazard communication
                rules generally require the secondary container to communicate the hazards. Having
                pictograms already recorded in your inventory makes compliant secondary labels easier.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== WHY IT MATTERS ===================== */}
      <section id="why" className="why-section">
        <div className="section-inner">
          <h2>Why a proper chemical inventory system matters</h2>
          <div className="why-grid">
            <div className="why-card">
              <h3>Safety first</h3>
              <p>
                Clear knowledge of what is present, where it is, and what it is incompatible with
                dramatically reduces the chance of accidental mixing, fire, or toxic exposure.
              </p>
            </div>
            <div className="why-card">
              <h3>Regulatory readiness</h3>
              <p>
                OSHA’s Laboratory Standard (29 CFR 1910.1450) and Hazard Communication Standard expect
                laboratories to maintain chemical inventories and accessible SDS information. A digital
                system makes this practical.
              </p>
            </div>
            <div className="why-card">
              <h3>Cost control</h3>
              <p>
                Avoid buying duplicates, reduce expired waste, and optimize ordering based on real usage
                and stock levels.
              </p>
            </div>
            <div className="why-card">
              <h3>Emergency response</h3>
              <p>
                In an incident, responders and safety staff need immediate answers: what chemicals are
                involved, their hazards, and exact locations.
              </p>
            </div>
            <div className="why-card">
              <h3>Knowledge continuity</h3>
              <p>
                When people leave the lab, institutional memory of “what is where” disappears unless it
                is recorded in a shared, maintained system.
              </p>
            </div>
            <div className="why-card">
              <h3>Audit confidence</h3>
              <p>
                Inspections become far less stressful when you can produce current inventory lists,
                hazard summaries, and SDS access in minutes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== FAQ ===================== */}
      <section id="faq" className="faq-section">
        <div className="section-inner">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-grid">
            <div className="faq-item">
              <h3>Is it free?</h3>
              <p>
                Yes. You can create an account and start managing your chemicals at no cost for
                individual use.
              </p>
            </div>
            <div className="faq-item">
              <h3>Is my data private?</h3>
              <p>
                Yes. Each account only sees its own inventory. Organization workspaces share only within
                the members you invite.
              </p>
            </div>
            <div className="faq-item">
              <h3>Can I upload SDS files?</h3>
              <p>Yes. You can upload PDF Safety Data Sheets and download them whenever you need them.</p>
            </div>
            <div className="faq-item">
              <h3>Does it support GHS pictograms?</h3>
              <p>
                Yes. You can mark each chemical with the relevant GHS hazard pictograms so risks are
                visible at a glance.
              </p>
            </div>
            <div className="faq-item">
              <h3>Can I track expiry dates?</h3>
              <p>
                Yes. The system highlights chemicals that are expired or expiring within 30 days and can
                warn about low stock.
              </p>
            </div>
            <div className="faq-item">
              <h3>Who is this for?</h3>
              <p>
                Chemists, laboratory technicians, research groups, teaching labs, safety officers, and
                small production facilities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== FINAL CTA ===================== */}
      <section className="final-cta">
        <div className="cta-inner">
          <h2>Take control of your chemical inventory</h2>
          <p>
            Stop relying on spreadsheets and memory. Start with a system built for the way laboratories
            actually work — inventory, SDS, hazards, and safer storage decisions in one place.
          </p>
          <div className="final-cta-actions">
            <button
              type="button"
              className="btn btn-primary btn-xl"
              onClick={() => startWith('personal')}
            >
              Personal account
            </button>
            <button
              type="button"
              className="btn btn-outline btn-xl final-cta-outline"
              onClick={() => startWith('organization')}
            >
              Lab / organization
            </button>
          </div>
          <p className="cta-note">No credit card · Private accounts · Built for chemists</p>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span>🧪 Chemical Inventory</span>
            <p>Modern inventory &amp; safety tools for laboratories</p>
          </div>
          <div className="footer-links">
            <a href="#features">Features</a>
            <a href="#safety-measures">Safety Measures</a>
            <a href="#storage-guide">Storage Guide</a>
            <a href="#ghs">GHS</a>
            <a href="#emergency">Emergency</a>
            <a href="#faq">FAQ</a>
            <a href="#product">Product</a>
            <button type="button" className="footer-btn" onClick={() => startWith('personal')}>
              Get Started
            </button>
          </div>
        </div>
        <div className="footer-bottom">
          <p>
            © 2026 Chemical Inventory. Information on this page is educational and based on common
            laboratory safety guidance (GHS, typical OSHA laboratory / hazard communication practice,
            and widely used university EHS storage schemes). Always consult current SDS documents and
            your institutional Chemical Hygiene Plan for specific requirements. GHS pictograms are
            standardized under the Globally Harmonized System of Classification and Labelling of
            Chemicals.
          </p>
        </div>
      </footer>

      {/* ===================== BACK TO TOP ===================== */}
      {showBackToTop && (
        <button className="back-to-top" onClick={scrollToTop} title="Back to top">
          ↑
        </button>
      )}
    </div>
  )
}

export default Landing
