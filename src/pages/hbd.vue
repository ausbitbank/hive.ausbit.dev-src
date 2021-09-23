<template>
  <q-page class="flex q-pa-md flex-center">
    <q-card v-if="globalProps !== undefined && globalProps !== null" class="text-center q-pa-sm q-ma-sm" bordered>
      <q-card-section>
        <q-item>
          <q-item-section avatar>
            <q-icon name="img:statics/hbd.svg" title="HBD" size="lg" />
          </q-item-section>
          <q-item-section class="text-h4">
            Hive Backed Dollars
          </q-item-section>
        </q-item>
        Hive Backed Dollars are a stablecoin used on the Hive network. They are "backed" by the networks ability to convert them into $1 USD worth of Hive.<br />
        There are constraints on HBD creation within the blockchain rules to help keep the Hive economy healthy.<br />
        This page helps track relevant info about HBD
      </q-card-section>
      <q-separator />
      <q-card-section>
        <div class="text-h6"><q-icon name="price_change" color="grey" />&nbsp; HBD Marketcap must be below 10% of HIVE marketcap</div>
        <div class="text-subtitle2">(The Debt Limit)</div>
        <div>HBD Marketcap = ${{ tidyNumber(hbdCap) }}</div>
        <div>Hive Marketcap = ${{ tidyNumber(hiveCap) }}</div>
        <div><q-linear-progress stripe size="10px" :value="percentCap / 10" :color="percentColor" /></div>
        <div>HBD Marketcap is currently <span class="text-bold">{{ percentCap }}</span> % of Hive Marketcap</div>
        <div v-if="medianPrice !== null">HIVE median price must stay above <span class="text-bold">${{ haircutPrice }}</span> to avoid haircut (currently ${{ (medianPrice.base.split(' ')[0] / parseFloat(medianPrice.quote.split(' ')[0])).toFixed(4) }})</div>
      </q-card-section>
      <q-separator />
      <q-card-section class="text-center" v-if="hbdApr > 0">
        <div class="text-h6"><q-icon name="trending_up" color="green" />&nbsp; HBD held in savings now earn interest</div>
        <div class="text-subtitle2">(paid monthly)</div>
        <div>The current interest rate is <q-badge :color="hbdAprColor">{{ hbdApr }} %</q-badge>, as determined by <router-link to="/witnesses">consensus witnesses</router-link></div>
        <div class="text-center"><q-icon name="info" color="blue" />&nbsp; <router-link to="/@ats-david/hive-dollar-interest-distributions-begin-on-the-hive-blockchain">Learn more about HBD interest here</router-link></div>
      </q-card-section>
      <q-separator />
      <q-card-section>
        <div class="text-h6"><q-icon name="trending_flat" color="orange" />&nbsp; HBDStabilizer is active</div>
        <div class="text-subtitle2">Using overvalued HBD to buy Hive for the DAO</div>
        <p><router-link to="hbdstabilizer"><q-icon name="info" color="blue" />&nbsp; Learn more about the HBD Stabilizer over here</router-link></p>
      </q-card-section>
      <q-separator />
      <q-card-section v-if="globalProps.hbd_print_rate !== 10000">
        <div class="text-h6"><q-icon name="warning" color="orange" />&nbsp; HBD creation reduced</div>
        <div class="text-subtitle">The HBD "Print Rate" has been reduced to <q-badge :color="percentColor">{{ globalProps.hbd_print_rate / 100 }} %</q-badge></div>
      </q-card-section>
      <q-separator v-if="globalProps.hbd_print_rate !== 10000" />
      <q-card-section v-if="percentCap < 10">
        <div class="text-h6"><q-icon name="check" color="green" />&nbsp; Normal Conditions Apply:</div>
        <div class="text-subtitle">Redeem each HBD for $1 of Hive at 3.5 day avg market price (${{ (medianPrice.base.split(' ')[0] / parseFloat(medianPrice.quote.split(' ')[0])).toFixed(4) }})</div>
      </q-card-section>
      <q-card-section v-if="percentCap > 10 && medianPrice !== null">
        <div class="text-bold"><q-icon name="warning" color="red" />&nbsp; Haircut Conditions Apply:</div>
        <div>Formula for redemption price during a haircut :</div>
        <div><code>(TOTAL ISSUED HIVE x INTERNAL MARKET PRICE) /  (10 x TOTAL ISSUED HBD)</code></div>
        <div><code>({{ parseFloat(globalProps.current_supply.split(' ')[0]) }} * {{ parseFloat(medianPrice.base.split(' ')[0]) / parseFloat(medianPrice.quote.split(' ')[0]) }}) / (10 x {{ globalProps.current_hbd_supply }})</code></div>
        <div>Redemption price during haircut : {{ (parseFloat(globalProps.current_supply.split(' ')[0]) * (parseFloat(medianPrice.base.split(' ')[0])) / parseFloat(medianPrice.quote.split(' ')[0])) / (10 * parseFloat(globalProps.current_hbd_supply.split(' ')[0])) }}</div>
      </q-card-section>
    </q-card>
    <coingecko :coins="['hive_dollar']" />
  </q-page>
