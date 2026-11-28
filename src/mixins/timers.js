// Minimal replacement for the abandoned `vue-timers` mixin.
//
// Supported forms (same as vue-timers):
//   timers: { refresh: { time: 60000, autostart: true, repeat: true, immediate: true } }
//   timers: [{ name: 'refresh', time: 3000, repeat: true, callback () { ... } }]
//
// Each timer is exposed as `this.timers[name]` with `start()`, `stop()`,
// `isRunning` and `time` so existing components keep working.
export default {
  data () {
    return {
      timers: {}
    }
  },

  created () {
    this._timerHandles = {}
    this._timerOptions = {}
  },

  mounted () {
    this._timerOptions = this.normalizeTimers(this.$options.timers)
    this._pausedTimerNames = []
    for (const [name, options] of Object.entries(this._timerOptions)) {
      this.timers[name] = {
        time: options.time,
        isRunning: false,
        start: () => this.startTimer(name),
        stop: () => this.stopTimer(name)
      }
      if (options.autostart !== false) this.startTimer(name)
    }

    if (typeof document !== 'undefined') {
      this._timerVisibilityHandler = () => {
        if (document.visibilityState === 'hidden') this.pauseTimers()
        else this.resumeTimers()
      }
      document.addEventListener('visibilitychange', this._timerVisibilityHandler)
    }
  },

  beforeUnmount () {
    for (const name of Object.keys(this._timerHandles || {})) this.stopTimer(name)
    if (typeof document !== 'undefined' && this._timerVisibilityHandler) {
      document.removeEventListener('visibilitychange', this._timerVisibilityHandler)
    }
  },

  methods: {
    normalizeTimers (config) {
      if (!config) return {}
      if (Array.isArray(config)) {
        return Object.fromEntries(config.map(timer => [timer.name, { ...timer }]))
      }
      return Object.fromEntries(
        Object.entries(config).map(([name, options]) => [name, { name, ...options }])
      )
    },

    resolveTimerCallback (name, options) {
      if (typeof options.callback === 'function') return options.callback
      if (typeof this[name] === 'function') return this[name]
      return null
    },

    startTimer (name) {
      const options = this._timerOptions[name]
      if (!options) return
      this.stopTimer(name)
      const callback = this.resolveTimerCallback(name, options)
      if (!callback) return

      const run = () => callback.call(this)
      if (options.immediate) run()
      if (options.repeat) {
        this._timerHandles[name] = setInterval(run, options.time)
      } else {
        this._timerHandles[name] = setTimeout(() => {
          delete this._timerHandles[name]
          if (this.timers[name]) this.timers[name].isRunning = false
          run()
        }, options.time)
      }
      this.timers[name].isRunning = true
    },

    stopTimer (name) {
      const handle = this._timerHandles[name]
      if (handle) {
        clearInterval(handle)
        clearTimeout(handle)
        delete this._timerHandles[name]
      }
      if (this.timers[name]) this.timers[name].isRunning = false
    },

    pauseTimers () {
      if (!this._pausedTimerNames) this._pausedTimerNames = []
      const paused = new Set(this._pausedTimerNames)
      for (const name of Object.keys(this._timerHandles || {})) {
        // One-shot timers are not restarted on visibility changes; a delayed
        // action should fire at most once.
        if (!this._timerOptions[name]?.repeat) continue
        paused.add(name)
        this.stopTimer(name)
      }
      this._pausedTimerNames = [...paused]
    },

    resumeTimers () {
      const names = [...new Set(this._pausedTimerNames || [])]
      this._pausedTimerNames = []
      for (const name of names) {
        if (this._timerOptions[name]?.repeat) this.startTimer(name)
      }
    }
  }
}
