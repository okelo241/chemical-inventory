import './App.css'

function Landing({ onGetStarted }) {
  return (
    <div className="landing">
      {/* ===================== NAVBAR ===================== */}
      <nav className="landing-nav">
        <div className="nav-brand">
          <span className="nav-logo">🧪</span>
          <span>Chemical Inventory</span>
        </div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#storage-guide">Storage Guide</a>
          <a href="#ghs">GHS & Hazards</a>
          <a href="#why">Why It Matters</a>
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
            <button className="btn btn-outline btn-xl" onClick={() => document.getElementById('storage-guide')?.scrollIntoView({ behavior: 'smooth' })}>
              Explore Storage Rules
            </button>
          </div>
          <p className="hero-note">Free for individual use · No credit card required · Private by design</p>
        </div>
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

          {/* Core Principles */}
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

          {/* Common Storage Groups */}
          <div className="guide-block">
            <h3>Common laboratory storage groups</h3>
            <p className="block-intro">
              Many institutions use a set of compatible storage groups (sometimes labeled A–X or 1–9). 
              Below is a practical synthesis of the most widely used schemes.
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

          {/* Never Store Together */}
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

          {/* Practical tips */}
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

      {/* ===================== GHS SECTION ===================== */}
      <section id="ghs" className="ghs-section">
        <div className="section-inner">
          <h2>GHS Hazard Pictograms at a glance</h2>
          <p className="section-lead">
            The Globally Harmonized System uses nine standard pictograms. 
            A single chemical may carry several. Your inventory should make these visible.
          </p>

          <div className="ghs-grid">
            <div className="ghs-card">
              <div className="ghs-symbol">💥</div>
              <h4>Exploding Bomb</h4>
              <p>Explosives, self-reactives, organic peroxides</p>
            </div>
            <div className="ghs-card">
              <div className="ghs-symbol">🔥</div>
              <h4>Flame</h4>
              <p>Flammables, pyrophorics, self-heating, emits flammable gas</p>
            </div>
            <div className="ghs-card">
              <div className="ghs-symbol">⭕🔥</div>
              <h4>Flame over Circle</h4>
              <p>Oxidizers</p>
            </div>
            <div className="ghs-card">
              <div className="ghs-symbol">🧴</div>
              <h4>Gas Cylinder</h4>
              <p>Gases under pressure</p>
            </div>
            <div className="ghs-card">
              <div className="ghs-symbol">🧴🖐️</div>
              <h4>Corrosion</h4>
              <p>Skin corrosion, serious eye damage, corrosive to metals</p>
            </div>
            <div className="ghs-card">
              <div className="ghs-symbol">☠️</div>
              <h4>Skull & Crossbones</h4>
              <p>Acute toxicity (fatal or toxic)</p>
            </div>
            <div className="ghs-card">
              <div className="ghs-symbol">❗</div>
              <h4>Exclamation Mark</h4>
              <p>Irritant, skin sensitizer, acute toxicity (harmful), narcotic effects</p>
            </div>
            <div className="ghs-card">
              <div className="ghs-symbol">🫁</div>
              <h4>Health Hazard</h4>
              <p>Carcinogen, mutagen, reproductive toxicity, STOT, aspiration hazard</p>
            </div>
            <div className="ghs-card">
              <div className="ghs-symbol">🌳🐟</div>
              <h4>Environment</h4>
              <p>Aquatic toxicity (mandatory in many jurisdictions)</p>
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
            <button className="footer-btn" onClick={onGetStarted}>Get Started</button>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 Chemical Inventory. Information on this page is educational and based on common laboratory safety guidance. Always consult current SDS documents and your institutional Chemical Hygiene Plan for specific requirements.</p>
        </div>
      </footer>
    </div>
  )
}

export default Landing