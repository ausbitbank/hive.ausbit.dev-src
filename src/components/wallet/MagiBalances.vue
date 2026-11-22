<template>
  <section v-if="hasAssets" id="magi" class="wallet-section" aria-labelledby="wallet-magi-title">
    <q-card flat bordered class="wallet-card wallet-magi">
      <q-card-section class="wallet-card__head">
        <div>
          <div class="wallet-eyebrow">Sidechain</div>
          <h2 id="wallet-magi-title" class="wallet-card__title">Magi Network</h2>
        </div>
        <div class="wallet-magi__actions">
          <q-btn flat dense no-caps color="primary" icon="code" label="Contracts" to="/magi" />
          <q-btn
            flat
            dense
            no-caps
            color="primary"
            icon="open_in_new"
            label="Altera"
            href="https://alterawallet.com"
            target="_blank"
            rel="noopener noreferrer"
          />
          <q-btn flat round dense icon="refresh" aria-label="Refresh Magi balances" title="Refresh Magi balances" :loading="loading" @click="load" />
        </div>
      </q-card-section>

      <p class="wallet-magi__intro">
        HIVE, HBD and standard magi_token balances held on Magi (formerly VSC).
        These are separate from your Hive wallet and are used by Magi apps and contracts.
      </p>

      <q-banner v-if="error" class="wallet-magi__banner" rounded>
        <template #avatar><q-icon name="cloud_off" aria-hidden="true" /></template>
        {{ error }}
        <template #action><q-btn flat no-caps color="primary" label="Retry" @click="load" /></template>
      </q-banner>

      <div v-else-if="loading && !balances" class="wallet-magi__state" aria-label="Loading Magi balances">
        <q-spinner-puff color="primary" size="2em" />
        <span>Reading Magi Network balances…</span>
      </div>

      <template v-else-if="balances">
        <div class="wallet-magi__summary">
          <span>Magi portfolio value</span>
          <strong>{{ formatUsd(totalUsd) }}</strong>
        </div>

        <div class="wallet-magi__grid">
          <div v-for="row in rows" :key="row.id" class="wallet-magi__cell">
            <span>{{ row.label }}</span>
            <strong>{{ row.amount }}</strong>
            <small>{{ formatUsd(row.usd) }}</small>
          </div>
          <template v-if="details">
            <div class="wallet-magi__cell">
              <span>Magi RC</span>
              <strong>{{ rcLabel }}</strong>
              <small>{{ rcPercent }}% available</small>
            </div>
            <div class="wallet-magi__cell">
              <span>Nonce</span>
              <strong>{{ details.nonce }}</strong>
              <small>next tx {{ details.nonce + 1 }}</small>
            </div>
            <div class="wallet-magi__cell">
              <span>Node mode</span>
              <strong>{{ details.delegationMode || 'Not a node' }}</strong>
              <small>{{ witnessStakeLabel }}</small>
            </div>
          </template>
        </div>

        <div class="wallet-magi__subsection">
          <div class="wallet-magi__subhead">
            <span>Consensus delegation</span>
          </div>
          <q-input
            v-model.trim="delegationNode"
            label="Check delegation to node"
            placeholder="techcoderx.vsc"
            dense
            outlined
            :loading="delegationLoading"
            aria-label="Magi node account to check delegation"
            class="wallet-magi__delegation-input"
            @keyup.enter="checkDelegation"
          >
            <template #append>
              <q-btn flat round dense icon="search" aria-label="Check Magi delegation" @click="checkDelegation" />
            </template>
          </q-input>
          <div v-if="delegation" class="wallet-magi__delegation-result">
            To <strong>{{ delegation.to }}</strong>: {{ amount(delegation.delegated) }} HIVE delegated,
            {{ amount(delegation.claimable) }} HIVE claimable now.
          </div>
          <div v-else-if="delegationError" class="wallet-magi__delegation-error">{{ delegationError }}</div>
        </div>

        <div v-if="tokens.length || tokensError" class="wallet-magi__subsection">
          <div class="wallet-magi__subhead">
            <span>Magi tokens</span>
            <small v-if="tokens.length">{{ tokens.length }} token{{ tokens.length === 1 ? '' : 's' }}</small>
          </div>
          <div v-if="tokensError" class="wallet-magi__tokens-error">{{ tokensError }}</div>
          <ul v-else class="wallet-magi-token-list">
            <li v-for="token in tokens" :key="token.contractId" class="wallet-magi-token">
              <q-avatar size="28px" class="wallet-magi-token__avatar">
                <span>{{ token.symbol.slice(0, 2) }}</span>
              </q-avatar>
              <div class="wallet-magi-token__name">
                <a
                  :href="tokenExplorerUrl(token.contractId)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="wallet-magi-token__symbol"
                  :title="'Open ' + token.symbol + ' in Magi Blocks'"
                >{{ token.symbol }}</a>
                <router-link
                  :to="{ name: 'magi', query: { contract: token.contractId } }"
                  class="wallet-magi-token__contract"
                  :title="token.contractId"
                >{{ shortContract(token.contractId) }}</router-link>
              </div>
              <span class="wallet-magi-token__amount" :title="token.raw + ' raw units'">{{ token.amountLabel }}</span>
            </li>
          </ul>
        </div>

        <div v-if="transactions.length" class="wallet-magi__subsection">
          <div class="wallet-magi__subhead">
            <span>Recent Magi activity</span>
            <small>{{ activityLabel }}</small>
          </div>
          <ul class="wallet-magi-op-list">
            <li
              v-for="entry in recentTransactions"
              :key="entry.id"
              class="wallet-magi-op"
              :class="'wallet-magi-op--' + entry.direction"
            >
              <div class="wallet-magi-op__icon" aria-hidden="true">
                <q-icon :name="entry.direction === 'out' ? 'north_east' : 'south_west'" />
              </div>
              <div class="wallet-magi-op__main">
                <div class="wallet-magi-op__title">{{ entry.label }}</div>
                <div class="wallet-magi-op__meta">
                  <time :datetime="entry.timestamp">{{ timeLabel(entry.timestamp) }}</time>
                </div>
              </div>
              <div class="wallet-magi-op__amount" :class="entry.direction === 'out' ? 'is-out' : 'is-in'">
                {{ entry.amountLabel }}
              </div>
            </li>
          </ul>
        </div>
      </template>
    </q-card>
  </section>
