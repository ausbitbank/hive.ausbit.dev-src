<template>
  <div class="dw-watch">
    <q-card-section class="home-panel__head dw-watch__head">
      <div>
        <div class="home-eyebrow">Watchlist</div>
        <h2 class="home-panel__title">Accounts</h2>
      </div>
      <span v-if="names.length" class="dw-watch__count">
        {{ summary.found }} / {{ names.length }}
      </span>
    </q-card-section>

    <dashboard-widget-state v-if="state === 'loading'" state="loading" />

    <dashboard-widget-state
      v-else-if="state === 'error'"
      state="error"
      :error="loadError || 'The watchlist accounts are unavailable right now.'"
      @retry="refresh"
    />

    <template v-else>
      <q-card-section v-if="state === 'stale' && loadError" class="dw-watch__warn" role="status">
        <q-icon name="warning" size="15px" aria-hidden="true" />
        <span>{{ loadError }}</span>
      </q-card-section>

      <q-card-section v-if="!names.length" class="home-panel__state">
        <q-icon name="person_search" size="24px" aria-hidden="true" />
        <span>Add accounts in widget settings.</span>
        <router-link to="/search" class="home-panel__link">Find accounts</router-link>
      </q-card-section>

      <q-card-section v-else-if="!summary.hasData" class="home-panel__state">
        <q-icon name="search_off" size="24px" aria-hidden="true" />
        <span>No accounts on this list were found.</span>
        <router-link to="/search" class="home-panel__link">Find accounts</router-link>
      </q-card-section>

      <q-card-section v-else class="dw-watch__body">
        <ul class="dw-watch__list">
          <li v-for="row in summary.rows" :key="row.name">
            <router-link :to="row.link" class="dw-watch__row">
              <img
                class="dw-watch__avatar"
                :src="row.avatar"
                alt=""
                width="30"
                height="30"
                loading="lazy"
                decoding="async"
                @error="onAvatarError"
              >
              <span class="dw-watch__ident">
                <span class="dw-watch__line">
                  <span class="dw-watch__name">@{{ row.name }}</span>
                  <span class="dw-watch__rep" title="Reputation">{{ row.reputation }}</span>
                </span>
                <span class="dw-watch__meta">
                  <span class="dw-watch__hp">{{ row.hpLabel }} HP</span>
                  <template v-if="showBalances">
                    <span>{{ row.hiveLabel }} HIVE</span>
                    <span>{{ row.hbdLabel }} HBD</span>
                  </template>
                  <span v-if="row.postCount" class="dw-watch__posts">
                    {{ formatCount(row.postCount) }} posts
                  </span>
                </span>
              </span>
            </router-link>
          </li>
        </ul>

        <p v-if="summary.missing" class="dw-watch__note">
          {{ summary.missing }} account{{ summary.missing === 1 ? '' : 's' }} not found.
        </p>
      </q-card-section>

      <q-card-section class="home-panel__footer dw-watch__footer">
        <router-link to="/search">Find accounts</router-link>
        <q-btn
          flat
          dense
          no-caps
          size="sm"
          color="primary"
          icon="refresh"
          label="Refresh"
          :loading="loading"
          @click="refresh"
        />
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-watch {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dw-watch__head {
  align-items: flex-start;
}

.dw-watch__count {
  padding: 0.18rem 0.55rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 7%, transparent);
  color: var(--c-text-muted);
  font-size: 0.66rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dw-watch__warn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 1rem;
  color: var(--c-warning);
  font-size: 0.72rem;
}

.dw-watch__body {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding-top: 0.6rem;
}

.dw-watch__list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dw-watch__row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.55rem;
  padding: 0.42rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  color: var(--c-text);
  text-decoration: none;
}

.dw-watch__row:hover,
.dw-watch__row:focus-visible {
  border-color: color-mix(in srgb, var(--c-link) 40%, transparent);
  background: color-mix(in srgb, var(--c-link) 8%, transparent);
  text-decoration: none;
}

.dw-watch__avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: cover;
  background: color-mix(in srgb, var(--c-text) 8%, transparent);
}

.dw-watch__ident {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
}

.dw-watch__line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
  min-width: 0;
}

