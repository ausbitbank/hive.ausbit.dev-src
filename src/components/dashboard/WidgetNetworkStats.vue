<template>
  <div class="dw-network">
    <q-card-section v-if="loading && !stats" class="dw-network__grid">
      <q-skeleton v-for="i in 4" :key="i" type="rect" height="52px" />
    </q-card-section>

    <q-card-section v-else-if="loadError && !stats" class="home-panel__state">
      <q-icon name="cloud_off" size="22px" color="orange" aria-hidden="true" />
      <span>{{ loadError }}</span>
      <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="reload" />
    </q-card-section>

    <template v-else-if="stats">
      <div class="dw-network__grid">
        <div class="dw-network__stat">
          <span class="dw-network__label">Head block</span>
          <router-link v-if="stats.headBlock" :to="'/b/' + stats.headBlock" class="dw-network__value">
            {{ formatCount(stats.headBlock) }}
          </router-link>
          <span v-else class="dw-network__value">—</span>
        </div>
        <div class="dw-network__stat">
          <span class="dw-network__label">Witness participation</span>
          <span class="dw-network__value">{{ stats.participationLabel }}</span>
          <span class="dw-network__hint">{{ stats.participationStatus }}</span>
        </div>
        <div class="dw-network__stat">
          <span class="dw-network__label">Staked HIVE</span>
          <span class="dw-network__value">{{ formatCount(stats.stakedHive) }} HP</span>
          <span class="dw-network__hint">{{ formatCount(stats.hiveSupply) }} HIVE supply</span>
        </div>
        <div class="dw-network__stat">
          <span class="dw-network__label">HBD debt ratio</span>
          <span class="dw-network__value">{{ stats.debtLabel }}</span>
          <span class="dw-network__hint">soft 20% · hard 30%</span>
        </div>
      </div>

      <q-card-section class="home-panel__footer">
        <span>{{ stats.hbdSavingsApr }}% HBD savings APR</span>
        <router-link to="/health">Network health</router-link>
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-network__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.4rem;
  padding: 0.7rem 1rem 0.2rem;
}

.dw-network__stat {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.025);
}

.dw-network__label {
  color: #90a4ae;
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-network__value {
  color: #e4eaed;
  font-size: 0.92rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-decoration: none;
}

a.dw-network__value:hover {
  color: #81d4fa;
}

.dw-network__hint {
  color: #78909c;
  font-size: 0.66rem;
  text-transform: capitalize;
}

@media (max-width: 799px) {
  .dw-network__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

<script>
import { fetchGlobalProps, fetchMedianHistoryPrice } from 'src/services/chainData'
import { formatCount, medianPrice } from 'src/services/network'
import { networkStats } from 'src/services/dashboardWidgets'
import { loadSnapshot, saveSnapshot } from 'src/services/snapshots'

const SNAPSHOT_KEY = 'home:network-stats'

export default {
  name: 'WidgetNetworkStats',
  data () {
    return {
      stats: null,
      loading: true,
      loadError: ''
    }
  },
  mounted () {
    this.reload()
  },
  methods: {
    formatCount,
    async reload () {
      this.loading = true
      this.loadError = ''
      try {
        const [props, median] = await Promise.all([
          fetchGlobalProps({ force: true }),
          fetchMedianHistoryPrice().catch(() => null)
        ])
        if (!props || props.empty) throw new Error('Global properties unavailable')
        this.stats = networkStats(props, { medianHiveUsd: medianPrice(median).hiveUsd })
        saveSnapshot(SNAPSHOT_KEY, { props, median, savedAt: Date.now() })
      } catch (error) {
        console.error('Failed to load network stats', error)
        if (this.stats) {
          this.loadError = 'Refresh failed — showing the last good numbers.'
        } else if (!this.restoreSnapshot()) {
          this.loadError = 'Network stats are unavailable right now.'
        }
      } finally {
        this.loading = false
      }
    },
    restoreSnapshot () {
      const snapshot = loadSnapshot(SNAPSHOT_KEY)
      const data = snapshot?.data
      if (!data?.props) return false
      this.stats = networkStats(data.props, { medianHiveUsd: medianPrice(data.median).hiveUsd })
      this.loadError = 'Showing saved network stats.'
      return true
    }
  }
}
</script>
