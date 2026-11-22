<template>
  <div class="tradingview-widget" :style="containerStyle" role="region" aria-label="TradingView price chart">
    <div :id="containerId" ref="host" class="tradingview-widget__host" />

    <div v-if="!ready && !failed" class="tradingview-widget__loading" aria-live="polite">
      <q-spinner-dots color="primary" size="28px" />
      <span>Loading chart…</span>
    </div>

    <div v-if="failed" class="tradingview-widget__fallback">
      <q-icon name="show_chart" size="28px" aria-hidden="true" />
      <span>Chart unavailable in this browser.</span>
      <a :href="fallbackUrl" target="_blank" rel="noopener noreferrer">Open on TradingView</a>
    </div>
  </div>
</template>

<script>
let widgetCounter = 0
let tvLoader = null

function loadTradingView () {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('TradingView is browser-only'))
  }
  if (window.TradingView?.widget) return Promise.resolve()
  if (tvLoader) return tvLoader

  tvLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-tradingview-loader]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('TradingView failed to load')))
      return
    }

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/tv.js'
    script.async = true
    script.dataset.tradingviewLoader = 'true'
    script.onload = () => resolve()
    script.onerror = () => {
      tvLoader = null
      reject(new Error('TradingView failed to load'))
    }
    document.head.appendChild(script)
  })

  return tvLoader
}

export default {
  name: 'TradingViewWidget',
  props: {
    options: { type: Object, default: () => ({}) }
  },
  data () {
    return {
      containerId: `tradingview_${Date.now()}_${widgetCounter++}`,
      ready: false,
      failed: false,
      renderToken: 0
    }
  },
  computed: {
    containerStyle () {
      const height = this.options.height
      const resolved = height === undefined || height === null || height === ''
        ? 'clamp(360px, 56vh, 660px)'
        : typeof height === 'number' ? `${height}px` : String(height)
      return { width: '100%', height: resolved, minHeight: '320px' }
    },
    fallbackUrl () {
      const symbol = this.options.symbol || 'BINANCE:HIVEUSDT'
      return 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(symbol)
    }
  },
  watch: {
    options: {
      deep: true,
      handler () {
        this.renderWidget()
      }
    }
  },
  mounted () {
    this.renderWidget()
  },
  beforeUnmount () {
    this.renderToken++
    if (this.$refs.host) this.$refs.host.innerHTML = ''
  },
  methods: {
    async renderWidget () {
      const token = ++this.renderToken
      this.ready = false
      this.failed = false

      try {
        await loadTradingView()
        if (token !== this.renderToken || !this.$refs.host) return

        // TradingView does not expose a destroy method. Clearing the host and
        // creating a new widget with the same container id is the documented
        // way to switch symbols without leaking iframes.
        this.$refs.host.innerHTML = ''

        const { width: _width, height: _height, autosize: _autosize, ...options } = this.options
        // TradingView does not expose a destroy method; a new widget is created
        // after clearing the host above.
        new window.TradingView.widget({
          ...options,
          container_id: this.containerId,
          autosize: true
        })
        this.ready = true
      } catch (error) {
        console.error('Failed to render TradingView chart', error)
        this.failed = true
      }
    }
  }
}
</script>

<style scoped>
.tradingview-widget {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: var(--radius-card);
  background: var(--c-bg-deep);
}

.tradingview-widget__host,
.tradingview-widget__host iframe {
  width: 100% !important;
  height: 100% !important;
  border: 0;
}

.tradingview-widget__loading,
.tradingview-widget__fallback {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: color-mix(in srgb, var(--c-bg-deep) 88%, transparent);
  color: var(--c-text-subtle);
  font-size: 0.82rem;
  text-align: center;
}

.tradingview-widget__fallback {
  padding: var(--space-4);
}

.tradingview-widget__fallback a {
  color: var(--c-link);
  font-weight: 600;
}
</style>
