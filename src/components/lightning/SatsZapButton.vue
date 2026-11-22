<template>
  <span class="sats-zap">
    <q-btn
      flat
      no-caps
      class="sats-zap__btn"
      :class="{ 'sats-zap__btn--compact': compact }"
      icon="bolt"
      label="Zap"
      aria-label="Zap this author with Lightning sats"
      title="Zap with Lightning"
      @click="open = true"
    />
    <lightning-receive-dialog
      v-if="open"
      v-model="open"
      :account="account"
      intent="zap"
      default-currency="sats"
      :default-amount="1000"
      default-receive-currency="hbd"
      :presets="[1000, 5000, 10000, 21000]"
      :default-note="note"
      @paid="$emit('paid', $event)"
    />
  </span>
</template>

<script>
import { defineAsyncComponent } from 'vue'

export default {
  name: 'SatsZapButton',
  components: {
    LightningReceiveDialog: defineAsyncComponent(() => import('components/lightning/LightningReceiveDialog.vue'))
  },
  props: {
    account: { type: String, required: true },
    permlink: { type: String, default: '' },
    compact: { type: Boolean, default: false }
  },
  emits: ['paid'],
  data () {
    return { open: false }
  },
  computed: {
    note () {
      const reference = String(this.permlink || '').slice(0, 48)
      return ['Zap', reference, 'hive.ausbit.dev'].filter(Boolean).join(' · ')
    }
  }
}
</script>

<style scoped>
.sats-zap__btn.q-btn {
  gap: 0.35rem;
  width: 100%;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--c-warning) 40%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-warning) 6%, transparent);
  color: var(--c-warning-soft);
  font-size: 0.8rem;
  font-weight: 600;
}

.sats-zap__btn.q-btn:hover {
  border-color: color-mix(in srgb, var(--c-warning) 70%, transparent);
  background: color-mix(in srgb, var(--c-warning) 12%, transparent);
  color: var(--c-warning-soft);
}

.sats-zap__btn--compact.q-btn {
  width: auto;
  min-height: 30px;
  padding: 0 10px;
  font-size: 0.74rem;
}
</style>
