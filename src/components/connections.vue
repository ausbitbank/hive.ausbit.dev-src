<template>
  <section class="connections" :aria-label="type === 'followers' ? 'Followers' : 'Following'">
    <div class="connections-toolbar">
      <q-input
        v-model="query"
        dense
        outlined
        clearable
        debounce="150"
        label="Search loaded accounts"
        aria-label="Search loaded accounts by name or profile text"
        class="connections-search"
        @clear="query = ''"
      >
        <template #prepend>
          <q-icon name="search" size="18px" aria-hidden="true" />
        </template>
      </q-input>

      <q-select
        v-model="sort"
        :options="sortOptions"
        emit-value
        map-options
        dense
        outlined
        options-dense
        label="Sort"
        aria-label="Sort accounts"
        class="connections-sort"
      />

      <div class="connections-chips" role="group" aria-label="Filter accounts">
        <button
          v-for="option in filterOptions"
          :key="option.value"
          type="button"
          class="connections-chip"
          :class="{ 'connections-chip--active': filter === option.value }"
          :aria-pressed="filter === option.value"
          @click="filter = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div v-if="error && !entries.length" class="connections-state">
      <q-icon name="error_outline" size="2em" color="orange" aria-hidden="true" />
      <p>{{ error }}</p>
      <q-btn outline no-caps color="primary" icon="refresh" label="Try again" @click="load({ force: true })" />
    </div>

    <div v-else-if="loading && !entries.length" class="connections-grid" aria-label="Loading accounts">
      <div v-for="i in 8" :key="i" class="connection-card connection-card--skeleton">
        <q-skeleton type="circle" size="42px" />
        <q-skeleton type="text" width="55%" />
        <q-skeleton type="text" width="75%" />
      </div>
    </div>

    <div v-else-if="!visible.length" class="connections-state">
      <q-icon name="person_search" size="2em" aria-hidden="true" />
      <p>{{ entries.length ? 'No loaded account matches this search or filter.' : 'No accounts to show yet.' }}</p>
      <q-btn v-if="entries.length" flat no-caps color="primary" label="Clear search and filters" @click="clearFilters" />
    </div>

    <infinite-scroll v-else :can-load="!exhausted" :loading="loading" :offset="500" @load="load">
      <div class="connections-grid">
        <div v-for="person in visible" :key="person.name" class="connection-card">
          <user-card :username="person.name" :show-cover="false" />
        </div>
      </div>
    </infinite-scroll>

    <p class="connections-count">
      <template v-if="entries.length">
        Showing {{ visible.length }} of {{ entries.length }} loaded
        <template v-if="total !== null"> · {{ formattedTotal }} {{ type }} in total</template>
      </template>
      <template v-else>No connections loaded yet.</template>
      <template v-if="query || filter !== 'all'"> · {{ filteredCount }} match the current filters</template>
    </p>
  </section>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import { fetchConnections } from 'src/services/chainData'
import { vestToHive } from 'src/services/wallet'

const SORTS = [
  { value: 'name', label: 'Name A–Z' },
  { value: 'hp', label: 'Hive Power' },
  { value: 'reputation', label: 'Reputation' },
  { value: 'active', label: 'Recently active' }
]

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'profile', label: 'With profile' },
  { value: 'active', label: 'Active 30d' }
]

function timestamp (value) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function profileOf (account) {
  if (!account || !account.posting_json_metadata) return null
  try {
    const metadata = JSON.parse(account.posting_json_metadata)
    return metadata && metadata.profile ? metadata.profile : null
  } catch {
    return null
  }
}

