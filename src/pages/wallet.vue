<template>
  <q-page class="wallet-page">
    <template v-if="account && globalProps">
      <account-header :globalProps="globalProps" :account="account" :showBalances="false" />

      <div class="wallet-shell">
        <wallet-portfolio-header
          :account-name="username"
          :total-usd="portfolio.totalUsd"
          :prices-ready="portfolio.pricesReady"
          :change-percent="portfolio.changePercent"
          :hive-apr="portfolio.hiveApr"
          :hbd-apr="portfolio.hbdApr"
          :logged-in="isOwner"
          :refreshing="refreshing"
          @refresh="refreshAll"
          @send-hive="transferHive = true"
          @send-hbd="transferHbd = true"
          @power-up="stakeHive = true"
          @navigate="scrollTo"
        />

        <section id="overview" class="wallet-section" aria-labelledby="wallet-assets-title">
          <div class="wallet-section__head">
            <div>
              <div class="wallet-eyebrow">Overview</div>
              <h2 id="wallet-assets-title" class="wallet-section__title">Assets</h2>
            </div>
            <span class="wallet-section__hint">Liquid, staked and saved balances</span>
          </div>

          <div class="wallet-asset-grid">
            <wallet-asset-card
              label="Liquid HIVE"
              symbol="HIVE"
              :balance="portfolio.liquidHive"
              :usd="portfolio.liquidHiveUsd"
              :prices-ready="portfolio.pricesReady"
              badge="Spendable"
              badge-color="blue-grey-8"
              hint="Available for transfers, power-ups, savings deposits and conversions."
              logoSrc="/statics/hive.svg"
              :logged-in="isOwner"
              :actions="assetActions.hive"
              @action="onAssetAction('hive', $event)"
            />
            <wallet-asset-card
              label="Staked HP"
              symbol="HP"
              :balance="portfolio.stakedHive"
              :usd="portfolio.stakedHiveUsd"
              :prices-ready="portfolio.pricesReady"
              :badge="portfolio.hiveApr !== null ? portfolio.hiveApr.toFixed(2) + '% APR' : 'Hive Power'"
              badge-color="green-9"
              :hint="'Voting power and HP rewards. Effective HP ' + tidyNumber(portfolio.effectiveHp) + '.'"
              icon="bolt"
              :logged-in="isOwner"
              :actions="assetActions.hp"
              @action="onAssetAction('hp', $event)"
            />
            <wallet-asset-card
              label="Liquid HBD"
              symbol="HBD"
              :balance="portfolio.liquidHbd"
              :usd="portfolio.liquidHbdUsd"
              :prices-ready="portfolio.pricesReady"
              badge="Spendable"
              badge-color="blue-grey-8"
              hint="Dollar-pegged HBD available for transfers, savings and conversions."
              logoSrc="/statics/hbd.svg"
              :logged-in="isOwner"
              :actions="assetActions.hbd"
              @action="onAssetAction('hbd', $event)"
            />
            <wallet-asset-card
              label="HIVE savings"
              symbol="HIVE"
              :balance="portfolio.savingsHive"
              :usd="portfolio.savingsHiveUsd"
              :prices-ready="portfolio.pricesReady"
              badge="3-day withdrawal"
              badge-color="blue-grey-8"
              hint="Held in savings. Withdrawals complete after three days."
              logoSrc="/statics/hive.svg"
              :logged-in="isOwner"
              :actions="assetActions.hiveSavings"
              @action="onAssetAction('hiveSavings', $event)"
            />
            <wallet-asset-card
              label="HBD savings"
              symbol="HBD"
              :balance="portfolio.savingsHbd"
              :usd="portfolio.savingsHbdUsd"
              :prices-ready="portfolio.pricesReady"
              :badge="portfolio.hbdApr ? portfolio.hbdApr.toFixed(2) + '% APR' : 'Savings'"
              badge-color="green-9"
              hint="Earns interest paid monthly. Withdrawals complete after three days."
              logoSrc="/statics/hbd.svg"
              :logged-in="isOwner"
              :actions="assetActions.hbdSavings"
              @action="onAssetAction('hbdSavings', $event)"
            />
          </div>

          <wallet-pending-strip
            :powerdown-hp="portfolio.powerdownHp"
            :savings-count="savingsWithdrawals.length"
            :conversion-count="conversionCount"
            :order-count="hiveInternalMarketOrders.length"
            :rewards-usd="portfolio.pendingUsd"
            :pending-interest="pendingHbdInterest"
            :claimable="pendingHbdClaim"
            @navigate="scrollTo('pending')"
          />
        </section>

        <section class="wallet-section" aria-labelledby="wallet-recent-title">
          <wallet-activity
            heading-id="wallet-recent-title"
            title="Recent activity"
            eyebrow="Latest"
            :entries="hiveTransactions"
            :username="username"
            :logged-in="isOwner"
            :global-props="globalProps"
            :hive-price-usd="hivePriceUsd"
            :hbd-price-usd="hbdPriceUsd"
            :decrypted-memos="decryptedMemos"
            :limit="5"
            :loading="historyLoading"
            @decrypt="decodeMemo"
            @navigate="scrollTo"
          />
        </section>

        <section id="activity" class="wallet-section" aria-labelledby="wallet-activity-title">
          <wallet-activity
            heading-id="wallet-activity-title"
            title="Activity"
            eyebrow="History"
            :entries="hiveTransactions"
            :username="username"
            :logged-in="isOwner"
            :global-props="globalProps"
            :hive-price-usd="hivePriceUsd"
            :hbd-price-usd="hbdPriceUsd"
            :decrypted-memos="decryptedMemos"
            filterable
            :loading="historyLoading"
            :has-more="!historyDone"
            @load="getHiveWalletTransactions"
            @decrypt="decodeMemo"
          />
        </section>

        <section id="pending" class="wallet-section" aria-labelledby="wallet-pending-title">
          <wallet-pending-panel
            heading-id="wallet-pending-title"
            :account="account"
            :username="username"
            :logged-in="isOwner"
            :global-props="globalProps"
            :hive-price-usd="hivePriceUsd"
            :hbd-price-usd="hbdPriceUsd"
            :orders="hiveInternalMarketOrders"
            :savings-withdrawals="savingsWithdrawals"
            :conversions="conversions"
            :collateralized-conversions="collateralizedConversions"
            :pending-interest="pendingHbdInterest"
            :claimable="pendingHbdClaim"
            @cancel-powerdown="unstakeHive = true"
            @cancel-savings-withdrawal="cancelSavingsWithdrawal"
            @cancel-order="cancelOrder"
            @claim-interest="claimHbdInterest"
            @refresh="refreshPending"
          />
        </section>

        <section id="tokens" class="wallet-section" aria-labelledby="wallet-tokens-title">
          <hive-engine-tokens
            heading-id="wallet-tokens-title"
            :username="username"
            :logged-in="isOwner"
            :hive-price-usd="hivePriceUsd"
          />
        </section>
      </div>

      <q-dialog v-model="transferHive">
        <transfer-dialog tokenName="HIVE" network="hive" :balance="portfolio.liquidHive" :username="username" />
      </q-dialog>
      <q-dialog v-model="transferHbd">
        <transfer-dialog tokenName="HBD" network="hive" :balance="portfolio.liquidHbd" :username="username" />
      </q-dialog>
      <q-dialog v-model="stakeHive">
        <staking-dialog tokenName="HIVE" network="hive" :balance="portfolio.liquidHive" :username="username" />
      </q-dialog>
      <q-dialog v-model="unstakeHive">
        <unstaking-dialog tokenName="HIVE" network="hive" :username="username" />
      </q-dialog>
      <q-dialog v-model="savingsVisible">
        <savings-dialog :tokenName="savingsTokenName" network="hive" :username="username" :type="savingsType" />
      </q-dialog>
      <q-dialog v-model="delegationDialogVisible">
        <delegation-dialog :username="username" tokenName="HIVE" :amountVestsSuggest="0" />
      </q-dialog>
      <q-dialog v-model="convertDialogVisible">
        <convert-dialog :username="username" :tokenName="convertTokenName" />
      </q-dialog>
    </template>

    <div v-else class="wallet-loading" aria-label="Loading wallet">
      <q-skeleton type="rect" height="150px" />
      <q-skeleton type="rect" height="120px" class="q-mt-md" />
      <q-skeleton type="rect" height="320px" class="q-mt-md" />
    </div>
  </q-page>
