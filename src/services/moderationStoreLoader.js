// Lazy access to the moderation store.
//
// The store pulls in the policy, settings and chain-read modules. Most routes
// never need them, so importing this tiny loader keeps the moderation code out
// of the initial and browse chunks; the first skin surface loads it on mount.

let pending = null

export function loadModerationStore () {
  if (!pending) {
    pending = import('src/stores/moderation')
      .then(module => module.useModerationStore())
      .catch(error => {
        pending = null
        throw error
      })
  }
  return pending
}
