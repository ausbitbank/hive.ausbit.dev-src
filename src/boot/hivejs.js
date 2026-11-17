import { defineBoot } from '#q-app'
import { hive, selectHiveNode, setHiveNode } from 'src/services/hive'
import { useHiveStore } from 'src/stores/hive'

export default defineBoot(async ({ app }) => {
  const store = useHiveStore()
  const configuredNode = store.user?.settings?.apiNode

  // Health-check at most ~4s (one 2s probe for the configured node, then a
  // parallel 2s probe of the known fallbacks) before installing $hive.
  let node
  try {
    node = await selectHiveNode(configuredNode)
  } catch {
    node = configuredNode
  }
  setHiveNode(node)
  app.config.globalProperties.$hive = hive
})

export { hive }
