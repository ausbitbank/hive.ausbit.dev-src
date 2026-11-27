import { describe, expect, it } from 'vitest'
import { PrivateKey, utils } from 'hive-tx'
import {
  postingPublicKeys,
  verifyVaultPayload,
  verifyVaultPayloadForAccount
} from '../../src/services/vaultSigning'

function newKey () {
  const privateKey = PrivateKey.from(globalThis.crypto.getRandomValues(new Uint8Array(32)))
  return {
    privateKey,
    wif: privateKey.toString(),
    publicKey: privateKey.createPublic().toString()
  }
}

describe('vault signing bridge', () => {
  it('verifies a real posting-key signature over the canonical payload', async () => {
    const key = newKey()
    const payload = 'banksia.vault.bulletin.v1|{"blog":"alice","seq":1}'
    const signature = utils.signMessage(payload, key.privateKey)

    await expect(verifyVaultPayload({ payload, signature, publicKey: key.publicKey }))
      .resolves.toBe(true)

    await expect(verifyVaultPayload({ payload: payload + 'x', signature, publicKey: key.publicKey }))
      .resolves.toBe(false)

    const other = newKey()
    await expect(verifyVaultPayload({ payload, signature, publicKey: other.publicKey }))
      .resolves.toBe(false)
  })

  it('fails closed for malformed signatures and missing keys', async () => {
    await expect(verifyVaultPayload({ payload: 'x', signature: 'nope', publicKey: 'STM111' }))
      .resolves.toBe(false)
    await expect(verifyVaultPayload({ payload: '', signature: '00', publicKey: 'STM111' }))
      .resolves.toBe(false)
    await expect(verifyVaultPayload({ payload: 'x', signature: '', publicKey: '' }))
      .resolves.toBe(false)
  })

  it('matches any posting key on the account authority', async () => {
    const first = newKey()
    const second = newKey()
    const payload = 'banksia.vault.bulletin.v1|{"blog":"alice"}'
    const signature = utils.signMessage(payload, second.privateKey)
    const account = {
      posting: {
        key_auths: [[first.publicKey, 1], [second.publicKey, 1]],
        account_auths: []
      }
    }

    expect(postingPublicKeys(account)).toEqual([first.publicKey, second.publicKey])
    await expect(verifyVaultPayloadForAccount({ payload, signature, account }))
      .resolves.toBe(true)

    await expect(verifyVaultPayloadForAccount({
      payload,
      signature,
      account: { posting: { key_auths: [[first.publicKey, 1]] } }
    })).resolves.toBe(false)
  })
})
