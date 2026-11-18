// Intent-based route prefetching.
//
// Hovering or focusing an internal link warms the route's dynamic import before
// the click. Nothing is prefetched in the background on page load.

const seen = new Set()

function isPrefetchableAnchor (anchor, event, location) {
  if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return false
  if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return false
  try {
    const url = new URL(anchor.href, location.href)
    return url.origin === location.origin &&
      url.pathname !== location.pathname &&
      !url.pathname.startsWith('/assets/') &&
      !url.pathname.startsWith('/statics/')
  } catch {
    return false
  }
}

/**
 * Load the async component(s) for a resolved route. Repeated calls are ignored.
 * Returns true when at least one loader was started.
 */
export function prefetchRoute (router, path) {
  if (!router || !path || seen.has(path)) return false
  const resolved = router.resolve(path)
  if (!resolved.matched.length) return false
  let started = false
  for (const record of resolved.matched) {
    const loader = record.components?.default || record.component
    if (typeof loader !== 'function') continue
    seen.add(path)
    loader().catch(() => {})
    started = true
  }
  return started
}

/** Test helper: forget which paths have been prefetched. */
export function resetPrefetchCache () {
  seen.clear()
}

export function installRoutePrefetch (router, win = window) {
  if (!router || !win || typeof win.document === 'undefined') return () => {}
  const document = win.document
  const pending = new WeakMap()

  const intent = (event, immediate) => {
    const anchor = event.target?.closest?.('a[href]')
    if (!isPrefetchableAnchor(anchor, event, win.location)) return
    const path = new URL(anchor.href, win.location.href).pathname
    if (seen.has(path)) return
    if (immediate) {
      prefetchRoute(router, path)
      return
    }
    if (pending.has(anchor)) return
    const timer = win.setTimeout(() => {
      pending.delete(anchor)
      if (anchor.matches?.(':hover')) prefetchRoute(router, path)
    }, 70)
    pending.set(anchor, timer)
  }

  const onPointer = event => intent(event, false)
  const onFocus = event => intent(event, true)
  document.addEventListener('pointerover', onPointer, { passive: true })
  document.addEventListener('focusin', onFocus)
  return () => {
    document.removeEventListener('pointerover', onPointer)
    document.removeEventListener('focusin', onFocus)
  }
}
