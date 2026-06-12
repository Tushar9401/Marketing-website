const features = [
  ['Display', 'On in-store TVs'],
  ['Schedule', 'With precision'],
  ['Analyze', 'Real-time results'],
  ['Engage', 'More shoppers'],
]

export default function AuthShowcase() {
  return (
    <aside className="auth-showcase signup-showcase">
      <div className="app-brand auth-hero-brand">
        <span className="brand-mark">M</span>
        <span>MarketFlow</span>
      </div>

      <div className="auth-hero-copy">
        <span className="showcase-pill">In-store TV marketing platform</span>
        <h2>
          Engage shoppers. Boost sales with <em>smart TV marketing.</em>
        </h2>
        <p>Manage content, schedule campaigns, and deliver the right message at the right time in-store.</p>
      </div>

      <img
        className="auth-hero-image"
        src={`${import.meta.env.BASE_URL}auth-marketflow-hero.webp`}
        alt="MarketFlow dashboard displayed on an in-store television with campaign analytics"
      />

      <div className="auth-hero-features" aria-label="MarketFlow features">
        {features.map(([title, description], index) => (
          <div key={title}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <p>
              <strong>{title}</strong>
              <small>{description}</small>
            </p>
          </div>
        ))}
      </div>
    </aside>
  )
}
