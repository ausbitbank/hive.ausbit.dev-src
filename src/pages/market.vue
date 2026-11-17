<template>
  <q-page class="market-page">
    <div class="market-shell">
      <header class="market-head">
        <div class="market-head__text">
          <div class="market-eyebrow">
            <span class="home-live-dot is-live" aria-hidden="true"></span>
            On-chain exchange
          </div>
          <h1 class="market-head__title">Internal market</h1>
          <p class="market-intro">
            Trade HIVE and HBD directly on the Hive blockchain. Compare the live
            order book and recent trades, then queue a limit order with your
            active key.
          </p>
        </div>
        <div class="market-actions">
          <q-btn no-caps outline color="primary" icon="show_chart" label="Price charts" to="/markets" />
          <q-btn no-caps outline color="primary" icon="attach_money" label="HBD tools" to="/markets#hbd-tools" />
        </div>
      </header>

      <internal-market :trade-enabled="true" />
    </div>
  </q-page>
</template>

<script>
import internalMarket from 'components/internalMarket.vue'
import { setPageMeta } from 'src/utils/pageMeta'

export default {
  name: 'InternalMarketPage',
  components: { internalMarket },
  mounted () {
    setPageMeta({
      title: 'Hive internal market — trade HIVE and HBD',
      description: 'Trade HIVE and HBD on the Hive internal market with a live order book, recent trades, open orders, balances and zero trading fees.',
      url: '/market'
    })
  }
}
</script>
