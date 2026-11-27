import { describe, expect, it } from 'vitest'
import { ADVISORY_BUDGET_KEYS, checkBudgets } from '../../scripts/perf-budgets.mjs'

const BUDGETS = {
  initialJsKb: 160,
  cssKb: 55,
  lcpMs: 5000,
  routes: {
    '/': { jsKb: 300, routeJsKb: 180, totalKb: 500, lcpMs: 2500, cls: 0.1 }
  }
}

function route (overrides = {}) {
  return {
    route: '/',
    name: 'Home',
    initialJsKb: 150,
    jsKb: 280,
    routeJsKb: 170,
    totalKb: 480,
    appTotalKb: 450,
    lcpMs: 2000,
    cls: 0.02,
    ...overrides
  }
}

describe('performance budget comparison', () => {
  it('passes when every value is inside its route budget', () => {
    expect(checkBudgets({ routes: [route()] }, BUDGETS)).toEqual({ failures: [], warnings: [] })
  })

  it('blocks bundle, CSS and app-transfer regressions', () => {
    const { failures, warnings } = checkBudgets({
      routes: [route({ initialJsKb: 200, jsKb: 400, cssKb: 80, appTotalKb: 600 })]
    }, BUDGETS)
    expect(warnings).toEqual([])
    expect(failures).toHaveLength(4)
    expect(failures.join('\n')).toContain('initial JS')
    expect(failures.join('\n')).toContain('total JS')
    expect(failures.join('\n')).toContain('CSS')
    expect(failures.join('\n')).toContain('total transfer')
  })

  it('reports LCP and CLS as advisory warnings', () => {
    const { failures, warnings } = checkBudgets({
      routes: [route({ lcpMs: 9000, cls: 0.5 })]
    }, BUDGETS)
    expect(failures).toEqual([])
    expect(warnings).toHaveLength(2)
    expect(ADVISORY_BUDGET_KEYS).toContain('lcpMs')
    expect(ADVISORY_BUDGET_KEYS).toContain('cls')
  })

  it('uses the route budget before the global fallback', () => {
    const { failures } = checkBudgets({
      routes: [route({ route: '/other', name: 'Other', lcpMs: 9000 })]
    }, BUDGETS)
    expect(failures).toEqual([])
  })

  it('does nothing without budgets', () => {
    expect(checkBudgets({ routes: [route()] }, null)).toEqual({ failures: [], warnings: [] })
  })
})
