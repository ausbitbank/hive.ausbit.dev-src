<template>
  <q-page class="flex flex-center">
    <div class="">
        <recent-posts-carousel />
    </div>
    <div class="q-pa-md row items-start q-gutter-md">
      <q-card flat bordered v-if="!false">
        <q-card-section class="text-center">
          <div class="text-h5 text-center">
            Dynamic Global Properties
          </div>
          <vue-json-pretty :data="globalProps" :custom-value-formatter="customLinkFormatter" />
          <div class="text-center"><q-btn icon="refresh" @click="this.getDynamicGlobalProps" /></div>
        </q-card-section>
      </q-card>
      <nodes />
      <witnesses />
      <coingecko />
    </div>
  </q-page>
</template>
<style scoped>
a {text-decoration: none; color: #3344dd }
a:link { color: #3344dd; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
</style>
<script>
import hive from '@hiveio/hive-js'
// hive.api.setOptions({ url: 'https://rpc.ausbit.dev' })
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'
import moment from 'moment'
import nodes from 'components/nodes.vue'
import witnesses from 'components/witnesses.vue'
import coingecko from 'components/coingecko.vue'
import recentPostsCarousel from 'components/recentPostsCarousel.vue'
// import { Client } from "@hiveio/dhive"
// const client = new Client(["https://rpc.ausbit.dev", "https://api.hive.blog", "https://api.hivekings.com", "https://anyx.io", "https://api.openhive.network"])

export default {
  name: 'Home',
  data () {
    return {
      globalProps: null
    }
  },
  components: {
    VueJsonPretty,
    nodes,
    witnesses,
    coingecko,
    recentPostsCarousel
  },
  computed: {
    hivePerMvests: function () {
      if (this.globalProps.total_vesting_shares) {
        return (this.globalProps.total_vesting_fund_hive.split(' ')[0] / (this.globalProps.total_vesting_shares.split(' ')[0] / 1e6))
      } else {
        return 509.6451627091090586
      }
    }
  },
  methods: {
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    tidyNumber (x) {
      var parts = x.toString().split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return parts.join('.')
    },
    getDynamicGlobalProps () {
      hive.api.getDynamicGlobalPropertiesAsync()
        .then((response) => { this.globalProps = response })
        .catch(() => { console.log('Failed to load dynamic global props') })
    },
    customLinkFormatter (data, key, parent, defaultFormatted) {
      if (key === 'head_block_number' || key === 'last_irreversible_block_num' || key === 'last_confirmed_block_num') {
        return `<a href="/block/${data}">${data}</a>`
      } else if (key === 'url') {
        return `<a href="${data}">${data}</a>`
      } else {
        return defaultFormatted
      }
    }
  },
  mounted () {
    this.getDynamicGlobalProps()
  }
}
</script>
