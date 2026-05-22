import { describe, expect, it, beforeAll } from 'vitest'
import { encryptConnectorConfig, decryptConnectorConfig } from '@/lib/server/connector-secrets'

beforeAll(() => {
  // 32-byte base64 key for testing
  process.env.CONNECTOR_ENCRYPTION_KEY = Buffer.alloc(32).toString('base64')
})

describe('connector config encryption', () => {
  it('round-trips a config object', () => {
    const original = { shopDomain: 'my-shop.myshopify.com', accessToken: 'shpat_secret' }
    const encrypted = encryptConnectorConfig(original)
    const decrypted = decryptConnectorConfig(encrypted)
    expect(decrypted).toEqual(original)
  })

  it('returns empty object for non-encrypted input', () => {
    expect(decryptConnectorConfig(null)).toEqual({})
    expect(decryptConnectorConfig({ v: 0 })).toEqual({})
    expect(decryptConnectorConfig('not-encrypted')).toEqual({})
  })

  it('produces different ciphertext each call (random IV)', () => {
    const config = { key: 'value' }
    const enc1 = encryptConnectorConfig(config) as { ciphertext: string }
    const enc2 = encryptConnectorConfig(config) as { ciphertext: string }
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext)
  })
})
