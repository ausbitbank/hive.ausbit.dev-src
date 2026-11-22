<template>
  <div class="dw-state" :class="'dw-state--' + state" :role="state === 'error' ? 'alert' : undefined">
    <template v-if="state === 'guest'">
      <q-icon name="lock_person" size="24px" aria-hidden="true" />
      <div>
        <div class="dw-state__title">{{ guestTitle }}</div>
        <p class="dw-state__text">{{ guestText }}</p>
      </div>
    </template>

    <template v-else-if="state === 'loading'">
      <div class="dw-state__loading" aria-live="polite">
        <div v-for="i in 3" :key="i" class="dw-state__row">
          <q-skeleton type="text" :width="[42, 68, 54][i - 1] + '%'" />
        </div>
      </div>
    </template>

    <template v-else-if="state === 'error'">
      <q-icon name="error_outline" size="24px" color="orange" aria-hidden="true" />
      <span class="dw-state__text">{{ error }}</span>
      <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="$emit('retry')" />
    </template>
  </div>
</template>

<style scoped>
.dw-state {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.75rem 1rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.45;
}

.dw-state--error {
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.dw-state__title {
  color: var(--c-text);
  font-weight: 600;
}

.dw-state__text {
  margin: 0.15rem 0 0;
}

.dw-state__loading {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.2rem;
}
</style>

<script>
// Shared guest / loading / error presentation for the dashboard widgets.
// Widgets keep their own skeletons where the shape matters; this is the
// fallback state block so wording and spacing stay consistent.
export default {
  name: 'DashboardWidgetState',
  props: {
    state: { type: String, default: 'loading' },
    error: { type: String, default: '' },
    guestTitle: { type: String, default: 'Log in to see this widget' },
    guestText: { type: String, default: 'This widget reads your own Hive account, so it needs a signed-in user.' }
  },
  emits: ['retry']
}
</script>
