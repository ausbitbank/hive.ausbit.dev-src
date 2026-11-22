<template>
  <q-card flat bordered class="wallet-card wallet-pending">
    <q-card-section class="wallet-card__head">
      <div>
        <div class="wallet-eyebrow">Pending</div>
        <h2 :id="headingId" class="wallet-card__title">Waiting on the chain</h2>
      </div>
      <q-btn flat round dense icon="refresh" aria-label="Refresh pending wallet actions" title="Refresh pending wallet actions" @click="$emit('refresh')" />
    </q-card-section>

    <p class="wallet-pending__authority-note">
      <q-icon name="key" aria-hidden="true" />
      Cancel and claim actions use your active key. Pending post rewards use your posting key.
    </p>

    <div v-if="!hasAnything" class="wallet-pending__clear">
      <q-icon name="check_circle" color="green" size="1.6em" aria-hidden="true" />
      <div>
        <strong>All clear.</strong>
        <span>No power-down, savings withdrawals, conversions, open orders or rewards are pending.</span>
      </div>
    </div>

    <q-card-section v-if="hasAnything" class="wallet-pending__grid">
      <section v-if="powerdownHp > 0" class="wallet-pending__item" aria-labelledby="wallet-powerdown-title">
        <div class="wallet-pending__item-head">
          <h3 id="wallet-powerdown-title"><q-icon name="arrow_circle_down" color="orange" aria-hidden="true" /> Power down</h3>
          <q-badge color="orange-9" text-color="black">{{ timeDelta(account.next_vesting_withdrawal) }}</q-badge>
        </div>
        <div class="wallet-pending__facts">
          <div><span>Total</span><strong>{{ tidyNumber(vestToHive(parseInt(account.to_withdraw / 1000000))) }} HIVE</strong></div>
          <div><span>Withdrawn</span><strong>{{ tidyNumber(vestToHive(parseInt(account.withdrawn / 1000000))) }} HIVE</strong></div>
          <div><span>Next payment</span><strong>{{ tidyNumber(powerdownHp) }} HIVE</strong></div>
        </div>
        <q-linear-progress
          rounded
          size="8px"
          color="orange"
          track-color="grey-10"
          :value="powerdownProgress"
          aria-label="Power down progress"
        />
        <q-btn
          v-if="loggedIn"
          flat
          dense
          no-caps
          color="red"
          icon="cancel"
          label="Cancel power down"
          class="wallet-pending__action"
          @click="$emit('cancel-powerdown')"
        />
      </section>

      <section v-if="savingsWithdrawals.length" class="wallet-pending__item" aria-labelledby="wallet-withdrawals-title">
        <div class="wallet-pending__item-head">
          <h3 id="wallet-withdrawals-title"><q-icon name="savings" color="orange" aria-hidden="true" /> Savings withdrawals</h3>
          <q-badge color="blue-grey-9">{{ savingsWithdrawals.length }}</q-badge>
        </div>
        <ul class="wallet-pending__list">
          <li v-for="request in savingsWithdrawals" :key="request.request_id">
            <div>
              <strong>{{ tidyAmount(request.amount) }}</strong>
              <span v-if="request.to !== username">to @{{ request.to }}</span>
              <span>due {{ timeDelta(request.complete) }}</span>
            </div>
            <q-btn
              v-if="loggedIn"
              flat
              dense
              round
              icon="cancel"
              color="red"
              aria-label="Cancel savings withdrawal"
              title="Cancel savings withdrawal"
              @click="$emit('cancel-savings-withdrawal', request.request_id)"
            />
          </li>
        </ul>
      </section>

      <section v-if="conversions.length || collateralizedConversions.length" class="wallet-pending__item" aria-labelledby="wallet-conversions-title">
        <div class="wallet-pending__item-head">
          <h3 id="wallet-conversions-title"><q-icon name="cached" color="blue" aria-hidden="true" /> Conversions</h3>
          <q-badge color="blue-grey-9">{{ conversions.length + collateralizedConversions.length }}</q-badge>
        </div>
        <ul class="wallet-pending__list">
          <li v-for="conversion in conversions" :key="'c-' + conversion.id">
            <div>
              <strong>{{ tidyAmount(conversion.amount) }}</strong>
              <span>to HIVE {{ timeDelta(conversion.conversion_date) }}</span>
            </div>
          </li>
          <li v-for="conversion in collateralizedConversions" :key="'cc-' + conversion.id">
            <div>
              <strong>{{ tidyAmount(conversion.collateral_amount) }}</strong>
              <span>collateral · {{ tidyAmount(conversion.converted_amount) }} converted to HBD {{ timeDelta(conversion.conversion_date) }}</span>
            </div>
          </li>
        </ul>
      </section>

      <section v-if="orders.length" class="wallet-pending__item" aria-labelledby="wallet-orders-title">
        <div class="wallet-pending__item-head">
          <h3 id="wallet-orders-title"><q-icon name="store" color="orange" aria-hidden="true" /> Open market orders</h3>
          <router-link to="/market" class="wallet-pending__link">Market</router-link>
        </div>
        <ul class="wallet-pending__list">
          <li v-for="order in orders" :key="order.orderid">
            <div>
              <strong>{{ tidyAmount(order.sell_price.base) }}</strong>
              <span>for {{ tidyAmount(order.sell_price.quote) }}</span>
            </div>
            <q-btn
              v-if="loggedIn"
              flat
              dense
              round
              icon="cancel"
              color="red"
              aria-label="Cancel market order"
              title="Cancel market order"
              @click="$emit('cancel-order', order)"
            />
          </li>
        </ul>
      </section>

      <section v-if="hasRewards" class="wallet-pending__item" aria-labelledby="wallet-rewards-title">
        <div class="wallet-pending__item-head">
          <h3 id="wallet-rewards-title"><q-icon name="stars" color="amber" aria-hidden="true" /> Pending rewards</h3>
          <span class="wallet-pending__value">{{ usdLabel(rewardsUsd) }}</span>
        </div>
        <div class="wallet-pending__facts">
          <div v-if="account.reward_hive_balance !== '0.000 HIVE'"><span>HIVE</span><strong>{{ tidyAmount(account.reward_hive_balance) }}</strong></div>
          <div v-if="account.reward_hbd_balance !== '0.000 HBD'"><span>HBD</span><strong>{{ tidyAmount(account.reward_hbd_balance) }}</strong></div>
          <div v-if="account.reward_vesting_balance !== '0.000000 VESTS'"><span>Hive Power</span><strong>{{ tidyNumber(vestToHive(parseFloat(account.reward_vesting_balance))) }} HP</strong></div>
        </div>
        <div v-if="loggedIn" class="wallet-pending__action-row">
          <claim-rewards :A="account" class="wallet-pending__action" />
          <q-badge color="green-9">posting key</q-badge>
        </div>
      </section>

      <section v-if="pendingInterest > 0.01" class="wallet-pending__item" aria-labelledby="wallet-interest-title">
        <div class="wallet-pending__item-head">
          <h3 id="wallet-interest-title"><q-icon name="trending_up" color="green" aria-hidden="true" /> HBD interest</h3>
          <q-badge v-if="claimable" color="green-9">claimable</q-badge>
        </div>
        <div class="wallet-pending__facts">
          <div><span>Pending</span><strong>{{ tidyNumber(pendingInterest, 3) }} HBD</strong></div>
          <div><span>Next payout</span><strong>{{ timeTillInterestPayout(account.savings_hbd_last_interest_payment) }}</strong></div>
        </div>
        <div v-if="loggedIn" class="wallet-pending__action-row">
          <q-btn
            flat
            dense
            no-caps
            color="primary"
            icon="redeem"
            label="Claim HBD interest"
            class="wallet-pending__action"
            :disable="!claimable"
            :title="!claimable ? 'Interest can be claimed once every 30 days' : 'Claim your HBD savings interest'"
            @click="$emit('claim-interest')"
          />
          <q-badge color="orange-9" text-color="black">active key</q-badge>
        </div>
        <p class="wallet-pending__note">Interest is paid once per month into your HBD savings balance.</p>
      </section>

      <section class="wallet-pending__item wallet-pending__wide" aria-labelledby="wallet-delegations-title">
        <div class="wallet-pending__item-head">
          <h3 id="wallet-delegations-title"><q-icon name="redeem" color="teal" aria-hidden="true" /> Delegations</h3>
          <span class="wallet-pending__value">
            {{ tidyNumber(portfolio.delegatedHp) }} HP out · {{ tidyNumber(portfolio.receivedHp) }} HP in
          </span>
        </div>
        <delegations :username="username" />
      </section>
    </q-card-section>
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

