import { Notify } from 'quasar'
import { watch } from 'vue'
import { defineBoot } from '#q-app'
import smartlock from 'components/smartlock/index.js'
import { useHiveStore } from 'src/stores/hive'
import { DEFAULT_SETTINGS } from 'src/stores/hive/state'

// SmartLock only keeps the posting key in memory. Lock it after a period of
// browser inactivity so leaving a tab open does not leave the key available
// indefinitely.
//
// This is a signing-only service: keep its timer and activity listeners off the
// startup path for logged-out, Keychain and public sessions.
export default defineBoot(({ app }) => {
  if (typeof window === 'undefined') return
  const store = useHiveStore()

  let timer = null
  let started = false
  let idleHandle = null

  const touch = () => smartlock.touchActivity()
  const lockNow = () => {
    const minutes = Number(store.user?.settings?.smartlockSessionMinutes) ||
      Number(DEFAULT_SETTINGS.smartlockSessionMinutes)
    const locked = smartlock.lockExpired(minutes * 60 * 1000)
    if (locked.length > 0 && store.user?.username) {
      Notify.create({
        message: 'SmartLock locked after ' + minutes + ' minutes of inactivity. Unlock again to sign posting actions.',
        color: 'orange',
        icon: 'lock',
        position: 'top',
        timeout: 6000
      })
    }
  }
  const onVisibility = () => {
    if (document.visibilityState === 'visible') lockNow()
  }

  const start = () => {
    if (started) return
    started = true
    window.addEventListener('pointerdown', touch, { passive: true })
    window.addEventListener('keydown', touch)
    window.addEventListener('touchstart', touch, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    timer = setInterval(lockNow, 60 * 1000)
    app.config.globalProperties.$smartlockTimer = timer
  }

  const stop = () => {
    if (!started) return
    started = false
    window.removeEventListener('pointerdown', touch)
    window.removeEventListener('keydown', touch)
    window.removeEventListener('touchstart', touch)
    document.removeEventListener('visibilitychange', onVisibility)
    if (timer) clearInterval(timer)
    timer = null
    app.config.globalProperties.$smartlockTimer = null
  }

  const scheduleStart = () => {
    if (started) return
    if (store.user.loginType !== 'smartlock' || !store.user.username) {
      stop()
      return
    }
    if (idleHandle !== null) return
    const begin = () => {
      idleHandle = null
      if (store.user.loginType === 'smartlock' && store.user.username) start()
    }
    if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(begin, { timeout: 2500 })
    } else {
      idleHandle = window.setTimeout(begin, 1500)
    }
  }

  watch(
    () => [store.user.loginType, store.user.username],
    () => scheduleStart(),
    { flush: 'post' }
  )

  scheduleStart()
})
