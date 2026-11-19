<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    @show="resetDraft"
  >
    <q-card class="dw-settings" aria-labelledby="dw-settings-title">
      <q-card-section class="dw-settings__head">
        <div>
          <div class="home-eyebrow">Widget settings</div>
          <h2 id="dw-settings-title" class="dw-settings__title">{{ meta.label }}</h2>
        </div>
        <q-btn flat dense round icon="close" aria-label="Close widget settings" v-close-popup />
      </q-card-section>

      <q-card-section class="dw-settings__body">
        <template v-if="fields.length">
          <div v-for="field in fields" :key="field.key" class="dw-settings__field">
            <template v-if="field.kind === 'toggle'">
              <q-toggle
                v-model="draft[field.key]"
                :label="field.label"
                color="primary"
                dense
              />
              <p v-if="field.hint" class="dw-settings__hint">{{ field.hint }}</p>
            </template>

            <template v-else-if="field.kind === 'number'">
              <q-input
                v-model.number="draft[field.key]"
                type="number"
                dense
                outlined
                :min="field.min"
                :max="field.max"
                :label="field.label"
              />
            </template>

            <template v-else-if="field.kind === 'select'">
              <q-select
                v-model="draft[field.key]"
                :options="field.options"
                emit-value
                map-options
                dense
                outlined
                options-dense
                :label="field.label"
              />
            </template>

            <template v-else-if="field.kind === 'currency'">
              <q-select
                v-model="draft[field.key]"
                :options="currencyOptions"
                emit-value
                map-options
                dense
                outlined
                options-dense
                :label="field.label"
              />
            </template>

            <template v-else-if="field.kind === 'coins'">
              <q-select
                v-model="draft[field.key]"
                :options="coinOptions"
                multiple
                use-input
                use-chips
                new-value-mode="add-unique"
                dense
                outlined
                options-dense
                input-debounce="0"
                :label="field.label"
                hint="Pick a suggested coin or paste a CoinGecko id."
              />
            </template>

            <template v-else>
              <q-input
                v-model="draft[field.key]"
                dense
                outlined
                :label="field.label"
                :placeholder="field.placeholder"
              />
              <p v-if="field.hint" class="dw-settings__hint">{{ field.hint }}</p>
            </template>
          </div>
        </template>

        <p v-else class="dw-settings__empty">
          This widget has no settings.
        </p>
      </q-card-section>

      <q-card-actions align="right" class="dw-settings__actions">
        <q-btn flat no-caps label="Reset" @click="resetDraft" />
        <q-btn flat no-caps label="Cancel" v-close-popup />
        <q-btn no-caps unelevated color="primary" label="Apply" @click="apply" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.dw-settings {
  width: min(440px, 96vw);
  max-width: 96vw;
  background: #0b1116;
}

.dw-settings__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  border-bottom: 1px solid var(--border-subtle);
}

.dw-settings__title {
  margin: 0.1rem 0 0;
  color: #e4eaed;
  font-size: 1.1rem;
  font-weight: 600;
}

.dw-settings__body {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  max-height: min(60vh, 520px);
  overflow-y: auto;
}

.dw-settings__field {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.dw-settings__hint {
  margin: 0;
  color: #78909c;
  font-size: 0.7rem;
  line-height: 1.35;
}

.dw-settings__empty {
  margin: 0;
  color: #78909c;
  font-size: 0.8rem;
}

.dw-settings__actions {
  border-top: 1px solid var(--border-subtle);
}
</style>

<script>
import { settingsFieldsFor, sanitiseWidgetSettings } from 'src/services/dashboardEditing'
import { HOME_MARKET_COIN_SUGGESTIONS, HOME_MARKET_CURRENCIES } from 'src/services/homeMarket'
import { defaultSettingsFor, widgetMeta } from 'src/services/dashboardLayout'

export default {
  name: 'WidgetSettingsDialog',
  props: {
    modelValue: { type: Boolean, default: false },
    widget: { type: Object, default: null }
  },
  emits: ['update:modelValue', 'save'],
  data () {
    return {
      draft: {}
    }
  },
  computed: {
    meta () {
      return this.widget ? (widgetMeta(this.widget.type) || { label: this.widget.type }) : { label: 'Widget' }
    },
    fields () {
      return this.widget ? settingsFieldsFor(this.widget.type) : []
    },
    currencyOptions () {
      return HOME_MARKET_CURRENCIES.map(entry => ({
        value: entry.id,
        label: entry.label + ' (' + entry.symbol + ')'
      }))
    },
    coinOptions () {
      return HOME_MARKET_COIN_SUGGESTIONS.map(coin => coin.id)
    }
  },
  watch: {
    widget: {
      immediate: true,
      handler () {
        if (this.modelValue) this.resetDraft()
      }
    },
    modelValue (open) {
      if (open) this.resetDraft()
    }
  },
  methods: {
    resetDraft () {
      if (!this.widget) {
        this.draft = {}
        return
      }
      this.draft = { ...defaultSettingsFor(this.widget.type), ...this.widget.settings }
    },
    apply () {
      if (!this.widget) return
      this.$emit('save', {
        widget: this.widget,
        settings: sanitiseWidgetSettings(this.widget.type, this.draft)
      })
      this.$emit('update:modelValue', false)
    }
  }
}
</script>
