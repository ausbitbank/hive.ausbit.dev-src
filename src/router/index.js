import { defineRouter } from '#q-app'
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import routes from './routes'

export default defineRouter(function () {
  const createHistory = import.meta.env.QUASAR_VUE_ROUTER_MODE === 'hash'
    ? createWebHashHistory
    : createWebHistory

  return createRouter({
    scrollBehavior (to, from, savedPosition) {
      if (to.hash) return { el: to.hash, top: 84, behavior: 'smooth' }
      // A query-only change (for example opening the quick-look peek) must
      // leave the feed exactly where it was.
      if (to.path === from.path) return false
      if (savedPosition) {
        // Browse feeds restore their loaded pages synchronously, but let Vue
        // commit the restored cards before the browser measures the document.
        return new Promise(resolve => {
          if (typeof requestAnimationFrame !== 'function') {
            resolve(savedPosition)
            return
          }
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(savedPosition)))
        })
      }
      return { left: 0, top: 0 }
    },
    routes,
    history: createHistory(import.meta.env.QUASAR_VUE_ROUTER_BASE)
  })
})
