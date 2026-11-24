<template>
  <div class="dw-wa">
    <q-card-section class="home-panel__head dw-wa__head">
      <div>
        <div class="home-eyebrow">Wallet</div>
        <h2 class="home-panel__title">
          <template v-if="accountName">@{{ accountName }}</template>
          <template v-else>Waiting on the chain</template>
        </h2>
      </div>
      <div class="home-panel__actions">
        <q-btn
          flat
          dense
          round
          icon="refresh"
          aria-label="Refresh pending wallet actions"
          title="Refresh pending wallet actions"
          :loading="loading || extrasLoading"
          @click="reload"
        />
      </div>
    </q-card-section>

    <dashboard-widget-state
      :state="displayState"
      :error="loadError"
      guest-title="Log in to see pending wallet actions"
      guest-text="Power-down, savings withdrawals, conversions, open orders, rewards and HBD interest."
      @retry="reload"
    />

    <template v-if="displayState === 'ready' || displayState === 'stale'">
      <p v-if="staleNotice" class="dw-wa__notice" role="status">
        <q-icon name="cloud_off" size="16px" aria-hidden="true" />
        <span>{{ staleNotice }}</span>
      </p>

      <p v-if="queuedAction" class="dw-wa__notice dw-wa__notice--queued" role="status">
        <q-icon name="playlist_add_check" size="16px" aria-hidden="true" />
        <span>{{ queuedAction }} was added to the signing queue. Review and send it from the queue; errors stay on the queue item.</span>
      </p>

      <div v-if="!summary.hasAnything" class="dw-wa__clear">
        <q-icon :name="checking ? 'hourglass_top' : 'check_circle'" size="22px" aria-hidden="true" />
        <div>
          <strong>{{ checking ? 'Checking the chain…' : 'All clear.' }}</strong>
          <span>{{ clearText }}</span>
        </div>
      </div>

      <div v-else-if="!visibleSections" class="dw-wa__clear">
        <q-icon name="visibility_off" size="22px" aria-hidden="true" />
        <div>
          <strong>Pending actions are hidden.</strong>
          <span>This widget's settings hide every section with activity.</span>
        </div>
      </div>

      <q-card-section v-else class="dw-wa__grid">
        <section v-if="showPowerDown && summary.powerdown.active" class="dw-wa__item" aria-labelledby="dw-wa-powerdown-title">
          <div class="dw-wa__item-head">
            <h3 id="dw-wa-powerdown-title"><q-icon name="arrow_circle_down" aria-hidden="true" /> Power down</h3>
            <span class="dw-wa__item-actions">
              <widget-action-button
                v-if="canAct"
                :action="actions.cancelPowerdown"
                :account="accountName"
                label="Cancel"
                @queued="onQueued"
              />
              <router-link :to="pendingPath" class="dw-wa__link" aria-label="Manage power down in the wallet">Wallet</router-link>
            </span>
          </div>
          <div class="dw-wa__facts">
            <div><span>Total</span><strong>{{ amountLabel(summary.powerdown.toWithdraw) }}</strong></div>
            <div><span>Withdrawn</span><strong>{{ amountLabel(summary.powerdown.withdrawn) }}</strong></div>
            <div><span>Next payment</span><strong>{{ summary.powerdown.nextLabel }}</strong></div>
          </div>
          <div
            class="dw-wa__bar"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="Math.round(summary.powerdown.progress * 100)"
            aria-label="Power down progress"
          >
            <span :style="{ width: (summary.powerdown.progress * 100) + '%' }"></span>
          </div>
          <p class="dw-wa__hint">
            {{ summary.powerdown.countdown || 'No countdown available' }} · {{ summary.powerdown.cyclesLeft }} weekly {{ summary.powerdown.cyclesLeft === 1 ? 'payment' : 'payments' }} left
          </p>
        </section>

        <section v-if="showSavings && summary.savingsWithdrawals.length" class="dw-wa__item" aria-labelledby="dw-wa-savings-title">
          <div class="dw-wa__item-head">
            <h3 id="dw-wa-savings-title"><q-icon name="savings" aria-hidden="true" /> Savings withdrawals</h3>
            <router-link :to="pendingPath" class="dw-wa__link" aria-label="Manage savings withdrawals in the wallet">Wallet</router-link>
          </div>
          <ul class="dw-wa__list">
            <li v-for="item in summary.savingsWithdrawals" :key="'savings-' + item.id">
              <span class="dw-wa__row-main">
                <strong>{{ item.amount }}</strong>
                <span class="dw-wa__row-meta">
                  <span>{{ item.to && item.to !== accountName ? 'to @' + item.to : 'to you' }}</span>
                  <span>{{ item.countdown || '—' }}</span>
                </span>
              </span>
              <widget-action-button
                v-if="canAct"
                :action="actions.cancelSavings(item.id)"
                :account="accountName"
                label="Cancel"
                @queued="onQueued"
              />
            </li>
          </ul>
        </section>

        <section v-if="showConversions && summary.conversions.length" class="dw-wa__item" aria-labelledby="dw-wa-conversions-title">
          <div class="dw-wa__item-head">
            <h3 id="dw-wa-conversions-title"><q-icon name="cached" aria-hidden="true" /> Conversions</h3>
            <router-link :to="pendingPath" class="dw-wa__link" aria-label="Manage conversions in the wallet">Wallet</router-link>
          </div>
          <ul class="dw-wa__list">
            <li v-for="item in summary.conversions" :key="'conversion-' + item.id">
              <strong>{{ item.amount }} {{ item.direction }}</strong>
              <span class="dw-wa__row-meta">{{ item.countdown || '—' }}</span>
            </li>
          </ul>
        </section>

        <section v-if="showOrders && summary.orders.length" class="dw-wa__item" aria-labelledby="dw-wa-orders-title">
          <div class="dw-wa__item-head">
            <h3 id="dw-wa-orders-title"><q-icon name="store" aria-hidden="true" /> Open orders</h3>
            <router-link :to="pendingPath" class="dw-wa__link" aria-label="Manage open market orders in the wallet">Wallet</router-link>
          </div>
          <ul class="dw-wa__list">
            <li v-for="order in summary.orders" :key="'order-' + order.id">
              <span class="dw-wa__row-main">
                <strong>{{ order.sell }} → {{ order.receive }}</strong>
                <span class="dw-wa__row-meta">{{ orderPrice(order) }}</span>
              </span>
              <widget-action-button
                v-if="canAct"
                :action="actions.cancelOrder(order.id)"
                :account="accountName"
                label="Cancel"
                @queued="onQueued"
              />
            </li>
          </ul>
        </section>

        <section v-if="showRewards && summary.rewards.has" class="dw-wa__item" aria-labelledby="dw-wa-rewards-title">
          <div class="dw-wa__item-head">
            <h3 id="dw-wa-rewards-title"><q-icon name="stars" aria-hidden="true" /> Pending rewards</h3>
            <span class="dw-wa__value">{{ summary.rewards.usd }}</span>
          </div>
          <div class="dw-wa__chips">
            <span v-for="part in summary.rewards.parts" :key="part" class="dw-wa__chip">{{ part }}</span>
          </div>
          <p class="dw-wa__hint">
            <router-link :to="pendingPath">Claim in the wallet</router-link>
          </p>
          <widget-action-button
            v-if="canAct"
            :action="actions.claimRewards"
            :account="accountName"
            label="Claim rewards"
            @queued="onQueued"
          />
        </section>

        <section v-if="showSavings && summary.interest.amount > 0.01" class="dw-wa__item" aria-labelledby="dw-wa-interest-title">
          <div class="dw-wa__item-head">
            <h3 id="dw-wa-interest-title"><q-icon name="trending_up" aria-hidden="true" /> HBD interest</h3>
            <span class="dw-wa__status" :class="summary.interest.claimable ? 'is-claimable' : ''">
              {{ summary.interest.claimable ? 'Claimable' : 'Accruing' }}
            </span>
          </div>
          <div class="dw-wa__facts">
            <div><span>Pending</span><strong>{{ tidyNumber(summary.interest.amount, 3) }} HBD</strong></div>
            <div><span>Next payout</span><strong>{{ summary.interest.nextLabel }}</strong></div>
          </div>
          <p class="dw-wa__hint">
            Interest is paid once per month into HBD savings.
            <router-link :to="pendingPath">Claim in the wallet</router-link>
          </p>
          <widget-action-button
            v-if="canAct"
            :action="actions.claimInterest"
            :account="accountName"
            label="Claim interest"
            @queued="onQueued"
          />
        </section>
      </q-card-section>

      <q-card-section class="home-panel__footer dw-wa__footer">
        <router-link :to="pendingPath">Manage in wallet</router-link>
        <span>{{ extrasLoading ? 'Refreshing…' : canAct ? 'Actions queue for signing' : 'Read-only · no signing' }}</span>
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-wa__head {
  align-items: flex-start;
}