</template>

<style scoped>
.wallet-page {
  min-width: 0;
  padding-bottom: var(--space-6);
}

.wallet-shell {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-6);
}

.wallet-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
  scroll-margin-top: 84px;
}

.wallet-section__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.wallet-section__title {
  margin: 0.12rem 0 0;
  color: #e4eaed;
  font-size: 1.02rem;
  font-weight: 600;
  line-height: 1.25;
}

.wallet-section__hint {
  color: #78909c;
  font-size: 0.72rem;
}

.wallet-eyebrow {
  color: #78909c;
  font-size: 0.66rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.wallet-asset-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: stretch;
  gap: 0.55rem;
}

.wallet-loading {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-4);
}

@media (max-width: 1099px) {
  .wallet-asset-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 699px) {
  .wallet-asset-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 599px) {
  .wallet-shell {
    gap: var(--space-3);
    padding: var(--space-3) var(--space-2) var(--space-5);
  }

  .wallet-asset-grid {
    gap: 0.45rem;
  }

  .wallet-asset-grid > :last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }

  .wallet-section__hint {
    display: none;
  }
}
</style>

<script>
import { defineAsyncComponent } from 'vue'
import { keychain } from '@hiveio/keychain'
import { ChainTypes, makeBitMaskFilter } from '@hiveio/hive-js/lib/auth/serializer'
import moment from 'src/utils/time'
import VueTimers from 'src/mixins/timers.js'
import { getHivePrices } from 'src/services/prices'
import { buildPortfolio, tidyNumber } from 'src/services/wallet'
import { setPageMeta } from 'src/utils/pageMeta'
import WalletPortfolioHeader from 'components/wallet/WalletPortfolioHeader.vue'
import WalletAssetCard from 'components/wallet/WalletAssetCard.vue'
import WalletPendingStrip from 'components/wallet/WalletPendingStrip.vue'
import WalletPendingPanel from 'components/wallet/WalletPendingPanel.vue'
import WalletActivity from 'components/wallet/WalletActivity.vue'
import HiveEngineTokens from 'components/wallet/HiveEngineTokens.vue'

