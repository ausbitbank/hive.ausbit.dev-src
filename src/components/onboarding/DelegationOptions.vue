<template>
  <section class="delegation" aria-labelledby="delegation-title">
    <div class="delegation__head">
      <div>
        <div class="delegation__eyebrow">Optional</div>
        <h3 id="delegation-title" class="delegation__title">Help the new account start</h3>
      </div>
      <q-icon name="volunteer_activism" size="22px" aria-hidden="true" />
    </div>
    <p class="delegation__copy">
      A brand-new account has no Resource Credits and no Hive Power, so it cannot
      transact until someone helps. Both choices are queued after the account is
      created: Resource Credits use your posting key, Hive Power uses your active
      key. Review each action in the wallet.
    </p>

    <div class="delegation__row">
      <q-toggle
        :model-value="value.rcEnabled"
        label="Delegate Resource Credits"
        @update:model-value="set('rcEnabled', $event)"
      />
      <q-input
        v-if="value.rcEnabled"
        :model-value="value.rcAmount"
        class="delegation__amount"
        type="number"
        inputmode="decimal"
        min="0"
        max="1000"
        step="0.5"
        dense
        outlined
        suffix="billion RC"
        aria-label="Resource Credits to delegate, in billions"
        @update:model-value="setNumber('rcAmount', $event)"
      />
    </div>

    <div class="delegation__row">
      <q-toggle
        :model-value="value.hpEnabled"
        label="Delegate Hive Power"
        @update:model-value="set('hpEnabled', $event)"
      />
      <q-input
        v-if="value.hpEnabled"
        :model-value="value.hpAmount"
        class="delegation__amount"
        type="number"
        inputmode="decimal"
        min="0"
        step="1"
        dense
        outlined
        suffix="HP"
        aria-label="Hive Power to delegate"
        @update:model-value="setNumber('hpAmount', $event)"
      />
    </div>

    <p v-if="value.hpEnabled" class="delegation__note">
      Hive Power is delegated in VESTS at the current chain ratio. The delegation
      stays until you withdraw it; it is not a transfer.
    </p>
  </section>
</template>

<script>
export default {
  name: 'DelegationOptions',
  props: {
    modelValue: { type: Object, default: () => ({}) }
  },
  emits: ['update:modelValue'],
  computed: {
    value () {
      return {
        rcEnabled: false,
        rcAmount: 5,
        hpEnabled: false,
        hpAmount: 5,
        ...(this.modelValue || {})
      }
    }
  },
  methods: {
    set (key, value) {
      this.$emit('update:modelValue', { ...this.value, [key]: value })
    },
    setNumber (key, value) {
      const number = Number(value)
      this.set(key, Number.isFinite(number) ? number : 0)
    }
  }
}
</script>

<style scoped>
.delegation {
  margin-top: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface-2);
}

.delegation__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.delegation__eyebrow {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.delegation__title {
  margin: 0.1rem 0 0;
  color: var(--c-text);
  font-size: 0.95rem;
  font-weight: 600;
}

.delegation__copy,
.delegation__note {
  margin: var(--space-2) 0 0;
  color: var(--c-text-subtle);
  font-size: 0.78rem;
  line-height: 1.5;
}

.delegation__note {
  color: var(--c-text-faint);
}

.delegation__row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-top: var(--space-2);
}

.delegation__amount {
  max-width: 190px;
}
</style>
