<template>
  <q-card flat bordered class="home-card home-panel">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Governance</div>
        <h2 class="home-panel__title">Top witnesses</h2>
      </div>
      <router-link to="/witnesses" class="home-panel__link">View all</router-link>
    </q-card-section>

    <div v-if="staleAt" class="home-panel__notice">
      <data-notice
        variant="stale"
        :message="offline ? 'Offline — showing saved witness data.' : 'Witness refresh failed — showing saved data.'"
        :updated-at="staleAt"
        action-label="Retry"
        @action="loadWitnesses"
      />
    </div>

    <q-card-section v-if="loading" class="home-panel__body">
      <div v-for="i in skeletonRows" :key="i" class="home-witness-skeleton">
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
      <div
        v-for="row in rows"
        :key="row.owner"
        class="home-witness"
        :class="{ 'home-witness--pinned': row.pinned, 'home-witness--mine': row.highlighted }"
      >
        <span class="home-witness__rank">{{ row.rank }}</span>
        <router-link :to="'/@' + row.owner" class="home-witness__avatar" :aria-label="'View @' + row.owner + ' profile'">
          <q-avatar size="28px">
            <q-img :src="avatarUrl(row.owner)" :alt="'Avatar of @' + row.owner" />
          </q-avatar>
        </router-link>
        <div class="home-witness__body">
          <router-link :to="'/@' + row.owner" class="home-witness__name">
            @{{ row.owner }}
            <span v-if="row.pinned" class="home-witness__tag">You</span>
          </router-link>
          <div class="home-witness__meta">
            <span>{{ row.hp }}</span>
            <span aria-hidden="true">·</span>
            <span>v{{ row.version }}</span>
          </div>
        </div>
        <q-icon
          v-if="showHealth"
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

.home-witness__tag {
  margin-left: 0.3rem;
  padding: 0.02rem 0.35rem;
  border-radius: var(--radius-pill);
  background: rgba(79, 195, 247, 0.16);
  color: #81d4fa;
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  vertical-align: middle;
}

.home-witness--pinned {
  border-radius: var(--radius-sm);
  background: rgba(79, 195, 247, 0.06);
}

.home-witness--mine {
  box-shadow: inset 2px 0 0 #4fc3f7;
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
import DataNotice from 'components/ui/DataNotice.vue'
import { loadSnapshot, saveSnapshot } from 'src/services/snapshots'

// The card fetches the full ranked list so `limit`/`pinMine` can select from it;
// the cached response is shared with the witnesses page.
const WITNESS_LIST_SIZE = 200

// Keyed by the original page, kept so switching the limit never serves a
// snapshot with a different set of rows.
const SNAPSHOT_KEY = 'home:witnesses'

export default {
  name: 'homeWitnessCard',
  components: { DataNotice },
  props: {
    // How many witnesses to list (the signed-in user's own witness is shown in
    // addition to these when `pinMine` is set).
    limit: { type: Number, default: 6 },
    // Keep your own witness at the top even when it is outside the limit.
    pinMine: { type: Boolean, default: false },
    // Outline one account's row (e.g. the user's witness on the dashboard).
    highlight: { type: String, default: '' },
    // Show the signing/price-feed health icon per row.
    showHealth: { type: Boolean, default: true }
  },
  data () {
    return {
      witnesses: [],
      globalProps: null,
      hardforkVersion: '',
      loading: true,
      error: '',
      staleAt: null
    }
  },
  computed: {
    offline () {
      return this.$online ? !this.$online.online : (typeof navigator !== 'undefined' && navigator.onLine === false)
    },
    signedInUser () {
      return this.$hiveStore.user.username || ''
    },
    skeletonRows () {
      return Math.max(1, Math.min(this.limit, 12))
    },
    rows () {
      const mineName = this.mineName()
      const mapped = this.witnesses.map((witness, index) => {
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
          warning,
          pinned: false,
          highlighted: Boolean(mineName) && witness.owner === mineName
        }
      })

      const pinned = this.pinMine && mineName ? mapped.find(row => row.owner === mineName) : null
      const rest = mapped.filter(row => row !== pinned)
      const size = Math.max(1, Math.min(rest.length, Number(this.limit) || 6))
      if (pinned) pinned.pinned = true
      return pinned ? [pinned, ...rest.slice(0, size)] : rest.slice(0, size)
    }
  },
  mounted () {
    this.loadWitnesses()
  },
  methods: {
    mineName () {
      return String(this.highlight || this.signedInUser || '').replace(/^@/, '')
    },
    avatarUrl (user) {
      return 'https://images.hive.blog/u/' + user + '/avatar'
    },
    async loadWitnesses () {
      this.loading = true
      this.error = ''
      try {
        const [witnesses, props, hardfork] = await Promise.all([
          fetchWitnessesByVote(WITNESS_LIST_SIZE),
          fetchGlobalProps(),
          this.$hive.api.getHardforkVersionAsync().catch(() => '')
        ])
        this.witnesses = Array.isArray(witnesses) ? witnesses : []
        this.globalProps = props
        this.hardforkVersion = hardfork || ''
        this.staleAt = null
        saveSnapshot(SNAPSHOT_KEY, {
          witnesses: this.witnesses,
          globalProps: this.globalProps,
          hardforkVersion: this.hardforkVersion
        })
      } catch (error) {
        console.error('Failed to load home witnesses', error)
        if (this.witnesses.length) {
          this.staleAt = this.staleAt || Date.now()
        } else if (!this.restoreSnapshot()) {
          this.error = 'Could not load witnesses.'
        }
      } finally {
        this.loading = false
      }
    },
    restoreSnapshot () {
      const snapshot = loadSnapshot(SNAPSHOT_KEY)
      const data = snapshot?.data
      if (!Array.isArray(data?.witnesses) || !data.witnesses.length) return false
      this.witnesses = data.witnesses
      this.globalProps = data.globalProps || null
      this.hardforkVersion = data.hardforkVersion || ''
      this.staleAt = snapshot.savedAt
      this.error = ''
      return true
    }
  }
}
</script>
