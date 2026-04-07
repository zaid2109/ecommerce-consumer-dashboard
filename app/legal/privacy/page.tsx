export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-5 px-6 py-10">
      <h1 className="text-2xl font-semibold text-tx-primary">Privacy Policy</h1>
      <p className="text-sm text-tx-secondary">
        EcoDash processes workspace data to deliver analytics, alerts, and reporting features.
        We isolate tenant data by workspace and restrict access using server-side role checks.
      </p>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-tx-primary">Data We Collect</h2>
        <p className="text-sm text-tx-secondary">
          Account information (email, role), session metadata (IP, user agent), uploaded datasets,
          connector sync metadata, and audit logs required for security and compliance.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-tx-primary">Data Usage</h2>
        <p className="text-sm text-tx-secondary">
          Data is used strictly for analytics calculations, connector processing, product reliability,
          and fraud prevention. We do not sell customer data.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-tx-primary">Retention & Deletion</h2>
        <p className="text-sm text-tx-secondary">
          Workspaces can request export or deletion through support channels. Audit and security logs
          are retained according to operational and compliance requirements.
        </p>
      </section>
    </main>
  )
}

