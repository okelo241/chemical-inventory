import './App.css'

function Landing({ onGetStarted }) {
  return (
    <div className="landing colorful">
      {/* NAVBAR */}
      <nav className="landing-nav">
        <div className="nav-brand">🧪 Chemical Inventory</div>
        <div className="nav-actions">
          <button className="btn btn-secondary" onClick={onGetStarted}>Log in</button>
          <button className="btn btn-primary" onClick={onGetStarted}>Get Started</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero colorful-hero">
        <div className="hero-content">
          <div className="hero-badge">Built for Chemists & Laboratories</div>
          <h1>
            Organize Your Chemicals.<br />
            <span className="gradient-text">Stay Safe. Stay Ready.</span>
          </h1>
          <p className="hero-subtitle">
            The modern way to track inventory, manage SDS files, monitor expiry dates, 
            and avoid dangerous storage mistakes.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-large" onClick={onGetStarted}>
              Start Free →
            </button>
            <p className="hero-note">Free forever for individual use · No credit card</p>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="problem-section">
        <div className="section-inner">
          <h2>Why most labs struggle with chemical management</h2>
          <div className="problem-grid">
            <div className="problem-card color-1">
              <span className="problem-icon">📄</span>
              <h3>Lost SDS Files</h3>
              <p>Important safety documents scattered across folders, emails, and cabinets.</p>
            </div>
            <div className="problem-card color-2">
              <span className="problem-icon">⏰</span>
              <h3>Expired Reagents</h3>
              <p>Without tracking, labs waste money and risk using degraded chemicals.</p>
            </div>
            <div className="problem-card color-3">
              <span className="problem-icon">💥</span>
              <h3>Dangerous Storage</h3>
              <p>Incompatible chemicals stored together can cause fires or toxic reactions.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features">
        <div className="section-inner">
          <h2>Everything you need to manage chemicals properly</h2>
          <p className="section-subtitle">Designed specifically for real laboratory work</p>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📦</div>
              <h3>Smart Inventory</h3>
              <p>Track name, CAS, formula, quantity, location and minimum stock levels.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📄</div>
              <h3>SDS Management</h3>
              <p>Upload and access Safety Data Sheets instantly whenever you need them.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚠️</div>
              <h3>Hazard Symbols</h3>
              <p>Mark chemicals with GHS pictograms for clear visual hazard identification.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔔</div>
              <h3>Expiry & Stock Alerts</h3>
              <p>Get automatic warnings for low stock and chemicals expiring soon.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔍</div>
              <h3>Fast Search</h3>
              <p>Find any chemical by name, CAS number, formula or hazard notes in seconds.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Private & Secure</h3>
              <p>Each account only sees its own inventory. Your data stays protected.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== CHEMICAL STORAGE GUIDE ========== */}
      <section className="storage-guide">
        <div className="section-inner">
          <h2>Chemical Storage Guide</h2>
          <p className="section-subtitle">
            Know what can be stored together — and what must never be mixed
          </p>

          {/* Compatible */}
          <div className="storage-block compatible">
            <h3>✅ Generally Compatible Groups</h3>
            <p>These groups can usually be stored near each other when properly sealed:</p>
            <div className="storage-grid">
              <div className="storage-item">
                <strong>Flammable Liquids</strong>
                <span>Alcohols, acetone, ethers, toluene</span>
              </div>
              <div className="storage-item">
                <strong>Organic Acids</strong>
                <span>Acetic acid, formic acid (away from oxidizers)</span>
              </div>
              <div className="storage-item">
                <strong>Inorganic Bases</strong>
                <span>Sodium hydroxide, potassium hydroxide</span>
              </div>
              <div className="storage-item">
                <strong>Salts & Stable Solids</strong>
                <span>Most non-reactive inorganic salts</span>
              </div>
            </div>
          </div>

          {/* Incompatible */}
          <div className="storage-block incompatible">
            <h3>🚫 Never Store These Together</h3>
            <p>These combinations can cause fires, explosions, or toxic gases:</p>
            
            <div className="incompatible-list">
              <div className="incompatible-row">
                <div className="chem-a">Acids</div>
                <div className="vs">×</div>
                <div className="chem-b">Bases / Cyanides</div>
                <div className="reason">Violent reaction or toxic HCN gas</div>
              </div>
              <div className="incompatible-row">
                <div className="chem-a">Oxidizers</div>
                <div className="vs">×</div>
                <div className="chem-b">Flammables / Organics</div>
                <div className="reason">Fire or explosion risk</div>
              </div>
              <div className="incompatible-row">
                <div className="chem-a">Water-Reactive</div>
                <div className="vs">×</div>
                <div className="chem-b">Aqueous solutions</div>
                <div className="reason">Can release flammable gases</div>
              </div>
              <div className="incompatible-row">
                <div className="chem-a">Chlorine / Bleach</div>
                <div className="vs">×</div>
                <div className="chem-b">Ammonia / Acids</div>
                <div className="reason">Toxic chloramine or chlorine gas</div>
              </div>
              <div className="incompatible-row">
                <div className="chem-a">Peroxides</div>
                <div className="vs">×</div>
                <div className="chem-b">Organics / Metals</div>
                <div className="reason">Explosion hazard</div>
              </div>
            </div>
          </div>

          {/* Why it matters */}
          <div className="storage-block importance">
            <h3>Why a proper inventory system matters</h3>
            <ul>
              <li>Prevents incompatible chemicals from being stored together</li>
              <li>Makes it easy to see location and hazard information quickly</li>
              <li>Reduces the risk of using expired or degraded reagents</li>
              <li>Helps laboratories pass safety inspections and audits</li>
              <li>Saves money by avoiding duplicate purchases and waste</li>
            </ul>
            <p className="storage-note">
              Your Chemical Inventory system helps you keep clear records of what you have, 
              where it is stored, and what hazards it carries — so safer decisions become easier.
            </p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="cta colorful-cta">
        <h2>Ready to take control of your chemicals?</h2>
        <p>Join chemists who are replacing spreadsheets with a proper system.</p>
        <button className="btn btn-primary btn-large" onClick={onGetStarted}>
          Create Free Account
        </button>
      </section>

      <footer className="landing-footer">
        <p>© 2026 Chemical Inventory · Built for chemists and laboratories</p>
      </footer>
    </div>
  )
}

export default Landing