.dw-wa__notice {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin: 0;
  padding: 0.45rem 1rem 0;
  color: var(--c-warning-soft);
  font-size: 0.7rem;
  line-height: 1.4;
}

.dw-wa__notice--queued {
  color: var(--c-positive);
}

.dw-wa__item-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.dw-wa__clear {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.95rem 1rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.4;
}

.dw-wa__clear .q-icon {
  color: var(--c-positive);
  flex: none;
}

.dw-wa__clear strong {
  display: block;
  color: var(--c-text);
}

.dw-wa__clear span {
  display: block;
}

.dw-wa__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  align-items: start;
  gap: 0.45rem;
  padding: 0.7rem 1rem 0.6rem;
}

.dw-wa__item {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.dw-wa__item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.dw-wa__item-head h3 {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin: 0;
  color: var(--c-text-soft);
  font-size: 0.8rem;
  font-weight: 600;
}

.dw-wa__item-head .q-icon {
  color: var(--c-text-subtle);
}

.dw-wa__link {
  color: var(--c-link);
  font-size: 0.68rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.dw-wa__link:hover {
  text-decoration: underline;
}

.dw-wa__facts {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.dw-wa__facts > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.74rem;
}

.dw-wa__facts span {
  color: var(--c-text-subtle);
}

.dw-wa__facts strong {
  color: var(--c-text);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.dw-wa__bar {
  overflow: hidden;
  height: 6px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 8%, transparent);
}

.dw-wa__bar > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--c-link), var(--c-link-hover));
}

