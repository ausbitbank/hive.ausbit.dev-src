<template>
  <span>
  <q-dialog persistent class="text-bold" v-model="showErrorDialog">
    <q-card flat bordered class="q-pa-sm">
      <q-icon name="warning" color="orange" size="md" />
          {{ error }}
          <q-btn label="Dismiss" @click="error = null" q-close-dialog />
    </q-card>
  </q-dialog>
  <q-card flat bordered class="text-center" style="max-width: 600px" v-if="!showTransactionDialog">
    <q-card-section header>
        <div class="text-center text-title text-h5">Exchange <q-badge color="primary" v-if="currencies.length > 0">{{ currencies.length }}</q-badge> tokens</div>
        <div class="text-caption">Use this form to swap between cryptocurrencies</div>
    </q-card-section>
    <q-card-section>
        <q-list separator>
            <q-item class="q-mb-md">
                <q-item-section>
                    <q-select label="I have" :options="optionsFrom" v-model="tradeFrom" clearable options-selected-class="text-primary" use-input input-debounce="0" @filter="filterFrom" @input="updateToken" :loading="loading.currencies" :hint="getTokenChainHint(tradeFrom)" transition-show="scale" transition-hide="scale" :option-value="opt => Object(opt) === opt && 'ticker' in opt ? opt.ticker : null" :option-label="opt => Object(opt) === opt && 'fullName' in opt ? opt.fullName : null" :option-disable="opt => opt.enabled ? false : true" emit-value map-options :display-value="tradeFrom">
                      <template v-slot:prepend v-if="tradeFrom"><q-avatar><q-img :src="getTokenImage(tradeFrom)" :title="tradeFrom"/></q-avatar></template>
                      <template v-slot:after v-if="tradeFrom && tradeTo"><q-input class="q-pt-md" label="Amount" v-model.number="tradeFromAmount" type="number" :rules="[ val => val > minAmount || 'Minimum trade is ' + minAmount + ' ' + tradeFrom, error !== null || error, ]" :loading="loading.minAmount" :debounce="2000" :readonly="loading.minAmount" @input="updateTradeFromAmount()" /></template>
                      <template v-slot:option="scope">
                        <q-item v-bind="scope.itemProps" v-on="scope.itemEvents">
                          <q-item-section avatar>
                            <q-avatar size="sm"><q-img :src="scope.opt.image" /></q-avatar>
                          </q-item-section>
                          <q-item-section>
                            <q-item-label>{{ scope.opt.ticker }}</q-item-label>
                            <q-item-label caption>{{ scope.opt.fullName }}</q-item-label>
                          </q-item-section>
                        </q-item>
                      </template>
                    </q-select>
                </q-item-section>
            </q-item>
            <q-item v-if="tradeFromWarning">{{ tradeFromWarning }}</q-item>
            <q-item class="text-center">
              <q-separator />
              <q-btn no-caps flat icon="swap_vert" size="md" color="primary" @click="swapTokens()" label="Swap positions" v-if="tradeFrom || tradeTo" />
              <q-btn no-caps flat icon="trending_up" label="Buy Hive" @click="tradeTo = 'hive'; tradeFrom = null" color="green" v-if="tradeTo !== 'hive'" />
              <q-btn no-caps flat icon="trending_down" label="Sell Hive" @click="tradeFrom = 'hive'; tradeTo = null" color="red" v-if="tradeFrom !== 'hive'" />
              <q-btn no-caps flat @click="tradeFromAmount = hiveBalance; if (tradeTo && tradeFrom) {updateTradeFromAmount()}" color="orange" v-if="loggedInUser && tradeFrom === 'hive'"><template v-slot:default><q-avatar size="md" class="q-mr-sm"><img :src="getHiveAvatarUrl(loggedInUser)" /></q-avatar> {{ hiveBalance }} HIVE</template></q-btn>
              <q-separator />
            </q-item>
            <q-item>
                <q-item-section>
                    <q-select label="I want" :options="optionsTo" v-model="tradeTo" clearable options-selected-class="text-primary" use-input input-debounce="0" @filter="filterTo" @input="updateToken" :loading="loading.currencies" :hint="getTokenChainHint(tradeTo)" transition-show="scale" transition-hide="scale" :option-value="opt => Object(opt) === opt && 'ticker' in opt ? opt.ticker : null" :option-label="opt => Object(opt) === opt && 'fullName' in opt ? opt.fullName : null" :option-disable="opt => opt.enabled ? false : true" emit-value map-options :display-value="tradeTo">
                      <template v-slot:prepend v-if="tradeTo"><q-avatar><q-img :src="getTokenImage(tradeTo)" :title="tradeTo" /></q-avatar></template>
                      <template v-slot:after v-if="tradeFrom && tradeTo"><q-input class="q-pt-md" label="Amount" v-model.number="tradeToAmount" readonly type="number" @input="updateTradeToAmount()" /></template>
                      <template v-slot:option="scope">
                        <q-item v-bind="scope.itemProps" v-on="scope.itemEvents">
                          <q-item-section avatar>
                            <q-avatar size="sm"><img :src="scope.opt.image" /></q-avatar>
                          </q-item-section>
                          <q-item-section>
                            <q-item-label>{{ scope.opt.ticker }}</q-item-label>
                            <q-item-label caption>{{ scope.opt.fullName }}</q-item-label>
                          </q-item-section>
                        </q-item>
                      </template>
                    </q-select>
                </q-item-section>
            </q-item>
            <q-item v-if="tradeToWarning">{{ tradeToWarning }}</q-item>
        </q-list>
    </q-card-section>
    <q-card-section v-if="this.for && userMetaTokens !== []" class="q-ma-sm">
      <div class="text-title text-bold"><router-link :to="getUserLink(this.for)"><q-avatar size="sm"><img :src="getHiveAvatarUrl(this.for)" /></q-avatar> {{ this.for }}</router-link>'s token addresses</div>
        <q-card flat>
          <q-list dense separator>
            <q-list v-for="token in Object.keys(userMetaTokens)" :key="token.index" dense>
              <q-item>
                <q-list dense separator bordered>
                  <q-item v-for="address in userMetaTokens[token]" :key="address.index" class="text-center text-weight-light" clickable @click="tradeTo = token; tradeToAddress = address; copy(address); updateToken()">
                    <q-item-section avatar><q-avatar size="sm"><q-img :src="getTokenImage(token)" :title="token" /></q-avatar></q-item-section>
                    <q-item-section>{{ address }}</q-item-section>
                  </q-item>
                </q-list>
              </q-item>
            </q-list>
          </q-list>
        </q-card>
    </q-card-section>
    <q-card-section v-if="!error && tradeFromAmount >= minAmount && tradeToAmount && tradeFrom && tradeTo">
        <div class="text-center text-title text-h5">
            <q-input v-model="tradeToAddress" label="Receiving Address" :rules="[val => !!val || 'Receiving address is required', val => val.trim() !== '' || 'Receiving address is required']"><template v-slot:prepend><q-avatar><img :src="getTokenImage(tradeTo)"></q-avatar></template></q-input>
            <q-input v-model="tradeToExtraId" :label="getTokenInfo(tradeTo).extraIdName" v-if="['xrp','xlm','eos','ignis','bnb','xmr','ardor','dct','xem','hive'].includes(tradeTo) && getTokenInfo(tradeTo).extraIdName !== null"><template v-slot:prepend><q-avatar><img :src="getTokenImage(tradeTo)"></q-avatar></template></q-input>
            <q-input v-model="refundAddress" :label="'Refund Address (optional)'"><template v-slot:prepend><q-avatar><img :src="getTokenImage(tradeFrom)"></q-avatar></template></q-input>
        </div>
        <div class="text-center text-title text-h5" v-if="quote">Trade confirmation</div>
        Swap <q-badge color="primary" class="text-bold">{{ tidyNumber(tradeFromAmount) }}</q-badge> <q-avatar size="sm"><img :src="getTokenImage(tradeFrom)" /></q-avatar> <b>{{ tradeFrom }}</b>
        for ~<q-badge color="primary">{{ tidyNumber(tradeToAmount) }}</q-badge> <q-avatar size="sm"><img :src="getTokenImage(tradeTo)" /></q-avatar> <b>{{ tradeTo }}</b><br />
        <div v-if="tradeToAddress !== '' && tradeToAddress !== null">Send that <q-avatar size="sm"><img :src="getTokenImage(tradeTo)" /></q-avatar> <b>{{ tradeTo }}</b> to <i>{{ tradeToAddress }}</i></div>
        <q-expansion-item dense icon="data_object" v-if="quote" label="Full quote"><json-viewer :data="quote" /></q-expansion-item>
        <q-separator dark />
    </q-card-section>
    <q-card v-if="tradeFrom && tradeTo" flat bordered class="q-pa-sm q-ma-sm"><q-checkbox class="text-caption" v-model="termsAndConditions">I have read and I agreed to the Changelly <a href="https://changelly.com/terms-of-use" target="_blank">terms of use</a> and <a href="https://changelly.com/privacy-policy">privacy policy</a>.<br />By checking this box, I acknowledge and understand that my transaction may trigger AML/KYC verification according to Changelly <a href="https://changelly.com/aml-kyc">AML/KYC</a></q-checkbox></q-card>
    <q-card-actions align="around">
        <q-btn flat label="Go Back" color="red" icon="arrow_back" @click="reset()" v-if="tradeFrom || tradeTo"/>
        <q-btn flat label="Continue" color="primary" icon-right="arrow_forward" :disable="!termsAndConditions || error !== null || tradeToAddress === null || tradeToAddress.trim() === ''" @click="createTransaction (tradeFrom, tradeTo, tradeToAddress, tradeFromAmount)" v-if="tradeFrom || tradeTo"/>
    </q-card-actions>
  </q-card>
  <div v-if="showTransactionDialog">
    <q-card flat bordered>
        <q-card-section header class="text-heading text-h5 text-center">
            {{ transaction.status === 'finished' ? 'Exchange Complete!' : 'Payment Request' }}
        </q-card-section>
        <q-card-section v-if="!['finished','sending','exchanging','confirming'].includes(transaction.status)">
            Please transfer:
            <q-input readonly v-model="transaction.amountExpectedFrom">
              <template v-slot:append><q-btn flat icon="content_copy" @click="copy(transaction.amountExpectedFrom)" /></template>
              <template v-slot:after><q-avatar><q-img :src="getTokenImage(transaction.currencyFrom)" /></q-avatar> {{ transaction.currencyFrom }}</template>
            </q-input>
            To this {{ transaction.currencyFrom }} address:
            <q-input readonly v-model="transaction.payinAddress">
              <template v-slot:append><q-btn flat icon="content_copy" @click="copy(transaction.payinAddress)" /></template>
            </q-input>
            <div v-if="transaction.payinExtraId">
              <q-input readonly v-model="transaction.payinExtraId" label="Payment Address Extra ID / MEMO">
                <template v-slot:append><q-btn flat icon="content_copy" @click="copy(transaction.payinExtraId)" /></template>
              </q-input>
            </div>
        </q-card-section>
        <q-separator />
        <q-card-section v-if="loggedInUser && transaction.currencyFrom === 'hive' && !['finished','sending'].includes(transaction.status)" class="text-center text-bold">
          <div>{{ loggedInUser }}'s balance <q-badge color="primary">{{ account.balance.split(' ')[0] }}</q-badge> <q-avatar size="sm"><q-img src="/statics/hive.svg" title="HIVE" /></q-avatar></div>
          <q-btn @click="transferNeededHive()" push icon="send" dense no-caps color="primary" :disable="['waiting','new'].includes(transaction.status) || transaction.moneyReceived > 0 || parseFloat(account.balance.split(' ')[0]) <= transaction.amountExpectedFrom || disableTransferButton" v-if="!['finished','sending'].includes(transaction.status)">Transfer {{ transaction.amountExpectedFrom }} HIVE to {{ transaction.payinAddress }} with memo {{ transaction.payinExtraId }}</q-btn>
        </q-card-section>
        <q-separator v-if="loggedInUser && tradeFrom === 'hive'" />
        <q-card-section>
          <q-input readonly outlined label="Exchange Id (For support purposes)" v-model="transaction.id"><template v-slot:append><q-btn flat icon="content_copy" @click="copy(transaction.id)" /><q-btn flat icon="open_in_new" @click="openNewWindow(getExchangeIdUrl(transaction.id))" title="Open exchange status in new window"/></template></q-input>
          <q-input readonly outlined label="Exchange Status" v-model="transaction.status" color="green"><template v-slot:append v-if="transaction.status !== 'finished'"><q-btn flat icon="refresh" label="Refresh Status" color="primary" @click="getTransaction(transaction.id)"/></template><template v-slot:append v-else><q-btn flat no-caps title="More Confetti" color="primary" icon="celebration" @click="confetti()"/></template></q-input>
          <span class="q-ma-sm text-bold text-title text-center">
          <q-card flat v-if="transaction.status === 'waiting'">Transaction is waiting for an incoming payment.</q-card>
          <q-card flat v-if="transaction.status === 'confirming'">We have received payin and are waiting for certain amount of confirmations depending of incoming currency.</q-card>
          <q-card flat v-if="transaction.status === 'exchanging'">Payment was confirmed and is being exchanged.</q-card>
          <q-card flat v-if="transaction.status === 'sending'">Coins are being sent to the recipient address.</q-card>
          <q-card flat v-if="transaction.status === 'finished'">Coins were successfully sent to the recipient address</q-card>
          <q-card flat v-if="transaction.status === 'failed'">Transaction has failed. In most cases, the amount was less than the minimum. Please contact support and provide a transaction id. <a href="https://support.changelly.com" target="_blank">support.changechangelly.com</a></q-card>
          <q-card flat v-if="transaction.status === 'refunded'">Exchange failed and coins were refunded to your wallet.</q-card>
          <q-card flat v-if="transaction.status === 'hold'">Due to AML/KYC procedure, exchange may be delayed. Contact support <a href="https://support.changelly.com" target="_blank">support.changechangelly.com</a></q-card>
          <q-card flat v-if="transaction.status === 'expired'">Payin for fixed-rate transaction was not sent within the indicated timeframe</q-card>
          </span>
        <q-card-section>
          <q-input label="Payout Address" v-model="transaction.payoutAddress" readonly outlined>
            <template v-slot:append>
              <q-btn dense v-if="getAddressUrl(transaction.currencyTo)" title="Open address in block explorer" icon="open_in_new" @click="openNewWindow(getAddressUrl(transaction.currencyTo, transaction.payoutAddress))"/> {{ transaction.currencyTo }} <q-avatar><q-img :src="getTokenImage(transaction.currencyTo)" :title="transaction.currencyTo"/></q-avatar>
            </template>
          </q-input>
          <q-input label="Finished Transaction Hash" v-model="transaction.payoutHash" readonly outlined v-if="transaction.payoutHash">
            <template v-slot:append>
              <q-btn icon="open_in_new" @click="openNewWindow(transaction.payoutHashLink)" />
            </template>
          </q-input>
        </q-card-section>
        </q-card-section>
        <q-card-section>
            <q-expansion-item dense label="Full Transaction Metadata" icon="data_object">
                <json-viewer :data="transaction" />
            </q-expansion-item>
        </q-card-section>
        <q-card-actions align="around">
            <q-btn flat no-caps label="Close" :color="transaction.status === 'finished' ? 'primary' : 'red'" icon="logout" @click="transaction = null" />
        </q-card-actions>
    </q-card>
  </div>
  </span>
