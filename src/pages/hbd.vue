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
        Hive Backed Dollars are a stablecoin used on the Hive network. They are "backed" by the networks ability to convert them into $1 USD worth of HIVE.<br />
        There are constraints on HBD creation within the blockchain rules to help keep the Hive economy healthy.<br />
        This page helps track relevant info about HBD
      </q-card-section>
      <q-separator />
      <q-card-section v-if="percentCap < hbdCapRatio">
        <div class="text-h6"><q-icon name="check" color="green" />&nbsp; Normal Conditions Apply:</div>
        <div class="text-subtitle">Redeem each HBD for $1 of HIVE at 3.5 day avg market price <q-badge color="primary">${{ (medianPrice.base.split(' ')[0] / parseFloat(medianPrice.quote.split(' ')[0])).toFixed(4) }}</q-badge></div>
      </q-card-section>
      <q-card-section v-if="percentCap > hbdCapRatio && medianPrice !== null">
        <div class="text-bold"><q-icon name="warning" color="red" />&nbsp; Haircut Conditions Apply:</div>
        <div>Formula for redemption price during a haircut:</div>
        <div><code>(HBD_supply x Median_Price) / (HIVE_supply x {{hbdCapRatio}}/100)</code></div>
        <div v-if="haircutPriceDisplay"><code>({{ haircutPriceDisplay.hbdSupply }} x {{ haircutPriceDisplay.medianPrice }}) / ({{ haircutPriceDisplay.hiveSupply }} x {{hbdCapRatio}}/100)</code></div>
        <div v-if="haircutPriceDisplay">Redemption price: {{ haircutPriceDisplay.result.toFixed(4) }}</div>
      </q-card-section>
      <q-separator />
      <q-card-section>
        <div class="text-h6"><q-icon name="price_change" color="grey" />&nbsp; HBD Marketcap must be below {{hbdCapRatio}}% of HIVE marketcap</div>
        <div class="text-subtitle2">(The Debt Limit)</div>
        <div v-if="hiveCap && hbdCap">
          <div>HBD Marketcap = <b>${{ tidyNumber(hbdCap) }}</b></div>
          <div>HIVE Marketcap = <b>${{ tidyNumber(hiveCap) }}</b></div>
          <div><q-linear-progress stripe size="10px" :value="percentCap / hbdCapRatio" :color="percentColor" /></div>
          <div>HBD Marketcap is currently <q-badge :color="percentColor">{{ percentCap }} %</q-badge> of HIVE Marketcap</div>
          <div v-if="medianPrice !== null">HIVE median price must stay above <q-badge color="primary">${{ haircutPrice }}</q-badge> to avoid haircut (currently <q-badge color="primary">${{ (medianPrice.base.split(' ')[0] / parseFloat(medianPrice.quote.split(' ')[0])).toFixed(4) }}</q-badge>)</div>
          <div v-if="internalMarketLatest">Internal market Hive price is <q-badge color="primary">${{ internalMarketLatest }}</q-badge></div>
        </div>
        <div v-else>
          <q-skeleton type="rect" height="50" />
        </div>
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
        <div class="text-subtitle2">Using overvalued HBD to buy HIVE for the DAO</div>
        <p><router-link to="hbdstabilizer"><q-icon name="info" color="blue" />&nbsp; Learn more about the HBD Stabilizer over here</router-link></p>
      </q-card-section>
      <q-separator />
      <q-card-section v-if="globalProps.hbd_print_rate !== 10000">
        <div class="text-h6"><q-icon name="warning" color="orange" />&nbsp; HBD creation reduced</div>
        <div class="text-subtitle">The HBD "Print Rate" has been reduced to <q-badge :color="percentColor">{{ globalProps.hbd_print_rate / 100 }} %</q-badge></div>
        <p><router-link to="@arcange/understanding-the-hive-debt-ratio"><q-icon name="info" color="blue" />&nbsp; Learn more about the HBD Print Rate here</router-link></p>
      </q-card-section>
      <q-separator v-if="globalProps.hbd_print_rate !== 10000" />
      <q-card-section>
        <div class="text-h6"><q-icon name="shopping_cart" color="blue" />&nbsp; How can I get HBD ?</div>
        <div class="text-subtitle">1) Earn HBD by posting popular original content on HIVE</div>
        <div class="text-subtitle">2) Purchase HBD on external exchanges like <a href="https://blocktrades.us/en/?affiliate_id=24923543-4939-4ab2-b0d5-d190f4fb82dc" target="blank">BlockTrades</a>, <a href="https://global.bittrex.com/Account/Register?referralCode=PPA-HMA-3VD" target="_blank">Bittrex</a> or <a href="https://sg.upbit.com" target="_blank">Upbit</a></div>
        <div class="text-subtitle">3) Exchange HIVE for HBD using the <router-link to="/market">internal market</router-link>, or convert them in your wallet.</div>
      </q-card-section>
      <q-separator />
      <q-card-section>
        <div class="text-h6"><q-icon name="quiz" color="pink" />&nbsp; Why HBD ?</div>
        <div class="text-subtitle">1) A fully decentralized stable coin pegged to USD.</div>
        <div class="text-subtitle" v-if="hbdApr && hbdApr > 0">2) Industry leading APR of <q-badge :color="hbdAprColor">{{ hbdApr }}%</q-badge></div>
        <div class="text-subtitle">3) Integrated in a large <a href="https://hive.io/eco" target="_blank">ecosystem of Dapps</a>.</div>
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
      daoHbdBalance: 23436695, // hive.fund HBD balance (updated Feb 2025)
      internalMarketLatest: null,
      hbdCapRatio: 30
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
      if ((this.percentCap) >= 25) {
        return 'red'
      } else if ((this.percentCap) >= 20) {
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
    // Median price in HIVE per HBD (e.g., 0.072 = 0.072 HIVE for 1 HBD)
    medianPriceHIVE: function () {
      if (this.medianPrice !== null) {
        return parseFloat(this.medianPrice.base.split(' ')[0]) / parseFloat(this.medianPrice.quote.split(' ')[0])
      } else {
        return null
      }
    },
    // Current HIVE supply converted to HBD value
    hiveSupplyAsHBD: function () {
      if (this.globalProps !== undefined && this.medianPriceHIVE !== null) {
        return parseFloat(this.globalProps.current_supply.split(' ')[0]) * this.medianPriceHIVE
      } else {
        return null
      }
    },
    // Total HBD supply (incl treasury) converted to HBD value
    totalHBDAsHBD: function () {
      if (this.globalProps !== undefined) {
        return parseFloat(this.globalProps.current_hbd_supply.split(' ')[0])
      } else {
        return null
      }
    },
    // HBD excluding treasury (as HBD value)
    hbdCap: function () {
      if (this.totalHBDAsHBD !== null) {
        return (this.totalHBDAsHBD - this.daoHbdBalance).toFixed(3) // HF24: Treasury HBD excluded from debt calculations
      } else {
        return null
      }
    },
    // Total for debt ratio = HBD_excl + HIVE_supply_as_HBD
    totalForDebtRatio: function () {
      return parseFloat(this.hbdCap) + this.hiveSupplyAsHBD
    },
    // Debt ratio per dalz's formula: HBD_excl / (HBD_excl + HIVE_supply_as_HBD)
    percentCap: function () {
      if (this.hbdCap !== null && this.totalForDebtRatio !== null) {
        return parseFloat((parseFloat(this.hbdCap) / this.totalForDebtRatio) * 100).toFixed(3)
      } else {
        return null
      }
    },
    // HIVE Market Cap = Current Supply * Median Price (in USD)
    hiveCap: function () {
      if (this.globalProps !== undefined && this.medianPriceHIVE !== null) {
        return (parseFloat(this.globalProps.current_supply.split(' ')[0]) * this.medianPriceHIVE).toFixed(3)
      } else {
        return null
      }
    },
    // Haircut price threshold: median price at which debt would reach 30%
    // debt_ratio = HBD_excl / (HBD_excl + HIVE_supply * price)
    // At 30%: 0.30 = HBD_excl / (HBD_excl + HIVE_supply * price)
    // 0.30 * (HBD_excl + HIVE_supply * price) = HBD_excl
    // 0.30 * HBD_excl + 0.30 * HIVE_supply * price = HBD_excl
    // 0.30 * HIVE_supply * price = HBD_excl * (1 - 0.30)
    // price = (HBD_excl * 0.70) / (0.30 * HIVE_supply)
    haircutPrice: function () {
      if (this.globalProps !== undefined && this.medianPriceHIVE !== null) {
        const hiveSupply = parseFloat(this.globalProps.current_supply.split(' ')[0])
        const hbdExcl = parseFloat(this.hbdCap)
        // At 30% debt ratio: price = (HBD_excl * 0.7) / (0.3 * HIVE_supply)
        return ((hbdExcl * 0.7) / (0.3 * hiveSupply)).toFixed(4)
      } else {
        return null
      }
    },
    haircutPriceDisplay: function () {
      if (this.globalProps !== undefined && this.medianPriceHIVE !== null) {
        const hiveSupply = parseFloat(this.globalProps.current_supply.split(' ')[0]) / 1000
        const hbdSupply = parseFloat(this.globalProps.current_hbd_supply.split(' ')[0]) / 1000
        const median = this.medianPriceHIVE
        return {
          hbdSupply: hbdSupply.toFixed(0),
          medianPrice: median.toFixed(4),
          hiveSupply: hiveSupply.toFixed(0),
          result: (hbdSupply * median) / (hiveSupply * this.hbdCapRatio / 100)
        }
      } else {
        return null
      }
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
    },
    getTicker () {
      this.$hive.api.getTickerAsync()
        .then(res => { this.internalMarketLatest = parseFloat(res.latest).toFixed(2) })
    }
  },
  mounted () {
    document.title = 'Hive Dollar Monitor'
    this.getDaoBalance()
    this.getMedianPrice()
    this.getTicker()
  },
  created () {
    this.$store.dispatch('hive/getGlobalProps')
  }
}
</script>
