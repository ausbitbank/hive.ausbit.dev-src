// Shared online/offline state.
//
// The PWA boot owns the browser listeners; read-only views and the signing
// queue consume the reactive state so stale notices and disabled signing
// controls agree with the actual connection.

import { reactive } from 'vue'

export const OFFLINE_SIGNING_EVENT = 'hive:offline-signing-blocked'

function initialOnline () {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

export const connectivity = reactive({
  online: initialOnline(),
  changedAt: Date.now()
})

export function isOnline () {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  return connectivity.online !== false
}

export function setOnlineStatus (value) {
  const online = Boolean(value)
  if (connectivity.online === online) return connectivity.online
  connectivity.online = online
  connectivity.changedAt = Date.now()
  return connectivity.online
}

export function notifyOfflineSigningBlocked () {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(OFFLINE_SIGNING_EVENT))
  }
}

export function installConnectivity () {
  if (typeof window === 'undefined') return () => {}
  const handleOnline = () => setOnlineStatus(true)
  const handleOffline = () => setOnlineStatus(false)
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  setOnlineStatus(initialOnline())
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}
