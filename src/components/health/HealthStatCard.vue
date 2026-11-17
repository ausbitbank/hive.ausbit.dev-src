<template>
  <q-card flat bordered class="net-stat-card">
    <div class="net-stat">
      <div class="net-stat__head">
        <q-icon v-if="icon" :name="icon" size="15px" aria-hidden="true" />
        <span>{{ label }}</span>
        <q-space />
        <q-badge v-if="statusLabel" :color="statusColor" :text-color="statusTextColor">{{ statusLabel }}</q-badge>
      </div>

      <div class="net-stat__value">
        {{ value }} <span v-if="unit" class="net-stat__unit">{{ unit }}</span>
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

      <div v-if="hint" class="net-stat__hint">{{ hint }}</div>

      <div v-if="links && links.length" class="net-stat__links">
        <router-link v-for="link in links" :key="link.to + link.label" :to="link.to">{{ link.label }}</router-link>
      </div>
    </div>
  </q-card>
</template>

<script>
export default {
  name: 'HealthStatCard',
  props: {
    label: { type: String, required: true },
    value: { type: [String, Number], default: '—' },
    unit: { type: String, default: '' },
    hint: { type: String, default: '' },
    icon: { type: String, default: '' },
    statusLabel: { type: String, default: '' },
    statusColor: { type: String, default: 'green' },
    statusTextColor: { type: String, default: 'black' },
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
