<template>
  <q-card flat bordered class="home-card home-panel home-market">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Markets</div>
        <h2 class="home-panel__title">Coin prices</h2>
      </div>
      <div class="home-panel__actions">
        <q-btn flat dense round icon="tune" aria-label="Customise coins and currency" title="Customise coins and currency" @click="openSettings" />
        <q-btn flat dense round icon="refresh" aria-label="Refresh prices" title="Refresh prices" :loading="refreshing" @click="loadPrices" />
        <router-link to="/markets" class="home-panel__link">Markets</router-link>
      </div>
    </q-card-section>

    <q-dialog v-model="settingsOpen">
      <q-card class="home-market-settings">
        <q-card-section class="home-market-settings__head">
          <div>
            <div class="home-eyebrow">Customise</div>
            <div class="home-panel__title">Coins &amp; currency</div>
          </div>
          <q-btn flat dense round icon="close" aria-label="Close" v-close-popup />
        </q-card-section>

        <q-card-section class="home-market-settings__body">
          <div class="home-market-settings__label">Quote currency</div>
          <q-select
            v-model="draftCurrency"
            :options="currencyOptions"
            emit-value
            map-options
            dense
            outlined
            options-dense
            aria-label="Quote currency"
          />
          <div v-if="draftIsForex" class="home-market-settings__note">
            Priced in USD and converted to {{ draftCurrency.toUpperCase() }} using the current forex rate.
          </div>

          <div class="home-market-settings__label">
            Coins
            <span class="home-market-settings__hint">{{ draftCoinIds.length }}/{{ maxCoins }}</span>
          </div>
          <div class="home-market-settings__coins">
            <q-toggle
              v-for="coin in coinChoices"
              :key="coin.id"
              :model-value="draftCoinIds.includes(coin.id)"
              :label="coin.symbol + ' · ' + coin.name"
              :disable="draftCoinIds.includes(coin.id) && draftCoinIds.length <= minCoins"
              dense
              class="home-market-settings__coin"
              @update:model-value="toggleDraftCoin(coin.id)"
            />
          </div>
        </q-card-section>

        <q-card-actions align="right" class="home-market-settings__actions">
          <q-btn flat no-caps label="Reset" @click="resetDraft" />
          <q-btn color="primary" no-caps label="Save" @click="saveSettings" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <div v-if="staleAt" class="home-panel__notice">
      <data-notice
        variant="stale"
        :message="offline ? 'Offline — showing saved prices.' : 'Price refresh failed — showing saved prices.'"
        :updated-at="staleAt"
        action-label="Retry"
        @action="loadPrices"
      />
    </div>

    <q-card-section v-if="loading && coins.length === 0" class="home-panel__body">
      <div v-for="i in 4" :key="i" class="home-market-skeleton">
        <q-skeleton type="circle" size="26px" />
        <div class="home-market-skeleton__body">
          <q-skeleton type="text" width="35%" />
          <q-skeleton type="text" width="22%" />
        </div>
        <q-skeleton type="text" width="60px" />
      </div>
    </q-card-section>

    <q-card-section v-else-if="error && coins.length === 0" class="home-panel__state">
      <q-icon name="cloud_off" size="24px" color="orange" aria-hidden="true" />
      <span>Price data unavailable.</span>
      <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="loadPrices" />
    </q-card-section>

    <template v-else>
      <div class="home-market-list">
        <component
          :is="coin.to ? 'router-link' : 'a'"
          v-for="coin in rows"
          :key="coin.id"
          v-bind="coin.linkProps"
          class="home-market-row"
          :class="{ 'home-market-row--hive': coin.isHive }"
          :title="coin.title"
          :aria-label="coin.ariaLabel"
        >
          <q-avatar size="28px">
            <q-img :src="coin.image" :alt="coin.name + ' logo'" />
          </q-avatar>
          <div class="home-market-row__name">
            <span class="home-market-row__symbol">{{ coin.symbol }}</span>
            <span class="home-market-row__coin">{{ coin.name }}</span>
          </div>
          <sparkline
            v-if="coin.sparkline"
            :data="coin.sparkline"
            :width="64"
            :height="22"
            :stroke="coin.stroke"
            fill="none"
            class="home-market-row__spark"
          />
          <div class="home-market-row__quote">
            <span class="home-market-row__price">{{ coin.price }}</span>
            <span class="home-market-row__change" :class="coin.changeClass">{{ coin.change }}</span>
          </div>
          <q-icon
            :name="coin.to ? 'chevron_right' : 'open_in_new'"
            size="14px"
            class="home-market-row__external"
            aria-hidden="true"
          />
        </component>
      </div>

      <div v-if="error" class="home-market__error">
        <q-icon name="warning" size="14px" color="orange" aria-hidden="true" />
        Last refresh failed.
        <q-btn flat dense no-caps color="primary" label="Retry" @click="loadPrices" />
      </div>

      <q-card-section class="home-panel__footer home-market__footer">
        <span class="home-market__footer-links">
          <router-link to="/market">Internal market</router-link>
          <router-link to="/markets#hbd-tools">HBD peg</router-link>
          <span>24h change · {{ currency.toUpperCase() }}<template v-if="isForex"> (via USD)</template></span>
        </span>
        <span>via CoinGecko<span v-if="updatedLabel"> · {{ updatedLabel }}</span></span>
      </q-card-section>
    </template>
  </q-card>
