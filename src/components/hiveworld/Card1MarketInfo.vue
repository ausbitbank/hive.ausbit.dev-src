<template>
  <div>
    <q-card>
      <q-tabs v-model="card1MarketInfoTab" dense align="justify" narrow-indicator indicator-color="secondary">
        <q-tab name="hiveHbd" label="HIVE / HBD" />
        <q-tab name="cryptoPairs" label="Crypto Pairs" />
        <q-tab name="currencyRates" label="Currency Rates" />
      </q-tabs>
      <q-separator />
      <q-tab-panels v-model="card1MarketInfoTab" animated>
        <q-tab-panel name="hiveHbd">
        </q-tab-panel>
        <q-tab-panel name="cryptoPairs">
        </q-tab-panel>
        <q-tab-panel name="currencyRates">
        </q-tab-panel>
      </q-tab-panels>
    </q-card>

  </div>
</template>

<script>
export default {
  name: 'Card1MarketInfo',
  props: ['A'],
  data () {
    return {
      card1MarketInfoTab: 'hiveHbd'
    }
  },
  methods: {
  }
}
</script>
