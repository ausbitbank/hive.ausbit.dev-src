<template>
    <q-page class="flex q-pa-md flex-center">
        <h1 class="sr-only">Hive internal market</h1>
        <internalMarket :tradeEnabled="true"/>
    </q-page>
</template>
<script>
import internalMarket from 'components/internalMarket.vue'
export default {
  name: 'InternalMarketPage',
  components: { internalMarket },
  mounted () {
    document.title = 'Hive Internal Market'
  }
}
</script>
