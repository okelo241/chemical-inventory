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

function Landing({ onGetStarted }) {
  const [showBackToTop, setShowBackToTop] = useState(false)

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

  return (
    <div className="landing">
      {/* ===================== NAVBAR ===================== */}
      <nav className="landing-nav">
        <div className="nav-brand">
          <div className="nav-logo">
            <img src={appLogo} alt="Chemical Inventory" className="app-logo-img" />
            <span>Chemical Inventory</span>
          </div>
        </div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#storage-guide">Storage Guide</a>
          <a href="#ghs">GHS & Hazards</a>
          <a href="#why">Why It Matters</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="nav-actions">
          <button className="btn btn-ghost" onClick={onGetStarted}>Log in</button>
          <button className="btn btn-primary" onClick={onGetStarted}>Get Started Free</button>
        </div>
      </nav>

      {/* ===================== HERO ===================== */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-content">
          <div className="hero-badge">Built for real laboratories · Chemists · Safety officers</div>
          <h1>
            Know exactly what you have.<br />
            <span className="gradient-text">Store it safely. Never guess again.</span>
          </h1>
          <p className="hero-subtitle">
            Modern chemical inventory software that tracks every bottle, links SDS documents,
            flags incompatible storage, monitors expiry dates, and helps your lab stay compliant
            with GHS and good laboratory practice.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-xl" onClick={onGetStarted}>
              Start Free Account →
            </button>
            <button
              className="btn btn-outline btn-xl"
              onClick={() => document.getElementById('storage-guide')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Explore Storage Rules
            </button>
          </div>
          <p className="hero-note">Free for individual use · No credit card required · Private by design</p>
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
              <p>Safety Data Sheets live in email, shared drives, or binders. When you need them during an incident or inspection, they are often missing or obsolete.</p>
            </div>
            <div className="problem-card">
              <div className="problem-icon">⏰</div>
              <h3>Expired & degraded reagents</h3>
              <p>Without reliable expiry tracking, labs use compromised chemicals, waste money on replacements, and risk experimental failure or safety issues.</p>
            </div>
            <div className="problem-card">
              <div className="problem-icon">💥</div>
              <h3>Incompatible storage</h3>
              <p>Acids next to bases, oxidizers next to organics, or water-reactives near aqueous solutions create real fire, explosion, and toxic-gas risks.</p>
            </div>
            <div className="problem-card">
              <div className="problem-icon">🔍</div>
              <h3>No clear location map</h3>
              <p>Nobody knows which cabinet, shelf, or secondary container holds a specific bottle — especially during emergencies or audits.</p>
            </div>
            <div className="problem-card">
              <div className="problem-icon">📊</div>
              <h3>Impossible audits</h3>
              <p>Inspectors and safety officers need current inventories, hazard summaries, and proof of proper segregation. Spreadsheets rarely deliver this cleanly.</p>
            </div>
            <div className="problem-card">
              <div className="problem-icon">💰</div>
              <h3>Duplicate purchases & waste</h3>
              <p>Without visibility of existing stock, labs reorder chemicals they already own and discard large volumes of unused material.</p>
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
              <p>Track every bottle or drum by name, CAS number, formula, quantity, concentration, location, owner, lot, and status (in stock / reserved / expired / disposed).</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📄</div>
              <h3>SDS linked to every record</h3>
              <p>Upload or link Safety Data Sheets so the correct document is one click away from the chemical record — critical for inspections and emergencies.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚠️</div>
              <h3>GHS hazard & pictogram support</h3>
              <p>Mark chemicals with the correct GHS pictograms and hazard classes so visual identification of risks is immediate.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔔</div>
              <h3>Expiry & low-stock alerts</h3>
              <p>Automatic warnings when reagents approach expiry or fall below minimum stock levels — reduce waste and avoid last-minute shortages.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🗂️</div>
              <h3>Storage location hierarchy</h3>
              <p>Model your real lab: building → room → cabinet → shelf → secondary container. Know exactly where every item sits.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Private by design</h3>
              <p>Each account only sees its own inventory. Role-based access keeps data secure while allowing controlled sharing inside a group or institution.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔎</div>
              <h3>Powerful search</h3>
              <p>Find chemicals by name, synonym, CAS, formula, hazard notes, location, or custom tags in seconds.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📋</div>
              <h3>Audit-ready records</h3>
              <p>Maintain clear history of additions, movements, and disposals to support laboratory inspections and Chemical Hygiene Plan requirements.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== CHEMICAL STORAGE GUIDE ===================== */}
      <section id="storage-guide" className="storage-section">
        <div className="section-inner">
          <div className="section-header">
            <h2>Chemical Storage Guide</h2>
            <p className="section-lead">
              Core principles used by university EHS departments and laboratory safety programs.
              Always verify with the specific Safety Data Sheet (Sections 7 & 10) for any chemical.
            </p>
          </div>

          <div className="guide-block">
            <h3>Fundamental rules</h3>
            <div className="principle-grid">
              <div className="principle-card">
                <strong>1. Segregate by hazard class — never alphabetically</strong>
                <p>Alphabetical storage routinely places incompatible materials next to each other (e.g., acetic acid beside acetone beside acetonitrile). First group by primary hazard, then alphabetize within the compatible group.</p>
              </div>
              <div className="principle-card">
                <strong>2. Prioritize the most severe hazard</strong>
                <p>When a chemical has multiple hazards, store it according to the highest-risk property (typically: pyrophoric / water-reactive → flammable → oxidizer → corrosive → toxic).</p>
              </div>
              <div className="principle-card">
                <strong>3. Use secondary containment</strong>
                <p>Liquids should sit in trays or bins capable of holding at least 110 % of the largest container. This contains spills and prevents mixing of incompatibles that share a cabinet.</p>
              </div>
              <div className="principle-card">
                <strong>4. Keep flammables in approved cabinets</strong>
                <p>Flammable and combustible liquids belong in NFPA 30-compliant flammable storage cabinets, away from oxidizers, heat sources, and ignition sources.</p>
              </div>
              <div className="principle-card">
                <strong>5. Never store chemicals in fume hoods long-term</strong>
                <p>Hoods are for active work. Permanent storage reduces airflow performance and increases fire load.</p>
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
              Many institutions use a set of compatible storage groups. Below is a practical synthesis of the most widely used schemes.
            </p>

            <div className="storage-groups">
              <div className="storage-group flammables">
                <div className="group-header">
                  <span className="group-badge">Flammables & Combustibles</span>
                  <span className="group-tag">Highest priority for fire risk</span>
                </div>
                <p className="group-examples">Acetone, ethanol, methanol, diethyl ether, hexane, toluene, THF, acetonitrile, many organic solvents</p>
                <p className="group-store"><strong>Store in:</strong> Approved flammable cabinet. Keep cool, away from ignition sources.</p>
                <p className="group-away"><strong>Keep away from:</strong> Oxidizers, oxidizing acids (nitric, perchloric), reactive metals, heat.</p>
              </div>

              <div className="storage-group oxidizers">
                <div className="group-header">
                  <span className="group-badge">Oxidizers & Peroxides</span>
                </div>
                <p className="group-examples">Hydrogen peroxide, nitric acid, perchloric acid, sodium hypochlorite, potassium permanganate, ammonium nitrate, chromates</p>
                <p className="group-store"><strong>Store in:</strong> Dedicated area or oxidizer cabinet, cool and dry.</p>
                <p className="group-away"><strong>Keep away from:</strong> All flammables, combustibles, organic materials, reducing agents, and most acids (especially organic acids).</p>
              </div>

              <div className="storage-group acids">
                <div className="group-header">
                  <span className="group-badge">Inorganic Acids (non-oxidizing)</span>
                </div>
                <p className="group-examples">Hydrochloric acid, sulfuric acid, phosphoric acid</p>
                <p className="group-store"><strong>Store in:</strong> Corrosive / acid cabinet with secondary containment. Prefer non-metal shelving.</p>
                <p className="group-away"><strong>Keep away from:</strong> Bases, cyanides, sulfides, active metals, flammables, oxidizers.</p>
              </div>

              <div className="storage-group acids-ox">
                <div className="group-header">
                  <span className="group-badge">Oxidizing Acids</span>
                </div>
                <p className="group-examples">Nitric acid, perchloric acid, chromic acid</p>
                <p className="group-store"><strong>Store in:</strong> Separate secondary containment, ideally isolated from other acids.</p>
                <p className="group-away"><strong>Keep away from:</strong> Organic acids, flammables, organics, bases, reducing agents. Nitric + organics is a classic lab fire/explosion scenario.</p>
              </div>

              <div className="storage-group organic-acids">
                <div className="group-header">
                  <span className="group-badge">Organic Acids</span>
                </div>
                <p className="group-examples">Acetic acid (glacial), formic acid, propionic acid, trifluoroacetic acid</p>
                <p className="group-store"><strong>Store in:</strong> Acid cabinet or flammable cabinet (many are combustible) with secondary containment.</p>
                <p className="group-away"><strong>Keep away from:</strong> Oxidizing acids, strong oxidizers, bases, cyanides.</p>
              </div>

              <div className="storage-group bases">
                <div className="group-header">
                  <span className="group-badge">Bases (Inorganic & Organic)</span>
                </div>
                <p className="group-examples">Sodium hydroxide, potassium hydroxide, ammonium hydroxide, amines, ethanolamine</p>
                <p className="group-store"><strong>Store in:</strong> Separate corrosive cabinet or clearly separated section from acids.</p>
                <p className="group-away"><strong>Keep away from:</strong> All acids, some metals, oxidizers.</p>
              </div>

              <div className="storage-group water-reactive">
                <div className="group-header">
                  <span className="group-badge">Water-Reactive & Pyrophoric</span>
                </div>
                <p className="group-examples">Sodium metal, lithium aluminum hydride, alkyl lithiums, calcium carbide, phosphorus pentoxide, many metal hydrides</p>
                <p className="group-store"><strong>Store in:</strong> Dry, cool location; often under inert atmosphere or in desiccated cabinets. Specialized handling required.</p>
                <p className="group-away"><strong>Keep away from:</strong> Water, aqueous solutions, humid air, oxidizers, and virtually all other chemical classes.</p>
              </div>

              <div className="storage-group toxics">
                <div className="group-header">
                  <span className="group-badge">Highly Toxic / Poisons</span>
                </div>
                <p className="group-examples">Cyanide salts, sulfide salts, mercury compounds, osmium tetroxide, many heavy-metal salts</p>
                <p className="group-store"><strong>Store in:</strong> Secure, limited-access location; often locked.</p>
                <p className="group-away"><strong>Especially critical:</strong> Cyanides and sulfides must never contact acids (release of HCN or H₂S).</p>
              </div>

              <div className="storage-group gases">
                <div className="group-header">
                  <span className="group-badge">Compressed Gases</span>
                </div>
                <p className="group-examples">Fuel gases (hydrogen, acetylene, propane), oxidizing gases (oxygen, chlorine), inert gases, toxic gases</p>
                <p className="group-store"><strong>Store:</strong> Upright, secured with chains or straps, in well-ventilated areas. Caps on when not in use.</p>
                <p className="group-away"><strong>Keep:</strong> Oxidizing gases at least 20 ft from fuel gases (or separated by a fire-rated barrier).</p>
              </div>
            </div>
          </div>

          <div className="guide-block incompatible-block">
            <h3>Never store these combinations together</h3>
            <p className="block-intro">These pairings are responsible for a large fraction of laboratory chemical incidents.</p>

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
              <li>Date peroxide-forming solvents (ethers, THF, etc.) on receipt and on opening. Test or dispose before they become dangerous.</li>
              <li>Keep only the minimum quantity needed in the active lab area. Bulk storage belongs in dedicated chemical storage rooms when possible.</li>
              <li>Label every secondary container and every storage location with the hazard class present.</li>
              <li>Return chemicals to their designated storage location immediately after use.</li>
              <li>Inspect cabinets regularly for leaking containers, corrosion, and outdated labels.</li>
              <li>Never store food, beverages, or personal items in chemical refrigerators or freezers.</li>
              <li>When in doubt, consult the SDS (Section 7 Handling & Storage and Section 10 Stability & Reactivity) and your institutional Chemical Hygiene Officer.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ===================== GHS + BIOHAZARD SECTION ===================== */}
      <section id="ghs" className="ghs-section">
        <div className="section-inner">
          <div className="section-header">
            <h2>GHS Hazard Pictograms & Biohazard</h2>
            <p className="section-lead">
              The Globally Harmonized System (GHS) uses nine standardized pictograms to communicate chemical hazards worldwide.
              A single substance may carry multiple pictograms. Your inventory should make these symbols immediately visible.
              We also include the widely recognized biohazard symbol used for biological risks in laboratories.
            </p>
          </div>

          <div className="ghs-intro-block">
            <h3>Why pictograms matter in chemical inventory</h3>
            <p>
              GHS pictograms appear on manufacturer labels and Safety Data Sheets. When you record a chemical in your inventory,
              associating the correct pictograms helps everyone in the lab instantly recognize the primary hazards —
              whether they are looking at a screen, a printed list, or a secondary container label you generate.
              This supports both daily safety and formal compliance with Hazard Communication requirements.
            </p>
          </div>

          <div className="ghs-grid-large">
            <div className="ghs-card-large">
              <div className="ghs-img-wrap">
                <img src={ghs01} alt="GHS01 Exploding Bomb – Explosive" className="ghs-pictogram-img" />
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
              <p className="ghs-note">Store away from heat, shock, friction and all other chemicals. Specialized magazines or cabinets required.</p>
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
              <p className="ghs-note">Store in approved flammable cabinets. Keep away from oxidizers and ignition sources.</p>
            </div>

            <div className="ghs-card-large">
              <div className="ghs-img-wrap">
                <img src={ghs03} alt="GHS03 Flame over Circle – Oxidizer" className="ghs-pictogram-img" />
              </div>
              <div className="ghs-code">GHS03</div>
              <h4>Flame over Circle</h4>
              <p className="ghs-title">Oxidizing</p>
              <ul className="ghs-details">
                <li>Oxidizing gases</li>
                <li>Oxidizing liquids</li>
                <li>Oxidizing solids</li>
              </ul>
              <p className="ghs-note">These materials can cause or intensify fire. Keep completely separated from flammables and combustibles.</p>
            </div>

            <div className="ghs-card-large">
              <div className="ghs-img-wrap">
                <img src={ghs04} alt="GHS04 Gas Cylinder – Gas under pressure" className="ghs-pictogram-img" />
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
              <p className="ghs-note">Secure cylinders upright. Protect from heat. Separate fuel gases from oxidizing gases.</p>
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
              <p className="ghs-note">Use secondary containment. Separate acids from bases. Prefer non-metal shelving for strong acids.</p>
            </div>

            <div className="ghs-card-large">
              <div className="ghs-img-wrap">
                <img src={ghs06} alt="GHS06 Skull and Crossbones – Toxic" className="ghs-pictogram-img" />
              </div>
              <div className="ghs-code">GHS06</div>
              <h4>Skull and Crossbones</h4>
              <p className="ghs-title">Acute Toxicity (Fatal or Toxic)</p>
              <ul className="ghs-details">
                <li>Acute toxicity – Oral (Categories 1, 2, 3)</li>
                <li>Acute toxicity – Dermal (Categories 1, 2, 3)</li>
                <li>Acute toxicity – Inhalation (Categories 1, 2, 3)</li>
              </ul>
              <p className="ghs-note">Highly toxic materials. Restrict access. Never store cyanides or sulfides near acids.</p>
            </div>

            <div className="ghs-card-large">
              <div className="ghs-img-wrap">
                <img src={ghs07} alt="GHS07 Exclamation Mark – Harmful / Irritant" className="ghs-pictogram-img" />
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
              <p className="ghs-note">Common on many laboratory reagents. Still requires proper PPE and good ventilation.</p>
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
              <p className="ghs-note">Long-term or serious health effects. Minimize exposure and track usage carefully.</p>
            </div>

            <div className="ghs-card-large">
              <div className="ghs-img-wrap">
                <img src={ghs09} alt="GHS09 Environment – Aquatic Toxicity" className="ghs-pictogram-img" />
              </div>
              <div className="ghs-code">GHS09</div>
              <h4>Environment</h4>
              <p className="ghs-title">Hazardous to the Aquatic Environment</p>
              <ul className="ghs-details">
                <li>Acute aquatic toxicity</li>
                <li>Chronic aquatic toxicity</li>
              </ul>
              <p className="ghs-note">Prevent release to drains and the environment. Follow local waste disposal rules strictly.</p>
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
                Not part of the official GHS chemical system, but essential in any laboratory that handles biological materials.
                Use alongside chemical pictograms when both chemical and biological risks are present.
              </p>
            </div>
          </div>

          <div className="ghs-extra-info">
            <div className="ghs-info-card">
              <h3>How GHS works with your inventory</h3>
              <p>
                When you add a chemical, you can record the GHS pictograms that appear on its original label or SDS.
                This information then travels with the chemical record — appearing in search results, location lists,
                printed labels, and emergency reports. It turns a simple name-and-quantity list into a true safety tool.
              </p>
            </div>
            <div className="ghs-info-card">
              <h3>Multiple pictograms on one chemical</h3>
              <p>
                Many laboratory reagents carry more than one pictogram. For example, methanol typically shows
                Flame + Skull and Crossbones + Health Hazard. Your system should allow multiple selections
                so the full hazard profile is visible at a glance.
              </p>
            </div>
            <div className="ghs-info-card">
              <h3>Pictograms vs. storage groups</h3>
              <p>
                GHS pictograms communicate hazard type. Storage groups (flammables, oxidizers, acids, bases, etc.)
                tell you <em>where</em> and <em>with what</em> a chemical may be stored. Both are needed.
              </p>
            </div>
            <div className="ghs-info-card">
              <h3>Secondary container labeling</h3>
              <p>
                When you pour a chemical into a smaller bottle or wash bottle, GHS requires that the secondary container
                also communicate the hazards. Having the pictograms already recorded in your inventory makes it much easier
                to generate compliant secondary labels.
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
              <p>Clear knowledge of what is present, where it is, and what it is incompatible with dramatically reduces the chance of accidental mixing, fire, or toxic exposure.</p>
            </div>
            <div className="why-card">
              <h3>Regulatory readiness</h3>
              <p>OSHA’s Laboratory Standard (29 CFR 1910.1450) and Hazard Communication Standard expect laboratories to maintain chemical inventories and accessible SDS information. A digital system makes this practical.</p>
            </div>
            <div className="why-card">
              <h3>Cost control</h3>
              <p>Avoid buying duplicates, reduce expired waste, and optimize ordering based on real usage and stock levels.</p>
            </div>
            <div className="why-card">
              <h3>Emergency response</h3>
              <p>In an incident, responders and safety staff need immediate answers: what chemicals are involved, their hazards, and exact locations.</p>
            </div>
            <div className="why-card">
              <h3>Knowledge continuity</h3>
              <p>When people leave the lab, institutional memory of “what is where” disappears unless it is recorded in a shared, maintained system.</p>
            </div>
            <div className="why-card">
              <h3>Audit confidence</h3>
              <p>Inspections become far less stressful when you can produce current inventory lists, hazard summaries, and SDS access logs in minutes.</p>
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
              <p>Yes. You can create an account and start managing your chemicals at no cost for individual use.</p>
            </div>
            <div className="faq-item">
              <h3>Is my data private?</h3>
              <p>Yes. Each account only sees its own inventory. Your chemicals are not shared with other users.</p>
            </div>
            <div className="faq-item">
              <h3>Can I upload SDS files?</h3>
              <p>Yes. You can upload PDF Safety Data Sheets and download them whenever you need them.</p>
            </div>
            <div className="faq-item">
              <h3>Does it support GHS pictograms?</h3>
              <p>Yes. You can mark each chemical with the relevant GHS hazard pictograms so risks are visible at a glance.</p>
            </div>
            <div className="faq-item">
              <h3>Can I track expiry dates?</h3>
              <p>Yes. The system highlights chemicals that are expired or expiring within 30 days and can warn about low stock.</p>
            </div>
            <div className="faq-item">
              <h3>Who is this for?</h3>
              <p>Chemists, laboratory technicians, research groups, teaching labs, safety officers, and small production facilities.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== FINAL CTA ===================== */}
      <section className="final-cta">
        <div className="cta-inner">
          <h2>Take control of your chemical inventory</h2>
          <p>
            Stop relying on spreadsheets and memory.
            Start with a system built for the way laboratories actually work.
          </p>
          <button className="btn btn-primary btn-xl" onClick={onGetStarted}>
            Create Your Free Account
          </button>
          <p className="cta-note">No credit card · Private accounts · Built for chemists</p>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span>🧪 Chemical Inventory</span>
            <p>Modern inventory & safety tools for laboratories</p>
          </div>
          <div className="footer-links">
            <a href="#features">Features</a>
            <a href="#storage-guide">Storage Guide</a>
            <a href="#ghs">GHS</a>
            <a href="#faq">FAQ</a>
            <button className="footer-btn" onClick={onGetStarted}>Get Started</button>
          </div>
        </div>
        <div className="footer-bottom">
          <p>
            © 2026 Chemical Inventory. Information on this page is educational and based on common laboratory safety guidance.
            Always consult current SDS documents and your institutional Chemical Hygiene Plan for specific requirements.
            GHS pictograms are standardized under the Globally Harmonized System of Classification and Labelling of Chemicals.
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