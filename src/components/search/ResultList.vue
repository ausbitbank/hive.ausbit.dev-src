// Reusable, keyboard-operable results list for the search page.
//
// Every row is a real button: Enter opens the result, and the parent owns the
// active-row state so arrow keys can move between groups.

<template>
  <ul class="result-list" role="list">
    <li v-for="row in rows" :key="row.key">
      <button
        type="button"
        class="result-row"
        :class="{ 'result-row--active': row.key === activeKey }"
        @click="$emit('open', row)"
        @focus="$emit('hover', row)"
        @mouseenter="$emit('hover', row)"
      >
        <span class="result-row__icon" aria-hidden="true">
          <q-icon :name="row.icon || 'search'" size="19px" />
        </span>
        <span class="result-row__body">
          <span class="result-row__title">{{ row.title }}</span>
          <span v-if="row.description" class="result-row__description">{{ row.description }}</span>
        </span>
        <span v-if="row.badge" class="result-row__badge">{{ row.badge }}</span>
        <q-icon name="arrow_forward" size="16px" class="result-row__arrow" aria-hidden="true" />
      </button>
    </li>
    <li v-if="!rows.length" class="result-list__empty">{{ empty }}</li>
  </ul>
</template>

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
  gap: 0.6rem;
  width: 100%;
  min-height: 44px;
  padding: 0.45rem 0.6rem;
  border: 1px solid transparent;
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

.result-row:focus-visible {
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

.result-list__empty {
  margin: 0;
  padding: 0.6rem;
  color: var(--c-text-subtle);
  font-size: 0.76rem;
}
</style>

<script>
export default {
  name: 'ResultList',
  props: {
    rows: { type: Array, default: () => [] },
    activeKey: { type: String, default: '' },
    empty: { type: String, default: 'No results in this group.' }
  },
  emits: ['open', 'hover']
}
</script>
