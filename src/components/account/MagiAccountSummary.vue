<template>
  <q-card flat bordered class="account-card magi-account">
    <q-card-section>
      <div class="account-card__head">
        <div>
          <div class="account-card__eyebrow">Sidechain</div>
          <h2 class="account-card__title account-card__title--small">Magi Network</h2>
        </div>
        <q-btn flat dense round icon="refresh" aria-label="Refresh Magi account details" title="Refresh Magi account details" :loading="loading" @click="load(true)" />
      </div>

      <div v-if="loading && !details" class="magi-account__state">
        <q-skeleton type="text" width="55%" />
        <q-skeleton type="text" width="80%" />
        <q-skeleton type="text" width="65%" />
      </div>

      <div v-else-if="error" class="magi-account__state">
        <q-icon name="cloud_off" size="18px" aria-hidden="true" />
        <span>{{ error }}</span>
        <q-btn flat dense no-caps color="primary" label="Retry" @click="load(true)" />
      </div>

      <template v-else-if="details">
        <div class="magi-account__rc">
          <div class="magi-account__rc-head">
            <span>Magi resource credits</span>
            <strong>{{ rcLabel }}</strong>
          </div>
          <q-linear-progress dark rounded size="7px" :value="rcPercent / 100" color="primary" aria-label="Magi resource credits" />
          <small>{{ rcPercent }}% available</small>
        </div>

        <dl class="magi-account__stats">
          <div>
            <dt>Nonce</dt>
            <dd>{{ details.nonce }}<small>next {{ details.nonce + 1 }}</small></dd>
          </div>
          <div>
            <dt>Node mode</dt>
            <dd>{{ details.delegationMode || 'Not a node' }}</dd>
          </div>
          <div>
            <dt>Consensus stake</dt>
            <dd>{{ formatAmount(details.witnessStake) }}<small>HIVE</small></dd>
          </div>
        </dl>

        <div class="magi-account__links">
          <router-link :to="walletLink">Wallet Magi balances</router-link>
          <router-link to="/magi">Magi contracts</router-link>
          <router-link to="/nodes?network=magi">Magi nodes</router-link>
        </div>
      </template>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.magi-account__state {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-direction: column;
  padding: 0.35rem 0;
  color: #78909c;
  font-size: 0.74rem;
  text-align: center;
}

.magi-account__rc {
  margin-top: 0.55rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.magi-account__rc-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.magi-account__rc-head span {
  color: #90a4ae;
  font-size: 0.66rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.magi-account__rc-head strong {
  color: #e4eaed;
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.magi-account__rc small {
  display: block;
  margin-top: 0.25rem;
  color: #78909c;
  font-size: 0.66rem;
}

.magi-account__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
  margin: 0.55rem 0 0;
}

.magi-account__stats > div {
  min-width: 0;
  padding: 0.45rem 0.5rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.magi-account__stats dt {
  color: #90a4ae;
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.magi-account__stats dd {
  margin: 0.1rem 0 0;
  color: #e4eaed;
  font-size: 0.78rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.magi-account__stats dd small {
  display: block;
  color: #78909c;
  font-size: 0.62rem;
  font-weight: 400;
}

.magi-account__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.7rem;
  margin-top: 0.55rem;
  padding-top: 0.45rem;
  border-top: 1px solid var(--border-subtle);
  font-size: 0.72rem;
  font-weight: 600;
}

.magi-account__links a {
  color: #4fc3f7;
  text-decoration: none;
}

.magi-account__links a:hover {
  text-decoration: underline;
}

@media (max-width: 599px) {
  .magi-account__stats {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<script>
import { fetchMagiAccountDetails } from 'src/services/magi'

export default {
  name: 'MagiAccountSummary',
  props: {
    username: { type: String, required: true }
  },
  data () {
    return {
      details: null,
      loading: false,
      error: ''
    }
  },
  computed: {
    walletLink () {
      return '/@' + this.username + '/wallet#magi'
    },
    rcLabel () {
      if (!this.details) return '—'
      return this.formatCompact(this.details.rc.amount) + ' / ' + this.formatCompact(this.details.rc.max)
    },
    rcPercent () {
      const rc = this.details?.rc
      if (!rc?.max) return 0
      return Math.max(0, Math.min(100, Math.round((Number(rc.amount) / Number(rc.max)) * 100)))
    }
  },
  watch: {
    username () {
      this.details = null
      this.load()
    }
  },
  mounted () {
    this.load()
  },
  methods: {
    formatCompact (value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '—'
      return number.toLocaleString('en-US', { maximumFractionDigits: 0 })
    },
    formatAmount (value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '—'
      return number.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    },
    async load (force = false) {
      if (!this.username || this.loading) return
      this.loading = true
      this.error = ''
      try {
        this.details = await fetchMagiAccountDetails(this.username, { force })
      } catch {
        this.details = null
        this.error = 'Magi Network is unavailable for this account.'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>