</template>

<style scoped>
.wallet-card {
  overflow: hidden;
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.wallet-eyebrow {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.wallet-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: 0.9rem 1rem 0.7rem;
  border-bottom: 1px solid var(--border-subtle);
}

.wallet-card__title {
  margin: 0.12rem 0 0;
  color: var(--c-text);
  font-size: 1.02rem;
  font-weight: 600;
  line-height: 1.25;
}

.wallet-magi__actions {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.wallet-magi__intro {
  max-width: 78ch;
  margin: 0.55rem 1rem 0;
  color: var(--c-text-subtle);
  font-size: 0.76rem;
  line-height: 1.45;
}

.wallet-magi__banner {
  margin: 0.65rem 1rem;
  background: color-mix(in srgb, var(--c-negative) 12%, transparent);
  color: var(--c-negative);
}

.wallet-magi__state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 1.2rem 1rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
}

.wallet-magi__summary {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin: 0.7rem 1rem 0.65rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
  color: var(--c-text-subtle);
  font-size: 0.68rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.wallet-magi__summary strong {
  color: var(--c-text);
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
  font-variant-numeric: tabular-nums;
}

.wallet-magi__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
  gap: 0.5rem;
  padding: 0 1rem 0.85rem;
}

.wallet-magi__cell {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.wallet-magi__cell span {
  color: var(--c-text-subtle);
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.wallet-magi__cell strong {
  color: var(--c-text);
  font-size: 0.92rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.wallet-magi__cell small {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  font-variant-numeric: tabular-nums;
}

.wallet-magi__subsection {
  padding: 0.2rem 1rem 0.85rem;
  border-top: 1px solid var(--border-subtle);
}

.wallet-magi__subhead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0 0.35rem;
  color: var(--c-text-subtle);
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.wallet-magi__subhead small {
  color: var(--c-text-faint);
  font-size: 0.64rem;
  letter-spacing: 0;
  text-transform: none;
}

.wallet-magi__delegation-input {
  width: 100%;
}

.wallet-magi__delegation-result,
.wallet-magi__delegation-error {
  margin-top: 0.45rem;
  padding: 0.45rem 0.55rem;
  border-radius: var(--radius-sm);
  font-size: 0.72rem;
  line-height: 1.45;
}

.wallet-magi__delegation-result {
  border: 1px solid color-mix(in srgb, var(--c-positive) 35%, transparent);
  background: color-mix(in srgb, var(--c-positive) 8%, transparent);
  color: var(--c-positive);
}

.wallet-magi__delegation-error,
.wallet-magi__tokens-error {
  border: 1px solid color-mix(in srgb, var(--c-warning) 35%, transparent);
  background: color-mix(in srgb, var(--c-warning) 8%, transparent);
  color: var(--c-warning-soft);
}

.wallet-magi__tokens-error {
  padding: 0.45rem 0.55rem;
  border-radius: var(--radius-sm);
  font-size: 0.72rem;
  line-height: 1.45;
}

.wallet-magi-token-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.wallet-magi-token {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.25rem;
  border-top: 1px solid var(--border-subtle);
}

.wallet-magi-token:first-child {
  border-top: 0;
}

.wallet-magi-token__avatar {
  flex: none;
  border: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--c-text) 4%, transparent);
  font-size: 0.62rem;
  font-weight: 600;
}

.wallet-magi-token__name {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.wallet-magi-token__symbol {
  overflow: hidden;
  color: var(--c-text-soft);
  font-size: 0.84rem;
  font-weight: 600;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wallet-magi-token__symbol:hover {
  color: var(--c-link-hover);
  text-decoration: underline;
}

.wallet-magi-token__contract {
  color: var(--c-text-faint);
  font-family: monospace;
  font-size: 0.64rem;
  text-decoration: none;
}

.wallet-magi-token__contract:hover {
  color: var(--c-link);
  text-decoration: underline;
}

.wallet-magi-token__amount {
  flex: none;
  color: var(--c-positive);
  font-size: 0.86rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.wallet-magi-op-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.wallet-magi-op {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.5rem 0.25rem;
  border-top: 1px solid var(--border-subtle);
}

.wallet-magi-op:first-child {
  border-top: 0;
}

.wallet-magi-op__icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-top: 0.05rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--c-text) 4%, transparent);
  color: var(--c-text-subtle);
}

.wallet-magi-op--in .wallet-magi-op__icon {
  background: color-mix(in srgb, var(--c-positive) 12%, transparent);
  color: var(--c-positive);
}

.wallet-magi-op--out .wallet-magi-op__icon {
  background: color-mix(in srgb, var(--c-negative) 10%, transparent);
  color: var(--c-negative);
}

.wallet-magi-op__main {
  flex: 1;
  min-width: 0;
}

.wallet-magi-op__title {
  color: var(--c-text-soft);
  font-size: 0.84rem;
  line-height: 1.35;
}

.wallet-magi-op__meta {
  margin-top: 0.1rem;
  color: var(--c-text-faint);
  font-size: 0.7rem;
}

.wallet-magi-op__amount {
  flex: none;
  font-size: 0.84rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.wallet-magi-op__amount.is-in {
  color: var(--c-positive);
}

.wallet-magi-op__amount.is-out {
  color: var(--c-negative);
}

@media (max-width: 599px) {
  .wallet-card__head {
    padding-left: 0.8rem;
    padding-right: 0.8rem;
  }

  .wallet-magi__intro {
    margin-left: 0.8rem;
    margin-right: 0.8rem;
  }

  .wallet-magi__banner,
  .wallet-magi__summary {
    margin-left: 0.8rem;
    margin-right: 0.8rem;
  }

  .wallet-magi__grid {
    padding-left: 0.8rem;
    padding-right: 0.8rem;
  }

  .wallet-magi__subsection {
    padding-left: 0.8rem;
    padding-right: 0.8rem;
  }

  .wallet-magi-token,
  .wallet-magi-op {
    padding-left: 0;
    padding-right: 0;
  }
}
</style>

<script>
import moment from 'src/utils/time'
import { fetchMagiAccount, fetchMagiAccountDetails, fetchMagiDelegation, fetchMagiTokens } from 'src/services/magi'
import { formatUsd } from 'src/services/wallet'

function amount (value, digits = 3) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

export default {
  name: 'MagiBalances',
  props: {
    username: { type: String, required: true },
    loggedIn: { type: Boolean, default: false },
    hivePriceUsd: { type: Number, default: 0 },
    hbdPriceUsd: { type: Number, default: 0 }
  },
  emits: ['update:has-assets'],
  data () {
    return {
      balances: null,
      details: null,
      tokens: [],
      transactions: [],
      loading: false,
      error: '',
      tokensError: '',
      delegationNode: '',
      delegation: null,
      delegationLoading: false,
      delegationError: ''
    }
  },
  computed: {
    hasAssets () {
      if (this.tokens.length > 0) return true
      if (!this.balances) return false
      const b = this.balances
      return (b.hive + b.hbd + b.consensus + b.hbdSavings + b.unstaking + b.pendingUnstaking) > 0
    },
    hiveTotal () {
      if (!this.balances) return 0
      return this.balances.hive + this.balances.consensus + this.balances.unstaking
    },
    hbdTotal () {
      if (!this.balances) return 0
      return this.balances.hbd + this.balances.hbdSavings + this.balances.pendingUnstaking
    },
    totalUsd () {
      return this.hiveTotal * (Number(this.hivePriceUsd) || 0) +
        this.hbdTotal * (Number(this.hbdPriceUsd) || 0)
    },
    rcLabel () {
      if (!this.details) return '—'
      const rc = this.details.rc || {}
      const format = value => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
      return rc.max > 0 ? format(rc.amount) + ' / ' + format(rc.max) : format(rc.amount)
    },
    rcPercent () {
      const rc = this.details?.rc
      if (!rc?.max) return 0
      return Math.max(0, Math.min(100, Math.round((Number(rc.amount) / Number(rc.max)) * 100)))
    },
    witnessStakeLabel () {
      if (!this.details) return ''
      return this.amount(this.details.witnessStake) + ' HIVE consensus stake'
    },
    recentTransactions () {
      return this.transactions.slice(0, 5)
    },
    activityLabel () {
      const total = this.transactions.length
      const shown = this.recentTransactions.length
      if (!total) return ''
      return total > shown ? 'Latest ' + shown + ' of ' + total : total + ' loaded'
    },
    rows () {
      if (!this.balances) return []
      const rows = [
        { id: 'hive', label: 'Liquid HIVE', amount: amount(this.balances.hive) + ' HIVE', usd: this.balances.hive * this.hivePriceUsd },
        { id: 'hbd', label: 'Liquid HBD', amount: amount(this.balances.hbd) + ' HBD', usd: this.balances.hbd * this.hbdPriceUsd }
      ]
      if (this.balances.consensus > 0) {
        rows.push({ id: 'consensus', label: 'Magi staked', amount: amount(this.balances.consensus) + ' HIVE', usd: this.balances.consensus * this.hivePriceUsd })
      }
      if (this.balances.hbdSavings > 0) {
        rows.push({ id: 'savings', label: 'Magi HBD savings', amount: amount(this.balances.hbdSavings) + ' HBD', usd: this.balances.hbdSavings * this.hbdPriceUsd })
      }
      if (this.balances.unstaking > 0) {
        rows.push({ id: 'unstaking', label: 'Unstaking HIVE', amount: amount(this.balances.unstaking) + ' HIVE', usd: this.balances.unstaking * this.hivePriceUsd })
      }
      if (this.balances.pendingUnstaking > 0) {
        rows.push({ id: 'pending', label: 'Pending HBD', amount: amount(this.balances.pendingUnstaking) + ' HBD', usd: this.balances.pendingUnstaking * this.hbdPriceUsd })
      }
      return rows
    }
  },
  watch: {
    username () {
      this.balances = null
      this.details = null
      this.tokens = []
      this.transactions = []
      this.tokensError = ''
      this.delegation = null
      this.delegationError = ''
      this.load()
    },
    hasAssets (value) {
      this.$emit('update:has-assets', value)
    }
  },
  mounted () {
    this.load()
  },
  methods: {
    formatUsd,
    amount,
    timeLabel (timestamp) {
      return timestamp ? moment.utc(timestamp).fromNow() : ''
    },
    tokenExplorerUrl (contractId) {
      return 'https://vsc.techcoderx.com/token/' + encodeURIComponent(contractId)
    },
    shortContract (contractId) {
      const value = String(contractId || '')
      return value.length > 14 ? value.slice(0, 7) + '…' + value.slice(-5) : value
    },
    async checkDelegation () {
      const node = this.delegationNode.trim()
      if (!node) {
        this.delegationError = 'Enter a Magi node account to check.'
        return
      }
      this.delegationLoading = true
      this.delegationError = ''
      this.delegation = null
      try {
        const result = await fetchMagiDelegation(this.username, node, { force: true })
        if (!result) {
          this.delegationError = 'No consensus delegation found to ' + node + '.'
          return
        }
        this.delegation = result
      } catch {
        this.delegationError = 'Magi delegation lookup failed.'
      } finally {
        this.delegationLoading = false
      }
    },
    async load () {
      if (!this.username) return
      this.loading = true
      this.error = ''
      try {
        const [accountResult, detailsResult, tokensResult] = await Promise.allSettled([
          fetchMagiAccount(this.username, { limit: 10, force: true }),
          fetchMagiAccountDetails(this.username, { force: true }),
          fetchMagiTokens(this.username, { force: true })
        ])
        if (accountResult.status !== 'fulfilled') throw accountResult.reason
        const data = accountResult.value
        this.balances = data?.balances || null
        this.transactions = data?.transactions || []
        this.details = detailsResult.status === 'fulfilled' ? detailsResult.value : null
        if (tokensResult.status === 'fulfilled') {
          this.tokens = tokensResult.value?.tokens || []
          this.tokensError = ''
        } else {
          this.tokens = []
          this.tokensError = 'Magi token index is unavailable right now.'
        }
      } catch {
        this.error = 'Magi Network is unavailable right now.'
        this.balances = null
        this.details = null
        this.tokens = []
        this.tokensError = ''
        this.transactions = []
      } finally {
        this.loading = false
        this.$emit('update:has-assets', this.hasAssets)
      }
    }
  }
}
</script>
