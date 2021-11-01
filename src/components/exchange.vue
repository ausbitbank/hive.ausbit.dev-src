<template>
  <span>
  <q-dialog persistent class="text-bold" v-model="showErrorDialog">
    <q-card flat bordered class="q-pa-sm">
      <q-icon name="warning" color="orange" size="md" />
          {{ error }}
          <q-btn label="Dismiss" @click="error = null" q-close-dialog />
    </q-card>
  </q-dialog>
  <q-card flat bordered class="text-center" style="max-width: 600px" v-if="step === 1">
    <q-card-section header v-if="step === 1">
        <div class="text-center text-title text-h5">Exchange <q-badge color="primary" v-if="currencies.length > 0">{{ currencies.length }}</q-badge> tokens</div>
        <div class="text-caption">Use this form to swap between cryptocurrencies</div>
    </q-card-section>
    <q-card-section v-if="step === 1">
        <q-list separator>
            <q-item class="q-mb-md">
                <q-item-section>
                    <q-select filled label="Send this Token" :options="optionsFrom" v-model="tradeFrom" clearable options-selected-class="text-primary" use-input input-debounce="0" @filter="filterFrom" @input="updateToken" :loading="loading.currencies">
                      <template v-slot:before v-if="tradeFrom"><q-avatar><q-img :src="getTokenImage(tradeFrom)" :title="tradeFrom"/></q-avatar></template>
                      <template v-slot:after v-if="tradeFrom && tradeTo"><q-input class="q-pt-md" label="Amount" v-model.number="tradeFromAmount" type="number" :rules="[ val => val > minAmount || 'Minimum trade is ' + minAmount + ' ' + tradeFrom, error !== null || error, ]" :loading="loading.minAmount" :debounce="2000" :readonly="loading.minAmount" @input="updateTradeFromAmount()" clearable /></template>
                    </q-select>
                </q-item-section>
            </q-item>
            <q-item class="text-center" v-if="tradeFrom || tradeTo">
              <q-btn flat icon="swap_vert" size="md" color="primary" @click="swapTokens()" title="Swap token positions" />
            </q-item>
            <q-item>
                <q-item-section>
                    <q-select filled label="Receive this Token" :options="optionsTo" v-model="tradeTo" clearable options-selected-class="text-primary" use-input input-debounce="0" @filter="filterTo" @input="updateToken" :loading="loading.currencies">
                      <template v-slot:before v-if="tradeTo"><q-avatar><q-img :src="getTokenImage(tradeTo)" :title="tradeTo" /></q-avatar></template>
                    </q-select>
                </q-item-section>
                <q-item-section side v-if="tradeTo && tradeToAmount">
                    <q-input label="Amount" readonly v-model="tradeToAmount" :hint="'Receive ~' + tidyNumber(tradeToAmount) + ' ' + tradeTo" :loading="loading.quote" />
                </q-item-section>
            </q-item>
        </q-list>
    </q-card-section>
    <q-card-section v-if="!error && tradeFromAmount > minAmount && tradeToAmount && tradeFrom && tradeTo">
        <div class="text-center text-title text-h5">
            <q-input v-model="tradeToAddress" :label="'Receiving Address : ' + tradeTo" :rules="[val => !!val || 'Receiving address is required', val => val.trim() !== '' || 'Receiving address is required']" />
        </div>
        <div class="text-center text-title text-h5" v-if="quote">Trade confirmation</div>
        Swap <q-badge color="primary" class="text-bold">{{ tidyNumber(tradeFromAmount) }}</q-badge> <q-avatar size="sm"><img :src="getTokenImage(tradeFrom)" /></q-avatar> <b>{{ tradeFrom }}</b>
        for ~<q-badge color="primary">{{ tidyNumber(tradeToAmount) }}</q-badge> <q-avatar size="sm"><img :src="getTokenImage(tradeTo)" /></q-avatar> <b>{{ tradeTo }}</b><br />
        <div v-if="tradeToAddress !== ''">Send that <q-avatar size="sm"><img :src="getTokenImage(tradeTo)" /></q-avatar> <b>{{ tradeTo }}</b> to <i>{{ tradeToAddress }}</i></div>
        <q-expansion-item dense icon="data_object" v-if="quote" label="Full quote"><json-viewer :data="quote" /></q-expansion-item>
        <q-separator dark />
    </q-card-section>
    <q-card v-if="tradeFrom && tradeTo" flat bordered class="q-pa-sm q-ma-sm"><q-checkbox class="text-caption" v-model="termsAndConditions">I have read and I agreed to the Changelly <a href="https://changelly.com/terms-of-use" target="_blank">terms of use</a> and <a href="https://changelly.com/privacy-policy">privacy policy</a>.<br />By checking this box, I acknowledge and understand that my transaction may trigger AML/KYC verification according to Changelly <a href="https://changelly.com/aml-kyc">AML/KYC</a></q-checkbox></q-card>
    <q-card-actions align="around">
        <q-btn flat label="Go Back" color="red" icon="arrow_back" @click="reset()" v-if="tradeFrom || tradeTo"/>
        <q-btn flat label="Continue" color="primary" icon-right="arrow_forward" :disable="!termsAndConditions || error !== null || tradeToAddress === null || tradeToAddress.trim() === ''" @click="createTransaction (tradeFrom, tradeTo, tradeToAddress, tradeFromAmount)" v-if="tradeFrom || tradeTo"/>
    </q-card-actions>
  </q-card>
  <q-dialog v-if="transaction" v-model="showTransactionDialog" persistent>
    <q-card flat bordered>
        <q-card-section header class="text-heading text-h5 text-center">
            Payment Request
        </q-card-section>
        <q-card-section>
            Please transfer:
            <q-input readonly v-model="transaction.amountExpectedFrom">
              <template v-slot:append><q-btn flat icon="content_copy" @click="copy(transaction.amountExpectedFrom)" /></template>
              <template v-slot:after><q-avatar><q-img :src="getTokenImage(transaction.currencyFrom)" /></q-avatar> {{ transaction.currencyFrom }}</template>
            </q-input>
            To this {{ transaction.currencyFrom }} address:
            <q-input readonly v-model="transaction.payinAddress">
              <template v-slot:after><q-btn flat icon="content_copy" @click="copy(transaction.payinAddress)" /></template>
            </q-input>
            <div v-if="transaction.payinExtraId">
              <q-input v-model="transaction.payinExtraId" label="Payment Address Extra ID / MEMO">
                <template v-slot:append><q-btn flat icon="content_copy" @click="copy(transaction.amountExpectedFrom)" /></template>
              </q-input>
            </div>
        </q-card-section>
        <q-separator />
        <q-card-section v-if="loggedInUser && transaction.currencyFrom === 'hive'" class="text-center text-bold">
          {{ loggedInUser }}'s balance <q-badge color="primary">{{ account.balance.split(' ')[0] }}</q-badge> <q-avatar size="sm"><q-img src="/statics/hive.svg" title="HIVE" /></q-avatar>
          <q-btn @click="transferNeededHive()" push icon="send" no-caps color="primary" :disable="transaction.status !== 'waiting' || transaction.moneyReceived > 0 || parseFloat(account.balance.split(' ')[0]) < transaction.amountExpectedFrom || disableTransferButton">Transfer {{ transaction.amountExpectedFrom }} HIVE to {{ transaction.payinAddress }} with memo {{ transaction.payinExtraId }}</q-btn>
        </q-card-section>
        <q-separator v-if="loggedInUser && tradeFrom === 'hive'" />
        <q-card-section>
          <q-input readonly label="Exchange Id (For support purposes)" v-model="transaction.id"><template v-slot:after><q-btn flat icon="content_copy" @click="copy(transaction.id)" /><q-btn flat icon="open_in_new" @click="openNewWindow(getExchangeIdUrl(transaction.id))" title="Open exchange status in new window"/></template></q-input>
          <q-input readonly label="Exchange Status" v-model="transaction.status"><template v-slot:after><q-btn flat icon="refresh" label="Refresh Status" color="primary" @click="getStatus(transaction.id)"/></template></q-input>
          <span class="q-ma-sm text-bold text-title text-center">
          <q-card flat bordered v-if="transaction.status === 'waiting'">Transaction is waiting for an incoming payment.</q-card>
          <q-card flat bordered v-if="transaction.status === 'confirming'">We have received payin and are waiting for certain amount of confirmations depending of incoming currency.</q-card>
          <q-card flat bordered v-if="transaction.status === 'exchanging'">Payment was confirmed and is being exchanged.</q-card>
          <q-card flat bordered v-if="transaction.status === 'sending'">Coins are being sent to the recipient address.</q-card>
          <q-card flat bordered v-if="transaction.status === 'finished'">Coins were successfully sent to the recipient address.</q-card>
          <q-card flat bordered v-if="transaction.status === 'failed'">Transaction has failed. In most cases, the amount was less than the minimum. Please contact support and provide a transaction id.</q-card>
          <q-card flat bordered v-if="transaction.status === 'refunded'">Exchange failed and coins were refunded to user's wallet. The wallet address should be provided by user.</q-card>
          <q-card flat bordered v-if="transaction.status === 'hold'">Due to AML/KYC procedure, exchange may be delayed</q-card>
          <q-card flat bordered v-if="transaction.status === 'expired'">In case payin for fixed-rate transaction was not sent within the indicated timeframe</q-card>
          </span>
        </q-card-section>
        <q-card-section>
            <q-expansion-item dense label="Full Transaction Metadata" icon="data_object">
                <json-viewer :data="transaction" />
            </q-expansion-item>
        </q-card-section>
        <q-card-section>
          <q-input label="Payout Address" v-model="transaction.payoutAddress" readonly>
            <template v-slot:after>
              {{ transaction.currencyTo }} <q-avatar><q-img :src="getTokenImage(transaction.currencyTo)" :title="transaction.currencyTo"/></q-avatar>
            </template>
          </q-input>
        </q-card-section>
        <q-card-actions align="around">
            <q-btn flat label="Exit/Abort" color="red" icon="warning" @click="transaction = null" />
        </q-card-actions>
    </q-card>
  </q-dialog>
  </span>
