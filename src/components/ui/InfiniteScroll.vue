<template>
  <div class="infinite-scroll">
    <slot />

    <div ref="footer" class="infinite-scroll__footer">
      <div v-if="isLoading" class="infinite-scroll__loading" role="status" aria-live="polite">
        <slot name="loading">
          <q-spinner-dots color="primary" size="28px" aria-hidden="true" />
          <span class="infinite-scroll__label">Loading…</span>
        </slot>
      </div>

      <div v-else-if="canLoad" class="infinite-scroll__more-wrap">
        <button type="button" class="infinite-scroll__more" @click="load">
          <q-icon name="expand_more" size="18px" aria-hidden="true" />
          <span>Load more</span>
        </button>
      </div>

      <div v-if="!canLoad && $slots.done" class="infinite-scroll__end">
        <slot name="done" />
      </div>
    </div>
  </div>
</template>

<script>
// Scroll-driven loading based on the footer's position rather than
// IntersectionObserver: observers report on their own schedule, which left the
// list stuck when a page resolved while the end was still on screen.
const CHECK_THROTTLE_MS = 120
const SETTLE_FALLBACK_MS = 4000

export default {
  name: 'InfiniteScroll',
  props: {
    canLoad: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    // Distance from the bottom of the viewport at which the next page loads.
    offset: { type: Number, default: 400 },
    // Selector for a nested scroller; the window is used by default.
    scrollTarget: { type: String, default: undefined },
    // When false the component only loads on a click of "Load more".
    automatic: { type: Boolean, default: true }
  },
  emits: ['load'],
  data () {
    return {
      isLoading: this.loading,
      awaiting: false
    }
  },
  computed: {
    isActive () {
      return this.canLoad && !this.disabled && this.automatic
    }
  },
  watch: {
    loading (value) {
      // `loading` is the parent's view of the current request, so it also ends
      // the in-flight period when the parent reports completion.
      if (value) {
        this.awaiting = true
        this.isLoading = true
        clearTimeout(this.settleTimer)
        return
      }
      this.finish()
    },
    canLoad () {
      this.$nextTick(() => this.check())
    }
  },
  created () {
    // Plain instance state: none of it needs to trigger a re-render.
    this.footerEl = null
    this.scrollContainer = null
    this.settleTimer = null
    this.throttleTimer = null
    this.pageBottom = 0
    this.paused = false
  },
  mounted () {
    this.footerEl = this.$refs.footer
    // The scroll area may still be mounting when this runs; resolve lazily.
    this.attach()
    this.$nextTick(() => this.check())
  },
  beforeUnmount () {
    this.detach()
    clearTimeout(this.settleTimer)
    clearTimeout(this.throttleTimer)
  },
  methods: {
    resolveScrollContainer () {
      if (!this.scrollTarget) return window
      const el = document.querySelector(this.scrollTarget)
      if (!el) return window
      // QScrollArea renders the scrolling node as an inner container, so walk
      // into it instead of observing the static wrapper.
      return el.querySelector('.q-scrollarea__container') || el
    },
    attach () {
      this.scrollContainer = this.resolveScrollContainer()
      this.scrollContainer?.addEventListener('scroll', this.onScroll, { passive: true })
      window.addEventListener('resize', this.onScroll, { passive: true })
    },
    detach () {
      this.scrollContainer?.removeEventListener('scroll', this.onScroll)
      window.removeEventListener('resize', this.onScroll)
    },
    onScroll () {
      this.paused = false
      if (!this.isActive || this.awaiting || this.throttleTimer) return
      this.throttleTimer = setTimeout(() => {
        this.throttleTimer = null
        this.check()
      }, CHECK_THROTTLE_MS)
    },
    footerBottom () {
      if (!this.footerEl || !this.footerEl.isConnected) return 0
      return this.footerEl.getBoundingClientRect().bottom
    },
    inReach () {
      if (!this.footerEl || !this.footerEl.isConnected) return false
      const viewportBottom = this.scrollContainer === window
        ? window.innerHeight || document.documentElement.clientHeight
        : this.scrollContainer.getBoundingClientRect().bottom
      return this.footerBottom() <= viewportBottom + Math.max(0, this.offset)
    },
    check () {
      if (!this.isActive || this.awaiting || this.isLoading || this.paused) return
      if (this.inReach()) this.load()
    },
    load () {
      if (!this.canLoad || this.disabled || this.awaiting || this.isLoading) return
      this.awaiting = true
      this.isLoading = true
      this.pageBottom = this.footerBottom()
      this.$emit('load')

      // Parents that load synchronously (or do not report `loading`) never
      // notify us; settle on their behalf so the guard cannot stick.
      clearTimeout(this.settleTimer)
      this.settleTimer = setTimeout(() => {
        if (this.awaiting) this.finish()
      }, SETTLE_FALLBACK_MS)
    },
    finish () {
      clearTimeout(this.settleTimer)
      if (!this.awaiting && !this.isLoading) return
      this.awaiting = false
      this.isLoading = false
      this.$nextTick(() => {
        if (!this.isActive) return
        // Keep loading while the page actually grows; when the end does not
        // move, demand a scroll so a short or empty page cannot cascade.
        if (this.inReach() && this.footerBottom() <= this.pageBottom) this.paused = true
      })
    }
  }
}
</script>

<style scoped>
.infinite-scroll {
  width: 100%;
}

.infinite-scroll__footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 2.25rem;
  padding: var(--space-2, 0.5rem) 0 var(--space-3, 1rem);
}

.infinite-scroll__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.infinite-scroll__label {
  color: var(--c-text-subtle);
  font-size: 0.78rem;
}

.infinite-scroll__end {
  display: flex;
  justify-content: center;
}

.infinite-scroll__more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  width: 100%;
  padding: 0.3rem 0;
  border: 0;
  border-radius: var(--radius-card, 8px);
  background: transparent;
  color: var(--c-link);
  font: inherit;
  font-size: 0.78rem;
  cursor: pointer;
}

.infinite-scroll__more:hover {
  background: color-mix(in srgb, var(--c-link) 8%, transparent);
}

.infinite-scroll__more:focus-visible {
  outline: 2px solid var(--c-link);
  outline-offset: 2px;
}
</style>
