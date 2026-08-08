import './App.css'

function Landing({ onGetStarted }) {
  return (
    <div className="landing">
      {/* ========== NAVBAR ========== */}
      <nav className="landing-nav">
        <div className="nav-brand">Chemical Inventory</div>
        <div className="nav-actions">
          <button className="btn btn-secondary" onClick={onGetStarted}>
            Log in
          </button>
          <button className="btn btn-primary" onClick={onGetStarted}>
            Get Started
          </button>
        </div>
      </nav>

      {/* ========== HERO ========== */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">Built for chemists & laboratories</div>
          <h1>
            Take control of your<br />
            chemical inventory
          </h1>
          <p className="hero-subtitle">
            Stop using spreadsheets and paper logs. Track every chemical, 
            manage SDS files, monitor expiry dates, and prevent dangerous 
            storage mistakes — all in one modern platform.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-large" onClick={onGetStarted}>
              Start Free →
            </button>
            <p className="hero-note">No credit card required</p>
          </div>
        </div>
      </section>

      {/* ========== PROBLEM ========== */}
      <section className="problem-section">
        <div className="section-inner">
          <h2>Most labs still manage chemicals the hard way</h2>
          <div className="problem-grid">
            <div className="problem-card">
              <span className="problem-icon">📄</span>
              <h3>Scattered SDS files</h3>
              <p>Safety Data Sheets are lost in folders, emails, or drawers when you need them most.</p>
            </div>
            <div className="problem-card">
              <span className="problem-icon">⏰</span>
              <h3>Expired chemicals</h3>
              <p>Without clear expiry tracking, labs waste money and risk using degraded reagents.</p>
            </div>
            <div className="problem-card">
              <span className="problem-icon">💥</span>
              <h3>Dangerous storage</h3>
              <p>Incompatible chemicals stored together can cause fires, toxic gases, or explosions.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== SOLUTION ========== */}
      <section className="features">
        <div className="section-inner">
          <h2>Everything you need in one place</h2>
          <p className="section-subtitle">
            Designed specifically for chemical inventory — not a generic tool.
          </p>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📦</div>
              <h3>Complete Inventory Tracking</h3>
              <p>Name, CAS number, molecular formula, quantity, location, and minimum stock levels.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📄</div>
              <h3>SDS File Management</h3>
              <p>Upload, store, and download Safety Data Sheets securely. Always available when needed.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">⚠️</div>
              <h3>Hazard Symbols</h3>
              <p>Mark chemicals with GHS pictograms so hazards are visible at a glance.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🔔</div>
              <h3>Smart Alerts</h3>
              <p>Automatic warnings for low stock and chemicals expiring within 30 days.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🔍</div>
              <h3>Powerful Search</h3>
              <p>Find any chemical instantly by name, CAS, formula, or hazard notes.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Private & Secure</h3>
              <p>Each user only sees their own inventory. Your data stays private.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== WHY IT MATTERS ========== */}
      <section className="why-section">
        <div className="section-inner">
          <h2>Why proper chemical inventory matters</h2>
          <div className="why-content">
            <div className="why-text">
              <p>
                Incompatible chemicals stored together are one of the most common 
                causes of laboratory accidents. Acids with bases, oxidizers with 
                flammables, or cyanides with acids can create toxic gases or violent reactions.
              </p>
              <p>
                A clear, up-to-date inventory helps you:
              </p>
              <ul>
                <li>Prevent dangerous storage combinations</li>
                <li>Know exactly what you have and where it is</li>
                <li>Avoid using expired or degraded chemicals</li>
                <li>Stay prepared for audits and safety inspections</li>
                <li>Save money by reducing unnecessary purchases</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <section className="cta">
        <h2>Start organizing your chemicals today</h2>
        <p>Free to use. Built for real laboratory needs.</p>
        <button className="btn btn-primary btn-large" onClick={onGetStarted}>
          Create Your Free Account
        </button>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="landing-footer">
        <p>© 2026 Chemical Inventory · Built for chemists and laboratories</p>
      </footer>
    </div>
  )
}

export default Landing