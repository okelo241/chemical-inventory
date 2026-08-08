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

      {/* WHY IT MATTERS */}
      <section className="why-section colorful-why">
        <div className="section-inner">
          <h2>Why proper chemical inventory is critical</h2>
          <div className="why-content">
            <p>
              Storing incompatible chemicals together is one of the most common causes of laboratory accidents. 
              Acids with bases, oxidizers with flammables, or cyanides with acids can produce toxic gases or violent reactions.
            </p>
            <p>A clear inventory system helps you:</p>
            <ul>
              <li>Prevent dangerous chemical combinations</li>
              <li>Know exactly what you have and where it is stored</li>
              <li>Avoid using expired or degraded reagents</li>
              <li>Stay ready for safety audits and inspections</li>
              <li>Reduce unnecessary purchases and waste</li>
            </ul>
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