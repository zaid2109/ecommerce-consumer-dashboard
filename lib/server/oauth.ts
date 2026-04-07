import crypto from 'crypto'

function base64Url(input: Buffer): string {
  return input.toString('base64url')
}

export function randomState(): string {
  return base64Url(crypto.randomBytes(24))
}

export function randomCodeVerifier(): string {
  return base64Url(crypto.randomBytes(48))
}

export function codeChallengeS256(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