</template>
<style scoped>
a {text-decoration: none; color: #1d8ce0 }
a:link { color: #1d8ce0; font-weight: normal; text-decoration: none; }
a:visited { color: #1d8ce0; }
</style>
<script>
import { debounce } from 'quasar'
import coingecko from 'components/coingecko.vue'
export default {
  name: 'hbd',
  data () {
    return {
      medianPrice: null,
      daoHbdBalance: 6177747 // hive.fund HBD balance as of Thu 23 Sep 2021 08:12:40 AM CEST
    }
  },
  components: { coingecko },
  computed: {
    globalProps: {
      get () {
        return this.$store.state.hive.globalProps
      }
    },
    percentColor: function () {
      if ((this.percentCap) >= 9) {
        return 'red'
      } else if ((this.percentCap) >= 8) {
        return 'orange'
      } else {
        return 'green'
      }
    },
    hbdAprColor: function () {
      if ((this.hbdApr) === 0) {
        return 'red'
      } else if ((this.hbdApr) === 1) {
        return 'orange'
      } else {
        return 'green'
      }
    },
    hbdApr: function () {
      if (this.globalProps !== undefined) {
        return this.globalProps.hbd_interest_rate / 100
      } else {
        return null
      }
    },
    hiveCap: function () {
      if (this.globalProps !== undefined && this.medianPrice !== null) {
        return parseFloat(parseFloat(this.globalProps.virtual_supply.split(' ')[0]) * (parseFloat(this.medianPrice.base.split(' ')[0])).toFixed(3) / parseFloat(this.medianPrice.quote.split(' ')[0])).toFixed(3)
      } else {
        return null
      }
    },
    hbdCap: function () {
      if (this.globalProps.current_hbd_supply !== undefined) {
        return (parseFloat(this.globalProps.current_hbd_supply.split(' ')[0]) - parseFloat(this.daoHbdBalance)).toFixed(3) // HF24 Ignores DAO HBD in debt calculations
      } else {
        return null
      }
    },
    percentCap: function () {
      return parseFloat((this.hbdCap / this.hiveCap) * 100).toFixed(3)
    },
    haircutPrice: function () {
      return parseFloat((this.hbdCap * 10) / parseFloat(this.globalProps.virtual_supply.split(' ')[0])).toFixed(4)
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
      this.$hive.api.getCurrentMedianHistoryPriceAsync()
        .then((response) => {
          this.medianPrice = response
        })
        .catch(() => {
          console.log('Failed to get median price - retrying')
          debounce(this.getMedianPrice(), 50)
        })
    },
    getDaoBalance () {
      this.$hive.api.getAccountsAsync(['hive.fund'])
        .then((response) => {
          this.daoHbdBalance = response[0].hbd_balance.split(' ')[0]
        })
        .catch(() => console.log('Failed to load @hive.fund profile'))
    }
  },
  mounted () {
    document.title = 'Hive Dollar Monitor'
    this.getDaoBalance()
    this.getMedianPrice()
  },
  created () {
    this.$store.dispatch('hive/getGlobalProps')
  }
}
</script>
