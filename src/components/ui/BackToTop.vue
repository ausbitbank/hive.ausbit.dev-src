<template>
  <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
    <q-btn
      v-if="visible"
      class="back-to-top"
      round
      unelevated
      color="primary"
      text-color="black"
      icon="arrow_upward"
      aria-label="Back to top"
      title="Back to top"
      @click="scrollToTop"
    />
  </transition>
</template>

<script>
export default {
  name: 'BackToTop',
  data () {
    return { visible: false }
  },
  mounted () {
    window.addEventListener('scroll', this.onScroll, { passive: true })
    this.onScroll()
  },
  beforeUnmount () {
    window.removeEventListener('scroll', this.onScroll)
  },
  methods: {
    onScroll () {
      this.visible = window.scrollY > 700
    },
    scrollToTop () {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    }
  }
}
</script>

<style scoped>
.back-to-top {
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: max(18px, env(safe-area-inset-bottom));
  z-index: 2500;
  box-shadow: var(--shadow-card);
}
</style>
