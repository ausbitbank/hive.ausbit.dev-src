import { describe, expect, it, vi } from 'vitest'
import { SW_UPDATE_MESSAGE, isUpdateAvailable, requestSkipWaiting } from '../../src/services/swUpdates'

describe('service-worker update prompt', () => {
  it('never prompts on the first install', () => {
    expect(isUpdateAvailable({
      waiting: null,
      installing: { state: 'installed' },
      controlled: false
    })).toBe(false)
  })

  it('prompts for a waiting worker or an installed update', () => {
    expect(isUpdateAvailable({ waiting: { state: 'installed' }, controlled: true })).toBe(true)
    expect(isUpdateAvailable({ installing: { state: 'installed' }, controlled: true })).toBe(true)
    expect(isUpdateAvailable({ installing: { state: 'installing' }, controlled: true })).toBe(false)
  })

  it('sends the explicit skip-waiting message only to a real worker', () => {
    const worker = { postMessage: vi.fn() }
    expect(requestSkipWaiting(worker)).toBe(true)
    expect(worker.postMessage).toHaveBeenCalledWith(SW_UPDATE_MESSAGE)
    expect(requestSkipWaiting(null)).toBe(false)
  })
})