</template>
<script>
import { copyToClipboard } from 'quasar'
export default {
  name: 'exchange',
  data () {
    return {
      api: 'https://exchange-api.ausbit.dev',
      tradeFrom: this.$route.query.from || null,
      tradeTo: this.$route.query.to || 'hive',
      tradeFromAmount: null,
      tradeToAmount: null,
      tradeToAddress: this.$route.query.address || null,
      optionsFrom: [],
      optionsTo: [],
      currencies: [],
      minAmount: null,
      quote: null,
      termsAndConditions: false,
      loading: {
        minAmount: false,
        quote: false,
        currencies: false,
        transaction: false
      },
      transaction: null,
      // transaction: { id: 'jua50lg8jbw4x8fo', apiExtraFee: '0', changellyFee: '0.4', payinExtraId: null, payoutExtraId: 'via ausbit.dev', amountExpectedFrom: 0.003, status: 'new', currencyFrom: 'btc', currencyTo: 'hive', amountTo: 0.000, amountExpectedTo: 223.875, payinAddress: '3GtFp5e7Bw3fhkywsh1Mtoaf76fUps7Xqx', payoutAddress: 'ausbitbank', createdAt: '2021-10-31T16:41:20.000Z', redirect: null, kycRequired: false, signature: null, binaryPayload: null },
      error: null,
      step: 1,
      exchangeId: this.$route.query.id || null,
      disableTransferButton: false
    }
  },
  components: {
    jsonViewer: () => import('components/jsonViewer.vue')
  },
  methods: {
    getCurrencies () {
      this.loading.currencies = true
      this.$axios.get(this.api + '/getCurrencies')
        .then((res) => {
          this.currencies = res.data.result.sort()
          this.loading.currencies = false
        })
    },
    getMinAmount (from, to) {
      this.minAmount = null
      this.loading.minAmount = true
      this.tradeToAmount = null
      this.$axios.post(this.api + '/getMinAmount', { from: from, to: to })
        .then((res) => { this.minAmount = res.data.result; this.tradeFromAmount = this.minAmount; this.getExchangeAmount(this.tradeFrom, this.tradeTo, this.tradeFromAmount); this.loading.minAmount = false })
    },
    filterFrom (val, update) {
      if (val === '') { update(() => { this.optionsFrom = this.currencies.filter(v => v !== this.tradeTo) }); return }
      update(() => { var needle = val.toLowerCase(); this.optionsFrom = this.currencies.filter(v => v.toLowerCase().indexOf(needle) > -1).filter(v => v !== this.tradeTo) })
    },
    filterTo (val, update) {
      if (val === '') { update(() => { this.optionsTo = this.currencies.filter(v => v !== this.tradeFrom) }); return }
      update(() => { var needle = val.toLowerCase(); this.optionsTo = this.currencies.filter(v => v.toLowerCase().indexOf(needle) > -1).filter(v => v !== this.tradeFrom) })
    },
    reset () { this.tradeFrom = null; this.tradeTo = null; this.minAmount = null; this.tradeFromAmount = null; this.tradeToAmount = null; this.quote = null; this.termsAndConditions = false; this.step = 1 },
    getTokenImage (token) { return 'https://web-api.changelly.com/api/coins/' + token.toLowerCase() + '.png' },
    getExchangeAmount (from, to, amount) {
      this.loading.quote = true
      this.tradeToAmount = null
      this.$axios.post(this.api + '/getExchangeAmount', { from: from, to: to, amount: amount })
        .then((res) => {
          if (res.data.error) { this.error = res.data.error.message } else { this.quote = res.data.result[0]; this.tradeToAmount = this.quote.result }; this.loading.quote = false
        })
    },
    createTransaction (from, to, address, amount) {
      this.transaction = null
      this.loading.transaction = true
      this.$axios.post(this.api + '/createTransaction', { from: from, to: to, address: address, amount: amount })
        .then((res) => {
          if (res.data.error) {
            this.error = res.data.error.message
            if (this.error === 'Invalid address') { this.tradeToAddress = '' }
          } else { this.transaction = res.data.result }
          this.loading.transaction = false
        })
    },
    getStatus (id) {
      this.$axios.post(this.api + '/getStatus', { id: id })
        .then((res) => {
          if (res.data.error) { this.error = res.data.error.message } else { this.transaction.status = res.data.result }
        })
    },
    getTransaction (id) {
      this.$axios.post(this.api + '/getTransaction', { id: id })
        .then((res) => {
          console.log(res.data)
          if (res.data.error) { this.error = res.data.error.message } else { this.transaction = res.data.result[0] }
        })
    },
    updateToken () {
      this.error = null
      if (this.$route.query.to === this.tradeTo && this.$route.query.address) {
        this.tradeToAddress = this.$route.query.address
      } else {
        this.tradeToAddress = null
      }
      this.tradeToAmount = null
      if (this.tradeFrom && this.tradeTo && this.tradeFrom !== this.tradeTo) {
        this.tradeFromAmount = 0
        this.minAmount = null
        this.getMinAmount(this.tradeFrom, this.tradeTo)
      }
    },
    updateTradeFromAmount () {
      this.error = null
      if (this.tradeFromAmount > this.minAmount) {
        this.getExchangeAmount(this.tradeFrom, this.tradeTo, this.tradeFromAmount)
      }
    },
    tidyNumber (x) { if (x) { var parts = x.toString().split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return parts.join('.') } else { return null } },
    swapTokens () { var x = this.tradeFrom; this.tradeFrom = this.tradeTo; this.tradeTo = x; this.updateToken() },
    copy (what) { copyToClipboard(what); this.$q.notify('Copied to clipboard: ' + what) },
    getExchangeIdUrl (id) { return 'https://hive.ausbit.dev/exchange?id=' + id },
    openNewWindow (url) { window.open(url, '_blank') },
    transferNeededHive () {
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'active', ['transfer', { to: this.transaction.payinAddress, from: this.loggedInUser, amount: this.transaction.amountExpectedFrom + ' HIVE', memo: this.transaction.payinExtraId }]])
      this.disableTransferButton = true
    }
  },
  computed: {
    loggedInUser: function () { return this.$store.state.hive.user.username },
    showTransactionDialog: function () { if (this.transaction !== null) { return true } else { return false } },
    showErrorDialog: function () { if (this.error !== null) { return true } else { return false } },
    account: {
      cache: false,
      get () { if (this.loggedInUser) { return this.$store.state.hive.accounts[this.loggedInUser] } else { return null } }
    }
  },
  watch: {
    loggedInUser: function () { if (this.account === null && this.loggedInUser) { this.$store.dispatch('hive/getAccount', this.loggedInUser) } }
  },
  mounted () {
    this.getCurrencies()
    if (this.exchangeId) { this.getTransaction(this.exchangeId) }
    if (this.tradeFrom && this.tradeTo) { this.updateToken() }
    if (this.account === null && this.loggedInUser) { this.$store.dispatch('hive/getAccount', this.loggedInUser) }
  }
}
</script>
