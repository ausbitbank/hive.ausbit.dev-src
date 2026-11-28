import { beforeEach, describe, expect, it } from 'vitest'
import dashboardState, { loadDashboard } from '../../src/stores/hive/dashboard'
import { saveDashboard, setupPromptKey } from '../../src/services/dashboardPrefs'
import { buildLayout } from '../../src/services/dashboardLayout'

// The initial store state is built once at boot, before any mutation runs. A
// restored session never calls `loadDashboard`, so these tests pin the values
// the page relies on straight after `state.js` spreads `dashboardState()`.

describe('dashboard boot state', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('resolves the signed-in account layout at boot', () => {
    saveDashboard('alice', buildLayout([{ type: 'wallet' }, { type: 'myWitness' }]))
    const { dashboard } = dashboardState('alice')
    expect(dashboard.source).toBe('account')
    expect(dashboard.widgets.map(widget => widget.type)).toEqual(['wallet', 'myWitness'])
    expect(dashboard.customised).toBe(true)
  })

  it('shows the setup prompt to a known account with no customised layout', () => {
    expect(dashboardState('alice').dashboard.setupPromptVisible).toBe(true)
    expect(dashboardState(null).dashboard.setupPromptVisible).toBe(false)
  })

  it('keeps the prompt dismissed at boot', () => {
    localStorage.setItem(setupPromptKey('alice'), String(Date.now()))
    expect(dashboardState('alice').dashboard.setupPromptVisible).toBe(false)
  })

  it('closes the editor when the identity changes', () => {
    const ctx = { dashboard: { ...dashboardState('alice').dashboard }, refreshSetupPrompt: () => {} }
    ctx.dashboard.editing = true
    loadDashboard.call(ctx, 'bob')
    expect(ctx.dashboard.editing).toBe(false)
  })
})
