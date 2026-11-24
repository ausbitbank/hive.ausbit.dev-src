<template>
  <ul class="result-list" role="list">
    <li v-for="row in rows" :key="row.key" :data-result-key="row.key">
      <div
        class="result-row"
        :class="{ 'result-row--active': row.key === activeKey }"
      >
        <button
          type="button"
          class="result-row__open"
          @click="$emit('open', row)"
          @focus="$emit('hover', row)"
          @mouseenter="$emit('hover', row)"
        >
          <span class="result-row__icon" aria-hidden="true">
            <q-icon :name="row.icon || 'search'" size="19px" />
          </span>
          <span class="result-row__body">
            <span class="result-row__title">{{ row.title }}</span>
            <span
              v-if="row.description && !collapsed(row)"
              class="result-row__description"
            >{{ row.description }}</span>
            <span
              v-if="row.moderation?.primary && row.moderation?.display !== 'show'"
              class="result-row__moderation"
            >
              <q-icon name="shield" size="11px" aria-hidden="true" />
              {{ row.moderation.primary.label }}
            </span>
          </span>
          <span v-if="row.badge" class="result-row__badge">{{ row.badge }}</span>
          <q-icon name="arrow_forward" size="16px" class="result-row__arrow" aria-hidden="true" />
        </button>
        <button
          v-if="showable(row)"
          type="button"
          class="result-row__show"
          :aria-label="'Show ' + row.title + ' anyway'"
          @click="showRow(row)"
          @focus="$emit('hover', row)"
        >
          Show anyway
        </button>
      </div>
    </li>
    <li v-if="!rows.length" class="result-list__empty">{{ empty }}</li>
  </ul>
</template>

<script>
export default {
  name: 'ResultList',
  props: {
    rows: { type: Array, default: () => [] },
    activeKey: { type: String, default: '' },
    empty: { type: String, default: 'No results in this group.' }
  },
  emits: ['open', 'hover', 'show'],
  methods: {
    collapsed (row) {
      return row.moderation?.display === 'collapse' || row.moderation?.display === 'hide'
    },
    showable (row) {
      return Boolean(
        row.moderation?.primary &&
        (row.moderation.display === 'collapse' || row.moderation.display === 'hide')
      )
    },
    showRow (row) {
      this.$emit('show', row)
      // The action disappears after the decision flips to “shown”; keep
      // keyboard focus on the row's open button instead of dropping it to body.
      this.$nextTick(() => {
        const key = String(row.key || '')
        const item = [...this.$el.querySelectorAll('[data-result-key]')]
          .find(element => element.dataset.resultKey === key)
        item?.querySelector('.result-row__open')?.focus()
      })
    }
  }
}
</script>

<style scoped>
.result-list {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  width: 100%;
  min-height: 44px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
}

.result-row__open {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  min-height: 44px;
  padding: 0.45rem 0.6rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.result-row:hover {
  border-color: var(--border-subtle);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.result-row__open:focus-visible,
.result-row__show:focus-visible {
  outline: 2px solid var(--c-link);
  outline-offset: 1px;
}

.result-row--active {
  border-color: color-mix(in srgb, var(--c-link) 35%, transparent);
  background: color-mix(in srgb, var(--c-link) 7%, transparent);
}

.result-row__icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 5%, transparent);
  color: var(--c-link-hover);
}

.result-row__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.result-row__title {
  overflow: hidden;
  color: var(--c-text);
  font-size: 0.84rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-row__description {
  overflow: hidden;
  color: var(--c-text-subtle);
  font-size: 0.73rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.result-row__moderation {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  color: var(--c-warning);
  font-size: 0.68rem;
  font-weight: 600;
}

.result-row__badge {
  flex: none;
  padding: 0.05rem 0.4rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 6%, transparent);
  color: var(--c-text-muted);
  font-size: 0.66rem;
  white-space: nowrap;
}

.result-row__arrow {
  flex: none;
  color: var(--c-text-faint);
}

.result-row__show {
  flex: none;
  min-height: 34px;
  margin-right: 0.45rem;
  padding: 0 0.55rem;
  border: 1px solid color-mix(in srgb, var(--c-link) 35%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-link) 6%, transparent);
  color: var(--c-link);
  cursor: pointer;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 600;
}

.result-row__show:hover {
  background: color-mix(in srgb, var(--c-link) 12%, transparent);
}

.result-list__empty {
  margin: 0;
  padding: 0.6rem;
  color: var(--c-text-subtle);
  font-size: 0.76rem;
}
</style>
