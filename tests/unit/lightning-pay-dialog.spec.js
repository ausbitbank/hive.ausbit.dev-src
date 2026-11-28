import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Quasar } from 'quasar'

vi.mock('src/services/prices', () => ({
  getHivePrices: vi.fn()
}))

vi.mock('src/services/v4vapp', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getBridgeQuote: vi.fn(),
    getBridgeStatus: vi.fn(),
    getSatsToHive: vi.fn(),
    getBridgeState: vi.fn(),
    bridgeFeePolicy: vi.fn(() => ({ percent: 0.029, fixed: 50, minSats: 50, maxSats: 180000 }))
  }
})

import { getHivePrices } from 'src/services/prices'
import { getBridgeQuote, getBridgeState, getBridgeStatus, getSatsToHive } from 'src/services/v4vapp'
import LightningPayDialog from 'src/components/lightning/LightningPayDialog.vue'

const global = { plugins: [[Quasar, {}]] }
let wrapper = null

function mountDialog () {
  wrapper = mount(LightningPayDialog, {
    props: { modelValue: true, account: 'brianoflondon', liquidHive: 100, liquidHbd: 100 },
    global
  })
  wrapper.vm.target = { type: 'address', value: 'alice@getalby.com' }
  wrapper.vm.manualSats = '1000'
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  getBridgeStatus.mockResolvedValue({ config: {} })
  getBridgeQuote.mockResolvedValue({ v4vapp: { sats_Hive: 58.829245, sats_HBD: 1602.198869 } })
  getBridgeState.mockReturnValue({ state: 'available' })
  getSatsToHive.mockResolvedValue({ HBD: 0.673, HIVE: 18.34 })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('Lightning pay dialog quote', () => {
  it('falls back to the bridge quote when market prices are unavailable', async () => {
    getHivePrices.mockRejectedValue(new Error('CoinGecko HTTP 429'))

    const dialog = mountDialog()
    await dialog.vm.loadQuote()

    expect(dialog.vm.quote.valid).toBe(true)
    expect(dialog.vm.quote.totalSats).toBe(1134)
    expect(dialog.vm.quoteSource).toBe('bridge')
    expect(dialog.vm.quoteError).toBe('')
    expect(dialog.vm.cost).toBe(0.673)
    expect(dialog.vm.canQueue).toBe(true)
  })

  it('prefers the bridge quote over the market estimate', async () => {
    getHivePrices.mockResolvedValue({
      bitcoin: { usd: 61704.005 },
      hive: { btc: 5.8829245e-7, usd: 0.0363 },
      hive_dollar: { btc: 1.602198869e-5, usd: 0.9886 }
    })

    const dialog = mountDialog()
    await dialog.vm.loadQuote()

    expect(dialog.vm.quoteSource).toBe('bridge')
    expect(dialog.vm.cost).toBe(0.673)
  })

  it('reports an error and blocks queueing when no cost is available', async () => {
    getHivePrices.mockRejectedValue(new Error('unreachable'))
    getBridgeQuote.mockResolvedValue({})
    getSatsToHive.mockResolvedValue({ HBD: 0, HIVE: 0 })

    const dialog = mountDialog()
    await dialog.vm.loadQuote()

    expect(dialog.vm.quoteError).toBe('Could not read a Hive/HBD price to estimate the cost.')
    expect(dialog.vm.canQueue).toBe(false)
  })
})

describe('Lightning pay dialog amount links', () => {
  const prices = {
    bitcoin: { usd: 61704.005 },
    hive: { btc: 5.8829245e-7, usd: 0.0363 },
    hive_dollar: { btc: 1.602198869e-5, usd: 0.9886 }
  }

  it('takes the amount and unit from the payment link', () => {
    wrapper = mount(LightningPayDialog, {
      props: {
        modelValue: false,
        account: 'brianoflondon',
        initialInput: 'alice@getalby.com',
        initialAmount: 5,
        initialCurrency: 'hbd'
      },
      global
    })
    wrapper.vm.reset()

    expect(wrapper.vm.amountUnit).toBe('hbd')
    expect(wrapper.vm.manualSats).toBe('5')
  })

  it('treats an HBD amount as the total spend including the fee', async () => {
    getHivePrices.mockResolvedValue(prices)

    wrapper = mount(LightningPayDialog, {
      props: {
        modelValue: true,
        account: 'brianoflondon',
        liquidHbd: 100,
        initialInput: 'alice@getalby.com',
        initialAmount: 5,
        initialCurrency: 'hbd'
      },
      global
    })
    await flushPromises()

    expect(wrapper.vm.amountUnit).toBe('hbd')
    expect(wrapper.vm.asset).toBe('HBD')
    expect(wrapper.vm.manualSats).toBe('5')
    expect(wrapper.vm.rates.satsPerHbd).toBe(1602.198869)

    await wrapper.vm.loadQuote()
    expect(wrapper.vm.quote.spend).toBe(5)
    expect(wrapper.vm.quote.totalSats).toBe(8011)
    expect(wrapper.vm.quote.bridgeFeeSats).toBe(283)
    expect(wrapper.vm.quote.bufferSats).toBe(58)
    expect(wrapper.vm.quote.feeSats).toBe(341)
    expect(wrapper.vm.quote.amountSats).toBe(7670)
    expect(wrapper.vm.amountSats).toBe(7670)
    expect(wrapper.vm.cost).toBe(5)
    expect(wrapper.vm.quoteError).toBe('')
  })

  it('does not reinterpret an existing sats value when the unit changes', () => {
    const dialog = mountDialog()
    expect(dialog.vm.manualSats).toBe('1000')

    dialog.vm.amountUnit = 'hbd'
    dialog.vm.onUnitChange()

    expect(dialog.vm.manualSats).toBe('')
    expect(dialog.vm.amountSats).toBe(0)
  })

  it('fills the full liquid HIVE balance into the spend field', () => {
    wrapper = mount(LightningPayDialog, {
      props: {
        modelValue: false,
        account: 'ausbitbank',
        liquidHive: 12.345,
        liquidHbd: 5
      },
      global
    })
    wrapper.vm.reset()
    wrapper.vm.amountUnit = 'hive'
    wrapper.vm.asset = 'HIVE'
    wrapper.vm.useFullBalance()

    expect(wrapper.vm.manualSats).toBe('12.345')
    expect(wrapper.vm.assetBalance).toBe(12.345)
  })
})
