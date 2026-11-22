<template>
  <q-card flat bordered class="witness-filters">
    <q-card-section class="witness-filters__body">
      <div class="witness-filters__search">
        <q-input
          :model-value="search"
          outlined
          dense
          clearable
          debounce="150"
          label="Search witnesses"
          aria-label="Search witnesses by name, URL, version or fee"
          @update:model-value="$emit('update:search', $event)"
        >
          <template #prepend>
            <q-icon name="search" aria-hidden="true" />
          </template>
        </q-input>
      </div>

      <div class="witness-filters__sort">
        <q-select
          :model-value="sort"
          :options="sortOptions"
          emit-value
          map-options
          outlined
          dense
          label="Sort witnesses"
          options-dense
          aria-label="Sort witnesses"
          @update:model-value="$emit('update:sort', $event)"
        />
      </div>

      <q-btn
        outline
        no-caps
        :icon="direction === 'asc' ? 'arrow_upward' : 'arrow_downward'"
        :label="direction === 'asc' ? 'Ascending' : 'Descending'"
        :aria-label="'Change sort direction, currently ' + direction"
        @click="$emit('update:direction', direction === 'asc' ? 'desc' : 'asc')"
      />

      <q-toggle
        v-if="loggedIn"
        :model-value="myVotesOnly"
        label="My votes only"
        color="orange"
        @update:model-value="$emit('update:myVotesOnly', $event)"
      />

      <q-toggle
        :model-value="warningsOnly"
        label="Warnings only"
        color="orange"
        @update:model-value="$emit('update:warningsOnly', $event)"
      />

      <q-btn
        v-if="search || myVotesOnly || warningsOnly"
        flat
        dense
        no-caps
        color="primary"
        icon="clear"
        label="Clear filters"
        @click="$emit('clear')"
      />
    </q-card-section>

    <div class="witness-filters__count" aria-live="polite">
      {{ visibleCount }} of {{ totalCount }} witnesses shown
      <span v-if="warningCount"> · {{ warningCount }} with health warnings</span>
      <span v-if="myVotesOnly"> · only witnesses you vote for</span>
    </div>
  </q-card>
</template>

<style scoped>
.witness-filters {
  overflow: hidden;
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.witness-filters__body {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: 0.75rem 0.9rem 0.55rem;
}

.witness-filters__search {
  flex: 1 1 240px;
  min-width: 0;
}

.witness-filters__sort {
  flex: 0 1 190px;
  min-width: 150px;
}

.witness-filters__count {
  padding: 0 0.9rem 0.7rem;
  color: var(--c-text-subtle);
  font-size: 0.76rem;
}

@media (max-width: 599px) {
  .witness-filters__body {
    gap: var(--space-2);
  }

  .witness-filters__search,
  .witness-filters__sort {
    flex-basis: 100%;
  }
}
</style>

<script>
export default {
  name: 'WitnessFilters',
  props: {
    search: { type: String, default: '' },
    sort: { type: String, default: 'rank' },
    direction: { type: String, default: 'asc' },
    myVotesOnly: { type: Boolean, default: false },
    warningsOnly: { type: Boolean, default: false },
    loggedIn: { type: Boolean, default: false },
    visibleCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
    warningCount: { type: Number, default: 0 }
  },
  emits: [
    'update:search',
    'update:sort',
    'update:direction',
    'update:myVotesOnly',
    'update:warningsOnly',
    'clear'
  ],
  computed: {
    sortOptions () {
      return [
        { label: 'Rank', value: 'rank' },
        { label: 'Votes', value: 'votes' },
        { label: 'Missed blocks', value: 'missed' },
        { label: 'Price feed age', value: 'pricefeed' },
        { label: 'Version', value: 'version' },
        { label: 'Name', value: 'name' },
        { label: 'Health warnings', value: 'warnings' }
      ]
    }
  }
}
</script>
