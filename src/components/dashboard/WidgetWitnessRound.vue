<template>
  <div class="dw-round">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Witnesses</div>
        <h2 class="home-panel__title">Witness round</h2>
      </div>
      <span v-if="summary.available" class="dw-round__badge">{{ summary.roundSize }} witnesses</span>
    </q-card-section>

    <dashboard-widget-state
      :state="viewState"
      :error="stateError"
      @retry="load({ force: true })"
    />

    <template v-if="viewState === 'ready' || viewState === 'stale'">
      <p v-if="staleNotice" class="dw-round__notice" role="status">
        <q-icon name="cloud_off" size="16px" aria-hidden="true" />
        <span>{{ staleNotice }}</span>
      </p>

      <q-card-section v-if="!summary.available" class="home-panel__state">
        <q-icon name="schedule" size="24px" aria-hidden="true" />
        <span>The witness schedule is unavailable right now.</span>
      </q-card-section>

      <template v-else>
        <q-card-section class="dw-round__current" role="group" aria-label="Current block producer">
          <div class="dw-round__current-main">
            <span class="dw-round__label">Current producer</span>
            <span class="dw-round__producer">
              <router-link
                v-if="summary.currentWitness"
                :to="'/@' + summary.currentWitness"
                class="dw-round__producer-link"
              >@{{ summary.currentWitness }}</router-link>
              <span v-else>Unknown</span>
              <span v-if="isAccount(summary.currentWitness)" class="dw-round__you">You</span>
            </span>
          </div>
          <div class="dw-round__progress-wrap">
            <span class="dw-round__progress-label">{{ summary.position }} / {{ summary.roundSize }}</span>
            <div
              class="dw-round__progress"
              role="progressbar"
              aria-label="Witness round progress"
              aria-valuemin="0"
              :aria-valuemax="summary.roundSize"
              :aria-valuenow="summary.position"
            >
              <span :style="{ width: progressPercent + '%' }"></span>
            </div>
          </div>
        </q-card-section>

        <q-card-section v-if="summary.accountInRound && summary.accountNext" class="dw-round__account" role="status">
          Your witness signs {{ inBlocksLabel(summary.accountNext.inBlocks) }}.
        </q-card-section>

        <q-card-section class="dw-round__list-wrap">
          <div class="dw-round__section-head">
            <h3 class="dw-round__section-title">Up next</h3>
            <span class="dw-round__section-hint">slot · in blocks</span>
          </div>
          <ol v-if="upcoming.length" class="dw-round__list" aria-label="Upcoming block producers">
            <li
              v-for="row in upcoming"
              :key="row.slot + '-' + row.name"
              :class="{ 'is-account': isAccount(row.name) }"
            >
              <span class="dw-round__slot" :title="'Slot ' + (row.slot + 1)">{{ row.slot + 1 }}</span>
              <router-link :to="'/@' + row.name" class="dw-round__name">@{{ row.name }}</router-link>
              <span v-if="missedLabel(row.name)" class="dw-round__missed">{{ missedLabel(row.name) }}</span>
              <span class="dw-round__eta">{{ inBlocksLabel(row.inBlocks) }}</span>
              <span v-if="isAccount(row.name)" class="dw-round__you">You</span>
            </li>
          </ol>
          <p v-else class="dw-round__empty">No upcoming producers are available for this round.</p>
        </q-card-section>
      </template>

      <q-card-section class="home-panel__footer dw-round__footer">
        <router-link to="/witnesses">All witnesses</router-link>
        <q-btn
          flat
          dense
          round
          icon="refresh"
          aria-label="Refresh witness round"
          title="Refresh witness round"
          :loading="loading"
          @click="load({ force: true })"
        />
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-round__badge {
  flex: none;
  padding: 0.16rem 0.5rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-link) 10%, transparent);
  color: var(--c-link-soft);
  font-size: 0.64rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.dw-round__notice {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin: 0;
  padding: 0.45rem 1rem 0;
  color: var(--c-warning-soft);
  font-size: 0.7rem;
  line-height: 1.4;
}

