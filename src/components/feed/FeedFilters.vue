<template>
  <q-btn
    flat
    dense
    no-caps
    icon="filter_alt"
    :label="$q.screen.gt.xs ? 'Filters' : ''"
    :aria-label="buttonAriaLabel"
    :class="{ 'feed-filter--active': hasActiveFilters }"
  >
    <q-badge v-if="hasActiveFilters" color="primary" floating>{{ activeFilterCount }}</q-badge>
    <q-popup-proxy>
      <q-card class="feed-filter-card">
        <q-card-section>
          <div class="feed-filter-card__head">
            <div>
              <div class="feed-filter-card__title">Filter posts</div>
              <div class="feed-filter-card__hint">Applies to the posts loaded so far.</div>
            </div>
            <q-btn flat dense round icon="close" aria-label="Close filters" v-close-popup />
          </div>

          <q-list dense class="feed-filter-list">
            <q-item>
              <q-item-section>
                <q-item-label>Hide voted posts</q-item-label>
                <q-item-label v-if="!loggedInUser" caption>Log in to filter voted posts</q-item-label>
              </q-item-section>
              <q-item-section side><q-toggle :model-value="filter.hideVoted" dense color="primary" aria-label="Hide voted posts" :disable="!loggedInUser" @update:model-value="value => setFilter('hideVoted', value)" /></q-item-section>
            </q-item>
            <q-item>
              <q-item-section><q-item-label>Hide reblogs</q-item-label></q-item-section>
              <q-item-section side><q-toggle :model-value="filter.hideReblogs" dense color="primary" aria-label="Hide reblogs" @update:model-value="value => setFilter('hideReblogs', value)" /></q-item-section>
            </q-item>
            <q-item>
              <q-item-section><q-item-label>Hide pinned posts</q-item-label></q-item-section>
              <q-item-section side><q-toggle :model-value="filter.hidePinned" dense color="primary" aria-label="Hide pinned posts" @update:model-value="value => setFilter('hidePinned', value)" /></q-item-section>
            </q-item>
            <q-item>
              <q-item-section><q-item-label>Hide muted posts</q-item-label></q-item-section>
              <q-item-section side><q-toggle :model-value="filter.hideHidden" dense color="primary" aria-label="Hide muted posts" @update:model-value="value => setFilter('hideHidden', value)" /></q-item-section>
            </q-item>
            <q-item>
              <q-item-section><q-item-label>Hide moderated posts</q-item-label></q-item-section>
              <q-item-section side><q-toggle :model-value="filter.hideGray" dense color="primary" aria-label="Hide moderated posts" @update:model-value="value => setFilter('hideGray', value)" /></q-item-section>
            </q-item>
            <q-item>
              <q-item-section><q-item-label>Hide rewards outside range</q-item-label></q-item-section>
              <q-item-section side><q-toggle :model-value="filter.hideRewardsFilter" dense color="primary" aria-label="Hide rewards outside range" @update:model-value="value => setFilter('hideRewardsFilter', value)" /></q-item-section>
            </q-item>
          </q-list>

          <div class="feed-filter-card__range">
            <q-input
              :model-value="filter.hideRewardsBelow"
              type="number"
              dense
              outlined
              label="Min HBD"
              :disable="!filter.hideRewardsFilter"
              @update:model-value="value => setRewardBound('hideRewardsBelow', value)"
            />
            <q-input
              :model-value="filter.hideRewardsAbove"
              type="number"
              dense
              outlined
              label="Max HBD"
              :disable="!filter.hideRewardsFilter"
              @update:model-value="value => setRewardBound('hideRewardsAbove', value)"
            />
          </div>

          <div class="feed-filter-card__tags">
            <div class="feed-filter-card__tags-head">
              <span>Ignored tags</span>
              <span class="feed-filter-card__hint">Saved in Moderation settings.</span>
            </div>
            <div class="feed-filter-card__tag-add">
              <q-input
                v-model="newIgnoredTag"
                dense
                outlined
                label="Add a tag to ignore"
                aria-label="Tag to ignore"
                @keyup.enter="addIgnoredTag"
              />
              <q-btn
                unelevated
                no-caps
                color="primary"
                label="Add"
                :disable="!newIgnoredTag.trim()"
                @click="addIgnoredTag"
              />
            </div>
            <div v-if="ignoredTags.length" class="feed-filter-card__tag-list">
              <q-chip
                v-for="tag in ignoredTags"
                :key="tag"
                dense
                removable
                color="grey-9"
                text-color="white"
                @remove="$emit('remove-tag', tag)"
              >
                #{{ tag }}
              </q-chip>
            </div>
            <p v-else class="feed-filter-card__hint">No tags ignored yet.</p>
          </div>

          <div class="feed-filter-card__actions">
            <q-btn flat no-caps color="primary" label="Reset filters" @click="$emit('reset')" />
            <q-btn unelevated no-caps color="primary" label="Done" v-close-popup />
          </div>
        </q-card-section>
      </q-card>
    </q-popup-proxy>
  </q-btn>
</template>

<script>
import { activeFeedFilterCount, defaultFeedFilters } from 'src/services/feedFilters'

export default {
  name: 'FeedFilters',
  props: {
    /** Reactive filter state owned by the feed; the dialog edits it in place. */
    filter: { type: Object, default: () => defaultFeedFilters() },
    ignoredTags: { type: Array, default: () => [] },
    loggedInUser: { type: String, default: '' },
    buttonAriaLabel: { type: String, default: 'Filter posts' }
  },
  emits: ['add-tag', 'remove-tag', 'reset', 'update:filter'],
  data () {
    return {
      newIgnoredTag: ''
    }
  },
  computed: {
    activeFilterCount () {
      return activeFeedFilterCount(this.filter, this.ignoredTags)
    },
    hasActiveFilters () {
      return this.activeFilterCount > 0
    }
  },
  methods: {
    setFilter (key, value) {
      this.$emit('update:filter', { ...this.filter, [key]: value })
    },
    setRewardBound (key, value) {
      this.setFilter(key, value === '' || value === null ? '' : Number(value))
    },
    addIgnoredTag () {
      const tag = this.newIgnoredTag.trim()
      if (!tag) return
      this.$emit('add-tag', tag)
      this.newIgnoredTag = ''
    }
  }
}
</script>

<style scoped>
.feed-filter--active {
  color: var(--c-link-hover);
}

.feed-filter-card {
  width: min(360px, 92vw);
}

.feed-filter-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: 0.35rem;
}

.feed-filter-card__title {
  font-weight: 600;
}

.feed-filter-card__hint {
  color: var(--c-text-subtle);
  font-size: 0.72rem;
}

.feed-filter-list {
  margin: 0 -0.5rem;
}

.feed-filter-card__range {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.feed-filter-card__tags {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-subtle);
}

.feed-filter-card__tags-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  font-weight: 600;
}

.feed-filter-card__tag-add {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin-top: 0.4rem;
}

.feed-filter-card__tag-add .q-field {
  flex: 1;
  min-width: 0;
}

.feed-filter-card__tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  max-height: 8rem;
  margin-top: 0.4rem;
  overflow-y: auto;
}

.feed-filter-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
</style>