.wallet-pending__authority-note {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  padding: 0.5rem 1rem 0;
  color: var(--c-text-faint);
  font-size: 0.7rem;
}

.wallet-pending__clear {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 1.1rem 1rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
}

.wallet-pending__clear strong {
  color: var(--c-text);
}

.wallet-pending__clear span {
  display: block;
}

.wallet-pending__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 0.65rem;
  padding: 0.75rem;
}

.wallet-pending__item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.7rem 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.wallet-pending__wide {
  grid-column: 1 / -1;
}

.wallet-pending__item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.wallet-pending__item-head h3 {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin: 0;
  color: var(--c-text-soft);
  font-size: 0.82rem;
  font-weight: 600;
}

.wallet-pending__facts {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.wallet-pending__facts > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  font-size: 0.76rem;
}

.wallet-pending__facts span {
  color: var(--c-text-subtle);
}

.wallet-pending__facts strong {
  color: var(--c-text);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.wallet-pending__list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.wallet-pending__list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  padding-top: 0.3rem;
  border-top: 1px solid var(--border-subtle);
  font-size: 0.75rem;
}

.wallet-pending__list li:first-child {
  padding-top: 0;
  border-top: 0;
}

.wallet-pending__list li > div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.wallet-pending__list strong {
  color: var(--c-text);
  font-variant-numeric: tabular-nums;
}

