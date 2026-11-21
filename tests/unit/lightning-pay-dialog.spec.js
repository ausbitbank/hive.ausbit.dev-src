import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { Quasar } from 'quasar'

vi.mock('src/services/prices', () => ({
  getHivePrices: vi.fn()
}))

vi.mock('src/services/v4vapp', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getBridgeStatus: vi.fn(),
    getSatsToHive: vi.fn(),
    getBridgeState: vi.fn(),
    bridgeFeePolicy: vi.fn(() => ({ percent: 0.029, fixed: 50, minSats: 50, maxSats: 180000 }))
  }
})

import { getHivePrices } from 'src/services/prices'
import { getBridgeState, getBridgeStatus, getSatsToHive } from 'src/services/v4vapp'
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
    expect(dialog.vm.quote.totalSats).toBe(1079)
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
    getSatsToHive.mockResolvedValue({ HBD: 0, HIVE: 0 })

    const dialog = mountDialog()
    await dialog.vm.loadQuote()

    expect(dialog.vm.quoteError).toBe('Could not read a Hive/HBD price to estimate the cost.')
    expect(dialog.vm.canQueue).toBe(false)
  })
})
