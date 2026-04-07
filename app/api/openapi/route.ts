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
        post: { summary: 'Rotate refresh session and issue access token' },
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
      '/api/jobs/{id}/status': {
        get: { summary: 'Get ingestion job status' },
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