const op = ChainTypes.operations
const walletBitmask = makeBitMaskFilter([
  op.transfer,
  op.transfer_to_vesting,
  op.withdraw_vesting,
  op.interest,
  op.liquidity_reward,
  op.transfer_to_savings,
  op.transfer_from_savings,
  op.fill_transfer_from_savings,
  op.cancel_transfer_from_savings,
  op.fill_convert_request,
  op.fill_order,
  op.claim_reward_balance,
  op.convert,
  op.collateralized_convert,
  op.fill_vesting_withdraw
])

export default {
  name: 'wallet',
  components: {
    accountHeader: defineAsyncComponent(() => import('components/accountHeader.vue')),
    transferDialog: defineAsyncComponent(() => import('components/transferDialog.vue')),
    stakingDialog: defineAsyncComponent(() => import('components/stakingDialog.vue')),
    unstakingDialog: defineAsyncComponent(() => import('components/unstakingDialog.vue')),
    savingsDialog: defineAsyncComponent(() => import('components/savingsDialog.vue')),
    delegationDialog: defineAsyncComponent(() => import('components/delegationDialog.vue')),
    convertDialog: defineAsyncComponent(() => import('components/convertDialog.vue')),
    WalletPortfolioHeader,
    WalletAssetCard,
    WalletPendingStrip,
    WalletPendingPanel,
    WalletActivity,
    HiveEngineTokens
  },
  mixins: [VueTimers],
  timers: {
    refresh: { time: 60000, autostart: true, repeat: true, immediate: false, isSwitchTab: false }
  },
  data () {
    return {
      username: this.$route.params.username,
      transferHive: false,
      transferHbd: false,
      stakeHive: false,
      unstakeHive: false,
      savingsVisible: false,
      savingsType: 'deposit',
      savingsTokenName: 'HIVE',
      delegationDialogVisible: false,
      convertDialogVisible: false,
      convertTokenName: 'HIVE',
      hivePriceUsd: 0,
      hbdPriceUsd: 0,
      hivePriceUsdChange: null,
      hbdPriceUsdChange: null,
      refreshing: false,
      hiveTransactions: [],
      hiveInternalMarketOrders: [],
      savingsWithdrawals: [],
      conversions: [],
      collateralizedConversions: [],
      decryptedMemos: {},
      accountHistoryPointer: -1,
      accountHistoryLimit: 50,
      historyLoading: false,
      historyDone: false,
      bitmask: walletBitmask
    }
  },
  computed: {
    globalProps () {
      return this.$hiveStore.globalProps
    },
    account () {
      return this.$hiveStore.accounts[this.username]
    },
    loggedInUser () {
      return this.$hiveStore.user.username
    },
    isOwner () {
      return Boolean(this.loggedInUser && this.loggedInUser === this.username)
    },
    portfolio () {
      return buildPortfolio({
        account: this.account,
        globalProps: this.globalProps,
        hivePriceUsd: this.hivePriceUsd,
        hbdPriceUsd: this.hbdPriceUsd,
        hiveChange: this.hivePriceUsdChange,
        hbdChange: this.hbdPriceUsdChange
      })
    },
    conversionCount () {
      return this.conversions.length + this.collateralizedConversions.length
    },
    pendingHbdInterest () {
      if (!this.globalProps || !this.account) return 0
      const secondsInYear = 60 * 60 * 24 * 365
      const secondsSinceUpdate = moment.utc().diff(moment.utc(this.account.savings_hbd_seconds_last_update), 'seconds')
      const pendingSeconds = parseFloat(this.account.savings_hbd_balance) * parseFloat(secondsSinceUpdate)
      const secondsToPayFor = parseFloat(this.account.savings_hbd_seconds) / 1000 + pendingSeconds
      const estimatedPayout = (secondsToPayFor / secondsInYear) * (parseFloat(this.globalProps.hbd_interest_rate) / 10000)
      return Number.isFinite(estimatedPayout) ? Number(estimatedPayout.toFixed(3)) : 0
    },
    pendingHbdClaim () {
      if (!this.globalProps || !this.account) return false
      return parseFloat(this.account.savings_hbd_seconds) > 0 &&
        moment.utc().diff(moment.utc(this.account.savings_hbd_last_interest_payment), 'days') >= 30
    },
    assetActions () {
      if (!this.isOwner) {
        return { hive: [], hp: [], hbd: [], hiveSavings: [], hbdSavings: [] }
      }
      const portfolio = this.portfolio
      const hive = [
        { id: 'transfer', label: 'Transfer HIVE', icon: 'send', authority: 'active' },
        { id: 'power-up', label: 'Power up', icon: 'arrow_upward', authority: 'active' }
      ]
      if (portfolio.liquidHive > 0) {
        hive.push(
          { id: 'deposit-savings', label: 'Deposit to savings', icon: 'savings', authority: 'active' },
          { id: 'convert-hive', label: 'Convert to HBD', icon: 'cached', authority: 'active' }
        )
      }
      hive.push(
        { id: 'market', label: 'Open market', icon: 'store', authority: 'active' },
        { id: 'create-account', label: 'Create account', icon: 'person_add', authority: 'active' }
      )

      const hbd = [
        { id: 'transfer', label: 'Transfer HBD', icon: 'send', authority: 'active' }
      ]
      if (portfolio.liquidHbd > 0) {
        hbd.push(
          { id: 'deposit-savings', label: 'Deposit to savings', icon: 'savings', authority: 'active' },
          { id: 'convert-hbd', label: 'Convert to HIVE', icon: 'cached', authority: 'active' }
        )
      }
      hbd.push({ id: 'market', label: 'Open market', icon: 'store', authority: 'active' })

      const hp = [
        { id: 'power-down', label: 'Power down', icon: 'arrow_downward', authority: 'active' },
        { id: 'delegate', label: 'Delegate HP', icon: 'redeem', authority: 'active' }
      ]

      const hiveSavings = []
      if (portfolio.savingsHive > 0) hiveSavings.push({ id: 'withdraw-savings', label: 'Withdraw HIVE', icon: 'savings', authority: 'active' })
      if (portfolio.liquidHive > 0) hiveSavings.push({ id: 'deposit-savings', label: 'Deposit HIVE', icon: 'savings', authority: 'active' })

      const hbdSavings = []
      if (portfolio.savingsHbd > 0) hbdSavings.push({ id: 'withdraw-savings', label: 'Withdraw HBD', icon: 'savings', authority: 'active' })
      if (portfolio.liquidHbd > 0) hbdSavings.push({ id: 'deposit-savings', label: 'Deposit HBD', icon: 'savings', authority: 'active' })
      if (this.pendingHbdInterest > 0.01) hbdSavings.push({ id: 'claim-interest', label: 'Claim HBD interest', icon: 'redeem', authority: 'active' })

      return { hive, hp, hbd, hiveSavings, hbdSavings }
    }
  },
  watch: {
    '$route.params.username' (value) {
      if (value !== this.username) this.init()
    }
  },
  methods: {
    tidyNumber,
    init () {
      this.username = this.$route.params.username
      setPageMeta({
        title: this.username + "'s Hive wallet",
        description: 'Hive wallet for @' + this.username + ' — HIVE, HBD, Hive Power, savings, delegations and Hive-Engine token balances.',
        url: '/@' + this.username + '/wallet'
      })
      if (this.globalProps.empty) this.$hiveStore.getGlobalProps()
      if (this.account === undefined) this.$hiveStore.getAccount(this.username, { force: true })
      this.hiveTransactions = []
      this.decryptedMemos = {}
      this.accountHistoryPointer = -1
      this.historyDone = false
      this.historyLoading = false
      this.getPrices()
      this.getOpenOrders()
      this.getPendingExtras()
      this.getHiveWalletTransactions()
    },
    refresh () {
      this.$hiveStore.getAccount(this.username, { force: true })
      this.getPrices()
    },
    async refreshAll () {
      this.refreshing = true
      try {
        await Promise.all([
          this.$hiveStore.getAccount(this.username, { force: true }),
          this.getPrices(),
          this.getOpenOrders(),
          this.getPendingExtras()
        ])
      } finally {
        this.refreshing = false
      }
    },
    refreshPending () {
      this.getOpenOrders()
      this.getPendingExtras()
    },
    async getPrices () {
      try {
        const prices = await getHivePrices()
        this.hivePriceUsd = Number(prices?.hive?.usd) || 0
        this.hivePriceUsdChange = prices?.hive?.usd_24h_change ?? null
        this.hbdPriceUsd = Number(prices?.hive_dollar?.usd) || 0
        this.hbdPriceUsdChange = prices?.hive_dollar?.usd_24h_change ?? null
      } catch {
        // Keep the previous values; the price service already falls back to the
        // Hive median price when CoinGecko is unavailable.
      }
    },
    async getOpenOrders () {
      try {
        const orders = await this.$hive.api.getOpenOrdersAsync(this.username)
        this.hiveInternalMarketOrders = Array.isArray(orders) ? orders : []
      } catch {
        this.hiveInternalMarketOrders = []
      }
    },
    async getPendingExtras () {
      const [withdrawals, conversions, collateralized] = await Promise.allSettled([
        this.$hive.api.getSavingsWithdrawFromAsync(this.username),
        this.$hive.api.getConversionRequestsAsync(this.username),
        this.$hive.api.callAsync('condenser_api.get_collateralized_conversion_requests', [this.username])
      ])
      this.savingsWithdrawals = withdrawals.status === 'fulfilled' && Array.isArray(withdrawals.value) ? withdrawals.value : []
      this.conversions = conversions.status === 'fulfilled' && Array.isArray(conversions.value) ? conversions.value : []
      this.collateralizedConversions = collateralized.status === 'fulfilled' && Array.isArray(collateralized.value) ? collateralized.value : []
    },
    async getHiveWalletTransactions (index, done) {
      const finish = () => {
        if (typeof done === 'function') done()
      }
      if (this.historyLoading || this.historyDone) {
        finish()
        return
      }

      this.historyLoading = true
      const requestedUser = this.username
      let retry = false
      try {
        const response = await this.$hive.api.callAsync('condenser_api.get_account_history', [
          this.username,
          this.accountHistoryPointer,
          this.accountHistoryLimit,
          ...this.bitmask
        ])
        if (this.username !== requestedUser) return
        const rows = Array.isArray(response) ? response : []
        if (rows.length === 0) {
          this.historyDone = true
        } else {
          this.accountHistoryPointer = parseInt(rows[0][0], 10) - 1
          const seen = new Set(this.hiveTransactions.map(entry => entry[0]))
          const batch = rows.slice().reverse().filter(entry => !seen.has(entry[0]))
          this.hiveTransactions = this.hiveTransactions.concat(batch)
          if (rows.length < this.accountHistoryLimit) this.historyDone = true
        }
      } catch (err) {
        const sequence = err?.data?.stack?.[0]?.data?.sequence
        const message = err?.cause?.message || err?.message || ''
        if (sequence && message.includes('Could not find filtered operation in')) {
          this.accountHistoryPointer = sequence
          retry = true
        } else {
          this.historyDone = true
        }
      } finally {
        if (this.username === requestedUser) this.historyLoading = false
      }

      if (this.username !== requestedUser) return
      if (retry) {
        setTimeout(() => this.getHiveWalletTransactions(0, done), 1000)
      } else {
        finish()
      }
    },
    async decodeMemo ({ memo, entry }) {
      try {
        const { success, msg } = await keychain(window, 'requestVerifyKey', this.loggedInUser, memo, 'Memo')
        if (!success || !msg) return
        const text = msg.startsWith('#') ? msg.slice(1) : msg
        const key = Array.isArray(entry) ? entry[0] : entry?.index ?? entry?.[1]?.trx_id
        this.decryptedMemos = { ...this.decryptedMemos, [key]: text }
      } catch {
        // Keychain may be unavailable or the user may cancel; the encrypted
        // memo simply stays visible.
      }
    },
    onAssetAction (asset, action) {
      if (action === 'transfer') {
        if (asset === 'hbd') this.transferHbd = true
        else this.transferHive = true
        return
      }
      if (action === 'power-up') {
        this.stakeHive = true
        return
      }
      if (action === 'power-down') {
        this.unstakeHive = true
        return
      }
      if (action === 'delegate') {
        this.delegationDialogVisible = true
        return
      }
      if (action === 'deposit-savings' || action === 'withdraw-savings') {
        this.savingsTokenName = asset === 'hbd' || asset === 'hbdSavings' ? 'HBD' : 'HIVE'
        this.savingsType = action === 'deposit-savings' ? 'deposit' : 'withdraw'
        this.savingsVisible = true
        return
      }
      if (action === 'convert-hive') {
        this.convertTokenName = 'HIVE'
        this.convertDialogVisible = true
        return
      }
      if (action === 'convert-hbd') {
        this.convertTokenName = 'HBD'
        this.convertDialogVisible = true
        return
      }
      if (action === 'market') {
        this.$router.push('/market')
        return
      }
      if (action === 'create-account') {
        this.$router.push('/create')
        return
      }
      if (action === 'claim-interest') {
        this.claimHbdInterest()
      }
    },
    claimHbdInterest () {
      this.$hiveStore.addToQueue([this.username, 'active', ['transfer_from_savings', { from: this.username, to: this.username, request_id: 42069420, amount: '0.001 HBD', memo: 'Claiming HBD interest' }]])
      this.$hiveStore.addToQueue([this.username, 'active', ['cancel_transfer_from_savings', { from: this.username, request_id: 42069420 }]])
      this.$q.notify({ message: 'HBD interest claim queued', color: 'green', icon: 'redeem', position: 'top' })
    },
    cancelOrder (order) {
      this.$hiveStore.addToQueue([this.loggedInUser, 'active', ['limit_order_cancel', { owner: this.loggedInUser, orderid: order.orderid }]])
      this.$q.notify({ message: 'Order cancellation queued', color: 'green', icon: 'cancel', position: 'top' })
    },
    cancelSavingsWithdrawal (requestId) {
      this.$hiveStore.addToQueue([this.loggedInUser, 'active', ['cancel_transfer_from_savings', { from: this.loggedInUser, request_id: requestId }]])
      this.$q.notify({ message: 'Savings withdrawal cancellation queued', color: 'green', icon: 'cancel', position: 'top' })
    },
    scrollTo (id) {
      this.$nextTick(() => {
        const target = document.getElementById(id)
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  },
  mounted () {
    this.init()
  }
}
</script>
