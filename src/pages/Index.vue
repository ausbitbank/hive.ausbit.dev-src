<template>
  <q-page class="flex flex-center">
    <div class="q-pa-md row items-start q-gutter-md">
      <q-card>
        <a href="/exodus" title="Escape from STEEM to HIVE"><img src="https://i.imgflip.com/3u458s.jpg" /></a>
      </q-card>
    </div>
  </q-page>
</template>

<script>
// import UsernameSelect from 'components/UsernameSelect.vue'
// import HiveQuery from 'components/HiveQuery.vue'
// import PriceFeed from 'components/PriceFeed.vue'
export default {
  name: 'Home',
  // components: { UsernameSelect, HiveQuery, PriceFeed }
  // components: { UsernameSelect },
  data () {
    return {
      pricefeed: '',
      bittrexPrice: ''
    }
  },
  methods: {
  }
}
</script>