.wallet-pending__list span {
  color: var(--c-text-subtle);
  overflow-wrap: anywhere;
}

.wallet-pending__link {
  color: var(--c-link);
  font-size: 0.74rem;
  font-weight: 600;
  text-decoration: none;
}

.wallet-pending__link:hover {
  text-decoration: underline;
}

.wallet-pending__value {
  color: var(--c-text-subtle);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
}

.wallet-pending__action-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.1rem;
}

.wallet-pending__action {
  align-self: flex-start;
}

.wallet-pending__note {
  margin: 0;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  line-height: 1.35;
}

@media (max-width: 899px) {
  .wallet-pending__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 599px) {
  .wallet-pending__grid {
    padding: 0.55rem;
  }

  .wallet-card__head {
    padding-left: 0.8rem;
    padding-right: 0.8rem;
  }
}
</style>

<script>
import { defineAsyncComponent } from 'vue'
import moment from 'src/utils/time'
import { buildPortfolio, formatUsd, hasPendingRewards, tidyAmount, tidyNumber, toNumber, vestToHive } from 'src/services/wallet'

export default {
  name: 'WalletPendingPanel',
  components: {
    claimRewards: defineAsyncComponent(() => import('components/claimRewards.vue')),
    delegations: defineAsyncComponent(() => import('components/delegations.vue'))
  },
  props: {
    headingId: { type: String, default: 'wallet-pending-title' },
    account: { type: Object, required: true },
    username: { type: String, required: true },
    loggedIn: { type: Boolean, default: false },
    globalProps: { type: Object, default: () => ({ empty: true }) },
    hivePriceUsd: { type: Number, default: 0 },
    hbdPriceUsd: { type: Number, default: 0 },
    orders: { type: Array, default: () => [] },
    savingsWithdrawals: { type: Array, default: () => [] },
    conversions: { type: Array, default: () => [] },
    collateralizedConversions: { type: Array, default: () => [] },
    pendingInterest: { type: [Number, String], default: 0 },
    claimable: { type: Boolean, default: false }
  },
  emits: ['cancel-powerdown', 'cancel-savings-withdrawal', 'cancel-order', 'claim-interest', 'refresh'],
  computed: {
    portfolio () {
      return buildPortfolio({
        account: this.account,
        globalProps: this.globalProps,
        hivePriceUsd: this.hivePriceUsd,
        hbdPriceUsd: this.hbdPriceUsd
      })
    },
    powerdownHp () {
      return this.portfolio.powerdownHp
    },
    powerdownProgress () {
      const total = toNumber(this.account.to_withdraw)
      const withdrawn = toNumber(this.account.withdrawn)
      if (!total) return 0
      return Math.min(1, Math.max(0, withdrawn / total))
    },
    rewardsUsd () {
      return this.portfolio.pendingUsd
    },
    hasRewards () {
      return hasPendingRewards(this.account)
    },
    hasAnything () {
      return this.powerdownHp > 0 ||
        this.savingsWithdrawals.length > 0 ||
        this.conversions.length > 0 ||
        this.collateralizedConversions.length > 0 ||
        this.orders.length > 0 ||
        this.hasRewards ||
        this.pendingInterest > 0.01
    }
  },
  methods: {
    tidyNumber,
    tidyAmount,
    usdLabel (value) {
      return formatUsd(value)
    },
    vestToHive (vests) {
      return vestToHive(vests, this.globalProps)
    },
    timeDelta (timestamp) {
      if (!timestamp) return ''
      const diff = moment.utc(timestamp).diff(moment.utc(), 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    timeTillInterestPayout (timestamp) {
      if (!timestamp) return '—'
      const next = moment.utc(timestamp).add(30, 'days')
      const minutes = next.diff(moment.utc(), 'minutes')
      if (minutes <= 0) return 'Ready to claim'
      return moment.duration(minutes, 'minutes').humanize(true)
    }
  }
}
</script>
