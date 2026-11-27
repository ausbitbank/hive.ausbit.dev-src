// Pure budget comparison for scripts/perf-baseline.mjs.
//
// Bundle-size and app-transfer budgets are deterministic enough to block a
// merge. LCP and CLS still depend on live public nodes, images and CI CPU, so
// they are reported as advisory notes. This keeps the PR gate useful without
// making a slow API node look like a bundle regression.

export const ADVISORY_BUDGET_KEYS = Object.freeze(['lcpMs', 'cls'])

const CHECKS = [
  ['initialJsKb', 'initial JS'],
  ['routeJsKb', 'route JS'],
  ['jsKb', 'total JS'],
  ['cssKb', 'CSS'],
  ['totalKb', 'total transfer'],
  ['lcpMs', 'LCP'],
  ['cls', 'CLS']
]

export function checkBudgets (result, budgets) {
  const failures = []
  const warnings = []
  if (!budgets) return { failures, warnings }

  const limitFor = (route, key) => {
    const routeBudget = budgets.routes?.[route] || {}
    return routeBudget[key] ?? budgets[key]
  }

  for (const route of result.routes || []) {
    for (const [key, name] of CHECKS) {
      const limit = limitFor(route.route, key)
      if (limit === undefined || limit === null) continue
      // Third-party/UGC media varies by live content; the transfer budget
      // covers app-owned assets so CI does not fail on a remote article image.
      const value = key === 'totalKb' ? route.appTotalKb : route[key]
      if (!(Number(value) > Number(limit))) continue
      const message = `${route.name}: ${name} ${value} > budget ${limit}`
      if (ADVISORY_BUDGET_KEYS.includes(key)) warnings.push(message)
      else failures.push(message)
    }
  }
  return { failures, warnings }
}
