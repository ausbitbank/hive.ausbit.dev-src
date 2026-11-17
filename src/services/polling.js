// Visibility-aware polling for components that cannot use the timers mixin.
//
// The callback is never invoked while the document is hidden. Returning to the
// tab runs the callback once and restarts the interval.

export function pollWhileVisible (callback, intervalMs, { immediate = true } = {}) {
  let timer = null
  let running = false

  const run = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    callback()
  }

  const start = () => {
    if (running) return
    running = true
    if (immediate) run()
    timer = setInterval(run, intervalMs)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility)
    }
  }

  const stop = () => {
    if (!running) return
    running = false
    if (timer) clearInterval(timer)
    timer = null
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }

  const onVisibility = () => {
    if (typeof document === 'undefined') return
    if (document.visibilityState === 'visible') {
      run()
    }
  }

  return {
    start,
    stop,
    get isRunning () {
      return running
    }
  }
}
