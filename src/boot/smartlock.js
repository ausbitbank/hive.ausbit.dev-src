import { Notify } from 'quasar'
import { defineBoot } from '#q-app'
import smartlock from 'components/smartlock/index.js'
import { useHiveStore } from 'src/stores/hive'
import { DEFAULT_SETTINGS } from 'src/stores/hive/state'

// SmartLock only keeps the posting key in memory. Lock it after a period of
// browser inactivity so leaving a tab open does not leave the key available
// indefinitely.
export default defineBoot(({ app }) => {
  if (typeof window === 'undefined') return
  const store = useHiveStore()

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

  window.addEventListener('pointerdown', touch, { passive: true })
  window.addEventListener('keydown', touch)
  window.addEventListener('touchstart', touch, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)

  const timer = setInterval(lockNow, 60 * 1000)

  // Keep a reference for tests and future teardown without exposing listeners.
  app.config.globalProperties.$smartlockTimer = timer
})
