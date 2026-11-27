import { describe, expect, it } from 'vitest'
import {
  buildSubscribeOperation,
  newSubscriptionId,
  parseSubscribeQuery,
  subscribePlanFromPost
} from '../../src/pages/subscribe.vue'
import { generateReaderKeyPair } from '../../src/services/vaultCrypto'
import {
  buildCancelOperation,
  buildVaultMemo,
  parseVaultMemo,
  VAULT_CANCEL_MATCHING
} from '../../src/services/vaultPayments'
import {
  buildReaderRegistry,
  readerRegistryOperation
} from '../../src/services/vaultBulletin'

const PRODUCT_POST = {
  author: 'alice',
  permlink: 'membership',
  title: 'Membership — @alice',
  json_metadata: JSON.stringify({
    content_type: 'product',
    version: 0.1,
    currency: 'HIVE:HBD',
    price: 5,
    subscription: 1,
    subscription_recurrence: 730,
    status: 1,
    tags: ['membership'],
    banksia_vault_product: {
      v: 1,
      plan: 'member',
      container: 'banksia-vault',
      archive: 'all'
    }
  })
}

const SUB = 'abcdefghijklmnop'

function plan () {
  const result = subscribePlanFromPost(PRODUCT_POST, { blog: 'alice' })
  expect(result.ok).toBe(true)
  return result.plan
}

describe('subscribe query validation', () => {
  it('defaults the product to blog/membership and rejects foreign or malformed references', () => {
    const defaults = parseSubscribeQuery({ blog: 'alice' })
    expect(defaults).toMatchObject({
      ok: true,
      blog: 'alice',
      label: 'alice/membership'
    })
    expect(defaults.product).toEqual({ author: 'alice', permlink: 'membership' })

    expect(parseSubscribeQuery({ blog: 'alice', product: 'alice/patron' }).ok).toBe(true)
    expect(parseSubscribeQuery({ blog: 'alice', product: 'bob/membership' }).ok).toBe(false)
    expect(parseSubscribeQuery({ blog: 'alice', product: 'not-a-product' }).ok).toBe(false)
    expect(parseSubscribeQuery({ blog: 'not a name' }).ok).toBe(false)
    expect(parseSubscribeQuery({}).ok).toBe(false)
  })

  it('ignores price, recipient and recurrence parameters from the URL', () => {
    const parsed = parseSubscribeQuery({
      blog: 'alice',
      product: 'alice/membership',
      price: '0.001 HBD',
      amount: '0.001 HBD',
      to: 'mallory',
      recurrence: '24',
      executions: '1'
    })
    expect(parsed.ok).toBe(true)
    expect(parsed).not.toHaveProperty('price')
    expect(parsed).not.toHaveProperty('to')
    expect(parsed).not.toHaveProperty('recurrence')

    const derived = subscribePlanFromPost(PRODUCT_POST, { blog: 'alice' })
    expect(derived.plan.priceLabel).toBe('5.000 HBD')
    expect(derived.plan.amount).toBe('5.000 HBD')
    expect(derived.plan.currency).toBe('HBD')
    expect(derived.plan.recurrence).toBe(730)
    expect(derived.plan.executions).toBe(12)
    expect(derived.plan.product).toBe('alice/membership')
    expect(derived.plan.author).toBe('alice')
  })

  it('refuses a product that belongs to another account or is inactive', () => {
    expect(subscribePlanFromPost(PRODUCT_POST, { blog: 'bob' }).ok).toBe(false)
    const inactive = {
      ...PRODUCT_POST,
      json_metadata: JSON.stringify({
        ...JSON.parse(PRODUCT_POST.json_metadata),
        status: 2
      })
    }
    expect(subscribePlanFromPost(inactive, { blog: 'alice' }).ok).toBe(false)
    expect(subscribePlanFromPost({ author: 'alice', permlink: 'x', json_metadata: '{}' }, { blog: 'alice' }).ok).toBe(false)
  })
})

describe('subscribe payment operations', () => {
  it('builds the exact recurrent transfer and memo', async () => {
    const reader = await generateReaderKeyPair()
    const result = buildSubscribeOperation({
      user: '@Bob',
      plan: plan(),
      readerKey: reader.publicKeyB64,
      sub: SUB
    })
    expect(result).not.toBeNull()
    expect(parseVaultMemo(result.memo)).toEqual({
      product: { author: 'alice', permlink: 'membership' },
      quantity: 1,
      banksia: {
        v: 1,
        plan: 'member',
        reader_key: reader.publicKeyB64,
        sub: SUB,
        gift_for: null
      }
    })
    expect(result.operation).toEqual([
      'recurrent_transfer',
      {
        from: 'bob',
        to: 'alice',
        amount: '5.000 HBD',
        memo: result.memo,
        recurrence: 730,
        executions: 12,
        extensions: []
      }
    ])
  })

  it('builds a one-time transfer with the same memo shape', async () => {
    const reader = await generateReaderKeyPair()
    const result = buildSubscribeOperation({
      user: 'bob',
      plan: plan(),
      readerKey: reader.publicKeyB64,
      sub: SUB,
      oneTime: true
    })
    expect(result.operation).toEqual([
      'transfer',
      {
        from: 'bob',
        to: 'alice',
        amount: '5.000 HBD',
        memo: result.memo
      }
    ])
  })

  it('rejects a payment without a valid reader key or account', async () => {
    const reader = await generateReaderKeyPair()
    expect(buildSubscribeOperation({
      user: 'bob',
      plan: plan(),
      readerKey: 'p256:short',
      sub: SUB
    })).toBeNull()
    expect(buildSubscribeOperation({
      user: 'bad name',
      plan: plan(),
      readerKey: reader.publicKeyB64,
      sub: SUB
    })).toBeNull()
    expect(newSubscriptionId()).toMatch(/^[A-Za-z0-9_-]{16,64}$/)
  })

  it('queues a cancel with the HF28 caveat attached', async () => {
    const reader = await generateReaderKeyPair()
    const memo = buildVaultMemo({
      product: 'alice/membership',
      plan: 'member',
      readerKey: reader.publicKeyB64,
      sub: SUB
    })
    const operation = buildCancelOperation({
      from: 'bob',
      to: 'alice',
      amount: '0.000 HBD',
      recurrence: 730,
      executions: 2,
      memo
    })
    expect(operation).toEqual([
      'recurrent_transfer',
      {
        from: 'bob',
        to: 'alice',
        amount: '0.000 HBD',
        memo,
        recurrence: 730,
        executions: 2,
        extensions: []
      }
    ])
    expect(operation.matching.tested).toBe(false)
    expect(operation.matching.note).toMatch(/testnet/i)
    expect(VAULT_CANCEL_MATCHING.tested).toBe(false)
  })

  it('builds the reader registry operation for a second device', async () => {
    const reader = await generateReaderKeyPair()
    const registry = buildReaderRegistry({
      blog: 'alice',
      keys: [{ key: reader.publicKeyB64, label: 'Phone', created: '2026-11-01T00:00:00Z' }]
    })
    const operation = readerRegistryOperation({ account: 'alice', registry })
    expect(operation[0]).toBe('custom_json')
    expect(operation[1]).toEqual({
      required_auths: [],
      required_posting_auths: ['alice'],
      id: 'banksia.vault.reader_key',
      json: JSON.stringify(registry)
    })
  })
})