</template>

<style scoped>
.home-market-list {
  display: flex;
  flex-direction: column;
}

.home-market-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.58rem 1rem;
  border-top: 1px solid var(--border-subtle);
  color: inherit;
  text-decoration: none;
}

.home-market-row:visited {
  color: inherit;
}

.home-market-row:first-child {
  border-top: 0;
}

.home-market-row:hover {
  background: rgba(255, 255, 255, 0.035);
}

.home-market-row__name {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.home-market-row__symbol {
  color: #e4eaed;
  font-size: 0.82rem;
  font-weight: 600;
}

.home-market-row--hive .home-market-row__symbol {
  color: #81d4fa;
}

.home-market-row__coin {
  overflow: hidden;
  color: #78909c;
  font-size: 0.68rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-market-row__spark {
  flex: none;
  opacity: 0.9;
}

.home-market-row__quote {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.05rem;
  min-width: 76px;
}

.home-market-row__price {
  color: #e4eaed;
  font-size: 0.82rem;
  font-weight: 600;
}

.home-market-row__change {
  font-size: 0.68rem;
  font-weight: 600;
}

.home-market-row__external {
  flex: none;
  color: #607d8b;
}

.home-market__error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  flex-wrap: wrap;
  padding: 0.35rem 0.8rem;
  color: #ffb74d;
  font-size: 0.72rem;
}

.home-market__footer-links {
  display: flex;
  align-items: center;
  gap: 0.25rem 0.8rem;
  flex-wrap: wrap;
}

.home-market-settings {
  width: min(420px, 92vw);
}

.home-market-settings__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.home-market-settings__body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.home-market-settings__label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 0.35rem;
  color: #b0bec5;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.home-market-settings__hint {
  color: #78909c;
  font-weight: 500;
}

.home-market-settings__note {
  color: #78909c;
  font-size: 0.7rem;
  line-height: 1.3;
}

.home-market-settings__coins {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  max-height: 46vh;
  overflow-y: auto;
}

.home-market-settings__coin {
  justify-content: flex-start;
}

.home-market-settings__actions {
  padding: 0.35rem 0.75rem 0.6rem;
}

.home-market-skeleton {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.55rem 0;
}

.home-market-skeleton__body {
  flex: 1;
}

.is-up {
  color: #66bb6a;
}

.is-down {
  color: #ef5350;
}

.is-flat {
  color: #90a4ae;
}

@media (max-width: 599px) {
  .home-market-row {
    padding: 0.55rem 0.8rem;
  }

  .home-market-row__external {
    display: none;
  }
}
</style>

<script>
import moment from 'src/utils/time'
import Sparkline from 'components/Sparkline.vue'
import {
  changeClass,
  formatMoney,
  formatPercent,
  sortMarketCoins
} from 'src/services/home'
import DataNotice from 'components/ui/DataNotice.vue'
import { loadSnapshot, saveSnapshot } from 'src/services/snapshots'
import {
  HOME_MARKET_COIN_CHOICES,
  HOME_MARKET_CURRENCIES,
  MAX_HOME_MARKET_COINS,
  MIN_HOME_MARKET_COINS,
  buildMarketUrl,
  convertCoinPrices,
  currencySymbol,
  defaultHomeMarketPrefs,
  homeMarketSnapshotKey,
  isForexCurrency,
  loadForexRate,
  loadHomeMarketPrefs,
  orderCoinIds,
  saveHomeMarketPrefs,
  toggleCoinId
} from 'src/services/homeMarket'

const MARKET_LINKS = {
  hive: {
    to: '/markets?pair=BINANCE:HIVEUSDT',
    title: 'Open the HIVE price chart, HBD peg and HIVE/HBD converter'
  },
  hive_dollar: {
    to: '/markets#hbd-tools',
    title: 'Open HBD peg, savings APR and the HIVE/HBD converter'
  }
}

