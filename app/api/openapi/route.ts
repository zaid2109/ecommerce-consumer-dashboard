import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    openapi: '3.0.3',
    info: {
      title: 'EcoDash API',
      version: '1.0.0',
      description: 'Multi-tenant e-commerce analytics API',
    },
    paths: {
      '/api/auth/login': {
        post: { summary: 'Login and create session' },
      },
      '/api/auth/magic-link/request': {
        post: { summary: 'Request a magic login link' },
      },
      '/api/auth/magic-link/verify': {
        post: { summary: 'Verify magic login link and create session' },
      },
      '/api/auth/refresh': {
        post: { summary: 'Rotate refresh session and renew auth cookies' },
      },
      '/api/auth/logout': {
        post: { summary: 'Logout and revoke session' },
      },
      '/api/auth/mfa/setup': {
        post: { summary: 'Initialize MFA setup and generate backup codes' },
      },
      '/api/auth/mfa/verify': {
        post: { summary: 'Verify MFA setup code and enable MFA' },
      },
      '/api/auth/mfa/disable': {
        post: { summary: 'Disable MFA for current user' },
      },
      '/api/auth/sessions': {
        get: { summary: 'List current user active sessions' },
        post: { summary: 'Revoke all sessions except current session' },
      },
      '/api/auth/sessions/{id}': {
        delete: { summary: 'Revoke one active session for current user' },
      },
      '/api/auth/oauth/{provider}/start': {
        get: { summary: 'Create OAuth authorization URL (Google/Microsoft PKCE)' },
      },
      '/api/auth/oauth/{provider}/callback': {
        get: { summary: 'OAuth callback with token exchange and session creation' },
      },
      '/api/datasets': {
        get: { summary: 'List workspace datasets' },
        post: { summary: 'Create dataset and enqueue ingestion job' },
      },
      '/api/datasets/{id}/rejects': {
        get: { summary: 'Download quarantined invalid rows as CSV reject file' },
      },
      '/api/jobs/{id}/status': {
        get: { summary: 'Get ingestion job status' },
      },
      '/api/saved-views': {
        get: { summary: 'List saved dashboard views for current page' },
        post: { summary: 'Create saved dashboard view' },
      },
      '/api/saved-views/{id}': {
        patch: { summary: 'Update saved dashboard view (pin/name/visibility/filters)' },
        delete: { summary: 'Delete saved dashboard view' },
      },
      '/api/saved-views/share/{token}': {
        get: { summary: 'Resolve saved view from share token within workspace' },
      },
      '/api/alerts/rules': {
        get: { summary: 'List alert rules' },
        post: { summary: 'Create alert rule (threshold or anomaly)' },
      },
      '/api/alerts/events': {
        get: { summary: 'List alert events with status and channels' },
      },
      '/api/alerts/events/{id}/ack': {
        post: { summary: 'Acknowledge alert event' },
      },
      '/api/exports': {
        get: { summary: 'List export jobs' },
        post: { summary: 'Create async export job (CSV/XLSX/PDF)' },
      },
      '/api/exports/{id}/download': {
        get: { summary: 'Download completed export artifact' },
      },
      '/api/billing/subscriptions': {
        get: { summary: 'List subscriptions for workspace' },
        post: { summary: 'Create/update subscription lifecycle state' },
      },
      '/api/billing/webhooks/stripe': {
        post: { summary: 'Stripe webhook ingestion for subscription and billing events' },
      },
      '/api/compliance/gdpr/requests': {
        get: { summary: 'List GDPR export/delete requests' },
        post: { summary: 'Create GDPR export/delete request and process it' },
      },
      '/api/compliance/dpa': {
        get: { summary: 'List DPA acceptances' },
        post: { summary: 'Accept DPA version with metadata' },
      },
      '/api/compliance/retention': {
        get: { summary: 'List retention policies' },
        post: { summary: 'Create retention policy' },
      },
      '/api/compliance/subprocessors': {
        get: { summary: 'List subprocessors registry' },
        post: { summary: 'Add subprocessor entry' },
      },
      '/api/enterprise/sso': {
        get: { summary: 'List SAML/OIDC SSO configurations' },
        post: { summary: 'Create SAML/OIDC SSO configuration' },
      },
      '/api/enterprise/sso/login': {
        post: { summary: 'Start SSO login handshake URL generation' },
      },
      '/api/ops/backup-drills': {
        get: { summary: 'List backup/restore drills' },
        post: { summary: 'Record backup/restore drill execution' },
      },
      '/api/ops/runbooks': {
        get: { summary: 'List operational runbooks' },
        post: { summary: 'Create operational runbook' },
      },
      '/api/ops/slo': {
        get: { summary: 'List SLO targets' },
        post: { summary: 'Create SLO target' },
      },
      '/api/ops/incidents': {
        get: { summary: 'List incident playbooks' },
        post: { summary: 'Create incident playbook' },
      },
      '/api/sales/demo-fixtures': {
        get: { summary: 'List demo fixtures' },
        post: { summary: 'Create demo fixture' },
      },
      '/api/sales/roi': {
        post: { summary: 'Calculate ROI for sales scenarios' },
      },
      '/api/sales/security-one-pager': {
        get: { summary: 'Get security one-pager JSON pack' },
      },
      '/api/sales/architecture-pack': {
        get: { summary: 'Get architecture pack JSON summary' },
      },
      '/api/workspace/members': {
        get: { summary: 'List workspace members' },
        post: { summary: 'Create workspace member' },
      },
      '/api/workspace/usage': {
        get: { summary: 'Get workspace plan usage and limits' },
      },
      '/api/workspace/invitations': {
        get: { summary: 'List invitations' },
        post: { summary: 'Create invitation' },
      },
      '/api/workspace/invitations/accept': {
        post: { summary: 'Accept invitation' },
      },
      '/api/connectors': {
        get: { summary: 'List connectors' },
        post: { summary: 'Connect a connector (Shopify/Stripe/GA4/S3)' },
      },
      '/api/connectors/{id}/sync': {
        post: { summary: 'Run connector sync' },
      },
      '/api/connectors/sync-schedule': {
        post: { summary: 'Schedule sync for all connected workspace connectors' },
      },
      '/api/connectors/sync-jobs': {
        get: { summary: 'List connector sync jobs (history, failures, dead letters)' },
      },
      '/api/connectors/sync-jobs/{id}/retry': {
        post: { summary: 'Retry a failed/dead-letter connector sync job' },
      },
      '/api/connectors/health': {
        get: { summary: 'Connector health and success/failure metrics' },
      },
      '/api/parse-file': {
        post: { summary: 'Parse uploaded file safely' },
      },
      '/api/analyze-dataset': {
        post: { summary: 'Analyze dataset schema and mapping' },
      },
    },
  })
}
