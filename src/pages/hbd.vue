<template>
  <q-page class="flex q-pa-md flex-center">
    <q-card v-if="globalProps !== null">
      <q-card-section>
        <div class="text-bold">Rule : HBD Marketcap cannot be more then 10% total HIVE marketcap</div>
        <div>HBD Marketcap = ${{ tidyNumber(hbdCap) }}</div>
        <div>Hive Marketcap = ${{ tidyNumber(hiveCap) }}</div>
        <div><q-linear-progress stripe size="10px" :value="percentCap / 10" :color="percentColor" /></div>
        <div>HBD Marketcap is currently <span class="text-bold">{{ percentCap }}</span> % of Hive Marketcap</div>
        <div v-if="medianPrice !== null">HIVE median price must stay above <span class="text-bold">${{ haircutPrice }}</span> to avoid haircut (now ${{ medianPrice.base.split(' ')[0] / parseFloat(medianPrice.quote.split(' ')[0]) }})</div>
      </q-card-section>
      <q-card-section v-if="percentCap >= 9 && percentCap < 10 && globalProps.hbd_print_rate !== 10000">
        <div class="text-bold"><q-icon name="warning" color="orange" />Print Rate slowed to {{ globalProps.hbd_print_rate / 100 }} %</div>
      </q-card-section>
      <q-card-section v-if="percentCap < 10">
        <div class="text-bold"><q-icon name="info" color="primary" />Normal Conditions Apply:</div>
        <div class="text-subtitle">Redeem each HBD for $1 of Hive at 3.5 day avg market price (${{ medianPrice.base.split(' ')[0] / parseFloat(medianPrice.quote.split(' ')[0]) }})</div>
      </q-card-section>
      <q-card-section v-if="percentCap > 10 && medianPrice !== null">
        <div class="text-bold"><q-icon name="warning" color="red" />Haircut Conditions Apply:</div>
        <div>Formula for redemption price during a haircut :</div>
        <div><code>(TOTAL ISSUED HIVE x INTERNAL MARKET PRICE) /  (10 x TOTAL ISSUED HBD)</code></div>
        <div><code>({{ parseFloat(globalProps.current_supply.split(' ')[0]) }} * {{ parseFloat(medianPrice.base.split(' ')[0]) / parseFloat(medianPrice.quote.split(' ')[0]) }}) / (10 x {{ globalProps.current_hbd_supply }})</code></div>
        <div>Redemption price during haircut : {{ (parseFloat(globalProps.current_supply.split(' ')[0]) * (parseFloat(medianPrice.base.split(' ')[0])) / parseFloat(medianPrice.quote.split(' ')[0])) / (10 * parseFloat(globalProps.current_hbd_supply.split(' ')[0])) }}</div>
      </q-card-section>
      <q-card-section v-if="false">
        <q-list dense bordered separator>
          <q-item class="text-bold">
            Relevant Stats
          </q-item>
          <q-item>
            HBD print rate : {{ globalProps.hbd_print_rate / 100 }} %
          </q-item>
          <q-item>
            HBD interest rate : {{ globalProps.hbd_interest_rate }} %
          </q-item>
          <q-item>
            HBD slows printing at {{ globalProps.hbd_start_percent / 100 }} %
          </q-item>
          <q-item>
            HBD stop printing at {{ globalProps.hbd_stop_percent / 100 }} %
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
    <coingecko />
  </q-page>
</template>
<style scoped>
a {text-decoration: none; color: #1d8ce0 }
a:link { color: #1d8ce0; font-weight: normal; text-decoration: none; }
a:visited { color: #1d8ce0; }
</style>
<script>
import hive from '@hiveio/hive-js'
import { debounce } from 'quasar'
import coingecko from 'components/coingecko.vue'
export default {
  name: 'hbd',
  data () {
    return {
      globalProps: null,
      medianPrice: null,
      daoHbdBalance: 0
    }
  },
  components: { coingecko },
  watch: {
  },
  props: {
  },
  computed: {
    percentColor: function () {
      if ((this.percentCap) >= 9) {
        return 'red'
      } else if ((this.percentCap) >= 8) {
        return 'orange'
      } else {
        return 'green'
      }
    },
    hiveCap: function () {
      if (this.globalProps !== null && this.medianPrice !== null) {
        return parseFloat(parseFloat(this.globalProps.current_supply.split(' ')[0]) * (parseFloat(this.medianPrice.base.split(' ')[0])).toFixed(3) / parseFloat(this.medianPrice.quote.split(' ')[0]))
      } else {
        return null
      }
    },
    hbdCap: function () {
      if (this.globalProps) {
        return (parseFloat(this.globalProps.current_hbd_supply.split(' ')[0]) - parseFloat(this.daoHbdBalance)).toFixed(3) // HF24 Ignores DAO HBD in debt calculations
      } else {
        return null
      }
    },
    percentCap: function () {
      // return this.hiveCap / this.hbdCap
      return parseFloat((this.hbdCap / this.hiveCap) * 100).toFixed(3)
    },
    haircutPrice: function () {
      return parseFloat((this.hbdCap * 10) / parseFloat(this.globalProps.current_supply.split(' ')[0])).toFixed(3)
    }
  },
  methods: {
    tidyNumber (x) {
      if (x == null) { return null }
      var parts = x.toString().split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return parts.join('.')
    },
    getMedianPrice () {
      hive.api.getCurrentMedianHistoryPriceAsync()
        .then((response) => {
          this.medianPrice = response
        })
        .catch(() => {
          console.log('Failed to get median price - retrying')
          debounce(this.getMedianPrice(), 50)
        })
    },
    getGlobalProps () {
      hive.api.getDynamicGlobalPropertiesAsync()
        .then((response) => {
          this.globalProps = response
        })
        .catch(() => {
          console.log('Failed to load global properties .. Retrying')
          debounce(this.getGlobalProps(), 50)
        })
    },
    getDaoBalance () {
      hive.api.getAccountsAsync(['hive.fund'])
        .then((response) => {
          this.daoHbdBalance = response[0].hbd_balance.split(' ')[0]
        })
        .catch(() => console.log('Failed to load @hive.fund profile'))
    }
  },
  mounted () {
    this.getGlobalProps()
    this.getDaoBalance()
    this.getMedianPrice()
  }
}
</script>
