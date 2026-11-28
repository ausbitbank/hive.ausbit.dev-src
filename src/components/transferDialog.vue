<template>
  <q-card flat bordered style="min-width: 100px; max-width: 95%" v-if="$hiveStore.accounts[username] !== undefined" class="text-center">
    <q-card-section header>
      <h4 class="text-center text-bold q-ma-none">Transfer {{ tokenName }}</h4>
    </q-card-section>
    <q-card-section >
      <user-search-box :username="toAccount" @selectUsername="setUsername" label="To account" style="margin: auto" />
      <div v-if="false"><q-input label="To account" v-model="toAccount" /></div>
      <q-btn dense flat label="To Exchange" color="primary" icon="shortcut" v-if="toAccount === '' && network === 'hive'">
        <q-popup-proxy>
          <q-card flat bordered class="text-center">
            <q-card-section header class="text-bold text-center">
              Known {{ tokenName }} exchange accounts
            </q-card-section>
            <q-btn flat v-for="ea in exchanges" :key="ea.index" :label="ea" color="primary" @click="setUsername(ea)" v-close-popup />
          </q-card>
        </q-popup-proxy>
      </q-btn>
      <div><q-input label="Amount" v-model="amount" style="margin: auto; max-width: 200px" /></div>
      <div class="text-center text-caption" v-if="balance">Available: <button type="button" class="amount-shortcut" :aria-label="'Use available balance ' + balance + ' ' + tokenName" @click="amount = parseFloat(balance)">{{ balance }}</button> {{ tokenName }}</div>
      <div class="text-center text-caption" v-else-if="availableBalance">Available: <button type="button" class="amount-shortcut" :aria-label="'Use available balance ' + availableBalance + ' ' + tokenName" @click="amount = parseFloat(availableBalance)">{{ availableBalance }}</button> {{ tokenName }}</div>
      <div v-if="amountInvalid" class="text-center text-caption text-negative">
        Enter a positive amount{{ maxAmount ? ' up to ' + maxAmount + ' ' + tokenName : '' }}. Commas are not accepted.
      </div>
      <q-input label="Memo" autogrow v-model="memo" debounce="400" @update:model-value="checkEncryption()" style="margin: auto; max-width: 200px" clearable />
      <q-checkbox v-model="encrypted" :disable="!canEncryptMemo" :title="canEncryptMemo ? 'Encrypt the memo with the recipient memo key' : 'Memo encryption requires SmartLock on a Hive transfer'" @update:model-value="toggleEncryption()" label="Encrypt Memo" />
      <div v-if="!canEncryptMemo && memo" class="text-center text-caption q-mt-xs">
        This memo will be public. Memo encryption is available with SmartLock on a Hive transfer only.
      </div>
      <div v-if="network === 'hive'">
        <q-toggle v-model="recurrent" label="Recurring Payments" />
        <div v-if="recurrent" class="shadow-5 q-pa-sm">
          <div>
            <q-input label="Hours between payments" v-model.number="recurrentHours" style="margin: auto; max-width: 200px" />
            <q-btn-toggle no-caps rounded v-model="recurrentHours" toggle-color="primary" :options="[ { label: 'Daily', value: 24 },  {label: 'Weekly', value: 168 }, { label: 'Monthly', value: 720 }]" />
          </div>
          <q-input label="Repeat payments" v-model.number="recurrentTimes" style="margin: auto; max-width: 200px" />
          <div class="text-center">
            <q-icon name="info" color="info" size="sm" /><br />
            Will send <b class="text-primary">{{ amount }}</b> {{tokenName }} to <b class="text-primary">{{ toAccount }}</b> immediately,<br />
            repeating every <b class="text-primary">{{ recurrentHours }}</b> hours , <b class="text-primary">{{ recurrentTimes }}</b> times<br />
            For a total cost of <b class="text-primary">{{ amount * recurrentTimes }}</b> {{ tokenName }}
          </div>
          <div v-if="recurrent && exchanges.includes(toAccount)" class="text-center text-red text-bold">
            <q-icon name="warning" color="red" size="md" /><br />
            No exchanges support recurrent transfers (yet) <br />
            Don't do it !
          </div>
        </div>
      </div>
      <div v-if="exchanges.includes(toAccount) && memo === ''" class="text-center text-red shadow-5 q-pa-sm">
        <q-icon name="warning" color="red" />
        You must enter a memo to deposit to exchanges
      </div>
      <div v-if="toAccount === 'deepcrypto8' && memo.length !== 9" class="text-center text-red shadow-5 q-pa-sm">
        <q-icon name="warning" color="red" />
        Deposits to deepcrypto8 (binance) require a 9 character memo
      </div>
      <div class="text-center q-ma-md">
        <div v-if="log !== ''"><q-icon name="error" color="red" v-if="err" />{{ log }}</div>
        <q-btn dense label="Send" icon="send" color="primary" @click="doTheThing()" v-if="!sent" v-close-popup :disable="disableSendButton" />
      </div>
    </q-card-section>
  </q-card>