export default {
  name: 'connections',
  props: {
    type: { type: String, default: 'followers' },
    username: { type: String, required: true }
  },
  components: {
    userCard: defineAsyncComponent(() => import('components/userCard.vue')),
    infiniteScroll: defineAsyncComponent(() => import('components/ui/InfiniteScroll.vue'))
  },
  data () {
    return {
      entries: [],
      loading: false,
      error: '',
      exhausted: false,
      query: '',
      sort: 'name',
      filter: 'all',
      limit: 60,
      sortOptions: SORTS,
      filterOptions: FILTERS
    }
  },
  computed: {
    globalProps () {
      return this.$hiveStore.globalProps
    },
    followCount () {
      return this.$hiveStore.followCounts[this.username] || null
    },
    total () {
      const count = this.type === 'following'
        ? this.followCount?.following_count
        : this.followCount?.follower_count
      return count === undefined || count === null ? null : Number(count)
    },
    formattedTotal () {
      return this.total === null ? '' : this.total.toLocaleString('en-US')
    },
    people () {
      return this.entries.map(name => this.personFor(name))
    },
    filteredCount () {
      return this.filteredPeople.length
    },
    filteredPeople () {
      const needle = String(this.query || '').trim().toLowerCase()
      return this.people.filter(person => {
        if (this.filter === 'profile' && !person.hasProfile) return false
        if (this.filter === 'active' && !person.recentlyActive) return false
        if (!needle) return true
        if (person.name.toLowerCase().includes(needle)) return true
        if (person.displayName && person.displayName.toLowerCase().includes(needle)) return true
        return Boolean(person.about && person.about.toLowerCase().includes(needle))
      })
    },
    visible () {
      const sorted = [...this.filteredPeople]
      switch (this.sort) {
        case 'hp':
          sorted.sort((a, b) => b.hp - a.hp || a.name.localeCompare(b.name))
          break
        case 'reputation':
          sorted.sort((a, b) => b.reputation - a.reputation || a.name.localeCompare(b.name))
          break
        case 'active':
          sorted.sort((a, b) => b.lastActive - a.lastActive || a.name.localeCompare(b.name))
          break
        default:
          sorted.sort((a, b) => a.sortName.localeCompare(b.sortName, 'en', { sensitivity: 'base' }))
          break
      }
      return sorted
    }
  },
  watch: {
    username () {
      this.reset()
      this.load()
    },
    type () {
      this.reset()
      this.load()
    }
  },
  methods: {
    personFor (name) {
      const account = this.$hiveStore.accounts[name]
      const profile = profileOf(account) || {}
      const displayName = typeof profile.name === 'string' ? profile.name.trim() : ''
      const about = typeof profile.about === 'string' ? profile.about.trim() : ''
      const lastActive = Math.max(timestamp(account?.last_post), timestamp(account?.last_vote_time))
      return {
        name,
        displayName,
        about,
        hasProfile: Boolean(displayName || about || profile.profile_image),
        recentlyActive: lastActive > Date.now() - 30 * 24 * 60 * 60 * 1000,
        lastActive,
        hp: account ? vestToHive(account.vesting_shares, this.globalProps) : 0,
        reputation: Number(account?.reputation) || 0,
        sortName: displayName || name
      }
    },
    reset () {
      this.entries = []
      this.error = ''
      this.exhausted = false
      this.query = ''
      this.filter = 'all'
    },
    clearFilters () {
      this.query = ''
      this.filter = 'all'
    },
    async load ({ force = false } = {}) {
      if (this.loading || this.exhausted) return
      this.loading = true
      this.error = ''
      const start = this.entries.length ? this.entries[this.entries.length - 1] : ''
      try {
        const response = await fetchConnections(this.username, this.type, {
          start,
          limit: this.limit,
          force
        })
        const rows = Array.isArray(response) ? response : []
        const next = rows
          .map(row => (this.type === 'following' ? row.following : row.follower))
          .filter(Boolean)
        for (const name of next) {
          if (!this.entries.includes(name)) this.entries.push(name)
        }
        this.exhausted = next.length < this.limit
        if (next.length) await this.$hiveStore.getAccounts(next)
        if (this.total === null) this.$hiveStore.getFollowCount(this.username)
      } catch (error) {
        console.error('Failed to load ' + this.type, error)
        this.error = 'Could not load ' + this.type + ' for @' + this.username + '.'
      } finally {
        this.loading = false
      }
    }
  },
  mounted () {
    if (this.globalProps && this.globalProps.empty) this.$hiveStore.getGlobalProps()
    if (this.$hiveStore.followCounts[this.username] === undefined) this.$hiveStore.getFollowCount(this.username)
    this.load()
  }
}
</script>

<style scoped>
.connections {
  width: 100%;
}

.connections-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.65rem 0.85rem;
  margin-bottom: var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.02);
}

.connections-search {
  flex: 1 1 240px;
  min-width: 0;
}

.connections-sort {
  flex: 0 1 180px;
  min-width: 0;
}

.connections-chips {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.connections-chip {
  padding: 0.28rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: transparent;
  color: #90a4ae;
  font: inherit;
  font-size: 0.74rem;
  cursor: pointer;
}

.connections-chip:hover:not(:disabled) {
  color: #e4eaed;
  border-color: rgba(79, 195, 247, 0.4);
}

.connections-chip--active {
  color: #0b1014;
  border-color: transparent;
  background: #4fc3f7;
  font-weight: 600;
}

.connections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
  gap: var(--space-3);
}

.connection-card {
  min-width: 0;
  padding: 0.75rem 0.7rem 0.35rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.014);
  transition: border-color 160ms ease, background-color 160ms ease;
}

.connection-card:hover {
  border-color: rgba(79, 195, 247, 0.28);
  background: rgba(255, 255, 255, 0.03);
}

.connection-card :deep(.q-separator) {
  display: none;
}

.connection-card--skeleton {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1rem;
}

.connections-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: var(--space-6) var(--space-3);
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-card);
  color: #90a4ae;
  text-align: center;
}

.connections-state p {
  margin: 0;
}

.connections-count {
  margin: 0.75rem 0 0;
  color: #78909c;
  font-size: 0.74rem;
  text-align: center;
}

@media (max-width: 599px) {
  .connections-toolbar {
    padding: 0.55rem 0.65rem;
  }

  .connections-sort {
    flex: 1 1 140px;
  }
}
</style>
