<template>
  <q-card flat bordered class="home-card home-panel market-orders">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Your activity</div>
        <h2 :id="headingId" class="home-panel__title">Open orders</h2>
      </div>
      <span class="market-orders__authority">
        <q-icon name="lock" size="13px" aria-hidden="true" />
        Active key
      </span>
    </q-card-section>

    <div v-if="!loggedIn" class="home-panel__state">
      <q-icon name="lock_person" size="24px" color="grey" aria-hidden="true" />
      <span>Log in from the header to view and cancel your open orders.</span>
    </div>

    <div v-else-if="loading && orders.length === 0" class="market-orders__skeleton">
      <q-skeleton v-for="i in 4" :key="i" type="text" height="18px" />
    </div>

    <div v-else-if="orders.length === 0" class="home-panel__state">
      <q-icon name="playlist_remove" size="24px" color="grey" aria-hidden="true" />
      <span>No open orders. Orders you place will appear here until filled or cancelled.</span>
    </div>

    <div v-else class="market-orders__body">
      <table class="market-orders__table">
        <caption class="sr-only">Your open internal market limit orders</caption>
        <thead>
          <tr>
            <th scope="col">Side</th>
            <th scope="col">Sell</th>
            <th scope="col">Receive</th>
            <th scope="col">Price</th>
            <th scope="col" class="market-orders__expiry-col">Expires</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.id">
            <td>
              <span :class="order.side === 'buy' ? 'market-orders__buy' : 'market-orders__sell'">
                {{ order.side === 'buy' ? 'Buy HIVE' : 'Sell HIVE' }}
              </span>
            </td>
            <td>{{ formatAmount(order.amount) }} {{ order.asset }}</td>
            <td>{{ formatAmount(order.receive) }} {{ order.receiveAsset }}</td>
            <td>{{ formatPrice(order.price) }}</td>
            <td class="market-orders__expiry-col">
              <time :datetime="order.expiration">{{ expiresLabel(order.expiration) }}</time>
            </td>
            <td class="market-orders__actions">
              <q-btn
                flat
                dense
                no-caps
                color="red"
                icon="cancel"
                label="Cancel"
                :loading="cancellingId === order.orderid"
                :aria-label="'Cancel order ' + order.orderid"
                @click="$emit('cancel', order.orderid)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <q-card-section class="home-panel__footer">
      <span>Cancelling queues a limit_order_cancel with active authority.</span>
      <span>{{ orders.length }} open</span>
    </q-card-section>
  </q-card>
</template>

<script>
import moment from 'src/utils/time'
import { formatAmount, formatPrice } from 'src/services/market'

export default {
  name: 'MarketOpenOrders',
  props: {
    orders: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    loggedIn: { type: Boolean, default: false },
    cancellingId: { type: [Number, String], default: null },
    headingId: { type: String, default: 'open-orders-title' }
  },
  emits: ['cancel'],
  methods: {
    formatAmount,
    formatPrice,
    expiresLabel (value) {
      if (!value) return '—'
      return moment.utc(value).fromNow()
    }
  }
}
</script>

<style scoped>
.market-orders__authority {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: #ffb74d;
  font-size: 0.7rem;
  white-space: nowrap;
}

.market-orders__body {
  padding: 0.35rem 0.5rem 0.4rem;
  overflow-x: auto;
}

.market-orders__skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.7rem 1rem;
}

.market-orders__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.market-orders__table th {
  padding: 0.22rem 0.45rem;
  color: #78909c;
  font-size: 0.64rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-align: right;
  text-transform: uppercase;
  white-space: nowrap;
}

.market-orders__table th:first-child,
.market-orders__table td:first-child {
  text-align: left;
}

.market-orders__table td {
  padding: 0.3rem 0.45rem;
  border-top: 1px solid var(--border-subtle);
  color: #cfd8dc;
  text-align: right;
  white-space: nowrap;
}

.market-orders__table time {
  color: #90a4ae;
  font-size: 0.7rem;
}

.market-orders__buy {
  color: #81c784;
  font-weight: 600;
}

.market-orders__sell {
  color: #ef9a9a;
  font-weight: 600;
}

.market-orders__actions {
  width: 1%;
}

@media (max-width: 599px) {
  .market-orders__expiry-col {
    display: none;
  }
}
</style>
