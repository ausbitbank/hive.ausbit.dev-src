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
        icon="ios_share"
        label="Share"
        title="Export this layout as a text string"
        @click="openExport"
      />
      <q-btn
        no-caps
        flat
        dense
        icon="download"
        label="Import"
        title="Import a shared layout"
        @click="openImport"
      />
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

    <q-dialog v-model="exportOpen">
      <q-card class="dw-share">
        <q-card-section class="dw-share__head">
          <div>
            <div class="home-eyebrow">Share layout</div>
            <h2 class="dw-share__title">Copy this layout string</h2>
          </div>
          <q-btn flat dense round icon="close" aria-label="Close" v-close-popup />
        </q-card-section>
        <q-card-section class="dw-share__body">
          <p class="dw-share__hint">Paste this into Share → Import on another dashboard. It carries widget types, widths and settings.</p>
          <q-input
            :model-value="exportText"
            readonly
            outlined
            autogrow
            type="textarea"
            aria-label="Layout string"
            class="dw-share__text"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn no-caps color="primary" icon="content_copy" label="Copy" @click="copyExport" />
          <q-btn no-caps flat label="Done" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="importOpen">
      <q-card class="dw-share">
        <q-card-section class="dw-share__head">
          <div>
            <div class="home-eyebrow">Import layout</div>
            <h2 class="dw-share__title">Paste a shared layout</h2>
          </div>
          <q-btn flat dense round icon="close" aria-label="Close" v-close-popup />
        </q-card-section>
        <q-card-section class="dw-share__body">
          <p class="dw-share__hint">This replaces the widgets in the current draft. Review the layout, then press Save.</p>
          <q-input
            v-model="importText"
            outlined
            autogrow
            type="textarea"
            label="Layout string or JSON"
            aria-label="Layout string to import"
            :error="Boolean(importError)"
            :error-message="importError"
            class="dw-share__text"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn no-caps flat label="Cancel" v-close-popup />
          <q-btn no-caps color="primary" icon="download" label="Import" @click="applyImport" />
        </q-card-actions>
      </q-card>
    </q-dialog>
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

.dw-share {
  width: min(520px, 94vw);
  border-radius: var(--radius-card);
}

.dw-share__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.dw-share__title {
  margin: 0.1rem 0 0;
  color: #e4eaed;
  font-size: 1rem;
  font-weight: 600;
}

.dw-share__body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dw-share__hint {
  margin: 0;
  color: #90a4ae;
  font-size: 0.78rem;
  line-height: 1.45;
}

.dw-share__text {
  font-family: monospace;
  font-size: 0.72rem;
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
import { serialiseLayout, parseLayoutText } from 'src/services/dashboardLayout'

export default {
  name: 'DashboardCustomiseBar',
  props: {
    // Widget counts for the summary: one per change type.
    changes: { type: Object, default: () => ({ total: 0 }) },
    dirty: { type: Boolean, default: false },
    // False when every widget is already on the dashboard or it is full.
    addDisabled: { type: Boolean, default: false },
    // The draft layout, so Share can include unsaved changes.
    layout: { type: Array, default: () => [] }
  },
  emits: ['save', 'cancel', 'reset', 'add', 'import'],
  data () {
    return {
      exportOpen: false,
      importOpen: false,
      importText: '',
      importError: ''
    }
  },
  computed: {
    summary () {
      const changes = this.changes || {}
      const parts = []
      if (changes.added) parts.push(plural(changes.added, 'widget added'))
      if (changes.removed) parts.push(plural(changes.removed, 'widget removed'))
      if (changes.moved) parts.push('order changed')
      if (changes.resized) parts.push(plural(changes.resized, 'width change'))
      if (changes.configured) parts.push(plural(changes.configured, 'setting change'))
      return parts.length ? parts.join(' · ') : 'Drag to reorder, change widths or add widgets.'
    },
    exportText () {
      return serialiseLayout(this.layout)
    }
  },
  methods: {
    openExport () {
      this.exportOpen = true
    },
    openImport () {
      this.importText = ''
      this.importError = ''
      this.importOpen = true
    },
    async copyExport () {
      try {
        await navigator.clipboard.writeText(this.exportText)
        this.$q.notify({ type: 'positive', message: 'Layout string copied' })
      } catch {
        this.$q.notify({ type: 'negative', message: 'Could not copy — select the text manually' })
      }
    },
    applyImport () {
      const result = parseLayoutText(this.importText)
      if (result.error) {
        this.importError = result.error
        return
      }
      this.$emit('import', result.layout)
      this.importOpen = false
      this.$q.notify({ type: 'positive', message: 'Layout imported — review it, then press Save' })
    }
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
