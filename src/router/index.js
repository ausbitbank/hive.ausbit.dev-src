import { defineRouter } from '#q-app'
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import routes from './routes'

export default defineRouter(function () {
  const createHistory = import.meta.env.QUASAR_VUE_ROUTER_MODE === 'hash'
    ? createWebHashHistory
    : createWebHistory

  return createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(import.meta.env.QUASAR_VUE_ROUTER_BASE)
  })
})
