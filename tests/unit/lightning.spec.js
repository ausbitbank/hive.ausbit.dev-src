import { describe, expect, it } from 'vitest'
import { bolt11AmountMsats, decodeBolt11 } from '../../src/services/bolt11'
import {
  cleanV4vappMemo,
  feeSats,
  formatSats,
  invoiceStatus,
  lightningAddress,
  lightningMemo,
  normalizeFeePolicy,
  parseLightningTarget,
  parseV4vappMemo,
  quoteSatsPayment,
  satsRatesFromPrices
} from '../../src/services/lightning'

// Real mainnet invoice created against the live bridge on 2026-11-20:
// 670 nano-BTC = 67 sats, description "ausbitbank | test | ...".
const INVOICE_67_SATS = 'lnbc670n1p40l2xtpp5au9rm9y33vj4gqpq3rgr56rcd99ukju8hu7ka7mezqf0m6l404sqdrqv96hxcnfw33xzmntyp7zqar9wd6zqlpqyd242j2yyq6rsv34x3sjqlpqydyyj4j9yq35xnz9g98zqg6ggfzzqgmkx3mxzurscqzzsxqzpusp5z7y3vgygleq43wqj4jqevwtfvfw04vw0snlxzeyl98wsr9v8594s9qxpqysgqh9nk7hgwme4s8nngdmhsskt9yqnzfrta9je0ggvvfqtzfr3etpzk2mqmdl3je4tnnqj8c8uz8938vvwtqdp72w3n5n8kzt42qq8xydqp7vhwv6'

describe('Lightning addresses', () => {
  it('derives the three v4v.app addresses', () => {
    expect(lightningAddress('alice')).toBe('alice@v4v.app')
    expect(lightningAddress('@Alice', 'hbd')).toBe('alice@hbd.v4v.app')
    expect(lightningAddress('alice', 'sats')).toBe('alice@sats.v4v.app')
    expect(lightningAddress('invalid name!')).toBe('')
  })

  it('classifies pasted inputs', () => {
    expect(parseLightningTarget('lightning:lnbc1abc')).toMatchObject({ type: 'invoice', value: 'lnbc1abc' })
    expect(parseLightningTarget('alice@getalby.com')).toMatchObject({ type: 'address' })
    expect(parseLightningTarget('lnurl1dp68gurn8ghj7')).toMatchObject({ type: 'lnurl' })
    expect(parseLightningTarget('lntb1abc')).toMatchObject({ type: 'unknown' })
    expect(parseLightningTarget('')).toMatchObject({ type: 'empty' })
  })
})

describe('BOLT11 decoding', () => {
  it('decodes amount, expiry, description and payment hash', () => {
    const decoded = decodeBolt11(INVOICE_67_SATS)
    expect(decoded.valid).toBe(true)
    expect(decoded.amountSats).toBe(67)
    expect(decoded.hasAmount).toBe(true)
    expect(decoded.expirySeconds).toBe(60)
    expect(decoded.description).toContain('ausbitbank | test')
    expect(decoded.paymentHash).toBe('ef0a3d94918b2554002088d03a6878694bcb4b87bf3d6efb791012fdebf57d60')
    expect(decoded.expiresAt).toBeGreaterThan(0)
  })

  it('accepts upper case and the lightning: prefix', () => {
    const decoded = decodeBolt11('lightning:' + INVOICE_67_SATS.toUpperCase())
    expect(decoded.valid).toBe(true)
    expect(decoded.amountSats).toBe(67)
  })

  it('reads the BOLT11 multipliers', () => {
    expect(bolt11AmountMsats('lnbc1m')).toBe(100000000)
    expect(bolt11AmountMsats('lnbc10u')).toBe(1000000)
    expect(bolt11AmountMsats('lnbc100n')).toBe(10000)
    expect(bolt11AmountMsats('lnbc100p')).toBe(10)
    expect(bolt11AmountMsats('lnbc')).toBeNull()
  })

  it('rejects testnet, malformed and mixed-case invoices', () => {
    expect(decodeBolt11('lntb100u1abc').valid).toBe(false)
    expect(decodeBolt11('lnbc1abc').valid).toBe(false)
    expect(decodeBolt11('').valid).toBe(false)
    const mixed = INVOICE_67_SATS.slice(0, 20).toUpperCase() + INVOICE_67_SATS.slice(20)
    expect(decodeBolt11(mixed).valid).toBe(false)
  })
})

