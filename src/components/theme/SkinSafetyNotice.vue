<template>
  <section
    class="skin-blocked"
    role="status"
    aria-live="polite"
    aria-label="Profile skin hidden"
  >
    <div class="skin-blocked__head">
      <q-icon name="shield" size="20px" aria-hidden="true" />
      <div>
        <p class="skin-blocked__title">Profile skin hidden</p>
        <p class="skin-blocked__reason">{{ decision.label }}</p>
        <p v-if="decision.detail" class="skin-blocked__detail">{{ decision.detail }}</p>
      </div>
    </div>
    <div class="skin-blocked__actions">
      <q-btn
        v-if="preview"
        unelevated
        no-caps
        color="primary"
        label="Preview anyway"
        @click="$emit('preview')"
      />
      <q-btn
        v-else-if="hasModeration"
        unelevated
        no-caps
        color="primary"
        label="Show this skin anyway"
        @click="$emit('show')"
      />
      <q-btn
        v-if="canFollowOverride"
        outline
        no-caps
        color="primary"
        label="Always show skins from accounts I follow"
        @click="$emit('enable-followed')"
      />
      <q-btn
        flat
        no-caps
        color="primary"
        icon="tune"
        label="Manage skin safety"
        to="/appearance#skin-safety"
      />
    </div>
  </section>
</template>

<style scoped>
.skin-blocked {
  margin: var(--space-3) 0;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-card);
  background: var(--c-surface-2);
  color: var(--c-text);
}

.skin-blocked__head {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.skin-blocked__title {
  margin: 0;
  font-weight: 600;
}

.skin-blocked__reason {
  margin: 0.15rem 0 0;
  color: var(--c-text-muted);
}

.skin-blocked__detail {
  margin: 0.15rem 0 0;
  color: var(--c-text-faint);
  font-size: 0.85rem;
}

.skin-blocked__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
</style>

<script>
export default {
  name: 'SkinSafetyNotice',
  props: {
    decision: { type: Object, required: true },
    preview: { type: Boolean, default: false },
    hasModeration: { type: Boolean, default: false },
    canFollowOverride: { type: Boolean, default: false }
  },
  emits: ['preview', 'show', 'enable-followed']
}
</script>
