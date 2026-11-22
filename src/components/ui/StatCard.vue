<template>
  <q-card flat bordered class="home-card ui-stat-card">
    <div class="ui-stat">
      <div class="ui-stat__head">
        <q-icon v-if="icon" :name="icon" size="15px" aria-hidden="true" />
        <span>{{ label }}</span>
        <q-space />
        <q-badge v-if="statusLabel" :color="statusColor" text-color="black">{{ statusLabel }}</q-badge>
      </div>

      <div class="ui-stat__value">
        {{ value }} <span v-if="unit" class="ui-stat__unit">{{ unit }}</span>
      </div>

      <q-linear-progress
        v-if="progress !== null && progress !== undefined"
        :value="clampedProgress"
        :color="statusColor"
        rounded
        size="6px"
        class="q-mt-xs"
        :aria-label="ariaLabel || label + ' progress'"
      />

      <div v-if="hint" class="ui-stat__hint">{{ hint }}</div>

      <div v-if="links && links.length" class="ui-stat__links">
        <router-link v-for="link in links" :key="link.to + link.label" :to="link.to">{{ link.label }}</router-link>
      </div>
    </div>
  </q-card>
</template>

<script>
export default {
  name: 'StatCard',
  props: {
    label: { type: String, required: true },
    value: { type: [String, Number], default: '—' },
    unit: { type: String, default: '' },
    hint: { type: String, default: '' },
    icon: { type: String, default: '' },
    statusLabel: { type: String, default: '' },
    statusColor: { type: String, default: 'green' },
    progress: { type: Number, default: null },
    ariaLabel: { type: String, default: '' },
    links: { type: Array, default: () => [] }
  },
  computed: {
    clampedProgress () {
      const value = Number(this.progress)
      if (!Number.isFinite(value)) return 0
      return Math.min(1, Math.max(0, value))
    }
  }
}
</script>

<style scoped>
.ui-stat-card {
  height: 100%;
  overflow: hidden;
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.ui-stat {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  height: 100%;
  padding: 0.85rem 0.95rem;
}

.ui-stat__head {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--c-text-subtle);
  font-size: 0.68rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.ui-stat__value {
  color: var(--c-text);
  font-size: 1.35rem;
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.ui-stat__unit {
  color: var(--c-text-subtle);
  font-size: 0.76rem;
  font-weight: 500;
}

.ui-stat__hint {
  margin-top: auto;
  padding-top: 0.3rem;
  color: var(--c-text-faint);
  font-size: 0.7rem;
  line-height: 1.35;
}

.ui-stat__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.7rem;
  margin-top: 0.25rem;
  font-size: 0.72rem;
  font-weight: 600;
}

.ui-stat__links a {
  color: var(--c-link);
  text-decoration: none;
}

.ui-stat__links a:hover {
  color: var(--c-link-hover);
  text-decoration: underline;
}
</style>
