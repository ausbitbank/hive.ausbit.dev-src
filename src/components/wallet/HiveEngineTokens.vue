<template>
  <q-card flat bordered class="wallet-card wallet-tokens">
    <q-card-section class="wallet-card__head">
      <div>
        <div class="wallet-eyebrow">Sidechain</div>
        <h2 :id="headingId" class="wallet-card__title">Hive-Engine tokens</h2>
      </div>
      <div class="wallet-tokens__actions">
        <q-checkbox v-model="filterSmall" dense label="Hide dust" class="wallet-tokens__filter" />
        <q-btn flat round dense icon="settings" aria-label="Change Hive-Engine value filter" title="Change value filter">
          <q-popup-proxy>
            <q-card flat bordered class="wallet-tokens__filter-card">
              <div class="wallet-tokens__filter-title">Hide tokens below</div>
              <q-input v-model.number="filterUsd" type="number" dense outlined suffix="USD" aria-label="Minimum Hive-Engine token value in USD" />
            </q-card>
          </q-popup-proxy>
        </q-btn>
        <q-btn flat round dense icon="refresh" aria-label="Refresh Hive-Engine data" title="Refresh Hive-Engine data" :loading="loading" @click="init()" />
      </div>
    </q-card-section>

    <q-banner v-if="error" class="wallet-tokens__banner" rounded>
      <template #avatar><q-icon name="cloud_off" aria-hidden="true" /></template>
      {{ error }}
      <template #action><q-btn flat no-caps color="primary" label="Retry" @click="init()" /></template>
    </q-banner>

    <div v-else-if="loading && balances === null" class="wallet-tokens__state" aria-label="Loading Hive-Engine balances">
      <q-spinner-puff color="primary" size="2em" />
      <span>Loading Hive-Engine balances…</span>
    </div>

    <div v-else-if="balances && balances.length === 0" class="wallet-tokens__state">
      <q-icon name="inbox" size="1.5em" aria-hidden="true" />
      <span>No Hive-Engine token balances were found for this account.</span>
    </div>

    <template v-else>
      <div v-if="filteredBalances.length === 0" class="wallet-tokens__state">
        <q-icon name="filter_alt" size="1.5em" aria-hidden="true" />
        <span>Every token is below the {{ filterUsd }} USD display filter.</span>
      </div>

      <ul v-else class="wallet-token-list">
        <li v-for="token in filteredBalances" :key="token.symbol" class="wallet-token">
          <div class="wallet-token__identity">
            <q-avatar size="28px" class="wallet-token__avatar">
              <img v-if="tokenMeta(token.symbol).icon" :src="tokenMeta(token.symbol).icon" alt="" aria-hidden="true" />
              <span v-else>{{ token.symbol.slice(0, 2) }}</span>
            </q-avatar>
            <div class="wallet-token__name">
              <q-btn flat dense no-caps :label="token.symbol" :title="'About ' + token.symbol" class="wallet-token__symbol">
                <q-popup-proxy>
                  <q-card flat bordered class="wallet-token__info">
                    <q-card-section class="wallet-token__info-head">
                      <q-avatar size="40px">
                        <img v-if="tokenMeta(token.symbol).icon" :src="tokenMeta(token.symbol).icon" alt="" aria-hidden="true" />
                      </q-avatar>
                      <strong>{{ token.symbol }}</strong>
                      <span>{{ tokenMeta(token.symbol).desc }}</span>
                    </q-card-section>
                    <q-card-section class="wallet-token__info-body">
                      <div><span>Issued by</span><router-link :to="'/@' + tokenInfo(token.symbol).issuer">{{ tokenInfo(token.symbol).issuer }}</router-link></div>
                      <div><span>Supply</span><strong>{{ tidyNumber(tokenInfo(token.symbol).supply) }}</strong></div>
                      <div><span>Max supply</span><strong>{{ tidyNumber(tokenInfo(token.symbol).maxSupply) }}</strong></div>
                      <div><span>Circulating</span><strong>{{ tidyNumber(tokenInfo(token.symbol).circulatingSupply) }}</strong></div>
                      <div><span>Total staked</span><strong>{{ tidyNumber(tokenInfo(token.symbol).totalStaked) }}</strong></div>
                    </q-card-section>
                  </q-card>
                </q-popup-proxy>
              </q-btn>
              <span class="wallet-token__hint">{{ tokenMeta(token.symbol).desc }}</span>
            </div>
          </div>

          <div class="wallet-token__amounts">
            <div v-if="toNumber(token.balance) > 0"><span>Liquid</span><strong>{{ tidyAmount(token.balance) }}</strong></div>
            <div v-if="toNumber(token.stake) > 0"><span>Staked</span><strong>{{ tidyAmount(token.stake) }}</strong></div>
            <div v-if="toNumber(token.pendingUnstake) > 0"><span>Unstaking</span><strong>{{ tidyAmount(token.pendingUnstake) }}</strong></div>
            <div v-if="toNumber(token.delegationsIn) > 0"><span>Delegated in</span><strong>{{ tidyAmount(token.delegationsIn) }}</strong></div>
            <div v-if="toNumber(token.delegationsOut) > 0"><span>Delegated out</span><strong>{{ tidyAmount(token.delegationsOut) }}</strong></div>
            <div v-if="toNumber(token.pendingUndelegations) > 0"><span>Undelegating</span><strong>{{ tidyAmount(token.pendingUndelegations) }}</strong></div>
          </div>

          <div class="wallet-token__value">
            <strong>{{ formatUsd(tokenUsdValue(token)) }}</strong>
            <span v-if="token.symbol !== 'SWAP.HIVE' && priceChange(token.symbol) !== null" :class="priceChange(token.symbol) >= 0 ? 'is-up' : 'is-down'">
              <q-icon :name="priceChange(token.symbol) >= 0 ? 'arrow_upward' : 'arrow_downward'" aria-hidden="true" />
              {{ Math.abs(priceChange(token.symbol)).toFixed(2) }}%
            </span>
          </div>

          <div v-if="loggedIn" class="wallet-token__actions">
            <q-btn
              v-if="toNumber(token.balance) > 0"
              flat
              dense
              round
              icon="send"
              color="primary"
              aria-label="Transfer token"
              title="Transfer token"
              @click="openTransfer(token)"
            />
            <q-btn flat dense round icon="more_horiz" aria-label="More token actions" title="More token actions">
              <q-menu>
                <q-list bordered separator role="group" style="min-width: 210px">
                  <q-item v-if="toNumber(token.balance) > 0" clickable @click="openTransfer(token)">
                    <q-item-section avatar><q-icon name="send" /></q-item-section>
                    <q-item-section>Transfer</q-item-section>
                  </q-item>
                  <q-item v-if="toNumber(token.balance) > 0 && stakingEnabled(token.symbol)" clickable @click="openStake(token)">
                    <q-item-section avatar><q-icon name="lock" /></q-item-section>
                    <q-item-section>Stake</q-item-section>
                  </q-item>
                  <q-item v-if="toNumber(token.stake) > 0 && stakingEnabled(token.symbol)" clickable @click="openUnstake(token)">
                    <q-item-section avatar><q-icon name="lock_open" /></q-item-section>
                    <q-item-section>Unstake</q-item-section>
                  </q-item>
                  <q-item v-if="token.symbol !== 'SWAP.HIVE'" clickable @click="$router.push(getTokenLink(token.symbol))">
                    <q-item-section avatar><q-icon name="store" /></q-item-section>
                    <q-item-section>Market</q-item-section>
                  </q-item>
                  <q-item v-if="token.symbol !== 'SWAP.HIVE'" clickable @click="openExternal('https://tribaldex.com/trade/' + token.symbol)">
                    <q-item-section avatar><q-icon name="open_in_new" /></q-item-section>
                    <q-item-section>TribalDex.com</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </div>
        </li>
      </ul>

      <q-expansion-item
        dense
        dense-toggle
        expand-separator
        icon="history"
        :label="historyLoaded ? history.length + ' Hive-Engine transactions' : 'Hive-Engine transactions'"
        class="wallet-tokens__history"
        @show="ensureHistory"
      >
        <q-scroll-area style="height: 430px">
          <div v-if="historyLoading" class="wallet-token-history wallet-token-history--state">
            <q-spinner-puff size="1.8em" color="primary" aria-label="Loading Hive-Engine transactions" />
          </div>
          <p v-else-if="historyLoaded && history.length === 0" class="wallet-token-history wallet-token-history--state">
            No Hive-Engine transactions were returned for this account.
          </p>
          <ul v-else class="wallet-token-history">
            <li v-for="(tx, index) in history" :key="tx.transactionId || index" class="wallet-he-tx">
              <q-icon :name="heView(tx).icon" class="wallet-he-tx__icon" aria-hidden="true" />
              <div class="wallet-he-tx__main">
                <div class="wallet-he-tx__title">
                  <span>{{ heView(tx).label }}</span>
                  <router-link v-if="heView(tx).counterparty" :to="'/@' + heView(tx).counterparty">{{ heView(tx).counterparty }}</router-link>
                </div>
                <div class="wallet-he-tx__meta">
                  <time :datetime="tx.timestamp">{{ heTime(tx.timestamp) }}</time>
                  <template v-if="heTransactionLink(tx)">
                    <span aria-hidden="true">·</span>
                    <router-link :to="heTransactionLink(tx)">tx {{ heTransactionLink(tx).slice(4, 12) }}</router-link>
                  </template>
                </div>
                <div v-if="heView(tx).memo" class="wallet-he-tx__memo">
                  <q-icon name="comment" aria-hidden="true" />
                  <span :title="heView(tx).memo">{{ heMemoPreview(heView(tx).memo) }}</span>
                </div>
              </div>
              <div class="wallet-he-tx__amount">
                <div v-for="(part, partIndex) in heView(tx).parts" :key="partIndex" :class="part.sign === '+' ? 'is-in' : part.sign === '-' ? 'is-out' : ''">
                  {{ part.sign === '+' ? '+ ' : part.sign === '-' ? '− ' : '' }}{{ part.text }}
                </div>
                <small v-if="heView(tx).usd !== null">≈ {{ formatUsd(heView(tx).usd) }}</small>
              </div>
            </li>
          </ul>
        </q-scroll-area>
      </q-expansion-item>
    </template>

    <q-dialog v-model="transferDialog">
      <transfer-dialog :tokenName="dialogToken" network="hiveEngine" :balance="dialogBalance" :username="username" />
    </q-dialog>
    <q-dialog v-model="stakeDialog">
      <staking-dialog :tokenName="dialogToken" network="hiveEngine" :balance="dialogBalance" :username="username" />
    </q-dialog>
    <q-dialog v-model="unstakeDialog">
      <unstaking-dialog
        :tokenName="dialogToken"
        :stake="dialogStake"
        :transactions="dialogTransactions"
        :cooldown="dialogCooldown"
        :unstaking="dialogUnstaking"
        :username="username"
      />
    </q-dialog>
  </q-card>
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

