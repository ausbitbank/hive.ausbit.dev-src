import { defineRouter } from '#q-app'
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import routes from './routes'

export default defineRouter(function () {
  const createHistory = import.meta.env.QUASAR_VUE_ROUTER_MODE === 'hash'
    ? createWebHashHistory
    : createWebHistory

  return createRouter({
    scrollBehavior: (to) => to.hash
      ? { el: to.hash, top: 84, behavior: 'smooth' }
      : { left: 0, top: 0 },
    routes,
    history: createHistory(import.meta.env.QUASAR_VUE_ROUTER_BASE)
  })
})
