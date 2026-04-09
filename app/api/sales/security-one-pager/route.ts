import { NextRequest, NextResponse } from 'next/server'
import { canAccess, readAuthContext } from '@/lib/server/auth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:sales')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    title: 'EcoDash Security One-Pager',
    version: '2026-04',
    controls: [
      'Cookie-first auth sessions with CSRF protection',
      'Workspace tenant isolation across protected APIs',
      'Startup secret enforcement for critical environment variables',
      'Dependency and container vulnerability scanning in CI',
      'Structured audit logs for auth, exports, alerts, and admin actions',
    ],
    dataHandling: [
      'Artifact storage abstraction supports filesystem or S3/MinIO',
      'GDPR export/delete workflow endpoints with request tracking',
      'Retention policies and subprocessor registry endpoints',
    ],
    assurance: [
      'Type-check/build/integration checks enforced in CI',
      'Canary and rollback workflow available for controlled deployments',
    ],
  })
}
