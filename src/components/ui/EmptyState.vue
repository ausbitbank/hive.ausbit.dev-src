<template>
  <q-card flat bordered class="home-card ui-empty-card">
    <div class="ui-empty">
      <q-icon :name="icon" size="28px" color="grey" aria-hidden="true" />
      <h2 v-if="title" class="ui-empty__title">{{ title }}</h2>
      <p v-if="message" class="ui-empty__message">{{ message }}</p>
      <slot />
      <q-btn
        v-if="actionLabel && actionTo"
        no-caps
        outline
        color="primary"
        :icon="actionIcon"
        :label="actionLabel"
        :to="actionTo"
      />
      <q-btn
        v-else-if="actionLabel"
        no-caps
        flat
        color="primary"
        :icon="actionIcon"
        :label="actionLabel"
        @click="$emit('action')"
      />
    </div>
  </q-card>
</template>

<script>
export default {
  name: 'EmptyState',
  props: {
    icon: { type: String, default: 'inbox' },
    title: { type: String, default: '' },
    message: { type: String, default: '' },
    actionLabel: { type: String, default: '' },
    actionIcon: { type: String, default: '' },
    actionTo: { type: [String, Object], default: null }
  },
  emits: ['action']
}
</script>

<style scoped>
.ui-empty-card {
  overflow: hidden;
}

.ui-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: var(--space-6) var(--space-4);
  text-align: center;
}

.ui-empty__title {
  margin: 0;
  color: #e4eaed;
  font-size: 1rem;
  font-weight: 600;
}

.ui-empty__message {
  max-width: 520px;
  margin: 0;
  color: #90a4ae;
  font-size: 0.8rem;
  line-height: 1.5;
}
</style>
