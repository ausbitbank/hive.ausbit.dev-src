import { defineBoot } from '#q-app'
import { hive, setHiveNode } from 'src/services/hive'
import { useHiveStore } from 'src/stores/hive'

export default defineBoot(({ app }) => {
  const store = useHiveStore()
  setHiveNode(store.user.settings.apiNode)
  app.config.globalProperties.$hive = hive
})

export { hive }
