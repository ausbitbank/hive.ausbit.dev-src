<template>
  <span class="dw-action">
    <q-btn
      v-if="action"
      flat
      dense
      no-caps
      size="sm"
      color="primary"
      :icon="action.icon"
      :label="label || action.label"
      :aria-label="ariaLabel"
      @click="open = true"
    />

    <q-dialog v-model="open">
      <q-card class="dw-action__dialog" :aria-labelledby="titleId" :aria-describedby="bodyId">
        <q-card-section class="dw-action__head">
          <div>
            <div class="home-eyebrow">Signing queue</div>
            <h3 :id="titleId" class="dw-action__title">{{ action ? action.label : 'Widget action' }}</h3>
          </div>
          <q-btn flat dense round icon="close" aria-label="Close confirmation" v-close-popup />
        </q-card-section>

        <q-card-section v-if="action" :id="bodyId" class="dw-action__body">
          <p class="dw-action__summary">{{ action.summary }}</p>

          <ul v-if="action.details.length" class="dw-action__details">
            <li v-for="detail in action.details" :key="detail">{{ detail }}</li>
          </ul>

          <div class="dw-action__authority">
            <q-badge outline :color="authorityColor">{{ action.authority.label }}</q-badge>
            <span>{{ action.authority.detail }}</span>
          </div>

          <div class="dw-action__ops">
            <span class="dw-action__ops-label">Operation{{ action.operations.length === 1 ? '' : 's' }}</span>
            <code v-for="(operation, index) in action.operations" :key="action.id + '-op-' + index">
              {{ operationLabel(operation) }}
            </code>
          </div>

          <p class="dw-action__warning">
            <q-icon name="info" size="15px" aria-hidden="true" />
            <span>This only adds the operation to your signing queue. Nothing is broadcast until you review and send it. HiveAuth stays manual-only.</span>
          </p>
        </q-card-section>

        <q-card-actions align="right" class="dw-action__actions">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            :label="'Queue ' + (action ? action.label.toLowerCase() : 'action')"
            @click="confirm"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </span>
</template>

<style scoped>
.dw-action {
  display: inline-flex;
}

.dw-action__dialog {
  width: min(440px, 96vw);
  max-width: 96vw;
  background: var(--c-bg-deep);
}

.dw-action__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  border-bottom: 1px solid var(--border-subtle);
}

.dw-action__title {
  margin: 0.1rem 0 0;
  color: var(--c-text);
  font-size: 1.05rem;
  font-weight: 600;
}

.dw-action__body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  font-size: 0.8rem;
  line-height: 1.45;
}

.dw-action__summary {
  margin: 0;
  color: var(--c-text-soft);
}

.dw-action__details {
  margin: 0;
  padding-left: 1.1rem;
  color: var(--c-text-subtle);
}

.dw-action__authority {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  color: var(--c-text-subtle);
  font-size: 0.72rem;
}

.dw-action__ops {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.dw-action__ops-label {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-action__ops code {
  padding: 0.1rem 0.35rem;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 6%, transparent);
  color: var(--c-text-soft);
  font-size: 0.7rem;
}

.dw-action__warning {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin: 0;
  color: var(--c-warning-soft);
  font-size: 0.7rem;
}

.dw-action__warning .q-icon {
  flex: none;
  margin-top: 0.05rem;
}

.dw-action__actions {
  border-top: 1px solid var(--border-subtle);
}
</style>

<script>
import { operationLabel } from 'src/services/widgetActions'

let instance = 0

export default {
  name: 'WidgetActionButton',
  props: {
    action: { type: Object, default: null },
    account: { type: String, required: true },
    label: { type: String, default: '' }
  },
  emits: ['queued'],
  data () {
    instance += 1
    return {
      uid: 'dw-action-' + instance,
      open: false
    }
  },
  computed: {
    titleId () {
      return this.uid + '-title'
    },
    bodyId () {
      return this.uid + '-body'
    },
    authorityColor () {
      const color = this.action?.authority?.color || 'primary'
      return color === 'primary' ? 'primary' : color + '-9'
    },
    ariaLabel () {
      return (this.action?.label || 'Widget action') + ' — opens a confirmation'
    }
  },
  methods: {
    operationLabel,
    confirm () {
      const action = this.action
      const account = String(this.account || '').replace(/^@/, '').trim()
      if (!action || !account || !this.$hiveStore) return
      for (const operation of action.operations) {
        this.$hiveStore.addToQueue([account, action.authority.key, operation])
      }
      this.open = false
      this.$q?.notify?.({
        message: action.label + ' queued for signing',
        caption: action.authority.label + ' · review it in the queue',
        color: 'green',
        icon: 'playlist_add_check',
        position: 'top'
      })
      this.$emit('queued', action)
    }
  }
}
</script>
