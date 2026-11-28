import { defineBoot } from '#q-app'
import { hive, selectHiveNode, setHiveNode } from 'src/services/hive'
import { DEFAULT_HIVE_NODE, HIVE_ENGINE_NODES, MAGI_NODES } from 'src/services/hiveNodes'
import { probeHiveEngineNode } from 'src/services/hiveEngine'
import { probeMagiNode } from 'src/services/magi'
import { pickFastestHealthy } from 'src/services/network'
import { loadNodePrefs } from 'src/services/nodeHistory'
import { useHiveStore } from 'src/stores/hive'

export default defineBoot(({ app }) => {
  const store = useHiveStore()
  const configuredNode = store.user?.settings?.apiNode || DEFAULT_HIVE_NODE

  // Mount against the configured node immediately. Node probing is a network
  // operation and must never block first paint; improve the node later if a
  // healthy fallback is faster.
  setHiveNode(configuredNode)
  app.config.globalProperties.$hive = hive

  const fastestOf = async (urls, probe) => {
    const results = await Promise.all([...new Set(urls.filter(Boolean))].map(url => probe(url)))
    return pickFastestHealthy(results)
  }

  const selectLayer2 = async () => {
    const prefs = loadNodePrefs()
    if (!prefs.autoSelectFastest && !prefs.autoFailover) return
    const settings = store.user?.settings || {}
    const heConfigured = settings.heApiNode || HIVE_ENGINE_NODES[0]
    const magiConfigured = settings.magiApiNode || MAGI_NODES[0]

    const selectFastest = prefs.autoSelectFastest
    // When auto-select is off, probe only the configured endpoints. The
    // services already retry their own fallbacks per request, so a full roster
    // probe on every page load would be wasted work.
    const [heCurrent, magiCurrent] = selectFastest
      ? [null, null]
      : await Promise.all([
          probeHiveEngineNode(heConfigured),
          probeMagiNode(magiConfigured)
        ])

    const [heFastest, magiFastest] = await Promise.all([
      selectFastest || !heCurrent?.ok
        ? fastestOf([heConfigured, ...HIVE_ENGINE_NODES], probeHiveEngineNode)
        : null,
      selectFastest || !magiCurrent?.ok
        ? fastestOf([magiConfigured, ...MAGI_NODES], probeMagiNode)
        : null
    ])

    // Re-read settings after the probes: the user may have saved changes while
    // the network calls were in flight. Merge only the node choices.
    const current = store.user?.settings || settings
    const next = { ...current }
    if (heFastest?.url && heFastest.url !== heConfigured) next.heApiNode = heFastest.url
    if (magiFastest?.url && magiFastest.url !== magiConfigured) next.magiApiNode = magiFastest.url
    if (next.heApiNode !== current.heApiNode || next.magiApiNode !== current.magiApiNode) {
      store.updateSettings(next)
    }
  }

  const probeAndSwitch = () => {
    selectHiveNode(configuredNode)
      .then(node => {
        if (node && node !== configuredNode) setHiveNode(node)
      })
      .catch(() => {})
      .finally(() => {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return
        selectLayer2().catch(() => {})
      })
  }
  if (typeof window === 'undefined') return
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(probeAndSwitch, { timeout: 2500 })
  } else {
    window.setTimeout(probeAndSwitch, 0)
  }
})

export { hive }
