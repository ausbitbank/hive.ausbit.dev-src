import { defineBoot } from '#q-app'
import { installRoutePrefetch } from 'src/router/prefetch'

export default defineBoot(({ router }) => {
  if (typeof window === 'undefined') return
  const uninstall = installRoutePrefetch(router, window)
  // Boot teardown is not used by the SPA, but keep the cleanup available for
  // HMR and isolated tests.
  if (import.meta.hot) import.meta.hot.dispose(uninstall)
})