.wallet-tokens__actions {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.wallet-tokens__filter {
  font-size: 0.78rem;
}

.wallet-tokens__filter-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: min(240px, 88vw);
  padding: 0.75rem;
}

.wallet-tokens__filter-title {
  font-weight: 600;
}

.wallet-tokens__banner {
  margin: 0.65rem;
  background: color-mix(in srgb, var(--c-negative) 12%, transparent);
  color: var(--c-negative);
}

.wallet-tokens__state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 1.4rem 1rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  text-align: center;
}

.wallet-token-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.wallet-token {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.85rem;
  border-top: 1px solid var(--border-subtle);
}

.wallet-token:first-child {
  border-top: 0;
}

.wallet-token__identity {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  flex: 1 1 200px;
}

.wallet-token__avatar {
  flex: none;
  border: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--c-text) 4%, transparent);
  font-size: 0.62rem;
  font-weight: 600;
}

.wallet-token__name {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.wallet-token__symbol {
  align-self: flex-start;
  min-height: 20px;
  padding: 0;
  font-weight: 600;
}

.wallet-token__hint {
  max-width: 100%;
  color: var(--c-text-faint);
  font-size: 0.66rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wallet-token__amounts {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
  flex: 1 1 230px;
}

.wallet-token__amounts > div {
  display: flex;
  flex-direction: column;
}

.wallet-token__amounts span {
  color: var(--c-text-faint);
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.wallet-token__amounts strong {
  color: var(--c-text);
  font-size: 0.8rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.wallet-token__value {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
}

.wallet-token__value strong {
  color: var(--c-text);
  font-size: 0.82rem;
}

.wallet-token__value span {
  display: inline-flex;
  align-items: center;
  gap: 0.1rem;
  font-size: 0.66rem;
}

.wallet-token__value .is-up {
  color: var(--c-positive);
}

.wallet-token__value .is-down {
  color: var(--c-negative);
}

.wallet-token__actions {
  display: flex;
  align-items: center;
  gap: 0.1rem;
}

.wallet-token__info {
  width: min(340px, 90vw);
}

.wallet-token__info-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.wallet-token__info-head span {
  flex-basis: 100%;
  color: var(--c-text-subtle);
  font-size: 0.72rem;
}

.wallet-token__info-body {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.76rem;
}

.wallet-token__info-body > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.wallet-token__info-body span {
  color: var(--c-text-subtle);
}

.wallet-tokens__history {
  border-top: 1px solid var(--border-subtle);
}

.wallet-token-history {
  margin: 0;
  padding: 0;
  list-style: none;
}

.wallet-token-history--state {
  display: grid;
  place-items: center;
  min-height: 120px;
  padding: 1rem;
  color: var(--c-text-subtle);
  text-align: center;
}

.wallet-he-tx {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  border-top: 1px solid var(--border-subtle);
}

.wallet-he-tx:first-child {
  border-top: 0;
}

.wallet-he-tx__icon {
  flex: none;
  margin-top: 0.15rem;
  color: var(--c-text-subtle);
}

.wallet-he-tx__main {
  flex: 1;
  min-width: 0;
}

.wallet-he-tx__title {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
  color: var(--c-text-soft);
  font-size: 0.8rem;
}

.wallet-he-tx__title a {
  color: var(--c-link);
  text-decoration: none;
}

.wallet-he-tx__title a:hover {
  text-decoration: underline;
}

.wallet-he-tx__meta {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
  color: var(--c-text-faint);
  font-size: 0.66rem;
}

.wallet-he-tx__meta a {
  color: var(--c-link);
  text-decoration: none;
}

.wallet-he-tx__memo {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--c-text-subtle);
  font-size: 0.7rem;
}

.wallet-he-tx__memo span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: min(46ch, 100%);
}

.wallet-he-tx__amount {
  flex: none;
  text-align: right;
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.35;
}

.wallet-he-tx__amount .is-in {
  color: var(--c-positive);
}

.wallet-he-tx__amount .is-out {
  color: var(--c-negative);
}

.wallet-he-tx__amount small {
  display: block;
  color: var(--c-text-faint);
  font-size: 0.64rem;
  font-weight: 400;
}

@media (max-width: 699px) {
  .wallet-token {
    flex-wrap: wrap;
    padding: 0.5rem 0.65rem;
  }

  .wallet-token__identity {
    flex-basis: calc(100% - 90px);
  }

  .wallet-token__amounts {
    flex-basis: 100%;
    gap: 0.5rem 0.8rem;
  }

  .wallet-token__value {
    flex-direction: row;
    align-items: baseline;
    gap: 0.3rem;
  }

  .wallet-token__actions {
    margin-left: auto;
  }

  .wallet-card__head {
    padding-left: 0.8rem;
    padding-right: 0.8rem;
  }

  .wallet-he-tx__amount {
    max-width: 44%;
  }

  .wallet-he-tx__memo span {
    max-width: 100%;
  }
}
</style>

<script>
import { defineAsyncComponent } from 'vue'
import moment from 'src/utils/time'
import { openURL } from 'quasar'
import { getHiveEngine } from 'src/services/hiveEngine'
import { formatUsd, tidyAmount, tidyNumber, toNumber } from 'src/services/wallet'

const PREFERRED_TOKENS = ['SWAP.HIVE', 'PAL', 'PALMM', 'LEO', 'LEOMM', 'CCC', 'STEM']

export default {
  name: 'HiveEngineTokens',
  components: {
    transferDialog: defineAsyncComponent(() => import('components/transferDialog.vue')),
    stakingDialog: defineAsyncComponent(() => import('components/stakingDialog.vue')),
    unstakingDialog: defineAsyncComponent(() => import('components/unstakingDialog.vue'))
  },
  props: {
    headingId: { type: String, default: 'wallet-tokens-title' },
    username: { type: String, required: true },
    loggedIn: { type: Boolean, default: false },
    hivePriceUsd: { type: Number, default: 0 }
  },
  data () {
    return {
      balances: null,
      tokenInfo: [],
      marketInfo: [],
      history: [],
      historyLoading: false,
      historyLoaded: false,
      error: null,
      loading: false,
      filterSmall: true,
      filterUsd: 1,
      transferDialog: false,
      stakeDialog: false,
      unstakeDialog: false,
      dialogToken: '',
      dialogBalance: null,
      dialogStake: null,
      dialogTransactions: null,
      dialogCooldown: null,
      dialogUnstaking: null
    }
  },
  computed: {
    filteredBalances () {
      if (!this.balances) return []
      const tokens = this.filterSmall
        ? this.balances.filter(token => this.tokenUsdValue(token) >= this.filterUsd)
        : this.balances
      return [...tokens].sort((a, b) => {
        const aIndex = PREFERRED_TOKENS.indexOf(a.symbol)
        const bIndex = PREFERRED_TOKENS.indexOf(b.symbol)
        if (aIndex === -1 && bIndex === -1) return 0
        if (aIndex === -1) return 1
        if (bIndex === -1) return -1
        return aIndex - bIndex
      })
    }
  },
  watch: {
    username () {
      this.history = []
      this.historyLoaded = false
      this.historyLoading = false
      this.init()
    }
  },
  methods: {
    toNumber,
    tidyNumber,
    tidyAmount,
    formatUsd,
    init () {
      this.fetchBalances()
    },
    ensureHistory () {
      if (this.historyLoaded || this.historyLoading) return
      this.fetchHistory()
    },
    async fetchBalances () {
      this.error = null
      this.loading = true
      this.balances = null
      try {
        const balances = await getHiveEngine().find('tokens', 'balances', { account: this.username }, 1000, 0, [])
        this.balances = Array.isArray(balances) ? balances : []
        await Promise.all([this.fetchTokenInfo(), this.fetchMarketInfo()])
      } catch {
        this.error = 'Hive-Engine balances are unavailable right now.'
      } finally {
        this.loading = false
      }
    },
    async fetchTokenInfo () {
      const symbols = (this.balances || []).map(token => token.symbol)
      if (!symbols.length) {
        this.tokenInfo = []
        return
      }
      try {
        const response = await getHiveEngine().find('tokens', 'tokens', { symbol: { $in: symbols } }, 1000, 0, [])
        this.tokenInfo = Array.isArray(response) ? response : []
      } catch {
        this.tokenInfo = []
      }
    },
    async fetchMarketInfo () {
      const symbols = (this.balances || []).map(token => token.symbol)
      if (!symbols.length) {
        this.marketInfo = []
        return
      }
      try {
        const response = await getHiveEngine().find('market', 'metrics', { symbol: { $in: symbols } }, 1000, 0, [])
        this.marketInfo = Array.isArray(response) ? response : []
      } catch {
        this.marketInfo = []
      }
    },
    async fetchHistory () {
      this.historyLoading = true
      try {
        const response = await fetch('https://history.hive-engine.com/accountHistory?account=' + this.username + '&limit=250&offset=0&type=user')
        if (!response.ok) throw new Error('HTTP ' + response.status)
        const data = await response.json()
        this.history = Array.isArray(data) ? data : []
      } catch {
        this.history = []
      } finally {
        this.historyLoading = false
        this.historyLoaded = true
      }
    },
    tokenInfoFor (symbol) {
      return (this.tokenInfo || []).find(token => token.symbol === symbol) || {}
    },
    tokenMeta (symbol) {
      const info = this.tokenInfoFor(symbol)
      let metadata = info.metadata
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata)
        } catch {
          metadata = {}
        }
      }
      metadata = metadata || {}
      return {
        icon: typeof metadata.icon === 'string' ? metadata.icon : '',
        desc: typeof metadata.desc === 'string' ? metadata.desc : ''
      }
    },
    stakingEnabled (symbol) {
      return this.tokenInfoFor(symbol).stakingEnabled === true
    },
    priceHive (symbol) {
      if (symbol === 'SWAP.HIVE') return 1
      const market = (this.marketInfo || []).find(item => item.symbol === symbol)
      return market ? toNumber(market.lastPrice) : null
    },
    priceChange (symbol) {
      if (symbol === 'SWAP.HIVE') return null
      const market = (this.marketInfo || []).find(item => item.symbol === symbol)
      return market && market.priceChangePercent !== undefined ? toNumber(market.priceChangePercent) : null
    },
    tokenPriceUsd (symbol) {
      const price = this.priceHive(symbol)
      return price === null ? null : price * this.hivePriceUsd
    },
    tokenUsdValue (token) {
      const price = this.tokenPriceUsd(token.symbol)
      if (price === null) return 0
      return price * (toNumber(token.balance) + toNumber(token.stake))
    },
    getTokenLink (symbol) {
      return '/@' + this.username + '/wallet/' + symbol
    },
    openExternal (url) {
      openURL(url, null, { noopener: true, menubar: true, toolbar: true, noreferrer: true })
    },
    openTransfer (token) {
      this.dialogToken = token.symbol
      this.dialogBalance = toNumber(token.balance)
      this.transferDialog = true
    },
    openStake (token) {
      this.dialogToken = token.symbol
      this.dialogBalance = toNumber(token.balance)
      this.stakeDialog = true
    },
    openUnstake (token) {
      this.dialogToken = token.symbol
      this.dialogStake = toNumber(token.stake)
      this.dialogUnstaking = toNumber(token.pendingUnstake)
      this.dialogCooldown = this.tokenInfoFor(token.symbol).unstakingCooldown
      this.dialogTransactions = this.tokenInfoFor(token.symbol).numberTransactions
      this.unstakeDialog = true
    },
    heTime (timestamp) {
      return timestamp ? moment.unix(timestamp).format('D MMM YYYY, HH:mm') : ''
    },
    heTransactionLink (tx) {
      if (!tx.transactionId) return ''
      const id = String(tx.transactionId).split('-')[0]
      return id ? '/tx/' + id : ''
    },
    heMemoPreview (memo) {
      return memo.length > 90 ? memo.slice(0, 90) + '…' : memo
    },
    heView (tx) {
      const view = {
        icon: 'receipt_long',
        label: String(tx.operation || '').replace(/_/g, ' '),
        counterparty: '',
        memo: typeof tx.memo === 'string' ? tx.memo : '',
        parts: [],
        usd: null
      }
      const addPart = (amount, token, sign) => {
        if (amount === undefined || amount === null || amount === '') return
        view.parts.push({ text: tidyAmount(amount + ' ' + token), sign })
      }
      const addUsd = (amount, token) => {
        const price = this.tokenPriceUsd(token)
        if (price !== null && Number.isFinite(price)) view.usd = (view.usd || 0) + toNumber(amount) * price
      }

      switch (tx.operation) {
        case 'tokens_transfer': {
          const incoming = tx.to === this.username
          view.icon = incoming ? 'add_circle' : 'remove_circle'
          view.label = incoming ? 'Received' : 'Sent'
          view.counterparty = incoming ? tx.from : tx.to
          addPart(tx.quantity, tx.symbol, incoming ? '+' : '-')
          addUsd(tx.quantity, tx.symbol)
          break
        }
        case 'tokens_stake': {
          const incoming = tx.to === this.username
          view.icon = 'arrow_circle_up'
          view.label = incoming ? 'Staked' : 'Staked for'
          view.counterparty = tx.to || ''
          addPart(tx.quantity, tx.symbol, incoming ? '+' : '-')
          addUsd(tx.quantity, tx.symbol)
          break
        }
        case 'tokens_unstake':
          view.icon = 'arrow_circle_down'
          view.label = 'Unstaked'
          view.counterparty = tx.account || ''
          addPart(tx.quantity, tx.symbol, '+')
          break
        case 'tokens_issue': {
          const incoming = tx.to === this.username
          view.icon = 'stars'
          view.label = incoming ? 'Issued' : 'Issued for'
          view.counterparty = incoming ? tx.from : tx.to
          addPart(tx.quantity, tx.symbol, incoming ? '+' : '-')
          addUsd(tx.quantity, tx.symbol)
          break
        }
        case 'mining_lottery':
          view.icon = 'casino'
          view.label = 'Mined'
          view.counterparty = tx.poolId || ''
          addPart(tx.quantity, tx.symbol, '+')
          addUsd(tx.quantity, tx.symbol)
          break
        case 'market_placeOrder': {
          view.icon = 'gavel'
          const sell = tx.orderType === 'sell'
          view.label = 'Market ' + tx.orderType + ' order'
          view.counterparty = tx.account || ''
          addPart(tx.quantityLocked, tx.symbol, sell ? '-' : '+')
          addUsd(tx.quantityLocked, tx.symbol)
          if (tx.price) view.label += ' · ' + tx.price + ' HIVE each'
          break
        }
        case 'market_expire':
          view.icon = 'gavel'
          view.label = 'Expired ' + tx.orderType + ' order'
          view.counterparty = tx.account || ''
          addPart(tx.quantityUnlocked, tx.symbol, '+')
          break
        case 'market_closeOrder':
        case 'market_cancel':
          view.icon = 'gavel'
          view.label = 'Cancelled ' + tx.orderType + ' order'
          view.counterparty = tx.account || ''
          break
        case 'market_buy':
          view.icon = 'gavel'
          view.label = 'Market buy'
          view.counterparty = tx.from || ''
          addPart(tx.quantityTokens, tx.symbol, '+')
          addUsd(tx.quantityTokens, tx.symbol)
          break
        case 'market_sell':
          view.icon = 'gavel'
          view.label = 'Market sell'
          view.counterparty = tx.to || ''
          addPart(tx.quantityTokens, tx.symbol, '-')
          addUsd(tx.quantityTokens, tx.symbol)
          break
        case 'hivepegged_buy':
          view.icon = 'savings'
          view.label = 'Deposited HIVE'
          view.counterparty = tx.from || ''
          addPart(tx.quantity, tx.symbol, '+')
          break
        case 'hivepegged_withdraw':
          view.icon = 'savings'
          view.label = 'Withdrew HIVE'
          view.counterparty = tx.to || ''
          addPart(tx.quantity, tx.symbol, '-')
          break
        case 'witnesses_proposeRound':
          view.icon = 'how_to_vote'
          view.label = 'Witness round'
          view.counterparty = tx.to || ''
          addPart(tx.quantity, tx.symbol, '+')
          break
      }
      return view
    }
  },
  mounted () {
    this.init()
  }
}
</script>
