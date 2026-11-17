<template>
    <q-page class="flex q-pa-md flex-center">
        <h1 class="sr-only">Hive internal market</h1>
        <internalMarket :tradeEnabled="true"/>
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
      description: 'Trade HIVE and HBD on the Hive internal market: live order book, ticker and order history on hive.ausbit.dev.',
      url: '/market'
    })
  }
}
</script>
