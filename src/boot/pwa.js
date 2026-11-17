import { Notify } from 'quasar'
import { defineBoot } from '#q-app'

// Register the offline shell only in production builds served over HTTPS.
export default defineBoot(() => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  if (!import.meta.env.PROD) return

  const register = () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('Service worker registration failed', error)
    })
  }
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })

  window.addEventListener('offline', () => {
    Notify.create({
      message: 'You are offline. Cached pages remain available; chain actions will wait for a connection.',
      color: 'orange',
      icon: 'cloud_off',
      position: 'top',
      timeout: 6000
    })
  })

  window.addEventListener('online', () => {
    Notify.create({
      message: 'Connection restored.',
      color: 'green',
      icon: 'cloud_done',
      position: 'top',
      timeout: 2500
    })
  })
})
