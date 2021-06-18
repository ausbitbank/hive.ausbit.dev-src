<template>
  <div>
    <q-card>
      <q-tabs v-model="card1OrdersTab" dense align="justify" narrow-indicator indicator-color="secondary">
        <q-tab name="orderbook" label="Orderbook" />
        <q-tab name="openOrders" label="Open Orders" />
        <q-tab name="conversion" label="Conversion" />
        <q-tab name="withdrawals" label="Withdrawals" />
      </q-tabs>
      <q-separator />
      <q-tab-panels v-model="card1OrdersTab" animated>
        <q-tab-panel name="orderbook">
          <q-tabs v-model="card1OrderbookTab" dense align="justify" narrow-indicator indicator-color="secondary">
            <q-tab name="buy" label="Buy" />
            <q-tab name="sell" label="Sell" />
          </q-tabs>
        </q-tab-panel>
        <q-tab-panel name="openOrders">
        </q-tab-panel>
        <q-tab-panel name="conversion">
        </q-tab-panel>
        <q-tab-panel name="withdrawals">
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </div>
</template>

<script>
export default {
  name: 'Card1Orders',
  props: ['A'],
  data () {
    return {
      card1OrdersTab: 'orderbook',
      card1OrderbookTab: 'buy'
    }
  },
  methods: {
  }
}
</script>