.dw-watch__name {
  overflow: hidden;
  color: var(--c-text);
  font-size: 0.8rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-watch__rep {
  flex: none;
  padding: 0.06rem 0.35rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-link) 12%, transparent);
  color: var(--c-link-soft);
  font-size: 0.62rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.dw-watch__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.2rem 0.45rem;
  color: var(--c-text-faint);
  font-size: 0.66rem;
  font-variant-numeric: tabular-nums;
}

.dw-watch__hp {
  color: var(--c-text-muted);
  font-weight: 600;
}

.dw-watch__posts {
  color: var(--c-text-faint);
}

.dw-watch__note {
  margin: 0;
  color: var(--c-text-faint);
  font-size: 0.66rem;
  line-height: 1.4;
}

.dw-watch__footer {
  align-items: center;
}

@media (max-width: 479px) {
  .dw-watch__row {
    gap: 0.45rem;
    padding: 0.38rem 0.45rem;
  }

  .dw-watch__posts {
    display: none;
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { fetchAccounts, fetchGlobalProps } from 'src/services/chainData'
import { accountWatchlistSummary } from 'src/services/accountWatchlist'
import { formatCount } from 'src/services/network'
import { FALLBACK_AVATAR } from 'src/utils/avatar'

const MAX_ACCOUNTS = 20

export default {
  name: 'WidgetAccountWatchlist',
  components: { DashboardWidgetState },
  props: {
    accounts: { type: Array, default: () => [] },
    showBalances: { type: Boolean, default: true }
  },
  data () {
    return {
      records: [],
      globalProps: null,
      requestToken: 0,
      loading: true,
      loaded: false,
      loadError: '',
      updatedAt: 0
    }
  },
  computed: {
    names () {
      const seen = new Set()
      const names = []
      for (const raw of Array.isArray(this.accounts) ? this.accounts : []) {
        const name = String(raw ?? '').trim().replace(/^@/, '').toLowerCase()
        if (!name || seen.has(name)) continue
        seen.add(name)
        names.push(name)
        if (names.length >= MAX_ACCOUNTS) break
      }
      return names
    },
    summary () {
      return accountWatchlistSummary({
        accounts: this.names,
        records: this.records,
        globalProps: this.globalProps
      })
    },
    state () {
      if (this.loading && !this.loaded) return 'loading'
      if (!this.loaded) return 'error'
      return this.loadError ? 'stale' : 'ready'
    }
  },
  watch: {
    accounts: {
      deep: true,
      handler () {
        this.reload()
      }
    }
  },
  mounted () {
    this.reload()
  },
  beforeUnmount () {
    this.requestToken += 1
  },
  methods: {
    formatCount,
    onAvatarError (event) {
      const image = event?.target
      if (!image || image.dataset.fallback) return
      image.dataset.fallback = '1'
      image.src = FALLBACK_AVATAR
    },
    refresh () {
      this.reload({ force: true })
    },
    async reload ({ force = false } = {}) {
      const token = ++this.requestToken
      this.loading = !this.loaded
      this.loadError = ''
      const names = this.names

      if (!names.length) {
        this.records = []
        this.globalProps = null
        this.loaded = true
        this.loading = false
        this.updatedAt = Date.now()
        return
      }

      const [accountsResult, propsResult] = await Promise.allSettled([
        fetchAccounts(names, { force }),
        fetchGlobalProps({ force })
      ])

      // A watchlist edit can start a second read; only the newest one may
      // replace the rows and clear the spinner.
      if (token !== this.requestToken) return

      if (accountsResult.status === 'fulfilled') {
        this.records = Array.isArray(accountsResult.value) ? accountsResult.value : []
        this.loaded = true
      } else {
        console.error('Failed to load watchlist accounts', accountsResult.reason)
        this.loadError = this.loaded
          ? 'Accounts are unavailable right now — showing the last values.'
          : 'Accounts are unavailable right now.'
      }

      if (propsResult.status === 'fulfilled') {
        this.globalProps = propsResult.value && !propsResult.value.empty ? propsResult.value : null
      } else {
        console.error('Failed to load global properties for the watchlist', propsResult.reason)
        if (!this.loadError) {
          this.loadError = 'Hive Power is unavailable right now — balances are still shown.'
        }
      }

      this.loading = false
      this.updatedAt = Date.now()
    }
  }
}
</script>