export default {
  name: 'homeMarketCard',
  components: { Sparkline, DataNotice },
  data () {
    const prefs = loadHomeMarketPrefs()
    return {
      coins: [],
      loading: true,
      refreshing: false,
      error: '',
      updatedAt: null,
      staleAt: null,
      coinIds: prefs.coinIds,
      currency: prefs.currency,
      settingsOpen: false,
      draftCoinIds: [...prefs.coinIds],
      draftCurrency: prefs.currency,
      coinChoices: HOME_MARKET_COIN_CHOICES,
      maxCoins: MAX_HOME_MARKET_COINS,
      minCoins: MIN_HOME_MARKET_COINS
    }
  },
  computed: {
    offline () {
      return this.$online ? !this.$online.online : (typeof navigator !== 'undefined' && navigator.onLine === false)
    },
    currencyOptions () {
      return HOME_MARKET_CURRENCIES.map(entry => ({
        value: entry.id,
        label: entry.name + ' (' + entry.symbol + ')'
      }))
    },
    symbol () {
      return currencySymbol(this.currency)
    },
    isForex () {
      return isForexCurrency(this.currency)
    },
    draftIsForex () {
      return isForexCurrency(this.draftCurrency)
    },
    rows () {
      return sortMarketCoins(this.coins, this.coinIds).map(coin => {
        const change = Number(coin.price_change_percentage_24h)
        const marketLink = MARKET_LINKS[coin.id]
        const priceLabel = formatMoney(coin.current_price, this.symbol)
        const changeLabel = formatPercent(change)
        const baseAria = coin.name + ' price ' + priceLabel + ', 24 hour change ' + changeLabel

        return {
          id: coin.id,
          symbol: String(coin.symbol || '').toUpperCase(),
          name: coin.name,
          image: coin.image,
          isHive: coin.id === 'hive' || coin.id === 'hive_dollar',
          price: priceLabel,
          change: changeLabel,
          changeClass: changeClass(change),
          sparkline: coin.sparkline_in_7d && coin.sparkline_in_7d.price,
          stroke: change < 0 ? '#ef5350' : '#66bb6a',
          to: marketLink?.to || '',
          linkProps: marketLink?.to
            ? { to: marketLink.to }
            : {
                href: 'https://www.coingecko.com/en/coins/' + coin.id,
                target: '_blank',
                rel: 'noopener noreferrer'
              },
          title: marketLink?.title || coin.name + ' · market cap ' + formatMoney(coin.market_cap, this.symbol) + ' · 24h volume ' + formatMoney(coin.total_volume, this.symbol),
          ariaLabel: marketLink?.to ? baseAria + '. ' + marketLink.title : baseAria
        }
      })
    },
    updatedLabel () {
      return this.updatedAt ? moment.utc(this.updatedAt).fromNow() : ''
    }
  },
  mounted () {
    this.loadPrices()
  },
  methods: {
    prefs () {
      return { coinIds: this.coinIds, currency: this.currency }
    },
    openSettings () {
      this.draftCoinIds = [...this.coinIds]
      this.draftCurrency = this.currency
      this.settingsOpen = true
    },
    toggleDraftCoin (id) {
      this.draftCoinIds = toggleCoinId(this.draftCoinIds, id)
    },
    resetDraft () {
      const defaults = defaultHomeMarketPrefs()
      this.draftCoinIds = defaults.coinIds
      this.draftCurrency = defaults.currency
    },
    async saveSettings () {
      this.coinIds = orderCoinIds(this.draftCoinIds)
      this.currency = this.draftCurrency
      saveHomeMarketPrefs(this.prefs())
      this.settingsOpen = false
      // The previous mix is no longer relevant, so start from a clean slate.
      this.coins = []
      this.updatedAt = null
      this.staleAt = null
      await this.loadPrices()
    },
    async loadPrices () {
      const hasCoins = this.coins.length > 0
      if (hasCoins) this.refreshing = true
      else this.loading = true
      this.error = ''

      const snapshotKey = homeMarketSnapshotKey(this.prefs())

      try {
        const [response, forex] = await Promise.all([
          fetch(buildMarketUrl(this.prefs())),
          this.isForex ? loadForexRate(this.currency) : Promise.resolve(null)
        ])
        if (!response.ok) throw new Error('HTTP ' + response.status)
        const data = await response.json()
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('Empty price response')
        }
        const coins = this.isForex ? convertCoinPrices(data, forex) : data
        this.coins = coins
        this.updatedAt = Date.now()
        this.staleAt = null
        saveSnapshot(snapshotKey, { coins, updatedAt: this.updatedAt, forexRate: forex || null })
      } catch (error) {
        console.error('Failed to load home prices', error)
        if (this.coins.length) {
          this.staleAt = this.updatedAt || Date.now()
          this.error = 'Price data unavailable.'
        } else if (!this.restoreSnapshot()) {
          this.error = 'Price data unavailable.'
        }
      } finally {
        this.loading = false
        this.refreshing = false
      }
    },
    restoreSnapshot () {
      const snapshot = loadSnapshot(homeMarketSnapshotKey(this.prefs()))
      const data = snapshot?.data
      if (!Array.isArray(data?.coins) || !data.coins.length) return false
      this.coins = data.coins
      this.updatedAt = Number(data.updatedAt) || snapshot.savedAt
      this.staleAt = this.updatedAt
      this.error = ''
      return true
    }
  }
}
</script>
