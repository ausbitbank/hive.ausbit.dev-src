<template>
  <q-card flat bordered class="home-card ui-table-card">
    <div v-if="caption || $slots.top" class="ui-table__head">
      <span v-if="caption" class="ui-table__caption">{{ caption }}</span>
      <div class="ui-table__actions">
        <slot name="top" />
      </div>
    </div>

    <div v-if="loading && rows.length === 0" class="ui-table__skeleton">
      <div v-for="i in skeletonRows" :key="i" class="ui-table__skeleton-row">
        <q-skeleton v-for="column in columns" :key="column.key" type="text" :width="i === 1 ? '68%' : '48%'" />
      </div>
    </div>

    <div v-else-if="rows.length === 0" class="ui-table__empty">
      <q-icon :name="emptyIcon" size="24px" color="grey" aria-hidden="true" />
      <span>{{ emptyMessage }}</span>
      <slot name="empty" />
    </div>

    <div v-else class="ui-table__scroll" tabindex="0" role="region" :aria-label="caption || 'Data table'">
      <table class="ui-table">
        <caption class="sr-only">{{ caption || 'Data table' }}</caption>
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              scope="col"
              :class="alignClass(column.align)"
              :style="column.width ? { width: column.width } : null"
            >{{ column.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="keyFor(row, index)">
            <td
              v-for="column in columns"
              :key="column.key"
              :class="alignClass(column.align)"
            >
              <slot
                :name="'cell-' + column.key"
                :row="row"
                :value="valueFor(row, column)"
                :index="index"
              >{{ valueFor(row, column) }}</slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="$slots.footer" class="ui-table__footer">
      <slot name="footer" />
    </div>
  </q-card>
</template>

<script>
export default {
  name: 'DataTable',
  props: {
    columns: { type: Array, default: () => [] },
    rows: { type: Array, default: () => [] },
    rowKey: { type: [String, Function], default: '' },
    caption: { type: String, default: '' },
    loading: { type: Boolean, default: false },
    skeletonRows: { type: Number, default: 5 },
    emptyIcon: { type: String, default: 'table_rows' },
    emptyMessage: { type: String, default: 'No rows to show.' }
  },
  methods: {
    alignClass (align) {
      if (align === 'right') return 'is-right'
      if (align === 'center') return 'is-center'
      return ''
    },
    valueFor (row, column) {
      if (typeof column.field === 'function') return column.field(row)
      return row?.[column.key] ?? '—'
    },
    keyFor (row, index) {
      if (typeof this.rowKey === 'function') return this.rowKey(row, index)
      if (this.rowKey && row) return row[this.rowKey]
      return index
    }
  }
}
</script>

<style scoped>
.ui-table-card {
  overflow: hidden;
}

.ui-table__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
}

.ui-table__caption {
  color: var(--c-text-subtle);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.ui-table__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.ui-table__scroll {
  overflow-x: auto;
}

.ui-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
}

.ui-table th {
  padding: 0.48rem 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--c-text-faint);
  font-size: 0.66rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

.ui-table td {
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--border-subtle);
  color: var(--c-text-soft);
  white-space: nowrap;
}

.ui-table td.is-right,
.ui-table th.is-right {
  text-align: right;
}

.ui-table td.is-center,
.ui-table th.is-center {
  text-align: center;
}

.ui-table__skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.8rem 0.9rem;
}

.ui-table__skeleton-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: 0.45rem;
}

.ui-table__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: var(--space-5) var(--space-4);
  color: var(--c-text-subtle);
  font-size: 0.78rem;
  text-align: center;
}

.ui-table__footer {
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--border-subtle);
  color: var(--c-text-faint);
  font-size: 0.7rem;
}

@media (max-width: 599px) {
  .ui-table th,
  .ui-table td {
    padding: 0.45rem 0.55rem;
  }
}
</style>
