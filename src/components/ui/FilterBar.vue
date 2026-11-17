<template>
  <div class="ui-filter-bar">
    <div class="ui-filter-bar__main">
      <slot />
    </div>
    <div v-if="$slots.actions" class="ui-filter-bar__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script>
export default {
  name: 'FilterBar'
}
</script>

<style scoped>
.ui-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.025);
}

.ui-filter-bar__main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1 1 340px;
  min-width: 0;
  flex-wrap: wrap;
}

.ui-filter-bar__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

@media (max-width: 599px) {
  .ui-filter-bar {
    padding: 0.55rem 0.65rem;
  }

  .ui-filter-bar__main {
    flex-basis: 100%;
  }

  .ui-filter-bar__main > * {
    flex: 1 1 100%;
  }
}
</style>
