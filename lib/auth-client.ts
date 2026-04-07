'use client'

let accessTokenCache: string | null = null
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise

  refreshPromise = fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  })
    .then(async (res) => {
      if (!res.ok) return null
      const payload = (await res.json()) as { accessToken?: string }
      const token = payload.accessToken ?? null
      accessTokenCache = token
      return token
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

export async function getAccessToken(options?: { forceRefresh?: boolean }): Promise<string | null> {
  if (options?.forceRefresh) {
    accessTokenCache = null
  }
  if (accessTokenCache) return accessTokenCache
  return refreshAccessToken()
}

export async function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const firstToken = await getAccessToken()
  const firstHeaders = new Headers(init?.headers ?? {})
  if (firstToken) {
    firstHeaders.set('Authorization', `Bearer ${firstToken}`)
  }

  let response = await fetch(input, {
    ...init,
    headers: firstHeaders,
    credentials: 'include',
  })

  if (response.status !== 401) return response

  const refreshedToken = await getAccessToken({ forceRefresh: true })
  const retryHeaders = new Headers(init?.headers ?? {})
  if (refreshedToken) {
    retryHeaders.set('Authorization', `Bearer ${refreshedToken}`)
  }
  response = await fetch(input, {
    ...init,
    headers: retryHeaders,
    credentials: 'include',
  })
  return response
}

