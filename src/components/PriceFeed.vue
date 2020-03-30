<template>
  <div>
    <form @submit.prevent.stop="FeedUpdate" @reset.prevent.stop="onReset" class="q-gutter-md">
      <q-input clearable filled v-model="pricefeed" label="Price Update" />
      <div>
        <q-btn label="Submit Price Update" type="submit" />
        <q-btn label="Fetch Price" @click="priceFeed" />
      </div>
    </form>
    {{ bittrexPrice }}
  </div>
</template>

<script>
import steem from 'steem'
import request from 'request'
steem.api.setOptions({ url: 'https://api.openhive.network' })
export default {
  name: 'PriceFeed',
  data () {
    return {
      pricefeed: '',
      bittrexPrice: ''
    }
  },
  methods: {
    FeedUpdate () {
      console.log(this.pricefeed)
    },
    getPrice (exchange, tickerUrl) {
      return new Promise((resolve, reject) => {
        request(tickerUrl, function (error, response, body) {
          if (body) {
            var json = JSON.parse(body)
            if (exchange === 'bittrex') { resolve(parseFloat(json.result.Last)) }
            if (exchange === 'ionomy') { resolve(parseFloat(json.data.price)) }
          }
          if (error) {
            console.log(error)
            resolve(0)
          }
        })
      })
    },
    async priceFeed () {
      var bittrexUsdtBtc = await this.getPrice('bittrex', 'https://bittrex.com/api/v1.1/public/getticker?market=usdt-btc')
      var bittrexBtcHive = await this.getPrice('bittrex', 'https://bittrex.com/api/v1.1/public/getticker?market=btc-hive')
      this.bittrexPrice = bittrexUsdtBtc * bittrexBtcHive
    }
  },
  mounted () {
  }
}
</script>
