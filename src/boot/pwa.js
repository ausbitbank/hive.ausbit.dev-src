import { Dialog, Notify } from 'quasar'
import { defineBoot } from '#q-app'
import {
  OFFLINE_SIGNING_EVENT,
  connectivity,
  installConnectivity,
  setOnlineStatus
} from 'src/services/connectivity'
import { isUpdateAvailable, requestSkipWaiting } from 'src/services/swUpdates'

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000

// Register the offline shell only in production builds served over HTTPS.
export default defineBoot(({ app }) => {
  app.config.globalProperties.$online = connectivity

  if (typeof window === 'undefined') return

  installConnectivity()

  window.addEventListener('offline', () => {
    setOnlineStatus(false)
    Notify.create({
      message: 'You are offline. Cached pages remain available; chain actions will wait for a connection.',
      color: 'orange',
      icon: 'cloud_off',
      position: 'top',
      timeout: 6000
    })
  })

  window.addEventListener('online', () => {
    setOnlineStatus(true)
    Notify.create({
      message: 'Connection restored.',
      color: 'green',
      icon: 'cloud_done',
      position: 'top',
      timeout: 2500
    })
  })

  window.addEventListener(OFFLINE_SIGNING_EVENT, () => {
    Notify.create({
      message: 'Signing is blocked while offline. The action is saved and can be sent after reconnecting.',
      color: 'orange',
      icon: 'lock_clock',
      position: 'top',
      timeout: 5000
    })
  })

  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

  let promptedWorker = null
  let updateCheckAt = 0

  const promptForUpdate = registration => {
    // Only a waiting worker can accept SKIP_WAITING safely. An installing
    // worker becomes waiting in the same task once the current one is active.
    const worker = registration.waiting
    if (!worker || promptedWorker === worker) return
    promptedWorker = worker

    Dialog.create({
      dark: true,
      title: 'Update available',
      message: 'A new version of Banksia is ready. Reload now to use it, or keep this version open and update later.',
      persistent: true,
      ok: { label: 'Reload now', color: 'primary', unelevated: true, noCaps: true },
      cancel: { label: 'Later', color: 'grey', flat: true, noCaps: true }
    }).onOk(() => applyUpdate(registration))
      .onCancel(() => {
        promptedWorker = null
        Notify.create({
          message: 'Update available. Reload when you are ready to switch versions.',
          color: 'primary',
          icon: 'system_update',
          position: 'top',
          timeout: 4000
        })
      })
  }

  const applyUpdate = registration => {
    const waiting = registration.waiting
    let reloading = false
    const reloadOnce = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', reloadOnce, { once: true })

    if (!requestSkipWaiting(waiting)) {
      // No waiting worker (for example the update activated between the prompt
      // and confirmation). Reload to pick up whatever the controller now serves.
      reloadOnce()
    }
  }

  const watchRegistration = registration => {
    const checkInstalling = () => {
      if (!isUpdateAvailable({
        waiting: registration.waiting,
        installing: registration.installing,
        controlled: Boolean(navigator.serviceWorker.controller)
      })) return

      if (registration.waiting) promptForUpdate(registration)
      else setTimeout(() => {
        if (registration.waiting) promptForUpdate(registration)
      }, 0)
    }

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing
      if (!installing) return
      installing.addEventListener('statechange', checkInstalling)
      checkInstalling()
    })

    checkInstalling()
  }

  const register = () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        watchRegistration(registration)
        updateCheckAt = Date.now()

        // Check explicitly when the tab returns, but never in the background
        // more often than the interval above.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState !== 'visible') return
          if (Date.now() - updateCheckAt < UPDATE_CHECK_INTERVAL_MS) return
          updateCheckAt = Date.now()
          registration.update().catch(() => {})
        })
      })
      .catch(error => {
        console.warn('Service worker registration failed', error)
      })
  }

  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
})