</template>
<script>
import userSearchBox from 'components/userSearchBox.vue'
import { parseAssetAmount } from 'src/services/signingInputs'
import { hiveEngineOperation } from 'src/services/signingInputs'
export default {
  name: 'transferDialog',
  data () {
    return {
      toAccount: this.to,
      amount: 0.000,
      memo: '',
      err: false,
      log: '',
      sent: false,
      encrypted: false,
      recurrent: false,
      recurrentHours: 24,
      recurrentTimes: 30,
      exchangesSupport: [
        { account: 'deepcrypto8', tokens: ['HIVE'] },
        { account: 'binance-hot', tokens: [] },
        { account: 'huobi-pro', tokens: ['HIVE'] },
        { account: 'huobi-withdrawal', tokens: [] },
        { account: 'blocktrades', tokens: ['HIVE', 'HBD'] },
        { account: 'mxchive', tokens: ['HIVE'] },
        { account: 'user.dunamu', tokens: ['HIVE', 'HBD'] },
        { account: 'probithive', tokens: ['HIVE'] }
        /* { account: 'probitred', tokens: [] },
        { account: 'upbitsteem', tokens: [] },
        { account: 'bithumb.hot', tokens: [] },
        { account: 'upbit-exchange', tokens: [] },
        { account: 'bitfinex', tokens: [] },
        { account: 'rudex', tokens: [] },
        { account: 'coinpayments.net', tokens: [] },
        { account: 'poloniex', tokens: [] },
        { account: 'openledger', tokens: [] },
        { account: 'openledger-dex', tokens: [] },
        { account: 'gsr-io', tokens: [] },
        { account: 'hot.dunamu', tokens: [] },
        { account: 'upbitsteemhot', tokens: [] } */
      ]
    }
  },
  props: {
    tokenName: {
      type: String,
      required: true
    },
    network: {
      type: String,
      required: false,
      default: 'hive'
    },
    balance: {
      type: Number,
      required: false,
      default: null
    },
    username: {
      type: String,
      required: true
    },
    precision: {
      type: Number,
      required: false,
      default: 3
    },
    to: {
      type: String,
      required: false,
      default: ''
    }
  },
  components: { userSearchBox },
  computed: {
    loginType () {
      return this.$hiveStore.user.loginType || ''
    },
    canEncryptMemo () {
      // Only SmartLock turns the leading `#` into a real encrypted memo. For
      // Keychain/HiveAuth (and Hive-Engine or recurrent transfers) the memo is
      // public, so the checkbox must not promise otherwise.
      const loginType = this.loginType || this.$hiveStore?.user?.loginType || ''
      return this.network === 'hive' && !this.recurrent && loginType === 'smartlock'
    },
    exchanges: function () {
      var e = []
      var x = this.exchangesSupport.filter(exchange => exchange.tokens.includes(this.tokenName))
      x.forEach(y => e.push(y.account))
      return e
    },
    availableBalance: function () {
      if (this.network === 'hive' && this.tokenName === 'HIVE') {
        return this.$hiveStore.accounts[this.username].balance.split(' ')[0]
      } else if (this.network === 'hive' && this.tokenName === 'HBD') {
        return this.$hiveStore.accounts[this.username].hbd_balance.split(' ')[0]
      } else {
        return null
      }
    },
    maxAmount () {
      if (this.balance !== null && this.balance !== undefined) return this.balance
      if (this.availableBalance !== null && this.availableBalance !== undefined) return this.availableBalance
      return null
    },
    parsedAmount () {
      return parseAssetAmount(this.amount, { precision: this.precision, max: this.maxAmount })
    },
    amountInvalid () {
      return Boolean(String(this.amount ?? '').trim()) && !this.parsedAmount
    },
    disableSendButton: function () {
      if (this.toAccount === '' || this.toAccount === null) { return true }
      if (this.recurrent && this.exchanges.includes(this.toAccount)) { return true }
      if (!this.parsedAmount) { return true }
      if (this.exchanges.includes(this.toAccount) && this.memo === '') { return true }
      return false
    }
  },
  watch: {
    canEncryptMemo (value) {
      if (value || !this.encrypted) return
      this.encrypted = false
      // The toggle added this prefix; remove only when it was actually on.
      if (this.memo.startsWith('#')) this.memo = this.memo.slice(1)
    }
  },
  methods: {
    doTheThing () {
      if (this.recurrent && this.network === 'hive') {
        this.recurrentTransfer()
      } else {
        this.transfer()
      }
    },
    setUsername (u) { this.toAccount = u },
    checkEncryption () {
      if (this.canEncryptMemo && this.memo.startsWith('#')) {
        this.encrypted = true
      } else {
        this.encrypted = false
      }
    },
    toggleEncryption () {
      if (!this.canEncryptMemo) {
        this.encrypted = false
        return
      }
      if (this.memo.startsWith('#')) {
        this.memo = this.memo.slice(1)
      } else {
        this.memo = '#' + this.memo
      }
    },
    recurrentTransfer () {
      const amount = this.parsedAmount
      if (!amount) return
      this.$hiveStore.addToQueue([this.username, 'active', ['recurrent_transfer', { to: this.toAccount, from: this.username, amount: amount + ' ' + this.tokenName, memo: this.memo, recurrence: this.recurrentHours, executions: this.recurrentTimes, extensions: [] }]])
    },
    transfer () {
      if (this.network === 'hive') {
        this.transferHive()
      } else if (this.network === 'hiveEngine') {
        this.transferHiveEngine()
      }
    },
    transferHive () {
      const amount = this.parsedAmount
      if (!amount) return
      this.$hiveStore.addToQueue([this.username, 'active', ['transfer', { to: this.toAccount, from: this.username, amount: amount + ' ' + this.tokenName, memo: this.memo }]])
    },
    transferHiveEngine () {
      const operation = hiveEngineOperation(this.username, 'tokens', 'transfer', {
        symbol: this.tokenName,
        to: this.toAccount,
        quantity: this.parsedAmount || String(this.amount),
        memo: this.memo
      })
      this.$hiveStore.addToQueue([this.username, 'active', operation])
    }
  },
  mounted () {
    if (this.$hiveStore.accounts[this.username] === undefined) {
      this.$hiveStore.getAccount(this.username)
    }
  }
}
</script>

<style scoped>
.amount-shortcut {
  padding: 0;
  border: 0;
  background: none;
  color: var(--c-primary);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.amount-shortcut:focus-visible {
  outline: 2px solid var(--c-primary);
  outline-offset: 1px;
  border-radius: var(--radius-sm);
}
</style>
