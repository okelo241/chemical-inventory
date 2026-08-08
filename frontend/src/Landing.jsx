import './App.css'

function Landing({ onGetStarted }) {
  return (
    <div className="landing">
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <h1>Chemical Inventory<br />Made Simple</h1>
          <p className="hero-subtitle">
            Track chemicals, manage SDS files, monitor expiry dates and stock levels — 
            all in one modern, secure platform built for chemists and labs.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-large" onClick={onGetStarted}>
              Get Started Free
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <h2>Everything you need to manage your lab chemicals</h2>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📦</div>
            <h3>Smart Inventory</h3>
            <p>Track quantity, location, CAS numbers and molecular formulas with ease.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📄</div>
            <h3>SDS Management</h3>
            <p>Upload, store and download Safety Data Sheets securely in the cloud.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">⚠️</div>
            <h3>Hazard Symbols</h3>
            <p>Mark chemicals with GHS hazard pictograms for quick visual identification.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔔</div>
            <h3>Expiry & Stock Alerts</h3>
            <p>Get clear warnings for low stock and chemicals that are expiring soon.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Powerful Search</h3>
            <p>Search by name, CAS number, molecular formula or hazard notes instantly.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🌙</div>
            <h3>Modern Experience</h3>
            <p>Clean interface with dark mode, built to work beautifully on any device.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <h2>Ready to organize your chemical inventory?</h2>
        <p>Start free. No credit card required.</p>
        <button className="btn btn-primary btn-large" onClick={onGetStarted}>
          Create Your Account
        </button>
      </section>

      <footer className="landing-footer">
        <p>© 2026 Chemical Inventory • Built for chemists</p>
      </footer>
    </div>
  )
}

export default Landing