</template>
<script>
import { copyToClipboard } from 'quasar'
import confetti from 'canvas-confetti'
export default {
  name: 'exchange',
  data () {
    return {
      api: 'https://exchange-api.ausbit.dev',
      tradeFrom: this.$route.query.from || null,
      tradeTo: this.$route.query.to || null,
      tradeFromAmount: null,
      tradeToAmount: null,
      tradeToAddress: this.$route.query.address || null,
      refundAddress: null,
      tradeToExtraId: null,
      optionsFrom: [],
      optionsTo: [],
      currencies: [],
      currenciesFull: [],
      for: this.$route.query.for || this.loggedInUser || null,
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
      lastStatus: null,
      // transaction: { id: 'jua50lg8jbw4x8fo', apiExtraFee: '0', changellyFee: '0.4', payinExtraId: null, payoutExtraId: 'via ausbit.dev', amountExpectedFrom: 0.003, status: 'new', currencyFrom: 'btc', currencyTo: 'hive', amountTo: 0.000, amountExpectedTo: 223.875, payinAddress: '3GtFp5e7Bw3fhkywsh1Mtoaf76fUps7Xqx', payoutAddress: 'ausbitbank', createdAt: '2021-10-31T16:41:20.000Z', redirect: null, kycRequired: false, signature: null, binaryPayload: null },
      error: null,
      exchangeId: this.$route.query.id || null,
      disableTransferButton: false,
      completedTradeSound: 'https://files.ausbit.dev/zoot.mp3'
    }
  },
  components: {
    jsonViewer: () => import('components/jsonViewer.vue')
  },
  methods: {
    getCurrencies () {
      this.$axios.get(this.api + '/getCurrencies')
        .then((res) => {
          this.currencies = res.data.result
          this.loading.currencies = false
        })
    },
    getCurrenciesFull () {
      this.loading.currencies = true
      this.$axios.get(this.api + '/getCurrenciesFull')
        .then((res) => {
          this.currenciesFull = res.data.result.filter(c => c.enabled === true)
          this.loading.currencies = false
        })
    },
    getMinAmount (from, to) {
      this.minAmount = null
      this.loading.minAmount = true
      this.tradeToAmount = null
      this.$axios.post(this.api + '/getMinAmount', { from: from, to: to })
        .then((res) => { this.minAmount = res.data.result; if (this.tradeFromAmount < this.minAmount) { this.tradeFromAmount = this.minAmount }; this.getExchangeAmount(this.tradeFrom, this.tradeTo, this.tradeFromAmount); this.loading.minAmount = false })
    },
    filterFrom (val, update) {
      if (val === '') { update(() => { this.optionsFrom = this.currenciesFull.filter(v => v.ticker !== this.tradeTo) }); return }
      update(() => { var needle = val.toLowerCase(); this.optionsFrom = this.currenciesFull.filter(v => v.ticker.toLowerCase().indexOf(needle) > -1).filter(v => v.ticker !== this.tradeTo) })
    },
    filterTo (val, update) {
      if (val === '') { update(() => { this.optionsTo = this.currenciesFull.filter(v => v.ticker !== this.tradeFrom) }); return }
      update(() => { var needle = val.toLowerCase(); this.optionsTo = this.currenciesFull.filter(v => v.ticker.toLowerCase().indexOf(needle) > -1).filter(v => v.ticker !== this.tradeFrom) })
    },
    reset () { this.tradeFrom = null; this.tradeTo = null; this.minAmount = null; this.tradeFromAmount = null; this.tradeToAmount = null; this.quote = null; this.termsAndConditions = false },
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
      var params = { from: from, to: to, address: address, amount: amount }
      if (this.refundAddress) { params.refundAddress = this.refundAddress; this.refundAddress = null }
      if (this.tradeToExtraId) { params.extraId = this.tradeToExtraId; this.tradeToExtraId = null }
      this.$axios.post(this.api + '/createTransaction', params)
        .then((res) => {
          if (res.data.error) {
            this.error = res.data.error.message
            if (this.error === 'Invalid address') { this.tradeToAddress = '' }
            if (this.error === 'Invalid currency pair') { this.tradeFrom = null }
          } else {
            this.transaction = res.data.result
            this.$router.replace('/exchange?id=' + this.transaction.id)
          }
          this.loading.transaction = false
        })
    },
    getStatus (id) {
      this.$axios.post(this.api + '/getStatus', { id: id })
        .then((res) => {
          if (res.data.error) { this.error = res.data.error.message } else {
            this.transaction.status = res.data.result
            if (this.lastStatus !== this.transaction.status) { this.lastStatus = this.transaction.status }
            // if (this.transaction.status === 'finished') { this.confetti() }
          }
        })
    },
    getTransaction (id) {
      this.$axios.post(this.api + '/getTransaction', { id: id })
        .then((res) => {
          if (res.data.error) { this.error = res.data.error.message } else {
            this.transaction = res.data.result[0]
            if (this.lastStatus !== this.transaction.status) { this.lastStatus = this.transaction.status }
            if (this.transaction.status === 'finished') { this.confetti(); this.playSound() }
          }
        })
    },
    updateToken () {
      this.error = null
      this.tradeToAmount = null
      if (this.tradeFrom && this.tradeTo && this.tradeFrom !== this.tradeTo) {
        // this.tradeFromAmount = 0
        this.minAmount = null
        this.getMinAmount(this.tradeFrom, this.tradeTo)
      }
      if (this.tradeFrom === this.tradeTo) { this.tradeTo = null }
    },
    updateTradeFromAmount () {
      this.error = null
      if (this.tradeFromAmount > this.minAmount) {
        this.getExchangeAmount(this.tradeFrom, this.tradeTo, this.tradeFromAmount)
      }
    },
    tidyNumber (x) { if (x !== null) { var parts = x.toString().split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return parts.join('.') } else { return null } },
    swapTokens () { var x = this.tradeFrom; this.tradeFrom = this.tradeTo; this.tradeTo = x; this.updateToken() },
    copy (what) { copyToClipboard(what); this.$q.notify('Copied to clipboard: ' + what) },
    getExchangeIdUrl (id) { return 'https://hive.ausbit.dev/exchange?id=' + id },
    openNewWindow (url) { window.open(url, '_blank') },
    transferNeededHive () {
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'active', ['transfer', { to: this.transaction.payinAddress, from: this.loggedInUser, amount: parseInt(this.transaction.amountExpectedFrom).toFixed(3) + ' HIVE', memo: this.transaction.payinExtraId }]])
      this.disableTransferButton = true
    },
    getUserLink (user) { return '/@' + user },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    getTokenInfo (token) {
      if (this.currenciesFull.length > 0) {
        return this.currenciesFull.filter(t => t.ticker === token)[0]
      } else { return null }
    },
    getTokenChainHint (token) {
      var ti = this.getTokenInfo(token)
      if (ti !== undefined && ti !== null) {
        var label = ti.fullName + ' on ' + ti.blockchain + ' blockchain (' + ti.protocol + ')'
        return label
      } else { return null }
    },
    getAddressUrl (token, address) {
      var ti = this.getTokenInfo(token)
      if (ti !== undefined && ti !== null) {
        return ti.addressUrl.replace('%1$s', address)
      } else { return null }
    },
    confetti () {
      var duration = 3 * 1000
      var end = Date.now() + duration;
      (function frame () {
        // launch a few confetti from the left edge
        confetti({
          particleCount: 6,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        })
        // and launch a few from the right edge
        confetti({
          particleCount: 6,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        })
        // keep going until we are out of time
        if (Date.now() < end) {
          requestAnimationFrame(frame)
        }
      }())
    },
    playSound () {
      var sound = new Audio(this.completedTradeSound)
      sound.play()
    },
    delay (ms) {
      return new Promise(resolve => setTimeout(resolve, ms))
    },
    async pollStatus () {
      await this.delay(30000)
      await this.getStatus(this.exchangeId)
    }
  },
  computed: {
    loggedInUser: function () { return this.$store.state.hive.user.username },
    showTransactionDialog: function () { if (this.transaction !== null) { return true } else { return false } },
    showErrorDialog: function () { if (this.error !== null) { return true } else { return false } },
    account: {
      cache: false,
      get () { if (this.loggedInUser) { return this.$store.state.hive.accounts[this.loggedInUser] } else { return null } }
    },
    userMetaTokens: function () {
      if (this.for) {
        var acct = this.$store.state.hive.accounts[this.for]
        if (acct !== undefined && acct.posting_json_metadata) {
          var meta = JSON.parse(acct.posting_json_metadata)
          if (meta.profile && meta.profile.tokens) { meta.profile.tokens.hive = [this.for]; return meta.profile.tokens } else { return { hive: [this.for] } }
        } else { return { hive: [this.for] } }
      } else { return {} }
    },
    hiveBalance: function () {
      if (this.loggedInUser && this.account !== undefined) {
        return parseFloat(this.account.balance.split(' ')[0])
      } else { return null }
    },
    tradeFromWarning: function () {
      var ti = this.getTokenInfo(this.tradeFrom)
      if (this.tradeFrom && this.currenciesFull && this.ti && ti.notifications && ti.notifications.payin) { return ti.notifications.payin } else { return null }
    },
    tradeToWarning: function () {
      var ti = this.getTokenInfo(this.tradeTo)
      if (this.tradeTo && this.currenciesFull && this.ti && ti.notifications && ti.notifications.payout) { return ti.notifications.payout } else { return null }
    }
  },
  watch: {
    loggedInUser: function () { if (this.account === undefined && this.loggedInUser) { this.$store.dispatch('hive/getAccount', this.loggedInUser) } }
  },
  mounted () {
    this.getCurrenciesFull()
    if (this.exchangeId) { this.getTransaction(this.exchangeId) }
    if (this.tradeFrom && this.tradeTo) { this.updateToken() }
    if (this.account === undefined && this.loggedInUser) { this.$store.dispatch('hive/getAccount', this.loggedInUser) }
    if (this.for) { this.$store.dispatch('hive/getAccount', this.for) }
  }
}
</script>
