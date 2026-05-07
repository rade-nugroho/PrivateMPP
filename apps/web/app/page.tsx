export default function HomePage() {
  return (
    <main style={{ maxWidth: '52rem', margin: '0 auto', padding: '2rem 1.25rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>PrivateMPP</h1>
      <p style={{ color: '#a3a3a3', marginTop: '0.75rem' }}>
        Devnet-first scaffold for private agent payments — MagicBlock PER Private Payments API + HTTP 402 /{' '}
        <code>mppx</code>.
      </p>
      <ul style={{ marginTop: '1.25rem', paddingLeft: '1.25rem', color: '#d4d4d4' }}>
        <li>
          <a href="/api/local-health">GET /api/local-health</a> — process health
        </li>
        <li>
          <a href="/api/per-proxy/health">GET /api/per-proxy/health</a> — forwards to PER when{' '}
          <code>PER_PRIVATE_PAYMENT_BASE_URL</code> is set
        </li>
        <li>
          <a href="/api/example-paid">GET /api/example-paid</a> — payment-gated example (returns 402 without
          credential)
        </li>
      </ul>
      <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: '#737373' }}>
        See <code>README.md</code> and <code>docs/</code> for architecture and env vars. No credentials in repo.
      </p>
    </main>
  );
}