describe('Fees and quotes', () => {
  it('normalises live and percentage fee configs', () => {
    expect(normalizeFeePolicy({ conv_fee_percent: 0.029, conv_fee_sats: 50 })).toMatchObject({
      percent: 0.029,
      fixed: 50,
      minSats: 50,
      maxSats: 180000
    })
    expect(normalizeFeePolicy({ conv_fee_percent: 2.9, conv_fee_sats: '50' })).toMatchObject({
      percent: 0.029,
      fixed: 50
    })
  })

  it('uses the larger of the two published minimums', () => {
    // Live on 2026-11-21: minimum_invoice_payment_sats reported 1 while the
    // conversion floor (min_max.min.sats) was still 50.
    expect(normalizeFeePolicy({
      conv_fee_percent: 0.029,
      conv_fee_sats: 50,
      minimum_invoice_payment_sats: 1,
      min_max: { min: { sats: 50 } }
    }).minSats).toBe(50)
    expect(normalizeFeePolicy({
      minimum_invoice_payment_sats: 100,
      min_max: { min: { sats: 50 } }
    }).minSats).toBe(100)
    expect(normalizeFeePolicy({
      minimum_invoice_payment_sats: 1,
      min_max: { min: { sats: 1 } }
    }).minSats).toBe(1)
  })

  it('reproduces the observed 180,000 sat fee', () => {
    expect(feeSats(180000, { conv_fee_percent: 0.029, conv_fee_sats: 50 })).toBe(5270)
    expect(feeSats(1000, { conv_fee_percent: 0.029, conv_fee_sats: 50 })).toBe(79)
  })

  it('quotes a Hive/HBD payment and enforces limits', () => {
    const quote = quoteSatsPayment({
      amountSats: 1000,
      satsPerHive: 58.829245,
      satsPerHbd: 1602.198869,
      policy: { conv_fee_percent: 0.029, conv_fee_sats: 50 }
    })
    expect(quote).toMatchObject({ valid: true, amountSats: 1000, feeSats: 79, totalSats: 1079 })
    expect(quote.hbd).toBeCloseTo(0.6734, 3)
    expect(quote.hive).toBeCloseTo(18.34, 1)

    expect(quoteSatsPayment({ amountSats: 49 }).valid).toBe(false)
    expect(quoteSatsPayment({ amountSats: 180001 }).valid).toBe(false)
  })

  it('derives sats rates from the site price feed', () => {
    const rates = satsRatesFromPrices({
      bitcoin: { usd: 61704.005 },
      hive: { usd: 0.0363, btc: 5.8829245e-7 },
      hive_dollar: { usd: 0.988620870203782, btc: 1.6021988690000002e-5 }
    })
    expect(rates.satsPerHive).toBeCloseTo(58.829245, 4)
    expect(rates.satsPerHbd).toBeCloseTo(1602.198869, 3)
    expect(rates.btcUsd).toBe(61704.005)
  })
})

describe('Invoice status', () => {
  it('normalises paid, expired and open invoices', () => {
    expect(invoiceStatus({ paid: true, settled: true, state: 'SETTLED' })).toBe('paid')
    expect(invoiceStatus({ paid: false, expired: true, state: 'CANCELED' })).toBe('expired')
    expect(invoiceStatus({ paid: false, expired: false, state: 'OPEN' })).toBe('open')
    expect(invoiceStatus(null)).toBe('unknown')
  })
})

describe('v4vapp memos', () => {
  const received = 'Converted 77 sats to 0.421 HIVE with fee: 52 sats for kriszrokk | ⚡ zapped by @vikisecrets on cyberspace77.com  #lightningaddress | § woVqr/s6PX | Thank you for using v4v.app'

  it('parses an inbound conversion and its fee', () => {
    const parsed = parseV4vappMemo(received)
    expect(parsed).toMatchObject({
      kind: 'received',
      sats: 77,
      feeSats: 52,
      amount: 0.421,
      asset: 'HIVE',
      zap: true,
      reference: 'woVqr/s6PX'
    })
    expect(cleanV4vappMemo(received)).toContain('Converted 77 sats')
    expect(cleanV4vappMemo(received)).toContain('fee 52 sats')
  })

  it('parses a keepsats deposit', () => {
    const memo = 'Deposit 21.999 HBD to 34,082 sats with fee: 1,069 for hivemodular2 | § 0600_fc89fd_1'
    const parsed = parseV4vappMemo(memo)
    expect(parsed).toMatchObject({ kind: 'deposit', sats: 34082, feeSats: 1069, amount: 21.999, asset: 'HBD' })
    expect(cleanV4vappMemo(memo)).toBe('Deposit of 34,082 sats (fee 1,069 sats)')
  })

  it('hides long invoices from the activity label', () => {
    expect(cleanV4vappMemo('lnbc2500u1pabc #v4vapp')).toBe('Lightning invoice payment')
  })

  it('builds safe transfer memos and rejects testnet', () => {
    expect(lightningMemo(INVOICE_67_SATS)).toBe(INVOICE_67_SATS + ' #v4vapp')
    expect(lightningMemo(INVOICE_67_SATS, { hbd: true })).toBe(INVOICE_67_SATS + ' #HBD #v4vapp')
    expect(lightningMemo('alice@getalby.com')).toBe('alice@getalby.com #v4vapp')
    expect(lightningMemo('lnurl1dp68gurn8ghj7')).toBe('lnurl1dp68gurn8ghj7 #v4vapp')
    expect(() => lightningMemo('lntb100u1abc')).toThrow()
    expect(() => lightningMemo('hello')).toThrow()
  })

  it('formats sats consistently', () => {
    expect(formatSats(1234.5, 1)).toBe('1,234.5 sats')
    expect(formatSats(null)).toBe('—')
  })
})
