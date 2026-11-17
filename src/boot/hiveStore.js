import { defineBoot } from '#q-app'
import { useHiveStore } from 'src/stores/hive'

export default defineBoot(({ app }) => {
  // Pinia stores are not available through `this.$store` like Vuex was.
  // Expose the single app store once so Options API components can use
  // `this.$hiveStore.<state|action>`.
  app.config.globalProperties.$hiveStore = useHiveStore()
})
