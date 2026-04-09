import { NextRequest, NextResponse } from 'next/server'
import { canAccess, readAuthContext } from '@/lib/server/auth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:sales')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    title: 'EcoDash Architecture Pack',
    generatedAt: new Date().toISOString(),
    stack: {
      app: 'Next.js 14 App Router + React 18 + TypeScript',
      data: 'Prisma + PostgreSQL + JSON artifacts',
      queues: 'BullMQ + Redis workers',
      storage: 'Filesystem or S3/MinIO via artifact-store abstraction',
      security: 'JWT access cookie + refresh/session cookies + CSRF',
    },
    flows: {
      ingestion: [
        'Upload file -> /api/parse-file',
        'Create dataset -> /api/datasets',
        'Queue ingestion job -> worker transform',
        'Persist processed artifact + quality metrics',
        'Status polling -> /api/jobs/:id/status',
      ],
      connectors: [
        'Configure connector -> /api/connectors',
        'Queue sync job -> connector worker',
        'Canonical ingestion into dataset model',
      ],
      exports: [
        'Create export job -> /api/exports',
        'Async worker processing',
        'Download -> /api/exports/:id/download',
      ],
    },
    compliance: {
      gdpr: ['/api/compliance/gdpr/requests'],
      dpa: ['/api/compliance/dpa'],
      retention: ['/api/compliance/retention'],
      subprocessors: ['/api/compliance/subprocessors'],
    },
  })
}
