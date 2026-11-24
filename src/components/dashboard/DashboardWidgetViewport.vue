<template>
  <div ref="root" class="dw-viewport" :style="{ minHeight: visible ? null : minHeight }">
    <slot v-if="visible" />
    <div v-else class="dw-viewport__placeholder" aria-busy="true">
      <q-skeleton type="rect" height="16px" width="36%" />
      <q-skeleton type="rect" height="46px" />
      <q-skeleton type="text" width="62%" />
    </div>
  </div>
</template>

<style scoped>
.dw-viewport {
  display: block;
  min-width: 0;
}

.dw-viewport__placeholder {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.9rem 1rem 1rem;
}
</style>

<script>
// Defers the expensive body of a widget until its card is near the viewport.
//
// The shell and its header stay mounted (so edit controls and layout sizing
// still work); only the widget body is behind this viewport. Public, cheap
// widgets can set `enabled` to false and render immediately.
export default {
  name: 'DashboardWidgetViewport',
  props: {
    enabled: { type: Boolean, default: false },
    rootMargin: { type: String, default: '240px' },
    minHeight: { type: String, default: '120px' }
  },
  data () {
    return {
      visible: false,
      observer: null
    }
  },
  watch: {
    enabled (value) {
      if (!value) {
        this.visible = true
        this.disconnect()
        return
      }
      if (!this.visible) this.observe()
    }
  },
  mounted () {
    if (!this.enabled || typeof IntersectionObserver === 'undefined') {
      this.visible = true
      return
    }
    this.observe()
  },
  beforeUnmount () {
    this.disconnect()
  },
  methods: {
    observe () {
      if (this.visible || !this.$refs.root || typeof IntersectionObserver === 'undefined') {
        this.visible = true
        return
      }
      if (this.observer) this.disconnect()
      this.observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          this.visible = true
          this.disconnect()
        }
      }, { rootMargin: this.rootMargin })
      this.observer.observe(this.$refs.root)
    },
    disconnect () {
      if (!this.observer) return
      this.observer.disconnect()
      this.observer = null
    }
  }
}
</script>
