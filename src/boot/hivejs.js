import { defineBoot } from '#q-app'
import { hive, selectHiveNode, setHiveNode } from 'src/services/hive'
import { DEFAULT_HIVE_NODE } from 'src/services/hiveNodes'
import { useHiveStore } from 'src/stores/hive'

export default defineBoot(({ app }) => {
  const store = useHiveStore()
  const configuredNode = store.user?.settings?.apiNode || DEFAULT_HIVE_NODE

  // Mount against the configured node immediately. Node probing is a network
  // operation and must never block first paint; improve the node later if a
  // healthy fallback is faster.
  setHiveNode(configuredNode)
  app.config.globalProperties.$hive = hive

  const probeAndSwitch = () => {
    selectHiveNode(configuredNode)
      .then(node => {
        if (node && node !== configuredNode) setHiveNode(node)
      })
      .catch(() => {})
  }
  if (typeof window === 'undefined') return
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(probeAndSwitch, { timeout: 2500 })
  } else {
    window.setTimeout(probeAndSwitch, 0)
  }
})

export { hive }
