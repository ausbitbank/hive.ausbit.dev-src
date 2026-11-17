<template>
  <q-card flat bordered class="home-card home-panel">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Governance</div>
        <h2 class="home-panel__title">Top witnesses</h2>
      </div>
      <router-link to="/witnesses" class="home-panel__link">View all</router-link>
    </q-card-section>

    <q-card-section v-if="loading" class="home-panel__body">
      <div v-for="i in 6" :key="i" class="home-witness-skeleton">
        <q-skeleton type="circle" size="28px" />
        <div class="home-witness-skeleton__body">
          <q-skeleton type="text" width="55%" />
          <q-skeleton type="text" width="35%" />
        </div>
      </div>
    </q-card-section>

    <q-card-section v-else-if="error" class="home-panel__state">
      <q-icon name="error_outline" size="22px" color="orange" aria-hidden="true" />
      <span>{{ error }}</span>
      <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="loadWitnesses" />
    </q-card-section>

    <q-card-section v-else class="home-panel__body home-witness-list">
      <div v-for="row in rows" :key="row.owner" class="home-witness">
        <span class="home-witness__rank">{{ row.rank }}</span>
        <router-link :to="'/@' + row.owner" class="home-witness__avatar" :aria-label="'View @' + row.owner + ' profile'">
          <q-avatar size="28px">
            <q-img :src="avatarUrl(row.owner)" :alt="'Avatar of @' + row.owner" />
          </q-avatar>
        </router-link>
        <div class="home-witness__body">
          <router-link :to="'/@' + row.owner" class="home-witness__name">@{{ row.owner }}</router-link>
          <div class="home-witness__meta">
            <span>{{ row.hp }}</span>
            <span aria-hidden="true">·</span>
            <span>v{{ row.version }}</span>
          </div>
        </div>
        <q-icon
          :name="row.warning ? 'warning' : 'check_circle'"
          :color="row.warning ? 'orange' : 'green'"
          size="18px"
          :title="row.warning || (row.missed ? row.missed + ' total missed blocks' : 'Witness is signing blocks and has a fresh price feed')"
          :aria-label="row.warning || 'Witness is healthy'"
        />
      </div>
    </q-card-section>

    <q-card-section class="home-panel__footer">
      <span v-if="hardforkVersion">Consensus v{{ hardforkVersion }}</span>
      <span v-else>Witness votes use active authority</span>
      <router-link to="/witnesses">Manage votes</router-link>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.home-witness-list {
  padding-top: 0.2rem;
  padding-bottom: 0.2rem;
}

.home-witness {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.48rem 0;
  border-top: 1px solid var(--border-subtle);
}

.home-witness:first-child {
  border-top: 0;
}

.home-witness__rank {
  flex: none;
  width: 1.1rem;
  color: #78909c;
  font-size: 0.72rem;
  font-weight: 600;
  text-align: center;
}

.home-witness__avatar {
  display: inline-flex;
  flex: none;
}

.home-witness__body {
  flex: 1;
  min-width: 0;
}

.home-witness__name {
  display: block;
  overflow: hidden;
  color: #e4eaed;
  font-size: 0.83rem;
  font-weight: 600;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-witness__name:hover {
  color: #81d4fa;
}

.home-witness__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.05rem;
  color: #90a4ae;
  font-size: 0.68rem;
}

.home-witness-skeleton {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0;
}

.home-witness-skeleton__body {
  flex: 1;
}
</style>

<script>
import moment from 'src/utils/time'
import { formatCompactNumber, witnessVotesHp } from 'src/services/home'
import { fetchGlobalProps, fetchWitnessesByVote } from 'src/services/chainData'

export default {
  name: 'homeWitnessCard',
  data () {
    return {
      witnesses: [],
      globalProps: null,
      hardforkVersion: '',
      loading: true,
      error: ''
    }
  },
  computed: {
    rows () {
      return this.witnesses.map((witness, index) => {
        const disabled = witness.signing_key === 'STM1111111111111111111111111111111114T1Anm'
        const stalePricefeed = moment.utc(witness.last_hbd_exchange_update).isBefore(moment.utc().subtract(24, 'hours'))
        const missed = Number(witness.total_missed) || 0
        const warning = disabled
          ? 'Signing key is disabled'
          : stalePricefeed
            ? 'Price feed is older than 24 hours'
            : ''

        return {
          rank: index + 1,
          owner: witness.owner,
          version: witness.running_version,
          hp: formatCompactNumber(witnessVotesHp(witness.votes, this.globalProps)) + ' HP',
          missed,
          warning
        }
      })
    }
  },
  mounted () {
    this.loadWitnesses()
  },
  methods: {
    avatarUrl (user) {
      return 'https://images.hive.blog/u/' + user + '/avatar'
    },
    async loadWitnesses () {
      this.loading = true
      this.error = ''
      try {
        const [witnesses, props, hardfork] = await Promise.all([
          fetchWitnessesByVote(6),
          fetchGlobalProps(),
          this.$hive.api.getHardforkVersionAsync().catch(() => '')
        ])
        this.witnesses = Array.isArray(witnesses) ? witnesses : []
        this.globalProps = props
        this.hardforkVersion = hardfork || ''
      } catch (error) {
        console.error('Failed to load home witnesses', error)
        this.error = 'Could not load witnesses.'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>
