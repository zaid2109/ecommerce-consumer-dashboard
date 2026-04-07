import crypto from 'crypto'
import type { Prisma } from '@prisma/client'

type EncryptedConnectorConfig = {
  v: 1
  alg: 'aes-256-gcm'
  iv: string
  tag: string
  ciphertext: string
}

function resolveEncryptionKey(): Buffer {
  const raw = process.env.CONNECTOR_ENCRYPTION_KEY
  if (!raw || raw.trim().length === 0) {
    throw new Error('Missing CONNECTOR_ENCRYPTION_KEY')
  }

  const value = raw.trim()
  const fromBase64 = Buffer.from(value, 'base64')
  if (fromBase64.length === 32) {
    return fromBase64
  }

  const fromHex = Buffer.from(value, 'hex')
  if (fromHex.length === 32) {
    return fromHex
  }

  throw new Error('CONNECTOR_ENCRYPTION_KEY must decode to 32 bytes (base64 or hex)')
}

export function encryptConnectorConfig(config: Record<string, unknown>): Prisma.InputJsonValue {
  const key = resolveEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(config), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  const payload: EncryptedConnectorConfig = {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  }

  return payload as Prisma.InputJsonValue
}

function isEncryptedConfig(value: unknown): value is EncryptedConnectorConfig {
  if (!value || typeof value !== 'object') return false
  const maybe = value as Partial<EncryptedConnectorConfig>
  return (
    maybe.v === 1 &&
    maybe.alg === 'aes-256-gcm' &&
    typeof maybe.iv === 'string' &&
    typeof maybe.tag === 'string' &&
    typeof maybe.ciphertext === 'string'
  )
}

export function decryptConnectorConfig(value: unknown): Record<string, unknown> {
  if (!isEncryptedConfig(value)) {
    return {}
  }

  const key = resolveEncryptionKey()
  const iv = Buffer.from(value.iv, 'base64')
  const tag = Buffer.from(value.tag, 'base64')
  const ciphertext = Buffer.from(value.ciphertext, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  const parsed = JSON.parse(plaintext.toString('utf8')) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {}
  }
  return parsed as Record<string, unknown>
}
