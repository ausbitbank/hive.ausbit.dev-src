// Pure summary for the Node health dashboard widget.
//
// `getApiNodeHealth()` reports the session state of every configured API node,
// while `fetchGlobalProps()` supplies the chain head. Keeping the derivation
// here means the widget only renders the result and the edge cases (a fresh
// session, cooldowns, missing global properties, absent L2 probes) are testable
// without mounting Vue.

function numberOrNull (value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function counter (node, key) {
  const value = numberOrNull(node?.[key])
  return value === null ? 0 : value
}

function statusLabelFor (status) {
  switch (status) {
    case 'critical':
      return 'Needs attention'
    case 'warning':
      return 'Degraded'
    case 'healthy':
      return 'Healthy'
    default:
      return 'Unknown'
  }
}

function probeStatus (probe) {
  if (!probe || typeof probe !== 'object') return null
  const configured = probe.configured === undefined ? Boolean(probe.url) : Boolean(probe.configured)
  const ok = Boolean(probe.ok)
  const latency = numberOrNull(probe.latency)
  let label = 'Offline'
  if (ok) label = 'Online'
  else if (probe.error) label = String(probe.error)
  else if (!configured) label = 'Not configured'
  return {
    configured,
    ok,
    label,
    latencyMs: latency === null ? null : Math.round(latency)
  }
}

export function nodeHealthSummary ({ health = [], globalProps = null, engine = null, magi = null } = {}) {
  const list = (Array.isArray(health) ? health : []).filter(Boolean)
  const activeNode = list.find(node => node.active) || list[0] || null

  const healthy = list.filter(node => !node.coolingDown && counter(node, 'successes') > 0)
  // A configured node that has simply not been used yet is unverified, not
  // failing. Only a cooldown, a current failure streak or failures without a
  // single success count as a problem.
  const failing = list.filter(node => (
    Boolean(node.coolingDown) ||
    counter(node, 'consecutiveFailures') > 0 ||
    (counter(node, 'failures') > 0 && counter(node, 'successes') === 0)
  ))
  const coolingDown = list.filter(node => Boolean(node.coolingDown)).length
  const failures = list.reduce((sum, node) => sum + counter(node, 'failures'), 0)
  const attempted = list.some(node => (
    counter(node, 'successes') > 0 ||
    counter(node, 'failures') > 0 ||
    counter(node, 'consecutiveFailures') > 0 ||
    Boolean(node.coolingDown)
  ))

  const latencyCandidates = [activeNode?.lastLatency, ...list.map(node => node.lastLatency)]
  const lastLatency = latencyCandidates
    .map(numberOrNull)
    .find(value => value !== null) ?? null

  const headBlock = numberOrNull(globalProps?.head_block_number) ??
    numberOrNull(globalProps?.headBlock) ?? 0

  const nodeCount = list.length
  const healthyCount = healthy.length
  const failingCount = failing.length

  let status = 'unknown'
  if (nodeCount > 0 && (attempted || headBlock > 0)) {
    if (healthyCount === 0) status = 'critical'
    else if (activeNode?.coolingDown) status = 'critical'
    else if (failingCount > 0 || !headBlock) status = 'warning'
    else status = 'healthy'
  }

  return {
    activeNode,
    nodes: nodeCount,
    healthy: healthyCount,
    failing: failingCount,
    lastLatency,
    failures,
    coolingDown,
    consecutiveFailures: counter(activeNode, 'consecutiveFailures'),
    headBlock,
    status,
    statusLabel: statusLabelFor(status),
    engine: probeStatus(engine),
    magi: probeStatus(magi)
  }
}

export default nodeHealthSummary
