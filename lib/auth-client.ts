'use client'

let refreshPromise: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise

  refreshPromise = fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

export async function ensureAuthSession(): Promise<boolean> {
  return refreshAccessToken()
}

export async function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const firstHeaders = new Headers(init?.headers ?? {})
  let response = await fetch(input, {
    ...init,
    headers: firstHeaders,
    credentials: 'include',
  })

  if (response.status !== 401) return response

  const refreshed = await ensureAuthSession()
  if (!refreshed) return response

  const retryHeaders = new Headers(init?.headers ?? {})
  response = await fetch(input, {
    ...init,
    headers: retryHeaders,
    credentials: 'include',
  })
  return response
}

