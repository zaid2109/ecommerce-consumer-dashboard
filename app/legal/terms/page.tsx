export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-5 px-6 py-10">
      <h1 className="text-2xl font-semibold text-tx-primary">Terms of Service</h1>
      <p className="text-sm text-tx-secondary">
        These terms govern use of EcoDash by workspace members and administrators.
        By using the service, customers agree to maintain account security and lawful data usage.
      </p>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-tx-primary">Service Scope</h2>
        <p className="text-sm text-tx-secondary">
          EcoDash provides analytics dashboards, connector ingestion, and reporting features
          based on subscribed plan limits.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-tx-primary">Plan Limits</h2>
        <p className="text-sm text-tx-secondary">
          Seat, connector, and ingestion volume limits are enforced server-side.
          Exceeding limits may require plan upgrade before additional operations proceed.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-tx-primary">Security & Responsibility</h2>
        <p className="text-sm text-tx-secondary">
          Customers are responsible for credential security and complying with applicable laws
          when uploading data and sharing dashboards.
        </p>
      </section>
    </main>
  )
}

