import crypto from 'crypto'
import bcrypt from 'bcryptjs'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function randomBase32(length: number): string {
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += BASE32_ALPHABET[bytes[i] % BASE32_ALPHABET.length]
  }
  return out
}

function base32ToBuffer(base32: string): Buffer {
  const clean = base32.replace(/=+$/g, '').toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = ''
  for (const c of clean) {
    const val = BASE32_ALPHABET.indexOf(c)
    if (val >= 0) bits += val.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

function hotp(secret: string, counter: number): string {
  const key = base32ToBuffer(secret)
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(code % 1_000_000).padStart(6, '0')
}

export function generateTotpSecret(): string {
  return randomBase32(32)
}

export function getTotpUri(input: { secret: string; email: string; issuer: string }): string {
  const label = encodeURIComponent(`${input.issuer}:${input.email}`)
  const issuer = encodeURIComponent(input.issuer)
  return `otpauth://totp/${label}?secret=${input.secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
}

export function verifyTotpCode(input: { secret: string; code: string; window?: number }): boolean {
  const nowCounter = Math.floor(Date.now() / 30_000)
  const window = input.window ?? 1
  const normalized = input.code.trim()
  for (let i = -window; i <= window; i += 1) {
    if (hotp(input.secret, nowCounter + i) === normalized) {
      return true
    }
  }
  return false
}

export async function generateBackupCodes(count = 8): Promise<{ plain: string[]; hashed: string[] }> {
  const plain = Array.from({ length: count }, () =>
    `${crypto.randomBytes(2).toString('hex')}-${crypto.randomBytes(2).toString('hex')}`.toUpperCase()
  )
  const hashed = await Promise.all(plain.map((code) => bcrypt.hash(code, 12)))
  return { plain, hashed }
}

export async function consumeBackupCode(input: {
  providedCode: string
  hashedCodes: string[]
}): Promise<{ ok: boolean; remainingHashedCodes: string[] }> {
  const provided = input.providedCode.trim().toUpperCase()
  for (let i = 0; i < input.hashedCodes.length; i += 1) {
    const matches = await bcrypt.compare(provided, input.hashedCodes[i])
    if (matches) {
      const remaining = [...input.hashedCodes.slice(0, i), ...input.hashedCodes.slice(i + 1)]
      return { ok: true, remainingHashedCodes: remaining }
    }
  }
  return { ok: false, remainingHashedCodes: input.hashedCodes }
}

