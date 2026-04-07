import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { POST as loginPost } from '@/app/api/auth/login/route'
import { POST as refreshPost } from '@/app/api/auth/refresh/route'
import { POST as logoutPost } from '@/app/api/auth/logout/route'
import { GET as connectorsGet, POST as connectorsPost } from '@/app/api/connectors/route'
import { GET as syncJobsGet } from '@/app/api/connectors/sync-jobs/route'
import { POST as connectorSyncPost } from '@/app/api/connectors/[id]/sync/route'

function makeRequest(url: string, init?: ConstructorParameters<typeof NextRequest>[1]): NextRequest {
  return new NextRequest(url, init)
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for integration checks')
  }

  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-check-secret'
  process.env.CONNECTOR_ENCRYPTION_KEY =
    process.env.CONNECTOR_ENCRYPTION_KEY ?? Buffer.alloc(32, 7).toString('base64')

  const suffix = Date.now().toString()
  const emailA = `integration-a-${suffix}@example.com`
  const emailB = `integration-b-${suffix}@example.com`
  const password = 'P@ssw0rd-Integration'
  const passwordHash = await bcrypt.hash(password, 10)

  const workspaceA = await prisma.workspace.create({ data: { name: `Workspace A ${suffix}`, plan: 'GROWTH' } })
  const workspaceB = await prisma.workspace.create({ data: { name: `Workspace B ${suffix}`, plan: 'GROWTH' } })

  const userA = await prisma.user.create({
    data: {
      workspaceId: workspaceA.id,
      email: emailA,
      passwordHash,
      role: 'OWNER',
    },
  })
  const userB = await prisma.user.create({
    data: {
      workspaceId: workspaceB.id,
      email: emailB,
      passwordHash,
      role: 'OWNER',
    },
  })

  try {
    const loginResA = await loginPost(
      makeRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: emailA, password }),
      })
    )
    assert.equal(loginResA.status, 200, 'login A failed')
    const loginDataA = (await loginResA.json()) as { accessToken: string }
    const accessTokenA = loginDataA.accessToken
    const refreshCookieA = loginResA.cookies.get('refresh_token')?.value
    const sessionIdA = loginResA.cookies.get('session_id')?.value
    const csrfTokenA = loginResA.cookies.get('csrf_token')?.value
    assert.ok(accessTokenA, 'missing access token for A')
    assert.ok(refreshCookieA, 'missing refresh cookie for A')
    assert.ok(sessionIdA, 'missing session id cookie for A')
    assert.ok(csrfTokenA, 'missing csrf token for A')

    const loginResB = await loginPost(
      makeRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: emailB, password }),
      })
    )
    assert.equal(loginResB.status, 200, 'login B failed')
    const loginDataB = (await loginResB.json()) as { accessToken: string }
    const accessTokenB = loginDataB.accessToken
    assert.ok(accessTokenB, 'missing access token for B')

    const createConnectorA = await connectorsPost(
      makeRequest('http://localhost/api/connectors', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessTokenA}`,
        },
        body: JSON.stringify({
          type: 'SHOPIFY',
          displayName: 'A Shopify',
          config: { shop: 'a-store', token: 'secret-a' },
        }),
      })
    )
    assert.equal(createConnectorA.status, 201, 'connector create A failed')
    const connectorAData = (await createConnectorA.json()) as { connector: { id: string } }

    const createConnectorB = await connectorsPost(
      makeRequest('http://localhost/api/connectors', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessTokenB}`,
        },
        body: JSON.stringify({
          type: 'STRIPE',
          displayName: 'B Stripe',
          config: { account: 'acct_b', apiKey: 'secret-b' },
        }),
      })
    )
    assert.equal(createConnectorB.status, 201, 'connector create B failed')
    const connectorBData = (await createConnectorB.json()) as { connector: { id: string } }

    const listA = await connectorsGet(
      makeRequest('http://localhost/api/connectors', {
        method: 'GET',
        headers: { authorization: `Bearer ${accessTokenA}` },
      })
    )
    assert.equal(listA.status, 200, 'connector list A failed')
    const listAData = (await listA.json()) as { connectors: Array<{ id: string }> }
    assert.equal(listAData.connectors.length, 1, 'tenant isolation failed: A can see wrong connector count')
    assert.equal(listAData.connectors[0]?.id, connectorAData.connector.id, 'tenant isolation failed: A sees wrong connector')

    const crossSync = await connectorSyncPost(
      makeRequest(`http://localhost/api/connectors/${connectorBData.connector.id}/sync`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessTokenA}` },
      }),
      { params: { id: connectorBData.connector.id } }
    )
    assert.equal(crossSync.status, 404, 'tenant isolation failed: A can sync B connector')

    const refreshA = await refreshPost(
      makeRequest('http://localhost/api/auth/refresh', {
        method: 'POST',
        headers: {
          cookie: `refresh_token=${refreshCookieA}; session_id=${sessionIdA}`,
        },
      })
    )
    assert.equal(refreshA.status, 200, 'refresh A failed')
    const refreshData = (await refreshA.json()) as { accessToken: string }
    assert.ok(refreshData.accessToken, 'missing refreshed access token')

    await prisma.connectorSyncJob.create({
      data: {
        connectorId: connectorBData.connector.id,
        workspaceId: workspaceB.id,
        trigger: 'SCHEDULED',
        status: 'FAILED',
        attempts: 1,
        maxAttempts: 3,
        errorMessage: 'simulated',
      },
    })
    const jobsA = await syncJobsGet(
      makeRequest('http://localhost/api/connectors/sync-jobs', {
        method: 'GET',
        headers: { authorization: `Bearer ${accessTokenA}` },
      })
    )
    assert.equal(jobsA.status, 200, 'sync-jobs A failed')
    const jobsAData = (await jobsA.json()) as { jobs: Array<{ connectorId: string }> }
    assert.equal(
      jobsAData.jobs.some((job) => job.connectorId === connectorBData.connector.id),
      false,
      'tenant isolation failed: A can see B sync job'
    )

    const logoutA = await logoutPost(
      makeRequest('http://localhost/api/auth/logout', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessTokenA}`,
          'x-csrf-token': csrfTokenA,
          cookie: `refresh_token=${refreshCookieA}; session_id=${sessionIdA}; csrf_token=${csrfTokenA}`,
        },
      })
    )
    assert.equal(logoutA.status, 200, 'logout A failed')
    const activeSessionsA = await prisma.session.count({ where: { userId: userA.id } })
    assert.equal(activeSessionsA, 0, 'logout did not revoke session')

    console.log('✅ Integration checks passed (auth flow + tenant isolation)')
  } finally {
    await prisma.connectorSyncJob.deleteMany({
      where: { workspaceId: { in: [workspaceA.id, workspaceB.id] } },
    })
    await prisma.connector.deleteMany({
      where: { workspaceId: { in: [workspaceA.id, workspaceB.id] } },
    })
    await prisma.auditLog.deleteMany({
      where: { workspaceId: { in: [workspaceA.id, workspaceB.id] } },
    })
    await prisma.session.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    })
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id] } },
    })
    await prisma.workspace.deleteMany({
      where: { id: { in: [workspaceA.id, workspaceB.id] } },
    })
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('❌ Integration checks failed')
  console.error(error)
  process.exit(1)
})

