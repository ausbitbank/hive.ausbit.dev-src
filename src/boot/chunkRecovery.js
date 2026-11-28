import { defineBoot } from '#q-app'
import { Dialog } from 'quasar'
import {
  isStaleBundleError,
  readLastReload,
  rememberReload,
  shouldAutoReload
} from 'src/services/staleBundle'

// A tab left open across a deploy keeps the old bundle in memory. Navigating to
// a route that was not loaded yet then requests a hashed chunk that no longer
// exists, so the click appears to do nothing or the page dies. Turn that dead
// end into a reload: automatically once, then a clear prompt if it happens
// again, which avoids a reload loop when the cause is the network instead.
export default defineBoot(({ router }) => {
  if (typeof window === 'undefined') return

  let recovering = false
  let navigating = false

  const reload = () => {
    rememberReload(window.sessionStorage)
    window.location.reload()
  }

  const promptReload = () => {
    Dialog.create({
      dark: true,
      title: 'New version available',
      message: 'This tab is running an older version of Banksia. Reload to pick up the current version and continue.',
      persistent: true,
      ok: { label: 'Reload now', color: 'primary', unelevated: true, noCaps: true },
      cancel: { label: 'Later', color: 'grey', flat: true, noCaps: true }
    }).onOk(reload)
      .onCancel(() => { recovering = false })
      .onDismiss(() => { recovering = false })
  }

  const recover = () => {
    if (recovering) return
    // A failed chunk fetch while offline is a connection problem, not a stale
    // deploy. The connectivity service already tells the user about it.
    if (window.navigator?.onLine === false) return

    recovering = true
    const lastReloadAt = readLastReload(window.sessionStorage)
    if (shouldAutoReload(Date.now(), lastReloadAt)) reload()
    else promptReload()
  }

  // Hover prefetching (src/router/prefetch.js) also loads route chunks, but a
  // failed hint must never yank the page out from under someone who is just
  // reading. Only a real navigation failure recovers; the click that follows a
  // failed prefetch still goes through the router and lands in onError below.
  router?.beforeEach(() => {
    navigating = true
  })
  router?.afterEach(() => {
    navigating = false
  })

  // Vite fires this when a dynamic import or its preload fails, before the
  // router sees the rejection.
  window.addEventListener('vite:preloadError', event => {
    if (!navigating) return
    event.preventDefault?.()
    recover()
  })

  router?.onError(error => {
    navigating = false
    if (isStaleBundleError(error)) recover()
  })
})
