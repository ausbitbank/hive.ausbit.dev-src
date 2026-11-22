import { defineBoot } from '#q-app'
import { useAppearanceStore } from 'src/stores/appearance'

export default defineBoot(({ app, $q }) => {
  const appearance = useAppearanceStore()
  appearance.hydrate($q)
  app.config.globalProperties.$appearance = appearance
})
