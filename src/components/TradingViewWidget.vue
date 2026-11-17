<template>
  <div
    :id="containerId"
    ref="host"
    class="tradingview-widget"
    :style="{ width: width, height: height, maxWidth: '100%' }"
  />
</template>

<script>
let widgetCounter = 0

export default {
  name: 'TradingViewWidget',
  props: {
    options: { type: Object, default: () => ({}) }
  },
  data () {
    return {
      containerId: `tradingview_${Date.now()}_${widgetCounter++}`
    }
  },
  computed: {
    width () {
      return this.options.width ? `${this.options.width}px` : '100%'
    },
    height () {
      return this.options.height ? `${this.options.height}px` : '500px'
    }
  },
  mounted () {
    this.renderWidget()
  },
  beforeUnmount () {
    if (this.$refs.host) this.$refs.host.innerHTML = ''
  },
  methods: {
    renderWidget () {
      const script = document.createElement('script')
      script.src = 'https://s3.tradingview.com/tv.js'
      script.async = true
      script.onload = () => {
        if (window.TradingView?.widget && this.$refs.host) {
           
          new window.TradingView.widget({
            ...this.options,
            container_id: this.containerId,
            autosize: true
          })
        }
      }
      this.$refs.host.appendChild(script)
    }
  }
}
</script>
