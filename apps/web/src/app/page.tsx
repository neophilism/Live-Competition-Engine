export default function HomePage() {
  return (
    <main className="shell">
      <p className="eyebrow">Live Competition Engine</p>
      <h1>Infrastructure for live, judged, audience-driven competition.</h1>
      <p className="lede">
        This repository provides the reusable competition engine. Product-specific
        vocabulary, branding, and rules belong in implementations built on top of it.
      </p>
      <section className="status" aria-label="Foundation status">
        <span>Foundation</span>
        <strong>online</strong>
      </section>
    </main>
  );
}
