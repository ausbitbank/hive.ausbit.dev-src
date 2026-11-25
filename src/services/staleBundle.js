// Pure helpers for recovering from a tab that outlived a deploy.
//
// A tab opened before a deploy keeps the old entry bundle in memory. When the
// user later navigates to a route that was not loaded yet, Vue Router asks for
// a content-hashed chunk from the old build. If the origin no longer has that
// file the import rejects and the navigation dies. These helpers decide whether
// a rejected import looks like that case, and whether a single automatic reload
// is still safe (rather than an endless reload loop).

export const STALE_BUNDLE_RELOAD_KEY = 'hive:stale-bundle-reload-at'

// One automatic reload per minute. Deploys are not frequent enough for a
// healthy tab to hit this twice; a repeat inside the window means something
// else is broken and the user should get a prompt instead of a reload loop.
export const STALE_BUNDLE_RELOAD_COOLDOWN_MS = 60 * 1000

const STALE_BUNDLE_ERRORS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /loading chunk [\w-]+ failed/i,
  /chunkloaderror/i,
  /unable to preload css/i,
  /failed to load module script/i
]

export function isStaleBundleError (error) {
  if (!error) return false
  if (typeof error === 'string') return STALE_BUNDLE_ERRORS.some(pattern => pattern.test(error))

  if (error.name === 'ChunkLoadError') return true
  const message = typeof error.message === 'string' ? error.message : ''
  return STALE_BUNDLE_ERRORS.some(pattern => pattern.test(message))
}

export function shouldAutoReload (now, lastReloadAt, cooldown = STALE_BUNDLE_RELOAD_COOLDOWN_MS) {
  if (!Number.isFinite(now)) return false
  if (!Number.isFinite(lastReloadAt) || lastReloadAt <= 0) return true
  return now - lastReloadAt > cooldown
}

export function readLastReload (storage) {
  try {
    return Number(storage?.getItem(STALE_BUNDLE_RELOAD_KEY)) || 0
  } catch {
    return 0
  }
}

export function rememberReload (storage, now = Date.now()) {
  try {
    storage?.setItem(STALE_BUNDLE_RELOAD_KEY, String(now))
  } catch {
    // Private mode or blocked storage: the reload still works, it just cannot
    // be de-duplicated across the navigation.
  }
}
