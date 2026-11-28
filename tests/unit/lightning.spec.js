import { describe, expect, it } from 'vitest'
import { bolt11AmountMsats, decodeBolt11 } from '../../src/services/bolt11'
import {
  cleanV4vappMemo,
  feeSats,
  formatSats,
  invoiceStatus,
  isV4vappAccount,
  isV4vappTransfer,
  isValidHiveAccount,
  lightningAddress,
  lightningAddressDomain,
  lightningFeeBufferSats,
  lightningMemo,
  lnurlCallbackUrl,
  normalizeAccount,
  normalizeAmountUnit,
  normalizeFeePolicy,
  normalizeLnurlPayInfo,
  parseLightningTarget,
  parseLnurlInvoice,
  parseV4vappMemo,
  payLinkAmount,
  quoteSatsPayment,
  quoteSpendPayment,
  satsRatesFromBridgeQuote,
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
    expect(quote).toMatchObject({
      valid: true,
      amountSats: 1000,
      bridgeFeeSats: 83,
      bufferSats: 51,
      feeSats: 134,
      totalSats: 1134
    })
    expect(quote.hbd).toBeCloseTo(0.708, 3)
    expect(quote.hive).toBeCloseTo(19.3, 1)

    expect(quoteSatsPayment({ amountSats: 49 }).valid).toBe(false)
    expect(quoteSatsPayment({ amountSats: 180001 }).valid).toBe(false)
  })

  it('treats a fixed HBD spend as the total including the fee', () => {
    const quote = quoteSpendPayment({
      spendAmount: 5,
      asset: 'hbd',
      satsPerHive: 58.829245,
      satsPerHbd: 1602.198869,
      policy: { conv_fee_percent: 0.029, conv_fee_sats: 50 }
    })
    expect(quote).toMatchObject({
      valid: true,
      spend: 5,
      spendAsset: 'hbd',
      totalSats: 8011,
      bridgeFeeSats: 283,
      bufferSats: 58,
      feeSats: 341,
      amountSats: 7670
    })
    expect(quote.hbd).toBeCloseTo(5, 3)
    // The bridge fee is charged on the gross spend, and the routing buffer is
    // held back from the remaining sats. Together they explain the invoice.
    expect(quote.bridgeFeeSats + quote.bufferSats).toBe(quote.feeSats)
    expect(quote.amountSats + quote.feeSats).toBe(quote.totalSats)
  })

  it('rounds a fixed spend to three decimals and enforces limits', () => {
    const policy = { conv_fee_percent: 0.029, conv_fee_sats: 50 }
    const rounded = quoteSpendPayment({
      spendAmount: '1.23456',
      asset: 'hive',
      satsPerHive: 58.829245,
      satsPerHbd: 1602,
      policy
    })
    expect(rounded.spend).toBe(1.235)
    expect(quoteSpendPayment({ spendAmount: 0.01, asset: 'hbd', satsPerHbd: 1602, policy }).valid).toBe(false)
    expect(quoteSpendPayment({ spendAmount: 200, asset: 'hbd', satsPerHbd: 1602, policy }).valid).toBe(false)
    expect(quoteSpendPayment({ spendAmount: 5, asset: 'hbd', satsPerHbd: null, policy }).valid).toBe(false)
    expect(quoteSpendPayment({ spendAmount: 0, asset: 'hbd', satsPerHbd: 1602, policy }).valid).toBe(false)
  })

  it('reserves the bridge fee and routing buffer from a fixed spend', () => {
    const quote = quoteSpendPayment({
      spendAmount: 1.079,
      asset: 'hbd',
      satsPerHive: 58,
      satsPerHbd: 1000,
      policy: { conv_fee_percent: 0.029, conv_fee_sats: 50 }
    })
    expect(quote).toMatchObject({ valid: true, totalSats: 1079, feeSats: 133, amountSats: 946 })
    expect(quote.bridgeFeeSats + quote.bufferSats).toBe(quote.feeSats)
  })

  it('reserves a routing buffer for fixed invoices', () => {
    expect(lightningFeeBufferSats(1000)).toBe(51)
    expect(lightningFeeBufferSats(0)).toBe(0)
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

describe('Payment-link amounts', () => {
  it('reads HBD, HIVE and sats amounts from a link', () => {
    expect(payLinkAmount({ amount: '5', currency: 'hbd' })).toEqual({ amount: 5, unit: 'hbd' })
    expect(payLinkAmount({ amount: '5', currency: 'HIVE' })).toEqual({ amount: 5, unit: 'hive' })
    expect(payLinkAmount({ amount: '5000' })).toEqual({ amount: 5000, unit: 'sats' })
    expect(payLinkAmount({ sats: '5000' })).toEqual({ amount: 5000, unit: 'sats' })
    expect(payLinkAmount({ amount: '5', asset: 'hbd' })).toEqual({ amount: 5, unit: 'hbd' })
    expect(payLinkAmount({ amount: '-1', currency: 'hbd' })).toEqual({ amount: null, unit: '' })
    expect(payLinkAmount({ amount: 'nope' })).toEqual({ amount: null, unit: '' })
    expect(payLinkAmount({})).toEqual({ amount: null, unit: '' })
  })

  it('normalises units and falls back safely', () => {
    expect(normalizeAmountUnit('SAT')).toBe('sats')
    expect(normalizeAmountUnit('HBD')).toBe('hbd')
    expect(normalizeAmountUnit('hp')).toBe('hive')
    expect(normalizeAmountUnit('usd', 'sats')).toBe('sats')
  })

  it('prefers the bridge rates and falls back to nulls', () => {
    expect(satsRatesFromBridgeQuote({ v4vapp: { sats_Hive: 60, sats_HBD: 1600 } }))
      .toEqual({ satsPerHive: 60, satsPerHbd: 1600 })
    expect(satsRatesFromBridgeQuote({})).toEqual({ satsPerHive: null, satsPerHbd: null })
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
    expect(lightningMemo('alice@getalby.com')).toBe('alice@getalby.com')
    expect(lightningMemo('lnurl1dp68gurn8ghj7')).toBe('lnurl1dp68gurn8ghj7')
    expect(() => lightningMemo('lntb100u1abc')).toThrow()
    expect(() => lightningMemo('hello')).toThrow()
  })

  it('never puts app tags after an address that v4vapp forwards as a comment', () => {
    // v4vapp splits the memo at the first space and sends the remainder as the
    // LNURL comment. A provider that rejects it makes the bridge fall back to a
    // keepsats deposit instead of paying the address.
    for (const address of ['ausbitbank@bitrefill.me', 'alice@getalby.com', 'user+tag@sub.domain.com']) {
      const memo = lightningMemo(address)
      expect(memo).toBe(address)
      expect(memo).not.toContain('#')
      expect(memo).not.toContain(' ')
    }
    expect(lightningMemo('lnurl1dp68gurn8ghj7')).not.toContain('#')
  })

  it('formats sats consistently', () => {
    expect(formatSats(1234.5, 1)).toBe('1,234.5 sats')
    expect(formatSats(null)).toBe('—')
  })
})

describe('Lightning address resolution helpers', () => {
  const info = {
    tag: 'payRequest',
    callback: 'https://bitrefill.me/v1/lnurl_pay/abc/callback/ausbitbank',
    minSendable: 1000,
    maxSendable: 3343487000,
    metadata: '[]'
  }

  it('normalises the LNURL-pay response to whole sats', () => {
    expect(normalizeLnurlPayInfo(info)).toMatchObject({
      callback: info.callback,
      minSats: 1,
      maxSats: 3343487,
      commentAllowed: 0
    })
    expect(() => normalizeLnurlPayInfo({ ...info, tag: 'withdrawRequest' })).toThrow()
    expect(() => normalizeLnurlPayInfo({ ...info, callback: 'not a url' })).toThrow()
  })

  it('builds a callback with the exact millisat amount and no comment', () => {
    const url = new URL(lnurlCallbackUrl(info.callback, 14887))
    expect(url.searchParams.get('amount')).toBe('14887000')
    expect(url.searchParams.has('comment')).toBe(false)
  })

  it('reads the BOLT11 invoice from the callback proxy response', () => {
    expect(parseLnurlInvoice({ pr: INVOICE_67_SATS })).toBe(INVOICE_67_SATS)
    expect(parseLnurlInvoice({ payment_request: INVOICE_67_SATS })).toBe(INVOICE_67_SATS)
    expect(() => parseLnurlInvoice({ pr: 'lntb100u1abc' })).toThrow()
  })
})

describe('Lightning account routing helpers', () => {
  it('normalises accounts and validates Hive names', () => {
    expect(normalizeAccount('  @Alice ')).toBe('alice')
    expect(normalizeAccount(null)).toBe('')
    expect(isValidHiveAccount('@Alice')).toBe(true)
    expect(isValidHiveAccount('ab')).toBe(false)
    expect(isValidHiveAccount('not a name')).toBe(false)
    expect(isValidHiveAccount(null)).toBe(false)
  })

  it('falls back to the hive domain for unknown currencies', () => {
    expect(lightningAddressDomain('hive')).toBe('v4v.app')
    expect(lightningAddressDomain('hbd')).toBe('hbd.v4v.app')
    expect(lightningAddressDomain('unknown')).toBe('v4v.app')
    expect(lightningAddress('alice', 'unknown')).toBe('alice@v4v.app')
  })

  it('matches only the v4vapp account family', () => {
    expect(isV4vappAccount('v4vapp')).toBe(true)
    expect(isV4vappAccount('@V4VAPP.hbd')).toBe(true)
    expect(isV4vappAccount('v4vappx')).toBe(false)
    expect(isV4vappAccount('alice')).toBe(false)
    expect(isV4vappTransfer({ from: 'v4vapp', to: 'alice' })).toBe(true)
    expect(isV4vappTransfer({ from: 'alice', to: 'v4vapp.hbd' })).toBe(true)
    expect(isV4vappTransfer({ from: 'alice', to: 'bob' })).toBe(false)
    expect(isV4vappTransfer()).toBe(false)
  })
})
