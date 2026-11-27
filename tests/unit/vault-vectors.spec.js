import { describe, expect, it } from 'vitest'
import {
  base64UrlDecode,
  base64UrlEncode,
  canonicalJson,
  importContentKey,
  importReaderPrivateKey,
  openKeyring,
  sha256Base64Url,
  sha256Hex,
  unwrapRingKey
} from '../../src/services/vaultCrypto'
import { buildBulletinSigningPayload, bulletinPayloadObject } from '../../src/services/vaultGrant'

const bytes = hex => Uint8Array.from(hex.match(/../g).map(part => parseInt(part, 16)))

function readerJwk () {
  const pub = base64UrlDecode('BAIX5hfwtkQ5KCePlpmeaaI6TywVK99tbN9m5bgCgtTtGUp968uXcS0t2jyoWqh2Wlb0X8dYWZZS8ol8ZTBuV5Q')
  const x = pub.slice(1, 33)
  const y = pub.slice(33, 65)
  return {
    kty: 'EC',
    crv: 'P-256',
    d: base64UrlEncode(bytes('11'.repeat(32))),
    x: base64UrlEncode(x),
    y: base64UrlEncode(y),
    ext: true
  }
}

describe('published protocol vectors', () => {
  it('matches the canonical JSON, base64url and SHA-256 vectors', async () => {
    expect(canonicalJson({ b: 1, a: { d: 'x', c: [true, null, 'é'] }, n: -2 }))
      .toBe('{"a":{"c":[true,null,"é"],"d":"x"},"b":1,"n":-2}')
    expect(base64UrlEncode(bytes('000102fdfeff'))).toBe('AAEC_f7_')
    expect([...base64UrlDecode('AAEC_f7_')]).toEqual([0, 1, 2, 253, 254, 255])
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(await sha256Base64Url('abc')).toBe('ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0')
  })

  it('matches the AES-256-GCM payload vector', async () => {
    const key = await importContentKey(base64UrlEncode(new Uint8Array(32)))
    const aad = new TextEncoder().encode('banksia.vault.content.v1|alice|vector|2026-11|section')
    const iv = new Uint8Array(12)
    const ct = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
      key,
      new TextEncoder().encode('Banksia Vault test vector')
    ))
    expect(await sha256Hex('Banksia Vault test vector')).toBe('41304b4ecfa77908c0413fd596cb98b24eed61a161f89b2a02e22e7b5ca62b06')
    expect(base64UrlEncode(ct)).toBe('jMYuVj4JCk5RL7C_ztPpfQEUI7xSxV4bo1h1jzJDzDDTbCYbnjfm69w')
  })

  it('matches the fixed ECDH + HKDF + AES-GCM ring-key wrap vector', async () => {
    const readerPublic = 'BAIX5hfwtkQ5KCePlpmeaaI6TywVK99tbN9m5bgCgtTtGUp968uXcS0t2jyoWqh2Wlb0X8dYWZZS8ol8ZTBuV5Q'
    const privateKey = await importReaderPrivateKey(readerJwk(), { extractable: false })
    const header = {
      blog: 'alice',
      rkt: '2bad0fd610d99eae',
      period: '2026-11',
      tier: 'member',
      expires: '2026-12-27T12:00:00Z'
    }
    const ring = await unwrapRingKey({
      alg: 'P256-HKDF-SHA256-A256GCM',
      epk: 'BNZak5d8qj0bCBhS_1ennkZfFmBXcwS66tUF3TpIWJzzUBheiVNy32Ih6joTdVfkc_3bZ1XwW9UHw8Uz_OnJEoU',
      iv: 'IiIiIiIiIiIiIiIi',
      ct: 'pMbQ1XkUi-FH4VccdS4Wbvr2aIwtSbU6lFwid0o2SNdmCXyafhPQqxFFT7ySCxbD'
    }, privateKey, header, 'p256:' + readerPublic)
    expect(ring).toBe('ERERERERERERERERERERERERERERERERERERERERERE')
  })

  it('matches the sealed-keyring vector', async () => {
    const keyring = await openKeyring({
      alg: 'A256GCM',
      iv: 'RERERERERERERERE',
      ct: 't2d6XngOCQbYsqW_ZZA6ltWwgUH1d3KtmimsGXGxZ6ZXGYcSGGOMUf6OlZSgWkFcr6Og9s7Ot8SN_lhcrzWAZpRdmJN_s8Y7Ow'
    }, 'ERERERERERERERERERERERERERERERERERERERERERE', { blog: 'alice', period: '2026-11' })
    expect(keyring).toEqual({ '2026-11': 'MzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzM' })
  })

  it('matches the bulletin keyring hash and canonical prefix', async () => {
    const bulletin = {
      v: 1,
      blog: 'alice',
      period: '2026-11',
      seq: 3,
      issued: '2026-11-27T12:00:00Z',
      keyring: { alg: 'A256GCM', iv: 'AAECAwQFBgcICQoL', ct: 'example' },
      entries: [{
        rkt: 'a1b2c3d4e5f6a7b8',
        alg: 'P256-HKDF-SHA256-A256GCM',
        epk: 'example',
        iv: 'AAECAwQFBgcICQoL',
        ct: 'example',
        tier: 'member',
        expires: '2026-12-27T12:00:00Z'
      }],
      claims: [],
      signer: 'alice',
      delegation: null
    }
    const payloadObject = await bulletinPayloadObject(bulletin)
    expect(payloadObject.keyringHash).toBe('sha256:a8c77bbae3ed01d00382382b299c11a535f7af1b7b7df67ea069dd7aa7405717')
    expect(await buildBulletinSigningPayload(bulletin))
      .toBe('banksia.vault.bulletin.v1|' + canonicalJson(payloadObject))
  })
})
