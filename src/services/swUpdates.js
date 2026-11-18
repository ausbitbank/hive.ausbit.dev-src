// Pure helpers for the service-worker update prompt.

export const SW_UPDATE_MESSAGE = Object.freeze({ type: 'SKIP_WAITING' })

/**
 * A waiting worker is always an update. An installing worker only counts once
 * it reaches `installed` and the page is already controlled (otherwise it is
 * the first install, not an update).
 */
export function isUpdateAvailable ({ waiting = null, installing = null, controlled = false } = {}) {
  if (!controlled) return false
  if (waiting) return true
  return installing?.state === 'installed'
}

export function requestSkipWaiting (worker) {
  if (!worker || typeof worker.postMessage !== 'function') return false
  worker.postMessage(SW_UPDATE_MESSAGE)
  return true
}