.dw-wa__list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dw-wa__list li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
  padding-top: 0.3rem;
  border-top: 1px solid var(--border-subtle);
  font-size: 0.73rem;
}

.dw-wa__row-main {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.dw-wa__list li:first-child {
  padding-top: 0;
  border-top: 0;
}

.dw-wa__list strong {
  color: var(--c-text);
  font-variant-numeric: tabular-nums;
  min-width: 0;
  overflow-wrap: anywhere;
}

.dw-wa__row-meta {
  display: inline-flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  justify-content: flex-end;
  color: var(--c-text-subtle);
  font-size: 0.68rem;
}

.dw-wa__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.dw-wa__chip {
  padding: 0.12rem 0.4rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-link) 9%, transparent);
  color: var(--c-link-soft);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}

.dw-wa__status {
  display: inline-flex;
  align-items: center;
  padding: 0.08rem 0.4rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 7%, transparent);
  color: var(--c-text-subtle);
  font-size: 0.62rem;
  font-weight: 600;
}

.dw-wa__status.is-claimable {
  background: color-mix(in srgb, var(--c-positive) 14%, transparent);
  color: var(--c-positive);
}

.dw-wa__value {
  color: var(--c-text);
  font-size: 0.74rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.dw-wa__hint {
  margin: 0;
  color: var(--c-text-faint);
  font-size: 0.66rem;
  line-height: 1.35;
}

.dw-wa__hint a {
  color: var(--c-link);
  text-decoration: none;
}

.dw-wa__hint a:hover {
  text-decoration: underline;
}

.dw-wa__footer {
  align-items: center;
}

@media (max-width: 599px) {
  .dw-wa__grid {
    padding-left: 0.7rem;
    padding-right: 0.7rem;
  }

  .dw-wa__item {
    padding: 0.45rem 0.5rem;
  }
}
</style>

<script>
import moment from 'src/utils/time'
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import WidgetActionButton from 'components/dashboard/WidgetActionButton.vue'
import { accountWidgetMixin } from 'components/dashboard/accountWidgetMixin'
import { walletActionsSummary } from 'src/services/walletActions'
import { tidyNumber } from 'src/services/wallet'
import {
  cancelOrderAction,
  cancelPowerdownAction,
  cancelSavingsWithdrawalAction,
  claimInterestAction,
  claimRewardsAction
} from 'src/services/widgetActions'

export default {
  name: 'WidgetWalletActions',
  components: { DashboardWidgetState, WidgetActionButton },
  mixins: [accountWidgetMixin],
  props: {
    account: { type: String, default: '' },
    showPowerDown: { type: Boolean, default: true },
    showSavings: { type: Boolean, default: true },
    showConversions: { type: Boolean, default: true },
    showOrders: { type: Boolean, default: true },
    showRewards: { type: Boolean, default: true },
    enableActions: { type: Boolean, default: false }
  },
  data () {
    return {
      openOrders: [],
      savingsWithdrawals: [],
      conversions: [],
      collateralizedConversions: [],
      extrasLoading: false,
      extrasLoaded: false,
      extrasFailed: false,
      extrasError: '',
      extrasAccount: '',
      queuedAction: ''
    }
  },
  computed: {
    // Same accrual calculation as `pages/wallet.vue`: seconds of HBD balance
    // held, converted at the chain's interest rate.
    pendingHbdInterest () {
      const account = this.accountRecord
      const globalProps = this.globalProps
      if (!account || !globalProps) return 0
      const secondsInYear = 60 * 60 * 24 * 365
      const secondsSinceUpdate = moment.utc().diff(moment.utc(account.savings_hbd_seconds_last_update), 'seconds')
      const pendingSeconds = parseFloat(account.savings_hbd_balance) * parseFloat(secondsSinceUpdate)
      const secondsToPayFor = parseFloat(account.savings_hbd_seconds) / 1000 + pendingSeconds
      const estimatedPayout = (secondsToPayFor / secondsInYear) * (parseFloat(globalProps.hbd_interest_rate) / 10000)
      return Number.isFinite(estimatedPayout) ? Number(estimatedPayout.toFixed(3)) : 0
    },
    summary () {
      return walletActionsSummary({
        account: this.accountRecord,
        globalProps: this.globalProps,
        prices: this.prices,
        openOrders: this.openOrders,
        conversions: this.conversions,
        collateralizedConversions: this.collateralizedConversions,
        savingsWithdrawals: this.savingsWithdrawals,
        pendingInterest: this.pendingHbdInterest,
        now: this.updatedAt || Date.now()
      })
    },
    displayState () {
      if (this.loading && this.loaded) return this.loadError ? 'stale' : 'ready'
      return this.state
    },
    staleNotice () {
      if (this.state === 'stale') {
        return this.loadError || 'Refresh failed — showing the last good account data.'
      }
      return this.extrasError
    },
    checking () {
      return this.extrasLoading && !this.extrasLoaded
    },
    clearText () {
      if (this.checking) return 'Fetching savings, conversions, orders and rewards.'
      if (this.extrasFailed) return 'No account-based actions are pending, but wallet extras could not be loaded.'
      return 'No power-down, savings withdrawals, conversions, open orders or rewards are pending.'
    },
    visibleSections () {
      return (this.showPowerDown && this.summary.powerdown.active) ||
        (this.showSavings && (this.summary.savingsWithdrawals.length > 0 || this.summary.interest.amount > 0.01)) ||
        (this.showConversions && this.summary.conversions.length > 0) ||
        (this.showOrders && this.summary.orders.length > 0) ||
        (this.showRewards && this.summary.rewards.has)
    },
    pendingPath () {
      return '/@' + this.accountName + '/wallet#pending'
    },
    /**
     * Actions are only offered for the signed-in user's own account. A widget
     * pointing at someone else stays a read-only view, and the setting is off
     * by default.
     */
    canAct () {
      return Boolean(this.enableActions && this.accountName && this.signedInUser === this.accountName)
    },
    actions () {
      const name = this.accountName
      return {
        claimRewards: this.canAct ? claimRewardsAction(name, this.accountRecord) : null,
        claimInterest: this.canAct ? claimInterestAction(name) : null,
        cancelPowerdown: this.canAct ? cancelPowerdownAction(name) : null,
        cancelSavings: id => (this.canAct ? cancelSavingsWithdrawalAction(name, id) : null),
        cancelOrder: id => (this.canAct ? cancelOrderAction(name, id) : null)
      }
    }
  },
  methods: {
    tidyNumber,
    onQueued (action) {
      this.queuedAction = action?.label || 'Action'
    },
    amountLabel (value) {
      return tidyNumber(value, 2) + ' HIVE'
    },
    orderPrice (order) {
      if (!order || !Number.isFinite(Number(order.price)) || Number(order.price) <= 0) return '—'
      return 'at ' + tidyNumber(order.price, 4)
    },
    applyAccountData (result) {
      const name = result.accountName || this.targetAccount
      if (!name) return
      if (this.extrasAccount && this.extrasAccount !== name) this.resetExtras()
      this.extrasAccount = name
      this.loadExtras(name)
    },
    resetExtras () {
      this.openOrders = []
      this.savingsWithdrawals = []
      this.conversions = []
      this.collateralizedConversions = []
      this.extrasLoaded = false
      this.extrasFailed = false
      this.extrasError = ''
    },
    async loadExtras (name) {
      if (!name) return
      this.extrasLoading = true
      const results = await Promise.allSettled([
        this.$hive.api.getOpenOrdersAsync(name),
        this.$hive.api.getSavingsWithdrawFromAsync(name),
        this.$hive.api.getConversionRequestsAsync(name),
        this.$hive.api.callAsync('condenser_api.get_collateralized_conversion_requests', [name])
      ])
      if (this.extrasAccount !== name) return

      let failed = false
      const labels = ['open orders', 'savings withdrawals', 'conversions', 'collateralized conversions']
      const apply = (index, setter) => {
        if (results[index].status === 'fulfilled') {
          setter(results[index].value)
        } else {
          console.error('Failed to load ' + labels[index] + ' for @' + name, results[index].reason)
          failed = true
        }
      }

      apply(0, value => { this.openOrders = Array.isArray(value) ? value : [] })
      apply(1, value => { this.savingsWithdrawals = Array.isArray(value) ? value : [] })
      apply(2, value => { this.conversions = Array.isArray(value) ? value : [] })
      apply(3, value => { this.collateralizedConversions = Array.isArray(value) ? value : [] })

      this.extrasFailed = failed
      this.extrasLoaded = true
      this.extrasLoading = false
      this.extrasError = failed
        ? 'Pending wallet extras could not refresh — showing the last known values.'
        : ''
    }
  }
}
</script>