.dw-round__current {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.7rem;
  flex-wrap: wrap;
  padding: 0.7rem 1rem 0.35rem;
}

.dw-round__current-main {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.dw-round__label {
  color: var(--c-text-subtle);
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-round__producer {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  flex-wrap: wrap;
  color: var(--c-text);
  font-size: 0.95rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.dw-round__producer-link {
  color: var(--c-link);
  text-decoration: none;
}

.dw-round__producer-link:hover {
  color: var(--c-link-hover);
  text-decoration: underline;
}

.dw-round__progress-wrap {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.2rem;
  min-width: 6rem;
}

.dw-round__progress-label {
  color: var(--c-text-subtle);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}

.dw-round__progress {
  overflow: hidden;
  width: 7rem;
  max-width: 100%;
  height: 5px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 8%, transparent);
}

.dw-round__progress > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--c-link);
}

.dw-round__account {
  margin: 0;
  padding: 0.35rem 1rem 0;
  color: var(--c-link-soft);
  font-size: 0.7rem;
}

.dw-round__list-wrap {
  padding: 0.5rem 1rem 0;
}

.dw-round__section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
}

.dw-round__section-title {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-round__section-hint {
  color: var(--c-text-faint);
  font-size: 0.62rem;
}

.dw-round__list {
  margin: 0.2rem 0 0;
  padding: 0;
  list-style: none;
}

.dw-round__list li {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0.34rem 0.35rem;
  border-top: 1px solid var(--border-subtle);
}

.dw-round__list li:first-child {
  border-top: 0;
}

.dw-round__list li.is-account {
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-link) 8%, transparent);
}

