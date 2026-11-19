<template>
  <div class="dw-bar" role="region" aria-label="Dashboard editing">
    <div class="dw-bar__main">
      <q-icon name="dashboard_customize" size="18px" aria-hidden="true" />
      <div class="dw-bar__text">
        <strong>Editing your dashboard</strong>
        <span class="dw-bar__summary">{{ summary }}</span>
      </div>
    </div>

    <div class="dw-bar__actions">
      <q-btn
        no-caps
        flat
        dense
        icon="restart_alt"
        label="Reset to default"
        class="dw-bar__reset"
        title="Use the built-in layout"
        @click="$emit('reset')"
      />
      <q-btn no-caps flat dense label="Cancel" @click="$emit('cancel')" />
      <q-btn
        no-caps
        unelevated
        color="primary"
        icon="add"
        label="Add widget"
        :disable="addDisabled"
        @click="$emit('add')"
      />
      <q-btn
        no-caps
        unelevated
        color="primary"
        icon="check"
        label="Save"
        :disable="!dirty"
        @click="$emit('save')"
      />
    </div>
  </div>
</template>

<style scoped>
.dw-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
  padding: 0.55rem 0.75rem;
  border: 1px solid rgba(79, 195, 247, 0.35);
  border-radius: var(--radius-card);
  background: rgba(8, 13, 17, 0.92);
  box-shadow: var(--shadow-card);
  color: #cfd8dc;
  backdrop-filter: blur(6px);
}

.dw-bar__main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.dw-bar__main .q-icon {
  color: #4fc3f7;
}

.dw-bar__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  font-size: 0.8rem;
  line-height: 1.3;
}

.dw-bar__text strong {
  color: #e4eaed;
  font-weight: 600;
}

.dw-bar__summary {
  color: #90a4ae;
  font-size: 0.74rem;
}

.dw-bar__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

@media (max-width: 599px) {
  .dw-bar {
    align-items: stretch;
  }

  .dw-bar__actions {
    justify-content: flex-end;
  }

  /* Reset and Cancel are secondary; keep the primary pair on one row. */
  .dw-bar__reset {
    margin-right: auto;
  }
}
</style>

<script>
import { computed } from 'vue'

export default {
  name: 'DashboardCustomiseBar',
  props: {
    // Widget counts for the summary: one per change type.
    changes: { type: Object, default: () => ({ total: 0 }) },
    dirty: { type: Boolean, default: false },
    // False when every widget is already on the dashboard or it is full.
    addDisabled: { type: Boolean, default: false }
  },
  emits: ['save', 'cancel', 'reset', 'add'],
  setup (props) {
    const summary = computed(() => {
      const changes = props.changes || {}
      const parts = []
      if (changes.added) parts.push(plural(changes.added, 'widget added'))
      if (changes.removed) parts.push(plural(changes.removed, 'widget removed'))
      if (changes.moved) parts.push('order changed')
      if (changes.resized) parts.push(plural(changes.resized, 'width change'))
      if (changes.configured) parts.push(plural(changes.configured, 'setting change'))
      return parts.length ? parts.join(' · ') : 'Drag to reorder, change widths or add widgets.'
    })
    return { summary }
  }
}

// Nouns are passed as "widget added" / "setting change", so pluralise the head
// noun: "widget added" -> "2 widgets added".
function plural (count, phrase) {
  const [head, ...rest] = phrase.split(' ')
  const word = count === 1 ? head : head + 's'
  return [count, word, ...rest].join(' ')
}
</script>
