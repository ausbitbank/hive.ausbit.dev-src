<template>
  <div
    class="data-notice"
    :class="'data-notice--' + variant"
    :role="variant === 'error' ? 'alert' : 'status'"
    :aria-live="variant === 'error' ? 'assertive' : 'polite'"
  >
    <q-icon :name="icon" size="17px" aria-hidden="true" />
    <span class="data-notice__text"><slot>{{ message }}</slot></span>
    <span v-if="updatedLabel" class="data-notice__age">· {{ updatedLabel }}</span>
    <q-btn
      v-if="actionLabel"
      flat
      dense
      no-caps
      color="light-blue-3"
      :label="actionLabel"
      :icon="actionIcon || undefined"
      class="data-notice__action"
      @click="$emit('action')"
    />
  </div>
</template>

<script>
import moment from 'src/utils/time'

const ICONS = {
  stale: 'history',
  offline: 'cloud_off',
  error: 'error_outline',
  info: 'info'
}

export default {
  name: 'DataNotice',
  props: {
    variant: { type: String, default: 'stale' },
    message: { type: String, default: '' },
    updatedAt: { type: [Number, Date, String], default: null },
    actionLabel: { type: String, default: '' },
    actionIcon: { type: String, default: '' }
  },
  emits: ['action'],
  computed: {
    icon () {
      return ICONS[this.variant] || ICONS.info
    },
    updatedLabel () {
      if (!this.updatedAt) return ''
      return 'saved ' + moment.utc(this.updatedAt).fromNow()
    }
  }
}
</script>

<style scoped>
.data-notice {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  color: var(--c-text-muted);
  font-size: 0.76rem;
  line-height: 1.4;
}

.data-notice--stale {
  background: color-mix(in srgb, var(--c-warning) 8%, transparent);
  border-color: color-mix(in srgb, var(--c-warning) 28%, transparent);
  color: var(--c-warning-soft);
}

.data-notice--offline {
  background: color-mix(in srgb, var(--c-text-subtle) 8%, transparent);
  border-color: color-mix(in srgb, var(--c-text-subtle) 28%, transparent);
  color: var(--c-text-soft);
}

.data-notice--error {
  background: color-mix(in srgb, var(--c-negative) 8%, transparent);
  border-color: color-mix(in srgb, var(--c-negative) 30%, transparent);
  color: var(--c-negative-soft);
}

.data-notice--info {
  background: color-mix(in srgb, var(--c-link) 7%, transparent);
  border-color: color-mix(in srgb, var(--c-link) 24%, transparent);
  color: var(--c-link-soft);
}

.data-notice__text {
  min-width: 0;
}

.data-notice__age {
  color: var(--c-text-subtle);
  white-space: nowrap;
}

.data-notice__action {
  margin-left: auto;
}
</style>