.dw-round__slot {
  flex: none;
  width: 1.35rem;
  color: var(--c-text-faint);
  font-size: 0.64rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.dw-round__name {
  overflow: hidden;
  flex: 1;
  min-width: 0;
  color: var(--c-link);
  font-size: 0.76rem;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-round__name:hover {
  color: var(--c-link-hover);
  text-decoration: underline;
}

.dw-round__missed {
  flex: none;
  color: var(--c-warning-soft);
  font-size: 0.62rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dw-round__eta {
  flex: none;
  color: var(--c-text-subtle);
  font-size: 0.66rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dw-round__you {
  flex: none;
  padding: 0.06rem 0.35rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-link) 14%, transparent);
  color: var(--c-link-soft);
  font-size: 0.58rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.dw-round__empty {
  margin: 0.3rem 0 0;
  color: var(--c-text-faint);
  font-size: 0.72rem;
  line-height: 1.4;
}

.dw-round__footer {
  align-items: center;
}

@media (max-width: 599px) {
  .dw-round__current,
  .dw-round__list-wrap,
  .dw-round__account,
  .dw-round__notice {
    padding-left: 0.7rem;
    padding-right: 0.7rem;
  }
}

@media (max-width: 340px) {
  .dw-round__progress-wrap {
    align-items: flex-start;
    width: 100%;
  }

  .dw-round__progress {
    width: 100%;
  }

  .dw-round__missed {
    display: none;
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { fetchGlobalProps, fetchWitnessesByVote } from 'src/services/chainData'
import { witnessRoundSummary } from 'src/services/witnessRound'

export default {
  name: 'WidgetWitnessRound',
  components: { DashboardWidgetState },
  props: {
    account: { type: String, default: '' },
    limit: { type: Number, default: 5 }
  },
  data () {
    return {
      schedule: null,
      globalProps: null,
      witnesses: [],
      loading: true,
      loaded: false,
      loadError: '',
      updatedAt: 0,
      requestToken: 0
    }
  },
  computed: {
    displayLimit () {
      const value = Number(this.limit)
      if (!Number.isFinite(value)) return 5
      return Math.max(0, Math.floor(value))
    },
    summary () {
      return witnessRoundSummary({
        schedule: this.schedule,
        globalProps: this.globalProps,
        witnesses: this.witnesses,
        account: this.account,
        // `next` includes the current producer as its first row; ask for one
        // extra so the rendered "up next" list still has `limit` entries.
        limit: this.displayLimit + 1,
        now: this.updatedAt || Date.now()
      })
    },
    upcoming () {
      return this.summary.next
        .filter(row => !row.current)
        .slice(0, this.displayLimit)
    },
    progressPercent () {
      const size = Number(this.summary.roundSize)
      if (!Number.isFinite(size) || size <= 0) return 0
      return Math.min(100, Math.max(0, (Number(this.summary.position) / size) * 100))
    },
    normalizedAccount () {
      return String(this.account || '').replace(/^@/, '').trim().toLowerCase()
    },
    viewState () {
      if (this.loading && this.loaded) return this.loadError ? 'stale' : 'ready'
      if (this.loading) return 'loading'
      if (this.loadError) return this.loaded ? 'stale' : 'error'
      return this.loaded ? 'ready' : 'loading'
    },
    stateError () {
      return this.loadError || 'Could not load the witness round right now.'
    },
    staleNotice () {
      return this.loaded ? this.loadError : ''
    }
  },
  mounted () {
    this.load()
  },
  methods: {
    isAccount (name) {
      if (!this.normalizedAccount) return false
      return String(name || '').toLowerCase() === this.normalizedAccount
    },
    inBlocksLabel (value) {
      const blocks = Number(value)
      if (!Number.isFinite(blocks) || blocks <= 0) return 'now'
      if (blocks === 1) return 'next block'
      return 'in ' + blocks.toLocaleString('en-US') + ' blocks'
    },
    missedLabel (name) {
      const key = String(name || '')
      if (!key) return ''
      const map = this.summary.missedById
      if (!Object.prototype.hasOwnProperty.call(map, key)) return ''
      return map[key].toLocaleString('en-US') + ' missed'
    },
    async load ({ force = true } = {}) {
      const token = ++this.requestToken
      this.loading = true
      this.loadError = ''

      const [scheduleResult, propsResult, witnessesResult] = await Promise.allSettled([
        this.$hive.api.callAsync('condenser_api.get_witness_schedule', []),
        fetchGlobalProps({ force }),
        fetchWitnessesByVote(200, { force })
      ])
      if (token !== this.requestToken) return

      let scheduleFailed = false
      let propsFailed = false

      const nextSchedule = scheduleResult.status === 'fulfilled' ? scheduleResult.value : null
      const nextShuffled = Array.isArray(nextSchedule?.current_shuffled_witnesses)
        ? nextSchedule.current_shuffled_witnesses
        : []
      if (nextShuffled.length > 0) {
        this.schedule = nextSchedule
      } else {
        scheduleFailed = true
        console.error(
          'Failed to load the witness schedule',
          scheduleResult.reason || 'empty shuffled schedule'
        )
      }

      if (propsResult.status === 'fulfilled' && propsResult.value && !propsResult.value.empty) {
        this.globalProps = propsResult.value
      } else {
        propsFailed = true
        console.error('Failed to load global properties for the witness round', propsResult.reason)
      }

      if (witnessesResult.status === 'fulfilled' && Array.isArray(witnessesResult.value)) {
        // Optional: missed-block counts only decorate the schedule.
        this.witnesses = witnessesResult.value
      } else {
        console.error('Failed to load witness records for missed block counts', witnessesResult.reason)
      }

      const shuffled = Array.isArray(this.schedule?.current_shuffled_witnesses)
        ? this.schedule.current_shuffled_witnesses
        : []
      this.loaded = shuffled.length > 0 && Boolean(this.globalProps)

      if (scheduleFailed || propsFailed) {
        this.loadError = this.loaded
          ? 'Witness round refresh failed — showing the last good schedule.'
          : 'Could not load the witness round right now.'
      } else if (!this.loaded) {
        this.loadError = 'The witness schedule is unavailable right now.'
      } else {
        this.updatedAt = Date.now()
      }

      this.loading = false
    }
  }
}
</script>
