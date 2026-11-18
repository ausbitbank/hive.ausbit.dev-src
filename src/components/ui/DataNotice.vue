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
      color="primary"
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
  color: #b0bec5;
  font-size: 0.76rem;
  line-height: 1.4;
}

.data-notice--stale {
  background: rgba(255, 183, 77, 0.08);
  border-color: rgba(255, 183, 77, 0.28);
  color: #ffcc80;
}

.data-notice--offline {
  background: rgba(144, 164, 174, 0.08);
  border-color: rgba(144, 164, 174, 0.28);
  color: #cfd8dc;
}

.data-notice--error {
  background: rgba(239, 83, 80, 0.08);
  border-color: rgba(239, 83, 80, 0.3);
  color: #ffcdd2;
}

.data-notice--info {
  background: rgba(79, 195, 247, 0.07);
  border-color: rgba(79, 195, 247, 0.24);
  color: #b3e5fc;
}

.data-notice__text {
  min-width: 0;
}

.data-notice__age {
  color: #90a4ae;
  white-space: nowrap;
}

.data-notice__action {
  margin-left: auto;
}
</style>
