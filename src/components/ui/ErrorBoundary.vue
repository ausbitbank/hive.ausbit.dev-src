<template>
  <div v-if="error" class="error-boundary" role="alert">
    <q-card flat bordered class="home-card error-boundary__card">
      <q-icon name="error_outline" size="34px" color="orange" aria-hidden="true" />
      <h1 class="error-boundary__title">This view could not be displayed</h1>
      <p class="error-boundary__text">
        {{ message || 'A page component failed while rendering. Your queue and saved data are untouched.' }}
      </p>
      <p v-if="detail" class="error-boundary__detail">{{ detail }}</p>
      <div class="error-boundary__actions">
        <q-btn unelevated no-caps color="primary" icon="refresh" label="Try again" @click="retry" />
        <q-btn outline no-caps color="primary" icon="open_in_browser" label="Reload page" @click="reload" />
        <q-btn flat no-caps color="primary" icon="home" label="Home" to="/" />
      </div>
    </q-card>
  </div>
  <div v-else :key="attempt" class="error-boundary__slot">
    <slot />
  </div>
</template>

<script>
import { recordUiError } from 'src/services/telemetry'

export default {
  name: 'ErrorBoundary',
  props: {
    message: { type: String, default: '' },
    showDetail: { type: Boolean, default: false }
  },
  data () {
    return {
      error: null,
      attempt: 0
    }
  },
  computed: {
    detail () {
      if (!this.showDetail || !this.error) return ''
      return String(this.error.message || this.error).slice(0, 240)
    }
  },
  errorCaptured (error, instance, info) {
    this.error = error || new Error('Unknown component error')
    recordUiError({ info, message: this.error?.message || '' })
    console.error('Page error boundary caught an error', info, error)
    return false
  },
  methods: {
    retry () {
      this.error = null
      this.attempt += 1
    },
    reload () {
      if (typeof window !== 'undefined') window.location.reload()
    }
  }
}
</script>

<style scoped>
.error-boundary {
  display: flex;
  justify-content: center;
  padding: var(--space-6) var(--space-4);
}

.error-boundary__card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.6rem;
  width: min(560px, 100%);
  padding: var(--space-5);
}

.error-boundary__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.25;
}

.error-boundary__text,
.error-boundary__detail {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.86rem;
  line-height: 1.5;
}

.error-boundary__detail {
  max-width: 100%;
  padding: 0.4rem 0.55rem;
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-shadow) 18%, transparent);
  color: var(--c-text-subtle);
  font-family: monospace;
  font-size: 0.74rem;
  word-break: break-word;
}

.error-boundary__actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.2rem;
}
</style>
