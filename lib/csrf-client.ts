export function readCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null
  const parts = document.cookie.split(';').map((p) => p.trim())
  const tokenPart = parts.find((p) => p.startsWith('csrf_token='))
  if (!tokenPart) return null
  return decodeURIComponent(tokenPart.slice('csrf_token='.length))
}

export function withCsrfHeader(
  headers?: HeadersInit
): HeadersInit {
  const token = readCsrfTokenFromCookie()
  const normalized = new Headers(headers ?? {})
  if (token) {
    normalized.set('x-csrf-token', token)
  }
  return normalized
}

